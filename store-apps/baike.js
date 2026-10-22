(() => {
  const BUNDLE = 'com.niunai.baike';
  const API_BASE = 'https://xiaoapi.cn/v1/bk.php';
  const ICON_URL = './assets/baike.svg';
  const REQUEST_TIMEOUT = 8000;

  const HOT_WORDS = [
    '机器人', '高铁', '磁悬浮列车', '黑洞',
    '人工智能', '相对论', '北京', '苹果',
  ];

  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5 19 12 7 19.5z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.4"/><rect x="14" y="5" width="4" height="14" rx="1.4"/></svg>`;
  const ICON_FULLSCREEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
  const ICON_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function computeGain(volume100) {
    const v = Math.max(0, Math.min(100, Number(volume100) || 0)) / 100;
    const g = Math.pow(v, 1.6) * 0.9;
    return Math.max(0, Math.min(1, g));
  }

  /* 让一个 <video> 跟随系统媒体音量。返回 cleanup 函数 */
  function attachVolumeSync(videoEl) {
    if (!videoEl) return () => { };

    function apply() {
      const v = Store.get('wujios.volume', 60);
      try { videoEl.volume = computeGain(v); } catch { }
    }

    apply();  // 创建时立即应用一次
    window.addEventListener('wuji:cc-volume-change', apply);

    return () => {
      window.removeEventListener('wuji:cc-volume-change', apply);
    };
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '牛奶百科',
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.0.4',

    styles: `
      .bk-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }

      .bk-header {
        flex: 0 0 auto;
        padding: 8px 14px 4px;
      }
      .bk-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
      }

      .bk-search {
        flex: 0 0 auto;
        display: flex;
        gap: 8px;
        padding: 6px 14px 10px;
      }
      .bk-input {
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
      .bk-input:focus { border-color: var(--wj-primary, #3a6ff0); }
      .bk-input::placeholder { color: var(--wj-text-dim); }

      .bk-search-btn {
        flex: 0 0 auto;
        height: 38px;
        padding: 0 16px;
        border: 0;
        border-radius: 10px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform .1s, filter .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .bk-search-btn:active { transform: scale(.96); filter: brightness(.92); }

      .bk-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 0 14px 16px;
      }

      .bk-section-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--wj-text-muted);
        letter-spacing: .3px;
        padding: 4px 2px 8px;
      }

      .bk-hot-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .bk-hot-item {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px 10px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 12px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background .15s, transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .bk-hot-item:active { background: #dae2f0; transform: scale(.97); }

      .bk-detail {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
      }
      .bk-detail__scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding-bottom: 24px;
      }

      .bk-hero {
        width: 100%;
        height: 140px;
        background: var(--wj-bg-alt);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-top: var(--statusbar-h);
        box-sizing: border-box;
      }
      .bk-hero img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .bk-hero.is-empty {
        background: linear-gradient(135deg, #3a6ff0, #2c5ad0);
        color: #fff;
        font-size: 48px;
      }

      .bk-detail__head { padding: 16px 18px 0; }
      .bk-word {
        font-size: 22px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
        margin-top: 4px;
      }

      .bk-summary {
        padding: 12px 18px 0;
        font-size: 14px;
        line-height: 1.65;
        color: var(--wj-text);
        word-break: break-word;
      }

      .bk-video-card {
        margin: 14px 18px 0;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        overflow: hidden;
        cursor: pointer;
        transition: transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .bk-video-card:active { transform: scale(.985); }

      .bk-video-cover {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #1c2536;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .bk-video-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        pointer-events: none;
      }
      .bk-video-play {
        position: absolute;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .bk-video-play::before {
        content: '';
        display: block;
        width: 0;
        height: 0;
        border-left: 12px solid #fff;
        border-top: 7px solid transparent;
        border-bottom: 7px solid transparent;
        margin-left: 3px;
      }
      .bk-video-title {
        padding: 10px 14px;
        font-size: 13px;
        color: var(--wj-text);
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ---------- 播放器（普通 / 全屏共用控制条样式） ---------- */
      .bk-vp {
        position: relative;
        margin: 14px 18px 0;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 14px;
        overflow: hidden;
      }
      .bk-vp__video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        background: #000;
        -webkit-tap-highlight-color: transparent;
      }
      .bk-vp__controls {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
        background: linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,0) 100%);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 2;
        transition: opacity .2s ease;
      }
      .bk-vp.is-hide .bk-vp__controls {
        opacity: 0;
        pointer-events: none;
      }
      .bk-vp__btn {
        flex: 0 0 auto;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: rgba(255,255,255,.18);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
      }
      .bk-vp__btn:active { background: rgba(255,255,255,.32); }
      .bk-vp__btn svg { width: 14px; height: 14px; display: block; }

      /* ★ 进度条：34px 触摸区，圆点可拖 */
      .bk-vp__progress {
        position: relative;
        flex: 1 1 auto;
        min-width: 0;
        height: 34px;
        display: flex;
        align-items: center;
        cursor: pointer;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .bk-vp__track {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 4px;
        margin-top: -2px;
        background: rgba(255,255,255,.28);
        border-radius: 2px;
        overflow: hidden;
        pointer-events: none;
      }
      .bk-vp__fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0;
        background: var(--wj-primary, #3a6ff0);
        border-radius: 2px;
        pointer-events: none;
      }
      /* ★ 白色圆点 */
      .bk-vp__knob {
        position: absolute;
        top: 50%;
        left: 0;
        width: 18px;
        height: 18px;
        margin-top: -9px;
        margin-left: -9px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.4);
        pointer-events: none;
        will-change: left;
        transition: transform .08s ease;
      }
      .bk-vp__progress.is-dragging .bk-vp__knob {
        transform: scale(1.15);
      }
      .bk-vp__time {
        flex: 0 0 auto;
        font-size: 11px;
        color: #fff;
        font-variant-numeric: tabular-nums;
        letter-spacing: .3px;
        white-space: nowrap;
        pointer-events: none;
      }

      .bk-fs {
  position: absolute;
  inset: 0;
  background: #000;
  overflow: hidden;
}

.bk-fs__stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100vh;
  height: 100vw;
  transform: translate(-50%, -50%) rotate(90deg);
  transform-origin: center center;
  background: #000;
  overflow: hidden;
}

.bk-fs__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.bk-fs__controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 12px;
  background: linear-gradient(to top, rgba(0,0,0,.82), transparent);
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 3;
  transition: opacity .2s ease;
}
.bk-fs.is-hide .bk-fs__controls {
  opacity: 0;
  pointer-events: none;
}
.bk-fs .bk-vp__track { background: rgba(255,255,255,.28); }
.bk-fs .bk-vp__knob { background: #fff; }
.bk-fs .bk-vp__time { color: #fff; }
.bk-fs .bk-vp__btn { background: rgba(255,255,255,.16); color: #fff; }

      .bk-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 60px 24px;
        text-align: center;
      }
      .bk-spinner {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        overflow: hidden;
        object-fit: cover;
        display: block;
        animation: bk-spin 0.9s linear infinite;
        will-change: transform;
      }
      @keyframes bk-spin { to { transform: rotate(360deg); } }
      .bk-state__text {
        font-size: 14px;
        color: var(--wj-text-muted);
        line-height: 1.6;
      }
      .bk-state__retry {
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
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="bk-page">
              <div class="bk-header">
                <div class="bk-title">牛奶百科</div>
              </div>
              <div class="bk-search">
                <input class="bk-input" id="bkInput" type="text"
                       placeholder="搜索词条…"
                       autocomplete="off" autocorrect="off"
                       autocapitalize="off" spellcheck="false">
                <button class="bk-search-btn" id="bkSearchBtn" type="button">搜索</button>
              </div>
              <div class="bk-body">
                <div class="bk-section-title">热门词条</div>
                <div class="bk-hot-grid">
                  ${HOT_WORDS.map(w => `
                    <button class="bk-hot-item" data-word="${escapeHtml(w)}" type="button">
                      ${escapeHtml(w)}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const inputEl = root.querySelector('#bkInput');
          const searchBtn = root.querySelector('#bkSearchBtn');
          const bodyEl = root.querySelector('.bk-body');

          function doSearch(word) {
            const w = String(word || '').trim();
            if (!w) return;
            inputEl.value = w;
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
            ctx.push('result', { word: w });
          }

          searchBtn.addEventListener('click', () => doSearch(inputEl.value));

          inputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) {
              e.preventDefault();
              doSearch(inputEl.value);
            }
          });

          bodyEl.querySelectorAll('[data-word]').forEach(btn => {
            btn.addEventListener('click', () => doSearch(btn.dataset.word));
          });
        },
      },

      result: {
        name: 'result',

        render(routeCtx) {
          const word = routeCtx.data?.word || '';
          return `
            <div class="bk-detail">
              <div class="bk-detail__scroll" id="bkScroll">
                <div class="bk-hero" id="bkHero"></div>
                <div class="bk-detail__head">
                  <div class="bk-word">${escapeHtml(word)}</div>
                </div>
                <div class="bk-summary" id="bkSummary"></div>
                <div id="bkVideo"></div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const word = String(ctx.data?.word || '').trim();
          const heroEl = root.querySelector('#bkHero');
          const summaryEl = root.querySelector('#bkSummary');
          const videoEl = root.querySelector('#bkVideo');

          let disposed = false;
          let cleanupVideo = null;

          async function fetchBaike(w) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
            try {
              const url = `${API_BASE}?msg=${encodeURIComponent(w)}`;
              const res = await fetch(url, {
                signal: ctrl.signal,
                cache: 'no-store',
              });
              if (!res.ok) {
                const err = new Error(`HTTP ${res.status}`);
                err.kind = 'http';
                throw err;
              }
              let data = null;
              try { data = await res.json(); } catch { }
              if (!data || typeof data !== 'object') {
                const err = new Error('INVALID_RESPONSE');
                err.kind = 'http';
                throw err;
              }
              if (data.code === 201) {
                const err = new Error('NOT_FOUND');
                err.kind = 'not-found';
                throw err;
              }
              if (data.code !== 200) {
                const err = new Error(data.msg || '查询失败');
                err.kind = 'http';
                throw err;
              }
              return data;
            } finally {
              clearTimeout(timer);
            }
          }

          function setHeroEmpty(symbol) {
            heroEl.classList.add('is-empty');
            heroEl.innerHTML = symbol || '';
          }

          function setHeroImage(url) {
            heroEl.classList.remove('is-empty');
            heroEl.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
            const img = heroEl.querySelector('img');
            img.addEventListener('error', () => setHeroEmpty('📖'), { once: true });
          }

          function renderLoading() {
            setHeroEmpty('');
            videoEl.innerHTML = '';
            summaryEl.innerHTML = `
    <div class="bk-state">
      <img class="bk-spinner" src="./assets/loading.png" alt="">
      <div class="bk-state__text">正在查询「${escapeHtml(word)}」…</div>
    </div>
  `;
          }

          function renderError(err) {
            setHeroEmpty('');
            videoEl.innerHTML = '';

            let text;
            let showRetry = true;

            if (err && err.kind === 'not-found') {
              text = `没有找到「${word}」这个词条，换个词试试`;
              showRetry = false;
            } else if (err && err.name === 'AbortError') {
              text = '请求超时，请重试';
            } else {
              text = '查询失败，请检查网络';
            }

            summaryEl.innerHTML = `
              <div class="bk-state">
                <div class="bk-state__text">${escapeHtml(text)}</div>
                ${showRetry ? `<button class="bk-state__retry" id="bkRetryBtn" type="button">重试</button>` : ''}
              </div>
            `;
            const retry = summaryEl.querySelector('#bkRetryBtn');
            if (retry) retry.addEventListener('click', () => load());
          }

          function renderData(data) {
            if (data.pic) setHeroImage(data.pic);
            else setHeroEmpty('📖');

            const summary = String(data.msg || '').trim();
            summaryEl.textContent = summary || '暂无摘要';

            renderVideo(data.video);
          }

          function renderVideo(video) {
            if (cleanupVideo) { cleanupVideo(); cleanupVideo = null; }

            if (!video || !video.playurl) {
              videoEl.innerHTML = '';
              return;
            }

            const cover = video.cover || '';
            const title = video.title || '相关视频';

            videoEl.innerHTML = `
              <div class="bk-video-card" id="bkVideoCard">
                <div class="bk-video-cover">
                  ${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}
                  <div class="bk-video-play"></div>
                </div>
                <div class="bk-video-title">${escapeHtml(title)}</div>
              </div>
            `;

            const card = videoEl.querySelector('#bkVideoCard');
            card.addEventListener('click', () => {
              if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
              renderPlayer(video.playurl, title, ctx);
            });
          }

          /* ---------- 普通播放器 ---------- */
          function renderPlayer(src, title, ctx) {
            if (cleanupVideo) { cleanupVideo(); cleanupVideo = null; }

            videoEl.innerHTML = `
              <div class="bk-vp" id="bkVp">
                <video class="bk-vp__video" id="bkVpVideo"
                       playsinline webkit-playsinline></video>
                <div class="bk-vp__controls" id="bkVpControls">
                  <button class="bk-vp__btn" id="bkVpPlayBtn" type="button">${ICON_PLAY}</button>
                  <div class="bk-vp__progress" id="bkVpProgress">
                    <div class="bk-vp__track">
                      <div class="bk-vp__fill" id="bkVpFill"></div>
                    </div>
                    <div class="bk-vp__knob" id="bkVpKnob"></div>
                  </div>
                  <span class="bk-vp__time" id="bkVpTime">00:00 / 00:00</span>
                  <button class="bk-vp__btn" id="bkVpFsBtn" type="button" aria-label="全屏">${ICON_FULLSCREEN}</button>
                </div>
              </div>
            `;

            const wrap = videoEl.querySelector('#bkVp');
            const v = videoEl.querySelector('#bkVpVideo');
            const playBtn = videoEl.querySelector('#bkVpPlayBtn');
            const progress = videoEl.querySelector('#bkVpProgress');
            const fill = videoEl.querySelector('#bkVpFill');
            const knob = videoEl.querySelector('#bkVpKnob');
            const timeEl = videoEl.querySelector('#bkVpTime');
            const fsBtn = videoEl.querySelector('#bkVpFsBtn');

            const detachVolume = attachVolumeSync(v);

            v.src = src;
            v.playsInline = true;
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', '');

            function updatePlayIcon(playing) {
              playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
            }

            function updateTimeText() {
              const cur = isFinite(v.currentTime) ? v.currentTime : 0;
              const dur = isFinite(v.duration) ? v.duration : 0;
              timeEl.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
            }

            function updateProgress() {
              if (!isFinite(v.duration) || v.duration <= 0) {
                fill.style.width = '0%';
                knob.style.left = '0%';
                return;
              }
              const pct = Math.max(0, Math.min(100, (v.currentTime / v.duration) * 100));
              fill.style.width = pct + '%';
              knob.style.left = pct + '%';
              updateTimeText();
            }

            function toggleControls() {
              wrap.classList.toggle('is-hide');
            }

            playBtn.addEventListener('click', e => {
              e.stopPropagation();
              e.preventDefault();
              if (v.paused) v.play().catch(() => { });
              else v.pause();
            });

            fsBtn.addEventListener('click', e => {
              e.stopPropagation();
              e.preventDefault();
              if (!src) return;

              const currentTime = v.currentTime;
              const wasPlaying = !v.paused;
              try { v.pause(); } catch { }

              const r = wrap.getBoundingClientRect(); 
              ctx.push('fullscreen', {
                src: src,
                title: title,
                currentTime,
                wasPlaying,
                onClose: (state) => {
                  if (!state) return;
                  try { v.currentTime = state.currentTime; } catch { }
                  if (state.wasPlaying) {
                    v.play().catch(() => { });
                  }
                },
              }, {
                transition: 'zoom',
                origin: { x: r.left, y: r.top, w: r.width, h: r.height },
              });
            });

            v.addEventListener('click', () => toggleControls());

            v.addEventListener('play', () => updatePlayIcon(true));
            v.addEventListener('pause', () => updatePlayIcon(false));
            v.addEventListener('ended', () => updatePlayIcon(false));

            v.addEventListener('timeupdate', updateProgress);
            v.addEventListener('loadedmetadata', () => {
              updateTimeText();
              updateProgress();
            });

            v.addEventListener('error', () => {
              videoEl.innerHTML = `
                <div class="bk-state">
                  <div class="bk-state__text">视频暂不可用</div>
                </div>
              `;
            }, { once: true });

            /* ---------- 进度条拖动（阻止返回手势） ---------- */
            attachProgressDrag({
              progress, videoEl: v, updateProgress,
              root, onDragStart: () => progress.classList.add('is-dragging'),
              onDragEnd: () => progress.classList.remove('is-dragging'),
            });

            try { v.play().catch(() => { }); } catch { }

            updatePlayIcon(false);
            updateTimeText();

            cleanupVideo = () => {
              detachVolume();                 // ★ 移除音量监听
              try { v.pause(); } catch { }
              try { v.removeAttribute('src'); v.load(); } catch { }
            };
          }

          async function load() {
            if (disposed) return;
            renderLoading();
            try {
              const data = await fetchBaike(word);
              if (disposed) return;
              renderData(data);
            } catch (e) {
              if (disposed) return;
              console.warn('[baike] fetch 失败', e);
              renderError(e);
            }
          }

          load();

          return () => {
            disposed = true;
            if (cleanupVideo) { cleanupVideo(); cleanupVideo = null; }
          };
        },
      },

      /* =========================================================
         fullscreen：全屏 + 旋转 90 度
         ========================================================= */
      fullscreen: {
        name: 'fullscreen',
        transition: 'zoom',

        render(routeCtx) {
          const src = routeCtx.data?.src || '';
          return `
    <div class="bk-fs" id="bkFs">
      <div class="bk-fs__stage">
        <video class="bk-fs__video" id="bkFsVideo"
               playsinline webkit-playsinline
               data-src="${escapeHtml(src)}"></video>
        <div class="bk-fs__controls" id="bkFsControls">
          <button class="bk-vp__btn" id="bkFsBack" type="button" aria-label="退出全屏">${ICON_BACK}</button>
          <button class="bk-vp__btn" id="bkFsPlayBtn" type="button">${ICON_PLAY}</button>
          <div class="bk-vp__progress" id="bkFsProgress">
            <div class="bk-vp__track">
              <div class="bk-vp__fill" id="bkFsFill"></div>
            </div>
            <div class="bk-vp__knob" id="bkFsKnob"></div>
          </div>
          <span class="bk-vp__time" id="bkFsTime">00:00 / 00:00</span>
        </div>
      </div>
    </div>
  `;
        },

        mount(root, ctx) {
          const data = ctx.data || {};
          const src = data.src || '';
          const initialTime = typeof data.currentTime === 'number' ? data.currentTime : 0;
          const wasPlaying = data.wasPlaying !== false;
          const onClose = typeof data.onClose === 'function' ? data.onClose : null;

          const wrap = root.querySelector('#bkFs');
          const v = root.querySelector('#bkFsVideo');
          const backBtn = root.querySelector('#bkFsBack');
          const playBtn = root.querySelector('#bkFsPlayBtn');
          const progress = root.querySelector('#bkFsProgress');
          const fill = root.querySelector('#bkFsFill');
          const knob = root.querySelector('#bkFsKnob');
          const timeEl = root.querySelector('#bkFsTime');

          if (!src) { ctx.pop(); return; }

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

          function toggleControls() {
            wrap.classList.toggle('is-hide');
          }

          // 点击画面切换控制条，点在控制条内不切换
          wrap.addEventListener('click', (e) => {
            if (e.target.closest('.bk-fs__controls')) return;
            toggleControls();
          });

          backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            ctx.pop();
          });

          playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (v.paused) v.play().catch(() => { });
            else v.pause();
          });

          v.addEventListener('play', () => updatePlayIcon(true));
          v.addEventListener('pause', () => updatePlayIcon(false));
          v.addEventListener('ended', () => updatePlayIcon(false));
          v.addEventListener('timeupdate', updateProgress);

          v.addEventListener('loadedmetadata', () => {
            if (initialTime > 0) {
              try { v.currentTime = initialTime; } catch { }
            }
            updateProgress();
          });

          v.addEventListener('error', () => {
            if (!disposed) ctx.pop();
          }, { once: true });

          attachProgressDrag({
            progress, mediaEl: v, updateProgress, root,
            onDragStart: () => progress.classList.add('is-dragging'),
            onDragEnd: () => progress.classList.remove('is-dragging'),
          });

          if (wasPlaying) v.play().catch(() => { });
          updateProgress();

          return () => {
            disposed = true;
            detachVolume();
            const state = {
              currentTime: isFinite(v.currentTime) ? v.currentTime : initialTime,
              wasPlaying: !v.paused,
            };
            try { v.pause(); } catch { }
            try { onClose?.(state); } catch { }
            try {
              v.removeAttribute('src');
              v.load();
            } catch { }
            delete root.dataset.blockBackGesture;
          };
        },
      },
    },
  });

  /* =========================================================
     进度条拖动：圆点 + 触摸热区 + 阻止返回手势
     ========================================================= */
  function attachProgressDrag({ progress, mediaEl, videoEl, updateProgress, root, onDragStart, onDragEnd }) {
    // ★ 兼容两种参数名，避免调用处写错导致 undefined
    const media = mediaEl || videoEl;
    if (!progress || !media) {
      console.warn('[progressDrag] 缺少 progress 或 media 元素');
      return;
    }

    let activePid = null;
    let dragging = false;

    function seekTo(clientX, clientY) {
      if (!isFinite(media.duration) || media.duration <= 0) return;
      const rect = progress.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      let ratio;
      // 自动判断方向：height > width → 垂直（全屏页旋转后）
      if (rect.height > rect.width) {
        ratio = (clientY - rect.top) / rect.height;
      } else {
        ratio = (clientX - rect.left) / rect.width;
      }
      ratio = Math.max(0, Math.min(1, ratio));
      try { media.currentTime = ratio * media.duration; } catch { }
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
      seekTo(e.clientX, e.clientY);
    });

    progress.addEventListener('pointermove', e => {
      if (!dragging || e.pointerId !== activePid) return;
      e.preventDefault();
      seekTo(e.clientX, e.clientY);
    });

    progress.addEventListener('pointerup', endSeek);
    progress.addEventListener('pointercancel', endSeek);
  }
})();