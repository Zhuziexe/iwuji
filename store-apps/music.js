(() => {
  const BUNDLE = 'com.wujinb.music';
  const API_BASE = 'https://xiaoapi.cn/v1';
  const ICON_URL = './assets/music.svg';
  const REQUEST_TIMEOUT = 10000;

  const HOT_KEYWORDS = ['小星星', '孤勇者', '后来', '起风了', '匆匆那年', '夜曲', '稻香'];

  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5 19 12 7 19.5z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.4"/><rect x="14" y="5" width="4" height="14" rx="1.4"/></svg>`;
  const ICON_FULLSCREEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
  const ICON_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;
  const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`;

  let activeVideo = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function computeGain(v) {
    const n = Math.max(0, Math.min(100, Number(v) || 0)) / 100;
    return Math.max(0, Math.min(1, Math.pow(n, 1.6) * 0.9));
  }

  function attachVolumeSync(mediaEl) {
    if (!mediaEl) return () => { };
    function apply() {
      try { mediaEl.volume = computeGain(Store.get('wujios.volume', 60)); } catch { }
    }
    apply();
    window.addEventListener('wuji:cc-volume-change', apply);
    return () => window.removeEventListener('wuji:cc-volume-change', apply);
  }

  function attachProgressDrag({ progress, mediaEl, updateProgress, root, onDragStart, onDragEnd }) {
    let activePid = null;
    let dragging = false;

    function seekTo(clientX) {
      if (!isFinite(mediaEl.duration) || mediaEl.duration <= 0) return;
      const rect = progress.getBoundingClientRect();
      if (rect.width <= 0) return;
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      try { mediaEl.currentTime = (x / rect.width) * mediaEl.duration; } catch { }
      updateProgress();
    }

    function endSeek(e) {
      if (!dragging) return;
      if (e && activePid !== null && e.pointerId !== activePid) return;
      dragging = false;
      const pid = activePid;
      activePid = null;
      if (root) delete root.dataset.blockBackGesture;
      onDragEnd?.();
      try { progress.releasePointerCapture(pid); } catch { }
    }

    progress.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      if (activePid !== null) return;
      activePid = e.pointerId;
      dragging = true;
      if (root) root.dataset.blockBackGesture = '1';
      onDragStart?.();
      try { progress.setPointerCapture(e.pointerId); } catch { }
      seekTo(e.clientX);
    });

    progress.addEventListener('pointermove', e => {
      if (!dragging || e.pointerId !== activePid) return;
      e.preventDefault();
      seekTo(e.clientX);
    });

    progress.addEventListener('pointerup', endSeek);
    progress.addEventListener('pointercancel', endSeek);
  }

  async function fetchJson(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.kind = 'network';
        throw err;
      }
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') throw e;      // 超时原样抛出
      if (!e.kind) e.kind = 'network';           // fetch 本身失败也归为网络
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function searchMv(keyword) {
    const data = await fetchJson(`${API_BASE}/mv.php?msg=${encodeURIComponent(keyword)}`);
    if (data.code !== 200) {
      const err = new Error(data.msg || '搜索失败');
      err.kind = 'business';
      err.apiMsg = data.msg || '';
      throw err;
    }
    return Array.isArray(data.list) ? data.list : [];
  }

  async function fetchMvDetail(keyword, index) {
    const data = await fetchJson(`${API_BASE}/mv.php?msg=${encodeURIComponent(keyword)}&n=${index}`);
    if (data.code !== 200) {
      const err = new Error(data.msg || '获取失败');
      err.kind = 'business';
      err.apiMsg = data.msg || '';
      throw err;
    }
    return {
      cover: data.cover || '',
      name: data.name || '',
      singer: data.singer || '',
      urls: Array.isArray(data.url) ? data.url.filter(Boolean) : [],
    };
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际音乐',
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.0.0',

    onShutdown() {
      if (activeVideo) {
        try {
          activeVideo.pause();
          activeVideo.removeAttribute('src');
          activeVideo.load();
        } catch { }
        activeVideo = null;
      }
    },

    styles: `
      /* ---------- 首页 ---------- */
      .mv-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }
      .mv-header { flex: 0 0 auto; padding: 8px 14px 4px; }
      .mv-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
      }
      .mv-search {
        flex: 0 0 auto;
        display: flex;
        gap: 8px;
        padding: 6px 14px 10px;
      }
      .mv-input {
        flex: 1 1 auto;
        min-width: 0;
        height: 38px;
        padding: 0 12px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 10px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
      }
      .mv-input:focus { border-color: var(--wj-primary, #3a6ff0); }
      .mv-input::placeholder { color: var(--wj-text-dim); }
      .mv-search-btn {
        flex: 0 0 auto;
        height: 38px;
        padding: 0 14px;
        border: 0;
        border-radius: 10px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        -webkit-tap-highlight-color: transparent;
      }
      .mv-search-btn svg { width: 14px; height: 14px; }
      .mv-search-btn:active { filter: brightness(.92); }

      .mv-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 0 14px 16px;
      }
      .mv-section-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--wj-text-muted);
        letter-spacing: .3px;
        padding: 4px 2px 8px;
      }
      .mv-hot-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .mv-chip {
        padding: 6px 14px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 999px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background .12s;
        -webkit-tap-highlight-color: transparent;
      }
      .mv-chip:active { background: #dae2f0; }

      .mv-results { display: flex; flex-direction: column; gap: 6px; }
      .mv-result {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        border-radius: 12px;
        background: var(--wj-bg-alt);
        cursor: pointer;
        transition: background .15s, transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .mv-result:active { transform: scale(.985); background: #dae2f0; }
      .mv-result__main {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .mv-result__name {
        font-size: 14px;
        font-weight: 600;
        color: var(--wj-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .mv-result__singer { font-size: 12px; color: var(--wj-text-dim); }
      .mv-result__arrow { flex: 0 0 auto; color: var(--wj-text-dim); font-size: 20px; }

      /* ---------- 播放页 ---------- */
      .mv-player {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }
      .mv-stage {
        position: relative;
        flex: 0 0 auto;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000;
        overflow: hidden;
      }
      .mv-video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
        display: block;
      }
      .mv-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.15);
        cursor: pointer;
        transition: opacity .2s;
      }
      .mv-overlay.is-hidden { opacity: 0; pointer-events: none; }
      .mv-play-big {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        border: 0;
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(8px);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .mv-play-big svg { width: 28px; height: 28px; margin-left: 4px; }
      .mv-play-big:active { transform: scale(.94); }

      .mv-info { flex: 0 0 auto; padding: 14px 18px 8px; }
      .mv-info__name {
        font-size: 17px;
        font-weight: 700;
        color: var(--wj-text);
        line-height: 1.35;
        word-break: break-word;
      }
      .mv-info__singer {
        margin-top: 4px;
        font-size: 13px;
        color: var(--wj-text-dim);
      }

      .mv-controls {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px calc(14px + env(safe-area-inset-bottom, 0px));
      }
      .mv-ctrl-btn {
        flex: 0 0 auto;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
      }
      .mv-ctrl-btn svg { width: 16px; height: 16px; }
      .mv-ctrl-btn:active { transform: scale(.94); }
      .mv-ctrl-btn.is-primary { background: var(--wj-primary, #3a6ff0); color: #fff; }

      .mv-progress {
        flex: 1 1 auto;
        min-width: 0;
        position: relative;
        height: 34px;
        display: flex;
        align-items: center;
        cursor: pointer;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }
      .mv-track {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 4px;
        margin-top: -2px;
        background: var(--wj-border, #e6e9ef);
        border-radius: 2px;
        overflow: hidden;
        pointer-events: none;
      }
      .mv-fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0;
        background: var(--wj-primary, #3a6ff0);
        border-radius: 2px;
      }
      .mv-knob {
        position: absolute;
        top: 50%;
        left: 0;
        width: 16px;
        height: 16px;
        margin-top: -8px;
        margin-left: -8px;
        border-radius: 50%;
        background: var(--wj-primary, #3a6ff0);
        box-shadow: 0 2px 6px rgba(0,0,0,.2);
        pointer-events: none;
        will-change: left;
      }
      .mv-progress.is-dragging .mv-knob { transform: scale(1.15); }
      .mv-time {
        flex: 0 0 auto;
        font-size: 11px;
        color: var(--wj-text-dim);
        font-variant-numeric: tabular-nums;
        letter-spacing: .3px;
      }

      /* ---------- 状态 ---------- */
      .mv-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 60px 24px;
        text-align: center;
      }
      .mv-spinner {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid rgba(58,111,240,.18);
        border-top-color: #3a6ff0;
        animation: mv-spin .85s linear infinite;
      }
      @keyframes mv-spin { to { transform: rotate(360deg); } }
      .mv-state__text {
        font-size: 14px;
        color: var(--wj-text-muted);
        line-height: 1.6;
      }
      .mv-state__retry {
        padding: 10px 24px;
        border: 0;
        border-radius: 999px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      /* ---------- 全屏页 ---------- */
      .mv-fs {
        position: absolute;
        inset: 0;
        background: #000;
        overflow: hidden;
      }
      .mv-fs__stage { position: absolute; inset: 0; background: #000; }
      .mv-fs__video {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100vh;
        height: 100vw;
        transform: translate(-50%, -50%) rotate(90deg);
        transform-origin: center center;
        background: #000;
        object-fit: contain;
        -webkit-tap-highlight-color: transparent;
      }
      .mv-fs__controls {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
        background: linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,0) 100%);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 3;
        transition: opacity .2s ease;
      }
      .mv-fs.is-hide .mv-fs__controls { opacity: 0; pointer-events: none; }
      .mv-fs .mv-track { background: rgba(255,255,255,.28); }
      .mv-fs .mv-knob { background: #fff; }
      .mv-fs .mv-time { color: #fff; }
      .mv-fs .mv-ctrl-btn { background: rgba(255,255,255,.16); color: #fff; }
      .mv-fs .mv-ctrl-btn.is-primary { background: var(--wj-primary, #3a6ff0); }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="mv-page">
              <div class="mv-header">
                <div class="mv-title">吴际音乐</div>
              </div>
              <div class="mv-search">
                <input class="mv-input" id="mvInput" type="text"
                       placeholder="搜索 MV…"
                       autocomplete="off" autocorrect="off"
                       autocapitalize="off" spellcheck="false">
                <button class="mv-search-btn" id="mvSearchBtn" type="button">
                  ${ICON_SEARCH}<span>搜索</span>
                </button>
              </div>
              <div class="mv-body" id="mvBody">
                <div class="mv-section-title">热门搜索</div>
                <div class="mv-hot-grid">
                  ${HOT_KEYWORDS.map(k => `
                    <button class="mv-chip" data-kw="${escapeHtml(k)}" type="button">
                      ${escapeHtml(k)}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const inputEl = root.querySelector('#mvInput');
          const searchBtn = root.querySelector('#mvSearchBtn');
          const bodyEl = root.querySelector('#mvBody');

          let disposed = false;
          let searching = false;

          function bindHot() {
            bodyEl.querySelectorAll('.mv-chip').forEach(btn => {
              btn.addEventListener('click', () => doSearch(btn.dataset.kw));
            });
          }

          function renderHot() {
            bodyEl.innerHTML = `
              <div class="mv-section-title">热门搜索</div>
              <div class="mv-hot-grid">
                ${HOT_KEYWORDS.map(k => `
                  <button class="mv-chip" data-kw="${escapeHtml(k)}" type="button">
                    ${escapeHtml(k)}
                  </button>
                `).join('')}
              </div>
            `;
            bindHot();
          }

          function renderResults(keyword, list) {
            if (!list.length) {
              bodyEl.innerHTML = `
                <div class="mv-state">
                  <div class="mv-state__text">没有找到「${escapeHtml(keyword)}」相关 MV</div>
                </div>
              `;
              return;
            }

            bodyEl.innerHTML = `
              <div class="mv-section-title">搜索结果（${list.length}）</div>
              <div class="mv-results">
                ${list.map((item, i) => `
                  <div class="mv-result" data-idx="${i}">
                    <div class="mv-result__main">
                      <div class="mv-result__name">${escapeHtml(item.name || '未命名')}</div>
                      <div class="mv-result__singer">${escapeHtml(item.singer || '')}</div>
                    </div>
                    <div class="mv-result__arrow">›</div>
                  </div>
                `).join('')}
              </div>
            `;

            bodyEl.querySelectorAll('.mv-result').forEach(el => {
              el.addEventListener('click', () => {
                const idx = Number(el.dataset.idx);
                if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
                ctx.push('player', {
                  keyword,
                  index: idx + 1,   // API 的 n 从 1 开始
                });
              });
            });
          }

          async function doSearch(keyword) {
            if (searching || disposed) return;
            const kw = String(keyword || '').trim();

            if (!kw) {
              // 空搜索 → 回到热门
              inputEl.value = '';
              renderHot();
              return;
            }

            inputEl.value = kw;
            searching = true;
            bodyEl.innerHTML = `
              <div class="mv-state">
                <div class="mv-spinner"></div>
                <div class="mv-state__text">正在搜索「${escapeHtml(kw)}」…</div>
              </div>
            `;

            try {
              const list = await searchMv(kw);
              if (disposed) return;
              renderResults(kw, list);
            } catch (e) {
              if (disposed) return;
              console.warn('[music] 搜索失败', e);

              let text;
              let showRetry = true;

              if (e.name === 'AbortError') {
                text = '请求超时，请重试';
              } else if (e.kind === 'business') {
                // API 明确说没有结果，不是网络问题
                text = e.apiMsg || '没有找到相关 MV';
                showRetry = false;      // 重试也没用，换关键词才有用
              } else {
                text = '网络异常，请检查后重试';
              }

              bodyEl.innerHTML = `
    <div class="mv-state">
      <div class="mv-state__text">${escapeHtml(text)}</div>
      ${showRetry ? `<button class="mv-state__retry" id="mvRetryBtn" type="button">重试</button>` : ''}
    </div>
  `;
              bodyEl.querySelector('#mvRetryBtn')?.addEventListener('click', () => doSearch(kw));
            } finally {
              searching = false;
            }
          }

          searchBtn.addEventListener('click', () => doSearch(inputEl.value));
          inputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) {
              e.preventDefault();
              doSearch(inputEl.value);
            }
          });

          bindHot();

          return () => { disposed = true; };
        },
      },

      player: {
        name: 'player',

        render(routeCtx) {
          return `
            <div class="mv-player">
              <div class="mv-stage" id="mvStage">
                <video class="mv-video" id="mvVideo" playsinline webkit-playsinline></video>
                <div class="mv-overlay" id="mvOverlay">
                  <button class="mv-play-big" id="mvPlayBig" type="button" aria-label="播放">
                    ${ICON_PLAY}
                  </button>
                </div>
              </div>
              <div class="mv-info">
                <div class="mv-info__name" id="mvName">—</div>
                <div class="mv-info__singer" id="mvSinger"></div>
              </div>
              <div class="mv-controls">
                <button class="mv-ctrl-btn is-primary" id="mvPlayBtn" type="button">${ICON_PLAY}</button>
                <div class="mv-progress" id="mvProgress">
                  <div class="mv-track">
                    <div class="mv-fill" id="mvFill"></div>
                  </div>
                  <div class="mv-knob" id="mvKnob"></div>
                </div>
                <span class="mv-time" id="mvTime">00:00 / 00:00</span>
                <button class="mv-ctrl-btn" id="mvFsBtn" type="button" aria-label="全屏">${ICON_FULLSCREEN}</button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const keyword = String(ctx.data?.keyword || '').trim();
          const index = Number(ctx.data?.index || 1);

          const stageEl = root.querySelector('#mvStage');
          const v = root.querySelector('#mvVideo');
          const overlayEl = root.querySelector('#mvOverlay');
          const playBig = root.querySelector('#mvPlayBig');
          const nameEl = root.querySelector('#mvName');
          const singerEl = root.querySelector('#mvSinger');
          const playBtn = root.querySelector('#mvPlayBtn');
          const progress = root.querySelector('#mvProgress');
          const fill = root.querySelector('#mvFill');
          const knob = root.querySelector('#mvKnob');
          const timeEl = root.querySelector('#mvTime');
          const fsBtn = root.querySelector('#mvFsBtn');

          let disposed = false;
          let videoSrc = '';
          let videoTitle = '';

          activeVideo = v;

          const detachVolume = attachVolumeSync(v);

          function updatePlayIcon(playing) {
            playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
          }

          function updateProgress() {
            const cur = isFinite(v.currentTime) ? v.currentTime : 0;
            const dur = isFinite(v.duration) ? v.duration : 0;
            const pct = dur > 0 ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;
            fill.style.width = pct + '%';
            knob.style.left = pct + '%';
            timeEl.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
          }

          function showOverlay() { overlayEl.classList.remove('is-hidden'); }
          function hideOverlay() { overlayEl.classList.add('is-hidden'); }

          function startPlay() {
            if (!videoSrc) return;
            v.play().catch(() => { showOverlay(); });
          }

          overlayEl.addEventListener('click', startPlay);
          playBig.addEventListener('click', e => { e.stopPropagation(); startPlay(); });

          playBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (!videoSrc) return;
            if (v.paused) startPlay();
            else v.pause();
          });

          fsBtn.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            if (!videoSrc) return;
            try { v.pause(); } catch { }
            const r = stageEl.getBoundingClientRect();
            ctx.push('fullscreen', { src: videoSrc, title: videoTitle }, {
              transition: 'zoom',
              origin: { x: r.left, y: r.top, w: r.width, h: r.height },
            });
          });

          v.addEventListener('play', () => { updatePlayIcon(true); hideOverlay(); });
          v.addEventListener('pause', () => updatePlayIcon(false));
          v.addEventListener('ended', () => { updatePlayIcon(false); showOverlay(); });
          v.addEventListener('timeupdate', updateProgress);
          v.addEventListener('loadedmetadata', updateProgress);

          attachProgressDrag({
            progress, mediaEl: v, updateProgress, root,
            onDragStart: () => progress.classList.add('is-dragging'),
            onDragEnd: () => progress.classList.remove('is-dragging'),
          });

          /* 加载详情 */
          (async () => {
            try {
              const data = await fetchMvDetail(keyword, index);
              if (disposed) return;

              nameEl.textContent = data.name || '—';
              singerEl.textContent = data.singer || '';

              if (!data.urls.length) {
                showOverlay();
                return;
              }

              if (data.cover) {
                try { v.poster = data.cover; } catch { }
              }

              videoSrc = data.urls[0];
              videoTitle = data.name || '';
              v.src = videoSrc;

              startPlay();
            } catch (e) {
              if (disposed) return;
              console.warn('[music] 加载详情失败', e);

              nameEl.textContent = keyword;
              if (e.name === 'AbortError') {
                singerEl.textContent = '请求超时';
              } else if (e.kind === 'business') {
                singerEl.textContent = e.apiMsg || '该 MV 暂不可用';
              } else {
                singerEl.textContent = '网络异常';
              }
              showOverlay();
            }
          })();

          return () => {
            disposed = true;
            detachVolume();
            try {
              v.pause();
              v.removeAttribute('src');
              v.load();
            } catch { }
            if (activeVideo === v) activeVideo = null;
            delete root.dataset.blockBackGesture;
          };
        },
      },

      fullscreen: {
        name: 'fullscreen',
        transition: 'zoom',

        render(routeCtx) {
          const src = routeCtx.data?.src || '';
          return `
            <div class="mv-fs" id="mvFs">
              <div class="mv-fs__stage">
                <video class="mv-fs__video" id="mvFsVideo"
                       playsinline webkit-playsinline
                       data-src="${escapeHtml(src)}"></video>
              </div>
              <div class="mv-fs__controls" id="mvFsControls">
                <button class="mv-ctrl-btn" id="mvFsBack" type="button" aria-label="退出全屏">${ICON_BACK}</button>
                <button class="mv-ctrl-btn is-primary" id="mvFsPlayBtn" type="button">${ICON_PLAY}</button>
                <div class="mv-progress" id="mvFsProgress">
                  <div class="mv-track">
                    <div class="mv-fill" id="mvFsFill"></div>
                  </div>
                  <div class="mv-knob" id="mvFsKnob"></div>
                </div>
                <span class="mv-time" id="mvFsTime">00:00 / 00:00</span>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const v = root.querySelector('#mvFsVideo');
          const backBtn = root.querySelector('#mvFsBack');
          const playBtn = root.querySelector('#mvFsPlayBtn');
          const progress = root.querySelector('#mvFsProgress');
          const fill = root.querySelector('#mvFsFill');
          const knob = root.querySelector('#mvFsKnob');
          const timeEl = root.querySelector('#mvFsTime');

          const src = v.dataset.src;
          if (!src) return;

          let disposed = false;

          const detachVolume = attachVolumeSync(v);

          v.src = src;
          v.playsInline = true;
          v.setAttribute('playsinline', '');
          v.setAttribute('webkit-playsinline', '');

          function updatePlayIcon(playing) {
            playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
          }

          function updateProgress() {
            const cur = isFinite(v.currentTime) ? v.currentTime : 0;
            const dur = isFinite(v.duration) ? v.duration : 0;
            const pct = dur > 0 ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;
            fill.style.width = pct + '%';
            knob.style.left = pct + '%';
            timeEl.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
          }

          backBtn.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            ctx.pop();
          });

          playBtn.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            if (v.paused) v.play().catch(() => { });
            else v.pause();
          });

          v.addEventListener('play', () => updatePlayIcon(true));
          v.addEventListener('pause', () => updatePlayIcon(false));
          v.addEventListener('ended', () => updatePlayIcon(false));
          v.addEventListener('timeupdate', updateProgress);
          v.addEventListener('loadedmetadata', updateProgress);
          v.addEventListener('error', () => { if (!disposed) ctx.pop(); }, { once: true });

          attachProgressDrag({
            progress, mediaEl: v, updateProgress, root,
            onDragStart: () => progress.classList.add('is-dragging'),
            onDragEnd: () => progress.classList.remove('is-dragging'),
          });

          v.play().catch(() => { });
          updateProgress();

          return () => {
            disposed = true;
            detachVolume();
            try {
              v.pause();
              v.removeAttribute('src');
              v.load();
            } catch { }
            delete root.dataset.blockBackGesture;
          };
        },
      },
    },
  });
})();