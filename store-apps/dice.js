(() => {
  const BUNDLE = 'com.wujinb.dice';
  const MIN = 1;
  const MAX = 6;

  const randomFace = () =>
    MIN + Math.floor(Math.random() * (MAX - MIN + 1));

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '骰子',
    icon: './assets/dice.svg',
    initialRoute: 'home',
    version: '1.0.1',

    styles: `
      .dice-page {
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

      .dice-title {
        flex: 0 0 auto;
        align-self: flex-start;
        font-size: 22px;
        font-weight: 700;
        color: #000000;
        letter-spacing: .5px;
        margin-top: 6px;
      }

      .dice-stage {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 26px;
        width: 100%;
        min-height: 0;
      }

      .dice-face {
        width: min(60vw, 220px);
        height: min(60vw, 220px);
        border: 0;
        border-radius: 28%;
        background: #ffffff;
        box-shadow:
          0 12px 40px rgba(0, 0, 0, .12),
          0 2px 8px rgba(0, 0, 0, .06),
          inset 0 -6px 0 rgba(0, 0, 0, .04);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: box-shadow .3s ease;
        -webkit-tap-highlight-color: transparent;
        overflow: hidden;
      }

      .dice-face:active {
        box-shadow:
          0 6px 20px rgba(0, 0, 0, .16),
          inset 0 -3px 0 rgba(0, 0, 0, .06);
      }

      .dice-face__emoji {
        display: inline-block;
        font-size: min(38vw, 140px);
        line-height: 1;
        will-change: transform;
      }

      .dice-face__emoji.is-rolling {
        animation: diceSpin .6s linear infinite;
      }

      @keyframes diceSpin {
        0%   { transform: rotate(0deg)   scale(1);    }
        25%  { transform: rotate(90deg)  scale(1.08); }
        50%  { transform: rotate(180deg) scale(0.94); }
        75%  { transform: rotate(270deg) scale(1.08); }
        100% { transform: rotate(360deg) scale(1);    }
      }

      .dice-value {
        font-size: 72px;
        font-weight: 800;
        color: #000000;
        letter-spacing: -1px;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        min-height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform .22s cubic-bezier(.2,.7,.3,1), color .22s ease;
      }
      .dice-value.is-reveal {
        transform: scale(1.22);
        color: #ff9500;
      }

      .dice-hint {
        flex: 0 0 auto;
        font-size: 12px;
        color: #888888;
        letter-spacing: .5px;
        padding-bottom: 8px;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="dice-page">
              <div class="dice-title">骰子</div>
              <div class="dice-stage">
                <button class="dice-face" id="diceFace" type="button">
                  <span class="dice-face__emoji" id="diceEmoji">🎲</span>
                </button>
                <div class="dice-value" id="diceValue">-</div>
              </div>
              <div class="dice-hint">点一下骰子</div>
            </div>
          `;
        },

        mount(root) {
          const faceEl  = root.querySelector('#diceFace');
          const emojiEl = root.querySelector('#diceEmoji');
          const valueEl = root.querySelector('#diceValue');
          if (!faceEl || !emojiEl || !valueEl) return;

          let rolling     = false;
          let ticker      = null;
          let endTimer    = null;
          let revealTimer = null;

          function roll() {
            if (rolling) return;
            rolling = true;

            if (navigator.vibrate) {
              try { navigator.vibrate(20); } catch {}
            }

            emojiEl.classList.remove('is-rolling');
            void emojiEl.offsetWidth;
            emojiEl.classList.add('is-rolling');

            valueEl.classList.remove('is-reveal');

            ticker = setInterval(() => {
              valueEl.textContent = String(randomFace());
            }, 60);

            endTimer = setTimeout(() => {
              clearInterval(ticker);
              ticker = null;

              const result = randomFace();
              valueEl.textContent = String(result);

              valueEl.classList.add('is-reveal');
              revealTimer = setTimeout(() => {
                valueEl.classList.remove('is-reveal');
                revealTimer = null;
              }, 260);

              emojiEl.classList.remove('is-rolling');
              rolling = false;
            }, 900);
          }

          function onClick() {
            roll();
          }

          faceEl.addEventListener('click', onClick);

          return () => {
            faceEl.removeEventListener('click', onClick);
            if (ticker)      { clearInterval(ticker);    ticker = null; }
            if (endTimer)    { clearTimeout(endTimer);   endTimer = null; }
            if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
          };
        },
      },
    },
  });
})();