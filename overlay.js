/* =========================================================
   overlay.js —— 全局覆盖层（应用级 overlay）
   ========================================================= */
window.WujiOverlay = (() => {
  let hostEl = null;
  const stack = [];

  function ensureHost() {
    if (hostEl && hostEl.isConnected) return hostEl;
    hostEl = document.createElement('div');
    hostEl.id = 'wjOverlayHost';
    hostEl.style.cssText =
      'position:absolute;inset:0;z-index:900;display:none;touch-action:none;';

    const ALLOW = '.ov-slider, .ov-slider__knob, [data-overlay-interactive]';

    const stop = ev => {
      const t = ev.target;
      if (t && t.closest && t.closest(ALLOW)) return;
      if (ev.cancelable) ev.preventDefault();
      ev.stopPropagation();
    };

    hostEl.addEventListener('touchstart', stop, { capture: true, passive: false });
    hostEl.addEventListener('touchmove',  stop, { capture: true, passive: false });
    hostEl.addEventListener('pointerdown', stop, { capture: true, passive: false });
    hostEl.addEventListener('pointermove', stop, { capture: true, passive: false });
    hostEl.addEventListener('contextmenu', ev => ev.preventDefault());

    (document.getElementById('os') || document.body).appendChild(hostEl);
    return hostEl;
  }

  async function open(q) {
    if (!q || !q.bundlename || !q.name) return false;

    let app = WujiApps.get(q.bundlename);
    if (!app) return false;

    if (app._metaOnly) {
      if (!app._src) return false;
      try {
        await WujiAppLoader.load(app._src, app.version);
      } catch (e) {
        console.error('[WujiOverlay] 加载失败', q.bundlename, e);
        return false;
      }
      app = WujiApps.get(q.bundlename);
    }

    if (!app || !Array.isArray(app.overlays)) return false;

    const def = app.overlays.find(o => o.name === q.name);
    if (!def) {
      console.warn('[WujiOverlay] 未找到 overlay:', q.name);
      return false;
    }

    const host = ensureHost();
    const el = document.createElement('div');
    el.className = 'wj-overlay';
    el.style.cssText = 'position:absolute;inset:0;';

    if (app.styles) {
      const st = document.createElement('style');
      st.textContent = app.styles;
      el.appendChild(st);
    }

    if (def.render) el.insertAdjacentHTML('beforeend', def.render(q.data || {}));

    host.appendChild(el);
    host.style.display = 'block';
    document.getElementById('os')?.classList.add('has-overlay');

    const entry = { app, def, el, data: q.data || {} };
    stack.push(entry);

    requestAnimationFrame(() => {
      try { def.mount?.(el, { data: entry.data, close: close }); }
      catch (e) { console.error('[WujiOverlay] mount 失败', e); }
    });

    return true;
  }

  function close() {
    const entry = stack.pop();
    if (!entry) return false;
    try { entry.def.unmount?.(entry.el); } catch (e) { console.error(e); }
    entry.el.remove();
    if (!stack.length) {
      if (hostEl) hostEl.style.display = 'none';
      document.getElementById('os')?.classList.remove('has-overlay');
    }
    return true;
  }

  function closeAll() { while (stack.length) close(); }

  return {
    open,
    close,
    closeAll,
    get isOpen() { return stack.length > 0; },
  };
})();