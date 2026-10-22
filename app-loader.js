/* =========================================================
   app-loader.js —— 应用脚本加载器
     - 支持 URL 脚本（带版本号 + 缓存失效）
     - 支持 idb://bundle（从 IndexedDB 取代码 → blob URL 执行）
     - 依赖：app-code-store.js
   ========================================================= */
window.WujiAppLoader = (() => {
  const cache = new Map();     // url -> Promise
  const scriptEls = new Map(); // url -> <script>
  const gen = new Map();       // src 前缀 -> generation

  function srcPrefix(src) {
    return String(src || '').split(/[?#]/)[0];
  }

  const isIdb = src => String(src || '').startsWith('idb://');
  const idbBundle = src => String(src || '').replace(/^idb:\/\//, '').split(/[?#]/)[0];

  function bumpGen(src) {
    const key = srcPrefix(src);
    const g = (gen.get(key) || 0) + 1;
    gen.set(key, g);
    return g;
  }

  /**
   * idb://bundle           → idb://bundle（首次）
   * idb://bundle invalidate 后 → idb://bundle?g=1
   * url 脚本行为和原来一致
   */
  function versionedUrl(src, version) {
    const prefix = srcPrefix(src);
    const g = gen.get(prefix) || 0;

    if (isIdb(prefix)) {
      return g > 0 ? `${prefix}?g=${g}` : prefix;
    }

    const parts = [];
    if (version) parts.push(`v=${encodeURIComponent(version)}`);
    if (g > 0) parts.push(`g=${g}`);
    if (!parts.length) return prefix;
    return `${prefix}?${parts.join('&')}`;
  }

  async function loadFromIdb(bundle) {
    const rec = await WujiAppCode.get(bundle);
    if (!rec || !rec.code) throw new Error('IDB 中不存在应用代码: ' + bundle);

    const url = URL.createObjectURL(
      new Blob([rec.code], { type: 'text/javascript' })
    );

    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => { URL.revokeObjectURL(url); resolve(); };
      s.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('执行失败: ' + bundle));
      };
      document.head.appendChild(s);
      scriptEls.set('idb://' + bundle, s);
    });
  }

  function loadFromUrl(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        cache.delete(url);
        scriptEls.delete(url);
        reject(new Error('加载失败: ' + url));
      };
      document.head.appendChild(s);
      scriptEls.set(url, s);
    });
  }

  function load(url) {
    if (cache.has(url)) return cache.get(url);

    const p = isIdb(url) ? loadFromIdb(idbBundle(url)) : loadFromUrl(url);
    p.catch(() => { cache.delete(url); });
    cache.set(url, p);
    return p;
  }

  return {
    load(src, version) {
      return load(versionedUrl(src, version));
    },

    /**
     * 让某个 src 的缓存失效：
     *   - 清 cache 里的 Promise
     *   - 从 <head> 移除已加载的 <script>
     *   - generation +1，下次 load 会拿到新 URL
     * idb:// 情况不删 IDB 记录（更新场景 IDB 里是新代码，要保留）
     */
    invalidate(src) {
      const prefix = srcPrefix(src);
      if (!prefix) return false;

      let hit = false;
      bumpGen(src);

      for (const url of [...cache.keys()]) {
        if (srcPrefix(url) === prefix) {
          cache.delete(url);
          hit = true;

          const el = scriptEls.get(url);
          if (el && el.parentNode) el.parentNode.removeChild(el);
          scriptEls.delete(url);
        }
      }
      return hit;
    },

    isIdb,
    idbBundle,
  };
})();