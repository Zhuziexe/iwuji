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

  function iconFor(kind) {
    return {
      image: '🖼️', video: '🎬', audio: '🎵', pdf: '📕',
      text: '📄', document: '📘', file: '📎', dir: '📁',
    }[kind] || '📎';
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
          ...(danger ? { color: 'var(--wj-danger, #e5484d)' } : {})
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
    version: '1.3.0',
    platforms: ['zhuzios', 'wujios'],

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
        padding: 12px 16px;
        display: flex; align-items: center; gap: 6px;
        font-size: var(--wj-fs-md);
        border-bottom: 1px solid #e6e9ef;
        overflow-x: auto; white-space: nowrap;
        -webkit-overflow-scrolling: touch;
      }
      .fm-crumb { color: #3a6ff0; cursor: pointer; text-decoration: none; }
      .fm-crumb:hover { text-decoration: underline; }
      .fm-sep { color: #8a93a4; }

      /* ---------- 工具栏 ---------- */
      .fm-toolbar {
        flex: 0 0 auto;
        display: flex; gap: 8px;
        padding: 10px 16px;
        border-bottom: 1px solid #e6e9ef;
      }
      .fm-btn {
        height: 36px; padding: 0 16px;
        border: 1px solid #e6e9ef; border-radius: 8px;
        background: #fff; color: #101828;
        font: inherit; font-size: var(--wj-fs-sm);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        display: inline-flex; align-items: center; gap: 6px;
        white-space: nowrap;
        transition: background .12s;
      }
      .fm-btn:hover:not(:disabled) { background: #f2f5fa; }
      .fm-btn:active:not(:disabled) { background: #e8edf5; }
      .fm-btn:disabled { opacity: .4; cursor: not-allowed; }

      .fm-btn__icon,
      .fm-btn__text { display: inline; line-height: 1; }

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

      /* 列宽因字号放大从 90px → 100px */
      .fm-row {
        display: grid;
        grid-template-columns: 32px minmax(0,1fr) 100px auto auto;
        align-items: center; gap: 12px;
        padding: 12px 12px; border-radius: 8px;
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
        font-size: var(--wj-fs-xl);
        line-height: 1;
      }
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
      }

      .fm-row button {
        height: 32px; padding: 0 12px;
        border: 1px solid #e6e9ef; border-radius: 6px;
        background: #fff; color: #101828;
        font: inherit; font-size: var(--wj-fs-sm);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        display: inline-flex; align-items: center; justify-content: center;
        gap: 4px;
        transition: background .12s, color .12s, border-color .12s;
      }
      .fm-row button:hover {
        background: #eaf0ff; border-color: #b9cdfb; color: #3a6ff0;
      }
      .fm-row button:active { background: #dde7fb; }
      .fm-row button.fm-row__del:hover {
        background: #fde8ef; border-color: #f7c1d3; color: #e0356b;
      }

      .fm-row button .fm-btn__icon { display: none; }

      @media (max-width: 640px) {
        .fm-path { padding: 12px 14px; font-size: var(--wj-fs-lg); }
        .fm-toolbar { padding: 10px 14px; gap: 8px; }
        .fm-btn { height: 40px; padding: 0 14px; font-size: var(--wj-fs-lg); }

        .fm-list { padding: 6px 10px 14px; }
        .fm-row {
          grid-template-columns: 32px minmax(0,1fr) auto auto;
          gap: 10px;
          padding: 12px 10px;
        }
        .fm-row__meta { display: none; }
        .fm-row button {
          height: 36px; padding: 0 12px;
          font-size: var(--wj-fs-sm);
        }
      }

      /* ---------- 小屏（iWuji） ---------- */
      @media (max-width: 520px) {
        /* 路径字号再大一号 */
        .fm-path {
          padding: 14px 14px;
          font-size: var(--wj-fs-lg);
          gap: 6px;
        }

        .fm-toolbar { padding: 10px 12px; gap: 6px; }
        .fm-btn {
          height: 44px; padding: 0 14px;
          font-size: var(--wj-fs-sm);
          gap: 0;
          border-radius: 10px;
        }
        /* 上级 / 新建：正方形按钮，仅图标 */
        #fmUpBtn, #fmMkdirBtn {
          width: 44px; padding: 0;
          justify-content: center;
        }
        #fmUpBtn .fm-btn__text,
        #fmMkdirBtn .fm-btn__text { display: none; }

        .fm-row {
          grid-template-columns: 30px minmax(0,1fr) auto auto;
          gap: 8px;
          padding: 14px 10px;
        }
        .fm-row button {
          width: 44px; height: 44px; padding: 0;
          font-size: var(--wj-fs-sm);
          border-radius: 10px;
        }
        .fm-row button .fm-btn__text { display: none; }
        .fm-row button .fm-btn__icon { display: inline; }
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
      .fm-preview__back {
        height: 36px; padding: 0 16px;
        border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
        background: rgba(255,255,255,.06); color: #fff;
        font: inherit; font-size: var(--wj-fs-md);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .12s;
      }
      .fm-preview__back:hover { background: rgba(255,255,255,.12); }
      .fm-preview__back:active { background: rgba(255,255,255,.18); }

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

      @media (max-width: 520px) {
        .fm-preview__head { padding: 12px 14px; }
        .fm-preview__back { height: 40px; padding: 0 16px; font-size: var(--wj-fs-lg); }
        .fm-preview__name { font-size: var(--wj-fs-lg); }
      }
    `,

    routes: {
      home: {
        name: 'home',

        /* ★ 3. 工具栏加"⬆️ 上级"按钮 */
        render() {
          return `
            <div class="fm-page">
              <div class="fm-path" id="fmPath"></div>
              <div class="fm-toolbar">
                <button class="fm-btn" id="fmUpBtn" type="button" disabled title="上级目录">
                  <span class="fm-btn__icon" aria-hidden="true">⬆️</span>
                  <span class="fm-btn__text">上级</span>
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

          /* ---------- 上级按钮状态 ---------- */
          function updateUpBtn() {
            upBtn.disabled = currentPath.length === 0;
          }

          function goUp() {
            if (!currentPath.length) return;
            currentPath = currentPath.slice(0, -1);
            render();
          }

          /* ---------- 路径面包屑 ---------- */
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

            /* ★ 2. 移除打开按钮 */
            listEl.innerHTML = items.map(it => {
              const isDir = it.kind === 'dir';
              const icon = isDir ? '📁' : iconFor(WujiFileSystem.kindOf(it.name));
              const meta = isDir ? '文件夹' : fmtSize(it.size);
              return `
                <div class="fm-row" data-name="${escapeHtml(it.name)}" data-kind="${it.kind}">
                  <span class="fm-row__icon">${icon}</span>
                  <span class="fm-row__name">${escapeHtml(it.name)}</span>
                  <span class="fm-row__meta">${meta}</span>
                  <button data-act="rename" type="button" aria-label="重命名" title="重命名">
                    <span class="fm-btn__text">重命名</span>
                    <span class="fm-btn__icon">✏️</span>
                  </button>
                  <button data-act="delete" class="fm-row__del" type="button" aria-label="删除" title="删除">
                    <span class="fm-btn__text">删除</span>
                    <span class="fm-btn__icon">🗑️</span>
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

                const file = {
                  path: full,
                  name,
                  mime: WujiFileSystem.guessMime(name),
                };

                if (window.WujiFileOpener) {
                  const list = WujiFileOpener.handlers(file);
                  if (list.length) {
                    WujiFileOpener.open(file).catch(e => console.error('[files] open failed', e));
                    return;
                  }
                }

                const kind = WujiFileSystem.kindOf(name);
                if (['image', 'video', 'audio', 'text'].includes(kind)) {
                  ctx.push('preview', { path: full });
                  return;
                }

                showNoHandler(file);
              }

              row.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                if (useDoubleClick()) {
                  selectRow(row);            // 双击模式:单击选中
                } else {
                  selectRow(null);
                  guardedOpen(openItem);     // 单击模式:单击打开
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

          /* ---------- 上级按钮 ---------- */
          upBtn.onclick = () => goUp();

          /* ---------- 上传 ---------- */
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
            for (const f of uploadable) {
              try {
                await WujiFileSystem.add(currentPath, f);
              } catch (e) {
                console.error('[fs] upload failed', f.name, e);
              }
            }
            render();
          };

          /* ---------- 新建文件夹 ---------- */
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

      /* ---------- 预览 ---------- */
      preview: {
        name: 'preview',

        render(routeCtx) {
          const path = routeCtx.data?.path || [];
          const name = path[path.length - 1] || '文件';
          return `
            <div class="fm-preview">
              <div class="fm-preview__head">
                <button class="fm-preview__back" id="fmPreviewBack" type="button">返回</button>
                <span class="fm-preview__name">${escapeHtml(name)}</span>
                <button class="fm-preview__back" id="fmPreviewDownload" type="button">下载</button>
              </div>
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

          root.querySelector('#fmPreviewBack').onclick = () => ctx.pop();

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