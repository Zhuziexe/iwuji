/* =========================================================
   core.js —— 应用注册表 + 系统级存储

   WujiApps：
     - 内置应用 / 已安装应用分桶
     - register / registerInstalled / registerMeta
     - meta 条目（占位）与完整条目可互相升级
     - on() 事件订阅：桌面布局在增删时自动重绘
     - boot() / shutdown() / shutdownOne()：应用生命周期钩子
     - deviceAllowed() / platformAllowed()：按 window.__OPENWUJI_PLATFORM 过滤应用
       · 字段统一为 devices: ['iwuji','pc']（wujios→iwuji，zhuzios→pc）
       · 兼容旧 platforms 字段（由 WujiDevices 自动映射）
       · devices 缺失 / null / undefined / 空数组 / 非数组 → 视为全设备

   Store：
     - 系统级小数据（localStorage），同步、必须立即可读
     - 应用私有大数据请走 AppStorage（IndexedDB）
   ========================================================= */

window.WujiApps = (() => {
  const builtin = new Map();
  const installed = new Map();
  const listeners = new Set();
  let booted = false;

  /* =========================================================
     设备过滤
     ========================================================= */
  const CUR_PLATFORM = window.__OPENWUJI_PLATFORM || 'wujios';
  const CUR_DEVICE = window.WujiDevices?.currentDevice?.() || 'iwuji';

  /**
   * 判断 meta / record 是否适用于当前设备。
   *
   * 向后兼容规则（全部交给 WujiDevices 处理）：
   *   devices / platforms 缺失 / null / undefined / 空数组 / 非数组
   *     → 视为全设备，返回 true
   *   devices（或旧 platforms）是非空数组
   *     → 仅当包含当前设备时返回 true
   */
  function deviceAllowed(meta) {
    if (!meta) return true;
    const D = window.WujiDevices;
    if (D?.deviceAllowed) {
      return D.deviceAllowed(meta, CUR_DEVICE);
    }
    /* 兜底：WujiDevices 未加载时也能工作 */
    const list = Array.isArray(meta.devices) && meta.devices.length
      ? meta.devices
      : (Array.isArray(meta.platforms) ? meta.platforms : null);
    if (!list || !list.length) return true;
    return list.some(v => {
      const d = v === 'wujios' ? 'iwuji' : v === 'zhuzios' ? 'pc' : v;
      return d === CUR_DEVICE || d === CUR_PLATFORM;
    });
  }

  /* platformAllowed 作为历史别名保留，避免外部旧代码调用失效 */
  const platformAllowed = deviceAllowed;

  function supportsFile(app, file) {
    if (!app || !Array.isArray(app.fileTypes) || !app.fileTypes.length) return false;
    if (!file) return false;

    const ext = (() => {
      const i = file.name.lastIndexOf('.');
      return i >= 0 ? file.name.slice(i + 1).toLowerCase() : '';
    })();

    return app.fileTypes.some(rule => {
      if (!rule) return false;

      if (rule.mime) {
        if (rule.mime.endsWith('/*')) {
          const prefix = rule.mime.slice(0, -1);
          if (file.mime && file.mime.startsWith(prefix)) return true;
        } else if (rule.mime === file.mime) {
          return true;
        }
      }

      if (Array.isArray(rule.ext) && rule.ext.length) {
        const exts = rule.ext.map(e => String(e).replace(/^\./, '').toLowerCase());
        if (exts.includes(ext)) return true;
      }

      return false;
    });
  }

  function emit(evt) {
    listeners.forEach(fn => {
      try { fn(evt); } catch (e) { console.error('[WujiApps]', e); }
    });
  }

  function safeInvoke(fn, label) {
    if (typeof fn !== 'function') return;
    try { fn(); }
    catch (e) { console.error('[WujiApps]', label, e); }
  }

  function normalize(app) {
    const norm = {
      bundlename: app.bundlename || app.bundle,
      name: app.name || app.bundlename,
      icon: app.icon || '',
      iconStyle: app.iconStyle || '',
      version: app.version || '1.0.0',
      author: app.author || '',
      description: app.description || '',
      initialRoute: app.initialRoute || null,
      routes: app.routes || null,
      overlays: app.overlays || null,
      render: app.render || null,
      mount: app.mount || null,
      unmount: app.unmount || null,
      styles: app.styles || '',
      onBoot: app.onBoot || null,
      onShutdown: app.onShutdown || null,
      _src: app.src || app._src || '',
      _metaOnly: false,
      fileTypes: Array.isArray(app.fileTypes) ? app.fileTypes.slice() : null,
      hidden: !!app.hidden,
    };

    /* 统一输出 devices（兼容入参里残留的旧 platforms） */
    const devices = window.WujiDevices?.normalizeDevices?.(app)
      || (Array.isArray(app.devices) && app.devices.length ? app.devices.slice() : null);
    if (devices) norm.devices = devices;

    return norm;
  }

  /* ---------------------------------------------------------
     完整注册
     --------------------------------------------------------- */
  function register(app, source) {
    if (!app || !app.bundlename) {
      console.error('[WujiApps] 应用必须有 bundlename');
      return false;
    }

    /* ★ 1) 应用自身声明的设备不匹配当前设备 → 直接拒绝 */
    if (!deviceAllowed(app)) return false;

    /* ★ 2) 已安装应用以安装记录为准（防脚本被误 preload 后绕过） */
    if (source === 'installed' && window.WujiAppInstaller?.get) {
      try {
        const rec = window.WujiAppInstaller.get(app.bundlename);
        if (rec && !deviceAllowed(rec)) return false;
      } catch { }
    }

    const isInstalled = source === 'installed';
    const bucket = isInstalled ? installed : builtin;
    const other = isInstalled ? builtin : installed;

    const existingSelf = bucket.get(app.bundlename);
    const existingOther = other.get(app.bundlename);

    if (existingSelf && !existingSelf._metaOnly) {
      console.warn(`[WujiApps] 应用 ${app.bundlename} 已注册，忽略`);
      return false;
    }
    if (existingOther && !existingOther._metaOnly) {
      console.warn(`[WujiApps] 应用 ${app.bundlename} 已在另一桶完整注册，忽略`);
      return false;
    }

    const norm = normalize(app);
    norm._source = source;
    norm._metaOnly = false;
    norm._registeredAt = Date.now();

    if (!norm._src && existingSelf?._src) {
      norm._src = existingSelf._src;
    }

    if (!norm.devices && existingSelf?.devices) {
      norm.devices = existingSelf.devices.slice();
    }
    if (!norm.fileTypes && existingSelf?.fileTypes) {
      norm.fileTypes = existingSelf.fileTypes.slice();
    }

    bucket.set(norm.bundlename, norm);
    if (existingOther) other.delete(norm.bundlename);

    emit({ type: 'registered', bundle: norm.bundlename, source, app: norm });

    if (booted) safeInvoke(norm.onBoot, 'onBoot:' + norm.bundlename);

    return true;
  }

  /* ---------------------------------------------------------
     只注册元数据（占位），等脚本加载后升级为完整定义
     --------------------------------------------------------- */
  function registerMeta(meta, source = 'installed') {
    if (!meta) return false;
    const bundle = meta.bundlename || meta.bundle;
    if (!bundle) return false;

    /* ★ 设备过滤（旧数据无 devices → 全设备放行） */
    if (!deviceAllowed(meta)) return false;

    const isBuiltin = source === 'builtin';
    const bucket = isBuiltin ? builtin : installed;
    const other = isBuiltin ? installed : builtin;

    const existingSelf = bucket.get(bundle);
    if (existingSelf && !existingSelf._metaOnly) return false;

    const existingOther = other.get(bundle);
    if (existingOther && !existingOther._metaOnly) return false;

    const norm = {
      ...normalize({ ...meta, bundlename: bundle }),
      _metaOnly: true,
      _src: meta.src || meta._src || '',
      _source: source,
      _registeredAt: Date.now(),
    };

    bucket.set(bundle, norm);
    emit({ type: 'registered', bundle, source, app: norm });
    return true;
  }

  function eachFull(fn) {
    for (const app of builtin.values()) if (!app._metaOnly) fn(app);
    for (const app of installed.values()) if (!app._metaOnly) fn(app);
  }

  return {
    register(app) { return register(app, 'builtin'); },
    registerInstalled(app) { return register(app, 'installed'); },
    registerMeta,
    deviceAllowed,
    platformAllowed,

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

    builtins() { return [...builtin.values()]; },
    installeds() { return [...installed.values()]; },

    has(bundle) { return builtin.has(bundle) || installed.has(bundle); },
    isInstalled(bundle) { return installed.has(bundle); },

    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    boot() {
      booted = true;
      eachFull(app => safeInvoke(app.onBoot, 'onBoot:' + app.bundlename));
    },

    shutdown() {
      booted = false;
      eachFull(app => safeInvoke(app.onShutdown, 'onShutdown:' + app.bundlename));
    },

    shutdownOne(bundle) {
      if (!booted) return;
      const app = installed.get(bundle) || builtin.get(bundle) || null;
      if (!app || app._metaOnly) return;
      safeInvoke(app.onShutdown, 'onShutdown:' + bundle);
    },

    get isBooted() { return booted; },
    get currentPlatform() { return CUR_PLATFORM; },
    get currentDevice() { return CUR_DEVICE; },
    supportsFile,
    visible() {
      return [...builtin.values(), ...installed.values()]
        .filter(a => !a.hidden);
    },
    visibleBuiltins() {
      return [...builtin.values()].filter(a => !a.hidden);
    },
    visibleInstalleds() {
      return [...installed.values()].filter(a => !a.hidden);
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
      try { localStorage.setItem(k, v); } catch { }
    },
    remove(k) {
      if (useMemory) { memory.delete(k); return; }
      try { localStorage.removeItem(k); } catch { }
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
    set(key, value) { try { raw.set(NS + key, JSON.stringify(value)); } catch { } },
    remove(key) { raw.remove(NS + key); },
    reset() { raw.keys().filter(k => k.startsWith(NS)).forEach(k => raw.remove(k)); },
    get isMemoryOnly() { return useMemory; },
  };
})();

window.escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
