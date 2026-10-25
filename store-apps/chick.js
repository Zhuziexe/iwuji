(() => {
  const BUNDLE = 'com.wujinb.chick';
  const ICON_URL = './assets/chick.svg';
  const NOTIF_ID = 1001;

  const DECAY = { hunger: 8, clean: 5, mood: 6 };
  const clamp = v => Math.max(0, Math.min(100, v));

  function db() { return AppStorage.for(BUNDLE); }

  function stateOf(pet) {
    if (pet.hunger < 20) return 'hungry';
    if (pet.clean < 20) return 'dirty';
    if (pet.mood < 20) return 'sad';
    if (pet.hunger > 70 && pet.clean > 70 && pet.mood > 70) return 'happy';
    return 'normal';
  }

  function stateText(pet) {
    const s = stateOf(pet);
    return {
      hungry: '饿得不行了…',
      dirty: '身上好脏，想洗澡',
      sad: '有点难过，陪陪我',
      happy: '非常开心！',
      normal: '还不错',
    }[s];
  }

  async function loadPet({ create = false } = {}) {
    let pet = await db().get('pet', null);

    if (!pet || typeof pet !== 'object') {
      if (!create) return null;
      pet = {
        bornAt: Date.now(),
        lastUpdate: Date.now(),
        hunger: 70,
        clean: 70,
        mood: 70,
        outfit: { hat: false, scarf: false },
      };
      await db().set('pet', pet);
      return pet;
    }

    const now = Date.now();
    const hours = Math.max(0, (now - (pet.lastUpdate || now)) / 3600000);
    if (hours > 0) {
      pet.hunger = clamp((pet.hunger || 0) - DECAY.hunger * hours);
      pet.clean = clamp((pet.clean || 0) - DECAY.clean * hours);
      pet.mood = clamp((pet.mood || 0) - DECAY.mood * hours);
      pet.lastUpdate = now;
    }

    if (!pet.outfit || typeof pet.outfit !== 'object') {
      pet.outfit = { hat: false, scarf: false };
    }
    if (typeof pet.outfit.hat   !== 'boolean') pet.outfit.hat = false;
    if (typeof pet.outfit.scarf !== 'boolean') pet.outfit.scarf = false;

    return pet;
  }

  async function savePet(pet) {
    pet.lastUpdate = Date.now();
    await db().set('pet', pet);
  }

  function syncNotification(pet, islock = false) {
    try {
      if (!pet) {
        WujiNotification.unpublish({ bundlename: BUNDLE, id: NOTIF_ID });
        return;
      }

      const alerts = [];
      if (pet.hunger < 20) alerts.push('饿了');
      if (pet.clean < 20) alerts.push('脏了');
      if (pet.mood < 20) alerts.push('不开心');

      if (alerts.length) {
        WujiNotification.publish({
          bundlename: BUNDLE,
          id: NOTIF_ID,
          title: '吴际小鸡',
          content: `小鸡${alerts.join('、')}，回来看看它吧`,
          showtime: false,
          notifyuser: islock,
          clickparams: {},
        });
      } else {
        WujiNotification.unpublish({ bundlename: BUNDLE, id: NOTIF_ID });
      }
    } catch { }
  }

  async function checkPetStatus() {
    const pet = await loadPet({ create: false });
    if (!pet) return;
    syncNotification(pet, true);
    await savePet(pet);
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h >= 6  && h < 9)  return '早安！今天也要加油哦';
    if (h >= 9  && h < 11) return '上午好~';
    if (h >= 11 && h < 13) return '该吃午饭啦，我也饿了';
    if (h >= 13 && h < 18) return '下午好，晒晒太阳吧';
    if (h >= 18 && h < 21) return '晚上好，今天过得怎么样？';
    if (h >= 21 && h < 23) return '准备睡觉啦';
    return '这么晚还不睡？我先睡了…';
  }

  const EVENTS = [
    '小鸡在窗边看到了一只蝴蝶，盯了好久',
    '小鸡学会了一个新动作，得意地跳来跳去',
    '小鸡做了一个梦，梦见自己会飞',
    '小鸡偷偷把你的袜子藏起来了',
    '小鸡捡到一颗漂亮的石子，当宝贝一样收着',
    '小鸡认识了一只路过的小鸟',
    '小鸡盯着云看了一下午',
    '小鸡打了个大哈欠，又睡着了',
    '小鸡把饭粒摆成了一个笑脸',
    '小鸡跟着你走了一路，说想多陪陪你',
  ];

  async function loadDiary() {
    try { return await db().get('diary', null); }
    catch { return null; }
  }

  async function saveDiary(entry) {
    try { await db().set('diary', entry); } catch { }
  }

  async function markDiaryRead() {
    const entry = await loadDiary();
    if (!entry || entry.read) return;
    await saveDiary({ ...entry, read: true });
  }

  async function maybeTriggerEvent() {
    const last = await loadDiary();
    const since = last ? (Date.now() - last.timestamp) : Infinity;

    let prob;
    if (since >= 12 * 3600000)      prob = 1;
    else if (since >= 6 * 3600000)  prob = 0.7;
    else if (since >= 2 * 3600000)  prob = 0.35;
    else                            prob = 0.1;

    if (Math.random() > prob) return null;

    const pool = EVENTS.filter(e => !last || e !== last.text);
    const list = pool.length ? pool : EVENTS;
    const text = list[Math.floor(Math.random() * list.length)];

    await saveDiary({ text, timestamp: Date.now(), read: false });
    return text;
  }

  function chickSVG(pet) {
    const s = stateOf(pet);
    const happy = s === 'happy';
    const sad = s === 'sad';
    const outfit = pet.outfit || {};

    const eyes = happy
      ? `<path d="M36 32 Q42 26 48 32" stroke="#1c2536" stroke-width="3" fill="none" stroke-linecap="round"/>
         <path d="M52 32 Q58 26 64 32" stroke="#1c2536" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<circle cx="42" cy="32" r="3.5" fill="#1c2536"/>
         <circle cx="58" cy="32" r="3.5" fill="#1c2536"/>`;

    const mouth = sad
      ? `<path d="M44 46 Q50 40 56 46" stroke="#FF9500" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
      : happy
        ? `<path d="M44 42 Q50 49 56 42" stroke="#FF9500" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
        : `<path d="M44 44 L56 44" stroke="#FF9500" stroke-width="2.8" stroke-linecap="round"/>`;

    const dirt = s === 'dirty'
      ? `<circle cx="28" cy="52" r="4" fill="#8B7355" opacity="0.55"/>
         <circle cx="74" cy="68" r="3" fill="#8B7355" opacity="0.5"/>
         <circle cx="56" cy="78" r="3.5" fill="#8B7355" opacity="0.5"/>`
      : '';

    const hungryMark = s === 'hungry'
      ? `<text x="78" y="24" font-size="16" font-weight="700" fill="#e0356b">!</text>`
      : '';

    const hat = outfit.hat ? `
      <g class="chick-hat">
        <rect x="26" y="16" width="48" height="5" rx="2.5" fill="#2c5ad0"/>
        <path d="M30 16 Q30 2 50 2 Q70 2 70 16 Z" fill="#3a6ff0"/>
        <circle cx="50" cy="3" r="3.5" fill="#ffd93b"/>
      </g>
    ` : '';

    const scarf = outfit.scarf ? `
      <g class="chick-scarf">
        <path d="M26 49 Q50 61 74 49 L74 55 Q50 67 26 55 Z"
              fill="#d64550"/>
        <path d="M28 50 Q50 60.5 72 50"
              stroke="#eb6b73" stroke-width="1.2"
              stroke-linecap="round" fill="none" opacity="0.5"/>
        <path d="M30 54 Q25 63 27 71 Q28 75 31 74 Q33 72 32 66 Q30 60 33 54 Z"
              fill="#d64550"/>
      </g>
    ` : '';

    return `
      <svg viewBox="0 0 100 100" class="chick-svg">
        <ellipse cx="50" cy="62" rx="32" ry="30" fill="#FFD93B"/>
        <circle cx="50" cy="36" r="24" fill="#FFE066"/>
        <path d="M38 14 Q42 6 46 14 Q50 6 54 14 Q58 6 62 14" fill="#e0356b"/>
        <ellipse cx="16" cy="60" rx="8" ry="14" fill="#FFD93B" transform="rotate(-15 16 60)"/>
        <ellipse cx="84" cy="60" rx="8" ry="14" fill="#FFD93B" transform="rotate(15 84 60)"/>
        ${hat}
        ${scarf}
        ${eyes}
        ${mouth}
        <line x1="38" y1="90" x2="38" y2="97" stroke="#FF9500" stroke-width="3" stroke-linecap="round"/>
        <line x1="62" y1="90" x2="62" y2="97" stroke="#FF9500" stroke-width="3" stroke-linecap="round"/>
        ${dirt}
        ${hungryMark}
      </svg>
    `;
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际小鸡',
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.0.6',

    onBoot() {
      checkPetStatus().catch(() => { });
    },

    onShutdown() {
    },

    styles: `
      .chick-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: linear-gradient(160deg, #fff8e1 0%, #ffe082 100%);
        padding-top: var(--statusbar-h);
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
      }

      .chick-header {
        flex: 0 0 auto;
        padding: 14px 25px 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .chick-title {
        font-size: var(--wj-fs-2xl);
        font-weight: 700;
        color: #5d4037;
        letter-spacing: .3px;
      }
      .chick-header-actions {
        display: flex;
        gap: 8px;
        flex: 0 0 auto;
      }
      .chick-diary-btn {
        position: relative;
        flex: 0 0 auto;
        padding: 5px 12px;
        border: 0;
        border-radius: 999px;
        background: rgba(93, 64, 55, 0.1);
        color: #5d4037;
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 500;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .15s;
      }
      .chick-diary-btn:active { background: rgba(93, 64, 55, 0.2); }
      .chick-diary-dot {
        position: absolute;
        top: -1px;
        right: -1px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #e0356b;
        display: none;
        pointer-events: none;
        box-shadow: 0 0 0 1.5px #fff8e1;
      }
      .chick-diary-dot.is-show { display: block; }

      .chick-stage {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .chick-body {
        position: relative;
        z-index: 1;
      }

      .chick-svg {
        width: 196px;
        height: 196px;
        display: block;
        animation: chickBreathe 2.8s ease-in-out infinite;
        transition: transform .2s;
      }
      @keyframes chickBreathe {
        0%, 100% { transform: scale(1) translateY(0); }
        50%      { transform: scale(1.03) translateY(-2px); }
      }
      .chick-svg.is-jumping {
        animation: chickJump .5s cubic-bezier(.3,.7,.4,1);
      }
      @keyframes chickJump {
        0%   { transform: translateY(0) scale(1); }
        40%  { transform: translateY(-24px) scale(1.05); }
        70%  { transform: translateY(0) scale(.97); }
        100% { transform: translateY(0) scale(1); }
      }
      .chick-svg.is-dizzy {
        animation: chickDizzy 1.2s ease-in-out;
      }
      @keyframes chickDizzy {
        0%   { transform: rotate(0deg); }
        20%  { transform: rotate(-15deg); }
        40%  { transform: rotate(15deg); }
        60%  { transform: rotate(-10deg); }
        80%  { transform: rotate(8deg); }
        100% { transform: rotate(0deg); }
      }

      .chick-heart {
        position: absolute;
        left: 50%;
        top: 25%;
        font-size: 28px;
        color: #e0356b;
        pointer-events: none;
        transform: translateX(-50%);
        animation: heartFloat 1.2s ease-out forwards;
        z-index: 20;
      }
      @keyframes heartFloat {
        0%   { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.6); }
        25%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.15); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-70px) scale(0.85); }
      }

      .chick-bubble {
        position: absolute;
        top: 10%;
        left: 50%;
        transform: translateX(-50%) translateY(6px);
        z-index: 10;
        padding: 11px 20px;
        background: #fff;
        border-radius: 20px;
        font-size: var(--wj-fs-lg);
        color: #5d4037;
        box-shadow: 0 6px 17px rgba(93,64,55,.18);
        white-space: nowrap;
        opacity: 0;
        transition: opacity .25s, transform .25s;
        pointer-events: none;
      }
      .chick-bubble.is-show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .chick-bubble::after {
        content: '';
        position: absolute;
        bottom: -6px;
        left: 50%;
        margin-left: -6px;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid #fff;
      }

      .chick-stats {
        flex: 0 0 auto;
        padding: 0 25px 11px;
        display: flex;
        flex-direction: column;
        gap: 11px;
      }
      .chick-stat {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .chick-stat__label {
        flex: 0 0 45px;
        font-size: var(--wj-fs-md);
        color: #8d6e63;
        font-weight: 600;
      }
      .chick-stat__bar {
        flex: 1 1 auto;
        height: 11px;
        border-radius: 6px;
        background: rgba(93, 64, 55, .12);
        overflow: hidden;
      }
      .chick-stat__fill {
        height: 100%;
        border-radius: 6px;
        transition: width .4s cubic-bezier(.2,.7,.3,1);
      }
      .chick-stat__fill--hunger { background: #FF9500; }
      .chick-stat__fill--clean  { background: #3a6ff0; }
      .chick-stat__fill--mood   { background: #e0356b; }
      .chick-stat__val {
        flex: 0 0 39px;
        text-align: right;
        font-size: var(--wj-fs-md);
        color: #8d6e63;
        font-variant-numeric: tabular-nums;
      }

      .chick-status {
        flex: 0 0 auto;
        text-align: center;
        font-size: var(--wj-fs-lg);
        color: #5d4037;
        padding: 6px 25px 14px;
        font-weight: 500;
      }

      .chick-actions {
        flex: 0 0 auto;
        display: flex;
        gap: 11px;
        padding: 0 20px calc(20px + env(safe-area-inset-bottom, 0px));
      }
      .chick-btn {
        flex: 1 1 0;
        padding: 20px 0;
        border: 0;
        border-radius: 20px;
        font: inherit;
        font-size: var(--wj-fs-xl);
        font-weight: 600;
        color: #fff;
        cursor: pointer;
        transition: transform .08s, filter .15s;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 6px 17px rgba(93,64,55,.18);
      }
      .chick-btn:active { transform: scale(.95); filter: brightness(.92); }
      .chick-btn--feed  { background: linear-gradient(180deg, #ffb74d, #ff9500); }
      .chick-btn--clean { background: linear-gradient(180deg, #64b5f6, #3a6ff0); }
      .chick-btn--play  { background: linear-gradient(180deg, #f06292, #e0356b); }

      .chick-diary-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: linear-gradient(160deg, #fff8e1 0%, #ffe082 100%);
        padding-top: var(--statusbar-h);
        overflow-y: auto;
        user-select: none;
        -webkit-user-select: none;
      }
      .chick-diary-header {
        flex: 0 0 auto;
        padding: 14px 25px 6px;
      }
      #chickDiaryContent {
        flex: 1 1 auto;
        padding: 12px 25px 24px;
      }
      .chick-diary-empty {
        text-align: center;
        padding: 60px 20px;
        color: #8d6e63;
        font-size: var(--wj-fs-md);
        line-height: 1.6;
      }
      .chick-diary-card {
        background: #fff;
        border-radius: 20px;
        padding: 20px 22px;
        box-shadow: 0 6px 17px rgba(93, 64, 55, .1);
      }
      .chick-diary-date {
        font-size: var(--wj-fs-xs);
        color: #8d6e63;
        margin-bottom: 10px;
        letter-spacing: .3px;
      }
      .chick-diary-text {
        font-size: var(--wj-fs-lg);
        color: #5d4037;
        line-height: 1.6;
      }

      .chick-wardrobe-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: linear-gradient(160deg, #fff8e1 0%, #ffe082 100%);
        padding-top: var(--statusbar-h);
        overflow-y: auto;
        user-select: none;
        -webkit-user-select: none;
      }
      .chick-wardrobe-header {
        flex: 0 0 auto;
        padding: 14px 25px 6px;
      }
      .chick-wardrobe-grid {
        flex: 1 1 auto;
        padding: 20px 25px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        align-content: start;
      }
      .chick-wardrobe-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 24px 16px;
        border-radius: 20px;
        background: #fff;
        box-shadow: 0 6px 17px rgba(93, 64, 55, .1);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .1s, box-shadow .15s, border-color .15s;
        border: 2px solid transparent;
      }
      .chick-wardrobe-card:active { transform: scale(.97); }
      .chick-wardrobe-card.is-on {
        border-color: #e0356b;
        box-shadow: 0 6px 20px rgba(224, 53, 107, .25);
      }
      .chick-wardrobe-icon {
        font-size: 48px;
        line-height: 1;
      }
      .chick-wardrobe-name {
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        color: #5d4037;
      }
      .chick-wardrobe-state {
        font-size: var(--wj-fs-sm);
        color: #8d6e63;
      }
      .chick-wardrobe-card.is-on .chick-wardrobe-state {
        color: #e0356b;
        font-weight: 600;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="chick-page">
              <div class="chick-header">
                <div class="chick-title">吴际小鸡</div>
                <div class="chick-header-actions">
                  <button class="chick-diary-btn" id="chickWardrobeBtn" type="button">衣柜</button>
                  <button class="chick-diary-btn" id="chickDiaryBtn" type="button">
                    日记
                    <span class="chick-diary-dot" id="chickDiaryDot"></span>
                  </button>
                </div>
              </div>

              <div class="chick-stage" id="chickStage">
                <div class="chick-body" id="chickBody"></div>
                <div class="chick-bubble" id="chickBubble"></div>
              </div>

              <div class="chick-stats">
                <div class="chick-stat">
                  <span class="chick-stat__label">饱食</span>
                  <div class="chick-stat__bar">
                    <div class="chick-stat__fill chick-stat__fill--hunger" id="hungerFill"></div>
                  </div>
                  <span class="chick-stat__val" id="hungerVal">--</span>
                </div>
                <div class="chick-stat">
                  <span class="chick-stat__label">清洁</span>
                  <div class="chick-stat__bar">
                    <div class="chick-stat__fill chick-stat__fill--clean" id="cleanFill"></div>
                  </div>
                  <span class="chick-stat__val" id="cleanVal">--</span>
                </div>
                <div class="chick-stat">
                  <span class="chick-stat__label">心情</span>
                  <div class="chick-stat__bar">
                    <div class="chick-stat__fill chick-stat__fill--mood" id="moodFill"></div>
                  </div>
                  <span class="chick-stat__val" id="moodVal">--</span>
                </div>
              </div>

              <div class="chick-status" id="chickStatus">—</div>

              <div class="chick-actions">
                <button class="chick-btn chick-btn--feed"  data-act="feed"  type="button">喂食</button>
                <button class="chick-btn chick-btn--clean" data-act="clean" type="button">清洁</button>
                <button class="chick-btn chick-btn--play"  data-act="play"  type="button">玩耍</button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const chickBodyEl = root.querySelector('#chickBody');
          const bubbleEl = root.querySelector('#chickBubble');
          const statusEl = root.querySelector('#chickStatus');
          const hungerFill = root.querySelector('#hungerFill');
          const cleanFill = root.querySelector('#cleanFill');
          const moodFill = root.querySelector('#moodFill');
          const hungerVal = root.querySelector('#hungerVal');
          const cleanVal = root.querySelector('#cleanVal');
          const moodVal = root.querySelector('#moodVal');
          const stageEl = root.querySelector('#chickStage');
          const diaryBtn = root.querySelector('#chickDiaryBtn');
          const diaryDot = root.querySelector('#chickDiaryDot');
          const wardrobeBtn = root.querySelector('#chickWardrobeBtn');

          let pet = null;
          let disposed = false;
          let bubbleTimer = null;
          let tickTimer = null;
          let lastRenderState = '';

          let tapCount = 0;
          let tapWindowTimer = null;
          let longPressTimer = null;
          let longPressFired = false;

          function showBubble(text) {
            bubbleEl.textContent = text;
            bubbleEl.classList.add('is-show');
            clearTimeout(bubbleTimer);
            bubbleTimer = setTimeout(() => {
              bubbleEl.classList.remove('is-show');
            }, 1600);
          }

          function render() {
            if (!pet || disposed) return;

            const s = stateOf(pet);
            const outfitSig =
              (pet.outfit && pet.outfit.hat ? '1' : '0') +
              (pet.outfit && pet.outfit.scarf ? '1' : '0');
            const sig = s + '|' + outfitSig;

            if (sig !== lastRenderState) {
              lastRenderState = sig;
              chickBodyEl.innerHTML = chickSVG(pet);
            }

            hungerFill.style.width = pet.hunger + '%';
            cleanFill.style.width = pet.clean + '%';
            moodFill.style.width = pet.mood + '%';
            hungerVal.textContent = Math.round(pet.hunger);
            cleanVal.textContent = Math.round(pet.clean);
            moodVal.textContent = Math.round(pet.mood);

            statusEl.textContent = stateText(pet);
          }

          function jump() {
            const svg = chickBodyEl.querySelector('.chick-svg');
            if (!svg) return;
            svg.classList.remove('is-jumping');
            void svg.getBoundingClientRect();
            svg.classList.add('is-jumping');
            setTimeout(() => {
              if (svg.isConnected) svg.classList.remove('is-jumping');
            }, 520);
          }

          function dizzy() {
            const svg = chickBodyEl.querySelector('.chick-svg');
            if (!svg) return;
            svg.classList.remove('is-jumping');
            svg.classList.add('is-dizzy');
            setTimeout(() => {
              if (svg.isConnected) svg.classList.remove('is-dizzy');
            }, 1250);
          }

          function showHeart() {
            const heart = document.createElement('div');
            heart.className = 'chick-heart';
            heart.textContent = '❤';
            stageEl.appendChild(heart);
            setTimeout(() => {
              if (heart.isConnected) heart.remove();
            }, 1250);
          }

          async function act(type) {
            if (!pet || disposed) return;

            if (type === 'feed') {
              if (pet.hunger >= 95) { showBubble('已经吃饱啦'); return; }
              pet.hunger = clamp(pet.hunger + 30);
              pet.mood = clamp(pet.mood + 5);
              pet.clean = clamp(pet.clean - 15);
              showBubble('好吃！');
            } else if (type === 'clean') {
              if (pet.clean >= 95) { showBubble('已经很干净了'); return; }
              pet.clean = clamp(pet.clean + 40);
              pet.mood = clamp(pet.mood + 5);
              showBubble('洗香香~');
            } else if (type === 'play') {
              if (pet.mood >= 95) { showBubble('已经很开心了'); return; }
              pet.mood = clamp(pet.mood + 30);
              pet.hunger = clamp(pet.hunger - 20);
              pet.clean = clamp(pet.clean - 10);
              showBubble('好好玩！');
            }

            jump();
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }

            render();
            syncNotification(pet);
            await savePet(pet);
          }

          root.querySelectorAll('.chick-btn').forEach(btn => {
            btn.addEventListener('click', () => act(btn.dataset.act));
          });

          diaryBtn?.addEventListener('click', () => {
            if (diaryDot) diaryDot.classList.remove('is-show');
            markDiaryRead().catch(() => { });
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
            ctx.push('diary');
          });

          wardrobeBtn?.addEventListener('click', () => {
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
            ctx.push('wardrobe');
          });

          /* ★ 从其他路由（衣柜 / 日记）返回 home 时，重新读 DB 的 outfit 并重绘 */
          const offNav = ctx.nav.onChange(async () => {
            if (disposed) return;
            if (ctx.nav.current?.route?.name !== 'home') return;
            const fresh = await loadPet({ create: false });
            if (!fresh || !pet) return;
            pet.outfit = fresh.outfit || pet.outfit;
            lastRenderState = '';
            render();
          });

          function onStageDown(e) {
            if (e.target.closest('.chick-btn')) return;
            if (e.target.closest('.chick-diary-btn')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            longPressFired = false;
            clearTimeout(longPressTimer);
            longPressTimer = setTimeout(() => {
              longPressTimer = null;
              longPressFired = true;
              showHeart();
              showBubble('好喜欢你~');
              if (navigator.vibrate) { try { navigator.vibrate(12); } catch { } }
            }, 600);
          }

          function onStageUp(e) {
            if (e.target.closest('.chick-btn')) return;
            if (e.target.closest('.chick-diary-btn')) return;

            clearTimeout(longPressTimer);
            longPressTimer = null;

            if (longPressFired) {
              longPressFired = false;
              return;
            }

            jump();
            if (navigator.vibrate) { try { navigator.vibrate(4); } catch { } }

            tapCount++;
            clearTimeout(tapWindowTimer);
            tapWindowTimer = setTimeout(() => {
              tapCount = 0;
              tapWindowTimer = null;
            }, 500);

            if (tapCount >= 3) {
              tapCount = 0;
              clearTimeout(tapWindowTimer);
              tapWindowTimer = null;
              dizzy();
              showBubble('晕了晕了…');
              if (navigator.vibrate) { try { navigator.vibrate([8, 40, 8]); } catch { } }
            }
          }

          function onStageCancel() {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            longPressFired = false;
          }

          stageEl.addEventListener('pointerdown', onStageDown, { passive: true });
          stageEl.addEventListener('pointerup', onStageUp, { passive: true });
          stageEl.addEventListener('pointercancel', onStageCancel, { passive: true });

          (async () => {
            pet = await loadPet({ create: true });
            if (disposed) return;
            render();
            syncNotification(pet);

            try {
              const existing = await loadDiary();
              if (!disposed && diaryDot && existing && !existing.read) {
                diaryDot.classList.add('is-show');
              }
            } catch { }

            setTimeout(() => {
              if (!disposed) showBubble(getGreeting());
            }, 300);

            try {
              const evt = await maybeTriggerEvent();
              if (evt && !disposed && diaryDot) {
                diaryDot.classList.add('is-show');
              }
            } catch { }

            let lastTick = Date.now();
            tickTimer = setInterval(() => {
              if (disposed || !pet) return;
              const now = Date.now();
              const hours = (now - lastTick) / 3600000;
              lastTick = now;
              pet.hunger = clamp(pet.hunger - DECAY.hunger * hours);
              pet.clean = clamp(pet.clean - DECAY.clean * hours);
              pet.mood = clamp(pet.mood - DECAY.mood * hours);
              render();
            }, 60000);
          })();

          return () => {
            offNav();
            disposed = true;
            clearTimeout(bubbleTimer);
            clearInterval(tickTimer);
            clearTimeout(tapWindowTimer);
            clearTimeout(longPressTimer);

            /* ★ 合并保存：数值用内存最新值，outfit 用 DB 最新值（衣柜可能改过） */
            if (pet) {
              db().get('pet', null).then(fresh => {
                const base = (fresh && typeof fresh === 'object')
                  ? fresh
                  : { ...pet };
                base.hunger = pet.hunger;
                base.clean = pet.clean;
                base.mood = pet.mood;
                base.lastUpdate = Date.now();
                return db().set('pet', base);
              }).catch(() => { });
            }
          };
        },
      },

      diary: {
        name: 'diary',

        render() {
          return `
            <div class="chick-diary-page">
              <div class="chick-diary-header">
                <div class="chick-title">小鸡日记</div>
              </div>
              <div id="chickDiaryContent"></div>
            </div>
          `;
        },

        mount(root) {
          const contentEl = root.querySelector('#chickDiaryContent');

          (async () => {
            const entry = await loadDiary();
            if (entry && !entry.read) {
              await saveDiary({ ...entry, read: true });
            }
            if (!root.isConnected || !contentEl) return;

            if (!entry) {
              contentEl.innerHTML = `
                <div class="chick-diary-empty">
                  小鸡还没有日记…<br>多来看看它吧
                </div>
              `;
              return;
            }

            const d = new Date(entry.timestamp);
            const p2 = n => String(n).padStart(2, '0');
            const dateStr =
              `${d.getMonth() + 1}月${d.getDate()}日 ` +
              `${p2(d.getHours())}:${p2(d.getMinutes())}`;

            contentEl.innerHTML = `
              <div class="chick-diary-card">
                <div class="chick-diary-date">${dateStr}</div>
                <div class="chick-diary-text">${entry.text}</div>
              </div>
            `;
          })();
        },
      },

      wardrobe: {
        name: 'wardrobe',

        render() {
          return `
            <div class="chick-wardrobe-page">
              <div class="chick-wardrobe-header">
                <div class="chick-title">小鸡衣柜</div>
              </div>
              <div class="chick-wardrobe-grid" id="chickWardrobeGrid"></div>
            </div>
          `;
        },

        mount(root) {
          const grid = root.querySelector('#chickWardrobeGrid');

          const ITEMS = [
            { key: 'hat',   name: '帽子', icon: '🎩' },
            { key: 'scarf', name: '围巾', icon: '🧣' },
          ];

          let disposed = false;

          async function renderGrid() {
            const pet = await loadPet({ create: true });
            if (!pet || !root.isConnected || disposed) return;

            const outfit = pet.outfit || {};

            grid.innerHTML = ITEMS.map(item => `
              <div class="chick-wardrobe-card ${outfit[item.key] ? 'is-on' : ''}"
                   data-key="${item.key}">
                <div class="chick-wardrobe-icon">${item.icon}</div>
                <div class="chick-wardrobe-name">${item.name}</div>
                <div class="chick-wardrobe-state">${outfit[item.key] ? '已穿上' : '点击穿上'}</div>
              </div>
            `).join('');

            grid.querySelectorAll('.chick-wardrobe-card').forEach(el => {
              el.addEventListener('click', async () => {
                const key = el.dataset.key;
                const current = await loadPet({ create: true });
                if (!current) return;

                if (!current.outfit) current.outfit = { hat: false, scarf: false };
                current.outfit[key] = !current.outfit[key];

                await savePet(current);
                if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }

                renderGrid();
              });
            });
          }

          renderGrid();

          return () => { disposed = true; };
        },
      },
    },
  });
})();