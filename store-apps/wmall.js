(() => {
  const DATA_URL = './assets/com.wujinb.wmall/products.json';

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
    version: '1.0.7',
    styles: `
  .wmall-page {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 0 0 34px;
    padding-top: calc(var(--wj-pad) + var(--statusbar-h));
    background: var(--wj-bg);
    display: flex;
    flex-direction: column;
  }

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
  }

  .wmall-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 17px;
    padding: 20px 20px 0;
  }

  .wmall-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 20px 14px 17px;
    border-radius: 22px;
    background: var(--wj-bg-alt);
    text-align: center;
    transition: transform .12s, background .15s;
    -webkit-tap-highlight-color: transparent;
  }
  .wmall-card:active { transform: scale(.96); background: #dae2f0; }

  .wmall-card__icon {
    width: 100%;
    aspect-ratio: 1;
    max-width: 126px;
    border-radius: 20px;
    overflow: hidden;
    background: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 11px rgba(15, 20, 45, .08);
  }
  .wmall-card__icon img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .wmall-card__name {
    font-size: var(--wj-fs-sm);
    color: var(--wj-text);
    line-height: 1.3;
    max-width: 100%;
  }

  .wmall-card__price {
    font-size: var(--wj-fs-lg);
    font-weight: 600;
    color: #e0356b;
    letter-spacing: .3px;
  }
  .wmall-card__price::before {
    content: "¥";
    font-size: var(--wj-fs-xs);
    margin-right: 1px;
  }

  .wmall-end {
    text-align: center;
    font-size: var(--wj-fs-xs);
    color: var(--wj-text-dim);
    padding: 25px 20px 8px;
    letter-spacing: .5px;
  }

  /* ==================== 加载中 ==================== */
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

  /* ==================== 详情页 ==================== */
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
    aspect-ratio: 16 / 9;
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
    gap: 4px;
    padding: 3px 10px 3px 3px;
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
  .wmall-chip img {
    width: 36px; height: 36px;
    border-radius: 50%;
    object-fit: cover;
    background: #fff;
    display: block;
    pointer-events: none;
    -webkit-user-drag: none;
  }
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

  .wmall-checkout__ad {
    margin-top: auto;
    width: calc(100% + 56px);
    margin-left: -20px;
    margin-right: -20px;
    display: block;
    -webkit-tap-highlight-color: transparent;
  }
  .wmall-checkout__ad img {
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
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
  .wmall-checkout__error[hidden] {
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

            const [first, ...rest] = products;

            bodyEl.innerHTML = `
              <div class="wmall-banner" data-id="${esc(first.id)}">
                <img src="${esc(first.banner || first.icon)}" alt="${esc(first.name)}">
              </div>

              <div class="wmall-grid">
                ${rest.map(p => `
                  <div class="wmall-card" data-id="${esc(p.id)}">
                    <div class="wmall-card__icon">
                      <img src="${esc(p.icon)}" alt="${esc(p.name)}">
                    </div>
                    <div class="wmall-card__name">${esc(p.name)}</div>
                    <div class="wmall-card__price">${p.price}</div>
                  </div>
                `).join('')}
              </div>

              <div class="wmall-end">没有更多了</div>
            `;

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

          return () => { cancelled = true; };
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
                            <img src="${esc(c.image)}" alt="">
                            <span>${esc(c.text)}</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                  ${renderSpecs(product.specs)}
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

              <div class="wmall-checkout__ad">
                <img src="./assets/com.wujinb.wmall/ad_bar.png" alt="">
              </div>
            </div>
          `;
        },

        mount(root) {
          if (this._timer) { clearTimeout(this._timer); this._timer = null; }

          const token = ++this._token;
          const loading = root.querySelector('#wjPayLoading');
          const error = root.querySelector('#wjPayError');

          this._timer = setTimeout(() => {
            this._timer = null;
            if (token !== this._token) return;
            if (!loading?.isConnected || !error?.isConnected) return;

            if (navigator.vibrate) { try { navigator.vibrate([40, 60, 120]); } catch { } }

            loading.hidden = true;
            error.hidden = false;
            error.classList.add('is-angry');

            if (navigator.vibrate) {
              try { navigator.vibrate([80, 40, 80, 40, 200]); } catch { }
            }
          }, 3000);
        },

        unmount() {
          this._token++;

          if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
          }
        },
      },
    },
  });
})();