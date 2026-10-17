WujiTheme.define({
  id: 'sea',
  name: '海景',
  version: '1.0.0',

  vars: {
    '--wj-lock-time-color': '#e8f0ff',
    '--wj-lock-date-color': '#e8f0ff',
    '--wj-lock-date-shadow': '0 1px 6px rgba(20, 40, 80, .7)',
  },
  tone: 'light',  

  styles: `
    :host { display: block; }
    .wall {
      position: absolute; inset: 0;
      background: url('./themes/sea/static.png') center center / cover no-repeat;
      will-change: transform;
    }
  `,

  mount(root, ctx) {
    const wall = document.createElement('div');
    wall.className = 'wall';
    root.appendChild(wall);

    const off = ctx.onStateChange(s => {
      const p = s.unlockProgress;
      wall.style.transition = 'none';
      wall.style.transform  = `scale(${1 + p * 0.06}) translateY(${-p * 8}px)`;
    });

    return () => off();
  },
});