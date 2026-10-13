(() => {
  function pinDotsHtml() {
    return `
      <div class="pin-dots" data-pin-dots>
        <span class="pin-dot"></span>
        <span class="pin-dot"></span>
        <span class="pin-dot"></span>
        <span class="pin-dot"></span>
      </div>
    `;
  }

  function pinPadHtml() {
    return `
      <div class="pin-pad" data-pin-pad>
        <button class="pin-key" data-digit="1">1</button>
        <button class="pin-key" data-digit="2">2</button>
        <button class="pin-key" data-digit="3">3</button>
        <button class="pin-key" data-digit="4">4</button>
        <button class="pin-key" data-digit="5">5</button>
        <button class="pin-key" data-digit="6">6</button>
        <button class="pin-key" data-digit="7">7</button>
        <button class="pin-key" data-digit="8">8</button>
        <button class="pin-key" data-digit="9">9</button>
        <button class="pin-key pin-key--empty" disabled></button>
        <button class="pin-key" data-digit="0">0</button>
        <button class="pin-key pin-key--action" data-action="backspace">⌫</button>
      </div>
    `;
  }

  /**
   * 绑定 PIN 输入逻辑
   * @param {HTMLElement} root
   * @param {Object} opts
   * @param {Function} opts.onComplete - (pin) => void  输入满 4 位时回调
   * @returns {Object} { clear, destroy, shake }
   */
  function bindPinPad(root, { onComplete } = {}) {
    const padEl  = root.querySelector('[data-pin-pad]');
    const dotsEl = root.querySelector('[data-pin-dots]');

    let current = '';
    let locked = false;

    function updateDots() {
      dotsEl.querySelectorAll('.pin-dot').forEach((dot, i) => {
        dot.classList.toggle('is-filled', i < current.length);
      });
    }

    padEl.addEventListener('click', e => {
      const key = e.target.closest('.pin-key');
      if (!key || key.disabled || locked) return;

      const digit  = key.dataset.digit;
      const action = key.dataset.action;

      if (action === 'backspace') {
        current = current.slice(0, -1);
        updateDots();
        return;
      }

      if (digit && current.length < 4) {
        current += digit;
        updateDots();

        if (current.length === 4) {
          locked = true;
          const pin = current;
          setTimeout(() => onComplete?.(pin), 160);
        }
      }
    });

    /* 键盘辅助：桌面调试时可物理键盘输入 */
    const onKey = e => {
      if (!root.isConnected || locked) return;

      if (/^\d$/.test(e.key) && current.length < 4) {
        current += e.key;
        updateDots();
        if (current.length === 4) {
          locked = true;
          const pin = current;
          setTimeout(() => onComplete?.(pin), 160);
        }
      } else if (e.key === 'Backspace') {
        current = current.slice(0, -1);
        updateDots();
      }
    };
    window.addEventListener('keydown', onKey);

    return {
      clear() {
        current = '';
        locked = false;
        updateDots();
      },
      shake() {
        if (navigator.vibrate) {
          try { navigator.vibrate([30, 40, 30]); } catch {}
        }
      },
      destroy() {
        window.removeEventListener('keydown', onKey);
      },
    };
  }

  /* =========================================================
     注册应用
     ========================================================= */
  WujiApps.register({
    bundlename: 'com.wujios.settings',
    name: '设置',
    icon: './assets/settings.svg',
    initialRoute: 'home',

    styles: `
      .settings-page {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 18px 16px 24px;
        padding-top: calc(18px + var(--statusbar-h));
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .settings-title {
        font-size: 22px;
        font-weight: 700;
        color: var(--wj-text);
        margin-bottom: 6px;
      }
      .settings-subtitle {
        font-size: 12px;
        color: var(--wj-text-dim);
        letter-spacing: .5px;
        margin-bottom: 6px;
      }

      .settings-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .settings-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 16px 18px;
        border: 0;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 15px;
        cursor: pointer;
        text-align: left;
        transition: background .12s, transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .settings-item:active { transform: scale(.985); background: #dae2f0; }
      .settings-item__arrow {
        color: var(--wj-text-dim);
        font-size: 20px;
        font-weight: 300;
        line-height: 1;
      }
      .settings-item--danger {
        color: var(--wj-danger);
        background: var(--wj-danger-bg);
      }
      .settings-item--danger:active { background: #ffd0d8; }

      .settings-info {
        display: flex;
        justify-content: space-between;
        padding: 14px 18px;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        font-size: 14px;
        color: var(--wj-text-muted);
      }
      .settings-info strong {
        color: var(--wj-text);
        font-weight: 600;
      }

      .pin-page {
        position: absolute;
        inset: 0;
        padding: 0 4% 3%;
        padding-top: var(--statusbar-h);
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }

      .pin-header {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        margin-top: 20px;
        margin-bottom: 14px;
      }

      .pin-heading {
        font-size: 15px;
        font-weight: 600;
        color: var(--wj-text);
        text-align: center;
        min-height: 20px;
        transition: color .2s ease;
      }
      .pin-heading.is-error {
        color: var(--wj-danger);
      }

      .pin-dots {
        display: flex;
        gap: 18px;
      }
      .pin-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2.5px solid var(--wj-text-dim);
        background: transparent;
        transition: background .12s, transform .12s, border-color .12s;
      }
      .pin-dot.is-filled {
        background: var(--wj-text);
        border-color: var(--wj-text);
        transform: scale(1.12);
      }

      /* 键盘放大：200px 宽，每格 ~61px */
      .pin-pad {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        width: 100%;
        max-width: 200px;
        margin: auto auto 0;
      }
      .pin-key {
        aspect-ratio: 1;
        width: 100%;
        border: 0;
        border-radius: 50%;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 24px;
        font-weight: 400;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .12s, transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .pin-key:active { transform: scale(.94); background: #dae2f0; }
      .pin-key--empty  { visibility: hidden; pointer-events: none; }
      .pin-key--action { font-size: 22px; }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">设置</div>

              <div class="settings-section">
                <div class="settings-info">
                  <span>存储模式</span><strong>${Store.isMemoryOnly ? '无法存储' : '正常'}</strong>
                </div>
              </div>

              <div class="settings-section" style="margin-top:8px">
                <button class="settings-item" data-act="biometric" type="button">
                  <span>生物识别和密码</span>
                  <span class="settings-item__arrow">›</span>
                </button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          root.querySelector('[data-act="biometric"]')
            ?.addEventListener('click', () => ctx.push('biometric'));
        },
      },

      biometric: {
        name: 'biometric',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">生物识别和密码</div>
              <div class="settings-section" id="bioList"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const listEl = root.querySelector('#bioList');

          function renderList() {
            const hasPwd = !!Store.get('lock.password', '');

            if (hasPwd) {
              listEl.innerHTML = `
                <button class="settings-item" data-act="change" type="button">
                  <span>更改锁屏密码</span>
                  <span class="settings-item__arrow">›</span>
                </button>
                <button class="settings-item" data-act="remove" type="button">
                  <span>关闭锁屏密码</span>
                  <span class="settings-item__arrow">›</span>
                </button>
              `;
            } else {
              listEl.innerHTML = `
                <button class="settings-item" data-act="add" type="button">
                  <span>添加锁屏密码</span>
                  <span class="settings-item__arrow">›</span>
                </button>
              `;
            }

            listEl.querySelectorAll('.settings-item').forEach(el => {
              el.addEventListener('click', () => {
                const act = el.dataset.act;
                if (act === 'add') {
                  ctx.push('pin-set', { requireOld: false });
                } else if (act === 'change') {
                  ctx.push('pin-set', { requireOld: true });
                } else if (act === 'remove') {
                  ctx.push('pin-verify');
                }
              });
            });
          }

          renderList();

          ctx.nav.onChange(() => {
            if (ctx.nav.current?.route?.name === 'biometric') {
              renderList();
            }
          });
        },
      },

      'pin-set': {
        name: 'pin-set',

        render() {
          return `
            <div class="pin-page" id="pinSetPage">
              <div class="pin-header">
                <div class="pin-heading" id="pinSetHeading">设置锁屏密码</div>
                ${pinDotsHtml()}
              </div>
              ${pinPadHtml()}
            </div>
          `;
        },

        mount(root, ctx) {
          const headingEl = root.querySelector('#pinSetHeading');

          const requireOld = !!ctx.data?.requireOld;

          let stage = requireOld ? 'verify' : 'new';
          let newPin = '';

          function setHeading() {
            if (stage === 'verify')  headingEl.textContent = '输入当前密码';
            if (stage === 'new')     headingEl.textContent = requireOld ? '输入新密码' : '设置锁屏密码';
            if (stage === 'confirm') headingEl.textContent = '再次输入以确认';
            headingEl.classList.remove('is-error');
          }

          function showError(text, onDone) {
            headingEl.textContent = text;
            headingEl.classList.add('is-error');
            if (navigator.vibrate) {
              try { navigator.vibrate([30, 40, 30]); } catch {}
            }
            setTimeout(() => {
              headingEl.classList.remove('is-error');
              setHeading();
              onDone?.();
            }, 900);
          }

          setHeading();

          const pad = bindPinPad(root, {
            onComplete(pin) {
              if (stage === 'verify') {
                const stored = Store.get('lock.password', '');
                if (pin === stored) {
                  stage = 'new';
                  setHeading();
                  pad.clear();
                } else {
                  showError('密码错误', () => pad.clear());
                }
                return;
              }

              if (stage === 'new') {
                newPin = pin;
                stage = 'confirm';
                setHeading();
                pad.clear();
                return;
              }

              if (stage === 'confirm') {
                if (pin === newPin) {
                  Store.set('lock.password', newPin);
                  ctx.pop();
                } else {
                  stage = 'new';
                  newPin = '';
                  showError('两次不一致', () => pad.clear());
                }
              }
            },
          });

          const unbind = () => pad.destroy?.();
          ctx.nav.onChange(() => {
            if (ctx.nav.current?.route?.name !== 'pin-set') unbind();
          });
        },
      },

      'pin-verify': {
        name: 'pin-verify',

        render() {
          return `
            <div class="pin-page" id="pinVerifyPage">
              <div class="pin-header">
                <div class="pin-heading" id="pinVerifyHeading">输入当前密码</div>
                ${pinDotsHtml()}
              </div>
              ${pinPadHtml()}
            </div>
          `;
        },

        mount(root, ctx) {
          const headingEl = root.querySelector('#pinVerifyHeading');

          function showError(text, onDone) {
            headingEl.textContent = text;
            headingEl.classList.add('is-error');
            if (navigator.vibrate) {
              try { navigator.vibrate([30, 40, 30]); } catch {}
            }
            setTimeout(() => {
              headingEl.classList.remove('is-error');
              headingEl.textContent = '输入当前密码';
              onDone?.();
            }, 900);
          }

          const pad = bindPinPad(root, {
            onComplete(pin) {
              const stored = Store.get('lock.password', '');
              if (pin === stored) {
                Store.set('lock.password', '');
                ctx.pop();
              } else {
                showError('密码错误', () => pad.clear());
              }
            },
          });

          const unbind = () => pad.destroy?.();
          ctx.nav.onChange(() => {
            if (ctx.nav.current?.route?.name !== 'pin-verify') unbind();
          });
        },
      },
    },
  });
})();