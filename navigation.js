window.WujiNavigation = class WujiNavigation {
  constructor({ host, routes, onChange, backGesture = true } = {}) {
    this.host     = host;
    this.routes   = routes || {};
    this._listeners = new Set();
    if (typeof onChange === 'function') this._listeners.add(onChange);
    this.stack    = [];
    this._dragActive = false;

    this.backGesture = backGesture !== false;
  }

  get depth() { return this.stack.length; }
  get current() { return this.stack[this.stack.length - 1] || null; }

  isGestureBlocked() {
    const cur = this.current;
    return !!(cur && cur.route && cur.route.disableBackGesture);
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emitChange() {
    this._listeners.forEach(fn => {
      try { fn(); } catch (e) { console.error('[WujiNavigation]', e); }
    });
  }

  /* ---------------------------------------------------------
     ★ 统一的「卸载一个栈项」入口
        - 取消尚未执行的 mount
        - 优先调用 mount 返回的清理函数
        - 再调用 route.unmount
     --------------------------------------------------------- */
  _disposeItem(item) {
    if (!item || item.disposed) return;
    item.disposed = true;

    /* mount 还没跑就别跑了 */
    if (item._mountRaf) {
      cancelAnimationFrame(item._mountRaf);
      item._mountRaf = null;
    }

    /* mount 返回的清理函数 */
    if (typeof item.dispose === 'function') {
      try { item.dispose(); }
      catch (e) { console.error('[WujiNavigation] dispose', e); }
      item.dispose = null;
    }

    /* 路由级 unmount */
    try { item.route.unmount?.(); }
    catch (e) { console.error('[WujiNavigation] unmount', e); }
  }

  /* ---------------------------------------------------------
     push
     --------------------------------------------------------- */
  push(routeOrName, data = {}, { animate = true } = {}) {
    const route = typeof routeOrName === 'string'
      ? this.routes[routeOrName]
      : routeOrName;

    if (!route) {
      console.warn('[WujiNavigation] 未找到路由:', routeOrName);
      return;
    }

    const el = document.createElement('div');
    el.className = 'wj-route app-page';
    el.dataset.route = route.name || '';
    el.style.cssText = `
      position: absolute;
      inset: 0;
      background: var(--wj-bg, #fff);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      will-change: transform;
      touch-action: auto;
    `;

    const routeCtx = {
      data,
      nav: this,
      push: (r, d) => this.push(r, d),
      pop: () => this.pop(),
      close: () => this.destroy(),
    };

    el.innerHTML = route.render ? route.render(routeCtx) : '';

    this.host.appendChild(el);

    if (animate) {
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'transform .3s cubic-bezier(.2,.7,.3,1)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transform = 'translateX(0)';
        });
      });
    }

    const item = {
      route,
      element: el,
      data,
      ctx: routeCtx,
      dispose: null,       // ★ mount 的返回值放这
      disposed: false,     // ★ 是否已经卸载
      _mountRaf: 0,
    };
    this.stack.push(item);

    item._mountRaf = requestAnimationFrame(() => {
      item._mountRaf = 0;
      /* ★ 排队期间已被 pop / reset / destroy → 不再 mount */
      if (item.disposed) return;

      const ret = route.mount?.(el, routeCtx);
      if (typeof ret === 'function') item.dispose = ret;

      /* ★ 极端情况：mount 执行过程中被卸载（比如 mount 里同步调用了 pop） */
      if (item.disposed && item.dispose) {
        try { item.dispose(); } catch (e) { console.error(e); }
        item.dispose = null;
      }
    });

    this._emitChange();
    return el;
  }

  /* ---------------------------------------------------------
     pop
     --------------------------------------------------------- */
  pop() {
    if (this.stack.length <= 1) return false;

    const cur  = this.stack.pop();
    const prev = this.stack[this.stack.length - 1];

    this._disposeItem(cur);   // ★ 统一卸载

    cur.element.style.transition = 'transform .28s cubic-bezier(.4,0,.6,1)';
    cur.element.style.transform = 'translateX(100%)';
    setTimeout(() => cur.element.remove(), 300);

    prev.element.style.transform = 'translateX(0)';

    this._emitChange();
    return true;
  }

  /* ---------------------------------------------------------
     reset / destroy
     --------------------------------------------------------- */
  reset(routeOrName, data = {}) {
    while (this.stack.length) {
      const it = this.stack.pop();
      this._disposeItem(it);   // ★
      it.element.remove();
    }
    this.push(routeOrName, data, { animate: false });
  }

  destroy() {
    while (this.stack.length) {
      const it = this.stack.pop();
      this._disposeItem(it);   // ★
      it.element.remove();
    }
    this._dragActive = false;
    this._emitChange();
  }

  dragStart() {
    if (this.isGestureBlocked()) return false;
    if (this.depth <= 1) return false;
    const cur = this.stack[this.stack.length - 1];
    if (!cur || !cur.element) return false;
    cur.element.style.transition = 'none';
    this._dragActive = true;
    return true;
  }

  dragMove(dx) {
    if (!this._dragActive) return;
    if (this.depth <= 1) return;
    const cur = this.stack[this.stack.length - 1];
    if (!cur || !cur.element) return;
    const clamped = Math.max(0, dx);
    cur.element.style.transform = `translateX(${clamped}px)`;
  }

  dragEnd(dx, thresholdRatio = 0.32) {
    if (!this._dragActive) return false;
    this._dragActive = false;
    if (this.depth <= 1) return false;

    const cur = this.stack[this.stack.length - 1];
    if (!cur || !cur.element) return false;

    const el = cur.element;
    const w = el.offsetWidth || 1;
    const passed = dx > w * thresholdRatio;

    if (passed) {
      this.pop();
      return true;
    }

    el.style.transition = 'transform .24s ease';
    el.style.transform = '';
    setTimeout(() => {
      if (el.parentNode) el.style.transition = '';
    }, 260);
    return false;
  }

  dragCancel() {
    if (!this._dragActive) return;
    this._dragActive = false;
    if (this.depth <= 1) return;

    const cur = this.stack[this.stack.length - 1];
    if (!cur || !cur.element) return;

    const el = cur.element;
    el.style.transition = 'transform .2s ease';
    el.style.transform = '';
    setTimeout(() => {
      if (el.parentNode) el.style.transition = '';
    }, 220);
  }
};