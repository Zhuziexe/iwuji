(() => {
  const BUNDLE = 'com.wujinb.randompic';
  const ICON_URL = './assets/randompic.svg';
  const IMG_URL = 'https://picsum.photos/300/400';
  const LOAD_TIMEOUT = 8000;

  const ICON_REFRESH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`;

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '随机图片',
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.0.1',

    styles: `
      .rp-page {
        position: absolute;
        inset: 0;
        background: #000;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
      }

      .rp-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: opacity .35s ease;
        pointer-events: none;   /* ★ 图片本身不接收事件，交给 pageEl */
      }

      .rp-statusbar-space {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: var(--statusbar-h);
        background: linear-gradient(to bottom, rgba(0,0,0,.55), transparent);
        pointer-events: none;
        z-index: 2;
        transition: opacity .25s ease;
      }

      .rp-bottom-fade {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 168px;
        background: linear-gradient(to top, rgba(0,0,0,.65), transparent);
        pointer-events: none;
        z-index: 2;
        transition: opacity .25s ease;
      }

      .rp-refresh {
        position: absolute;
        right: 22px;
        bottom: calc(28px + env(safe-area-inset-bottom, 0px));
        z-index: 5;
        width: 73px;
        height: 73px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: rgba(255,255,255,.16);
        backdrop-filter: blur(17px);
        -webkit-backdrop-filter: blur(17px);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 20px rgba(0,0,0,.35);
        transition: background .15s, transform .1s, opacity .25s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .rp-refresh:active:not(:disabled) {
        transform: scale(.9);
        background: rgba(255,255,255,.28);
      }
      .rp-refresh:disabled { cursor: default; }
      .rp-refresh svg {
        width: 31px;
        height: 31px;
        display: block;
        transition: transform .3s;
      }
      .rp-refresh.is-loading svg {
        animation: rp-spin .9s linear infinite;
      }
      @keyframes rp-spin { to { transform: rotate(360deg); } }

      /* ★ 沉浸模式：顶部渐变、底部渐变、刷新按钮全部隐藏 */
      .rp-page.is-immersive .rp-statusbar-space,
      .rp-page.is-immersive .rp-bottom-fade,
      .rp-page.is-immersive .rp-refresh {
        opacity: 0;
        pointer-events: none;
      }

      .rp-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        color: rgba(255,255,255,.85);
        font-size: var(--wj-fs-sm);
        letter-spacing: .5px;
        background: #0f1116;
        z-index: 3;
      }

      .rp-spinner {
        width: 45px;
        height: 45px;
        border-radius: 50%;
        border: 4px solid rgba(255,255,255,.18);
        border-top-color: #fff;
        animation: rp-spin .85s linear infinite;
      }

      .rp-error {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        background: #0f1116;
        color: rgba(255,255,255,.85);
        font-size: var(--wj-fs-md);
        text-align: center;
        padding: 42px;
        z-index: 3;
      }
      .rp-error__icon {
        font-size: 62px;
        opacity: .4;
      }
      .rp-error__retry {
        padding: 14px 39px;
        border: 0;
        border-radius: 1399px;
        background: rgba(255,255,255,.14);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .rp-error__retry:active { background: rgba(255,255,255,.24); }

      .rp-toast {
        position: absolute;
        left: 50%;
        bottom: 126px;
        transform: translateX(-50%) translateY(14px);
        padding: 11px 25px;
        border-radius: 1399px;
        background: rgba(0,0,0,.72);
        backdrop-filter: blur(11px);
        color: #fff;
        font-size: var(--wj-fs-xs);
        letter-spacing: .5px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity .22s, transform .22s;
        z-index: 6;
      }
      .rp-toast.is-show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="rp-page" id="rpPage">
              <div class="rp-statusbar-space"></div>
              <div class="rp-bottom-fade"></div>

              <img class="rp-img" id="rpImg" alt="" style="opacity:0">

              <button class="rp-refresh" id="rpRefreshBtn" type="button" aria-label="换一换">
                ${ICON_REFRESH}
              </button>

              <div class="rp-toast" id="rpToast"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const pageEl = root.querySelector('#rpPage');
          const imgEl = root.querySelector('#rpImg');
          const refreshBtn = root.querySelector('#rpRefreshBtn');

          let disposed = false;
          let loading = false;
          let toastTimer = null;
          let firstLoadDone = false;

          function toast(msg, ms = 1800) {
            const el = root.querySelector('#rpToast');
            if (!el) return;
            el.textContent = msg;
            el.classList.add('is-show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => el.classList.remove('is-show'), ms);
          }

          function setLoading(on) {
            loading = on;
            refreshBtn.disabled = on;
            refreshBtn.classList.toggle('is-loading', on);
          }

          function showFirstLoading() {
            const el = document.createElement('div');
            el.className = 'rp-loading';
            el.innerHTML = `
              <div class="rp-spinner"></div>
              <div>正在加载图片…</div>
            `;
            pageEl.appendChild(el);
            return el;
          }

          function showError(msg) {
            const existing = pageEl.querySelector('.rp-error');
            if (existing) existing.remove();

            const el = document.createElement('div');
            el.className = 'rp-error';
            el.innerHTML = `
              <div class="rp-error__icon">🖼️</div>
              <div>${msg || '图片加载失败'}</div>
              <button class="rp-error__retry" type="button">重试</button>
            `;
            el.querySelector('.rp-error__retry').addEventListener('click', () => {
              el.remove();
              loadImage();
            });
            pageEl.appendChild(el);
          }

          async function loadImage() {
            if (loading || disposed) return;
            setLoading(true);

            const oldError = pageEl.querySelector('.rp-error');
            if (oldError) oldError.remove();

            const url = `${IMG_URL}?t=${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

            const preloader = new Image();
            preloader.loading = 'eager';
            preloader.fetchPriority = 'high';

            let settled = false;
            let timer = null;
            let firstLoadingEl = null;

            if (!firstLoadDone) {
              firstLoadingEl = showFirstLoading();
            }

            const finish = (ok) => {
              if (settled) return;
              settled = true;
              if (timer) { clearTimeout(timer); timer = null; }
              if (firstLoadingEl) {
                firstLoadingEl.remove();
                firstLoadingEl = null;
              }
              if (disposed) return;

              setLoading(false);

              if (ok) {
                imgEl.src = preloader.src;
                imgEl.style.opacity = '1';
                imgEl.animate(
                  [{ opacity: 0.3 }, { opacity: 1 }],
                  { duration: 300, easing: 'ease-out' }
                );
              } else {
                toast('图片加载失败');
                if (!firstLoadDone) {
                  showError('图片加载失败，请检查网络后重试');
                }
              }

              firstLoadDone = true;
            };

            preloader.onload = () => finish(true);
            preloader.onerror = () => finish(false);

            timer = setTimeout(() => finish(false), LOAD_TIMEOUT);
            preloader.src = url;
          }

          /* ★ 沉浸模式：整个页面监听，排除按钮 */
          pageEl.addEventListener('click', (e) => {
            // 点到刷新按钮、重试按钮时，不切换沉浸
            if (e.target.closest('.rp-refresh')) return;
            if (e.target.closest('.rp-error__retry')) return;

            pageEl.classList.toggle('is-immersive');
            if (navigator.vibrate) { try { navigator.vibrate(4); } catch { } }
          });

          refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();   // ★ 防止冒泡到 pageEl 触发沉浸切换
            if (loading) return;
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
            loadImage();
          });

          function onKeydown(e) {
            if (!root.isConnected) return;
            if (e.key === ' ' || e.key === 'Enter') {
              if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
              e.preventDefault();
              loadImage();
            }
          }
          window.addEventListener('keydown', onKeydown);

          loadImage();

          return () => {
            disposed = true;
            window.removeEventListener('keydown', onKeydown);
            clearTimeout(toastTimer);
          };
        },
      },
    },
  });
})();