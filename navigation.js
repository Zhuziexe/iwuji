window.WujiNavigation = class WujiNavigation {
  constructor({ host, routes, onChange } = {}) {
    this.host     = host;
    this.routes   = routes || {};
    this._listeners = new Set();
    if (typeof onChange === 'function') this._listeners.add(onChange);
    this.stack    = [];
    this._dragActive = false;
  }

  get depth()   { return this.stack.length; }
  get current() { return this.stack[this.stack.length - 1] || null; }

  /* 添加导航变化监听；返回取消函数 */
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
      pop:  () => this.pop(),
      close: () => this.destroy(),
    };

    el.innerHTML = route.render ? route.render(routeCtx) : '';

    this.host.appendChild(el);

    if (animate) {
      el.style.transform  = 'translateX(100%)';
      el.style.transition = 'transform .3s cubic-bezier(.2,.7,.3,1)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transform = 'translateX(0)';
        });
      });
    }

    this.stack.push({ route, element: el, data, ctx: routeCtx });

    requestAnimationFrame(() => {
      route.mount?.(el, routeCtx);
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

    cur.route.unmount?.();

    cur.element.style.transition = 'transform .28s cubic-bezier(.4,0,.6,1)';
    cur.element.style.transform  = 'translateX(100%)';
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
      it.route.unmount?.();
      it.element.remove();
    }
    this.push(routeOrName, data, { animate: false });
  }

  destroy() {
    while (this.stack.length) {
      const it = this.stack.pop();
      it.route.unmount?.();
      it.element.remove();
    }
    this._dragActive = false;
    this._emitChange();
  }

  /* ---------------------------------------------------------
     拖拽支持（不变）
     --------------------------------------------------------- */
  dragStart() {
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
    const w  = el.offsetWidth || 1;
    const passed = dx > w * thresholdRatio;

    if (passed) {
      this.pop();
      return true;
    }

    el.style.transition = 'transform .24s ease';
    el.style.transform  = '';
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
    el.style.transform  = '';
    setTimeout(() => {
      if (el.parentNode) el.style.transition = '';
    }, 220);
  }
};