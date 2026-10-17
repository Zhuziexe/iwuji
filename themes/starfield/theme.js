WujiTheme.define({
  id: 'starfield',
  name: '星空',
  version: '1.0.0',

  vars: {
    '--wj-lock-time-color': '#e8f0ff',
    '--wj-lock-date-color': '#e8f0ff',
    '--wj-lock-date-shadow': '0 1px 6px rgba(20, 40, 80, .7)',
  },
  tone: 'dark',
  lockstyle: 'small',
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
    let lastT = 0;
    let shootTimer = 800;

    /* 三层星星：远层密、小、慢；近层疏、大、快 */
    const LAYERS = [
      { count: 150, rMin: 0.35, rMax: 0.8, speed: 4,  aMin: 0.30, aMax: 0.55 },
      { count: 70,  rMin: 0.7,  rMax: 1.3, speed: 9,  aMin: 0.50, aMax: 0.80 },
      { count: 28,  rMin: 1.2,  rMax: 2.0, speed: 16, aMin: 0.75, aMax: 1.00 },
    ];

    let stars = [];
    let shooting = [];

    function initStars() {
      stars = [];
      LAYERS.forEach((L, li) => {
        for (let i = 0; i < L.count; i++) {
          const warm = Math.random() < 0.12;
          stars.push({
            layer: li,
            x: Math.random() * W,
            y: Math.random() * H,
            r: L.rMin + Math.random() * (L.rMax - L.rMin),
            base: L.aMin + Math.random() * (L.aMax - L.aMin),
            tw: 0.4 + Math.random() * 1.8,
            phase: Math.random() * Math.PI * 2,
            drift: (Math.random() - 0.5) * 0.02,
            color: warm ? '255,230,190' : '255,255,255',
          });
        }
      });
      shooting = [];
    }

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = w;
      H = h;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
    }

    function spawnShooting() {
      const fromLeft = Math.random() < 0.5;
      const x0 = fromLeft ? -30 : W + 30;
      const y0 = Math.random() * H * 0.45;
      const dx = fromLeft ? 1 : -1;
      const dy = 0.35 + Math.random() * 0.45;
      const speed = 0.9 + Math.random() * 0.8; /* 像素 / ms */
      const len = 60 + Math.random() * 90;
      shooting.push({
        x: x0, y: y0,
        dx, dy, speed, len,
        life: 1400,
        maxLife: 1400,
      });
    }

    function drawMoon(t) {
      const mx = W * 0.82 + Math.sin(t / 4000) * 4;
      const my = H * 0.18 + Math.cos(t / 5000) * 3 + progress * -6;
      const mr = Math.min(W, H) * 0.08;
      const breathe = 0.5 + 0.5 * Math.sin(t / 2000);

      /* 光晕 */
      const glow = c.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 2.6);
      glow.addColorStop(0, `rgba(255,240,180,${(0.32 + breathe * 0.18).toFixed(3)})`);
      glow.addColorStop(0.4, `rgba(255,220,140,${(0.12 + breathe * 0.08).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = glow;
      c.beginPath();
      c.arc(mx, my, mr * 2.6, 0, Math.PI * 2);
      c.fill();

      /* 本体 */
      const mg = c.createRadialGradient(
        mx - mr * 0.3, my - mr * 0.3, mr * 0.1,
        mx, my, mr
      );
      mg.addColorStop(0, '#fffbe8');
      mg.addColorStop(0.55, '#ffe9a8');
      mg.addColorStop(1, '#d4b672');
      c.fillStyle = mg;
      c.beginPath();
      c.arc(mx, my, mr, 0, Math.PI * 2);
      c.fill();

      /* 环形山 */
      c.fillStyle = 'rgba(200,180,130,0.32)';
      c.beginPath(); c.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.18, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(mx + mr * 0.25, my + mr * 0.15, mr * 0.11, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(mx - mr * 0.1, my + mr * 0.35, mr * 0.08, 0, Math.PI * 2); c.fill();
    }

    function frame(t) {
      if (!lastT) lastT = t;
      const dt = Math.min(48, t - lastT);
      lastT = t;

      if (!paused && W && H) {
        /* 背景（随解锁进度略微变亮） */
        const bg = c.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, `hsl(220, 60%, ${3 + progress * 3}%)`);
        bg.addColorStop(1, `hsl(230, 70%, ${1 + progress * 2}%)`);
        c.fillStyle = bg;
        c.fillRect(0, 0, W, H);

        /* 一层很淡的银河带 */
        const mw = c.createRadialGradient(
          W * 0.6, H * 0.3, 0,
          W * 0.6, H * 0.3, Math.max(W, H) * 0.75
        );
        mw.addColorStop(0, `rgba(90,130,220,${(0.07 + progress * 0.04).toFixed(3)})`);
        mw.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = mw;
        c.fillRect(0, 0, W, H);

        /* 星星：闪烁 + 漂移 */
        for (const s of stars) {
          const L = LAYERS[s.layer];

          /* 缓慢向下漂移（越近越快），横向轻微摆动 */
          s.y += (L.speed * dt / 1000) * 0.4;
          s.x += s.drift + Math.sin(t / 3500 + s.phase) * 0.015;

          if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
          if (s.x < -4)     s.x = W + 4;
          if (s.x > W + 4)  s.x = -4;

          const twinkle = 0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.phase);
          const alpha = s.base * twinkle;

          c.fillStyle = `rgba(${s.color},${alpha.toFixed(3)})`;
          c.beginPath();
          c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          c.fill();

          /* 最亮的几颗加十字光芒 */
          if (s.layer === 2 && s.r > 1.55 && alpha > 0.5) {
            const arm = s.r * 3.5;
            c.strokeStyle = `rgba(255,255,255,${(alpha * 0.35).toFixed(3)})`;
            c.lineWidth = 0.6;
            c.beginPath();
            c.moveTo(s.x - arm, s.y); c.lineTo(s.x + arm, s.y);
            c.moveTo(s.x, s.y - arm); c.lineTo(s.x, s.y + arm);
            c.stroke();
          }
        }

        /* 流星 */
        shootTimer -= dt;
        if (shootTimer <= 0) {
          spawnShooting();
          shootTimer = 2600 + Math.random() * 4500;
        }

        for (let i = shooting.length - 1; i >= 0; i--) {
          const sh = shooting[i];
          const move = sh.speed * dt;
          sh.x += sh.dx * move;
          sh.y += sh.dy * move;
          sh.life -= dt;

          if (sh.life <= 0 || sh.x < -260 || sh.x > W + 260 || sh.y > H + 140) {
            shooting.splice(i, 1);
            continue;
          }

          const a = Math.min(1, sh.life / 500);
          const tailX = sh.x - sh.dx * sh.len;
          const tailY = sh.y - sh.dy * sh.len;

          const grad = c.createLinearGradient(sh.x, sh.y, tailX, tailY);
          grad.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
          grad.addColorStop(0.35, `rgba(200,220,255,${(a * 0.55).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(200,220,255,0)');

          c.strokeStyle = grad;
          c.lineWidth = 1.6;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(sh.x, sh.y);
          c.lineTo(tailX, tailY);
          c.stroke();

          /* 头部光点 */
          c.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
          c.beginPath();
          c.arc(sh.x, sh.y, 1.6, 0, Math.PI * 2);
          c.fill();
        }

        /* 月亮 */
        drawMoon(t);
      }

      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const off = ctx.onStateChange(s => {
      progress = s.unlockProgress;
      paused = (s.power === 'off' || s.power === 'shuttingdown' || s.view === 'app');
    });

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
    };
  },
});