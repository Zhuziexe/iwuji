WujiApps.registerInstalled({
  bundlename: 'com.wujinb.wmall',
  name: '吴际商城',
  icon: './assets/wmall.svg',
  initialRoute: 'home',
  version: '1.0.4',
  styles: `
  .wmall-page {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 0 0 24px;
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
    gap: 12px;
    padding: 14px 14px 0;
  }

  .wmall-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px 10px 12px;
    border-radius: 16px;
    background: var(--wj-bg-alt);
    text-align: center;
    transition: transform .12s, background .15s;
    -webkit-tap-highlight-color: transparent;
  }
  .wmall-card:active { transform: scale(.96); background: #dae2f0; }

  .wmall-card__icon {
    width: 100%;
    aspect-ratio: 1;
    max-width: 90px;
    border-radius: 14px;
    overflow: hidden;
    background: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(15, 20, 45, .08);
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
    /*overflow: hidden;*/
    /*text-overflow: ellipsis;*/
    /*white-space: nowrap;*/
  }

  .wmall-card__price {
    font-size: 15px;
    font-weight: 600;
    color: #e0356b;
    letter-spacing: .3px;
  }
  .wmall-card__price::before {
    content: "¥";
    font-size: 11px;
    margin-right: 1px;
  }

  .wmall-end {
    text-align: center;
    font-size: var(--wj-fs-xs);
    color: var(--wj-text-dim);
    padding: 18px 14px 6px;
    letter-spacing: .5px;
  }

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
    padding-bottom: 20px;
  }

  /* hero：16:9 全宽容器，1:1 图片居中 */
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

  /* Info */
  .wmall-detail__info {
    padding: 16px 18px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .wmall-detail__name {
    font-size: 20px;
    font-weight: 600;
    color: var(--wj-text);
    letter-spacing: .3px;
  }

  .wmall-detail__price {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: .5px;
  }
  .wmall-detail__price::before {
    content: "¥";
    font-size: 15px;
    font-weight: 500;
    margin-right: 2px;
  }
  .wmall-detail__price.is-blue { color: #3a6ff0; }

  /* Chips */
  .wmall-chips {
    margin-top: 14px;
  }

  .wmall-chips__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--wj-text);
    margin-bottom: 8px;
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
    padding: 2px 8px 2px 2px;
    border: 1.5px solid var(--wj-border, #e6e9ef);
    border-radius: 999px;
    background: var(--wj-bg-alt);
    color: var(--wj-text);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    transition: border-color .15s, background .15s, color .15s, transform .1s;
    -webkit-tap-highlight-color: transparent;
  }
  .wmall-chip:active { transform: scale(.96); }
  .wmall-chip img {
    width: 26px; height: 26px;
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

  /* Specs */
  .wmall-specs {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
  }
  .wmall-specs__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--wj-text);
    margin-bottom: 4px;
  }
  .wmall-specs__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 0;
    border-bottom: .5px solid var(--wj-border, #e6e9ef);
    font-size: 13px;
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
    font-size: 11px;
    color: var(--wj-text-dim);
    line-height: 1.6;
    margin-top: 6px;
    padding-right: 4px;
  }

  /* 参数行紧跟 note：去掉下边框 */
  .wmall-specs__row:has(+ .wmall-specs__note) {
    border-bottom: none;
  }

  /* note 后面还有参数行：补下边框 */
  .wmall-specs__note:has(+ .wmall-specs__row) {
    border-bottom: .5px solid var(--wj-border, #e6e9ef);
    padding-bottom: 6px;
  }

  /* Footer 固定按钮 */
  .wmall-detail__footer {
    flex: 0 0 auto;
    padding: 10px 16px;
    background: var(--wj-bg);
    border-top: .5px solid var(--wj-border, #e6e9ef);
  }

  .wmall-buy-btn {
    display: block;
    width: 100%;
    padding: 14px 20px;
    border: 0;
    border-radius: 999px;
    background: #3a6ff0;
    color: #fff;
    font: inherit;
    font-size: 16px;
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
    padding: calc(var(--wj-pad) + var(--statusbar-h)) 20px 0;
    background: var(--wj-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
  }

  .wmall-checkout__title {
    font-size: 22px;
    font-weight: 700;
    color: var(--wj-text);
    letter-spacing: 1px;
    margin-top: 24px;
  }

  .wmall-checkout__amount {
    font-size: 60px;
    font-weight: 700;
    color: #3a6ff0;
    letter-spacing: 1px;
    line-height: 1;
    margin-top: 8px;
  }
  .wmall-checkout__amount::before {
    content: "¥";
    font-size: 30px;
    font-weight: 500;
    margin-right: 4px;
  }
  .wmall-checkout__error {
  font-size: 15px;
  font-weight: 600;
  color: #e0356b;
  letter-spacing: .5px;
}

/* 气人模式：出现时抖动 + 放大 */
.wmall-checkout__error.is-angry {
  animation: wmall-angry .5s cubic-bezier(.36,.07,.19,.97) both;
}

@keyframes wmall-angry {
  0%   { transform: translateX(0)    scale(1);   opacity: 0; }
  10%  { transform: translateX(-6px) scale(1.15); opacity: 1; }
  20%  { transform: translateX(6px)  scale(1.15); }
  30%  { transform: translateX(-6px) scale(1.15); }
  40%  { transform: translateX(6px)  scale(1.15); }
  50%  { transform: translateX(-4px) scale(1.1); }
  60%  { transform: translateX(4px)  scale(1.1); }
  100% { transform: translateX(0)    scale(1); }
}
  .wmall-checkout__ad {
    margin-top: auto;
    width: calc(100% + 40px);
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
    gap: 12px;
    font-size: 15px;
    color: var(--wj-text-muted);
    letter-spacing: .5px;
  }
  .wmall-spinner {
    width: 34px;
    height: 34px;
    box-sizing: border-box;
    border: 3px solid rgba(58, 111, 240, .18);
    border-top-color: #3a6ff0;
    border-radius: 50%;
    animation: wmall-spin .8s linear infinite;
  }

  @keyframes wmall-spin {
    to { transform: rotate(360deg); }
  }

  /* hidden 时强制隐藏，避免 display:flex 覆盖 hidden */
  .wmall-checkout__loading[hidden],
  .wmall-checkout__error[hidden] {
    display: none !important;
  }
`,

  routes: {
    home: {
      name: 'home',

      render() {
        const products = [
          { id: 'wujibuds', icon: './assets/com.wujinb.wmall/wujibuds.png', name: 'WujiBuds', price: 599 },
          { id: 'charger', icon: './assets/com.wujinb.wmall/iwuji_charger.png', name: 'iWuji快充充电器', price: 79 },
          { id: 'case', icon: './assets/com.wujinb.wmall/iwuji_baohuke.png', name: 'iWuji透明保护壳', price: 39 },
        ];

        return `
          <div class="wmall-page">
            <h2 class="wj-title" style="margin-left: 18px;">吴际商城</h2>
            <div class="wmall-banner" data-detail="iWuji">
              <img src="./assets/com.wujinb.wmall/iwuji_banner.png" alt="iWuji">
            </div>

            <div class="wmall-grid">
              ${products.map(p => `
                <div class="wmall-card" data-detail="${p.id}">
                  <div class="wmall-card__icon">
                    <img src="${p.icon}" alt="${p.name}">
                  </div>
                  <div class="wmall-card__name">${p.name}</div>
                  <div class="wmall-card__price">${p.price}</div>
                </div>
              `).join('')}
            </div>

            <div class="wmall-end">没有更多了</div>
          </div>
        `;
      },

      mount(root, ctx) {
        root.querySelectorAll('[data-detail]').forEach(el => {
          el.addEventListener('click', () => {
            ctx.push('detail', { id: el.dataset.detail });
          });
        });

        (async () => {
          WujiNotification.publish({
            bundlename: 'com.wujinb.wmall',
            id: 1001,
            title: '吴际商城',
            content: '快去购买iWuji!',
            showtime: true,
            notifyuser: true,
            clickparams: {},
          });
        })()
      },
    },

    detail: {
      name: 'detail',

      render(routeCtx) {
        const id = routeCtx.data?.id;
        if (id === 'iWuji') {
          return `
            <div class="wmall-detail">
              <div class="wmall-detail__scroll">
                <div class="wmall-detail__hero">
                  <img id="wjPhoneImg"
                       src="./assets/com.wujinb.wmall/iwuji_blue.png"
                       alt="iWuji">
                </div>

                <div class="wmall-detail__info">
                  <div class="wmall-detail__name">iWuji</div>
                  <div class="wmall-detail__price is-blue">2999</div>

                  <div class="wmall-chips" id="wjChips">
                    <div class="wmall-chips__title">颜色</div>
                    <div class="wmall-chips__list">
                      <div class="wmall-chip is-active" data-color="blue" role="button" tabindex="0">
                        <img src="./assets/com.wujinb.wmall/iwuji_blue.png" alt="">
                        <span>牛逼蓝</span>
                      </div>
                      <div class="wmall-chip" data-color="white" role="button" tabindex="0">
                        <img src="./assets/com.wujinb.wmall/iwuji_white.png" alt="">
                        <span>牛逼白</span>
                      </div>
                      <div class="wmall-chip" data-color="black" role="button" tabindex="0">
                        <img src="./assets/com.wujinb.wmall/iwuji_black.png" alt="">
                        <span>牛逼黑</span>
                      </div>
                    </div>
                  </div>

                  <div class="wmall-specs">
                    <div class="wmall-specs__title">参数</div>

                    <div class="wmall-specs__row">
                      <span>运行内存(RAM)</span><strong>4GB</strong>
                    </div>
                    <div class="wmall-specs__row">
                      <span>机身内存(ROM)</span><strong>64GB</strong>
                    </div>
                    <div class="wmall-specs__note">
                      *可使用的内存容量小于此值，因为手机软件占用部分空间。
                    </div>

                    <div class="wmall-specs__row" style="margin-top:6px">
                      <span>操作系统</span><strong>WujiOS</strong>
                    </div>
                    <div class="wmall-specs__row">
                      <span>电池容量</span><strong>4720 mAh（典型值）</strong>
                    </div>
                    <div class="wmall-specs__note">
                      *电池额定容量为 4610mAh。
                    </div>
                  </div>
                </div>
              </div>

              <div class="wmall-detail__footer">
                <button class="wmall-buy-btn" id="wjBuyBtn" type="button">
                  立即购买
                </button>
              </div>
            </div>
          `;
        }

        const map = {
          wujibuds: {
            img: './assets/com.wujinb.wmall/wujibuds.png',
            name: 'WujiBuds',
            price: 599,
          },
          charger: {
            img: './assets/com.wujinb.wmall/iwuji_charger.png',
            name: 'iWuji快充充电器',
            price: 79,
          },
          case: {
            img: './assets/com.wujinb.wmall/iwuji_baohuke.png',
            name: 'iWuji透明保护壳',
            price: 39,
          },
        };
        const item = map[id] || map.charger;

        return `
          <div class="wmall-detail">
            <div class="wmall-detail__scroll">
              <div class="wmall-detail__hero">
                <img src="${item.img}" alt="${item.name}">
              </div>

              <div class="wmall-detail__info">
                <div class="wmall-detail__name">${item.name}</div>
                <div class="wmall-detail__price is-blue">${item.price}</div>
              </div>
            </div>

            <div class="wmall-detail__footer">
              <button class="wmall-buy-btn"
                      data-price="${item.price}"
                      data-name="${item.name}"
                      type="button">立即购买</button>
            </div>
          </div>
        `;
      },

      mount(root, ctx) {
        const id = ctx.data?.id;

        if (id === 'iWuji') {
          const chips = root.querySelectorAll('.wmall-chip');
          const imgEl = root.querySelector('#wjPhoneImg');
          const buyBtn = root.querySelector('#wjBuyBtn');

          const imgMap = {
            blue: './assets/com.wujinb.wmall/iwuji_blue.png',
            white: './assets/com.wujinb.wmall/iwuji_white.png',
            black: './assets/com.wujinb.wmall/iwuji_black.png',
          };

          chips.forEach(chip => {
            chip.addEventListener('click', () => {
              if (chip.classList.contains('is-active')) return;

              chips.forEach(c => c.classList.remove('is-active'));
              chip.classList.add('is-active');

              const color = chip.dataset.color;
              imgEl.src = imgMap[color];

              if (color === 'white') {
                buyBtn.disabled = true;
                buyBtn.textContent = '暂时缺货';
              } else {
                buyBtn.disabled = false;
                buyBtn.textContent = '立即购买';
              }
            });
          });

          buyBtn.addEventListener('click', () => {
            if (buyBtn.disabled) return;
            if (navigator.vibrate) { try { navigator.vibrate(10); } catch { } }
            ctx.push('checkout', { price: 2999, name: 'iWuji' });
          });
          return;
        }

        const buyBtn = root.querySelector('.wmall-buy-btn');
        buyBtn?.addEventListener('click', () => {
          if (navigator.vibrate) { try { navigator.vibrate(10); } catch { } }
          ctx.push('checkout', {
            price: +buyBtn.dataset.price,
            name: buyBtn.dataset.name,
          });
        });
      },
    },

    checkout: {
      name: 'checkout',
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
        const amount = root.querySelector('.wmall-checkout__amount');

        this._timer = setTimeout(() => {
          this._timer = null;
          if (token !== this._token) return;
          if (!loading?.isConnected || !error?.isConnected) return;

          if (navigator.vibrate) { try { navigator.vibrate([40, 60, 120]); } catch { } }

          loading.hidden = true;
          error.hidden = false;
          error.classList.add('is-angry');

          if (navigator.vibrate) {
            try { navigator.vibrate([80, 40, 80, 40, 200]); } catch (e) { }
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