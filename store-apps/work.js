(() => {
  const BUNDLE = 'com.wujinb.work';
  const MAX_SIZE = 20 * 1024 * 1024;
  const LIB_CDN = {
    mammoth: [
      'https://fastly.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
      'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
      'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js',
      'https://npm.elemecdn.com/mammoth@1.6.0/mammoth.browser.min.js',
    ],
    xlsx: [
      'https://fastly.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://npm.elemecdn.com/xlsx@0.18.5/dist/xlsx.full.min.js',
    ],
  };

  function loadScript(src, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      let done = false;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        s.remove();
        reject(new Error('timeout'));
      }, timeoutMs);

      s.onload = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      s.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        s.remove();
        reject(new Error('network'));
      };

      document.head.appendChild(s);
    });
  }

  const libPromises = {};

  function loadLib(name) {
    if (libPromises[name]) return libPromises[name];

    libPromises[name] = (async () => {
      if (name === 'mammoth' && window.mammoth) return;
      if (name === 'xlsx' && window.XLSX) return;

      const urls = LIB_CDN[name];
      const errors = [];

      for (const url of urls) {
        try {
          await loadScript(url);

          if (name === 'mammoth' && !window.mammoth) throw new Error('全局 mammoth 未定义');
          if (name === 'xlsx' && !window.XLSX) throw new Error('全局 XLSX 未定义');

          console.log(`[work] ${name} 加载成功：${url}`);
          return;
        } catch (e) {
          errors.push(`${shortHost(url)}: ${e.message}`);
          console.warn(`[work] ${name} 尝试失败：${url} (${e.message})`);
        }
      }

      libPromises[name] = null;

      const msg = `无法加载 ${name} 库\n\n已尝试:\n${errors.join('\n')}\n\n可能原因:\n· 网络无法访问 CDN\n· 站点 CSP 阻止外部脚本\n\n解决:把 ${name}.browser.min.js 放到 ./libs/ 下`;
      throw new Error(msg);
    })();

    return libPromises[name];
  }

  function shortHost(url) {
    if (url.startsWith('./')) return 'local';
    try { return new URL(url).host; } catch { return url; }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function extOf(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
  }

  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  async function renderDocx(file, container) {
    await loadLib('mammoth');

    const blob = await WujiFileSystem.read(file.path);
    if (!blob) throw new Error('文件不存在');

    if (blob.size > MAX_SIZE) {
      throw new Error(`文件过大(${fmtSize(blob.size)}),上限 ${fmtSize(MAX_SIZE)}`);
    }

    const arrayBuffer = await blob.arrayBuffer();

    const result = await window.mammoth.convertToHtml(
      { arrayBuffer },
      {
        convertImage: window.mammoth.images.imgElement(image =>
          image.read('base64').then(data => ({
            src: `data:${image.contentType};base64,${data}`,
          }))
        ),
      }
    );

    container.innerHTML = `<div class="work-doc">${result.value}</div>`;

    if (result.messages && result.messages.length) {
      console.warn('[work] docx 告警', result.messages);
    }
  }

  async function renderXlsx(file, container) {
    await loadLib('xlsx');

    const blob = await WujiFileSystem.read(file.path);
    if (!blob) throw new Error('文件不存在');

    if (blob.size > MAX_SIZE) {
      throw new Error(`文件过大(${fmtSize(blob.size)}),上限 ${fmtSize(MAX_SIZE)}`);
    }

    const arrayBuffer = await blob.arrayBuffer();
    const wb = window.XLSX.read(arrayBuffer, { type: 'array' });

    if (!wb.SheetNames || !wb.SheetNames.length) {
      throw new Error('工作簿为空');
    }

    const html = wb.SheetNames.map((name, i) => {
      const sheet = wb.Sheets[name];
      const tableHtml = window.XLSX.utils.sheet_to_html(sheet, {
        id: 'work-sheet-' + i,
      });
      return `
        <section class="work-sheet-section">
          <h3 class="work-sheet-name">${esc(name)}</h3>
          <div class="work-sheet">${tableHtml}</div>
        </section>
      `;
    }).join('');

    container.innerHTML = html;
  }

  async function renderFile(root, file) {
    const viewer = root.querySelector('#workViewer');
    if (!viewer) return;

    const ext = extOf(file.name);

    root.querySelector('#workFilename').textContent = file.name;

    viewer.innerHTML = '<div class="work-loading">正在打开…</div>';

    try {
      if (ext === 'docx') {
        const target = document.createElement('div');
        await renderDocx(file, target);
        viewer.innerHTML = '';
        viewer.appendChild(target.firstChild);
      } else if (ext === 'xlsx') {
        const target = document.createElement('div');
        await renderXlsx(file, target);
        viewer.innerHTML = target.innerHTML;
      } else {
        throw new Error(`不支持的文件类型:.${ext}`);
      }
    } catch (e) {
      console.error('[work] render failed', e);
      viewer.innerHTML = `
        <div class="work-error">
          <div class="work-error__title">无法打开文件</div>
          <div class="work-error__msg">${esc(e.message || '未知错误')}</div>
        </div>
      `;
    }
  }

  function renderHome(root) {
    const viewer = root.querySelector('#workViewer');
    root.querySelector('#workFilename').textContent = '吴际办公';

    viewer.innerHTML = `
      <div class="work-welcome">
        <div class="work-welcome__icon">💩</div>
        <div class="work-welcome__title">吴际办公</div>
        <div class="work-welcome__desc">在文件管理器中点击 .docx / .xlsx 文件即可打开</div>
        <div class="work-welcome__hint">当前为只读模式,不支持编辑</div>
      </div>
    `;
  }

  /* ---------- 注册应用 ---------- */
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际办公',
    icon: './assets/work.svg',
    version: '1.0.0',
    platforms: ['zhuzios', 'wujios'],
    fileTypes: [
      {
        ext: ['docx'], role: 'viewer',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      {
        ext: ['xlsx'], role: 'viewer',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
    ],

    styles: `
      .work-page {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: #ffffff; color: #101828;
        font-family: var(--wj-font);
        overflow: hidden;
        padding-top: var(--statusbar-h, 0px);
      }
      .work-topbar {
        flex: 0 0 auto;
        display: flex; align-items: center; gap: 12px;
        padding: 10px 16px;
        border-bottom: 1px solid #e6e9ef;
        background: #fafbfd;
        font-size: var(--wj-fs-md);
      }
      .work-topbar__name {
        flex: 1 1 auto; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-weight: 600;
      }

      .work-viewer {
        flex: 1 1 auto; min-height: 0;
        overflow-y: auto;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        background: #f2f5fa;
        padding: 20px;
      }

      .work-loading {
        padding: 80px 20px;
        text-align: center;
        color: #5b6478;
        font-size: var(--wj-fs-md);
      }
      .work-error {
        padding: 80px 24px;
        text-align: center;
      }
      .work-error__title {
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        color: #e0356b;
        margin-bottom: 12px;
      }
      .work-error__msg {
        font-size: var(--wj-fs-md);
        color: #5b6478;
        line-height: 1.6;
      }

      /* 欢迎页 */
      .work-welcome {
        padding: 80px 24px;
        text-align: center;
      }
      .work-welcome__icon {
        font-size: 72px;
        line-height: 1;
        margin-bottom: 24px;
      }
      .work-welcome__title {
        font-size: var(--wj-fs-2xl);
        font-weight: 700;
        color: #101828;
        margin-bottom: 12px;
      }
      .work-welcome__desc {
        font-size: var(--wj-fs-md);
        color: #5b6478;
        line-height: 1.7;
      }
      .work-welcome__hint {
        margin-top: 24px;
        font-size: var(--wj-fs-sm);
        color: #8a93a4;
      }

      /* docx 渲染区域 */
      .work-doc {
        max-width: 820px;
        margin: 0 auto;
        padding: 40px 56px;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0,0,0,.06);
        color: #101828;
        font-size: var(--wj-fs-md);
        line-height: 1.75;
        user-select: text;
        -webkit-user-select: text;
      }
      .work-doc * { user-select: text; -webkit-user-select: text; }
      .work-doc p { margin: 0 0 1em; }
      .work-doc h1 { font-size: 2em;   margin: 1.2em 0 .6em; font-weight: 700; }
      .work-doc h2 { font-size: 1.5em; margin: 1.2em 0 .6em; font-weight: 700; }
      .work-doc h3 { font-size: 1.25em; margin: 1em 0 .5em; font-weight: 600; }
      .work-doc h4, .work-doc h5, .work-doc h6 { margin: 1em 0 .5em; font-weight: 600; }
      .work-doc ul, .work-doc ol { margin: 0 0 1em; padding-left: 2em; }
      .work-doc li { margin-bottom: .25em; }
      .work-doc blockquote {
        margin: 1em 0;
        padding: 8px 16px;
        border-left: 4px solid #e6e9ef;
        color: #5b6478;
      }
      .work-doc table {
        border-collapse: collapse;
        margin: 1em 0;
        max-width: 100%;
      }
      .work-doc table td, .work-doc table th {
        border: 1px solid #e6e9ef;
        padding: 6px 10px;
      }
      .work-doc img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1em auto;
      }
      .work-doc pre {
        background: #f2f5fa;
        padding: 12px 16px;
        border-radius: 6px;
        overflow-x: auto;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: var(--wj-fs-sm);
      }

      /* xlsx 渲染区域 */
      .work-sheet-section {
        margin: 0 0 32px;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0,0,0,.06);
        padding: 20px 24px;
      }
      .work-sheet-name {
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        margin: 0 0 16px;
        color: #101828;
      }
      .work-sheet {
        overflow-x: auto;
      }
      .work-sheet table {
        border-collapse: collapse;
        font-size: var(--wj-fs-sm);
      }
      .work-sheet table td, .work-sheet table th {
        border: 1px solid #e6e9ef;
        padding: 6px 10px;
        min-width: 80px;
        white-space: nowrap;
      }
      .work-sheet table th {
        background: #f2f5fa;
        font-weight: 600;
      }

      @media (max-width: 520px) {
        .work-doc { padding: 24px 20px; }
        .work-viewer { padding: 12px; }
      }
    `,

    render() {
      return `
        <div class="work-page">
          <div class="work-topbar">
            <span class="work-topbar__name" id="workFilename">吴际办公</span>
          </div>
          <div class="work-viewer" id="workViewer"></div>
        </div>
      `;
    },

    mount(root, ctx) {
      if (!window.WujiFileSystem) {
        root.querySelector('#workViewer').innerHTML =
          '<div class="work-error"><div class="work-error__msg">文件系统不可用</div></div>';
        return;
      }

      const file = ctx.params?.file;

      if (file) {
        renderFile(root, file);
      } else {
        renderHome(root);
      }

      /* ★ 单例窗口:再次用 work 打开新文件 */
      const onParams = (e) => {
        if (e.detail.bundle !== BUNDLE) return;
        const newFile = e.detail.params?.file;
        if (newFile) renderFile(root, newFile);
      };
      window.addEventListener('wuji:app-params', onParams);

      return () => {
        window.removeEventListener('wuji:app-params', onParams);
      };
    },
  });
})();