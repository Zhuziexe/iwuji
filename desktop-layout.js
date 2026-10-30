/* =========================================================
   desktop-layout.js —— 桌面布局（固定 4×4 槽位）
   ========================================================= */
window.DesktopLayout = (() => {
  const KEY = 'desktopLayout';
  const COLS = 4;
  const ROWS = 4;
  const PER_PAGE = COLS * ROWS;
  const VERSION = 2;

  let data = null;
  let lastRemoved = null

  function newPageId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  function emptyPage() {
    return { id: newPageId(), slots: new Array(PER_PAGE).fill('') };
  }

  function migrate(old) {
    if (!old || !Array.isArray(old.pages)) return null;
    return {
      version: VERSION,
      pages: old.pages.map(p => {
        const slots = new Array(PER_PAGE).fill('');
        if (Array.isArray(p.slots)) {
          for (let i = 0; i < PER_PAGE; i++) slots[i] = p.slots[i] || '';
        } else if (Array.isArray(p.apps)) {
          for (let i = 0; i < Math.min(p.apps.length, PER_PAGE); i++) {
            slots[i] = p.apps[i];
          }
        }
        return { id: p.id || newPageId(), slots };
      }),
    };
  }

  function ensureData() {
    if (data) return data;
    const raw = Store.get(KEY, null);

    if (raw && raw.version === VERSION && Array.isArray(raw.pages) && raw.pages.length) {
      raw.pages.forEach(p => {
        if (!Array.isArray(p.slots) || p.slots.length !== PER_PAGE) {
          const s = new Array(PER_PAGE).fill('');
          if (Array.isArray(p.slots)) {
            for (let i = 0; i < PER_PAGE; i++) s[i] = p.slots[i] || '';
          }
          p.slots = s;
        }
        if (!p.id) p.id = newPageId();
      });
      data = raw;
    } else if (raw) {
      data = migrate(raw) || { version: VERSION, pages: [emptyPage()] };
    } else {
      data = { version: VERSION, pages: [emptyPage()] };
    }
    return data;
  }

  function persist() { Store.set(KEY, ensureData()); }

  function isEmptyPage(p) {
    if (!p || !Array.isArray(p.slots)) return true;
    return p.slots.every(s => !s);
  }

  function cleanupEmptyPages() {
    const d = ensureData();

    /* 全部删空 → 留一页 */
    if (d.pages.length === 0) {
      d.pages.push(emptyPage());
      return;
    }

    /* 删掉所有空页 */
    const nonEmpty = d.pages.filter(p => !isEmptyPage(p));

    /* 全空 → 保留一页空页（用户可能把所有应用都删了） */
    if (nonEmpty.length === 0) {
      d.pages = [emptyPage()];
    } else {
      d.pages = nonEmpty;
    }
  }

  function findEmptySlot() {
    const d = ensureData();
    for (let pi = 0; pi < d.pages.length; pi++) {
      const s = d.pages[pi].slots;
      const i = s.indexOf('');
      if (i >= 0) return { pageIndex: pi, slotIndex: i };
    }
    return null;
  }

  return {
    COLS, ROWS, PER_PAGE,

    seedFromRegistry() {
      const d = ensureData();
      let dirty = false;

      const onDesktop = new Set();
      d.pages.forEach(p => p.slots.forEach(s => { if (s) onDesktop.add(s); }));

      const missing = WujiApps.all()
        .map(a => a.bundlename)
        .filter(b => !onDesktop.has(b));

      for (const b of missing) {
        let pos = null;

        // ★ 刚被 removeApp 清掉的，回原位
        if (lastRemoved && lastRemoved.bundle === b) {
          const pi = d.pages.findIndex(p => p.id === lastRemoved.pageId);
          if (pi >= 0 && !d.pages[pi].slots[lastRemoved.slotIndex]) {
            pos = { pageIndex: pi, slotIndex: lastRemoved.slotIndex };
          }
          lastRemoved = null;
        }

        if (!pos) pos = findEmptySlot();
        if (!pos) {
          d.pages.push(emptyPage());
          pos = { pageIndex: d.pages.length - 1, slotIndex: 0 };
        }

        d.pages[pos.pageIndex].slots[pos.slotIndex] = b;
        dirty = true;
      }

      if (dirty) persist();
    },

    snapshot() {
      const d = ensureData();
      return d.pages.map(p => {
        let slots = p.slots;
        if (!Array.isArray(slots) || slots.length !== PER_PAGE) {
          const s = new Array(PER_PAGE).fill('');
          if (Array.isArray(slots)) {
            for (let i = 0; i < Math.min(slots.length, PER_PAGE); i++) {
              s[i] = slots[i] || '';
            }
          }
          slots = s;
          p.slots = s;
        }
        return {
          pageId: p.id,
          slots: slots.map(b => {
            if (!b) return null;
            const meta = WujiApps.get(b);
            if (!meta) return null;
            return { bundle: b, meta };
          }),
        };
      });
    },

    pageCount() { return ensureData().pages.length; },

    isPageEmpty(index) {
      const d = ensureData();
      const p = d.pages[index];
      if (!p) return true;
      return p.slots.every(s => !s);
    },

    findBundle(bundle) {
      const d = ensureData();
      for (let pi = 0; pi < d.pages.length; pi++) {
        const si = d.pages[pi].slots.indexOf(bundle);
        if (si >= 0) return { pageIndex: pi, slotIndex: si };
      }
      return null;
    },

    swap(from, to) {
      const d = ensureData();
      const fp = d.pages[from.pageIndex];
      const tp = d.pages[to.pageIndex];
      if (!fp || !tp) return;
      const tmp = fp.slots[from.slotIndex] || '';
      fp.slots[from.slotIndex] = tp.slots[to.slotIndex] || '';
      tp.slots[to.slotIndex] = tmp;
      cleanupEmptyPages();
      persist();
    },

    move(bundle, toPageIndex, toSlotIndex) {
      const from = this.findBundle(bundle);
      if (!from) return;
      const d = ensureData();
      while (d.pages.length <= toPageIndex) d.pages.push(emptyPage());
      toSlotIndex = Math.max(0, Math.min(PER_PAGE - 1, toSlotIndex));
      this.swap(from, { pageIndex: toPageIndex, slotIndex: toSlotIndex });
    },

    addPage() {
      const d = ensureData();
      d.pages.push(emptyPage());
      persist();
      return d.pages.length - 1;
    },

    addPageAt(index) {
      const d = ensureData();
      index = Math.max(0, Math.min(index, d.pages.length));
      d.pages.splice(index, 0, emptyPage());
      persist();
      return index;
    },

    removeApp(bundle) {
      const d = ensureData();
      for (const p of d.pages) {
        const i = p.slots.indexOf(bundle);
        if (i >= 0) {
          lastRemoved = { bundle, pageId: p.id, slotIndex: i };
          p.slots[i] = '';
          persist();
          return;
        }
      }
    },

    cleanupEmptyPages() {
      cleanupEmptyPages();
      persist();
    },

    reset() {
      data = { version: VERSION, pages: [emptyPage()] };
      persist();
    },
  };
})();