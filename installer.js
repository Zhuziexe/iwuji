/* =========================================================
   installer.js —— 已安装应用的安装 / 更新 / 卸载 / 列表

   依赖（加载顺序需在这些之后）：
     Store / WujiApps / AppStorage / WujiAppCode / WujiAppLoader

   特性：
     - install：fetch 代码 → 写 IDB（原子覆盖）→ 清 loader 缓存 → 重注册
     - 更新策略：本地 < 市场 → 更新；本地 = 市场 → noop；本地 > 市场 → 不降级
     - uninstall：清 AppStorage + 清 IDB + 清通知 + 移除桌面图标
     - restore：IDB 为真相源，Store 作为快速索引
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

  function metaFromRecord(rec) {
    return {
      bundlename:  rec.bundle,
      name:        rec.name,
      icon:        rec.icon,
      version:     rec.version,
      author:      rec.author,
      description: rec.description,
      src:         rec.src,
    };
  }

  function recordFromMeta(meta) {
    const bundle = meta.bundle || meta.bundlename;
    return {
      bundle,
      name:        meta.name        || bundle,
      icon:        meta.icon        || '',
      version:     meta.version     || '1.0.0',
      author:      meta.author      || '',
      description: meta.description || '',
      src:         meta.src         || meta._src || '',
      installedAt: Date.now(),
    };
  }

  /* ---------- 对外 API ---------- */
  return {
    /* ---------- 查询 ---------- */
    list() { return readAll().slice(); },

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

    /**
     * 安装或更新。
     *   - 未安装            → 安装
     *   - 已安装，版本相同   → noop
     *   - 已安装，本地更新   → noop（newer-local）
     *   - 已安装，市场更新   → 覆盖更新
     *
     * @returns {Promise<{
     *   ok: boolean,
     *   action: 'installed' | 'updated' | 'noop' | 'newer-local'
     *         | 'fetch-failed' | 'idb-failed',
     *   version?: string,
     *   pendingReload?: boolean,
     *   error?: Error,
     * }>}
     */
    async install(meta, { force = false } = {}) {
      if (!meta) throw new Error('installer.install: missing meta');

      const bundle = meta.bundle || meta.bundlename;
      const src    = meta.src || meta._src;
      if (!bundle) throw new Error('installer.install: missing bundle');
      if (!src)    throw new Error('installer.install: missing src');

      const nextVersion = meta.version || '1.0.0';
      const existing    = this.get(bundle);

      /* 版本判断 */
      if (existing && !force) {
        const c = cmpVer(existing.version, nextVersion);
        if (c === 0) return { ok: false, action: 'noop', version: existing.version };
        if (c >  0)  return { ok: false, action: 'newer-local', version: existing.version };
      }

      /* 下载代码（先不动 IDB） */
      let code;
      if (src.startsWith('idb://')) {
        const rec = await WujiAppCode.get(bundle);
        if (!rec) return { ok: false, action: 'idb-failed', error: new Error('IDB 中不存在代码') };
        code = rec.code;
      } else {
        try {
          const r = await fetch(src, { cache: 'no-store' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          code = await r.text();
        } catch (e) {
          return { ok: false, action: 'fetch-failed', error: e };
        }
      }

      /* 原子覆盖 IDB */
      const idbRecord = {
        bundle,
        version: nextVersion,
        code,
        meta: {
          name:        meta.name        || bundle,
          icon:        meta.icon        || '',
          author:      meta.author      || '',
          description: meta.description || '',
        },
        savedAt: Date.now(),
      };
      try { await WujiAppCode.upsert(idbRecord); }
      catch (e) { return { ok: false, action: 'idb-failed', error: e }; }

      /* 写 Store 记录 */
      const record = recordFromMeta({
        ...meta,
        bundle,
        src: `idb://${bundle}`,
        version: nextVersion,
      });
      if (existing) record.installedAt = existing.installedAt || Date.now();

      const list = readAll();
      const idx = list.findIndex(a => a.bundle === bundle);
      if (idx >= 0) list[idx] = record;
      else          list.push(record);
      writeAll(list);

      /* 清 loader 缓存（IDB 记录不删） */
      if (window.WujiAppLoader?.invalidate) {
        try { WujiAppLoader.invalidate(`idb://${bundle}`); } catch { }
      }

      /* 运行时重注册 */
      const wasRunning =
        window.WujiAppLauncher?.getCurrentBundle?.() === bundle;

      if (WujiApps.isInstalled(bundle)) {
        try { WujiApps.shutdownOne(bundle); }
        catch (e) { console.warn('[installer] shutdownOne', bundle, e); }
        WujiApps.unregister(bundle);
      }
      WujiApps.registerMeta(
        { ...metaFromRecord(record), src: `idb://${bundle}` },
        'installed'
      );

      return {
        ok: true,
        action: existing ? 'updated' : 'installed',
        version: nextVersion,
        pendingReload: wasRunning,
      };
    },

    /* ---------- 检查更新 ---------- */
    async checkUpdates() {
      const market = window.WUJI_MARKET_APPS;
      if (!Array.isArray(market)) return [];

      const out = [];
      for (const m of market) {
        const bundle = m.bundle || m.bundlename;
        if (!bundle) continue;
        const local = this.get(bundle);
        if (!local) continue;                          // 未安装不算更新
        if (cmpVer(local.version, m.version) < 0) {
          out.push({
            bundle,
            name:  m.name || bundle,
            from:  local.version,
            to:    m.version,
            meta:  m,
          });
        }
      }
      return out;
    },

    async updateAll() {
      const list = await this.checkUpdates();
      const results = [];
      for (const item of list) {
        try {
          const r = await this.install(item.meta);
          results.push({ bundle: item.bundle, ...r });
        } catch (e) {
          results.push({ bundle: item.bundle, ok: false, action: 'error', error: e });
        }
      }
      return results;
    },

    /* ---------- 卸载 ---------- */

    /**
     * 卸载应用，清空 AppStorage 私有数据 + IDB 代码 + 通知 + 桌面图标。
     */
    async uninstall(bundle) {
      if (!bundle) return false;
      if (!this.has(bundle)) return false;

      const list = readAll();
      const rec  = list.find(a => a.bundle === bundle);
      const src  = rec?.src || '';

      writeAll(list.filter(a => a.bundle !== bundle));

      /* 先让应用清自己的定时器 / window 监听 */
      try { WujiApps.shutdownOne(bundle); }
      catch (e) { console.warn('[installer] shutdownOne', bundle, e); }

      try { await AppStorage.uninstall(bundle); }
      catch (e) { console.warn('[installer] AppStorage.uninstall failed', bundle, e); }

      /* 清 IDB 代码 */
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

      /* 清脚本缓存 */
      if (window.WujiAppLoader?.invalidate) {
        const target = src || `idb://${bundle}`;
        try { WujiAppLoader.invalidate(target); } catch { }
      }

      WujiApps.unregister(bundle);
      return true;
    },

    /* ---------- 启动恢复 ---------- */

    /**
     * IDB 为真相源，Store 作快速索引：
     *   - Store 有 + IDB 有 → 用 IDB 的版本号
     *   - Store 有 + IDB 无 → 兼容旧记录（远程 src）
     *   - Store 无 + IDB 有 → 从 IDB 补回 Store
     */
        /* ---------- 启动恢复 ---------- */

    /**
     * IDB 为真相源，Store 作为快速索引。
     * 返回 { newRecords, legacyRecords }：
     *   newRecords    —— IDB 有、Store 无，已补回 Store
     *   legacyRecords —— Store 有 URL src、IDB 无，待后台迁移
     */
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
      const legacyRecords = [];   // ★ 待迁移：src 是 URL，IDB 里没有

      /* 处理 Store 里已有的 */
      for (const rec of storeList) {
        if (!rec?.bundle) continue;
        seen.add(rec.bundle);

        const idbRec = idbMap.get(rec.bundle);
        if (idbRec) {
          /* IDB 中有代码 → 用 idb:// 注册 */
          const src = (rec.src && rec.src.startsWith('idb://'))
            ? rec.src
            : `idb://${rec.bundle}`;
          WujiApps.registerMeta({
            bundlename:  rec.bundle,
            name:        rec.name        || idbRec.meta?.name        || rec.bundle,
            icon:        rec.icon        || idbRec.meta?.icon        || '',
            version:     idbRec.version,
            author:      rec.author      || idbRec.meta?.author      || '',
            description: rec.description || idbRec.meta?.description || '',
            src,
          }, 'installed');
        } else if (rec.src) {
          /* IDB 中没有 → 先用 URL 跑，收集起来后台迁移 */
          WujiApps.registerMeta(metaFromRecord(rec), 'installed');
          if (!rec.src.startsWith('idb://')) {
            legacyRecords.push(rec);
          }
        }
      }

      /* IDB 里有、Store 里没有的（比如从备份恢复） */
      for (const rec of idbRecords) {
        if (seen.has(rec.bundle)) continue;
        const meta = {
          bundlename:  rec.bundle,
          name:        rec.meta?.name        || rec.bundle,
          icon:        rec.meta?.icon        || '',
          version:     rec.version,
          author:      rec.meta?.author      || '',
          description: rec.meta?.description || '',
          src:         `idb://${rec.bundle}`,
        };
        WujiApps.registerMeta(meta, 'installed');
        newRecords.push({
          ...recordFromMeta(meta),
          installedAt: rec.savedAt || Date.now(),
        });
      }

      if (newRecords.length) {
        writeAll([...readAll(), ...newRecords]);
      }

      return { newRecords, legacyRecords };
    },

    /**
     * 后台静默迁移：把 Store 里还是 URL src 的应用拉到 IDB。
     *   - 逐条 fetch → 写 IDB → 更新 Store src
     *   - 失败静默跳过，下次启动再试
     *   - 不重新注册（避免桌面闪动），下次刷新页面自然生效
     *
     * @param {Array} records  restore() 返回的 legacyRecords
     * @returns {Promise<number>} 成功迁移的数量
     */
    async migrateLegacyToIdb(records) {
      if (!Array.isArray(records) || !records.length) return 0;

      let migrated = 0;
      for (const rec of records) {
        if (!rec?.bundle || !rec.src) continue;
        if (rec.src.startsWith('idb://')) continue;

        /* 再确认一次 IDB 里确实没有（防止并发场景重复写） */
        try {
          const existing = await WujiAppCode.get(rec.bundle);
          if (existing) {
            /* IDB 已有，只更新 Store 里的 src */
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

        /* fetch 代码 */
        let code;
        try {
          const r = await fetch(rec.src, { cache: 'no-store' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          code = await r.text();
        } catch (e) {
          console.warn('[installer] 迁移 fetch 失败，跳过', rec.bundle, e.message);
          continue;   // 下次启动再试
        }

        /* 写 IDB */
        try {
          await WujiAppCode.upsert({
            bundle:  rec.bundle,
            version: rec.version || '1.0.0',
            code,
            meta: {
              name:        rec.name        || rec.bundle,
              icon:        rec.icon        || '',
              author:      rec.author      || '',
              description: rec.description || '',
            },
          });
        } catch (e) {
          console.warn('[installer] 迁移写 IDB 失败，跳过', rec.bundle, e.message);
          continue;
        }

        /* 更新 Store 的 src */
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

    /**
     * 旧的 pruneMissing 保留为 no-op。
     * 理由：IDB 里有代码就能跑，不再自动清理"市场上没有"的应用。
     */
    async pruneMissing() {
      return 0;
    },

    cmpVer,
  };
})();