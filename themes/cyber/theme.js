(() => {
  WujiTheme.define({
    id: 'cyber',
    tone: 'dark',
    lockstyle: 'large',
    vars: {
      '--wj-lock-time-color': '#00e5ff',
      '--wj-lock-time-fill': '#00e5ff',
      '--wj-lock-time-bg': 'none',
      '--wj-lock-time-filter': 'drop-shadow(0 0 8px #00e5ff) drop-shadow(0 0 24px rgba(0, 229, 255, .5))',
      '--wj-lock-date-color': '#ff3d9a',
      '--wj-lock-date-shadow': '0 0 10px rgba(255, 61, 154, .8)',
    },
    styles: `
      .cy-bg { position: absolute; inset: 0; background: #0a0014; }
      .cy-grid {
        position: absolute;
        left: -20%; right: -20%; bottom: 0;
        height: 60%;
        background-image:
          linear-gradient(rgba(0, 229, 255, .12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 61, 154, .12) 1px, transparent 1px);
        background-size: 32px 32px;
        transform: perspective(400px) rotateX(55deg);
        transform-origin: center bottom;
        animation: cyGridMove 3s linear infinite;
        pointer-events: none;
      }
      @keyframes cyGridMove {
        from { background-position: 0 0, 0 0; }
        to   { background-position: 0 32px, 32px 0; }
      }
      /* 应用打开 / 非运行态时暂停网格滚动 */
      [data-paused="1"] .cy-grid {
        animation-play-state: paused;
      }
      .cy-glow {
        position: absolute;
        width: 400px; height: 400px;
        border-radius: 50%;
        pointer-events: none;
        filter: blur(80px);
        opacity: .55;
      }
      .cy-glow--1 {
        background: radial-gradient(circle, #00e5ff, transparent 70%);
        top: -120px; left: -120px;
      }
      .cy-glow--2 {
        background: radial-gradient(circle, #ff3d9a, transparent 70%);
        bottom: -120px; right: -120px;
      }
      .cy-scan {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, .14) 0px,
          rgba(0, 0, 0, .14) 1px,
          transparent 1px,
          transparent 3px
        );
        pointer-events: none;
      }
    `,
    mount(root, ctx) {
      root.innerHTML = `
        <div class="cy-bg"></div>
        <div class="cy-glow cy-glow--1"></div>
        <div class="cy-glow cy-glow--2"></div>
        <div class="cy-grid"></div>
        <div class="cy-scan"></div>
      `;

      const off = ctx.onStateChange(s => {
        const paused = (
          s.view === 'app' ||
          s.power === 'off' ||
          s.power === 'booting' ||
          s.power === 'shuttingdown' ||
          s.power === 'updating'
        );
        root.setAttribute('data-paused', paused ? '1' : '0');
      });

      return () => off();
    },
  });
})();