/* =========================================================
   apps/photos.js —— 图库（虚拟列表 + 选择模式 + 批量删除）
   ========================================================= */
(() => {
  const BUNDLE = 'com.wujios.photos';

  const COLS = 3;
  const GAP = 4;
  const OVERSCAN = 2;

  const IMG_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

  /* 当前挂载页面的刷新回调（foreground 钩子调用） */
  let foregroundRefresh = null;

  function hasImgExt(name) {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return false;
    return IMG_EXT.has(name.slice(dot + 1).toLowerCase());
  }

  const SVG_CHECK = `<svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4,12 10,18 20,6"/></svg>`;

  WujiApps.register({
    bundlename: BUNDLE,
    name: '图库',
    icon: './assets/photos.svg',
    initialRoute: 'home',
    version: '1.1.7',

    /* ★ 回到前台时重新加载列表（拍照/删除后切回即最新）。
       用函数钩子，不再依赖事件广播。 */
    foreground() {
      try { foregroundRefresh?.(); } catch (e) { console.error('[photos foreground]', e); }
    },

    styles: `
      .ph-page {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: var(--wj-bg);
        overflow: hidden;
        padding-top: var(--statusbar-h, 0px);
      }

      .ph-header {
        flex: 0 0 auto;
        display: flex; align-items: center; gap: 8px;
        padding: 12px 16px 8px;
      }
      .ph-header .wj-title { margin: 0; }
      .ph-count {
        flex: 1 1 auto;
        font-size: var(--wj-fs-sm);
        color: var(--wj-text-dim);
      }
      .ph-select-btn {
        flex: 0 0 auto;
        height: 48px; padding: 0 20px;
        border: 0;
        border-radius: 999px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit; font-size: var(--wj-fs-sm);
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: opacity .12s, transform .1s, background .12s;
      }
      .ph-select-btn:active { transform: scale(.96); opacity: .85; }
      .ph-select-btn.is-active {
        background: var(--wj-text-muted, #5b6478);
        color: #fff;
      }

      .ph-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        position: relative;
      }
      .ph-spacer {
        position: relative;
        width: 100%;
        min-height: 1px;
      }

      .ph-cell {
        position: absolute;
        overflow: hidden;
        border-radius: 4px;
        background: #eef1f6;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .ph-cell:active { filter: brightness(.82); }
      .ph-cell.is-selected::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 3px solid var(--wj-primary, #3a6ff0);
        border-radius: 4px;
        box-sizing: border-box;
        pointer-events: none;
      }
      .ph-cell__img {
        width: 100%; height: 100%;
        object-fit: cover;
        display: block;
        pointer-events: none;
        -webkit-user-drag: none;
        user-select: none;
      }

      .ph-cell__check {
        position: absolute;
        bottom: 6px; right: 6px;
        width: 28px; height: 28px;
        border-radius: 50%;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        box-shadow: 0 2px 6px rgba(0,0,0,.35);
        border: 2px solid #fff;
      }
      .ph-cell__check svg { width: 16px; height: 16px; }
      .ph-cell.is-selected .ph-cell__check {
        display: inline-flex;
      }

      .ph-empty {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 12px;
        padding: 40px 32px;
        text-align: center;
        color: var(--wj-text-dim);
        font-size: var(--wj-fs-md);
        line-height: 1.7;
        pointer-events: none;
      }
      .ph-empty[hidden] { display: none; }

      .ph-bar {
        flex: 0 0 auto;
        display: flex; align-items: center; gap: 10px;
        padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid var(--wj-border, #e6e9ef);
        background: #fff;
      }
      .ph-bar[hidden] { display: none; }
      .ph-bar__count {
        flex: 1 1 auto;
        font-size: var(--wj-fs-md);
        color: var(--wj-text, #101828);
        font-weight: 500;
      }
      .ph-bar__btn {
        flex: 0 0 auto;
        height: 48px; padding: 0 24px;
        border: 0;
        border-radius: 999px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit; font-size: var(--wj-fs-md);
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: opacity .12s, transform .1s, background .12s;
      }
      .ph-bar__btn:active:not(:disabled) { transform: scale(.96); opacity: .85; }
      .ph-bar__btn:disabled { opacity: .4; cursor: not-allowed; }
      .ph-bar__btn--danger {
        background: var(--wj-danger, #e5484d);
        color: #fff;
      }

      .ph-detail {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: #fff;
        color: #18191c;
        padding-top: var(--statusbar-h, 0px);   /* 让开状态栏（系统默认黑字渐变正常显示） */
      }
      .ph-detail__stage {
        flex: 1 1 auto;
        min-height: 0;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        /* 图片用 contain 缩放，这里再兜一层裁剪，防止亚像素溢出到操作栏 */
        contain: paint;
      }
      .ph-detail__img {
        /* 只用 max-* 约束，不再强制 100%/100%：避免 img 撑出 stage 产生 1px 溢出行 */
        max-width: 100%; max-height: 100%;
        object-fit: contain;
        display: block;
        pointer-events: none;
      }
      .ph-detail__bar {
        flex: 0 0 auto;
        align-self: center;
        display: flex; align-items: center; justify-content: space-around;
        gap: 4px;
        height: 60px;
        width: 240px;                  /* 4:1 比例，宽度更窄、居中 */
        max-width: calc(100% - 32px);
        margin: 18px 0 calc(14px + env(safe-area-inset-bottom, 0px)); /* 与图片拉开距离 */
        padding: 0 6px;
        border-radius: 14px;           /* 圆角再小一点 */
        background: #fff;
        box-shadow: none;
        border: 1px solid rgba(0,0,0,.12);   /* 不要阴影，只用边框 */
      }
      .ph-detail__btn {
        width: 50px; height: 50px;      /* 图标按钮更占满胶囊 */
        border: 0; border-radius: 12px;
        background: transparent;
        color: #3a3d45;
        display: inline-flex; align-items: center; justify-content: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .12s, opacity .12s;
      }
      .ph-detail__btn:active { background: rgba(0,0,0,.07); }
      .ph-detail__btn:disabled { opacity: .3; cursor: default; }
      .ph-detail__btn--danger { color: #e0356b; }
      .ph-detail__btn--danger:active { background: rgba(224,53,107,.16); }
      .ph-detail__btn svg { width: 28px; height: 28px; display: block; }

      .ph-info {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: #fff; color: #18191c;
        padding-top: var(--statusbar-h, 0px);
      }
      .ph-info__title {
        padding: 10px 20px 14px;
        font-size: var(--wj-fs-2xl); font-weight: 700;
      }
      .ph-info__row {
        display: flex; justify-content: space-between; gap: 16px;
        padding: 14px 20px;
        border-top: 1px solid #eceef2;
        font-size: 20px;
      }
      .ph-info__row span:first-child { color: var(--wj-text-dim); flex: 0 0 auto; }
      .ph-info__row span:last-child { color: #18191c; text-align: right; word-break: break-all; }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="ph-page">
              <div class="ph-header">
                <h2 class="wj-title">照片</h2>
                <span class="ph-count" id="phCount"></span>
                <button class="ph-select-btn" id="phSelectBtn" type="button">选择</button>
              </div>
              <div class="ph-scroll" id="phScroll">
                <div class="ph-spacer" id="phSpacer"></div>
                <div class="ph-empty" id="phEmpty" hidden>
                  还没有照片<br>打开相机拍一张吧
                </div>
              </div>
              <div class="ph-bar" id="phBar" hidden>
                <span class="ph-bar__count" id="phBarCount">已选 0 张</span>
                <button class="ph-bar__btn" id="phSelectAllBtn" type="button">全选</button>
                <button class="ph-bar__btn ph-bar__btn--danger" id="phBulkDeleteBtn" type="button" disabled>删除</button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          if (!window.WujiFileSystem?.supported) {
            root.innerHTML = `<div class="ph-page"><div class="ph-empty">当前浏览器不支持文件系统</div></div>`;
            return;
          }

          const scrollEl = root.querySelector('#phScroll');
          const spacerEl = root.querySelector('#phSpacer');
          const emptyEl = root.querySelector('#phEmpty');
          const countEl = root.querySelector('#phCount');
          const selectBtn = root.querySelector('#phSelectBtn');
          const barEl = root.querySelector('#phBar');
          const barCountEl = root.querySelector('#phBarCount');
          const selectAllBtn = root.querySelector('#phSelectAllBtn');
          const bulkDelBtn = root.querySelector('#phBulkDeleteBtn');

          let files = [];
          const cells = new Map();
          let cellSize = 0;
          let rowHeight = 0;
          let startRow = -1;
          let endRow = -1;
          let disposed = false;
          let rafPending = false;

          let selecting = false;
          const selected = new Set();

          /* ---------- 布局 ---------- */
          function calcLayout() {
            const w = scrollEl.clientWidth;
            if (!w) return;
            cellSize = Math.floor((w - GAP * (COLS - 1)) / COLS);
            rowHeight = cellSize + GAP;
          }
          function totalRows() { return Math.ceil(files.length / COLS); }
          function totalHeight() {
            const rows = totalRows();
            return rows ? rows * rowHeight - GAP : 0;
          }

          /* ---------- 选择状态 UI ---------- */
          function updateSelectionUI() {
            const n = selected.size;
            barCountEl.textContent = `已选 ${n} 张`;
            bulkDelBtn.disabled = n === 0;

            if (selecting) {
              const allSelected = n === files.length && files.length > 0;
              selectAllBtn.textContent = allSelected ? '取消全选' : '全选';
            }
          }

          function syncCellSelection() {
            for (const [name, rec] of cells) {
              rec.el.classList.toggle('is-selected', selected.has(name));
            }
          }

          function enterSelectMode() {
            selecting = true;
            selected.clear();
            selectBtn.textContent = '取消';
            selectBtn.classList.add('is-active');
            barEl.hidden = false;
            syncCellSelection();
            updateSelectionUI();
          }

          function exitSelectMode() {
            selecting = false;
            selected.clear();
            selectBtn.textContent = '选择';
            selectBtn.classList.remove('is-active');
            barEl.hidden = true;
            syncCellSelection();
            updateSelectionUI();
          }

          /* ---------- cell ---------- */
          function createCell(file, idx) {
            const col = idx % COLS;
            const row = Math.floor(idx / COLS);

            const cell = document.createElement('div');
            cell.className = 'ph-cell';
            if (selected.has(file.name)) cell.classList.add('is-selected');
            cell.dataset.idx = idx;
            cell.dataset.name = file.name;
            cell.style.left = (col * (cellSize + GAP)) + 'px';
            cell.style.top = (row * (cellSize + GAP)) + 'px';
            cell.style.width = cellSize + 'px';
            cell.style.height = cellSize + 'px';

            const img = document.createElement('img');
            img.className = 'ph-cell__img';
            img.alt = '';
            img.draggable = false;
            cell.appendChild(img);

            const check = document.createElement('span');
            check.className = 'ph-cell__check';
            check.innerHTML = SVG_CHECK;
            cell.appendChild(check);

            spacerEl.appendChild(cell);

            const record = { el: cell, img, url: null, disposed: false };
            cells.set(file.name, record);

            (async () => {
              try {
                const f = await WujiFileSystem.read(['Pictures', file.name]);
                if (!f || record.disposed) return;
                const url = URL.createObjectURL(f);
                record.url = url;
                record.img.src = url;
              } catch (e) {
                console.warn('[photos] load failed', file.name, e);
              }
            })();

            cell.addEventListener('click', () => {
              /* 选择模式：切换选中 */
              if (selecting) {
                if (selected.has(file.name)) selected.delete(file.name);
                else selected.add(file.name);
                cell.classList.toggle('is-selected', selected.has(file.name));
                updateSelectionUI();
                return;
              }

              /* 普通模式：进大图 */
              const rect = cell.getBoundingClientRect();
              if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
              ctx.push('detail', { name: file.name }, {
                origin: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
              });
            });
          }

          function destroyCell(record) {
            record.disposed = true;
            if (record.url) {
              URL.revokeObjectURL(record.url);
              record.url = null;
            }
            record.el.remove();
          }

          /* ---------- 虚拟窗口 ---------- */
          function renderWindow() {
            if (disposed || !files.length || !rowHeight) {
              startRow = -1;
              endRow = -1;
              return;
            }

            const scrollTop = scrollEl.scrollTop;
            const viewH = scrollEl.clientHeight;
            const rows = totalRows();

            const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
            const last = Math.min(rows - 1, Math.floor((scrollTop + viewH) / rowHeight) + OVERSCAN);

            if (first === startRow && last === endRow) return;
            startRow = first;
            endRow = last;

            const startIdx = first * COLS;
            const endIdx = Math.min(files.length, (last + 1) * COLS);

            for (const [name, rec] of cells) {
              const idx = +rec.el.dataset.idx;
              if (idx < startIdx || idx >= endIdx) {
                destroyCell(rec);
                cells.delete(name);
              }
            }
            for (let i = startIdx; i < endIdx; i++) {
              const f = files[i];
              if (cells.has(f.name)) continue;
              createCell(f, i);
            }
          }

          function scheduleRender() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
              rafPending = false;
              renderWindow();
            });
          }

          /* ---------- 数据 ---------- */
          async function loadFiles() {
            let items = [];
            try {
              items = await WujiFileSystem.list(['Pictures']);
            } catch (e) {
              console.warn('[photos] list failed', e);
            }
            if (disposed) return;

            files = items
              .filter(it => it.kind === 'file' && hasImgExt(it.name))
              .sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

            /* 清理已不存在的选中项 */
            for (const name of [...selected]) {
              if (!files.some(f => f.name === name)) selected.delete(name);
            }
            updateSelectionUI();

            countEl.textContent = files.length ? `共 ${files.length} 张` : '';

            if (!files.length) {
              emptyEl.hidden = false;
              spacerEl.style.height = '0px';
              startRow = -1;
              endRow = -1;
              if (selecting) exitSelectMode();
              return;
            }
            emptyEl.hidden = true;

            calcLayout();
            spacerEl.style.height = totalHeight() + 'px';

            requestAnimationFrame(() => {
              if (disposed) return;
              calcLayout();
              spacerEl.style.height = totalHeight() + 'px';
              startRow = -1;
              endRow = -1;
              renderWindow();
            });
          }

          function reload() {
            for (const rec of cells.values()) destroyCell(rec);
            cells.clear();
            startRow = -1;
            endRow = -1;
            loadFiles();
          }

          /* ---------- 选择按钮 ---------- */
          selectBtn.addEventListener('click', () => {
            if (selecting) exitSelectMode();
            else enterSelectMode();
          });

          /* ---------- 全选 / 取消全选 ---------- */
          selectAllBtn.addEventListener('click', () => {
            if (selected.size === files.length && files.length > 0) {
              selected.clear();
            } else {
              files.forEach(f => selected.add(f.name));
            }
            syncCellSelection();
            updateSelectionUI();
          });

          /* ---------- 批量删除 ---------- */
          bulkDelBtn.addEventListener('click', async () => {
            const n = selected.size;
            if (!n) return;

            let ok = true;
            if (window.WujiDialog?.show) {
              const res = await WujiDialog.show({
                bundlename: BUNDLE,
                title: '删除照片',
                content: `确定删除选中的 ${n} 张照片？删除后无法恢复`,
                buttons: [
                  { value: '取消' },
                  { value: '删除', primary: true, color: 'var(--wj-danger, #e5484d)' },
                ],
              });
              ok = res === '删除';
            } else {
              ok = window.confirm(`确定删除选中的 ${n} 张照片？`);
            }
            if (!ok) return;

            const names = [...selected];
            let fail = 0;
            for (const name of names) {
              try {
                await WujiFileSystem.remove(['Pictures', name]);
              } catch (e) {
                console.warn('[photos] delete failed', name, e);
                fail++;
              }
            }

            if (navigator.vibrate) { try { navigator.vibrate(12); } catch { } }
            if (fail) {
              try { window.WujiToast?.show?.(`${fail} 张删除失败`); } catch { }
            }

            exitSelectMode();
            reload();
          });

          /* ---------- 事件 ---------- */
          scrollEl.addEventListener('scroll', scheduleRender, { passive: true });

          let resizeTimer = null;

          function relayoutExistingCells() {
            if (!cells.size || !cellSize) return;
            for (const [, rec] of cells) {
              const idx = +rec.el.dataset.idx;
              const col = idx % COLS;
              const row = Math.floor(idx / COLS);
              rec.el.style.left = (col * (cellSize + GAP)) + 'px';
              rec.el.style.top = (row * (cellSize + GAP)) + 'px';
              rec.el.style.width = cellSize + 'px';
              rec.el.style.height = cellSize + 'px';
            }
          }

          const ro = new ResizeObserver(() => {
            const w = scrollEl.clientWidth;
            if (!w) return;
            cellSize = Math.floor((w - GAP * (COLS - 1)) / COLS);
            rowHeight = cellSize + GAP;
            spacerEl.style.height = totalHeight() + 'px';
            relayoutExistingCells();

            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
              startRow = -1; endRow = -1;
              renderWindow();
            }, 150);
          });
          ro.observe(scrollEl);

          /* ★ 前台刷新：注册到模块级钩子，由 foreground() 调用。 */
          foregroundRefresh = () => {
            if (disposed) return;
            reload();
          };

          loadFiles();

          return () => {
            disposed = true;
            clearTimeout(resizeTimer);
            ro.disconnect();
            if (foregroundRefresh) foregroundRefresh = null;
            for (const rec of cells.values()) destroyCell(rec);
            cells.clear();
          };
        },
      },

      detail: {
        name: 'detail',
        transition: 'zoom',
        /* 去掉 statusBar 覆盖：让系统默认状态栏（黑字白渐变）在白底上正常显示 */
        render(routeCtx) {
          const name = routeCtx.data?.name || '';
          return `
            <div class="ph-detail">
              <div class="ph-detail__stage" id="phStage">
                <img class="ph-detail__img" id="phImg" alt="">
              </div>
              <div class="ph-detail__bar">
                <button class="ph-detail__btn" id="phPrevBtn" type="button" aria-label="上一张">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
                <button class="ph-detail__btn ph-detail__btn--danger"
                        id="phDeleteBtn" type="button" aria-label="删除">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                  </svg>
                </button>
                <button class="ph-detail__btn" id="phInfoBtn" type="button" aria-label="属性">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 11v5"/><path d="M12 8h.01"/>
                  </svg>
                </button>
                <button class="ph-detail__btn" id="phNextBtn" type="button" aria-label="下一张">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const name = ctx.data?.name || '';
          if (!name) { ctx.pop(); return; }

          const imgEl = root.querySelector('#phImg');
          const stageEl = root.querySelector('#phStage');
          const delBtn = root.querySelector('#phDeleteBtn');
          const prevBtn = root.querySelector('#phPrevBtn');
          const nextBtn = root.querySelector('#phNextBtn');
          const infoBtn = root.querySelector('#phInfoBtn');

          let currentName = name;
          let list = [];                 // 图片文件元数据（按 mtime 降序，与主页一致）
          let url = null;
          let disposed = false;
          let busy = false;

          function idx() { return list.findIndex(f => f.name === currentName); }

          function freeUrl() { if (url) { URL.revokeObjectURL(url); url = null; } }

          async function loadCurrent() {
            imgEl.style.opacity = '0';
            try {
              const f = await WujiFileSystem.read(['Pictures', currentName]);
              if (disposed || !f) return;
              freeUrl();
              url = URL.createObjectURL(f);
              imgEl.src = url;
              imgEl.style.opacity = '1';
            } catch (e) {
              console.warn('[photos] detail load failed', e);
            }
          }

          function syncNav() {
            const i = idx();
            if (prevBtn) prevBtn.disabled = i <= 0;
            if (nextBtn) nextBtn.disabled = i < 0 || i >= list.length - 1;
            if (infoBtn) infoBtn.disabled = i < 0;
          }

          /* 切换图片后同步“返回 zoom”的目标矩形：指向当前图片在主页对应的缩略图，
             否则返回时仍缩放回最初点击的那张，造成目标矩形不对。 */
          function syncZoomOrigin() {
            try {
              const nav = ctx.nav;
              const cur = nav && nav.current;
              if (!cur) return;
              const home = nav.stack.find(it => it && it.route && it.route.name === 'home');
              let cell = null;
              if (home && home.element) {
                const cells = home.element.querySelectorAll('.ph-cell');
                for (let k = 0; k < cells.length; k++) {
                  if (cells[k].dataset.name === currentName) { cell = cells[k]; break; }
                }
              }
              if (!cell) return;
              const r = cell.getBoundingClientRect();
              cur.transitionOrigin = { x: r.left, y: r.top, w: r.width, h: r.height };
            } catch (e) { /* 取不到就沿用原 origin */ }
          }

          async function showAt(i) {
            if (i < 0 || i >= list.length) return;
            currentName = list[i].name;
            if (ctx.data) ctx.data.name = currentName;   // 让属性页/返回拿到当前张
            syncZoomOrigin();
            await loadCurrent();
            syncNav();
          }

          (async () => {
            try {
              const items = await WujiFileSystem.list(['Pictures']);
              list = (Array.isArray(items) ? items : [])
                .filter(it => it.kind === 'file' && hasImgExt(it.name))
                .sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
            } catch (e) { /* 列表失败也不影响单图查看 */ }
            if (disposed) return;
            syncNav();
            await loadCurrent();
          })();

          if (prevBtn) prevBtn.addEventListener('click', e => { e.stopPropagation(); showAt(idx() - 1); });
          if (nextBtn) nextBtn.addEventListener('click', e => { e.stopPropagation(); showAt(idx() + 1); });
          if (infoBtn) infoBtn.addEventListener('click', e => {
            e.stopPropagation();
            const f = list[idx()];
            ctx.push('info', { name: currentName, file: f || null }, { transition: 'slide' });
          });

          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (busy) return;
            busy = true;

            let ok = true;
            if (window.WujiDialog?.show) {
              const res = await WujiDialog.show({
                bundlename: BUNDLE,
                title: '删除照片',
                content: '删除后无法恢复',
                buttons: [
                  { value: '取消' },
                  { value: '删除', primary: true, color: 'var(--wj-danger, #e5484d)' },
                ],
              });
              ok = res === '删除';
            } else {
              ok = window.confirm('删除这张照片？');
            }

            if (!ok) { busy = false; return; }

            try {
              await WujiFileSystem.remove(['Pictures', currentName]);
              window.dispatchEvent(new CustomEvent('wuji:photos-changed'));
              if (navigator.vibrate) { try { navigator.vibrate(12); } catch { } }
              const i = idx();
              list.splice(i, 1);
              busy = false;
              if (list.length) await showAt(Math.min(i, list.length - 1));  // 删后显示相邻一张
              else ctx.pop();                                              // 删光则退出
            } catch (err) {
              console.error('[photos] delete failed', err);
              busy = false;
            }
          });

          return () => {
            disposed = true;
            freeUrl();
          };
        },
      },

      info: {
        name: 'info',
        transition: 'slide-up',
        render(routeCtx) {
          const f = routeCtx.data?.file || {};
          const name = routeCtx.data?.name || f.name || '';
          let size = '—';
          if (typeof f.size === 'number') {
            size = f.size < 1024 ? f.size + ' B'
              : f.size < 1048576 ? (f.size / 1024).toFixed(1) + ' KB'
              : (f.size / 1048576).toFixed(2) + ' MB';
          }
          let date = '—';
          if (f.mtime) {
            try { date = new Date(f.mtime).toLocaleString(); } catch (e) { date = String(f.mtime); }
          }
          const ext = (name.split('.').pop() || '').toUpperCase();
          return `
            <div class="ph-info">
              <div class="ph-info__title">属性</div>
              <div class="ph-info__row"><span>名称</span><span>${escapeHtml(name)}</span></div>
              <div class="ph-info__row"><span>类型</span><span>${escapeHtml(ext ? ext + ' 图片' : '图片')}</span></div>
              <div class="ph-info__row"><span>大小</span><span>${escapeHtml(size)}</span></div>
              <div class="ph-info__row"><span>修改日期</span><span>${escapeHtml(date)}</span></div>
              <div class="ph-info__row"><span>位置</span><span>Pictures</span></div>
            </div>
          `;
        },
      },
    },
  });
})();