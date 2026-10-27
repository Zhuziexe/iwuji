(() => {
  // ==================== 常量 ====================
  const BUNDLE = 'com.wujinb.wujibili';
  const PROXY = 'https://api.cors.lol/?url=';
  const API_RCMD = 'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd';
  const API_SEARCH = 'https://api.bilibili.com/x/web-interface/wbi/search/type';
  const PS = 12;
  const KEY_TTL = 3600 * 1000;
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // ==================== WBI 签名 ====================
  const mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
  ];

  function getMixinKey(orig) {
    return mixinKeyEncTab.map(n => orig[n]).join('').slice(0, 32);
  }

  function encWbi(params, img_key, sub_key) {
    const mixin_key = getMixinKey(img_key + sub_key);
    const wts = Math.round(Date.now() / 1000);
    Object.assign(params, { wts });
    const query = Object.keys(params).sort().map(key => {
      const value = String(params[key]).replace(/[!'()*]/g, '');
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }).join('&');
    const sign = md5(query + mixin_key);
    return query + '&w_rid=' + sign;
  }

  // ==================== 密钥获取 ====================
  let wbiKeysCache = { keys: null, at: 0 };

  async function fetchJson(url, opts = {}) {
    const res = await fetch(PROXY + url, {
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': UA,
        ...(opts.headers || {})
      }
    });
    if (res.status === 412) throw new Error('IP 风控 (412)');
    if (res.status === 429) throw new Error('请求过于频繁 (429)');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('响应非 JSON（可能触发了风控）');
    }
  }

  async function getWbiKeys(force = false) {
    if (!force && wbiKeysCache.keys && Date.now() - wbiKeysCache.at < KEY_TTL) {
      return wbiKeysCache.keys;
    }
    const json = await fetchJson('https://api.bilibili.com/x/web-interface/nav');
    const wbiImg = json.data?.wbi_img;
    if (!wbiImg?.img_url || !wbiImg?.sub_url) {
      throw new Error(`无法获取密钥: ${json.message || ''}`);
    }
    const keys = {
      img_key: wbiImg.img_url.slice(wbiImg.img_url.lastIndexOf('/') + 1, wbiImg.img_url.lastIndexOf('.')),
      sub_key: wbiImg.sub_url.slice(wbiImg.sub_url.lastIndexOf('/') + 1, wbiImg.sub_url.lastIndexOf('.')),
    };
    wbiKeysCache = { keys, at: Date.now() };
    return keys;
  }

  // ==================== 工具 ====================
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function formatNum(n) {
    n = Number(n) || 0;
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return String(n);
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际哔哩',
    icon: './assets/wujibili.svg',
    initialRoute: 'home',
    version: '1.0.2',

    styles: `
      .bli-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg, #f1f2f3);
      }

      /* ==================== 顶部 ==================== */
      .bli-header {
        flex-shrink: 0;
        padding: 10px 12px 8px;
        padding-top: calc(10px + var(--statusbar-h, 20px));
        background: var(--wj-bg, #f1f2f3);
        border-bottom: 1px solid var(--wj-border, #e6e9ef);
      }

      .bli-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }

      .bli-refresh {
        flex-shrink: 0;
        min-height: 42px;
        padding: 0 18px;
        border: 0;
        border-radius: 10px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font-family: inherit;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .bli-refresh:active:not(:disabled) { opacity: .7; }
      .bli-refresh:disabled { opacity: .5; cursor: not-allowed; }

      .bli-search-row {
        display: flex;
        gap: 8px;
      }

      .bli-input {
        flex: 1;
        min-width: 0;
        min-height: 42px;
        padding: 0 12px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 10px;
        background: var(--wj-bg-alt, #fff);
        color: var(--wj-text, #18191c);
        font-family: inherit;
        font-size: 16px;
        outline: none;
        transition: border-color .15s;
      }
      .bli-input:focus { border-color: var(--wj-primary, #3a6ff0); }

      .bli-search-btn,
      .bli-clear-btn {
        flex-shrink: 0;
        min-height: 42px;
        padding: 0 14px;
        border: 0;
        border-radius: 10px;
        font-family: inherit;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bli-search-btn {
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
      }
      .bli-search-btn:active:not(:disabled) { opacity: .7; }
      .bli-search-btn:disabled { opacity: .5; cursor: not-allowed; }

      .bli-clear-btn {
        background: var(--wj-bg-alt, #e6e9ef);
        color: var(--wj-text-muted, #61666d);
        padding: 0 12px;
      }

      /* ==================== 列表 ==================== */
      .bli-feed {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 10px 12px 16px;
      }

      .bli-card {
        display: flex;
        gap: 12px;
        padding: 10px;
        margin-bottom: 10px;
        border-radius: 12px;
        background: var(--wj-bg-alt, #fff);
        cursor: pointer;
        transition: transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .bli-card:active { transform: scale(.98); }

      .bli-cover {
        width: 120px;
        height: 72px;
        object-fit: cover;
        border-radius: 10px;
        flex-shrink: 0;
        background: var(--wj-border, #ddd);
      }

      .bli-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 2px 0;
      }

      .bli-card-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--wj-text, #18191c);
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .bli-meta {
        display: flex;
        gap: 10px;
        font-size: 16px;
        color: var(--wj-text-dim, #9499a0);
        overflow: hidden;
        font-weight: 500;
      }
      .bli-meta span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bli-meta span:first-child {
        flex: 1;
        min-width: 0;
      }

      /* ==================== 状态 ==================== */
      .bli-loading,
      .bli-error,
      .bli-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 16px;
        color: var(--wj-text-muted, #61666d);
        font-size: 16px;
        text-align: center;
        gap: 14px;
      }
      .bli-error { color: var(--wj-danger, #e0356b); }

      .bli-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(58, 111, 240, .18);
        border-top-color: var(--wj-primary, #3a6ff0);
        border-radius: 50%;
        animation: bli-spin .8s linear infinite;
        box-sizing: border-box;
      }
      @keyframes bli-spin { to { transform: rotate(360deg); } }

      .bli-player-page {
        position: absolute;
        inset: 0;
        background: #000;
      }

      .bli-player-frame {
        position: absolute;
        top: var(--statusbar-h, 20px);
        left: 0;
        width: 100%;
        height: calc(100% - var(--statusbar-h, 20px));
        border: none;
        display: block;
        background: #000;
      }

      .bli-player-close {
        position: absolute;
        top: calc(10px + var(--statusbar-h, 20px));
        left: 10px;
        z-index: 20;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: rgba(0, 0, 0, .6);
        color: #fff;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
      }
      .bli-player-close:active { background: rgba(0, 0, 0, .85); }

      .bli-player-error {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 16px;
      }
    `,

    routes: {
      // ==================== 首页（推荐 + 搜索） ====================
      home: {
        name: 'home',

        render() {
          return `
            <div class="bli-page">
              <div class="bli-header">
                <div class="bli-title-row">
                  <div class="wj-title" id="bliTitle">吴际哔哩</div>
                  <button class="bli-refresh" id="bliRefresh" type="button">刷新</button>
                </div>
                <div class="bli-search-row">
                  <input class="bli-input" id="bliSearchInput" type="text"
                         placeholder="搜索视频..." autocomplete="off" />
                  <button class="bli-search-btn" id="bliSearchBtn" type="button">搜索</button>
                  <button class="bli-clear-btn" id="bliClearBtn" type="button" hidden>✕</button>
                </div>
              </div>
              <div class="bli-feed" id="bliFeed">
                <div class="bli-loading">
                  <div class="bli-spinner"></div>
                  <div>加载中...</div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const state = {
            mode: 'recommend',
            fresh_idx: 1,
            keyword: '',
            loading: false,
          };

          const titleEl = root.querySelector('#bliTitle');
          const refreshBtn = root.querySelector('#bliRefresh');
          const searchInput = root.querySelector('#bliSearchInput');
          const searchBtn = root.querySelector('#bliSearchBtn');
          const clearBtn = root.querySelector('#bliClearBtn');
          const feedEl = root.querySelector('#bliFeed');

          let disposed = false;

          // ---------- 渲染工具 ----------
          function showLoading(text) {
            feedEl.innerHTML = `
              <div class="bli-loading">
                <div class="bli-spinner"></div>
                <div>${escHtml(text || '加载中...')}</div>
              </div>
            `;
          }

          function showError(msg) {
            feedEl.innerHTML = `<div class="bli-error">${escHtml(msg || '加载失败')}</div>`;
          }

          function showEmpty(msg) {
            feedEl.innerHTML = `<div class="bli-empty">${escHtml(msg || '暂无内容')}</div>`;
          }

          function renderFeed(items) {
            feedEl.innerHTML = items.map(item => {
              let pic = item.pic || '';
              if (pic.startsWith('//')) pic = 'https:' + pic;
              return `
                <div class="bli-card" data-bvid="${escHtml(item.bvid || '')}">
                  <img class="bli-cover" src="${escHtml(pic)}"
                       referrerpolicy="no-referrer" loading="lazy" alt="">
                  <div class="bli-info">
                    <div class="bli-card-title">${escHtml(item.title || '无标题')}</div>
                    <div class="bli-meta">
                      <span>${escHtml(item.owner?.name || '')}</span>
                      <span>▶ ${formatNum(item.stat?.view)}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('');

            feedEl.querySelectorAll('.bli-card').forEach(el => {
              el.addEventListener('click', () => {
                const bvid = el.dataset.bvid;
                if (bvid && bvid.startsWith('BV')) {
                  ctx.push('player', { bvid });
                }
              });
            });
          }

          // ---------- 推荐 ----------
          async function loadRecommend() {
            if (disposed || state.loading) return;
            state.mode = 'recommend';
            state.keyword = '';
            state.loading = true;

            titleEl.textContent = '吴际哔哩';
            clearBtn.hidden = true;
            refreshBtn.hidden = false;
            refreshBtn.disabled = true;
            showLoading('加载中...');

            try {
              const { img_key, sub_key } = await getWbiKeys();
              const params = {
                ps: PS,
                fresh_type: 4,
                fresh_idx: state.fresh_idx,
                fresh_idx_1h: state.fresh_idx,
                fetch_row: (state.fresh_idx - 1) * PS,
                brush: state.fresh_idx,
              };
              const query = encWbi(params, img_key, sub_key);
              const json = await fetchJson(`${API_RCMD}?${query}`);

              if (disposed) return;

              if (json.code !== 0) {
                showError(`加载失败: ${json.message || '未知错误'}`);
                return;
              }
              const items = json.data?.item || [];
              if (!items.length) {
                showEmpty('暂无推荐内容');
                return;
              }
              renderFeed(items);
            } catch (e) {
              if (disposed) return;
              showError('加载失败: ' + (e.message || '网络错误'));
            } finally {
              if (!disposed) {
                state.loading = false;
                refreshBtn.disabled = false;
              }
            }
          }

          // ---------- 搜索 ----------
          async function loadSearch(kw) {
            if (disposed || state.loading) return;
            state.mode = 'search';
            state.keyword = kw;
            state.loading = true;

            titleEl.textContent = `🔍 ${kw}`;
            clearBtn.hidden = false;
            refreshBtn.hidden = true;
            searchBtn.disabled = true;
            showLoading('搜索中...');

            try {
              const { img_key, sub_key } = await getWbiKeys();
              const params = {
                keyword: kw,
                search_type: 'video',
                page: 1,
                web_location: 1430650,
              };
              const query = encWbi(params, img_key, sub_key);
              const json = await fetchJson(`${API_SEARCH}?${query}`, {
                headers: {
                  'Referer': `https://search.bilibili.com/all?keyword=${encodeURIComponent(kw)}`
                }
              });

              if (disposed) return;

              if (json.code !== 0) {
                showError(`搜索失败: ${json.message || '未知错误'}`);
                return;
              }
              const items = (json.data?.result || []).map(v => ({
                bvid: v.bvid,
                title: (v.title || '').replace(/<[^>]+>/g, ''),
                pic: v.pic || '',
                owner: { name: v.author || '' },
                stat: { view: v.play || 0 },
              }));
              if (!items.length) {
                showEmpty('没有找到相关视频');
                return;
              }
              renderFeed(items);
            } catch (e) {
              if (disposed) return;
              showError('搜索失败: ' + (e.message || '网络错误'));
            } finally {
              if (!disposed) {
                state.loading = false;
                searchBtn.disabled = false;
              }
            }
          }

          // ---------- 取消搜索 ----------
          function cancelSearch() {
            searchInput.value = '';
            state.fresh_idx = 1;
            loadRecommend();
          }

          // ---------- 事件 ----------
          refreshBtn.addEventListener('click', () => {
            if (state.loading || state.mode !== 'recommend') return;
            state.fresh_idx += 1;
            loadRecommend();
          });

          searchBtn.addEventListener('click', () => {
            const kw = searchInput.value.trim();
            if (!kw) {
              if (state.mode === 'search') cancelSearch();
              return;
            }
            if (state.loading) return;
            loadSearch(kw);
          });

          searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              searchBtn.click();
            }
          });

          searchInput.addEventListener('input', () => {
            if (state.mode === 'search' && !searchInput.value.trim()) {
              cancelSearch();
            }
          });

          clearBtn.addEventListener('click', () => {
            if (state.loading) return;
            cancelSearch();
          });

          // ---------- 启动 ----------
          loadRecommend();

          return () => { disposed = true; };
        },
      },

      player: {
        name: 'player',

        render(routeCtx) {
          const bvid = routeCtx.data?.bvid || '';

          if (!bvid || !bvid.startsWith('BV')) {
            return `
            <div class="bli-player-page">
              <div class="bli-player-error">视频信息无效</div>
              <button class="bli-player-close" id="bliPlayerClose" type="button" aria-label="返回">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            </div>`;
          }

          const url = `https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=${bvid}&autoplay=true&danmaku=0`;

          return `
            <div class="bli-player-page">
              <button class="bli-player-close" id="bliPlayerClose" type="button" aria-label="返回"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
              <iframe
                class="bli-player-frame"
                src="${url}"
                scrolling="no"
                frameborder="no"
                allow="autoplay"
              ></iframe>
            </div>
          `;
        },

        mount(root, ctx) {
          const closeBtn = root.querySelector('#bliPlayerClose');
          if (closeBtn) {
            closeBtn.addEventListener('click', () => ctx.pop());
          }
        },
      },
    },
  });
})();