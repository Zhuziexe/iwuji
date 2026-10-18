(() => {
  const BUNDLE = 'com.wujios.clock';
  const NOTIF_ID = 1001;
  const pad2 = n => String(n).padStart(2, '0');

  const Timer = (() => {
    let total = 5 * 60;
    let remaining = total;
    let status = 'idle';          // idle | running | paused | overtime
    let endAt = 0;
    let tickId = null;
    let lastSec = -1;
    let overtimeStart = 0;
    const subs = new Set();

    function snapshot() {
      return { total, remaining, status, overtimeStart };
    }
    function emit() {
      const s = snapshot();
      subs.forEach(fn => { try { fn(s); } catch (e) { console.error('[Timer]', e); } });
    }
    function onChange(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }

    function publishNotif() {
      const secs = Math.max(0, Math.ceil(remaining));
      WujiNotification.publish({
        bundlename: BUNDLE,
        id: NOTIF_ID,
        title: '计时器',
        content: `${pad2(Math.floor(secs / 60))}:${pad2(secs % 60)}`,
        showtime: false,
        notifyuser: false,
        clickparams: { tab: 1 },
      });
    }
    function unpublishNotif() {
      WujiNotification.unpublish({ bundlename: BUNDLE, id: NOTIF_ID });
    }

    function stopTick() {
      if (tickId) { clearInterval(tickId); tickId = null; }
    }

    function tick() {
      if (status !== 'running') return;

      remaining = Math.max(0, (endAt - Date.now()) / 1000);
      const sec = Math.ceil(remaining);

      if (sec !== lastSec) {
        lastSec = sec;
        publishNotif();
        emit();
      }

      if (remaining <= 0) {
        remaining = 0;
        status = 'overtime';
        overtimeStart = Date.now();
        stopTick();
        unpublishNotif();

        if (navigator.vibrate) {
          try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
        }

        WujiOverlay.open({ bundlename: BUNDLE, name: 'timeoutoverlay' });
        emit();
      }
    }

    function startTick() {
      stopTick();
      lastSec = -1;
      tickId = setInterval(tick, 250);
      tick();
    }

    return {
      onChange,
      snapshot,
      getStatus:    () => status,
      getTotal:     () => total,
      getRemaining: () => remaining,

      setTotal(sec) {
        if (status !== 'idle') return;
        total = Math.max(0, Math.min(59 * 60 + 59, Math.round(sec)));
        remaining = total;
        emit();
      },

      start() {
        if (status === 'running') return;
        if (total <= 0) return;
        remaining = total;
        status = 'running';
        endAt = Date.now() + remaining * 1000;
        publishNotif();
        startTick();
        emit();
      },

      pause() {
        if (status !== 'running') return;
        remaining = Math.max(0, (endAt - Date.now()) / 1000);
        status = 'paused';
        stopTick();
        publishNotif();
        emit();
      },

      resume() {
        if (status !== 'paused') return;
        status = 'running';
        endAt = Date.now() + remaining * 1000;
        startTick();
        emit();
      },

      reset() {
        if (status === 'running') return;
        stopTick();
        status = 'idle';
        remaining = total;
        overtimeStart = 0;
        unpublishNotif();
        emit();
      },

      dismiss() {
        stopTick();
        status = 'idle';
        remaining = total;
        overtimeStart = 0;
        unpublishNotif();
        emit();
      },
    };
  })();

  WujiApps.register({
    bundlename: BUNDLE,
    name: '时钟',
    icon: './assets/clock.svg',
    initialRoute: 'home',
    version: '1.1.3',

    /* ★ 开机 / 关机钩子 */
    onBoot() {
      /* 脚本加载后 Timer 已是 idle，这里显式重置一次防脏（覆盖安装场景） */
      Timer.dismiss();
    },
    onShutdown() {
      Timer.dismiss();
    },

    styles: `
      .clock-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
      }

      .clock-tabview {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }

      .clock-tab {
        position: absolute;
        inset: 0;
        display: none;
        flex-direction: column;
        align-items: center;
        padding: 18px 20px 0;
        box-sizing: border-box;
      }
      .clock-tab.is-active { display: flex; }

      .clock-title {
        flex: 0 0 auto;
        align-self: flex-start;
        font-size: 22px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .5px;
        margin-bottom: 4px;
      }

      /* ============ 时钟页 ============ */
      .clock-stage {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .clock-dial {
        width: min(76vw, 300px);
        height: min(76vw, 300px);
        display: block;
      }
      .clock-time {
        flex: 0 0 auto;
        margin: 18px 0 14px;
        font-family: 'Consolas', 'SF Mono', monospace;
        font-size: 32px;
        font-weight: 600;
        letter-spacing: 2px;
        font-variant-numeric: tabular-nums;
        color: var(--wj-text);
      }

      /* ============ 计时器页 ============ */
      .timer-body {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        display: flex;
        flex-direction: column;
      }

      /* ---- idle ---- */
      .timer-idle {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 26px;
        padding-bottom: 12px;
      }

      /* 两轮卡片 */
      .timer-wheel-card {
        position: relative;
        width: 240px;
        height: 132px;
        border-radius: 22px;
        background: var(--wj-bg-alt);
        overflow: hidden;
        touch-action: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .timer-wheel-card::after {
        content: '';
        position: absolute;
        left: 16px;
        right: 16px;
        top: 50%;
        height: 44px;
        transform: translateY(-50%);
        border-radius: 12px;
        background: rgba(58, 111, 240, .10);
        pointer-events: none;
        z-index: 0;
      }

      .timer-wheel {
        position: relative;
        width: 82px;
        height: 100%;
        overflow: hidden;
        z-index: 1;
      }
      .timer-wheel__inner {
        position: absolute;
        left: 0; right: 0;
        top: 0;
        will-change: transform;
      }
      .timer-wheel__item {
        height: 44px;
        line-height: 44px;
        text-align: center;
        font-size: 27px;
        font-weight: 700;
        color: var(--wj-text-dim);
        font-variant-numeric: tabular-nums;
        letter-spacing: 1px;
        transition: color .15s ease, transform .15s ease, opacity .12s ease;
      }
      .timer-wheel__item.is-active {
        color: var(--wj-text);
        transform: scale(1.14);
      }
      .timer-wheel__sep {
        position: relative;
        z-index: 1;
        font-size: 26px;
        font-weight: 700;
        color: var(--wj-text);
        line-height: 1;
        transform: translateY(-1px);
        user-select: none;
      }

      .timer-btn {
        min-width: 180px;
        padding: 16px 28px;
        border: 0;
        border-radius: 999px;
        font: inherit;
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 2px;
        cursor: pointer;
        transition: transform .1s ease, filter .15s ease, opacity .15s;
        -webkit-tap-highlight-color: transparent;
        color: #fff;
        background: #3a6ff0;
        box-shadow: 0 8px 22px rgba(58, 111, 240, .38);
      }
      .timer-btn:active { transform: scale(.97); }

      /* ---- running / paused ---- */
      .timer-running {
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 34px;
        padding-bottom: 16px;
      }

      .timer-ring-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .timer-ring {
        width: min(46vw, 190px);
        height: min(46vw, 190px);
        display: block;
      }
      .timer-ring__progress {
        transition: stroke-dashoffset .25s linear;
      }

      .timer-ring__time {
        font-family: 'Consolas', 'SF Mono', monospace;
        font-size: 26px;
        font-weight: 700;
        color: var(--wj-text);
        font-variant-numeric: tabular-nums;
        letter-spacing: 1px;
      }

      .timer-actions {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .timer-round-btn {
        width: 62px;
        height: 62px;
        border-radius: 50%;
        border: 0;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font-size: 24px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
        transition: transform .1s ease, background .15s ease, opacity .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .timer-round-btn:active:not(:disabled) { transform: scale(.92); }
      .timer-round-btn:disabled { opacity: .35; cursor: default; }
      .timer-round-btn--primary { background: #3a6ff0; color: #fff; }
      .timer-round-btn svg { width: 24px; height: 24px; display: block; }

      .clock-tabs {
        position: relative;
        z-index: 2;
        flex: 0 0 auto;
        display: flex;
        border-top: 1px solid rgba(0, 0, 0, .07);
        padding: 4px 0 calc(6px + env(safe-area-inset-bottom, 0px));
        background: var(--wj-bg);
      }

      .clock-tab-btn {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 8px 0;
        border: 0;
        background: transparent;
        color: var(--wj-text-dim);
        font: inherit;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: color .15s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .clock-tab-btn__icon {
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .clock-tab-btn__icon svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .clock-tab-btn.is-active { color: #3a6ff0; }

      .ov-timeout {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        padding: 40px 30px calc(48px + env(safe-area-inset-bottom, 0px));
        background: rgba(12, 18, 36, .72);
        backdrop-filter: blur(26px) saturate(150%);
        -webkit-backdrop-filter: blur(26px) saturate(150%);
        color: #fff;
        text-align: center;
        user-select: none;
        -webkit-user-select: none;
      }

      .ov-timeout__title {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 2px;
        text-shadow: 0 2px 10px rgba(0, 0, 0, .4);
      }

      .ov-timeout__count {
        font-family: 'Consolas', 'SF Mono', monospace;
        font-size: 72px;
        font-weight: 700;
        letter-spacing: 3px;
        font-variant-numeric: tabular-nums;
        color: #fff;
        text-shadow:
          0 4px 18px rgba(0, 0, 0, .45),
          0 0 40px rgba(120, 160, 255, .35);
      }

      .ov-slider {
        position: relative;
        width: min(320px, 84vw);
        height: 62px;
        border-radius: 999px;
        background: rgba(255, 255, 255, .14);
        border: 1px solid rgba(255, 255, 255, .16);
        overflow: hidden;
        margin-top: 26px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .14);
      }
      .ov-slider__fill {
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 62px;
        border-radius: 999px;
        background: rgba(255, 255, 255, .22);
        transition: width .05s linear;
        pointer-events: none;
      }
      .ov-slider__hint {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 500;
        color: rgba(255, 255, 255, .82);
        letter-spacing: 2px;
        pointer-events: none;
      }
      .ov-slider__knob {
        position: absolute;
        left: 4px;
        top: 4px;
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: #fff;
        color: #3a6ff0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        touch-action: none;
        box-shadow: 0 6px 18px rgba(0, 0, 0, .3);
        will-change: transform;
      }
      .ov-slider__knob:active { cursor: grabbing; }
      .ov-slider__knob svg { width: 24px; height: 24px; display: block; }
    `,

    overlays: [
      {
        name: 'timeoutoverlay',

        render() {
          return `
            <div class="ov-timeout">
              <div class="ov-timeout__title">计时器超时</div>
              <div class="ov-timeout__count" id="ovCount">00:00</div>

              <div class="ov-slider" id="ovSlider">
                <div class="ov-slider__fill" id="ovFill"></div>
                <div class="ov-slider__hint" id="ovHint">滑动来关闭</div>
                <div class="ov-slider__knob" id="ovKnob">
                  <svg viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.6"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"/>
                    <path d="M13 6l6 6-6 6"/>
                  </svg>
                </div>
              </div>
            </div>
          `;
        },

        mount(root) {
          const countEl  = root.querySelector('#ovCount');
          const sliderEl = root.querySelector('#ovSlider');
          const fillEl   = root.querySelector('#ovFill');
          const knobEl   = root.querySelector('#ovKnob');

          let intervalId = setInterval(() => {
            if (!countEl.isConnected) return;
            const st = Timer.snapshot();
            const s = Math.max(0, Math.floor((Date.now() - st.overtimeStart) / 1000));
            countEl.textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
          }, 250);

          let dragging = false;
          let startX = 0;
          let pos = 0;
          let maxX = 0;

          function applyPos(v, animate) {
            pos = Math.max(0, Math.min(maxX, v));
            knobEl.style.transition = animate
              ? 'transform .2s cubic-bezier(.2,.7,.3,1)'
              : 'none';
            knobEl.style.transform = `translateX(${pos}px)`;
            fillEl.style.width = (pos + 62) + 'px';
          }

          function computeMax() {
            maxX = Math.max(0, sliderEl.clientWidth - knobEl.offsetWidth - 8);
          }

          function onDown(e) {
            e.preventDefault();
            e.stopPropagation();
            computeMax();
            dragging = true;
            startX = e.clientX - pos;
            try { knobEl.setPointerCapture(e.pointerId); } catch {}
          }

          function onMove(e) {
            if (!dragging) return;
            applyPos(e.clientX - startX, false);
          }

          function onUp(e) {
            if (!dragging) return;
            dragging = false;
            try { knobEl.releasePointerCapture(e.pointerId); } catch {}

            if (pos >= maxX * 0.72) {
              applyPos(maxX, true);
              setTimeout(() => {
                Timer.dismiss();
                WujiOverlay.close();
              }, 120);
            } else {
              applyPos(0, true);
            }
          }

          knobEl.addEventListener('pointerdown', onDown);
          knobEl.addEventListener('pointermove', onMove);
          knobEl.addEventListener('pointerup', onUp);
          knobEl.addEventListener('pointercancel', onUp);

          root._ovCleanup = () => {
            if (intervalId) { clearInterval(intervalId); intervalId = null; }
            knobEl.removeEventListener('pointerdown', onDown);
            knobEl.removeEventListener('pointermove', onMove);
            knobEl.removeEventListener('pointerup', onUp);
            knobEl.removeEventListener('pointercancel', onUp);
          };

          requestAnimationFrame(() => { computeMax(); applyPos(0, false); });
        },

        unmount(root) {
          root._ovCleanup?.();
        },
      },
    ],

    routes: {
      home: {
        name: 'home',

        render(routeCtx) {
          const startTab = routeCtx?.data?.tab === 1 ? 'timer' : 'clock';

          return `
            <div class="clock-page">
              <div class="clock-tabview">

                <div class="clock-tab ${startTab === 'clock' ? 'is-active' : ''}"
                     data-tab="clock">
                  <div class="clock-title">时钟</div>

                  <div class="clock-stage">
                    <svg class="clock-dial" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r="94"
                              fill="#ffffff" stroke="#e3e9f2" stroke-width="2"/>
                      <g id="clockTicks" stroke="#c8d2e0"></g>
                      <g id="clockNumbers"
                         fill="#1c2536"
                         font-size="14"
                         font-weight="600"
                         text-anchor="middle"
                         dominant-baseline="central"
                         font-family="var(--wj-font, sans-serif)"></g>

                      <line id="clockHour"
                            x1="100" y1="100" x2="100" y2="52"
                            stroke="#1c2536" stroke-width="5.5" stroke-linecap="round"/>
                      <line id="clockMinute"
                            x1="100" y1="100" x2="100" y2="34"
                            stroke="#1c2536" stroke-width="3.2" stroke-linecap="round"/>
                      <line id="clockSecond"
                            x1="100" y1="108" x2="100" y2="24"
                            stroke="#e0356b" stroke-width="1.6" stroke-linecap="round"/>

                      <circle cx="100" cy="100" r="4.5" fill="#1c2536"/>
                      <circle cx="100" cy="100" r="1.8" fill="#ffffff"/>
                    </svg>
                  </div>

                  <div class="clock-time" id="clockTime">00:00:00</div>
                </div>

                <div class="clock-tab ${startTab === 'timer' ? 'is-active' : ''}"
                     data-tab="timer">
                  <div class="clock-title">计时器</div>
                  <div class="timer-body" id="timerBody"></div>
                </div>

              </div>

              <div class="clock-tabs">
                <button class="clock-tab-btn ${startTab === 'clock' ? 'is-active' : ''}"
                  data-goto="clock" type="button">
                  <span class="clock-tab-btn__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 2"/>
  </svg></span>
                  <span>时钟</span>
                </button>
                <button class="clock-tab-btn ${startTab === 'timer' ? 'is-active' : ''}" 
                  data-goto="timer" type="button">
                  <span class="clock-tab-btn__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="13" r="8"/>
    <path d="M12 9v4l2.5 2"/>
    <path d="M9 2h6"/>
    <path d="M12 2v3"/>
  </svg></span>
                  <span>计时器</span>
                </button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const tabs       = root.querySelectorAll('.clock-tab');
          const tabBtns    = root.querySelectorAll('.clock-tab-btn');
          const timerBody  = root.querySelector('#timerBody');

          /* ---------------- Tab 切换 ---------------- */
          function setTab(name) {
            tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
            tabBtns.forEach(b => b.classList.toggle('is-active', b.dataset.goto === name));
            if (name === 'timer') renderTimer();
          }

          tabBtns.forEach(b => {
            b.addEventListener('click', () => setTab(b.dataset.goto));
          });

          /* ---------------- 时钟 ---------------- */
          const hourEl = root.querySelector('#clockHour');
          const minEl  = root.querySelector('#clockMinute');
          const secEl  = root.querySelector('#clockSecond');
          const timeEl = root.querySelector('#clockTime');
          const ticksG = root.querySelector('#clockTicks');
          const numsG  = root.querySelector('#clockNumbers');

          let ticks = '';
          for (let i = 0; i < 60; i++) {
            const angle = i * 6;
            const isHour = i % 5 === 0;
            const r1 = isHour ? 84 : 88, r2 = 92;
            const rad = (angle - 90) * Math.PI / 180;
            ticks += `<line x1="${(100 + Math.cos(rad) * r1).toFixed(2)}" ` +
                     `y1="${(100 + Math.sin(rad) * r1).toFixed(2)}" ` +
                     `x2="${(100 + Math.cos(rad) * r2).toFixed(2)}" ` +
                     `y2="${(100 + Math.sin(rad) * r2).toFixed(2)}" ` +
                     `stroke-width="${isHour ? 2.4 : 1.2}" stroke-linecap="round"/>`;
          }
          ticksG.innerHTML = ticks;

          let nums = '';
          for (let i = 1; i <= 12; i++) {
            const rad = (i * 30 - 90) * Math.PI / 180;
            nums += `<text x="${(100 + Math.cos(rad) * 70).toFixed(2)}" ` +
                    `y="${(100 + Math.sin(rad) * 70).toFixed(2)}">${i}</text>`;
          }
          numsG.innerHTML = nums;

          function clockTick() {
            if (!root.isConnected) return;
            const d = new Date();
            const h = d.getHours() % 12;
            const m = d.getMinutes();
            const s = d.getSeconds();

            hourEl.setAttribute('transform',
              `rotate(${h * 30 + m * 0.5 + s * (0.5 / 60)} 100 100)`);
            minEl.setAttribute('transform',
              `rotate(${m * 6 + s * 0.1} 100 100)`);
            secEl.setAttribute('transform', `rotate(${s * 6} 100 100)`);

            timeEl.textContent =
              `${pad2(d.getHours())}:${pad2(m)}:${pad2(s)}`;
          }

          let clockInterval = null;
          let alignTimer = null;

          clockTick();
          const now = new Date();
          alignTimer = setTimeout(() => {
            alignTimer = null;
            if (!root.isConnected) return;
            clockTick();
            clockInterval = setInterval(clockTick, 1000);
          }, 1000 - now.getMilliseconds());

          /* ---------------- 计时器 UI ---------------- */
          let timerUnsub = null;
          let renderedMode = null;
          let wheelMin = null;
          let wheelSec = null;

          function fmtMinSec(sec) {
            const s = Math.max(0, Math.round(sec));
            return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
          }

          /* ---- 0~59 循环滚轮 ---- */
          function buildWheel(el, initialIndex, onSelect) {
            const H = 44;
            const COUNT = 60;
            const REPEAT = 5;
            const TOTAL = COUNT * REPEAT;
            const MIDDLE = Math.floor(REPEAT / 2);

            let pos = MIDDLE * COUNT + initialIndex;
            let dragging = false;
            let startY = 0;
            let startPos = pos;
            let pointerId = null;
            let selectedIndex = initialIndex;

            el.innerHTML = '<div class="timer-wheel__inner"></div>';
            const inner = el.querySelector('.timer-wheel__inner');

            let html = '';
            for (let r = 0; r < REPEAT; r++) {
              for (let i = 0; i < COUNT; i++) {
                html += `<div class="timer-wheel__item">${pad2(i)}</div>`;
              }
            }
            inner.innerHTML = html;
            const children = [...inner.children];

            function render(animate) {
              const h = el.clientHeight || 132;
              const base = h / 2 - H / 2;
              inner.style.transition = animate
                ? 'transform .28s cubic-bezier(.2,.7,.3,1)'
                : 'none';
              inner.style.transform = `translateY(${base - pos * H}px)`;

              const near = Math.round(pos);
              children.forEach((c, i) => {
                const d = Math.abs(i - near);
                c.classList.toggle('is-active', i === near);
                c.style.opacity = String(Math.max(0.15, 1 - d * 0.42));
              });
            }

            function normalize() {
              const min = MIDDLE * COUNT - COUNT * 0.5;
              const max = MIDDLE * COUNT + COUNT * 1.5;
              if (pos < min) pos += COUNT;
              else if (pos > max) pos -= COUNT;
            }

            el.addEventListener('pointerdown', e => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              e.preventDefault();
              pointerId = e.pointerId;
              dragging = true;
              startY = e.clientY;
              startPos = pos;
              try { el.setPointerCapture(e.pointerId); } catch {}
            });

            el.addEventListener('pointermove', e => {
              if (!dragging || e.pointerId !== pointerId) return;
              e.preventDefault();
              const dy = e.clientY - startY;
              pos = startPos - dy / H;
              pos = Math.max(0, Math.min(TOTAL - 1, pos));
              render(false);
            });

            function end(e) {
              if (!dragging) return;
              dragging = false;
              try { el.releasePointerCapture(e.pointerId); } catch {}

              pos = Math.max(0, Math.min(TOTAL - 1, Math.round(pos)));
              normalize();
              render(true);

              const idx = ((pos % COUNT) + COUNT) % COUNT;
              if (idx !== selectedIndex) {
                selectedIndex = idx;
                onSelect(idx);
              }
            }

            el.addEventListener('pointerup', end);
            el.addEventListener('pointercancel', end);

            requestAnimationFrame(() => render(false));

            return {
              getValue: () => selectedIndex,
            };
          }

          function renderTimer() {
            if (!timerBody.isConnected) return;

            const st = Timer.getStatus();
            const mode = (st === 'idle') ? 'idle' : 'active';

            if (renderedMode !== mode) {
              renderedMode = mode;
              wheelMin = null;
              wheelSec = null;

              if (mode === 'idle') {
                timerBody.innerHTML = `
                  <div class="timer-idle">
                    <div class="timer-wheel-card">
                      <div class="timer-wheel" id="timerWheelMin"></div>
                      <div class="timer-wheel__sep">:</div>
                      <div class="timer-wheel" id="timerWheelSec"></div>
                    </div>
                    <button class="timer-btn" id="timerStartBtn" type="button">开始</button>
                  </div>
                `;

                const total = Timer.getTotal();
                const initMin = Math.floor(total / 60) % 60;
                const initSec = total % 60;

                let curMin = initMin;
                let curSec = initSec;

                wheelMin = buildWheel(
                  timerBody.querySelector('#timerWheelMin'),
                  initMin,
                  v => {
                    curMin = v;
                    Timer.setTotal(curMin * 60 + curSec);
                  }
                );

                wheelSec = buildWheel(
                  timerBody.querySelector('#timerWheelSec'),
                  initSec,
                  v => {
                    curSec = v;
                    Timer.setTotal(curMin * 60 + curSec);
                  }
                );

                timerBody.querySelector('#timerStartBtn')
                  .addEventListener('click', () => {
                    if (Timer.getTotal() <= 0) return;
                    Timer.start();
                    if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
                  });

              } else {
                timerBody.innerHTML = `
                  <div class="timer-running">
                    <div class="timer-ring-col">
                      <svg class="timer-ring" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r="86"
                                fill="none"
                                stroke="rgba(58,111,240,.16)"
                                stroke-width="12"/>
                        <circle class="timer-ring__progress" id="timerRingProgress"
                                cx="100" cy="100" r="86"
                                fill="none"
                                stroke="#3a6ff0"
                                stroke-width="12"
                                stroke-linecap="round"
                                transform="rotate(-90 100 100)"/>
                      </svg>
                      <div class="timer-ring__time" id="timerRingTime">00:00</div>
                    </div>

                    <div class="timer-actions">
                      <button class="timer-round-btn timer-round-btn--primary"
                              id="timerPauseBtn" type="button"></button>
                      <button class="timer-round-btn"
                              id="timerResetBtn" type="button">
                        <svg viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 12a9 9 0 1 0 3-6.7"/>
                          <path d="M3 4v5h5"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                `;

                timerBody.querySelector('#timerPauseBtn')
                  .addEventListener('click', () => {
                    const s = Timer.getStatus();
                    if (s === 'running') Timer.pause();
                    else if (s === 'paused') Timer.resume();
                    if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
                  });

                timerBody.querySelector('#timerResetBtn')
                  .addEventListener('click', () => {
                    if (Timer.getStatus() === 'running') return;
                    Timer.reset();
                    if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
                  });
              }
            }

            /* 每帧刷新状态型 UI */
            if (mode === 'active') {
              const rem = Timer.getRemaining();
              const tot = Timer.getTotal();
              const s = Timer.getStatus();

              const timeEl2  = timerBody.querySelector('#timerRingTime');
              const progEl   = timerBody.querySelector('#timerRingProgress');
              const pauseBtn = timerBody.querySelector('#timerPauseBtn');
              const resetBtn = timerBody.querySelector('#timerResetBtn');

              if (timeEl2) timeEl2.textContent = fmtMinSec(Math.max(0, Math.ceil(rem)));

              if (progEl) {
                const C = 2 * Math.PI * 86;
                const ratio = tot > 0 ? Math.max(0, Math.min(1, rem / tot)) : 0;
                progEl.setAttribute('stroke-dasharray', C.toFixed(2));
                progEl.setAttribute('stroke-dashoffset', (C * (1 - ratio)).toFixed(2));
              }

              if (pauseBtn) {
                pauseBtn.innerHTML = (s === 'running')
                  ? `<svg viewBox="0 0 24 24" fill="currentColor">
                       <rect x="6" y="5" width="4" height="14" rx="1.4"/>
                       <rect x="14" y="5" width="4" height="14" rx="1.4"/>
                     </svg>`
                  : `<svg viewBox="0 0 24 24" fill="currentColor">
                       <path d="M7 4.5 19 12 7 19.5z"/>
                     </svg>`;
              }

              if (resetBtn) resetBtn.disabled = (s !== 'paused');
            }
          }

          timerUnsub = Timer.onChange(() => {
            renderTimer();
          });

          const onParams = e => {
            if (!e.detail || e.detail.bundle !== BUNDLE) return;
            setTab(e.detail.params?.tab === 1 ? 'timer' : 'clock');
          };
          window.addEventListener('wuji:app-params', onParams);

          if (Timer.getStatus() !== 'idle') {
            setTab('timer');
          } else if (ctx?.data?.tab === 1) {
            setTab('timer');
          } else {
            renderTimer();
          }

          return () => {
            if (alignTimer)    { clearTimeout(alignTimer);    alignTimer = null; }
            if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
            timerUnsub?.();
            timerUnsub = null;
            window.removeEventListener('wuji:app-params', onParams);
          };
        },
      },
    },
  });
})();