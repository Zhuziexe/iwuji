/* =========================================================
   fs.js —— 文件系统(纯 OPFS)
   依赖:无
   被依赖:文件管理器 / 任何需要读文件的应用
   ========================================================= */
window.WujiFileSystem = (() => {
  const ROOT = 'files';

  /* ---------- 能力检测 ---------- */
  const supported = !!(navigator.storage && navigator.storage.getDirectory);

  /* ---------- 扩展名 → MIME ---------- */
  const EXT_MIME = {
    jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif',
    webp:'image/webp', svg:'image/svg+xml', bmp:'image/bmp',
    mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime',
    mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg',
    pdf:'application/pdf',
    txt:'text/plain', md:'text/markdown', csv:'text/csv',
    json:'application/json', xml:'application/xml',
    html:'text/html', css:'text/css', js:'text/javascript',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip:'application/zip',
  };
  function guessMime(name) {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return 'application/octet-stream';
    return EXT_MIME[name.slice(dot + 1).toLowerCase()] || 'application/octet-stream';
  }
  function kindOf(name) {
    const m = guessMime(name);
    if (m.startsWith('image/'))       return 'image';
    if (m.startsWith('video/'))       return 'video';
    if (m.startsWith('audio/'))       return 'audio';
    if (m === 'application/pdf')      return 'pdf';
    if (m.startsWith('text/'))        return 'text';
    if (m === 'application/json')     return 'text';
    if (m.startsWith('application/')) return 'document';
    return 'file';
  }

  /* ---------- 路径遍历 ---------- */
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
    const ext  = dot > 0 ? name.slice(dot) : '';
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
          size: f.size, mtime: f.lastModified, mime: guessMime(name),
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
        const f  = await h.getFile();
        const fh = await dst.getFileHandle(name, { create: true });
        const w  = await fh.createWritable();
        await w.write(await f.arrayBuffer());
        await w.close();
      }
    }
  }

  /* ---------- API ---------- */
  const api = {
    supported,

    async list(path = []) {
      const dir = await getDir(path);
      const dirs = [], files = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind === 'directory') dirs.push({ name, kind: 'dir' });
        else {
          const f = await h.getFile();
          files.push({
            name, kind: 'file', size: f.size,
            mtime: f.lastModified, mime: guessMime(name),
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
      let name = opts.name || file.name || '未命名';
      if (!opts.overwrite) name = await uniqueName(dir, name, false);

      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      try {
        await w.write(await file.arrayBuffer());
        await w.close();
      } catch (e) {
        try { await w.abort(); } catch { }
        try { await dir.removeEntry(name); } catch { }
        throw e;
      }
      const saved = await fh.getFile();
      return { name, size: saved.size, mtime: saved.lastModified, mime: guessMime(name) };
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

    guessMime, kindOf,
  };

  return api;
})();