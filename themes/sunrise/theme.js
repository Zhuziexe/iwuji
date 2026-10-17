WujiTheme.define({
  id: 'sunrise',
  name: '日出',
  version: '1.0.0',

  vars: {
  /* 日出：暖色调锁屏时钟 */
  '--wj-lock-time-color': '#ffe9c0',
  '--wj-lock-time-bg': 'none',
  '--wj-lock-time-fill': '#ffe9c0',
  '--wj-lock-time-filter': 'drop-shadow(0 2px 14px rgba(255,180,100,.55))',
  '--wj-lock-date-color': '#ffe9c0',
  '--wj-lock-date-shadow': '0 1px 8px rgba(180, 100, 40, .55)',
},
 tone: 'dark',

  styles: `
    :host { display: block; }
    .sky {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom,
        #1a1733 0%, #3a2a4a 22%, #7a4a5a 46%,
        #d47a5a 68%, #f5b070 80%, #ffd9a0 92%, #ffe9c0 100%);
      will-change: filter;
    }
    .glow {
      position: absolute; left: 50%; bottom: 22%;
      width: 320px; height: 320px; margin-left: -160px;
      border-radius: 50%;
      background: radial-gradient(circle,
        rgba(255,220,150,.55) 0%,
        rgba(255,180,100,.22) 35%,
        rgba(255,120,60,0) 70%);
      pointer-events: none; z-index: 1;
      will-change: transform, opacity;
    }
    .sun {
      position: absolute; left: 50%; bottom: 22%;
      width: 130px; height: 130px; margin-left: -65px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 45%,
        #fff8e0 0%, #ffd76a 40%, #ff9e3a 75%, #e07030 100%);
      box-shadow:
        0 0 40px rgba(255,200,100,.7),
        0 0 100px rgba(255,160,80,.5),
        0 0 180px rgba(255,120,60,.3);
      z-index: 2; will-change: transform, filter;
    }
    .cloud {
      position: absolute; border-radius: 999px;
      background: rgba(255,200,180,.4);
      filter: blur(10px);
      will-change: transform, opacity; z-index: 4;
    }
    .cloud::before, .cloud::after {
      content: ''; position: absolute;
      background: inherit; border-radius: 50%;
    }
    .cloud--1 { width: 90px; height: 22px; top: 45%; left: 6%;  animation: drift 26s linear infinite; }
    .cloud--1::before { width: 50px; height: 50px; left: 12px; top: -22px; }
    .cloud--1::after  { width: 38px; height: 38px; right: 12px; top: -16px; }
    .cloud--2 { width: 120px; height: 26px; top: 30%; right: 4%; animation: drift 34s linear infinite reverse; }
    .cloud--2::before { width: 60px; height: 60px; left: 18px; top: -28px; }
    .cloud--2::after  { width: 44px; height: 44px; right: 18px; top: -22px; }
    .cloud--3 { width: 70px; height: 18px; top: 58%; left: 65%; animation: drift 42s linear infinite; }
    .cloud--3::before { width: 40px; height: 40px; left: 10px; top: -18px; }
    @keyframes drift {
      from { transform: translateX(-30px); }
      to   { transform: translateX(calc(100vw + 30px)); }
    }
    .horizon {
      position: absolute; left: 0; right: 0; bottom: 0;
      height: 22%;
      background: linear-gradient(to bottom, #2a1a30 0%, #1a1020 60%, #0a0810 100%);
      z-index: 3;
    }
    .horizon::before {
      content: ''; position: absolute; top: -1px; left: 0; right: 0; height: 2px;
      background: linear-gradient(to right,
        transparent 0%,
        rgba(255,200,140,.55) 35%,
        rgba(255,220,170,.8) 50%,
        rgba(255,200,140,.55) 65%,
        transparent 100%);
    }
  `,

  mount(root, ctx) {
    root.innerHTML = `
      <div class="sky"></div>
      <div class="glow"></div>
      <div class="sun"></div>
      <div class="cloud cloud--1"></div>
      <div class="cloud cloud--2"></div>
      <div class="cloud cloud--3"></div>
      <div class="horizon"></div>
    `;

    const sky   = root.querySelector('.sky');
    const sun   = root.querySelector('.sun');
    const glow  = root.querySelector('.glow');

    let progress = 0;

    function applyProgress() {
      const rise = 60 - progress * 60;
      sun.style.transform  = `translateY(${rise}%) scale(${1 + progress * 0.08})`;
      sun.style.filter     = `brightness(${0.75 + progress * 0.35})`;
      glow.style.transform = `translateY(${rise}%) scale(${1 + progress * 0.15})`;
      glow.style.opacity   = String(0.6 + progress * 0.4);
      sky.style.filter     = `brightness(${0.85 + progress * 0.35}) saturate(${1 + progress * 0.2})`;
    }
    applyProgress();

    const off = ctx.onStateChange(s => {
      progress = s.unlockProgress;
      applyProgress();
      const paused = (s.power === 'off' || s.power === 'shuttingdown' || s.view === 'app');
      const play = paused ? 'paused' : 'running';
      root.querySelectorAll('.cloud').forEach(c => c.style.animationPlayState = play);
    });

    return () => off();
  },
});