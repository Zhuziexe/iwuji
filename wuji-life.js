/* =========================================================
   wuji-life.js —— 应用生命周期状态系统

   目标：把"模块级变量常驻内存"改成跟随应用/页面生命周期的状态：
     - WujiLife.global(bundle)  → 应用级全局变量：应用被杀/被关闭就没掉
     - WujiLife.page(bundle, pageId) → 页面级局部变量：返回 pop 就没掉

   特点：
     - 全局变量在后台（background）时保留，杀后台/unmount 时销毁
     - 页面变量在返回手势 pop 对应页面时销毁
     - 应用 foreground 时保证 global 存在；未 foreground 就 background/unmount 不崩溃
     - 纯内存 Map，销毁时把值置空，便于 GC

   依赖：无（挂载到 window.WujiLife）
   ========================================================= */
(() => {
  'use strict';

  /** @type {Map<string, {globals: Map<string, any>, pages: Map<string, Map<string, any>>, alive: boolean}>} */
  const stores = new Map();

  function ensure(bundle) {
    let s = stores.get(bundle);
    if (!s) {
      s = { globals: new Map(), pages: new Map(), alive: true };
      stores.set(bundle, s);
    }
    return s;
  }

  function destroyMap(map) {
    if (!map) return;
    for (const key of map.keys()) {
      try { map.set(key, undefined); } catch { }
    }
    map.clear();
  }

  const api = {
    /* --------------------------------------------------
       应用级全局状态
       -------------------------------------------------- */
    global(bundle) {
      return ensure(bundle).globals;
    },

    /** 读取一个全局值（不存在时返回 fb，可用函数做惰性初始化） */
    g(bundle, key, fb) {
      const m = api.global(bundle);
      if (!m.has(key)) {
        const v = (typeof fb === 'function') ? fb() : fb;
        m.set(key, v);
        return v;
      }
      return m.get(key);
    },

    /** 设置一个全局值 */
    setG(bundle, key, value) {
      api.global(bundle).set(key, value);
      return value;
    },

    /* --------------------------------------------------
       页面级局部状态
       -------------------------------------------------- */
    page(bundle, pageId) {
      const s = ensure(bundle);
      let p = s.pages.get(pageId);
      if (!p) {
        p = new Map();
        s.pages.set(pageId, p);
      }
      return p;
    },

    p(bundle, pageId, key, fb) {
      const m = api.page(bundle, pageId);
      if (!m.has(key)) {
        const v = (typeof fb === 'function') ? fb() : fb;
        m.set(key, v);
        return v;
      }
      return m.get(key);
    },

    setP(bundle, pageId, key, value) {
      api.page(bundle, pageId).set(key, value);
      return value;
    },

    /* --------------------------------------------------
       生命周期钩子
       -------------------------------------------------- */
    /** 应用进入前台：如果之前被杀过（alive=false），重建空状态 */
    foreground(bundle) {
      const s = ensure(bundle);
      s.alive = true;
      return s;
    },

    /** 应用退到后台：保留 globals 和 pages */
    background(bundle) {
      // 什么都不做——后台保留状态（这正是"移到后台不销毁"的语义）
    },

    /** 应用被杀死 / 关闭：销毁全局变量 + 所有页面局部变量 */
    kill(bundle) {
      const s = stores.get(bundle);
      if (!s) return;
      destroyMap(s.globals);
      for (const p of s.pages.values()) destroyMap(p);
      s.pages.clear();
      s.alive = false;
      // 直接从表里移除，彻底断开引用
      stores.delete(bundle);
    },

    /** pop 单个页面：销毁该页面的所有局部变量 */
    popPage(bundle, pageId) {
      const s = stores.get(bundle);
      if (!s) return;
      const p = s.pages.get(pageId);
      if (!p) return;
      destroyMap(p);
      s.pages.delete(pageId);
    },

    /** 清空某应用的全部页面变量（保留全局变量，如 reset） */
    clearPages(bundle) {
      const s = stores.get(bundle);
      if (!s) return;
      for (const p of s.pages.values()) destroyMap(p);
      s.pages.clear();
    },

    /** 应用是否处于"活"状态（未被杀） */
    isAlive(bundle) {
      const s = stores.get(bundle);
      return !!s && s.alive;
    },

    /** 诊断：当前占用（应用数 / 各应用页面数） */
    stats() {
      const out = {};
      for (const [bundle, s] of stores) {
        out[bundle] = { globals: s.globals.size, pages: s.pages.size, alive: s.alive };
      }
      return out;
    },
  };

  window.WujiLife = api;

  /* --------------------------------------------------
     生命周期通知（iWuji / ZhuziOS 共用）
     - notifyForeground(bundle)：WujiLife.foreground + app.foreground()
     - notifyBackground(bundle)：WujiLife.background + app.background()
     应用只需实现模块级 foreground()/background() 函数钩子，不再走事件广播。
     -------------------------------------------------- */
  function notifyForeground(bundle) {
    try { api.foreground(bundle); } catch { }
    let app = null;
    try { app = window.WujiApps?.get?.(bundle); } catch { }
    try { app?.foreground?.(); } catch (e) { console.error('[foreground]', bundle, e); }
  }

  function notifyBackground(bundle) {
    try { api.background(bundle); } catch { }
    let app = null;
    try { app = window.WujiApps?.get?.(bundle); } catch { }
    try { app?.background?.(); } catch (e) { console.error('[background]', bundle, e); }
  }

  api.notifyForeground = notifyForeground;
  api.notifyBackground = notifyBackground;
})();
