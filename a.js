#!/usr/bin/env node
/* scripts/scale-to-420.js
 * 300×400 → 420×560 基准换算
 * 字号：×1.4 后吸附到最近 token（14/16/18/20/22/24/28/32/36）
 * 其他 px：×1.4 后四舍五入取整
 */

const fs = require('fs');
const path = require('path');

const SCALE = 1.4;
const ROOT = path.resolve(__dirname, '.');

const FILES = [
  'styles/os.css',
  'styles/components.css',
  'wujios.html',
  'apps/calculator.js',
  'apps/clock.js',
  'apps/photos.js',
  'apps/settings.js',
  'apps/themes.js',
  'apps/weather.js',
  'apps/phone.js',
  'apps/camera.js',
  'apps/wujigallery.js',
];

const storeAppsDir = path.join(ROOT, 'store-apps');
if (fs.existsSync(storeAppsDir)) {
  fs.readdirSync(storeAppsDir)
    .filter(f => f.endsWith('.js'))
    .forEach(f => FILES.push('store-apps/' + f));
}

/* 字号吸附表（目标 px → token） */
const FS_STOPS = [
  [14, 'var(--wj-fs-2xs)'],
  [16, 'var(--wj-fs-xs)'],
  [18, 'var(--wj-fs-sm)'],
  [20, 'var(--wj-fs-md)'],
  [22, 'var(--wj-fs-lg)'],
  [24, 'var(--wj-fs-xl)'],
  [28, 'var(--wj-fs-2xl)'],
  [32, 'var(--wj-fs-3xl)'],
  [36, 'var(--wj-fs-4xl)'],
];

function snapFontSize(px) {
  if (px <= 1) return null;
  const scaled = px * SCALE;
  if (scaled > 38) return Math.round(scaled) + 'px';   // 超大字号不进 token

  let bestTok = FS_STOPS[0][1];
  let bestStop = FS_STOPS[0][0];
  let bestDist = Math.abs(scaled - bestStop);

  for (let i = 1; i < FS_STOPS.length; i++) {
    const [stop, tok] = FS_STOPS[i];
    const d = Math.abs(scaled - stop);
    if (d < bestDist) {
      bestDist = d; bestStop = stop; bestTok = tok;
    } else if (d === bestDist && stop > bestStop) {
      bestStop = stop; bestTok = tok;   // 平手取大
    }
  }
  return bestTok;
}

function snapPx(px) {
  if (px <= 1) return null;            // 0 / 0.5px / 1px 边框不动
  return Math.round(px * SCALE) + 'px';
}

function shouldSkipLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return true;
  if (t.endsWith('*/')) return true;
  if (/@media/.test(line)) return true;
  return false;
}

/* 检测是否已经跑过一版脚本（防止重复缩放） */
const DIRTY = /\b(11\.2|16\.8|19\.6|22\.4|25\.2|33\.6|37\.8)px\b/;

function processFile(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.log(`[skip]    ${rel}  (not found)`);
    return;
  }

  const src = fs.readFileSync(full, 'utf8');

  if (DIRTY.test(src)) {
    console.warn(`\n[WARN] ${rel} 疑似已经过一版脚本处理（存在 1.4x 脏值）`);
    console.warn(`       建议先 git checkout 恢复原始 300 基准再跑\n`);
    return;
  }

  const lines = src.split('\n');
  const changes = [];

    const out = lines.map((line, idx) => {
    if (shouldSkipLine(line)) return line;

    /* ---- 第一步：font-size 用占位符，不直接输出 px / var ---- */
    const fsSlots = [];
    let tmp = line.replace(
      /font-size\s*:\s*(\d+(?:\.\d+)?)px\b/g,
      (m, numStr) => {
        const v = parseFloat(numStr);
        const r = snapFontSize(v);
        if (r == null) return m;
        const key = `__FSPH${fsSlots.length}__`;
        fsSlots.push({ key, original: numStr + 'px', result: r });
        return `font-size: ${key}`;
      }
    );

    /* ---- 第二步：处理其他所有 px（此时 font-size 已被占位符替代） ---- */
    tmp = tmp.replace(
      /(^|[\s:(,;{])(\d+(?:\.\d+)?)px\b/g,
      (m, before, numStr) => {
        const v = parseFloat(numStr);
        const r = snapPx(v);
        if (r == null) return m;
        if (numStr + 'px' !== r) changes.push(`L${idx + 1} [px]  ${numStr}px → ${r}`);
        return before + r;
      }
    );

    /* ---- 第三步：还原 font-size 占位符 ---- */
    for (const { key, original, result } of fsSlots) {
      tmp = tmp.split(key).join(result);
      if (original !== result) changes.push(`L${idx + 1} [fs]  ${original} → ${result}`);
    }

    return tmp;
  }).join('\n');

  if (out === src) {
    console.log(`[clean]   ${rel}`);
    return;
  }

  fs.writeFileSync(full, out, 'utf8');
  console.log(`\n[write]   ${rel}  (${changes.length} changes)`);
  changes.slice(0, 20).forEach(c => console.log('  ' + c));
  if (changes.length > 20) console.log(`  ... ${changes.length - 20} more`);
}

FILES.forEach(processFile);

console.log('\n================ done ================');
console.log('手动还要改的：');
console.log('  1. index.html  <script> 里 const DESIGN_W = 420, DESIGN_H = 560;');
console.log('  2. studio.html <script> 里 const DESIGN_W = 420, DESIGN_H = 560;');
console.log('  3. studio.html .studio-frame { width: 420px; height: 560px; }  (如果漏改)');
console.log('  4. wujios.html 里 MOVE_CANCEL / EDGE_ZONE 常量（可选，按视觉判断）');
console.log('  5. 超大字（锁屏 96→134、天气 68→95 等）看视觉要不要手调');
console.log('  6. @media 查询里的 px 脚本跳过了，逐个确认');