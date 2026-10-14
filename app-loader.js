/* =========================================================
   app-loader.js —— 应用脚本加载器（带版本号 + 缓存失效）
   ========================================================= */
window.WujiAppLoader = (() => {
  const cache = new Map();

  /** 给 src 加上版本查询串，让浏览器把它当作新 URL */
  function versionedUrl(src, version) {
    if (!version) return src;
    const sep = src.includes('?') ? '&' : '?';
    return `${src}${sep}v=${encodeURIComponent(version)}`;
  }

  function load(url) {
    if (cache.has(url)) return cache.get(url);

    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error('加载失败: ' + url));
      document.head.appendChild(s);
    });

    cache.set(url, p);
    return p;
  }

  return {
    /**
     * @param {string} src       原始脚本路径
     * @param {string} [version] 版本号（有则拼到 URL 上）
     */
    load(src, version) {
      return load(versionedUrl(src, version));
    },

    /** 让某个 src（不论版本）的所有缓存失效 */
    invalidate(src) {
      const prefix = src.split('?')[0];
      for (const url of [...cache.keys()]) {
        if (url.split('?')[0] === prefix) cache.delete(url);
      }
    },
  };
})();