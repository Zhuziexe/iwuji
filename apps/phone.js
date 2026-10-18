(() => {
  const BUNDLE = 'com.wujios.phone';
  const pad2 = n => String(n).padStart(2, '0');

  const Call = (() => {
    let number = '';
    let status = 'idle';       // idle | dialing | active
    let callStart = 0;

    return {
      getNumber: () => number,
      getStatus: () => status,
      getCallStart: () => callStart,

      start(num) {
        number = num;
        status = 'dialing';
        callStart = 0;
      },
      connect() {
        if (status !== 'dialing') return;
        status = 'active';
        callStart = Date.now();
      },
      end() {
        number = '';
        status = 'idle';
        callStart = 0;
      },
    };
  })();

  WujiApps.register({
    bundlename: BUNDLE,
    name: '电话',
    icon: './assets/phone.svg',
    initialRoute: 'dialer',
    version: '1.0.2',
    styles: `
      .phone-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg, #fff);
        padding-top: var(--statusbar-h, 26px);
        overflow: hidden;
        box-sizing: border-box;
        user-select: none;
        -webkit-user-select: none;

        --key-size: min(72px, 18vw, 15vh);
      }

.phone-display {
  flex: 0 0 auto;
  padding: 12px 24px 4px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
}
.phone-display::-webkit-scrollbar { display: none; }

.phone-number {
  display: block;
  width: max-content;
  min-width: 100%;
  box-sizing: border-box;
  text-align: center;
  white-space: nowrap;
  word-break: normal;
  max-width: none;

  font-size: 30px;
  font-weight: 600;
  color: var(--wj-text, #101828);
  letter-spacing: 1.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  min-height: 38px;
}
.phone-number:empty::before {
  content: '输入号码';
  color: var(--wj-text-dim, #9aa4b8);
  font-weight: 400;
  letter-spacing: .5px;
}
      .phone-pad {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        max-width: 340px;
        margin: 0 auto;
        padding: 0 20px;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-template-rows: repeat(4, minmax(0, 1fr));
        gap: 6px;
        place-items: center;
        overflow: hidden;
      }

      .phone-key {
        width: var(--key-size);
        height: var(--key-size);
        border: 0;
        border-radius: 50%;
        background: var(--wj-bg-alt, #eef1f6);
        color: var(--wj-text, #101828);
        font: inherit;
        font-size: clamp(20px, 5.6vw, 28px);
        font-weight: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding: 0;
        cursor: pointer;
        line-height: 1;
        transition: transform .08s ease, background .12s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .phone-key:active { transform: scale(.93); background: #dce3ef; }

      .phone-key__sub {
        font-size: clamp(7px, 2.4vw, 9px);
        font-weight: 700;
        letter-spacing: 1.2px;
        color: var(--wj-text-dim, #9aa4b8);
        margin-top: 1px;
        line-height: 1;
      }

      .phone-actions {
        flex: 0 0 auto;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px 24px calc(16px + env(safe-area-inset-bottom, 0px));
      }

      .phone-dial-btn {
        width: clamp(56px, 18vw, 68px);
        height: clamp(56px, 18vw, 68px);
        border-radius: 50%;
        border: 0;
        background: #34c759;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(52, 199, 89, .35);
        transition: transform .08s ease, filter .12s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .phone-dial-btn:active { transform: scale(.93); filter: brightness(.9); }
      .phone-dial-btn svg { width: 55%; height: 55%; display: block; }

      .phone-back-btn {
        position: absolute;
        right: 24px;
        top: 50%;
        transform: translateY(-50%);
        width: 52px;
        height: 52px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        color: var(--wj-text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transition: opacity .15s ease, transform .08s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .phone-back-btn.is-visible { opacity: 1; pointer-events: auto; }
      .phone-back-btn:active { transform: translateY(-50%) scale(.9); }
      .phone-back-btn svg { width: 24px; height: 24px; display: block; }

      .ov-call {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: calc(80px + var(--statusbar-h, 26px)) 30px
                 calc(48px + env(safe-area-inset-bottom, 0px));
        background: rgba(12, 18, 36, .78);
        backdrop-filter: blur(26px) saturate(150%);
        -webkit-backdrop-filter: blur(26px) saturate(150%);
        color: #fff;
        text-align: center;
        box-sizing: border-box;
        user-select: none;
        -webkit-user-select: none;
      }

      .ov-call__info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        width: 100%;
        min-width: 0;
      }

      .ov-call__number {
        font-size: 32px;
        font-weight: 600;
        letter-spacing: 2px;
        color: #fff;
        text-shadow: 0 2px 12px rgba(0, 0, 0, .35);
        font-variant-numeric: tabular-nums;
        word-break: break-all;
        max-width: 100%;
      }

      .ov-call__status {
        font-size: 17px;
        font-weight: 400;
        color: rgba(255, 255, 255, .72);
        letter-spacing: 2px;
        transition: font-size .2s ease, color .2s ease;
        min-height: 24px;
      }
      .ov-call__status.is-active {
        font-family: 'Consolas', 'SF Mono', monospace;
        font-size: 22px;
        font-weight: 600;
        color: #fff;
        font-variant-numeric: tabular-nums;
        letter-spacing: 1.5px;
      }

      .ov-call__hangup {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 0;
  background: #ff3b30;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(255, 59, 48, .45);
  transition: transform .08s ease, filter .12s ease;
  -webkit-tap-highlight-color: transparent;

  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}
      .ov-call__hangup:active { transform: scale(.92); filter: brightness(.9); }
      .ov-call__hangup svg { width: 34px; height: 34px; display: block; }
    `,

    overlays: [
      {
        name: 'calling',

        render() {
          const number = Call.getNumber() || '';
          return `
            <div class="ov-call">
              <div class="ov-call__info">
                <div class="ov-call__number">${number}</div>
                <div class="ov-call__status" id="ovCallStatus">正在拨号…</div>
              </div>

              <button class="ov-call__hangup" id="ovHangup" type="button" aria-label="挂断">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
              </button>
            </div>
          `;
        },

        mount(root) {
          const statusEl = root.querySelector('#ovCallStatus');
          const hangupBtn = root.querySelector('#ovHangup');

          if (navigator.vibrate) { try { navigator.vibrate(20); } catch { } }

          let tickTimer = null;

          const delay = 4000 + Math.random() * 4000;
          const connectTimer = setTimeout(() => {
            Call.connect();

            if (statusEl && statusEl.isConnected) {
              statusEl.textContent = '00:00';
              statusEl.classList.add('is-active');
            }

            tickTimer = setInterval(() => {
              if (!statusEl || !statusEl.isConnected) return;
              const sec = Math.floor((Date.now() - Call.getCallStart()) / 1000);
              statusEl.textContent =
                `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
            }, 250);
          }, delay);

          hangupBtn.addEventListener('pointerup', e => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation();

            if (navigator.vibrate) { try { navigator.vibrate(15); } catch { } }

            Call.end();
            WujiOverlay.close();
          });

          this._cleanup = () => {
            clearTimeout(connectTimer);
            if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
          };
        },

        unmount() {
          this._cleanup?.();
          this._cleanup = null;
          Call.end();
        },
      },
    ],

    routes: {
      dialer: {
        name: 'dialer',

        render() {
          return `
            <div class="phone-page">
              <div class="phone-display">
                <div class="phone-number" id="phoneNumber"></div>
              </div>

              <div class="phone-pad">
                <button class="phone-key" data-digit="1" type="button">1</button>
                <button class="phone-key" data-digit="2" type="button">2<span class="phone-key__sub">ABC</span></button>
                <button class="phone-key" data-digit="3" type="button">3<span class="phone-key__sub">DEF</span></button>
                <button class="phone-key" data-digit="4" type="button">4<span class="phone-key__sub">GHI</span></button>
                <button class="phone-key" data-digit="5" type="button">5<span class="phone-key__sub">JKL</span></button>
                <button class="phone-key" data-digit="6" type="button">6<span class="phone-key__sub">MNO</span></button>
                <button class="phone-key" data-digit="7" type="button">7<span class="phone-key__sub">PQRS</span></button>
                <button class="phone-key" data-digit="8" type="button">8<span class="phone-key__sub">TUV</span></button>
                <button class="phone-key" data-digit="9" type="button">9<span class="phone-key__sub">WXYZ</span></button>
                <button class="phone-key" data-digit="*" type="button">*</button>
                <button class="phone-key" data-digit="0" type="button">0<span class="phone-key__sub">+</span></button>
                <button class="phone-key" data-digit="#" type="button">#</button>
              </div>

              <div class="phone-actions">
                <button class="phone-back-btn" id="phoneBack" type="button" aria-label="删除">
                  <svg viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/>
                    <path d="M15 9l-5 6"/>
                    <path d="M10 9l5 6"/>
                  </svg>
                </button>

                <button class="phone-dial-btn" id="phoneDial" type="button" aria-label="拨号">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02z"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
        },

        mount(root) {
          const numberEl = root.querySelector('#phoneNumber');
          const backBtn = root.querySelector('#phoneBack');
          const dialBtn = root.querySelector('#phoneDial');
          const padEl = root.querySelector('.phone-pad');

          let number = '';

          function updateNumber() {
            numberEl.textContent = number;
            backBtn.classList.toggle('is-visible', number.length > 0);

            requestAnimationFrame(() => {
              const display = numberEl.parentElement;
              const max = display.scrollWidth - display.clientWidth;
              display.scrollLeft = max > 0 ? max : 0;
            });
          }

          function appendDigit(d) {
            if (!d) return;
            if (number.length >= 20) return;
            number += d;
            updateNumber();
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
          }

          function backspace() {
            if (!number) return;
            number = number.slice(0, -1);
            updateNumber();
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
          }

          function onPadClick(e) {
            const key = e.target.closest('.phone-key');
            if (!key) return;
            appendDigit(key.dataset.digit);
          }

          function onDial() {
            if (!number) return;
            if (navigator.vibrate) { try { navigator.vibrate(20); } catch { } }

            Call.start(number);
            WujiOverlay.open({ bundlename: BUNDLE, name: 'calling' });
          }

          function onKeydown(e) {
            if (!root.isConnected) return;
            if (Call.getStatus() !== 'idle') return;

            if (/^[0-9*#]$/.test(e.key)) {
              appendDigit(e.key);
              e.preventDefault();
            } else if (e.key === 'Backspace') {
              backspace();
              e.preventDefault();
            } else if (e.key === 'Enter') {
              onDial();
              e.preventDefault();
            }
          }

          padEl.addEventListener('click', onPadClick);
          backBtn.addEventListener('click', backspace);
          dialBtn.addEventListener('click', onDial);
          window.addEventListener('keydown', onKeydown);

          updateNumber();

          return () => {
            padEl.removeEventListener('click', onPadClick);
            backBtn.removeEventListener('click', backspace);
            dialBtn.removeEventListener('click', onDial);
            window.removeEventListener('keydown', onKeydown);
          };
        },
      },
    },
  });
})();