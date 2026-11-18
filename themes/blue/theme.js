/* 牛逼蓝 —— 轻量「一镜到底」主题：明亮大光晕 + 柔光点，纯 CSS transform 随解锁进度运动，
   零 canvas / 零 RAF；JS 只在状态变化时写一个 --p 变量。 */
WujiTheme.define({
  id: 'niu-blue',
  name: '牛逼蓝',
  version: '1.0.0',

  vars: {
    '--wj-lock-time-color': '#ffffff',
    '--wj-lock-date-color': '#e8f2ff',
    '--wj-lock-date-shadow': '0 1px 6px rgba(4, 14, 48, .8)',
  },

  styles: `
    :host { display: block; }
    .stage {
      position: absolute; inset: 0; overflow: hidden;
      --p: 0;
      background: linear-gradient(160deg, #04102e 0%, #0e2c6b 50%, #051534 100%);
    }
    /* 光晕层：柔和的大团蓝光（中心不发白），随 --p 一镜到底推进+放大 */
    .stage::before {
      content: ''; position: absolute; inset: -30%;
      background:
        radial-gradient(circle 58vmin at 30% 28%,
          rgba(120, 175, 245, .50) 0%, rgba(80, 140, 225, .30) 40%, transparent 72%),
        radial-gradient(circle 52vmin at 74% 66%,
          rgba(95, 150, 230, .44) 0%, rgba(50, 105, 205, .26) 42%, transparent 74%),
        radial-gradient(circle 44vmin at 52% 92%,
          rgba(60, 120, 215, .30) 0%, transparent 70%);
      transform: translate3d(calc(var(--p) * 9%), calc(var(--p) * -11%), 0) scale(calc(1 + var(--p) * .16));
      will-change: transform;
    }
    /* 柔光点：几颗低调的小亮斑，反向视差 */
    .stage::after {
      content: ''; position: absolute; inset: -10%;
      background:
        radial-gradient(circle 3vmin at 18% 62%, rgba(190, 220, 255, .42), transparent 70%),
        radial-gradient(circle 2.4vmin at 84% 22%, rgba(180, 215, 255, .36), transparent 70%),
        radial-gradient(circle 2vmin at 46% 44%, rgba(190, 220, 255, .30), transparent 70%);
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
