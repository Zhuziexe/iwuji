/* =========================================================
   app-loader.js —— 应用脚本加载器（带版本号 + 缓存失效）
   ========================================================= */
window.WujiAppLoader = (() => {
  const cache     = new Map();   // url -> Promise
  const scriptEls = new Map();   // url -> <script> 元素
  const gen       = new Map();   // src 前缀 -> generation 计数

  function srcPrefix(src) {
    return String(src || '').split('?')[0];
  }

  function bumpGen(src) {
    const key = srcPrefix(src);
    const g = (gen.get(key) || 0) + 1;
    gen.set(key, g);
    return g;
  }

  /**
   * 拼接最终 URL：
   *   1.0.0 首次        → src?v=1.0.0
   *   同一版本 invalidate 后 → src?v=1.0.0&g=1
   *   升级到 1.0.1      → src?v=1.0.1&g=1
   * 保证每次 invalidate 之后 URL 都不同，浏览器不会命中旧缓存。
   */
  function versionedUrl(src, version) {
    const prefix = srcPrefix(src);
    const g = gen.get(prefix) || 0;

    const parts = [];
    if (version) parts.push(`v=${encodeURIComponent(version)}`);
    if (g > 0)   parts.push(`g=${g}`);

    if (!parts.length) return prefix;
    return `${prefix}?${parts.join('&')}`;
  }

  function load(url) {
    if (cache.has(url)) return cache.get(url);

    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;

      s.onload = () => resolve();
      s.onerror = () => {
        /* ★ 失败要从 cache 里摘掉，否则下次拿到的是 rejected promise */
        cache.delete(url);
        scriptEls.delete(url);
        reject(new Error('加载失败: ' + url));
      };

      document.head.appendChild(s);
      scriptEls.set(url, s);
    });

    cache.set(url, p);
    return p;
  }

  return {
    load(src, version) {
      return load(versionedUrl(src, version));
    },

    /**
     * 让某个 src 的所有缓存失效：
     *   - 清 cache 里的 Promise
     *   - 从 <head> 移除已经加载的 <script>
     *   - generation +1，下次 load 会拿到新 URL，强制重新执行
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
  };
})();