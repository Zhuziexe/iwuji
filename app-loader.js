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
    invalidate(src, opts = {}) {
      const prefix = srcPrefix(src);
      if (!prefix) return false;

      let hit = false;
      /* noBump：只清内存 cache / 旧 script 标签，不改 generation。
         用于「退出应用时释放内存、下次重新注入」：URL 保持稳定（内置应用
         带 ?v=version），浏览器直接走 HTTP 缓存，不会每次打开都重新下载。
         更新场景（installer.install）仍用默认 bump 来绕过缓存取新代码。 */
      if (!opts.noBump) bumpGen(src);

      for (const url of [...cache.keys()]) {
        if (srcPrefix(url) === prefix) {
          cache.delete(url);
          hit = true;
        }
      }

      /* ★ 按 srcPrefix 遍历 scriptEls 删除旧 <script> 节点，而不是用完整 url
         去 get：idb:// 加载时 scriptEls 的键是 `idb://bundle`，但 cache 的键是
         versionedUrl（带 ?g=N），两者不一致，旧代码下 script 节点永不被移除、
         在 <head> 里越积越多。这里按前缀匹配可同时覆盖 idb 与 url 两类。 */
      for (const [key, el] of [...scriptEls.entries()]) {
        if (srcPrefix(key) === prefix) {
          if (el && el.parentNode) el.parentNode.removeChild(el);
          scriptEls.delete(key);
          hit = true;
        }
      }
      return hit;
    },

    isIdb,
    idbBundle,
  };
})();