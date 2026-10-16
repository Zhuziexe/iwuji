/* =========================================================
   installer.js —— 已安装应用的安装 / 覆盖 / 卸载 / 列表
   =========================================================
   依赖（加载顺序需在这些之后）：
     Store / WujiApps / AppStorage

   桌面重绘通过 WujiApps 的 'registered' / 'unregistered'
   事件驱动（见 index.html 里的 WujiApps.on 监听器）。
   ========================================================= */
window.WujiAppInstaller = (() => {
  const KEY = 'installedApps';

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

    /** 所有已安装记录（副本） */
    list() { return readAll().slice(); },

    /** 按 bundle 取一条记录 */
    get(bundle) {
      return readAll().find(a => a.bundle === bundle) || null;
    },

    /** 是否已安装 */
    has(bundle) {
      return readAll().some(a => a.bundle === bundle);
    },

    /** 取已安装版本，未安装返回 null */
    getVersion(bundle) {
      const rec = this.get(bundle);
      return rec ? rec.version : null;
    },

    /* ---------- 安装 / 覆盖 ---------- */

    /**
     * 安装或覆盖安装。
     *   - 未安装          → 安装
     *   - 已安装，版本相同 → noop
     *   - 已安装，版本不同 → 覆盖（不论新旧）
     *
     * @returns {Promise<{
     *   ok: boolean,
     *   action: 'installed' | 'replaced' | 'noop',
     *   version?: string,
     * }>}
     */
    async install(meta) {
      if (!meta) throw new Error('installer.install: missing meta');

      const bundle = meta.bundle || meta.bundlename;
      const src    = meta.src || meta._src;
      if (!bundle) throw new Error('installer.install: missing bundle');
      if (!src)    throw new Error('installer.install: missing src');

      const nextVersion = meta.version || '1.0.0';
      const existing    = this.get(bundle);

      /* 版本相同 → 什么也不做 */
      if (existing && existing.version === nextVersion) {
        return { ok: false, action: 'noop', version: existing.version };
      }

      const record = recordFromMeta({ ...meta, bundle, src });
      if (existing) record.installedAt = existing.installedAt || Date.now();

      /* 写 Store：已存在则替换，否则追加 */
      const list = readAll();
      const idx = list.findIndex(a => a.bundle === bundle);
      if (idx >= 0) list[idx] = record;
      else          list.push(record);
      writeAll(list);

      /* 版本变了 → 清脚本内存缓存，下次打开时重新下载 */
      if (window.WujiAppLoader?.invalidate) {
        WujiAppLoader.invalidate(src);
      }

      /* 已安装 → 先注销旧 meta，再注册新 meta（emit 顺序干净） */
      if (WujiApps.isInstalled(bundle)) {
        WujiApps.unregister(bundle);
      }
      WujiApps.registerMeta(metaFromRecord(record), 'installed');

      if (window.WujiAppLoader?.load) {
        WujiAppLoader.load(src, record.version).catch(err => {
          console.warn('[installer] 预加载失败', bundle, err);
        });
      }

      return {
        ok: true,
        action: existing ? 'replaced' : 'installed',
        version: record.version,
      };
    },

    /* ---------- 卸载 ---------- */

    /**
     * 卸载应用，同时清空其 AppStorage 私有数据。
     */
    async uninstall(bundle) {
      if (!bundle) return false;
      if (!this.has(bundle)) return false;

      const list = readAll().filter(a => a.bundle !== bundle);
      writeAll(list);

      try { await AppStorage.uninstall(bundle); }
      catch (e) { console.warn('[installer] AppStorage.uninstall failed', bundle, e); }

      try {
        if (window.WujiNotification?.clearByBundle) {
          WujiNotification.clearByBundle(bundle);
        }
      } catch (e) {
        console.warn('[installer] 清理通知失败', bundle, e);
      }

      /* 主动清桌面，不依赖监听器 */
      if (window.DesktopLayout?.removeApp) {
        DesktopLayout.removeApp(bundle);
      }

      WujiApps.unregister(bundle);
      return true;
    },

    /* ---------- 启动恢复 ---------- */

    /**
     * 由 index.html 在启动时调用一次：
     * 把 Store 里记录的已安装应用注册成内存 meta 占位。
     */
    restore() {
      const list = readAll();
      list.forEach(rec => {
        if (!rec?.bundle || !rec?.src) return;
        WujiApps.registerMeta(metaFromRecord(rec), 'installed');
      });
    },

        /* ---------- ★ 清理：store/apps.js 里已经没有的已安装应用 ---------- */
    async pruneMissing() {
      const market = window.WUJI_MARKET_APPS;
      if (!Array.isArray(market)) return 0;

      const valid = new Set(
        market.map(m => m.bundle || m.bundlename).filter(Boolean)
      );
      if (!valid.size) return 0;

      const list = readAll();
      const stale = list.filter(rec => rec?.bundle && !valid.has(rec.bundle));

      if (!stale.length) return 0;

      console.warn('[installer] 清理已下架应用:',
        stale.map(a => a.bundle));

      for (const rec of stale) {
        try {
          await this.uninstall(rec.bundle);
        } catch (e) {
          console.warn('[installer] prune 卸载失败', rec.bundle, e);
        }
      }
      return stale.length;
    },
  };
})();