(() => {
  const BUNDLE = 'com.wujinb.aihot';
  const API_BASE = 'https://aihot.news/api/v1/items';
  const PAGE_SIZE = 30;

  const CATEGORIES = [
    { key: '', label: '全部' },
    { key: 'ai-models', label: '模型' },
    { key: 'ai-products', label: '产品' },
    { key: 'industry', label: '行业' },
    { key: 'paper', label: '论文' },
    { key: 'tip', label: '技巧' },
    { key: 'opinion', label: '观点' },
  ];

  const CAT_LABEL = {
    'ai-models': '模型',
    'ai-products': '产品',
    'industry': '行业',
    'paper': '论文',
    'tip': '技巧',
    'opinion': '观点',
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function fmtRelative(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  async function fetchItems(cat) {
    const params = new URLSearchParams({
      mode: 'selected',
      window: '7d',
      limit: String(PAGE_SIZE),
      by: 'timeline',
    });
    if (cat) params.set('category', cat);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    try {
      const res = await fetch(`${API_BASE}?${params}`, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });

      if (res.status === 429) {
        const err = new Error('RATE_LIMIT');
        err.kind = 'rate-limit';
        throw err;
      }
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.kind = 'http';
        throw err;
      }

      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } finally {
      clearTimeout(timer);
    }
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: 'AI新闻',
    icon: './assets/aihot.svg',
    version: '1.0.7',
    initialRoute: 'home',

    styles: `
      .ai-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }

      .ai-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 17px 22px 11px;
        gap: 14px;
      }

      .ai-title {
        font-size: var(--wj-fs-2xl);
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
      }

      .ai-refresh {
        flex: 0 0 auto;
        padding: 8px 20px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 1399px;
        background: var(--wj-bg-alt);
        color: var(--wj-text-muted);
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 500;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .ai-refresh:active { background: #dae2f0; }
      .ai-refresh:disabled { opacity: .5; cursor: default; }

      .ai-cats {
        flex: 0 0 auto;
        display: flex;
        gap: 11px;
        padding: 6px 22px 11px;
        overflow-x: auto;
        touch-action: pan-y;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        user-select: none;
        -webkit-user-select: none;
        cursor: grab;
      }
      .ai-cats::-webkit-scrollbar { display: none; }
      .ai-cats.is-dragging { cursor: grabbing; }
      .ai-cat { user-select: none; -webkit-user-select: none; }

      .ai-cat {
        flex: 0 0 auto;
        padding: 8px 20px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 1399px;
        background: transparent;
        color: var(--wj-text-muted);
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;
        transition: background .15s, color .15s, border-color .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .ai-cat:active { transform: scale(.96); }
      .ai-cat.is-active {
        background: var(--wj-primary);
        border-color: var(--wj-primary);
        color: #fff;
      }

      .ai-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 0 22px 22px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .ai-card {
        padding: 20px;
        border-radius: 20px;
        background: var(--wj-bg-alt);
        cursor: pointer;
        transition: transform .08s, background .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .ai-card:active {
        transform: scale(.985);
        background: #dae2f0;
      }

      /* ★ 关键修复：不允许换行，分类 chip 不被压缩，源名称溢出省略 */
      .ai-card__meta {
        display: flex;
        align-items: center;
        gap: 11px;
        font-size: var(--wj-fs-md);
        color: var(--wj-text-dim);
        margin-bottom: 8px;
        flex-wrap: nowrap;
        overflow: hidden;
      }

      .ai-card__cat {
        flex: 0 0 auto;
        padding: 3px 11px;
        border-radius: 1399px;
        background: rgba(58, 111, 240, .10);
        color: var(--wj-primary);
        font-size: var(--wj-fs-md);
        font-weight: 500;
        white-space: nowrap;
      }

      .ai-card__src {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ai-card__time {
        flex: 0 0 auto;
        white-space: nowrap;
      }

      .ai-card__dot {
        flex: 0 0 auto;
        opacity: .5;
      }

      .ai-card__title {
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        color: var(--wj-text);
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin-bottom: 8px;
        word-break: break-word;
      }

      .ai-card__summary {
        font-size: var(--wj-fs-md);
        color: var(--wj-text-muted);
        line-height: 1.6;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-word;
      }

      .ai-state {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        padding: 56px 34px;
        text-align: center;
      }
      .ai-spinner {
        width: 45px;
        height: 45px;
        border-radius: 50%;
        border: 4px solid var(--wj-border-strong, #c9d3e6);
        border-top-color: var(--wj-primary);
        animation: aiSpin .85s linear infinite;
      }
      @keyframes aiSpin { to { transform: rotate(360deg); } }
      .ai-state__text {
        font-size: var(--wj-fs-lg);
        color: var(--wj-text-muted);
        line-height: 1.6;
      }
      .ai-state__retry {
        padding: 14px 34px;
        border: 0;
        border-radius: 1399px;
        background: var(--wj-primary);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      /* 详情页 */
      .ai-detail {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
      }

      .ai-detail__scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 22px 25px calc(34px + env(safe-area-inset-bottom, 0px));
        padding-top: calc(22px + var(--statusbar-h));
      }

      .ai-detail__meta {
        display: flex;
        align-items: center;
        gap: 11px;
        font-size: var(--wj-fs-md);
        color: var(--wj-text-dim);
        margin-bottom: 17px;
        flex-wrap: nowrap;
        overflow: hidden;
      }

      .ai-detail__title {
        font-size: var(--wj-fs-2xl);
        font-weight: 700;
        color: var(--wj-text);
        line-height: 1.45;
        letter-spacing: .2px;
        margin-bottom: 22px;
        word-break: break-word;
      }

      .ai-detail__label {
        font-size: var(--wj-fs-md);
        font-weight: 600;
        color: var(--wj-text-muted);
        letter-spacing: .3px;
        margin-bottom: 11px;
      }

      .ai-detail__summary {
        font-size: var(--wj-fs-lg);
        color: var(--wj-text);
        line-height: 1.75;
        margin-bottom: 25px;
        word-break: break-word;
        white-space: pre-wrap;
      }

      .ai-detail__reason {
        padding: 17px 20px;
        border-radius: 17px;
        background: var(--wj-bg-alt);
        font-size: var(--wj-fs-md);
        line-height: 1.7;
        color: var(--wj-text-muted);
        margin-bottom: 11px;
        border-left: 4px solid var(--wj-primary);
        word-break: break-word;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="ai-page">
              <div class="ai-header">
                <span class="ai-title">AI 速览</span>
                <button class="ai-refresh" id="aiRefresh" type="button">刷新</button>
              </div>
              <div class="ai-cats" id="aiCats"></div>
              <div class="ai-list" id="aiList"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          try { AppStorage.for(BUNDLE).clear().catch(() => {}); } catch {}

          const listEl = root.querySelector('#aiList');
          const catsEl = root.querySelector('#aiCats');
          const refreshBtn = root.querySelector('#aiRefresh');

          let currentCat = '';
          let items = [];
          let loading = false;
          let disposed = false;

          function renderCats() {
            catsEl.innerHTML = CATEGORIES.map(c => `
              <button class="ai-cat ${c.key === currentCat ? 'is-active' : ''}"
                      data-cat="${esc(c.key)}" type="button">${esc(c.label)}</button>
            `).join('');

            catsEl.querySelectorAll('.ai-cat').forEach(el => {
              el.addEventListener('click', () => {
                if (drag.moved) { drag.reset(); return; }
                const cat = el.dataset.cat;
                if (cat === currentCat) return;
                currentCat = cat;
                renderCats();
                load();
                if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
              });
            });
          }

          function renderLoading() {
            listEl.innerHTML = `
              <div class="ai-state">
                <div class="ai-spinner"></div>
                <div class="ai-state__text">正在获取 AI 资讯…</div>
              </div>
            `;
          }

          function renderError(msg) {
            listEl.innerHTML = `
              <div class="ai-state">
                <div class="ai-state__text">${esc(msg)}</div>
                <button class="ai-state__retry" id="aiRetry" type="button">重试</button>
              </div>
            `;
            listEl.querySelector('#aiRetry')?.addEventListener('click', () => load());
          }

          function renderList() {
            if (!items.length) {
              renderError('暂无内容，请稍后刷新');
              return;
            }

            listEl.innerHTML = items.map((item, idx) => {
              const catLabel = CAT_LABEL[item.category] || '资讯';
              const src = item.source?.name || '';
              const time = fmtRelative(item.publishedAt);

              return `
                <div class="ai-card" data-idx="${idx}">
                  <div class="ai-card__meta">
                    <span class="ai-card__cat">${esc(catLabel)}</span>
                    ${src ? `<span class="ai-card__src">${esc(src)}</span>` : ''}
                    ${time ? `<span class="ai-card__dot">·</span><span class="ai-card__time">${esc(time)}</span>` : ''}
                  </div>
                  <div class="ai-card__title">${esc(item.title || '')}</div>
                  ${item.summary ? `<div class="ai-card__summary">${esc(item.summary)}</div>` : ''}
                </div>
              `;
            }).join('');

            listEl.querySelectorAll('.ai-card').forEach(el => {
              el.addEventListener('click', () => {
                const idx = +el.dataset.idx;
                const item = items[idx];
                if (!item) return;
                if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
                ctx.push('detail', { item });
              });
            });
          }

          async function load() {
            if (loading || disposed) return;
            loading = true;
            refreshBtn.disabled = true;
            renderLoading();

            try {
              const list = await fetchItems(currentCat);
              if (disposed) return;
              items = list;
              renderList();
            } catch (e) {
              if (disposed) return;
              console.warn('[aihot] 加载失败', e);

              let msg = '加载失败，请检查网络';
              if (e.name === 'AbortError') msg = '请求超时，请重试';
              else if (e.kind === 'rate-limit') msg = '请求太频繁，请稍后再试';
              else if (e.kind === 'http') msg = '服务暂时不可用';

              renderError(msg);
            } finally {
              loading = false;
              refreshBtn.disabled = false;
            }
          }

          refreshBtn.addEventListener('click', () => {
            if (loading) return;
            load();
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
          });

          const drag = (() => {
            const MOVE_THRESHOLD = 4;
            let startX = 0, startY = 0, startLeft = 0;
            let moved = false;
            let active = false;
            let touchId = null;
            let mouseDown = false;

            function begin(x, y) {
              startX = x; startY = y;
              startLeft = catsEl.scrollLeft;
              moved = false; active = true;
              catsEl.classList.add('is-dragging');
            }
            function move(x, y, canPrevent, e) {
              if (!active) return;
              const dx = x - startX, dy = y - startY;
              if (!moved) {
                if (Math.abs(dx) < MOVE_THRESHOLD && Math.abs(dy) < MOVE_THRESHOLD) return;
                if (Math.abs(dy) > Math.abs(dx)) { end(); return; }
                moved = true;
              }
              if (canPrevent && e.cancelable) e.preventDefault();
              catsEl.scrollLeft = startLeft - dx;
            }
            function end() {
              if (!active) return;
              active = false; touchId = null;
              catsEl.classList.remove('is-dragging');
              if (moved) setTimeout(() => { moved = false; }, 0);
            }

            function onTouchStart(e) {
              e.stopPropagation();
              const t = e.changedTouches[0];
              if (!t) return;
              touchId = t.identifier;
              begin(t.clientX, t.clientY);
            }
            function onTouchMove(e) {
              e.stopPropagation();
              if (!active) return;
              const t = Array.from(e.changedTouches).find(x => x.identifier === touchId);
              if (!t) return;
              move(t.clientX, t.clientY, true, e);
            }
            function onTouchEnd(e) {
              e.stopPropagation();
              if (active) end();
            }
            function onMouseDown(e) {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              mouseDown = true;
              begin(e.clientX, e.clientY);
            }
            function onMouseMove(e) {
              if (!mouseDown) return;
              move(e.clientX, e.clientY, true, e);
            }
            function onMouseUp() {
              if (!mouseDown) return;
              mouseDown = false;
              end();
            }

            catsEl.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
            catsEl.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
            catsEl.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
            catsEl.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: false });
            catsEl.addEventListener('mousedown', onMouseDown, { capture: true });
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            return {
              get moved() { return moved; },
              reset() { moved = false; },
              destroy() {
                catsEl.removeEventListener('touchstart', onTouchStart, true);
                catsEl.removeEventListener('touchmove', onTouchMove, true);
                catsEl.removeEventListener('touchend', onTouchEnd, true);
                catsEl.removeEventListener('touchcancel', onTouchEnd, true);
                catsEl.removeEventListener('mousedown', onMouseDown, true);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              },
            };
          })();
          renderCats();
          load();

          return () => {
            disposed = true;
            drag.destroy();
          };
        },
      },

      detail: {
        name: 'detail',

        render(routeCtx) {
          const item = routeCtx.data?.item;
          if (!item) {
            return `<div class="ai-page"><div class="ai-state"><div class="ai-state__text">内容不存在</div></div></div>`;
          }

          const catLabel = CAT_LABEL[item.category] || '资讯';
          const src = item.source?.name || '';
          const time = fmtRelative(item.publishedAt);

          return `
            <div class="ai-detail">
              <div class="ai-detail__scroll">
                <div class="ai-detail__meta">
                  <span class="ai-card__cat">${esc(catLabel)}</span>
                  ${src ? `<span class="ai-card__src">${esc(src)}</span>` : ''}
                  ${time ? `<span class="ai-card__dot">·</span><span class="ai-card__time">${esc(time)}</span>` : ''}
                </div>

                <div class="ai-detail__title">${esc(item.title || '')}</div>

                ${item.summary ? `
                  <div class="ai-detail__label">摘要</div>
                  <div class="ai-detail__summary">${esc(item.summary)}</div>
                ` : ''}

                ${item.reason ? `
                  <div class="ai-detail__label">推荐理由</div>
                  <div class="ai-detail__reason">${esc(item.reason)}</div>
                ` : ''}
              </div>
            </div>
          `;
        },
      },
    },
  });
})();