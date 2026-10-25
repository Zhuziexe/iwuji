(() => {
  const BUNDLE = 'com.wujinb.wujiquan';
  const API = 'https://wujiquan.pages.dev';
  const REQUEST_TIMEOUT = 10000;

  let reloadHome = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  async function fetchPosts() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
    try {
      const res = await fetch(API + '/api/posts', {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function createPost(name, content) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
    try {
      const res = await fetch(API + '/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际圈',
    icon: './assets/wujiquan.svg',
    initialRoute: 'home',
    version: '1.0.2',

    styles: `
      .wq-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }

      .wq-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 11px 20px 8px;
      }
      .wq-compose-btn {
        flex: 0 0 auto;
        height: 48px;
        padding: 0 22px;
        border: 0;
        border-radius: 14px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .wq-compose-btn:active { filter: brightness(.92); transform: scale(.97); }

      .wq-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 6px 17px 17px;
        display: flex;
        flex-direction: column;
        gap: 11px;
      }

      .wq-post {
        flex: 0 0 auto;
        background: var(--wj-bg-alt);
        border-radius: 17px;
        padding: 14px 17px;
      }
      .wq-post__head {
        display: flex;
        align-items: baseline;
        gap: 11px;
        margin-bottom: 6px;
        min-width: 0;
      }
      .wq-name {
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        color: var(--wj-primary, #3a6ff0);
        flex: 0 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wq-time {
        font-size: var(--wj-fs-md);
        color: var(--wj-text-dim);
        flex: 0 0 auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .wq-content {
        font-size: var(--wj-fs-lg);
        line-height: 1.55;
        color: var(--wj-text);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .wq-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        padding: 70px 28px;
        text-align: center;
        font-size: var(--wj-fs-lg);
        color: var(--wj-text-muted);
        line-height: 1.6;
      }
      .wq-spinner {
        width: 39px;
        height: 39px;
        border-radius: 50%;
        border: 4px solid var(--wj-border, #e6e9ef);
        border-top-color: var(--wj-primary, #3a6ff0);
        animation: wq-spin .85s linear infinite;
      }
      @keyframes wq-spin { to { transform: rotate(360deg); } }
      .wq-retry {
        padding: 14px 34px;
        border: 0;
        border-radius: 1399px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      /* ============ 发帖页 ============ */
      .wq-compose {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
      }
      .wq-compose__header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 11px;
        padding: 11px 17px;
      }
      .wq-compose__title {
        font-size: var(--wj-fs-xl);
        font-weight: 600;
        color: var(--wj-text);
      }

      .wq-submit {
        flex: 0 0 auto;
        height: 48px;
        padding: 0 22px;
        border: 0;
        border-radius: 14px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .wq-submit:active:not(:disabled) { filter: brightness(.92); transform: scale(.97); }
      .wq-submit:disabled { opacity: .45; cursor: not-allowed; }

      .wq-compose__body {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 6px 17px 17px;
      }

      .wq-input,
      .wq-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 14px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: var(--wj-fs-lg);
        outline: none;
        padding: 14px 17px;
        -webkit-appearance: none;
        appearance: none;
      }
      .wq-input:focus,
      .wq-textarea:focus { border-color: var(--wj-primary, #3a6ff0); }
      .wq-input::placeholder,
      .wq-textarea::placeholder { color: var(--wj-text-dim); }

      .wq-input { flex: 0 0 auto; height: 62px; }

      .wq-textarea {
        flex: 1 1 auto;
        min-height: 140px;
        resize: none;
        line-height: 1.5;
      }

      .wq-msg {
        flex: 0 0 auto;
        font-size: var(--wj-fs-sm);
        color: #c0392b;
        min-height: 25px;
        padding: 0 3px;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="wq-page">
              <div class="wq-header">
                <h2 class="wj-title">吴际圈</h2>
                <button class="wq-compose-btn" id="wqComposeBtn" type="button">发帖</button>
              </div>
              <div class="wq-list" id="wqList">
                <div class="wq-state">
                  <div class="wq-spinner"></div>
                  <div>正在加载…</div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const listEl = root.querySelector('#wqList');
          const composeBtn = root.querySelector('#wqComposeBtn');

          let disposed = false;

          function renderLoading() {
            listEl.innerHTML = `
              <div class="wq-state">
                <div class="wq-spinner"></div>
                <div>正在加载…</div>
              </div>
            `;
          }

          function renderEmpty() {
            listEl.innerHTML = `
              <div class="wq-state">
                <div>还没有内容，点右上角发第一帖吧</div>
              </div>
            `;
          }

          function renderError(msg) {
            listEl.innerHTML = `
              <div class="wq-state">
                <div>${escapeHtml(msg)}</div>
                <button class="wq-retry" id="wqRetry" type="button">重试</button>
              </div>
            `;
            const retry = listEl.querySelector('#wqRetry');
            if (retry) retry.addEventListener('click', load);
          }

          function renderPosts(posts) {
            if (!Array.isArray(posts) || posts.length === 0) {
              renderEmpty();
              return;
            }
            listEl.innerHTML = posts.map(p => `
              <div class="wq-post">
                <div class="wq-post__head">
                  <span class="wq-name">${escapeHtml(p.name || '匿名')}</span>
                  <span class="wq-time">${escapeHtml(p.created_at || '')}</span>
                </div>
                <div class="wq-content">${escapeHtml(p.content || '')}</div>
              </div>
            `).join('');
          }

          async function load() {
            if (disposed) return;
            renderLoading();
            try {
              const posts = await fetchPosts();
              if (disposed) return;
              renderPosts(posts);
            } catch (e) {
              if (disposed) return;
              if (e.name === 'AbortError') {
                renderError('请求超时，请重试');
              } else {
                renderError('加载失败：' + (e.message || '网络错误'));
              }
            }
          }

          composeBtn.addEventListener('click', () => {
            ctx.push('compose');
          });

          reloadHome = load;
          load();

          return () => {
            disposed = true;
            if (reloadHome === load) reloadHome = null;
          };
        },
      },

      compose: {
        name: 'compose',
        transition: 'slide',

        render() {
          const savedName = Store.get('wujiquan.name', '');
          return `
            <div class="wq-compose">
              <div class="wq-compose__header">
                <div class="wq-compose__title">发帖</div>
                <button class="wq-submit" id="wqSubmit" type="button">发布</button>
              </div>
              <div class="wq-compose__body">
                <input class="wq-input" id="wqName" placeholder="用户名" maxlength="30"
                       value="${escapeHtml(savedName)}" autocomplete="off"
                       autocorrect="off" autocapitalize="off" spellcheck="false" />
                <textarea class="wq-textarea" id="wqContent" placeholder="说点什么…"
                          maxlength="500"></textarea>
                <div class="wq-msg" id="wqMsg"></div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const submitBtn = root.querySelector('#wqSubmit');
          const nameEl = root.querySelector('#wqName');
          const contentEl = root.querySelector('#wqContent');
          const msgEl = root.querySelector('#wqMsg');

          let disposed = false;
          let submitting = false;

          function updateSubmitState() {
            const ok = nameEl.value.trim() && contentEl.value.trim() && !submitting;
            submitBtn.disabled = !ok;
          }

          nameEl.addEventListener('input', updateSubmitState);
          contentEl.addEventListener('input', updateSubmitState);
          updateSubmitState();

          submitBtn.addEventListener('click', async () => {
            if (submitting || disposed) return;

            const name = nameEl.value.trim();
            const content = contentEl.value.trim();
            if (!name || !content) {
              msgEl.textContent = '用户名和内容不能为空';
              return;
            }

            submitting = true;
            updateSubmitState();
            msgEl.textContent = '发布中…';
            msgEl.style.color = 'var(--wj-text-muted, #999)';

            try {
              const data = await createPost(name, content);
              if (disposed) return;

              if (data && data.success) {
                Store.set('wujiquan.name', name);
                if (typeof reloadHome === 'function') {
                  try { reloadHome(); } catch { }
                }
                ctx.pop();
              } else {
                msgEl.textContent = (data && data.error) || '发布失败';
                msgEl.style.color = '#c0392b';
                submitting = false;
                updateSubmitState();
              }
            } catch (e) {
              if (disposed) return;
              if (e.name === 'AbortError') {
                msgEl.textContent = '请求超时，请重试';
              } else {
                msgEl.textContent = '发布失败：' + (e.message || '网络错误');
              }
              msgEl.style.color = '#c0392b';
              submitting = false;
              updateSubmitState();
            }
          });

          return () => { disposed = true; };
        },
      },
    },
  });
})();