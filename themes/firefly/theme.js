(() => {
  WujiTheme.define({
    id: 'firefly',
    tone: 'dark',
    lockstyle: 'large',
    vars: {
      '--wj-lock-time-color': 'transparent',
      '--wj-lock-time-bg': 'linear-gradient(180deg, #d8f0c8 0%, #8fbf7f 100%)',
      '--wj-lock-time-fill': 'transparent',
      '--wj-lock-date-color': 'rgba(200, 230, 190, .72)',
    },
    styles: `
      .fr-bg {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, #0a1410 0%, #102018 50%, #0a1810 100%);
      }
      .fr-fog {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 50% 80%, rgba(100, 150, 110, .18) 0%, transparent 60%);
        pointer-events: none;
      }
.fr-canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
  background: #0a1410;
}
    `,
    mount(root, ctx) {
      root.innerHTML = `
        <div class="fr-bg"></div>
        <div class="fr-fog"></div>
        <canvas class="fr-canvas"></canvas>
      `;

      const canvas = root.querySelector('.fr-canvas');
      const c = canvas.getContext('2d');
      if (!c) return;

      let W = 0, H = 0, dpr = 1;
      let flies = [];
      let raf = 0;
      let lastT = 0;
      let paused = true;

      function resize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) return;

        const dw = Math.abs(w - W);
        const dh = Math.abs(h - H);
        const bigChange = !W || dw / W > 0.3 || dh / H > 0.3;

        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = w;
        H = h;
        canvas.width  = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        c.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (bigChange) {
          flies = [];
          const n = Math.min(24, Math.round(W * H / 4000));
          for (let i = 0; i < n; i++) {
            flies.push({
              x: Math.random() * W,
              y: Math.random() * H,
              r: 1 + Math.random() * 1.5,
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 12,
              phase: Math.random() * Math.PI * 2,
              speed: 0.4 + Math.random() * 0.6,
            });
          }
        }
      }

      function draw(t) {
        if (paused) { raf = 0; return; }

        const dt = Math.min(50, t - (lastT || t)) / 1000;
        lastT = t;

        c.clearRect(0, 0, W, H);

        for (const f of flies) {
          f.x += f.vx * dt;
          f.y += f.vy * dt;

          if (f.x < 0 || f.x > W) f.vx = -f.vx;
          if (f.y < 0 || f.y > H) f.vy = -f.vy;

          const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * f.speed * 4 + f.phase);
          const alpha = 0.2 + tw * 0.7;

          const grad = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 8);
          grad.addColorStop(0, `rgba(180, 255, 140, ${alpha.toFixed(3)})`);
          grad.addColorStop(0.3, `rgba(140, 220, 100, ${(alpha * 0.4).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(140, 220, 100, 0)');
          c.fillStyle = grad;
          c.beginPath();
          c.arc(f.x, f.y, f.r * 8, 0, Math.PI * 2);
          c.fill();

          c.beginPath();
          c.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          c.fillStyle = `rgba(220, 255, 180, ${alpha.toFixed(3)})`;
          c.fill();
        }

        raf = requestAnimationFrame(draw);
      }

      function start() {
        if (paused) return;
        if (raf) return;
        lastT = 0;
        raf = requestAnimationFrame(draw);
      }

      function stop() {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        lastT = 0;
      }

      resize();

      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      const off = ctx.onStateChange(s => {
        paused = (
          s.view === 'app' ||
          s.power === 'off' ||
          s.power === 'booting' ||
          s.power === 'shuttingdown' ||
          s.power === 'updating'
        );
        if (paused) stop();
        else start();
      });

      return () => {
        stop();
        ro.disconnect();
        off();
      };
    },
  });
})();