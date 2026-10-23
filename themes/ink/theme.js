(() => {
  WujiTheme.define({
    id: 'ink',
    tone: 'dark',
    lockstyle: 'large',
    vars: {
      /* 时钟用宣纸白到墨灰的渐变，像毛笔写字 */
      '--wj-lock-time-color': 'transparent',
      '--wj-lock-time-bg':
        'linear-gradient(180deg, #f0ece4 0%, #c8c0b4 40%, #8a8070 100%)',
      '--wj-lock-time-fill': 'transparent',
      '--wj-lock-time-filter':
        'drop-shadow(0 1px 0 rgba(255,255,255,.15)) ' +
        'drop-shadow(0 4px 20px rgba(0,0,0,.6))',
      '--wj-lock-date-color': 'rgba(200, 195, 185, .55)',
      '--wj-lock-date-shadow': '0 1px 8px rgba(0,0,0,.6)',
    },
    styles: `
      /* 宣纸底色 —— 米色偏暖，不是纯黑 */
      .ink-paper {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse at 30% 20%, #121316 0%, transparent 55%),
          radial-gradient(ellipse at 70% 80%, #0e0f12 0%, transparent 55%),
          linear-gradient(160deg, #16171b 0%, #0d0e11 50%, #101115 100%);
      }

      /* 宣纸纤维纹理 —— 极淡的噪点，模拟纸面 */
      .ink-fiber {
        position: absolute;
        inset: 0;
        opacity: .08;
        pointer-events: none;
        background-image:
          repeating-linear-gradient(
            45deg,
            rgba(255, 255, 255, .5) 0px,
            rgba(255, 255, 255, .5) 1px,
            transparent 1px,
            transparent 3px
          ),
          repeating-linear-gradient(
            -45deg,
            rgba(255, 255, 255, .3) 0px,
            rgba(255, 255, 255, .3) 1px,
            transparent 1px,
            transparent 4px
          );
        mix-blend-mode: overlay;
      }

      /* 墨团 —— 三层不同大小、不同速度，模拟墨汁晕开 */
      .ink-blob {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        will-change: transform, opacity;
        filter: blur(48px);
      }

      /* 底层：大团深墨 —— 提供整体氛围 */
      .ink-blob--bg1 {
        width: 420px;
        height: 420px;
        top: -140px;
        left: -160px;
        background: radial-gradient(
          circle at 40% 40%,
          rgba(60, 65, 78, .55) 0%,
          rgba(40, 44, 54, .3) 40%,
          transparent 75%
        );
        filter: blur(60px);
        animation: inkDrift1 28s ease-in-out infinite;
      }

      .ink-blob--bg2 {
        width: 460px;
        height: 460px;
        bottom: -180px;
        right: -180px;
        background: radial-gradient(
          circle at 60% 60%,
          rgba(50, 55, 68, .5) 0%,
          rgba(35, 38, 48, .28) 45%,
          transparent 75%
        );
        filter: blur(64px);
        animation: inkDrift2 34s ease-in-out infinite;
      }

      /* 中层：中等墨点 —— 提供视觉焦点 */
      .ink-blob--mid {
        width: 200px;
        height: 200px;
        top: 38%;
        left: 55%;
        background: radial-gradient(
          circle,
          rgba(90, 96, 110, .35) 0%,
          rgba(60, 65, 78, .2) 40%,
          transparent 70%
        );
        filter: blur(36px);
        animation: inkDrift3 20s ease-in-out infinite;
      }

      /* 顶层：小墨点 —— 提供动态细节 */
      .ink-dot {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        will-change: transform, opacity;
      }

      .ink-dot--1 {
        width: 8px;
        height: 8px;
        top: 26%;
        left: 18%;
        background: radial-gradient(circle, #4a4f5e, transparent 70%);
        box-shadow: 0 0 20px rgba(70, 75, 88, .4);
        animation: inkFloat1 16s ease-in-out infinite;
      }

      .ink-dot--2 {
        width: 5px;
        height: 5px;
        top: 68%;
        left: 72%;
        background: radial-gradient(circle, #5a5f6e, transparent 70%);
        box-shadow: 0 0 16px rgba(80, 85, 98, .45);
        animation: inkFloat2 22s ease-in-out infinite;
      }

      .ink-dot--3 {
        width: 6px;
        height: 6px;
        top: 52%;
        left: 32%;
        background: radial-gradient(circle, #404552, transparent 70%);
        box-shadow: 0 0 14px rgba(60, 65, 78, .4);
        animation: inkFloat3 18s ease-in-out infinite;
      }

      @keyframes inkDrift1 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: .9; }
        50%      { transform: translate(50px, 70px) scale(1.1); opacity: 1; }
      }

      @keyframes inkDrift2 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: .85; }
        50%      { transform: translate(-60px, -50px) scale(1.08); opacity: 1; }
      }

      @keyframes inkDrift3 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: .8; }
        50%      { transform: translate(-30px, 40px) scale(1.15); opacity: 1; }
      }

      @keyframes inkFloat1 {
        0%, 100% { transform: translate(0, 0); opacity: .9; }
        50%      { transform: translate(30px, 20px); opacity: .6; }
      }

      @keyframes inkFloat2 {
        0%, 100% { transform: translate(0, 0); opacity: .7; }
        50%      { transform: translate(-25px, -30px); opacity: 1; }
      }

      @keyframes inkFloat3 {
        0%, 100% { transform: translate(0, 0); opacity: .5; }
        50%      { transform: translate(20px, -25px); opacity: .9; }
      }
    `,
    mount(root, ctx) {
      root.innerHTML = `
        <div class="ink-paper"></div>
        <div class="ink-fiber"></div>
        <div class="ink-blob ink-blob--bg1"></div>
        <div class="ink-blob ink-blob--bg2"></div>
        <div class="ink-blob ink-blob--mid"></div>
        <div class="ink-dot ink-dot--1"></div>
        <div class="ink-dot ink-dot--2"></div>
        <div class="ink-dot ink-dot--3"></div>
      `;

      /* 应用打开 / 非运行态时暂停所有 CSS 动画 */
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