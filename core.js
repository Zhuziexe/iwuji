/* =========================================================
   core.js —— 应用注册表 + 系统级存储

   WujiApps：
     - 内置应用 / 已安装应用分桶
     - register / registerInstalled / registerMeta
     - meta 条目（占位）与完整条目可互相升级
     - on() 事件订阅：桌面布局在增删时自动重绘

   Store：
     - 系统级小数据（localStorage），同步、必须立即可读
     - 应用私有大数据请走 AppStorage（IndexedDB）
   ========================================================= */

window.WujiApps = (() => {
  const builtin   = new Map();
  const installed = new Map();
  const listeners = new Set();

  function emit(evt) {
    listeners.forEach(fn => {
      try { fn(evt); } catch (e) { console.error('[WujiApps]', e); }
    });
  }

  function normalize(app) {
    return {
      bundlename:   app.bundlename || app.bundle,
      name:         app.name || app.bundlename,
      icon:         app.icon || '',
      iconStyle:    app.iconStyle || '',
      version:      app.version || '1.0.0',
      author:       app.author || '',
      description:  app.description || '',
      initialRoute: app.initialRoute || null,
      routes:       app.routes || null,
      render:       app.render || null,
      mount:        app.mount || null,
      unmount:      app.unmount || null,
      styles:       app.styles || '',
      _src:         app.src || app._src || '',
      _metaOnly:    false,
    };
  }

  /* ---------------------------------------------------------
     完整注册
     --------------------------------------------------------- */
  function register(app, source) {
    if (!app || !app.bundlename) {
      console.error('[WujiApps] 应用必须有 bundlename');
      return false;
    }

    const isInstalled = source === 'installed';
    const bucket = isInstalled ? installed : builtin;
    const other  = isInstalled ? builtin   : installed;

    const existingSelf  = bucket.get(app.bundlename);
    const existingOther = other.get(app.bundlename);

    /* 已经完整注册过 → 忽略 */
    if (existingSelf && !existingSelf._metaOnly) {
      console.warn(`[WujiApps] 应用 ${app.bundlename} 已注册，忽略`);
      return false;
    }
    /* 另一桶里有完整版 → 忽略（内置优先，避免把系统应用注册成已安装） */
    if (existingOther && !existingOther._metaOnly) {
      console.warn(`[WujiApps] 应用 ${app.bundlename} 已在另一桶完整注册，忽略`);
      return false;
    }

    const norm = normalize(app);
    norm._source = source;
    norm._metaOnly = false;
    norm._registeredAt = Date.now();

    bucket.set(norm.bundlename, norm);
    /* 清掉另一桶里的 meta 残留 */
    if (existingOther) other.delete(norm.bundlename);

    emit({ type: 'registered', bundle: norm.bundlename, source, app: norm });
    return true;
  }

  /* ---------------------------------------------------------
     只注册元数据（占位），等脚本加载后升级为完整定义
     --------------------------------------------------------- */
  function registerMeta(meta, source = 'installed') {
    if (!meta) return false;
    const bundle = meta.bundlename || meta.bundle;
    if (!bundle) return false;

    /* 系统内置里已有同名 → 不允许 meta 覆盖 */
    if (builtin.has(bundle)) return false;

    const existing = installed.get(bundle);
    if (existing && !existing._metaOnly) return false;   // 已完整，忽略

    const norm = {
      ...normalize({ ...meta, bundlename: bundle }),
      _metaOnly: true,
      _src: meta.src || meta._src || '',
      _source: source,
      _registeredAt: Date.now(),
    };

    installed.set(bundle, norm);
    emit({ type: 'registered', bundle, source, app: norm });
    return true;
  }

  return {
    /* 内置应用：随 OS 一起发布的 */
    register(app) { return register(app, 'builtin'); },

    /* 应用市场 / 侧载：安装时调用 */
    registerInstalled(app) { return register(app, 'installed'); },

    /* 只登记元数据（占位） */
    registerMeta,

    /* 卸载：只能卸已安装的应用 */
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