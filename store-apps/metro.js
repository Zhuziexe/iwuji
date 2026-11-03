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
          } catch (e) { console.warn('[metro] CDN failed:', url, e); }
        }
        throw new Error('无法加载 3D 引擎');
      })();
    }
    return threePromise;
  }

  const BUNDLE = 'com.wujinb.metro';

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '开地铁游戏',
    icon: './assets/metro.png',
    initialRoute: 'main',
    version: '1.1.3',

    styles: `
      .mt-wrap {
        position: absolute; inset: 0;
        background: #05070c;
        overflow: hidden;
        display: flex; align-items: center; justify-content: center;
      }
      .mt-stage {
        position: relative;
        overflow: hidden;
        background: #0a1428;
        box-shadow: 0 0 40px rgba(0, 0, 0, .5);
      }
      .mt-canvas {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        display: block;
        touch-action: none;
      }

      /* ---------- 顶部栏（避让状态栏） ---------- */
      .mt-topbar {
        position: absolute;
        top: calc(10px + var(--statusbar-h, 0px));
        left: 10px; right: 10px;
        display: flex; align-items: stretch; gap: 8px;
        z-index: 6;
        pointer-events: none;
      }

      .mt-station {
        flex: 1;
        padding: 8px 16px;
        border-radius: 12px;
        background: rgba(0, 0, 0, .55);
        border: 1px solid rgba(138, 212, 255, .18);
        text-align: center;
        min-width: 0;
      }
      .mt-station-label {
        font-size: 14px; color: rgba(138, 212, 255, .65);
        letter-spacing: 2px;
      }
      .mt-station-name {
        font-size: 22px; font-weight: 700; color: #e8f7ff;
        margin: 3px 0 6px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .mt-progress {
        height: 4px; border-radius: 2px;
        background: rgba(90, 140, 190, .22);
        overflow: hidden;
      }
      .mt-progress > i {
        display: block; height: 100%; width: 0%;
        border-radius: 2px;
        background: linear-gradient(90deg, #2fb6ff, #7ce8ff);
        transition: width .1s linear;
      }
      .mt-station-dist {
        font-size: 14px; color: rgba(138, 212, 255, .75);
        margin-top: 5px; font-variant-numeric: tabular-nums;
      }

      .mt-speed {
  flex-shrink: 0;
  width: 96px;
  box-sizing: border-box;
  padding: 8px 0;
  border-radius: 12px;
  background: rgba(0, 0, 0, .55);
  border: 1px solid rgba(138, 212, 255, .18);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
      .mt-speed-val {
  font-size: 32px; font-weight: 800; color: #e8f7ff;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  width: 100%;
  text-align: center;
}
      .mt-speed-unit {
        font-size: 14px; color: rgba(138, 212, 255, .6);
        letter-spacing: 1.5px; margin-top: 3px;
      }

      /* ---------- 底部控制 ---------- */
      .mt-controls {
        position: absolute;
        left: 18px; right: 18px;
        bottom: calc(20px + env(safe-area-inset-bottom, 0px));
        display: flex; justify-content: space-between;
        z-index: 5;
        pointer-events: none;
      }
      .mt-ctrl {
        width: 96px; height: 96px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 17px; font-weight: 600; letter-spacing: 3px;
        pointer-events: auto;
        cursor: pointer;
        border: 2px solid;
        -webkit-tap-highlight-color: transparent;
        -webkit-user-select: none; user-select: none;
        touch-action: none;
        transition: transform .08s, box-shadow .12s, background .12s;
      }
      .mt-throttle {
        background: radial-gradient(circle at 36% 30%, rgba(60, 220, 160, .45), rgba(20, 120, 90, .3));
        border-color: rgba(90, 240, 190, .55);
        color: #b6ffe4;
      }
      .mt-brake {
        background: radial-gradient(circle at 36% 30%, rgba(255, 90, 90, .5), rgba(170, 28, 28, .32));
        border-color: rgba(255, 120, 120, .55);
        color: #ffd2d2;
      }
      .mt-ctrl.active { transform: scale(.93); }
      .mt-throttle.active { box-shadow: 0 0 30px rgba(60, 240, 170, .65); }
      .mt-brake.active { box-shadow: 0 0 30px rgba(255, 80, 80, .65); }

      /* ---------- 提示 ---------- */
      .mt-toast {
        position: absolute;
        left: 50%; top: 42%;
        transform: translate(-50%, -50%) scale(.8);
        font-size: 36px; font-weight: 800; letter-spacing: 3px;
        opacity: 0;
        pointer-events: none;
        z-index: 7;
        text-shadow: 0 0 28px currentColor;
        white-space: nowrap;
      }
      .mt-toast.show { animation: mt-pop 1.35s cubic-bezier(.2, .9, .3, 1) forwards; }
      @keyframes mt-pop {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(.55); }
        14% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        30% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        72% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1) translateY(-34px); }
      }

      /* ---------- 加载（覆盖全屏，不受 stage 尺寸影响） ---------- */
      .mt-loading {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 16px;
        background: #05070c;
        color: #8ad4ff; font-size: 16px;
        z-index: 20;
      }
      .mt-loading[hidden] { display: none !important; }
      .mt-spin {
        width: 36px; height: 36px; border-radius: 50%;
        border: 3px solid rgba(138, 212, 255, .2);
        border-top-color: #8ad4ff;
        animation: mt-spin .8s linear infinite;
        box-sizing: border-box;
      }
      @keyframes mt-spin { to { transform: rotate(360deg); } }
    `,

    routes: {
      main: {
        name: 'main',
        render() {
          return `
            <div class="mt-wrap">
              <div class="mt-stage" id="mtStage">
                <canvas class="mt-canvas" id="mtCanvas"></canvas>

                <div class="mt-topbar">
                  <div class="mt-station">
                    <div class="mt-station-label">下一站</div>
                    <div class="mt-station-name" id="mtStName">银信湾</div>
                    <div class="mt-progress"><i id="mtProgress"></i></div>
                    <div class="mt-station-dist"><span id="mtDist">420</span> m</div>
                  </div>

                  <div class="mt-speed">
                    <div class="mt-speed-val" id="mtSpeed">0</div>
                    <div class="mt-speed-unit">km/h</div>
                  </div>
                </div>

                <div class="mt-controls">
                  <button class="mt-ctrl mt-throttle" id="mtThrottle" type="button">牵引</button>
                  <button class="mt-ctrl mt-brake" id="mtBrake" type="button">制动</button>
                </div>

                <div class="mt-toast" id="mtToast"></div>
              </div>

              <div class="mt-loading" id="mtLoading">
                <div class="mt-spin"></div>
                <div>加载 3D 引擎…</div>
              </div>
            </div>
          `;
        },
        mount(root, ctx) {
          const wrap = root.querySelector('.mt-wrap');
          const stage = root.querySelector('#mtStage');
          const canvas = root.querySelector('#mtCanvas');
          const loading = root.querySelector('#mtLoading');

          const refs = {
            stName: root.querySelector('#mtStName'),
            dist: root.querySelector('#mtDist'),
            progress: root.querySelector('#mtProgress'),
            speed: root.querySelector('#mtSpeed'),
            toast: root.querySelector('#mtToast'),
            throttle: root.querySelector('#mtThrottle'),
            brake: root.querySelector('#mtBrake'),
          };

          /* ---- 先让 stage 有 3:4 尺寸，确保加载层可见 ---- */
          function fitStage() {
            const w = wrap.clientWidth, h = wrap.clientHeight;
            if (!w || !h) return;
            const A = 3 / 4;
            let sw, sh;
            if (w / h > A) { sh = h; sw = h * A; }
            else { sw = w; sh = w / A; }
            stage.style.width = sw + 'px';
            stage.style.height = sh + 'px';
          }
          fitStage();
          const stageRO = new ResizeObserver(fitStage);
          stageRO.observe(wrap);

          let disposed = false;
          let api = null;

          (async () => {
            try {
              const THREE = await ensureThree();
              if (disposed) return;
              api = createMetro(THREE, { wrap, stage, canvas, refs });
              loading.hidden = true;
            } catch (e) {
              console.error('[metro]', e);
              loading.innerHTML = `<div>⚠️ ${e.message || '加载失败'}</div>`;
            }
          })();

          return () => {
            disposed = true;
            stageRO.disconnect();
            if (api) { try { api.destroy(); } catch { } }
          };
        },
      },
    },
  });

  // ==========================================================
  // 地铁驾驶实现
  // ==========================================================
  function createMetro(THREE, { stage, canvas, refs }) {
    const {
      WebGLRenderer, Scene, PerspectiveCamera, Color, Group,
      BoxGeometry, PlaneGeometry, MeshBasicMaterial, Mesh,
      CanvasTexture, SRGBColorSpace, Fog, RepeatWrapping,
    } = THREE;

    /* ---------- 渲染器 ---------- */
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x0a1428, 1);
    renderer.outputColorSpace = SRGBColorSpace;

    const scene = new Scene();

    /* ---------- 天空 ---------- */
    function makeSkyTexture() {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 512;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#4FA8E8');
      g.addColorStop(0.40, '#87CEEB');
      g.addColorStop(0.75, '#B8E4FF');
      g.addColorStop(1, '#D8F0FF');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 512);
      const t = new CanvasTexture(c);
      t.colorSpace = SRGBColorSpace;
      return t;
    }
    scene.background = makeSkyTexture();

    scene.fog = new Fog(0x18202c, 30, 160);
    const FOG_TUNNEL = new Color(0x18202c);
    const FOG_CITY = new Color(0xB8D8F0);

    const camera = new PerspectiveCamera(72, 1, 0.1, 1200);
    camera.position.set(0, 1.8, 0);
    camera.lookAt(0, 1.2, -20);

    /* ---------- 尺寸适配（渲染器跟随 stage） ---------- */
    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    /* ---------- 纹理 ---------- */
    function makeCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return [c, c.getContext('2d')];
    }

    function buildTunnelTexture() {
      const [cv, ctx] = makeCanvas(512, 512);
      ctx.fillStyle = '#1a222e';
      ctx.fillRect(0, 0, 512, 512);
      for (let x = 0; x <= 512; x += 64) {
        ctx.fillStyle = 'rgba(140,180,230,0.10)';
        ctx.fillRect(x, 0, 2, 512);
      }
      for (let y = 0; y < 512; y += 32) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(0, y, 512, 1);
      }
      for (const ly of [128, 384]) {
        const glow = ctx.createLinearGradient(0, ly - 44, 0, ly + 44);
        glow.addColorStop(0, 'rgba(70,140,220,0)');
        glow.addColorStop(0.32, 'rgba(150,205,255,0.32)');
        glow.addColorStop(0.5, 'rgba(255,255,255,1)');
        glow.addColorStop(0.68, 'rgba(150,205,255,0.32)');
        glow.addColorStop(1, 'rgba(70,140,220,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, ly - 44, 512, 88);
        ctx.fillStyle = 'rgba(255,255,255,0.98)';
        ctx.fillRect(0, ly - 3, 512, 6);
      }
      const tex = new CanvasTexture(cv);
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.repeat.set(1, 3);
      return tex;
    }

    function buildTrackTexture() {
      const [cv, ctx] = makeCanvas(512, 512);
      const bg = ctx.createLinearGradient(0, 0, 512, 0);
      bg.addColorStop(0, '#2c3442');
      bg.addColorStop(0.5, '#3a4456');
      bg.addColorStop(1, '#2c3442');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 512);
      const step = 512 / 6;
      for (let i = 0; i < 6; i++) {
        const y = i * step + step * 0.25;
        ctx.fillStyle = '#5a4432';
        ctx.fillRect(50, y, 412, 26);
        ctx.fillStyle = 'rgba(255,225,190,0.16)';
        ctx.fillRect(50, y, 412, 3);
      }
      for (const x of [130, 382]) {
        ctx.fillStyle = '#141a24';
        ctx.fillRect(x - 6, 0, 28, 512);
        ctx.fillStyle = '#8a9ab2';
        ctx.fillRect(x, 0, 16, 512);
        ctx.fillStyle = '#e0e8f0';
        ctx.fillRect(x + 5, 0, 5, 512);
      }
      const tex = new CanvasTexture(cv);
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.repeat.set(1, 3);
      return tex;
    }

    function buildGroundTexture() {
      const [cv, ctx] = makeCanvas(256, 256);
      ctx.fillStyle = '#8CC86A';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 32; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 4 + Math.random() * 14;
        ctx.fillStyle = Math.random() < 0.5 ? '#7EB85C' : '#9CD878';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new CanvasTexture(cv);
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.repeat.set(24, 24);
      tex.colorSpace = SRGBColorSpace;
      return tex;
    }

    function makeSignTexture(text) {
      const [cv, ctx] = makeCanvas(512, 128);

      // 白底
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 128);

      // 黑色边框
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 500, 116);

      // 黑字（居中）
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 76px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 66);

      const tex = new CanvasTexture(cv);
      tex.colorSpace = SRGBColorSpace;
      return tex;
    }

    /* ---------- 段配置 ---------- */
    const SEG_LEN = 30.5;
    const SEG_COUNT = 16;
    const SEG_TOTAL = SEG_COUNT * SEG_LEN;
    const SEG_RECYCLE = SEG_LEN / 2 + 1;
    const GROUND_Y = -17.2;

    const tunnelTex = buildTunnelTexture();
    const trackTex = buildTrackTexture();

    /* ---------- 段生成 ---------- */
    const segments = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const zc = -SEG_LEN / 2 - i * SEG_LEN;

      const tGeo = new THREE.CylinderGeometry(6.5, 6.5, SEG_LEN + 0.1, 36, 1, true);
      tGeo.rotateX(Math.PI / 2);
      const tMat = new MeshBasicMaterial({
        map: tunnelTex, side: THREE.BackSide,
        transparent: false, depthWrite: true,
      });
      const tunnel = new Mesh(tGeo, tMat);
      tunnel.position.set(0, 1.4, zc);
      scene.add(tunnel);

      const kGeo = new PlaneGeometry(3.2, SEG_LEN + 0.1);
      kGeo.rotateX(-Math.PI / 2);
      const track = new Mesh(kGeo, new MeshBasicMaterial({ map: trackTex }));
      track.position.set(0, 0.01, zc);
      scene.add(track);

      const sGeo = new BoxGeometry(4.4, 0.4, SEG_LEN + 0.1);
      const slab = new Mesh(sGeo, new MeshBasicMaterial({ color: 0x2c3648 }));
      slab.position.set(0, -0.2, zc);
      scene.add(slab);

      const rGeo = new BoxGeometry(0.12, 1.0, SEG_LEN + 0.1);
      const railL = new Mesh(rGeo, new MeshBasicMaterial({ color: 0xFFD700 }));
      railL.position.set(-2.75, 0.5, zc);
      scene.add(railL);

      const railR = new Mesh(rGeo, new MeshBasicMaterial({ color: 0xFFD700 }));
      railR.position.set(2.75, 0.5, zc);
      scene.add(railR);

      const pillarHeight = -GROUND_Y;
      const pGeo = new BoxGeometry(0.7, pillarHeight, 0.7);
      const pMat = new MeshBasicMaterial({ color: 0xC8D0D8 });

      const pillarL = new Mesh(pGeo, pMat.clone());
      pillarL.position.set(-2.75, GROUND_Y / 2, zc);
      scene.add(pillarL);

      const pillarR = new Mesh(pGeo, pMat.clone());
      pillarR.position.set(2.75, GROUND_Y / 2, zc);
      scene.add(pillarR);

      segments.push({ tunnel, tMat, track, slab, railL, railR, pillarL, pillarR });
    }

    /* ---------- 地面与城市 ---------- */
    const groundTex = buildGroundTexture();
    const groundGeo = new PlaneGeometry(2400, 2400);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new Mesh(groundGeo, new MeshBasicMaterial({ map: groundTex }));
    ground.position.set(0, GROUND_Y, -800);
    scene.add(ground);

    const cityGroup = new Group();
    scene.add(cityGroup);

    const CITY_COLORS = [
      0xE85D5D, 0xF5A623, 0xF8E71C, 0x7ED321,
      0x4A90E2, 0x9013FE, 0xE91E63, 0x00BCD4,
    ];
    const CITY_COUNT = 46;
    const CITY_SPAN = 440;
    const cityItems = [];

    for (let i = 0; i < CITY_COUNT; i++) {
      const w = 4 + Math.random() * 8;
      const h = 10 + Math.random() * 40;
      const d = 4 + Math.random() * 8;
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (18 + Math.random() * 60);
      const z = -20 - Math.random() * CITY_SPAN;
      const color = CITY_COLORS[Math.floor(Math.random() * CITY_COLORS.length)];

      const mesh = new Mesh(
        new BoxGeometry(w, h, d),
        new MeshBasicMaterial({ color })
      );
      mesh.position.set(x, GROUND_Y + h / 2, z);
      cityGroup.add(mesh);
      cityItems.push(mesh);
    }

    /* ---------- 车站 ---------- */
    const PLAT_LEN = 46;
    const station = new Group();
    station.visible = false;
    scene.add(station);

    const wall = new Mesh(
      new BoxGeometry(0.2, 4.4, PLAT_LEN),
      new MeshBasicMaterial({ color: 0x26364a })
    );
    wall.position.set(-5.65, 2.2, 0);
    station.add(wall);

    const platform = new Mesh(
      new BoxGeometry(2.5, 1.1, PLAT_LEN),
      new MeshBasicMaterial({ color: 0x34465e })
    );
    platform.position.set(-4.35, 0.55, 0);
    station.add(platform);

    const safetyLine = new Mesh(
      new BoxGeometry(0.18, 0.03, PLAT_LEN),
      new MeshBasicMaterial({ color: 0xffd23a })
    );
    safetyLine.position.set(-3.18, 1.12, 0);
    station.add(safetyLine);

    const edgeGlow = new Mesh(
      new BoxGeometry(0.07, 0.07, PLAT_LEN),
      new MeshBasicMaterial({ color: 0x7ff0ff })
    );
    edgeGlow.position.set(-3.05, 1.16, 0);
    station.add(edgeGlow);

    const roof = new Mesh(
      new BoxGeometry(3.0, 0.2, PLAT_LEN),
      new MeshBasicMaterial({ color: 0x2c3c52 })
    );
    roof.position.set(-4.3, 3.98, 0);
    station.add(roof);

    const roofGlow = new Mesh(
      new BoxGeometry(2.4, 0.05, PLAT_LEN),
      new MeshBasicMaterial({ color: 0xe4f6ff, transparent: true, opacity: 0.5, depthWrite: false })
    );
    roofGlow.position.set(-4.3, 3.86, 0);
    station.add(roofGlow);

    const pillarMat = new MeshBasicMaterial({ color: 0x40546e });
    for (let z = -19; z <= 19; z += 5.5) {
      const p = new Mesh(new BoxGeometry(0.15, 2.7, 0.15), pillarMat);
      p.position.set(-3.45, 2.45, z);
      station.add(p);
    }

    const lampGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const glowGeo = new THREE.SphereGeometry(0.42, 8, 8);
    const wireGeo = new BoxGeometry(0.02, 0.28, 0.02);
    const lampMat = new MeshBasicMaterial({ color: 0xfff4d0 });
    const glowMat = new MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.25, depthWrite: false });
    const wireMat = new MeshBasicMaterial({ color: 0x5a6e88 });

    for (let z = -20; z <= 20; z += 4.5) {
      const wire = new Mesh(wireGeo, wireMat);
      wire.position.set(-4.4, 3.7, z);
      station.add(wire);

      const lamp = new Mesh(lampGeo, lampMat);
      lamp.position.set(-4.4, 3.52, z);
      station.add(lamp);

      const glow = new Mesh(glowGeo, glowMat);
      glow.position.copy(lamp.position);
      station.add(glow);
    }

    const adColors = [0x3fd0ff, 0xff5fa8, 0xffd24a, 0x6effc0, 0xa06fff];
    for (let i = 0; i < 6; i++) {
      const ad = new Mesh(
        new PlaneGeometry(1.4, 0.9),
        new MeshBasicMaterial({ color: adColors[i % adColors.length], transparent: true, opacity: 0.8 })
      );
      ad.position.set(-5.54, 2.05, -16 + i * 6.4);
      ad.rotation.y = Math.PI / 2;
      station.add(ad);
    }

    let lastSignIndex = -1;
    const signMat = new MeshBasicMaterial({ map: makeSignTexture('银信湾') });
    const sign = new Mesh(new PlaneGeometry(1.6, 0.4), signMat); sign.position.set(-5.54, 3.15, 0);
    sign.rotation.y = Math.PI / 2;
    station.add(sign);

    const platformBase = new Mesh(
      new BoxGeometry(2.8, -GROUND_Y, PLAT_LEN),
      new MeshBasicMaterial({ color: 0xC8D0D8 })
    );
    platformBase.position.set(-4.35, GROUND_Y / 2, 0);
    platformBase.visible = false;
    station.add(platformBase);

    /* ---------- 高架站玻璃罩（仅高架可见） ---------- */
    const glassGroup = new Group();
    glassGroup.visible = false;
    station.add(glassGroup);

    const glassMat = new MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    // 玻璃幕墙边框材质
    const frameMat = new MeshBasicMaterial({ color: 0x9ab4cc });
    const FRAME_T = 0.07;   // 边框粗细

    // 右侧玻璃墙（轨道另一侧）
    const glassWallR = new Mesh(
      new BoxGeometry(0.08, 3.9, PLAT_LEN),
      glassMat
    );
    glassWallR.position.set(2.55, 1.95, 0);
    glassGroup.add(glassWallR);

    // 顶部玻璃
    const glassRoof = new Mesh(
      new BoxGeometry(8.3, 0.08, PLAT_LEN),
      glassMat
    );
    glassRoof.position.set(-1.55, 3.9, 0);
    glassGroup.add(glassRoof);
    /* ---- 右侧玻璃墙：上下横框 ---- */
    const wallTopBar = new Mesh(
      new BoxGeometry(FRAME_T, FRAME_T, PLAT_LEN),
      frameMat
    );
    wallTopBar.position.set(2.55, 3.9, 0);
    glassGroup.add(wallTopBar);

    const wallBottomBar = new Mesh(
      new BoxGeometry(FRAME_T, FRAME_T, PLAT_LEN),
      frameMat
    );
    wallBottomBar.position.set(2.55, 0.0, 0);
    glassGroup.add(wallBottomBar);

    /* ---- 右侧玻璃墙：竖向分隔杆（每约 6 米一根） ---- */
    for (let z = -PLAT_LEN / 2; z <= PLAT_LEN / 2 + 0.01; z += 6.1) {
      const mullion = new Mesh(
        new BoxGeometry(FRAME_T, 3.9, FRAME_T),
        frameMat
      );
      mullion.position.set(2.55, 1.95, z);
      glassGroup.add(mullion);
    }

    /* ---- 顶部玻璃：左右两条长边框 ---- */
    for (const x of [-5.7, 2.55]) {
      const roofEdge = new Mesh(
        new BoxGeometry(FRAME_T, FRAME_T, PLAT_LEN),
        frameMat
      );
      roofEdge.position.set(x, 3.9, 0);
      glassGroup.add(roofEdge);
    }

    /* ---- 顶部玻璃：横向分隔梁（与竖向杆对齐） ---- */
    for (let z = -PLAT_LEN / 2; z <= PLAT_LEN / 2 + 0.01; z += 6.1) {
      const roofBeam = new Mesh(
        new BoxGeometry(8.3, FRAME_T, FRAME_T),
        frameMat
      );
      roofBeam.position.set(-1.55, 3.9, z);
      glassGroup.add(roofBeam);
    }

    // 进站端站名牌（往右上移动，挂在顶棚下方）
    const endSignMat = new MeshBasicMaterial({ map: makeSignTexture('银信湾') });
    const endSign = new Mesh(new PlaneGeometry(2.0, 0.5), endSignMat);
    endSign.position.set(0.6, 3.2, PLAT_LEN / 2 + 0.06);
    glassGroup.add(endSign);

    // 牌子顶部横杆
    const endBar = new Mesh(
      new BoxGeometry(3.0, 0.06, 0.06),
      new MeshBasicMaterial({ color: 0x9ab4cc })
    );
    endBar.position.set(0.6, 3.70, PLAT_LEN / 2 + 0.06);
    glassGroup.add(endBar);

    // 两根吊杆：把横杆挂到顶棚
    const hangerMat = new MeshBasicMaterial({ color: 0x9ab4cc });
    for (const x of [-0.6, 1.8]) {
      const hanger = new Mesh(new BoxGeometry(0.05, 0.20, 0.05), hangerMat);
      hanger.position.set(x, 3.82, PLAT_LEN / 2 + 0.06);
      glassGroup.add(hanger);
    }

    /* ---------- 停车标线 ---------- */
    function groundStrip(z, len, color, opacity) {
      const g = new PlaneGeometry(3.5, len);
      g.rotateX(-Math.PI / 2);
      const m = new Mesh(g, new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      m.position.set(0, 0.025, z);
      return m;
    }
    station.add(groundStrip(0, 3.0, 0x2effc0, 0.36));
    station.add(groundStrip(4.0, 5.0, 0xffd24a, 0.24));
    station.add(groundStrip(-4.0, 5.0, 0xffd24a, 0.24));
    station.add(groundStrip(-10.25, 7.5, 0xff4a4a, 0.30));

    for (const z of [1.5, -1.5, 6.5, -6.5]) {
      const line = new Mesh(
        new PlaneGeometry(3.6, 0.07),
        new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.03, z);
      station.add(line);
    }

    const stopMark = new Mesh(
      new PlaneGeometry(3.6, 0.16),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
    );
    stopMark.rotation.x = -Math.PI / 2;
    stopMark.position.set(0, 0.035, 0);
    station.add(stopMark);

    const stopBar = new Mesh(
      new BoxGeometry(3.4, 0.09, 0.09),
      new MeshBasicMaterial({ color: 0x7ff0ff })
    );
    stopBar.position.set(0, 3.6, 0);
    station.add(stopBar);

    /* ---------- 游戏数据 ---------- */
    const STATIONS = [
      { name: '银信湾', istunnel: false },
      { name: '吴际广场', istunnel: false },
      { name: '别人湾', istunnel: false },
      { name: '樱花林', istunnel: false },
      { name: '村庄', istunnel: false },
      { name: '别别村', istunnel: false },
    ];
    const STATION_GAP = 520;
    const MAX_SPEED = 33.3;
    const ACCEL = 3.5;
    const BRAKE = 6.0;

    let speed = 20;
    let distToNext = 420;
    let stationIndex = 0;
    let state = 'run';
    let stopTimer = 0;
    let earlyCooldown = 0;

    /* ---------- 输入 ---------- */
    const keys = Object.create(null);
    function onKeyDown(e) {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      keys[e.code] = true;
    }
    function onKeyUp(e) { keys[e.code] = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let touchThrottle = false;
    let touchBrake = false;
    function bindHold(el, on, off) {
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (_) { }
        el.classList.add('active');
        on();
      });
      const release = () => {
        el.classList.remove('active');
        off();
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    }
    bindHold(refs.throttle, () => touchThrottle = true, () => touchThrottle = false);
    bindHold(refs.brake, () => touchBrake = true, () => touchBrake = false);

    /* ---------- HUD ---------- */
    function updateHUD() {
      refs.speed.textContent = Math.round(speed * 3.6);
      const d = Math.max(0, distToNext);
      refs.dist.textContent = Math.round(d);
      const progress = Math.max(0, Math.min(1, 1 - distToNext / STATION_GAP));
      refs.progress.style.width = (progress * 100).toFixed(1) + '%';
      refs.stName.textContent = STATIONS[stationIndex].name;
    }

    function toast(text, color) {
      refs.toast.textContent = text;
      refs.toast.style.color = color;
      refs.toast.classList.remove('show');
      void refs.toast.offsetWidth;
      refs.toast.classList.add('show');
    }

    /* ---------- 主循环 ---------- */
    const clock = new THREE.Clock();
    let rafId = null;
    let disposed = false;

    function update(dt) {
      const throttle = !!(keys['KeyW'] || keys['ArrowUp'] || touchThrottle);
      const brake = !!(keys['Space'] || keys['ArrowDown'] || keys['KeyS'] || touchBrake);

      if (state === 'stopped') {
        speed = 0;
      } else {
        if (brake) speed = Math.max(0, speed - BRAKE * dt);
        else if (throttle) speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
      }

      const ds = speed * dt;
      distToNext += -ds;

      const isTunnel = STATIONS[stationIndex].istunnel;

      for (const seg of segments) {
        seg.tunnel.position.z += ds;
        seg.track.position.z += ds;
        seg.slab.position.z += ds;
        seg.railL.position.z += ds;
        seg.railR.position.z += ds;
        seg.pillarL.position.z += ds;
        seg.pillarR.position.z += ds;

        if (seg.tunnel.position.z > SEG_RECYCLE) {
          const wrap = SEG_TOTAL;
          seg.tunnel.position.z -= wrap;
          seg.track.position.z -= wrap;
          seg.slab.position.z -= wrap;
          seg.railL.position.z -= wrap;
          seg.railR.position.z -= wrap;
          seg.pillarL.position.z -= wrap;
          seg.pillarR.position.z -= wrap;
        }

        seg.tunnel.visible = isTunnel;
        seg.railL.visible = !isTunnel;
        seg.railR.visible = !isTunnel;
        seg.pillarL.visible = !isTunnel;
        seg.pillarR.visible = !isTunnel;
      }

      cityGroup.visible = !isTunnel;
      ground.visible = !isTunnel;

      if (!isTunnel) {
        for (const m of cityItems) {
          m.position.z += ds;
          if (m.position.z > 10) m.position.z -= CITY_SPAN;
        }
      }

      if (isTunnel) {
        scene.fog.color.copy(FOG_TUNNEL);
        scene.fog.near = 30;
        scene.fog.far = 160;
      } else {
        scene.fog.color.copy(FOG_CITY);
        scene.fog.near = 140;
        scene.fog.far = 620;
      }

      const showStation = distToNext < 170 && distToNext > -23;
      station.visible = showStation;

      if (showStation) {
        station.position.z = -distToNext;
        platformBase.visible = !isTunnel;
        glassGroup.visible = !isTunnel;

        if (lastSignIndex !== stationIndex) {
          lastSignIndex = stationIndex;
          const name = STATIONS[stationIndex].name;

          signMat.map.dispose();
          signMat.map = makeSignTexture(name);
          signMat.needsUpdate = true;

          endSignMat.map.dispose();
          endSignMat.map = makeSignTexture(name);
          endSignMat.needsUpdate = true;
        }
      }

      earlyCooldown = Math.max(0, earlyCooldown - dt);

      if (state === 'run') {
        if (distToNext < -6.5) {
          state = 'missed';
          stopTimer = 1.5;
          toast(speed > 5 ? '过站了！' : '停过站了', '#ff5b5b');
        } else if (speed < 0.1) {
          if (distToNext >= -6.5 && distToNext <= 6.5) {
            speed = 0;
            state = 'stopped';
            stopTimer = 2.0;
            if (Math.abs(distToNext) <= 1.5) toast('完美停车！', '#7cf0ff');
            else toast('停站合格', '#ffd479');
          } else if (distToNext > 6.5 && earlyCooldown <= 0) {
            toast('未到停车位，请继续行驶', '#9fb8d0');
            earlyCooldown = 2.5;
          }
        }
      } else {
        stopTimer -= dt;
        if (stopTimer <= 0) {
          distToNext += STATION_GAP;
          stationIndex = (stationIndex + 1) % STATIONS.length;
          state = 'run';
          speed = Math.max(speed, 10);
          lastSignIndex = -1;
        }
      }

      updateHUD();
    }

    function loop() {
      if (disposed) return;
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      update(dt);
      renderer.render(scene, camera);
    }
    updateHUD();
    loop();

    /* ---------- 清理 ---------- */
    return {
      destroy() {
        disposed = true;
        if (rafId) cancelAnimationFrame(rafId);
        ro.disconnect();
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
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