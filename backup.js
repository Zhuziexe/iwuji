/* =========================================================
   backup.js —— 全量备份 / 恢复
     备份：localStorage(wujios:) + 所有 IndexedDB
     恢复：覆盖写入 + 触发重启
   ========================================================= */
window.WujiBackup = (() => {
  const LS_PREFIX = 'wujios:';
  const FORMAT_VERSION = 1;

  /* ---------------- localStorage ---------------- */
  function dumpLocalStorage() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LS_PREFIX)) {
          out[key] = localStorage.getItem(key);
        }
      }
    } catch (e) {
      console.warn('[backup] localStorage dump failed', e);
    }
    return out;
  }

  function restoreLocalStorage(data) {
    if (!data) return;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LS_PREFIX)) keys.push(key);
      }
      keys.forEach(k => localStorage.removeItem(k));
      Object.keys(data).forEach(k => {
        localStorage.setItem(k, data[k]);
      });
    } catch (e) {
      console.warn('[backup] localStorage restore failed', e);
    }
  }

  /* ---------------- IndexedDB ---------------- */
  async function listDatabases() {
    if (indexedDB.databases) {
      try {
        const list = await indexedDB.databases();
        return list.map(d => d.name).filter(Boolean);
      } catch (e) {
        console.warn('[backup] indexedDB.databases failed', e);
      }
    }
    // 兜底：从已安装应用 + 内置应用里猜库名
    const names = new Set();
    try {
      (window.Store?.get?.('installedApps', []) || [])
        .forEach(a => a.bundle && names.add(a.bundle));
    } catch { }
    try {
      (window.BUILTIN_APPS || [])
        .forEach(a => a.bundlename && names.add(a.bundlename));
    } catch { }
    return [...names];
  }

  function openDatabase(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function readStore(store) {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dumpDatabase(name) {
    const db = await openDatabase(name);
    const stores = {};
    for (const storeName of db.objectStoreNames) {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const records = await readStore(store);
      stores[storeName] = {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes: [...store.indexNames].map(n => {
          const idx = store.index(n);
          return {
            name: idx.name,
            keyPath: idx.keyPath,
            unique: idx.unique,
            multiEntry: idx.multiEntry,
          };
        }),
        records,
      };
    }
    const version = db.version;
    db.close();
    return { name, version, stores };
  }

  async function dumpAllIndexedDB() {
    const names = await listDatabases();
    const out = {};
    for (const name of names) {
      try {
        out[name] = await dumpDatabase(name);
      } catch (e) {
        console.warn('[backup] dump db failed', name, e);
      }
    }
    return out;
  }

  /* 打开现有库；不存在则按备份的 schema 创建 */
  function openOrCreate(name, version, stores) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version || 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.keys(stores).forEach(storeName => {
          if (db.objectStoreNames.contains(storeName)) return;
          const def = stores[storeName];
          const params = {};
          if (def.keyPath != null) params.keyPath = def.keyPath;
          if (def.autoIncrement) params.autoIncrement = true;
          const store = db.createObjectStore(storeName, params);
          (def.indexes || []).forEach(idx => {
            store.createIndex(idx.name, idx.keyPath, {
              unique: !!idx.unique,
              multiEntry: !!idx.multiEntry,
            });
          });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function clearStore(db, storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function writeRecords(db, storeName, records) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      records.forEach(r => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function restoreDatabase(spec) {
    const db = await openOrCreate(spec.name, spec.version, spec.stores);
    for (const storeName of db.objectStoreNames) {
      if (!spec.stores[storeName]) continue;
      await clearStore(db, storeName);
      await writeRecords(db, storeName, spec.stores[storeName].records);
    }
    db.close();
  }

  async function restoreAllIndexedDB(data) {
    if (!data) return;
    for (const name of Object.keys(data)) {
      try {
        await restoreDatabase(data[name]);
      } catch (e) {
        console.warn('[backup] restore db failed', name, e);
      }
    }
  }

  /* ---------------- 对外 ---------------- */
  async function exportAll() {
    return {
      version: FORMAT_VERSION,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      localStorage: dumpLocalStorage(),
      indexedDB: await dumpAllIndexedDB(),
    };
  }

  async function importAll(json) {
    if (!json || typeof json !== 'object') throw new Error('无效的备份文件');
    if (json.version !== FORMAT_VERSION) {
      throw new Error(`备份版本不匹配：文件 ${json.version}，当前支持 ${FORMAT_VERSION}`);
    }
    restoreLocalStorage(json.localStorage);
    await restoreAllIndexedDB(json.indexedDB);
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `wujios-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function triggerRestart() {
    try {
      // 标记：下一次加载时自动开机
      sessionStorage.setItem('wujios:restore-pending', '1');
    } catch (e) {
      console.warn('[backup] sessionStorage failed', e);
    }
    // 立刻刷新整个 DOM，销毁所有应用状态
    location.reload();
  }

  return { exportAll, importAll, downloadJson, triggerRestart };
})();