window.WujiControlCenter = (() => {
  const CC_KEYS = ['wifi', 'bluetooth', 'nb', 'cellular'];

  let osEl = null;
  let notifyParent = () => { };

  let controlCenter = null;
  let ccBackdropEl = null;
  let ccVolumeFill = null;
  let ccBrightnessFill = null;

  const ccState = {};
  let volume = 60;
  let brightness = 80;
  let ccOpen = false;
  let ccDragState = null;
  let bound = false;

  function applyToggleUI() {
    CC_KEYS.forEach(k => {
      const el = document.querySelector(`.cc-toggle[data-key="${k}"]`);
      if (el) el.classList.toggle('is-on', !!ccState[k]);
    });
  }

  function emitToggleChange(key, value) {
    try {
      window.dispatchEvent(new CustomEvent('wuji:cc-toggle-change', {
        detail: { key, value: !!value },
      }));
    } catch { }
  }

  function applyVolumeUI() {
    if (ccVolumeFill) ccVolumeFill.style.height = volume + '%';
  }

  function applyBrightnessUI() {
    if (ccBrightnessFill) ccBrightnessFill.style.height = brightness + '%';
  }

  function setCCOpen(open) {
    ccOpen = open;

    controlCenter.style.transition = 'transform .35s cubic-bezier(.2,.7,.3,1)';
    controlCenter.style.transform = open ? 'translateY(0)' : 'translateY(-100%)';

    ccBackdropEl.style.transition = 'opacity .35s cubic-bezier(.2,.7,.3,1)';
    ccBackdropEl.style.opacity = open ? '1' : '0';

    osEl.classList.toggle('cc-open', open);
  }

  function close() {
    ccDragState = null;
    ccOpen = false;
    if (!controlCenter) return;

    controlCenter.style.transition = 'transform .35s cubic-bezier(.2,.7,.3,1)';
    controlCenter.style.transform = 'translateY(-100%)';

    ccBackdropEl.style.transition = 'opacity .35s cubic-bezier(.2,.7,.3,1)';
    ccBackdropEl.style.opacity = '0';

    osEl.classList.remove('cc-open');
  }

  function ccBeginOpen(y) {
    const h = controlCenter.offsetHeight;
    ccDragState = {
      mode: 'open',
      startY: y,
      startPos: -h,
      curPos: -h,
      height: h,
      captured: true,
      lastY: y,
      lastT: performance.now(),
      velocity: 0,
    };
    controlCenter.style.transition = 'none';
    controlCenter.style.transform = `translateY(${-h}px)`;

    ccBackdropEl.style.transition = 'none';
    ccBackdropEl.style.opacity = '0';

    osEl.classList.add('cc-open');
  }

  function ccBeginClose(y) {
    ccDragState = {
      mode: 'close',
      startY: y,
      startPos: 0,
      curPos: 0,
      height: controlCenter.offsetHeight,
      captured: false,
      lastY: y,
      lastT: performance.now(),
      velocity: 0,
    };
  }

  /* ---------- 拖动中 ---------- */
  function ccMove(y, preventFn) {
    if (!ccDragState) return;
    const dy = y - ccDragState.startY;

    if (ccDragState.mode === 'close' && !ccDragState.captured) {
      if (Math.abs(dy) < 6) return;
      ccDragState.captured = true;
      controlCenter.style.transition = 'none';
      ccBackdropEl.style.transition = 'none';
    }

    if (preventFn) preventFn();

    let pos = ccDragState.startPos + dy;
    pos = Math.max(-ccDragState.height, Math.min(0, pos));
    ccDragState.curPos = pos;
    controlCenter.style.transform = `translateY(${pos}px)`;

    const now = performance.now();
    const dt = now - ccDragState.lastT;
    if (dt > 0) {
      const instant = (y - ccDragState.lastY) / dt;
      ccDragState.velocity = ccDragState.velocity * 0.6 + instant * 0.4;
      ccDragState.lastY = y;
      ccDragState.lastT = now;
    }

    const p = 1 - (-pos / ccDragState.height);
    ccBackdropEl.style.opacity = String(Math.max(0, Math.min(1, p)));
  }

  function ccEnd() {
    if (!ccDragState) return;
    const state = ccDragState;
    ccDragState = null;
    if (!state.captured) return;

    const VELOCITY = 0.35;
    let shouldOpen;

    if (state.mode === 'close') {
      const movedEnough = state.curPos < -state.height * 0.15;
      const fastEnough = state.velocity < -VELOCITY;
      shouldOpen = !(movedEnough || fastEnough);
    } else {
      const movedEnough = state.curPos > -state.height * 0.4;
      const fastEnough = state.velocity > VELOCITY;
      shouldOpen = movedEnough || fastEnough;
    }

    ccBackdropEl.style.transition = 'opacity .35s cubic-bezier(.2,.7,.3,1)';
    ccBackdropEl.style.opacity = shouldOpen ? '1' : '0';

    setCCOpen(shouldOpen);
  }

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

  function bindEvents() {
    if (bound) return;
    bound = true;

    document.querySelectorAll('.cc-toggle').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.key;
        ccState[key] = !ccState[key];
        Store.set('control.' + key, ccState[key]);
        el.classList.toggle('is-on', ccState[key]);
        emitToggleChange(key, ccState[key]);          /* 新增 */
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
      });
    });

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

    osEl.addEventListener('touchstart', e => {
      if (osEl.dataset.power !== 'running') return;
      if (osEl.dataset.view === 'locked') return;
      if (ccDragState) return;
      const t = e.touches[0];
      if (!t) return;

      const rect = osEl.getBoundingClientRect();
      const localY = t.clientY - rect.top;
      const relX = (t.clientX - rect.left) / rect.width;

      if (!ccOpen && localY < 30 && relX >= 0.5) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        ccBeginOpen(t.clientY);
        return;
      }

      if (ccOpen) {
        if (e.target.closest('.cc-slider-card')) return;
        ccBeginClose(t.clientY);
      }
    }, { capture: true, passive: false });

    document.addEventListener('touchmove', e => {
      if (!ccDragState) return;
      const t = e.touches[0];
      if (!t) return;
      ccMove(t.clientY, () => { if (e.cancelable) e.preventDefault(); });
    }, { passive: false });

    document.addEventListener('touchend', ccEnd);
    document.addEventListener('touchcancel', ccEnd);

    osEl.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      if (e.button !== 0) return;
      if (osEl.dataset.power !== 'running') return;
      if (osEl.dataset.view === 'locked') return;
      if (ccDragState) return;

      const rect = osEl.getBoundingClientRect();
      const localY = e.clientY - rect.top;
      const relX = (e.clientX - rect.left) / rect.width;

      if (!ccOpen && localY < 30 && relX >= 0.5) {
        e.stopPropagation();
        e.preventDefault();
        ccBeginOpen(e.clientY);
        return;
      }

      if (ccOpen) {
        if (e.target.closest('.cc-slider-card')) return;
        ccBeginClose(e.clientY);
      }
    }, { capture: true });

    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      if (!ccDragState) return;
      ccMove(e.clientY, null);
    });

    document.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse') return;
      ccEnd();
    });

    document.addEventListener('pointercancel', e => {
      if (e.pointerType !== 'mouse') return;
      ccEnd();
    });
  }

  function init(options) {
    osEl = options.osEl;
    notifyParent = options.notifyParent || (() => { });

    controlCenter = document.getElementById('controlCenter');
    ccBackdropEl = document.getElementById('ccBackdrop');
    ccVolumeFill = document.getElementById('ccVolumeFill');
    ccBrightnessFill = document.getElementById('ccBrightnessFill');

    CC_KEYS.forEach(k => { ccState[k] = !!Store.get('control.' + k, false); });
    volume = Store.get('control.volume', 60);
    brightness = Store.get('control.brightness', 80);

    applyToggleUI();
    applyVolumeUI();
    applyBrightnessUI();

    bindEvents();
  }

  return {
    init,
    close,
    isOpen() { return ccOpen; },
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