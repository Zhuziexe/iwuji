(() => {
  const BUNDLE = 'com.wujios.themes';

  const SYSTEM_THEMES = () => Array.isArray(window.SYSTEM_THEMES) ? window.SYSTEM_THEMES : [];
  const STORE_THEMES  = () => Array.isArray(window.STORE_THEMES)  ? window.STORE_THEMES  : [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  async function getDownloaded() {
    try {
      const db = AppStorage.for(BUNDLE);
      const list = await db.get('downloaded_themes', []);
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  async function setDownloaded(list) {
    const db = AppStorage.for(BUNDLE);
    await db.set('downloaded_themes', list);
  }
  async function isDownloaded(id) {
    const list = await getDownloaded();
    return list.some(t => t.id === id);
  }

  WujiApps.register({
    bundlename: BUNDLE,
    name: '主题',
    icon: './assets/themes.svg',
    initialRoute: 'home',
    version: '1.0.0',

    styles: `
      .theme-page {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: calc(var(--wj-pad) + var(--statusbar-h)) 16px 24px;
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .theme-title { font-size: 22px; font-weight: 700; color: var(--wj-text); margin: 2px 0 4px; }

      .theme-section { display: flex; flex-direction: column; gap: 10px; }
      .theme-section__head { display: flex; align-items: center; justify-content: space-between; }
      .theme-section__title { font-size: 17px; font-weight: 600; color: var(--wj-text); }
      .theme-section__more {
        font-size: 13px; color: var(--wj-text-dim); cursor: pointer;
        padding: 4px 8px; border-radius: 8px;
        -webkit-tap-highlight-color: transparent; transition: background .15s;
      }
      .theme-section__more:active { background: rgba(0,0,0,.06); }

      .theme-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .theme-card {
        display: flex; flex-direction: column; gap: 6px;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        transition: transform .1s;
      }
      .theme-card:active { transform: scale(.96); }
      .theme-card__thumb {
        width: 100%; aspect-ratio: 3 / 4; border-radius: 12px; overflow: hidden;
        background: var(--wj-bg-alt); box-shadow: 0 2px 8px rgba(0,0,0,.08);
      }
      .theme-card__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
      .theme-card__name {
        font-size: 12px; color: var(--wj-text); text-align: center;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .theme-end { text-align: center; font-size: 12px; color: var(--wj-text-dim); padding: 6px 0 2px; }

      .theme-mine-entry {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px; border-radius: 14px; background: var(--wj-bg-alt);
        color: var(--wj-text); font-size: 15px; font-weight: 500;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
      }
      .theme-mine-entry:active { transform: scale(.99); }
      .theme-mine-entry__arrow { color: var(--wj-text-dim); font-size: 18px; }

      /* 详情 */
      .theme-detail { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--wj-bg); }
      .theme-detail__scroll {
        flex: 1 1 auto; min-height: 0; overflow-y: auto;
        -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
        padding-top: var(--statusbar-h); padding-bottom: 16px;
      }
      .theme-detail__name {
        font-size: 22px; font-weight: 700; color: var(--wj-text);
        padding: 22px 20px 8px; letter-spacing: .3px;
      }
      .theme-detail__hero {
        margin: 8px 20px 0; border-radius: 16px; overflow: hidden;
        background: var(--wj-bg-alt); box-shadow: 0 4px 20px rgba(0,0,0,.1);
      }
      .theme-detail__hero img { width: 100%; display: block; pointer-events: none; }
      .theme-detail__desc {
        padding: 16px 20px 0; font-size: 14px; line-height: 1.65;
        color: var(--wj-text-muted); white-space: pre-line;
      }
      .theme-detail__footer {
        flex: 0 0 auto; padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
        border-top: .5px solid var(--wj-border); background: var(--wj-bg);
      }
      .theme-btn {
        position: relative; display: block; width: 100%; height: 48px;
        padding: 0; border: 0; border-radius: 999px;
        background: #3a6ff0; color: #fff;
        font: inherit; font-size: 16px; font-weight: 600;
        cursor: pointer; overflow: hidden; -webkit-tap-highlight-color: transparent;
        transition: transform .1s, background .2s;
      }
      .theme-btn:active:not(:disabled) { transform: scale(.98); }
      .theme-btn:disabled { background: var(--wj-bg-alt); color: var(--wj-text-muted); }
      .theme-btn.is-progress, .theme-btn.is-progress:disabled { background: #3a6ff0; color: #fff; }
      .theme-btn__fill {
        position: absolute; left: 0; top: 0; bottom: 0; width: 0%;
        background: rgba(255,255,255,.28); pointer-events: none;
        transition: width .08s linear;
      }
      .theme-btn__label {
        position: relative; z-index: 1; height: 100%;
        display: flex; align-items: center; justify-content: center; letter-spacing: .3px;
      }
    `,

    routes: {
      home: {
        name: 'home',
        render() {
          const top3 = STORE_THEMES().slice(0, 3);
          return `
            <div class="theme-page">
              <div class="theme-title">主题</div>

              <div class="theme-section">
                <div class="theme-section__head">
                  <div class="theme-section__title">推荐</div>
                  <div class="theme-section__more" data-more="1">更多 ›</div>
                </div>
                <div class="theme-grid">
                  ${top3.map(t => `
                    <div class="theme-card" data-id="${esc(t.id)}">
                      <div class="theme-card__thumb">
                        <img src="${esc(t.storeimg || t.static || '')}" alt="">
                      </div>
                      <div class="theme-card__name">${esc(t.name)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="theme-mine-entry" data-mine="1">
                <span>我的主题</span>
                <span class="theme-mine-entry__arrow">›</span>
              </div>
            </div>
          `;
        },
        mount(root, ctx) {
          root.querySelector('[data-more]')?.addEventListener('click', () => ctx.push('more'));
          root.querySelector('[data-mine]')?.addEventListener('click', () => {
            /* 拉起设置 → 主题页面 */
            try {
              window.WujiAppLauncher?.open('com.wujios.settings', { route: 'themes' });
            } catch (e) { console.error(e); }
          });
          root.querySelectorAll('.theme-card').forEach(el => {
            el.addEventListener('click', () => {
              const theme = STORE_THEMES().find(t => t.id === el.dataset.id);
              if (!theme) return;

              const thumb = el.querySelector('.theme-card__thumb');
              const rect = (thumb || el).getBoundingClientRect();

              ctx.push('detail', { theme }, {
                transition: 'zoom',
                origin: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
              });
            });
          });
        },
      },

      more: {
        name: 'more',
        render() {
          const all = STORE_THEMES();
          return `
            <div class="theme-page">
              <div class="theme-title">推荐</div>
              <div class="theme-grid">
                ${all.map(t => `
                  <div class="theme-card" data-id="${esc(t.id)}">
                    <div class="theme-card__thumb">
                      <img src="${esc(t.storeimg || t.static || '')}" alt="">
                    </div>
                    <div class="theme-card__name">${esc(t.name)}</div>
                  </div>
                `).join('')}
              </div>
              <div class="theme-end">没有更多了</div>
            </div>
          `;
        },
        mount(root, ctx) {
          root.querySelectorAll('.theme-card').forEach(el => {
            el.addEventListener('click', () => {
              const theme = STORE_THEMES().find(t => t.id === el.dataset.id);
              if (!theme) return;

              const thumb = el.querySelector('.theme-card__thumb');
              const rect = (thumb || el).getBoundingClientRect();

              ctx.push('detail', { theme }, {
                transition: 'zoom',
                origin: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
              });
            });
          });
        },
      },

      detail: {
        name: 'detail',
        transition: 'zoom',
        render(routeCtx) {
          const theme = routeCtx.data?.theme;
          if (!theme) return `<div class="theme-page"><div class="theme-end">主题不存在</div></div>`;

          return `
            <div class="theme-detail">
              <div class="theme-detail__scroll">
                <div class="theme-detail__name">${esc(theme.name)}</div>
                <div class="theme-detail__hero">
                  <img src="${esc(theme.storeimg || theme.static || '')}" alt="">
                </div>
                ${theme.longdescription
                  ? `<div class="theme-detail__desc">${esc(theme.longdescription)}</div>`
                  : ''}
              </div>
              <div class="theme-detail__footer">
                <button class="theme-btn" id="themeActionBtn" type="button">
                  <span class="theme-btn__fill" id="themeActionFill"></span>
                  <span class="theme-btn__label" id="themeActionLabel">下载</span>
                </button>
              </div>
            </div>
          `;
        },
        mount(root, ctx) {
          const theme = ctx.data?.theme;
          if (!theme) return;

          const btn = root.querySelector('#themeActionBtn');
          const fill = root.querySelector('#themeActionFill');
          const label = root.querySelector('#themeActionLabel');
          if (!btn || !fill || !label) return;

          let busy = false;

          async function refresh() {
            if (busy) return;
            const dl = await isDownloaded(theme.id);
            const active = WujiTheme.current === theme.id;
            if (active) { label.textContent = '使用中'; btn.disabled = true; btn.classList.remove('is-progress'); fill.style.width = '0%'; }
            else if (dl) { label.textContent = '应用'; btn.disabled = false; btn.classList.remove('is-progress'); fill.style.width = '0%'; }
            else { label.textContent = '下载'; btn.disabled = false; btn.classList.remove('is-progress'); fill.style.width = '0%'; }
          }
          refresh();

          const runDownload = () => new Promise(resolve => {
            const DURATION = 600;
            const START = performance.now();
            const tick = () => {
              const p = Math.min(1, (performance.now() - START) / DURATION);
              fill.style.width = (p * 100).toFixed(1) + '%';
              label.textContent = `下载中...`;
              if (p < 1) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          });

          btn.addEventListener('click', async () => {
            if (busy || btn.disabled) return;

            const dl = await isDownloaded(theme.id);

            if (!dl) {
              busy = true;
              btn.disabled = true;
              btn.classList.add('is-progress');
              fill.style.width = '0%';
              label.textContent = '下载中 0%';
              try {
                await runDownload();
                const list = await getDownloaded();
                if (!list.some(t => t.id === theme.id)) {
                  list.push({
                    id: theme.id, name: theme.name, author: theme.author,
                    version: theme.version, description: theme.description,
                    longdescription: theme.longdescription,
                    src: theme.src, static: theme.static, storeimg: theme.storeimg,
                    installedAt: Date.now(),
                  });
                  await setDownloaded(list);
                }
                await WujiTheme.load(theme.id);
                busy = false;
                refresh();
                if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
              } catch (e) {
                console.error('[themes] 下载失败', e);
                busy = false;
                btn.classList.remove('is-progress');
                label.textContent = '下载失败';
                fill.style.width = '0%';
                setTimeout(refresh, 1200);
              }
              return;
            }

            try {
              await WujiTheme.load(theme.id);
              if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
              refresh();
            } catch (e) { console.error('[theme] 应用失败', e); }
          });
        },
      },
    },
  });
})();