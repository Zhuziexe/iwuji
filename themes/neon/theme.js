(() => {
  WujiTheme.define({
    id: 'neon',
    tone: 'dark',
    lockstyle: 'small',
    vars: {
      '--wj-lock-time-color': '#ff2d78',
      '--wj-lock-time-fill': '#ff2d78',
      '--wj-lock-time-bg': 'none',
      '--wj-lock-time-filter':
        'drop-shadow(0 0 8px #ff2d78) drop-shadow(0 0 20px rgba(255, 45, 120, .5))',
      '--wj-lock-date-color': '#00e5ff',
      '--wj-lock-date-shadow': '0 0 8px rgba(0, 229, 255, .7)',
    },
    styles: `
      .ne-bg {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse at 20% 100%, rgba(255, 45, 120, .22) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(0, 229, 255, .22) 0%, transparent 50%),
          linear-gradient(180deg, #0a0510 0%, #150a1e 60%, #1a0a20 100%);
      }
      .ne-canvas {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        display: block;
        pointer-events: none;
      }
      .ne-fog {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 30%;
        background: linear-gradient(to top,
          rgba(255, 45, 120, .12) 0%,
          rgba(0, 229, 255, .06) 50%,
          transparent 100%);
        pointer-events: none;
      }
    `,
    mount(root, ctx) {
      root.innerHTML = '<div class="ne-bg"></div>';

      const canvas = document.createElement('canvas');
      canvas.className = 'ne-canvas';
      root.appendChild(canvas);

      const fog = document.createElement('div');
      fog.className = 'ne-fog';
      root.appendChild(fog);

      const c = canvas.getContext('2d');
      if (!c) return;

      let W = 0, H = 0, dpr = 1;
      let drops = [];
      let raf = 0;
      let lastT = 0;
      let paused = true;

      function resize() {
        const rect = canvas.getBoundingClientRect();
        let w = rect.width, h = rect.height;
        if (!w || !h) {
          const pr = root.getBoundingClientRect();
          w = pr.width; h = pr.height;
        }
        if (!w || !h) return;

        const dw = Math.abs(w - W), dh = Math.abs(h - H);
        const bigChange = !W || dw / W > 0.3 || dh / H > 0.3;

        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = w; H = h;
        canvas.width = Math.min(4096, Math.round(W * dpr));
        canvas.height = Math.min(4096, Math.round(H * dpr));
        c.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (bigChange) {
          drops = [];
          const n = Math.min(90, Math.round(W * H / 1400));
          for (let i = 0; i < n; i++) {
            drops.push({
              x: Math.random() * W,
              y: Math.random() * H,
              len: 16 + Math.random() * 32,       /* 稍长，慢速下雨丝才有存在感 */
              speed: 90 + Math.random() * 160,    /* 慢到 2~4 秒才穿过屏幕 */
              drift: 8 + Math.random() * 14,      /* 横向风，让雨丝倾斜 */
              alpha: 0.25 + Math.random() * 0.5,
              color: Math.random() < 0.5 ? '255, 45, 120' : '0, 229, 255',
            });
          }
        }
      }

      function draw(t) {
        if (paused) { raf = 0; return; }
        const dt = Math.min(50, t - (lastT || t)) / 1000;
        lastT = t;

        c.clearRect(0, 0, W, H);
        c.lineCap = 'round';

        for (const d of drops) {
          d.y += d.speed * dt;
          d.x += d.drift * dt;

          if (d.y > H + d.len) {
            d.y = -d.len;
            d.x = Math.random() * W;
          }
          if (d.x > W + 10) d.x = -10;

          /* 雨丝带倾斜：终点相对起点往右下偏 */
          const tilt = d.drift / d.speed;

          c.strokeStyle = `rgba(${d.color}, ${d.alpha})`;
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(d.x, d.y);
          c.lineTo(d.x - d.len * tilt, d.y + d.len);
          c.stroke();

          /* 底部溅射光点 */
          if (d.y > H - 10) {
            c.fillStyle = `rgba(${d.color}, ${d.alpha * 0.6})`;
            c.beginPath();
            c.arc(d.x, H - 4, 1.5, 0, Math.PI * 2);
            c.fill();
          }
        }

        raf = requestAnimationFrame(draw);
      }

      function start() {
        if (paused || raf) return;
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
        paused = s.view === 'app' || s.power !== 'running';
        if (paused) stop();
        else start();
      });

      return () => { stop(); ro.disconnect(); off(); };
    },
  });
})();