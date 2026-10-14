(() => {
  const BUNDLE = 'com.wujinb.mood';

  const MOODS = [
    { emoji: '😊', text: '今天心情不错' },
    { emoji: '😄', text: '开心到飞起' },
    { emoji: '😎', text: '酷毙了' },
    { emoji: '🥰', text: '被爱包围' },
    { emoji: '🤔', text: '陷入沉思' },
    { emoji: '😴', text: '困得不行' },
    { emoji: '😭', text: '想哭' },
    { emoji: '😤', text: '气鼓鼓' },
    { emoji: '🥺', text: '有点委屈' },
    { emoji: '😱', text: '吓死宝宝了' },
    { emoji: '🤯', text: '脑子爆炸' },
    { emoji: '🤩', text: '眼冒星星' },
    { emoji: '😋', text: '想吃好吃的' },
    { emoji: '🤗', text: '想抱抱' },
    { emoji: '🙃', text: '假装淡定' },
    { emoji: '😇', text: '圣光普照' },
    { emoji: '🤪', text: '疯疯癫癫' },
    { emoji: '😌', text: '岁月静好' },
    { emoji: '🫠', text: '整个人融化了' },
    { emoji: '😏', text: '嘿嘿嘿' },
    { emoji: '🤤', text: '馋了' },
    { emoji: '🥳', text: '想开派对' },
  ];

  function pickRandom(prev) {
    if (MOODS.length <= 1) return MOODS[0];
    let next;
    do {
      next = MOODS[Math.floor(Math.random() * MOODS.length)];
    } while (next === prev);
    return next;
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际心情',
    icon: './assets/mood.svg',
    initialRoute: 'home',

    styles: `
      .mood-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #ffffff;
        padding: calc(var(--wj-pad) + var(--statusbar-h)) 20px 24px;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
      }

      .mood-title {
        flex: 0 0 auto;
        font-size: 22px;
        font-weight: 700;
        color: #000000;
        letter-spacing: .5px;
        margin-top: 6px;
      }

      .mood-stage {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 30px;
        width: 100%;
        min-height: 0;
      }

      .mood-emoji {
        width: min(60vw, 220px);
        height: min(60vw, 220px);
        border: 0;
        border-radius: 50%;
        background: #ffffff;
        box-shadow:
          0 12px 40px rgba(0, 0, 0, .12),
          0 2px 8px rgba(0, 0, 0, .06),
          inset 0 -6px 0 rgba(0, 0, 0, .04);
        font-size: min(38vw, 140px);
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transform: scale(1);
        transition: box-shadow .3s ease;
        -webkit-tap-highlight-color: transparent;
      }

      .mood-emoji:active {
        box-shadow:
          0 6px 20px rgba(0, 0, 0, .16),
          inset 0 -3px 0 rgba(0, 0, 0, .06);
      }

      .mood-emoji.is-shaking {
        animation: moodShake .42s cubic-bezier(.36,.07,.19,.97) both;
      }

      @keyframes moodShake {
        0%   { transform: scale(1)    rotate(0deg); }
        15%  { transform: scale(1.10) rotate(-9deg); }
        30%  { transform: scale(1.16) rotate(9deg); }
        45%  { transform: scale(1.12) rotate(-7deg); }
        60%  { transform: scale(1.14) rotate(7deg); }
        75%  { transform: scale(1.06) rotate(-4deg); }
        100% { transform: scale(1)    rotate(0deg); }
      }

      .mood-text {
        font-size: 20px;
        font-weight: 600;
        color: #000000;
        letter-spacing: 1px;
        text-align: center;
        min-height: 28px;
        transition: opacity .18s ease;
      }

      .mood-hint {
        flex: 0 0 auto;
        font-size: 12px;
        color: #888888;
        letter-spacing: .5px;
        padding-bottom: 8px;
        user-select: none;
        -webkit-user-select: none;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          const first = MOODS[Math.floor(Math.random() * MOODS.length)];
          return `
            <div class="mood-page">
              <div class="wj-title">吴际心情</div>
              <div class="mood-stage">
                <button class="mood-emoji" id="moodEmoji" type="button">${first.emoji}</button>
                <div class="mood-text" id="moodText">${first.text}</div>
              </div>
              <div class="mood-hint">点一下试试</div>
            </div>
          `;
        },

        mount(root) {
          const btn = root.querySelector('#moodEmoji');
          const textEl = root.querySelector('#moodText');
          if (!btn || !textEl) return;

          let current = { emoji: btn.textContent, text: textEl.textContent };
          let animating = false;

          btn.addEventListener('click', () => {
            if (animating) return;
            animating = true;

            const next = pickRandom(current);
            current = next;

            btn.textContent = next.emoji;
            textEl.textContent = next.text;

            /* 重启动画 */
            btn.classList.remove('is-shaking');
            void btn.offsetWidth;
            btn.classList.add('is-shaking');

            /* 设备震动 */
            if (navigator.vibrate) {
              try { navigator.vibrate(15); } catch { }
            }

            setTimeout(() => {
              animating = false;
              btn.classList.remove('is-shaking');
            }, 440);
          });
        },
      },
    },
  });
})();