/* =========================================================
   fs-worker.js —— OPFS 写入 Worker

   主线程 getFileHandle / createWritable 失败时降级使用。
   依赖：FileSystemSyncAccessHandle（专用 Worker 才有的 API）
   ========================================================= */
self.onmessage = async (e) => {
  const { id, action, payload } = e.data || {};
  try {
    let result;
    switch (action) {
      case 'write':
        result = await handleWrite(payload);
        break;
      default:
        throw new Error('未知 action: ' + action);
    }
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || String(err) });
  }
};

async function getDirByPath(parentPath) {
  const root = await navigator.storage.getDirectory();
  let dir = await root.getDirectoryHandle('files', { create: true });
  for (const seg of parentPath || []) {
    dir = await dir.getDirectoryHandle(seg);
  }
  return dir;
}

async function uniqueNameInDir(dir, name) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext  = dot > 0 ? name.slice(dot) : '';
  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? name : `${base} (${i})${ext}`;
    try { await dir.getFileHandle(candidate); }
    catch { return candidate; }
  }
  return `${base} (${Date.now()})${ext}`;
}

async function handleWrite({ parentPath, name, buffer, overwrite }) {
  const dir = await getDirByPath(parentPath);

  const finalName = overwrite
    ? name
    : await uniqueNameInDir(dir, name);

  const fh = await dir.getFileHandle(finalName, { create: true });

  if (typeof fh.createSyncAccessHandle !== 'function') {
    throw new Error('Worker 环境不支持同步文件写入');
  }

  const access = await fh.createSyncAccessHandle();
  try {
    access.truncate(0);
    access.write(new Uint8Array(buffer), { at: 0 });
    access.flush();
  } finally {
    access.close();
  }

  const saved = await fh.getFile();
  return { name: finalName, size: saved.size, mtime: saved.lastModified };
}