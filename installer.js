/* =========================================================
   installer.js —— 已安装应用的安装 / 更新 / 卸载 / 列表

   目标设备字段（原名 platforms）：
     - 统一使用 devices: ['iwuji','pc']（wujios→iwuji，zhuzios→pc）
     - 写入侧只写 devices
     - 读取侧通过 WujiDevices.normalizeDevices 兼容旧 platforms
     - 无 devices / 空数组 → 视为全设备
     - 启动时 restore() 会自动把持久化数据（Store + IDB）
       里的 platforms 迁移为 devices 并回写（见 device-compat.js）
   ========================================================= */
window.WujiAppInstaller = (() => {
  const KEY = 'installedApps';
  let migrationDone = false;

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

  /** 取规范 devices 数组（兼容旧 platforms），缺失/空 → null */
  function pickDevices(obj) {
    const D = window.WujiDevices;
    if (D?.normalizeDevices) {
      return D.normalizeDevices(obj);
    }
    const p = Array.isArray(obj?.devices) && obj.devices.length
      ? obj.devices
      : (Array.isArray(obj?.platforms) && obj.platforms.length ? obj.platforms : null);
    if (!p) return null;
    return p.map(v => v === 'wujios' ? 'iwuji' : v === 'zhuzios' ? 'pc' : v);
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
    const d = pickDevices(rec);
    if (d) meta.devices = d;
    if (Array.isArray(rec.fileTypes) && rec.fileTypes.length) {
      meta.fileTypes = rec.fileTypes.slice();
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
    const d = pickDevices(meta);
    if (d) rec.devices = d;
    if (Array.isArray(meta.fileTypes) && meta.fileTypes.length) {
      rec.fileTypes = meta.fileTypes.slice();
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
    const d = pickDevices(meta);
    if (d) m.devices = d;
    if (Array.isArray(meta.fileTypes) && meta.fileTypes.length) {
      m.fileTypes = meta.fileTypes.slice();
    }
    return m;
  }

  /* ---------- 对外 API ---------- */
  return {
    list() { return readAll().slice(); },

    /** 当前设备可见的已安装记录（供 PC 的"已安装管理"用） */
    listForCurrentDevice() {
      const api = window.WujiDevices;
      const cur = api?.currentDevice?.() || 'iwuji';
      return readAll().filter(a => {
        if (api?.deviceAllowed) return api.deviceAllowed(a, cur);
        const d = pickDevices(a);
        return !d || d.includes(cur);
      });
    },
    /* 历史别名，保留避免外部调用失效 */
    listForCurrentPlatform() { return this.listForCurrentDevice(); },

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

      const nextDevices = pickDevices(meta) || pickDevices(existing) || null;
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
              devices: nextDevices || undefined,
              platforms: undefined,       /* 屏蔽调用方残留的旧字段，避免回退读取 */
              fileTypes: nextFileTypes || undefined,
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
        devices: nextDevices || undefined,
        platforms: undefined,       /* 屏蔽调用方残留的旧字段，避免回退读取 */
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

      /* ★ 用最终 devices 决定是否要注册（别的设备的应用只写数据、不注册） */
      const finalMeta = { ...metaFromRecord(record), src: `idb://${bundle}` };
      if (WujiApps.deviceAllowed(finalMeta)) {
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
      /* ★ 自动迁移：把持久化数据里的 platforms 改成 devices（幂等） */
      if (!migrationDone && window.WujiDevices?.migrateAll) {
        migrationDone = true;
        try { await WujiDevices.migrateAll(); }
        catch (e) { console.warn('[installer] devices 迁移失败', e); }
      }

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
          const devices = pickDevices(rec) || pickDevices(idbRec.meta) || null;

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
          if (devices) meta.devices = devices;
          if (fileTypes) meta.fileTypes = fileTypes;

          WujiApps.registerMeta(meta, 'installed');

          if (!rec.devices && devices) {
            rec.devices = devices;
          }
          if (!rec.fileTypes && fileTypes) {
            rec.fileTypes = fileTypes.slice();
          }
          /* 顺手清掉本记录里可能残留的旧字段 */
          if (Object.prototype.hasOwnProperty.call(rec, 'platforms')) {
            delete rec.platforms;
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

        const devices = pickDevices(rec.meta) || null;
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
        if (devices) meta.devices = devices;
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

      /* ★ 若本次给 Store 里的记录补了 devices，写回 */
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
          const d = pickDevices(rec);
          if (d) idbMeta.devices = d;

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
