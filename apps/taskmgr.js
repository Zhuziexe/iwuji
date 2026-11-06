(() => {
  const BUNDLE = 'com.wujios.taskmgr';

  WujiApps.register({
    bundlename: BUNDLE,
    name: '任务管理器',
    icon: './assets/taskmgr.svg',
    initialRoute: 'main',
    version: '1.0.0',
    devices: ['pc'],

    styles: `
      .tm-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        color: #101828;
        font-family: var(--wj-font);
        overflow: hidden;
      }

      /* ---------- 顶部统计 ---------- */
      .tm-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        padding: 16px 16px 12px;
        flex: 0 0 auto;
      }

      .tm-stat {
        padding: 12px 14px;
        border-radius: 10px;
        background: #f2f5fa;
        min-width: 0;
      }

      .tm-stat__label {
        font-size: 12px;
        color: #5b6478;
        margin-bottom: 4px;
        letter-spacing: .2px;
      }

      .tm-stat__value {
        font-size: 20px;
        font-weight: 600;
        color: #101828;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tm-stat__bar {
        height: 4px;
        margin-top: 8px;
        background: rgba(0, 0, 0, .06);
        border-radius: 2px;
        overflow: hidden;
      }

      .tm-stat__bar i {
        display: block;
        height: 100%;
        width: 0;
        background: #3a6ff0;
        border-radius: 2px;
        transition: width .4s ease;
      }

      /* ---------- 工具栏 ---------- */
      .tm-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        border-top: 1px solid #e6e9ef;
        border-bottom: 1px solid #e6e9ef;
        flex: 0 0 auto;
      }

      .tm-toolbar__title {
        font-size: 13px;
        font-weight: 600;
        color: #101828;
        letter-spacing: .2px;
      }

      /* ---------- 列表 ---------- */
      .tm-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: 6px 16px 16px;
      }

      .tm-empty {
        padding: 50px 0;
        text-align: center;
        color: #8a93a4;
        font-size: 13px;
      }

      .tm-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 54px 56px 76px 62px 62px;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
        color: #101828;
        transition: background .12s;
      }
      .tm-row:hover { background: #f2f5fa; }

      .tm-row__name {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .tm-row__icon {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        object-fit: cover;
        flex-shrink: 0;
        background: #f2f5fa;
      }
      .tm-row__name span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      .tm-row__pid,
      .tm-row__cpu,
      .tm-row__mem {
        color: #5b6478;
        font-variant-numeric: tabular-nums;
        font-size: 12px;
      }

      .tm-row__status {
        font-size: 12px;
        color: #5b6478;
        white-space: nowrap;
      }
      .tm-row__status.is-running { color: #22b25b; }
      .tm-row__status.is-paused  { color: #d99d16; }
      .tm-row__status.is-bg      { color: #8a93a4; }

      .tm-row__end {
        height: 26px;
        padding: 0 10px;
        border: 1px solid #e6e9ef;
        border-radius: 6px;
        background: #fff;
        color: #101828;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        transition: background .12s, color .12s, border-color .12s;
        -webkit-tap-highlight-color: transparent;
      }
      .tm-row__end:hover {
        background: #fde8ef;
        color: #e0356b;
        border-color: #f7c1d3;
      }
      .tm-row__end:active { background: #fbd1e0; }

      /* ---------- 窄窗口:隐藏 PID / CPU 列 ---------- */
      @container wj-app (max-width: 520px) {
        .tm-row {
          grid-template-columns: minmax(0, 1fr) 76px 62px 62px;
        }
        .tm-row__pid,
        .tm-row__cpu { display: none; }
      }
    `,

    routes: {
      main: {
        name: 'main',

        render() {
          return `
            <div class="tm-page">
              <div class="tm-stats">
                <div class="tm-stat">
                  <div class="tm-stat__label">CPU</div>
                  <div class="tm-stat__value" id="tmCpu">—</div>
                  <div class="tm-stat__bar"><i id="tmCpuBar"></i></div>
                </div>
                <div class="tm-stat">
                  <div class="tm-stat__label">内存</div>
                  <div class="tm-stat__value" id="tmMem">—</div>
                  <div class="tm-stat__bar"><i id="tmMemBar"></i></div>
                </div>
                <div class="tm-stat">
                  <div class="tm-stat__label">进程</div>
                  <div class="tm-stat__value" id="tmProc">0</div>
                </div>
              </div>

              <div class="tm-toolbar">
                <span class="tm-toolbar__title">进程</span>
              </div>

              <div class="tm-list" id="tmList"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const cpuEl    = root.querySelector('#tmCpu');
          const cpuBarEl = root.querySelector('#tmCpuBar');
          const memEl    = root.querySelector('#tmMem');
          const memBarEl = root.querySelector('#tmMemBar');
          const procEl   = root.querySelector('#tmProc');
          const listEl   = root.querySelector('#tmList');

          let timer = null;
          let disposed = false;

          /* ---------- 数据源:排除自己 ---------- */
          function getWindows() {
            return WujiWindows.list();
          }

          /* ---------- 模拟 CPU ---------- */
          function fakeCpu(win) {
            if (win.minimized) return +(Math.random() * 0.3).toFixed(1);

            const focused = win.el.classList.contains('is-focused');
            const base = focused ? 2.5 : 0.8;
            const wave = Math.sin(Date.now() / 1000 + win.id) * 1.5;
            const noise = Math.random() * 0.6;
            return +Math.max(0.1, base + wave + noise).toFixed(1);
          }

          /* ---------- 模拟内存 ---------- */
          function fakeMem(win) {
            const base = 42 + (win.id % 5) * 9;
            const nodes = win.el.querySelectorAll('*').length;
            return Math.round(base + nodes * 0.05);
          }

          function getStatus(win) {
            if (win.minimized) return { text: '已暂停', cls: 'is-paused' };
            if (win.el.classList.contains('is-focused')) return { text: '运行中', cls: 'is-running' };
            return { text: '后台', cls: 'is-bg' };
          }

          function fmtMem(mb) {
            return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb + ' MB';
          }

          /* ---------- 结束进程 ---------- */
          function killOne(winId) {
            const w = WujiWindows.list().find(x => x.id === winId);
            if (!w) return;

            try {
              WujiWindows.close(w);
            } catch (e) {
              console.warn('[taskmgr] close failed', e);
            }
            render();
          }

          function killAll() {
            for (const w of getWindows()) {
              try { WujiWindows.close(w); } catch { }
            }
            render();
          }

          /* ---------- 渲染 ---------- */
          function render() {
            if (disposed || !root.isConnected) return;

            const wins = getWindows();

            let totalCpu = 0;
            let totalMem = 0;
            for (const w of wins) {
              totalCpu += fakeCpu(w);
              totalMem += fakeMem(w);
            }
            totalCpu = +(totalCpu + 3 + Math.random() * 2).toFixed(1);
            totalMem = totalMem + 380;

            cpuEl.textContent = totalCpu.toFixed(1) + '%';
            cpuBarEl.style.width = Math.min(100, totalCpu) + '%';

            memEl.textContent = fmtMem(totalMem);
            memBarEl.style.width = Math.min(100, (totalMem / 2048) * 100) + '%';

            procEl.textContent = String(wins.length);

            if (!wins.length) {
              listEl.innerHTML = `<div class="tm-empty">没有正在运行的应用</div>`;
              return;
            }

            listEl.innerHTML = wins.map(w => {
              const app = WujiApps.get(w.bundle);
              const name = (app && app.name) || w.title || w.bundle;
              const icon = (app && app.icon) || '';
              const cpu = fakeCpu(w);
              const mem = fakeMem(w);
              const st = getStatus(w);

              return `
                <div class="tm-row" data-win-id="${w.id}">
                  <div class="tm-row__name">
                    <img class="tm-row__icon" src="${escapeHtml(icon)}" alt="">
                    <span>${escapeHtml(name)}</span>
                  </div>
                  <div class="tm-row__pid">${w.id}</div>
                  <div class="tm-row__cpu">${cpu.toFixed(1)}%</div>
                  <div class="tm-row__mem">${fmtMem(mem)}</div>
                  <div class="tm-row__status ${st.cls}">${st.text}</div>
                  <button class="tm-row__end" data-win-id="${w.id}" type="button">结束</button>
                </div>
              `;
            }).join('');

            listEl.querySelectorAll('.tm-row__end').forEach(btn => {
              btn.addEventListener('click', e => {
                e.stopPropagation();
                killOne(Number(btn.dataset.winId));
              });
            });
          }

          render();
          timer = setInterval(render, 1000);

          return () => {
            disposed = true;
            if (timer) { clearInterval(timer); timer = null; }
          };
        },
      },
    },
  });
})();