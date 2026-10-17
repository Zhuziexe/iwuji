WujiTheme.define({
  id: 'wujiniubee',
  name: '吴际牛逼',
  version: '1.0.0',

  vars: {
    /* 白底主题：锁屏文字统一改成深色，保证可读 */
    '--wj-lock-time-color': '#ffffff',
    '--wj-lock-time-bg': 'none',
    '--wj-lock-time-fill': '#ffffff',
    '--wj-lock-time-filter': 'none',
    '--wj-lock-date-color': '#ffffff',
    '--wj-lock-date-shadow': 'none',
  },
  tone: 'dark',

  styles: `
    :host { display: block; }

    .stage {
      position: absolute; inset: 0;
      overflow: hidden;
      background: #955809;
    }

    .smiley {
      position: absolute;
      left: 50%; top: 50%;
      width: 280px; height: 280px;
      margin: -140px 0 0 -140px;
      will-change: transform;
    }
    .smiley svg {
      display: block;
      width: 100%; height: 100%;
      overflow: visible;
    }

    /* 底部大标语 */
    .slogan {
      position: absolute;
      left: 0; right: 0;
      bottom: 8%;
      text-align: center;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
                   system-ui, -apple-system, sans-serif;
      font-weight: 900;
      font-size: clamp(44px, 19vw, 130px);
      line-height: 1;
      letter-spacing: .04em;
      color: #ffffff;
      opacity: 0;
      transform: translateY(30px) scale(.9);
      will-change: opacity, transform;
      pointer-events: none;
      user-select: none;
    }
  `,

  mount(root, ctx) {
    root.innerHTML = `
      <div class="stage">
        <div class="smiley">
          <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <radialGradient id="wjFaceGrad" cx="38%" cy="30%" r="80%">
                <stop offset="0%"   stop-color="#fff1a0"/>
                <stop offset="45%"  stop-color="#ffd93b"/>
                <stop offset="100%" stop-color="#f2bb16"/>
              </radialGradient>
            </defs>

            <!-- 脸 -->
            <circle cx="128" cy="128" r="86"
                    fill="url(#wjFaceGrad)"
                    stroke="#000000" stroke-width="8"/>

            <!-- 眼睛 -->
            <circle cx="98"  cy="106" r="11" fill="#000000"/>
            <circle cx="158" cy="106" r="11" fill="#000000"/>

            <!-- 超级无敌开心的大嘴：从脸左上角一路笑到底部再兜回右上角 -->
            <path d="M58 86 C 66 238, 190 238, 198 86"
                  fill="none"
                  stroke="#000000"
                  stroke-width="10"
                  stroke-linecap="round"/>
          </svg>
        </div>

        <div class="slogan">吴际牛逼</div>
      </div>
    `;

    const stage  = root.querySelector('.stage');
    const smiley = root.querySelector('.smiley');
    const slogan = root.querySelector('.slogan');

    let stageH   = 0;
    let progress = 0;

    function apply() {
      const H = stageH || window.innerHeight || 800;
      const p = Math.max(0, Math.min(1, progress));

      /* ---- 笑脸 ---- */
      // p = 0：元素中心落在屏幕底边 → 半张脸被裁掉
      // p = 1：元素中心回到屏幕正中
      const offsetY = (1 - p) * (H / 2);
      const scale   = 1 + p * 0.06;
      smiley.style.transform =
        `translate3d(0, ${offsetY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;

      /* ---- 底部大标语：解锁进度过半后淡入上浮 ---- */
      const t = Math.max(0, Math.min(1, (p - 0.45) / 0.55));
      const e = t * t * (3 - 2 * t);           // smoothstep
      slogan.style.opacity = e.toFixed(3);
      slogan.style.transform =
        `translate3d(0, ${((1 - e) * 30).toFixed(2)}px, 0) scale(${(0.9 + e * 0.1).toFixed(3)})`;
    }

    // 舞台尺寸变化（旋转屏幕 / 分屏）时重新计算
    const ro = new ResizeObserver(() => {
      stageH = stage.clientHeight;
      apply();
    });
    ro.observe(stage);

    stageH = stage.clientHeight || window.innerHeight;
    apply();

    const off = ctx.onStateChange(s => {
      progress = (typeof s.unlockProgress === 'number') ? s.unlockProgress : 0;
      apply();
    });

    return () => {
      ro.disconnect();
      off();
    };
  },
});