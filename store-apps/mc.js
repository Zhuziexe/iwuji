(() => {
  const THREE_VERSION = '0.160.0';
  const CDN_LIST = [
    `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`,
    `https://unpkg.com/three@${THREE_VERSION}/build/three.module.min.js`,
    `https://cdn.jsdmirror.com/npm/three@${THREE_VERSION}/build/three.module.min.js`,
  ];
  let threePromise = null;
  function ensureThree() {
    if (!threePromise) {
      threePromise = (async () => {
        for (const url of CDN_LIST) {
          try {
            const mod = await import(url);
            if (mod && mod.WebGLRenderer) return mod;
          } catch (e) { console.warn('[mc] CDN failed:', url, e); }
        }
        throw new Error('无法加载 3D 引擎');
      })();
    }
    return threePromise;
  }

  const BUNDLE = 'com.wujinb.mc';
  const SIZE = 32;
  const HEIGHT = 14;
  const SAVE_KEY = 'world';

  const BLOCK_IDS = {
    GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4, LEAVES: 5, SAND: 6, GLASS: 7,
  };
  const BLOCK_COLORS = {
    1: 0x5ba844, 2: 0x8b5a2b, 3: 0x9ca3af, 4: 0xb45309,
    5: 0x22c55e, 6: 0xf5deb3, 7: 0x7dd3fc,
  };
  const HOTBAR = [1, 2, 3, 4, 5, 6, 7];

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际MC',
    icon: './assets/mc.svg',
    initialRoute: 'main',
    version: '1.2.6',

    styles: `
      .mc-wrap { position: absolute; inset: 0; background: #000; overflow: hidden; }
      .mc-stage {
        position: absolute; top: 50%; left: 50%;
        width: 560px; height: 420px;
        transform: translate(-50%, -50%) rotate(-90deg);
        transform-origin: center center;
        background: #87ceeb; overflow: hidden;
      }
      .mc-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }

      .mc-crosshair {
        position: absolute; left: 50%; top: 50%;
        width: 20px; height: 20px;
        transform: translate(-50%, -50%);
        pointer-events: none; z-index: 5;
      }
      .mc-crosshair::before, .mc-crosshair::after {
        content: ''; position: absolute;
        background: rgba(255,255,255,.85);
        box-shadow: 0 0 2px rgba(0,0,0,.8);
      }
      .mc-crosshair::before { left: 50%; top: 0; width: 2px; height: 100%; transform: translateX(-50%); }
      .mc-crosshair::after { top: 50%; left: 0; height: 2px; width: 100%; transform: translateY(-50%); }

      .mc-exit {
        position: absolute; top: 12px; left: 12px;
        width: 56px; height: 56px; padding: 0;
        border: 0; border-radius: 50%;
        background: rgba(0,0,0,.55);
        border: 1px solid rgba(255,255,255,.25);
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 10;
        -webkit-tap-highlight-color: transparent;
      }
      .mc-exit:active { transform: scale(.92); }
      .mc-exit svg { width: 28px; height: 28px; display: block; }

      .mc-fps {
        position: absolute; top: 16px; right: 16px;
        padding: 6px 12px; border-radius: 8px;
        background: rgba(0,0,0,.55);
        color: #8ad4ff;
        font-family: ui-monospace, monospace;
        font-size: 18px; font-weight: 600;
        pointer-events: none; z-index: 6;
        letter-spacing: .3px;
      }

      .mc-joy {
        position: absolute; left: 16px; bottom: 16px;
        width: 140px; height: 140px;
        border-radius: 50%;
        background: rgba(0,0,0,.28);
        border: 2px solid rgba(255,255,255,.25);
        z-index: 7; touch-action: none;
      }
      .mc-joy__knob {
        position: absolute; left: 50%; top: 50%;
        width: 64px; height: 64px; border-radius: 50%;
        background: rgba(255,255,255,.6);
        transform: translate(-50%, -50%);
        pointer-events: none;
        transition: background .1s;
      }
      .mc-joy.is-active .mc-joy__knob { background: rgba(255,255,255,.85); }

      .mc-btn {
        position: absolute; padding: 0; border: 0; border-radius: 50%;
        background: rgba(0,0,0,.45);
        border: 2px solid rgba(255,255,255,.3);
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 7;
        font: inherit; font-weight: 700;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none; -webkit-user-select: none;
        transition: background .1s, transform .08s;
      }
      .mc-btn:active, .mc-btn.is-active {
        background: rgba(74,125,255,.6);
        transform: scale(.92);
      }

      .mc-btn--jump { right: 16px; bottom: 16px; width: 80px; height: 80px; font-size: 20px; }
      .mc-btn--break { right: 96px; bottom: 16px; width: 68px; height: 68px; font-size: 26px; }
      .mc-btn--place { right: 16px; bottom: 108px; width: 68px; height: 68px; font-size: 28px; }

      /* 快捷栏 */
      .mc-hotbar {
        position: absolute;
        left: 50%; bottom: 10px;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 3px;
        padding: 4px;
        border-radius: 12px;
        background: rgba(0,0,0,.5);
        border: 1px solid rgba(255,255,255,.22);
        z-index: 6;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .mc-hb-arrow {
        flex: 0 0 36px;
        width: 36px; height: 36px;
        padding: 0; border: 0; border-radius: 8px;
        background: rgba(255,255,255,.18);
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font: inherit; font-size: 20px; font-weight: 700; line-height: 1;
        -webkit-tap-highlight-color: transparent;
        transition: background .1s;
      }
      .mc-hb-arrow:active { background: rgba(255,255,255,.32); }
      .mc-hb-arrow[hidden] { display: none !important; }

      .mc-hb-viewport {
        flex: 0 0 153px;
        width: 153px; height: 46px;
        overflow: hidden;
        border-radius: 8px;
        display: flex;
        align-items: center;
      }
      .mc-hb-track {
        display: flex; gap: 3px; height: 36px;
        transition: transform .22s cubic-bezier(.2,.7,.3,1);
        will-change: transform;
      }
      .mc-slot {
        flex: 0 0 36px;
        width: 36px; height: 36px;
        padding: 0; border: 0; border-radius: 8px;
        background: transparent;
        position: relative;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .1s;
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.18);
      }
      .mc-slot.is-active {
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.18), 0 0 0 3px #ffd54a;
        transform: scale(1.06);
      }

      .mc-loading {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 14px; z-index: 20;
        background: #0a1428; color: #8ad4ff;
        font-size: 14px;
        padding-left: var(--statusbar-h, 20px);
      }
      .mc-loading[hidden] { display: none !important; }
      .mc-spin {
        width: 32px; height: 32px; border-radius: 50%;
        border: 3px solid rgba(138,212,255,.2);
        border-top-color: #8ad4ff;
        animation: mc-spin .8s linear infinite;
        box-sizing: border-box;
      }
      @keyframes mc-spin { to { transform: rotate(360deg); } }
    `,

    routes: {
      main: {
        name: 'main',
        render() {
          return `
            <div class="mc-wrap">
              <div class="mc-stage" id="mcStage">
                <canvas class="mc-canvas" id="mcCanvas"></canvas>
                <div class="mc-crosshair"></div>

                <button class="mc-exit" id="mcExit" type="button" aria-label="退出">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 6L6 18"/>
  <path d="M6 6l12 12"/>
</svg>
                </button>
                <div class="mc-fps" id="mcFps">-- FPS</div>

                <div class="mc-joy" id="mcJoy">
                  <div class="mc-joy__knob" id="mcKnob"></div>
                </div>

                <button class="mc-btn mc-btn--jump" id="mcJump" type="button">跳</button>
                <button class="mc-btn mc-btn--break" id="mcBreak" type="button">⛏</button>
                <button class="mc-btn mc-btn--place" id="mcPlace" type="button">＋</button>

                <div class="mc-hotbar">
                  <button class="mc-hb-arrow" id="mcHBL" type="button" aria-label="上一页" hidden>◀</button>
                  <div class="mc-hb-viewport">
                    <div class="mc-hb-track" id="mcHBTrack"></div>
                  </div>
                  <button class="mc-hb-arrow" id="mcHBR" type="button" aria-label="下一页" hidden>▶</button>
                </div>
              </div>
              <div class="mc-loading" id="mcLoading">
                <div class="mc-spin"></div>
                <div>生成世界中…</div>
              </div>
            </div>
          `;
        },
        mount(root, ctx) {
          const canvas = root.querySelector('#mcCanvas');
          const stage = root.querySelector('#mcStage');
          const loading = root.querySelector('#mcLoading');
          const fpsEl = root.querySelector('#mcFps');
          const exitBtn = root.querySelector('#mcExit');
          const joyEl = root.querySelector('#mcJoy');
          const knobEl = root.querySelector('#mcKnob');
          const jumpBtn = root.querySelector('#mcJump');
          const breakBtn = root.querySelector('#mcBreak');
          const placeBtn = root.querySelector('#mcPlace');
          const hbTrack = root.querySelector('#mcHBTrack');
          const hbLeft = root.querySelector('#mcHBL');
          const hbRight = root.querySelector('#mcHBR');

          const routeEl = ctx.nav?.current?.element;
          if (routeEl) routeEl.dataset.blockBackGesture = '1';

          let disposed = false;
          let game = null;

          exitBtn.addEventListener('click', () => {
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
            ctx.close();
          });

          // ---- 快捷栏 ----
          const HB_SLOT_W = 36;
          const HB_GAP = 3;
          const HB_STRIDE = HB_SLOT_W + HB_GAP;
          const HB_PER_PAGE = 4;
          const HB_VIEWPORT_W = 153;

          let selectedId = 1;
          let hbPage = 0;
          const maxPage = HOTBAR.length <= HB_PER_PAGE
            ? 0
            : Math.ceil((HOTBAR.length - HB_PER_PAGE) / (HB_PER_PAGE - 1));

          HOTBAR.forEach(id => {
            const slot = document.createElement('button');
            slot.className = 'mc-slot' + (id === selectedId ? ' is-active' : '');
            slot.style.background = '#' + BLOCK_COLORS[id].toString(16).padStart(6, '0');
            slot.dataset.id = id;
            slot.addEventListener('click', () => {
              selectedId = id;
              hbTrack.querySelectorAll('.mc-slot').forEach(s =>
                s.classList.toggle('is-active', Number(s.dataset.id) === id));
              if (game) game.setSelected(id);
              if (navigator.vibrate) { try { navigator.vibrate(6); } catch {} }
            });
            hbTrack.appendChild(slot);
          });

          function updateHotbarPage() {
            const totalW = HOTBAR.length * HB_SLOT_W + (HOTBAR.length - 1) * HB_GAP;
            const maxOffset = Math.max(0, totalW - HB_VIEWPORT_W);
            const startIndex = hbPage * (HB_PER_PAGE - 1);
            const rawOffset = startIndex * HB_STRIDE;
            const offset = Math.min(rawOffset, maxOffset);

            hbTrack.style.transform = `translateX(${-offset}px)`;
            hbLeft.hidden = hbPage <= 0;
            hbRight.hidden = hbPage >= maxPage;
          }
          updateHotbarPage();

          hbLeft.addEventListener('click', () => {
            if (hbPage <= 0) return;
            hbPage--;
            updateHotbarPage();
            if (navigator.vibrate) { try { navigator.vibrate(5); } catch {} }
          });
          hbRight.addEventListener('click', () => {
            if (hbPage >= maxPage) return;
            hbPage++;
            updateHotbarPage();
            if (navigator.vibrate) { try { navigator.vibrate(5); } catch {} }
          });

          // ---- 启动游戏 ----
          (async () => {
            try {
              const THREE = await ensureThree();
              if (disposed) return;
              game = createGame(THREE, canvas, {
                joyEl, knobEl, jumpBtn, breakBtn, placeBtn,
                fpsEl, selectedId,
              });
              loading.hidden = true;
            } catch (e) {
              console.error('[mc]', e);
              loading.innerHTML = `<div>⚠️ ${e.message || '加载失败'}</div>`;
            }
          })();

          return () => {
            disposed = true;
            if (routeEl) delete routeEl.dataset.blockBackGesture;
            if (game) { try { game.destroy(); } catch {} }
          };
        },
      },
    },
  });

  // ==================== 世界 ====================
  function createGame(THREE, canvas, ui) {
    const {
      WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3,
      BoxGeometry, MeshStandardMaterial, Mesh,
      InstancedMesh, Matrix4, DirectionalLight, AmbientLight, HemisphereLight,
      Raycaster, Vector2, Fog, SRGBColorSpace, ACESFilmicToneMapping,
      DynamicDrawUsage,
    } = THREE;

    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x87ceeb, 1);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new Scene();
    scene.background = new Color(0x87ceeb);
    scene.fog = new Fog(0x87ceeb, 40, 80);

    const camera = new PerspectiveCamera(72, 560 / 420, 0.1, 200);
    camera.rotation.order = 'YXZ';

    scene.add(new AmbientLight(0xffffff, 1.0));
    scene.add(new HemisphereLight(0xb8d8ff, 0x556677, 1.4));
    const sun = new DirectionalLight(0xfff2e0, 2.8);
    sun.position.set(30, 50, 20);
    scene.add(sun);

    // ---- 世界数据 ----
    const db = AppStorage.for(BUNDLE);
    const world = new Map();
    function key(x, y, z) { return `${x},${y},${z}`; }

    function seedTerrain() {
      for (let x = 0; x < SIZE; x++) {
        for (let z = 0; z < SIZE; z++) {
          const h = Math.round(
            3 + Math.sin(x * 0.4) * 1.2 + Math.cos(z * 0.45) * 1.2 +
            Math.sin((x + z) * 0.3) * 0.8
          );
          for (let y = 0; y <= h; y++) {
            let id;
            if (y === h) id = BLOCK_IDS.GRASS;
            else if (y >= h - 1) id = BLOCK_IDS.DIRT;
            else id = BLOCK_IDS.STONE;
            world.set(key(x, y, z), id);
          }
        }
      }
      const trees = [[8, 8], [22, 12], [14, 24], [25, 26]];
      trees.forEach(([tx, tz]) => {
        let groundY = 0;
        for (let y = HEIGHT - 1; y >= 0; y--) {
          if (world.has(key(tx, y, tz))) { groundY = y; break; }
        }
        const trunkH = 4;
        for (let i = 1; i <= trunkH; i++) world.set(key(tx, groundY + i, tz), BLOCK_IDS.WOOD);
        const topY = groundY + trunkH;
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -1; dy <= 2; dy++) {
            for (let dz = -2; dz <= 2; dz++) {
              const dist = Math.sqrt(dx * dx + dz * dz);
              if (dist > 2.2) continue;
              if (dy === 2 && dist > 1.5) continue;
              const lx = tx + dx, ly = topY + dy, lz = tz + dz;
              if (lx < 0 || lx >= SIZE || lz < 0 || lz >= SIZE) continue;
              if (ly < 0 || ly >= HEIGHT) continue;
              if (world.has(key(lx, ly, lz))) continue;
              world.set(key(lx, ly, lz), BLOCK_IDS.LEAVES);
            }
          }
        }
      });
    }
    seedTerrain();

    // ---- InstancedMesh ----
    const MAX = SIZE * SIZE * HEIGHT;
    const mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 }),
      MAX
    );
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const matrix = new Matrix4();
    const color = new Color();
    const coords = [];

    function isBlockExposed(x, y, z) {
      return !world.has(key(x + 1, y, z)) || !world.has(key(x - 1, y, z)) ||
        !world.has(key(x, y + 1, z)) || !world.has(key(x, y - 1, z)) ||
        !world.has(key(x, y, z + 1)) || !world.has(key(x, y, z - 1));
    }

    function rebuild() {
      let i = 0;
      coords.length = 0;
      world.forEach((id, k) => {
        const [x, y, z] = k.split(',').map(Number);
        if (y > 0 && !isBlockExposed(x, y, z)) return;
        matrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
        mesh.setMatrixAt(i, matrix);
        color.setHex(BLOCK_COLORS[id] || 0x999999);
        mesh.setColorAt(i, color);
        coords.push([x, y, z]);
        i++;
      });
      for (let j = i; j < MAX; j++) {
        matrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(j, matrix);
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    rebuild();

    // ---- 读存档 ----
    let loaded = false;
    (async () => {
      try {
        const saved = await db.get(SAVE_KEY, null);
        if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
          world.clear();
          for (const k in saved) world.set(k, saved[k]);
          rebuild();
        }
      } catch (e) { console.warn('[mc] 读档失败', e); }
      finally { loaded = true; }
    })();

    let saveTimer = null;
    function save() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        saveTimer = null;
        if (!loaded) return;
        const obj = {};
        world.forEach((v, k) => { obj[k] = v; });
        try { await db.set(SAVE_KEY, obj); } catch (e) { console.warn('[mc] 保存失败', e); }
      }, 400);
    }

    // ---- 玩家 ----
    const player = {
      pos: new Vector3(SIZE / 2, 20, SIZE / 2),
      velY: 0, onGround: false,
      yaw: 0, pitch: 0,
      halfW: 0.3, height: 1.8, eye: 1.62,
    };

    function findSpawn() {
      const cx = SIZE / 2;
      for (let y = HEIGHT - 1; y >= 0; y--) {
        if (world.has(key(Math.floor(cx), y, Math.floor(cx)))) {
          player.pos.set(cx, y + 1, cx);
          return;
        }
      }
      player.pos.set(cx, 1, cx);
    }
    findSpawn();

    // ---- 碰撞 ----
    function collides(px, py, pz) {
      const minX = Math.floor(px - player.halfW + 0.001);
      const maxX = Math.floor(px + player.halfW - 0.001);
      const minZ = Math.floor(pz - player.halfW + 0.001);
      const maxZ = Math.floor(pz + player.halfW - 0.001);
      const minY = Math.floor(py);
      const maxY = Math.floor(py + player.height - 0.001);
      for (let by = minY; by <= maxY; by++) {
        for (let bx = minX; bx <= maxX; bx++) {
          for (let bz = minZ; bz <= maxZ; bz++) {
            if (world.has(key(bx, by, bz))) return true;
          }
        }
      }
      return false;
    }
    function tryMoveX(dx) {
      if (dx === 0) return;
      const nx = player.pos.x + dx;
      if (!collides(nx, player.pos.y, player.pos.z)) player.pos.x = nx;
      else if (dx > 0) player.pos.x = Math.floor(nx + player.halfW) - player.halfW - 0.001;
      else player.pos.x = Math.floor(nx - player.halfW) + 1 + player.halfW + 0.001;
    }
    function tryMoveZ(dz) {
      if (dz === 0) return;
      const nz = player.pos.z + dz;
      if (!collides(player.pos.x, player.pos.y, nz)) player.pos.z = nz;
      else if (dz > 0) player.pos.z = Math.floor(nz + player.halfW) - player.halfW - 0.001;
      else player.pos.z = Math.floor(nz - player.halfW) + 1 + player.halfW + 0.001;
    }
    function tryMoveY(dy) {
      const ny = player.pos.y + dy;
      if (!collides(player.pos.x, ny, player.pos.z)) {
        player.pos.y = ny;
        player.onGround = false;
        return true;
      }
      if (dy < 0) {
        player.pos.y = Math.floor(ny) + 1;
        player.onGround = true;
        player.velY = 0;
      } else {
        player.velY = 0;
      }
      return false;
    }

    // ---- 输入 ----
    const input = { moveX: 0, moveY: 0, jump: false };

    // 摇杆
    let joyActive = false;
    let joyPointerId = null;
    let joyStartX = 0, joyStartY = 0;
    const JOY_RADIUS = 56;

    ui.joyEl.addEventListener('pointerdown', e => {
      joyActive = true;
      joyPointerId = e.pointerId;
      joyStartX = e.clientX;
      joyStartY = e.clientY;
      ui.joyEl.classList.add('is-active');
      try { ui.joyEl.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });

    ui.joyEl.addEventListener('pointermove', e => {
      if (!joyActive || e.pointerId !== joyPointerId) return;

      const sdx = e.clientX - joyStartX;
      const sdy = e.clientY - joyStartY;
      const len = Math.hypot(sdx, sdy);
      const clamp = Math.min(1, len / JOY_RADIUS);

      if (len > 0.001) {
        // 物理右 → 用户视角向下推 → 后退（负 moveY）
        // 物理上 → 用户视角向右推 → 向右（正 moveX）
        input.moveY = -(sdx / len) * clamp;
        input.moveX = -(sdy / len) * clamp;
      } else {
        input.moveX = 0;
        input.moveY = 0;
      }

      let kx = -sdy;
      let ky = sdx;
      const klen = Math.hypot(kx, ky);
      if (klen > JOY_RADIUS) {
        kx = kx / klen * JOY_RADIUS;
        ky = ky / klen * JOY_RADIUS;
      }
      ui.knobEl.style.transform =
        `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    });

    function endJoy(e) {
      if (!joyActive || (e && e.pointerId !== joyPointerId)) return;
      joyActive = false;
      joyPointerId = null;
      input.moveX = 0;
      input.moveY = 0;
      ui.joyEl.classList.remove('is-active');
      ui.knobEl.style.transform = 'translate(-50%, -50%)';
    }
    ui.joyEl.addEventListener('pointerup', endJoy);
    ui.joyEl.addEventListener('pointercancel', endJoy);

    // 看向
    let lookingPointer = null;
    let lookLastX = 0, lookLastY = 0;
    const LOOK_SENS = 0.0035;

    canvas.addEventListener('pointerdown', e => {
      if (lookingPointer !== null) return;
      lookingPointer = e.pointerId;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    });

    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== lookingPointer) return;
      const sdx = e.clientX - lookLastX;
      const sdy = e.clientY - lookLastY;
      lookLastX = e.clientX;
      lookLastY = e.clientY;

      // 物理右拖 → 用户向上拖 → 抬头（pitch+）
      // 物理上拖 → 用户向右拖 → 向右看（yaw-）
      player.pitch += sdx * LOOK_SENS;
      player.yaw -= sdy * LOOK_SENS;
      player.pitch = Math.max(-Math.PI / 2 + 0.05,
        Math.min(Math.PI / 2 - 0.05, player.pitch));
    });

    function endLook(e) {
      if (e.pointerId !== lookingPointer) return;
      lookingPointer = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    }
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', endLook);

    // 跳跃
    ui.jumpBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      input.jump = true;
      ui.jumpBtn.classList.add('is-active');
      if (navigator.vibrate) { try { navigator.vibrate(6); } catch {} }
    });
    function endJump() {
      input.jump = false;
      ui.jumpBtn.classList.remove('is-active');
    }
    ui.jumpBtn.addEventListener('pointerup', endJump);
    ui.jumpBtn.addEventListener('pointercancel', endJump);
    ui.jumpBtn.addEventListener('pointerleave', endJump);

    // ---- 挖掘 / 放置 ----
    const raycaster = new Raycaster();
    const centerNDC = new Vector2(0, 0);

    function raycastBlock() {
      raycaster.setFromCamera(centerNDC, camera);
      raycaster.far = 6;
      const hits = raycaster.intersectObject(mesh, false);
      if (!hits.length) return null;
      const hit = hits[0];
      const c = coords[hit.instanceId];
      if (!c) return null;
      return { x: c[0], y: c[1], z: c[2], face: hit.face.normal };
    }

    function blockIntersectsPlayer(bx, by, bz) {
      return bx + 1 > player.pos.x - player.halfW &&
        bx < player.pos.x + player.halfW &&
        by + 1 > player.pos.y && by < player.pos.y + player.height &&
        bz + 1 > player.pos.z - player.halfW &&
        bz < player.pos.z + player.halfW;
    }

    let selectedId = ui.selectedId || 1;
    function setSelected(id) { selectedId = id; }

    function doBreak() {
      const hit = raycastBlock();
      if (!hit || hit.y === 0) return false;
      world.delete(key(hit.x, hit.y, hit.z));
      rebuild(); save();
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
      return true;
    }
    function doPlace() {
      const hit = raycastBlock();
      if (!hit) return false;
      const n = hit.face;
      const px = hit.x + Math.round(n.x);
      const py = hit.y + Math.round(n.y);
      const pz = hit.z + Math.round(n.z);
      if (px < 0 || px >= SIZE || pz < 0 || pz >= SIZE) return false;
      if (py < 0 || py >= HEIGHT) return false;
      if (world.has(key(px, py, pz))) return false;
      if (blockIntersectsPlayer(px, py, pz)) return false;
      world.set(key(px, py, pz), selectedId);
      rebuild(); save();
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
      return true;
    }

    ui.breakBtn.addEventListener('click', doBreak);
    ui.placeBtn.addEventListener('click', doPlace);

    // ---- 尺寸 ----
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // ---- 循环 ----
    let disposed = false;
    let rafId = null;
    let lastTime = performance.now();
    let frameCount = 0, fpsAccum = 0;

    const GRAVITY = -22;
    const SPEED = 4.8;
    const JUMP_V = 8.2;
    const forward = new Vector3();
    const right = new Vector3();

    function tick(now) {
      if (disposed) return;
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      frameCount++;
      fpsAccum += dt;
      if (fpsAccum >= 0.5) {
        if (ui.fpsEl) ui.fpsEl.textContent = Math.round(frameCount / fpsAccum) + ' FPS';
        frameCount = 0; fpsAccum = 0;
      }

      forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

      let mx = 0, mz = 0;
      if (input.moveY > 0.05) { mx += forward.x; mz += forward.z; }
      if (input.moveY < -0.05) { mx -= forward.x; mz -= forward.z; }
      if (input.moveX > 0.05) { mx += right.x; mz += right.z; }
      if (input.moveX < -0.05) { mx -= right.x; mz -= right.z; }

      const len = Math.hypot(mx, mz);
      if (len > 0.001) {
        const speed = SPEED * Math.min(1, Math.hypot(input.moveX, input.moveY));
        mx = (mx / len) * speed * dt;
        mz = (mz / len) * speed * dt;
      } else { mx = mz = 0; }

      tryMoveX(mx);
      tryMoveZ(mz);

      if (input.jump && player.onGround) {
        player.velY = JUMP_V;
        player.onGround = false;
      }
      player.velY += GRAVITY * dt;
      if (player.velY < -30) player.velY = -30;
      tryMoveY(player.velY * dt);

      if (player.pos.y < -5) { findSpawn(); player.velY = 0; }

      camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(tick);

    return {
      setSelected,
      destroy() {
        disposed = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
          if (loaded) {
            const obj = {};
            world.forEach((v, k) => { obj[k] = v; });
            db.set(SAVE_KEY, obj).catch(() => {});
          }
        }
        ro.disconnect();
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
            else o.material.dispose();
          }
        });
        renderer.dispose();
      },
    };
  }
})();