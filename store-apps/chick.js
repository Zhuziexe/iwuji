(() => {
  const BUNDLE = 'com.wujinb.chick';
  const ICON_URL = './assets/chick.svg';
  const NOTIF_ID = 1001;

  const DECAY = { hunger: 8, clean: 5, mood: 6 };
  const clamp = v => Math.max(0, Math.min(100, v));

  const OUTFIT_ITEMS = [
    { key: 'bowtie',      name: '领结',   price: 2 },
    { key: 'hat',         name: '帽子',   price: 3 },
    { key: 'scarf',       name: '围巾',   price: 3 },
    { key: 'socks',       name: '袜子',   price: 3 },
    { key: 'glasses',     name: '眼镜',   price: 5 },
    { key: 'boots',       name: '靴子',   price: 5 },
    { key: 'nbhat',       name: '牛逼帽', price: 6 },
    { key: 'sunglasses',  name: '墨镜',   price: 8 },
    { key: 'headphones',  name: '耳机',   price: 8 },
  ];

  const EXCLUSIVE_GROUPS = [
    ['hat', 'nbhat', 'headphones'],
    ['glasses', 'sunglasses'],
    ['scarf', 'bowtie'],
    ['socks', 'boots'], 
  ];

  const EGG_INTERVAL = 12 * 3600000;

  function defaultOutfit() {
    return {
      hat: false, scarf: false, glasses: false, nbhat: false,
      bowtie: false, socks: false, boots: false,
      sunglasses: false, headphones: false,
    };
  }

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
        outfit: defaultOutfit(),
        owned: defaultOutfit(),
        eggs: 0,
        eggOnStage: false,
        lastEggAt: 0,
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

    /* 兼容旧数据 */
    if (!pet.outfit || typeof pet.outfit !== 'object') pet.outfit = defaultOutfit();
    if (!pet.owned  || typeof pet.owned  !== 'object') pet.owned  = defaultOutfit();
    if (typeof pet.eggs !== 'number') pet.eggs = 0;
    if (typeof pet.eggOnStage !== 'boolean') pet.eggOnStage = false;
    if (typeof pet.lastEggAt !== 'number') pet.lastEggAt = 0;

    /* 逐键校验；旧数据里已穿过的视为已拥有 */
    for (const it of OUTFIT_ITEMS) {
      if (typeof pet.outfit[it.key] !== 'boolean') pet.outfit[it.key] = false;
      if (typeof pet.owned[it.key]  !== 'boolean') {
        pet.owned[it.key] = pet.outfit[it.key] === true;
      }
    }

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

    const hasHeadphones = outfit.headphones === true;
    const hasSunglasses = outfit.sunglasses === true;
    const hasBowtie     = outfit.bowtie     === true;
    const hasBoots      = outfit.boots      === true;
    const hasSocks      = outfit.socks      === true;

    // 墨镜穿戴时，不画眼睛
    const eyes = hasSunglasses ? '' : (happy
      ? `<path d="M36 32 Q42 26 48 32" stroke="#1c2536" stroke-width="3" fill="none" stroke-linecap="round"/>
         <path d="M52 32 Q58 26 64 32" stroke="#1c2536" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<circle cx="42" cy="32" r="3.5" fill="#1c2536"/>
         <circle cx="58" cy="32" r="3.5" fill="#1c2536"/>`);

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

    // ---- 头顶：牛逼帽 / 帽子 / 耳机 三选一 ----
    const hatSVG = outfit.nbhat ? `
      <g class="chick-nbhat">
        <rect x="24" y="16" width="52" height="6" rx="3" fill="#1e40af"/>
        <path d="M28 16 Q28 0 50 0 Q72 0 72 16 Z" fill="#2563eb"/>
        <text x="50" y="12" text-anchor="middle"
              font-family="Arial, sans-serif" font-size="11"
              font-weight="900" fill="#ffffff" letter-spacing="0">NB</text>
      </g>
    ` : (outfit.hat ? `
      <g class="chick-hat">
        <rect x="26" y="16" width="48" height="5" rx="2.5" fill="#8ae580"/>
        <path d="M30 16 Q30 2 50 2 Q70 2 70 16 Z" fill="#38c129"/>
        <circle cx="50" cy="3" r="3.5" fill="#ffd93b"/>
      </g>
    ` : (hasHeadphones ? `
      <g class="chick-headphones">
        <path d="M28 32 Q28 6 50 6 Q72 6 72 32"
              stroke="#3a4050" stroke-width="4.5" fill="none" stroke-linecap="round"/>
        <circle cx="26" cy="36" r="7.5" fill="#3a4050"/>
        <circle cx="74" cy="36" r="7.5" fill="#3a4050"/>
        <circle cx="26" cy="36" r="3" fill="#8ad4ff"/>
        <circle cx="74" cy="36" r="3" fill="#8ad4ff"/>
      </g>
    ` : ''));

    // ---- 颈部：围巾 / 领结 二选一 ----
    const neckSVG = outfit.scarf ? `
      <g class="chick-scarf">
        <path d="M26 49 Q50 61 74 49 L74 55 Q50 67 26 55 Z"
              fill="#d64550"/>
        <path d="M28 50 Q50 60.5 72 50"
              stroke="#eb6b73" stroke-width="1.2"
              stroke-linecap="round" fill="none" opacity="0.5"/>
        <path d="M30 54 Q25 63 27 71 Q28 75 31 74 Q33 72 32 66 Q30 60 33 54 Z"
              fill="#d64550"/>
      </g>
    ` : (hasBowtie ? `
      <g class="chick-bowtie">
        <path d="M50 52 L37 45 L37 59 Z" fill="#d64550"/>
        <path d="M50 52 L63 45 L63 59 Z" fill="#d64550"/>
        <circle cx="50" cy="52" r="3.5" fill="#8b2530"/>
      </g>
    ` : '');

    // ---- 眼镜 / 墨镜 ----
    const glasses = outfit.glasses ? `
      <g class="chick-glasses">
        <circle cx="42" cy="32" r="9" fill="none" stroke="#5d4037" stroke-width="2.2"/>
        <circle cx="58" cy="32" r="9" fill="none" stroke="#5d4037" stroke-width="2.2"/>
        <line x1="51" y1="32" x2="49" y2="32"
              stroke="#5d4037" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="33" y1="30" x2="27" y2="27"
              stroke="#5d4037" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="67" y1="30" x2="73" y2="27"
              stroke="#5d4037" stroke-width="2.2" stroke-linecap="round"/>
      </g>
    ` : '';

    const sunglasses = hasSunglasses ? `
      <g class="chick-sunglasses">
        <rect x="33" y="27" width="15" height="10" rx="3" fill="#1c2536"/>
        <rect x="52" y="27" width="15" height="10" rx="3" fill="#1c2536"/>
        <line x1="48" y1="32" x2="52" y2="32" stroke="#1c2536" stroke-width="2.2"/>
        <line x1="33" y1="29" x2="27" y2="27" stroke="#1c2536" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="67" y1="29" x2="73" y2="27" stroke="#1c2536" stroke-width="2.2" stroke-linecap="round"/>
        <rect x="35" y="29" width="5" height="3" rx="1" fill="#4a90e2" opacity="0.5"/>
        <rect x="54" y="29" width="5" height="3" rx="1" fill="#4a90e2" opacity="0.5"/>
      </g>
    ` : '';

    const socks = hasSocks ? `
      <g class="chick-socks">
        <rect x="34" y="91" width="9" height="7" rx="1.5" fill="#e0356b"/>
        <rect x="57" y="91" width="9" height="7" rx="1.5" fill="#e0356b"/>
        <rect x="34" y="91" width="9" height="1.5" fill="#ffffff"/>
        <rect x="57" y="91" width="9" height="1.5" fill="#ffffff"/>
      </g>
    ` : '';

    const boots = hasBoots ? `
      <g class="chick-boots">
        <!-- 左脚：靴头朝左 -->
        <path d="M33 90 L33 94 Q28 95 28 98 L45 98 L45 90 Z" fill="#5d4037"/>
        <!-- 右脚：靴头朝右 -->
        <path d="M67 90 L67 94 Q72 95 72 98 L55 98 L55 90 Z" fill="#5d4037"/>
        <!-- 鞋口高光 -->
        <path d="M33 90 L33 92 L45 92 L45 90 Z" fill="#8d6e63"/>
        <path d="M55 90 L55 92 L67 92 L67 90 Z" fill="#8d6e63"/>
      </g>
    ` : '';

    return `
      <svg viewBox="0 0 100 100" class="chick-svg">
        <ellipse cx="50" cy="62" rx="32" ry="30" fill="#FFD93B"/>
        <circle cx="50" cy="36" r="24" fill="#FFE066"/>
        <path d="M38 14 Q42 6 46 14 Q50 6 54 14 Q58 6 62 14" fill="#e0356b"/>
        <ellipse cx="16" cy="60" rx="8" ry="14" fill="#FFD93B" transform="rotate(-15 16 60)"/>
        <ellipse cx="84" cy="60" rx="8" ry="14" fill="#FFD93B" transform="rotate(15 84 60)"/>
        ${hatSVG}
        ${neckSVG}
        ${eyes}
        ${glasses}
        ${sunglasses}
        ${mouth}
        <line x1="38" y1="88" x2="38" y2="95" stroke="#FF9500" stroke-width="3" stroke-linecap="round"/>
        <line x1="62" y1="88" x2="62" y2="95" stroke="#FF9500" stroke-width="3" stroke-linecap="round"/>
        ${socks}
        ${boots}
        ${dirt}
        ${hungryMark}
      </svg>
    `;
  }

  /* ---------- 蛋 SVG ---------- */
  function eggSVG() {
    return `
      <svg viewBox="0 0 30 40" class="chick-egg-on-stage-svg">
        <ellipse cx="15" cy="22" rx="11" ry="15" fill="#fff8e1" stroke="#f5d76e" stroke-width="1.8"/>
        <ellipse cx="11" cy="15" rx="2.5" ry="4" fill="#ffffff" opacity="0.75"/>
        <circle cx="19" cy="28" r="1.2" fill="#f5d76e" opacity="0.7"/>
        <circle cx="13" cy="30" r="1" fill="#f5d76e" opacity="0.7"/>
        <circle cx="17" cy="20" r="0.9" fill="#f5d76e" opacity="0.7"/>
      </svg>
    `;
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际小鸡',
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.2.1',

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
      .chick-header-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex: 0 0 auto;
      }
      .chick-egg-counter {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 999px;
        background: rgba(93, 64, 55, 0.1);
        color: #5d4037;
        font-size: var(--wj-fs-md);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        transition: transform .15s;
        align-self: stretch;
        justify-content: center;
      }
      .chick-egg-counter__icon {
        font-size: var(--wj-fs-md);
        line-height: 1;
      }
      .chick-egg-counter.is-bump {
        animation: eggBump .35s cubic-bezier(.3,.7,.4,1);
      }
      @keyframes eggBump {
        0%   { transform: scale(1); }
        50%  { transform: scale(1.22); }
        100% { transform: scale(1); }
      }

      .chick-header-actions {
        display: flex;
        gap: 8px;
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

      /* 舞台上的鸡蛋 */
      .chick-egg-on-stage {
        position: absolute;
        right: 15%;
        bottom: 20%;
        width: 44px;
        height: 58px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        z-index: 2;
        animation: eggWiggle 2.4s ease-in-out infinite;
      }
      @keyframes eggWiggle {
        0%, 100% { transform: rotate(0deg); }
        25%      { transform: rotate(-3deg); }
        75%      { transform: rotate(3deg); }
      }
      .chick-egg-on-stage-svg {
        width: 100%;
        height: 100%;
        display: block;
        filter: drop-shadow(0 4px 8px rgba(93,64,55,.15));
        transition: transform .1s;
      }
      .chick-egg-on-stage:active .chick-egg-on-stage-svg {
        transform: scale(.9);
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
        padding: 0 25px;
        display: flex;
        flex-direction: column;
        gap: 6px;
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
        padding: 6px 10px 14px;
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
        padding: 10px 0;
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

      /* ---------- 衣柜页 ---------- */
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
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .chick-wardrobe-grid {
        flex: 1 1 auto;
        padding: 16px 20px 24px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
        align-content: start;
      }
      .chick-wardrobe-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 14px 12px;
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
      .chick-wardrobe-preview {
        width: 100%;
        max-width: 96px;
        aspect-ratio: 1;
        border-radius: 14px;
        background: linear-gradient(160deg, #fff8e1 0%, #ffe082 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .chick-wardrobe-preview .chick-svg {
        width: 100%;
        height: 100%;
        animation: none;
        padding: 6px;
        box-sizing: border-box;
      }
      .chick-wardrobe-name {
        font-size: var(--wj-fs-md);
        font-weight: 600;
        color: #5d4037;
      }
      .chick-wardrobe-action {
        padding: 6px 14px;
        border: 0;
        border-radius: 999px;
        background: rgba(93, 64, 55, 0.1);
        color: #5d4037;
        font: inherit;
        font-size: var(--wj-fs-sm);
        font-weight: 600;
        white-space: nowrap;
        transition: background .15s, color .15s, opacity .15s;
      }
      .chick-wardrobe-card.is-on .chick-wardrobe-action {
        background: #e0356b;
        color: #fff;
      }
      .chick-wardrobe-action.is-locked {
        opacity: 0.55;
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
                <div class="chick-header-right">
                  <div class="chick-egg-counter" id="chickEggCounter">
                    <span class="chick-egg-counter__icon">🥚</span>
                    <span class="chick-egg-counter__count" id="chickEggCount">0</span>
                  </div>
                  <div class="chick-header-actions">
                    <button class="chick-diary-btn" id="chickWardrobeBtn" type="button">衣柜</button>
                    <button class="chick-diary-btn" id="chickDiaryBtn" type="button">
                      日记
                      <span class="chick-diary-dot" id="chickDiaryDot"></span>
                    </button>
                  </div>
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
          const eggCountEl = root.querySelector('#chickEggCount');
          const eggCounterEl = root.querySelector('#chickEggCounter');

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

          function updateEggCounter(animate) {
            if (eggCountEl && pet) {
              eggCountEl.textContent = String(pet.eggs || 0);
            }
            if (animate && eggCounterEl) {
              eggCounterEl.classList.remove('is-bump');
              void eggCounterEl.offsetWidth;
              eggCounterEl.classList.add('is-bump');
            }
          }

          function render() {
            if (!pet || disposed) return;

            const s = stateOf(pet);
                        const outfitSig =
              (pet.outfit && pet.outfit.hat     ? '1' : '0') +
              (pet.outfit && pet.outfit.scarf   ? '1' : '0') +
              (pet.outfit && pet.outfit.glasses ? '1' : '0') +
              (pet.outfit && pet.outfit.nbhat   ? '1' : '0');
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
            updateEggCounter(false);
            renderEggOnStage();
          }

          /* ---------- 舞台上的蛋 ---------- */
          function renderEggOnStage() {
            stageEl.querySelectorAll('.chick-egg-on-stage').forEach(el => el.remove());
            if (!pet || !pet.eggOnStage) return;

            const egg = document.createElement('div');
            egg.className = 'chick-egg-on-stage';
            egg.innerHTML = eggSVG();
            egg.addEventListener('click', onCollectEgg);
            stageEl.appendChild(egg);
          }

          function onCollectEgg(e) {
            const eggEl = e.currentTarget;
            if (!pet || !pet.eggOnStage) return;
            if (eggEl.dataset.collecting === '1') return;
            eggEl.dataset.collecting = '1';

            const rect = eggEl.getBoundingClientRect();
            const targetEl = eggCounterEl;
            if (!targetEl) {
              eggEl.remove();
              return;
            }
            const targetRect = targetEl.getBoundingClientRect();

            const clone = eggEl.cloneNode(true);
            clone.dataset.collecting = '0';
            clone.style.cssText = `
              position: fixed;
              left: ${rect.left}px;
              top: ${rect.top}px;
              width: ${rect.width}px;
              height: ${rect.height}px;
              margin: 0;
              z-index: 200;
              pointer-events: none;
              animation: none;
              will-change: transform, opacity;
            `;
            document.body.appendChild(clone);
            eggEl.style.visibility = 'hidden';

            const dx = (targetRect.left + targetRect.width / 2) - (rect.left + rect.width / 2);
            const dy = (targetRect.top + targetRect.height / 2) - (rect.top + rect.height / 2);

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                clone.style.transition = 'transform .55s cubic-bezier(.4,0,.2,1), opacity .3s ease-in .3s';
                clone.style.transform = `translate(${dx}px, ${dy}px) scale(.4)`;
                clone.style.opacity = '0.6';
              });
            });

            if (navigator.vibrate) { try { navigator.vibrate(10); } catch { } }

            setTimeout(() => {
              if (clone.isConnected) clone.remove();
              if (eggEl.isConnected) eggEl.remove();

              if (pet) {
                pet.eggs = (pet.eggs || 0) + 1;
                pet.eggOnStage = false;
                savePet(pet).catch(() => { });
                updateEggCounter(true);
                showBubble('收藏了一颗蛋！');
              }
            }, 600);
          }

          /* ---------- 小鸡动作 ---------- */
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

          /* 返回 home 时重新同步 outfit / owned / eggs */
          const offNav = ctx.nav.onChange(async () => {
            if (disposed) return;
            if (ctx.nav.current?.route?.name !== 'home') return;
            const fresh = await loadPet({ create: false });
            if (!fresh || !pet) return;
            pet.outfit = fresh.outfit || pet.outfit;
            pet.owned  = fresh.owned  || pet.owned;
            if (typeof fresh.eggs === 'number') pet.eggs = fresh.eggs;
            lastRenderState = '';
            render();
          });

          function onStageDown(e) {
            if (e.target.closest('.chick-btn')) return;
            if (e.target.closest('.chick-diary-btn')) return;
            if (e.target.closest('.chick-egg-on-stage')) return;
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
            if (e.target.closest('.chick-egg-on-stage')) return;

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

            /* 下蛋：距上次 >= EGG_INTERVAL 且舞台上没有未收集的蛋 */
            try {
              const since = Date.now() - (pet.lastEggAt || 0);
              if (!pet.eggOnStage && since >= EGG_INTERVAL) {
                pet.eggOnStage = true;
                pet.lastEggAt = Date.now();
                await savePet(pet);
              }
            } catch { }

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

            if (pet) {
              db().get('pet', null).then(fresh => {
                const base = (fresh && typeof fresh === 'object') ? fresh : { ...pet };
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
                <div class="chick-egg-counter">
                  <span class="chick-egg-counter__icon">🥚</span>
                  <span class="chick-egg-counter__count" id="chickWardrobeEggCount">0</span>
                </div>
              </div>
              <div class="chick-wardrobe-grid" id="chickWardrobeGrid"></div>
            </div>
          `;
        },

        mount(root) {
          const grid = root.querySelector('#chickWardrobeGrid');
          const eggCountEl = root.querySelector('#chickWardrobeEggCount');

          let disposed = false;

          function previewSVG(key) {
            const previewOutfit = defaultOutfit();
            previewOutfit[key] = true;
            return chickSVG({
              hunger: 80, clean: 80, mood: 80,
              outfit: previewOutfit,
            });
          }

          function actionLabel(item, pet) {
            if (!pet.owned[item.key]) return `🥚 ${item.price} 购买`;
            if (pet.outfit[item.key]) return '取消使用';
            return '使用';
          }

          async function renderGrid() {
            const pet = await loadPet({ create: true });
            if (!pet || !root.isConnected || disposed) return;

            if (eggCountEl) eggCountEl.textContent = String(pet.eggs || 0);

            grid.innerHTML = OUTFIT_ITEMS.map(item => {
              const on = pet.outfit[item.key];
              const owned = pet.owned[item.key];
              const canAfford = (pet.eggs || 0) >= item.price;
              const lockedCls = (!owned && !canAfford) ? ' is-locked' : '';

              return `
                <div class="chick-wardrobe-card ${on ? 'is-on' : ''}"
                     data-key="${item.key}">
                  <div class="chick-wardrobe-preview">${previewSVG(item.key)}</div>
                  <div class="chick-wardrobe-name">${item.name}</div>
                  <button class="chick-wardrobe-action${lockedCls}" type="button">
                    ${actionLabel(item, pet)}
                  </button>
                </div>
              `;
            }).join('');

            grid.querySelectorAll('.chick-wardrobe-card').forEach(el => {
              el.addEventListener('click', () => handleAction(el.dataset.key));
            });
          }

          async function handleAction(key) {
            if (disposed) return;
            const item = OUTFIT_ITEMS.find(it => it.key === key);
            if (!item) return;

            const current = await loadPet({ create: true });
            if (!current) return;

            if (!current.owned) current.owned = defaultOutfit();
            if (!current.outfit) current.outfit = defaultOutfit();

            if (!current.owned[key]) {
              /* 购买 */
              if ((current.eggs || 0) < item.price) {
                if (navigator.vibrate) { try { navigator.vibrate([20, 40, 20]); } catch { } }
                return;
              }
              current.eggs = current.eggs - item.price;
              current.owned[key] = true;
              current.outfit[key] = false;
              if (navigator.vibrate) { try { navigator.vibrate(15); } catch { } }
            } else if (current.outfit[key]) {
              /* 取消使用 */
              current.outfit[key] = false;
              if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
            } else {
              current.outfit[key] = true;
              for (const group of EXCLUSIVE_GROUPS) {
                if (!group.includes(key)) continue;
                for (const other of group) {
                  if (other !== key) current.outfit[other] = false;
                }
              }
              if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
            }

            await savePet(current);
            await renderGrid();
          }

          renderGrid();

          return () => { disposed = true; };
        },
      },
    },
  });
})();