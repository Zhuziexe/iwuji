/* =========================================================
   panelsystem.js —— 通知中心 / 控制中心 统一容器

   一个 backdrop + 一条横向 track + 两个 pane：
     track translateX(0%)   → 通知中心
     track translateX(-50%) → 控制中心
   整个容器：
     translateY(-100%) → 收起
     translateY(0%)    → 展开
   手势只在 osEl 上绑定一次，根据下拉起点的 X 坐标决定目标 pane。
   ========================================================= */
window.PanelSystem = (() => {
  const EASE = 'cubic-bezier(.2,.7,.3,1)';
  const DUR  = 340;

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

    /* 按进度插值 opacity（0 → 1），拖动/展开/收起全程平滑 */
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

      gesture = {
        mode: 'open',
        startX: x, startY: y,
        v0: -100,
        h0: (targetPane === 'nc' ? 0 : -50),
        axis: null,
        moved: false,
        fromList: false,
      };

      panel = targetPane;
      h = gesture.h0;
      v = -100;
      apply(false);
      root.classList.add('is-active');
      return;
    }

    /* 已打开：通知项横滑删除交给 item 自己处理 */
    if (target && target.closest && target.closest('.nc-item')) return;

    gesture = {
      mode: 'inside',
      startX: x, startY: y,
      v0: 0,
      h0: h,
      axis: null,
      moved: false,
      fromList: !!(target && target.closest && target.closest('.nc-list')),
    };
  }

  function moveGesture(x, y, preventFn) {
    if (!gesture) return;

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
      /* 左滑 → h 变小 → 露出控制中心；右滑 → h 靠近 0 → 回到通知中心 */
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

    if (g.axis === 'h') {
      panel = (h < -25) ? 'cc' : 'nc';
      h = (panel === 'nc') ? 0 : -50;
      apply(true);
    } else if (g.axis === 'v') {
      if (g.mode === 'open') {
        if (v > -50) { open = true; v = 0; }
        else { open = false; v = -100; }
      } else {
        if (v < -30) { open = false; v = -100; }
        else { open = true; v = 0; }
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

    /* ★ 先置 ready，否则 apply(false) 会提前 return，导致面板停在初始状态 */
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