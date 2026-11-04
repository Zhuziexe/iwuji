(() => {
const BUNDLE = 'com.wujinb.cart';
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
} catch (e) { console.warn('[cart] CDN failed:', url, e); }
}
throw new Error('无法加载 3D 引擎');
})();
}
return threePromise;
}
const LEVELS = [
{
id: 'bamboo', name: '竹林', sub: '浅绿赛道 · 收集竹笋',
emoji: '🎋', cardBg: 'linear-gradient(135deg,#a8e6a1 0%,#4caf50 100%)',
sky: 0xbfe8d0, fog: 0xbfe8d0, fogNear: 150, fogFar: 380,
ground: 0x5a8f4a, hasGround: true,
roadColor: 0x9dd9a3, lineColor: 0xf0fff0,
collectible: 'bamboo', collectName: '竹笋',
decor: 'bamboo', fences: false
},
{
id: 'rainbow', name: '彩虹星球', sub: '空中赛道 · 收集星星',
emoji: '🌈', cardBg: 'linear-gradient(135deg,#ff9a9e 0%,#a18cd1 100%)',
sky: 0x0e0420, fog: 0x0e0420, fogNear: 220, fogFar: 700,
ground: null, hasGround: false,
roadColor: 'rainbow', lineColor: 0xffffff,
collectible: 'star', collectName: '星星',
decor: 'stars', fences: true
},
{
id: 'city', name: '吴际城', sub: '城市马路 · 收集金币',
emoji: '🏙️', cardBg: 'linear-gradient(135deg,#a1c4fd 0%,#5b7fa6 100%)',
sky: 0x9fd3ea, fog: 0x9fd3ea, fogNear: 160, fogFar: 420,
ground: 0x4d7a4f, hasGround: true,
roadColor: 0x5a5f66, lineColor: 0xf2f2f2,
collectible: 'coin', collectName: '金币',
decor: 'city', fences: false
}
];
const AudioEngine = (() => {
let ctx = null;
let master = null;
let volTimer = null;
function readVolume() {
let v = 60;
try {
if (window.HardwareUI?.getVolume) v = HardwareUI.getVolume();
else if (window.WujiControlCenter?.getVolume) v = WujiControlCenter.getVolume();
else if (window.Store?.get) v = Store.get('wujios.volume', 60);
} catch { }
v = Number(v);
if (!isFinite(v)) v = 60;
return Math.max(0, Math.min(100, v));
}
function sync() {
if (!ctx || !master) return;
const vol = readVolume() / 100;
const target = Math.pow(vol, 1.6) * 0.9;
try { master.gain.setTargetAtTime(target, ctx.currentTime, 0.06); } catch { }
}
function ensure() {
if (ctx && ctx.state !== 'closed') return ctx;
if (ctx) {
try { if (ctx.state !== 'closed') ctx.close().catch(() => { }); } catch { }
ctx = null; master = null;
}
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return null;
try { ctx = new AC(); } catch { return null; }
master = ctx.createGain();
master.gain.value = 0.5;
master.connect(ctx.destination);
sync();
if (!volTimer) volTimer = setInterval(sync, 400);
return ctx;
}
function resume() {
ensure();
if (ctx && ctx.state === 'suspended') {
ctx.resume().catch(() => { });
}
}
function playCollect() {
const c = ensure();
if (!c || !master) return;
const t = c.currentTime;
const o = c.createOscillator();
const g = c.createGain();
o.type = 'triangle';
o.frequency.setValueAtTime(880, t);
o.frequency.setValueAtTime(1320, t + 0.06);
g.gain.setValueAtTime(0.12, t);
g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
o.connect(g); g.connect(master);
o.start(t); o.stop(t + 0.16);
}
function playBeep(isGo) {
const c = ensure();
if (!c || !master) return;
const t = c.currentTime;
const o = c.createOscillator();
const g = c.createGain();
o.type = 'sine';
o.frequency.setValueAtTime(isGo ? 880 : 440, t);
o.frequency.exponentialRampToValueAtTime(isGo ? 1320 : 520, t + 0.15);
g.gain.setValueAtTime(0.18, t);
g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
o.connect(g); g.connect(master);
o.start(t); o.stop(t + 0.26);
}
function destroy() {
if (volTimer) { clearInterval(volTimer); volTimer = null; }
if (ctx) {
const old = ctx;
ctx = null; master = null;
try { if (old.state !== 'closed') old.close().catch(() => { }); } catch { }
}
}
return { resume, sync, playCollect, playBeep, destroy };
})();
window.addEventListener('wuji:cc-toggle-change', () => AudioEngine.sync());
function pushRoute(ctx, name, data) {
try {
if (typeof ctx.push === 'function') return ctx.push(name, data);
if (ctx.nav && typeof ctx.nav.push === 'function') return ctx.nav.push(name, data);
} catch (e) { console.warn('[cart] push failed', e); }
}
function popRoute(ctx) {
try {
if (typeof ctx.pop === 'function') return ctx.pop();
if (typeof ctx.back === 'function') return ctx.back();
if (ctx.nav && typeof ctx.nav.pop === 'function') return ctx.nav.pop();
if (ctx.nav && typeof ctx.nav.back === 'function') return ctx.nav.back();
} catch (e) { console.warn('[cart] pop failed', e); }
}
WujiApps.registerInstalled({
bundlename: BUNDLE,
name: '吴际赛车',
icon: './assets/cart.svg',
initialRoute: 'home',
version: '1.0.0',
onBoot() { },
onShutdown() {
AudioEngine.destroy();
},
styles: `
.ct-home {
position: absolute;
inset: 0;
display: flex;
flex-direction: column;
padding: calc(20px + var(--statusbar-h)) 22px
 calc(22px + env(safe-area-inset-bottom, 0px));
background: linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%);
overflow: hidden;
user-select: none;
-webkit-user-select: none;
-webkit-tap-highlight-color: transparent;
}
.ct-home__head {
flex: 0 0 auto;
display: flex;
flex-direction: column;
gap: 4px;
}
.ct-home__title {
font-size: 34px;
font-weight: 900;
color: #fff;
}
.ct-home__sub {
font-size: 22px;
font-weight: 600;
color: rgba(140, 190, 255, .78);
}
.ct-home__hero {
flex: 1 1 auto;
min-height: 0;
display: flex;
align-items: center;
justify-content: center;
}
.ct-hero {
width: 68%;
max-width: 300px;
height: auto;
}
.ct-home__cards {
flex: 0 0 auto;
display: flex;
gap: 10px;
padding-top: 8px;
}
.ct-card {
flex: 1 1 0;
min-width: 0;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
gap: 6px;
padding: 16px 4px 14px;
border: 1px solid rgba(255, 255, 255, .16);
border-radius: 20px;
background: rgba(255, 255, 255, .08);
color: #fff;
font: inherit;
cursor: pointer;
-webkit-tap-highlight-color: transparent;
transition: transform .1s ease, background .15s, box-shadow .15s;
box-shadow: 0 8px 22px rgba(0, 0, 0, .32);
}
.ct-card:active {
transform: scale(.95);
background: rgba(255, 255, 255, .16);
}
.ct-card__emoji {
font-size: 34px;
line-height: 1;
filter: drop-shadow(0 4px 10px rgba(0, 0, 0, .3));
}
.ct-card__name {
font-size: 18px;
font-weight: 700;
letter-spacing: .5px;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
max-width: 100%;
}
.ct-page {
position: absolute;
inset: 0;
background: #0a0a1a;
overflow: hidden;
user-select: none;
-webkit-user-select: none;
-webkit-tap-highlight-color: transparent;
touch-action: none;
}
.ct-canvas {
position: absolute;
inset: 0;
width: 100%;
height: 100%;
display: block;
touch-action: none;
}
.ct-hud {
position: absolute;
inset: 0;
pointer-events: none;
z-index: 10;
color: #fff;
text-shadow: 0 2px 6px rgba(0, 0, 0, .45);
}
.ct-panel {
position: absolute;
top: calc(10px + var(--statusbar-h, 20px));
background: rgba(0, 0, 0, .5);
border: 1px solid rgba(255, 255, 255, .14);
border-radius: 12px;
padding: 8px 12px;
font-size: 20px;
min-width: 156px;
}
.ct-panel--left { left: 12px; }
.ct-panel--right { right: 12px; }
.ct-row {
display: flex;
justify-content: space-between;
align-items: baseline;
gap: 12px;
line-height: 1.6;
}
.ct-row span { opacity: .74; }
.ct-row b {
font-variant-numeric: tabular-nums;
font-weight: 800;
font-size: 23px;
}
#ctSpeed { color: #ffd166; }
#ctCoins { color: #ffcc33; }
.ct-countdown {
position: absolute;
left: 50%;
top: 50%;
transform: translate(-50%, -50%) scale(1);
font-size: 132px;
font-weight: 900;
color: #fff;
z-index: 30;
line-height: 1;
text-align: center;
white-space: nowrap;
display: none;
pointer-events: none;
font-variant-numeric: tabular-nums;
text-shadow: 0 0 50px rgba(255, 209, 102, .85), 0 8px 24px rgba(0, 0, 0, .7);
}
.ct-countdown.is-go {
color: #5aff7a;
text-shadow: 0 0 60px rgba(90, 255, 122, .95), 0 8px 24px rgba(0, 0, 0, .7);
}
.ct-controls {
position: absolute;
left: 0;
right: 0;
bottom: 0;
z-index: 20;
padding: 14px 18px calc(20px + env(safe-area-inset-bottom, 0px));
display: flex;
justify-content: space-between;
align-items: flex-end;
pointer-events: none;
}
.ct-ctrl-group {
display: flex;
gap: 12px;
align-items: flex-end;
pointer-events: auto;
}
.ct-ctrl {
width: 74px;
height: 74px;
border-radius: 50%;
background: rgba(255, 255, 255, .16);
border: 2px solid rgba(255, 255, 255, .38);
color: #fff;
font: inherit;
font-size: 23px;
font-weight: 700;
display: flex;
align-items: center;
justify-content: center;
touch-action: none;
cursor: pointer;
-webkit-tap-highlight-color: transparent;
transition: transform .08s ease, background .08s;
}
.ct-ctrl.is-pressed {
background: rgba(255, 255, 255, .4);
transform: scale(.93);
}
.ct-ctrl--throttle {
width: 96px;
height: 96px;
font-size: 20px;
background: rgba(80, 200, 100, .32);
border-color: rgba(120, 255, 140, .6);
}
.ct-ctrl--throttle.is-pressed { background: rgba(80, 200, 100, .58); }
.ct-ctrl--brake {
font-size: 20px;
background: rgba(200, 80, 80, .3);
border-color: rgba(255, 120, 120, .55);
}
.ct-ctrl--brake.is-pressed { background: rgba(200, 80, 80, .55); }
.ct-result {
position: absolute;
inset: 0;
z-index: 40;
display: flex;
align-items: center;
justify-content: center;
padding: 24px;
background: rgba(10, 16, 32, .62);
opacity: 0;
visibility: hidden;
transition: opacity .28s ease, visibility .28s ease;
}
.ct-result.is-show {
opacity: 1;
visibility: visible;
}
.ct-result__card {
width: 100%;
max-width: 340px;
display: flex;
flex-direction: column;
align-items: center;
gap: 10px;
padding: 32px 24px 28px;
border-radius: 24px;
background: rgba(255, 255, 255, .1);
border: 1px solid rgba(255, 255, 255, .18);
box-shadow: 0 20px 60px rgba(0, 0, 0, .45);
text-align: center;
transform: translateY(12px) scale(.97);
transition: transform .3s cubic-bezier(.2, .9, .3, 1.2);
}
.ct-result.is-show .ct-result__card {
transform: translateY(0) scale(1);
}
.ct-result__title {
font-size: 30px;
font-weight: 900;
color: #fff;
letter-spacing: 2px;
margin-bottom: 6px;
}
.ct-result__row {
font-size: 20px;
color: rgba(255, 255, 255, .78);
}
.ct-result__row b {
font-size: 24px;
color: #ffd166;
font-variant-numeric: tabular-nums;
}
.ct-result__btn {
margin-top: 18px;
padding: 18px 54px;
border: 0;
border-radius: 1399px;
background: linear-gradient(180deg, #5b8bff, #3a6ff0);
color: #fff;
font: inherit;
font-size: 22px;
font-weight: 700;
letter-spacing: 1px;
cursor: pointer;
-webkit-tap-highlight-color: transparent;
box-shadow: 0 12px 30px rgba(58, 111, 240, .5);
transition: transform .08s, filter .15s;
}
.ct-result__btn:active {
transform: scale(.96);
filter: brightness(.92);
}
.ct-loading {
position: absolute;
inset: 0;
z-index: 50;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
gap: 14px;
background: #0a0a1a;
color: #8ad4ff;
font-size: 18px;
}
.ct-loading[hidden] { display: none !important; }
.ct-spin {
width: 34px;
height: 34px;
border-radius: 50%;
border: 3px solid rgba(138, 212, 255, .2);
border-top-color: #8ad4ff;
box-sizing: border-box;
animation: ctSpin .8s linear infinite;
}
@keyframes ctSpin { to { transform: rotate(360deg); } }
`,
routes: {
home: {
name: 'home',
render() {
return `
<div class="ct-home">
<div class="ct-home__head">
<div class="ct-home__title">吴际赛车</div>
<div class="ct-home__sub">WujiCart</div>
</div>
<div class="ct-home__hero">
<svg class="ct-hero" viewBox="0 0 260 150" fill="none" aria-hidden="true">
<ellipse cx="130" cy="134" rx="92" ry="9" fill="rgba(120,180,255,.14)"/>
<rect x="34" y="78" width="192" height="40" rx="18" fill="#3a6ff0"/>
<rect x="34" y="78" width="192" height="17" rx="8.5" fill="#5b8bff"/>
<path d="M84 78 L102 42 Q106 34 116 34 H158 Q168 34 172 42 L190 78 Z" fill="#5b8bff"/>
<path d="M94 74 L108 46 Q110 42 116 42 H140 V74 Z" fill="#cfe4ff"/>
<path d="M148 42 H158 Q164 42 166 46 L178 74 H148 Z" fill="#cfe4ff"/>
<rect x="26" y="66" width="20" height="8" rx="4" fill="#9aa0a6"/>
<circle cx="82" cy="118" r="22" fill="#22232a"/>
<circle cx="82" cy="118" r="9" fill="#9aa0a6"/>
<circle cx="182" cy="118" r="22" fill="#22232a"/>
<circle cx="182" cy="118" r="9" fill="#9aa0a6"/>
<circle cx="216" cy="92" r="7" fill="#ffe08a"/>
<circle cx="44" cy="92" r="6" fill="#ff7a7a"/>
</svg>
</div>
<div class="ct-home__cards">
${LEVELS.map((lv, i) => `
<button class="ct-card" data-level="${i}" type="button">
<span class="ct-card__emoji">${lv.emoji}</span>
<span class="ct-card__name">${lv.name}</span>
</button>
`).join('')}
</div>
</div>
`;
},
mount(root, ctx) {
const onClick = (e) => {
const btn = e.target && e.target.closest ? e.target.closest('[data-level]') : null;
if (!btn || !root.contains(btn)) return;
const idx = Number(btn.dataset.level);
if (!Number.isFinite(idx)) return;
AudioEngine.resume();
if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
pushRoute(ctx, 'play', { level: idx });
};
root.addEventListener('click', onClick);
return () => {
root.removeEventListener('click', onClick);
};
},
},
play: {
name: 'play',
render(routeCtx) {
const idx = Number(routeCtx?.data?.level);
const lvIdx = Number.isFinite(idx) ? Math.max(0, Math.min(LEVELS.length - 1, idx)) : 0;
const lv = LEVELS[lvIdx];
return `
<div class="ct-page" data-level="${lvIdx}">
<canvas class="ct-canvas" id="ctCanvas"></canvas>
<div class="ct-hud">
<div class="ct-panel ct-panel--left">
<div class="ct-row"><span>速度</span><b id="ctSpeed">0</b></div>
<div class="ct-row"><span>圈数</span><b id="ctLap">1 / 3</b></div>
</div>
<div class="ct-panel ct-panel--right">
<div class="ct-row"><span>${lv.collectName}</span><b id="ctCoins">0</b></div>
<div class="ct-row"><span>时间</span><b id="ctTime">0.00</b></div>
</div>
</div>
<div class="ct-countdown" id="ctCountdown"></div>
<div class="ct-controls" id="ctControls">
<div class="ct-ctrl-group">
<button class="ct-ctrl" data-key="a" type="button" aria-label="左转">◀</button>
<button class="ct-ctrl" data-key="d" type="button" aria-label="右转">▶</button>
</div>
<div class="ct-ctrl-group">
<button class="ct-ctrl ct-ctrl--brake" data-key="s" type="button">刹车</button>
<button class="ct-ctrl ct-ctrl--throttle" data-key="w" type="button">加速</button>
</div>
</div>
<div class="ct-result" id="ctResult">
<div class="ct-result__card">
<div class="ct-result__title">🏁 完成！</div>
<div class="ct-result__row">用时 <b id="ctResultTime">0.00s</b></div>
<div class="ct-result__row">
<span id="ctResultLabel">${lv.collectName}</span>
<b id="ctResultCoins">0</b> 个
</div>
<button class="ct-result__btn" id="ctResultBack" type="button">返回主页</button>
</div>
</div>
<div class="ct-loading" id="ctLoading">
<div class="ct-spin"></div>
<div>加载 3D 引擎…</div>
</div>
</div>
`;
},
mount(root, ctx) {
const pageEl = root.querySelector('.ct-page');
const levelIdx = pageEl ? (Number(pageEl.dataset.level) || 0) : 0;
const dom = {
canvas: root.querySelector('#ctCanvas'),
speedEl: root.querySelector('#ctSpeed'),
lapEl: root.querySelector('#ctLap'),
coinsEl: root.querySelector('#ctCoins'),
timeEl: root.querySelector('#ctTime'),
countdownEl: root.querySelector('#ctCountdown'),
controlsEl: root.querySelector('#ctControls'),
resultEl: root.querySelector('#ctResult'),
resultTimeEl: root.querySelector('#ctResultTime'),
resultCoinsEl: root.querySelector('#ctResultCoins'),
resultLabelEl: root.querySelector('#ctResultLabel'),
resultBackEl: root.querySelector('#ctResultBack'),
loadingEl: root.querySelector('#ctLoading'),
};
let api = null;
let disposed = false;
const goHome = () => {
if (disposed) return;
if (navigator.vibrate) { try { navigator.vibrate(6); } catch { } }
popRoute(ctx);
};
if (dom.resultBackEl) {
dom.resultBackEl.addEventListener('click', goHome);
}
(async () => {
try {
const THREE = await ensureThree();
if (disposed) return;
api = createGame(THREE, dom, levelIdx, goHome);
if (dom.loadingEl) dom.loadingEl.hidden = true;
} catch (e) {
console.error('[cart]', e);
if (dom.loadingEl) {
dom.loadingEl.innerHTML = `<div>⚠️ ${e && e.message ? e.message : '加载失败'}</div>`;
}
}
})();
return () => {
disposed = true;
if (dom.resultBackEl) dom.resultBackEl.removeEventListener('click', goHome);
if (api) { try { api.destroy(); } catch (e) { console.warn('[cart] destroy', e); } api = null; }
AudioEngine.destroy();
};
},
},
},
});
function createGame(THREE, dom, levelIdx, onExit) {
const {
canvas, speedEl, lapEl, coinsEl, timeEl,
countdownEl, controlsEl, resultEl,
resultTimeEl, resultCoinsEl, resultLabelEl,
} = dom;
const lv = LEVELS[levelIdx] || LEVELS[0];
const L = 85;
const R = 14;
const HS = L - R;
const SL = 2 * HS;
const CL = Math.PI * R / 2;
const HALF_W = 9;
const TOTAL_LAPS = 3;
const TOTAL_LEN = 4 * SL + 4 * CL;
function getPointAt(s) {
s = ((s % TOTAL_LEN) + TOTAL_LEN) % TOTAL_LEN;
if (s < SL) return { x: -HS + s, z: -L, tx: 1, tz: 0, isCurve: false };
s -= SL;
if (s < CL) {
const th = -Math.PI / 2 + s / R;
return {
x: HS + R * Math.cos(th), z: -HS + R * Math.sin(th),
tx: -Math.sin(th), tz: Math.cos(th), isCurve: true
};
}
s -= CL;
if (s < SL) return { x: L, z: -HS + s, tx: 0, tz: 1, isCurve: false };
s -= SL;
if (s < CL) {
const th = s / R;
return {
x: HS + R * Math.cos(th), z: HS + R * Math.sin(th),
tx: -Math.sin(th), tz: Math.cos(th), isCurve: true
};
}
s -= CL;
if (s < SL) return { x: HS - s, z: L, tx: -1, tz: 0, isCurve: false };
s -= SL;
if (s < CL) {
const th = Math.PI / 2 + s / R;
return {
x: -HS + R * Math.cos(th), z: HS + R * Math.sin(th),
tx: -Math.sin(th), tz: Math.cos(th), isCurve: true
};
}
s -= CL;
if (s < SL) return { x: -L, z: HS - s, tx: 0, tz: -1, isCurve: false };
s -= SL;
const th = Math.PI + s / R;
return {
x: -HS + R * Math.cos(th), z: -HS + R * Math.sin(th),
tx: -Math.sin(th), tz: Math.cos(th), isCurve: true
};
}
function isInCurve(dist) {
const s = ((dist % TOTAL_LEN) + TOTAL_LEN) % TOTAL_LEN;
let seg = s;
if (seg < SL) return false; seg -= SL;
if (seg < CL) return true;seg -= CL;
if (seg < SL) return false; seg -= SL;
if (seg < CL) return true;seg -= CL;
if (seg < SL) return false; seg -= SL;
if (seg < CL) return true;seg -= CL;
if (seg < SL) return false;
return true;
}
const SEG = 900;
const D_PER_SEG = TOTAL_LEN / SEG;
const samples = [];
const tangents = [];
for (let i = 0; i < SEG; i++) {
const p = getPointAt(i * D_PER_SEG);
samples.push(new THREE.Vector3(p.x, 0, p.z));
tangents.push(new THREE.Vector3(p.tx, 0, p.tz).normalize());
}
function sampleAt(dist, outP, outT) {
const d = ((dist % TOTAL_LEN) + TOTAL_LEN) % TOTAL_LEN;
const f = d / D_PER_SEG;
const i0 = Math.floor(f) % SEG;
const i1 = (i0 + 1) % SEG;
const frac = f - Math.floor(f);
outP.copy(samples[i0]).lerp(samples[i1], frac);
outT.copy(tangents[i0]).lerp(tangents[i1], frac).normalize();
}
function distToTrack(x, z) {
let best = Infinity;
for (let i = 0; i < SEG; i += 8) {
const s = samples[i];
const dx = x - s.x, dz = z - s.z;
const d = dx * dx + dz * dz;
if (d < best) best = d;
}
return Math.sqrt(best);
}
function offsetAt(dist, lateralOff) {
const p = getPointAt(dist);
const lx = p.tz, lz = -p.tx;
return { x: p.x + lx * lateralOff, z: p.z + lz * lateralOff, p };
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(lv.sky);
scene.fog = new THREE.Fog(lv.fog, lv.fogNear, lv.fogFar);
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 900);
const renderer = new THREE.WebGLRenderer({
canvas,
antialias: false,
powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0a0a1a, 1);
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x35502f, 1.1));
const sun = new THREE.DirectionalLight(0xfff3d6, 2.0);
sun.position.set(90, 130, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
const shadowCam = sun.shadow.camera;
shadowCam.left = -200; shadowCam.right = 200;
shadowCam.top = 200; shadowCam.bottom = -200;
shadowCam.near = 1;shadowCam.far = 480;
sun.shadow.bias = -0.0006;
scene.add(sun);
const worldGroup = new THREE.Group();
scene.add(worldGroup);
function disposeGroup(g) {
g.traverse(o => {
if (o.geometry) o.geometry.dispose();
if (o.material) {
if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
else o.material.dispose();
}
});
}
function buildRibbon(leftOff, rightOff, y) {
const P = [], Nn = [], I = [];
for (let i = 0; i < SEG; i++) {
const p = samples[i], t = tangents[i];
const lx = t.z, lz = -t.x;
P.push(p.x + lx * leftOff, y, p.z + lz * leftOff);
P.push(p.x + lx * rightOff, y, p.z + lz * rightOff);
Nn.push(0, 1, 0, 0, 1, 0);
}
for (let i = 0; i < SEG; i++) {
const a = i * 2, b = i * 2 + 1;
const c = ((i + 1) % SEG) * 2, d = ((i + 1) % SEG) * 2 + 1;
I.push(a, c, b, b, c, d);
}
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
g.setIndex(I);
return g;
}
function buildRainbowRibbon(leftOff, rightOff, y) {
const P = [], C = [], Nn = [], I = [];
for (let i = 0; i < SEG; i++) {
const p = samples[i], t = tangents[i];
const lx = t.z, lz = -t.x;
const hue = (Math.floor(i / 20) * 0.137) % 1;
const col = new THREE.Color().setHSL(hue, 0.92, 0.7);
P.push(p.x + lx * leftOff, y, p.z + lz * leftOff);
P.push(p.x + lx * rightOff, y, p.z + lz * rightOff);
C.push(col.r, col.g, col.b, col.r, col.g, col.b);
Nn.push(0, 1, 0, 0, 1, 0);
}
for (let i = 0; i < SEG; i++) {
const a = i * 2, b = i * 2 + 1;
const c = ((i + 1) % SEG) * 2, d = ((i + 1) % SEG) * 2 + 1;
I.push(a, c, b, b, c, d);
}
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
g.setIndex(I);
return g;
}
function makeStarGeo() {
const shape = new THREE.Shape();
const outer = 1.1, inner = 0.5;
for (let i = 0; i < 10; i++) {
const r = i % 2 === 0 ? outer : inner;
const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
const x = Math.cos(a) * r, y = Math.sin(a) * r;
if (i === 0) shape.moveTo(x, y);
else shape.lineTo(x, y);
}
shape.closePath();
return new THREE.ExtrudeGeometry(shape, {
depth: 0.3, bevelEnabled: true,
bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1, steps: 1,
});
}
function makeKart() {
const g = new THREE.Group();
const blue = new THREE.MeshStandardMaterial({ color: 0x2d7dff, roughness: 0.42, metalness: 0.2 });
const dark = new THREE.MeshStandardMaterial({ color: 0x22232a, roughness: 0.85 });
const grey = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.55, metalness: 0.45 });
const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.36, 2.05), blue);
body.position.y = 0.46; body.castShadow = true; g.add(body);
const nose = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 0.75), blue);
nose.position.set(0, 0.4, 1.3); nose.castShadow = true; g.add(nose);
const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.68), dark);
seat.position.set(0, 0.8, -0.1); seat.castShadow = true; g.add(seat);
const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 0.32), grey);
spoiler.position.set(0, 0.95, -1.0); spoiler.castShadow = true; g.add(spoiler);
const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.32, 12);
wg.rotateZ(Math.PI / 2);
for (const [x, z] of [[-0.76, 0.76], [0.76, 0.76], [-0.76, -0.76], [0.76, -0.76]]) {
const w = new THREE.Mesh(wg, dark);
w.position.set(x, 0.34, z);
w.castShadow = true;
g.add(w);
}
return g;
}
const KART_SCALE = 2.2;
const kart = makeKart();
kart.scale.setScalar(KART_SCALE);
scene.add(kart);
const MAX_SPEED = 32;
const ACCEL = 24;
const BRAKE = 50;
const DRAG = 0.55;
const LAT_SPEED = 10;
const CURVE_MIN = MAX_SPEED * 0.30;
const CURVE_MAX = MAX_SPEED * 0.55;
const COIN_GAP = 12;
let progress = 0, lateral = 0, speed = 0;
let lap = 0, coinCount = 0, totalTime = 0;
let finished = false, finishedShown = false;
let countdownTime = 0;
let countdownNum = -1;
let countdownActive = false;
const carPos = new THREE.Vector3();
const carTan = new THREE.Vector3();
let carHeading = 0;
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let coins = [];
const keys = {};
function buildGround() {
const g = new THREE.Mesh(
new THREE.PlaneGeometry(1000, 1000),
new THREE.MeshStandardMaterial({ color: lv.ground, roughness: 1 })
);
g.rotation.x = -Math.PI / 2;
g.receiveShadow = true;
worldGroup.add(g);
}
function buildRoad() {
let roadMesh;
if (lv.roadColor === 'rainbow') {
roadMesh = new THREE.Mesh(
buildRainbowRibbon(HALF_W, -HALF_W, 0.02),
new THREE.MeshBasicMaterial({
vertexColors: true,
side: THREE.DoubleSide,
})
);
} else {
roadMesh = new THREE.Mesh(
buildRibbon(HALF_W, -HALF_W, 0.02),
new THREE.MeshStandardMaterial({
color: lv.roadColor, roughness: 0.92, side: THREE.DoubleSide,
})
);
}
roadMesh.receiveShadow = true;
worldGroup.add(roadMesh);
const lineMat = new THREE.MeshStandardMaterial({
color: lv.lineColor,
roughness: 0.7,
side: THREE.DoubleSide,
emissive: lv.roadColor === 'rainbow' ? 0xffffff : 0x000000,
emissiveIntensity: lv.roadColor === 'rainbow' ? 0.4 : 0,
});
worldGroup.add(new THREE.Mesh(buildRibbon(HALF_W - 0.6, HALF_W, 0.04), lineMat));
worldGroup.add(new THREE.Mesh(buildRibbon(-HALF_W, -HALF_W + 0.6, 0.04), lineMat));
}
function buildStartLine() {
const c = document.createElement('canvas');
c.width = 256; c.height = 64;
const ctx2d = c.getContext('2d');
const cols = 16, rows = 4;
const cw = c.width / cols, ch = c.height / rows;
for (let y = 0; y < rows; y++) {
for (let x = 0; x < cols; x++) {
ctx2d.fillStyle = ((x + y) % 2 === 0) ? '#ffffff' : '#141414';
ctx2d.fillRect(x * cw, y * ch, cw, ch);
}
}
const tex = new THREE.CanvasTexture(c);
tex.magFilter = THREE.NearestFilter;
const group = new THREE.Group();
group.position.copy(samples[0]);
group.rotation.y = Math.atan2(tangents[0].x, tangents[0].z);
const checker = new THREE.Mesh(
new THREE.PlaneGeometry(HALF_W * 2, 2.6),
new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
);
checker.rotation.x = -Math.PI / 2;
checker.position.y = 0.05;
group.add(checker);
worldGroup.add(group);
}
function makeBambooTexture() {
const c = document.createElement('canvas');
c.width = 32; c.height = 512;
const ctx2d = c.getContext('2d');
const grad = ctx2d.createLinearGradient(0, 0, 32, 0);
grad.addColorStop(0.0, '#4a7a1a');
grad.addColorStop(0.28, '#8ac050');
grad.addColorStop(0.55, '#9ad060');
grad.addColorStop(0.8, '#6aa030');
grad.addColorStop(1.0, '#3a6a10');
ctx2d.fillStyle = grad;
ctx2d.fillRect(0, 0, 32, 512);
for (let y = 34; y < 512; y += 56) {
ctx2d.fillStyle = 'rgba(30,50,10,0.65)';
ctx2d.fillRect(0, y, 32, 4);
ctx2d.fillStyle = 'rgba(210,245,160,0.55)';
ctx2d.fillRect(0, y + 4, 32, 1.5);
ctx2d.fillStyle = 'rgba(150,200,90,0.35)';
ctx2d.fillRect(0, y - 2, 32, 2);
}
ctx2d.fillStyle = 'rgba(255,255,255,0.10)';
for (let x = 4; x < 32; x += 7) ctx2d.fillRect(x, 0, 1, 512);
const tex = new THREE.CanvasTexture(c);
tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
tex.magFilter = THREE.LinearFilter;
return tex;
}
function makeLeafTexture() {
const c = document.createElement('canvas');
c.width = 64; c.height = 128;
const ctx2d = c.getContext('2d');
ctx2d.clearRect(0, 0, 64, 128);
const grad = ctx2d.createLinearGradient(0, 128, 0, 0);
grad.addColorStop(0, '#4a7a20');
grad.addColorStop(0.45, '#6fae35');
grad.addColorStop(1, '#a8d860');
ctx2d.fillStyle = grad;
ctx2d.beginPath();
ctx2d.moveTo(32, 126);
ctx2d.quadraticCurveTo(52, 74, 33, 4);
ctx2d.quadraticCurveTo(12, 74, 32, 126);
ctx2d.fill();
ctx2d.strokeStyle = 'rgba(40,70,15,0.55)';
ctx2d.lineWidth = 1.6;
ctx2d.beginPath();
ctx2d.moveTo(32, 124);
ctx2d.quadraticCurveTo(33, 66, 33, 8);
ctx2d.stroke();
ctx2d.strokeStyle = 'rgba(40,70,15,0.25)';
ctx2d.lineWidth = 1;
for (let i = 1; i <= 4; i++) {
const y = 20 + i * 22;
ctx2d.beginPath();
ctx2d.moveTo(33, y);
ctx2d.quadraticCurveTo(42, y + 8, 44, y + 18);
ctx2d.stroke();
ctx2d.beginPath();
ctx2d.moveTo(32, y);
ctx2d.quadraticCurveTo(22, y + 8, 20, y + 18);
ctx2d.stroke();
}
const tex = new THREE.CanvasTexture(c);
tex.magFilter = THREE.LinearFilter;
return tex;
}
function makeCrossPlaneGeo(w, h, planes) {
const positions = [], normals = [], uvs = [], indices = [];
let offset = 0;
const hw = w / 2;
const hy = h / 2;
for (let i = 0; i < planes; i++) {
const angle = (i / planes) * Math.PI;
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);
positions.push(
-hw * cosA, -hy, -hw * sinA,
 hw * cosA, -hy,hw * sinA,
 hw * cosA,hy,hw * sinA,
-hw * cosA,hy, -hw * sinA
);
const nx = -sinA, nz = cosA;
normals.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
offset += 4;
}
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
g.setIndex(indices);
return g;
}
function buildBamboo() {
const TRUNK_H = 18;
const TRUNK_COUNT = 500;
const LEAVES_PER = 10;
const LEAF_COUNT = TRUNK_COUNT * LEAVES_PER;
const trunkGeo = makeCrossPlaneGeo(0.55, TRUNK_H, 3);
const trunkMat = new THREE.MeshStandardMaterial({
map: makeBambooTexture(),
roughness: 0.72,
side: THREE.DoubleSide,
});
const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, TRUNK_COUNT);
trunkMesh.castShadow = true;
trunkMesh.receiveShadow = true;
const leafGeo = new THREE.PlaneGeometry(1.0, 3.8);
leafGeo.translate(0, 1.9, 0);
const leafMat = new THREE.MeshStandardMaterial({
map: makeLeafTexture(),
alphaTest: 0.45,
side: THREE.DoubleSide,
roughness: 0.85,
emissive: 0x0a1a00,
emissiveIntensity: 0.15,
});
const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, LEAF_COUNT);
leafMesh.castShadow = false;
const dummy = new THREE.Object3D();
const col = new THREE.Color();
const upVec = new THREE.Vector3(0, 1, 0);
const dirVec = new THREE.Vector3();
const quat = new THREE.Quaternion();
const zAxis = new THREE.Vector3(0, 0, 1);
let trunkIdx = 0, leafIdx = 0;
let d = Math.random() * 3;
let guard = 0;
while (trunkIdx < TRUNK_COUNT && guard < 40000) {
guard++;
d += 3.5 + Math.random() * 3;
if (d > TOTAL_LEN) d -= TOTAL_LEN;
const side = Math.random() < 0.5 ? -1 : 1;
const off = side * (HALF_W + 3 + Math.random() * 7);
const base = offsetAt(d, off);
const clusterN = 3 + Math.floor(Math.random() * 3);
for (let k = 0; k < clusterN && trunkIdx < TRUNK_COUNT; k++) {
const cx = base.x + (Math.random() - 0.5) * 4;
const cz = base.z + (Math.random() - 0.5) * 4;
if (distToTrack(cx, cz) < HALF_W + 2.5) continue;
const h = TRUNK_H * (0.85 + Math.random() * 0.5);
const scaleY = h / TRUNK_H;
const scaleW = 0.85 + Math.random() * 0.4;
dummy.rotation.order = 'YXZ';
dummy.rotation.set(
(Math.random() - 0.5) * 0.12,
Math.random() * Math.PI * 2,
(Math.random() - 0.5) * 0.12
);
dummy.position.set(cx, h / 2, cz);
dummy.scale.set(scaleW, scaleY, scaleW);
dummy.updateMatrix();
trunkMesh.setMatrixAt(trunkIdx, dummy.matrix);
const shade = 0.92 + Math.random() * 0.18;
col.setRGB(shade, shade, shade * 0.96);
trunkMesh.setColorAt(trunkIdx, col);
trunkIdx++;
for (let j = 0; j < LEAVES_PER && leafIdx < LEAF_COUNT; j++) {
const frac = 0.4 + Math.random() * 0.6;
const y = h * frac;
const angle = Math.random() * Math.PI * 2;
const tilt = 0.45 + Math.random() * 0.85;
const leafScale = 0.85 + Math.random() * 0.65;
const radiusOut = 0.15 + Math.random() * 0.55;
dirVec.set(
Math.cos(angle) * Math.sin(tilt),
Math.cos(tilt),
Math.sin(angle) * Math.sin(tilt)
).normalize();
quat.setFromUnitVectors(upVec, dirVec);
dummy.quaternion.copy(quat);
dummy.rotateOnAxis(zAxis, Math.random() * Math.PI * 2);
dummy.position.set(
cx + Math.cos(angle) * radiusOut,
y,
cz + Math.sin(angle) * radiusOut
);
dummy.scale.setScalar(leafScale);
dummy.updateMatrix();
leafMesh.setMatrixAt(leafIdx, dummy.matrix);
const hue = 0.21 + Math.random() * 0.07;
const light = 0.30 + Math.random() * 0.22;
col.setHSL(hue, 0.58 + Math.random() * 0.15, light);
leafMesh.setColorAt(leafIdx, col);
leafIdx++;
}
}
}
trunkMesh.count = trunkIdx;
leafMesh.count = leafIdx;
if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true;
if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
worldGroup.add(trunkMesh);
worldGroup.add(leafMesh);
}
function buildCity() {
const COUNT = 100;
const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.1 });
const roofGeo = new THREE.ConeGeometry(0.75, 1, 4);
const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, COUNT);
const roofMesh = new THREE.InstancedMesh(roofGeo, roofMat, COUNT);
bodyMesh.castShadow = true; roofMesh.castShadow = true;
bodyMesh.receiveShadow = true;
const dummy = new THREE.Object3D();
const col = new THREE.Color();
const bodyColors = [0xb8b8b8, 0xc8b89a, 0xa0a8b8, 0xd0c8b8, 0x9098a8];
const roofColors = [0x8a3a3a, 0x5a5a5a, 0x3a5a8a, 0x6a4a3a];
let placed = 0;
function addBuilding(x, z, w, h, d) {
if (placed >= COUNT) return;
dummy.position.set(x, h / 2, z);
dummy.rotation.set(0, 0, 0);
dummy.scale.set(w, h, d);
dummy.updateMatrix();
bodyMesh.setMatrixAt(placed, dummy.matrix);
col.setHex(bodyColors[placed % bodyColors.length]);
bodyMesh.setColorAt(placed, col);
const rh = 2 + Math.random() * 3;
dummy.position.set(x, h + rh / 2, z);
dummy.rotation.set(0, Math.PI / 4, 0);
dummy.scale.set(w * 0.7, rh, d * 0.7);
dummy.updateMatrix();
roofMesh.setMatrixAt(placed, dummy.matrix);
col.setHex(roofColors[placed % roofColors.length]);
roofMesh.setColorAt(placed, col);
placed++;
}
let d = 6;
const sideCount = Math.floor(COUNT * 0.6);
let guard = 0;
while (placed < sideCount && guard < 2000) {
guard++;
d += 8 + Math.random() * 6;
if (d > TOTAL_LEN) d -= TOTAL_LEN;
const side = Math.random() < 0.5 ? -1 : 1;
const off = side * (HALF_W + 5 + Math.random() * 14);
const pos = offsetAt(d, off);
const x = pos.x + (Math.random() - 0.5) * 3;
const z = pos.z + (Math.random() - 0.5) * 3;
if (distToTrack(x, z) < HALF_W + 4.5) continue;
const w = 5 + Math.random() * 7;
const h = 7 + Math.random() * 26;
const dd = 5 + Math.random() * 7;
addBuilding(x, z, w, h, dd);
}
const centerLimit = L - 28;
guard = 0;
while (placed < COUNT && guard < 3000) {
guard++;
const x = (Math.random() - 0.5) * 2 * centerLimit;
const z = (Math.random() - 0.5) * 2 * centerLimit;
if (distToTrack(x, z) < HALF_W + 10) continue;
const w = 5 + Math.random() * 7;
const h = 6 + Math.random() * 24;
const dd = 5 + Math.random() * 7;
addBuilding(x, z, w, h, dd);
}
bodyMesh.count = placed;
roofMesh.count = placed;
worldGroup.add(bodyMesh);
worldGroup.add(roofMesh);
}
function buildStarField() {
const N = 800;
const positions = new Float32Array(N * 3);
const colors = new Float32Array(N * 3);
const col = new THREE.Color();
for (let i = 0; i < N; i++) {
const theta = Math.random() * Math.PI * 2;
const phi = Math.acos(2 * Math.random() - 1);
const r = 280 + Math.random() * 340;
positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
positions[i * 3 + 1] = Math.abs(Math.cos(phi)) * r * 0.55 + 15;
positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
col.setHSL(Math.random(), 0.7, 0.72);
colors[i * 3] = col.r;
colors[i * 3 + 1] = col.g;
colors[i * 3 + 2] = col.b;
}
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const m = new THREE.PointsMaterial({
size: 3.2, vertexColors: true, transparent: true, opacity: 0.9,
depthWrite: false, sizeAttenuation: true,
});
worldGroup.add(new THREE.Points(g, m));
}
function buildFences() {
for (const side of [-1, 1]) {
const P = [], I = [];
for (let i = 0; i < SEG; i++) {
const p = samples[i], t = tangents[i];
const lx = t.z, lz = -t.x;
const off = side * (HALF_W - 0.15);
P.push(p.x + lx * off, 0.05, p.z + lz * off);
P.push(p.x + lx * off, 1.9, p.z + lz * off);
}
for (let i = 0; i < SEG; i++) {
const a = i * 2, b = i * 2 + 1;
const c = ((i + 1) % SEG) * 2, d = ((i + 1) % SEG) * 2 + 1;
I.push(a, c, b, b, c, d);
}
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
g.setIndex(I);
g.computeVertexNormals();
const mat = new THREE.MeshBasicMaterial({
color: 0x66ffff, transparent: true, opacity: 0.55,
side: THREE.DoubleSide, depthWrite: false,
});
worldGroup.add(new THREE.Mesh(g, mat));
}
}
function buildCollectibles() {
let geo, mat, yOff;
if (lv.collectible === 'bamboo') {
geo = new THREE.ConeGeometry(0.65, 1.7, 8);
mat = new THREE.MeshStandardMaterial({
color: 0xc8e06a, emissive: 0x334400,
emissiveIntensity: 0.4, roughness: 0.6,
});
yOff = 1.0;
} else if (lv.collectible === 'star') {
geo = makeStarGeo();
mat = new THREE.MeshStandardMaterial({
color: 0xffd700, emissive: 0x886600,
emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.2,
});
yOff = 1.4;
} else {
geo = new THREE.CylinderGeometry(1.05, 1.05, 0.22, 20);
geo.rotateX(Math.PI / 2);
mat = new THREE.MeshStandardMaterial({
color: 0xffcc33, metalness: 0.85, roughness: 0.22,
emissive: 0x664400, emissiveIntensity: 0.5,
});
yOff = 1.3;
}
let d = 22;
while (d < TOTAL_LEN - 14) {
const p = getPointAt(d);
const lat = p.isCurve ? 0 : Math.sin(d * 0.045) * (HALF_W - 3.5);
const lx = p.tz, lz = -p.tx;
const mesh = new THREE.Mesh(geo, mat);
mesh.position.set(p.x + lx * lat, yOff, p.z + lz * lat);
mesh.castShadow = true;
worldGroup.add(mesh);
coins.push({
dist: d, lateral: lat, mesh, baseY: yOff, taken: false,
phase: Math.random() * 6.28,
});
d += COIN_GAP;
}
}
if (lv.hasGround) buildGround();
buildRoad();
buildStartLine();
if (lv.decor === 'bamboo') buildBamboo();
else if (lv.decor === 'city') buildCity();
else if (lv.decor === 'stars') buildStarField();
if (lv.fences) buildFences();
buildCollectibles();
function startCountdown() {
countdownTime = 3.0;
countdownNum = -1;
countdownActive = true;
if (countdownEl) {
countdownEl.style.display = 'block';
countdownEl.style.opacity = '1';
countdownEl.style.transition = 'none';
countdownEl.style.transform = 'translate(-50%,-50%) scale(1)';
countdownEl.textContent = '';
countdownEl.classList.remove('is-go');
}
}
function popCountdownAnim() {
if (!countdownEl) return;
countdownEl.style.transition = 'none';
countdownEl.style.transform = 'translate(-50%,-50%) scale(1.6)';
countdownEl.style.opacity = '0.3';
void countdownEl.offsetWidth;
countdownEl.style.transition = 'transform .25s ease-out, opacity .25s ease-out';
countdownEl.style.transform = 'translate(-50%,-50%) scale(1)';
countdownEl.style.opacity = '1';
}
function updateCountdown(dt) {
countdownTime -= dt;
if (countdownTime > 0) {
const n = Math.ceil(countdownTime);
if (n !== countdownNum && n > 0) {
countdownNum = n;
if (countdownEl) countdownEl.textContent = String(n);
popCountdownAnim();
AudioEngine.playBeep(false);
}
} else {
if (countdownNum !== 0) {
countdownNum = 0;
if (countdownEl) {
countdownEl.textContent = 'GO!';
countdownEl.classList.add('is-go');
}
popCountdownAnim();
AudioEngine.playBeep(true);
}
if (countdownEl) {
if (countdownTime < -0.3) {
const t = Math.max(0, (countdownTime + 0.7) / 0.4);
countdownEl.style.opacity = t.toFixed(2);
}
if (countdownTime < -0.7) {
countdownActive = false;
countdownEl.style.display = 'none';
}
} else {
if (countdownTime < -0.7) countdownActive = false;
}
}
}
function updateCarTransform() {
sampleAt(progress, carPos, carTan);
const lx = carTan.z, lz = -carTan.x;
kart.position.set(carPos.x + lx * lateral, 0, carPos.z + lz * lateral);
carHeading = Math.atan2(carTan.x, carTan.z);
kart.rotation.y = carHeading;
kart.rotation.z = THREE.MathUtils.clamp(-lateral * 0.02, -0.12, 0.12);
}
const CAM_DIST = 17;
const CAM_HEIGHT = 8.5;
const CAM_LOOK_AHEAD = 7;
function updateCamera(dt, instant) {
const fx = Math.sin(carHeading), fz = Math.cos(carHeading);
camPos.set(
kart.position.x - fx * CAM_DIST,
kart.position.y + CAM_HEIGHT,
kart.position.z - fz * CAM_DIST
);
if (instant) camera.position.copy(camPos);
else camera.position.lerp(camPos, 1 - Math.exp(-7 * dt));
camLook.set(
kart.position.x + fx * CAM_LOOK_AHEAD,
kart.position.y + 2.2,
kart.position.z + fz * CAM_LOOK_AHEAD
);
camera.lookAt(camLook);
const targetFov = 75 + (speed / MAX_SPEED) * 8;
if (Math.abs(camera.fov - targetFov) > 0.05) {
camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-4 * dt));
camera.updateProjectionMatrix();
}
}
function updateHUD() {
if (speedEl) speedEl.textContent = String(Math.round(speed * 3.6));
if (lapEl) lapEl.textContent = `${Math.min(lap + 1, TOTAL_LAPS)} / ${TOTAL_LAPS}`;
if (coinsEl) coinsEl.textContent = String(coinCount);
if (timeEl) timeEl.textContent = totalTime.toFixed(2);
}
function resetCollectibles() {
for (const c of coins) {
c.taken = false;
c.mesh.visible = true;
c.mesh.scale.setScalar(1);
c.mesh.position.y = c.baseY;
}
}
function resetRun() {
progress = 0;
lateral = 0;
speed = 0;
lap = 0;
coinCount = 0;
totalTime = 0;
finished = false;
finishedShown = false;
if (resultEl) resultEl.classList.remove('is-show');
resetCollectibles();
updateCarTransform();
updateCamera(0, true);
updateHUD();
startCountdown();
}
function showResult() {
if (resultTimeEl) resultTimeEl.textContent = totalTime.toFixed(2) + 's';
if (resultCoinsEl) resultCoinsEl.textContent = String(coinCount);
if (resultLabelEl) resultLabelEl.textContent = lv.collectName;
if (resultEl) resultEl.classList.add('is-show');
if (navigator.vibrate) { try { navigator.vibrate([20, 40, 20]); } catch { } }
}
function onKeyDown(e) {
const k = (e.key || '').toLowerCase();
if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
e.preventDefault();
}
keys[k] = true;
AudioEngine.resume();
if (k === 'r') resetRun();
if (k === 'escape') onExit();
}
function onKeyUp(e) {
keys[(e.key || '').toLowerCase()] = false;
}
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
const ctrlCleanups = [];
if (controlsEl) {
controlsEl.querySelectorAll('[data-key]').forEach(btn => {
const key = btn.dataset.key;
const press = (e) => {
e.preventDefault();
try { btn.setPointerCapture?.(e.pointerId); } catch { }
keys[key] = true;
btn.classList.add('is-pressed');
AudioEngine.resume();
};
const release = (e) => {
e.preventDefault();
keys[key] = false;
btn.classList.remove('is-pressed');
};
btn.addEventListener('pointerdown', press);
btn.addEventListener('pointerup', release);
btn.addEventListener('pointercancel', release);
btn.addEventListener('pointerleave', release);
ctrlCleanups.push(() => {
btn.removeEventListener('pointerdown', press);
btn.removeEventListener('pointerup', release);
btn.removeEventListener('pointercancel', release);
btn.removeEventListener('pointerleave', release);
});
});
}
function update(dt, time) {
if (countdownActive) {
updateCountdown(dt);
updateCarTransform();
updateCamera(dt);
updateHUD();
return;
}
const inCurve = !finished && isInCurve(progress);
let throttle = false, brake = false, steer = 0;
if (!inCurve && !finished) {
throttle = !!(keys['w'] || keys['arrowup']);
brake = !!(keys['s'] || keys['arrowdown']);
steer = (keys['a'] || keys['arrowleft'] ? 1 : 0) -
(keys['d'] || keys['arrowright'] ? 1 : 0);
}
if (throttle) speed += ACCEL * dt;
if (brake) speed -= BRAKE * dt;
if (!throttle && !brake) speed -= speed * DRAG * dt;
if (inCurve) {
if (speed > CURVE_MAX) speed -= (speed - CURVE_MAX) * 4 * dt;
else if (speed < CURVE_MIN) speed += (CURVE_MIN - speed) * 2 * dt;
}
speed = Math.max(0, Math.min(speed, MAX_SPEED));
if (!finished) {
const latV = LAT_SPEED * (0.35 + 0.65 * speed / MAX_SPEED);
lateral += steer * latV * dt;
const edgeLimit = HALF_W - 1.0;
if (Math.abs(lateral) > edgeLimit) {
lateral = Math.sign(lateral) * edgeLimit;
speed *= 0.975;
}
} else {
speed -= speed * 2.5 * dt;
if (speed < 0.1) speed = 0;
}
progress += speed * dt;
if (!finished) totalTime += dt;
if (!finished) {
const newLap = Math.floor(progress / TOTAL_LEN);
if (newLap > lap) {
lap = newLap;
if (lap >= TOTAL_LAPS) finished = true;
else resetCollectibles();
}
}
updateCarTransform();
const timeSec = time * 0.001;
for (const c of coins) {
const m = c.mesh;
if (c.taken) {
if (m.visible) {
m.scale.multiplyScalar(1 - Math.min(1, dt * 10));
m.position.y += dt * 4;
if (m.scale.x < 0.05) m.visible = false;
}
continue;
}
m.rotation.y = timeSec * 3 + c.phase;
m.position.y = c.baseY + Math.sin(timeSec * 2 + c.phase) * 0.18;
const dx = kart.position.x - m.position.x;
const dz = kart.position.z - m.position.z;
const pickR = 3.4 * (KART_SCALE / 1.9);
if (dx * dx + dz * dz < pickR * pickR) {
c.taken = true;
coinCount++;
AudioEngine.playCollect();
}
}
if (finished && !finishedShown) {
finishedShown = true;
showResult();
}
updateCamera(dt);
updateHUD();
}
const clock = new THREE.Clock();
let rafId = null;
let disposed = false;
function loop() {
if (disposed) return;
rafId = requestAnimationFrame(loop);
const dt = Math.min(clock.getDelta(), 0.05);
update(dt, performance.now());
renderer.render(scene, camera);
}
function resize() {
const w = canvas.clientWidth || window.innerWidth;
const h = canvas.clientHeight || window.innerHeight;
if (!w || !h) return;
camera.aspect = w / h;
camera.updateProjectionMatrix();
renderer.setSize(w, h, false);
}
let ro = null;
try {
ro = new ResizeObserver(resize);
ro.observe(canvas);
} catch { }
window.addEventListener('resize', resize);
resize();
resetRun();
rafId = requestAnimationFrame(loop);
return {
destroy() {
if (disposed) return;
disposed = true;
if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
window.removeEventListener('keydown', onKeyDown);
window.removeEventListener('keyup', onKeyUp);
window.removeEventListener('resize', resize);
for (const fn of ctrlCleanups) { try { fn(); } catch { } }
ctrlCleanups.length = 0;
if (ro) { try { ro.disconnect(); } catch { } ro = null; }
for (const k in keys) keys[k] = false;
try {
scene.remove(worldGroup);
disposeGroup(worldGroup);
disposeGroup(kart);
} catch { }
try { renderer.dispose(); } catch { }
},
};
}
})();