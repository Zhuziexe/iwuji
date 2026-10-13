/* =========================================================
   core.js —— 应用注册表 + 系统级存储

   WujiApps：
     - 内置应用与已安装应用分桶，卸载时只清"已安装"桶
     - register / registerInstalled 两个入口，语义清晰
     - 提供 on() 事件订阅，桌面布局可以在应用增删时自动重绘
     - 元数据规范化：name/icon/version/author 等

   Store：
     - 系统级小数据（锁屏密码、控制中心开关、桌面布局…）
     - 同步、小体积、必须立即可读
     - 应用私有数据请走 AppStorage（IndexedDB）
   ========================================================= */

window.WujiApps = (() => {
  const builtin   = new Map();
  const installed = new Map();
  const injected  = new Set();
  const listeners = new Set();

  function emit(evt) {
    listeners.forEach(fn => {
      try { fn(evt); } catch (e) { console.error('[WujiApps]', e); }
    });
  }

  function injectStyles(app) {
    if (!app.styles || injected.has(app.bundlename)) return;
    injected.add(app.bundlename);
    const tag = document.createElement('style');
    tag.dataset.wjApp = app.bundlename;
    tag.textContent = app.styles;
    document.head.appendChild(tag);
  }

  function normalize(app) {
    return {
      bundlename:  app.bundlename,
      name:        app.name || app.bundlename,
      icon:        app.icon || '',
      iconStyle:   app.iconStyle || '',
      version:     app.version || '1.0.0',
      author:      app.author || '',
      description: app.description || '',
      initialRoute: app.initialRoute || null,
      routes:      app.routes || null,
      render:      app.render || null,
      mount:       app.mount || null,
      unmount:     app.unmount || null,
      styles:      app.styles || '',
    };
  }

  function register(app, source) {
    if (!app || !app.bundlename) {
      console.error('[WujiApps] 应用必须有 bundlename');
      return false;
    }
    if (builtin.has(app.bundlename) || installed.has(app.bundlename)) {
      console.warn(`[WujiApps] 应用 ${app.bundlename} 已注册，忽略`);
      return false;
    }
    const norm = normalize(app);
    norm._source = source;
    norm._registeredAt = Date.now();

    const bucket = source === 'installed' ? installed : builtin;
    bucket.set(norm.bundlename, norm);
    injectStyles(norm);
    emit({ type: 'registered', bundle: norm.bundlename, source, app: norm });
    return true;
  }

  return {
    /* 内置应用：随 OS 一起发布的 */
    register(app) { return register(app, 'builtin'); },

    /* 应用市场 / 侧载：安装时调用 */
    registerInstalled(app) { return register(app, 'installed'); },

    /* 卸载：只能卸已安装的应用，内置应用返回 false */
    unregister(bundle) {
      if (!installed.has(bundle)) return false;
      installed.delete(bundle);
      emit({ type: 'unregistered', bundle });
      return true;
    },

    get(bundle) {
      return installed.get(bundle) || builtin.get(bundle) || null;
    },

    all() {
      return [...builtin.values(), ...installed.values()];
    },

    builtins()   { return [...builtin.values()]; },
    installeds() { return [...installed.values()]; },

    has(bundle)  { return builtin.has(bundle) || installed.has(bundle); },
    isInstalled(bundle) { return installed.has(bundle); },

    /* 订阅注册表变化：{ type: 'registered' | 'unregistered', bundle, source?, app? } */
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
})();

/* =========================================================
   Store —— 系统级小数据（localStorage）
   ========================================================= */
window.Store = (() => {
  const NS = 'wujios:';
  const memory = new Map();
  let useMemory = false;
  try {
    localStorage.setItem(NS + '__probe', '1');
    localStorage.removeItem(NS + '__probe');
  } catch { useMemory = true; }

  const raw = {
    get(k) {
      if (useMemory) return memory.has(k) ? memory.get(k) : null;
      try { return localStorage.getItem(k); } catch { return null; }
    },
    set(k, v) {
      if (useMemory) { memory.set(k, v); return; }
      try { localStorage.setItem(k, v); } catch {}
    },
    remove(k) {
      if (useMemory) { memory.delete(k); return; }
      try { localStorage.removeItem(k); } catch {}
    },
    keys() {
      if (useMemory) return [...memory.keys()];
      try { return Object.keys(localStorage); } catch { return []; }
    },
  };

  return {
    get(key, fb = null) {
      const s = raw.get(NS + key);
      if (s === null) return fb;
      try { return JSON.parse(s); } catch { return fb; }
    },
    set(key, value) { try { raw.set(NS + key, JSON.stringify(value)); } catch {} },
    remove(key) { raw.remove(NS + key); },
    reset() { raw.keys().filter(k => k.startsWith(NS)).forEach(k => raw.remove(k)); },
    get isMemoryOnly() { return useMemory; },
  };
})();

window.escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);