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
          } catch (e) { console.warn('[voxel] CDN failed:', url, e); }
        }
        throw new Error('无法加载 3D 引擎');
      })();
    }
    return threePromise;
  }

  const BUNDLE = 'com.wujinb.voxel';
  const W = 12, H = 6, D = 12;
  const SAVE_KEY = 'world';

  const BLOCKS = [
    { id: 1, name: '草', color: 0x4ade80 },
    { id: 2, name: '土', color: 0x8b5a2b },
    { id: 3, name: '石', color: 0x9ca3af },
    { id: 4, name: '木', color: 0xb45309 },
    { id: 5, name: '玻璃', color: 0x7dd3fc },
  ];

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际沙盒',
    icon: './assets/voxel.svg',
    initialRoute: 'main',
    version: '1.3.0',

    styles: `
      .vx-wrap { position: absolute; inset: 0; background: #0a1428; overflow: hidden; }
      .vx-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }

      .vx-topbar {
        position: absolute;
        top: calc(10px + var(--statusbar-h, 20px));
        left: 12px; right: 12px;
        display: flex; align-items: center; gap: 10px;
        z-index: 6;
      }
      .vx-exit {
        width: 48px; height: 48px; flex-shrink: 0;
        padding: 0; border-radius: 50%;
        background: rgba(0, 0, 0, .6);
        border: 1px solid rgba(138, 212, 255, .22);
        color: #8ad4ff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .12s, transform .08s;
        pointer-events: auto;
      }
      .vx-exit:active { transform: scale(.92); background: rgba(58, 111, 240, .35); }
      .vx-exit svg { width: 24px; height: 24px; display: block; }

      .vx-hud {
        flex: 1;
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px;
        pointer-events: none;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 18px;
        color: rgba(138, 212, 255, .75);
        letter-spacing: .3px;
        text-shadow: 0 1px 3px rgba(0,0,0,.6);
      }
      .vx-hud__stat {
        padding: 5px 9px;
        border-radius: 8px;
        background: rgba(0, 0, 0, .45);
      }

      .vx-bar {
        position: absolute; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%);
        display: flex; gap: 6px;
        padding: 8px 10px;
        border-radius: 1399px;
        background: rgba(10, 20, 40, .82);
        border: 1px solid rgba(138, 212, 255, .18);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        z-index: 5;
      }
      .vx-swatch {
        width: 48px; height: 48px; padding: 0; border: 0; border-radius: 50%;
        cursor: pointer; position: relative;
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.15);
        transition: transform .12s, box-shadow .12s;
        -webkit-tap-highlight-color: transparent;
      }
      .vx-swatch:active { transform: scale(.9); }
      .vx-swatch.is-active {
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.15), 0 0 0 3px #8ad4ff;
        transform: scale(1.08);
      }
      .vx-swatch.is-erase {
        background: rgba(255, 77, 77, .15);
        color: #ff4d4d;
        font-size: 24px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        box-shadow: inset 0 0 0 2px rgba(255,77,77,.5);
      }
      .vx-swatch.is-erase.is-active {
        box-shadow: inset 0 0 0 2px rgba(255,77,77,.5), 0 0 0 3px #ff4d4d;
      }

      .vx-loading {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 14px;
        background: #0a1428; color: #8ad4ff; font-size: 14px; z-index: 10;
      }
      .vx-loading[hidden] { display: none !important; }
      .vx-spin {
        width: 32px; height: 32px; border-radius: 50%;
        border: 3px solid rgba(138,212,255,.2); border-top-color: #8ad4ff;
        animation: vx-spin .8s linear infinite; box-sizing: border-box;
      }
      @keyframes vx-spin { to { transform: rotate(360deg); } }
    `,

    routes: {
      main: {
        name: 'main',
        render() {
          return `
            <div class="vx-wrap">
              <canvas class="vx-canvas" id="vxCanvas"></canvas>

              <div class="vx-topbar">
                <button class="vx-exit" id="vxExit" type="button" aria-label="退出">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 6L6 18"/>
  <path d="M6 6l12 12"/>
</svg>
                </button>
                <div class="vx-hud">
                  <span class="vx-hud__stat" id="vxCount">0 方块</span>
                  <span class="vx-hud__stat" id="vxFps">-- FPS</span>
                </div>
              </div>

              <div class="vx-bar" id="vxBar"></div>

              <div class="vx-loading" id="vxLoading">
                <div class="vx-spin"></div>
                <div>加载 3D 引擎…</div>
              </div>
            </div>
          `;
        },
        mount(root, ctx) {
          const canvas = root.querySelector('#vxCanvas');
          const bar = root.querySelector('#vxBar');
          const countEl = root.querySelector('#vxCount');
          const fpsEl = root.querySelector('#vxFps');
          const loading = root.querySelector('#vxLoading');
          const exitBtn = root.querySelector('#vxExit');

          const routeEl = ctx.nav?.current?.element;
          if (routeEl) routeEl.dataset.blockBackGesture = '1';

          let disposed = false;
          let api = null;

          exitBtn.addEventListener('click', () => {
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
            ctx.close();
          });

          (async () => {
            try {
              const THREE = await ensureThree();
              if (disposed) return;
              api = createWorld(THREE, canvas, { bar, countEl, fpsEl, bundle: BUNDLE });
              loading.hidden = true;
            } catch (e) {
              console.error('[voxel]', e);
              loading.innerHTML = `<div>⚠️ ${e.message || '加载失败'}</div>`;
            }
          })();

          return () => {
            disposed = true;
            if (routeEl) delete routeEl.dataset.blockBackGesture;
            if (api) { try { api.destroy(); } catch {} }
          };
        },
      },
    },
  });

  // ==================== 世界 ====================
  function createWorld(THREE, canvas, { bar, countEl, fpsEl, bundle }) {
    const {
      WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Group,
      BoxGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial,
      Mesh, InstancedMesh, Matrix4, DirectionalLight, AmbientLight,
      HemisphereLight, Raycaster, Vector2, BufferGeometry, BufferAttribute,
      PointsMaterial, Points, Fog, SRGBColorSpace, ACESFilmicToneMapping,
      DynamicDrawUsage,
    } = THREE;

    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x0a1428, 1);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new Scene();
    scene.background = new Color(0x0a1428);
    scene.fog = new Fog(0x0a1428, 28, 60);

    const camera = new PerspectiveCamera(50, 1, 0.1, 200);

    // ---- 光照（r155+ 物理单位）----
    scene.add(new AmbientLight(0xffffff, 1.8));
    scene.add(new HemisphereLight(0x9bb8ff, 0x334455, 1.4));

    const sun = new DirectionalLight(0xfff2e0, 3.5);
    sun.position.set(8, 15, 6);
    scene.add(sun);

    const fill = new DirectionalLight(0x88bbff, 1.2);
    fill.position.set(-8, 6, -6);
    scene.add(fill);

    // ---- 地面 ----
    const groundGeo = new PlaneGeometry(W, D);
    const groundMat = new MeshStandardMaterial({ color: 0x1f2a40, roughness: 1 });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(W / 2 - 0.5, 0, D / 2 - 0.5);
    scene.add(ground);

    const gridGroup = new Group();
    const lineMat = new MeshBasicMaterial({ color: 0x3a4a6a });
    for (let i = 0; i <= W; i++) {
      const l = new Mesh(new BoxGeometry(0.02, 0.01, D), lineMat);
      l.position.set(i - 0.5, 0.006, D / 2 - 0.5);
      gridGroup.add(l);
    }
    for (let i = 0; i <= D; i++) {
      const l = new Mesh(new BoxGeometry(W, 0.01, 0.02), lineMat);
      l.position.set(W / 2 - 0.5, 0.006, i - 0.5);
      gridGroup.add(l);
    }
    scene.add(gridGroup);

    // ---- 星空 ----
    const starPos = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const r = 50 + Math.random() * 40;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(Math.random() * 2 - 1);
      starPos[i*3] = r * Math.sin(p) * Math.cos(t);
      starPos[i*3+1] = Math.abs(r * Math.sin(p) * Math.sin(t)) + 5;
      starPos[i*3+2] = r * Math.cos(p);
    }
    const starGeo = new BufferGeometry();
    starGeo.setAttribute('position', new BufferAttribute(starPos, 3));
    const stars = new Points(starGeo, new PointsMaterial({
      color: 0xffffff, size: 0.15, sizeAttenuation: true,
      transparent: true, opacity: 0.8, fog: false,
    }));
    scene.add(stars);

    // ---- 方块数据 ----
    const db = AppStorage.for(bundle);
    const world = new Map();
    function key(x, y, z) { return `${x},${y},${z}`; }

    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        world.set(key(x, 0, z), 1);
      }
    }

    const MAX = W * H * D;
    const mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05 }),
      MAX
    );
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    scene.add(mesh);

    const matrix = new Matrix4();
    const color = new Color();
    const pos = new Vector3();

    let loaded = false;

    function rebuild() {
      let i = 0;
      world.forEach((blockId, k) => {
        const [x, y, z] = k.split(',').map(Number);
        pos.set(x, y + 0.5, z);
        matrix.makeTranslation(pos.x, pos.y, pos.z);
        mesh.setMatrixAt(i, matrix);
        const b = BLOCKS.find(b => b.id === blockId) || BLOCKS[0];
        color.setHex(b.color);
        mesh.setColorAt(i, color);
        i++;
      });
      for (let j = i; j < MAX; j++) {
        matrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(j, matrix);
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      countEl.textContent = i + ' 方块';
    }
    rebuild();

    (async () => {
      try {
        const saved = await db.get(SAVE_KEY, null);
        if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
          world.clear();
          for (const k in saved) world.set(k, saved[k]);
          rebuild();
        }
      } catch (e) {
        console.warn('[voxel] 读取存档失败', e);
      } finally {
        loaded = true;
      }
    })();

    let saveTimer = null;
    function save() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        saveTimer = null;
        if (!loaded) return;
        const obj = {};
        world.forEach((v, k) => { obj[k] = v; });
        try { await db.set(SAVE_KEY, obj); }
        catch (e) { console.warn('[voxel] 保存失败', e); }
      }, 300);
    }

    // ---- 相机 ----
    const camState = {
      theta: Math.PI * 0.25,
      phi: Math.PI * 0.32,
      radius: 16,
      target: new Vector3(W / 2 - 0.5, 1.5, D / 2 - 0.5),
    };

    function updateCamera() {
      camState.phi = Math.max(0.15, Math.min(Math.PI * 0.48, camState.phi));
      camState.radius = Math.max(6, Math.min(35, camState.radius));
      const r = camState.radius;
      const x = camState.target.x + r * Math.sin(camState.phi) * Math.cos(camState.theta);
      const y = camState.target.y + r * Math.cos(camState.phi);
      const z = camState.target.z + r * Math.sin(camState.phi) * Math.sin(camState.theta);
      camera.position.set(x, y, z);
      camera.lookAt(camState.target);
    }
    updateCamera();

    // ---- 色板 ----
    let selectedId = 1;
    let eraseMode = false;

    BLOCKS.forEach(b => {
      const sw = document.createElement('button');
      sw.className = 'vx-swatch';
      sw.style.background = '#' + b.color.toString(16).padStart(6, '0');
      sw.title = b.name;
      sw.dataset.id = b.id;
      sw.addEventListener('click', () => {
        selectedId = b.id;
        eraseMode = false;
        updateSwatches();
      });
      bar.appendChild(sw);
    });

    const eraseSw = document.createElement('button');
    eraseSw.className = 'vx-swatch is-erase';
    eraseSw.textContent = '×';
    eraseSw.title = '删除';
    eraseSw.addEventListener('click', () => {
      eraseMode = !eraseMode;
      updateSwatches();
    });
    bar.appendChild(eraseSw);

    function updateSwatches() {
      bar.querySelectorAll('.vx-swatch').forEach(sw => {
        if (sw === eraseSw) {
          sw.classList.toggle('is-active', eraseMode);
        } else {
          sw.classList.toggle('is-active', !eraseMode && Number(sw.dataset.id) === selectedId);
        }
      });
    }
    updateSwatches();

    // ---- 交互 ----
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let dragging = false;
    let downX = 0, downY = 0;
    let lastX = 0, lastY = 0;
    let moved = false;
    let pinchDist = 0;
    const pointers = new Map();

    function onPointerDown(e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true;
        moved = false;
        downX = e.clientX;
        downY = e.clientY;
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        dragging = false;
      }
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    }

    function onPointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchDist > 0) {
          camState.radius *= pinchDist / d;
          updateCamera();
        }
        pinchDist = d;
        return;
      }

      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) moved = true;
      lastX = e.clientX;
      lastY = e.clientY;
      // ★ theta += 而不是 -=，让世界跟手转动
      camState.theta += dx * 0.008;
      camState.phi -= dy * 0.008;
      updateCamera();
    }

    function onPointerUp(e) {
      const wasDown = pointers.has(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        dragging = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
        if (wasDown && !moved) handleTap(e.clientX, e.clientY);
      }
    }

    function handleTap(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);

      const hits = raycaster.intersectObject(mesh, false);
      if (hits.length) {
        const hit = hits[0];
        const instanceId = hit.instanceId;
        let i = 0;
        let foundKey = null;
        world.forEach((v, k) => {
          if (i === instanceId) foundKey = k;
          i++;
        });
        if (!foundKey) return;

        const [x, y, z] = foundKey.split(',').map(Number);

        if (eraseMode) {
          if (y === 0) return;
          world.delete(foundKey);
          rebuild();
          save();
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
          return;
        }

        const n = hit.face.normal;
        const nx = x + Math.round(n.x);
        const ny = y + Math.round(n.y);
        const nz = z + Math.round(n.z);

        if (ny < 0 || ny >= H) return;
        if (nx < 0 || nx >= W || nz < 0 || nz >= D) return;
        const nk = key(nx, ny, nz);
        if (world.has(nk)) return;

        world.set(nk, selectedId);
        rebuild();
        save();
        if (navigator.vibrate) { try { navigator.vibrate(6); } catch {} }
      } else {
        if (eraseMode) return;
        const groundHits = raycaster.intersectObject(ground, false);
        if (!groundHits.length) return;
        const p = groundHits[0].point;
        const gx = Math.round(p.x);
        const gz = Math.round(p.z);
        if (gx < 0 || gx >= W || gz < 0 || gz >= D) return;
        const k = key(gx, 1, gz);
        if (world.has(k)) return;
        world.set(k, selectedId);
        rebuild();
        save();
        if (navigator.vibrate) { try { navigator.vibrate(6); } catch {} }
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    function onWheel(e) {
      e.preventDefault();
      camState.radius *= (1 + e.deltaY * 0.001);
      updateCamera();
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });

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
    let frameCount = 0;
    let fpsAccum = 0;

    function tick(now) {
      if (disposed) return;
      rafId = requestAnimationFrame(tick);

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      frameCount++;
      fpsAccum += dt;
      if (fpsAccum >= 0.5) {
        if (fpsEl) fpsEl.textContent = Math.round(frameCount / fpsAccum) + ' FPS';
        frameCount = 0;
        fpsAccum = 0;
      }

      stars.rotation.y += 0.0008;
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(tick);

    return {
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
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);
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