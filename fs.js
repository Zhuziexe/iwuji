/* =========================================================
   fs.js —— 文件系统(纯 OPFS)
   依赖:无
   被依赖:文件管理器 / 任何需要读文件的应用
   ========================================================= */
window.WujiFileSystem = (() => {
  const ROOT = 'files';
  const INITIAL_DIRS = ['Pictures', 'Documents', 'Downloads'];
  /* ---------- Worker 通道 ---------- */
  let fsWorker = null;
  let fsWorkerBroken = false;
  let fsSeq = 0;
  const fsPending = new Map();

  function getFsWorker() {
    if (fsWorkerBroken) return null;
    if (fsWorker) return fsWorker;
    try {
      fsWorker = new Worker('fs-worker.js');
    } catch (e) {
      console.warn('[fs] Worker 创建失败', e);
      fsWorkerBroken = true;
      return null;
    }
    fsWorker.onmessage = (e) => {
      const { id, ok, error, result } = e.data || {};
      const p = fsPending.get(id);
      if (!p) return;
      fsPending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error || 'Worker 操作失败'));
    };
    fsWorker.onerror = (e) => {
      console.error('[fs-worker] 运行时错误', e);
      for (const [, p] of fsPending) {
        p.reject(new Error('Worker 运行时错误: ' + (e.message || '')));
      }
      fsPending.clear();
      fsWorkerBroken = true;
      fsWorker = null;
    };
    return fsWorker;
  }

  function workerCall(action, payload) {
    return new Promise((resolve, reject) => {
      const w = getFsWorker();
      if (!w) return reject(new Error('Worker 不可用'));
      const id = ++fsSeq;
      fsPending.set(id, { resolve, reject });
      w.postMessage({ id, action, payload });
    });
  }
  /* ---------- 能力检测 ---------- */
  const supported = !!(navigator.storage && navigator.storage.getDirectory);

  const EXT_KIND = {
    image: ['jpg','jpeg','png','gif','webp','svg','bmp','ico','heic','avif','tif','tiff'],
    video: ['mp4','webm','mov','avi','mkv','m4v','flv','wmv','3gp','mpeg','mpg'],
    audio: ['mp3','wav','ogg','flac','m4a','aac','opus','wma','amr','aiff','ape'],
    text:  ['txt','md','markdown','csv','tsv','json','xml','html','htm','css',
            'js','mjs','ts','jsx','tsx','yml','yaml','ini','toml','log',
            'sh','bat','ps1','py','rb','go','rs','java','c','h','cpp','hpp',
            'cs','php','sql','lua'],
    doc:   ['doc','docx','odt','rtf','pdf'],
    xls:   ['xls','xlsx','ods'],
  };

  function kindOf(name) {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return 'file';
    const ext = name.slice(dot + 1).toLowerCase();
    for (const kind of Object.keys(EXT_KIND)) {
      if (EXT_KIND[kind].includes(ext)) return kind;
    }
    return 'file';
  }

  async function getRoot() {
    const r = await navigator.storage.getDirectory();
    return r.getDirectoryHandle(ROOT, { create: true });
  }
  async function getDir(path) {
    let dir = await getRoot();
    for (const seg of path) dir = await dir.getDirectoryHandle(seg);
    return dir;
  }

  /* ---------- 唯一名 ---------- */
  async function uniqueName(dir, name, isDir) {
    const probe = isDir
      ? n => dir.getDirectoryHandle(n)
      : n => dir.getFileHandle(n);
    try { await probe(name); } catch { return name; }

    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let i = 1; i < 1000; i++) {
      const c = `${base} (${i})${ext}`;
      try { await probe(c); } catch { return c; }
    }
    return `${base} (${Date.now()})${ext}`;
  }

  /* ---------- 递归辅助 ---------- */
  async function walk(dir, prefix = []) {
    const out = [];
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'directory') {
        out.push({ name, path: [...prefix, name], kind: 'dir' });
        out.push(...await walk(h, [...prefix, name]));
      } else {
        const f = await h.getFile();
        out.push({
          name, path: [...prefix, name], kind: 'file',
          size: f.size, mtime: f.lastModified, 
        });
      }
    }
    return out;
  }
  async function copyTree(src, dst) {
    for await (const [name, h] of src.entries()) {
      if (h.kind === 'directory') {
        const sub = await dst.getDirectoryHandle(name, { create: true });
        await copyTree(h, sub);
      } else {
        const f = await h.getFile();
        const fh = await dst.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(await f.arrayBuffer());
        await w.close();
      }
    }
  }

  /* ---------- API ---------- */
  const api = {
    supported,
    async ensureStructure() {
      try {
        const root = await getRoot();
        for (const name of INITIAL_DIRS) {
          try {
            await root.getDirectoryHandle(name, { create: true });
          } catch (e) {
            console.warn('[fs] 创建目录失败:', name, e);
          }
        }
        return true;
      } catch (e) {
        console.warn('[fs] ensureStructure 失败', e);
        return false;
      }
    },
    async list(path = []) {
      const dir = await getDir(path);
      const dirs = [], files = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind === 'directory') dirs.push({ name, kind: 'dir' });
        else {
          const f = await h.getFile();
          files.push({
            name, kind: 'file', size: f.size,
            mtime: f.lastModified,
          });
        }
      }
      const cmp = (a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN');
      return [...dirs.sort(cmp), ...files.sort(cmp)];
    },

    async walkAll(path = []) {
      return walk(await getDir(path), path);
    },

    async mkdir(parentPath, name) {
      const dir = await getDir(parentPath);
      const finalName = await uniqueName(dir, name, true);
      await dir.getDirectoryHandle(finalName, { create: true });
      return finalName;
    },

    async add(parentPath, file, opts = {}) {
      const dir = await getDir(parentPath);
      const name = opts.name || file.name || '未命名';
      const overwrite = !!opts.overwrite;

      /* 主线程先算唯一名，失败则交给 Worker 处理 */
      let targetName = name;
      if (!overwrite) {
        try { targetName = await uniqueName(dir, name, false); }
        catch { targetName = name; }
      }

      const buffer = await file.arrayBuffer();

      /* ---------- 尝试主线程 ---------- */
      let mainError = null;
      try {
        const fh = await dir.getFileHandle(targetName, { create: true });

        if (typeof fh.createWritable !== 'function') {
          /* 没有 createWritable：清理可能创建的空文件，走 Worker */
          try { await dir.removeEntry(targetName); } catch { }
          throw new Error('主线程不支持 createWritable');
        }

        const w = await fh.createWritable();
        try {
          await w.write(buffer);
          await w.close();
        } catch (e) {
          try { await w.abort(); } catch { }
          try { await dir.removeEntry(targetName); } catch { }
          throw e;
        }

        const saved = await fh.getFile();
        return {
          name: targetName,
          size: saved.size,
          mtime: saved.lastModified,
        };
      } catch (e) {
        mainError = e;
        console.warn('[fs] 主线程写入失败，尝试 Worker:', e.message);
        try { await dir.removeEntry(targetName); } catch { }
      }

      /* ---------- 降级到 Worker ---------- */
      try {
        const r = await workerCall('write', {
          parentPath,
          name: targetName,
          buffer,
          overwrite,
        });
        return {
          name: r.name,
          size: r.size,
          mtime: r.mtime,
        };
      } catch (workerError) {
        console.error('[fs] Worker 写入也失败', workerError);

        /* 抛出清晰的错误，让文件管理器弹窗展示 */
        const mainMsg = mainError?.message || '未知错误';
        const wMsg = workerError?.message || '未知错误';

        throw new Error(
          `文件写入失败（已尝试主线程与 Worker）\n` +
          `主线程：${mainMsg}\n` +
          `Worker：${wMsg}\n\n` +
          `可能原因：\n` +
          `· 当前浏览器限制了本地文件存储\n` +
          `· 无痕/隐私模式\n` +
          `· 存储空间不足\n` +
          `· 浏览器版本 Bug（如 Android WebView 132）`
        );
      }
    },

    async read(path) {
      const dir = await getDir(path.slice(0, -1));
      try {
        const fh = await dir.getFileHandle(path[path.length - 1]);
        return await fh.getFile();
      } catch { return null; }
    },

    async remove(path) {
      const dir = await getDir(path.slice(0, -1));
      try {
        await dir.removeEntry(path[path.length - 1], { recursive: true });
        return true;
      } catch { return false; }
    },

    async rename(path, newName) {
      const parentPath = path.slice(0, -1);
      const oldName = path[path.length - 1];
      if (oldName === newName) return newName;

      const dir = await getDir(parentPath);
      let isDir = false;
      try { await dir.getDirectoryHandle(oldName); isDir = true; } catch { }

      const finalName = await uniqueName(dir, newName, isDir);

      if (!isDir) {
        const f = await (await dir.getFileHandle(oldName)).getFile();
        const fh = await dir.getFileHandle(finalName, { create: true });
        const w = await fh.createWritable();
        await w.write(await f.arrayBuffer());
        await w.close();
        await dir.removeEntry(oldName);
      } else {
        const srcDir = await dir.getDirectoryHandle(oldName);
        const dstDir = await dir.getDirectoryHandle(finalName, { create: true });
        await copyTree(srcDir, dstDir);
        await dir.removeEntry(oldName, { recursive: true });
      }
      return finalName;
    },

    async getURL(path) {
      const f = await this.read(path);
      return f ? URL.createObjectURL(f) : null;
    },

    async download(path) {
      const f = await this.read(path);
      if (!f) return false;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = path[path.length - 1];
      document.body.appendChild(a);
      a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return true;
    },

    async estimate() {
      if (navigator.storage?.estimate) {
        try { return await navigator.storage.estimate(); } catch { }
      }
      return null;
    },

    kindOf,
  };
  if (supported) {
    /* 延迟到下一帧，避免和首屏渲染争资源 */
    setTimeout(() => {
      api.ensureStructure().catch(e => {
        console.warn('[fs] 自动初始化失败', e);
      });
    }, 0);
  }
  return api;
})();