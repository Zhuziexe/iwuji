(() => {
  const BUNDLE = 'com.wujinb.radio';
  const API_BASE = 'https://de1.api.radio-browser.info/json/stations/search';
  const ICON_URL = './assets/radio.svg';
  const REQUEST_TIMEOUT = 10000;
  const LIST_LIMIT = 30;

  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5 19 12 7 19.5z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.4"/><rect x="14" y="5" width="4" height="14" rx="1.4"/></svg>`;
  const ICON_STOP = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

  let activeAudio = null;   // 模块级引用，onShutdown 时兜底停止

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /* 音量曲线：和 piano.js 完全一致，保证系统内所有媒体音量感知统一 */
  function computeGain(volume100) {
    const v = Math.max(0, Math.min(100, Number(volume100) || 0)) / 100;
    const g = Math.pow(v, 1.6) * 0.9;
    return Math.max(0, Math.min(1, g));
  }

  /* 过滤掉 HLS / 非 MP3-AAC-OGG 的流，避免点了没声音 */
  function isPlayable(st) {
    if (!st || !st.url_resolved) return false;
    const url = st.url_resolved;
    if (/\.m3u8(\?|$)/i.test(url)) return false;
    if (st.codec && !/mp3|aac|ogg|opus/i.test(st.codec)) return false;
    return true;
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际电台',
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.0.0',

    onShutdown() {
      if (activeAudio) {
        try {
          activeAudio.pause();
          activeAudio.removeAttribute('src');
          activeAudio.load();
        } catch { }
        activeAudio = null;
      }
    },

    styles: `
      .rd-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }

      .rd-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 14px 6px;
      }
      .rd-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
      }
      .rd-count {
        font-size: 12px;
        color: var(--wj-text-dim);
        font-variant-numeric: tabular-nums;
      }

      .rd-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 0 14px;
        /* 底部留出播放条的高度，避免最后一项被遮 */
        padding-bottom: 92px;
      }

      .rd-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .rd-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--wj-bg-alt);
        cursor: pointer;
        transition: background .15s, transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .rd-item:active { transform: scale(.985); background: #dae2f0; }
      .rd-item.is-playing {
        background: rgba(58, 111, 240, .12);
        box-shadow: inset 0 0 0 1px rgba(58, 111, 240, .35);
      }

      .rd-item__icon {
        flex: 0 0 36px;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #5856d6, #3a6ff0);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 18px;
        overflow: hidden;
      }
      .rd-item__icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .rd-item__main {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .rd-item__name {
        font-size: 14px;
        font-weight: 600;
        color: var(--wj-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rd-item__meta {
        font-size: 11px;
        color: var(--wj-text-dim);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rd-item__status {
        flex: 0 0 auto;
        font-size: 11px;
        color: var(--wj-primary, #3a6ff0);
        font-weight: 600;
        letter-spacing: .3px;
      }

      /* ---------- 底部播放条 ---------- */
      .rd-player {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
        background: var(--wj-bg);
        border-top: 1px solid var(--wj-border, #e6e9ef);
        box-shadow: 0 -4px 16px rgba(0,0,0,.06);
        transform: translateY(100%);
        transition: transform .25s ease;
      }
      .rd-player.is-show { transform: translateY(0); }

      .rd-player__icon {
        flex: 0 0 36px;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #5856d6, #3a6ff0);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 18px;
        overflow: hidden;
      }
      .rd-player__icon img { width: 100%; height: 100%; object-fit: cover; }

      .rd-player__info {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .rd-player__name {
        font-size: 13px;
        font-weight: 600;
        color: var(--wj-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rd-player__status {
        font-size: 11px;
        color: var(--wj-text-dim);
        letter-spacing: .3px;
      }
      .rd-player__status.is-error { color: var(--wj-danger, #e0356b); }

      .rd-player__btn {
        flex: 0 0 auto;
        width: 38px;
        height: 38px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
      }
      .rd-player__btn svg { width: 16px; height: 16px; display: block; }
      .rd-player__btn--stop { background: var(--wj-bg-alt); color: var(--wj-text-muted); }
      .rd-player__btn:active { transform: scale(.92); }

      /* ---------- 状态 ---------- */
      .rd-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 60px 24px;
        text-align: center;
      }
      .rd-spinner {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid rgba(58,111,240,.18);
        border-top-color: #3a6ff0;
        animation: rd-spin .85s linear infinite;
      }
      @keyframes rd-spin { to { transform: rotate(360deg); } }
      .rd-state__text {
        font-size: 14px;
        color: var(--wj-text-muted);
        line-height: 1.6;
      }
      .rd-state__retry {
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

      /* ---------- Toast ---------- */
      .rd-toast {
        position: absolute;
        left: 50%;
        bottom: 100px;
        transform: translateX(-50%) translateY(10px);
        padding: 8px 18px;
        border-radius: 999px;
        background: rgba(0,0,0,.78);
        color: #fff;
        font-size: 12px;
        letter-spacing: .5px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity .22s, transform .22s;
        z-index: 20;
      }
      .rd-toast.is-show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="rd-page">
              <div class="rd-header">
                <div class="rd-title">吴际电台</div>
                <div class="rd-count" id="rdCount"></div>
              </div>
              <div class="rd-body" id="rdBody">
                <div class="rd-state">
                  <div class="rd-spinner"></div>
                  <div class="rd-state__text">正在加载电台…</div>
                </div>
              </div>
              <div class="rd-player" id="rdPlayer">
                <div class="rd-player__icon" id="rdPlayerIcon">📻</div>
                <div class="rd-player__info">
                  <div class="rd-player__name" id="rdPlayerName">—</div>
                  <div class="rd-player__status" id="rdPlayerStatus">正在播放</div>
                </div>
                <button class="rd-player__btn rd-player__btn--stop" id="rdStopBtn" type="button" aria-label="停止">
                  ${ICON_STOP}
                </button>
                <button class="rd-player__btn" id="rdPlayBtn" type="button" aria-label="播放/暂停">
                  ${ICON_PLAY}
                </button>
              </div>
              <div class="rd-toast" id="rdToast"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const bodyEl = root.querySelector('#rdBody');
          const countEl = root.querySelector('#rdCount');
          const playerEl = root.querySelector('#rdPlayer');
          const playerIconEl = root.querySelector('#rdPlayerIcon');
          const playerNameEl = root.querySelector('#rdPlayerName');
          const playerStatusEl = root.querySelector('#rdPlayerStatus');
          const playBtn = root.querySelector('#rdPlayBtn');
          const stopBtn = root.querySelector('#rdStopBtn');

          const audio = new Audio();
          audio.preload = 'none';
          activeAudio = audio;

          let stations = [];
          let currentStation = null;
          let disposed = false;
          let toastTimer = null;

          /* ================================================================
             音量同步：唯一数据源是 Store('wujios.volume')
             所有入口（控制中心滑块、硬件音量键、设置滑块）最终都 emit 这个事件
             ================================================================ */
          function applyVolume() {
            const v = Store.get('wujios.volume', 60);
            audio.volume = computeGain(v);
          }

          function onVolumeChange() {
            applyVolume();
          }

          // 静音/响铃切换不影响媒体音量（和钢琴一致）
          // 如果以后产品上要求"静音模式也静音电台"，在这里判断 Store.get('wujios.soundmode')
          function onToggleChange() {
            // 当前不做处理，保持媒体音频独立
          }

          window.addEventListener('wuji:cc-volume-change', onVolumeChange);
          window.addEventListener('wuji:cc-toggle-change', onToggleChange);

          // 初始音量
          applyVolume();

          /* ---------- 工具 ---------- */
          function toast(msg, ms = 1800) {
            const el = root.querySelector('#rdToast');
            if (!el) return;
            el.textContent = msg;
            el.classList.add('is-show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => el.classList.remove('is-show'), ms);
          }

          function fmtMeta(st) {
            const parts = [];
            if (st.country) parts.push(st.country);
            if (st.tags) {
              const firstTag = String(st.tags).split(',').map(t => t.trim()).filter(Boolean)[0];
              if (firstTag && firstTag.length < 12) parts.push(firstTag);
            }
            if (st.bitrate) parts.push(`${st.bitrate}kbps`);
            return parts.join(' · ') || '电台';
          }

          /* ---------- 网络 ---------- */
          async function fetchStations() {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
            try {
              // language=chinese 覆盖普通话/粤语等，order=clickcount 按热度排
              const url = `${API_BASE}?language=chinese&limit=${LIST_LIMIT * 2}&order=clickcount&reverse=true&hidebroken=true`;
              const res = await fetch(url, {
                signal: ctrl.signal,
                cache: 'no-store',
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              if (!Array.isArray(data)) throw new Error('返回格式异常');
              return data.filter(isPlayable).slice(0, LIST_LIMIT);
            } finally {
              clearTimeout(timer);
            }
          }

          /* ---------- 渲染列表 ---------- */
          function renderList() {
            if (!stations.length) {
              bodyEl.innerHTML = `
                <div class="rd-state">
                  <div class="rd-state__text">没有找到可用电台</div>
                  <button class="rd-state__retry" id="rdRetryBtn" type="button">重试</button>
                </div>
              `;
              bodyEl.querySelector('#rdRetryBtn')?.addEventListener('click', () => load());
              return;
            }

            countEl.textContent = `${stations.length} 个电台`;

            bodyEl.innerHTML = `
              <div class="rd-list">
                ${stations.map((st, i) => `
                  <div class="rd-item" data-idx="${i}">
                    <div class="rd-item__icon">${st.favicon
                      ? `<img src="${escapeHtml(st.favicon)}" alt="" loading="lazy">`
                      : '📻'
                    }</div>
                    <div class="rd-item__main">
                      <div class="rd-item__name">${escapeHtml(st.name || '未命名电台')}</div>
                      <div class="rd-item__meta">${escapeHtml(fmtMeta(st))}</div>
                    </div>
                    <div class="rd-item__status" data-status="${i}"></div>
                  </div>
                `).join('')}
              </div>
            `;

            // 缩略图加载失败 → 换成 emoji
            bodyEl.querySelectorAll('.rd-item__icon img').forEach(img => {
              img.addEventListener('error', () => {
                const box = img.parentElement;
                if (box) box.textContent = '📻';
              }, { once: true });
            });

            // 点击
            bodyEl.querySelectorAll('.rd-item').forEach(el => {
              el.addEventListener('click', () => {
                const idx = Number(el.dataset.idx);
                const st = stations[idx];
                if (!st) return;
                if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
                playStation(st);
              });
            });

            updateListHighlight();
          }

          function updateListHighlight() {
            bodyEl.querySelectorAll('.rd-item').forEach((el, i) => {
              const st = stations[i];
              const on = currentStation && st && st.stationuuid === currentStation.stationuuid;
              el.classList.toggle('is-playing', !!on);
              const statusEl = el.querySelector('.rd-item__status');
              if (statusEl) {
                if (on) {
                  statusEl.textContent = audio.paused ? '已暂停' : '正在播';
                } else {
                  statusEl.textContent = '';
                }
              }
            });
          }

          /* ---------- 播放条 ---------- */
          function updatePlayerUI() {
            if (!currentStation) {
              playerEl.classList.remove('is-show');
              return;
            }

            playerEl.classList.add('is-show');
            playerNameEl.textContent = currentStation.name || '未命名电台';

            // 图标
            if (currentStation.favicon) {
              playerIconEl.innerHTML = `<img src="${escapeHtml(currentStation.favicon)}" alt="">`;
              const img = playerIconEl.querySelector('img');
              img.addEventListener('error', () => {
                playerIconEl.textContent = '📻';
              }, { once: true });
            } else {
              playerIconEl.textContent = '📻';
            }

            // 状态
            if (playerStatusEl.classList.contains('is-error')) {
              // 保留错误文案
            } else {
              playerStatusEl.textContent = audio.paused ? '已暂停' : '正在播放';
            }

            // 播放/暂停按钮图标
            playBtn.innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE;

            updateListHighlight();
          }

          function setStatusError(msg) {
            playerStatusEl.textContent = msg;
            playerStatusEl.classList.add('is-error');
            setTimeout(() => {
              if (!root.isConnected) return;
              playerStatusEl.classList.remove('is-error');
              if (currentStation) {
                playerStatusEl.textContent = audio.paused ? '已暂停' : '正在播放';
              }
            }, 3000);
          }

          /* ---------- 播放控制 ---------- */
          function playStation(st) {
            // 同一个电台 → 切换播放/暂停
            if (currentStation && st.stationuuid === currentStation.stationuuid) {
              if (audio.paused) {
                audio.play().catch(err => {
                  console.warn('[radio] play 失败', err);
                  setStatusError('播放失败');
                });
              } else {
                audio.pause();
              }
              return;
            }

            // 切换电台
            currentStation = st;
            playerStatusEl.classList.remove('is-error');
            playerStatusEl.textContent = '连接中…';

            try {
              audio.pause();
              audio.removeAttribute('src');
              audio.load();
            } catch { }

            audio.src = st.url_resolved;

            // 切换后重新应用音量（有些浏览器在换 src 后会重置 volume）
            applyVolume();

            audio.play().catch(err => {
              console.warn('[radio] play 失败', err);
              setStatusError('播放失败');
              updatePlayerUI();
            });

            updatePlayerUI();
          }

          function stopPlay() {
            try {
              audio.pause();
              audio.removeAttribute('src');
              audio.load();
            } catch { }
            currentStation = null;
            playerEl.classList.remove('is-show');
            updateListHighlight();
          }

          /* ---------- 音频事件 ---------- */
          audio.addEventListener('play', () => {
            playerStatusEl.classList.remove('is-error');
            playerStatusEl.textContent = '正在播放';
            playBtn.innerHTML = ICON_PAUSE;
            updateListHighlight();
          });

          audio.addEventListener('pause', () => {
            if (!currentStation) return;
            playerStatusEl.textContent = '已暂停';
            playBtn.innerHTML = ICON_PLAY;
            updateListHighlight();
          });

          audio.addEventListener('error', () => {
            if (!currentStation) return;
            setStatusError('流不可用');
            updatePlayerUI();
          });

          audio.addEventListener('stalled', () => {
            if (!currentStation) return;
            setStatusError('缓冲中…');
          });

          /* ---------- 按钮 ---------- */
          playBtn.addEventListener('click', () => {
            if (!currentStation) return;
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
            if (audio.paused) {
              audio.play().catch(() => setStatusError('播放失败'));
            } else {
              audio.pause();
            }
          });

          stopBtn.addEventListener('click', () => {
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
            stopPlay();
          });

          /* ---------- 加载 ---------- */
          async function load() {
            bodyEl.innerHTML = `
              <div class="rd-state">
                <div class="rd-spinner"></div>
                <div class="rd-state__text">正在加载电台…</div>
              </div>
            `;
            countEl.textContent = '';

            try {
              stations = await fetchStations();
              if (disposed) return;
              renderList();
            } catch (e) {
              if (disposed) return;
              console.warn('[radio] 加载失败', e);
              bodyEl.innerHTML = `
                <div class="rd-state">
                  <div class="rd-state__text">${
                    e.name === 'AbortError' ? '请求超时' : '加载失败，请检查网络'
                  }</div>
                  <button class="rd-state__retry" id="rdRetryBtn" type="button">重试</button>
                </div>
              `;
              bodyEl.querySelector('#rdRetryBtn')?.addEventListener('click', () => load());
            }
          }

          /* ---------- 全局停止事件（关机时兜底） ---------- */
          function onGlobalStop() {
            stopPlay();
          }
          window.addEventListener('wuji:radio-stop', onGlobalStop);

          load();

          return () => {
            disposed = true;
            clearTimeout(toastTimer);
            window.removeEventListener('wuji:cc-volume-change', onVolumeChange);
            window.removeEventListener('wuji:cc-toggle-change', onToggleChange);
            window.removeEventListener('wuji:radio-stop', onGlobalStop);
            try {
              audio.pause();
              audio.removeAttribute('src');
              audio.load();
            } catch { }
            if (activeAudio === audio) activeAudio = null;
          };
        },
      },
    },
  });
})();