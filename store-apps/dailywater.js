(() => {
  const BUNDLE = 'com.wujinb.dailywater';
  const MAX    = 8;

  let _db = null;
  const getDB = () => (_db || (_db = AppStorage.for(BUNDLE)));

  function todayKey() {
    const d   = new Date();
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return Number(`${y}${m}${day}`);
  }

  async function loadData() {
    const db    = getDB();
    const today = todayKey();

    let data = await db.get('data', null);

    if (!data || typeof data !== 'object') {
      data = { date: today, water: 0, lastday: 0 };
      await db.set('data', data);
      return data;
    }

    if (data.date !== today) {
      data = {
        date:    today,
        water:   0,
        lastday: Math.max(0, Math.min(MAX, Number(data.water) || 0)),
      };
      await db.set('data', data);
    }

    data.date    = today;
    data.water   = Math.max(0, Math.min(MAX, Number(data.water)   || 0));
    data.lastday = Math.max(0, Math.min(MAX, Number(data.lastday) || 0));

    return data;
  }

  async function saveData(data) {
    await getDB().set('data', data);
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '每日喝水',
    icon: './assets/dailywater.svg',
    initialRoute: 'home',
    version: '1.0.2',
    styles: `
      .dw-page {
        position: absolute;
        inset: 0;
        overflow: hidden;
        padding: calc(var(--statusbar-h) + 10px) 16px 16px;
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 6px;
        user-select: none;
        -webkit-user-select: none;
      }

      /* ★ 标题左对齐 */
      .dw-title {
        flex: 0 0 auto;
        align-self: stretch;
        text-align: left;
        font-size: 20px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .5px;
        padding: 2px 4px 0;
      }

      /* ==================== 水瓶 ==================== */
      /* ★ 弹性容器，占用剩余空间，把瓶子在中间居中 */
      .dw-bottle-wrap {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px 0;
      }

      /* ★ 用容器比例决定瓶子大小：任何手机都放得下 */
      .dw-bottle {
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        max-height: 100%;
        aspect-ratio: 124 / 264;   /* 瓶身+瓶盖宽高比 */
        min-height: 0;
      }

      .dw-bottle__cap {
        flex: 0 0 7%;
        width: 36%;
        border-radius: 4px 4px 1px 1px;
        background: linear-gradient(180deg, #a0b0c5 0%, #7c8a9e 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35);
      }

      .dw-bottle__neck {
        flex: 0 0 8%;
        width: 31%;
        background: #eaf1fb;
        border-left: 2px solid #b6c2d6;
        border-right: 2px solid #b6c2d6;
        box-sizing: border-box;
      }

      .dw-bottle__body {
        position: relative;
        flex: 0 1 auto;
        width: 100%;
        min-height: 0;
        height: 85%;
        background: #eef3ff;
        border: 2.5px solid #b6c2d6;
        border-radius: 8px 8px 26px 26px;
        overflow: hidden;
        box-shadow:
          inset 0 0 24px rgba(120, 150, 200, .10),
          0 8px 22px rgba(80, 120, 180, .14);
        box-sizing: border-box;
      }

      .dw-bottle__water {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 0;
        background: linear-gradient(180deg,
          #7ec3ff 0%,
          #52adff 12%,
          #3d8de8 100%);
        transition: height .45s cubic-bezier(.22, .61, .36, 1);
      }

      .dw-bottle__water::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 6px;
        background: rgba(255, 255, 255, .55);
        filter: blur(3px);
        pointer-events: none;
      }

      .dw-bottle__body::after {
        content: '';
        position: absolute;
        left: 8%;
        top: 7%;
        width: 12%;
        height: 72%;
        border-radius: 8px;
        background: linear-gradient(180deg,
          rgba(255, 255, 255, .70) 0%,
          rgba(255, 255, 255, .16) 80%,
          rgba(255, 255, 255, 0) 100%);
        pointer-events: none;
      }

      /* ==================== 计数器 ==================== */
      .dw-counter {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 22px;
        padding: 4px 0 0;
      }

      .dw-btn {
        width: 46px;
        height: 46px;
        padding: 0 0 3px;
        border: 0;
        border-radius: 50%;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 26px;
        font-weight: 400;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform .1s ease, background .15s ease, opacity .15s ease;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .dw-btn:active:not(:disabled) {
        transform: scale(.9);
        background: #dae2f0;
      }
      .dw-btn:disabled {
        opacity: .32;
        cursor: default;
      }

      .dw-count {
        display: inline-flex;
        align-items: baseline;
        justify-content: center;
        min-width: 86px;
        color: var(--wj-text);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }
      .dw-count b {
        font-size: 40px;
        font-weight: 700;
        letter-spacing: -1.5px;
      }
      .dw-count span {
        font-size: 18px;
        font-weight: 500;
        color: var(--wj-text-dim);
        margin-left: 1px;
      }

      /* ==================== 昨日 ==================== */
      .dw-yesterday {
        flex: 0 0 auto;
        height: 18px;
        line-height: 18px;
        font-size: 13px;
        color: var(--wj-text-muted);
        letter-spacing: .3px;
        text-align: center;
        margin-bottom: 2px;
      }
      .dw-yesterday[hidden] {
        visibility: hidden;   /* 用 visibility 占位，避免高度抖动 */
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="dw-page">
              <h1 class="dw-title">每日喝水</h1>

              <div class="dw-bottle-wrap">
                <div class="dw-bottle">
                  <div class="dw-bottle__cap"></div>
                  <div class="dw-bottle__neck"></div>
                  <div class="dw-bottle__body">
                    <div class="dw-bottle__water" id="dwWater"></div>
                  </div>
                </div>
              </div>

              <div class="dw-counter">
                <button class="dw-btn" id="dwMinus" type="button" aria-label="减少一杯">−</button>
                <div class="dw-count">
                  <b id="dwCount">0</b><span>/${MAX}</span>
                </div>
                <button class="dw-btn" id="dwPlus" type="button" aria-label="增加一杯">+</button>
              </div>

              <div class="dw-yesterday" id="dwYesterday" hidden></div>
            </div>
          `;
        },

        mount(root) {
          const waterEl  = root.querySelector('#dwWater');
          const countEl  = root.querySelector('#dwCount');
          const minusBtn = root.querySelector('#dwMinus');
          const plusBtn  = root.querySelector('#dwPlus');
          const yEl      = root.querySelector('#dwYesterday');

          let data     = { date: 0, water: 0, lastday: 0 };
          let ready    = false;
          let disposed = false;
          let saving   = false;
          let pending  = false;

          function render() {
            const n   = data.water;
            const pct = (n / MAX) * 100;

            waterEl.style.height = pct + '%';
            countEl.textContent  = String(n);

            minusBtn.disabled = !ready || n <= 0;
            plusBtn.disabled  = !ready || n >= MAX;

            if (data.lastday > 0) {
              yEl.hidden      = false;
              yEl.textContent = `昨日喝水: ${data.lastday}/${MAX}`;
            } else {
              yEl.hidden = true;
              yEl.textContent = '';
            }
          }

          async function persist() {
            if (saving) { pending = true; return; }

            saving = true;
            try {
              do {
                pending = false;
                await saveData({
                  date:    data.date,
                  water:   data.water,
                  lastday: data.lastday,
                });
              } while (pending && !disposed);
            } catch (e) {
              console.warn('[dailywater] save failed', e);
            } finally {
              saving = false;
            }
          }

          function step(delta) {
            if (!ready) return;
            const n = Math.max(0, Math.min(MAX, data.water + delta));
            if (n === data.water) return;

            data.water = n;
            render();

            if (navigator.vibrate) {
              try { navigator.vibrate(8); } catch { }
            }
            persist();
          }

          minusBtn.addEventListener('click', () => step(-1));
          plusBtn.addEventListener('click', () => step(+1));

          (async () => {
            try {
              const loaded = await loadData();
              if (disposed) return;
              data = loaded;
            } catch (e) {
              console.warn('[dailywater] load failed', e);
            }
            if (disposed) return;
            ready = true;
            render();
          })();

          render();

          return () => {
            disposed = true;
          };
        },
      },
    },
  });
})();