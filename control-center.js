/* =========================================================
   control-center.js —— 控制中心（内容 + 状态）

   面板的位置 / 手势 / 层级 全部由 PanelSystem 负责。
   本模块只关心：
     - toggle 状态
     - volume / brightness 滑块
     - 与系统其他部分的通信（notifyParent / CustomEvent）
   ========================================================= */
window.WujiControlCenter = (() => {
  const CC_KEYS = ['wifi', 'bluetooth', 'soundmode', 'cellular'];
  
  const ICON_RING = `<svg viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>`;

  const ICON_MUTE = `<svg viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
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
        Store.set('control.' + key, ccState[key]);

        /* ★ 整体重绘，会一并更新 nb 的文字和图标 */
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
      setValue: v => {
        volume = Math.max(0, Math.min(100, v));
        Store.set('control.volume', volume);
        applyVolumeUI();
        notifyParent('volume-set', { volume });
      },
    });

    bindSlider(document.querySelector('[data-slider="brightness"]'), {
      setValue: v => {
        brightness = Math.max(0, Math.min(100, v));
        Store.set('control.brightness', brightness);
        applyBrightnessUI();
      },
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init(options) {
    osEl = options.osEl;
    notifyParent = options.notifyParent || (() => { });

    ccVolumeFill     = document.getElementById('ccVolumeFill');
    ccBrightnessFill = document.getElementById('ccBrightnessFill');

    CC_KEYS.forEach(k => { ccState[k] = !!Store.get('control.' + k, false); });
    volume     = Store.get('control.volume', 60);
    brightness = Store.get('control.brightness', 80);

    try { Store.remove('control.nb'); } catch { }

    applyToggleUI();
    applyVolumeUI();
    applyBrightnessUI();

    bindEvents();
  }

  /* ---------------- 导出 ---------------- */
  return {
    init,

    /* 打开 / 关闭 / 判断 全部委托给 PanelSystem */
    close()   { window.PanelSystem?.close(); },
    isOpen()  {
      return !!window.PanelSystem?.isOpen && window.PanelSystem.panel === 'cc';
    },
    openFromRight() { window.PanelSystem?.open('cc'); },
    switchToNotificationCenter() { window.PanelSystem?.setPanel('nc'); },

    /* 音量 / 亮度 */
    setVolume(v) {
      volume = Math.max(0, Math.min(100, v));
      applyVolumeUI();
    },
    getVolume() { return volume; },

    setBrightness(v) {
      brightness = Math.max(0, Math.min(100, v));
      applyBrightnessUI();
    },
    getBrightness() { return brightness; },

    /* toggle */
    setToggle(key, value) {
      if (!CC_KEYS.includes(key)) return;
      ccState[key] = !!value;
      Store.set('control.' + key, ccState[key]);
      applyToggleUI();
      emitToggleChange(key, ccState[key]);
    },
    getToggle(key) {
      if (!CC_KEYS.includes(key)) return false;
      return !!ccState[key];
    },
  };
})();