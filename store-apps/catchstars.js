(() => {
  const BUNDLE = 'com.wujinb.catchstars';

  /* ---------------- 参数 ---------------- */
  const GAME_DURATION = 60;
  const PLAYER_WIDTH  = 52;
  const PLAYER_BOTTOM = 18;
  const PLAYER_SPEED  = 420;
  const ITEM_BASE     = 36;
  const SPAWN_START   = 1000;
  const SPAWN_MIN     = 550;
  const FALL_MIN      = 130;
  const FALL_MAX      = 260;
  const STAR_SCORE    = 10;
  const POOP_SCORE    = -10;
  const POOP_RATIO    = 0.25;

  const EMOJI = {
    star:   '⭐',
    poop:   '💩',
    player: '😊',
  };

  const AudioEngine = (() => {
    let ctx = null;
    let master = null;
    let musicBus = null;
    let sfxBus = null;
    let bgPlaying = false;
    let bgTimer = null;
    let bgBeat = 0;
    let lastTickSec = -1;
    let volSyncTimer = null;

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }

      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      musicBus = ctx.createGain();
      musicBus.gain.value = 0.30;
      musicBus.connect(master);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.85;
      sfxBus.connect(master);

      volSyncTimer = setInterval(syncVolume, 400);
      return ctx;
    }

    function readVolume() {
      let v = 60;
      try {
        if (window.HardwareUI?.getVolume) v = HardwareUI.getVolume();
        else if (window.WujiControlCenter?.getVolume) v = WujiControlCenter.getVolume();
        else v = Store.get('wujios.volume', 60);
      } catch {}
      return Math.max(0, Math.min(100, v));
    }

    function isMuted() {
      try {
        return !!WujiControlCenter?.getToggle?.('soundmode');
      } catch { return false; }
    }

    function syncVolume() {
      if (!ctx || !master) return;
      const vol = readVolume() / 100;
      const target = isMuted() ? 0 : Math.pow(vol, 1.6) * 0.9;
      try { master.gain.setTargetAtTime(target, ctx.currentTime, 0.06); } catch {}
    }

    function resume() {
      ensure();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }

    function playNote(freq, dur, gain, when, bus, type) {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(gain, when + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(g);
      g.connect(bus);
      osc.start(when);
      osc.stop(when + dur + 0.02);
    }

    /* ---------- 音效 ---------- */
    function sfxStar() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      playNote(1046.5, 0.10, 0.22, t,        sfxBus, 'sine');
      playNote(1318.5, 0.12, 0.20, t + 0.06, sfxBus, 'sine');
      playNote(1568.0, 0.16, 0.18, t + 0.12, sfxBus, 'sine');
    }

    function sfxPoop() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.28);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      osc.connect(g);
      g.connect(sfxBus);
      osc.start(t);
      osc.stop(t + 0.32);
    }

    function sfxTick() {
      if (!ensure()) return;
      playNote(1200, 0.05, 0.10, ctx.currentTime, sfxBus, 'square');
    }

    function sfxGameOver() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      playNote(523.25, 0.18, 0.18, t,        sfxBus, 'sine');
      playNote(392.00, 0.18, 0.18, t + 0.16, sfxBus, 'sine');
      playNote(261.63, 0.38, 0.18, t + 0.32, sfxBus, 'sine');
    }

    /* ---------- 背景音乐 ---------- */
    const MELODY = [523.25, 659.25, 783.99, 659.25];  // C E G E
    const BASS   = [130.81, 130.81, 174.61, 174.61];  // C3 C3 F3 F3
    const BEAT   = 0.32;

    function scheduleBeat() {
      if (!bgPlaying || !ctx) return;
      const when = ctx.currentTime + 0.02;
      const mi = bgBeat % MELODY.length;
      playNote(MELODY[mi], BEAT * 0.9, 0.10, when, musicBus, 'triangle');

      if (bgBeat % 4 === 0) {
        const bi = Math.floor(bgBeat / 4) % BASS.length;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = BASS[bi];
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(0.07, when + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, when + BEAT * 4);
        osc.connect(g);
        g.connect(musicBus);
        osc.start(when);
        osc.stop(when + BEAT * 4 + 0.02);
      }

      bgBeat++;
      bgTimer = setTimeout(scheduleBeat, BEAT * 1000);
    }

    function startBg() {
      if (!ensure()) return;
      resume();
      if (bgPlaying) return;
      bgPlaying = true;
      bgBeat = 0;
      scheduleBeat();
    }

    function stopBg() {
      bgPlaying = false;
      if (bgTimer) { clearTimeout(bgTimer); bgTimer = null; }
    }

    /* ★ 彻底挂起：关机 / 卸载时调 */
    function suspend() {
      stopBg();
      if (volSyncTimer) { clearInterval(volSyncTimer); volSyncTimer = null; }
      if (ctx) {
        try { ctx.close(); } catch {}
        ctx = null;
        master = null;
        musicBus = null;
        sfxBus = null;
      }
    }

    /* ---------- 倒计时滴答 ---------- */
    function tick(timeLeft) {
      const sec = Math.ceil(timeLeft);
      if (sec !== lastTickSec && sec > 0 && sec <= 10) {
        lastTickSec = sec;
        sfxTick();
      }
    }

    function resetTick() { lastTickSec = -1; }

    function destroy() {
      suspend();
    }

    return {
      resume, syncVolume, startBg, stopBg, suspend,
      sfxStar, sfxPoop, sfxGameOver, tick, resetTick, destroy,
    };
  })();

  /* ---------------- 状态 ---------------- */
  let els = null;
  let rafId = null;
  let lastT = 0;
  let running = false;
  let sceneW = 0;
  let sceneH = 0;
  let flashTimer = null;

  const items = new Map();
  const input = { left: false, right: false };

  const S = {
    score: 0,
    timeLeft: GAME_DURATION,
    elapsed: 0,
    playerX: 0.5,
    status: 'ready',
    spawnTimer: 0,
    spawnInterval: SPAWN_START,
    nextId: 1,
  };

  function vibrate(p) {
    if (navigator.vibrate) { try { navigator.vibrate(p); } catch {} }
  }

  /* ---------------- 云 ---------------- */
  function buildClouds(el, count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      const w = 50 + Math.random() * 60;
      const h = w * 0.45;
      const x = Math.random() * 100;
      const y = Math.random() * 60;
      const op = 0.35 + Math.random() * 0.4;
      html += `<div class="star-cloud" style="left:${x}%;top:${y}px;width:${w}px;height:${h}px;opacity:${op.toFixed(2)}"></div>`;
    }
    el.innerHTML = html;
  }

  /* ---------------- 清场 & 重置 ---------------- */
  function clearItems() {
    for (const item of items.values()) item.el.remove();
    items.clear();
  }

  function resetGame() {
    clearItems();
    S.score = 0;
    S.timeLeft = GAME_DURATION;
    S.elapsed = 0;
    S.playerX = 0.5;
    S.status = 'ready';
    S.spawnTimer = 0;
    S.spawnInterval = SPAWN_START;
    input.left = false;
    input.right = false;
    AudioEngine.resetTick();
    AudioEngine.stopBg();
    updateHUD();
  }

  function startGame() {
    clearItems();
    S.score = 0;
    S.timeLeft = GAME_DURATION;
    S.elapsed = 0;
    S.playerX = 0.5;
    S.status = 'running';
    S.spawnTimer = 0;
    S.spawnInterval = SPAWN_START;
    input.left = false;
    input.right = false;

    AudioEngine.resume();
    AudioEngine.resetTick();
    AudioEngine.startBg();

    updateHUD();
    if (els) els.overlay.classList.remove('is-show');
  }

  /* ---------------- HUD ---------------- */
  function updateHUD() {
    if (!els) return;
    els.score.textContent = S.score;

    const secs = Math.max(0, Math.ceil(S.timeLeft));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    els.time.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    els.time.classList.toggle('is-low', S.timeLeft <= 10);
  }

  function showOverlay(title, desc, btn) {
    if (!els) return;
    els.overlayTitle.textContent = title;
    els.overlayDesc.innerHTML = desc;
    els.overlayBtn.textContent = btn;
    els.overlay.classList.add('is-show');
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
    }, 220);
  }

  /* ---------------- 掉落物 ---------------- */
  function spawnItem() {
    if (sceneW === 0) return;

    const isPoop = Math.random() < POOP_RATIO;
    const size = ITEM_BASE + Math.random() * 10;
    const half = size / 2;
    const x = half + 8 + Math.random() * (sceneW - size - 16);
    const vy = FALL_MIN + Math.random() * (FALL_MAX - FALL_MIN);

    const el = document.createElement('div');
    el.className = 'star-item ' + (isPoop ? 'is-poop' : 'is-star');
    el.textContent = isPoop ? EMOJI.poop : EMOJI.star;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.fontSize = (size * 0.92) + 'px';
    el.style.transform = `translate3d(${x - half}px, ${-size}px, 0)`;
    els.items.appendChild(el);

    const id = S.nextId++;
    items.set(id, {
      id, el, x, y: -size, vy, size, half,
      type: isPoop ? 'poop' : 'star',
      hit: false,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 260,
    });
  }

  function removeItem(id) {
    const item = items.get(id);
    if (!item) return;
    item.el.remove();
    items.delete(id);
  }

  function onHit(item) {
    if (item.type === 'star') {
      S.score += STAR_SCORE;
      flash('ok');
      vibrate(10);
      AudioEngine.sfxStar();
    } else {
      S.score += POOP_SCORE;
      flash('bad');
      vibrate([20, 30, 20]);
      AudioEngine.sfxPoop();
    }
    updateHUD();
    removeItem(item.id);
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    if (S.status !== 'running') return;

    S.elapsed += dt * 1000;
    S.timeLeft = Math.max(0, GAME_DURATION - S.elapsed / 1000);
    updateHUD();

    AudioEngine.tick(S.timeLeft);

    if (S.timeLeft <= 0) {
      S.status = 'gameover';
      AudioEngine.stopBg();
      AudioEngine.sfxGameOver();
      showOverlay(
        '时间到！',
        `本次得分 <b style="color:#e0356b;font-size:24px;display:inline-block;margin-top:6px;">${S.score}</b>`,
        '再来一次'
      );
      return;
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0 && sceneW > 0) {
      S.playerX += dir * PLAYER_SPEED * dt / sceneW;
      const halfP = PLAYER_WIDTH / 2 / sceneW;
      S.playerX = Math.max(halfP, Math.min(1 - halfP, S.playerX));
    }

    S.spawnTimer += dt * 1000;
    if (S.spawnTimer >= S.spawnInterval) {
      S.spawnTimer = 0;
      spawnItem();
      const p = Math.min(1, S.elapsed / (GAME_DURATION * 1000));
      S.spawnInterval = SPAWN_START - (SPAWN_START - SPAWN_MIN) * p;
    }

    const playerCenterX = S.playerX * sceneW;
    const playerLeft  = playerCenterX - PLAYER_WIDTH / 2;
    const playerRight = playerCenterX + PLAYER_WIDTH / 2;
    const playerTop    = sceneH - PLAYER_BOTTOM - PLAYER_WIDTH;
    const playerBottom = sceneH - PLAYER_BOTTOM;

    for (const item of items.values()) {
      item.y += item.vy * dt;
      item.rotation += item.rotSpeed * dt;

      if (!item.hit && item.y + item.size >= playerTop && item.y <= playerBottom) {
        const il = item.x - item.half;
        const ir = item.x + item.half;
        if (ir > playerLeft && il < playerRight) {
          item.hit = true;
          onHit(item);
          continue;
        }
      }

      if (item.y > sceneH + 40) {
        removeItem(item.id);
      }
    }
  }

  /* ---------------- render ---------------- */
  function render() {
    if (!els) return;

    const w = els.scene.clientWidth;
    const h = els.scene.clientHeight;
    if (w !== sceneW || h !== sceneH) {
      sceneW = w;
      sceneH = h;
    }

    els.player.style.transform =
      `translateX(${S.playerX * sceneW - PLAYER_WIDTH / 2}px)`;

    for (const item of items.values()) {
      item.el.style.transform =
        `translate3d(${item.x - item.half}px, ${item.y}px, 0) rotate(${item.rotation}deg)`;
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
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ---------------- 按钮 ---------------- */
  function bindHold(el, setter) {
    const down = e => {
      e.preventDefault();
      el.classList.add('is-active');
      try { el.setPointerCapture?.(e.pointerId); } catch {}
      setter(true);
    };
    const up = () => {
      el.classList.remove('is-active');
      setter(false);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  /* ---------------- 注册应用 ---------------- */
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '接住星星',
    icon: './assets/catchstars.svg',
    initialRoute: 'home',
    version: '1.0.2',

    /* ★ 开机 / 关机钩子 */
    onBoot() {
      /* 脚本加载后是全新状态，无需做任何事 */
    },
    onShutdown() {
      stopLoop();
      clearItems();
      AudioEngine.suspend();
      if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
      els = null;
    },

    styles: `
      .star-page {
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
          #8cc8ea 45%,
          #c7e4f5 78%,
          #eaf4fb 100%);
      }

      /* ============ HUD ============ */
      .star-hud {
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
      .star-score {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        text-shadow: 0 1px 2px rgba(255, 255, 255, .6);
      }
      .star-score b {
        font-size: 28px;
        color: #e0356b;
        font-weight: 800;
        letter-spacing: -.5px;
      }
      .star-time {
        font-size: 22px;
        font-weight: 800;
        color: #1c2536;
        font-variant-numeric: tabular-nums;
        letter-spacing: 1px;
        text-shadow: 0 1px 2px rgba(255, 255, 255, .6);
        transition: color .25s;
      }
      .star-time.is-low {
        color: #e0356b;
        animation: starTimePulse .6s ease-in-out infinite alternate;
      }
      @keyframes starTimePulse {
        from { transform: scale(1); }
        to   { transform: scale(1.12); }
      }

      /* ============ 场景 ============ */
      .star-scene {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }

      .star-sun {
        position: absolute;
        top: 10%;
        right: 12%;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, #fff6cc 0%, #ffd93b 45%, #ffb800 100%);
        box-shadow:
          0 0 28px rgba(255, 217, 59, .7),
          0 0 56px rgba(255, 200, 60, .35);
        z-index: 0;
        pointer-events: none;
      }

      .star-clouds {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        height: 40%;
        z-index: 1;
        pointer-events: none;
      }
      .star-cloud {
        position: absolute;
        background: #ffffff;
        border-radius: 999px;
        filter: blur(0.3px);
      }
      .star-cloud::before,
      .star-cloud::after {
        content: '';
        position: absolute;
        background: #ffffff;
        border-radius: 50%;
      }
      .star-cloud::before { width: 55%; height: 120%; left: 12%; top: -40%; }
      .star-cloud::after  { width: 45%; height: 100%; right: 12%; top: -25%; }

      .star-ground {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 22%;
        background: linear-gradient(to bottom,
          #6dc27c 0%,
          #4ea35f 55%,
          #3a854a 100%);
        z-index: 2;
        pointer-events: none;
      }
      .star-ground::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: -6px;
        height: 8px;
        background: radial-gradient(circle at 30% 50%, #7ed48a 0%, transparent 70%),
                    radial-gradient(circle at 70% 50%, #7ed48a 0%, transparent 70%);
      }

      /* ============ 掉落物 ============ */
      .star-items {
        position: absolute;
        inset: 0;
        z-index: 4;
        pointer-events: none;
      }
      .star-item {
        position: absolute;
        left: 0;
        top: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        will-change: transform;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, .18));
      }
      .star-item.is-star {
        filter: drop-shadow(0 2px 6px rgba(255, 200, 60, .55));
      }
      .star-item.is-poop {
        filter: drop-shadow(0 2px 4px rgba(80, 50, 20, .35));
      }

      /* ============ 玩家 ============ */
      .star-player {
        position: absolute;
        left: 0;
        bottom: 18px;
        width: 52px;
        height: 52px;
        z-index: 5;
        pointer-events: none;
        will-change: transform;
      }
      .star-player__inner {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 46px;
        line-height: 1;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, .25));
        animation: starPlayerBob 1.6s ease-in-out infinite;
      }
      @keyframes starPlayerBob {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-3px); }
      }

      /* ============ 底部按钮 ============ */
      .star-controls {
        flex: 0 0 auto;
        display: flex;
        gap: 12px;
        padding: 12px 20px calc(16px + env(safe-area-inset-bottom, 0px));
        z-index: 10;
      }
      .star-btn {
        flex: 1 1 0;
        height: 64px;
        border: 0;
        border-radius: 18px;
        font: inherit;
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        cursor: pointer;
        transition: transform .08s ease, filter .1s;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        box-shadow: 0 6px 16px rgba(0, 0, 0, .22);
        background: linear-gradient(to bottom, #6a8dff 0%, #3a6ff0 100%);
      }
      .star-btn.is-active {
        filter: brightness(.9);
        transform: scale(.97);
      }

      /* ============ 全屏遮罩 & 闪光（相对 .star-page 全屏） ============ */
      .star-overlay {
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
      .star-overlay.is-show {
        opacity: 1;
        visibility: visible;
      }
      .star-overlay__title {
        font-size: 30px;
        font-weight: 800;
        color: #fff;
        letter-spacing: 2px;
      }
      .star-overlay__desc {
        font-size: 15px;
        color: rgba(255, 255, 255, .9);
        line-height: 1.65;
        max-width: 280px;
      }
      .star-overlay__btn {
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
      .star-overlay__btn:active { transform: scale(.96); }

      .star-flash {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 30;
        opacity: 0;
        transition: opacity .3s ease;
      }
      .star-flash.is-ok {
        background: radial-gradient(circle, transparent 40%, rgba(52, 199, 89, .5) 100%);
        opacity: 1;
        transition: none;
      }
      .star-flash.is-bad {
        background: radial-gradient(circle, transparent 25%, rgba(224, 53, 107, .6) 100%);
        opacity: 1;
        transition: none;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="star-page">
              <div class="star-hud">
                <div class="star-score">得分 <b id="starScore">0</b></div>
                <div class="star-time" id="starTime">01:00</div>
              </div>

              <div class="star-scene" id="starScene">
                <div class="star-sun"></div>
                <div class="star-clouds" id="starClouds"></div>
                <div class="star-ground"></div>
                <div class="star-items" id="starItems"></div>
                <div class="star-player" id="starPlayer">
                  <div class="star-player__inner">${EMOJI.player}</div>
                </div>
              </div>

              <div class="star-controls">
                <button class="star-btn" id="starLeft"  type="button" aria-label="左移">←</button>
                <button class="star-btn" id="starRight" type="button" aria-label="右移">→</button>
              </div>

              <div class="star-flash" id="starFlash"></div>

              <div class="star-overlay is-show" id="starOverlay">
                <div class="star-overlay__title" id="starOverlayTitle">接星星</div>
                <div class="star-overlay__desc" id="starOverlayDesc">
                  用下方按钮左右移动 😊<br>
                  接住 ⭐ 得 <b style="color:#5bd67f">10</b> 分，<br>
                  接住 💩 扣 <b style="color:#e0356b">10</b> 分<br>
                  时间 60 秒
                </div>
                <button class="star-overlay__btn" id="starOverlayBtn" type="button">开始</button>
              </div>
            </div>
          `;
        },

        mount(root) {
          els = {
            score:        root.querySelector('#starScore'),
            time:         root.querySelector('#starTime'),
            scene:        root.querySelector('#starScene'),
            clouds:       root.querySelector('#starClouds'),
            items:        root.querySelector('#starItems'),
            player:       root.querySelector('#starPlayer'),
            overlay:      root.querySelector('#starOverlay'),
            overlayTitle: root.querySelector('#starOverlayTitle'),
            overlayDesc:  root.querySelector('#starOverlayDesc'),
            overlayBtn:   root.querySelector('#starOverlayBtn'),
            flash:        root.querySelector('#starFlash'),
          };

          buildClouds(els.clouds, 7);

          els.overlayBtn.addEventListener('click', () => {
            if (S.status === 'ready' || S.status === 'gameover') {
              startGame();
            }
          });

          bindHold(root.querySelector('#starLeft'),  v => { input.left  = v; });
          bindHold(root.querySelector('#starRight'), v => { input.right = v; });

          /* 键盘 */
          const onKey = e => {
            if (!root.isConnected) return;
            switch (e.key) {
              case 'ArrowLeft': case 'a': case 'A':
                input.left = true; e.preventDefault(); break;
              case 'ArrowRight': case 'd': case 'D':
                input.right = true; e.preventDefault(); break;
              case ' ':
                if (S.status === 'ready' || S.status === 'gameover') {
                  startGame(); e.preventDefault();
                }
                break;
            }
          };
          const onKeyUp = e => {
            switch (e.key) {
              case 'ArrowLeft': case 'a': case 'A':  input.left  = false; break;
              case 'ArrowRight': case 'd': case 'D': input.right = false; break;
            }
          };
          window.addEventListener('keydown', onKey);
          window.addEventListener('keyup', onKeyUp);

          /* 音量 / 静音变化时立即同步一次 */
          const onCCChange = () => AudioEngine.syncVolume();
          window.addEventListener('wuji:cc-toggle-change', onCCChange);

          resetGame();
          startLoop();

          /* ★ 所有副作用在这里统一收尾 */
          return () => {
            stopLoop();
            clearItems();
            AudioEngine.stopBg();
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('wuji:cc-toggle-change', onCCChange);
            if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
            els = null;
          };
        },
      },
    },
  });
})();