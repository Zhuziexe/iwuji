(() => {
  const BUNDLE = 'com.wujios.notiftest';

  /* 进度模拟的定时器（模块作用域，unmount 时清掉） */
  let progressTimer = null;

  WujiApps.register({
    bundlename: BUNDLE,
    name: '通知测试',
    icon: './assets/app.svg',
    initialRoute: 'home',

    styles: `
      .nt-page {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: calc(var(--wj-pad) + var(--statusbar-h)) var(--wj-pad) var(--wj-pad);
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .nt-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .nt-label {
        font-size: 12px;
        color: var(--wj-text-muted);
        font-weight: 500;
        letter-spacing: .3px;
      }

      .nt-input {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 12px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 15px;
        -webkit-appearance: none;
        appearance: none;
        transition: border-color .15s ease;
      }
      .nt-input:focus {
        outline: none;
        border-color: #3a6ff0;
      }

      .nt-input--id {
        max-width: 130px;
      }
      .nt-input--id::-webkit-outer-spin-button,
      .nt-input--id::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .nt-input--id {
        -moz-appearance: textfield;
      }

      .nt-checks {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        padding: 4px 2px;
      }

      .nt-check {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--wj-text);
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .nt-check input {
        width: 18px;
        height: 18px;
        accent-color: #3a6ff0;
        cursor: pointer;
      }

      .nt-btn {
        display: block;
        width: 100%;
        padding: 13px 18px;
        border: 0;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: .3px;
        cursor: pointer;
        transition: transform .08s ease, background .15s ease;
        -webkit-tap-highlight-color: transparent;
        text-align: center;
      }
      .nt-btn:active:not(:disabled) {
        transform: scale(.98);
        background: #dae2f0;
      }
      .nt-btn--primary {
        background: #3a6ff0;
        color: #fff;
      }
      .nt-btn--primary:active:not(:disabled) {
        background: #2c5ad0;
      }
      .nt-btn--danger {
        background: #fdecef;
        color: #e0356b;
      }
      .nt-btn--danger:active:not(:disabled) {
        background: #fbd9df;
      }

      .nt-status {
        padding: 12px 14px;
        border-radius: 12px;
        background: var(--wj-bg-alt);
        font-size: 12.5px;
        color: var(--wj-text-muted);
        line-height: 1.6;
        word-break: break-all;
        font-variant-numeric: tabular-nums;
      }
      .nt-status b {
        color: var(--wj-text);
        font-weight: 600;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="nt-page">
              <h2 class="wj-title">通知测试</h2>

              <div class="nt-section">
                <label class="nt-label" for="ntTitle">标题</label>
                <input class="nt-input" id="ntTitle" type="text"
                       value="测试标题" maxlength="40" autocomplete="off">
              </div>

              <div class="nt-section">
                <label class="nt-label" for="ntContent">内容</label>
                <input class="nt-input" id="ntContent" type="text"
                       value="这是一条测试通知" maxlength="80" autocomplete="off">
              </div>

              <div class="nt-section">
                <label class="nt-label" for="ntId">通知 ID（相同 ID 会更新原通知，不会新增）</label>
                <input class="nt-input nt-input--id" id="ntId" type="number"
                       value="1001" min="0" step="1" inputmode="numeric">
              </div>

              <div class="nt-checks">
                <label class="nt-check">
                  <input type="checkbox" id="ntShowtime" checked>
                  <span>显示时间</span>
                </label>
                <label class="nt-check">
                  <input type="checkbox" id="ntNotify">
                  <span>横幅 + 音效</span>
                </label>
              </div>

              <button class="nt-btn nt-btn--primary" id="ntSend" type="button">
                发送通知
              </button>

              <button class="nt-btn" id="ntBanner" type="button">
                发送横幅通知（id=2001，带音效）
              </button>

              <button class="nt-btn" id="ntSilent" type="button">
                发送静默通知（无时间、无横幅）
              </button>

              <button class="nt-btn" id="ntProgress" type="button">
                进度模拟（同一 ID，0% → 100%，约 5 秒）
              </button>

              <button class="nt-btn" id="ntUpdate" type="button">
                用相同 ID 更新一次（内容写当前时间）
              </button>

              <button class="nt-btn" id="ntFive" type="button">
                发送 5 条测试通知
              </button>

              <button class="nt-btn nt-btn--danger" id="ntRemove" type="button">
                删除该 ID 的通知
              </button>

              <button class="nt-btn nt-btn--danger" id="ntClear" type="button">
                清空所有通知
              </button>

              <div class="nt-status" id="ntStatus"></div>
            </div>
          `;
        },

        mount(root) {
          const titleEl    = root.querySelector('#ntTitle');
          const contentEl  = root.querySelector('#ntContent');
          const idEl       = root.querySelector('#ntId');
          const showtimeEl = root.querySelector('#ntShowtime');
          const notifyEl   = root.querySelector('#ntNotify');
          const statusEl   = root.querySelector('#ntStatus');
          const progressBtn = root.querySelector('#ntProgress');

          const PROGRESS_LABEL = '进度模拟（同一 ID，0% → 100%，约 5 秒）';

          function currentId() {
            const v = Number(idEl.value);
            return Number.isFinite(v) && v >= 0 ? v : 1001;
          }

          function refreshStatus() {
            const list = WujiNotification.all();
            if (!list.length) {
              statusEl.innerHTML = '当前通知数：<b>0</b>';
              return;
            }
            const lines = list.map(n =>
              `· [${n.bundlename} #${n.id}] ${n.title}`
            );
            statusEl.innerHTML =
              `当前通知数：<b>${list.length}</b><br>` +
              lines.join('<br>');
          }

          function publish(extra) {
            const base = {
              bundlename:  BUNDLE,
              id:          currentId(),
              title:       titleEl.value.trim()  || '测试标题',
              content:     contentEl.value.trim() || '这是一条测试通知',
              showtime:    showtimeEl.checked,
              notifyuser:  notifyEl.checked,
              clickparams: {},
            };
            WujiNotification.publish(Object.assign(base, extra || {}));
            refreshStatus();
          }

          /* ---------- 发送普通通知 ---------- */
          root.querySelector('#ntSend').addEventListener('click', () => {
            publish();
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
          });

          /* ---------- 横幅通知 ---------- */
          root.querySelector('#ntBanner').addEventListener('click', () => {
            publish({
              id: 2001,
              notifyuser: true,
              showtime: true,
              title:   titleEl.value.trim()   || '横幅通知',
              content: contentEl.value.trim() || '这条会弹横幅并播声音',
            });
            if (navigator.vibrate) {
              try { navigator.vibrate([10, 40, 10]); } catch { }
            }
          });

          /* ---------- 静默通知 ---------- */
          root.querySelector('#ntSilent').addEventListener('click', () => {
            publish({
              id: currentId() + 1,
              notifyuser: false,
              showtime: false,
              title:   titleEl.value.trim()   || '静默通知',
              content: contentEl.value.trim() || '这条没有时间也没有横幅',
            });
          });

          /* ---------- 进度模拟 ---------- */
          progressBtn.addEventListener('click', () => {
            if (progressTimer) {
              clearInterval(progressTimer);
              progressTimer = null;
            }

            const id = currentId();
            const title = titleEl.value.trim() || '进度';
            let pct = 0;

            const tick = () => {
              WujiNotification.publish({
                bundlename:  BUNDLE,
                id,
                title,
                content:     `已完成 ${pct}%`,
                showtime:    false,
                notifyuser:  false,
                clickparams: {},
              });
              refreshStatus();

              if (pct >= 100) {
                clearInterval(progressTimer);
                progressTimer = null;
                progressBtn.textContent = PROGRESS_LABEL;
                return;
              }
              pct += 5;
            };

            progressBtn.textContent = '进度模拟中…';
            tick();
            progressTimer = setInterval(tick, 250);
          });

          /* ---------- 相同 ID 更新一次 ---------- */
          root.querySelector('#ntUpdate').addEventListener('click', () => {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            publish({ content: `更新于 ${hh}:${mm}:${ss}` });
          });

          /* ---------- 发送 5 条 ---------- */
          root.querySelector('#ntFive').addEventListener('click', () => {
            const baseId = currentId() + 100;
            for (let i = 0; i < 5; i++) {
              WujiNotification.publish({
                bundlename:  BUNDLE,
                id:          baseId + i,
                title:       `批量通知 ${i + 1}`,
                content:     `这是第 ${i + 1} 条测试通知`,
                showtime:    true,
                notifyuser:  false,
                clickparams: {},
              });
            }
            refreshStatus();
          });

          /* ---------- 删除该 ID ---------- */
          root.querySelector('#ntRemove').addEventListener('click', () => {
            WujiNotification.unpublish({ bundlename: BUNDLE, id: currentId() });
            refreshStatus();
          });

          /* ---------- 清空所有 ---------- */
          root.querySelector('#ntClear').addEventListener('click', () => {
            WujiNotification.clearAll();
            refreshStatus();
          });

          /* 初始状态 */
          refreshStatus();
        },

        unmount() {
          if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
          }
        },
      },
    },
  });
})();