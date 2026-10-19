(() => {
  const BUNDLE = 'com.wujinb.piano';

  const WHITE_NOTES = [
    { name: 'G3', num: '5', freq: 196.00 },
    { name: 'A3', num: '6', freq: 220.00 },
    { name: 'B3', num: '7', freq: 246.94 },
    { name: 'C4', num: '1', freq: 261.63 },
    { name: 'D4', num: '2', freq: 293.66 },
    { name: 'E4', num: '3', freq: 329.63 },
    { name: 'F4', num: '4', freq: 349.23 },
    { name: 'G4', num: '5', freq: 392.00 },
    { name: 'A4', num: '6', freq: 440.00 },
    { name: 'B4', num: '7', freq: 493.88 },
    { name: 'C5', num: '1', freq: 523.25 },
    { name: 'D5', num: '2', freq: 587.33 },
    { name: 'E5', num: '3', freq: 659.25 },
    { name: 'F5', num: '4', freq: 698.46 },
    { name: 'G5', num: '5', freq: 783.99 },
  ];

  const BLACK_NOTES = [
    { afterIdx: 1,  name: 'G#3', freq: 207.65 },
    { afterIdx: 2,  name: 'A#3', freq: 233.08 },
    { afterIdx: 4,  name: 'C#4', freq: 277.18 },
    { afterIdx: 5,  name: 'D#4', freq: 311.13 },
    { afterIdx: 7,  name: 'F#4', freq: 369.99 },
    { afterIdx: 8,  name: 'G#4', freq: 415.30 },
    { afterIdx: 9,  name: 'A#4', freq: 466.16 },
    { afterIdx: 11, name: 'C#5', freq: 554.37 },
    { afterIdx: 12, name: 'D#5', freq: 622.25 },
    { afterIdx: 14, name: 'F#5', freq: 739.99 },
  ];

  const INIT_FIRST_IDX = 3;
  const INIT_LAST_IDX  = 7;

  // ---------- 系统音量 ----------
  function clampVolume(v) {
    const n = Number(v);
    if (!isFinite(n)) return 60;
    return Math.max(0, Math.min(100, n));
  }

  function readVolume() {
    try {
      if (window.HardwareUI?.getVolume) return clampVolume(HardwareUI.getVolume());
      if (window.WujiControlCenter?.getVolume) return clampVolume(WujiControlCenter.getVolume());
      if (window.Store) return clampVolume(Store.get('wujios.volume', 60));
    } catch (_) {}
    return 60;
  }

  // ★ 只跟随媒体音量；soundmode（静音/响铃）控制的是铃声，不影响钢琴
  function currentPeak() {
    const v = readVolume() / 100;
    const p = Math.pow(v, 1.6) * 0.9;
    return p < 0.001 ? 0 : p;
  }

  // ---------- AudioContext ----------
  let ctx = null;

  function ensureCtx() {
    if (ctx && ctx.state !== 'closed') {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      console.warn('[piano] AudioContext 创建失败', e);
      ctx = null;
      return null;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function disposeCtx() {
    if (!ctx) return;
    const old = ctx;
    ctx = null;
    try {
      if (old.state !== 'closed') old.close().catch(() => {});
    } catch (_) {}
  }

  function playNote(freq) {
    const ac = ensureCtx();
    if (!ac) return;

    const peak = currentPeak();
    if (peak <= 0) return;   // 媒体音量为 0 时不出声

    const now = ac.currentTime;

    const master = ac.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(peak, now + 0.008);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    master.connect(ac.destination);

    [
      { mult: 1, type: 'triangle', weight: 1.0 },
      { mult: 2, type: 'sine',     weight: 0.5 },
      { mult: 3, type: 'sine',     weight: 0.25 },
      { mult: 4, type: 'sine',     weight: 0.12 },
    ].forEach(p => {
      const osc = ac.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.mult;
      const g = ac.createGain();
      g.gain.value = p.weight;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '迷你钢琴',
    icon: './assets/piano.svg',
    initialRoute: 'home',
    version: '1.0.5',

    onShutdown() {
      disposeCtx();
    },

    styles: `
      .piano-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        min-height: 0;
      }

      .piano-header {
        flex: 0 0 auto;
        padding: 10px 14px;
        border-bottom: 1px solid var(--wj-border, #e6e9ef);
      }
      .piano-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
        line-height: 1.2;
      }

      .piano-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 10px;
        box-sizing: border-box;
        touch-action: pan-x;
      }
      .piano-scroll::-webkit-scrollbar { height: 3px; }
      .piano-scroll::-webkit-scrollbar-thumb {
        background: var(--wj-border-strong, #c9d3e6);
        border-radius: 2px;
      }

      .piano-track {
        --kw: 60px;
        --bw: 36px;
        --gap: 3px;
        display: flex;
        flex-direction: column;
        height: 100%;
        width: max-content;
        min-width: max-content;
      }

      .piano-keys {
        flex: 1 1 auto;
        position: relative;
        display: flex;
        gap: var(--gap);
        min-height: 0;
      }

      .piano-drag-zone {
        flex: 0 0 auto;
        height: 40px;
        margin-top: 8px;
        border-radius: 6px;
        background: var(--wj-bg-alt, #f0f3f8);
        cursor: grab;
        touch-action: pan-x;
      }
      .piano-drag-zone:active { cursor: grabbing; }

      .piano-key {
        position: relative;
        border: 0;
        font: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        touch-action: pan-x;
        padding: 0;
        transition: background .06s, transform .06s, box-shadow .06s;
      }

      .piano-white {
        flex: 0 0 var(--kw);
        width: var(--kw);
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 14px;
        border-radius: 8px;
        background: #ffffff;
        color: #333;
        box-shadow: inset 0 -3px 0 #d6dbe7, 0 1px 3px rgba(0, 0, 0, .1);
      }
      .piano-white.is-pending { background: #eef3fa; }
      .piano-white.is-pressed {
        background: #e8eef8;
        box-shadow: inset 0 -1px 0 #c9d3e6;
        transform: translateY(1px);
      }
      .piano-white__num {
        font-size: 16px;
        font-weight: 700;
        color: #555;
        line-height: 1;
      }

      .piano-black {
        position: absolute;
        top: 0;
        z-index: 2;
        width: var(--bw);
        height: 60%;
        border-radius: 0 0 5px 5px;
        background: #2a2a2a;
        box-shadow: inset 0 -3px 0 #000, 0 2px 5px rgba(0, 0, 0, .35);
      }
      .piano-black.is-pending { background: #3a3a3a; }
      .piano-black.is-pressed {
        background: #444;
        box-shadow: inset 0 -1px 0 #000;
        transform: translateY(1px);
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          const whiteHtml = WHITE_NOTES.map((n, i) => `
            <button class="piano-key piano-white"
                    data-freq="${n.freq}" data-name="${n.name}" data-idx="${i}"
                    type="button">
              <span class="piano-white__num">${n.num}</span>
            </button>
          `).join('');

          const blackHtml = BLACK_NOTES.map(b => `
            <button class="piano-key piano-black"
                    data-freq="${b.freq}" data-name="${b.name}"
                    style="left: calc((var(--kw) + var(--gap)) * ${b.afterIdx} - var(--gap) / 2 - var(--bw) / 2)"
                    type="button"></button>
          `).join('');

          return `
            <div class="piano-page">
              <div class="piano-header">
                <div class="piano-title">迷你钢琴</div>
              </div>
              <div class="piano-scroll" id="pianoScroll">
                <div class="piano-track">
                  <div class="piano-keys">
                    ${whiteHtml}
                    ${blackHtml}
                  </div>
                  <div class="piano-drag-zone" id="pianoDragZone"></div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root) {
          const scrollEl = root.querySelector('#pianoScroll');
          const dragZone = root.querySelector('#pianoDragZone');
          const keyEls   = root.querySelectorAll('.piano-key');

          function centerInitial() {
            const kw = 60, gap = 3;
            const firstLeft  = INIT_FIRST_IDX * (kw + gap);
            const lastRight  = INIT_LAST_IDX  * (kw + gap) + kw;
            const rangeCenter = (firstLeft + lastRight) / 2;
            const target = rangeCenter - scrollEl.clientWidth / 2;
            scrollEl.scrollLeft = Math.max(0, target);
          }
          requestAnimationFrame(() => requestAnimationFrame(centerInitial));

          let blockActive = false;
          function blockNav() {
            if (blockActive) return;
            blockActive = true;
            root.dataset.blockBackGesture = '1';
          }
          function unblockNav() {
            if (!blockActive) return;
            blockActive = false;
            delete root.dataset.blockBackGesture;
          }

          function press(el) {
            const freq = parseFloat(el.dataset.freq);
            if (!freq || isNaN(freq)) return;
            playNote(freq);
            el.classList.add('is-pressed');
            setTimeout(() => el.classList.remove('is-pressed'), 140);
            if (navigator.vibrate) {
              try { navigator.vibrate(8); } catch (_) {}
            }
          }

          let keyState = null;
          let mouseDrag = null;

          function onKeyDown(e) {
            e.stopPropagation();
            blockNav();
            keyState = {
              el: e.currentTarget,
              startX: e.clientX,
              startY: e.clientY,
              startScroll: scrollEl.scrollLeft,
              pointerType: e.pointerType,
              moved: false,
            };
            keyState.el.classList.add('is-pending');
          }

          function onGlobalMove(e) {
            if (!keyState) return;
            const dx = e.clientX - keyState.startX;
            const dy = e.clientY - keyState.startY;

            if (!keyState.moved) {
              if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                keyState.moved = true;
                keyState.el.classList.remove('is-pending');
              }
            }
            if (keyState.moved && keyState.pointerType === 'mouse') {
              scrollEl.scrollLeft = keyState.startScroll - dx;
            }
          }

          function onGlobalUp() {
            if (keyState) {
              const state = keyState;
              keyState = null;
              state.el.classList.remove('is-pending');
              if (!state.moved) press(state.el);
            }
            mouseDrag = null;
            unblockNav();
          }

          function onGlobalCancel() {
            if (keyState) {
              keyState.el.classList.remove('is-pending');
              keyState = null;
            }
            mouseDrag = null;
            unblockNav();
          }

          keyEls.forEach(el => {
            el.addEventListener('pointerdown', onKeyDown);
            el.addEventListener('contextmenu', e => e.preventDefault());
          });

          function onDragZoneDown(e) {
            e.stopPropagation();
            blockNav();
            if (e.pointerType !== 'mouse') return;
            e.preventDefault();
            mouseDrag = { startX: e.clientX, startScroll: scrollEl.scrollLeft };
            try { dragZone.setPointerCapture(e.pointerId); } catch (_) {}
          }
          function onDragZoneMove(e) {
            if (!mouseDrag) return;
            scrollEl.scrollLeft = mouseDrag.startScroll - (e.clientX - mouseDrag.startX);
          }

          dragZone.addEventListener('pointerdown', onDragZoneDown);
          dragZone.addEventListener('pointermove', onDragZoneMove);
          dragZone.addEventListener('contextmenu', e => e.preventDefault());

          window.addEventListener('pointermove', onGlobalMove);
          window.addEventListener('pointerup', onGlobalUp);
          window.addEventListener('pointercancel', onGlobalCancel);

          function onWheel(e) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              scrollEl.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }
          scrollEl.addEventListener('wheel', onWheel, { passive: false });

          return () => {
            window.removeEventListener('pointermove', onGlobalMove);
            window.removeEventListener('pointerup', onGlobalUp);
            window.removeEventListener('pointercancel', onGlobalCancel);
            dragZone.removeEventListener('pointerdown', onDragZoneDown);
            dragZone.removeEventListener('pointermove', onDragZoneMove);
            scrollEl.removeEventListener('wheel', onWheel);
            unblockNav();
            disposeCtx();
          };
        },
      },
    },
  });
})();