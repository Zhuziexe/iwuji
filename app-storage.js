/* =========================================================
   app-storage.js —— 按应用包名隔离的 IndexedDB 存储

   用法：
     const db = AppStorage.for('com.wujios.weather');
     await db.set('cache.杭州', {...});
     const v = await db.get('cache.杭州', {});
     await db.clear();            // 应用卸载时调

   特点：
     - 单 DB / 单 store / 复合主键 [bundle, key]
     - 按 bundle 建索引，读取和清除都是 O(应用自己的行数)
     - IndexedDB 不可用（隐私模式等）时自动降级到内存
     - 系统级小数据继续走 Store(localStorage)，本模块只管"应用私有数据"
   ========================================================= */
window.AppStorage = (() => {
  const DB_NAME    = 'wujios-appdata';
  const DB_VERSION = 1;
  const STORE      = 'kv';
  const MEM_SEP    = '\x00';

  let dbPromise = null;
  let memMode   = false;
  const mem     = new Map();   // 降级存储：bundle\x00key -> value

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { reject(e); return; }

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: ['bundle', 'key'] });
          store.createIndex('byBundle', 'bundle', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror   = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    return dbPromise;
  }

  async function ensureDB() {
    if (memMode) return null;
    try { return await openDB(); }
    catch (e) {
      console.warn('[AppStorage] IndexedDB 不可用，降级到内存', e);
      memMode = true;
      return null;
    }
  }

  function reqAsync(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  function memKey(bundle, key) { return bundle + MEM_SEP + key; }

  function makeApi(bundle) {
    return {
      async get(key, fallback = null) {
        const db = await ensureDB();
        if (!db) {
          const k = memKey(bundle, key);
          return mem.has(k) ? mem.get(k) : fallback;
        }
        const t = db.transaction(STORE, 'readonly');
        const row = await reqAsync(t.objectStore(STORE).get([bundle, key]));
        return row ? row.value : fallback;
      },

      async set(key, value) {
        const db = await ensureDB();
        if (!db) { mem.set(memKey(bundle, key), value); return; }
        return new Promise((resolve, reject) => {
          const t = db.transaction(STORE, 'readwrite');
          t.objectStore(STORE).put({ bundle, key, value, updatedAt: Date.now() });
          t.oncomplete = () => resolve();
          t.onerror    = () => reject(t.error);
        });
      },

      async remove(key) {
        const db = await ensureDB();
        if (!db) { mem.delete(memKey(bundle, key)); return; }
        return new Promise((resolve, reject) => {
          const t = db.transaction(STORE, 'readwrite');
          t.objectStore(STORE).delete([bundle, key]);
          t.oncomplete = () => resolve();
          t.onerror    = () => reject(t.error);
        });
      },

      async keys() {
        const db = await ensureDB();
        if (!db) {
          const pre = bundle + MEM_SEP;
          return [...mem.keys()].filter(k => k.startsWith(pre)).map(k => k.slice(pre.length));
        }
        const t = db.transaction(STORE, 'readonly');
        const idx = t.objectStore(STORE).index('byBundle');
        const rows = await reqAsync(idx.getAll(bundle));
        return rows.map(r => r.key);
      },

      async all() {
        const db = await ensureDB();
        if (!db) {
          const pre = bundle + MEM_SEP;
          const out = {};
          for (const [k, v] of mem) {
            if (k.startsWith(pre)) out[k.slice(pre.length)] = v;
          }
          return out;
        }
        const t = db.transaction(STORE, 'readonly');
        const idx = t.objectStore(STORE).index('byBundle');
        const rows = await reqAsync(idx.getAll(bundle));
        return rows.reduce((acc, r) => (acc[r.key] = r.value, acc), {});
      },

      async clear() {
        const db = await ensureDB();
        if (!db) {
          const pre = bundle + MEM_SEP;
          for (const k of [...mem.keys()]) if (k.startsWith(pre)) mem.delete(k);
          return;
        }
        return new Promise((resolve, reject) => {
          const t = db.transaction(STORE, 'readwrite');
          const idx = t.objectStore(STORE).index('byBundle');
          const cursorReq = idx.openCursor(bundle);
          cursorReq.onsuccess = e => {
            const c = e.target.result;
            if (c) { c.delete(); c.continue(); }
          };
          t.oncomplete = () => resolve();
          t.onerror    = () => reject(t.error);
        });
      },

      async size() {
        const data = await this.all();
        try { return new Blob([JSON.stringify(data)]).size; }
        catch { return 0; }
      },
    };
  }

  const apis = new Map();

  return {
    /* 拿一个应用的私有 DB 对象，重复调用返回同一实例 */
    for(bundle) {
      if (!apis.has(bundle)) apis.set(bundle, makeApi(bundle));
      return apis.get(bundle);
    },

    /* 卸载应用时调一次：清空该应用的所有数据 */
    async uninstall(bundle) {
      try { await makeApi(bundle).clear(); }
      catch (e) { console.warn('[AppStorage] uninstall failed', bundle, e); }
      apis.delete(bundle);
    },

    /* 全应用用量统计：{ bundle: { count, bytes } } */
    async usageAll() {
      const db = await ensureDB();
      if (!db) {
        const map = {};
        const preMap = {};
        for (const k of mem.keys()) {
          const i = k.indexOf(MEM_SEP);
          if (i < 0) continue;
          const b = k.slice(0, i);
          preMap[b] = (preMap[b] || 0) + 1;
        }
        for (const [b, n] of Object.entries(preMap)) map[b] = { count: n, bytes: 0 };
        return map;
      }
      const t = db.transaction(STORE, 'readonly');
      const rows = await reqAsync(t.objectStore(STORE).index('byBundle').getAll());
      const map = {};
      for (const r of rows) {
        const b = r.bundle;
        if (!map[b]) map[b] = { count: 0, bytes: 0 };
        map[b].count++;
        try { map[b].bytes += new Blob([JSON.stringify(r.value)]).size; } catch {}
      }
      return map;
    },

    /* 探测是否真的可用 */
    async available() {
      return (await ensureDB()) !== null;
    },

    get isMemoryOnly() { return memMode; },

    /* 在 return 对象里追加 */
async clearAll() {
  const db = await ensureDB();
  if (!db) { mem.clear(); return; }
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).clear();
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
},

/* 彻底删除整个数据库（比 clear 更干净，连索引都没了） */
async destroy() {
  apis.clear();
  mem.clear();
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {}
    dbPromise = null;
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
    req.onblocked = () => resolve(); // 有别的连接没关，也当成功
  });
},
  };
})();