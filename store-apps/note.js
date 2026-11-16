(() => {
  const BUNDLE = 'com.wujios.note';

  /* ========== 数据层 ========== */
  const db = () => AppStorage.for(BUNDLE);

  let notesCache    = [];
  let notesLoaded   = false;
  let loadingPromise = null;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function loadNotes() {
    if (notesLoaded) return Promise.resolve(notesCache);
    if (!loadingPromise) {
      loadingPromise = db().get('notes', [])
        .then(arr => {
          notesCache    = Array.isArray(arr) ? arr : [];
          notesLoaded   = true;
          loadingPromise = null;
          return notesCache;
        })
        .catch(err => {
          console.warn('[note] load failed', err);
          notesCache    = [];
          notesLoaded   = true;
          loadingPromise = null;
          return notesCache;
        });
    }
    return loadingPromise;
  }

  function persistNotes() {
    db().set('notes', notesCache).catch(err => {
      console.warn('[note] save failed', err);
    });
  }

  function findNote(id) {
    return notesCache.find(n => n.id === id) || null;
  }

  function upsertNote(id, title, content) {
    const idx = notesCache.findIndex(n => n.id === id);
    const now = Date.now();
    if (idx >= 0) {
      notesCache[idx] = { ...notesCache[idx], title, content, updatedAt: now };
    } else {
      notesCache.push({ id, title, content, updatedAt: now });
    }
    notesCache.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    persistNotes();
  }

  function deleteNote(id) {
    const before = notesCache.length;
    notesCache = notesCache.filter(n => n.id !== id);
    if (notesCache.length !== before) persistNotes();
  }

  loadNotes();

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '备忘录',
    icon: './assets/note.svg',
    initialRoute: 'home',
    version: '1.1.7',
    styles: `
      /* ==================== 主页 ==================== */
      .note-page {
        position: absolute;
        inset: 0;
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        padding-top: var(--statusbar-h);
      }

      .note-header {
        flex: 0 0 96px;              /* 固定高度，不随标题/提示字体变化抖动 */
        height: 96px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 17px;
        padding: 0 22px;
      }

      .note-header__text {
        flex: 1 1 auto;
        min-width: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 14px;                /* 标题“全部备忘”与提示“长按删除”之间的间距 */
      }

      /* 固定行高并清除 h2 默认外边距，header 高度不再随字体/内容变化 */
      .note-header .wj-title {
        margin: 0;
        line-height: 34px;
        height: 34px;
      }

      .note-hint {
        font-size: var(--wj-fs-lg);        /* 整体调大 */
        color: var(--wj-text-dim);
        letter-spacing: .3px;
        line-height: 28px;
        height: 28px;
      }

      .note-add-btn {
        flex: 0 0 auto;
        width: 62px;
        height: 62px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: #FFC107;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform .1s ease, background .15s ease;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .note-add-btn:active {
        transform: scale(.9);
        background: #e2aa00;
      }
      .note-add-btn svg {
        width: 31px;
        height: 31px;
        display: block;
        pointer-events: none;
      }

      .note-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 4px 16px 20px;          /* ★ 顶部 +4，跟 header 有点呼吸 */
        display: flex;
        flex-direction: column;
        gap: 8px;                        /* ★ 10 → 8 更紧凑 */
      }

      .note-card {
        padding: 12px 14px;              /* ★ 14/16 → 12/14 更紧凑 */
        border-radius: 20px;
        background: var(--wj-bg-alt);
        cursor: pointer;
        transition: transform .12s ease, background .15s ease;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .note-card:active {
        transform: scale(.985);
        background: #dae2f0;
      }

      .note-card__title {
        font-size: 22px;                 /* ★ 整体调大 18 → 22 */
        font-weight: 600;
        color: var(--wj-text);
        letter-spacing: .2px;
        line-height: 1.25;               /* ★ 收紧 */
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .note-card__title.is-empty {
        color: var(--wj-text-dim);
        font-weight: 500;
      }

      .note-card__content {
        margin-top: 5px;                 /* ★ 整体调大后略增间距 */
        font-size: 18px;                 /* ★ 整体调大 15 → 18 */
        line-height: 1.45;               /* ★ 收紧 */
        color: var(--wj-text-muted);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-all;
      }

      .note-empty {
        padding: 112px 28px;
        text-align: center;
        color: var(--wj-text-dim);
        font-size: 18px;                 /* ★ 整体调大 15 → 18 */
        letter-spacing: .5px;
        line-height: 1.8;
      }

      /* ==================== 编辑页 ==================== */
      .note-edit {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        padding-top: var(--statusbar-h);
        background: var(--wj-bg);
        /* #10 整页纵向滚动：内容多时页面滚动，顶部标题输入框随之滚出视口（自动隐藏） */
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }

      .note-edit__title {
        flex: 0 0 76px;                  /* 固定高度：不随字体加载/内容变化 */
        height: 76px;
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        padding: 0 20px;                 /* 垂直居中由 flex/line-height 保证 */
        font: inherit;
        font-family: inherit;
        font-size: 32px;                 /* ★ 整体调大 28 → 32 */
        font-weight: 700;                /* ★ 600 → 700 更醒目 */
        color: var(--wj-text);
        letter-spacing: .3px;
        line-height: 76px;               /* 与固定高度一致 → 单行垂直居中 */
        border-bottom: .5px solid var(--wj-border, #e6e9ef);
        margin-bottom: 14px;             /* #10 分隔线下方灰色间距 */
        box-sizing: border-box;
      }
      .note-edit__title::placeholder {
        color: var(--wj-text-dim);
        font-weight: 500;
      }

      .note-edit__content {
        flex: 0 0 auto;                  /* #10 不再占满剩余空间，随内容撑高 */
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        font: inherit;
        font-family: inherit;
        font-size: 24px;                 /* ★ 整体调大 20 → 24 */
        line-height: 1.6;
        color: var(--wj-text);
        resize: none;
        box-sizing: border-box;
      }
      .note-edit__content::placeholder {
        color: var(--wj-text-dim);
      }
      /* #4 自绘 div 输入框：保持与原 input/textarea 一致的换行/滚动表现。
         单行标题用 flex 垂直居中，对齐原生 <input> 的居中效果。
         多行正文：height:fit-content 随内容自适应高度，整页滚动而非内部滚动。 */
      div.note-edit__title {
        display: flex; align-items: center;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      div.note-edit__content {
        height: fit-content;             /* #10 随内容增长 */
        min-height: 64px;
        padding: 4px 20px 60px;          /* 顶部留白对齐分隔线上方；底部留足滚动余量 */
        white-space: pre-wrap; word-break: break-word;
      }
      /* zhuzios 原生 <textarea>：无自绘 IME，保留内部滚动的旧行为，不强制 fit-content */
      textarea.note-edit__content {
        flex: 1 1 auto;
        min-height: 0;
        padding: 12px 20px 24px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }

    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="note-page">
              <div class="note-header">
                <div class="note-header__text">
                  <h2 class="wj-title">全部备忘</h2>
                  <div class="note-hint">长按删除</div>
                </div>
                <button class="note-add-btn" id="noteAddBtn" type="button" aria-label="新建">
                  <svg viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.4"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 5v14"/>
                    <path d="M5 12h14"/>
                  </svg>
                </button>
              </div>
              <div class="note-list" id="noteList"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const listEl = root.querySelector('#noteList');
          const addBtn = root.querySelector('#noteAddBtn');

          function renderList() {
            const notes = notesCache;

            if (!notes.length) {
              listEl.innerHTML = `
                <div class="note-empty">
                  暂无备忘<br>点右上角 + 新建
                </div>
              `;
              return;
            }

            listEl.innerHTML = notes.map(n => {
              const title    = (n.title || '').trim();
              const content  = (n.content || '').trim();
              const titleCls = title ? 'note-card__title' : 'note-card__title is-empty';
              const titleTxt = title ? escapeHtml(title) : '无标题';
              const contentHtml = content
                ? `<div class="note-card__content">${escapeHtml(content)}</div>`
                : '';
              return `
                <div class="note-card" data-id="${escapeHtml(n.id)}">
                  <div class="${titleCls}">${titleTxt}</div>
                  ${contentHtml}
                </div>
              `;
            }).join('');

            bindCards();
          }

          function bindCards() {
            listEl.querySelectorAll('.note-card').forEach(cardEl => {
              const id = cardEl.dataset.id;

              let pressTimer  = null;
              let longPressed = false;
              let startX = 0, startY = 0;

              cardEl.addEventListener('pointerdown', e => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                longPressed = false;
                startX = e.clientX;
                startY = e.clientY;

                pressTimer = setTimeout(() => {
                  pressTimer  = null;
                  longPressed = true;
                  if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
                  // ★ 删除确认改用系统 WujiDialog，更好看更 wuji（替代自定义 confirm-delete 路由）。
                  const note = findNote(id);
                  const title = (note?.title || '').trim() || '无标题';
                  window.WujiDialog.show({
                    bundlename: BUNDLE,
                    title: '删除后无法恢复',
                    content: `确定要删除「${title}」吗？`,
                    buttons: [
                      { value: '取消' },
                      { value: '删除', color: 'var(--wj-danger)', primary: true },
                    ],
                  }).then(res => {
                    if (res !== '删除') return;
                    deleteNote(id);
                    if (navigator.vibrate) { try { navigator.vibrate([20, 40, 20]); } catch {} }
                    renderList();
                  }).catch(err => console.warn('[note] delete dialog', err));
                }, 500);
              }, { passive: true });

              cardEl.addEventListener('pointermove', e => {
                if (!pressTimer) return;
                const dx = Math.abs(e.clientX - startX);
                const dy = Math.abs(e.clientY - startY);
                if (dx > 10 || dy > 10) {
                  clearTimeout(pressTimer);
                  pressTimer = null;
                }
              }, { passive: true });

              cardEl.addEventListener('pointerup', () => {
                if (pressTimer) {
                  clearTimeout(pressTimer);
                  pressTimer = null;
                  if (!longPressed) {
                    ctx.push('edit', { id });
                  }
                }
                longPressed = false;
              });

              cardEl.addEventListener('pointercancel', () => {
                if (pressTimer) {
                  clearTimeout(pressTimer);
                  pressTimer = null;
                }
                longPressed = false;
              });

              cardEl.addEventListener('pointerleave', () => {
                if (pressTimer) {
                  clearTimeout(pressTimer);
                  pressTimer = null;
                }
                longPressed = false;
              });
            });
          }

          if (notesLoaded) {
            renderList();
          } else {
            listEl.innerHTML = `<div class="note-empty">加载中…</div>`;
            loadNotes().then(() => {
              if (!root.isConnected) return;
              renderList();
            });
          }

          addBtn.addEventListener('click', () => {
            const id = uid();
            ctx.push('edit', { id, isNew: true });
          });

          const unbind = ctx.nav.onChange(() => {
            if (!root.isConnected) { unbind(); return; }
            if (ctx.nav.current?.route?.name === 'home') {
              renderList();
            }
          });

          return () => {
            unbind();
          };
        },
      },

      edit: {
        name: 'edit',

        render(routeCtx) {
          const id   = routeCtx.data?.id;
          const note = findNote(id);
          const title   = note ? (note.title   || '') : '';
          const content = note ? (note.content || '') : '';

          const titleField = window.WJ_IME
            ? `<div class="note-edit__title" id="noteEditTitle" data-wj-field="1" data-wj-placeholder="标题" tabindex="0" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>`
            : `<input class="note-edit__title" id="noteEditTitle" type="text" placeholder="标题" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${escapeHtml(title)}">`;
          const contentField = window.WJ_IME
            ? `<div class="note-edit__content" id="noteEditContent" data-wj-field="1" data-wj-multiline="1" data-wj-placeholder="内容" tabindex="0" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>`
            : `<textarea class="note-edit__content" id="noteEditContent" placeholder="内容" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">${escapeHtml(content)}</textarea>`;

          return `
            <div class="note-edit">
              ${titleField}
              ${contentField}
            </div>
          `;
        },

        mount(root, ctx) {
          const id = ctx.data?.id;
          if (!id) {
            console.warn('[note] edit: missing id');
            return;
          }

          const titleEl   = root.querySelector('#noteEditTitle');
          const contentEl = root.querySelector('#noteEditContent');
          const isNew     = !!ctx.data.isNew;

          // #4 自绘 div 用 IME 接口初始化文本（input 直接走 value）。
          // title/content 在 render 作用域内，mount 里重新取值。
          const note0 = findNote(id);
          const title0   = note0 ? (note0.title   || '') : '';
          const content0 = note0 ? (note0.content || '') : '';
          if (window.WJ_IME) { window.WJ_IME.setFieldText(titleEl, title0); window.WJ_IME.setFieldText(contentEl, content0); }

          if (isNew) {
            setTimeout(() => {
              try { titleEl.focus(); } catch {}
            }, 220);
          }

          let saveTimer = null;
          let destroyed = false;

          function readText(el) { return window.WJ_IME ? window.WJ_IME.getFieldText(el) : (el.value || ''); }
          function flushSave() {
            const title   = readText(titleEl);
            const content = readText(contentEl);
            if (isNew && !title.trim() && !content.trim()) return;
            upsertNote(id, title, content);
          }

          function scheduleSave() {
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
              saveTimer = null;
              flushSave();
            }, 400);
          }

          // 自绘 div 输入由 IME 接管并派发 input 事件；input 原生派发。
          titleEl.addEventListener('input', scheduleSave);
          contentEl.addEventListener('input', scheduleSave);

          return () => {
            destroyed = true;
            if (saveTimer) {
              clearTimeout(saveTimer);
              saveTimer = null;
            }
            flushSave();
          };
        },
      },
    },
  });
})();