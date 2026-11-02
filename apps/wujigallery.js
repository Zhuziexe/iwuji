WujiApps.register({
  bundlename: 'com.wujios.wujigallery',
  name: '应用市场',
  icon: './assets/wujigallery.svg',
  initialRoute: 'home',
  version: '1.0.4',
  styles: `
    /* ---------------- 列表页 ---------------- */
    .market-page {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      padding: 25px 22px 39px;
      padding-top: calc(25px + var(--statusbar-h));
      background: var(--wj-bg);
    }

    .market-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .market-row {
      display: flex;
      align-items: center;
      gap: 17px;
      padding: 10px 12px;
      border-radius: 20px;
      background: var(--wj-bg-alt);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background .15s, transform .08s;
    }
    .market-row:active {
      background: #dae2f0;
      transform: scale(.99);
    }
    .market-row.is-na {
      opacity: .62;
    }

    .market-row__icon {
      width: 73px;
      height: 73px;
      flex: 0 0 73px;
      border-radius: 17px;
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
      flex: 1 1 auto;
      font-size: var(--wj-fs-md);
      color: var(--wj-text);
      font-weight: 500;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .market-row__badge--update {
      flex: 0 0 auto;
      font-size: var(--wj-fs-xs);
      font-weight: 600;
      letter-spacing: .3px;
      padding: 4px 13px;
      border-radius: 1399px;
      background: var(--wj-primary);
      color: #fff;
      white-space: nowrap;
      box-shadow: 0 3px 11px rgba(58, 111, 240, .35);
    }

    .market-row__badge--na {
      flex: 0 0 auto;
      font-size: var(--wj-fs-xs);
      font-weight: 500;
      letter-spacing: .3px;
      padding: 4px 13px;
      border-radius: 1399px;
      background: rgba(0, 0, 0, .06);
      color: var(--wj-text-muted);
      white-space: nowrap;
    }

    .market-empty,
    .market-end {
      text-align: center;
      font-size: var(--wj-fs-xs);
      color: var(--wj-text-dim);
      padding: 31px 0 6px;
      letter-spacing: .5px;
    }

    /* ---------------- 详情页 ---------------- */
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
      padding-bottom: 17px;
    }

    .market-detail__header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 28px 25px 14px;
    }

    .market-detail__icon {
      width: 90px;
      height: 90px;
      flex: 0 0 90px;
      border-radius: 20px;
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
      font-size: var(--wj-fs-3xl);
      font-weight: 600;
      color: var(--wj-text);
      letter-spacing: .3px;
    }
    .market-detail__meta {
      font-size: var(--wj-fs-xs);
      color: var(--wj-text-dim);
      margin-top: 6px;
    }

    .market-detail__hero {
      margin: 22px 25px 0;
      border-radius: 20px;
      overflow: hidden;
      background: var(--wj-bg-alt);
    }
    .market-detail__hero img {
      width: 100%;
      display: block;
    }

    .market-detail__desc {
      padding: 22px 25px 0;
      font-size: var(--wj-fs-sm);
      color: var(--wj-text-muted);
      line-height: 1.6;
      white-space: pre-line;
    }

    .market-detail__footer {
      flex: 0 0 auto;
      padding: 17px 25px calc(17px + env(safe-area-inset-bottom, 0px));
      border-top: .5px solid var(--wj-border);
      background: var(--wj-bg);
    }

    .market-btn {
      position: relative;
      display: block;
      width: 100%;
      height: 67px;
      padding: 0;
      border: 0;
      border-radius: 1399px;
      background: var(--wj-primary);
      color: #fff;
      font: inherit;
      font-size: var(--wj-fs-lg);
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
            <h2 class="wj-title">应用市场</h2>
            <div id="marketList" class="market-empty">加载中...</div>
          </div>
        `;
      },

      mount(root, ctx) {
        const listEl = root.querySelector('#marketList');

        /* ---------- 平台标签 ---------- */
        const platformLabel = list => {
          if (!Array.isArray(list) || !list.length) return '';
          return list
            .map(p => p === 'wujios' ? 'iWuji' : p === 'zhuzios' ? '电脑' : p)
            .join('/');
        };

        /* ---------- 静默回填：把市场里的 platforms 写回已安装记录 ---------- */
        const syncInstalledPlatforms = (marketApps) => {
          const list = Store.get('installedApps', []);
          if (!Array.isArray(list) || !list.length) return 0;

          const byBundle = new Map(marketApps.map(a => [a.bundle, a]));
          let changed = 0;

          for (const rec of list) {
            const m = byBundle.get(rec.bundle);
            if (!m || !Array.isArray(m.platforms) || !m.platforms.length) continue;

            const same = Array.isArray(rec.platforms)
              && rec.platforms.length === m.platforms.length
              && rec.platforms.every((p, i) => p === m.platforms[i]);

            if (!same) {
              rec.platforms = m.platforms.slice();
              changed++;
            }
          }

          if (changed) {
            Store.set('installedApps', list);

            /* 内存注册表同步下线不适用本平台的应用
               （避免刷新前依然可见 / 可尝试打开） */
            for (const rec of list) {
              if (!rec.platforms) continue;
              if (WujiApps.platformAllowed(rec)) continue;
              if (WujiApps.isInstalled(rec.bundle)) {
                try { WujiApps.unregister(rec.bundle); } catch { }
              }
            }
          }
          return changed;
        };

        /* ---------- 判断单个应用状态 ---------- */
        const getAppState = (app) => {
          const platformApplicable = WujiApps.platformAllowed(app);

          const rec = WujiAppInstaller.get(app.bundle);
          /* 记录层平台不适用 → 视为"当前设备不可用"（含旧数据未回填时的二次校验） */
          const recordApplicable = rec
            ? WujiApps.platformAllowed(rec)
            : platformApplicable;

          const inRegistry =
            WujiApps.has(app.bundle) && WujiApps.isInstalled(app.bundle);

          const norm = v => String(v == null ? '' : v).trim();
          const localVersion = norm(
            (rec && rec.version) ||
            (inRegistry && WujiApps.get(app.bundle)?.version) ||
            ''
          );
          const marketVersion = norm(app.version);

          let hasUpdate = false;
          if (rec && localVersion && marketVersion) {
            try {
              hasUpdate = WujiAppInstaller.cmpVer(localVersion, marketVersion) < 0;
            } catch {
              hasUpdate = localVersion !== marketVersion;
            }
          }

          return {
            installed: !!rec || inRegistry,
            hasUpdate,
            localVersion,
            platformApplicable,
            recordApplicable,
          };
        };

        /* ---------- 渲染列表 ---------- */
        const renderList = (apps) => {
          if (!apps || !apps.length) {
            listEl.className = 'market-empty';
            listEl.innerHTML = '没有更多了';
            return;
          }

          const withState = apps.map(app => ({ app, state: getAppState(app) }));

          withState.sort((a, b) => {
            const rank = s => s.hasUpdate ? 0 : 1;
            return rank(a.state) - rank(b.state);
          });

          listEl.className = '';
          listEl.innerHTML = `
            <div class="market-list">
              ${withState.map(({ app, state }) => {
                let badge = '';
                if (!state.platformApplicable) {
                  badge = `<span class="market-row__badge--na">仅${platformLabel(app.platforms)}</span>`;
                } else if (state.hasUpdate) {
                  badge = '<span class="market-row__badge--update">更新</span>';
                }

                return `
                <div class="market-row ${state.platformApplicable ? '' : 'is-na'}"
                     data-bundle="${escapeHtml(app.bundle)}">
                  <div class="market-row__icon">
                    <img src="${escapeHtml(app.icon || '')}" alt="">
                  </div>
                  <div class="market-row__name">${escapeHtml(app.name || app.bundle)}</div>
                  ${badge}
                </div>
              `;
              }).join('')}
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

        /* ---------- 异步加载目录 ---------- */
        let apps = [];
        let disposed = false;

        async function loadApps() {
          listEl.className = 'market-empty';
          listEl.textContent = '加载中...';

          try {
            const res = await fetch(`store/apps.json?t=${Date.now()}`, {
              cache: 'no-store',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = await res.json();
            apps = Array.isArray(raw)
              ? raw
              : (raw && Array.isArray(raw.apps) ? raw.apps : []);
          } catch (e) {
            console.warn('[market] load failed', e);
            apps = [];
          }

          if (disposed || !root.isConnected) return;

          if (!apps.length) {
            listEl.className = 'market-empty';
            listEl.textContent = '未找到应用目录';
            return;
          }

          /* ★ 市场元数据到位 → 先把旧安装记录的 platforms 补齐 */
          const fixed = syncInstalledPlatforms(apps);
          if (fixed) {
            console.log(`[market] 已回填 ${fixed} 条安装记录的 platforms`);
          }

          renderList(apps);
        }

        loadApps();

        /* ---------- 安装 / 卸载后实时刷新 ---------- */
        const off = WujiApps.on(evt => {
          if (evt.type !== 'registered' && evt.type !== 'unregistered') return;
          if (!root.isConnected) {
            off();
            return;
          }
          if (!apps.length) return;
          renderList(apps);
        });

        return () => {
          disposed = true;
          off();
        };
      },
    },

    detail: {
      name: 'detail',

      render(routeCtx) {
        const app = routeCtx.data?.app;
        if (!app) {
          return `<div class="market-page"><div class="market-empty">应用不存在</div></div>`;
        }

        /* ★ 支持设备：platforms 缺失/空 → 全平台 */
        const platformNames = Array.isArray(app.platforms) && app.platforms.length
          ? app.platforms.map(p =>
              p === 'wujios'   ? 'iWuji' :
              p === 'zhuzios'  ? '电脑'  : p
            )
          : ['iWuji', '电脑'];
        const supportText = platformNames.join('，');

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

              <div class="market-detail__desc">支持设备：${escapeHtml(supportText)}</div>
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

        const platformLabel = list => {
          if (!Array.isArray(list) || !list.length) return '';
          return list
            .map(p => p === 'wujios' ? 'iWuji' : p === 'zhuzios' ? '电脑' : p)
            .join('/');
        };

        const refreshBtn = () => {
          if (busy) return;

          /* ---------- 状态 0：平台不适用（最重要） ---------- */
          if (!WujiApps.platformAllowed(app)) {
            label.textContent = `不适用于本设备（仅${platformLabel(app.platforms)}）`;
            btn.disabled = true;
            btn.classList.remove('is-progress');
            fill.style.width = '0%';
            return;
          }

          const rec = WujiAppInstaller.get(app.bundle);
          const inRegistry =
            WujiApps.has(app.bundle) && WujiApps.isInstalled(app.bundle);
          const registeredApp = WujiApps.get(app.bundle);

          const normalize = v => String(v == null ? '' : v).trim();

          const currentVersion = normalize(
            (rec && rec.version) ||
            (registeredApp && registeredApp.version) ||
            ''
          );
          const targetVersion = normalize(app.version);

          if (!rec && !inRegistry) {
            label.textContent = '安装';
            btn.disabled = false;
            btn.classList.remove('is-progress');
            fill.style.width = '0%';
            return;
          }

          /* ---------- 状态 1：记录层平台不适用 ---------- */
          if (rec && !WujiApps.platformAllowed(rec)) {
            label.textContent = `已安装在其它设备（仅${platformLabel(rec.platforms)}）`;
            btn.disabled = true;
            btn.classList.remove('is-progress');
            fill.style.width = '0%';
            return;
          }

          /* ---------- 状态 2：本地最新 ---------- */
          let cmp = 0;
          if (currentVersion && targetVersion) {
            try {
              cmp = WujiAppInstaller.cmpVer(currentVersion, targetVersion);
            } catch {
              cmp = currentVersion === targetVersion ? 0 : -1;
            }
          }

          if (cmp >= 0) {
            label.textContent = '已安装';
            btn.disabled = true;
            btn.classList.remove('is-progress');
            fill.style.width = '0%';
            return;
          }

          /* ---------- 状态 3：可更新 ---------- */
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
          if (!WujiApps.platformAllowed(app)) return;

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
                /* ★ 关键：把市场元数据里的 platforms 传下去 */
                platforms: Array.isArray(app.platforms) && app.platforms.length
                  ? app.platforms.slice()
                  : undefined,
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
            setTimeout(() => { refreshBtn(); }, 1200);
          }
        });
      },
    },
  },
});