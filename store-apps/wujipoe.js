(() => {
  const BUNDLE = 'com.wujinb.wujipoe';
  const API = 'https://poetry.palemoky.com';

  /* ============ 工具 ============ */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function getJSON(url, ms = 9000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal })
      .then(async (r) => {
        const text = await r.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = null; }
        if (!r.ok) {
          const msg = (body && body.error && body.error.message) || ('HTTP ' + r.status);
          throw new Error(msg);
        }
        return body;
      })
      .finally(() => clearTimeout(t));
  }

  function toast(msg) {
    try { window.WujiToast && window.WujiToast.show(msg); } catch { }
  }

  // 按内容数组渲染为横排版，每句一个段落
  function renderLines(content) {
    if (!Array.isArray(content) || !content.length) return '<div class="wp-empty">（暂无内容）</div>';
    const lines = content
      .map(s => String(s || ''))
      .filter(s => s.length)
      .map(s => `<p>${esc(s)}</p>`)
      .join('');
    return `<div class="wp-verse">${lines}</div>`;
  }

  function metaLine(p) {
    const parts = [];
    if (p.dynasty && p.dynasty.name) parts.push(esc(p.dynasty.name));
    if (p.type && p.type.name && p.type.name !== '其他') parts.push(esc(p.type.name));
    if (p.author && p.author.name) parts.push(esc(p.author.name));
    const right = parts.join(' · ');
    const left = p.title ? esc(p.title) : '佚名';
    return `
      <div class="wp-meta">
        <div class="wp-meta__title">${left}</div>
        <div class="wp-meta__sub">${right}</div>
      </div>`;
  }

  /* ============ 应用注册 ============ */
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际诗词',
    icon: './assets/wujipoe.svg',
    initialRoute: 'home',
    version: '1.0.1',
    devices: ['iwuji', 'pc'],

    styles: `
      .wp-page {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: var(--wj-bg);
        overflow: hidden;
        user-select: none; -webkit-user-select: none;
      }

      .wp-header {
        flex: 0 0 auto;
        padding: calc(var(--statusbar-h) + 12px) 22px 10px;
        background: var(--wj-bg);
        border-bottom: 1px solid var(--wj-border);
      }
      .wp-header__title {
        display: flex; align-items: baseline; gap: 10px;
        font-size: var(--wj-fs-2xl); font-weight: 700; color: var(--wj-text);
      }
      .wp-search {
        margin-top: 12px;
        display: flex; gap: 10px; align-items: center;
        background: var(--wj-bg-alt);
        border: 1px solid var(--wj-border-strong);
        border-radius: 999px;
        padding: 9px 16px;
      }
      .wp-search input {
        flex: 1; border: 0; background: transparent; outline: none;
        font: inherit; font-size: var(--wj-fs-md); color: var(--wj-text);
      }
      .wp-search input::placeholder { color: var(--wj-text-dim); }
      .wp-search button {
        border: 0; background: var(--wj-primary); color: #fff;
        font: inherit; font-size: var(--wj-fs-sm); font-weight: 600;
        border-radius: 999px; padding: 7px 18px; cursor: pointer;
      }
      .wp-search button:active { transform: scale(.97); }

      .wp-body {
        flex: 1 1 auto; min-height: 0;
        overflow-y: auto;
        padding: 16px 22px 28px;
        -webkit-overflow-scrolling: touch;
      }

      .wp-feature {
        background: linear-gradient(160deg, #f3fbf9 0%, #eef3fc 100%);
        border: 1px solid var(--wj-border-strong);
        border-radius: var(--wj-radius-lg);
        padding: 26px 24px;
        margin-bottom: 18px;
      }
      .wp-verse {
        margin: 14px 0 18px;
      }
      .wp-verse p {
        margin: 0 0 10px;
        font-size: var(--wj-fs-lg); line-height: 1.9;
        color: var(--wj-text); letter-spacing: 1px;
        text-align: center;
      }
      .wp-meta {
        text-align: center;
        border-top: 1px dashed var(--wj-border-strong);
        padding-top: 14px;
      }
      .wp-meta__title { font-size: var(--wj-fs-lg); font-weight: 700; color: var(--wj-text); }
      .wp-meta__sub { font-size: var(--wj-fs-xs); color: var(--wj-text-muted); margin-top: 4px; }

      .wp-actions { display: flex; gap: 12px; margin-top: 6px; }
      .wp-btn {
        flex: 1; border: 0; cursor: pointer;
        font: inherit; font-size: var(--wj-fs-md); font-weight: 600;
        border-radius: var(--wj-radius); padding: 15px 0;
        color: #fff; background: var(--wj-primary);
      }
      .wp-btn:active { transform: scale(.98); }
      .wp-btn--ghost { background: var(--wj-bg); color: var(--wj-primary); border: 1px solid var(--wj-primary); }

      .wp-list { display: flex; flex-direction: column; gap: 12px; }
      .wp-item {
        background: var(--wj-bg);
        border: 1px solid var(--wj-border);
        border-radius: var(--wj-radius);
        padding: 16px 18px;
        cursor: pointer;
      }
      .wp-item:active { background: var(--wj-bg-alt); }
      .wp-item__title { font-size: var(--wj-fs-md); font-weight: 700; color: var(--wj-text); }
      .wp-item__sub { font-size: var(--wj-fs-xs); color: var(--wj-text-dim); margin: 4px 0 10px; }
      .wp-item__text {
        font-size: var(--wj-fs-sm); color: var(--wj-text-muted);
        line-height: 1.7; display: -webkit-box;
        -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
      }

      .wp-state { text-align: center; color: var(--wj-text-dim); font-size: var(--wj-fs-sm); padding: 40px 0; }
      .wp-empty { color: var(--wj-text-dim); font-size: var(--wj-fs-sm); text-align: center; padding: 10px 0; }
    `,

    routes: {
      /* ===================== 首页：随机一首 + 搜索 ===================== */
      home: {
        render() {
          return `
            <div class="wp-page">
              <header class="wp-header">
                <div class="wp-header__title">吴际诗词</div>
                <div class="wp-search">
                  ${ window.WJ_IME
                    ? '<div id="wp-q" data-wj-field="1" data-wj-placeholder="搜索诗句 / 标题，如「明月」「静夜思」" tabindex="0" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>'
                    : '<input id="wp-q" type="search" placeholder="搜索诗句 / 标题，如「明月」「静夜思」" />'
                  }
                  <button id="wp-go" type="button">搜索</button>
                </div>
              </header>
              <main class="wp-body" id="wp-body">
                <div class="wp-state">加载中…</div>
              </main>
            </div>`;
        },

        mount(root, ctx) {
          let disposed = false;
          const body = () => root.querySelector('#wp-body');
          const qEl = () => root.querySelector('#wp-q');
          let loading = false;

          function buildURL() {
            return `${API}/api/poems/random`;
          }

          function showError(msg) {
            body().innerHTML = `<div class="wp-state">${esc(msg)}<br/>请检查网络后重试。</div>`;
          }

          async function load() {
            if (loading) return;
            loading = true;
            body().innerHTML = `<div class="wp-state">加载中…</div>`;
            try {
              const res = await getJSON(buildURL());
              if (disposed) return;
              const p = res && res.data;
              if (!p) { showError('没有找到诗词'); return; }
              body().innerHTML = `
                <section class="wp-feature">
                  ${renderLines(p.content)}
                  ${metaLine(p)}
                </section>
                <div class="wp-actions">
                  <button class="wp-btn" id="wp-next">换一首</button>
                </div>`;
              const next = body().querySelector('#wp-next');
              if (next) next.addEventListener('click', () => { if (!disposed) load(); });
            } catch (e) {
              if (!disposed) showError('加载失败：' + (e && e.message ? e.message : e));
            } finally {
              loading = false;
            }
          }

          function doSearch() {
            const q = (window.WJ_IME ? window.WJ_IME.getFieldText(qEl()) : qEl().value || '').trim();
            if (q.length < 3) {
              toast('搜索关键词至少需要 3 个字');
              return;
            }
            ctx.push('list', { apiURL: `${API}/api/search?q=${encodeURIComponent(q)}`, title: `“${esc(q)}” 的搜索结果` });
          }

          root.querySelector('#wp-go').addEventListener('click', doSearch);
          qEl().addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

          load();

          return () => { disposed = true; };
        },
      },

      /* ===================== 列表页：搜索 / 作者合集 ===================== */
      list: {
        render() {
          return `
            <div class="wp-page">
              <header class="wp-header" style="padding-bottom:14px">
                <div class="wp-header__title" id="wp-list-title">结果</div>
              </header>
              <main class="wp-body" id="wp-list-body">
                <div class="wp-state">加载中…</div>
              </main>
            </div>`;
        },

        mount(root, ctx) {
          let disposed = false;
          const body = root.querySelector('#wp-list-body');
          const titleEl = root.querySelector('#wp-list-title');

          function showError(msg) {
            body.innerHTML = `<div class="wp-state">${esc(msg)}<br/>请检查网络后重试。</div>`;
          }

          async function load() {
            const apiURL = ctx.data && ctx.data.apiURL;
            const title = (ctx.data && ctx.data.title) || '结果';
            titleEl.textContent = title;
            if (!apiURL) { showError('没有指定数据源'); return; }
            try {
              const res = await getJSON(apiURL);
              if (disposed) return;
              const arr = Array.isArray(res) ? res : (res && res.data) || [];
              if (!arr.length) { body.innerHTML = `<div class="wp-state">没有找到相关诗词</div>`; return; }
              body.innerHTML = `<div class="wp-list">${arr.map(itemHTML).join('')}</div>`;
              body.querySelectorAll('.wp-item').forEach(el => {
                const id = Number(el.dataset.id);
                const p = arr.find(x => Number(x.id) === id);
                if (p) el.addEventListener('click', () => openDetail(p));
              });
            } catch (e) {
              if (disposed) return;
              toast('搜索失败：' + (e && e.message ? e.message : e));
              if (ctx.pop) { try { ctx.pop(); } catch { } }
            }
          }

          function itemHTML(p) {
            const text = Array.isArray(p.content) ? p.content.join('，') : '';
            const sub = [
              p.dynasty && p.dynasty.name,
              p.type && p.type.name && p.type.name !== '其他' ? p.type.name : null,
              p.author && p.author.name,
            ].filter(Boolean).map(esc).join(' · ');
            return `
              <div class="wp-item" data-id="${p.id}">
                <div class="wp-item__title">${esc(p.title || '佚名')}</div>
                <div class="wp-item__sub">${sub}</div>
                <div class="wp-item__text">${esc(text)}</div>
              </div>`;
          }

          function openDetail(p) {
            ctx.push('detail', { poem: p });
          }

          load();
          return () => { disposed = true; };
        },
      },

      /* ===================== 详情页：单首精读 ===================== */
      detail: {
        render() {
          return `
            <div class="wp-page">
              <header class="wp-header" style="padding-bottom:14px">
                <div class="wp-header__title" id="wp-d-title">诗词</div>
              </header>
              <main class="wp-body" id="wp-d-body">
                <div class="wp-state">加载中…</div>
              </main>
            </div>`;
        },

        mount(root, ctx) {
          const body = root.querySelector('#wp-d-body');
          const titleEl = root.querySelector('#wp-d-title');
          let p = ctx.data && ctx.data.poem;

          async function ensure() {
            // 若从搜索列表带入完整对象则直接用；否则按 id 取随机再匹配不可行，仅显示已有
            if (p && p.content) return;
            if (p && p.id) {
              // 用搜索接口按标题兜底尝试获取（API 无单条 get，使用搜索兜底）
              try {
                const res = await getJSON(`${API}/api/search?q=${encodeURIComponent(p.title || '')}`);
                const arr = (res && res.data) || [];
                const hit = arr.find(x => Number(x.id) === Number(p.id));
                if (hit) p = hit;
              } catch { /* ignore */ }
            }
          }

          (async () => {
            await ensure();
            if (!p) { body.innerHTML = `<div class="wp-state">没有可显示的内容</div>`; return; }
            titleEl.textContent = p.title || '佚名';
            body.innerHTML = `
              <section class="wp-feature">
                ${renderLines(p.content)}
                ${metaLine(p)}
              </section>`;
          })();

          return () => {};
        },
      },
    },
  });
})();
