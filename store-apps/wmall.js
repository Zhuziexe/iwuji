(() => {
  const DATA_URL = './assets/com.wujinb.wmall/products.json';
  const WMALL_MIRRORS = [
    file => `https://cdn.jsdelivr.net/gh/zhuziexe/iwuji@HEAD/assets/com.wujinb.wmall/${file}`,
    file => `https://gcore.jsdelivr.net/gh/zhuziexe/iwuji@HEAD/assets/com.wujinb.wmall/${file}`,
    file => `https://githubproxy.cc/https://raw.githubusercontent.com/zhuziexe/iwuji/HEAD/assets/com.wujinb.wmall/${file}`,
  ];

  async function tryMirror(file, idx = 0) {
    if (idx >= WMALL_MIRRORS.length) throw new Error('所有镜像加载失败');
    const url = WMALL_MIRRORS[idx](file);
    try {
      const res = await fetch(url);
      if (res.ok) return url;
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      return tryMirror(file, idx + 1);
    }
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  async function fetchProducts() {
    const url = `${DATA_URL}?t=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return Array.isArray(d.products) ? d.products : [];
  }

  function renderSpecs(specs) {
    if (!Array.isArray(specs) || !specs.length) return '';
    return `
      <div class="wmall-specs">
        <div class="wmall-specs__title">参数</div>
        ${specs.map(s => `
          <div class="wmall-specs__row">
            <span>${esc(s.label)}</span><strong>${esc(s.value)}</strong>
          </div>
          ${s.note ? `<div class="wmall-specs__note">${esc(s.note)}</div>` : ''}
        `).join('')}
      </div>
    `;
  }

  WujiApps.registerInstalled({
    bundlename: 'com.wujinb.wmall',
    name: '吴际商城',
    icon: './assets/wmall.svg',
    initialRoute: 'home',
    version: '1.1.3',
    styles: `
 .wmall-page {
   position: absolute;
   inset: 0;
   isolation: isolate;
   overflow-y: auto;
   -webkit-overflow-scrolling: touch;
   overscroll-behavior: contain;
   padding: 0 0 34px;
   padding-top: calc(var(--wj-pad) + var(--statusbar-h));
   background: var(--wj-bg);
   display: flex;
   flex-direction: column;
 }

 .wmall-banner[hidden] { display: none !important; }
 .wmall-banner {
   width: 100%;
   aspect-ratio: 16 / 9;
   flex-shrink: 0;
   overflow: hidden;
   background: var(--wj-bg-alt);
   position: relative;
   transition: transform .12s;
 }
 .wmall-banner img {
   width: 100%; height: 100%;
   object-fit: cover;
   display: block;
   pointer-events: none;
   user-select: none;
   -webkit-user-drag: none;
   opacity: 0;
   transition: opacity .5s ease;
   position: absolute;
   inset: 0;
 }
 .wmall-banner img.is-active { opacity: 1; }
 .wmall-banner__dots {
   position: absolute;
   left: 0; right: 0; bottom: 8px;
   display: flex; justify-content: center; gap: 6px;
   z-index: 2;
   pointer-events: none;
 }
 .wmall-banner__dot {
   width: 6px; height: 6px; border-radius: 50%;
   background: rgba(255,255,255,.55);
   transition: background .25s, transform .25s;
 }
 .wmall-banner__dot.is-active {
   background: #fff; transform: scale(1.35);
 }

.wmall-grid {
 display: grid;
 grid-template-columns: repeat(2, minmax(0, 1fr));
 gap: 16px;
 padding: 18px 12px 0;
}

.wmall-card {
 display: flex;
 flex-direction: column;
 align-items: stretch;
 gap: 0;
 padding: 0;
 border-radius: 12px;
 background: var(--wj-bg-alt);
 text-align: left;
 overflow: hidden;
 border: 2px solid var(--wj-border, #e6e9ef);
 box-shadow:
   0 4px 12px rgba(15, 20, 45, .09),
   0 1px 3px rgba(15, 20, 45, .05);
 transition: transform .12s, box-shadow .12s, border-color .15s;
 -webkit-tap-highlight-color: transparent;
}
.wmall-card:active {
 transform: scale(.98);
 border-color: #3a6ff0;
 box-shadow: 0 2px 6px rgba(15, 20, 45, .07);
}

.wmall-card__icon {
 width: 100%;
 aspect-ratio: 1 / 1;
 max-width: none;
 flex-shrink: 0;
 border-radius: 0;
 overflow: hidden;
 display: block;
 box-shadow: none;
}
.wmall-card__icon img {
 width: 100%;
 height: 100%;
 object-fit: contain;
 display: block;
 pointer-events: none;
 user-select: none;
 -webkit-user-drag: none;
}

.wmall-card__body {
 padding: 8px 10px 10px;
 display: flex;
 flex-direction: column;
 gap: 2px;
}

.wmall-card__name {
 font-size: var(--wj-fs-md);
 line-height: 1.3;
 color: var(--wj-text);
 text-align: left;
 display: -webkit-box;
 -webkit-line-clamp: 2;
 -webkit-box-orient: vertical;
 overflow: hidden;
 min-height: 2.6em;
}

.wmall-card__price {
 font-size: var(--wj-fs-lg);
 font-weight: 600;
 line-height: 1.2;
 color: #e0356b;
 text-align: left;
 letter-spacing: 0;
 font-variant-numeric: tabular-nums;
}
.wmall-card__price::before {
 content: "¥";
 font-size: var(--wj-fs-sm);
 font-weight: 500;
 margin-right: 1px;
}

 /* 角标绝对定位到图片上，不占卡片高度 */
 .wmall-card__icon { position: relative; }
 /* 商品角标（数据来自 products.json 的 badge 字段） */
 .wmall-badge {
   position: absolute;
   top: 8px;
   left: 8px;
   z-index: 2;
   font-size: var(--wj-fs-xs);
   font-weight: 700;
   line-height: 1;
   padding: 4px 8px;
   border-radius: 6px;
   background: #e0356b;
   color: #fff;
   box-shadow: 0 2px 6px rgba(0,0,0,.18);
 }
 .wmall-badge--new { background: #3a6ff0; }

 /* 详情页店铺行（数据来自 products.json 的 shop 字段） */
 .wmall-shop {
   margin-top: 18px;
   padding-top: 16px;
   border-top: 1px solid var(--wj-border, #e6e9ef);
   font-size: var(--wj-fs-md);
   color: var(--wj-text-muted);
 }
 .wmall-shop::before {
   content: "店铺: ";
   color: var(--wj-text-dim);
 }

 .wmall-end {
   text-align: center;
   font-size: var(--wj-fs-sm);
   color: var(--wj-text-dim);
   padding: 25px 20px 8px;
   letter-spacing: .5px;
 }

 .wmall-loading {
   display: flex;
   flex-direction: column;
   align-items: center;
   justify-content: center;
   gap: 17px;
   padding: 84px 28px;
   color: var(--wj-text-muted);
   font-size: var(--wj-fs-lg);
   letter-spacing: .5px;
 }
 .wmall-loading[hidden] { display: none !important; }

 .wmall-detail {
   position: absolute;
   inset: 0;
   background: var(--wj-bg);
   display: flex;
   flex-direction: column;
 }

 .wmall-detail__scroll {
   flex: 1 1 auto;
   min-height: 0;
   overflow-y: auto;
   -webkit-overflow-scrolling: touch;
   overscroll-behavior: contain;
   padding-top: var(--statusbar-h);
   padding-bottom: 28px;
 }

 .wmall-detail__hero {
   width: 100%;
   aspect-ratio: 4 / 3;
   flex-shrink: 0;
   background: var(--wj-bg-alt);
   display: flex;
   align-items: center;
   justify-content: center;
   overflow: hidden;
 }
 .wmall-detail__hero img {
   height: 100%;
   aspect-ratio: 1;
   object-fit: contain;
   display: block;
   -webkit-user-drag: none;
 }

 .wmall-detail__info {
   padding: 22px 25px 0;
   display: flex;
   flex-direction: column;
   gap: 11px;
 }

 .wmall-detail__name {
   font-size: var(--wj-fs-2xl);
   font-weight: 600;
   color: var(--wj-text);
   letter-spacing: .3px;
 }

 .wmall-detail__price {
   font-size: var(--wj-fs-4xl);
   font-weight: 700;
   letter-spacing: .5px;
 }
 .wmall-detail__price::before {
   content: "¥";
   font-size: var(--wj-fs-lg);
   font-weight: 500;
   margin-right: 3px;
 }
 .wmall-detail__price.is-blue { color: #3a6ff0; }

 .wmall-chips { margin-top: 20px; }

 .wmall-chips__title {
   font-size: var(--wj-fs-lg);
   font-weight: 600;
   color: var(--wj-text);
   margin-bottom: 11px;
 }

 .wmall-chips__list {
   display: flex;
   flex-wrap: wrap;
   gap: 4px;
 }

 .wmall-chip {
   display: inline-flex;
   align-items: center;
   padding: 4px 12px 4px 12px;
   border: 2px solid var(--wj-border, #e6e9ef);
   border-radius: 999px;
   background: var(--wj-bg-alt);
   color: var(--wj-text);
   font: inherit;
   font-size: var(--wj-fs-sm);
   font-weight: 500;
   white-space: nowrap;
   transition: border-color .15s, background .15s, color .15s, transform .1s;
   -webkit-tap-highlight-color: transparent;
 }
 .wmall-chip:active { transform: scale(.96); }
 .wmall-chip.is-active {
   border-color: #3a6ff0;
   background: rgba(58, 111, 240, .10);
   color: #3a6ff0;
 }

 .wmall-specs {
   margin-top: 20px;
   display: flex;
   flex-direction: column;
 }
 .wmall-specs__title {
   font-size: var(--wj-fs-lg);
   font-weight: 600;
   color: var(--wj-text);
   margin-bottom: 6px;
 }
 .wmall-specs__row {
   display: flex;
   align-items: flex-start;
   justify-content: space-between;
   gap: 17px;
   padding: 15px 0;
   border-bottom: .5px solid var(--wj-border, #e6e9ef);
   font-size: var(--wj-fs-sm);
 }
 .wmall-specs__row span {
   flex: 0 0 auto;
   color: var(--wj-text-muted);
 }
 .wmall-specs__row strong {
   color: var(--wj-text);
   font-weight: 500;
   text-align: right;
 }
 .wmall-specs__note {
   font-size: var(--wj-fs-xs);
   color: var(--wj-text-dim);
   line-height: 1.6;
   margin-top: 8px;
   padding-right: 6px;
 }
 .wmall-specs__row:has(+ .wmall-specs__note) {
   border-bottom: none;
 }
 .wmall-specs__note:has(+ .wmall-specs__row) {
   border-bottom: .5px solid var(--wj-border, #e6e9ef);
   padding-bottom: 8px;
 }

 .wmall-detail__footer {
   flex: 0 0 auto;
   padding: 14px 22px;
   background: var(--wj-bg);
   border-top: .5px solid var(--wj-border, #e6e9ef);
 }

 .wmall-buy-btn {
   display: block;
   width: 100%;
   padding: 20px 28px;
   border: 0;
   border-radius: 1399px;
   background: #3a6ff0;
   color: #fff;
   font: inherit;
   font-size: var(--wj-fs-lg);
   font-weight: 600;
   transition: transform .1s, background .15s, opacity .15s;
   -webkit-tap-highlight-color: transparent;
 }
 .wmall-buy-btn:active:not(:disabled) {
   transform: scale(.98);
   background: #2c5ad0;
 }
 .wmall-buy-btn:disabled {
   background: var(--wj-bg-alt);
   color: var(--wj-text-dim);
   cursor: not-allowed;
 }

 /* ==================== 结算页 ==================== */
 .wmall-checkout {
   position: absolute;
   inset: 0;
   padding: calc(var(--wj-pad) + var(--statusbar-h)) 28px 0;
   background: var(--wj-bg);
   display: flex;
   flex-direction: column;
   align-items: center;
   gap: 31px;
 }

 .wmall-checkout__title {
   font-size: var(--wj-fs-3xl);
   font-weight: 700;
   color: var(--wj-text);
   letter-spacing: 1px;
   margin-top: 34px;
 }

 .wmall-checkout__amount {
   font-size: 84px;
   font-weight: 700;
   color: #3a6ff0;
   letter-spacing: 1px;
   line-height: 1;
   margin-top: 11px;
 }
 .wmall-checkout__amount::before {
   content: "¥";
   font-size: 42px;
   font-weight: 500;
   margin-right: 6px;
 }
 .wmall-checkout__error {
   font-size: var(--wj-fs-lg);
   font-weight: 600;
   color: #e0356b;
   letter-spacing: .5px;
 }
 .wmall-checkout__error.is-angry {
   animation: wmall-angry .5s cubic-bezier(.36,.07,.19,.97) both;
 }

 @keyframes wmall-angry {
   0%   { transform: translateX(0)    scale(1);   opacity: 0; }
   10%  { transform: translateX(-6px) scale(1.15); opacity: 1; }
   20%  { transform: translateX(8px)  scale(1.15); }
   30%  { transform: translateX(-6px) scale(1.15); }
   40%  { transform: translateX(8px)  scale(1.15); }
   50%  { transform: translateX(-4px) scale(1.1); }
   60%  { transform: translateX(6px)  scale(1.1); }
   100% { transform: translateX(0)    scale(1); }
 }
 .wmall-checkout__loading {
   display: flex;
   flex-direction: column;
   align-items: center;
   gap: 17px;
   font-size: var(--wj-fs-lg);
   color: var(--wj-text-muted);
   letter-spacing: .5px;
 }

 /* ===== 隐藏彩蛋：余额不足 → 观看视频 ===== */
 .wmall-watch-btn {
   margin-top: 8px;
   padding: 14px 34px;
   border: 0;
   border-radius: 999px;
   background: var(--wj-bg-alt);
   color: var(--wj-primary);
   font: inherit;
   font-size: var(--wj-fs-md);
   font-weight: 600;
   cursor: pointer;
   -webkit-tap-highlight-color: transparent;
 }
 .wmall-watch-btn[hidden] { display: none !important; }
 .wmall-watch-btn:active { filter: brightness(.94); }

 /* 视频模式：覆盖整个结算页，无提示、无关闭按钮 */
 .wmall-egg {
   position: absolute;
   inset: 0;
   z-index: 20;
   background: #000;
   display: none;
   align-items: center;
   justify-content: center;
 }
 .wmall-egg.is-on {
   display: flex;
 }
 .wmall-egg video {
   width: 100%;
   height: 100%;
   object-fit: contain;
   display: block;
 }
 .wmall-spinner {
   width: 48px;
   height: 48px;
   box-sizing: border-box;
   border: 4px solid rgba(58, 111, 240, .18);
   border-top-color: #3a6ff0;
   border-radius: 50%;
   animation: wmall-spin .8s linear infinite;
 }

 @keyframes wmall-spin {
   to { transform: rotate(360deg); }
 }

 .wmall-checkout__loading[hidden],
 .wmall-checkout__error[hidden],
 .wmall-watch-btn[hidden] {
   display: none !important;
 }
`,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="wmall-page">
              <h2 class="wj-title" style="margin-left: 25px;">吴际商城</h2>

              <div class="wmall-loading" id="wjHomeLoading">
                <div class="wmall-spinner"></div>
                <div>加载中...</div>
              </div>

              <div id="wjHomeBody"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const loadingEl = root.querySelector('#wjHomeLoading');
          const bodyEl = root.querySelector('#wjHomeBody');
          let cancelled = false;
          let bannerCarouselCleanup = null;

          (async () => {
            let products;
            try {
              products = await fetchProducts();
            } catch (e) {
              if (cancelled || !root.isConnected) return;
              loadingEl.hidden = true;
              bodyEl.innerHTML = `
                <div class="wmall-end">加载失败：${esc(e.message || '网络错误')}</div>
              `;
              return;
            }

            if (cancelled || !root.isConnected) return;
            loadingEl.hidden = true;

            if (!products.length) {
              bodyEl.innerHTML = '<div class="wmall-end">暂无商品</div>';
              return;
            }

            /* banner 轮播：只用带 banner 图（960x540 JPG）的商品 */
            const bannerItems = products.filter(p => p.banner);

            /* 商城感：商品顺序每次打乱；角标来自数据字段 badge */
            function shuffle(arr) {
              const a = arr.slice();
              for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
              }
              return a;
            }
            const shuffled = shuffle(products);

            bodyEl.innerHTML = `
              <div class="wmall-banner" id="wjBanner" data-id="${esc(bannerItems[0]?.id || '')}">
                ${bannerItems.map((p, i) => `
                  <img class="${i === 0 ? 'is-active' : ''}" data-i="${i}"
                       src="${esc(p.banner)}" alt="${esc(p.name)}">`).join('')}
                <div class="wmall-banner__dots">
                  ${bannerItems.map((_, i) => `
                    <span class="wmall-banner__dot ${i === 0 ? 'is-active' : ''}"></span>`).join('')}
                </div>
              </div>

              <div class="wmall-grid">
               ${shuffled.map(p => `
 <div class="wmall-card" data-id="${esc(p.id)}">
   <div class="wmall-card__icon">
     <img src="${esc(p.icon)}" alt="${esc(p.name)}">
     ${p.badge ? `<span class="wmall-badge${p.badge === '新品' ? ' wmall-badge--new' : ''}">${esc(p.badge)}</span>` : ''}
   </div>
   <div class="wmall-card__body">
     <div class="wmall-card__name">${esc(p.name)}</div>
     <div class="wmall-card__price">${p.price}</div>
   </div>
 </div>
`).join('')}
              </div>

              <div class="wmall-end">没有更多了</div>
            `;

            /* ---- 轮播逻辑 ---- */
            const banner = bodyEl.querySelector('#wjBanner');
            if (!bannerItems.length) banner.hidden = true;
            const imgs = [...banner.querySelectorAll('img[data-i]')];
            const dots = [...banner.querySelectorAll('.wmall-banner__dot')];
            let cur = 0;
            let bannerTimer = null;
            function showBanner(i) {
              if (!imgs.length) return;
              cur = (i + imgs.length) % imgs.length;
              imgs.forEach((im, k) => im.classList.toggle('is-active', k === cur));
              dots.forEach((dot, k) => dot.classList.toggle('is-active', k === cur));
              banner.dataset.id = bannerItems[cur].id;
            }
            function startBanner() {
              if (imgs.length < 2) return;
              clearInterval(bannerTimer);
              bannerTimer = setInterval(() => showBanner(cur + 1), 3500);
            }
            startBanner();
            bannerCarouselCleanup = () => clearInterval(bannerTimer);

            bodyEl.querySelectorAll('[data-id]').forEach(el => {
              el.addEventListener('click', () => {
                const product = products.find(p => p.id === el.dataset.id);
                if (product) ctx.push('detail', { product });
              });
            });
          })();

          try {
            WujiNotification.publish({
              bundlename: 'com.wujinb.wmall',
              id: 1001,
              title: '吴际商城',
              content: '快去购买iWuji!',
              showtime: true,
              notifyuser: true,
              clickparams: {},
            });
          } catch { }

          return () => {
            cancelled = true;
            if (bannerCarouselCleanup) bannerCarouselCleanup();
          };
        },
      },

      detail: {
        name: 'detail',

        render(routeCtx) {
          const product = routeCtx.data?.product;
          if (!product) {
            return `
              <div class="wmall-detail">
                <div class="wmall-detail__scroll" style="padding:56px 28px;text-align:center;">
                  商品不存在
                </div>
              </div>
            `;
          }

          const colors = Array.isArray(product.colors) ? product.colors : [];
          const firstColor = colors[0];
          const heroImage = firstColor?.image || product.icon;
          const initialBuyable = colors.length
            ? !!firstColor.buyable
            : product.buyable !== false;

          return `
            <div class="wmall-detail">
              <div class="wmall-detail__scroll">
                <div class="wmall-detail__hero">
                  <img id="wjHeroImg" src="${esc(heroImage)}" alt="${esc(product.name)}">
                </div>

                <div class="wmall-detail__info">
                  <div class="wmall-detail__name">${esc(product.name)}</div>
                  <div class="wmall-detail__price is-blue">${product.price}</div>

                  ${colors.length ? `
                    <div class="wmall-chips" id="wjChips">
                      <div class="wmall-chips__title">颜色</div>
                      <div class="wmall-chips__list">
                        ${colors.map((c, i) => `
                          <div class="wmall-chip${i === 0 ? ' is-active' : ''}"
                               data-image="${esc(c.image)}"
                               data-buyable="${c.buyable ? '1' : '0'}"
                               role="button" tabindex="0">
                            <span>${esc(c.text)}</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                  ${renderSpecs(product.specs)}
                  ${product.shop ? `<div class="wmall-shop">${esc(product.shop)}</div>` : ''}
                </div>
              </div>

              <div class="wmall-detail__footer">
                <button class="wmall-buy-btn" id="wjBuyBtn" type="button"
                        ${initialBuyable ? '' : 'disabled'}>
                  ${initialBuyable ? '立即购买' : '暂时缺货'}
                </button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const product = ctx.data?.product;
          if (!product) return;

          const chips = root.querySelectorAll('.wmall-chip');
          const imgEl = root.querySelector('#wjHeroImg');
          const buyBtn = root.querySelector('#wjBuyBtn');

          chips.forEach(chip => {
            chip.addEventListener('click', () => {
              if (chip.classList.contains('is-active')) return;

              chips.forEach(c => c.classList.remove('is-active'));
              chip.classList.add('is-active');

              if (imgEl) imgEl.src = chip.dataset.image;

              const buyable = chip.dataset.buyable === '1';
              buyBtn.disabled = !buyable;
              buyBtn.textContent = buyable ? '立即购买' : '暂时缺货';
            });
          });

          buyBtn.addEventListener('click', () => {
            if (buyBtn.disabled) return;
            if (navigator.vibrate) { try { navigator.vibrate(10); } catch { } }
            ctx.push('checkout', { price: product.price, name: product.name });
          });
        },
      },

      checkout: {
        name: 'checkout',
        transition: 'slide-up',
        _timer: null,
        _token: 0,

        render(routeCtx) {
          const price = routeCtx.data?.price ?? 0;
          return `
            <div class="wmall-checkout">
              <div class="wmall-checkout__title">吴际支付</div>
              <div class="wmall-checkout__amount">${price}</div>

              <div class="wmall-checkout__loading" id="wjPayLoading">
                <div class="wmall-spinner"></div>
                <div>加载中...</div>
              </div>

              <div class="wmall-checkout__error" id="wjPayError" hidden>余额不足</div>

              <button class="wmall-watch-btn" id="wjWatchBtn" type="button" hidden>观看视频</button>

              <div class="wmall-egg" id="wjEgg">
                <video id="wjEggVideo" loop playsinline preload="none"></video>
              </div>
            </div>
          `;
        },

        async mount(root) {
          if (this._timer) { clearTimeout(this._timer); this._timer = null; }

          const token = ++this._token;
          const loading = root.querySelector('#wjPayLoading');
          const error = root.querySelector('#wjPayError');
          const watchBtn = root.querySelector('#wjWatchBtn');
          const egg = root.querySelector('#wjEgg');
          const video = root.querySelector('#wjEggVideo');
          let detachVolume = null;

          function computeGain(volume100) {
            const v = Math.max(0, Math.min(100, Number(volume100) || 0)) / 100;
            return Math.max(0, Math.min(1, Math.pow(v, 1.6) * 0.9));
          }
          function applyVolume() {
            try { video.volume = computeGain(Store.get('wujios.volume', 60)); } catch { }
          }

          const openEggBound = async () => {
            if (token !== this._token) return;
            if (!egg?.isConnected || !video?.isConnected) return;
            if (navigator.vibrate) { try { navigator.vibrate(10); } catch { } }

            try {
              const videoUrl = await tryMirror('nb.mp4');
              video.src = videoUrl;
            } catch(err) {
              alert('视频所有镜像加载失败');
              return;
            }

            egg.classList.add('is-on');

            applyVolume();
            window.addEventListener('wuji:cc-volume-change', applyVolume);
            detachVolume = () => window.removeEventListener('wuji:cc-volume-change', applyVolume);

            try { video.currentTime = 0; } catch { }
            const p = video.play();
            if (p) p.catch(() => { });
          }

          if (watchBtn) watchBtn.addEventListener('click', openEggBound);

          this._timer = setTimeout(() => {
            this._timer = null;
            if (token !== this._token) return;
            if (!loading?.isConnected || !error?.isConnected) return;

            if (navigator.vibrate) { try { navigator.vibrate([40, 60, 120]); } catch { } }

            loading.hidden = true;
            error.hidden = false;
            error.classList.add('is-angry');
            if (watchBtn) watchBtn.hidden = false;

            if (navigator.vibrate) {
              try { navigator.vibrate([80, 40, 80, 40, 200]); } catch { }
            }
          }, 3000);

          this._eggCleanup = () => {
            try { video.pause(); } catch { }
            if (detachVolume) detachVolume();
          };
        },

        unmount() {
          this._token++;

          if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
          }
          if (this._eggCleanup) {
            this._eggCleanup();
            this._eggCleanup = null;
          }
        },
      },
    },
  });
})();
