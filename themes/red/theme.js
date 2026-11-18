/* 牛逼红 —— 轻量「一镜到底」主题（与牛逼蓝同构，酒红配色）：明亮大光晕 + 柔光点，
   纯 CSS transform 随解锁进度运动，零 canvas / 零 RAF；JS 只写一个 --p 变量。 */
WujiTheme.define({
  id: 'niu-red',
  name: '牛逼红',
  version: '1.0.0',

  vars: {
    '--wj-lock-time-color': '#ffffff',
    '--wj-lock-date-color': '#ffdfe6',
    '--wj-lock-date-shadow': '0 1px 6px rgba(60, 4, 16, .8)',
  },

  styles: `
    :host { display: block; }
    .stage {
      position: absolute; inset: 0; overflow: hidden;
      --p: 0;
      background: linear-gradient(160deg, #2a0612 0%, #7d1830 50%, #300818 100%);
    }
    .stage::before {
      content: ''; position: absolute; inset: -30%;
      background:
        radial-gradient(circle 58vmin at 30% 28%,
          rgba(235, 145, 170, .50) 0%, rgba(200, 80, 115, .30) 40%, transparent 72%),
        radial-gradient(circle 52vmin at 74% 66%,
          rgba(225, 125, 155, .44) 0%, rgba(180, 55, 95, .26) 42%, transparent 74%),
        radial-gradient(circle 44vmin at 52% 92%,
          rgba(170, 45, 85, .30) 0%, transparent 70%);
      transform: translate3d(calc(var(--p) * 9%), calc(var(--p) * -11%), 0) scale(calc(1 + var(--p) * .16));
      will-change: transform;
    }
    .stage::after {
      content: ''; position: absolute; inset: -10%;
      background:
        radial-gradient(circle 3vmin at 18% 62%, rgba(255, 205, 220, .42), transparent 70%),
        radial-gradient(circle 2.4vmin at 84% 22%, rgba(255, 195, 215, .36), transparent 70%),
        radial-gradient(circle 2vmin at 46% 44%, rgba(255, 210, 225, .30), transparent 70%);
      transform: translate3d(calc(var(--p) * -6%), calc(var(--p) * 7%), 0);
      will-change: transform;
    }
  `,

  mount(root, ctx) {
    const stage = document.createElement('div');
    stage.className = 'stage';
    root.appendChild(stage);
    const off = ctx.onStateChange(s => {
      const p = Math.max(0, Math.min(1, typeof s.unlockProgress === 'number' ? s.unlockProgress : 0));
      stage.style.setProperty('--p', p.toFixed(3));
    });
    return () => off();
  },
});
