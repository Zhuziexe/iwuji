(() => {
  const BUNDLE = 'com.wujinb.benchmark';
  const DB_KEY = 'lastResult';

  const DEVICE = {
    cpu: 'Jiwu 8 牛逼版',
    screen: '420 × 560',
    ram: '4 GB',
    rom: '64 GB',
    os: 'WujiOS 1.0.115',
    kernel: 'OpenWuji 1.0',
  };

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function fmt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function animateNumber(el, from, to, duration = 800) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (t < 1 && el.isConnected) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ==================== CPU 测试（降低计算量） ====================
  async function cpuBenchmark(onProgress) {
    const CHUNKS = 25;
    const ITER = 100000;   // ★ 250000 → 100000
    let total = 0;
    const start = performance.now();

    for (let c = 0; c < CHUNKS; c++) {
      for (let i = 0; i < ITER; i++) {
        const x = (i + c * ITER) * 0.0001;
        total += Math.sin(x) * Math.sqrt(Math.abs(x) + 1);   // ★ 去掉 cos 和 log
      }
      onProgress((c + 1) / CHUNKS);
      await new Promise(r => setTimeout(r, 0));
    }

    const elapsed = performance.now() - start;
    const score = Math.round(120000 * (350 / Math.max(elapsed, 100)));
    return { score, elapsed: Math.round(elapsed), unit: 'ms' };
  }

  // ==================== GPU 测试 ====================
  function gpuBenchmark(canvas, onProgress) {
    return new Promise((resolve) => {
      const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
      if (!gl) { resolve({ score: 0, elapsed: 0, fps: 0 }); return; }

      function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      }

      const vs = compile(gl.VERTEX_SHADER, `
        attribute vec2 p;
        void main() { gl_Position = vec4(p, 0.0, 1.0); }
      `);
      const fs = compile(gl.FRAGMENT_SHADER, `
        precision mediump float;
        uniform float t;
        void main() {
          gl_FragColor = vec4(
            sin(t) * 0.5 + 0.5,
            cos(t * 1.3) * 0.5 + 0.5,
            sin(t * 0.7) * 0.5 + 0.5,
            1.0);
        }
      `);

      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const tLoc = gl.getUniformLocation(prog, 't');
      const TOTAL = 300;
      let frames = 0;
      const start = performance.now();

      function frame() {
        gl.uniform1f(tLoc, frames * 0.04);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        frames++;
        onProgress(frames / TOTAL);
        if (frames >= TOTAL) {
          const elapsed = performance.now() - start;
          const fps = TOTAL / (elapsed / 1000);
          resolve({ score: Math.round(fps * 1200), elapsed: Math.round(elapsed), fps: Math.round(fps) });
          return;
        }
        setTimeout(frame, 0);
      }
      setTimeout(frame, 0);
    });
  }

  // ==================== 内存测试 ====================
  async function memoryBenchmark(onProgress) {
    const SIZE = 3000000;   // ★ 400万 → 300万
    const start = performance.now();

    onProgress(0.2);
    await sleep(20);
    const arr = new Float32Array(SIZE);

    onProgress(0.4);
    for (let i = 0; i < SIZE; i++) arr[i] = i * 0.5;
    await sleep(20);

    onProgress(0.7);
    let sum = 0;
    for (let i = 0; i < SIZE; i++) sum += arr[i];
    await sleep(20);

    onProgress(1);
    const elapsed = performance.now() - start;
    const score = Math.round(100000 * (200 / Math.max(elapsed, 50)));
    return { score, elapsed: Math.round(elapsed), unit: 'ms' };
  }

  // ==================== 应用注册 ====================
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际跑分',
    icon: './assets/benchmark.svg',
    initialRoute: 'main',
    version: '1.1.1',

    styles: `
      .bm-page {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: #0a0c12;
        padding-top: var(--statusbar-h);
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        color: #e9ecf2;
        user-select: none; -webkit-user-select: none;
      }

      /* ============ 首页 ============ */
      .bm-home {
        flex: 0 0 auto;                      /* ★ flex: 1 → 0 0 auto */
        display: flex; flex-direction: column;
        padding: 18px 18px 24px;
        gap: 16px;
        min-height: calc(100% - 0px);        /* ★ 内容少时撑满，让按钮贴底 */
      }

      .bm-header { text-align: center; }
      .bm-title {
        font-size: var(--wj-fs-3xl);
        font-weight: 800;
        letter-spacing: 2px;
        color: #fff;
        text-shadow: 0 0 20px rgba(255,215,0,.3);
        line-height: 1.2;
      }
      .bm-subtitle {
        font-size: var(--wj-fs-sm);
        color: #6b7280;
        letter-spacing: 1px;
        margin-top: 6px;
      }

      .bm-device-card {
        background: linear-gradient(135deg, #141822, #1a1f2e);
        border: 1px solid #2a2f3a;
        border-radius: 18px;
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .bm-device-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: var(--wj-fs-lg);
      }
      .bm-device-label {
        color: #6b7280;
        font-weight: 500;
      }
      .bm-device-value {
        color: #e9ecf2;
        font-weight: 700;
        font-family: ui-monospace, 'SF Mono', monospace;
        letter-spacing: .5px;
      }
      .bm-device-value.is-cpu {
        color: #ffd700;
        font-weight: 800;
        letter-spacing: 1px;
      }

      .bm-start-btn {
        margin-top: auto;
        padding: 22px;
        border: 0;
        border-radius: 1399px;
        background: linear-gradient(180deg, #ffd700, #f5a623);
        color: #0a0c12;
        font: inherit;
        font-size: var(--wj-fs-2xl);
        font-weight: 900;
        letter-spacing: 3px;
        cursor: pointer;
        box-shadow: 0 8px 30px rgba(255,215,0,.35);
        transition: transform .08s, filter .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .bm-start-btn:active { transform: scale(.97); filter: brightness(.92); }

      .bm-last-result {
        text-align: center;
        font-size: var(--wj-fs-md);
        color: #6b7280;
      }
      .bm-last-result strong {
        color: #ffd700;
        font-size: var(--wj-fs-lg);
      }

      /* ============ 跑分中 ============ */
      .bm-running {
        flex: 0 0 auto;                      /* ★ flex: 1 → 0 0 auto */
        display: flex; flex-direction: column;
        padding: 14px 18px 22px;
        gap: 12px;
        min-height: calc(100vh - var(--statusbar-h) - 20px);
      }

      .bm-gpu-canvas {
        flex: 1;
        width: 100%;
        border-radius: 16px;
        background: #000;
        min-height: 120px;
        display: block;
      }

      .bm-test-list {
        flex: 0 0 auto;
        display: flex; flex-direction: column;
        gap: 10px;
        margin-top: 10px;
      }

      .bm-test {
        background: #141822;
        border-radius: 16px;
        padding: 16px 18px;
        border: 1px solid transparent;
        transition: border-color .2s, background .2s;
      }
      .bm-test.is-active { border-color: #ffd700; background: #1a1f2e; }
      .bm-test.is-done { border-color: rgba(52,199,89,.4); }

      .bm-test-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 10px;
      }
      .bm-test-name {
        font-size: var(--wj-fs-lg);
        font-weight: 700;
        color: #e9ecf2;
      }
      .bm-test-score {
        font-size: var(--wj-fs-xl);
        font-weight: 900;
        color: #ffd700;
        font-family: ui-monospace, monospace;
        font-variant-numeric: tabular-nums;
      }
      .bm-test.is-pending .bm-test-score { color: #4b5563; }

      .bm-bar {
        height: 8px;
        background: #2a2f3a;
        border-radius: 4px;
        overflow: hidden;
      }
      .bm-bar-fill {
        height: 100%;
        width: 0;
        background: linear-gradient(90deg, #ffd700, #f5a623);
        border-radius: 4px;
        transition: width .1s linear;
      }
      .bm-test.is-done .bm-bar-fill {
        background: linear-gradient(90deg, #34c759, #22a84a);
      }

      .bm-result {
        flex: 0 0 auto;
        display: flex; flex-direction: column;
        padding: 18px 18px 22px;
        gap: 14px;
      }
      .bm-result::-webkit-scrollbar { display: none; }

      .bm-total-card {
        background: linear-gradient(135deg, #141822, #1e2433);
        border-radius: 22px;
        padding: 26px 20px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .bm-total-card::before {
        content: '';
        position: absolute;
        inset: -50%;
        background: radial-gradient(circle, rgba(255,215,0,.1), transparent 60%);
        pointer-events: none;
      }
      .bm-total-label {
        font-size: var(--wj-fs-2xl); 
        font-weight: 700;
        color: #9ca3af; 
        letter-spacing: 2px;
        margin-bottom: 8px;
        position: relative;
      }
      .bm-total-score {
        font-size: 64px;
        font-weight: 900;
        color: #ffd700;
        font-family: ui-monospace, monospace;
        font-variant-numeric: tabular-nums;
        letter-spacing: 2px;
        text-shadow: 0 0 30px rgba(255,215,0,.5);
        line-height: 1;
        position: relative;
      }
      .bm-total-rank {
        font-size: var(--wj-fs-lg);
        color: #9ca3af;
        margin-top: 14px;
        position: relative;
      }
      .bm-total-rank strong {
        color: #ffd700;
        font-weight: 800;
      }

      .bm-breakdown {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));  /* ★ 关键：允许列收缩 */
  gap: 10px;
}

.bm-breakdown-item {
  min-width: 0;                 /* ★ flex/grid 子项必须，覆盖 min-width:auto */
  background: #141822;
  border-radius: 16px;
  padding: 16px 8px;            /* 左右 10 → 8，多挤点空间 */
  text-align: center;
  border: 1px solid #2a2f3a;
}

.bm-breakdown-score {
  font-size: clamp(14px, 4.4vw, var(--wj-fs-xl, 20px)); /* ★ 420 下约 18.5px */
  font-weight: 900;
  color: #e9ecf2;
  font-family: ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; 
}
      .bm-breakdown-label {
        font-size: var(--wj-fs-sm);
        color: #6b7280;
        margin-bottom: 6px;
      }
      .bm-breakdown-detail {
        font-size: var(--wj-fs-xs);
        color: #4b5563;
        margin-top: 4px;
      }

      .bm-rivals {
        background: #141822;
        border-radius: 18px;
        padding: 16px;
        border: 1px solid #2a2f3a;
      }
      .bm-rivals-title {
        font-size: var(--wj-fs-md);
        color: #6b7280;
        font-weight: 600;
        margin-bottom: 12px;
        letter-spacing: 1px;
      }
      .bm-rival {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        font-size: var(--wj-fs-lg);
      }
      .bm-rival + .bm-rival { border-top: 1px solid #1f242e; }
      .bm-rival.is-self .bm-rival-name {
        color: #ffd700;
        font-weight: 800;
      }
      .bm-rival-name { color: #9ca3af; font-weight: 600; }
      .bm-rival-score {
        font-family: ui-monospace, monospace;
        font-variant-numeric: tabular-nums;
        color: #e9ecf2;
        font-weight: 700;
      }
      .bm-rival.is-self .bm-rival-score { color: #ffd700; }

      .bm-result-actions {
        display: flex;
        gap: 10px;
        margin-top: auto;
        padding-top: 8px;
      }
      .bm-action-btn {
        flex: 1;
        padding: 18px;
        border: 0;
        border-radius: 1399px;
        font: inherit;
        font-size: var(--wj-fs-lg);
        font-weight: 800;
        letter-spacing: 1px;
        cursor: pointer;
        transition: transform .08s, filter .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .bm-action-btn:active { transform: scale(.97); filter: brightness(.92); }
      .bm-action-btn--primary {
        background: linear-gradient(180deg, #ffd700, #f5a623);
        color: #0a0c12;
      }
      .bm-action-btn--secondary {
        background: #1f242e;
        color: #e9ecf2;
      }
    `,

    routes: {
      main: {
        name: 'main',

        render() {
          return `<div class="bm-page" id="bmPage"></div>`;
        },

        mount(root, ctx) {
          const pageEl = root.querySelector('#bmPage');
          let disposed = false;
          let state = 'idle';
          let lastResult = null;

          AppStorage.for(BUNDLE).get(DB_KEY, null).then(r => {
            if (!disposed && r && state === 'idle') {
              lastResult = r;
              renderHome();
            }
          }).catch(() => {});

          function renderHome() {
            pageEl.innerHTML = `
              <div class="bm-home">
                <div class="bm-header">
                  <div class="bm-title">吴际跑分</div>
                  <div class="bm-subtitle">Wuji Benchmark v1.1</div>
                </div>

                <div class="bm-device-card">
                  <div class="bm-device-row">
                    <span class="bm-device-label">处理器</span>
                    <span class="bm-device-value is-cpu">${DEVICE.cpu}</span>
                  </div>
                  <div class="bm-device-row">
                    <span class="bm-device-label">屏幕</span>
                    <span class="bm-device-value">${DEVICE.screen}</span>
                  </div>
                  <div class="bm-device-row">
                    <span class="bm-device-label">运行内存</span>
                    <span class="bm-device-value">${DEVICE.ram}</span>
                  </div>
                  <div class="bm-device-row">
                    <span class="bm-device-label">机身存储</span>
                    <span class="bm-device-value">${DEVICE.rom}</span>
                  </div>
                  <div class="bm-device-row">
                    <span class="bm-device-label">系统</span>
                    <span class="bm-device-value">${DEVICE.os}</span>
                  </div>
                  <div class="bm-device-row">
                    <span class="bm-device-label">内核</span>
                    <span class="bm-device-value">${DEVICE.kernel}</span>
                  </div>
                </div>

                ${lastResult ? `
                  <div class="bm-last-result">
                    上次跑分：<strong>${fmt(lastResult.total)}</strong> 分
                  </div>
                ` : ''}

                <button class="bm-start-btn" id="bmStartBtn" type="button">
                  开始跑分
                </button>
              </div>
            `;

            pageEl.querySelector('#bmStartBtn').addEventListener('click', startBenchmark);
          }

          function renderRunning() {
            pageEl.innerHTML = `
              <div class="bm-running">
                <canvas class="bm-gpu-canvas" id="bmGpuCanvas"></canvas>

                <div class="bm-test-list">
                  <div class="bm-test is-pending" data-test="cpu">
                    <div class="bm-test-head">
                      <span class="bm-test-name">CPU · 浮点运算</span>
                      <span class="bm-test-score" data-score="cpu">—</span>
                    </div>
                    <div class="bm-bar"><div class="bm-bar-fill" data-bar="cpu"></div></div>
                  </div>

                  <div class="bm-test is-pending" data-test="gpu">
                    <div class="bm-test-head">
                      <span class="bm-test-name">GPU · WebGL 渲染</span>
                      <span class="bm-test-score" data-score="gpu">—</span>
                    </div>
                    <div class="bm-bar"><div class="bm-bar-fill" data-bar="gpu"></div></div>
                  </div>

                  <div class="bm-test is-pending" data-test="mem">
                    <div class="bm-test-head">
                      <span class="bm-test-name">内存 · 分配读写</span>
                      <span class="bm-test-score" data-score="mem">—</span>
                    </div>
                    <div class="bm-bar"><div class="bm-bar-fill" data-bar="mem"></div></div>
                  </div>
                </div>
              </div>
            `;

            const canvas = pageEl.querySelector('#bmGpuCanvas');
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
          }

          function setTestActive(name) {
            pageEl.querySelectorAll('.bm-test').forEach(el => {
              el.classList.toggle('is-active', el.dataset.test === name);
              el.classList.remove('is-pending');
            });
          }

          function setTestProgress(name, p) {
            const bar = pageEl.querySelector(`[data-bar="${name}"]`);
            if (bar) bar.style.width = (p * 100) + '%';
          }

          function setTestScore(name, score) {
            const el = pageEl.querySelector(`[data-score="${name}"]`);
            const row = pageEl.querySelector(`[data-test="${name}"]`);
            if (el) el.textContent = fmt(score);
            if (row) { row.classList.remove('is-active'); row.classList.add('is-done'); }
          }

          async function startBenchmark() {
            if (state !== 'idle') return;
            state = 'running';

            if (navigator.vibrate) { try { navigator.vibrate(20); } catch {} }

            renderRunning();
            await sleep(150);

            try {
              setTestActive('cpu');
              const cpu = await cpuBenchmark(p => setTestProgress('cpu', p));
              setTestScore('cpu', cpu.score);
              await sleep(200);

              setTestActive('gpu');
              const canvas = pageEl.querySelector('#bmGpuCanvas');
              const gpu = await gpuBenchmark(canvas, p => setTestProgress('gpu', p));
              setTestScore('gpu', gpu.score);
              await sleep(200);

              setTestActive('mem');
              const mem = await memoryBenchmark(p => setTestProgress('mem', p));
              setTestScore('mem', mem.score);
              await sleep(300);

              const total = cpu.score + gpu.score + mem.score;

              // ★ 友商分数改为 0.6–1.6 倍随机，iWuji 有时第一、有时最后
              const rivals = [
                { name: 'iWuji', score: total, isSelf: true },
                { name: '友商 Pro', score: Math.round(total * (0.5 + Math.random() * 0.7)) },
                { name: '友商 Ultra', score: Math.round(total * (0.5 + Math.random() * 0.7)) },
                { name: '友商 Max', score: Math.round(total * (0.5 + Math.random() * 0.7)) },
              ];
              rivals.sort((a, b) => b.score - a.score);

              const rank = rivals.findIndex(r => r.isSelf) + 1;
              const beatPercent = Math.round((rivals.length - rank) / rivals.length * 100 + 15 + Math.random() * 10);

              const result = {
                total, cpu, gpu, mem, rivals, rank,
                beatPercent: Math.min(99, Math.max(50, beatPercent)),
                at: Date.now(),
              };

              await AppStorage.for(BUNDLE).set(DB_KEY, result).catch(() => {});
              lastResult = result;
              state = 'done';
              renderResult(result);

              if (navigator.vibrate) {
                try { navigator.vibrate([30, 50, 30, 50, 80]); } catch {}
              }
            } catch (e) {
              console.error('[benchmark]', e);
              state = 'idle';
              renderHome();
            }
          }

          function renderResult(result) {
            const rankNames = ['冠军', '亚军', '季军', '殿军'];
            const rivalRows = result.rivals.map((r, i) => `
              <div class="bm-rival ${r.isSelf ? 'is-self' : ''}">
                <span class="bm-rival-name">
                  ${i === 0 ? '🏆 ' : ''}${r.name}
                </span>
                <span class="bm-rival-score">${fmt(r.score)}</span>
              </div>
            `).join('');

            pageEl.innerHTML = `
              <div class="bm-result">
                <div class="bm-total-card">
                  <div class="bm-total-label">总分</div>
                  <div class="bm-total-score" id="bmTotalScore">0</div>
                  <div class="bm-total-rank">
                    排名 <strong>${rankNames[result.rank - 1] || '第 ' + result.rank + ' 名'}</strong>
                    · 超过 <strong>${result.beatPercent}%</strong> 的设备
                  </div>
                </div>

                <div class="bm-breakdown">
                  <div class="bm-breakdown-item">
                    <div class="bm-breakdown-label">CPU</div>
                    <div class="bm-breakdown-score">${fmt(result.cpu.score)}</div>
                    <div class="bm-breakdown-detail">${result.cpu.elapsed}ms</div>
                  </div>
                  <div class="bm-breakdown-item">
                    <div class="bm-breakdown-label">GPU</div>
                    <div class="bm-breakdown-score">${fmt(result.gpu.score)}</div>
                    <div class="bm-breakdown-detail">${result.gpu.fps}fps</div>
                  </div>
                  <div class="bm-breakdown-item">
                    <div class="bm-breakdown-label">内存</div>
                    <div class="bm-breakdown-score">${fmt(result.mem.score)}</div>
                    <div class="bm-breakdown-detail">${result.mem.elapsed}ms</div>
                  </div>
                </div>

                <div class="bm-rivals">
                  <div class="bm-rivals-title">设备排行</div>
                  ${rivalRows}
                </div>

                <div class="bm-result-actions">
                  <button class="bm-action-btn bm-action-btn--secondary" id="bmShareBtn" type="button">分享</button>
                  <button class="bm-action-btn bm-action-btn--primary" id="bmAgainBtn" type="button">再来一次</button>
                </div>
              </div>
            `;

            animateNumber(pageEl.querySelector('#bmTotalScore'), 0, result.total, 1200);

            pageEl.querySelector('#bmAgainBtn').addEventListener('click', () => {
              state = 'idle';
              renderHome();
            });

            pageEl.querySelector('#bmShareBtn').addEventListener('click', () => {
              const text = `我的 iWuji（${DEVICE.cpu}）跑分 ${fmt(result.total)} 分，排名第 ${result.rank}，超过 ${result.beatPercent}% 的设备。`;
              if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                  if (window.WujiToast) WujiToast.show('成绩已复制');
                }).catch(() => {
                  if (window.WujiToast) WujiToast.show('复制失败');
                });
              } else {
                if (window.WujiToast) WujiToast.show(text);
              }
            });
          }

          renderHome();

          return () => { disposed = true; };
        },
      },
    },
  });
})();