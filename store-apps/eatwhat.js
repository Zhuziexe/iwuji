(() => {
  const BUNDLE = 'com.wujinb.eatwhat';
  const DATA_URL = './assets/com.wujinb.eatwhat/meals.json';
  const ICON_URL = './assets/eatwhat.svg';
  const CATS = ['全部', '家常菜', '粤菜', '面食', '早餐', '快餐', '汤锅', '凉菜'];
  const HISTORY_MAX = 20;
  const SHAKE_THRESHOLD = 28;
  const SHAKE_COOLDOWN = 800;

  function gradient(color) {
    const c = Array.isArray(color) && color.length >= 2 ? color : ['#3a6ff0', '#2c5ad0'];
    return `linear-gradient(135deg, ${c[0]}, ${c[1]})`;
  }

  function renderCard(meal, { big = false } = {}) {
    return `
      <div class="ew-card ${big ? 'is-big' : ''}" data-id="${meal.id}"
           style="--grad:${gradient(meal.color)}">
        <div class="ew-card__emoji">${meal.emoji || '🍽️'}</div>
        <div class="ew-card__body">
          <div class="ew-card__name">${meal.name}</div>
          <div class="ew-card__meta">
            <span>${meal.cat}</span><span>·</span>
            <span>${meal.time} 分钟</span><span>·</span>
            <span>${meal.diff}</span>
          </div>
        </div>
      </div>
    `;
  }

  function openDetail(el, meal, ctx) {
    const rect = el.getBoundingClientRect();
    ctx.push('detail', { meal }, {
      transition: 'zoom',
      origin: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    });
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '今天吃什么',
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.0.1',

    styles: `
      .ew-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }

      .ew-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 11px 20px 6px;
      }
      .ew-title {
        font-size: var(--wj-fs-xl);
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ew-roll-btn {
        flex: 0 0 auto;
        padding: 7px 17px;
        border: 0;
        border-radius: 1399px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 600;
        letter-spacing: .3px;
        cursor: pointer;
        transition: transform .1s, filter .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .ew-roll-btn:active { transform: scale(.95); filter: brightness(.92); }

      /* ===== 页签：chip 恢复到可点尺寸 ===== */
      .ew-filters {
        flex: 0 0 auto;
        display: flex;
        gap: 8px;
        padding: 6px 20px 8px;
        overflow-x: auto;
        touch-action: pan-x;
        -webkit-overflow-scrolling: touch;
      }
      .ew-chip {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 7px 17px;
        min-height: 36px;
        box-sizing: border-box;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 1399px;
        background: transparent;
        color: var(--wj-text-muted);
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 500;
        line-height: 1;
        cursor: pointer;
        transition: all .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .ew-chip:active { transform: scale(.95); }
      .ew-chip.is-active {
        background: var(--wj-primary, #3a6ff0);
        border-color: var(--wj-primary, #3a6ff0);
        color: #fff;
      }

      .ew-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 8px 20px 22px;
      }

      .ew-empty {
        text-align: center;
        padding: 56px 22px;
        color: var(--wj-text-dim);
        font-size: var(--wj-fs-md);
        line-height: 1.6;
      }

      .ew-card {
        position: relative;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 17px;
        margin-bottom: 11px;
        border-radius: 20px;
        background: var(--wj-bg-alt);
        cursor: pointer;
        transition: transform .08s, background .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .ew-card:active { transform: scale(.985); background: #dae2f0; }

      .ew-card.is-big {
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        padding: 0;
        overflow: hidden;
        border-radius: 25px;
        background: transparent;
        box-shadow: 0 14px 36px rgba(0,0,0,.15);
        margin-bottom: 17px;
      }
      .ew-card.is-big:active { transform: scale(.98); }

      .ew-card__emoji {
        flex: 0 0 62px;
        width: 62px;
        height: 62px;
        border-radius: 17px;
        background: var(--grad);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--wj-fs-3xl);
        line-height: 1;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.25);
      }

      .ew-card.is-big .ew-card__emoji {
        flex: 0 0 auto;
        width: 100%;
        height: 140px;
        border-radius: 0;
        font-size: 84px;
        box-shadow: none;
      }

      .ew-card__body {
        flex: 1 1 auto;
        min-width: 0;
      }
      .ew-card.is-big .ew-card__body {
        padding: 14px 20px 17px;
        background: var(--wj-bg-alt);
      }

      .ew-card__name {
        font-size: var(--wj-fs-lg);
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ew-card.is-big .ew-card__name { font-size: var(--wj-fs-2xl); }

      .ew-card__meta {
        margin-top: 3px;
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-dim);
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
      }
      .ew-card.is-big .ew-card__meta { font-size: var(--wj-fs-md); margin-top: 6px; }

      .ew-detail {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
      }
      .ew-detail__scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding-bottom: 28px;
      }
      .ew-detail__hero {
        width: 100%;
        height: 196px;
        background: var(--grad);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 109px;
        line-height: 1;
        padding-top: var(--statusbar-h);
        box-sizing: border-box;
      }
      .ew-detail__head { padding: 20px 25px 0; }
      .ew-detail__name {
        font-size: var(--wj-fs-3xl);
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
      }
      .ew-detail__meta {
        margin-top: 6px;
        font-size: var(--wj-fs-md);
        color: var(--wj-text-dim);
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
      }
      .ew-section { padding: 20px 25px 0; }
      .ew-section__title {
        font-size: var(--wj-fs-lg);
        font-weight: 700;
        color: var(--wj-text);
        margin-bottom: 11px;
        letter-spacing: .3px;
      }
      .ew-ing {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .ew-ing__row {
        display: flex;
        align-items: baseline;
        gap: 11px;
        font-size: var(--wj-fs-md);
        color: var(--wj-text);
        padding: 11px 17px;
        background: var(--wj-bg-alt);
        border-radius: 14px;
      }
      .ew-ing__row::before {
        content: '·';
        color: var(--wj-primary, #3a6ff0);
        font-weight: 700;
        font-size: var(--wj-fs-lg);
        line-height: 1;
      }
      .ew-steps {
        display: flex;
        flex-direction: column;
        gap: 11px;
        counter-reset: step;
      }
      .ew-step {
        display: flex;
        gap: 14px;
        font-size: var(--wj-fs-md);
        line-height: 1.55;
        color: var(--wj-text);
        counter-increment: step;
      }
      .ew-step::before {
        content: counter(step);
        flex: 0 0 31px;
        width: 31px;
        height: 31px;
        border-radius: 50%;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font-size: var(--wj-fs-xs);
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 1px;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="ew-page">
              <div class="ew-header">
                <div class="ew-title">今天吃什么</div>
                <button class="ew-roll-btn" id="ewRollBtn" type="button">换一个</button>
              </div>
              <div class="ew-filters" id="ewFilters"></div>
              <div class="ew-body" id="ewBody">
                <div class="ew-empty">加载中…</div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const filtersEl = root.querySelector('#ewFilters');
          const bodyEl = root.querySelector('#ewBody');
          const rollBtn = root.querySelector('#ewRollBtn');
          const db = AppStorage.for(BUNDLE);

          let meals = [];
          let mealsLoaded = false;
          let lastPickId = null;
          let currentCat = '全部';
          let currentPick = null;
          let disposed = false;

          const scrollPositions = Object.create(null);
          const picks = Object.create(null);

          async function loadMeals() {
            try {
              const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              meals = Array.isArray(data.meals) ? data.meals : [];
              db.set('mealsCache', meals).catch(() => { });
            } catch (e) {
              console.warn('[eatwhat] fetch 失败，降级到缓存', e);
              try {
                const cached = await db.get('mealsCache', []);
                meals = Array.isArray(cached) ? cached : [];
              } catch { meals = []; }
            }
            mealsLoaded = true;
          }

          function pushHistory(id) {
            db.get('history', []).then(his => {
              const next = [id, ...(Array.isArray(his) ? his : []).filter(x => x !== id)]
                .slice(0, HISTORY_MAX);
              return db.set('history', next);
            }).catch(() => { });
          }

          function pickRandom(pool) {
            if (!pool.length) return null;
            if (pool.length === 1) return pool[0];
            let candidate, guard = 0;
            do {
              candidate = pool[Math.floor(Math.random() * pool.length)];
              guard++;
            } while (candidate.id === lastPickId && guard < 20);
            lastPickId = candidate.id;
            return candidate;
          }

          function buildFilters() {
            filtersEl.innerHTML = CATS.map(c => `
              <button class="ew-chip ${c === currentCat ? 'is-active' : ''}"
                      data-cat="${c}" type="button">${c}</button>
            `).join('');
            filtersEl.querySelectorAll('.ew-chip').forEach(btn => {
              btn.addEventListener('click', () => switchCat(btn.dataset.cat));
            });
          }

          function setActiveChip() {
            filtersEl.querySelectorAll('.ew-chip').forEach(b => {
              b.classList.toggle('is-active', b.dataset.cat === currentCat);
            });
          }

          function pool() {
            return currentCat === '全部' ? meals : meals.filter(m => m.cat === currentCat);
          }

          function saveScroll() {
            scrollPositions[currentCat] = bodyEl.scrollTop;
          }

          function restoreScroll() {
            const y = scrollPositions[currentCat] || 0;
            requestAnimationFrame(() => {
              if (disposed) return;
              const max = Math.max(0, bodyEl.scrollHeight - bodyEl.clientHeight);
              bodyEl.scrollTop = Math.min(y, max);
            });
          }

          function switchCat(cat) {
            if (cat === currentCat) return;
            saveScroll();
            currentCat = cat;
            setActiveChip();
            renderBody();
            restoreScroll();
          }

          function renderBody() {
            if (!mealsLoaded) { bodyEl.innerHTML = `<div class="ew-empty">加载中…</div>`; return; }
            if (!meals.length) { bodyEl.innerHTML = `<div class="ew-empty">菜谱数据加载失败<br>请检查网络后重新打开</div>`; return; }

            const list = pool();
            if (!list.length) { bodyEl.innerHTML = `<div class="ew-empty">这个分类下还没有菜</div>`; return; }

            const savedId = picks[currentCat];
            let pick = savedId ? list.find(m => m.id === savedId) : null;
            if (!pick) {
              pick = pickRandom(list);
              picks[currentCat] = pick.id;
            }
            currentPick = pick;

            const rest = list.filter(m => m.id !== currentPick.id);

            bodyEl.innerHTML = `
              ${renderCard(currentPick, { big: true })}
              <div class="ew-section__title" style="padding:0 3px 11px;">其他选择</div>
              ${rest.map(m => renderCard(m)).join('')}
            `;

            bodyEl.querySelectorAll('.ew-card').forEach(el => {
              el.addEventListener('click', () => {
                const meal = meals.find(m => m.id === el.dataset.id);
                if (!meal) return;
                openDetail(el, meal, ctx);
              });
            });
          }

          function roll() {
            if (!mealsLoaded || !meals.length) return;
            const list = pool();
            if (!list.length) return;

            currentPick = pickRandom(list);
            picks[currentCat] = currentPick.id;
            pushHistory(currentPick.id);
            renderBody();

            scrollPositions[currentCat] = 0;
            bodyEl.scrollTop = 0;

            if (navigator.vibrate) { try { navigator.vibrate(12); } catch { } }

            const big = bodyEl.querySelector('.ew-card.is-big');
            if (big) {
              big.animate(
                [{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }],
                { duration: 260, easing: 'ease-out' }
              );
            }
          }

          const blockSwipe = () => { root.dataset.blockBackGesture = '1'; };
          const releaseSwipe = () => { delete root.dataset.blockBackGesture; };

          filtersEl.addEventListener('touchstart', blockSwipe, { capture: true, passive: true });
          filtersEl.addEventListener('touchend', releaseSwipe, { passive: true });
          filtersEl.addEventListener('touchcancel', releaseSwipe, { passive: true });
          filtersEl.addEventListener('pointerdown', blockSwipe);
          filtersEl.addEventListener('pointerup', releaseSwipe);
          filtersEl.addEventListener('pointercancel', releaseSwipe);
          filtersEl.addEventListener('pointerleave', releaseSwipe);

          let lastShake = 0;
          function onMotion(e) {
            const acc = e.accelerationIncludingGravity;
            if (!acc) return;
            const m = Math.abs(acc.x || 0) + Math.abs(acc.y || 0) + Math.abs(acc.z || 0);
            if (m > SHAKE_THRESHOLD && Date.now() - lastShake > SHAKE_COOLDOWN) {
              lastShake = Date.now();
              roll();
            }
          }
          window.addEventListener('devicemotion', onMotion);

          rollBtn.addEventListener('click', roll);

          buildFilters();

          (async () => {
            await loadMeals();
            if (disposed) return;
            renderBody();
          })();

          return () => {
            disposed = true;
            window.removeEventListener('devicemotion', onMotion);
            filtersEl.removeEventListener('touchstart', blockSwipe, true);
            filtersEl.removeEventListener('touchend', releaseSwipe);
            filtersEl.removeEventListener('touchcancel', releaseSwipe);
            filtersEl.removeEventListener('pointerdown', blockSwipe);
            filtersEl.removeEventListener('pointerup', releaseSwipe);
            filtersEl.removeEventListener('pointercancel', releaseSwipe);
            filtersEl.removeEventListener('pointerleave', releaseSwipe);
            delete root.dataset.blockBackGesture;
          };
        },
      },

      detail: {
        name: 'detail',
        transition: 'zoom',

        render(routeCtx) {
          const meal = routeCtx.data?.meal;
          if (!meal) {
            return `<div class="ew-page"><div class="ew-empty">菜不存在</div></div>`;
          }
          const c = Array.isArray(meal.color) && meal.color.length >= 2
            ? meal.color : ['#3a6ff0', '#2c5ad0'];
          return `
            <div class="ew-detail">
              <div class="ew-detail__scroll">
                <div class="ew-detail__hero"
                     style="--grad:linear-gradient(135deg, ${c[0]}, ${c[1]})">
                  ${meal.emoji || '🍽️'}
                </div>
                <div class="ew-detail__head">
                  <div class="ew-detail__name">${meal.name}</div>
                  <div class="ew-detail__meta">
                    <span>${meal.cat}</span><span>·</span>
                    <span>${meal.time} 分钟</span><span>·</span>
                    <span>${meal.diff}</span>
                  </div>
                </div>
                <div class="ew-section">
                  <div class="ew-section__title">食材</div>
                  <div class="ew-ing">
                    ${(meal.ing || []).map(i => `<div class="ew-ing__row">${i}</div>`).join('')}
                  </div>
                </div>
                <div class="ew-section">
                  <div class="ew-section__title">做法</div>
                  <div class="ew-steps">
                    ${(meal.steps || []).map(s => `<div class="ew-step">${s}</div>`).join('')}
                  </div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const meal = ctx.data?.meal;
          if (!meal) return;
          const db = AppStorage.for(BUNDLE);
          db.get('history', []).then(his => {
            const next = [meal.id, ...(Array.isArray(his) ? his : []).filter(x => x !== meal.id)]
              .slice(0, HISTORY_MAX);
            return db.set('history', next);
          }).catch(() => { });
        },
      },
    },
  });
})();