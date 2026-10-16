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
    version: '1.0.4',
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
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px 8px;
      }

      .note-header__text {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0;
      }

      .note-header__title {
        font-size: 24px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
        line-height: 1.2;
        margin: 0;
      }

      .note-hint {
        font-size: 14px;
        color: var(--wj-text-dim);
        letter-spacing: .3px;
        line-height: 1.15;
      }

      .note-add-btn {
        flex: 0 0 auto;
        width: 44px;
        height: 44px;
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
        width: 22px;
        height: 22px;
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
        border-radius: 14px;
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
        font-size: 18px;                 /* ★ 16 → 18 */
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
        margin-top: 4px;                 /* ★ 6 → 4 */
        font-size: 15px;                 /* ★ 13 → 15 */
        line-height: 1.45;               /* ★ 收紧 */
        color: var(--wj-text-muted);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-all;
      }

      .note-empty {
        padding: 80px 20px;
        text-align: center;
        color: var(--wj-text-dim);
        font-size: 15px;                 /* ★ 14 → 15 */
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
      }

      .note-edit__title {
        flex: 0 0 auto;
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        padding: 14px 20px;              /* ★ 16 → 14 */
        font: inherit;
        font-family: inherit;
        font-size: 28px;                 /* ★ 24 → 28 */
        font-weight: 700;                /* ★ 600 → 700 更醒目 */
        color: var(--wj-text);
        letter-spacing: .3px;
        line-height: 1.25;
        border-bottom: .5px solid var(--wj-border, #e6e9ef);
        box-sizing: border-box;
      }
      .note-edit__title::placeholder {
        color: var(--wj-text-dim);
        font-weight: 500;
      }

      .note-edit__content {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        padding: 12px 20px 24px;         /* ★ 14 → 12 */
        font: inherit;
        font-family: inherit;
        font-size: 20px;                 /* 保持 20 */
        line-height: 1.6;                /* ★ 1.65 → 1.6 略紧 */
        color: var(--wj-text);
        resize: none;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        box-sizing: border-box;
      }
      .note-edit__content::placeholder {
        color: var(--wj-text-dim);
      }

      /* ==================== 删除确认页 ==================== */
      .note-confirm {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: calc(var(--statusbar-h) + 20px) 30px 40px;
        background: var(--wj-bg);
        gap: 10px;
      }

      .note-confirm__icon {
        width: 68px;                     /* ★ 64 → 68 */
        height: 68px;
        border-radius: 50%;
        background: #ffe4ec;
        color: #e0356b;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 8px;
      }
      .note-confirm__icon svg {
        width: 32px;                     /* ★ 30 → 32 */
        height: 32px;
        display: block;
      }

      .note-confirm__title {
        font-size: 19px;                 /* ★ 17 → 19 */
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
        text-align: center;
      }

      .note-confirm__msg {
        font-size: 16px;                 /* ★ 14 → 16 */
        line-height: 1.6;
        color: var(--wj-text-muted);
        text-align: center;
        word-break: break-all;
        max-width: 300px;
        padding: 0 4px;
      }
      .note-confirm__msg strong {
        color: var(--wj-text);
        font-weight: 600;
      }

      .note-confirm__actions {
        margin-top: 24px;
        display: flex;
        gap: 12px;
        width: 100%;
        max-width: 280px;
      }

      .note-confirm__btn {
        flex: 1 1 0;
        padding: 14px 20px;              /* ★ 13 → 14 */
        border: 0;
        border-radius: 999px;
        font: inherit;
        font-size: 16px;                 /* ★ 15 → 16 */
        font-weight: 600;
        letter-spacing: .3px;
        cursor: pointer;
        transition: transform .1s ease, background .15s ease;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .note-confirm__btn:active {
        transform: scale(.97);
      }

      .note-confirm__btn--cancel {
        background: var(--wj-bg-alt);
        color: var(--wj-text);
      }
      .note-confirm__btn--cancel:active {
        background: #dae2f0;
      }

      .note-confirm__btn--confirm {
        background: #e0356b;
        color: #fff;
      }
      .note-confirm__btn--confirm:active {
        background: #c02a58;
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
                  <h1 class="note-header__title">全部备忘</h1>
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
                  ctx.push('confirm-delete', { id });
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

          return `
            <div class="note-edit">
              <input class="note-edit__title"
                     id="noteEditTitle"
                     type="text"
                     placeholder="标题"
                     autocomplete="off"
                     autocorrect="off"
                     autocapitalize="off"
                     spellcheck="false"
                     value="${escapeHtml(title)}">
              <textarea class="note-edit__content"
                        id="noteEditContent"
                        placeholder="内容"
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck="false">${escapeHtml(content)}</textarea>
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

          if (isNew) {
            setTimeout(() => {
              try { titleEl.focus(); } catch {}
            }, 220);
          }

          let saveTimer = null;
          let destroyed = false;

          function flushSave() {
            const title   = titleEl.value;
            const content = contentEl.value;
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

      'confirm-delete': {
        name: 'confirm-delete',

        render(routeCtx) {
          const id   = routeCtx.data?.id;
          const note = findNote(id);
          const title = (note?.title || '').trim() || '无标题';

          return `
            <div class="note-confirm">
              <div class="note-confirm__icon">
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                </svg>
              </div>
              <div class="note-confirm__title">删除后无法恢复</div>
              <div class="note-confirm__msg">
                你确定要删除 <strong>"${escapeHtml(title)}"</strong> 吗？
              </div>
              <div class="note-confirm__actions">
                <button class="note-confirm__btn note-confirm__btn--cancel"
                        id="noteCancelBtn" type="button">取消</button>
                <button class="note-confirm__btn note-confirm__btn--confirm"
                        id="noteConfirmBtn" type="button">确定</button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const id = ctx.data?.id;

          root.querySelector('#noteCancelBtn').addEventListener('click', () => {
            ctx.pop();
          });

          root.querySelector('#noteConfirmBtn').addEventListener('click', () => {
            if (id) deleteNote(id);
            if (navigator.vibrate) {
              try { navigator.vibrate([20, 40, 20]); } catch {}
            }
            ctx.pop();
          });
        },
      },
    },
  });
})();