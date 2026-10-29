(() => {
  const THREE_VERSION = '0.160.0';
  const CDN_LIST = [
    `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`,
    `https://unpkg.com/three@${THREE_VERSION}/build/three.module.min.js`,
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
  const SIZE = 64;
  const HEIGHT = 14;
  const SAVE_KEY = 'world';
  const HOTBAR_KEY = 'hotbar';

  const BLOCK_IDS = {
    GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4,
    LEAVES: 5, SAND: 6, GLASS: 7, BRICK: 8,
    STONE_BRICK: 9, PLANK: 10, SNOW: 11, WUJIGALLERY: 12,
  };
  const BLOCK_NAMES = {
    1: '草方块', 2: '泥土', 3: '石头', 4: '原木',
    5: '树叶', 6: '沙子', 7: '玻璃', 8: '砖块',
    9: '石砖', 10: '木板', 11: '雪', 12: '应用市场',
  };
  const ALL_BLOCKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const DEFAULT_HOTBAR = [1, 3, 4, 8, 7];

  const BAG_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>`;

  const CLOSE_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6L6 18"/>
      <path d="M6 6l12 12"/>
    </svg>`;

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际MC',
    icon: './assets/mc.svg',
    initialRoute: 'main',
    version: '1.4.3',

    styles: `
      .mc-wrap { position: absolute; inset: 0; background: #000; overflow: hidden; }
      .mc-stage {
        position: absolute; top: 50%; left: 50%;
        width: 560px; height: 420px;
        transform: translate(-50%, -50%) rotate(90deg);
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
        position: absolute; top: 12px; left: 24px;
        width: 56px; height: 56px; padding: 0;
        border: 0; border-radius: 50%;
        background: rgba(0,0,0,.55);
        border: 1px solid rgba(255,255,255,.25);
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 10;
        -webkit-tap-highlight-color: transparent; touch-action: none;
      }
      .mc-exit:active { transform: scale(.92); }
      .mc-exit svg { width: 28px; height: 28px; display: block; pointer-events: none; }

      .mc-fps {
        position: absolute; top: 16px; right: 16px;
        padding: 6px 12px; border-radius: 8px;
        background: rgba(0,0,0,.55);
        color: #8ad4ff;
        font-family: ui-monospace, monospace;
        font-size: 18px; font-weight: 600;
        pointer-events: none; z-index: 6;
      }

      .mc-joy {
        position: absolute; left: 16px; bottom: 16px;
        width: 140px; height: 140px;
        border-radius: 50%;
        background: rgba(0,0,0,.28);
        border: 2px solid rgba(255,255,255,.25);
        z-index: 7; touch-action: none;
        user-select: none; -webkit-user-select: none;
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
        touch-action: none;
        user-select: none; -webkit-user-select: none;
        transition: background .1s, transform .08s;
      }
      .mc-btn.is-active {
        background: rgba(74,125,255,.6);
        transform: scale(.92);
      }
      .mc-btn--jump { right: 16px; bottom: 16px; width: 80px; height: 80px; font-size: 20px; }
      .mc-btn--break { right: 96px; bottom: 16px; width: 68px; height: 68px; font-size: 26px; }
      .mc-btn--place { right: 16px; bottom: 108px; width: 68px; height: 68px; font-size: 28px; }

      /* ============ 快捷栏：去掉 blur ============ */
      .mc-hotbar {
        position: absolute;
        left: 50%; bottom: 10px;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border-radius: 12px;
        background: rgba(0,0,0,.55);          /* ★ 无 blur，纯半透明黑 */
        border: 1px solid rgba(255,255,255,.22);
        z-index: 16;
        touch-action: none;
      }

      .mc-hb-track {
        display: flex;
        gap: 3px;
        height: 36px;
      }

      .mc-slot {
        flex: 0 0 36px;
        width: 36px; height: 36px;
        padding: 0; border: 0; border-radius: 8px;
        background-color: rgba(255,255,255,.06);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        image-rendering: pixelated;
        position: relative;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
        user-select: none; -webkit-user-select: none;
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.18);
        transition: transform .1s, box-shadow .15s;
      }
      .mc-slot.is-active {
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.18), 0 0 0 3px #ffd54a;
        transform: scale(1.06);
      }

      .mc-hb-bag {
        flex: 0 0 36px;
        width: 36px; height: 36px;
        padding: 0; border: 0; border-radius: 8px;
        background: rgba(255,255,255,.15);
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
        user-select: none; -webkit-user-select: none;
        transition: background .1s, transform .08s;
      }
      .mc-hb-bag:active { background: rgba(255,255,255,.32); transform: scale(.92); }
      .mc-hb-bag.is-open { background: rgba(255,255,255,.28); }
      .mc-hb-bag svg { width: 22px; height: 22px; pointer-events: none; display: block; }

      /* ============ 物品栏面板 ============ */
      .mc-inventory {
        position: absolute; inset: 0;
        z-index: 15;
        pointer-events: none;
      }
      .mc-inventory[hidden] { display: none !important; }

      .mc-inventory__backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,.5);          /* ★ 无 blur */
        pointer-events: auto;
      }
      .mc-inventory__backdrop.is-opening {
        animation: mcInvBackdropIn .2s ease forwards;
      }
      .mc-inventory__backdrop.is-closing {
        animation: mcInvBackdropOut .2s ease forwards;
      }
      @keyframes mcInvBackdropIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes mcInvBackdropOut { from { opacity: 1; } to { opacity: 0; } }

      .mc-inventory__panel {
        position: absolute;
        left: 50%;
        bottom: 62px;
        transform: translateX(-50%);
        width: fit-content;
        max-width: calc(100% - 24px);
        background: #c6c6c6;                  /* ★ MC 浅灰 */
        border: 2px solid #373737;
        border-radius: 6px;
        padding: 14px 16px 16px;
        box-shadow:
          inset -2px -2px 0 rgba(0,0,0,.15),
          inset  2px  2px 0 rgba(255,255,255,.45),
          0 -4px 20px rgba(0,0,0,.4);
        pointer-events: auto;
        box-sizing: border-box;
      }
      .mc-inventory__panel.is-opening {
        animation: mcInvPanelIn .24s cubic-bezier(.2,.7,.3,1) forwards;
      }
      .mc-inventory__panel.is-closing {
        animation: mcInvPanelOut .2s cubic-bezier(.4,0,.6,1) forwards;
      }
      @keyframes mcInvPanelIn {
        from { transform: translateX(-50%) translateY(16px); opacity: 0; }
        to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
      }
      @keyframes mcInvPanelOut {
        from { transform: translateX(-50%) translateY(0);    opacity: 1; }
        to   { transform: translateX(-50%) translateY(16px); opacity: 0; }
      }

      .mc-inventory__header {
        margin-bottom: 12px;
        font-size: 20px;
        font-weight: 800;
        color: #3f3f3f;
        text-shadow: 0 1px 0 rgba(255,255,255,.6);
        letter-spacing: .5px;
      }

      .mc-inventory__grid {
        display: grid;
        grid-template-columns: repeat(4, 48px);
        gap: 6px;
      }

      .mc-inv-cell {
        width: 48px; height: 48px;
        padding: 0;
        background-color: #8b8b8b;
        background-size: cover;
        background-position: center;
        image-rendering: pixelated;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
        user-select: none; -webkit-user-select: none;
        border: 2px solid;
        border-color: #373737 #ffffff #ffffff #373737;   /* ★ MC 凹槽 */
        border-radius: 2px;
        transition: transform .08s, box-shadow .1s;
      }
      .mc-inv-cell:active {
        transform: scale(.9);
      }
      .mc-inv-cell.is-current {
        border-color: #3a6ff0 #3a6ff0 #3a6ff0 #3a6ff0;
        box-shadow: 0 0 0 2px rgba(58,111,240,.5);
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
        border: 3px solid rgba(138,212,255,.2); border-top-color: #8ad4ff;
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
                  <div class="mc-hb-track" id="mcHBTrack"></div>
                  <button class="mc-hb-bag" id="mcHBBag" type="button" aria-label="物品栏">
                    ${BAG_SVG}
                  </button>
                </div>

                <div class="mc-inventory" id="mcInventory" hidden>
                  <div class="mc-inventory__backdrop" id="mcInvBackdrop"></div>
                  <div class="mc-inventory__panel" id="mcInvPanel">
                    <div class="mc-inventory__header">物品栏</div>
                    <div class="mc-inventory__grid" id="mcInvGrid"></div>
                  </div>
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
          const loading = root.querySelector('#mcLoading');
          const fpsEl = root.querySelector('#mcFps');
          const exitBtn = root.querySelector('#mcExit');
          const joyEl = root.querySelector('#mcJoy');
          const knobEl = root.querySelector('#mcKnob');
          const jumpBtn = root.querySelector('#mcJump');
          const breakBtn = root.querySelector('#mcBreak');
          const placeBtn = root.querySelector('#mcPlace');
          const hbTrack = root.querySelector('#mcHBTrack');
          const bagBtn = root.querySelector('#mcHBBag');
          const mcInventory = root.querySelector('#mcInventory');
          const mcInvPanel = root.querySelector('#mcInvPanel');
          const mcInvBackdrop = root.querySelector('#mcInvBackdrop');
          const invGrid = root.querySelector('#mcInvGrid');

          const routeEl = ctx.nav?.current?.element;
          if (routeEl) routeEl.dataset.blockBackGesture = '1';

          const db = AppStorage.for(BUNDLE);

          let disposed = false;
          let game = null;

          // ---- 快捷栏状态 ----
          const hotbarSlots = [...DEFAULT_HOTBAR];
          let currentSlotIndex = 0;
          let selectedId = hotbarSlots[0];
          const previewCache = {};

          // ============ 快捷栏 ============
          function renderHotbar() {
            hbTrack.innerHTML = '';
            hotbarSlots.forEach((id, i) => {
              const slot = document.createElement('button');
              slot.className = 'mc-slot' + (i === currentSlotIndex ? ' is-active' : '');
              if (previewCache[id]) slot.style.backgroundImage = `url(${previewCache[id]})`;
              slot.title = BLOCK_NAMES[id] || '';
              slot.addEventListener('pointerdown', e => {
                e.preventDefault();
                currentSlotIndex = i;
                selectedId = hotbarSlots[i];
                updateHotbarVisuals();
                if (game) game.setSelected(selectedId);
                if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
              });
              hbTrack.appendChild(slot);
            });
          }

          function updateHotbarVisuals() {
            const slots = hbTrack.querySelectorAll('.mc-slot');
            slots.forEach((s, i) => {
              s.classList.toggle('is-active', i === currentSlotIndex);
              if (previewCache[hotbarSlots[i]]) {
                s.style.backgroundImage = `url(${previewCache[hotbarSlots[i]]})`;
              }
              s.title = BLOCK_NAMES[hotbarSlots[i]] || '';
            });
          }

          async function saveHotbar() {
            try { await db.set(HOTBAR_KEY, [...hotbarSlots]); }
            catch (e) { console.warn('[mc] 保存快捷栏失败', e); }
          }

          async function loadHotbar() {
            try {
              const saved = await db.get(HOTBAR_KEY, null);
              if (Array.isArray(saved) && saved.length === hotbarSlots.length) {
                saved.forEach((id, i) => {
                  if (typeof id === 'number' && BLOCK_NAMES[id]) hotbarSlots[i] = id;
                });
                selectedId = hotbarSlots[currentSlotIndex];
                if (game) game.setSelected(selectedId);
                updateHotbarVisuals();
              }
            } catch (e) { console.warn('[mc] 读快捷栏失败', e); }
          }

          // ============ 物品栏 ============
          function setBagIcon(open) {
            bagBtn.innerHTML = open ? CLOSE_SVG : BAG_SVG;
            bagBtn.classList.toggle('is-open', open);
            bagBtn.setAttribute('aria-label', open ? '关闭物品栏' : '物品栏');
          }

          function renderInventory() {
            invGrid.innerHTML = '';
            ALL_BLOCKS.forEach(id => {
              const cell = document.createElement('button');
              cell.className = 'mc-inv-cell' +
                (hotbarSlots[currentSlotIndex] === id ? ' is-current' : '');
              cell.dataset.id = id;
              if (previewCache[id]) cell.style.backgroundImage = `url(${previewCache[id]})`;
              cell.title = BLOCK_NAMES[id] || '';
              // ★ 点击替换，无拖动
              cell.addEventListener('pointerdown', e => {
                e.preventDefault();
                hotbarSlots[currentSlotIndex] = id;
                selectedId = id;
                updateHotbarVisuals();
                if (game) game.setSelected(id);
                saveHotbar();
                invGrid.querySelectorAll('.mc-inv-cell').forEach(c =>
                  c.classList.toggle('is-current', Number(c.dataset.id) === id));
                if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
              });
              invGrid.appendChild(cell);
            });
          }

          let closeTimer = null;

          function showInventory() {
            if (!mcInventory.hidden) return;
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }

            renderInventory();
            mcInventory.hidden = false;

            mcInvPanel.classList.remove('is-closing');
            mcInvBackdrop.classList.remove('is-closing');
            void mcInvPanel.offsetWidth;
            mcInvPanel.classList.add('is-opening');
            mcInvBackdrop.classList.add('is-opening');

            setBagIcon(true);
          }

          function hideInventory() {
            if (mcInventory.hidden) return;

            mcInvPanel.classList.remove('is-opening');
            mcInvBackdrop.classList.remove('is-opening');
            void mcInvPanel.offsetWidth;
            mcInvPanel.classList.add('is-closing');
            mcInvBackdrop.classList.add('is-closing');

            setBagIcon(false);

            if (closeTimer) clearTimeout(closeTimer);
            closeTimer = setTimeout(() => {
              mcInventory.hidden = true;
              mcInvPanel.classList.remove('is-closing');
              mcInvBackdrop.classList.remove('is-closing');
              closeTimer = null;
            }, 220);
          }

          function toggleInventory() {
            if (mcInventory.hidden) showInventory();
            else hideInventory();
          }

          bagBtn.addEventListener('pointerdown', e => {
            e.preventDefault();
            toggleInventory();
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
          });

          mcInvBackdrop.addEventListener('pointerdown', e => {
            e.preventDefault();
            hideInventory();
          });

          // ============ 退出 ============
          exitBtn.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
            ctx.close();
          });

          // ============ 启动 ============
          renderHotbar();

          (async () => {
            try {
              const THREE = await ensureThree();
              if (disposed) return;
              game = createGame(THREE, canvas, {
                joyEl, knobEl, jumpBtn, breakBtn, placeBtn, fpsEl,
                selectedId,
                onSpriteReady: (img) => {
                  for (let id = 1; id <= 16; id++) {
                    const row = id - 1;
                    const col = 1;
                    const c = document.createElement('canvas');
                    c.width = c.height = 48;
                    const cx = c.getContext('2d');
                    cx.imageSmoothingEnabled = false;
                    cx.drawImage(img, col * 16, row * 16, 16, 16, 0, 0, 48, 48);
                    previewCache[id] = c.toDataURL();
                  }
                  updateHotbarVisuals();
                  if (!mcInventory.hidden) renderInventory();
                },
              });
              loading.hidden = true;
              await loadHotbar();
            } catch (e) {
              console.error('[mc]', e);
              loading.innerHTML = `<div>⚠️ ${e.message || '加载失败'}</div>`;
            }
          })();

          return () => {
            disposed = true;
            if (closeTimer) clearTimeout(closeTimer);
            if (routeEl) delete routeEl.dataset.blockBackGesture;
            if (game) { try { game.destroy(); } catch { } }
          };
        },
      },
    },
  });

  function createGame(THREE, canvas, ui) {
    const {
      WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3,
      BoxGeometry, MeshStandardMaterial, Mesh, InstancedMesh, Matrix4,
      DirectionalLight, AmbientLight, HemisphereLight,
      Raycaster, Vector2, Fog, SRGBColorSpace, ACESFilmicToneMapping,
      DynamicDrawUsage, TextureLoader, NearestFilter,
      LinearMipmapLinearFilter, InstancedBufferAttribute, CanvasTexture,
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

    const atlasUrl = './assets/com.wujinb.mc/atlas.png';
    const blockTexture = new TextureLoader().load(
      atlasUrl,
      (tex) => {
        tex.magFilter = NearestFilter;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.colorSpace = SRGBColorSpace;
        if (tex.image && ui.onSpriteReady) ui.onSpriteReady(tex.image);
      },
      undefined,
      () => {
        console.warn('[mc] atlas 加载失败');
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const ctx = c.getContext('2d');
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            for (let by = 0; by < 4; by++) {
              for (let bx = 0; bx < 4; bx++) {
                ctx.fillStyle = (bx + by) % 2 === 0 ? '#000000' : '#ff00ff';
                ctx.fillRect(x * 16 + bx * 4, y * 16 + by * 4, 4, 4);
              }
            }
          }
        }
        const fbTex = new CanvasTexture(c);
        fbTex.magFilter = NearestFilter;
        material.map = fbTex;
        material.needsUpdate = true;
        if (ui.onSpriteReady) ui.onSpriteReady(c);
      }
    );
    blockTexture.magFilter = NearestFilter;
    blockTexture.minFilter = LinearMipmapLinearFilter;
    blockTexture.colorSpace = SRGBColorSpace;

    const db = AppStorage.for(BUNDLE);
    const world = new Map();
    const KEY_SHIFT_Y = 4;
    function key(x, y, z) {
      return ((z * SIZE + x) << KEY_SHIFT_Y) | y;
    }
    function unpackKey(k) {
      const y = k & ((1 << KEY_SHIFT_Y) - 1);
      const rest = k >>> KEY_SHIFT_Y;
      return [rest % SIZE, y, Math.floor(rest / SIZE)];
    }

    function seedTerrain() {
      for (let x = 0; x < SIZE; x++) {
        for (let z = 0; z < SIZE; z++) {
          const biome = Math.sin(x * 0.06) * 0.8 + Math.cos(z * 0.07) * 0.6;

          const h = Math.max(2, Math.round(
            3 +
            Math.sin(x * 0.25) * 2.0 +
            Math.cos(z * 0.3) * 1.8 +
            Math.sin((x + z) * 0.2) * 1.2 +
            biome * 2.5
          ));

          let surfaceId;
          if (biome > 0.6) surfaceId = BLOCK_IDS.SNOW;
          else if (biome < -0.6) surfaceId = BLOCK_IDS.SAND;
          else surfaceId = BLOCK_IDS.GRASS;

          for (let y = 0; y <= h; y++) {
            let id;
            if (y === h) {
              id = surfaceId;
            } else if (y >= h - 1) {
              id = surfaceId === BLOCK_IDS.SAND ? BLOCK_IDS.SAND : BLOCK_IDS.DIRT;
            } else if (y === 0) {
              id = BLOCK_IDS.STONE_BRICK;
            } else {
              id = BLOCK_IDS.STONE;
            }
            world.set(key(x, y, z), id);
          }
        }
      }

      const treeAttempts = 40;
      for (let i = 0; i < treeAttempts; i++) {
        const tx = Math.floor(Math.random() * (SIZE - 4)) + 2;
        const tz = Math.floor(Math.random() * (SIZE - 4)) + 2;
        let groundY = -1;
        for (let y = HEIGHT - 1; y >= 0; y--) {
          if (world.has(key(tx, y, tz))) { groundY = y; break; }
        }
        if (groundY < 0) continue;
        const surface = world.get(key(tx, groundY, tz));
        if (surface !== BLOCK_IDS.GRASS) continue;

        const trunkH = 4 + Math.floor(Math.random() * 2);
        for (let j = 1; j <= trunkH; j++) {
          world.set(key(tx, groundY + j, tz), BLOCK_IDS.WOOD);
        }
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
      }
    }
    seedTerrain();

    const MAX = SIZE * SIZE * HEIGHT;
    const geometry = new BoxGeometry(1, 1, 1);
    const aBlockIdAttr = new InstancedBufferAttribute(new Float32Array(MAX), 1);
    geometry.setAttribute('aBlockId', aBlockIdAttr);

    const material = new MeshStandardMaterial({
      map: blockTexture,
      roughness: 0.9,
      metalness: 0.02,
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        attribute float aBlockId;
        varying float vBlockId;
        varying float vFaceIdx;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBlockId = aBlockId;
        float faceIdx = 1.0;
        if (normal.y > 0.5) faceIdx = 0.0;
        else if (normal.y < -0.5) faceIdx = 2.0;
        vFaceIdx = faceIdx;
        `
      );

      shader.fragmentShader = `
        varying float vBlockId;
        varying float vFaceIdx;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        vec4 sampledDiffuseColor = vec4(1.0);
        if (vBlockId > 0.5) {
          float row_idx = floor(vBlockId) - 1.0;
          float v_off = (15.0 - row_idx) / 16.0;
          vec2 off = vec2(vFaceIdx / 16.0, v_off);
          vec2 uv2 = vMapUv / 16.0 + off;
          sampledDiffuseColor = texture2D(map, uv2);
        }
        diffuseColor *= sampledDiffuseColor;
        `
      );
    };

    const mesh = new InstancedMesh(geometry, material, MAX);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const matrix = new Matrix4();
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
        const [x, y, z] = unpackKey(k);
        if (y > 0 && !isBlockExposed(x, y, z)) return;
        matrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
        mesh.setMatrixAt(i, matrix);
        aBlockIdAttr.array[i] = id;
        coords.push([x, y, z]);
        i++;
      });
      for (let j = i; j < MAX; j++) {
        matrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(j, matrix);
        aBlockIdAttr.array[j] = 0;
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      aBlockIdAttr.needsUpdate = true;
    }
    rebuild();

    const player = {
      pos: new Vector3(SIZE / 2, 20, SIZE / 2),
      velY: 0, onGround: false,
      yaw: 0, pitch: 0,
      halfW: 0.3, height: 1.8, eye: 1.62,
    };

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

    function snapToGround() {
      // 从玩家当前 y 往下找最近的地面，把玩家放上去
      const px = Math.floor(player.pos.x);
      const pz = Math.floor(player.pos.z);
      const startY = Math.min(HEIGHT - 1, Math.max(0, Math.floor(player.pos.y)));
      for (let y = startY; y >= 0; y--) {
        if (world.has(key(px, y, pz))) {
          // 找到方块，玩家站在它上面
          const testY = y + 1;
          // 确保 y+1 和 y+2 不碰撞（玩家高 1.8）
          if (!collides(player.pos.x, testY, player.pos.z)) {
            player.pos.y = testY;
            player.velY = 0;
            player.onGround = true;
            return;
          }
        }
      }
      // 整列都没方块，fallback 到 findSpawn
      findSpawn();
    }

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
    
    let loaded = false;
    (async () => {
      try {
        const saved = await db.get(SAVE_KEY, null);
        if (saved && typeof saved === 'object') {
          const blocks = saved.blocks && typeof saved.blocks === 'object' ? saved.blocks : saved;
          world.clear();
          for (const k in blocks) {
            if (typeof blocks[k] !== 'number') continue;
            let numKey;
            if (k.indexOf(',') !== -1) {
              // 旧格式 "x,y,z" → 整数 key
              const [x, y, z] = k.split(',').map(Number);
              numKey = key(x, y, z);
            } else {
              // 新格式 "33282" → 33282
              numKey = Number(k);
            }
            if (!isNaN(numKey)) world.set(numKey, blocks[k]);
          }
          rebuild();

          if (saved.player && typeof saved.player === 'object') {
            const p = saved.player;
            if (typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number'
                && p.y >= 0 && p.y < HEIGHT
                && !collides(p.x, p.y, p.z)) {
              player.pos.set(p.x, p.y, p.z);
            }
            if (typeof p.yaw === 'number') player.yaw = p.yaw;
            if (typeof p.pitch === 'number') player.pitch = p.pitch;
          }
        }
      } catch (e) { console.warn('[mc] 读档失败', e); }
      finally {
        // ★ 读档完成后，强制落地检查：脚下必须有方块
        snapToGround();
        loaded = true;
      }
    })();

    let saveTimer = null;
    function save() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        saveTimer = null;
        if (!loaded) return;
        const blocks = {};
        world.forEach((v, k) => { blocks[k] = v; });
        try {
          await db.set(SAVE_KEY, {
            blocks,
            player: {
              x: player.pos.x, y: Math.max(0, player.pos.y), z: player.pos.z,
              yaw: player.yaw, pitch: player.pitch,
            },
          });
        } catch (e) { console.warn('[mc] 保存失败', e); }
      }, 400);
    }

    const input = { moveX: 0, moveY: 0, jump: false };

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
      try { ui.joyEl.setPointerCapture(e.pointerId); } catch { }
      e.preventDefault();
    });

    ui.joyEl.addEventListener('pointermove', e => {
      if (!joyActive || e.pointerId !== joyPointerId) return;
      const sdx = e.clientX - joyStartX;
      const sdy = e.clientY - joyStartY;
      const len = Math.hypot(sdx, sdy);
      const clamp = Math.min(1, len / JOY_RADIUS);

      if (len > 0.001) {
        input.moveY = (sdx / len) * clamp;
        input.moveX = (sdy / len) * clamp;
      } else {
        input.moveX = 0; input.moveY = 0;
      }

      let kx = sdy;
      let ky = -sdx;
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
      input.moveX = 0; input.moveY = 0;
      ui.joyEl.classList.remove('is-active');
      ui.knobEl.style.transform = 'translate(-50%, -50%)';
    }
    ui.joyEl.addEventListener('pointerup', endJoy);
    ui.joyEl.addEventListener('pointercancel', endJoy);
    ui.joyEl.addEventListener('lostpointercapture', endJoy);

    let lookingPointer = null;
    let lookLastX = 0, lookLastY = 0;
    const LOOK_SENS = 0.0035;

    canvas.addEventListener('pointerdown', e => {
      if (lookingPointer !== null) return;
      lookingPointer = e.pointerId;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch { }
    });

    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== lookingPointer) return;
      const sdx = e.clientX - lookLastX;
      const sdy = e.clientY - lookLastY;
      lookLastX = e.clientX;
      lookLastY = e.clientY;

      player.pitch += sdx * LOOK_SENS;
      player.yaw -= sdy * LOOK_SENS;
      player.pitch = Math.max(-Math.PI / 2 + 0.05,
        Math.min(Math.PI / 2 - 0.05, player.pitch));
    });

    function endLook(e) {
      if (e.pointerId !== lookingPointer) return;
      lookingPointer = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { }
    }
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', endLook);
    canvas.addEventListener('lostpointercapture', endLook);

    ui.jumpBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      input.jump = true;
      ui.jumpBtn.classList.add('is-active');
      if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
    });
    function endJump() {
      input.jump = false;
      ui.jumpBtn.classList.remove('is-active');
    }
    ui.jumpBtn.addEventListener('pointerup', endJump);
    ui.jumpBtn.addEventListener('pointercancel', endJump);
    ui.jumpBtn.addEventListener('pointerleave', endJump);

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
      if (!hit || hit.y === 0) return;
      world.delete(key(hit.x, hit.y, hit.z));
      rebuild(); save();
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch { } }
    }
    function doPlace() {
      const hit = raycastBlock();
      if (!hit) return;
      const n = hit.face;
      const px = hit.x + Math.round(n.x);
      const py = hit.y + Math.round(n.y);
      const pz = hit.z + Math.round(n.z);
      if (px < 0 || px >= SIZE || pz < 0 || pz >= SIZE) return;
      if (py < 0 || py >= HEIGHT) return;
      if (world.has(key(px, py, pz))) return;
      if (blockIntersectsPlayer(px, py, pz)) return;
      world.set(key(px, py, pz), selectedId);
      rebuild(); save();
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
    }

    ui.breakBtn.addEventListener('pointerdown', e => {
      e.preventDefault(); ui.breakBtn.classList.add('is-active'); doBreak();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt =>
      ui.breakBtn.addEventListener(evt, () => ui.breakBtn.classList.remove('is-active')));

    ui.placeBtn.addEventListener('pointerdown', e => {
      e.preventDefault(); ui.placeBtn.classList.add('is-active'); doPlace();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt =>
      ui.placeBtn.addEventListener(evt, () => ui.placeBtn.classList.remove('is-active')));

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
        return;
      }
      if (dy < 0) {
        player.pos.y = Math.floor(ny) + 1;
        player.onGround = true;
        player.velY = 0;
      } else {
        player.velY = 0;
      }
    }

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

    const posSaveTimer = setInterval(() => {
      if (disposed || !loaded) return;
      save();
    }, 3000);

    return {
      setSelected,
      destroy() {
        disposed = true;
        clearInterval(posSaveTimer);
        if (rafId) cancelAnimationFrame(rafId);
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        if (loaded) {
          const blocks = {};
          world.forEach((v, k) => { blocks[k] = v; });
          db.set(SAVE_KEY, {
            blocks,
            player: {
              x: player.pos.x, y: player.pos.y, z: player.pos.z,
              yaw: player.yaw, pitch: player.pitch,
            },
          }).catch(() => { });
        }
        ro.disconnect();
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
            else o.material.dispose();
          }
        });
        blockTexture.dispose();
        renderer.dispose();
      },
    };
  }
})();