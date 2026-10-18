/* =========================================================
   panelsystem.js —— 通知中心 / 控制中心 统一容器

   一个 backdrop + 一条横向 track + 两个 pane：
     track translateX(0%)   → 通知中心
     track translateX(-50%) → 控制中心
   整个容器：
     translateY(-100%) → 收起
     translateY(0%)    → 展开

   手势：追踪速度，快速滑动时按方向直接完成，不必拖到距离阈值。
   ========================================================= */
window.PanelSystem = (() => {
  const EASE = 'cubic-bezier(.2,.7,.3,1)';
  const DUR  = 340;

  /* 速度阈值（px/ms）—— 快速滑动判定 */
  const V_THRESH   = 0.3;
  /* 速度触发所需的最小位移（避免轻点误触） */
  const MIN_DIST   = 18;
  /* 松手前多少毫秒内没动就认为「停住了」，忽略速度 */
  const STALE_MS   = 100;

  let root     = null;
  let track    = null;
  let backdrop = null;
  let osEl     = null;

  let v = -100;        // -100 = 收起，0 = 展开
  let h = 0;           // 0 = 通知中心，-50 = 控制中心
  let open = false;
  let panel = 'nc';    // 'nc' | 'cc'

  let gesture = null;
  let ready = false;

  function apply(animate = true) {
    if (!ready) return;

    if (animate) {
      root.style.transition     = `transform ${DUR}ms ${EASE}`;
      track.style.transition    = `transform ${DUR}ms ${EASE}`;
      backdrop.style.transition = `opacity ${DUR}ms ${EASE}`;
    } else {
      root.style.transition     = 'none';
      track.style.transition    = 'none';
      backdrop.style.transition = 'none';
    }

    root.style.transform  = `translateY(${v}%)`;
    track.style.transform = `translateX(${h}%)`;

    const progress = Math.max(0, Math.min(1, (v + 100) / 100));
    backdrop.style.opacity = String(progress);

    root.classList.toggle('is-active', v > -100);

    osEl.classList.toggle('panel-open', open);
    osEl.classList.toggle('nc-open', open && panel === 'nc');
    osEl.classList.toggle('cc-open', open && panel === 'cc');
  }

  /* ---------------- 打开 / 关闭 / 切 pane ---------------- */
  function openPanel(p, animate = true) {
    if (!ready) return;
    panel = (p === 'cc') ? 'cc' : 'nc';
    h = (panel === 'nc') ? 0 : -50;
    v = 0;
    open = true;

    try { WujiNotification?.hideBanner?.(); } catch { }

    apply(animate);
  }

  function closePanel(animate = true) {
    if (!ready) return;
    v = -100;
    open = false;
    apply(animate);
  }

  function setPanel(p, animate = true) {
    if (!ready) return;
    const next = (p === 'cc') ? 'cc' : 'nc';
    if (panel === next) return;
    panel = next;
    h = (panel === 'nc') ? 0 : -50;
    apply(animate);
  }

  /* ---------------- 手势 ---------------- */
  function makeGesture(patch) {
    const now = performance.now();
    return {
      axis: null,
      moved: false,
      fromList: false,
      /* ★ 速度追踪 */
      lastX: 0, lastY: 0, lastT: now,
      vx: 0, vy: 0,
      ...patch,
    };
  }

  function startGesture(target, x, y) {
    if (window.WujiOverlay?.isOpen) return;
    if (osEl.dataset.power !== 'running') return;
    if (osEl.dataset.view === 'locked') return;
    if (gesture) return;

    /* ★ 排除控制中心的滑块（音量 / 亮度），避免在滑块上滑动时误触关闭 */
    if (target && target.closest && target.closest('.cc-slider-card')) return;
    /* ★ 排除控制中心的 toggle，避免按钮上的触摸被当作面板手势 */
    if (target && target.closest && target.closest('.cc-toggle')) return;

    const rect = osEl.getBoundingClientRect();
    const ly = y - rect.top;
    const rx = (x - rect.left) / rect.width;

    if (!open) {
      /* 仅顶部 30px 内下拉可触发 */
      if (ly > 30) return;

      const targetPane = rx < 0.5 ? 'nc' : 'cc';

      gesture = makeGesture({
        mode: 'open',
        startX: x, startY: y,
        v0: -100,
        h0: (targetPane === 'nc' ? 0 : -50),
        lastX: x, lastY: y,
      });

      panel = targetPane;
      h = gesture.h0;
      v = -100;
      apply(false);
      root.classList.add('is-active');
      return;
    }

    /* 已打开：通知项横滑删除交给 item 自己处理 */
    if (target && target.closest && target.closest('.nc-item')) return;

    gesture = makeGesture({
      mode: 'inside',
      startX: x, startY: y,
      v0: 0,
      h0: h,
      lastX: x, lastY: y,
      fromList: !!(target && target.closest && target.closest('.nc-list')),
    });
  }

  function moveGesture(x, y, preventFn) {
    if (!gesture) return;

    /* ★ 速度追踪（指数平滑，缓解单帧抖动） */
    const now = performance.now();
    const mdt = now - gesture.lastT;
    if (mdt > 0) {
      const mdx = x - gesture.lastX;
      const mdy = y - gesture.lastY;
      gesture.vx = gesture.vx * 0.5 + (mdx / mdt) * 0.5;
      gesture.vy = gesture.vy * 0.5 + (mdy / mdt) * 0.5;
    }
    gesture.lastX = x;
    gesture.lastY = y;
    gesture.lastT = now;

    const dx = x - gesture.startX;
    const dy = y - gesture.startY;

    if (!gesture.moved) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      gesture.moved = true;

      if (gesture.mode === 'open') {
        gesture.axis = 'v';
      } else {
        if (Math.abs(dx) > Math.abs(dy) * 1.2) {
          gesture.axis = 'h';
        } else if (dy < 0) {
          /* 列表已经滚动过 → 不拦，让列表自己滚 */
          if (gesture.fromList) {
            const list = document.getElementById('ncList');
            if (list && list.scrollTop > 0) { gesture = null; return; }
          }
          gesture.axis = 'v';
        } else {
          gesture = null;
          return;
        }
      }
    }

    if (gesture.axis === 'h') {
      if (preventFn) preventFn();
      const W = window.innerWidth;
      let nh = gesture.h0 + (dx / W) * 50;
      nh = Math.max(-50, Math.min(0, nh));
      h = nh;
      apply(false);
    } else if (gesture.axis === 'v') {
      if (preventFn) preventFn();
      const H = window.innerHeight;
      let nv = gesture.v0 + (dy / H) * 100;
      nv = Math.max(-100, Math.min(0, nv));
      v = nv;
      apply(false);
    }
  }

  function endGesture() {
    if (!gesture) return;
    const g = gesture;
    gesture = null;

    if (!g.moved) { apply(true); return; }

    /* ★ 速度判定：松手前 STALE_MS 内没动 → 认为停住，速度清零 */
    const now = performance.now();
    const stale = (now - g.lastT) > STALE_MS;
    const vx = stale ? 0 : g.vx;
    const vy = stale ? 0 : g.vy;
    const dxTotal = g.lastX - g.startX;
    const dyTotal = g.lastY - g.startY;

    const fastH = Math.abs(vx) > V_THRESH && Math.abs(dxTotal) > MIN_DIST;
    const fastV = Math.abs(vy) > V_THRESH && Math.abs(dyTotal) > MIN_DIST;

    if (g.axis === 'h') {
      let target;
      if (fastH) {
        /* 左快滑 → 控制中心；右快滑 → 通知中心 */
        target = vx < 0 ? 'cc' : 'nc';
      } else {
        target = (h < -25) ? 'cc' : 'nc';
      }
      panel = target;
      h = (panel === 'nc') ? 0 : -50;
      apply(true);

    } else if (g.axis === 'v') {
      if (g.mode === 'open') {
        /* 下拉打开：向下快滑 → 打开；向上快滑 → 放弃 */
        if (fastV && vy > 0)        { open = true;  v = 0; }
        else if (fastV && vy < 0)   { open = false; v = -100; }
        else if (v > -50)           { open = true;  v = 0; }
        else                        { open = false; v = -100; }
      } else {
        /* 已打开：向上快滑 → 关闭；向下快滑 → 保持 */
        if (fastV && vy < 0)        { open = false; v = -100; }
        else if (fastV && vy > 0)   { open = true;  v = 0; }
        else if (v < -30)           { open = false; v = -100; }
        else                        { open = true;  v = 0; }
      }
      apply(true);

    } else {
      apply(true);
    }
  }

  /* ---------------- 事件绑定（只绑一次） ---------------- */
  function bind() {
    osEl.addEventListener('touchstart', e => {
      const t = e.touches[0];
      if (!t) return;
      startGesture(e.target, t.clientX, t.clientY);
    }, { capture: true, passive: true });

    osEl.addEventListener('touchmove', e => {
      if (!gesture) return;
      const t = e.touches[0];
      if (!t) return;
      moveGesture(t.clientX, t.clientY, () => {
        if (e.cancelable) e.preventDefault();
      });
    }, { capture: true, passive: false });

    osEl.addEventListener('touchend', endGesture);
    osEl.addEventListener('touchcancel', endGesture);

    osEl.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      startGesture(e.target, e.clientX, e.clientY);
    }, { capture: true });

    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      if (!gesture) return;
      moveGesture(e.clientX, e.clientY, null);
    });

    document.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse') return;
      endGesture();
    });

    document.addEventListener('pointercancel', e => {
      if (e.pointerType !== 'mouse') return;
      endGesture();
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    if (ready) return;

    root     = document.getElementById('panelSystem');
    track    = document.getElementById('panelTrack');
    backdrop = document.getElementById('panelBackdrop');
    osEl     = document.getElementById('os');

    if (!root || !track || !backdrop || !osEl) {
      console.warn('[PanelSystem] 缺少 DOM 节点，初始化失败');
      return;
    }

    ready = true;

    apply(false);
    root.classList.remove('is-active');
    bind();
  }

  /* ---------------- 导出 ---------------- */
  return {
    init,
    open:     (p = 'nc') => openPanel(p, true),
    close:    () => closePanel(true),
    setPanel: (p) => setPanel(p, true),
    get isOpen() { return open; },
    get panel()  { return panel; },
  };
})();