(() => {
  const ICON = {
    wifi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
    bluetooth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11"/></svg>`,
    cellular: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h.01"/><path d="M7 22v-4"/><path d="M12 22V12"/><path d="M17 22V6"/><path d="M22 22V2"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/></svg>`,
    key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="M18 5l2 2"/><path d="M15 8l2 2"/></svg>`,
    storage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="2.6"/><path d="M4 6v5c0 1.44 3.58 2.6 8 2.6s8-1.16 8-2.6V6"/><path d="M4 12v5c0 1.44 3.58 2.6 8 2.6s8-1.16 8-2.6v-5"/></svg>`,
    /* ★ 桌面和个性化：红色圆形底 + 白色刷子 */
    paint: `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <circle cx="128" cy="128" r="128" fill="#ff375f"/>
      <rect x="112" y="32" width="32" height="96" rx="10" fill="#FFFFFF"/>
      <rect x="94"  y="128" width="68" height="18" rx="4"  fill="#FFFFFF"/>
      <rect x="44"  y="146" width="168" height="80" rx="10" fill="#FFFFFF"/>
      <line x1="44" y1="146" x2="212" y2="146" stroke="#ff375f" stroke-opacity="0.25" stroke-width="2"/>
    </svg>`,
  };

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
    version: '1.0.8',
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
        gap: 12px;
        width: 100%;
        padding: 8px 14px;
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

      /* ---------- 设置项圆形图标 ---------- */
      .settings-item__icon {
        width: 36px;
        height: 36px;
        flex: 0 0 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        overflow: hidden;
        box-sizing: border-box;
      }
      .settings-item__icon svg {
        width: 21px;
        height: 21px;
        display: block;
      }
      .settings-item__icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        background: #ccc;
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

      /* ============ 存储页 ============ */
      .storage-card {
        padding: 20px 18px 16px;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .storage-percent {
        font-size: 34px;
        font-weight: 700;
        color: var(--wj-text);
        line-height: 1;
        letter-spacing: -.5px;
      }

      .storage-bar {
        height: 10px;
        border-radius: 5px;
        background: rgba(0, 0, 0, .08);
        overflow: hidden;
      }

      .storage-bar__fill {
        height: 100%;
        width: 0;
        border-radius: 5px;
        background: #5856d6;
        transition: width .5s cubic-bezier(.2, .7, .3, 1);
      }

      .storage-legend {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--wj-text-dim);
        letter-spacing: .2px;
      }

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

      /* ===== 主题网格 ===== */
      .theme-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .theme-card {
        display: flex; flex-direction: column; gap: 6px;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        transition: transform .1s;
      }
      .theme-card:active { transform: scale(.96); }
      .theme-card__thumb {
        width: 100%; aspect-ratio: 3 / 4; border-radius: 12px; overflow: hidden;
        background: var(--wj-bg-alt); box-shadow: 0 2px 8px rgba(0,0,0,.08);
      }
      .theme-card__thumb img {
        width: 100%; height: 100%; object-fit: cover; display: block;
        pointer-events: none; -webkit-user-drag: none;
      }
      .theme-card__name {
        font-size: 12px; color: var(--wj-text); text-align: center;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .theme-end { text-align: center; font-size: 12px; color: var(--wj-text-dim); padding: 6px 0 2px; }

      .theme-goto-market {
        margin-top: 8px;
        padding: 14px 20px;
        border: 0;
        border-radius: 999px;
        background: #3a6ff0;
        color: #fff;
        font: inherit;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .08s;
      }
      .theme-goto-market:active { transform: scale(.98); }

      /* ===== 长按菜单 ===== */
      .theme-menu {
        position: absolute;
        z-index: 999;
        background: rgba(255,255,255,.92);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0,0,0,.18);
        padding: 4px;
        animation: themeMenuIn .14s cubic-bezier(.2,.7,.3,1);
      }
      @keyframes themeMenuIn {
        from { opacity: 0; transform: scale(.92); }
        to   { opacity: 1; transform: scale(1); }
      }
      .theme-menu__item {
        padding: 10px 14px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #e0356b;
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        -webkit-tap-highlight-color: transparent;
      }
      .theme-menu__item:active { background: rgba(224,53,107,.1); }

      /* ===== 主题详情页 ===== */
      .theme-detail { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--wj-bg); }
      .theme-detail__scroll {
        flex: 1 1 auto; min-height: 0; overflow-y: auto;
        -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
        padding-top: var(--statusbar-h); padding-bottom: 16px;
      }
      .theme-detail__name {
        font-size: 22px; font-weight: 700; color: var(--wj-text);
        padding: 22px 20px 8px;
      }
      .theme-detail__hero {
        margin: 8px 20px 0; border-radius: 16px; overflow: hidden;
        background: var(--wj-bg-alt); box-shadow: 0 4px 20px rgba(0,0,0,.1);
      }
      .theme-detail__hero img { width: 100%; display: block; pointer-events: none; }
      .theme-detail__footer {
        flex: 0 0 auto; padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
        border-top: .5px solid var(--wj-border); background: var(--wj-bg);
      }
      .theme-btn {
        position: relative; display: block; width: 100%; height: 48px;
        border: 0; border-radius: 999px;
        background: #3a6ff0; color: #fff;
        font: inherit; font-size: 16px; font-weight: 600;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        transition: transform .1s, background .2s;
      }
      .theme-btn:active:not(:disabled) { transform: scale(.98); }
      .theme-btn:disabled { background: var(--wj-bg-alt); color: var(--wj-text-muted); }
      .theme-btn__label {
        display: flex; align-items: center; justify-content: center; height: 100%;
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
                  <div class="settings-item__icon">
                    <img src="./assets/com.wujios.settings/iwuji.png" alt="">
                  </div>
                  <span>这台iWuji</span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-item" data-act="wlan">
                  <div class="settings-item__icon" style="background:#3a6ff0">${ICON.wifi}</div>
                  <span>WLAN</span>
                </div>
                <div class="settings-item" data-act="bluetooth">
                  <div class="settings-item__icon" style="background:#3a6ff0">${ICON.bluetooth}</div>
                  <span>蓝牙</span>
                </div>
                <div class="settings-item" data-act="cellular">
                  <div class="settings-item__icon" style="background:#34c759">${ICON.cellular}</div>
                  <span>移动数据</span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-item" data-act="personalize">
                  <div class="settings-item__icon" style="background:#ff375f">${ICON.paint}</div>
                  <span>桌面和个性化</span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-item" data-act="storage">
                  <div class="settings-item__icon" style="background:#5856d6">${ICON.storage}</div>
                  <span>存储</span>
                </div>
                <div class="settings-item" data-act="app-manage">
                  <div class="settings-item__icon" style="background:#ffb800">${ICON.grid}</div>
                  <span>应用管理</span>
                </div>
                <div class="settings-item" data-act="biometric">
                  <div class="settings-item__icon" style="background:#00c7be">${ICON.key}</div>
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
          root.querySelector('[data-act="cellular"]')
            ?.addEventListener('click', () => ctx.push('cellular'));
          root.querySelector('[data-act="personalize"]')
            ?.addEventListener('click', () => ctx.push('personalize'));
          root.querySelector('[data-act="storage"]')
            ?.addEventListener('click', () => ctx.push('storage'));
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
                <div class="settings-about-card__version">1.0.107</div>
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
                  <span class="settings-row__value">1.0.107</span>
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

      cellular: {
        name: 'cellular',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">移动数据</div>

              <div class="settings-section">
                <div class="settings-row">
                  <span>移动数据</span>
                  <div class="settings-toggle" data-toggle="cellular" role="switch"></div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root) {
          bindToggle(root, 'cellular');
        },
      },

      storage: {
        name: 'storage',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">存储</div>

              <div class="storage-card">
                <div class="storage-percent" id="storagePercent">--%</div>
                <div class="storage-bar">
                  <div class="storage-bar__fill" id="storageFill"></div>
                </div>
                <div class="storage-legend">
                  <span id="storageUsed">已使用 --</span>
                  <span id="storageFree">可用 --</span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-row">
                  <span>应用和数据</span>
                  <span class="settings-row__value" id="storageAppData">计算中...</span>
                </div>
                <div class="settings-row">
                  <span>WujiOS</span>
                  <span class="settings-row__value">4.3 GB</span>
                </div>
              </div>
            </div>
          `;
        },

        mount(root) {
          const percentEl = root.querySelector('#storagePercent');
          const fillEl    = root.querySelector('#storageFill');
          const usedEl    = root.querySelector('#storageUsed');
          const freeEl    = root.querySelector('#storageFree');
          const appDataEl = root.querySelector('#storageAppData');

          const TOTAL_BYTES  = 64  * 1024 * 1024 * 1024;
          const SYSTEM_BYTES = 4.3 * 1024 * 1024 * 1024;

          async function update() {
            let appBytes = 0;
            try {
              const usage = await AppStorage.usageAll();
              for (const k in usage) {
                appBytes += (usage[k] && usage[k].bytes) || 0;
              }
            } catch (e) {
              console.warn('[storage] usageAll failed', e);
            }

            const used  = SYSTEM_BYTES + appBytes;
            const free  = Math.max(0, TOTAL_BYTES - used);
            const pct   = Math.min(100, (used / TOTAL_BYTES) * 100);

            percentEl.textContent = pct.toFixed(1) + '%';
            fillEl.style.width = pct + '%';
            usedEl.textContent = '已使用 ' + formatBytes(used);
            freeEl.textContent = '可用 '   + formatBytes(free);

            appDataEl.textContent = formatBytes(appBytes);
          }

          update();
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
                usageEl.textContent = '已使用 ' + formatBytes(bytes);
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

      /* ==================== 桌面和个性化 ==================== */
      personalize: {
        name: 'personalize',

        render() {
          /* ★ 读取当前主题的 storeimg 作为左侧图标 */
          const themeMeta = window.WujiTheme?.meta;
          const storeImg  = themeMeta?.storeimg || '';
          const iconHtml  = storeImg
            ? `<img src="${escapeHtml(storeImg)}" alt="">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                 <circle cx="12" cy="12" r="9"/>
                 <path d="M12 3v18M3 12h18"/>
               </svg>`;

          return `
            <div class="settings-page">
              <div class="settings-title">桌面和个性化</div>

              <div class="settings-section">
                <div class="settings-item" data-act="themes">
                  <div class="settings-item__icon" style="background:#ff375f">
                    ${iconHtml}
                  </div>
                  <span>主题</span>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          root.querySelector('[data-act="themes"]')
            ?.addEventListener('click', () => ctx.push('themes'));
        },
      },

      /* ==================== 主题列表 ==================== */
      themes: {
        name: 'themes',

        render() {
          const sys = Array.isArray(window.SYSTEM_THEMES) ? window.SYSTEM_THEMES : [];
          return `
            <div class="settings-page">
              <div class="settings-title">主题</div>

              <div style="font-size:15px;font-weight:600;color:var(--wj-text);">系统主题</div>
              <div class="theme-grid" id="sysThemeGrid">
                ${sys.map(t => `
                  <div class="theme-card" data-id="${escapeHtml(t.id)}" data-sys="1">
                    <div class="theme-card__thumb">
                      <img src="${escapeHtml(t.storeimg || t.static || '')}" alt="">
                    </div>
                    <div class="theme-card__name">${escapeHtml(t.name)}</div>
                  </div>
                `).join('')}
              </div>

              <div style="font-size:15px;font-weight:600;color:var(--wj-text);margin-top:6px;">我的主题</div>
              <div class="theme-grid" id="myThemeGrid"></div>
              <div class="theme-end" id="myThemeEmpty" hidden>没有更多了</div>

              <button class="theme-goto-market" id="gotoMarketBtn" type="button">
                前往主题市场
              </button>
            </div>
          `;
        },

        mount(root, ctx) {
          const myGrid  = root.querySelector('#myThemeGrid');
          const myEmpty = root.querySelector('#myThemeEmpty');
          const gotoBtn = root.querySelector('#gotoMarketBtn');
          const SYS     = Array.isArray(window.SYSTEM_THEMES) ? window.SYSTEM_THEMES : [];

          /* ---------- 系统主题点击 ---------- */
          root.querySelectorAll('#sysThemeGrid .theme-card').forEach(el => {
            el.addEventListener('click', () => {
              const t = SYS.find(x => x.id === el.dataset.id);
              if (!t) return;
              ctx.push('theme-detail', { theme: t, isSystem: true });
            });
          });

          /* ---------- DB 读写 ---------- */
          const DB = () => AppStorage.for('com.wujios.themes');

          async function readDownloaded() {
            try {
              const list = await DB().get('downloaded_themes', []);
              const arr = Array.isArray(list) ? list.slice() : [];
              console.log('[themes] read:', arr.map(t => t && t.id));
              return arr;
            } catch (e) {
              console.error('[themes] read failed:', e);
              return [];
            }
          }

          async function writeDownloaded(list) {
            try {
              await DB().set('downloaded_themes', list);
              console.log('[themes] wrote:', list.map(t => t && t.id));
              return true;
            } catch (e) {
              console.error('[themes] write failed:', e);
              return false;
            }
          }

          async function deleteTheme(themeId) {
            if (themeId === undefined || themeId === null) {
              console.warn('[themes] delete: themeId 为空，放弃');
              return false;
            }
            const list = await readDownloaded();
            const before = list.length;
            const next = list.filter(t => String(t.id) !== String(themeId));
            const after = next.length;
            console.log('[themes] delete:', themeId,
              'before:', before, 'after:', after, 'match:', before - after);

            if (before === after) {
              console.warn('[themes] 未匹配到要删除的主题，list ids =',
                list.map(t => String(t.id)));
              return false;
            }
            return await writeDownloaded(next);
          }

          /* ---------- 菜单 ---------- */
          let menuEl = null;
          let menuOffHandler = null;

          function hideMenu() {
            if (menuOffHandler) {
              document.removeEventListener('pointerdown', menuOffHandler, true);
              menuOffHandler = null;
            }
            if (menuEl) { menuEl.remove(); menuEl = null; }
          }

          function showDeleteMenu(theme, rect) {
            hideMenu();
            menuEl = document.createElement('div');
            menuEl.className = 'theme-menu';
            menuEl.innerHTML = `
              <button class="theme-menu__item" type="button">
                删除主题「${escapeHtml(theme.name || '')}」
              </button>
            `;
            root.appendChild(menuEl);

            const mr = menuEl.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            const EDGE = 8;
            let left = rect.left + rect.width / 2 - mr.width / 2;
            left = Math.max(EDGE, Math.min(vw - mr.width - EDGE, left));
            let top = rect.top - mr.height - 6;
            if (top < EDGE) top = rect.bottom + 6;
            if (top + mr.height > vh - EDGE) top = vh - EDGE - mr.height;
            menuEl.style.left = left + 'px';
            menuEl.style.top  = top  + 'px';

            /* ---- 菜单项：pointerup + click 双保险 ---- */
            const item = menuEl.querySelector('.theme-menu__item');
            let handled = false;

            const handleDelete = async ev => {
              if (handled) return;
              handled = true;

              try { ev.stopPropagation(); ev.preventDefault(); } catch { }
              hideMenu();
              console.log('[themes] delete clicked:', theme.id);

              const ok = await deleteTheme(theme.id);
              if (!ok) { handled = false; return; }

              if (WujiTheme.current === theme.id) {
                const fallback = (SYS[0] && SYS[0].id) || 'sea';
                try { await WujiTheme.load(fallback); } catch (e) {
                  console.warn('[themes] fallback load failed:', e);
                }
              }
              await renderMine();
            };

            item.addEventListener('pointerup', handleDelete);
            item.addEventListener('click', handleDelete);

            /* 点菜单外面关闭 */
            menuOffHandler = ev => {
              if (menuEl && !menuEl.contains(ev.target)) {
                hideMenu();
              }
            };
            setTimeout(() => {
              if (menuEl && menuOffHandler) {
                document.addEventListener('pointerdown', menuOffHandler, true);
              }
            }, 0);
          }

          /* ---------- 长按删除 ---------- */
          function bindLongPressDelete(el, theme) {
            let lpTimer = null;
            let lpFired = false;
            let pid     = null;
            let startX  = 0, startY = 0;
            const MOVE_CANCEL = 10;

            el.addEventListener('pointerdown', e => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              lpFired = false;
              pid = e.pointerId;
              startX = e.clientX;
              startY = e.clientY;
              try { el.setPointerCapture(e.pointerId); } catch { }

              lpTimer = setTimeout(() => {
                lpTimer = null;
                lpFired = true;

                /* ★ 长按触发时立刻释放 capture，
                   否则后续 pointer 事件全被锁在卡片上，菜单按钮点不到 */
                try { el.releasePointerCapture(pid); } catch { }
                pid = null;

                if (navigator.vibrate) { try { navigator.vibrate(12); } catch {} }
                const rect = el.getBoundingClientRect();
                showDeleteMenu(theme, rect);
              }, 600);
            });

            el.addEventListener('pointermove', e => {
              if (!lpTimer) return;
              if (pid !== null && e.pointerId !== pid) return;
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              if (Math.hypot(dx, dy) > MOVE_CANCEL) {
                clearTimeout(lpTimer);
                lpTimer = null;
              }
            });

            const stop = e => {
              if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
              if (pid !== null) {
                try { el.releasePointerCapture(pid); } catch { }
                pid = null;
              }
            };
            el.addEventListener('pointerup', stop);
            el.addEventListener('pointercancel', stop);

            /* 长按松手后的 click 在 capture 阶段吞掉 */
            el.addEventListener('click', e => {
              if (lpFired) {
                lpFired = false;
                e.preventDefault();
                e.stopPropagation();
              }
            }, true);
          }

          /* ---------- 我的主题渲染 ---------- */
          async function renderMine() {
            const list = await readDownloaded();

            if (!list.length) {
              myGrid.innerHTML = '';
              myEmpty.hidden = false;
              return;
            }
            myEmpty.hidden = true;

            myGrid.innerHTML = list.map(t => `
              <div class="theme-card" data-id="${escapeHtml(String(t.id))}" data-mine="1">
                <div class="theme-card__thumb">
                  <img src="${escapeHtml(t.storeimg || t.static || '')}" alt="">
                </div>
                <div class="theme-card__name">${escapeHtml(t.name || '')}</div>
              </div>
            `).join('');

            /* ★ 用索引绑定，避免 dataset.id 与 t.id 二次匹配失败 */
            const cards = myGrid.querySelectorAll('.theme-card');
            cards.forEach((el, i) => {
              const theme = list[i];
              if (!theme) return;
              el.addEventListener('click', () => {
                ctx.push('theme-detail', { theme, isSystem: false });
              });
              bindLongPressDelete(el, theme);
            });
          }

          renderMine();

          gotoBtn.addEventListener('click', () => {
            try {
              window.WujiAppLauncher?.open('com.wujios.themes', {});
            } catch (e) { console.error(e); }
          });
        },
      },

      /* ==================== 主题详情（设置内） ==================== */
      'theme-detail': {
        name: 'theme-detail',

        render(routeCtx) {
          const theme = routeCtx.data?.theme;
          if (!theme) return `<div class="settings-page"><div class="settings-row"><span>主题不存在</span></div></div>`;

          return `
            <div class="theme-detail">
              <div class="theme-detail__scroll">
                <div class="theme-detail__name">${escapeHtml(theme.name)}</div>
                <div class="theme-detail__hero">
                  <img src="${escapeHtml(theme.storeimg || theme.static || '')}" alt="">
                </div>
              </div>
              <div class="theme-detail__footer">
                <button class="theme-btn" id="setThemeBtn" type="button">
                  <span class="theme-btn__label">应用</span>
                </button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const theme = ctx.data?.theme;
          if (!theme) return;

          const btn = root.querySelector('#setThemeBtn');
          if (!btn) return;

          async function refresh() {
            const active = WujiTheme.current === theme.id;
            if (active) {
              btn.disabled = true;
              btn.querySelector('.theme-btn__label').textContent = '使用中';
            } else {
              btn.disabled = false;
              btn.querySelector('.theme-btn__label').textContent = '应用';
            }
          }
          refresh();

          btn.addEventListener('click', async () => {
            if (btn.disabled) return;
            try {
              await WujiTheme.load(theme.id);
              if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
              refresh();
            } catch (e) { console.error('[theme] 应用失败', e); }
          });
        },
      },
    },
  });
})();