(() => {
  const BUNDLE = 'com.wujios.files';
  const MAX_FILE_SIZE = 200 * 1024 * 1024;

  /* ---------- 运行环境判定 ---------- */
  function isPC() {
    return window.__OPENWUJI_PLATFORM === 'zhuzios';
  }

  function isTouchModeOn() {
    const os = document.getElementById('os');
    if (os) return os.classList.contains('is-touch-mode');
    if (document.body && document.body.classList.contains('is-touch-mode')) return true;
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches;
  }

  function useDoubleClick() {
    return isPC() && !isTouchModeOn();
  }

  /* ---------- 工具 ---------- */
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  /* =========================================================
     SVG 图标（32×32，Win11 风格彩色文件夹 + 文件）
     ========================================================= */
  const SVG_ATTR = 'viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';

  const svgFolder = (color, content = '') =>
    `<svg ${SVG_ATTR}><path d="M4 8 Q4 6 6 6 H12 L14 8 H26 Q28 8 28 10 V24 Q28 26 26 26 H6 Q4 26 4 24 Z" fill="${color}"/>${content}</svg>`;

  const svgFile = (color, foldColor, content = '') =>
    `<svg ${SVG_ATTR}><path d="M8 4 H20 L26 10 V27 Q26 28 25 28 H8 Q7 28 7 27 V5 Q7 4 8 4 Z" fill="${color}"/><path d="M20 4 V10 H26 Z" fill="${foldColor}" opacity="0.7"/>${content}</svg>`;

  /* ---------- 文件夹图标 ---------- */
  const ICON_FOLDER = svgFolder('#FFC107');

  const ICON_FOLDER_DOWNLOADS = svgFolder('#4CAF50',
    '<path d="M16 12 V19 M12.5 16 L16 19.5 L19.5 16" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>');

  const ICON_FOLDER_PICTURES = svgFolder('#2196F3',
    '<path d="M8 22 L11 17 L14 19 L18 14 L24 22 Z" fill="white"/><circle cx="22" cy="12" r="1.8" fill="white"/>');

  const ICON_FOLDER_DOCUMENTS = svgFolder('#9E9E9E',
    '<rect x="10" y="13" width="10" height="1.6" rx="0.8" fill="white"/><rect x="10" y="17" width="10" height="1.6" rx="0.8" fill="white"/><rect x="10" y="21" width="7" height="1.6" rx="0.8" fill="white"/><rect x="21" y="13" width="3" height="9" rx="0.8" fill="white" opacity="0.85"/>');

  /* ---------- 文件图标 ---------- */
  const ICON_FILE_IMAGE = svgFile('#B3E5FC', '#81D4FA',
    '<rect x="9" y="12" width="14" height="12" rx="1.5" fill="white" opacity="0.9"/><path d="M10 22 L13 17 L15 19 L18 15 L22 22 Z" fill="#1976D2"/><circle cx="20" cy="15" r="1.2" fill="#1976D2"/>');

  const ICON_FILE_VIDEO = svgFile('#DA7FEA', '#CB70DB',
    '<rect x="9" y="13" width="14" height="10" rx="1.5" fill="white" opacity="0.9"/><path d="M14 15.5 L19 18 L14 20.5 Z" fill="#7B1FA2"/>');

  const ICON_FILE_AUDIO = svgFile('#F9A082', '#F78569',
    '<ellipse cx="12" cy="21" rx="2" ry="1.5" fill="white"/><ellipse cx="19" cy="19" rx="2" ry="1.5" fill="white"/><path d="M13.8 21 V13 M20.8 19 V11" stroke="white" stroke-width="1.2"/><path d="M13.8 13 L20.8 11 L20.8 13 L13.8 15 Z" fill="white"/>');

  const ICON_FILE_TEXT = svgFile('#54A5E6', '#3295E5',
    '<rect x="10" y="13" width="12" height="1.5" rx="0.75" fill="white"/><rect x="10" y="16.5" width="12" height="1.5" rx="0.75" fill="white"/><rect x="10" y="20" width="9" height="1.5" rx="0.75" fill="white"/><rect x="10" y="23.5" width="6" height="1.5" rx="0.75" fill="white"/>');

  const ICON_FILE_DOC = svgFile('#54A5E6', '#3295E5',
    '<path d="M11 12 L13 21 L16 15 L19 21 L21 12" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="miter" fill="none"/>');

  const ICON_FILE_SHEET = svgFile('#81C784', '#66BB6A',
    '<path d="M12 13 L20 22 M20 13 L12 22" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>');

  const ICON_FILE_UNKNOWN = svgFile('#B0B0B0', '#9F9F9F',
    '<path d="M12.5 13 Q12.5 11 16 11 Q19.5 11 19.5 14 Q19.5 16 16 17.5 L16 19" stroke="white" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="16" cy="22" r="1" fill="white"/>');

  /* ---------- 按钮图标 ---------- */
  const SVG_RENAME = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;

  const SVG_DELETE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

  /* ---------- 类型映射 ---------- */
  function iconFor(kind) {
    switch (kind) {
      case 'image': return ICON_FILE_IMAGE;
      case 'video': return ICON_FILE_VIDEO;
      case 'audio': return ICON_FILE_AUDIO;
      case 'text': return ICON_FILE_TEXT;
      case 'doc': return ICON_FILE_DOC;
      case 'xls': return ICON_FILE_SHEET;
      case 'dir': return ICON_FOLDER;
      default: return ICON_FILE_UNKNOWN;
    }
  }

  function dirIcon(name) {
    if (name === 'Pictures') return ICON_FOLDER_PICTURES;
    if (name === 'Documents') return ICON_FOLDER_DOCUMENTS;
    if (name === 'Downloads') return ICON_FOLDER_DOWNLOADS;
    return ICON_FOLDER;
  }

  function validateEntryName(raw) {
    const name = String(raw == null ? '' : raw).trim();
    if (!name) return '名称不能为空';
    if (name === '.' || name === '..') return '名称不合法';
    if (/[\\/:*?"<>|]/.test(name)) return '名称不能包含 \\ / : * ? " < > |';
    if (/[. ]$/.test(name)) return '名称不能以点或空格结尾';
    return '';
  }

  /* ---------- WujiDialog 封装 ---------- */
  async function showAlert(title, content) {
    if (!window.WujiDialog) {
      window.alert((title ? title + '\n\n' : '') + (content || ''));
      return;
    }
    await window.WujiDialog.show({
      bundlename: BUNDLE, title, content,
      buttons: [{ value: '确定', primary: true }],
    });
  }

  async function showConfirm(title, content, okValue = '确定', danger = false) {
    if (!window.WujiDialog) {
      return window.confirm((title ? title + '\n\n' : '') + (content || ''));
    }
    const res = await window.WujiDialog.show({
      bundlename: BUNDLE, title, content,
      buttons: [
        { value: '取消' },
        {
          value: okValue, primary: true,
          ...(danger ? { color: 'var(--wj-danger, #e5484d)' } : {}),
        },
      ],
    });
    return res === okValue;
  }

  async function showPrompt(title, defaultValue, okValue = '确定', placeholder = '') {
    if (!window.WujiDialog) {
      const v = window.prompt(title, defaultValue);
      return v == null ? null : String(v).trim();
    }
    const res = await window.WujiDialog.show({
      bundlename: BUNDLE, title,
      input: {
        value: defaultValue == null ? '' : String(defaultValue),
        placeholder,
      },
      buttons: [
        { value: '取消' },
        { value: okValue, primary: true, validate: validateEntryName },
      ],
    });
    if (!res || res.button !== okValue) return null;
    return String(res.value == null ? '' : res.value).trim();
  }

  /* ---------- 注册应用 ---------- */
  WujiApps.register({
    bundlename: BUNDLE,
    name: '文件管理',
    icon: './assets/files.svg',
    initialRoute: 'home',
    version: '1.4.0',

    styles: `
      .fm-page {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: #ffffff; color: #101828;
        font-family: var(--wj-font); overflow: hidden;
        padding-top: var(--statusbar-h, 0px);
        font-size: var(--wj-fs-md);
        line-height: 1.5;
      }

      .fm-path {
        flex: 0 0 auto;
        padding: 10px 16px;
        display: flex; align-items: center; gap: 4px;
        font-size: var(--wj-fs-md);
        border-bottom: 1px solid #e6e9ef;
        overflow-x: auto; white-space: nowrap;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        touch-action: pan-x;
      }
      .fm-path::-webkit-scrollbar { display: none; }

      .fm-path > * { flex-shrink: 0; }

      .fm-crumb {
        color: #3a6ff0;
        cursor: pointer;
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
      .fm-crumb:hover { text-decoration: underline; }

      .fm-sep { color: #8a93a4; }

      .fm-toolbar {
        flex: 0 0 auto;
        display: flex; gap: 8px;
        padding: 10px 16px;
        border-bottom: 1px solid #e6e9ef;
      }
      .fm-btn {
        height: 40px; padding: 0 14px;
        border: 1px solid #e6e9ef; border-radius: 8px;
        background: #fff; color: #101828;
        font: inherit; font-size: var(--wj-fs-md);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        white-space: nowrap;
        transition: background .12s;
      }
      .fm-btn:hover:not(:disabled) { background: #f2f5fa; }
      .fm-btn:active:not(:disabled) { background: #e8edf5; }
      .fm-btn:disabled { opacity: .4; cursor: not-allowed; }

      .fm-btn--icon {
        width: 40px; padding: 0;
      }

      .fm-btn__icon,
      .fm-btn__text { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
      .fm-btn__icon svg { display: block; }

      /* ---------- 文件列表 ---------- */
      .fm-list {
        flex: 1 1 auto; min-height: 0;
        overflow-y: auto; padding: 8px 16px 16px;
        -webkit-overflow-scrolling: touch;
      }
      .fm-empty {
        padding: 60px 20px; text-align: center;
        color: #8a93a4; font-size: var(--wj-fs-md);
        line-height: 1.7;
      }

      .fm-row {
        display: grid;
        grid-template-columns: 48px minmax(0,1fr) 60px 40px 40px;
        align-items: center; gap: 8px;
        padding: 6px 12px; border-radius: 8px;
        font-size: var(--wj-fs-md);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        transition: background .12s ease;
      }
      .fm-row:hover { background: #f2f5fa; }
      .fm-row.is-selected { background: #eaf0ff; }
      .fm-row.is-selected .fm-row__name { color: #3a6ff0; }

      .fm-row__icon {
        width: 48px;
        height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      .fm-row__icon svg { width: 100%; height: 100%; display: block; }

      .fm-row__name {
        overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; min-width: 0;
        font-size: var(--wj-fs-md);
      }
      .fm-row__meta {
        color: #5b6478;
        font-size: var(--wj-fs-md);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      /* 行内操作按钮：40×40 方，只显示 SVG 图标 */
      .fm-row__btn {
        width: 40px; height: 40px; padding: 0;
        border: 1px solid #e6e9ef; border-radius: 8px;
        background: #fff; color: #5b6478;
        font: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        display: inline-flex; align-items: center; justify-content: center;
        transition: background .12s, color .12s, border-color .12s;
      }
      .fm-row__btn svg { display: block; }
      .fm-row__btn:hover {
        background: #eaf0ff; border-color: #b9cdfb; color: #3a6ff0;
      }
      .fm-row__btn:active { background: #dde7fb; }
      .fm-row__btn.fm-row__btn--danger:hover {
        background: #fde8ef; border-color: #f7c1d3; color: #e0356b;
      }

      /* ---------- 预览 ---------- */
      .fm-preview {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: #101828; color: #fff;
        padding-top: var(--statusbar-h, 0px);
        font-size: var(--wj-fs-md);
      }
      .fm-preview__head {
        flex: 0 0 auto;
        display: flex; align-items: center; gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        font-size: var(--wj-fs-md);
      }
      .fm-preview__btn {
        height: 40px; padding: 0 16px;
        border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
        background: rgba(255,255,255,.06); color: #fff;
        font: inherit; font-size: var(--wj-fs-md);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .12s;
      }
      .fm-preview__btn:hover { background: rgba(255,255,255,.12); }
      .fm-preview__btn:active { background: rgba(255,255,255,.18); }

      .fm-preview__name {
        flex: 1 1 auto; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: var(--wj-fs-md);
      }

      .fm-preview__body {
        flex: 1 1 auto; min-height: 0;
        display: flex; align-items: center; justify-content: center;
        overflow: auto;
      }
      .fm-preview__body img,
      .fm-preview__body video {
        max-width: 100%; max-height: 100%; display: block;
      }
      .fm-preview__body iframe {
        width: 100%; height: 100%; border: 0; background: #fff;
      }
      .fm-preview__body pre {
        margin: 0; padding: 20px; width: 100%; height: 100%;
        overflow: auto; color: #e9ecf2; background: #0f1116;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: var(--wj-fs-md);
        line-height: 1.6; white-space: pre-wrap;
        word-break: break-word;
      }

      .fm-preview__hint {
        padding: 40px;
        text-align: center;
        color: #8a93a4;
        font-size: var(--wj-fs-md);
        line-height: 1.7;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="fm-page">
              <div class="fm-path" id="fmPath"></div>
              <div class="fm-toolbar">
                <button class="fm-btn" id="fmUpBtn" type="button" disabled title="上级目录">
                  <span class="fm-btn__icon" aria-hidden="true">⬆️</span>
                </button>
                <button class="fm-btn" id="fmUploadBtn" type="button">
                  <span class="fm-btn__text">上传文件</span>
                </button>
                <button class="fm-btn" id="fmMkdirBtn" type="button">
                  <span class="fm-btn__icon" aria-hidden="true">📁</span>
                  <span class="fm-btn__text">新建文件夹</span>
                </button>
              </div>
              <div class="fm-list" id="fmList"></div>
              <input type="file" id="fmInput" multiple hidden>
            </div>
          `;
        },

        mount(root, ctx) {
          if (!window.WujiFileSystem || !window.WujiFileSystem.supported) {
            root.innerHTML = `<div class="fm-page"><div class="fm-empty">
              当前浏览器不支持文件系统<br>
              请使用较新的 Chrome / Edge / Safari
            </div></div>`;
            return;
          }

          const pathEl = root.querySelector('#fmPath');
          const listEl = root.querySelector('#fmList');
          const input = root.querySelector('#fmInput');
          pathEl.addEventListener('touchstart', e => {
            e.stopPropagation();
          }, { passive: true });
          pathEl.addEventListener('pointerdown', e => {
            e.stopPropagation();
          }, { passive: true });
          const upBtn = root.querySelector('#fmUpBtn');
          const uploadBtn = root.querySelector('#fmUploadBtn');
          const mkdirBtn = root.querySelector('#fmMkdirBtn');

          let currentPath = ctx.data?.path || [];

          let lastOpenAt = 0;
          function guardedOpen(fn) {
            const now = Date.now();
            if (now - lastOpenAt < 400) return;
            lastOpenAt = now;
            fn();
          }

          function updateUpBtn() {
            upBtn.disabled = currentPath.length === 0;
          }

          function goUp() {
            if (!currentPath.length) return;
            currentPath = currentPath.slice(0, -1);
            render();
          }

          function renderPath() {
            const parts = ['根目录', ...currentPath];
            pathEl.innerHTML = parts.map((p, i) => {
              const last = i === parts.length - 1;
              return last
                ? `<span>${escapeHtml(p)}</span>`
                : `<a class="fm-crumb" data-idx="${i}">${escapeHtml(p)}</a>
                   <span class="fm-sep">›</span>`;
            }).join('');
            pathEl.querySelectorAll('.fm-crumb').forEach(a => {
              a.onclick = () => {
                currentPath = currentPath.slice(0, Number(a.dataset.idx));
                render();
              };
            });
            requestAnimationFrame(() => {
              pathEl.scrollLeft = pathEl.scrollWidth;
            });
          }

          function selectRow(row) {
            listEl.querySelectorAll('.fm-row.is-selected')
              .forEach(r => r.classList.remove('is-selected'));
            if (row) row.classList.add('is-selected');
          }

          async function showNoHandler(file) {
            const ext = (() => {
              const i = file.name.lastIndexOf('.');
              return i >= 0 ? file.name.slice(i + 1).toLowerCase() : '';
            })();

            const hint = ext
              ? `没有应用能打开「${file.name}」\n可以下载支持 .${ext} 的应用`
              : `没有应用能打开「${file.name}」`;

            const res = await WujiDialog.show({
              bundlename: BUNDLE,
              title: '无可用打开方式',
              content: hint,
              buttons: [
                { value: '取消' },
                { value: '去应用市场', primary: true },
              ],
            });

            if (res === '去应用市场') {
              if (window.WujiAppLauncher) {
                WujiAppLauncher.open('com.wujios.wujigallery');
              }
            }
          }

          async function render() {
            updateUpBtn();
            renderPath();
            listEl.innerHTML = '<div class="fm-empty">加载中…</div>';

            let items = [];
            try {
              items = await WujiFileSystem.list(currentPath);
            } catch (e) {
              listEl.innerHTML = '<div class="fm-empty">读取失败</div>';
              console.error(e);
              return;
            }

            if (!items.length) {
              listEl.innerHTML = `
                <div class="fm-empty">
                  空文件夹<br>
                  <span style="font-size:16px">点"上传文件"或"新建文件夹"开始</span>
                </div>`;
              return;
            }

            listEl.innerHTML = items.map(it => {
              const isDir = it.kind === 'dir';
              const icon = isDir ? dirIcon(it.name) : iconFor(WujiFileSystem.kindOf(it.name));
              const meta = isDir ? '' : fmtSize(it.size);
              return `
                <div class="fm-row" data-name="${escapeHtml(it.name)}" data-kind="${it.kind}">
                  <span class="fm-row__icon">${icon}</span>
                  <span class="fm-row__name">${escapeHtml(it.name)}</span>
                  <span class="fm-row__meta">${meta}</span>
                                    <button data-act="rename" class="fm-row__btn" type="button" aria-label="重命名" title="重命名">
                    ${SVG_RENAME}
                  </button>
                  <button data-act="delete" class="fm-row__btn fm-row__btn--danger" type="button" aria-label="删除" title="删除">
                    ${SVG_DELETE}
                  </button>
                </div>`;
            }).join('');

            listEl.querySelectorAll('.fm-row').forEach(row => {
              const name = row.dataset.name;
              const kind = row.dataset.kind;
              const full = [...currentPath, name];
              const isDir = kind === 'dir';

              function openItem() {
                if (isDir) {
                  currentPath = full;
                  render();
                  return;
                }

                const file = { path: full, name };

                if (window.WujiFileOpener) {
                  WujiFileOpener.open(file).catch(e => console.error('[files] open failed', e));
                } else {
                  showNoHandler(file);
                }
              }

              row.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                if (useDoubleClick()) {
                  selectRow(row);
                } else {
                  selectRow(null);
                  guardedOpen(openItem);
                }
              });

              row.addEventListener('dblclick', (e) => {
                if (e.target.closest('button')) return;
                if (!useDoubleClick()) return;
                guardedOpen(openItem);
              });

              row.querySelector('[data-act="rename"]').onclick = async (e) => {
                e.stopPropagation();
                const nn = await showPrompt('重命名', name, '确定', '输入新名称');
                if (nn == null || !nn || nn === name) return;
                try {
                  await WujiFileSystem.rename(full, nn);
                } catch (err) {
                  await showAlert('重命名失败', err && err.message ? err.message : String(err));
                }
                render();
              };

              row.querySelector('[data-act="delete"]').onclick = async (e) => {
                e.stopPropagation();
                const tip = isDir
                  ? `删除文件夹「${name}」及其全部内容？`
                  : `删除「${name}」？`;
                const ok = await showConfirm(
                  isDir ? '删除文件夹' : '删除文件', tip, '删除', true
                );
                if (!ok) return;
                try {
                  await WujiFileSystem.remove(full);
                } catch (err) {
                  await showAlert('删除失败', err && err.message ? err.message : String(err));
                }
                render();
              };
            });
          }

          upBtn.onclick = () => goUp();

          uploadBtn.onclick = () => input.click();

          input.onchange = async () => {
            const files = Array.from(input.files || []);
            input.value = '';
            if (!files.length) return;

            const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
            if (oversized.length) {
              const names = oversized.map(f => `「${f.name}」`).join('、');
              await showAlert(
                '文件过大',
                `${names} 超过 ${fmtSize(MAX_FILE_SIZE)} 上限，已跳过`
              );
            }
            const uploadable = files.filter(f => f.size <= MAX_FILE_SIZE);
            if (!uploadable.length) return;

            const est = await WujiFileSystem.estimate();
            const totalSize = uploadable.reduce((s, f) => s + f.size, 0);
            if (est && est.quota) {
              const free = est.quota - (est.usage || 0);
              if (totalSize * 1.2 > free) {
                await showAlert(
                  '空间不足',
                  `需要 ${fmtSize(totalSize)}，剩余 ${fmtSize(free)}`
                );
                return;
              }
            }

            listEl.innerHTML = `<div class="fm-empty">正在上传 ${uploadable.length} 个文件…</div>`;

            const failures = [];
            for (const f of uploadable) {
              try {
                await WujiFileSystem.add(currentPath, f);
              } catch (e) {
                console.error('[fs] upload failed', f.name, e);
                failures.push({ name: f.name, error: e });
              }
            }

            if (failures.length) {
              const details = failures.map(f =>
                `「${f.name}」: ${f.error?.message || '未知错误'}`
              ).join('\n');
              await showAlert('上传失败', `${failures.length} 个文件失败:\n\n${details}`);
            }

            render();
          };

          mkdirBtn.onclick = async () => {
            const name = await showPrompt(
              '新建文件夹', '新建文件夹', '创建', '输入文件夹名称'
            );
            if (!name) return;
            try {
              await WujiFileSystem.mkdir(currentPath, name);
            } catch (e) {
              await showAlert('创建失败', e && e.message ? e.message : String(e));
            }
            render();
          };

          render();
        },
      },

      /* ---------- 预览（无返回按钮） ---------- */
      preview: {
        name: 'preview',

        render(routeCtx) {
          const path = routeCtx.data?.path || [];
          const name = path[path.length - 1] || '文件';
          return `
            <div class="fm-preview">
              <div class="fm-preview__head">
                <span class="fm-preview__name">${escapeHtml(name)}</span>
                <button class="fm-preview__btn" id="fmPreviewDownload" type="button">下载</button>              </div>
              <div class="fm-preview__body" id="fmPreviewBody">
                <div class="fm-preview__hint">加载中…</div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const path = ctx.data?.path || [];
          const name = path[path.length - 1] || '';
          const bodyEl = root.querySelector('#fmPreviewBody');
          let objectURL = null;

          root.querySelector('#fmPreviewDownload').onclick = () => {
            WujiFileSystem.download(path);
          };

          async function load() {
            const file = await WujiFileSystem.read(path);
            if (!file) {
              bodyEl.innerHTML = '<div class="fm-preview__hint">文件不存在</div>';
              return;
            }

            const kind = WujiFileSystem.kindOf(name);

            if (kind === 'image') {
              objectURL = URL.createObjectURL(file);
              bodyEl.innerHTML = `<img src="${objectURL}" alt="">`;
              return;
            }

            if (kind === 'video') {
              objectURL = URL.createObjectURL(file);
              bodyEl.innerHTML = `<video src="${objectURL}" controls autoplay playsinline></video>`;
              return;
            }

            if (kind === 'audio') {
              objectURL = URL.createObjectURL(file);
              bodyEl.innerHTML = `<audio src="${objectURL}" controls autoplay></audio>`;
              return;
            }

            if (kind === 'text') {
              try {
                const text = await file.text();
                const pre = document.createElement('pre');
                pre.textContent = text;
                bodyEl.innerHTML = '';
                bodyEl.appendChild(pre);
              } catch {
                bodyEl.innerHTML = '<div class="fm-preview__hint">无法读取文本</div>';
              }
              return;
            }

            bodyEl.innerHTML = `
              <div class="fm-preview__hint">
                无法预览此类型文件<br>
                <span style="font-size:12px">点"下载"在本地打开</span>
              </div>`;
          }

          load();

          return () => {
            if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
          };
        },
      },
    },
  });
})();