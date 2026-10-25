(() => {
  const BUNDLE = 'com.wujinb.news';
  const API_URL = 'https://xiaoapi.cn/v1/zs_xw.php';
  const ICON_URL = './assets/news.svg';
  const LOADING_URL = './assets/loading.png';
  const REQUEST_TIMEOUT = 10000;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function fmtHot(v) {
    if (v == null || v === '') return '';
    const str = String(v).trim();
    const n = Number(str.replace(/[^\d.]/g, ''));
    if (!isFinite(n) || n <= 0) return str;
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return String(Math.round(n));
  }

  function normalize(data) {
    if (!data || typeof data !== 'object') return [];
    const arr =
      (Array.isArray(data.data) && data.data) ||
      (Array.isArray(data.list) && data.list) ||
      (Array.isArray(data.news) && data.news) ||
      (Array.isArray(data.result) && data.result) ||
      (Array.isArray(data.items) && data.items) ||
      null;
    if (!arr) return [];

    return arr.map(item => {
      if (!item || typeof item !== 'object') return null;
      const title = String(
        item.title || item.name || item.content || item.text || ''
      ).trim();
      if (!title) return null;
      return {
        title,
        hot: item.hotValue || item.hot || item.heat || item.hotNum || item.score || '',
        img: item.img || item.image || item.pic || item.cover || item.thumbnail || '',
        url: item.url || item.link || item.href || '',
      };
    }).filter(Boolean);
  }

  /* 从触发元素向上找最近的带图片的卡片 / 卡片本身，作为 zoom 起点 */
  function findOriginElement(el, container) {
    let node = el;
    while (node && node !== container) {
      if (node.classList && (node.classList.contains('nw-thumb') || node.classList.contains('nw-item'))) {
        return node;
      }
      node = node.parentElement;
    }
    return el;
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '牛逼新闻',
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.0.3',

    styles: `
      .nw-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }

      .nw-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        padding: 11px 20px 8px;
      }
      .nw-title {
        font-size: var(--wj-fs-2xl);
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
      }

      .nw-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 0 20px 22px;
      }

      .nw-list {
        display: flex;
        flex-direction: column;
        gap: 11px;
      }

      .nw-item {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 17px 17px;
        border-radius: 20px;
        background: var(--wj-bg-alt);
        cursor: pointer;
        transition: transform .08s, background .15s, opacity .2s;
        -webkit-tap-highlight-color: transparent;
      }
      .nw-item:active { transform: scale(.985); background: #dae2f0; }
      .nw-item.is-read { opacity: .55; }

      .nw-rank {
        flex: 0 0 31px;
        width: 31px;
        padding-top: 1px;
        font-size: var(--wj-fs-lg);
        font-weight: 700;
        text-align: center;
        color: var(--wj-text-dim);
        font-variant-numeric: tabular-nums;
      }
      .nw-rank--1 { color: #e0356b; }
      .nw-rank--2 { color: #ff6b35; }
      .nw-rank--3 { color: #ff9500; }

      .nw-main {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .nw-item__title {
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        line-height: 1.42;
        color: var(--wj-text);
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .nw-item__hot {
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-dim);
        font-variant-numeric: tabular-nums;
        letter-spacing: .3px;
      }

      .nw-thumb {
        flex: 0 0 90px;
        width: 90px;
        height: 90px;
        border-radius: 14px;
        overflow: hidden;
        background: var(--wj-bg);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .nw-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .nw-meta {
        flex: 0 0 auto;
        text-align: center;
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-dim);
        padding: 17px 6px 3px;
        letter-spacing: .3px;
      }

      /* ---------- 详情页 ---------- */
      .nw-detail {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
      }
      .nw-detail__scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding-bottom: 34px;
      }

      .nw-detail__hero {
        width: 100%;
        height: 280px;
        background: var(--wj-bg-alt);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-top: var(--statusbar-h);
        box-sizing: border-box;
      }
      .nw-detail__hero img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .nw-detail__hero.is-empty {
        background: linear-gradient(135deg, #e0356b, #922b21);
        color: #fff;
        font-size: 78px;
      }

      .nw-detail__body {
        padding: 25px 25px 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .nw-detail__title {
        font-size: var(--wj-fs-3xl);
        font-weight: 700;
        line-height: 1.42;
        color: var(--wj-text);
        letter-spacing: .3px;
        word-break: break-word;
        margin-top: 3px;
      }
      .nw-detail__hot {
        font-size: var(--wj-fs-md);
        color: var(--wj-text-dim);
        font-variant-numeric: tabular-nums;
        letter-spacing: .3px;
      }

      /* 状态 */
      .nw-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        padding: 84px 34px;
        text-align: center;
      }
      .nw-spinner {
        width: 90px;
        height: 90px;
        border-radius: 50%;
        overflow: hidden;
        object-fit: cover;
        display: block;
        animation: nw-spin .9s linear infinite;
        will-change: transform;
      }
      @keyframes nw-spin { to { transform: rotate(360deg); } }
      .nw-state__text {
        font-size: var(--wj-fs-md);
        color: var(--wj-text-muted);
        line-height: 1.6;
      }
      .nw-state__retry {
        padding: 14px 34px;
        border: 0;
        border-radius: 1399px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="nw-page">
              <div class="nw-header">
                <div class="nw-title">牛逼新闻</div>
              </div>
              <div class="nw-body" id="nwBody">
                <div class="nw-state">
                  <img class="nw-spinner" src="${LOADING_URL}" alt="">
                  <div class="nw-state__text">正在获取新闻…</div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const bodyEl = root.querySelector('#nwBody');

          let disposed = false;
          let news = [];
          let lastUpdated = 0;
          const readSet = new Set();

          async function fetchNews() {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
            try {
              const res = await fetch(`${API_URL}?t=${Date.now()}`, {
                signal: ctrl.signal,
                cache: 'no-store',
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              let data = null;
              try { data = await res.json(); } catch { }
              return normalize(data);
            } finally {
              clearTimeout(timer);
            }
          }

          function renderError(msg) {
            bodyEl.innerHTML = `
              <div class="nw-state">
                <div class="nw-state__text">${escapeHtml(msg)}</div>
                <button class="nw-state__retry" id="nwRetryBtn" type="button">重试</button>
              </div>
            `;
            const retry = bodyEl.querySelector('#nwRetryBtn');
            if (retry) retry.addEventListener('click', () => load());
          }

          function fmtTime(ts) {
            const d = new Date(ts);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          }

          function renderList() {
            const itemsHtml = news.map((item, i) => {
              const rank = i + 1;
              const rankCls = rank <= 3 ? `nw-rank--${rank}` : '';
              const isRead = readSet.has(item.title);
              const hotText = fmtHot(item.hot);
              const hotHtml = hotText ? `<div class="nw-item__hot">🔥 ${escapeHtml(hotText)}</div>` : '';
              const thumbHtml = item.img
                ? `<div class="nw-thumb"><img src="${escapeHtml(item.img)}" alt="" loading="lazy"></div>`
                : '';
              return `
                <div class="nw-item ${isRead ? 'is-read' : ''}" data-idx="${i}">
                  <div class="nw-rank ${rankCls}">${rank}</div>
                  <div class="nw-main">
                    <div class="nw-item__title">${escapeHtml(item.title)}</div>
                    ${hotHtml}
                  </div>
                  ${thumbHtml}
                </div>
              `;
            }).join('');

            const meta = lastUpdated
              ? `<div class="nw-meta">更新于 ${fmtTime(lastUpdated)}</div>`
              : '';

            bodyEl.innerHTML = `
              <div class="nw-list">${itemsHtml}</div>
              ${meta}
            `;

            bodyEl.querySelectorAll('.nw-thumb img').forEach(img => {
              img.addEventListener('error', () => {
                const box = img.parentElement;
                if (box) box.style.display = 'none';
              }, { once: true });
            });

            bodyEl.querySelectorAll('.nw-item').forEach(el => {
              el.addEventListener('click', () => {
                const idx = Number(el.dataset.idx);
                const item = news[idx];
                if (!item) return;

                if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }

                // 标记已读
                if (!readSet.has(item.title)) {
                  readSet.add(item.title);
                  el.classList.add('is-read');
                }

                // 找 zoom 起点：优先缩略图，没有缩略图就用卡片本身
                const originEl = findOriginElement(el, bodyEl);
                const rect = originEl.getBoundingClientRect();

                ctx.push('detail', { item }, {
                  transition: 'zoom',
                  origin: {
                    x: rect.left,
                    y: rect.top,
                    w: rect.width,
                    h: rect.height,
                  },
                });
              });
            });
          }

          async function load() {
            if (disposed) return;
            bodyEl.innerHTML = `
              <div class="nw-state">
                <img class="nw-spinner" src="${LOADING_URL}" alt="">
                <div class="nw-state__text">正在获取新闻…</div>
              </div>
            `;

            try {
              const list = await fetchNews();
              if (disposed) return;

              news = list;
              lastUpdated = Date.now();

              if (!news.length) {
                renderError('暂无新闻数据');
              } else {
                renderList();
              }
            } catch (e) {
              if (disposed) return;
              console.warn('[news] fetch 失败', e);
              renderError(e.name === 'AbortError' ? '请求超时，请重试' : '网络异常，请检查后重试');
            }
          }

          load();

          return () => { disposed = true; };
        },
      },

      detail: {
        name: 'detail',
        transition: 'zoom',

        render(routeCtx) {
          const item = routeCtx.data?.item;
          if (!item) {
            return `<div class="nw-page"><div class="nw-state"><div class="nw-state__text">新闻不存在</div></div></div>`;
          }

          const hotText = fmtHot(item.hot);

          return `
            <div class="nw-detail">
              <div class="nw-detail__scroll">
                <div class="nw-detail__hero ${item.img ? '' : 'is-empty'}" id="nwHero">
                  ${item.img ? `<img src="${escapeHtml(item.img)}" alt="">` : '📰'}
                </div>
                <div class="nw-detail__body">
                  <div class="nw-detail__title">${escapeHtml(item.title)}</div>
                  ${hotText ? `<div class="nw-detail__hot">🔥 ${escapeHtml(hotText)}</div>` : ''}
                </div>
              </div>
            </div>
          `;
        },

        mount(root) {
          const heroEl = root.querySelector('#nwHero');
          const img = heroEl?.querySelector('img');
          if (img) {
            img.addEventListener('error', () => {
              heroEl.classList.add('is-empty');
              heroEl.innerHTML = '📰';
            }, { once: true });
          }
        },
      },
    },
  });
})();