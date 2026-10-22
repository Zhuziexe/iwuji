(() => {
  const BUNDLE = 'com.wujinb.metro';

  const SPEED_MAX = 120;
  const ACCEL = 55;
  const BRAKE = 95;
  const DRAG = 12;
  const PX_PER_SPEED = 3;
  const STATION_GAP = 800;
  const STOP_MAX_SPEED = 30;
  const STOP_DURATION = 1400;
  const TRAIN_CENTER = 110;
  const STATION_W = 60;

  const STATION_SVG = `
    <svg viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg">
      <polygon points="6,24 30,6 54,24"
               fill="#e0356b" stroke="#1c2536"
               stroke-width="2.4" stroke-linejoin="round"/>
      <rect x="12" y="24" width="4" height="40" fill="#1c2536"/>
      <rect x="44" y="24" width="4" height="40" fill="#1c2536"/>
      <rect x="17" y="32" width="26" height="15" rx="2.5"
            fill="#1c2536"/>
      <text x="30" y="43" text-anchor="middle"
            fill="#ffffff" font-size="10" font-weight="700"
            font-family="sans-serif">站</text>
    </svg>`;

  const HEART_PATH = "M12 20.7l-1.4-1.3C5.4 14.8 2 11.7 2 7.9 2 4.8 4.4 2.4 7.5 2.4c1.7 0 3.4.8 4.5 2.1 1.1-1.3 2.8-2.1 4.5-2.1 3.1 0 5.5 2.4 5.5 5.5 0 3.8-3.4 6.9-8.6 11.5L12 20.7z";

  let els = null;
  let rafId = null;
  let lastT = 0;
  let running = false;
  let flashTimer = null;

  const stationEls = new Map();

  const S = {
    speed: 0,
    worldX: 0,
    stations: [],
    nextStationAt: 500,
    score: 0,
    lives: 3,
    status: 'ready',
    stoppedUntil: 0,
  };

  const input = { accel: false, brake: false };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function vibrate(p) {
    if (navigator.vibrate) { try { navigator.vibrate(p); } catch { } }
  }

  function buildLayer(el, count, minH, maxH) {
    const parts = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
      const w = 30 + Math.random() * 45;
      const h = minH + Math.random() * (maxH - minH);
      parts.push(
        `<div class="b" style="width:${w.toFixed(1)}px;height:${h.toFixed(1)}px"></div>`
      );
      total += w + 8;
    }
    el.innerHTML = parts.join('') + parts.join('');
    return total;
  }

  function buildClouds(el, count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      const w = 50 + Math.random() * 60;
      const h = w * 0.45;
      const x = Math.random() * 400;
      const y = Math.random() * 60;
      const op = 0.35 + Math.random() * 0.4;
      html += `<div class="cloud" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;opacity:${op.toFixed(2)}"></div>`;
    }
    el.innerHTML = html;
  }

  /* ---------------- 游戏状态 ---------------- */
  function resetGame() {
    S.speed = 0;
    S.worldX = 0;
    S.stations = [];
    S.nextStationAt = 500;
    S.score = 0;
    S.lives = 3;
    S.status = 'ready';
    S.stoppedUntil = 0;
    input.accel = false;
    input.brake = false;

    for (const [, el] of stationEls) el.remove();
    stationEls.clear();
  }

  function startGame() {
    resetGame();
    S.status = 'running';
    if (els) els.overlay.classList.remove('is-show');
  }

  function flash(type) {
    if (!els) return;
    const el = els.flash;
    el.classList.remove('is-ok', 'is-bad');
    void el.offsetWidth;
    el.classList.add(type === 'ok' ? 'is-ok' : 'is-bad');

    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      el.classList.remove('is-ok', 'is-bad');
      flashTimer = null;
    }, 260);
  }

  function onStopSuccess() {
    S.score += 1;
    S.speed = 0;
    S.status = 'stopped';
    S.stoppedUntil = performance.now() + STOP_DURATION;
    vibrate(12);
    flash('ok');
  }

  function onMissStation() {
    S.lives -= 1;
    vibrate([30, 50, 30]);
    flash('bad');
    if (S.lives <= 0) {
      S.lives = 0;
      S.status = 'gameover';
      S.speed = 0;
    }
  }

  /* ---------------- 更新 ---------------- */
  function update(dt) {
    if (S.status === 'ready' || S.status === 'gameover') return;

    if (S.status === 'stopped') {
      S.speed = 0;
      if (performance.now() >= S.stoppedUntil) {
        S.status = 'running';
      }
      return;
    }

    if (input.accel && !input.brake) {
      S.speed = clamp(S.speed + ACCEL * dt, 0, SPEED_MAX);
    } else if (input.brake && !input.accel) {
      S.speed = clamp(S.speed - BRAKE * dt, 0, SPEED_MAX);
    } else {
      S.speed = clamp(S.speed - DRAG * dt, 0, SPEED_MAX);
    }

    S.worldX += S.speed * PX_PER_SPEED * dt;

    for (const st of S.stations) {
      if (st.judged) continue;
      if (st.worldX <= S.worldX) {
        st.judged = true;
        if (S.speed <= STOP_MAX_SPEED) {
          st.passed = 'ok';
          onStopSuccess();
        } else {
          st.passed = 'bad';
          onMissStation();
        }
      }
    }

    S.stations = S.stations.filter(st => st.worldX - S.worldX > -400);

    if (S.status === 'running') {
      const last = S.stations[S.stations.length - 1];
      const tooClose = last && (S.nextStationAt - last.worldX < STATION_GAP);
      if (!tooClose && S.stations.length < 2) {
        S.stations.push({ worldX: S.nextStationAt, judged: false, passed: null });
        S.nextStationAt += STATION_GAP;
      }
    }
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!els) return;

    if (els.farWidth > 0) {
      const off = (S.worldX * 0.15) % els.farWidth;
      els.far.style.transform = `translate3d(${-off}px,0,0)`;
    }
    if (els.nearWidth > 0) {
      const off = (S.worldX * 0.35) % els.nearWidth;
      els.near.style.transform = `translate3d(${-off}px,0,0)`;
    }

    /* 云朵：缓慢左移 */
    if (els.clouds) {
      const off = (S.worldX * 0.06) % 400;
      els.clouds.style.transform = `translate3d(${-off}px,0,0)`;
    }

    els.sleepers.style.backgroundPositionX = (-S.worldX) + 'px';

    /* 站点 */
    const inUse = new Set(S.stations);
    for (const [st, el] of stationEls) {
      if (!inUse.has(st)) { el.remove(); stationEls.delete(st); }
    }

    for (const st of S.stations) {
      let el = stationEls.get(st);
      if (!el) {
        el = document.createElement('div');
        el.className = 'metro-station';
        el.innerHTML = `<div class="metro-station__inner">${STATION_SVG}</div>`;
        els.stations.appendChild(el);
        stationEls.set(st, el);
      }
      const screenX = (TRAIN_CENTER - STATION_W / 2) + (st.worldX - S.worldX);
      el.style.transform = `translate3d(${screenX}px,0,0)`;

      if (st.passed === 'ok') el.classList.add('is-pass-ok');
      if (st.passed === 'bad') el.classList.add('is-pass-bad');
    }

    /* HUD */
    els.score.textContent = S.score;

    let hearts = '';
    for (let i = 0; i < 3; i++) {
      hearts += `<svg class="metro-heart ${i < S.lives ? 'is-on' : 'is-off'}" viewBox="0 0 24 24"><path d="${HEART_PATH}"/></svg>`;
    }
    els.lives.innerHTML = hearts;

    els.speed.textContent = Math.round(S.speed);
    els.speedFill.style.width = (S.speed / SPEED_MAX * 100) + '%';

    /* 高速时给速度数字加脉冲 */
    const fast = S.speed > 70;
    els.speedLabel.classList.toggle('is-fast', fast);

    els.scene.classList.toggle('is-fast', S.speed > 55 && S.status === 'running');
    els.train.classList.toggle('is-moving', S.speed > 5);

    if (S.status === 'ready') {
      els.overlay.classList.add('is-show');
      els.overlayTitle.textContent = '地铁大冒险';
      els.overlayDesc.textContent = '加速到站，速度 ≤ 30 km/h 停下';
      els.overlayBtn.textContent = '开始';
    } else if (S.status === 'gameover') {
      els.overlay.classList.add('is-show');
      els.overlayTitle.textContent = '游戏结束';
      els.overlayDesc.textContent = `本次得分 ${S.score}`;
      els.overlayBtn.textContent = '再来一次';
    } else {
      els.overlay.classList.remove('is-show');
    }
  }

  /* ---------------- 主循环 ---------------- */
  function loop(t) {
    if (!running) return;
    if (lastT === 0) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    update(dt);
    render();

    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  /* ---------------- 输入绑定 ---------------- */
  function bindHold(el, onChange) {
    const down = e => {
      e.preventDefault();
      el.classList.add('is-active');
      try { el.setPointerCapture?.(e.pointerId); } catch { }
      onChange(true);
    };
    const up = () => {
      el.classList.remove('is-active');
      onChange(false);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '开地铁游戏',
    icon: './assets/metro.png',
    initialRoute: 'home',
    version: '1.0.1',
    styles: `
      .metro-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        padding-top: var(--statusbar-h);
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        background: linear-gradient(to bottom,
          #4fa4de 0%,
          #8cc8ea 32%,
          #c7e4f5 58%,
          #eaf4fb 78%,
          #d9eefb 100%);
      }

      /* ============ HUD ============ */
      .metro-hud {
        flex: 0 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 20px 8px;
        font-size: 16px;
        font-weight: 700;
        color: #1c2536;
        z-index: 10;
        pointer-events: none;
        letter-spacing: .3px;
      }
      .metro-score {
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
        color: #1c2536;
        text-shadow: 0 1px 2px rgba(255, 255, 255, .6);
      }
      .metro-score b {
        font-size: 30px;
        color: #e0356b;
        font-weight: 800;
        letter-spacing: -.5px;
      }
      .metro-lives {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0;
      }
      .metro-heart {
        width: 26px;
        height: 26px;
        display: block;
        transition: transform .2s ease;
      }
      .metro-heart.is-on {
        fill: #e0356b;
        filter: drop-shadow(0 2px 3px rgba(224, 53, 107, .55));
      }
      .metro-heart.is-off {
        fill: rgba(28, 37, 54, .18);
      }

      /* ============ 场景 ============ */
      .metro-scene {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }
      .metro-scene.is-fast::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          to right,
          transparent 0px, transparent 55px,
          rgba(255, 255, 255, .30) 55px, rgba(255, 255, 255, .30) 57px
        );
        animation: metroSpeed .28s linear infinite;
        pointer-events: none;
        z-index: 9;
        mix-blend-mode: screen;
      }
      @keyframes metroSpeed {
        from { background-position-x: 0; }
        to   { background-position-x: -57px; }
      }

      /* ---------- 太阳 ---------- */
      .metro-sun {
        position: absolute;
        top: 8%;
        right: 12%;
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, #fff6cc 0%, #ffd93b 45%, #ffb800 100%);
        box-shadow:
          0 0 32px rgba(255, 217, 59, .75),
          0 0 64px rgba(255, 200, 60, .4);
        z-index: 0;
        pointer-events: none;
      }

      /* ---------- 云层 ---------- */
      .metro-clouds {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        height: 40%;
        z-index: 0;
        pointer-events: none;
        will-change: transform;
      }
      .cloud {
        position: absolute;
        background: #ffffff;
        border-radius: 999px;
        filter: blur(0.3px);
      }
      .cloud::before,
      .cloud::after {
        content: '';
        position: absolute;
        background: #ffffff;
        border-radius: 50%;
      }
      .cloud::before {
        width: 55%;
        height: 120%;
        left: 12%;
        top: -40%;
      }
      .cloud::after {
        width: 45%;
        height: 100%;
        right: 12%;
        top: -25%;
      }

      /* ---------- 建筑 ---------- */
      .metro-far,
      .metro-near {
        position: absolute;
        left: 0;
        display: flex;
        align-items: flex-end;
        gap: 8px;
        pointer-events: none;
        will-change: transform;
      }
      .metro-far  { bottom: 42%; z-index: 1; }
      .metro-near { bottom: 42%; z-index: 2; }

.metro-far .b,
.metro-near .b {
  position: relative;
  flex: 0 0 auto;
  background-repeat: repeat;
}

.metro-far .b {
  background-color: rgba(70, 110, 160, 0.28);
  border-radius: 3px 3px 0 0;
}

.metro-near .b {
  background-color: rgba(50, 85, 135, 0.55);
  border-radius: 4px 4px 0 0;
}

      /* ---------- 地面 ---------- */
      .metro-ground {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 42%;
        background: linear-gradient(to bottom,
          #4a5b73 0%,
          #3a4a60 45%,
          #2e3a4d 100%);
        z-index: 3;
      }

      /* ---------- 枕木 ---------- */
      .metro-sleepers {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 12%;
        height: 26px;
        background-image: repeating-linear-gradient(
          to right,
          #6a5540 0px, #6a5540 12px,
          transparent 12px, transparent 44px
        );
        z-index: 4;
        will-change: background-position;
      }

      /* ---------- 铁轨 ---------- */
      .metro-rails {
        position: absolute;
        left: 0;
        right: 0;
        bottom: calc(12% + 6px);
        height: 14px;
        border-top: 4px solid #b8c0cc;
        border-bottom: 4px solid #8a95a6;
        z-index: 5;
        pointer-events: none;
      }

      /* ---------- 站点 ---------- */
      .metro-stations {
        position: absolute;
        left: 0;
        right: 0;
        bottom: calc(12% + 26px);
        height: 80px;
        pointer-events: none;
        z-index: 6;
      }
      .metro-station {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 60px;
        height: 70px;
        will-change: transform;
      }
      .metro-station__inner {
        width: 100%;
        height: 100%;
        transform-origin: center bottom;
        will-change: transform, filter;
      }
      .metro-station__inner svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .metro-station.is-pass-ok .metro-station__inner {
        animation: metroOk .55s ease;
      }
      .metro-station.is-pass-bad .metro-station__inner {
        animation: metroBad .6s cubic-bezier(.36, .07, .19, .97);
      }
      @keyframes metroOk {
        0%   { filter: drop-shadow(0 0 0 rgba(52, 199, 89, 0)); }
        35%  { filter: drop-shadow(0 0 16px rgba(52, 199, 89, 1)); transform: scale(1.15); }
        100% { filter: drop-shadow(0 0 0 rgba(52, 199, 89, 0)); }
      }
      @keyframes metroBad {
        0%   { filter: drop-shadow(0 0 0 rgba(224, 53, 107, 0)); }
        15%  { transform: rotate(-11deg); filter: drop-shadow(0 0 16px rgba(224, 53, 107, 1)); }
        45%  { transform: rotate(11deg); }
        70%  { transform: rotate(-6deg); }
        100% { transform: rotate(0); filter: drop-shadow(0 0 0 rgba(224, 53, 107, 0)); }
      }

      /* ---------- 地铁 ---------- */
      .metro-train {
        position: absolute;
        left: 110px;
        bottom: calc(12% + 18px);
        width: 72px;
        height: 52px;
        transform: translateX(-50%);
        z-index: 7;
        pointer-events: none;
      }
      .metro-train__inner {
        position: relative;
        width: 100%;
        height: 100%;
      }
      .metro-train.is-moving .metro-train__inner {
        animation: metroBob .26s ease-in-out infinite alternate;
      }
      @keyframes metroBob {
        from { transform: translateY(0); }
        to   { transform: translateY(-1.5px); }
      }

      .metro-train__body {
        position: absolute;
        left: 0;
        bottom: 10px;
        width: 72px;
        height: 34px;
        background: linear-gradient(to bottom, #4a80ff 0%, #3a6ff0 100%);
        border-radius: 9px 11px 9px 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        box-shadow:
          inset 0 -7px 0 rgba(0, 0, 0, .18),
          0 4px 10px rgba(0, 0, 0, .25);
      }
      .metro-train__body::before,
      .metro-train__body::after {
        content: '';
        position: absolute;
        bottom: -8px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: #1c2536;
        box-shadow: inset 0 2px 3px rgba(255, 255, 255, .2);
      }
      .metro-train__body::before { left: 10px; }
      .metro-train__body::after  { right: 10px; }

      .metro-train__win {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        background: linear-gradient(to bottom, #d8ecff 0%, #a8c8ea 100%);
        box-shadow: inset 0 -2px 0 rgba(0, 0, 0, .06);
      }

      .metro-train__light {
        position: absolute;
        right: -4px;
        top: 50%;
        transform: translateY(-50%);
        width: 7px;
        height: 13px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 40%, #ffe9a8 0%, #ffb800 60%, #d78c00 100%);
        box-shadow:
          0 0 10px rgba(255, 200, 60, .9),
          0 0 20px rgba(255, 200, 60, .4);
      }

      /* ============ 速度条 ============ */
      .metro-speed {
        flex: 0 0 auto;
        padding: 12px 20px 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 10;
      }
      .metro-speed__bar {
        height: 8px;
        border-radius: 4px;
        background: rgba(28, 37, 54, .14);
        overflow: hidden;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, .08);
      }
      .metro-speed__fill {
        height: 100%;
        width: 0;
        border-radius: 4px;
        background: linear-gradient(to right, #34c759 0%, #ffb800 55%, #e0356b 100%);
        transition: width .12s linear;
      }
      .metro-speed__label {
        text-align: right;
        font-size: 15px;
        font-weight: 700;
        color: #1c2536;
        font-variant-numeric: tabular-nums;
        letter-spacing: .5px;
        transition: color .2s ease;
      }
      .metro-speed__label span {
        font-size: 24px;
        margin-right: 4px;
        color: #1c2536;
        transition: color .2s ease;
      }
      .metro-speed__label.is-fast span {
        color: #e0356b;
      }

      /* ============ 控制按钮 ============ */
      .metro-controls {
        flex: 0 0 auto;
        display: flex;
        gap: 12px;
        padding: 12px 20px calc(16px + env(safe-area-inset-bottom, 0px));
        z-index: 10;
      }
      .metro-btn {
        flex: 1 1 0;
        padding: 18px 20px;
        border: 0;
        border-radius: 18px;
        font: inherit;
        font-size: 19px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #fff;
        cursor: pointer;
        transition: transform .08s ease, filter .1s;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        box-shadow: 0 6px 16px rgba(0, 0, 0, .22);
      }
      .metro-btn--brake {
        background: linear-gradient(to bottom, #ff6a95 0%, #e0356b 100%);
      }
      .metro-btn--accel {
        background: linear-gradient(to bottom, #5bd67f 0%, #34c759 100%);
      }
      .metro-btn.is-active {
        filter: brightness(.92);
        transform: scale(.97);
      }

      /* ============ 遮罩 ============ */
      .metro-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 30px;
        background: rgba(20, 30, 50, .55);
        backdrop-filter: blur(14px) saturate(140%);
        -webkit-backdrop-filter: blur(14px) saturate(140%);
        z-index: 20;
        opacity: 0;
        visibility: hidden;
        transition: opacity .25s ease, visibility .25s ease;
        text-align: center;
      }
      .metro-overlay.is-show {
        opacity: 1;
        visibility: visible;
      }
      .metro-overlay__title {
        font-size: 30px;
        font-weight: 800;
        color: #fff;
        letter-spacing: 2px;
      }
      .metro-overlay__desc {
        font-size: 16px;
        color: rgba(255, 255, 255, .85);
        line-height: 1.6;
        max-width: 280px;
      }
      .metro-overlay__btn {
        margin-top: 10px;
        padding: 14px 48px;
        border: 0;
        border-radius: 999px;
        background: #3a6ff0;
        color: #fff;
        font: inherit;
        font-size: 18px;
        font-weight: 600;
        letter-spacing: 1px;
        cursor: pointer;
        transition: transform .08s, filter .15s;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 8px 22px rgba(58, 111, 240, .5);
      }
      .metro-overlay__btn:active { transform: scale(.96); }

      /* ============ 屏幕闪光 ============ */
      .metro-flash {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 30;
        opacity: 0;
        transition: opacity .35s ease;
      }
      .metro-flash.is-ok {
        background: radial-gradient(circle, transparent 35%, rgba(52, 199, 89, .55) 100%);
        opacity: 1;
        transition: none;
      }
      .metro-flash.is-bad {
        background: radial-gradient(circle, transparent 20%, rgba(224, 53, 107, .65) 100%);
        opacity: 1;
        transition: none;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="metro-page">
              <div class="metro-hud">
                <div class="metro-score">得分 <b id="mScore">0</b></div>
                <div class="metro-lives" id="mLives"></div>
              </div>

              <div class="metro-scene" id="mScene">
                <div class="metro-sun"></div>
                <div class="metro-clouds" id="mClouds"></div>
                <div class="metro-far"  id="mFar"></div>
                <div class="metro-near" id="mNear"></div>
                <div class="metro-ground"></div>
                <div class="metro-sleepers" id="mSleepers"></div>
                <div class="metro-rails"></div>
                <div class="metro-stations" id="mStations"></div>

                <div class="metro-train" id="mTrain">
                  <div class="metro-train__inner">
                    <div class="metro-train__body">
                      <span class="metro-train__win"></span>
                      <span class="metro-train__win"></span>
                      <span class="metro-train__win"></span>
                      <span class="metro-train__light"></span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="metro-speed">
                <div class="metro-speed__bar">
                  <div class="metro-speed__fill" id="mSpeedFill"></div>
                </div>
                <div class="metro-speed__label" id="mSpeedLabel">
                  <span id="mSpeed">0</span> km/h
                </div>
              </div>

              <div class="metro-controls">
                <button class="metro-btn metro-btn--brake" id="mBrake" type="button">刹车</button>
                <button class="metro-btn metro-btn--accel" id="mAccel" type="button">加速</button>
              </div>

              <div class="metro-flash" id="mFlash"></div>

              <div class="metro-overlay is-show" id="mOverlay">
                <div class="metro-overlay__title" id="mOverlayTitle">地铁大冒险</div>
                <div class="metro-overlay__desc" id="mOverlayDesc">
                  加速到站，速度 ≤ 30 km/h 停下
                </div>
                <button class="metro-overlay__btn" id="mOverlayBtn" type="button">开始</button>
              </div>
            </div>
          `;
        },

        mount(root) {
          els = {
            score: root.querySelector('#mScore'),
            lives: root.querySelector('#mLives'),
            scene: root.querySelector('#mScene'),
            sun: root.querySelector('.metro-sun'),
            clouds: root.querySelector('#mClouds'),
            far: root.querySelector('#mFar'),
            near: root.querySelector('#mNear'),
            sleepers: root.querySelector('#mSleepers'),
            stations: root.querySelector('#mStations'),
            train: root.querySelector('#mTrain'),
            speed: root.querySelector('#mSpeed'),
            speedLabel: root.querySelector('#mSpeedLabel'),
            speedFill: root.querySelector('#mSpeedFill'),
            overlay: root.querySelector('#mOverlay'),
            overlayTitle: root.querySelector('#mOverlayTitle'),
            overlayDesc: root.querySelector('#mOverlayDesc'),
            overlayBtn: root.querySelector('#mOverlayBtn'),
            flash: root.querySelector('#mFlash'),
          };

          els.farWidth = buildLayer(els.far, 36, 40, 100);
          els.nearWidth = buildLayer(els.near, 26, 55, 130);
          buildClouds(els.clouds, 8);

          /* 初始化 hearts */
          let hearts = '';
          for (let i = 0; i < 3; i++) {
            hearts += `<svg class="metro-heart is-on" viewBox="0 0 24 24"><path d="${HEART_PATH}"/></svg>`;
          }
          els.lives.innerHTML = hearts;

          els.overlayBtn.addEventListener('click', () => {
            if (S.status === 'ready' || S.status === 'gameover') {
              startGame();
            }
          });

          bindHold(root.querySelector('#mAccel'), v => { input.accel = v; });
          bindHold(root.querySelector('#mBrake'), v => { input.brake = v; });

          const onKey = e => {
            if (!root.isConnected) return;
            if (e.repeat) return;
            switch (e.key) {
              case 'ArrowUp':
              case 'ArrowRight':
                input.accel = true; e.preventDefault();
                break;
              case 'ArrowDown':
              case 'ArrowLeft':
                input.brake = true; e.preventDefault();
                break;
              case ' ':
                if (S.status === 'ready' || S.status === 'gameover') {
                  startGame();
                  e.preventDefault();
                }
                break;
            }
          };
          const onKeyUp = e => {
            switch (e.key) {
              case 'ArrowUp':
              case 'ArrowRight':
                input.accel = false;
                break;
              case 'ArrowDown':
              case 'ArrowLeft':
                input.brake = false;
                break;
            }
          };
          window.addEventListener('keydown', onKey);
          window.addEventListener('keyup', onKeyUp);

          resetGame();
          startLoop();

          /* ★ 所有副作用在这里统一收尾 */
          return () => {
            stopLoop();
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('keyup', onKeyUp);
            if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
            if (els) {
              for (const [, el] of stationEls) el.remove();
              stationEls.clear();
              els = null;
            }
            input.accel = false;
            input.brake = false;
          };
        },

        unmount() {
          /* 兜底：_disposeItem 里 dispose 和 unmount 都会被调，这里保证幂等 */
          stopLoop();
          if (els) {
            for (const [, el] of stationEls) el.remove();
            stationEls.clear();
            els = null;
          }
        },
      },
    },
  });
})();