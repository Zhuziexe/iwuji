window.WujiApps = (() => {
  const list = [];
  const injected = new Set();

  function injectStyles(app) {
    if (!app.styles || injected.has(app.bundlename)) return;
    injected.add(app.bundlename);
    const tag = document.createElement('style');
    tag.dataset.wjApp = app.bundlename;
    tag.textContent = app.styles;
    document.head.appendChild(tag);
  }

  return {
    register(app) {
      if (!app.bundlename) { console.error('应用必须有 bundlename'); return; }
      if (list.some(a => a.bundlename === app.bundlename)) {
        console.warn(`应用 ${app.bundlename} 重复注册，已忽略`);
        return;
      }
      list.push(app);
      injectStyles(app);
    },
    all() { return list.slice(); },
    get(bundle) { return list.find(a => a.bundlename === bundle); },
  };
})();

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