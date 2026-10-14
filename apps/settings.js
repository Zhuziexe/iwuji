(() => {
  function formatBytes(n) {
    if (!n || n < 0) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function pinDotsHtml() {
    return `
      <div class="settings-pin-dots" data-pin-dots>
        <span class="settings-pin-dot"></span>
        <span class="settings-pin-dot"></span>
        <span class="settings-pin-dot"></span>
        <span class="settings-pin-dot"></span>
      </div>
    `;
  }

  function pinPadHtml() {
    return `
      <div class="settings-pin-pad" data-pin-pad>
        <button class="settings-pin-key" data-digit="1">1</button>
        <button class="settings-pin-key" data-digit="2">2</button>
        <button class="settings-pin-key" data-digit="3">3</button>
        <button class="settings-pin-key" data-digit="4">4</button>
        <button class="settings-pin-key" data-digit="5">5</button>
        <button class="settings-pin-key" data-digit="6">6</button>
        <button class="settings-pin-key" data-digit="7">7</button>
        <button class="settings-pin-key" data-digit="8">8</button>
        <button class="settings-pin-key" data-digit="9">9</button>
        <button class="settings-pin-key settings-pin-key--empty" disabled></button>
        <button class="settings-pin-key" data-digit="0">0</button>
        <button class="settings-pin-key settings-pin-key--action" data-action="backspace">⌫</button>
      </div>
    `;
  }

  function bindPinPad(root, { onComplete } = {}) {
    const padEl = root.querySelector('[data-pin-pad]');
    const dotsEl = root.querySelector('[data-pin-dots]');

    let current = '';
    let locked = false;

    function updateDots() {
      dotsEl.querySelectorAll('.settings-pin-dot').forEach((dot, i) => {
        dot.classList.toggle('is-filled', i < current.length);
      });
    }

    padEl.addEventListener('click', e => {
      const key = e.target.closest('.settings-pin-key');
      if (!key || key.disabled || locked) return;

      const digit = key.dataset.digit;
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
          try { navigator.vibrate([30, 40, 30]); } catch { }
        }
      },
      destroy() {
        window.removeEventListener('keydown', onKey);
      },
    };
  }

  function bindToggle(root, key) {
    const el = root.querySelector(`[data-toggle="${key}"]`);
    if (!el) return;

    function readState() {
      if (window.WujiControlCenter && typeof WujiControlCenter.getToggle === 'function') {
        return WujiControlCenter.getToggle(key);
      }
      return !!Store.get('control.' + key, false);
    }

    function writeState(v) {
      if (window.WujiControlCenter && typeof WujiControlCenter.setToggle === 'function') {
        WujiControlCenter.setToggle(key, v);
        return;
      }
      Store.set('control.' + key, v);
      const ccToggle = document.querySelector(`.cc-toggle[data-key="${key}"]`);
      if (ccToggle) ccToggle.classList.toggle('is-on', v);
    }

    function onCCChange(e) {
      if (!el.isConnected) {
        window.removeEventListener('wuji:cc-toggle-change', onCCChange);
        return;
      }
      if (!e.detail || e.detail.key !== key) return;
      el.classList.toggle('is-on', !!e.detail.value);
    }
    window.addEventListener('wuji:cc-toggle-change', onCCChange);

    el.classList.toggle('is-on', readState());

    el.addEventListener('click', () => {
      const next = !el.classList.contains('is-on');
      el.classList.toggle('is-on', next);
      writeState(next);
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
    });
  }

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
        touch-action: pan-y;
        padding: 18px 16px 28px;
        padding-top: calc(18px + var(--statusbar-h));
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .settings-title {
        font-size: 22px;
        font-weight: 700;
        color: var(--wj-text);
        margin-bottom: 2px;
        flex: 0 0 auto;
      }

      .settings-section {
        flex: 0 0 auto;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .settings-item {
        display: flex;
        align-items: center;
        flex-direction: row;
        justify-content: flex-start;
        flex-wrap: nowrap;
        width: 100%;
        padding: 16px 18px;
        border: 0;
        background: transparent;
        color: var(--wj-text);
        font: inherit;
        font-size: 15px;
        cursor: pointer;
        text-align: left;
        transition: background .12s;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .settings-item + .settings-item {
        border-top: 1px solid rgba(0, 0, 0, .07);
      }
      .settings-item:active {
        background: rgba(0, 0, 0, .06);
      }

      .settings-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        font-size: 15px;
        color: var(--wj-text);
        gap: 12px;
      }
      .settings-row + .settings-row {
        border-top: 1px solid rgba(0, 0, 0, .07);
      }
      .settings-row__value {
        color: var(--wj-text-dim);
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .settings-toggle {
        position: relative;
        width: 51px;
        height: 31px;
        border-radius: 15.5px;
        background: #c8c8cc;
        transition: background .25s ease;
        flex: 0 0 auto;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .settings-toggle.is-on {
        background: #34c759;
      }
      .settings-toggle::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 27px;
        height: 27px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, .2), 0 0 1px rgba(0, 0, 0, .1);
        transition: transform .25s cubic-bezier(.2, .7, .3, 1);
      }
      .settings-toggle.is-on::after {
        transform: translateX(20px);
      }

      .settings-about-card {
        flex: 0 0 auto;
        padding: 28px 18px 24px;
        border-radius: 18px;
        background: var(--wj-bg-alt);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .settings-about-card__title {
        font-size: 32px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: -.5px;
      }
      .settings-about-card__version {
        font-size: 13px;
        color: var(--wj-text-dim);
        letter-spacing: .3px;
      }
      .settings-about-card__btn {
        margin-top: 16px;
        padding: 10px 22px;
        border: 0;
        border-radius: 999px;
        background: #3a6ff0;
        color: #fff;
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        text-align: center;
        transition: opacity .2s ease, transform .08s ease;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        min-width: 128px;
      }
      .settings-about-card__btn:active:not(:disabled) { transform: scale(.97); }
      .settings-about-card__btn.is-disabled,
      .settings-about-card__btn:disabled {
        opacity: .55;
        cursor: default;
      }

      .settings-pin-page {
        position: absolute;
        inset: 0;
        padding: 0 4% 3%;
        padding-top: var(--statusbar-h);
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }

      .settings-pin-header {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        margin-top: 20px;
        margin-bottom: 14px;
      }

      .settings-pin-heading {
        font-size: 15px;
        font-weight: 600;
        color: var(--wj-text);
        text-align: center;
        min-height: 20px;
        transition: color .2s ease;
      }
      .settings-pin-heading.is-error { color: var(--wj-danger); }

      .settings-pin-dots { display: flex; gap: 18px; }
      .settings-pin-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2.5px solid var(--wj-text-dim);
        background: transparent;
        transition: background .12s, transform .12s, border-color .12s;
      }
      .settings-pin-dot.is-filled {
        background: var(--wj-text);
        border-color: var(--wj-text);
        transform: scale(1.12);
      }

      .settings-pin-pad {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        width: 100%;
        max-width: 200px;
        margin: auto auto 0;
      }
      .settings-pin-key {
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
      .settings-pin-key:active { transform: scale(.94); background: #dae2f0; }
      .settings-pin-key--empty  { visibility: hidden; pointer-events: none; }
      .settings-pin-key--action { font-size: 22px; }

      /* ============ 应用管理 ============ */
      .app-item {
        gap: 12px;
      }
      .app-item__icon {
        width: 40px;
        height: 40px;
        flex: 0 0 40px;
        border-radius: 10px;
        object-fit: cover;
        background: var(--wj-bg);
        display: block;
      }
      .app-item__info {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .app-item__name {
        font-size: 15px;
        color: var(--wj-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .app-item__version {
        font-size: 12px;
        color: var(--wj-text-dim);
      }

      .app-detail {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 10px 8px;
      }

      .app-detail__icon {
        width: 64px;
        height: 64px;
        flex: 0 0 64px;
        border-radius: 16px;
        object-fit: cover;
        background: var(--wj-bg);
        display: block;
      }

      .app-detail__info {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .app-detail__name {
        font-size: 18px;
        font-weight: 600;
        color: var(--wj-text);
        letter-spacing: .2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .app-detail__version {
        font-size: 13px;
        color: var(--wj-text-dim);
        letter-spacing: .3px;
      }

      .app-uninstall-btn {
  display: block;
  width: 100%;
  padding: 14px 20px;
  border: 0;
  border-radius: 999px;
  background: var(--wj-bg-alt, #f2f5fa);
  color: var(--wj-danger, #e0356b);
  font: inherit;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background .12s ease, opacity .15s ease;
  -webkit-tap-highlight-color: transparent;
}

.app-uninstall-btn:active:not(:disabled) {
  background: #dde3ec;
}

.app-uninstall-btn:disabled {
  opacity: .5;
  cursor: default;
}
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">设置</div>

              <div class="settings-section">
                <div class="settings-item" data-act="about">
                  <span>这台iWuji</span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-item" data-act="wlan">
                  <span>WLAN</span>
                </div>
                <div class="settings-item" data-act="bluetooth">
                  <span>蓝牙</span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-item" data-act="app-manage">
                  <span>应用管理</span>
                </div>
                <div class="settings-item" data-act="biometric">
                  <span>生物识别和密码</span>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          root.querySelector('[data-act="about"]')
            ?.addEventListener('click', () => ctx.push('about'));
          root.querySelector('[data-act="wlan"]')
            ?.addEventListener('click', () => ctx.push('wlan'));
          root.querySelector('[data-act="bluetooth"]')
            ?.addEventListener('click', () => ctx.push('bluetooth'));
          root.querySelector('[data-act="app-manage"]')
            ?.addEventListener('click', () => ctx.push('app-manage'));
          root.querySelector('[data-act="biometric"]')
            ?.addEventListener('click', () => ctx.push('biometric'));
        },
      },

      about: {
        name: 'about',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">关于本机</div>

              <div class="settings-about-card">
                <div class="settings-about-card__title">WujiOS</div>
                <div class="settings-about-card__version">1.0.104</div>
                <div class="settings-about-card__btn" id="checkUpdateBtn">检查更新</div>
              </div>

              <div class="settings-section">
                <div class="settings-row">
                  <span>设备名称</span>
                  <span class="settings-row__value">iWuji</span>
                </div>
                <div class="settings-row">
                  <span>型号</span>
                  <span class="settings-row__value">IWUJI-1</span>
                </div>
                <div class="settings-row">
                  <span>WujiOS版本</span>
                  <span class="settings-row__value">1.0.104</span>
                </div>
                <div class="settings-row">
                  <span>OpenWuji版本</span>
                  <span class="settings-row__value">1.0 Release</span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-row">
                  <span>运行内存(RAM)</span>
                  <span class="settings-row__value">4GB</span>
                </div>
                <div class="settings-row">
                  <span>机身内存(ROM)</span>
                  <span class="settings-row__value">64GB</span>
                </div>
              </div>
            </div>
          `;
        },

        mount(root) {
          const btn = root.querySelector('#checkUpdateBtn');
          if (!btn) return;

          let t1 = null, t2 = null;
          let destroyed = false;

          btn.addEventListener('click', () => {
            if (btn.classList.contains('is-disabled') || destroyed) return;

            btn.classList.add('is-disabled');
            btn.textContent = '检查更新中';

            t1 = setTimeout(() => {
              if (destroyed) return;
              btn.textContent = '已是最新版本';

              t2 = setTimeout(() => {
                if (destroyed) return;
                btn.classList.remove('is-disabled');
                btn.textContent = '检查更新';
              }, 2000);
            }, 3000);
          });

          return () => {
            destroyed = true;
            clearTimeout(t1);
            clearTimeout(t2);
          };
        },
      },

      wlan: {
        name: 'wlan',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">WLAN</div>

              <div class="settings-section">
                <div class="settings-row">
                  <span>WLAN</span>
                  <div class="settings-toggle" data-toggle="wifi" role="switch"></div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root) {
          bindToggle(root, 'wifi');
        },
      },

      bluetooth: {
        name: 'bluetooth',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">蓝牙</div>

              <div class="settings-section">
                <div class="settings-row">
                  <span>蓝牙</span>
                  <div class="settings-toggle" data-toggle="bluetooth" role="switch"></div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root) {
          bindToggle(root, 'bluetooth');
        },
      },

      'app-manage': {
        name: 'app-manage',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">应用管理</div>
              <div class="settings-section" id="appManageList"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const listEl = root.querySelector('#appManageList');

          function renderList() {
            const apps = WujiApps.all().slice().sort((a, b) => {
              const an = a.name || a.bundlename;
              const bn = b.name || b.bundlename;
              return an.localeCompare(bn, 'zh-Hans-CN');
            });
            if (!apps.length) {
              listEl.innerHTML = `
                <div class="settings-row"><span>没有应用</span></div>
              `;
              return;
            }

            listEl.innerHTML = apps.map(app => `
              <div class="settings-item app-item" data-bundle="${escapeHtml(app.bundlename)}">
                <img class="app-item__icon"
                     src="${escapeHtml(app.icon || '')}"
                     alt="">
                <div class="app-item__info">
                  <div class="app-item__name">${escapeHtml(app.name || app.bundlename)}</div>
                  <div class="app-item__version">${escapeHtml(app.version || '1.0.0')}</div>
                </div>
              </div>
            `).join('');

            listEl.querySelectorAll('.app-item').forEach(el => {
              el.addEventListener('click', () => {
                const bundle = el.dataset.bundle;
                if (!WujiApps.get(bundle)) return;
                ctx.push('app-manage-detail', { bundle });
              });
            });
          }

          renderList();

          ctx.nav.onChange(() => {
            if (ctx.nav.current?.route?.name === 'app-manage') {
              renderList();
            }
          });
        },
      },

      'app-manage-detail': {
        name: 'app-manage-detail',

        render(routeCtx) {
          const bundle = routeCtx.data?.bundle;
          const app = bundle ? WujiApps.get(bundle) : null;

          if (!app) {
            return `
              <div class="settings-page">
                <div class="settings-section">
                  <div class="settings-row"><span>应用不存在</span></div>
                </div>
              </div>
            `;
          }

          const isSystem = !WujiApps.isInstalled(app.bundlename);

          return `
            <div class="settings-page">
              <div class="app-detail">
                <img class="app-detail__icon"
                     src="${escapeHtml(app.icon || '')}"
                     alt="">
                <div class="app-detail__info">
                  <div class="app-detail__name">${escapeHtml(app.name || app.bundlename)}</div>
                  <div class="app-detail__version">${escapeHtml(app.version || '1.0.0')}</div>
                </div>
              </div>

              <button class="app-uninstall-btn"
                      id="appUninstallBtn"
                      type="button"
                      ${isSystem ? 'disabled' : ''}>
                卸载
              </button>

              <div class="settings-section">
                <div class="settings-row">
                  <span>存储</span>
                  <span class="settings-row__value" id="appStorageUsage">计算中...</span>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const bundle = ctx.data?.bundle;
          const btn = root.querySelector('#appUninstallBtn');
          const usageEl = root.querySelector('#appStorageUsage');

          if (bundle && btn && !btn.disabled) {
            let busy = false;

            btn.addEventListener('click', async () => {
              if (busy) return;
              busy = true;

              btn.textContent = '卸载中...';
              btn.disabled = true;

              try {
                await WujiAppInstaller.uninstall(bundle);
                ctx.pop();
              } catch (err) {
                console.error('[settings] 卸载失败', err);
                btn.textContent = '卸载';
                btn.disabled = false;
                busy = false;
              }
            });
          }

          if (bundle && usageEl) {
            AppStorage.for(bundle).size()
              .then(bytes => {
                if (!usageEl.isConnected) return;
                usageEl.textContent = '已使用 '+formatBytes(bytes);
              })
              .catch(err => {
                console.warn('[settings] 读取存储失败', bundle, err);
                if (usageEl.isConnected) usageEl.textContent = '—';
              });
          }
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
                <div class="settings-item" data-act="change">
                  <span>更改锁屏密码</span>
                </div>
                <div class="settings-item" data-act="remove">
                  <span>关闭锁屏密码</span>
                </div>
              `;
            } else {
              listEl.innerHTML = `
                <div class="settings-item" data-act="add">
                  <span>添加锁屏密码</span>
                </div>
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
            <div class="settings-pin-page" id="pinSetPage">
              <div class="settings-pin-header">
                <div class="settings-pin-heading" id="pinSetHeading">设置锁屏密码</div>
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
            if (stage === 'verify') headingEl.textContent = '输入当前密码';
            if (stage === 'new') headingEl.textContent = requireOld ? '输入新密码' : '设置锁屏密码';
            if (stage === 'confirm') headingEl.textContent = '再次输入以确认';
            headingEl.classList.remove('is-error');
          }

          function showError(text, onDone) {
            headingEl.textContent = text;
            headingEl.classList.add('is-error');
            if (navigator.vibrate) {
              try { navigator.vibrate([30, 40, 30]); } catch { }
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
            <div class="settings-pin-page" id="pinVerifyPage">
              <div class="settings-pin-header">
                <div class="settings-pin-heading" id="pinVerifyHeading">输入当前密码</div>
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
              try { navigator.vibrate([30, 40, 30]); } catch { }
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