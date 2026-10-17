(() => {
  const BUNDLE = 'com.wujinb.metromap';

  const CITIES = [
    { id: 'shanghai', name: '上海', map: './assets/com.wujinb.metromap/shanghai.png' },
    { id: 'beijing', name: '北京', map: './assets/com.wujinb.metromap/beijing.png' },
    { id: 'hangzhou', name: '青岛', map: './assets/com.wujinb.metromap/qingdao.jpg' },
    { id: 'chengdu', name: '成都', map: './assets/com.wujinb.metromap/chengdu.jpg' },
  ];

  const SVG_ARROW = `<svg class="mm-item__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`;
  const SVG_BACK  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;

  const DEFAULT_ZOOM = 6;

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '地铁图',
    icon: './assets/metromap.svg',
    initialRoute: 'home',
    version: '1.0.3',
    styles: `
      .mm-page {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: calc(var(--wj-pad) + var(--statusbar-h)) var(--wj-pad) var(--wj-pad);
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .mm-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .mm-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 17px 16px;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font-size: 16px;
        font-weight: 500;
        letter-spacing: .3px;
        cursor: pointer;
        transition: transform .12s ease, background .15s ease;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }

      .mm-item:active {
        transform: scale(.98);
        background: #dae2f0;
      }

      .mm-item__arrow {
        flex: 0 0 16px;
        width: 16px;
        height: 16px;
        color: var(--wj-text-dim);
        display: block;
      }

      .mm-end {
        text-align: center;
        font-size: var(--wj-fs-xs, 12px);
        color: var(--wj-text-dim);
        letter-spacing: .5px;
        padding: 8px 0 4px;
      }

      /* ==================== 地图页 ==================== */
      .mm-map {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        overflow: hidden;
      }

      .mm-map__bar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: var(--statusbar-h) 12px 8px;
        background: var(--wj-bg);
        border-bottom: .5px solid var(--wj-border, #e6e9ef);
        z-index: 2;
      }

      .mm-back {
        flex: 0 0 auto;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform .08s ease, background .15s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .mm-back:active {
        transform: scale(.92);
        background: #dae2f0;
      }
      .mm-back svg {
        width: 18px;
        height: 18px;
        display: block;
      }

      .mm-map__title {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 17px;
        font-weight: 600;
        color: var(--wj-text);
        letter-spacing: .5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mm-zoom {
        flex: 0 0 auto;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 20px;
        font-weight: 600;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform .08s ease, background .15s ease, opacity .15s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .mm-zoom:active:not(:disabled) {
        transform: scale(.92);
        background: #dae2f0;
      }
      .mm-zoom:disabled {
        opacity: .35;
        cursor: default;
      }

      .mm-viewport {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        background: #eef3fa;
        touch-action: none;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .mm-viewport.is-grabbing {
        cursor: grabbing;
      }

      .mm-image {
        position: absolute;
        left: 0;
        top: 0;
        max-width: none;
        max-height: none;
        display: block;
        transform-origin: 0 0;
        will-change: transform;
        opacity: 0;
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
      }
      .mm-image.is-ready {
        opacity: 1;
        transition: opacity .18s ease;
      }

      .mm-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        font-size: 14px;
        color: var(--wj-text-muted);
        letter-spacing: .5px;
        pointer-events: none;
        background: #eef3fa;
        z-index: 1;
      }
      .mm-loading[hidden] {
        display: none !important;
      }

      .mm-spinner {
        width: 34px;
        height: 34px;
        box-sizing: border-box;
        border: 3px solid rgba(58, 111, 240, .18);
        border-top-color: #3a6ff0;
        border-radius: 50%;
        animation: mm-spin .8s linear infinite;
      }
      @keyframes mm-spin {
        to { transform: rotate(360deg); }
      }
    `,

    routes: {
      /* ==================== 主页 ==================== */
      home: {
        name: 'home',

        render() {
          return `
            <div class="mm-page">
              <h2 class="wj-title">地铁图</h2>

              <div class="mm-list">
                ${CITIES.map(c => `
                  <div class="mm-item" data-city="${c.id}">
                    <span>${c.name}</span>
                    ${SVG_ARROW}
                  </div>
                `).join('')}
              </div>

              <div class="mm-end">没有更多了</div>
            </div>
          `;
        },

        mount(root, ctx) {
          root.querySelectorAll('.mm-item').forEach(el => {
            el.addEventListener('click', () => {
              if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
              ctx.push('map', { cityId: el.dataset.city });
            });
          });
        },
      },

      /* ==================== 地图查看页 ==================== */
      map: {
        name: 'map',
        disableBackGesture: true,

        render(routeCtx) {
          const city =
            CITIES.find(c => c.id === routeCtx.data?.cityId) || CITIES[0];

          /* ★ <img> 不写 src，由 JS 接管，避免浏览器提前解码卡主线程 */
          return `
            <div class="mm-map">
              <div class="mm-map__bar">
                <button class="mm-back" id="mmBack" type="button" aria-label="返回">
                  ${SVG_BACK}
                </button>
                <div class="mm-map__title">${city.name}</div>
                <button class="mm-zoom" data-zoom="out" type="button" aria-label="缩小">−</button>
                <button class="mm-zoom" data-zoom="in"  type="button" aria-label="放大">+</button>
              </div>

              <div class="mm-viewport" id="mmViewport">
                <img class="mm-image" id="mmImage"
                     alt="${city.name}地铁图"
                     draggable="false">
                <div class="mm-loading" id="mmLoading">
                  <div class="mm-spinner"></div>
                  <div class="mm-loading__text">加载中...</div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const city =
            CITIES.find(c => c.id === ctx.data?.cityId) || CITIES[0];

          const viewport   = root.querySelector('#mmViewport');
          const image      = root.querySelector('#mmImage');
          const loading    = root.querySelector('#mmLoading');
          const backBtn    = root.querySelector('#mmBack');
          const zoomInBtn  = root.querySelector('[data-zoom="in"]');
          const zoomOutBtn = root.querySelector('[data-zoom="out"]');

          let vw = 0, vh = 0;
          let iw = 0, ih = 0;
          let minScale = 1, maxScale = 6;
          let scale = 1, tx = 0, ty = 0;
          let ready = false;
          let destroyed = false;

          /* ---------- 变换 ---------- */
          function apply() {
            image.style.transform =
              `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
          }

          function clampPan() {
            const w = iw * scale;
            const h = ih * scale;
            if (w <= vw) tx = (vw - w) / 2;
            else tx = Math.min(0, Math.max(vw - w, tx));
            if (h <= vh) ty = (vh - h) / 2;
            else ty = Math.min(0, Math.max(vh - h, ty));
          }

          function updateZoomButtons() {
            if (zoomInBtn)  zoomInBtn.disabled  = scale >= maxScale - 1e-6;
            if (zoomOutBtn) zoomOutBtn.disabled = scale <= minScale + 1e-6;
          }

          function setScale(target, anchorX, anchorY) {
            const ns = Math.max(minScale, Math.min(maxScale, target));
            if (Math.abs(ns - scale) < 1e-6) return;
            const ax = (anchorX === undefined) ? vw / 2 : anchorX;
            const ay = (anchorY === undefined) ? vh / 2 : anchorY;
            const k = ns / scale;
            tx = ax - (ax - tx) * k;
            ty = ay - (ay - ty) * k;
            scale = ns;
            clampPan();
            apply();
            updateZoomButtons();
          }

          function fit() {
            vw = viewport.clientWidth;
            vh = viewport.clientHeight;
            if (!iw || !ih || !vw || !vh) return;
            minScale = Math.min(vw / iw, vh / ih);
            maxScale = minScale * 8;
            scale = minScale * DEFAULT_ZOOM;
            tx = 0;
            ty = 0;
            clampPan();
            apply();
            updateZoomButtons();
          }

          /* ---------- 加载 + 预解码 ---------- */
          async function loadAndDecode() {
            image.src = city.map;

            try {
              if (!image.complete) {
                await new Promise((resolve, reject) => {
                  image.addEventListener('load',  resolve, { once: true });
                  image.addEventListener('error', () => reject(new Error('load failed')), { once: true });
                });
              }

              /* 强制在后台把整张图解码成位图 */
              if (typeof image.decode === 'function') {
                await image.decode();
              }
            } catch (e) {
              if (!destroyed && loading) {
                loading.innerHTML = '<div class="mm-loading__text">图片加载失败</div>';
              }
              return;
            }

            if (destroyed) return;

            iw = image.naturalWidth  || 0;
            ih = image.naturalHeight || 0;
            if (!iw || !ih) return;

            /* 让浏览器把 loading 完整画出来，再切换 */
            await new Promise(r =>
              requestAnimationFrame(() => requestAnimationFrame(r))
            );
            if (destroyed) return;

            fit();

            loading.hidden = true;
            image.classList.add('is-ready');

            ready = true;
          }

          loadAndDecode();

          /* ---------- 拖动 / 双指缩放 ---------- */
          const pts = new Map();
          let mode = null;
          let panStart = null;
          let pinchStart = null;

          const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
          const mid  = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

          function onPointerDown(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (!ready) return;
            try { viewport.setPointerCapture(e.pointerId); } catch { }

            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (pts.size === 1) {
              mode = 'pan';
              panStart = { x: e.clientX, y: e.clientY, tx, ty };
              viewport.classList.add('is-grabbing');
            } else if (pts.size === 2) {
              const [a, b] = [...pts.values()];
              mode = 'pinch';
              pinchStart = {
                d: Math.max(1, dist(a, b)),
                m: mid(a, b),
                scale, tx, ty,
              };
            }
          }

          function onPointerMove(e) {
            if (!pts.has(e.pointerId)) return;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (mode === 'pan' && pts.size === 1 && panStart) {
              tx = panStart.tx + (e.clientX - panStart.x);
              ty = panStart.ty + (e.clientY - panStart.y);
              clampPan();
              apply();
              return;
            }

            if (mode === 'pinch' && pts.size === 2 && pinchStart) {
              const [a, b] = [...pts.values()];
              const d = dist(a, b);
              const m = mid(a, b);
              const ns = Math.max(
                minScale,
                Math.min(maxScale, pinchStart.scale * (d / pinchStart.d))
              );
              const k = ns / pinchStart.scale;
              tx = m.x - (pinchStart.m.x - pinchStart.tx) * k;
              ty = m.y - (pinchStart.m.y - pinchStart.ty) * k;
              scale = ns;
              clampPan();
              apply();
              updateZoomButtons();
            }
          }

          function releasePointer(e) {
            if (!pts.has(e.pointerId)) return;
            pts.delete(e.pointerId);
            if (pts.size === 0) {
              mode = null;
              panStart = null;
              pinchStart = null;
              viewport.classList.remove('is-grabbing');
            } else if (pts.size === 1) {
              const p = [...pts.values()][0];
              mode = 'pan';
              panStart = { x: p.x, y: p.y, tx, ty };
              pinchStart = null;
              viewport.classList.add('is-grabbing');
            }
          }

          viewport.addEventListener('pointerdown', onPointerDown);
          viewport.addEventListener('pointermove', onPointerMove);
          viewport.addEventListener('pointerup', releasePointer);
          viewport.addEventListener('pointercancel', releasePointer);

          /* ---------- 滚轮缩放（桌面端） ---------- */
          function onWheel(e) {
            if (!ready) return;
            e.preventDefault();
            const rect = viewport.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const factor = Math.exp(-e.deltaY * 0.0015);
            setScale(scale * factor, mx, my);
          }
          viewport.addEventListener('wheel', onWheel, { passive: false });

          /* ---------- 顶栏按钮 ---------- */
          backBtn?.addEventListener('click', () => {
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
            ctx.pop();
          });
          zoomInBtn?.addEventListener('click', () => setScale(scale * 1.5));
          zoomOutBtn?.addEventListener('click', () => setScale(scale / 1.5));

          /* ---------- 尺寸变化 ---------- */
          function onResize() {
            if (!ready) return;
            const nvw = viewport.clientWidth;
            const nvh = viewport.clientHeight;
            if (!nvw || !nvh || (nvw === vw && nvh === vh)) return;

            const icx = (vw / 2 - tx) / scale;
            const icy = (vh / 2 - ty) / scale;

            vw = nvw; vh = nvh;
            minScale = Math.min(vw / iw, vh / ih);
            maxScale = minScale * 8;
            scale = Math.max(scale, minScale);

            tx = vw / 2 - icx * scale;
            ty = vh / 2 - icy * scale;

            clampPan();
            apply();
            updateZoomButtons();
          }
          window.addEventListener('resize', onResize);

          return () => {
            destroyed = true;
            window.removeEventListener('resize', onResize);
            pts.clear();
            mode = null;
            panStart = null;
            pinchStart = null;
          };
        },
      },
    },
  });
})();