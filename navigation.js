window.WujiNavigation = class WujiNavigation {
  constructor({ host, routes, onChange } = {}) {
    this.host = host;
    this.routes = routes || {};
    this._listeners = new Set();
    if (typeof onChange === 'function') this._listeners.add(onChange);
    this.stack = [];
    this._dragActive = false;
  }

  get depth() { return this.stack.length; }
  get current() { return this.stack[this.stack.length - 1] || null; }

  /* ★ 应用不再动态设置是否允许返回手势；侧滑返回不与中间横滑冲突。
     仅通过全局 disablebackgesture（3D 游戏类）在宿主侧整体关闭。
     页面级 dataset.blockBackGesture 仅用于控制输入法/浮层，不拦截侧滑。 */
  isGestureBlocked() { return false; }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** 公开：恢复前台/切 view 后，按当前 route 重新同步状态栏声明 */
  syncStatusBar() { this._syncStatusBar(); }

  _emitChange() {
    this._syncStatusBar();
    this._listeners.forEach(fn => {
      try { fn(); } catch (e) { console.error('[WujiNavigation]', e); }
    });
  }

  /* 依据当前 route 的 statusBar 声明同步状态栏外观。
     声明格式（route 上）：
       statusBar: {
         immersive: true,          // 沉浸：隐藏状态栏（游戏类等）
         color: 'dark' | 'light',  // 黑字 / 白字，默认 'dark'
         gradient: true | false    // 是否带渐变遮罩，默认 true
       }
     未声明 → 'dark-gradient'（黑字 + 白色渐变，系统默认）。 */
  _syncStatusBar() {
    const osEl = document.getElementById('os');
    if (!osEl) return;
    const item = this.current;
    /* ★ 没有活动页面（栈被 destroy 清空）且当前不在应用页时，不要改状态栏，
       否则杀后台时 nav.destroy() 会把多任务/桌面的白色状态栏改成默认黑字。 */
    if (!item && osEl.dataset.view !== 'app') return;
    const cfg = (item && item.route && item.route.statusBar) || null;
    let mode = 'dark-gradient';
    if (cfg && typeof cfg === 'object') {
      if (cfg.immersive) mode = 'immersive';
      else {
        const color = cfg.color === 'light' ? 'light' : 'dark';
        const grad = cfg.gradient === false ? 'flat' : 'gradient';
        mode = color + '-' + grad;
      }
    }
    osEl.dataset.statusbar = mode;

    /* 进入沉浸页（状态栏隐藏）时收起通知/控制中心，避免“无状态栏却挂着面板” */
    if (mode === 'immersive') {
      try { if (window.PanelSystem?.isOpen) window.PanelSystem.close(); } catch { }
    }
  }

  /* =========================================================
     转场表
       每个转场两个方法：enter(el, origin) / exit(el, origin)
       origin: { x, y, w, h } —— 页面坐标系（getBoundingClientRect 直接拿）
       应用通过 push 的第三参 { transition, origin } 传入
     ========================================================= */
  static get TRANSITIONS() {
    return {
      slide: {
        enter(el) {
          el.style.transform = 'translateX(100%)';
          el.style.transition = 'transform .3s cubic-bezier(.2,.7,.3,1)';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.transform = 'translateX(0)';
          }));
        },
        exit(el) {
          el.style.transition = 'transform .28s cubic-bezier(.4,0,.6,1)';
          el.style.transform = 'translateX(100%)';
        },
      },

      'slide-up': {
        enter(el) {
          el.style.transform = 'translateY(100%)';
          el.style.transition = 'transform .3s cubic-bezier(.2,.7,.3,1)';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.transform = 'translateY(0)';
          }));
        },
        exit(el) {
          el.style.transition = 'transform .28s cubic-bezier(.4,0,.6,1)';
          el.style.transform = 'translateY(100%)';
        },
      },

      fade: {
        enter(el) {
          el.style.opacity = '0';
          el.style.transition = 'opacity .26s ease';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.opacity = '1';
          }));
        },
        exit(el) {
          el.style.transition = 'opacity .22s ease';
          el.style.opacity = '0';
        },
      },

      zoom: {
        enter(el, origin) {
          if (!origin) return WujiNavigation.TRANSITIONS.fade.enter(el);
          const host = el.parentElement;
          const hostRect = host.getBoundingClientRect();
          const sx = origin.w / hostRect.width;
          const sy = origin.h / hostRect.height;
          const tx = origin.x - hostRect.left;
          const ty = origin.y - hostRect.top;

          el.dataset.zooming = '1';
          el.style.transformOrigin = 'top left';

          el.style.transition = 'none';
          el.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
          el.style.opacity = '0';

          void el.offsetWidth;

          requestAnimationFrame(() => {
            el.style.transition = 'transform .38s cubic-bezier(.2,.7,.3,1), opacity .2s ease';
            requestAnimationFrame(() => {
              el.style.transform = 'translate(0, 0) scale(1)';
              el.style.opacity = '1';
            });
          });
          /* ★ 动画结束后彻底清掉 transform / transformOrigin / will-change：
             残留的 transform 会留下一个合成层，在窗口 overflow:visible 的场景下
             可能越出窗口下缘，画出一条被裁切的图片行（图库打开图片时的“小横条”）。 */
          setTimeout(() => {
            delete el.dataset.zooming;
            if (el.style.transform === 'translate(0, 0) scale(1)') {
              el.style.transition = '';
              el.style.transform = '';
              el.style.transformOrigin = '';
              el.style.willChange = '';
            }
          }, 420);
        },

        exit(el, origin) {
          if (!origin) return WujiNavigation.TRANSITIONS.fade.exit(el);
          const host = el.parentElement;
          const hostRect = host.getBoundingClientRect();
          const sx = origin.w / hostRect.width;
          const sy = origin.h / hostRect.height;
          const tx = origin.x - hostRect.left;
          const ty = origin.y - hostRect.top;

          el.dataset.zooming = '1';
          el.style.transformOrigin = 'top left';
          el.style.transition =
            'transform .38s cubic-bezier(.2,.7,.3,1), opacity .2s ease';
          el.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
          el.style.opacity = '0';
          setTimeout(() => { delete el.dataset.zooming; }, 380);
        },
      },

      none: {
        enter() { },
        exit() { },
      },
    };
  }

  _getTransition(type) {
    return WujiNavigation.TRANSITIONS[type] || WujiNavigation.TRANSITIONS.slide;
  }

  /* ---------------------------------------------------------
     ★ 统一的「卸载一个栈项」入口
     --------------------------------------------------------- */
  _disposeItem(item) {
    if (!item || item.disposed) return;
    item.disposed = true;

    if (item._mountRaf) {
      cancelAnimationFrame(item._mountRaf);
      item._mountRaf = null;
    }

    if (typeof item.dispose === 'function') {
      try { item.dispose(); }
      catch (e) { console.error('[WujiNavigation] dispose', e); }
      item.dispose = null;
    }

    try { item.route.unmount?.(); }
    catch (e) { console.error('[WujiNavigation] unmount', e); }
  }

  /* ---------------------------------------------------------
     push
     选项新增 onResult：(result, data) => void
     当本页面被 pop 时，把 result 回传给调用方
     --------------------------------------------------------- */
  push(routeOrName, data = {}, { animate = true, transition, origin, onResult } = {}) {
    const route = typeof routeOrName === 'string'
      ? this.routes[routeOrName]
      : routeOrName;

    if (!route) {
      console.warn('[WujiNavigation] 未找到路由:', routeOrName);
      return;
    }

    /* ★ 转场类型：显式传入 > route.transition > 默认 slide */
    const type = transition || route.transition || 'slide';
    const t = this._getTransition(type);

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
      touch-action: auto;
    `;

    const routeCtx = {
      data,
      nav: this,
      push: (r, d, opts) => this.push(r, d, opts),   /* ★ 透传选项 */
      pop: (result) => this.pop(result),             /* ★ 透传回传值 */
      close: () => {
        if (window.WujiAppLauncher && typeof window.WujiAppLauncher.close === 'function') {
          window.WujiAppLauncher.close();
        } else {
          this.destroy();
        }
      },
    };

    el.innerHTML = route.render ? route.render(routeCtx) : '';

    this.host.appendChild(el);

    if (animate) {
      el.style.willChange = 'transform, opacity';

      try { t.enter(el, origin); }
      catch (e) { console.error('[WujiNavigation] enter', type, e); }

      setTimeout(() => {
        if (el.isConnected) el.style.willChange = '';
      }, 500);
    }

    const item = {
      route,
      element: el,
      data,
      ctx: routeCtx,
      dispose: null,
      disposed: false,
      _mountRaf: 0,
      transitionType: type,
      transitionOrigin: origin || null,
      onResult: typeof onResult === 'function' ? onResult : null,
    };
    this.stack.push(item);

    item._mountRaf = requestAnimationFrame(() => {
      item._mountRaf = 0;
      if (item.disposed) return;

      const ret = route.mount?.(el, routeCtx);
      if (typeof ret === 'function') item.dispose = ret;

      if (item.disposed && item.dispose) {
        try { item.dispose(); } catch (e) { console.error(e); }
        item.dispose = null;
      }
    });

    this._emitChange();
    return el;
  }

  /* ---------------------------------------------------------
     pop(result)
     result 会通过 push 时传入的 onResult 回传给调用方
     --------------------------------------------------------- */
  pop(result) {
    if (this.stack.length <= 1) return false;

    const cur = this.stack.pop();
    const prev = this.stack[this.stack.length - 1];

    /* ★ 先回传结果，再卸载页面 */
    if (typeof cur.onResult === 'function') {
      try { cur.onResult(result, cur.data); }
      catch (e) { console.error('[WujiNavigation] onResult', e); }
    }

    this._disposeItem(cur);

    /* ★ 用该次 push 时的转场类型做反向动画 */
    const t = this._getTransition(cur.transitionType);
    cur.element.style.willChange = 'transform, opacity';
    try { t.exit(cur.element, cur.transitionOrigin); }
    catch (e) { console.error('[WujiNavigation] exit', e); }

    /* 留足退出动画时间再移除 */
    const duration = (cur.transitionType === 'slide' || cur.transitionType === 'slide-up')
      ? 320 : 340;
    setTimeout(() => {
      if (cur.element.parentNode) cur.element.remove();
    }, duration);

    /* 让底层页面恢复原位（slide 系列才需要，其它转场底层一直是原位） */
    if (prev.element) prev.element.style.transform = 'translateX(0)';

    this._emitChange();
    return true;
  }

  /* ---------------------------------------------------------
     reset / destroy
     --------------------------------------------------------- */
  reset(routeOrName, data = {}) {
    while (this.stack.length) {
      const it = this.stack.pop();
      this._disposeItem(it);
      it.element.remove();
    }
    this.push(routeOrName, data, { animate: false });
  }

  destroy() {
    while (this.stack.length) {
      const it = this.stack.pop();
      this._disposeItem(it);
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
    cur.element.style.willChange = 'transform, opacity';
    if (cur.transitionType === 'zoom' && cur.transitionOrigin) {
      cur.element.style.transformOrigin = 'top left';
    }
    this._dragActive = true;
    return true;
  }

  dragMove(dx) {
    if (!this._dragActive) return;
    if (this.depth <= 1) return;
    const cur = this.stack[this.stack.length - 1];
    if (!cur || !cur.element) return;

    const el = cur.element;
    const clamped = Math.max(0, dx);
    const w = el.offsetWidth || 1;

    if (cur.transitionType === 'slide-up') {
      const p = Math.max(0, Math.min(1, clamped / (w * 0.8)));
      el.style.transform = `translateY(${p * 100}%)`;
      return;
    }

    if (cur.transitionType !== 'zoom' || !cur.transitionOrigin) {
      el.style.transform = `translateX(${clamped}px)`;
      return;
    }

    const origin = cur.transitionOrigin;
    const host = el.parentElement;
    const hostRect = host.getBoundingClientRect();
    const sx = origin.w / hostRect.width;
    const sy = origin.h / hostRect.height;
    const tx = origin.x - hostRect.left;
    const ty = origin.y - hostRect.top;

    const p = Math.max(0, Math.min(1, clamped / (w * 0.6)));

    const csx = 1 + (sx - 1) * p;
    const csy = 1 + (sy - 1) * p;
    const ctx_ = tx * p;
    const cty = ty * p;

    el.style.transform = `translate(${ctx_}px, ${cty}px) scale(${csx}, ${csy})`;
    el.style.opacity = String(1 - p);
  }

  dragEnd(dx, thresholdRatio = 0.32) {
    if (!this._dragActive) return false;
    this._dragActive = false;
    if (this.depth <= 1) return false;

    const cur = this.stack[this.stack.length - 1];
    if (!cur || !cur.element) return false;

    const el = cur.element;
    const w = el.offsetWidth || 1;

    const isZoom = cur.transitionType === 'zoom' && !!cur.transitionOrigin;
    const isSlideUp = cur.transitionType === 'slide-up';

    const passed = dx > w * thresholdRatio;

    if (passed) {
      this.pop();               // pop 内会重设 will-change 并最终移除元素
      return true;
    }

    if (isZoom) {
      el.style.transition = 'transform .26s cubic-bezier(.2,.7,.3,1), opacity .22s ease';
      el.style.transform = 'translate(0, 0) scale(1)';
      el.style.opacity = '1';
      setTimeout(() => {
        if (!el.parentNode) return;
        el.style.transition = '';
        el.style.transformOrigin = '';
        el.style.willChange = '';
      }, 280);
    } else if (isSlideUp) {
      el.style.transition = 'transform .26s cubic-bezier(.2,.7,.3,1)';
      el.style.transform = 'translateY(0)';
      setTimeout(() => {
        if (!el.parentNode) return;
        el.style.transition = '';
        el.style.willChange = '';
      }, 280);
    } else {
      el.style.transition = 'transform .24s ease';
      el.style.transform = '';
      setTimeout(() => {
        if (el.parentNode) {
          el.style.transition = '';
          el.style.willChange = '';
        }
      }, 260);
    }
    return false;
  }

  dragCancel() {
    if (!this._dragActive) return;
    this._dragActive = false;
    if (this.depth <= 1) return;

    const cur = this.stack[this.stack.length - 1];
    if (!cur || !cur.element) return;

    const el = cur.element;
    const isZoom = cur.transitionType === 'zoom' && !!cur.transitionOrigin;
    const isSlideUp = cur.transitionType === 'slide-up';

    if (isZoom) {
      el.style.transition = 'transform .2s cubic-bezier(.2,.7,.3,1), opacity .18s ease';
      el.style.transform = 'translate(0, 0) scale(1)';
      el.style.opacity = '1';
      setTimeout(() => {
        if (!el.parentNode) return;
        el.style.transition = '';
        el.style.transformOrigin = '';
        el.style.willChange = '';
      }, 220);
    } else if (isSlideUp) {
      el.style.transition = 'transform .2s cubic-bezier(.2,.7,.3,1)';
      el.style.transform = 'translateY(0)';
      setTimeout(() => {
        if (!el.parentNode) return;
        el.style.transition = '';
        el.style.willChange = '';
      }, 220);
    } else {
      el.style.transition = 'transform .2s ease';
      el.style.transform = '';
      setTimeout(() => {
        if (el.parentNode) {
          el.style.transition = '';
          el.style.willChange = '';
        }
      }, 220);
    }
  }
};