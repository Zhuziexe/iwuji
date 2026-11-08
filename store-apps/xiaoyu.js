(() => {
  /* =========================================================
     杨梅小鱼 com.yangmei.xiaoyu

     架构约定：
       - 模块级只放「常量 + 纯函数」，没有任何可变状态（let / 单例 state）。
       - 所有可变数据放进「应用会话 session」，它挂在每次打开应用时
         新建的 WujiNavigation 实例上（见 wujios.html openApp）。
         应用关闭 → nav 被 destroy/丢弃 → session 随之回收。
       - 持久化仍只走 AppStorage（OS 只提供存储，留存逻辑在应用内）。
     ========================================================= */
  const BUNDLE = 'com.yangmei.xiaoyu';
  const KEY = 'state';

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const DEFAULT_STATE = () => ({
    coins: 10,
    bait: 5,
    lastSignIn: '',
    likedId: null,        // 当前喜欢的 fish.id
    fish: [],             // 钓到的鱼（含质量；价值按公式实时算）
    fishCatalog: [],      // 图鉴：鱼种 id（不记录质量）
    junkCatalog: [],      // 图鉴：杂物 id
    soldCount: 0,         // 累计卖出条数
    earned: 0,            // 累计售出收入
  });

  /* ---------- 图鉴数据（常量） ----------
     weight = 该鱼种在「钓到鱼」时的相对出现权重，总和 100。
     概率越小 → 越稀有 → 单价越高（单价由概率反推，见 unitPrice）。
     ------------------------------------- */
  const FISH_SPECIES = [
    { id: 'hongyu',  name: '红小鲫',   weight: 28, color: '#ef5350', accent: '#ffcdd2' },
    { id: 'lanwe',   name: '蓝尾鱼',   weight: 22, color: '#42a5f5', accent: '#bbdefb' },
    { id: 'jinli',   name: '锦鲤',     weight: 16, color: '#ff7a59', accent: '#ffd166' },
    { id: 'mojin',   name: '墨金鱼',   weight: 12, color: '#37474f', accent: '#ffca28' },
    { id: 'boli',    name: '玻璃鱼',   weight: 8,  color: '#80deea', accent: '#e0f7fa' },
    { id: 'xingyu',  name: '星星鱼',   weight: 6,  color: '#7e57c2', accent: '#ffe082' },
    { id: 'yueliang',name: '月光鱼',   weight: 5,  color: '#5c6bc0', accent: '#fff59d' },
    { id: 'longyu',  name: '小金龙',   weight: 3,  color: '#f9a825', accent: '#fff8e1' },
  ];

  const JUNK = [
    { id: 'xiezi',   name: '破靴子',   color: '#8d6e63' },
    { id: 'kongping',name: '空瓶子',   color: '#4db6ac' },
    { id: 'shuye',   name: '烂树叶',   color: '#7cb342' },
    { id: 'yilaguan',name: '易拉罐',   color: '#90a4ae' },
    { id: 'wangqiu', name: '旧网球',   color: '#cddc39' },
  ];

  const NOTHING_RATE = 0.4;   /* 没钓到 */
  const JUNK_RATE    = 0.3;   /* 钓到杂物 */
  const FISH_RATE    = 0.3;   /* 钓到鱼 */
  const FISH_TOTAL_WEIGHT = FISH_SPECIES.reduce((s, f) => s + f.weight, 0);
  const probOf = sp => sp.weight / FISH_TOTAL_WEIGHT;
  const absProbOf = sp => FISH_RATE * probOf(sp);
  const PRICE_K = 2;
  const unitPrice = sp => Math.max(1, Math.round(PRICE_K / probOf(sp)));

  const QUALITIES = [
    { min: 0.85, label: '极品', mult: 3.0 },
    { min: 0.60, label: '优良', mult: 1.8 },
    { min: 0.00, label: '普通', mult: 1.0 },
  ];
  const qualityOf = q => QUALITIES.find(x => q >= x.min) || QUALITIES[QUALITIES.length - 1];
  const fishValue = (sp, q) => Math.max(1, Math.round(unitPrice(sp) * qualityOf(q).mult));

  function rarityOf(sp) {
    const p = probOf(sp);
    if (p >= 0.20) return { label: '常见', stars: 1 };
    if (p >= 0.12) return { label: '少见', stars: 2 };
    if (p >= 0.07) return { label: '稀有', stars: 3 };
    if (p >= 0.04) return { label: '珍稀', stars: 4 };
    return { label: '传说', stars: 5 };
  }
  const starsText = n => '★'.repeat(n) + '☆'.repeat(5 - n);

  const findFish = id => FISH_SPECIES.find(f => f.id === id);
  const findJunk = id => JUNK.find(j => j.id === id);
  const valueOfFish = f => {
    const sp = findFish(f.species);
    return sp ? fishValue(sp, f.quality) : Math.max(1, Number(f.value) || 1);
  };

  /* =========================================================
     SVG 素材（纯函数，无状态）
     ========================================================= */
  const COIN_SVG = (size = 26) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="xy-coin-${size}" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stop-color="#fff3b0"/>
          <stop offset="55%" stop-color="#ffd54f"/>
          <stop offset="100%" stop-color="#f9a825"/>
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#xy-coin-${size})" stroke="#f57f17" stroke-width="2"/>
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="#fff8e1" stroke-width="1.5" opacity=".8"/>
      <g transform="translate(24 24)">
        <path d="M-9 0 Q-3 -8 8 0 Q-3 8 -9 0 Z" fill="#e65100" opacity=".9"/>
        <path d="M-9 0 L-15 -6 L-15 6 Z" fill="#e65100" opacity=".9"/>
        <circle cx="4" cy="-1.6" r="1.5" fill="#fff8e1"/>
      </g>
    </svg>`;

  function fishSvg(sp, size = 120, cls = '') {
    const c = sp.color, a = sp.accent;
    return `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
      <g class="xy-fish-body">
        <path d="M18 60 Q40 30 78 60 Q40 90 18 60 Z" fill="${c}"/>
        <path d="M78 60 L104 40 L100 60 L104 80 Z" fill="${c}" opacity=".85"/>
        <path d="M46 44 Q60 34 70 44 Q60 40 46 44 Z" fill="${a}" opacity=".9"/>
        <path d="M46 76 Q60 86 70 76 Q60 80 46 76 Z" fill="${a}" opacity=".55"/>
        <circle cx="34" cy="55" r="4.2" fill="#fff"/>
        <circle cx="33.4" cy="55" r="2.3" fill="#263238"/>
        <path d="M22 60 q5 3 10 0" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/>
        <path d="M58 60 q10 -5 20 0" stroke="${a}" stroke-width="2" fill="none" opacity=".5"/>
      </g>
    </svg>`;
  }

  function junkSvg(j, size = 120, cls = '') {
    const c = j.color;
    const shapes = {
      xiezi:   `<path d="M20 78 L20 46 Q20 40 28 40 L40 40 L44 62 L62 62 Q78 62 78 74 L78 80 L20 80 Z" fill="${c}"/>`,
      kongping:`<rect x="46" y="30" width="28" height="58" rx="9" fill="${c}" opacity=".85"/><rect x="52" y="22" width="16" height="12" rx="3" fill="${c}"/>`,
      shuye:   `<path d="M24 66 Q38 30 92 40 Q86 84 44 82 Q30 80 24 66 Z" fill="${c}"/><path d="M30 70 Q56 56 84 44" stroke="#33691e" stroke-width="2" fill="none"/>`,
      yilaguan:`<rect x="42" y="34" width="36" height="54" rx="6" fill="${c}"/><rect x="46" y="38" width="28" height="46" rx="3" fill="#eceff1" opacity=".5"/>`,
      wangqiu: `<circle cx="60" cy="62" r="28" fill="${c}"/><path d="M36 50 Q60 62 84 50 M36 74 Q60 62 84 74" stroke="#fff" stroke-width="2.5" fill="none"/>`,
    };
    return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">${shapes[j.id] || shapes.kongping}</svg>`;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* =========================================================
     应用会话：每次打开应用创建一个，挂在 ctx.nav 上，关闭即回收
     ========================================================= */
  function session(nav) {
    if (nav.__xiaoyu) return nav.__xiaoyu;
    const S = {
      state: DEFAULT_STATE(),
      loaded: false,
      db: AppStorage.for(BUNDLE),
      readyPromise: null,
      scroll: { all: 0, book: 0 },   /* 列表页滚动位置，返回详情时保留 */
    };
    S.load = async function () {
      let s = await S.db.get(KEY, null);
      if (!s || typeof s !== 'object') s = DEFAULT_STATE();
      const d = DEFAULT_STATE();
      S.state = {
        coins: Math.max(0, Number(s.coins ?? d.coins) || 0),
        bait: Math.max(0, Number(s.bait ?? d.bait) || 0),
        lastSignIn: typeof s.lastSignIn === 'string' ? s.lastSignIn : '',
        likedId: s.likedId ?? null,
        fish: Array.isArray(s.fish) ? s.fish : [],
        fishCatalog: Array.isArray(s.fishCatalog) ? s.fishCatalog : [],
        junkCatalog: Array.isArray(s.junkCatalog) ? s.junkCatalog : [],
        soldCount: Math.max(0, Number(s.soldCount) || 0),
        earned: Math.max(0, Number(s.earned) || 0),
      };
      S.loaded = true;
      return S.state;
    };
    S.save = () => S.db.set(KEY, S.state);
    S.ready = () => {
      if (!S.readyPromise) S.readyPromise = S.load();
      return S.readyPromise;
    };
    nav.__xiaoyu = S;
    S.ready().catch(() => { });   /* 立刻开始读存档，尽量在首帧前完成 */
    return S;
  }

  /* ---------- 纯逻辑（不改会话，返回/接受 S） ---------- */
  function drawCatch() {
    const r = Math.random();
    if (r < NOTHING_RATE) return { kind: 'nothing' };
    if (r < NOTHING_RATE + JUNK_RATE) {
      const j = JUNK[Math.floor(Math.random() * JUNK.length)];
      return { kind: 'junk', junk: j };
    }
    let w = Math.random() * FISH_TOTAL_WEIGHT, sp = FISH_SPECIES[FISH_SPECIES.length - 1];
    for (const f of FISH_SPECIES) { w -= f.weight; if (w <= 0) { sp = f; break; } }
    const q = Math.random();
    return { kind: 'fish', species: sp, quality: q, value: fishValue(sp, q) };
  }

  function commitCatch(S, c) {
    if (c.kind === 'fish') {
      const item = {
        id: 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        species: c.species.id, quality: c.quality, value: c.value,
      };
      S.state.fish.push(item);
      if (!S.state.fishCatalog.includes(item.species)) S.state.fishCatalog.push(item.species);
      return item;
    }
    if (c.kind === 'junk') {
      if (!S.state.junkCatalog.includes(c.junk.id)) S.state.junkCatalog.push(c.junk.id);
    }
    return null;
  }

  async function sellFish(S, id) {
    const idx = S.state.fish.findIndex(f => f.id === id);
    if (idx < 0) return { ok: false, reason: 'not-found' };
    const f = S.state.fish[idx];
    if (f.id === S.state.likedId) return { ok: false, reason: 'liked' };
    const value = valueOfFish(f);
    S.state.fish.splice(idx, 1);
    S.state.coins += value;
    S.state.soldCount += 1;
    S.state.earned += value;
    await S.save();
    return { ok: true, value };
  }

  /* ---------- 公共 UI 片段（header 需要金币，故接受 S） ---------- */
  const header = (S, title, right = '') => `
    <div class="xy-header">
      <div class="xy-title">${esc(title)}</div>
      <div class="xy-coin">${COIN_SVG(30)}<span>${S.state.coins}</span></div>
      ${right}
    </div>`;
  const page = (inner, cls = '') => `<div class="xy-page ${cls}">${inner}</div>`;

  function bowl(fishHtml, { big = false, empty = false } = {}) {
    return `
      <div class="xy-bowl ${big ? 'xy-bowl--big' : ''} ${empty ? 'is-empty' : ''}">
        <div class="xy-bowl__water"></div>
        <div class="xy-bowl__glass"></div>
        <div class="xy-bowl__swim">${fishHtml}</div>
        <div class="xy-bubbles">
          <i style="--d:0s;--l:28%"></i><i style="--d:1.1s;--l:44%"></i>
          <i style="--d:2.2s;--l:60%"></i><i style="--d:0.6s;--l:72%"></i>
          <i style="--d:1.7s;--l:36%"></i>
        </div>
        ${empty ? '<div class="xy-bowl__empty">还没有喜欢的小鱼</div>' : ''}
      </div>`;
  }

  /* =========================================================
     styles（常量字符串）
     字号阶梯：18 / 20 / 22 / 24 / 28
       - 18：辅助说明（tip / 概率 / 标签）
       - 20：次要正文
       - 22：正文、按钮
       - 24：小标题、卡片名
       - 28：页面大标题
     ========================================================= */
  const styles = `
    .xy-page { position:absolute; inset:0; isolation:isolate; display:flex; flex-direction:column;
      overflow-y:auto; padding: calc(var(--statusbar-h) + 12px) 14px 16px;
      background: linear-gradient(180deg,#eaf6ff 0%, #f7fbff 40%, #ffffff 100%);
      color: var(--wj-text); font-family: var(--wj-font); -webkit-overflow-scrolling:touch;
      font-size: 22px; }
    .xy-page::-webkit-scrollbar { display:none; }

    /* 顶部标题栏：固定，不随下方内容滚动 */
    .xy-header { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:10px;
      margin-bottom:14px; padding-bottom:10px;
      background: linear-gradient(180deg,#eaf6ff 0%, #eef7ff 78%, rgba(238,247,255,0) 100%); }
    .xy-title { font-size:28px; font-weight:800; letter-spacing:.5px; flex:1 1 auto;
      line-height:1.2; }
    .xy-coin { display:inline-flex; align-items:center; gap:7px; font-weight:800;
      font-size:24px; line-height:1.2; background:#fff8e1; padding:5px 14px 5px 9px;
      border-radius:1399px; box-shadow:0 2px 8px rgba(249,168,37,.25); flex:0 0 auto; }
    .xy-coin svg { display:block; }
    .xy-bait { display:inline-flex; align-items:center; gap:8px; font-weight:700;
      background:#e8f5e9; padding:5px 10px 5px 12px; border-radius:1399px; font-size:20px;
      line-height:1.2; flex:0 0 auto; }
    .xy-plus { width:30px; height:30px; border:none; border-radius:50%; padding:0;
      background: var(--wj-primary); color:#fff; font-size:22px; line-height:1;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; font-weight:700; flex:0 0 auto; }

    /* 鱼缸 */
    .xy-bowl { position:relative; width:180px; height:180px; border-radius:50%;
      margin:4px auto 12px; overflow:hidden; flex:0 0 auto;
      background: radial-gradient(circle at 38% 30%, #ffffff 0%, #d6f0ff 40%, #9fd8f5 100%);
      box-shadow: inset 0 0 0 8px rgba(255,255,255,.55), 0 10px 26px rgba(60,140,200,.28); }
    .xy-bowl--big { width:200px; height:200px; }
    .xy-bowl__water { position:absolute; left:0; right:0; bottom:0; height:78%;
      background: linear-gradient(180deg, rgba(120,200,245,.35), rgba(40,140,210,.5)); }
    .xy-bowl__glass { position:absolute; inset:0; border-radius:50%;
      box-shadow: inset 14px 10px 26px rgba(255,255,255,.65), inset -10px -14px 22px rgba(30,110,170,.18); }
    .xy-bowl__swim { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      animation: xySwim 5s ease-in-out infinite alternate; }
    .xy-bowl__swim svg { filter: drop-shadow(0 4px 6px rgba(0,0,0,.18)); }
    .xy-bubbles i { position:absolute; bottom:18%; left:var(--l); width:9px; height:9px;
      border-radius:50%; background: rgba(255,255,255,.7); border:1px solid rgba(255,255,255,.9);
      animation: xyBubble 3.4s linear infinite; animation-delay:var(--d); opacity:0; }
    .xy-bowl__empty { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      padding:0 10px; text-align:center; color:#5b7a90; font-size:18px; font-weight:600; line-height:1.3; }
    @keyframes xySwim { 0%{transform:translateX(-16px) rotate(-4deg)} 100%{transform:translateX(16px) rotate(4deg)} }
    @keyframes xyBubble { 0%{transform:translateY(0) scale(.6);opacity:0} 20%{opacity:.85}
      100%{transform:translateY(-150px) scale(1.15);opacity:0} }

    /* 首页：左鱼缸（放大） + 右按钮列（自适应填满） */
    .xy-home { display:flex; flex-direction:row; align-items:center; gap:14px; }
    .xy-home .xy-bowl { width:160px; height:160px; margin:0; flex:0 0 160px; }
    .xy-home .xy-bowl__swim svg { width:82%; height:82%; }
    .xy-home .xy-bowl__empty { font-size:16px; padding:0 8px; }
    .xy-menu { display:flex; flex-direction:column; gap:10px; flex:1 1 auto; min-width:0; }
    .xy-menu button { width:100%; border:none; border-radius:14px; padding:12px 6px;
      font-size:22px; font-weight:700; color:#fff; cursor:pointer;
      box-shadow:0 4px 12px rgba(0,0,0,.12);
      transition:transform .1s; text-align:center; line-height:1.2; }
    .xy-menu button:active { transform:scale(.97); }
    .xy-m-fish{background:linear-gradient(135deg,#42a5f5,#1e88e5);}
    .xy-m-all {background:linear-gradient(135deg,#66bb6a,#43a047);}
    .xy-m-book{background:linear-gradient(135deg,#ffa726,#fb8c00);}
    .xy-m-sign{background:linear-gradient(135deg,#ab47bc,#8e24aa);}
    .xy-loved { margin-top:14px; background:#fff; border-radius:16px; padding:14px 16px;
      box-shadow:0 3px 12px rgba(0,0,0,.06); }
    .xy-loved__label { font-size:18px; color: var(--wj-text-dim); margin-bottom:6px; }
    .xy-loved__name { font-size:22px; font-weight:800; }
    .xy-loved__q { font-size:20px; color: var(--wj-text-muted); margin-top:4px; }
    .xy-loved__empty { color: var(--wj-text-dim); font-size:18px; }

    /* 钓鱼 */
    .xy-rod { text-align:center; margin:2px 0 6px; }
    .xy-rod svg { display:block; margin:0 auto; }
    .xy-rod .xy-line { transition:transform .3s; transform-origin:top center; }
    .xy-catch { background:#fff; border-radius:18px; padding:16px; text-align:center;
      box-shadow:0 4px 16px rgba(0,0,0,.08); min-height:180px; }
    .xy-catch__art { height:120px; display:flex; align-items:center; justify-content:center; }
    .xy-catch__name { font-size:24px; font-weight:800; margin-top:6px; }
    .xy-catch__q { font-size:20px; color: var(--wj-text-muted); margin-top:4px; }
    .xy-catch__val { font-size:22px; color:#f9a825; font-weight:800; margin-top:6px; }
    .xy-catch__rare { font-size:18px; color:#8e24aa; margin-top:4px; font-weight:700; }
    .xy-catch__prob { font-size:18px; color: var(--wj-text-dim); margin-top:2px; }
    .xy-catch__hint { color: var(--wj-text-dim); font-size:20px; }
    .xy-actions { display:flex; gap:10px; margin-top:12px; }
    .xy-btn { flex:1; border:none; border-radius:1399px; padding:13px; font-size:22px;
      font-weight:700; cursor:pointer; transition:transform .1s; line-height:1.2; }
    .xy-btn:active { transform:scale(.97); }
    .xy-btn:disabled { opacity:.5; cursor:default; }
    .xy-btn--primary { background: var(--wj-primary); color:#fff; }
    .xy-btn--ghost { background:#eef2f7; color: var(--wj-text); }
    .xy-tip { text-align:center; color: var(--wj-text-dim); font-size:18px; margin-top:10px; }

    /* 全部小鱼 网格 */
    .xy-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
    .xy-cell { background:#fff; border-radius:14px; padding:8px 4px 10px; text-align:center;
      box-shadow:0 3px 10px rgba(0,0,0,.06); cursor:pointer; transition:transform .1s; }
    .xy-cell:active { transform:scale(.96); }
    .xy-cell .xy-bowl { width:100%; height:auto; aspect-ratio:1; margin:0 0 4px; box-shadow:inset 0 0 0 4px rgba(255,255,255,.6),0 3px 8px rgba(60,140,200,.2); }
    .xy-cell .xy-bowl__swim { animation:none; }
    .xy-cell .xy-bowl__swim svg { width:64%; height:64%; }
    .xy-cell .xy-bubbles { display:none; }
    .xy-cell__name { font-size:18px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .xy-cell__val { font-size:18px; color:#f9a825; font-weight:800; margin-top:2px; }
    .xy-cell__star { color:#f9a825; font-size:18px; }
    .xy-empty { text-align:center; color: var(--wj-text-dim); padding:50px 0; font-size:20px; }

    /* 详情 */
    .xy-detail { text-align:center; }
    .xy-star { width:60px; height:60px; margin:14px auto 0; border:none; background:none; cursor:pointer;
      font-size:48px; line-height:1; color:#dfe4ea; transition:transform .15s, color .2s; }
    .xy-star.is-on { color:#f9a825; }
    .xy-star:active { transform:scale(1.2) rotate(12deg); }
    .xy-detail__name { font-size:24px; font-weight:800; margin-top:8px; }
    .xy-detail__q { font-size:20px; color: var(--wj-text-muted); margin-top:4px; }
    .xy-detail__val { font-size:22px; color:#f9a825; font-weight:800; margin-top:6px; }
    .xy-detail__rare { font-size:18px; color:#8e24aa; margin-top:4px; font-weight:700; }
    .xy-detail__prob { font-size:18px; color: var(--wj-text-dim); margin-top:2px; }
    .xy-sell { display:flex; align-items:center; justify-content:center; gap:6px;
      margin:16px auto 0; max-width:320px; }
    .xy-btn--sell { background:linear-gradient(135deg,#ffb74d,#f57c00); color:#fff; }
    .xy-btn--sell:disabled { background:#e0e0e0; color:#9e9e9e; }
    .xy-sell__note { text-align:center; font-size:18px; color: var(--wj-text-dim); margin-top:8px; }
    .xy-sellbar { display:flex; gap:10px; align-items:center; margin-bottom:10px; }
    .xy-sellbar__info { flex:1; font-size:18px; color: var(--wj-text-muted); line-height:1.35; }
    .xy-sellbar .xy-btn { flex:0 0 auto; padding:10px 16px; font-size:20px; }

    /* 图鉴 tab */
    .xy-tabs { display:flex; gap:8px; margin-bottom:12px; }
    .xy-tab { flex:1; border:none; border-radius:1399px; padding:10px; font-size:20px;
      font-weight:700; background:#eef2f7; color: var(--wj-text-muted); cursor:pointer; }
    .xy-tab.is-on { background: var(--wj-primary); color:#fff; }
    .xy-cards { display:flex; flex-direction:column; gap:10px; }
    .xy-card { display:flex; align-items:center; gap:12px; background:#fff; border-radius:14px;
      padding:10px 14px; box-shadow:0 3px 10px rgba(0,0,0,.06); cursor:pointer; }
    .xy-card:active { transform:scale(.99); }
    .xy-card svg { width:60px; height:60px; flex:0 0 60px; }
    .xy-card__name { font-size:22px; font-weight:700; }
    .xy-card__tag { font-size:18px; color: var(--wj-text-dim); margin-top:2px; line-height:1.3; }
    .xy-card.is-locked { opacity:.55; }
    .xy-card.is-locked svg { filter:grayscale(1); }

    .xy-signin { text-align:center; padding-top:18px; }
    .xy-signin__coin { display:flex; justify-content:center; }
    .xy-signin__title { font-size:24px; font-weight:800; margin:12px 0 6px; }
    .xy-signin__desc { color: var(--wj-text-muted); font-size:20px; }
    .xy-signin__ok { margin-top:16px; color:#43a047; font-weight:800; font-size:22px; }
  `;

  /* =========================================================
     routes：每个 render/mount 都从 ctx.nav 取本应用的 session
     ========================================================= */
  const routes = {
    /* ---------------- 主页 ---------------- */
    home: {
      name: 'home', transition: 'fade',
      render(routeCtx) {
        const S = session(routeCtx.nav);
        const loved = S.state.fish.find(f => f.id === S.state.likedId);
        const sp = loved ? findFish(loved.species) : null;
        const fishHtml = sp ? fishSvg(sp, 150) : '';
        return page(`
          ${header(S, '杨梅小鱼')}
          <div class="xy-home">
            ${bowl(fishHtml, { empty: !sp })}
            <div class="xy-menu">
              <button class="xy-m-fish" data-go="fish">🎣 去钓鱼</button>
              <button class="xy-m-all"  data-go="all">🐟 全部小鱼</button>
              <button class="xy-m-book" data-go="book">📖 图鉴</button>
              <button class="xy-m-sign" data-go="sign">📅 签到</button>
            </div>
          </div>
          <div class="xy-loved">
            <div class="xy-loved__label">我喜欢的那只</div>
            ${sp ? `
              <div class="xy-loved__name">${esc(sp.name)}</div>
              <div class="xy-loved__q">质量：${esc(qualityOf(loved.quality).label)} · 价值 ${valueOfFish(loved)}</div>
            ` : `<div class="xy-loved__empty">去「全部小鱼」里点五角星，选一只喜欢的吧～</div>`}
          </div>
          <div class="xy-tip">钓到的小鱼会自动收进「全部小鱼」和「图鉴」；越稀有的鱼卖得越贵</div>
          ${S.state.soldCount || S.state.earned
            ? `<div class="xy-tip">已售出 ${S.state.soldCount} 条 · 累计收入 ${S.state.earned} 小鱼币</div>` : ''}
        `);
      },
      mount(root, ctx) {
        root.querySelectorAll('[data-go]').forEach(b => {
          b.addEventListener('click', () => ctx.push(b.dataset.go));
        });
      },
    },

    /* ---------------- 钓鱼 ---------------- */
    fish: {
      name: 'fish',
      render(routeCtx) {
        const S = session(routeCtx.nav);
        return page(`
          ${header(S, '钓鱼', `<span class="xy-bait">🪱 鱼饵 ${S.state.bait}<button class="xy-plus" id="xyAddBait" type="button" aria-label="兑换鱼饵">+</button></span>`)}
          <div class="xy-rod">
            <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
              <path d="M14 76 Q26 20 96 10" stroke="#8d6e63" stroke-width="5" fill="none" stroke-linecap="round"/>
              <line class="xy-line" id="xyLine" x1="96" y1="10" x2="96" y2="56" stroke="#90a4ae" stroke-width="1.5"/>
              <circle cx="96" cy="58" r="3.5" fill="#ef5350"/>
              <path d="M92 58 q4 6 8 0" stroke="#fff" stroke-width="1" fill="none"/>
            </svg>
          </div>
          <div class="xy-catch" id="xyCatch">
            <div class="xy-catch__art"><div class="xy-catch__hint">点击下方按钮抛竿 🎣</div></div>
          </div>
          <div class="xy-actions">
            <button class="xy-btn xy-btn--primary" id="xyGoFish" type="button">抛竿（消耗 1 鱼饵）</button>
          </div>
          <div class="xy-tip" id="xyFishTip">每钓一次消耗 1 个鱼饵</div>
        `);
      },
      mount(root, ctx) {
        const S = session(ctx.nav);
        const catchEl = root.querySelector('#xyCatch');
        const goBtn = root.querySelector('#xyGoFish');
        const tip = root.querySelector('#xyFishTip');
        const line = root.querySelector('#xyLine');
        let busy = false;   /* 本页局部状态，随页面卸载销毁 */

        function refreshHeader() {
          const coinEl = root.querySelector('.xy-coin span');
          if (coinEl) coinEl.textContent = S.state.coins;
          const baitEl = root.querySelector('.xy-bait');
          if (baitEl) baitEl.innerHTML = `🪱 鱼饵 ${S.state.bait}<button class="xy-plus" id="xyAddBait" type="button" aria-label="兑换鱼饵">+</button>`;
          bindBait();
        }
        function bindBait() {
          const btn = root.querySelector('#xyAddBait');
          if (btn) btn.addEventListener('click', onBuyBait);
        }

        async function onBuyBait() {
          const res = await window.WujiDialog.show({
            bundlename: BUNDLE,
            title: '兑换鱼饵',
            content: '是否用 5 个金币兑换 1 个鱼饵？',
            buttons: [{ value: '取消' }, { value: '兑换', primary: true }],
          });
          if (res !== '兑换') return;
          if (S.state.coins < 5) {
            try { WujiToast.show('金币不够啦～去签到领小鱼币吧'); } catch { }
            return;
          }
          S.state.coins -= 5;
          S.state.bait += 1;
          await S.save();
          refreshHeader();
          try { WujiToast.show('兑换成功：鱼饵 +1'); } catch { }
        }

        function showCatch(c) {
          if (c.kind === 'nothing') {
            catchEl.innerHTML = `
              <div class="xy-catch__art"><div class="xy-catch__hint">🌊</div></div>
              <div class="xy-catch__name">什么都没有</div>
              <div class="xy-catch__q">这一竿没钓到，再试试吧</div>`;
          } else if (c.kind === 'fish') {
            const rare = rarityOf(c.species);
            const pct = (absProbOf(c.species) * 100).toFixed(1);
            catchEl.innerHTML = `
              <div class="xy-catch__art">${fishSvg(c.species, 120)}</div>
              <div class="xy-catch__name">${esc(c.species.name)}</div>
              <div class="xy-catch__rare">${starsText(rare.stars)} ${esc(rare.label)}</div>
              <div class="xy-catch__q">质量：${esc(qualityOf(c.quality).label)}</div>
              <div class="xy-catch__val">价值 ${c.value} 小鱼币</div>
              <div class="xy-catch__prob">每竿出现概率约 ${pct}%</div>`;
          } else {
            catchEl.innerHTML = `
              <div class="xy-catch__art">${junkSvg(c.junk, 120)}</div>
              <div class="xy-catch__name">${esc(c.junk.name)}</div>
              <div class="xy-catch__q">钓到了杂物，已收进图鉴</div>`;
          }
        }

        async function onFish() {
          if (busy) return;
          if (S.state.bait <= 0) {
            try { WujiToast.show('鱼饵用完啦，点 + 用金币兑换'); } catch { }
            return;
          }
          busy = true;
          goBtn.disabled = true;
          S.state.bait -= 1;
          await S.save();
          refreshHeader();

          if (line) line.style.transform = 'scaleY(1.35)';
          catchEl.innerHTML = `<div class="xy-catch__art"><div class="xy-catch__hint">等待咬钩…</div></div>`;
          tip.textContent = '鱼线在动…';

          setTimeout(async () => {
            if (line) line.style.transform = '';
            const c = drawCatch();
            commitCatch(S, c);
            await S.save();
            showCatch(c);
            tip.textContent = c.kind === 'fish'
              ? '已自动加入「全部小鱼」和「图鉴」'
              : c.kind === 'junk'
                ? '已自动加入「图鉴」'
                : '这竿扑了个空，再来一竿';
            busy = false;
            goBtn.disabled = false;
          }, 900);
        }


        bindBait();
        goBtn.addEventListener('click', onFish);
      },
    },

    /* ---------------- 全部小鱼 ---------------- */
    all: {
      name: 'all',
      render(routeCtx) {
        const S = session(routeCtx.nav);
        const sellable = S.state.fish.filter(f => f.id !== S.state.likedId);
        const total = sellable.reduce((s, f) => s + valueOfFish(f), 0);
        const cells = S.state.fish.map(f => {
          const sp = findFish(f.species) || FISH_SPECIES[0];
          const star = f.id === S.state.likedId ? '<span class="xy-cell__star">★</span>' : '';
          const val = valueOfFish(f);
          return `<div class="xy-cell" data-id="${esc(f.id)}">
            ${bowl(fishSvg(sp, 100))}
            <div class="xy-cell__name">${esc(sp.name)} ${star}</div>
            <div class="xy-cell__val">${val} 币</div>
          </div>`;
        }).join('');
        return page(`
          ${header(S, '全部小鱼')}
          ${S.state.fish.length ? `
            <div class="xy-sellbar">
              <div class="xy-sellbar__info">共 ${S.state.fish.length} 条${S.state.likedId ? '（喜欢的 1 条不卖）' : ''}<br>可卖 ${sellable.length} 条 · 预计 ${total} 币</div>
              <button class="xy-btn xy-btn--sell" id="xySellAll" type="button" ${sellable.length ? '' : 'disabled'}>一键卖出</button>
            </div>` : ''}
          ${cells
            ? `<div class="xy-grid">${cells}</div>`
            : `<div class="xy-empty">还没有小鱼，去钓鱼吧 🎣</div>`}
        `);
      },
      mount(root, ctx) {
        const S = session(ctx.nav);
        const pageEl = root.querySelector('.xy-page');
        if (pageEl) pageEl.scrollTop = S.scroll.all || 0;

        root.querySelectorAll('.xy-cell').forEach(el => {
          el.addEventListener('click', () => {
            if (pageEl) S.scroll.all = pageEl.scrollTop;
            ctx.push('fishDetail', { id: el.dataset.id });
          });
        });
        const sellAll = root.querySelector('#xySellAll');
        if (sellAll) sellAll.addEventListener('click', async () => {
          const sellable = S.state.fish.filter(f => f.id !== S.state.likedId);
          if (!sellable.length) return;
          const total = sellable.reduce((s, f) => s + valueOfFish(f), 0);
          const res = await window.WujiDialog.show({
            bundlename: BUNDLE,
            title: '一键卖出',
            content: `卖出 ${sellable.length} 条小鱼，共得 ${total} 小鱼币？\n（喜欢的那只不会被卖掉）`,
            buttons: [{ value: '取消' }, { value: '卖出', primary: true }],
          });
          if (res !== '卖出') return;
          for (const f of sellable) await sellFish(S, f.id);
          try { WujiToast.show(`卖出 ${sellable.length} 条，+${total} 小鱼币`); } catch { }
          root.innerHTML = routes.all.render(ctx);
          routes.all.mount(root, ctx);
        });
      },
    },

    /* ---------------- 小鱼详情 ---------------- */
    fishDetail: {
      name: 'fishDetail',
      render(routeCtx) {
        const S = session(routeCtx.nav);
        const f = S.state.fish.find(x => x.id === routeCtx.data?.id);
        const sp = f ? (findFish(f.species) || FISH_SPECIES[0]) : null;
        if (!f || !sp) return page(`${header(S, '小鱼')}<div class="xy-empty">找不到这只小鱼</div>`);
        const liked = f.id === S.state.likedId;
        const rare = rarityOf(sp);
        const val = valueOfFish(f);
        const pct = (absProbOf(sp) * 100).toFixed(1);
        return page(`
          ${header(S, '小鱼')}
          <div class="xy-detail">
            ${bowl(fishSvg(sp, 190), { big: true })}
            <div class="xy-detail__name">${esc(sp.name)}</div>
            <div class="xy-detail__rare">${starsText(rare.stars)} ${esc(rare.label)} · 出现概率约 ${pct}%</div>
            <div class="xy-detail__q">质量：${esc(qualityOf(f.quality).label)}</div>
            <div class="xy-detail__val">价值 ${val} 小鱼币</div>
            <button class="xy-star ${liked ? 'is-on' : ''}" id="xyStar" type="button"
              aria-label="${liked ? '取消喜欢' : '喜欢'}">★</button>
            <div class="xy-tip" id="xyStarTip">${liked ? '这是你喜欢的那只小鱼' : '点一下，把它设为喜欢的小鱼'}</div>
            <div class="xy-sell">
              <button class="xy-btn xy-btn--sell" id="xySellOne" type="button"
                ${liked ? 'disabled' : ''}>${liked ? '喜欢中，不可卖' : `卖出 · +${val} 小鱼币`}</button>
            </div>
            <div class="xy-sell__note">${liked ? '取消喜欢后才能卖出这条' : '卖出后这条小鱼会离开鱼群'}</div>
          </div>
        `);
      },
      mount(root, ctx) {
        const S = session(ctx.nav);

        const star = root.querySelector('#xyStar');
        const tip = root.querySelector('#xyStarTip');
        const sellBtn = root.querySelector('#xySellOne');

        const syncSellBtn = () => {
          if (!sellBtn) return;
          const f = S.state.fish.find(x => x.id === ctx.data.id);
          const liked = f && f.id === S.state.likedId;
          sellBtn.disabled = !!liked;
          sellBtn.textContent = liked
            ? '喜欢中，不可卖'
            : `卖出 · +${f ? valueOfFish(f) : 0} 小鱼币`;
          const note = root.querySelector('.xy-sell__note');
          if (note) note.textContent = liked ? '取消喜欢后才能卖出这条' : '卖出后这条小鱼会离开鱼群';
        };

        if (star) star.addEventListener('click', async () => {
          const id = ctx.data.id;
          S.state.likedId = (S.state.likedId === id) ? null : id;
          await S.save();
          const on = S.state.likedId === id;
          star.classList.toggle('is-on', on);
          star.setAttribute('aria-label', on ? '取消喜欢' : '喜欢');
          if (tip) tip.textContent = on ? '这是你喜欢的那只小鱼' : '点一下，把它设为喜欢的小鱼';
          syncSellBtn();
          try { WujiToast.show(on ? '已设为喜欢的小鱼 ⭐' : '已取消喜欢'); } catch { }
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
        });

        if (sellBtn) sellBtn.addEventListener('click', async () => {
          const id = ctx.data.id;
          const f = S.state.fish.find(x => x.id === id);
          if (!f) return;
          if (f.id === S.state.likedId) { try { WujiToast.show('取消喜欢后才能卖哦'); } catch { } return; }
          const val = valueOfFish(f);
          const res = await window.WujiDialog.show({
            bundlename: BUNDLE,
            title: '卖出小鱼',
            content: `卖出这条${findFish(f.species)?.name || '小鱼'}（${qualityOf(f.quality).label}），得 ${val} 小鱼币？`,
            buttons: [{ value: '取消' }, { value: '卖出', primary: true }],
          });
          if (res !== '卖出') return;
          const r = await sellFish(S, id);
          if (!r.ok) return;
          try { WujiToast.show(`卖出成功，+${r.value} 小鱼币`); } catch { }
          ctx.pop();
        });
      },
    },

    /* ---------------- 图鉴 ---------------- */
    book: {
      name: 'book',
      render(routeCtx) {
        const S = session(routeCtx.nav);
        return page(`
          ${header(S, '图鉴')}
          <div class="xy-tabs">
            <button class="xy-tab is-on" data-tab="fish" type="button">小鱼</button>
            <button class="xy-tab" data-tab="junk" type="button">杂物</button>
          </div>
          <div class="xy-cards" id="xyCards"></div>
        `);
      },
      mount(root, ctx) {
        const S = session(ctx.nav);
        const cards = root.querySelector('#xyCards');
        const tabs = root.querySelectorAll('.xy-tab');
        const pageEl = root.querySelector('.xy-page');
        let tab = S.bookTab || 'fish';   /* 跨返回保留的当前标签 */

        function renderCards() {
          tabs.forEach(t => t.classList.toggle('is-on', t.dataset.tab === tab));
          if (tab === 'fish') {
            const sorted = [...FISH_SPECIES].sort((a, b) => b.weight - a.weight);
            cards.innerHTML = sorted.map(sp => {
              const got = S.state.fishCatalog.includes(sp.id);
              const rare = rarityOf(sp);
              return `<div class="xy-card ${got ? '' : 'is-locked'}" data-kind="fish" data-id="${esc(sp.id)}">
                ${fishSvg(sp, 60)}
                <div><div class="xy-card__name">${got ? esc(sp.name) : '？？？'}</div>
                <div class="xy-card__tag">${got
                  ? `${starsText(rare.stars)} ${esc(rare.label)} · 单价 ${unitPrice(sp)} 币 · 概率约 ${(absProbOf(sp) * 100).toFixed(1)}%`
                  : '未发现 · 越稀有越贵'}</div></div>
              </div>`;
            }).join('');
          } else {
            cards.innerHTML = JUNK.map(j => {
              const got = S.state.junkCatalog.includes(j.id);
              return `<div class="xy-card ${got ? '' : 'is-locked'}" data-kind="junk" data-id="${esc(j.id)}">
                ${junkSvg(j, 60)}
                <div><div class="xy-card__name">${got ? esc(j.name) : '？？？'}</div>
                <div class="xy-card__tag">${got ? '已收录' : '未发现'}</div></div>
              </div>`;
            }).join('');
          }
          cards.querySelectorAll('.xy-card').forEach(el => {
            el.addEventListener('click', () => {
              if (el.classList.contains('is-locked')) return;
              if (pageEl) S.scroll.book = pageEl.scrollTop;
              ctx.push('bookDetail', { kind: el.dataset.kind, id: el.dataset.id });
            });
          });
        }

        tabs.forEach(t => t.addEventListener('click', () => {
          tab = t.dataset.tab;
          S.bookTab = tab;
          renderCards();
        }));

        renderCards();
        if (pageEl) pageEl.scrollTop = S.scroll.book || 0;
      },
    },

    /* ---------------- 图鉴详情 ---------------- */
    bookDetail: {
      name: 'bookDetail',
      render(routeCtx) {
        const S = session(routeCtx.nav);
        const { kind, id } = routeCtx.data || {};
        const sp = kind === 'fish' ? findFish(id) : null;
        const j = kind === 'junk' ? findJunk(id) : null;
        const art = sp ? fishSvg(sp, 160) : (j ? junkSvg(j, 160) : '');
        const name = sp ? sp.name : (j ? j.name : '未知');
        return page(`
          ${header(S, '图鉴')}
          <div class="xy-detail">
            <div class="xy-catch__art" style="height:200px">${art}</div>
            <div class="xy-detail__name">${esc(name)}</div>
          </div>
        `);
      },
      mount(root, ctx) {

      },
    },

    /* ---------------- 签到 ---------------- */
    sign: {
      name: 'sign',
      render(routeCtx) {
        const S = session(routeCtx.nav);
        const signed = S.state.lastSignIn === todayKey();
        return page(`
          ${header(S, '签到')}
          <div class="xy-signin">
            <div class="xy-signin__coin">${COIN_SVG(96)}</div>
            <div class="xy-signin__title">每日签到</div>
            <div class="xy-signin__desc">每天领取 15 小鱼币</div>
            ${signed
              ? `<div class="xy-signin__ok">✓ 今日已签到，明天再来吧</div>`
              : `<div class="xy-actions" style="max-width:320px;margin:22px auto 0">
                   <button class="xy-btn xy-btn--primary" id="xySignBtn" type="button">领取 15 小鱼币</button>
                 </div>`}
          </div>
        `);
      },
      mount(root, ctx) {
        const S = session(ctx.nav);

        const btn = root.querySelector('#xySignBtn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
          if (S.state.lastSignIn === todayKey()) return;
          S.state.coins += 15;
          S.state.lastSignIn = todayKey();
          await S.save();
          btn.outerHTML = '<div class="xy-signin__ok">✓ 签到成功，小鱼币 +15</div>';
          const coinEl = root.querySelector('.xy-coin span');
          if (coinEl) coinEl.textContent = S.state.coins;
          try { WujiToast.show('签到成功：小鱼币 +15 🎉'); } catch { }
        });
      },
    },
  };

  /* =========================================================
     路由包装：异步存档就绪后重画本页；从下级返回时刷新。
     数据来自挂在 nav 上的 session，包装器本身无状态。
     ========================================================= */
  function wrap(route) {
    const wrapped = {
      ...route,
      mount(root, ctx) {
        const S = session(ctx.nav);
        let disposed = false;
        let localDispose = null;

        const rebind = () => {
          if (typeof localDispose === 'function') {
            try { localDispose(); } catch { }
            localDispose = null;
          }
          const ret = route.mount?.(root, ctx);
          localDispose = typeof ret === 'function' ? ret : null;
        };
        const paint = () => {
          if (disposed || !root.isConnected) return;
          root.innerHTML = route.render(ctx);
          rebind();
        };

        if (S.loaded) {
          rebind();
        } else {
          S.ready().then(() => { if (!disposed) paint(); })
                   .catch(() => { if (!disposed) rebind(); });
        }

        const off = ctx.nav.onChange(() => {
          if (disposed || !S.loaded) return;
          if (ctx.nav.current?.route !== wrapped) return;
          paint();
        });

        return () => {
          disposed = true;
          try { off(); } catch { }
          if (typeof localDispose === 'function') {
            try { localDispose(); } catch { }
            localDispose = null;
          }
        };
      },
    };
    return wrapped;
  }

  const wrappedRoutes = {};
  Object.keys(routes).forEach(k => { wrappedRoutes[k] = wrap(routes[k]); });

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '杨梅小鱼',
    icon: './assets/xiaoyu.svg',
    initialRoute: 'home',
    version: '1.2.0',
    devices: ['iwuji', 'pc'],
    styles,
    routes: wrappedRoutes,
  });
})();