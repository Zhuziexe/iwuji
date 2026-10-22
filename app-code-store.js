/* =========================================================
   app-code-store.js —— 应用代码本地存储（IndexedDB）

   单表 / 单记录设计：
     每个 bundle 只留一份记录（keyPath: 'bundle'）
     更新时整体 put 覆盖，天然原子，不会出现"代码新、meta 旧"

   依赖：无（尽早加载）
   被依赖：app-loader.js / installer.js
   ========================================================= */
window.WujiAppCode = (() => {
  const DB_NAME = 'wujios-appcode';
  const DB_VERSION = 1;
  const STORE = 'apps';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { reject(e); return; }

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'bundle' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      let req;
      try { req = fn(t.objectStore(STORE)); }
      catch (e) {
        try { t.abort(); } catch { }
        reject(e);
        return;
      }
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('transaction aborted'));
    });
  }

  return {
    /** 写入或覆盖一条记录（同一 bundle 只保留一份） */
    async upsert(record) {
      if (!record || !record.bundle) throw new Error('missing bundle');
      const rec = { ...record, savedAt: record.savedAt || Date.now() };
      await tx('readwrite', s => s.put(rec));
      return rec;
    },

    async get(bundle) {
      return tx('readonly', s => s.get(bundle));
    },

    async list() {
      const rows = await tx('readonly', s => s.getAll());
      return Array.isArray(rows) ? rows : [];
    },

    async remove(bundle) {
      await tx('readwrite', s => s.delete(bundle));
    },

    async clear() {
      await tx('readwrite', s => s.clear());
    },

    async has(bundle) {
      const rec = await this.get(bundle);
      return !!rec;
    },

    /** 彻底删除整个数据库（清除数据时用） */
    async destroy() {
      if (dbPromise) {
        try { (await dbPromise).close(); } catch { }
        dbPromise = null;
      }
      return new Promise(resolve => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    },
  };
})();