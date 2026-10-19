window.WujiControlCenter = (() => {
  const CC_KEYS = ['wifi', 'bluetooth', 'soundmode', 'cellular'];
  
  const ICON_RING = `<svg viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2v2"/>
    <path d="M18 8.5A6 6 0 0 0 6 8.5c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>`;

  const ICON_MUTE = `<svg viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2v2"/>
    <path d="M18 8.5A6 6 0 0 0 6 8.5c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>`;

  let osEl = null;
  let notifyParent = () => { };

  let ccVolumeFill = null;
  let ccBrightnessFill = null;

  const ccState = {};
  let volume = 60;
  let brightness = 80;
  let bound = false;

  function applyToggleUI() {
    CC_KEYS.forEach(k => {
      const el = document.querySelector(`.cc-toggle[data-key="${k}"]`);
      if (!el) return;

      const on = !!ccState[k];
      el.classList.toggle('is-on', on);

      if (k === 'soundmode') {
        const labelEl = el.querySelector('.cc-label');
        const iconEl  = el.querySelector('.cc-icon');
        if (labelEl) labelEl.textContent = on ? '静音' : '响铃';
        if (iconEl)  iconEl.innerHTML    = on ? ICON_MUTE : ICON_RING;
      }
    });
  }

  function applyVolumeUI() {
    if (ccVolumeFill) ccVolumeFill.style.height = volume + '%';
  }

  function applyBrightnessUI() {
    if (ccBrightnessFill) ccBrightnessFill.style.height = brightness + '%';
  }

  function emitToggleChange(key, value) {
    try {
      window.dispatchEvent(new CustomEvent('wuji:cc-toggle-change', {
        detail: { key, value: !!value },
      }));
    } catch { }
  }

  function emitVolumeChange(v) {
    try {
      window.dispatchEvent(new CustomEvent('wuji:cc-volume-change', {
        detail: { volume: v },
      }));
    } catch { }
  }
  function emitBrightnessChange(v) {
    try {
      window.dispatchEvent(new CustomEvent('wuji:cc-brightness-change', {
        detail: { brightness: v },
      }));
    } catch { }
  }

  /* ---------------- ★ 音量唯一入口 ----------------
     - 写内存 volume
     - 写 Store（持久化）
     - 更新 UI
     - emit=true 时通知外层（拖滑块路径才需要）
     -------------------------------------------------- */
  function _applyVolume(v, { emit } = {}) {
    volume = Math.max(0, Math.min(100, v));
    Store.set('wujios.volume', volume);
    applyVolumeUI();
    emitVolumeChange(volume);            /* ★ 新增 */
    if (emit) notifyParent('volume-set', { volume });
  }
  function _applyBrightness(v) {
    brightness = Math.max(0, Math.min(100, v));
    Store.set('wujios.brightness', brightness);
    applyBrightnessUI();
    emitBrightnessChange(brightness);
  }
  /* ---------------- 滑块 ---------------- */
  function bindSlider(el, { setValue }) {
    if (!el) return;

    const computeFromEvent = e => {
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const p = 1 - Math.max(0, Math.min(1, y / rect.height));
      return Math.round(p * 100);
    };

    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { }
      setValue(computeFromEvent(e));
    });
    el.addEventListener('pointermove', e => {
      if (!el.hasPointerCapture?.(e.pointerId)) return;
      setValue(computeFromEvent(e));
    });
    el.addEventListener('pointerup', e => {
      try { el.releasePointerCapture(e.pointerId); } catch { }
    });
    el.addEventListener('pointercancel', e => {
      try { el.releasePointerCapture(e.pointerId); } catch { }
    });
  }

  function bindToggleEvents() {
    document.querySelectorAll('.cc-toggle').forEach(el => {
      if (el._bound) return;
      el._bound = true;

      el.addEventListener('click', () => {
        const key = el.dataset.key;
        if (!CC_KEYS.includes(key)) return;

        ccState[key] = !ccState[key];
        Store.set('wujios.' + key, ccState[key]);

        applyToggleUI();

        emitToggleChange(key, ccState[key]);

        if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
      });
    });
  }

  /* ---------------- 一次性绑定 ---------------- */
  function bindEvents() {
    if (bound) return;
    bound = true;

    bindToggleEvents();

    bindSlider(document.querySelector('[data-slider="volume"]'), {
      setValue: v => _applyVolume(v, { emit: true }),
    });

    bindSlider(document.querySelector('[data-slider="brightness"]'), {
      setValue: v => _applyBrightness(v),
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init(options) {
    osEl = options.osEl;
    notifyParent = options.notifyParent || (() => { });

    ccVolumeFill     = document.getElementById('ccVolumeFill');
    ccBrightnessFill = document.getElementById('ccBrightnessFill');

    CC_KEYS.forEach(k => { ccState[k] = !!Store.get('wujios.' + k, false); });
    volume     = Store.get('wujios.volume', 60);
    brightness = Store.get('wujios.brightness', 80);

    applyToggleUI();
    applyVolumeUI();
    applyBrightnessUI();

    bindEvents();
  }

  /* ---------------- 导出 ---------------- */
  return {
    init,

    close()   { window.PanelSystem?.close(); },
    isOpen()  {
      return !!window.PanelSystem?.isOpen && window.PanelSystem.panel === 'cc';
    },
    openFromRight() { window.PanelSystem?.open('cc'); },
    switchToNotificationCenter() { window.PanelSystem?.setPanel('nc'); },

    /* ★ 内部已写 Store，外部调用者不用再写 */
    setVolume(v) { _applyVolume(v); },
    getVolume()  { return volume; },

    setBrightness(v) { _applyBrightness(v); },
    getBrightness()  { return brightness; },

    setToggle(key, value) {
      if (!CC_KEYS.includes(key)) return;
      ccState[key] = !!value;
      Store.set('wujios.' + key, ccState[key]);
      applyToggleUI();
      emitToggleChange(key, ccState[key]);
    },
    getToggle(key) {
      if (!CC_KEYS.includes(key)) return false;
      return !!ccState[key];
    },
  };
})();