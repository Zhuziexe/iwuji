WujiApps.register({
  bundlename: 'com.wujios.wujigallery',
  name: '应用市场',
  icon: './assets/wujigallery.svg',
  initialRoute: 'home',
  version: '1.0.3',
  styles: `
    /* ---------------- 列表页 ---------------- */
    .market-page {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      padding: 18px 16px 28px;
      padding-top: calc(18px + var(--statusbar-h));
      background: var(--wj-bg);
    }

    .market-title {
      font-size: var(--wj-fs-lg);
      font-weight: 600;
      color: var(--wj-text);
      margin-bottom: var(--wj-gap);
    }

    .market-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

.market-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--wj-bg-alt);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background .15s, transform .08s;
}
.market-row:active {
  background: #dae2f0;
  transform: scale(.99);
}
    .market-row__icon {
      width: 52px;
      height: 52px;
      flex: 0 0 52px;
      border-radius: 12px;
      overflow: hidden;
      background: var(--wj-bg-alt);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .market-row__icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .market-row__name {
      font-size: var(--wj-fs-md);
      color: var(--wj-text);
      font-weight: 500;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .market-empty,
    .market-end {
      text-align: center;
      font-size: var(--wj-fs-xs);
      color: var(--wj-text-dim);
      padding: 22px 0 4px;
      letter-spacing: .5px;
    }

    .market-detail {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      background: var(--wj-bg);
    }

    .market-detail__scroll {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      padding-top: var(--statusbar-h);
      padding-bottom: 12px;
    }

    .market-detail__header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 18px 10px;
    }

    .market-detail__icon {
      width: 64px;
      height: 64px;
      flex: 0 0 64px;
      border-radius: 14px;
      overflow: hidden;
      background: var(--wj-bg-alt);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .market-detail__icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .market-detail__name {
      font-size: 22px;
      font-weight: 600;
      color: var(--wj-text);
      letter-spacing: .3px;
    }
    .market-detail__meta {
      font-size: var(--wj-fs-xs);
      color: var(--wj-text-dim);
      margin-top: 4px;
    }

    .market-detail__hero {
      margin: 16px 18px 0;
      border-radius: 14px;
      overflow: hidden;
      background: var(--wj-bg-alt);
    }
    .market-detail__hero img {
      width: 100%;
      display: block;
    }

    .market-detail__desc {
      padding: 16px 18px 0;
      font-size: var(--wj-fs-sm);
      color: var(--wj-text-muted);
      line-height: 1.6;
      white-space: pre-line;
    }

    .market-detail__footer {
      flex: 0 0 auto;
      padding: 12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
      border-top: .5px solid var(--wj-border);
      background: var(--wj-bg);
    }

    .market-btn {
      position: relative;
      display: block;
      width: 100%;
      height: 48px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: var(--wj-primary);
      color: #fff;
      font: inherit;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      overflow: hidden;
      transition: transform .1s, background .2s, color .2s;
      -webkit-tap-highlight-color: transparent;
    }
    .market-btn:active:not(:disabled) { transform: scale(.98); }
    .market-btn:disabled {
      background: var(--wj-bg-alt);
      color: var(--wj-text-muted);
      cursor: default;
    }

    .market-btn.is-progress,
    .market-btn.is-progress:disabled {
      background: var(--wj-primary);
      color: #fff;
      cursor: default;
    }

    .market-btn__fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 0%;
      background: rgba(255, 255, 255, .28);
      pointer-events: none;
      transition: width .08s linear;
    }

    .market-btn__label {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      letter-spacing: .3px;
    }
  `,

  routes: {
    home: {
      name: 'home',

      render() {
        return `
          <div class="market-page">
            <h2 class="market-title">应用市场</h2>
            <div id="marketList" class="market-empty">加载中...</div>
          </div>
        `;
      },

      mount(root, ctx) {
        const listEl = root.querySelector('#marketList');

        const renderList = apps => {
          if (!apps || !apps.length) {
            listEl.className = 'market-empty';
            listEl.innerHTML = '没有更多了';
            return;
          }

          listEl.className = '';
          listEl.innerHTML = `
            <div class="market-list">
              ${apps.map(app => `
                <div class="market-row" data-bundle="${escapeHtml(app.bundle)}">
                  <div class="market-row__icon">
                    <img src="${escapeHtml(app.icon || '')}" alt="">
                  </div>
                  <div class="market-row__name">${escapeHtml(app.name || app.bundle)}</div>
                </div>
              `).join('')}
            </div>
            <div class="market-end">没有更多了</div>
          `;

          listEl.querySelectorAll('.market-row').forEach(row => {
            row.addEventListener('click', () => {
              const bundle = row.dataset.bundle;
              const app = apps.find(a => a.bundle === bundle);
              if (!app) return;
              ctx.push('detail', { app });
            });
          });
        };

        const apps = window.WUJI_MARKET_APPS;

        if (Array.isArray(apps)) {
          renderList(apps);
        } else {
          listEl.className = 'market-empty';
          listEl.textContent = '未找到应用目录';
        }
      },
    },

    detail: {
      name: 'detail',

      render(routeCtx) {
        const app = routeCtx.data?.app;
        if (!app) {
          return `<div class="market-page"><div class="market-empty">应用不存在</div></div>`;
        }

        return `
          <div class="market-detail">
            <div class="market-detail__scroll">
              <div class="market-detail__header">
                <div class="market-detail__icon">
                  <img src="${escapeHtml(app.icon || '')}" alt="">
                </div>
                <div style="min-width:0">
                  <div class="market-detail__name">${escapeHtml(app.name || app.bundle)}</div>
                  <div class="market-detail__meta">
                    ${app.description ? escapeHtml(app.description) : ''}
                  </div>
                </div>
              </div>

              ${app.image ? `
                <div class="market-detail__hero">
                  <img src="${escapeHtml(app.image)}" alt="">
                </div>
              ` : ''}

              ${app.longdescription ? `
                <div class="market-detail__desc">${escapeHtml(app.longdescription)}</div>
              ` : ''}
            </div>

            <div class="market-detail__footer">
              <button class="market-btn" id="marketActionBtn" type="button">
                <span class="market-btn__fill" id="marketActionFill"></span>
                <span class="market-btn__label" id="marketActionLabel">安装</span>
              </button>
            </div>
          </div>
        `;
      },

      mount(root, ctx) {
        const app = ctx.data?.app;
        if (!app) return;

        const btn = root.querySelector('#marketActionBtn');
        const fill = root.querySelector('#marketActionFill');
        const label = root.querySelector('#marketActionLabel');
        if (!btn || !fill || !label) return;

        let busy = false;

        const refreshBtn = () => {
          if (busy) return;

          // 两个数据源都查：Store.installedApps 和 WujiApps 内存注册表
          const rec = WujiAppInstaller.get(app.bundle);
          const inRegistry =
            WujiApps.has(app.bundle) && WujiApps.isInstalled(app.bundle);
          const registeredApp = WujiApps.get(app.bundle);

          // 归一化版本号，兼容数字/字符串两种写法
          const normalize = v => String(v == null ? '' : v).trim();

          const currentVersion = normalize(
            (rec && rec.version) ||
            (registeredApp && registeredApp.version) ||
            ''
          );
          const targetVersion = normalize(app.version);

          // ---- 状态 1：完全没装过 ----
          if (!rec && !inRegistry) {
            label.textContent = '安装';
            btn.disabled = false;
            btn.classList.remove('is-progress');
            fill.style.width = '0%';
            return;
          }

          // ---- 状态 2：装了，版本一致 ----
          if (currentVersion && currentVersion === targetVersion) {
            label.textContent = '已安装';
            btn.disabled = true;
            btn.classList.remove('is-progress');
            fill.style.width = '0%';
            return;
          }

          // ---- 状态 3：装了，但版本不同 ----
          label.textContent = '更新';
          btn.disabled = false;
          btn.classList.remove('is-progress');
          fill.style.width = '0%';
        };

        refreshBtn();

        const runDownloadProgress = () => {
          const DURATION = 1500;
          const START = performance.now();

          return new Promise(resolve => {
            const tick = () => {
              const now = performance.now();
              const p = Math.min(1, (now - START) / DURATION);
              fill.style.width = (p * 100).toFixed(1) + '%';
              label.textContent = `下载中...`;

              if (p < 1) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          });
        };

        const sleep = ms => new Promise(r => setTimeout(r, ms));

        btn.addEventListener('click', async () => {
          if (busy || btn.disabled) return;

          busy = true;
          btn.disabled = true;
          btn.classList.add('is-progress');
          fill.style.width = '0%';
          label.textContent = '下载中 0%';

          try {
            await runDownloadProgress();

            fill.style.width = '100%';
            label.textContent = '安装中...';

            await Promise.all([
              WujiAppInstaller.install({
                bundle: app.bundle,
                name: app.name,
                icon: app.icon,
                version: app.version,
                author: app.author,
                description: app.description,
                src: app.src,
              }),
              sleep(1000),
            ]);

            busy = false;
            refreshBtn();
          } catch (err) {
            console.error('[market] 安装失败', err);
            busy = false;
            btn.classList.remove('is-progress');
            label.textContent = '安装失败';
            fill.style.width = '0%';
            setTimeout(() => {
              refreshBtn();
            }, 1200);
          }
        });
      },
    },
  },
});