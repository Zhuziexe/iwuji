(() => {
  const ICON = {
    wifi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
    bluetooth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11"/></svg>`,
    cellular: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h.01"/><path d="M7 22v-4"/><path d="M12 22V12"/><path d="M17 22V6"/><path d="M22 22V2"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/></svg>`,
    key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="M18 5l2 2"/><path d="M15 8l2 2"/></svg>`,
    storage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="2.6"/><path d="M4 6v5c0 1.44 3.58 2.6 8 2.6s8-1.16 8-2.6V6"/><path d="M4 12v5c0 1.44 3.58 2.6 8 2.6s8-1.16 8-2.6v-5"/></svg>`,
    paint: `<svg viewBox="0 0 24 24"><rect width="24" height="24" fill="#ff375f" /><rect x="4.35" y="0.98" width="15.3" height="8.6" rx="1.13" fill="#FFFFFF" /><rect x="5.03" y="9.98" width="14.18" height="2.03" rx="0.45" fill="#FFFFFF" /><rect x="10.2" y="12" width="3.6" height="10.8" rx="1.13" fill="#FFFFFF" /></svg>`,
    sound: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    backup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.6-5.7"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.6 5.7"/><path d="M4 20v-4.5h4.5"/><rect x="9" y="10" width="6" height="4" rx="1" fill="currentColor" stroke="none"/></svg>`,
  };

  function formatBytes(n) {
    if (!n || n < 0) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function imgToCanvas(src, w, h) {
    const canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    };
    img.onerror = () => { };
    img.src = src;
    return canvas;
  }

  function imgToCanvasNatural(src, cssWidth) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:auto;display:block;';
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cssWidth || canvas.clientWidth || img.naturalWidth;
      const h = w * img.naturalHeight / img.naturalWidth;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = src;
    return canvas;
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
    let cancelled = false;

    function updateDots() {
      dotsEl.querySelectorAll('.settings-pin-dot').forEach((dot, i) => {
        dot.classList.toggle('is-filled', i < current.length);
      });
    }

    function fireComplete(pin) {
      if (cancelled) return;
      onComplete?.(pin);
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
          setTimeout(() => fireComplete(pin), 160);
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
          setTimeout(() => fireComplete(pin), 160);
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
        cancelled = true;
        window.removeEventListener('keydown', onKey);
      },
    };
  }

  function bindToggle(root, key) {
    const el = root.querySelector(`[data-toggle="${key}"]`);
    if (!el) return () => { };

    function readState() {
      if (window.WujiControlCenter && typeof WujiControlCenter.getToggle === 'function') {
        return WujiControlCenter.getToggle(key);
      }
      return !!Store.get('wujios.' + key, false);
    }

    function writeState(v) {
      if (window.WujiControlCenter && typeof WujiControlCenter.setToggle === 'function') {
        WujiControlCenter.setToggle(key, v);
        return;
      }
      Store.set('wujios.' + key, v);
      const ccToggle = document.querySelector(`.cc-toggle[data-key="${key}"]`);
      if (ccToggle) ccToggle.classList.toggle('is-on', v);
    }

    function onCCChange(e) {
      if (!e.detail || e.detail.key !== key) return;
      el.classList.toggle('is-on', !!e.detail.value);
    }
    window.addEventListener('wuji:cc-toggle-change', onCCChange);

    el.classList.toggle('is-on', readState());

    function onClick() {
      const next = !el.classList.contains('is-on');
      el.classList.toggle('is-on', next);
      writeState(next);
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
    }
    el.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('wuji:cc-toggle-change', onCCChange);
      el.removeEventListener('click', onClick);
    };
  }

  function bindPercentSlider(root, ctx, {
    sliderSel, fillSel, labelSel, knobSel, initial, onChange, eventName,
  }) {
    const sliderEl = root.querySelector(sliderSel);
    const fillEl = root.querySelector(fillSel);
    const labelEl = root.querySelector(labelSel);
    const knobEl = knobSel ? root.querySelector(knobSel) : null;
    if (!sliderEl || !fillEl || !labelEl) return () => { };

    let value = Math.max(0, Math.min(100, Number(initial) || 0));
    let dragging = false;
    let activePointer = null;

    function paint(v) {
      const vv = Math.max(0, Math.min(100, v));
      const w = sliderEl.clientWidth;
      if (!w) return;

      const R_FILL = 14;
      const PAD = 4;

      const px = w * vv / 100;

      const knobX = Math.max(R_FILL + PAD, Math.min(w - R_FILL - PAD, px));

      const fillWidth = Math.max(R_FILL * 2, knobX + R_FILL - PAD);

      fillEl.style.width = fillWidth + 'px';
      knobEl.style.left = knobX + 'px';
      labelEl.textContent = vv + '%';
    }
    paint(value);

    function setBlock(on) {
      const item = ctx.nav?.current;
      const el = item?.element;
      if (!el) return;
      if (on) el.dataset.blockBackGesture = '1';
      else delete el.dataset.blockBackGesture;
    }

    function computeFromEvent(e) {
      const rect = sliderEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return Math.round(Math.max(0, Math.min(1, x / rect.width)) * 100);
    }

    function onDown(e) {
      e.stopPropagation();
      e.preventDefault();
      setBlock(true);
      dragging = true;
      activePointer = e.pointerId;
      try { sliderEl.setPointerCapture(e.pointerId); } catch { }
      value = computeFromEvent(e);
      paint(value);
      onChange(value);
    }

    function onMove(e) {
      if (!dragging || e.pointerId !== activePointer) return;
      e.preventDefault();
      value = computeFromEvent(e);
      paint(value);
      onChange(value);
    }

    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      activePointer = null;
      setBlock(false);
      try { sliderEl.releasePointerCapture(e.pointerId); } catch { }
    }

    function onTouchStart(e) { e.stopPropagation(); }

    function onExternal(e) {
      if (dragging) return;
      if (!e.detail) return;
      let v = null;
      if (typeof e.detail.volume === 'number') v = e.detail.volume;
      if (typeof e.detail.brightness === 'number') v = e.detail.brightness;
      if (v == null) return;
      value = Math.max(0, Math.min(100, v));
      paint(value);
    }

    sliderEl.addEventListener('touchstart', onTouchStart, { passive: true });
    sliderEl.addEventListener('pointerdown', onDown);
    sliderEl.addEventListener('pointermove', onMove);
    sliderEl.addEventListener('pointerup', onUp);
    sliderEl.addEventListener('pointercancel', onUp);
    if (eventName) window.addEventListener(eventName, onExternal);

    return () => {
      sliderEl.removeEventListener('touchstart', onTouchStart);
      sliderEl.removeEventListener('pointerdown', onDown);
      sliderEl.removeEventListener('pointermove', onMove);
      sliderEl.removeEventListener('pointerup', onUp);
      sliderEl.removeEventListener('pointercancel', onUp);
      if (eventName) window.removeEventListener(eventName, onExternal);
      setBlock(false);
    };
  }

  WujiApps.register({
    bundlename: 'com.wujios.settings',
    name: '设置',
    icon: './assets/settings.svg',
    initialRoute: 'home',
    version: '1.1.3',
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
        min-height: 53px;
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
        background: var(--wj-primary);
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
        background: var(--wj-primary);
        transition: width .5s cubic-bezier(.2, .7, .3, 1);
      }

      .storage-legend {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--wj-text-dim);
        letter-spacing: .2px;
      }

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
        background: var(--wj-primary);
        color: #fff;
        font: inherit;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .08s;
      }
      .theme-goto-market:active { transform: scale(.98); }

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
        background: var(--wj-primary); color: #fff;
        font: inherit; font-size: 16px; font-weight: 600;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        transition: transform .1s, background .2s;
      }
      .theme-btn:active:not(:disabled) { transform: scale(.98); }
      .theme-btn:disabled { background: var(--wj-bg-alt); color: var(--wj-text-muted); }
      .theme-btn__label {
        display: flex; align-items: center; justify-content: center; height: 100%;
      }
      .settings-slider {
        position: relative;
        width: 100%;
        height: 36px;
        border-radius: 18px;
        background: var(--wj-bg-alt, #eef1f6);
        cursor: pointer;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .settings-slider__fill {
        position: absolute;
        top: 4px;
        bottom: 4px;
        left: 4px;
        width: 0;
        background: var(--wj-primary);
        border-radius: 14px;
        pointer-events: none;
      }

      .settings-slider__knob {
        position: absolute;
        top: 50%;
        left: 18px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow:
          0 2px 6px rgba(0, 0, 0, .22),
          0 0 0 1px rgba(0, 0, 0, .04);
        transform: translate(-50%, -50%);
        z-index: 1;
        pointer-events: none;
      }

      .settings-segment {
        display: flex;
        gap: 8px;
      }
      .settings-segment__btn {
        flex: 1 1 0;
        padding: 12px 16px;
        border: 2px solid var(--wj-border, #e6e9ef);
        border-radius: 999px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color .15s, background .15s, color .15s, transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .settings-segment__btn:active { transform: scale(.97); }
      .settings-segment__btn.is-active {
        border-color: var(--wj-primary);
        background: rgba(58, 111, 240, .10);
        color: var(--wj-primary);
        font-weight: 600;
      }
      .backup-status {
        flex: 0 0 auto;
        text-align: center;
        font-size: 13px;
        color: var(--wj-text-muted);
        min-height: 20px;
        letter-spacing: .3px;
        line-height: 1.6;
        padding: 4px 8px;
      }
      .backup-status.is-error { color: var(--wj-danger, #e0356b); }
      .backup-status.is-ok    { color: #34c759; }
      .backup-hero {
        width: 100%;
        background: var(--wj-bg-alt);
        overflow: hidden;
      }
      .backup-hero img {
        display: block;
        width: 100%;
        height: auto;
        pointer-events: none;
        user-select: none;
        -webkit-user-drag: none;
      }
      .ov-backup {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #070b14;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      .ov-backup__glow {
        position: absolute;
        width: 420px;
        height: 420px;
        border-radius: 50%;
        pointer-events: none;
        filter: blur(60px);
        opacity: .55;
      }
      .ov-backup__glow--1 {
        top: -120px;
        left: -120px;
        background: radial-gradient(circle, rgba(58,111,240,.65), transparent 70%);
      }
      .ov-backup__glow--2 {
        bottom: -140px;
        right: -100px;
        background: radial-gradient(circle, rgba(40,80,200,.55), transparent 70%);
      }

            .ov-backup__content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px;
        text-align: center;
      }

      .ov-backup__progress {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 48px;
      }
      .ov-backup__progress.is-hide {
        display: none;
      }

      .ov-backup__done {
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 32px;
      }
      .ov-backup__done.is-show {
        display: flex;
      }

      .ov-backup__title {
        font-size: 28px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: 3px;
        text-shadow: 0 4px 20px rgba(58,111,240,.4);
      }

      .ov-backup__orb {
        width: min(168px, 44vw);
        height: min(168px, 44vw);
        border-radius: 50%;
        border: 3px solid #3a6ff0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          0 0 30px rgba(58,111,240,.35),
          inset 0 0 30px rgba(58,111,240,.15);
        background: radial-gradient(circle at 40% 30%, rgba(58,111,240,.15), transparent 60%);
      }

      .ov-backup__percent {
        font-size: clamp(30px, 9vw, 38px);
        font-weight: 700;
        color: #ffffff;
        font-variant-numeric: tabular-nums;
        letter-spacing: 1px;
        text-shadow: 0 2px 12px rgba(58,111,240,.5);
      }

      .ov-backup__check {
        width: 84px;
        height: 84px;
        border-radius: 50%;
        border: 3px solid #3a6ff0;
        background: radial-gradient(circle at 40% 30%, rgba(58,111,240,.18), transparent 60%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #3a6ff0;
        box-shadow:
          0 0 32px rgba(58,111,240,.4),
          inset 0 0 20px rgba(58,111,240,.15);
      }
      .ov-backup__check svg {
        width: 40px;
        height: 40px;
        display: block;
      }

      .ov-backup__btn {
        min-width: 168px;
        padding: 14px 44px;
        border: 0;
        border-radius: 999px;
        background: #3a6ff0;
        color: #fff;
        font: inherit;
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 2px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(58,111,240,.5);
        transition: transform .1s, filter .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .ov-backup__btn:active {
        transform: scale(.96);
        filter: brightness(.9);
      }
    `,

    overlays: [
      {
        name: 'backup',

        render() {
          return `
            <div class="ov-backup">
              <div class="ov-backup__glow ov-backup__glow--1"></div>
              <div class="ov-backup__glow ov-backup__glow--2"></div>
              <div class="ov-backup__content">

                <div class="ov-backup__progress" id="ovBackupProgress">
                  <div class="ov-backup__title" id="ovBackupTitle">数据备份中</div>
                  <div class="ov-backup__orb">
                    <span class="ov-backup__percent" id="ovBackupPercent">0%</span>
                  </div>
                </div>

                <div class="ov-backup__done" id="ovBackupDone">
                  <div class="ov-backup__check">
                    <svg viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="3"
                         stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12l5 5 9-11"/>
                    </svg>
                  </div>
                  <div class="ov-backup__title">数据备份完成</div>
                  <button class="ov-backup__btn" id="ovBackupOk"
                          type="button" data-overlay-interactive>确定</button>
                </div>

              </div>
            </div>
          `;
        },

        mount(root) {
          const progressEl = root.querySelector('#ovBackupProgress');
          const doneEl = root.querySelector('#ovBackupDone');
          const percentEl = root.querySelector('#ovBackupPercent');
          const titleEl = root.querySelector('#ovBackupTitle');
          const okBtn = root.querySelector('#ovBackupOk');

          const startTime = performance.now();
          let exportData = null;    // 导出完成后先存住，进度走完再下载
          let exportDone = false;
          let exportDoneTime = 0;
          let percentAtDone = 0;
          let failed = false;
          let finished = false;   // 100% 到了、下载完了、切到完成态
          let rafId = null;

          function setPercent(p) {
            percentEl.textContent = Math.floor(p) + '%';
          }

          function showDone() {
            finished = true;
            progressEl.classList.add('is-hide');
            doneEl.classList.add('is-show');
          }

          function loop(now) {
            if (!root.isConnected) return;
            if (failed || finished) return;

            if (!exportDone) {
              const elapsed = now - startTime;
              setPercent(Math.min(90, (elapsed / 8000) * 90));
              rafId = requestAnimationFrame(loop);
              return;
            }

            const elapsedSinceDone = now - exportDoneTime;
            if (elapsedSinceDone >= 5000) {
              setPercent(100);
              try {
                if (exportData && window.WujiBackup) {
                  WujiBackup.downloadJson(exportData);
                }
              } catch (e) {
                console.error('[settings/backup] download failed', e);
              }
              showDone();
              return;
            }

            const displayPercent =
              percentAtDone + (elapsedSinceDone / 5000) * (100 - percentAtDone);
            setPercent(displayPercent);
            rafId = requestAnimationFrame(loop);
          }

          rafId = requestAnimationFrame(loop);

          (async () => {
            try {
              if (!window.WujiBackup) throw new Error('备份模块未加载');
              const data = await WujiBackup.exportAll();
              if (!root.isConnected) return;

              exportData = data;
              exportDone = true;
              exportDoneTime = performance.now();
              percentAtDone = parseFloat(percentEl.textContent) || 0;
              if (percentAtDone >= 100) percentAtDone = 90;
            } catch (e) {
              console.error('[settings/backup]', e);
              if (!root.isConnected) return;

              failed = true;
              if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

              titleEl.textContent = '备份失败';
              percentEl.textContent = '!';
              percentEl.style.color = '#ff6b6b';

              setTimeout(() => {
                if (root.isConnected) WujiOverlay.close();
              }, 2500);
            }
          })();

          okBtn.addEventListener('click', () => {
            WujiOverlay.close();
          });

          this._cleanup = () => {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
          };
        },

        unmount() {
          this._cleanup?.();
          this._cleanup = null;
        },
      },
    ],
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
                <div class="settings-item" data-act="sound">
                  <div class="settings-item__icon" style="background:#3a6ff0">${ICON.sound}</div>
                  <span>铃声和音量</span>
                </div>
                <div class="settings-item" data-act="display">
                  <div class="settings-item__icon" style="background:#34c759">${ICON.eye}</div>
                  <span>显示和亮度</span>
                </div>
                <div class="settings-item" data-act="personalize">
                  <div class="settings-item__icon" style="background:#ff375f">${ICON.paint}</div>
                  <span>桌面和个性化</span>
                </div>
                <div class="settings-item" data-act="biometric">
                  <div class="settings-item__icon" style="background:#00c7be">${ICON.key}</div>
                  <span>生物识别和密码</span>
                </div>
              </div>
              <div class="settings-section">
                <div class="settings-item" data-act="app-manage">
                  <div class="settings-item__icon" style="background:#ffb800">${ICON.grid}</div>
                  <span>应用管理</span>
                </div>
                <div class="settings-item" data-act="storage">
                  <div class="settings-item__icon" style="background:#5856d6">${ICON.storage}</div>
                  <span>存储</span>
                </div>
                <div class="settings-item" data-act="backup">
                  <div class="settings-item__icon" style="background:#3a6ff0">${ICON.backup}</div>
                  <span>备份和恢复</span>
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
          root.querySelector('[data-act="sound"]')
            ?.addEventListener('click', () => ctx.push('sound'));
          root.querySelector('[data-act="display"]')
            ?.addEventListener('click', () => ctx.push('display'));
          root.querySelector('[data-act="backup"]')
            ?.addEventListener('click', () => ctx.push('backup'));
          const target = ctx.data && ctx.data.route;

          if (target && ctx.nav && ctx.nav.routes && ctx.nav.routes[target]) {
            requestAnimationFrame(() => {
              ctx.nav.reset(target, {});
            });
          }
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
                <div class="settings-about-card__version">1.0.114</div>
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
                  <span class="settings-row__value">1.0.114</span>
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
          return bindToggle(root, 'wifi');
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
          return bindToggle(root, 'bluetooth');
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
          return bindToggle(root, 'cellular');
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
          const fillEl = root.querySelector('#storageFill');
          const usedEl = root.querySelector('#storageUsed');
          const freeEl = root.querySelector('#storageFree');
          const appDataEl = root.querySelector('#storageAppData');

          const TOTAL_BYTES = 64 * 1024 * 1024 * 1024;
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

            if (!root.isConnected) return;

            const used = SYSTEM_BYTES + appBytes;
            const free = Math.max(0, TOTAL_BYTES - used);
            const pct = Math.min(100, (used / TOTAL_BYTES) * 100);

            percentEl.textContent = pct.toFixed(1) + '%';
            fillEl.style.width = pct + '%';
            usedEl.textContent = '已使用 ' + formatBytes(used);
            freeEl.textContent = '可用 ' + formatBytes(free);

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

          const off = ctx.nav.onChange(() => {
            if (ctx.nav.current?.route?.name === 'app-manage') {
              renderList();
            }
          });

          return () => off();
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

              const app = WujiApps.get(bundle);
              if (!app) return;

              const res = await WujiDialog.show({
                bundlename: '',
                icon: app.icon || '',
                title: `卸载“${app.name || bundle}”`,
                content: '卸载后，应用内本地数据同步清除。',
                buttons: [
                  { value: '取消', color: 'var(--wj-primary)' },
                  { value: '卸载', color: 'var(--wj-danger)' },
                ],
              });

              if (res !== '卸载') return;

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

          const off = ctx.nav.onChange(() => {
            if (ctx.nav.current?.route?.name === 'biometric') {
              renderList();
            }
          });

          return () => off();
        },
      },

      sound: {
        name: 'sound',

        render() {
          const vol = (window.WujiControlCenter?.getVolume?.())
            ?? Store.get('wujios.volume', 60);
          const mute = (window.WujiControlCenter?.getToggle?.('soundmode'))
            ?? !!Store.get('wujios.soundmode', false);
          const playBoot = Store.get('wujios.playbootsound', true) !== false;

          return `
            <div class="settings-page">
              <div class="settings-title">铃声和音量</div>

              <div class="settings-section"
                   style="padding:14px 18px;gap:12px;display:flex;flex-direction:column;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                  <span>音量</span>
                  <span class="settings-row__value" id="sVolumeLabel">${vol}%</span>
                </div>
                <div class="settings-slider" id="sVolumeSlider">
                  <div class="settings-slider__fill" id="sVolumeFill"></div>
                  <div class="settings-slider__knob" id="sVolumeKnob"></div>
                </div>
              </div>

              <div class="settings-section"
                   style="padding:14px 18px;gap:10px;display:flex;flex-direction:column;">
                <div>音量模式</div>
                <div class="settings-segment" id="sSoundMode">
                  <button class="settings-segment__btn ${!mute ? 'is-active' : ''}"
                          data-mode="ring" type="button">铃声</button>
                  <button class="settings-segment__btn ${mute ? 'is-active' : ''}"
                          data-mode="mute" type="button">静音</button>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-row">
                  <span>开机铃声</span>
                  <div class="settings-toggle ${playBoot ? 'is-on' : ''}"
                       data-toggle="playbootsound" role="switch"></div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const segmentEl = root.querySelector('#sSoundMode');
          const bootToggle = root.querySelector('[data-toggle="playbootsound"]');

          const offSlider = bindPercentSlider(root, ctx, {
            sliderSel: '#sVolumeSlider',
            fillSel: '#sVolumeFill',
            labelSel: '#sVolumeLabel',
            knobSel: '#sVolumeKnob',
            initial: window.WujiControlCenter?.getVolume?.()
              ?? Store.get('wujios.volume', 60),
            eventName: 'wuji:cc-volume-change',
            onChange: v => {
              try { WujiControlCenter?.setVolume?.(v); }
              catch { Store.set('wujios.volume', v); }
            },
          });

          let onCCChange = null;
          let onSegClick = null;
          let onBootToggle = null;

          if (segmentEl) {
            function syncButtons(mute) {
              segmentEl.querySelectorAll('.settings-segment__btn').forEach(b => {
                b.classList.toggle('is-active',
                  (b.dataset.mode === 'mute') === mute);
              });
            }

            onSegClick = e => {
              const btn = e.target.closest('.settings-segment__btn');
              if (!btn || btn.classList.contains('is-active')) return;

              const mute = btn.dataset.mode === 'mute';
              try { WujiControlCenter?.setToggle?.('soundmode', mute); }
              catch { Store.set('wujios.soundmode', mute); }

              syncButtons(mute);
              if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
            };
            segmentEl.addEventListener('click', onSegClick);

            onCCChange = e => {
              if (!e.detail || e.detail.key !== 'soundmode') return;
              syncButtons(!!e.detail.value);
            };
            window.addEventListener('wuji:cc-toggle-change', onCCChange);
          }

          /* ★ 开机铃声开关 */
          if (bootToggle) {
            onBootToggle = () => {
              const next = !bootToggle.classList.contains('is-on');
              bootToggle.classList.toggle('is-on', next);
              Store.set('wujios.playbootsound', next);
              if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
            };
            bootToggle.addEventListener('click', onBootToggle);
          }

          return () => {
            offSlider();
            if (segmentEl && onSegClick) segmentEl.removeEventListener('click', onSegClick);
            if (onCCChange) window.removeEventListener('wuji:cc-toggle-change', onCCChange);
            if (bootToggle && onBootToggle) bootToggle.removeEventListener('click', onBootToggle);
          };
        },
      },

      display: {
        name: 'display',

        render() {
          const b = (window.WujiControlCenter?.getBrightness?.())
            ?? Store.get('wujios.brightness', 80);
          return `
            <div class="settings-page">
              <div class="settings-title">显示和亮度</div>

              <div class="settings-section"
                   style="padding:14px 18px;gap:12px;display:flex;flex-direction:column;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                  <span>亮度</span>
                  <span class="settings-row__value" id="sBrightLabel">${b}%</span>
                </div>
                <div class="settings-slider" id="sBrightSlider">
                  <div class="settings-slider__fill" id="sBrightFill"></div>
                  <div class="settings-slider__knob" id="sBrightKnob"></div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          return bindPercentSlider(root, ctx, {
            sliderSel: '#sBrightSlider',
            fillSel: '#sBrightFill',
            labelSel: '#sBrightLabel',
            knobSel: '#sBrightKnob',
            initial: window.WujiControlCenter?.getBrightness?.()
              ?? Store.get('wujios.brightness', 80),
            eventName: 'wuji:cc-brightness-change',
            onChange: v => {
              try { WujiControlCenter?.setBrightness?.(v); }
              catch { Store.set('wujios.brightness', v); }
            },
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
              if (!root.isConnected) return;
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

          return () => pad.destroy?.();
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
              if (!root.isConnected) return;
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

          return () => pad.destroy?.();
        },
      },

      personalize: {
        name: 'personalize',

        render() {
          const themeMeta = window.WujiTheme?.meta;
          const storeImg = themeMeta?.storeimg || '';
          const iconHtml = storeImg
            ? `<img src="${escapeHtml(storeImg)}" alt="">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                 <circle cx="12" cy="12" r="9"/>
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
                  <div class="theme-card" data-id="${escapeHtml(t.id)}" data-sys="1"
                       data-src="${escapeHtml(t.storeimg || t.static || '')}">
                    <div class="theme-card__thumb"></div>
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
          const myGrid = root.querySelector('#myThemeGrid');
          const myEmpty = root.querySelector('#myThemeEmpty');
          const gotoBtn = root.querySelector('#gotoMarketBtn');
          const SYS = Array.isArray(window.SYSTEM_THEMES) ? window.SYSTEM_THEMES : [];

          root.querySelectorAll('#sysThemeGrid .theme-card').forEach(card => {
            const thumb = card.querySelector('.theme-card__thumb');
            const src = card.dataset.src;
            if (!thumb || !src) return;
            thumb.innerHTML = '';
            thumb.appendChild(imgToCanvas(src, 160, 213));
          });

          root.querySelectorAll('#sysThemeGrid .theme-card').forEach(el => {
            el.addEventListener('click', () => {
              const t = SYS.find(x => x.id === el.dataset.id);
              if (!t) return;

              const rect = el.getBoundingClientRect();

              ctx.push('theme-detail',
                { theme: t, isSystem: true },
                {
                  origin: {
                    x: rect.left,
                    y: rect.top,
                    w: rect.width,
                    h: rect.height,
                  },
                }
              );
            });
          });

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

          let menuEl = null;
          let menuOffHandler = null;

          function hideMenu() {
            if (menuOffHandler) {
              document.removeEventListener('pointerdown', menuOffHandler, true);
              menuOffHandler = null;
            }
            if (menuEl) { menuEl.remove(); menuEl = null; }
          }

          function bindLongPressDelete(el, theme) {
            let lpTimer = null;
            let lpFired = false;
            let startX = 0, startY = 0;
            const MOVE_CANCEL = 10;

            el.addEventListener('pointerdown', e => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              if (window.WujiDialog?.isOpen) return;

              lpFired = false;
              startX = e.clientX;
              startY = e.clientY;

              lpTimer = setTimeout(async () => {
                lpTimer = null;
                lpFired = true;
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch { } }

                const res = await WujiDialog.show({
                  bundlename: 'com.wujios.settings',
                  title: '删除主题',
                  content: `确定要删除主题「${theme.name || ''}」吗？`,
                  buttons: [
                    { value: '取消', color: 'var(--wj-primary, #3a6ff0)' },
                    { value: '删除', color: 'var(--wj-danger, #e0356b)' },
                  ],
                });

                if (res !== '删除') return;

                const ok = await deleteTheme(theme.id);
                if (!ok) return;

                if (WujiTheme.current === theme.id) {
                  const fallback = (SYS[0] && SYS[0].id) || 'sea';
                  try { await WujiTheme.load(fallback); } catch (e) {
                    console.warn('[themes] fallback load failed:', e);
                  }
                }
                await renderMine();
              }, 600);

              const cleanup = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onUp);
              };
              const onMove = ev => {
                if (!lpTimer) return;
                if (Math.abs(ev.clientX - startX) > MOVE_CANCEL ||
                  Math.abs(ev.clientY - startY) > MOVE_CANCEL) {
                  clearTimeout(lpTimer);
                  lpTimer = null;
                  cleanup();
                }
              };
              const onUp = () => {
                if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
                cleanup();
              };
              document.addEventListener('pointermove', onMove, { passive: true });
              document.addEventListener('pointerup', onUp);
              document.addEventListener('pointercancel', onUp);
            });

            el.addEventListener('click', e => {
              if (lpFired) {
                lpFired = false;
                e.preventDefault();
                e.stopPropagation();
              }
            }, true);
          }

          async function renderMine() {
            const list = await readDownloaded();

            if (!list.length) {
              myGrid.innerHTML = '';
              myEmpty.hidden = false;
              return;
            }
            myEmpty.hidden = true;

            myGrid.innerHTML = list.map(t => `
              <div class="theme-card" data-id="${escapeHtml(String(t.id))}" data-mine="1"
                   data-src="${escapeHtml(t.storeimg || t.static || '')}">
                <div class="theme-card__thumb"></div>
                <div class="theme-card__name">${escapeHtml(t.name || '')}</div>
              </div>
            `).join('');

            myGrid.querySelectorAll('.theme-card').forEach(card => {
              const thumb = card.querySelector('.theme-card__thumb');
              const src = card.dataset.src;
              if (!thumb || !src) return;
              thumb.innerHTML = '';
              thumb.appendChild(imgToCanvas(src, 160, 213));
            });

            const cards = myGrid.querySelectorAll('.theme-card');
            cards.forEach((el, i) => {
              const theme = list[i];
              if (!theme) return;
              el.addEventListener('click', () => {
                const rect = el.getBoundingClientRect();

                ctx.push('theme-detail',
                  { theme, isSystem: false },
                  {
                    origin: {
                      x: rect.left,
                      y: rect.top,
                      w: rect.width,
                      h: rect.height,
                    },
                  }
                );
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

          return () => {
            hideMenu();
          };
        },
      },

      'theme-detail': {
        name: 'theme-detail',
        transition: 'zoom',
        render(routeCtx) {
          const theme = routeCtx.data?.theme;
          if (!theme) return `<div class="settings-page"><div class="settings-row"><span>主题不存在</span></div></div>`;

          return `
            <div class="theme-detail">
              <div class="theme-detail__scroll">
                <div class="theme-detail__name">${escapeHtml(theme.name)}</div>
                <div class="theme-detail__hero" id="themeHero"></div>
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

          const hero = root.querySelector('#themeHero');
          if (hero) {
            const src = theme.storeimg || theme.static || '';
            if (src) hero.appendChild(imgToCanvasNatural(src, 800));
          }

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
              refresh();
            } catch (e) { console.error('[theme] 应用失败', e); }
          });
        },
      },
      backup: {
        name: 'backup',

        render() {
          return `
            <div class="settings-page">
              <div class="settings-title">备份和恢复</div>

              <div class="settings-section" style="padding:0;overflow:hidden;">
                <div class="backup-hero">
                  <img src="./assets/com.wujios.settings/connect_to_pc.png"
                       alt="" draggable="false">
                </div>
                <div style="padding:14px 18px;font-size:14px;color:var(--wj-text-muted);line-height:1.6;">
                  将 iWuji 连接到电脑，进行数据备份 / 恢复
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-item" data-act="export" style="justify-content:center;">
                  <span>备份到电脑</span>
                </div>
                <div class="settings-item" data-act="import" style="justify-content:center;color:var(--wj-danger,#e0356b);">
                  <span>从电脑恢复</span>
                </div>
                <input type="file" id="backupFileInput" accept="application/json,.json" hidden>
              </div>

              <div class="backup-status" id="backupStatus"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const statusEl = root.querySelector('#backupStatus');
          const fileInput = root.querySelector('#backupFileInput');
          const exportBtn = root.querySelector('[data-act="export"]');
          const importBtn = root.querySelector('[data-act="import"]');

          let busy = false;

          function setStatus(text, kind) {
            statusEl.textContent = text || '';
            statusEl.classList.toggle('is-error', kind === 'error');
            statusEl.classList.toggle('is-ok', kind === 'ok');
          }

          function ensureBackup() {
            if (window.WujiBackup) return true;
            setStatus('备份模块未加载，请检查 backup.js 是否已在 index.html 引入', 'error');
            return false;
          }

          exportBtn.addEventListener('click', () => {
            if (busy || !ensureBackup()) return;
            WujiOverlay.open({ bundlename: 'com.wujios.settings', name: 'backup' });
          });

          importBtn.addEventListener('click', () => {
            if (busy || !ensureBackup()) return;
            fileInput.click();
          });

          fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (!file) return;

            let answer = '恢复';
            try {
              answer = await WujiDialog.show({
                bundlename: 'com.wujios.settings',
                title: '恢复备份',
                content: `将从「${file.name}」恢复全部数据，覆盖当前设备所有应用数据，并自动重启。\n确定继续？`,
                buttons: [
                  { value: '取消', color: 'var(--wj-primary, #3a6ff0)' },
                  { value: '恢复', color: 'var(--wj-danger, #e0356b)' },
                ],
              });
            } catch (_) {
              answer = '取消';
            }
            if (answer !== '恢复') return;

            busy = true;
            importBtn.style.pointerEvents = 'none';
            importBtn.style.opacity = '.55';
            setStatus('正在恢复…');

            try {
              const text = await file.text();
              const json = JSON.parse(text);
              await WujiBackup.importAll(json);
              setStatus('恢复完成，正在重启…', 'ok');
              setTimeout(() => WujiBackup.triggerRestart(), 400);
            } catch (e) {
              console.error('[settings/backup]', e);
              setStatus('恢复失败：' + (e.message || '未知错误'), 'error');
              busy = false;
              importBtn.style.pointerEvents = '';
              importBtn.style.opacity = '';
            }
          });
        },
      },
    },
  });
})();