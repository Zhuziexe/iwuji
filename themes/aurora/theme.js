WujiTheme.define({
  id: 'aurora',
  name: '极光',
  version: '1.0.0',
  tone: 'dark',

  vars: {
    '--wj-lock-time-color':  '#eef6ff',
    '--wj-lock-time-bg':     'none',
    '--wj-lock-time-fill':   '#eef6ff',
    '--wj-lock-time-filter':
      'drop-shadow(0 1px 2px rgba(0,0,0,.65)) drop-shadow(0 4px 14px rgba(0,0,0,.45))',
    '--wj-lock-date-color':  '#d8ecff',
    '--wj-lock-date-shadow':
      '0 1px 3px rgba(0,0,0,.55), 0 4px 12px rgba(0,0,0,.4)',
  },

  styles: `
    :host { display: block; }
    canvas { width: 100%; height: 100%; display: block; }
  `,

  mount(root, ctx) {
    const canvas = document.createElement('canvas');
    root.appendChild(canvas);
    const c = canvas.getContext('2d');

    let W = 0, H = 0, dpr = 1;
    let paused = false;
    let progress = 0;
    let raf = 0;
    let startT = performance.now();

    let orbs = [];
    let stars = [];

    /* 时钟区域：和锁屏 padding-top 16% 对齐，覆盖时钟 + 日期 */
    const CLOCK_CY = 0.42;   /* 中心 y（占屏幕高度比例） */
    const CLOCK_RY = 0.35;   /* 半径（占屏幕高度比例） */

    function initStars() {
      stars = [];
      const n = Math.round(W * H / 9000);
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H * 0.7,
          r: 0.3 + Math.random() * 0.8,
          a: 0.2 + Math.random() * 0.5,
          tw: 0.3 + Math.random() * 1.2,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function initOrbs() {
      const count = Math.max(18, Math.min(36, Math.round(W * H / 22000)));
      const HUES = [155, 175, 195, 220, 265];

      orbs = [];
      for (let i = 0; i < count; i++) {
        const breathPeriod = 3000 + Math.random() * 4000;
        orbs.push({
          x: Math.random(),
          y: Math.random(),
          baseR: 60 + Math.random() * 110,
          hue: HUES[(Math.random() * HUES.length) | 0],
          period: breathPeriod,
          phase: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.00006,
          vy: (Math.random() - 0.5) * 0.00006,
        });
      }
    }

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = w; H = h;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
      initOrbs();
    }

    function drawOrb(orb, now) {
      const b = Math.sin((now / orb.period) * Math.PI * 2 + orb.phase);
      const breath = 1 + b * 0.35;

      /* ★ 时钟区域降亮：光斑在时钟范围内时 alpha 压到 35%，边缘平滑过渡 */
      const dy = Math.abs(orb.y - CLOCK_CY);
      let safeScale = 1;
      if (dy < CLOCK_RY) {
        const t = dy / CLOCK_RY;        /* 0 = 中心，1 = 边缘 */
        safeScale = 0.35 + t * 0.65;
      }

      const alpha = (0.28 + (b + 1) * 0.16) * safeScale;

      const r = orb.baseR * breath;
      const x = orb.x * W;
      const y = orb.y * H;

      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0,    `hsla(${orb.hue}, 90%, 65%, ${alpha.toFixed(3)})`);
      g.addColorStop(0.35, `hsla(${orb.hue}, 90%, 58%, ${(alpha * 0.55).toFixed(3)})`);
      g.addColorStop(0.7,  `hsla(${orb.hue}, 85%, 50%, ${(alpha * 0.18).toFixed(3)})`);
      g.addColorStop(1,    `hsla(${orb.hue}, 85%, 50%, 0)`);

      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }

    /* ★ 时钟区域暗角：一层深蓝色径向渐变，压在光斑之上 */
    function drawClockScrim() {
      const cx = W * 0.5;
      const cy = H * CLOCK_CY;
      const rx = W * 0.65;
      const ry = H * CLOCK_RY;

      const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      g.addColorStop(0,    'rgba(6, 12, 28, 0.52)');
      g.addColorStop(0.45, 'rgba(6, 12, 28, 0.28)');
      g.addColorStop(0.8,  'rgba(6, 12, 28, 0.08)');
      g.addColorStop(1,    'rgba(6, 12, 28, 0)');

      c.save();
      c.translate(cx, cy);
      c.scale(rx, ry);
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 1, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    function frame(now) {
      if (!paused && W && H) {
        const lift = 4 + progress * 8;

        /* 1) 夜空背景 */
        const bg = c.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, `hsl(228, 55%, ${5 + lift}%)`);
        bg.addColorStop(1, `hsl(210, 40%, ${2 + lift}%)`);
        c.fillStyle = bg;
        c.fillRect(0, 0, W, H);

        /* 2) 星星 */
        for (const s of stars) {
          const tw = 0.6 + 0.4 * Math.sin(now * 0.001 * s.tw + s.phase);
          c.fillStyle = `rgba(220,235,255,${(s.a * tw).toFixed(3)})`;
          c.beginPath();
          c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          c.fill();
        }

        /* 3) 极光光斑 */
        c.globalCompositeOperation = 'lighter';
        for (const orb of orbs) {
          orb.x += orb.vx;
          orb.y += orb.vy;
          if (orb.x < -0.1) orb.x = 1.1;
          if (orb.x > 1.1)  orb.x = -0.1;
          if (orb.y < -0.1) orb.y = 1.1;
          if (orb.y > 1.1)  orb.y = -0.1;
          drawOrb(orb, now);
        }
        c.globalCompositeOperation = 'source-over';

        /* ★ 4) 时钟区域暗角：压住飘到时钟后面的光斑 */
        drawClockScrim();

        /* 5) 底部雾化 */
        const fog = c.createLinearGradient(0, H * 0.55, 0, H);
        fog.addColorStop(0, 'rgba(8,12,28,0)');
        fog.addColorStop(1, `rgba(8,12,28,${(0.85 - progress * 0.15).toFixed(2)})`);
        c.fillStyle = fog;
        c.fillRect(0, H * 0.55, W, H * 0.45);
      }
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(frame);

    const off = ctx.onStateChange(s => {
      progress = s.unlockProgress;
      paused = (s.power === 'off' || s.power === 'shuttingdown' || s.view === 'app');
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
    };
  },
});