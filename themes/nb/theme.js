/* 吴际牛逼 —— 轻量主题：笑脸用 CSS 伪元素绘制，移动用 transform + CSS 变量 calc，
   JS 仅在状态变化时写一个 --p 变量（无 canvas / 无 SVG / 无逐帧布局）。 */
WujiTheme.define({
  id: 'wujiniubee',
  name: '吴际牛逼',
  version: '1.0.0',

  vars: {
    '--wj-lock-time-color': '#ffffff',
    '--wj-lock-time-bg': 'none',
    '--wj-lock-time-fill': '#ffffff',
    '--wj-lock-time-filter': 'none',
    '--wj-lock-date-color': '#ffffff',
    '--wj-lock-date-shadow': '0 1px 6px rgba(0,0,0,.4)',
  },

  styles: `
    :host { display: block; }
    .stage {
      position: absolute; inset: 0; overflow: hidden;
      background: radial-gradient(120% 90% at 50% 20%, #b96c10 0%, #955809 55%, #5e3606 100%);
      --p: 0;  /* 解锁进度 0..1，由 JS 轻量写入 */
    }

    /* 笑脸：div 本身当脸；::before 用径向渐变一次画两只眼，::after 画笑嘴 */
    .smiley {
      position: absolute; left: 50%; top: 50%;
      width: 46vmin; height: 46vmin; margin: -23vmin 0 0 -23vmin;
      border-radius: 50%;
      background: radial-gradient(circle at 38% 30%, #fff1a0 0%, #ffd93b 45%, #f2bb16 100%);
      box-shadow: inset 0 0 0 6px #000, 0 10px 30px rgba(0,0,0,.3);
      transform: translate3d(0, calc((1 - var(--p)) * 55vmin), 0) scale(calc(1 + var(--p) * 0.06));
      will-change: transform;
    }
    /* 两只眼睛：两个径向渐变圆点，位置按脸的百分比精确定位 */
    .smiley::before {
      content: ''; position: absolute; inset: 0;
      background:
        radial-gradient(circle at 32% 36%, #000 0 5.5%, transparent 6%),
        radial-gradient(circle at 68% 36%, #000 0 5.5%, transparent 6%);
    }
.smiley::after {
  content: '';
  position: absolute;
  left: 8%;
  top: 45%;
  width: 84%;
  height: 55%;

  background: #000;

  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 50' preserveAspectRatio='none'><path d='M0,0 Q50,58 100,0' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/></svg>");
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 50' preserveAspectRatio='none'><path d='M0,0 Q50,58 100,0' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/></svg>");
}

    .slogan {
      position: absolute; left: 0; right: 0; bottom: 8%;
      text-align: center;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
      font-weight: 900; font-size: clamp(44px, 19vw, 130px); line-height: 1;
      letter-spacing: .04em; color: #fff;
      pointer-events: none; user-select: none;
      opacity: clamp(0, calc((var(--p) - 0.45) * 2), 1);
      transform: translateY(calc((1 - var(--p)) * 30px)) scale(calc(.9 + var(--p) * .1));
      will-change: opacity, transform;
    }
  `,

  mount(root, ctx) {
    root.innerHTML = `
      <div class="stage">
        <div class="smiley"></div>
        <div class="slogan">吴际牛逼</div>
      </div>
    `;
    const stage = root.querySelector('.stage');
    const off = ctx.onStateChange(s => {
      const p = Math.max(0, Math.min(1, typeof s.unlockProgress === 'number' ? s.unlockProgress : 0));
      stage.style.setProperty('--p', p.toFixed(3));
    });
    return () => off();
  },
});
