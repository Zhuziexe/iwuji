(() => {
  const BUNDLE = 'com.niunai.kitchen';
  const DB_KEY = 'state';

  const INGREDIENTS = [
    { id: 'flour',      name: '面粉',  icon: '🌾', price: 5 },
    { id: 'egg',        name: '鸡蛋',  icon: '🥚', price: 3 },
    { id: 'milk',       name: '牛奶',  icon: '🥛', price: 4 },
    { id: 'sugar',      name: '糖',    icon: '🍬', price: 3 },
    { id: 'butter',     name: '黄油',  icon: '🧈', price: 6 },
    { id: 'chocolate',  name: '巧克力',icon: '🍫', price: 8 },
    { id: 'strawberry', name: '草莓',  icon: '🍓', price: 7 },
    { id: 'apple',      name: '苹果',  icon: '🍎', price: 5 },
  ];

  const RECIPES = [
    { id: 'dough',         name: '面团',       icon: '🥖', ings: ['flour', 'milk'],                 price: 10 },
    { id: 'milkcandy',     name: '奶糖',       icon: '🍬', ings: ['milk', 'sugar'],                 price: 10 },
    { id: 'biscuit',       name: '饼干',       icon: '🍪', ings: ['flour', 'sugar'],                price: 12 },
    { id: 'bread2',        name: '面包',       icon: '🍞', ings: ['flour', 'egg'],                  price: 15 },
    { id: 'caramel',       name: '焦糖',       icon: '🍯', ings: ['butter', 'sugar'],               price: 15 },
    { id: 'jam',           name: '苹果酱',     icon: '🍎', ings: ['apple', 'sugar'],                price: 16 },
    { id: 'eggPudding',    name: '蛋奶布丁',   icon: '🍮', ings: ['milk', 'egg'],                   price: 18 },
    { id: 'strawberryJam', name: '草莓酱',     icon: '🍓', ings: ['strawberry', 'sugar'],           price: 18 },
    { id: 'hotChoco',      name: '热巧克力',   icon: '☕', ings: ['milk', 'chocolate'],             price: 20 },
    { id: 'chocoCookie',   name: '巧克力饼干', icon: '🍪', ings: ['flour', 'chocolate'],            price: 22 },

    { id: 'pancake',        name: '煎饼',       icon: '🥞', ings: ['flour', 'egg', 'milk'],          price: 25 },
    { id: 'bread',          name: '黄油面包',   icon: '🥐', ings: ['flour', 'egg', 'butter'],        price: 28 },
    { id: 'muffin',         name: '麦芬',       icon: '🧁', ings: ['flour', 'milk', 'sugar'],        price: 32 },
    { id: 'cookie',         name: '曲奇',       icon: '🍪', ings: ['flour', 'butter', 'sugar'],      price: 30 },
    { id: 'pie',            name: '苹果派',     icon: '🥧', ings: ['flour', 'butter', 'apple'],      price: 45 },
    { id: 'chocoCake',      name: '巧克力蛋糕', icon: '🍫', ings: ['flour', 'egg', 'chocolate'],     price: 55 },
    { id: 'strawberryCake', name: '草莓蛋糕',   icon: '🍰', ings: ['flour', 'sugar', 'strawberry'],  price: 55 },
    { id: 'pudding',        name: '布丁',       icon: '🍮', ings: ['milk', 'sugar', 'egg'],          price: 35 },
    { id: 'icecream',       name: '冰淇淋',     icon: '🍨', ings: ['milk', 'sugar', 'strawberry'],   price: 40 },
    { id: 'smoothie',       name: '奶昔',       icon: '🥤', ings: ['milk', 'apple', 'sugar'],        price: 30 },
    { id: 'chocoMilk',      name: '巧克力牛奶', icon: '🍫', ings: ['milk', 'chocolate', 'sugar'],    price: 38 },
    { id: 'cake',           name: '蛋糕',       icon: '🎂', ings: ['flour', 'egg', 'sugar'],         price: 35 },
    { id: 'applePancake',   name: '苹果煎饼',   icon: '🥞', ings: ['flour', 'egg', 'apple'],         price: 42 },
    { id: 'duoCake',        name: '双拼蛋糕',   icon: '🎂', ings: ['flour', 'chocolate', 'strawberry'], price: 60 },
    { id: 'strawberryChoco',name: '草莓巧克力奶',icon: '🥤',ings: ['milk', 'chocolate', 'strawberry'],price: 45 },
  ];

  const SIGN_IN_REWARD = 15;

  function db() { return AppStorage.for(BUNDLE); }
  function ingById(id) { return INGREDIENTS.find(i => i.id === id); }

  function matchRecipe(ings) {
    const sorted = [...ings].sort();
    for (const r of RECIPES) {
      const rs = [...r.ings].sort();
      if (rs.length === sorted.length && rs.every((v, i) => v === sorted[i])) return r;
    }
    return null;
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  async function loadState() {
    let s = await db().get(DB_KEY, null);
    if (!s || typeof s !== 'object') {
      s = {
        coins: 100,
        inventory: {},
        unlocked: {},
        lastSignIn: '',
        dailyIngredient: '',
        slots: [null, null, null],
      };
    }
    if (!s.inventory) s.inventory = {};
    if (!s.unlocked) s.unlocked = {};
    if (typeof s.lastSignIn !== 'string') s.lastSignIn = '';
    if (typeof s.dailyIngredient !== 'string') s.dailyIngredient = '';
    if (!Array.isArray(s.slots) || s.slots.length !== 3) s.slots = [null, null, null];

    const today = todayStr();
    if (!s.dailyIngredient || s._dailyDate !== today) {
      const ing = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
      s.dailyIngredient = ing.id;
      s._dailyDate = today;
      await db().set(DB_KEY, s);
    }
    return s;
  }

  async function saveState(s) {
    await db().set(DB_KEY, s);
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '牛奶厨房',
    icon: './assets/kitchen.svg',
    initialRoute: 'main',
    version: '1.2.0',

    styles: `
      .kt-page {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: linear-gradient(160deg, #fff5e6 0%, #ffd8a8 100%);
        padding-top: var(--statusbar-h);
        overflow: hidden;
        user-select: none; -webkit-user-select: none;
      }

      .kt-header {
        flex: 0 0 auto;
        padding: 14px 20px 10px;
        display: flex; align-items: center; justify-content: space-between;
      }
      .kt-title {
        font-size: var(--wj-fs-xl);
        font-weight: 700;
        color: #5d3a1a;
        letter-spacing: .3px;
      }
      .kt-coins {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 16px;
        border-radius: 999px;
        background: rgba(93, 58, 26, 0.14);
        color: #5d3a1a;
        font-size: 20px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      .kt-tabs {
        flex: 0 0 auto;
        display: flex;
        gap: 5px;
        padding: 0 16px 12px;
      }
      .kt-tab {
        flex: 1;
        padding: 8px 0;
        border: 0;
        border-radius: 12px;
        background: rgba(255,255,255,.55);
        color: #8a5a30;
        font: inherit;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .15s, color .15s;
      }
      .kt-tab.is-active {
        background: #c97a2b;
        color: #fff;
      }

      .kt-content {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: scroll;
        scrollbar-width: none;
        -ms-overflow-style: none;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 0 16px 16px;
      }
      .kt-content::-webkit-scrollbar { display: none; }

      /* ============ 厨房 ============ */
      .kt-kitchen {
        display: flex; flex-direction: column;
      }

      .kt-slots {
        flex: 0 0 auto;
        display: flex;
        justify-content: center;
        gap: 14px;
        padding: 14px 0 8px;
      }
      .kt-slot {
        width: 84px; height: 84px;
        border-radius: 18px;
        border: 3px dashed rgba(93, 58, 26, .28);
        background: rgba(255,255,255,.5);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 3px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .1s, border-color .15s, background .15s;
        color: #8a5a30;
      }
      .kt-slot.is-filled {
        border-style: solid;
        border-color: #c97a2b;
        background: #fff;
        box-shadow: 0 3px 10px rgba(201, 122, 43, .2);
      }
      .kt-slot:active { transform: scale(.94); }
      .kt-slot__icon { font-size: 38px; line-height: 1; }
      .kt-slot__name { font-size: 18px; font-weight: 600; color: #5d3a1a; }

      .kt-cook-btn {
        flex: 0 0 auto;
        margin: 4px 8px 16px;
        padding: 18px 0;
        border: 0;
        border-radius: 1399px;
        background: linear-gradient(180deg, #e69544, #c97a2b);
        color: #fff;
        font: inherit;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: .5px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 6px 16px rgba(201, 122, 43, .35);
        transition: transform .08s, filter .15s, background .15s;
      }
      .kt-cook-btn:active:not(:disabled) { transform: scale(.97); filter: brightness(.92); }
      .kt-cook-btn:disabled {
        background: #c9b8a8;
        box-shadow: none;
        cursor: not-allowed;
      }

      .kt-pantry {
        flex: 0 0 auto;
        padding: 12px 0 4px;
        border-top: 1px solid rgba(93, 58, 26, .12);
      }
      .kt-pantry__title {
        font-size: 18px;
        color: #8a5a30;
        font-weight: 600;
        text-align: center;
        margin-bottom: 10px;
      }
      .kt-pantry__grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .kt-ing {
        position: relative;
        padding: 12px 4px 10px;
        border: 0;
        border-radius: 12px;
        background: #fff;
        color: #5d3a1a;
        font: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        display: flex; flex-direction: column;
        align-items: center; gap: 4px;
        box-shadow: 0 2px 6px rgba(93, 58, 26, .08);
        transition: transform .08s, opacity .15s;
      }
      .kt-ing:active { transform: scale(.92); }
      .kt-ing:disabled { opacity: .35; cursor: not-allowed; }
      .kt-ing__icon { font-size: 30px; line-height: 1; }
      .kt-ing__name { font-size: 18px; font-weight: 500; color: #5d3a1a; }
      .kt-ing__count {
        position: absolute;
        top: 4px; right: 6px;
        font-size: 16px;
        font-weight: 700;
        color: #c97a2b;
      }

      /* ============ 超市 ============ */
      .kt-shop { display: flex; flex-direction: column; gap: 10px; }
      .kt-shop-item {
        display: flex; align-items: center; gap: 14px;
        padding: 14px 16px;
        border-radius: 14px;
        background: rgba(255,255,255,.85);
        box-shadow: 0 2px 6px rgba(93, 58, 26, .06);
        transition: background .2s;
      }
      .kt-shop-item.is-special {
        background: linear-gradient(135deg, #fff7d6, #ffeaa8);
        box-shadow: 0 2px 10px rgba(230, 149, 68, .25);
      }
      .kt-shop-item__icon { font-size: 36px; }
      .kt-shop-item__info { flex: 1; min-width: 0; }
      .kt-shop-item__name { font-size: 18px; font-weight: 600; color: #5d3a1a; }
      .kt-shop-item__price {
        font-size: 18px;
        color: #8a5a30;
        font-variant-numeric: tabular-nums;
        margin-top: 3px;
      }
      .kt-shop-item__price s { color: #b0a090; margin-right: 4px; }
      .kt-shop-item__buy {
        padding: 12px 22px;
        border: 0;
        border-radius: 12px;
        background: #c97a2b;
        color: #fff;
        font: inherit;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .08s;
      }
      .kt-shop-item__buy:active:not(:disabled) { transform: scale(.94); }
      .kt-shop-item__buy:disabled { background: #c9b8a8; cursor: not-allowed; }

      /* ============ 图鉴 ============ */
      .kt-book { display: flex; flex-direction: column; gap: 12px; }
      .kt-book__header {
        display: flex; align-items: baseline; justify-content: space-between;
        padding: 4px 0 6px;
      }
      .kt-book__title { font-size: 22px; font-weight: 700; color: #5d3a1a; }
      .kt-book__progress {
        font-size: 20px;
        color: #8a5a30;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .kt-book__grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }
      .kt-dish {
        padding: 16px 8px;
        border-radius: 14px;
        background: #fff;
        text-align: center;
        box-shadow: 0 2px 6px rgba(93, 58, 26, .08);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .1s;
      }
      .kt-dish:active { transform: scale(.94); }
      .kt-dish.is-locked { background: rgba(255,255,255,.45); }
      .kt-dish__icon { font-size: 44px; line-height: 1; }
      .kt-dish.is-locked .kt-dish__icon { opacity: .3; }
      .kt-dish__name {
        font-size: 18px;
        font-weight: 600;
        color: #5d3a1a;
        margin-top: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .kt-dish.is-locked .kt-dish__name { color: #b0a090; }
      .kt-dish__price {
        font-size: 18px;
        color: #c97a2b;
        margin-top: 4px;
        font-weight: 600;
      }
      .kt-dish.is-locked .kt-dish__price { color: #b0a090; }

      .kt-detail {
        display: flex; flex-direction: column;
        gap: 20px;
        padding: calc(20px + var(--statusbar-h)) 16px 20px;
        min-height: 100%;
        box-sizing: border-box;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
      .kt-detail__hero {
        display: flex; flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 30px 20px;
        background: #fff;
        border-radius: 20px;
        box-shadow: 0 4px 16px rgba(93, 58, 26, .1);
      }
      .kt-detail__icon { font-size: 96px; line-height: 1; }
      .kt-detail__hero.is-locked .kt-detail__icon { opacity: .3; }
      .kt-detail__name {
        font-size: 32px;
        font-weight: 700;
        color: #5d3a1a;
      }
      .kt-detail__hero.is-locked .kt-detail__name { color: #b0a090; }
      .kt-detail__price {
        font-size: 24px;
        font-weight: 700;
        color: #c97a2b;
      }
      .kt-detail__hero.is-locked .kt-detail__price { color: #b0a090; }

      .kt-detail__section {
        background: #fff;
        border-radius: 16px;
        padding: 18px 20px;
        box-shadow: 0 2px 8px rgba(93, 58, 26, .08);
      }
      .kt-detail__section-title {
        font-size: 22px;
        font-weight: 700;
        color: #5d3a1a;
        margin-bottom: 14px;
      }
      .kt-detail__ings {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .kt-detail__ing {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border-radius: 12px;
        background: rgba(201, 122, 43, .1);
        color: #5d3a1a;
        font-size: 18px;
        font-weight: 600;
      }
      .kt-detail__ing--locked {
        background: rgba(176, 160, 144, .15);
        color: #8a5a30;
      }
      .kt-detail__locked-hint {
        font-size: 18px;
        color: #8a5a30;
        line-height: 1.6;
      }

      /* ============ 签到 ============ */
      .kt-signin {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        height: 100%;
        gap: 22px;
        padding: 20px;
      }
      .kt-signin__hero {
        font-size: 88px;
        line-height: 1;
        filter: drop-shadow(0 6px 16px rgba(201, 122, 43, .3));
      }
      .kt-signin__title { font-size: 26px; font-weight: 700; color: #5d3a1a; }
      .kt-signin__desc {
        font-size: 18px;
        color: #8a5a30;
        text-align: center;
        line-height: 1.7;
      }
      .kt-signin__desc strong { color: #c97a2b; font-size: 22px; }
      .kt-signin__btn {
        margin-top: 10px;
        padding: 20px 56px;
        border: 0;
        border-radius: 1399px;
        background: linear-gradient(180deg, #e69544, #c97a2b);
        color: #fff;
        font: inherit;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: .5px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 6px 20px rgba(201, 122, 43, .35);
        transition: transform .08s, filter .15s;
      }
      .kt-signin__btn:active:not(:disabled) { transform: scale(.97); filter: brightness(.92); }
      .kt-signin__btn:disabled {
        background: #c9b8a8;
        box-shadow: none;
        cursor: not-allowed;
        font-size: 22px;
        padding: 20px 40px;
      }

      /* ============ 全屏结果浮层 ============ */
      .kt-result-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, .55);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
        transition: opacity .25s;
        padding: 20px;
        text-align: center;
      }
      .kt-result-overlay.is-show { opacity: 1; pointer-events: auto; }
      .kt-result-overlay__icon {
        font-size: 96px;
        line-height: 1;
        filter: drop-shadow(0 8px 24px rgba(0,0,0,.3));
      }
      .kt-result-overlay__name {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        text-shadow: 0 2px 8px rgba(0,0,0,.4);
      }
      .kt-result-overlay__sub {
        font-size: 18px;
        color: rgba(255,255,255,.85);
      }
      .kt-result-overlay__new {
        display: inline-block;
        padding: 6px 18px;
        border-radius: 999px;
        background: #e0356b;
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        margin-top: 6px;
      }
    `,

    routes: {
      main: {
        name: 'main',
        render() {
          return `
            <div class="kt-page">
              <div class="kt-header">
                <div class="kt-title">牛奶厨房</div>
                <div class="kt-coins">
                  <span>💰</span>
                  <span id="ktCoins">0</span>
                </div>
              </div>

              <div class="kt-tabs">
                <button class="kt-tab is-active" data-tab="kitchen" type="button">厨房</button>
                <button class="kt-tab" data-tab="shop" type="button">超市</button>
                <button class="kt-tab" data-tab="book" type="button">图鉴</button>
                <button class="kt-tab" data-tab="signin" type="button">签到</button>
              </div>

              <div class="kt-content" id="ktContent"></div>

              <div class="kt-result-overlay" id="ktResult"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const coinsEl = root.querySelector('#ktCoins');
          const contentEl = root.querySelector('#ktContent');
          const resultEl = root.querySelector('#ktResult');
          const tabBtns = root.querySelectorAll('.kt-tab');

          let state = null;
          let currentTab = 'kitchen';
          let resultTimer = null;
          let disposed = false;

          function getSlots() { return state.slots || [null, null, null]; }
          async function setSlots(s) {
            state.slots = s;
            await saveState(state);
          }

          function showResult(result) {
            if (result.type === 'fail') {
              const sub = result.hint === 'close'
                ? '好像就差一个食材…'
                : '这个组合不行';
              resultEl.innerHTML = `
                <div class="kt-result-overlay__icon">💩</div>
                <div class="kt-result-overlay__name">黑暗料理</div>
                <div class="kt-result-overlay__sub">${sub}</div>
              `;
            } else if (result.type === 'new') {
              resultEl.innerHTML = `
                <div class="kt-result-overlay__icon">${result.recipe.icon}</div>
                <div class="kt-result-overlay__name">${result.recipe.name}</div>
                <div class="kt-result-overlay__new">✨ 新配方！+${result.coins}</div>
              `;
            } else {
              resultEl.innerHTML = `
                <div class="kt-result-overlay__icon">${result.recipe.icon}</div>
                <div class="kt-result-overlay__name">${result.recipe.name}</div>
                <div class="kt-result-overlay__sub">已卖出 +${result.coins} 金币</div>
              `;
            }
            resultEl.classList.add('is-show');
            clearTimeout(resultTimer);
            resultTimer = setTimeout(() => resultEl.classList.remove('is-show'), 2000);
          }

          function updateCoins() {
            if (coinsEl && state) coinsEl.textContent = String(state.coins || 0);
          }

          // ============ 厨房 ============
          function renderKitchen() {
            const inv = state.inventory || {};
            const slots = getSlots();
            const slotHTML = slots.map((id, i) => {
              if (id) {
                const ing = ingById(id);
                return `
                  <div class="kt-slot is-filled" data-slot="${i}">
                    <span class="kt-slot__icon">${ing.icon}</span>
                    <span class="kt-slot__name">${ing.name}</span>
                  </div>
                `;
              }
              return `<div class="kt-slot" data-slot="${i}"></div>`;
            }).join('');

            const filledCount = slots.filter(Boolean).length;

            const pantryHTML = INGREDIENTS.map(ing => {
              const count = inv[ing.id] || 0;
              return `
                <button class="kt-ing" data-ing="${ing.id}" type="button"
                        ${count <= 0 ? 'disabled' : ''}>
                  <span class="kt-ing__icon">${ing.icon}</span>
                  <span class="kt-ing__name">${ing.name}</span>
                  <span class="kt-ing__count">x${count}</span>
                </button>
              `;
            }).join('');

            contentEl.innerHTML = `
              <div class="kt-kitchen">
                <div class="kt-slots">${slotHTML}</div>
                <button class="kt-cook-btn" id="ktCookBtn" type="button"
                        ${filledCount < 2 ? 'disabled' : ''}>
                  ${filledCount === 0 ? '先放入食材' : filledCount === 1 ? '再放一个食材' : '开始烹饪'}
                </button>
                <div class="kt-pantry">
                  <div class="kt-pantry__title">点击食材放入槽位</div>
                  <div class="kt-pantry__grid">${pantryHTML}</div>
                </div>
              </div>
            `;

            contentEl.querySelectorAll('.kt-slot').forEach(el => {
              el.addEventListener('click', async () => {
                const i = Number(el.dataset.slot);
                const slots = getSlots();
                if (!slots[i]) return;
                const id = slots[i];
                state.inventory[id] = (state.inventory[id] || 0) + 1;
                slots[i] = null;
                await setSlots(slots);
                renderKitchen();
              });
            });

            contentEl.querySelectorAll('.kt-ing').forEach(el => {
              el.addEventListener('click', async () => {
                const id = el.dataset.ing;
                const invCount = (state.inventory || {})[id] || 0;
                if (invCount <= 0) return;
                const slots = getSlots();
                const emptyIdx = slots.findIndex(s => s === null);
                if (emptyIdx === -1) {
                  WujiToast.show('槽位已满');
                  return;
                }
                state.inventory[id] -= 1;
                slots[emptyIdx] = id;
                await setSlots(slots);
                if (navigator.vibrate) { try { navigator.vibrate(6); } catch {} }
                renderKitchen();
              });
            });

            const cookBtn = contentEl.querySelector('#ktCookBtn');
            if (cookBtn) cookBtn.addEventListener('click', doCook);
          }

          async function doCook() {
            const slots = getSlots();
            const filled = slots.filter(Boolean);
            if (filled.length < 2) return;

            let result = { type: 'fail', hint: 'bad' };
            const recipe = matchRecipe(filled);
            if (recipe) {
              if (!state.unlocked[recipe.id]) {
                state.unlocked[recipe.id] = true;
                const bonus = Math.round(recipe.price * 0.5);
                state.coins = (state.coins || 0) + bonus;
                result = { type: 'new', recipe, coins: bonus };
              } else {
                state.coins = (state.coins || 0) + recipe.price;
                result = { type: 'known', recipe, coins: recipe.price };
              }
            } else {
              if (filled.length === 2) {
                const sorted = [...filled].sort();
                const isClose = RECIPES.some(r => {
                  if (r.ings.length !== 3) return false;
                  const rs = [...r.ings].sort();
                  return rs.includes(sorted[0]) && rs.includes(sorted[1]);
                });
                result = { type: 'fail', hint: isClose ? 'close' : 'bad' };
              }
            }

            await setSlots([null, null, null]);
            updateCoins();

            if (navigator.vibrate) {
              try {
                navigator.vibrate(result.type === 'new' ? [20, 30, 20, 30, 20] :
                                  result.type === 'known' ? [10, 20, 10] : 30);
              } catch {}
            }

            renderKitchen();
            showResult(result);
          }

          // ============ 超市 ============
          function renderShop() {
            const special = state.dailyIngredient;
            const sorted = [...INGREDIENTS].sort((a, b) => {
              if (a.id === special) return -1;
              if (b.id === special) return 1;
              return 0;
            });
            const itemsHTML = sorted.map(ing => {
              const isSpecial = ing.id === special;
              const price = isSpecial ? Math.max(1, Math.round(ing.price * 0.5)) : ing.price;
              const canAfford = (state.coins || 0) >= price;
              return `
                <div class="kt-shop-item ${isSpecial ? 'is-special' : ''}">
                  <span class="kt-shop-item__icon">${ing.icon}</span>
                  <div class="kt-shop-item__info">
                    <div class="kt-shop-item__name">${ing.name}</div>
                    <div class="kt-shop-item__price">
                      ${isSpecial ? `<s>${ing.price}</s>` : ''}💰 ${price}
                    </div>
                  </div>
                  <button class="kt-shop-item__buy" data-buy="${ing.id}" type="button"
                          ${canAfford ? '' : 'disabled'}>
                    购买
                  </button>
                </div>
              `;
            }).join('');

            contentEl.innerHTML = `<div class="kt-shop">${itemsHTML}</div>`;

            contentEl.querySelectorAll('[data-buy]').forEach(btn => {
              btn.addEventListener('click', async () => {
                const id = btn.dataset.buy;
                const ing = ingById(id);
                const isSpecial = id === special;
                const price = isSpecial ? Math.max(1, Math.round(ing.price * 0.5)) : ing.price;
                if ((state.coins || 0) < price) return;
                state.coins -= price;
                state.inventory[id] = (state.inventory[id] || 0) + 1;
                await saveState(state);
                updateCoins();
                WujiToast.show('购买成功');
                if (navigator.vibrate) { try { navigator.vibrate(6); } catch {} }
                renderShop();
              });
            });
          }

          // ============ 图鉴 ============
          function renderBook() {
            const unlockedCount = Object.keys(state.unlocked || {}).length;
            const total = RECIPES.length;

            const dishesHTML = RECIPES.map(r => {
              const unlocked = state.unlocked[r.id];
              return `
                <div class="kt-dish ${unlocked ? '' : 'is-locked'}"
                     data-recipe-id="${r.id}">
                  <div class="kt-dish__icon">${unlocked ? r.icon : '❓'}</div>
                  <div class="kt-dish__name">${unlocked ? r.name : '???'}</div>
                  <div class="kt-dish__price">${unlocked ? `💰 ${r.price}` : '未解锁'}</div>
                </div>
              `;
            }).join('');

            contentEl.innerHTML = `
              <div class="kt-book">
                <div class="kt-book__header">
                  <div class="kt-book__title">📖 食谱图鉴</div>
                  <div class="kt-book__progress">${unlockedCount} / ${total}</div>
                </div>
                <div class="kt-book__grid">${dishesHTML}</div>
              </div>
            `;

            // ★ 点击跳详情
            contentEl.querySelectorAll('.kt-dish').forEach(el => {
              el.addEventListener('click', () => {
                const recipeId = el.dataset.recipeId;
                const recipe = RECIPES.find(r => r.id === recipeId);
                if (!recipe) return;
                if (navigator.vibrate) { try { navigator.vibrate(4); } catch {} }
                ctx.push('detail', {
                  recipe,
                  unlocked: !!state.unlocked[recipeId],
                });
              });
            });
          }

          // ============ 签到 ============
          function renderSignIn() {
            const today = todayStr();
            const signed = state.lastSignIn === today;

            contentEl.innerHTML = `
              <div class="kt-signin">
                <div class="kt-signin__hero">${signed ? '🎉' : '🥛'}</div>
                <div class="kt-signin__title">${signed ? '今日已签到' : '每日签到'}</div>
                <div class="kt-signin__desc">
                  ${signed
                    ? '明天再来吧～<br>今天已经领过了'
                    : `签到领 <strong>${SIGN_IN_REWARD}</strong> 金币<br>每天都能领一次`}
                </div>
                <button class="kt-signin__btn" id="ktSignBtn" type="button" ${signed ? 'disabled' : ''}>
                  ${signed ? '明天再来' : `领取 ${SIGN_IN_REWARD} 金币`}
                </button>
              </div>
            `;

            const btn = contentEl.querySelector('#ktSignBtn');
            if (btn && !signed) {
              btn.addEventListener('click', async () => {
                state.lastSignIn = today;
                state.coins = (state.coins || 0) + SIGN_IN_REWARD;
                await saveState(state);
                updateCoins();
                if (navigator.vibrate) { try { navigator.vibrate([15, 30, 15]); } catch {} }
                WujiToast.show(`签到成功 +${SIGN_IN_REWARD} 金币`);
                renderSignIn();
              });
            }
          }

          // ============ Tab ============
          function switchTab(tab) {
            currentTab = tab;
            tabBtns.forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
            if (tab === 'kitchen') renderKitchen();
            else if (tab === 'shop') renderShop();
            else if (tab === 'book') renderBook();
            else if (tab === 'signin') renderSignIn();
          }

          tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
              if (currentTab === btn.dataset.tab) return;
              if (navigator.vibrate) { try { navigator.vibrate(4); } catch {} }
              switchTab(btn.dataset.tab);
            });
          });

          // ============ 返回首页时刷新金币 ============
          const offNav = ctx.nav.onChange(async () => {
            if (disposed) return;
            if (ctx.nav.current?.route?.name !== 'main') return;
            const fresh = await loadState();
            if (fresh) {
              state.coins = fresh.coins;
              state.inventory = fresh.inventory;
              state.unlocked = fresh.unlocked;
              state.lastSignIn = fresh.lastSignIn;
              updateCoins();
              switchTab(currentTab);
            }
          });

          (async () => {
            state = await loadState();
            if (disposed) return;
            updateCoins();
            renderKitchen();
          })();

          return () => {
            disposed = true;
            offNav();
            clearTimeout(resultTimer);
          };
        },
      },

      // ============ 菜品详情页 ============
      detail: {
        name: 'detail',

        render(routeCtx) {
          const recipe = routeCtx.data?.recipe;
          const unlocked = routeCtx.data?.unlocked;
          if (!recipe) {
            return `<div class="kt-detail"><div class="kt-detail__section">菜品不存在</div></div>`;
          }

          const ingsHTML = recipe.ings.map(id => {
            const ing = ingById(id);
            if (unlocked) {
              return `<div class="kt-detail__ing">${ing.icon} ${ing.name}</div>`;
            }
            return `<div class="kt-detail__ing kt-detail__ing--locked">❓ ???</div>`;
          }).join('');

          const lockedHint = `<div class="kt-detail__locked-hint">做成这道菜后解锁配方</div>`;

          return `
            <div class="kt-detail">
              <div class="kt-detail__hero ${unlocked ? '' : 'is-locked'}">
                <div class="kt-detail__icon">${unlocked ? recipe.icon : '❓'}</div>
                <div class="kt-detail__name">${unlocked ? recipe.name : '???'}</div>
                <div class="kt-detail__price">${unlocked ? `💰 ${recipe.price}` : '未解锁'}</div>
              </div>

              <div class="kt-detail__section">
                <div class="kt-detail__section-title">配方（${recipe.ings.length} 种食材）</div>
                ${unlocked ? `<div class="kt-detail__ings">${ingsHTML}</div>` : lockedHint}
              </div>
            </div>
          `;
        },
      },
    },
  });
})();