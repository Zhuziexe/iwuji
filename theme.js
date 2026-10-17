/* =========================================================
   theme.js —— 主题引擎

   统一通过 iframe 加载主题：
     #wallpaperHost
       └── <iframe src="themes/xxx/index.html">
   OS 与主题通过 postMessage 单向通信（OS→主题）。
   ========================================================= */
window.WujiTheme = (() => {
  const HOST_ID   = 'wallpaperHost';
  const STORE_KEY = 'theme.current';
  const DB_BUNDLE = 'com.wujios.themes';

  let hostEl     = null;
  let iframeEl   = null;
  let currentId  = null;
  let currentMeta = null;
  let ready      = false;
  const listeners = new Set();

  let _pendingProgress = null;
  let _rafId = 0;

  function ensureHost() {
    if (hostEl && hostEl.isConnected) return hostEl;

    /* 优先复用 HTML 里已有的 host，避免出现两个 #wallpaperHost 叠加 */
    const existing = document.getElementById(HOST_ID);
    if (existing) {
      hostEl = existing;
      return hostEl;
    }

    hostEl = document.createElement('div');
    hostEl.id = HOST_ID;
    hostEl.className = 'os-wallpaper-host';
    const os = document.getElementById('os');
    if (!os) return null;
    os.insertBefore(hostEl, os.firstChild);
    return hostEl;
  }

  function post(type, payload) {
    if (!iframeEl || !iframeEl.contentWindow) return;
    try {
      iframeEl.contentWindow.postMessage({
        source: 'wuji-os',
        type,
        payload: payload || {},
      }, '*');
    } catch (e) {
      console.warn('[theme] post 失败', type, e);
    }
  }

  function postProgress(p) {
    _pendingProgress = p;
    if (_rafId) return;
    _rafId = requestAnimationFrame(() => {
      _rafId = 0;
      if (_pendingProgress === null) return;
      post('unlock-progress', { p: _pendingProgress });
      _pendingProgress = null;
    });
  }

  function unmount() {
    if (iframeEl) { iframeEl.remove(); iframeEl = null; }
    ready = false;
  }

  function mount(entry) {
    unmount();
    const host = ensureHost();
    if (!host) {
      console.warn('[theme] 找不到 wallpaperHost');
      return;
    }

    iframeEl = document.createElement('iframe');
    iframeEl.className = 'os-wallpaper-frame';
    iframeEl.setAttribute('scrolling', 'no');
    iframeEl.setAttribute('title', '');
    iframeEl.style.opacity = '1';

    /* 先 append 再设 src，避免 load 事件在监听器挂上之前触发 */
    host.appendChild(iframeEl);
    iframeEl.src = entry;

    iframeEl.addEventListener('load', () => {
      console.log('[theme] iframe loaded:', entry);
    }, { once: true });
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
    } catch (e) {
      console.warn('[theme] 读取已下载主题失败', e);
    }
    return null;
  }

  async function load(id, { persist = true } = {}) {
    const meta = await findMeta(id);
    if (!meta) {
      console.warn('[theme] 未找到主题', id);
      return false;
    }

    currentId = id;
    currentMeta = meta;
    ready = false;

    mount(meta.src || `themes/${id}/index.html`);

    if (persist) {
      try { Store.set(STORE_KEY, id); } catch { }
    }

    listeners.forEach(fn => {
      try { fn(id, meta); } catch (e) { console.error(e); }
    });
    return true;
  }

  function init() {
    window.addEventListener('message', e => {
      const d = e.data;
      if (!d || d.source !== 'wuji-theme') return;

      if (d.type === 'ready') {
        ready = true;
        const os = document.getElementById('os');
        post('init', {
          view:  os ? os.dataset.view  : 'locked',
          /* ★ 初始化时先按 running 处理，避免"开机前 power=off"导致主题一挂载就 paused */
          power: 'running',
          size: {
            w: window.innerWidth,
            h: window.innerHeight,
            dpr: Math.min(window.devicePixelRatio || 1, 2),
          },
        });
      } else if (d.type === 'log') {
        console.log('[theme]', d.payload);
      } else if (d.type === 'error') {
        console.warn('[theme]', d.payload);
      }
    });

    window.addEventListener('resize', () => {
      post('resize', {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        post('resize', {
          w: window.innerWidth,
          h: window.innerHeight,
          dpr: Math.min(window.devicePixelRatio || 1, 2),
        });
      }, 150);
    });

    const saved = Store.get(STORE_KEY, null);
    const fallback = (Array.isArray(window.SYSTEM_THEMES) && SYSTEM_THEMES[0]?.id) || 'sea';
    load(saved || fallback, { persist: false });
  }

  async function isDownloaded(id) {
    try {
      const db = AppStorage.for(DB_BUNDLE);
      const list = await db.get('downloaded_themes', []);
      return Array.isArray(list) && list.some(t => t.id === id);
    } catch { return false; }
  }

  function isSystemTheme(id) {
    return Array.isArray(window.SYSTEM_THEMES) && SYSTEM_THEMES.some(t => t.id === id);
  }

  return {
    init,
    load,
    post,
    postProgress,
    isDownloaded,
    isSystemTheme,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get current() { return currentId; },
    get meta()    { return currentMeta; },
    get isReady() { return ready; },
  };
})();