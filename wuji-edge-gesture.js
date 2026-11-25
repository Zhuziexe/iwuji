/* =========================================================
   wuji-edge-gesture.js —— 边缘侧滑返回手势 + 吸附手柄

   行为（Android 定制系统风格）：
     - 手指从屏幕左 / 右边缘向内滑动时激活
     - 灰色半圆/胶囊手柄吸附在侧边，只向外凸出一点点，跟随手指上下移动
       但不会移到屏幕中间；当前页面保持不动
     - 手柄图标：桌面/多任务"≡"，应用内"<"/">"
     - 松手回退到阈值外 → 手柄缩回、取消
     - 达到阈值后松手 → 触发回调（固定时长转场，目标固定）
     - 应用内达到阈值后持续按住 1200ms → 图标变"≡"（进入多任务）
     - 锁屏/密码界面、下拉面板打开时不生效

   依赖：无，挂载到 window.WujiEdgeGesture（工厂函数）
   ========================================================= */
(() => {
  'use strict';

  const SVG_CHEVRON_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4 7 12l8 8"/></svg>`;
  const SVG_CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4l8 8-8 8"/></svg>`;
  const SVG_HOME = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

  const HOLD_MS = 1200;
  const EDGE_W = 30;          // 边缘激活区宽度(px)
  const DIR_LOCK = 10;        // 方向锁定阈值(px)
  const DEFAULT_THRESHOLD = 70; // 默认触发阈值(px)

  /**
   * @param {Object} cfg
   *   host       : HTMLElement        手势监听宿主（一般为 #os）
   *   threshold  : number|function    触发阈值(px)，可为函数 (side)=>px
   *   canStart   : function(x,y,side) 是否允许开始（锁屏/面板等在此拦截）
   *   modeForSide: function(side)     'back' | 'home'，决定初始图标与是否允许长按切换
   *   onProgress : function(p, side, y) 进度变化 0..1
   *   onCommit   : function(side, mode, y) 松手达标
   *   onCancel   : function() 取消
   */
  function create(cfg) {
    cfg = cfg || {};
    const host = cfg.host;
    if (!host) throw new Error('[WujiEdgeGesture] 缺少 host');

    /* ---------------- 手柄 DOM ----------------
       形状：一整条平滑曲线（像机子边框被向外拉弯），不是胶囊突块。
       用 SVG 画：上下两端贴边，中段向外凸出，整体连续无折角。 */
    const handle = document.createElement('div');
    handle.className = 'wj-edge-handle';
    handle.dataset.side = 'left';
    handle.dataset.icon = 'back';
    handle.innerHTML = `
      <svg class="wj-edge-handle__curve" viewBox="0 0 36 120" preserveAspectRatio="none" aria-hidden="true">
        <path class="wj-edge-handle__curve-path" d=""></path>
      </svg>
      <div class="wj-edge-handle__icon"></div>
    `;
    const curveEl = handle.querySelector('.wj-edge-handle__curve-path');
    const iconEl = handle.querySelector('.wj-edge-handle__icon');
    host.appendChild(handle);

    /* 平滑曲线：两段三次贝塞尔拼成的"月牙"。
    关键：端点处控制点与端点同 x（切线竖直，与机身边框相切 → 无折角）；
    中段两段在 (24,50) 处切线同为竖直 → 衔接处也无折角。
       整体像边框被向外拉弯：上下贴边、中段凸出，连续一整条。 */
    const CURVE_LEFT = 'M 0 0 C 0 24, 30 36, 30 60 C 30 84, 0 96, 0 120 Z';
    const CURVE_RIGHT = 'M 36 0 C 36 24, 6 36, 6 60 C 6 84, 36 96, 36 120 Z';

    function setIcon(side, type) {
      handle.dataset.side = side;
      handle.dataset.icon = type;
      curveEl.setAttribute('d', side === 'right' ? CURVE_RIGHT : CURVE_LEFT);
      if (type === 'home') iconEl.innerHTML = SVG_HOME;
      else iconEl.innerHTML = (side === 'right') ? SVG_CHEVRON_LEFT : SVG_CHEVRON_RIGHT;
    }

    let visible = false;
    function showHandle(side, type, y) {
      setIcon(side, type);
      handle.style.top = y + 'px';
      if (!visible) {
        visible = true;
        /* 完全靠 CSS transition：先无动画置于「完全藏住」，再下一帧加 is-show
           平滑滑到「凸出一点」；收回时移除 is-show 会平滑滑回屏幕外，方向一致。 */
        handle.classList.add('no-anim');
        handle.classList.remove('is-show');
        void handle.offsetWidth;
        handle.classList.remove('no-anim');
        handle.classList.add('is-show');
      }
    }
    function moveHandle(y) {
      handle.style.top = y + 'px';
    }
    function setProgress(side, p) {
      handle.style.setProperty('--p', String(Math.max(0, Math.min(1, p))));
    }
    function hideHandle() {
      if (!visible) return;
      handle.classList.remove('is-show');
      visible = false;
      /* 保留 --p 到收回动画结束再清，避免收回瞬间 transform 目标跳变 */
      handle.style.setProperty('--p', '0');
    }

    /* ---------------- 状态 ---------------- */
    let active = false;
    let pointerId = null;
    let side = null;              // 'left' | 'right'
    let mode = 'back';            // 'back' | 'home'
    let startX = 0, startY = 0;
    let dir = null;               // 'h' | 'v' | null
    let progress = 0;
    let holdTimer = null;
    let holdFired = false;

    function thresholdFor(s) {
      const t = cfg.threshold;
      if (typeof t === 'function') return t(s);
      return t || DEFAULT_THRESHOLD;
    }

    function fireHold() {
      if (!active || holdFired || progress < 1) return;
      holdFired = true;
      mode = 'home';
      setIcon(side, 'home');
      try { cfg.onModeChange?.('home'); } catch { }
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    /* 一次性 setTimeout：到达阈值并停住即触发，不依赖持续 move，
       setTimeout 不受 rAF 节流影响（后台标签/低帧率下也准）。 */
    function startHoldCheck() {
      if (holdTimer || holdFired) return;
      holdTimer = setTimeout(() => {
        holdTimer = null;
        fireHold();
      }, HOLD_MS);
    }
    function clearHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      holdFired = false;
    }

    function reset() {
      active = false;
      pointerId = null;
      side = null;
      dir = null;
      progress = 0;
      mode = 'back';
      holdFired = false;
      clearHold();
      hideHandle();
    }

    /* ---------------- 手势流程 ---------------- */
    function begin(x, y, id) {
      if (active) return false;
      const rect = host.getBoundingClientRect();
      const localX = x - rect.left;
      const localY = y - rect.top;

      let s = null;
      if (localX <= EDGE_W) s = 'left';
      else if (localX >= rect.width - EDGE_W) s = 'right';
      if (!s) return false;

      try {
        if (cfg.canStart && cfg.canStart(localX, localY, s) === false) return false;
      } catch { return false; }

      active = true;
      pointerId = id;
      side = s;
      startX = localX;
      startY = localY;
      dir = null;
      progress = 0;
      holdFired = false;
      mode = 'back';
      try { mode = cfg.modeForSide ? cfg.modeForSide(s) : 'back'; } catch { }
      return true;
    }

    function move(x, y, id, preventFn) {
      if (!active) return;
      if (pointerId !== null && id !== pointerId) return;
      const rect = host.getBoundingClientRect();
      const localX = x - rect.left;
      const localY = y - rect.top;
      const dx = localX - startX;
      const dy = localY - startY;

      // 向内为正
      const inward = (side === 'left') ? dx : -dx;

      if (!dir) {
        if (Math.abs(dx) < DIR_LOCK && Math.abs(dy) < DIR_LOCK) return;
        if (Math.abs(dx) < Math.abs(dy) || inward <= 0) {
          // 竖直方向或向外 → 不是返回手势，交给系统（下拉面板等）
          reset();
          return;
        }
        dir = 'h';
        try { preventFn?.(); } catch { }
        showHandle(side, mode, localY);
      }
      if (dir !== 'h') return;

      try { preventFn?.(); } catch { }

      const th = thresholdFor(side) || DEFAULT_THRESHOLD;
      progress = Math.max(0, Math.min(1, inward / th));

      // 手柄：吸附侧边，只凸出一点点（最大 ~14px），跟随手指上下移动
      setProgress(side, progress);
      moveHandle(Math.max(8, Math.min(rect.height - 8, localY)));

      const holdAllowed = (typeof cfg.allowHold === 'function')
        ? cfg.allowHold(side)
        : cfg.allowHold !== false;
      if (progress >= 0.98) {
        /* 容差：接近阈值(0.98)就当作到达，避免手指在阈值线附近微抖
           导致计时器被反复 clear→重arm，永远走不满时长。 */
        if (mode === 'back' && holdAllowed && !holdFired) startHoldCheck();
      } else if (progress < 0.8) {
        /* 只有明显退回阈值内(0.8)才真正取消，抗抖动 */
        const wasFired = holdFired;
        clearHold();
        if (wasFired) {
          mode = (() => { try { return cfg.modeForSide ? cfg.modeForSide(side) : 'back'; } catch { return 'back'; } })();
          setIcon(side, mode);
        }
      }
      /* 0.8~0.98 之间保持现状，不动计时器 */

      try { cfg.onProgress?.(progress, side, localY); } catch { }
    }

    function end(x, y, id) {
      if (!active) return;
      if (pointerId !== null && id != null && id !== pointerId) return;
      const committed = dir === 'h' && progress >= 0.98;
      const finalMode = mode;
      const finalSide = side || 'left';
      clearHold();
      reset();
      if (committed) {
        try { cfg.onCommit?.(finalSide, finalMode, y); } catch (e) { console.error('[WujiEdgeGesture] commit', e); }
      } else {
        try { cfg.onCancel?.(); } catch { }
      }
    }

    function cancel() {
      if (!active) return;
      reset();
      try { cfg.onCancel?.(); } catch { }
    }

    /* ---------------- 事件绑定 ---------------- */
    // 触摸：用 capture 保证在子视图（appScreen / 桌面）之前拿到
    host.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      begin(t.clientX, t.clientY, 'touch');
    }, { capture: true, passive: true });

    host.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (!t) return;
      move(t.clientX, t.clientY, 'touch', () => {
        if (e.cancelable) e.preventDefault();
      });
    }, { capture: true, passive: false });

    host.addEventListener('touchend', e => {
      const t = e.changedTouches && e.changedTouches[0];
      end(t ? t.clientX : 0, t ? t.clientY : 0, 'touch');
    }, { capture: true });
    host.addEventListener('touchcancel', () => cancel(), { capture: true });

    // 鼠标：仅左键，开始必须在边缘
    host.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      begin(e.clientX, e.clientY, 'mouse');
    }, { capture: true });

    host.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      move(e.clientX, e.clientY, 'mouse', null);
    }, { capture: true });

    host.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse') return;
      end(e.clientX, e.clientY, 'mouse');
    }, { capture: true });
    host.addEventListener('pointercancel', e => {
      if (e.pointerType !== 'mouse') return;
      cancel();
    }, { capture: true });

    return {
      hide: hideHandle,
      get active() { return active; },
      destroy() {
        reset();
        handle.remove();
      },
    };
  }

  window.WujiEdgeGesture = { create, HOLD_MS, EDGE_W };
})();
