/* =========================================================
   device-compat.js —— 应用「目标设备」字段兼容层

   字段更名：platforms → devices
     - 旧值（OS 标识）  wujios → iwuji，zhuzios → pc
     - 新值（设备标识）  iwuji / pc

   设计要点（务必保持向后兼容）：
     1. 写入侧统一只写 devices；
     2. 读取侧同时兼容 devices 与旧 platforms（未迁移的旧数据/旧代码）；
     3. 启动时把持久化数据（localStorage 的 installedApps 与
        IndexedDB「wujios-appcode」里的 meta）里的 platforms 自动
        迁移为 devices，并回写；迁移幂等，可反复执行。
     4. 运行时平台 window.__OPENWUJI_PLATFORM 仍沿用 wujios / zhuzios
        （系统里大量无关逻辑依赖它），这里只在判断设备时做一次映射，
        同时也接受直接设置成 iwuji / pc 的新写法。

   依赖：无（尽早加载，先于 core.js）
   ========================================================= */
window.WujiDevices = (() => {
  const DB_NAME = 'wujios-appcode';
  const STORE = 'apps';

  /* 单个值 → 规范设备标识。未知值原样保留，避免误伤自定义设备。 */
  function toDeviceId(v) {
    const s = String(v == null ? '' : v).trim();
    if (s === 'wujios') return 'iwuji';
    if (s === 'zhuzios') return 'pc';
    return s;
  }

  /* 当前运行设备（iwuji / pc） */
  function currentDevice() {
    return toDeviceId(window.__OPENWUJI_PLATFORM || 'wujios');
  }

  /**
   * 从任意 meta / record 取出规范 devices 数组。
   * 优先 devices，其次旧的 platforms；缺失/空/非数组 → null（视为全设备）。
   * 返回的数组已做值映射、去重、去空。
   */
  function normalizeDevices(obj) {
    if (!obj) return null;
    let raw = null;
    if (Array.isArray(obj.devices) && obj.devices.length) raw = obj.devices;
    else if (Array.isArray(obj.platforms) && obj.platforms.length) raw = obj.platforms;
    if (!raw) return null;

    const out = [];
    for (const p of raw) {
      const d = toDeviceId(p);
      if (d && !out.includes(d)) out.push(d);
    }
    return out.length ? out : null;
  }

  /** 判断 meta / record 是否适用于当前设备（缺失 devices → 全设备放行） */
  function deviceAllowed(obj, cur) {
    const list = normalizeDevices(obj);
    if (!list) return true;
    return list.includes(cur || currentDevice());
  }

  /** 设备标识 → 展示名 */
  function label(d) {
    const id = toDeviceId(d);
    if (id === 'iwuji') return 'iWuji';
    if (id === 'pc') return '电脑';
    return String(d);
  }

  /**
   * 就地迁移一个对象：platforms → devices（并把 devices 里的旧值规范化）。
   * 无论是否发生变化，只要存在 platforms 字段都会删除它。
   * 返回是否发生了修改。
   */
  function migrateObject(obj) {
    if (!obj || typeof obj !== 'object') return false;
    let changed = false;

    const hasLegacy = Object.prototype.hasOwnProperty.call(obj, 'platforms');
    const devices = normalizeDevices(obj);

    /* 规范 devices 字段（含把 ['wujios'] 之类旧值改成 ['iwuji']） */
    if (devices) {
      const same = Array.isArray(obj.devices)
        && obj.devices.length === devices.length
        && obj.devices.every((d, i) => d === devices[i]);
      if (!same) {
        obj.devices = devices.slice();
        changed = true;
      }
    } else if (Object.prototype.hasOwnProperty.call(obj, 'devices')) {
      /* 显式存在但为空/非法 → 删掉，等价于「全设备」 */
      if (Array.isArray(obj.devices) && obj.devices.length === 0) {
        delete obj.devices;
        changed = true;
      }
    }

    if (hasLegacy) {
      delete obj.platforms;
      changed = true;
    }
    return changed;
  }

  /** 迁移一条 IDB 记录（meta 为主，顶层 platforms 兜底） */
  function migrateIdbRecord(rec) {
    if (!rec || typeof rec !== 'object') return false;
    let changed = false;
    if (rec.meta && typeof rec.meta === 'object') {
      changed = migrateObject(rec.meta) || changed;
    }
    /* 极少数历史数据可能把 platforms 直接放在顶层 */
    if (Object.prototype.hasOwnProperty.call(rec, 'platforms')) {
      if (!rec.devices) {
        const d = normalizeDevices(rec);
        if (d) rec.devices = d;
      }
      delete rec.platforms;
      changed = true;
    }
    return changed;
  }

  /**
   * 迁移 localStorage 里的 installedApps 列表并回写。
   * 幂等。返回被修改的记录数。
   */
  function migrateStoreList() {
    let list;
    try { list = window.Store?.get?.('installedApps', []); } catch { return 0; }
    if (!Array.isArray(list) || !list.length) return 0;

    let changed = 0;
    for (const rec of list) {
      if (migrateObject(rec)) changed++;
    }
    if (changed) {
      try { window.Store.set('installedApps', list); } catch { }
    }
    return changed;
  }

  /**
   * 迁移 IndexedDB「wujios-appcode」里所有记录的 platforms → devices 并回写。
   * 依赖 window.WujiAppCode（保证 apps 表已正确建好），缺失时静默跳过。
   * 幂等。返回被修改的记录数。
   */
  async function migrateIdb() {
    const api = window.WujiAppCode;
    if (!api || typeof api.list !== 'function' || typeof api.upsert !== 'function') {
      return 0;
    }
    let rows;
    try { rows = await api.list(); } catch (e) {
      console.warn('[devices] IDB 读取失败，跳过迁移', e);
      return 0;
    }
    if (!Array.isArray(rows) || !rows.length) return 0;

    let changed = 0;
    for (const rec of rows) {
      if (!migrateIdbRecord(rec)) continue;
      try {
        await api.upsert(rec);
        changed++;
      } catch (e) {
        console.warn('[devices] IDB 回写失败', rec.bundle, e);
      }
    }
    return changed;
  }

  /** 启动时一次性迁移（Store + IDB），返回统计 */
  async function migrateAll() {
    const storeChanged = migrateStoreList();
    let idbChanged = 0;
    try { idbChanged = await migrateIdb(); } catch (e) {
      console.warn('[devices] IDB 迁移异常', e);
    }
    if (storeChanged || idbChanged) {
      console.log(`[devices] 已迁移 ${storeChanged} 条安装记录 / ${idbChanged} 条 IDB 记录：platforms → devices`);
    }
    return { storeChanged, idbChanged };
  }

  return {
    toDeviceId,
    currentDevice,
    normalizeDevices,
    deviceAllowed,
    label,
    migrateObject,
    migrateIdbRecord,
    migrateStoreList,
    migrateIdb,
    migrateAll,
    DB_NAME,
    STORE,
  };
})();
