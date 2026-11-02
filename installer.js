/* =========================================================
   installer.js —— 已安装应用的安装 / 更新 / 卸载 / 列表

   平台字段：
     - record.platforms / meta.platforms
     - 只在存在且非空时写入（向后兼容旧记录）
     - 旧记录无 platforms → 视为全平台
   ========================================================= */
window.WujiAppInstaller = (() => {
  const KEY = 'installedApps';

  /* ---------- 版本比较 ---------- */
  function cmpVer(a, b) {
    const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  /* ---------- 内部工具 ---------- */
  function readAll() {
    const list = Store.get(KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function writeAll(list) {
    Store.set(KEY, list);
  }

  function pickPlatforms(obj) {
    const p = obj?.platforms;
    return (Array.isArray(p) && p.length) ? p.slice() : null;
  }

  function metaFromRecord(rec) {
    const meta = {
      bundlename: rec.bundle,
      name: rec.name,
      icon: rec.icon,
      version: rec.version,
      author: rec.author,
      description: rec.description,
      src: rec.src,
    };
    const p = pickPlatforms(rec);
    if (p) meta.platforms = p;
    if (Array.isArray(rec.fileTypes) && rec.fileTypes.length) {
      meta.fileTypes = rec.fileTypes.slice();       // ★ 新增
    }
    return meta;
  }

  function recordFromMeta(meta) {
    const bundle = meta.bundle || meta.bundlename;
    const rec = {
      bundle,
      name: meta.name || bundle,
      icon: meta.icon || '',
      version: meta.version || '1.0.0',
      author: meta.author || '',
      description: meta.description || '',
      src: meta.src || meta._src || '',
      installedAt: Date.now(),
    };
    const p = pickPlatforms(meta);
    if (p) rec.platforms = p;
    if (Array.isArray(meta.fileTypes) && meta.fileTypes.length) {
      rec.fileTypes = meta.fileTypes.slice();       // ★ 新增
    }
    return rec;
  }

  function idbMetaFromMeta(meta, bundle) {
    const m = {
      name: meta.name || bundle,
      icon: meta.icon || '',
      author: meta.author || '',
      description: meta.description || '',
    };
    const p = pickPlatforms(meta);
    if (p) m.platforms = p;
    if (Array.isArray(meta.fileTypes) && meta.fileTypes.length) {
      m.fileTypes = meta.fileTypes.slice();       // ★ 新增
    }
    return m;
  }

  /* ---------- 对外 API ---------- */
  return {
    list() { return readAll().slice(); },

    /** 当前平台可见的已安装记录（供 PC 的"已安装管理"用） */
    listForCurrentPlatform() {
      const cur = window.__OPENWUJI_PLATFORM || 'wujios';
      return readAll().filter(a => {
        if (!Array.isArray(a.platforms) || a.platforms.length === 0) return true;
        return a.platforms.includes(cur);
      });
    },

    get(bundle) {
      return readAll().find(a => a.bundle === bundle) || null;
    },

    has(bundle) {
      return readAll().some(a => a.bundle === bundle);
    },

    getVersion(bundle) {
      const rec = this.get(bundle);
      return rec ? rec.version : null;
    },

    /* ---------- 安装 / 更新 ---------- */
    async install(meta, { force = false, code = null } = {}) {
      if (!meta) throw new Error('installer.install: missing meta');

      const bundle = meta.bundle || meta.bundlename;
      const src = meta.src || meta._src;
      if (!bundle) throw new Error('installer.install: missing bundle');
      if (!src && code == null) throw new Error('installer.install: missing src/code');

      const nextVersion = meta.version || '1.0.0';
      const existing = this.get(bundle);

      if (existing && !force) {
        const c = cmpVer(existing.version, nextVersion);
        if (c === 0) return { ok: false, action: 'noop', version: existing.version };
        if (c > 0) return { ok: false, action: 'newer-local', version: existing.version };
      }

      const nextPlatforms = pickPlatforms(meta) || pickPlatforms(existing) || null;
      const nextFileTypes = Array.isArray(meta.fileTypes) && meta.fileTypes.length
        ? meta.fileTypes.slice()
        : (existing?.fileTypes ? existing.fileTypes.slice() : null);

      /* 取代码 */
      let codeText;
      if (code != null) {
        codeText = code;
      } else if (src.startsWith('idb://')) {
        const rec = await WujiAppCode.get(bundle);
        if (!rec) return { ok: false, action: 'idb-failed', error: new Error('IDB 中不存在代码') };
        codeText = rec.code;
      } else {
        try {
          const r = await fetch(src, { cache: 'no-store' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          codeText = await r.text();
        } catch (e) {
          return { ok: false, action: 'fetch-failed', error: e };
        }
      }

      /* 原子写 IDB */
      try {
        await WujiAppCode.upsert({
          bundle,
          version: nextVersion,
          code: codeText,
          meta: idbMetaFromMeta(
            {
              ...meta,
              platforms: nextPlatforms || undefined,
              fileTypes: nextFileTypes || undefined,     // ★ 新增
            },
            bundle
          ),
          savedAt: Date.now(),
        });
      } catch (e) {
        return { ok: false, action: 'idb-failed', error: e };
      }

      /* 写 Store */
      const record = recordFromMeta({
        ...meta,
        bundle,
        src: `idb://${bundle}`,
        version: nextVersion,
        platforms: nextPlatforms || undefined,
      });
      if (existing) record.installedAt = existing.installedAt || Date.now();

      const list = readAll();
      const idx = list.findIndex(a => a.bundle === bundle);
      if (idx >= 0) list[idx] = record; else list.push(record);
      writeAll(list);

      /* 清 loader 缓存 + 重注册 */
      try { WujiAppLoader.invalidate(`idb://${bundle}`); } catch { }

      if (WujiApps.isInstalled(bundle)) {
        try { WujiApps.shutdownOne(bundle); } catch { }
        WujiApps.unregister(bundle);
      }

      /* ★ 用最终 platforms 决定是否要注册（别的平台的应用只写数据、不注册） */
      const finalMeta = { ...metaFromRecord(record), src: `idb://${bundle}` };
      if (WujiApps.platformAllowed(finalMeta)) {
        WujiApps.registerMeta(finalMeta, 'installed');
      }

      return { ok: true, action: existing ? 'updated' : 'installed', version: nextVersion };
    },

    /* ---------- 卸载 ---------- */
    async uninstall(bundle) {
      if (!bundle) return false;
      if (!this.has(bundle)) return false;

      const list = readAll();
      const rec = list.find(a => a.bundle === bundle);
      const src = rec?.src || '';

      writeAll(list.filter(a => a.bundle !== bundle));

      try { WujiApps.shutdownOne(bundle); }
      catch (e) { console.warn('[installer] shutdownOne', bundle, e); }

      try { await AppStorage.uninstall(bundle); }
      catch (e) { console.warn('[installer] AppStorage.uninstall failed', bundle, e); }

      try { await WujiAppCode.remove(bundle); }
      catch (e) { console.warn('[installer] IDB remove failed', bundle, e); }

      try {
        if (window.WujiNotification?.clearByBundle) {
          WujiNotification.clearByBundle(bundle);
        }
      } catch (e) { console.warn('[installer] 清理通知失败', bundle, e); }

      if (window.DesktopLayout?.removeApp) {
        DesktopLayout.removeApp(bundle);
      }

      if (window.WujiAppLoader?.invalidate) {
        const target = src || `idb://${bundle}`;
        try { WujiAppLoader.invalidate(target); } catch { }
      }

      WujiApps.unregister(bundle);
      return true;
    },

    /* ---------- 启动恢复 ---------- */
    async restore() {
      let idbRecords = [];
      try {
        idbRecords = await WujiAppCode.list();
      } catch (e) {
        console.warn('[installer] IDB list failed', e);
      }

      const idbMap = new Map();
      for (const r of idbRecords) idbMap.set(r.bundle, r);

      const storeList = readAll();
      const seen = new Set();
      const newRecords = [];
      const legacyRecords = [];

      /* 处理 Store 里已有的 */
      for (const rec of storeList) {
        if (!rec?.bundle) continue;
        seen.add(rec.bundle);

        const idbRec = idbMap.get(rec.bundle);

        if (idbRec) {
          const platforms = pickPlatforms(rec) || pickPlatforms(idbRec.meta) || null;

          const fileTypes = (Array.isArray(rec.fileTypes) && rec.fileTypes.length)
            ? rec.fileTypes
            : (Array.isArray(idbRec.meta?.fileTypes) ? idbRec.meta.fileTypes : null);

          const src = (rec.src && rec.src.startsWith('idb://'))
            ? rec.src
            : `idb://${rec.bundle}`;

          const meta = {
            bundlename: rec.bundle,
            name: rec.name || idbRec.meta?.name || rec.bundle,
            icon: rec.icon || idbRec.meta?.icon || '',
            version: idbRec.version,
            author: rec.author || idbRec.meta?.author || '',
            description: rec.description || idbRec.meta?.description || '',
            src,
          };
          if (platforms) meta.platforms = platforms;
          if (fileTypes) meta.fileTypes = fileTypes;

          WujiApps.registerMeta(meta, 'installed');

          if (!rec.platforms && platforms) {
            rec.platforms = platforms;
          }
          if (!rec.fileTypes && fileTypes) {
            rec.fileTypes = fileTypes.slice();
          }
        } else if (rec.src) {
          WujiApps.registerMeta(metaFromRecord(rec), 'installed');
          if (!rec.src.startsWith('idb://')) {
            legacyRecords.push(rec);
          }
        }
      }

      /* IDB 里有、Store 里没有的 */
      for (const rec of idbRecords) {
        if (seen.has(rec.bundle)) continue;

        const platforms = pickPlatforms(rec.meta) || null;
        const fileTypes = (Array.isArray(rec.meta?.fileTypes) && rec.meta.fileTypes.length)
          ? rec.meta.fileTypes
          : null;

        const meta = {
          bundlename: rec.bundle,
          name: rec.meta?.name || rec.bundle,
          icon: rec.meta?.icon || '',
          version: rec.version,
          author: rec.meta?.author || '',
          description: rec.meta?.description || '',
          src: `idb://${rec.bundle}`,
        };
        if (platforms) meta.platforms = platforms;
        if (fileTypes) meta.fileTypes = fileTypes;
        WujiApps.registerMeta(meta, 'installed');

        const newRec = {
          ...recordFromMeta(meta),
          installedAt: rec.savedAt || Date.now(),
        };
        newRecords.push(newRec);
      }

      if (newRecords.length) {
        writeAll([...readAll(), ...newRecords]);
      }

      /* ★ 若本次迁移给 Store 里的记录补了 platforms，写回 */
      writeAll(storeList);

      return { newRecords, legacyRecords };
    },

    /* ---------- 旧 URL src 迁移到 IDB ---------- */
    async migrateLegacyToIdb(records) {
      if (!Array.isArray(records) || !records.length) return 0;

      let migrated = 0;
      for (const rec of records) {
        if (!rec?.bundle || !rec.src) continue;
        if (rec.src.startsWith('idb://')) continue;

        try {
          const existing = await WujiAppCode.get(rec.bundle);
          if (existing) {
            const list = readAll();
            const idx = list.findIndex(a => a.bundle === rec.bundle);
            if (idx >= 0) {
              list[idx] = { ...list[idx], src: `idb://${rec.bundle}` };
              writeAll(list);
            }
            migrated++;
            continue;
          }
        } catch { }

        let code;
        try {
          const r = await fetch(rec.src, { cache: 'no-store' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          code = await r.text();
        } catch (e) {
          console.warn('[installer] 迁移 fetch 失败，跳过', rec.bundle, e.message);
          continue;
        }

        try {
          const idbMeta = {
            name: rec.name || rec.bundle,
            icon: rec.icon || '',
            author: rec.author || '',
            description: rec.description || '',
          };
          const p = pickPlatforms(rec);
          if (p) idbMeta.platforms = p;

          await WujiAppCode.upsert({
            bundle: rec.bundle,
            version: rec.version || '1.0.0',
            code,
            meta: idbMeta,
            savedAt: Date.now(),
          });
        } catch (e) {
          console.warn('[installer] 迁移写 IDB 失败，跳过', rec.bundle, e.message);
          continue;
        }

        const list = readAll();
        const idx = list.findIndex(a => a.bundle === rec.bundle);
        if (idx >= 0) {
          list[idx] = { ...list[idx], src: `idb://${rec.bundle}` };
          writeAll(list);
        }
        migrated++;
      }

      return migrated;
    },

    async pruneMissing() { return 0; },
    cmpVer,
  };
})();