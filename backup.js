/* =========================================================
   backup.js —— 全量备份 / 恢复（二进制，含 OPFS）

   格式 WJBK：
     [magic 4B][version u32][headerLen u32][header JSON][file0][file1]...
   header.opfs[i] 对应紧随其后的第 i 段原始字节

   兼容：importAll 也接受旧版 JSON 对象（v1，无 OPFS）
   ========================================================= */
window.WujiBackup = (() => {
  const LS_PREFIX = 'wujios:';
  const FORMAT_VERSION = 2;
  const MAGIC = 'WJBK';
  const OPFS_ROOT = 'files';

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
    const names = new Set(['wujios-appcode']);
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

  /* ---------------- OPFS ---------------- */
  async function getOPFSRoot() {
    if (!navigator.storage?.getDirectory) {
      throw new Error('当前浏览器不支持 OPFS');
    }
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OPFS_ROOT, { create: true });
  }

  async function walkOPFS(dir, prefix, out) {
    for await (const [name, handle] of dir.entries()) {
      const path = prefix ? prefix + '/' + name : name;
      if (handle.kind === 'directory') {
        await walkOPFS(handle, path, out);
      } else {
        const file = await handle.getFile();
        out.push({ path, file });
      }
    }
  }

  /** 收集 OPFS 里所有文件（按 mtime 正序，恢复时顺序写入） */
  async function collectOPFSFiles() {
    let dir;
    try {
      dir = await getOPFSRoot();
    } catch {
      return [];
    }
    const out = [];
    try {
      await walkOPFS(dir, '', out);
    } catch (e) {
      console.warn('[backup] walk OPFS failed', e);
    }
    out.sort((a, b) => (a.file.lastModified || 0) - (b.file.lastModified || 0));
    return out;
  }

  async function clearOPFS() {
    try {
      const root = await navigator.storage.getDirectory();
      try { await root.removeEntry(OPFS_ROOT, { recursive: true }); } catch { }
    } catch (e) {
      console.warn('[backup] clear OPFS failed', e);
    }
  }

  async function writeOPFSFile(path, data) {
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) return;
    const fileName = parts.pop();

    const root = await navigator.storage.getDirectory();
    let dir = await root.getDirectoryHandle(OPFS_ROOT, { create: true });
    for (const seg of parts) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }

    const fh = await dir.getFileHandle(fileName, { create: true });
    if (typeof fh.createWritable !== 'function') {
      throw new Error('当前浏览器不支持 OPFS 写入（createWritable 缺失）');
    }
    const w = await fh.createWritable();
    try {
      await w.write(data);
      await w.close();
    } catch (e) {
      try { await w.abort(); } catch { }
      try { await dir.removeEntry(fileName); } catch { }
      throw e;
    }
  }

  function buildBinaryFromFiles(header, opfsFiles) {
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));

    const chunks = [];
    chunks.push(new TextEncoder().encode(MAGIC));

    const metaBuf = new ArrayBuffer(8);
    const dv = new DataView(metaBuf);
    dv.setUint32(0, FORMAT_VERSION);
    dv.setUint32(4, headerBytes.length);
    chunks.push(new Uint8Array(metaBuf));

    chunks.push(headerBytes);

    /* ★ 直接拼 File（Blob 子类）—— 零拷贝，不占 JS 内存 */
    for (const f of opfsFiles) {
      if (f.file.size === 0) continue;
      chunks.push(f.file);
    }

    return new Blob(chunks, { type: 'application/octet-stream' });
  }

  function parseBinary(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    if (arrayBuffer.byteLength < 12) throw new Error('备份文件太小');

    const magic = String.fromCharCode(
      dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)
    );
    if (magic !== MAGIC) throw new Error('不是有效的 WujiOS 备份文件');

    const version = dv.getUint32(4);
    if (version !== FORMAT_VERSION) {
      throw new Error(`备份版本不匹配：文件 ${version}，当前支持 ${FORMAT_VERSION}`);
    }

    const headerLen = dv.getUint32(8);
    if (12 + headerLen > arrayBuffer.byteLength) {
      throw new Error('备份文件头损坏');
    }

    const headerBytes = new Uint8Array(arrayBuffer, 12, headerLen);
    const header = JSON.parse(new TextDecoder().decode(headerBytes));

    return { header, dataOffset: 12 + headerLen };
  }

  /* ---------------- 对外 ---------------- */
  /**
   * 导出完整备份（含 OPFS）。
   * @param {object} opts
   *   - onProgress({ phase, current, total, bytes }) 进度回调
   * @returns {Promise<Blob>}
   */
  async function exportAll({ onProgress } = {}) {
    onProgress?.({ phase: 'localStorage' });
    const lsData = dumpLocalStorage();

    onProgress?.({ phase: 'indexedDB' });
    const idbData = await dumpAllIndexedDB();

    onProgress?.({ phase: 'opfs-scan' });
    const opfsFiles = await collectOPFSFiles();
    const totalOpfsBytes = opfsFiles.reduce((s, f) => s + f.file.size, 0);

    const header = {
      version: FORMAT_VERSION,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      localStorage: lsData,
      indexedDB: idbData,
      opfs: opfsFiles.map(f => ({
        path: f.path,
        size: f.file.size,
        mtime: f.file.lastModified,
      })),
      opfsTotalBytes: totalOpfsBytes,
    };

    onProgress?.({ phase: 'pack' });
    return buildBinaryFromFiles(header, opfsFiles);
  }

  /**
   * 导入备份。
   * 支持：
   *   - Blob / ArrayBuffer / Uint8Array（新版二进制 WJBK）
   *   - Object（旧版 JSON，v1，无 OPFS）
   * @param {Blob|ArrayBuffer|Uint8Array|object} input
   * @param {object} opts
   *   - onProgress({ phase, current, total, name })
   */
    /* =========================================================
     Blob 流式导入 —— 内存恒定，只保留当前文件的缓冲
     ========================================================= */
  async function importFromBlobStream(blob, { onProgress } = {}) {
    const reader = blob.stream().getReader();

    let pending = new Uint8Array(0);   // 未消费的缓冲

    /**
     * 从流里精确读 n 字节。
     * 不足 n 字节时持续 read()，最终只返回 n 字节，
     * 剩余部分留在 pending 里给下一次调用。
     */
    async function readAtLeast(n) {
      while (pending.length < n) {
        const { value, done } = await reader.read();
        if (done) throw new Error('备份文件意外结束（数据不完整）');
        const merged = new Uint8Array(pending.length + value.length);
        merged.set(pending, 0);
        merged.set(value, pending.length);
        pending = merged;
      }
      const out = pending.slice(0, n);
      pending = pending.slice(n);
      return out;
    }

    try {
      /* ---------- 1. 固定头 12 字节 ---------- */
      const head = await readAtLeast(12);
      const magic = String.fromCharCode(head[0], head[1], head[2], head[3]);
      if (magic !== MAGIC) throw new Error('不是有效的 WujiOS 备份文件');

      const dv = new DataView(head.buffer, head.byteOffset, 12);
      const version = dv.getUint32(4);
      if (version !== FORMAT_VERSION) {
        throw new Error(`备份版本不匹配：文件 ${version}，当前支持 ${FORMAT_VERSION}`);
      }
      const headerLen = dv.getUint32(8);

      /* ---------- 2. header JSON ---------- */
      const headerBytes = await readAtLeast(headerLen);
      const header = JSON.parse(new TextDecoder().decode(headerBytes));

      /* ---------- 3. localStorage ---------- */
      onProgress?.({ phase: 'localStorage' });
      restoreLocalStorage(header.localStorage);

      /* ---------- 4. IndexedDB ---------- */
      onProgress?.({ phase: 'indexedDB' });
      await restoreAllIndexedDB(header.indexedDB);

      /* ---------- 5. OPFS ---------- */
      const opfsList = Array.isArray(header.opfs) ? header.opfs : [];
      if (opfsList.length) {
        onProgress?.({ phase: 'opfs-clear' });
        await clearOPFS();

        for (let i = 0; i < opfsList.length; i++) {
          const info = opfsList[i];
          const size = info.size || 0;
          onProgress?.({
            phase: 'opfs-write',
            current: i + 1,
            total: opfsList.length,
            name: info.path,
          });

          let data;
          try {
            data = size > 0 ? await readAtLeast(size) : new Uint8Array(0);
          } catch (e) {
            console.warn('[backup] OPFS 数据读取中断，跳过剩余', info.path, e);
            break;
          }

          try {
            await writeOPFSFile(info.path, data);
          } catch (e) {
            console.warn('[backup] write OPFS file failed', info.path, e);
          }
        }
      }

      return { format: 'binary', hadOPFS: opfsList.length > 0 };
    } finally {
      try { await reader.cancel(); } catch { }
    }
  }

  /* =========================================================
     ArrayBuffer / Uint8Array 路径 —— 数据已在内存，按偏移切片
     ========================================================= */
  async function importFromBuffer(arrayBuffer, { onProgress } = {}) {
    const { header, dataOffset } = parseBinary(arrayBuffer);

    onProgress?.({ phase: 'localStorage' });
    restoreLocalStorage(header.localStorage);

    onProgress?.({ phase: 'indexedDB' });
    await restoreAllIndexedDB(header.indexedDB);

    const opfsList = Array.isArray(header.opfs) ? header.opfs : [];
    if (opfsList.length) {
      onProgress?.({ phase: 'opfs-clear' });
      await clearOPFS();

      let offset = dataOffset;
      for (let i = 0; i < opfsList.length; i++) {
        const info = opfsList[i];
        const size = info.size || 0;
        onProgress?.({
          phase: 'opfs-write',
          current: i + 1,
          total: opfsList.length,
          name: info.path,
        });

        if (offset + size > arrayBuffer.byteLength) {
          console.warn('[backup] OPFS 数据不完整，跳过', info.path);
          break;
        }

        const data = arrayBuffer.slice(offset, offset + size);
        offset += size;

        try {
          await writeOPFSFile(info.path, data);
        } catch (e) {
          console.warn('[backup] write OPFS file failed', info.path, e);
        }
      }
    }

    return { format: 'binary', hadOPFS: opfsList.length > 0 };
  }

  /* =========================================================
     统一入口 —— 三路分流
     ========================================================= */
  async function importAll(input, { onProgress } = {}) {
    /* ---- 旧版 JSON 对象（v1，无 OPFS） ---- */
    if (input && typeof input === 'object'
        && !(input instanceof Blob)
        && !(input instanceof ArrayBuffer)
        && !ArrayBuffer.isView(input)) {
      if (input.version !== 1) {
        throw new Error(`不支持的备份版本：${input.version}`);
      }
      onProgress?.({ phase: 'localStorage' });
      restoreLocalStorage(input.localStorage);
      onProgress?.({ phase: 'indexedDB' });
      await restoreAllIndexedDB(input.indexedDB);
      return { format: 'legacy', hadOPFS: false };
    }

    /* ---- Blob / File → 流式 ---- */
    if (input instanceof Blob) {
      onProgress?.({ phase: 'read-file' });
      return importFromBlobStream(input, { onProgress });
    }

    /* ---- ArrayBuffer / Uint8Array → 内存切片 ---- */
    let arrayBuffer;
    if (input instanceof ArrayBuffer) {
      arrayBuffer = input;
    } else if (ArrayBuffer.isView(input)) {
      arrayBuffer = input.buffer.slice(
        input.byteOffset, input.byteOffset + input.byteLength
      );
    } else {
      throw new Error('无效的备份文件');
    }

    return importFromBuffer(arrayBuffer, { onProgress });
  }

  /**
   * 下载。兼容旧调用：传对象 → JSON，传 Blob → 直接下载。
   */
  function downloadJson(data, filename) {
    let blob;
    if (data instanceof Blob) {
      blob = data;
    } else {
      blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    }

    const ext = blob.type === 'application/json' ? 'json' : 'wjbk';
    const name = filename || `wujios-backup-${new Date().toISOString().slice(0, 10)}.${ext}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function triggerRestart() {
    try {
      sessionStorage.setItem('wujios:restore-pending', '1');
    } catch (e) {
      console.warn('[backup] sessionStorage failed', e);
    }
    location.reload();
  }

  return { exportAll, importAll, downloadJson, triggerRestart };
})();