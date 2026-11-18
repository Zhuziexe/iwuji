/* =========================================================
   theme.js —— 主题引擎（Shadow DOM 版）

   主题 = 一个 JS 文件，源码里调用 WujiTheme.define({...}) 注册。
   加载方式：fetch 取源码 → new Function 在受限作用域内执行 →
   主题定义只落入本次的局部收件箱（不写 window、不插 <script> 标签），
   执行完销毁函数，内存里只保留当前主题的一份定义。切主题时重新请求。

   挂载到 #wallpaperHost 的 Shadow DOM，主题可以：
     - 用 CSS 动画 / canvas / requestAnimationFrame 跑壁纸
     - 通过 vars 设置锁屏时钟/日期的 CSS 变量
     - 通过 ctx.onStateChange 订阅 OS 状态（view / power / 解锁进度）

   状态栏由系统统一控制，主题无权修改。
   ========================================================= */
window.WujiTheme = (() => {
  const HOST_ID   = 'wallpaperHost';
  const STORE_KEY = 'theme.current';
  const DB_BUNDLE = 'com.wujios.themes';

  /* ★ 主题只能设置锁屏时钟/日期相关的变量 */
  const THEME_ALLOWED_VARS = new Set([
    '--wj-lock-time-color',
    '--wj-lock-time-bg',
    '--wj-lock-time-fill',
    '--wj-lock-time-filter',
    '--wj-lock-date-color',
    '--wj-lock-date-shadow',
  ]);

  let hostEl = null;
  let shadow = null;
  let currentId = null;
  let currentMeta = null;
  let currentDef = null;
  let ready = false;

  const listeners = new Set();

  const state = {
    view: 'locked',
    power: 'off',
    unlockProgress: 0,
  };
  const stateSubs = new Set();

  let cleanupFns = [];
  let appliedVars = [];

  function ensureHost() {
    if (hostEl && hostEl.isConnected && shadow) return hostEl;

    const existing = document.getElementById(HOST_ID);
    if (existing) {
      hostEl = existing;
      shadow = hostEl.shadowRoot || hostEl.attachShadow({ mode: 'open' });
      return hostEl;
    }

    hostEl = document.createElement('div');
    hostEl.id = HOST_ID;
    hostEl.className = 'os-wallpaper-host';
    const os = document.getElementById('os');
    if (!os) return null;
    os.insertBefore(hostEl, os.firstChild);
    shadow = hostEl.attachShadow({ mode: 'open' });
    return hostEl;
  }

  /* ---------- CSS 变量：先清旧值，再按白名单应用新值 ---------- */
  function clearVars() {
    if (!appliedVars.length) return;
    const root = document.documentElement;
    for (const k of appliedVars) root.style.removeProperty(k);
    appliedVars = [];
  }

  function applyVars(vars) {
    clearVars();
    if (!vars) return;

    const root = document.documentElement;
    for (const k in vars) {
      if (!THEME_ALLOWED_VARS.has(k)) {
        console.warn('[theme] 拒绝设置变量（不在白名单）:', k);
        continue;
      }
      try {
        root.style.setProperty(k, String(vars[k]));
        appliedVars.push(k);
      } catch (e) {
        console.warn('[theme] 设置变量失败:', k, e);
      }
    }
  }

  function updateState(patch) {
    if (patch.view !== undefined)           state.view = patch.view;
    if (patch.power !== undefined)          state.power = patch.power;
    if (patch.unlockProgress !== undefined) state.unlockProgress = patch.unlockProgress;
    stateSubs.forEach(fn => {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  function resolveThemeSrc(meta) {
    let src = meta && meta.src ? String(meta.src) : '';
    if (!src) return '';
    if (/index\.html(\?|$)/i.test(src)) src = src.replace(/index\.html(\?|$)/i, 'theme.js$1');
    if (/\.html(\?|$)/i.test(src))      src = src.replace(/\.html(\?|$)/i, '.js$1');
    if (!/\.js(\?|$)/i.test(src)) return '';
    return src;
  }

  /* 取主题源码并在受限作用域内执行：
     - 用 fetch 取文本，不插 <script> 标签；走浏览器正常 HTTP 缓存
     - new Function 只在本次调用的参数里给它一个 WujiTheme.define，
       主题定义落入局部 inbox，不写 window.__WUJI_THEMES__
     - 函数执行完即弃，内存里只由 load() 保留 currentDef 一份 */
  async function fetchThemeDef(src) {
    const res = await fetch(src);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const code = await res.text();

    const inbox = { def: null };
    const scopedTheme = {
      define(def) {
        if (def && inbox.def === null) inbox.def = def;
        return true;
      },
    };

    // 主题脚本里只需 WujiTheme；其余全局（document/Math/...）由 new Function
    // 的正常全局作用域解析，无需注入，从而不污染 window。
    const fn = new Function('WujiTheme', code);
    fn(scopedTheme);
    return inbox.def;
  }

  async function findMeta(id) {
    if (Array.isArray(window.SYSTEM_THEMES)) {
      const m = SYSTEM_THEMES.find(t => t.id === id);
      if (m) return m;
    }
    try {
      const db = AppStorage.for(DB_BUNDLE);
      const list = await db.get('downloaded_themes', []);
      const m = Array.isArray(list) ? list.find(t => t.id === id) : null;
      if (m) return m;
    } catch { }
    return null;
  }

  async function load(id, { persist = true } = {}) {
    const meta = await findMeta(id);
    if (!meta) {
      console.warn('[theme] 未找到主题', id);
      return false;
    }

    const src = resolveThemeSrc(meta);
    if (!src) {
      console.warn('[theme] 主题源无效', id, meta.src);
      return false;
    }

    unmount();

    currentId = id;
    currentMeta = meta;
    ready = false;

    let def;
    try {
      def = await fetchThemeDef(src);
    } catch (e) {
      console.error('[theme] 加载主题失败', src, e);
      return false;
    }

    if (!def) {
      console.warn('[theme] 主题脚本没有调用 WujiTheme.define()', id);
      return false;
    }
    currentDef = def;

    applyVars(def.vars);
    applyLockStyle(def.lockstyle || 'large');
    const host = ensureHost();
    if (!host || !shadow) return false;

    shadow.innerHTML = '';

    if (def.styles) {
      const st = document.createElement('style');
      st.textContent = def.styles;
      shadow.appendChild(st);
    }

    const root = document.createElement('div');
    root.className = 'wj-theme-root';
    root.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
    shadow.appendChild(root);

    const themeDir = src.substring(0, src.lastIndexOf('/') + 1);

    const ctx = {
      get state() { return state; },
      onStateChange(fn) {
        if (typeof fn !== 'function') return () => {};
        stateSubs.add(fn);
        try { fn(state); } catch (e) { console.error(e); }
        return () => stateSubs.delete(fn);
      },
      resolve(relPath) {
        if (!relPath) return themeDir;
        if (/^(?:[a-z]+:|\/)/i.test(relPath)) return relPath;
        return themeDir + relPath;
      },
    };

    if (typeof def.mount === 'function') {
      try {
        const ret = def.mount(root, ctx);
        if (typeof ret === 'function') cleanupFns.push(ret);
      } catch (e) {
        console.error('[theme] mount 失败', e);
      }
    }

    if (persist) {
      try { Store.set(STORE_KEY, id); } catch { }
    }

    listeners.forEach(fn => {
      try { fn(id, meta); } catch (e) { console.error(e); }
    });

    ready = true;
    return true;
  }

  function applyTone(tone) {
    const os = document.getElementById('os');
    if (!os) return;
    os.dataset.themeTone = (tone === 'light') ? 'light' : 'dark';
  }

  function clearTone() {
    const os = document.getElementById('os');
    if (!os) return;
    delete os.dataset.themeTone;
  }

  function applyLockStyle(style) {
    const os = document.getElementById('os');
    if (!os) return;
    os.dataset.lockStyle = (style === 'small') ? 'small' : 'large';
  }

  function clearLockStyle() {
    const os = document.getElementById('os');
    if (!os) return;
    delete os.dataset.lockStyle;
  }

  function unmount() {
    if (currentDef && typeof currentDef.unmount === 'function') {
      try { currentDef.unmount(); } catch (e) { console.error(e); }
    }
    cleanupFns.forEach(fn => { try { fn(); } catch { } });
    cleanupFns = [];
    stateSubs.clear();

    if (shadow) shadow.innerHTML = '';
    clearVars();
    clearLockStyle();

    currentDef = null;
    currentId = null;
    currentMeta = null;
    ready = false;
  }

  function post(type, payload) {
    payload = payload || {};
    switch (type) {
      case 'view':            updateState({ view: payload.view }); break;
      case 'power':           updateState({ power: payload.state }); break;
      case 'unlock-progress': updateState({ unlockProgress: payload.p }); break;
      case 'unlock-finish':   updateState({ unlockProgress: 1 }); break;
      case 'unlock-cancel':
      case 'lock-enter':      updateState({ unlockProgress: 0 }); break;
    }
  }

  function postProgress(p) {
    updateState({ unlockProgress: p });
  }

  function init() {
    const os = document.getElementById('os');
    if (os) {
      state.view  = os.dataset.view  || 'locked';
      state.power = os.dataset.power || 'off';
    }
    const saved = Store.get(STORE_KEY, null);
    const fallback = (Array.isArray(window.SYSTEM_THEMES) && SYSTEM_THEMES[0]?.id) || 'sea';
    load(saved || fallback, { persist: false }).catch(e => {
      console.error('[theme] init load failed', e);
    });
  }

  return {
    init,
    load,
    unmount,
    post,
    postProgress,
    get current() { return currentId; },
    get meta()    { return currentMeta; },
    get isReady() { return ready; },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
})();