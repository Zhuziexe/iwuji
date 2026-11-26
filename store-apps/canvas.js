(() => {
  /* =========================================================
     竹子画板 com.zhuzi.canvas
       - 主页：画布列表（新建时先命名 / 长按重命名或删除）
       - 编辑器：固定尺寸画布，不做任何缩放，高性能
       - 画布就是物理像素 420 × 352（width/height 直接写死，不乘 DPI）
       - 统一 RGB 三通道（canvas alpha:false），橡皮 = 涂白 (255,255,255)
       - 导出：写入文件系统 Pictures 文件夹
     ========================================================= */
  const BUNDLE = 'com.zhuzi.canvas';
  const LIST_KEY = 'list';
  const ART_KEY = id => 'art:' + id;
  const db = () => AppStorage.for(BUNDLE);

  /* 画布物理尺寸：固定、不随 DPI/窗口缩放（高性能）。
     高度取 330：iWuji(420×560) 上扣掉状态栏 36 与工具栏约 192 后，
     剩余高度刚好能容纳 420 宽，从而等比缩放时宽度占满。 */
  const CW = 420;
  const CH = 330;

  const PALETTE = [
    '#1c1c1e', '#ffffff', '#ef5350', '#f9a825', '#66bb6a',
    '#42a5f5', '#7e57c2', '#8d6e63', '#26c6da', '#ec407a',
  ];

  const MAX_UNDO = 5;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* 模块级只放常量/纯函数；可变数据挂在 nav 会话上 */
  function session(nav) {
    if (!nav.__zcanvas) {
      nav.__zcanvas = { list: [], saveTimer: null, loaded: false, ready: null };
    }
    const S = nav.__zcanvas;
    if (!S.ready) {
      S.ready = db().get(LIST_KEY)
        .then(v => { S.list = Array.isArray(v) ? v : []; })
        .catch(() => { S.list = []; })
        .then(() => { S.loaded = true; return S.list; });
    }
    return S;
  }
  async function saveList(S) {
    try { await db().set(LIST_KEY, S.list); } catch (e) { console.warn('[canvas] saveList', e); }
  }

  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function toast(msg) { try { WujiToast?.show?.(msg); } catch { } }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '竹子画板',
    icon: './assets/canvas.jpg',
    initialRoute: 'home',
    version: '1.3.2',
    author: 'Zhuzi',
    devices: ['iwuji', 'pc'],

    styles: `
      /* ---------- 主页 ---------- */
      .zc-home { position: absolute; inset: 0; display: flex; flex-direction: column;
        background: var(--wj-bg, #fff); }
      .zc-home__head {
        flex: 0 0 auto;
        padding: calc(var(--statusbar-h, 36px) + 10px) 16px 8px;
        display: flex; align-items: center; gap: 12px;
      }
      .zc-home__text { flex: 1 1 auto; min-width: 0; }
      .zc-home__title { margin: 0; font-size: 28px; font-weight: 700; color: var(--wj-text); }
      .zc-home__hint { font-size: 18px; color: var(--wj-text-dim, #98a1b0); margin-top: 4px; }
      .zc-add {
        flex: 0 0 auto; width: 60px; height: 60px; padding: 0;
        border: 0; border-radius: 50%;
        background: #7cb342; color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        transition: transform .1s ease, background .15s ease;
      }
      .zc-add:active { transform: scale(.9); background: #689f38; }
      .zc-add svg { width: 30px; height: 30px; display: block; pointer-events: none; }

      .zc-list { flex: 1 1 auto; min-height: 0; overflow-y: auto;
        -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
        padding: 4px 16px 20px; display: flex; flex-direction: column; gap: 8px; }
      .zc-card {
        padding: 14px; border-radius: 8px;
        background: var(--wj-bg-alt, #eef1f6);
        display: flex; align-items: center; gap: 14px;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        user-select: none; -webkit-user-select: none;
        transition: background .15s ease, transform .12s ease;
      }
      .zc-card:active { background: #dae2f0; transform: scale(.985); }
      .zc-card__thumb {
        flex: 0 0 auto; width: 56px; height: 56px;
        border-radius: 6px; background: #fff center/cover no-repeat;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,.1);
      }
      .zc-card__body { flex: 1 1 auto; min-width: 0; }
      .zc-card__name { font-size: 22px; font-weight: 600; color: var(--wj-text);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zc-card__meta { margin-top: 4px; font-size: 17px; color: var(--wj-text-muted, #5b6478); }
      .zc-empty { padding: 100px 28px; text-align: center; font-size: 20px;
        color: var(--wj-text-dim, #98a1b0); line-height: 1.6; }

      /* ---------- 编辑器 ---------- */
      .zc-edit { position: absolute; inset: 0; display: flex; flex-direction: column;
        background: #ffffff; padding-top: var(--statusbar-h, 0px); box-sizing: border-box; }
      /* 舞台：白底，画布等比缩放到占满剩余空间（宽度优先） */
      .zc-stage {
        flex: 1 1 auto; min-height: 0;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        background: #ffffff;
      }
      .zc-canvas {
        display: block; background: #fff;
        touch-action: none;
        box-shadow: 0 1px 8px rgba(0,0,0,.14);
      }

      /* ---------- 工具栏：移动端圆形按钮 ---------- */
      .zc-tools {
        flex: 0 0 auto;
        padding: 8px 10px calc(10px + env(safe-area-inset-bottom, 0px));
        background: #f7f9fb; border-top: 1px solid #e2e7ee;
        display: flex; flex-direction: column; gap: 6px;
      }
      /* 工具按钮行：用 gap 排布并居中，不靠左挤在一起 */
      .zc-row { display: flex; align-items: center; gap: 6px; }
      .zc-row--tools { justify-content: center; gap: 10px; }
      .zc-btn {
        flex: 0 0 auto; width: 54px; height: 54px; padding: 0;
        border: 0; background: transparent; border-radius: 50%;
        color: #33404f; display: flex; align-items: center; justify-content: center;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        transition: background .12s ease, color .12s ease;
      }
      .zc-btn svg { width: 26px; height: 26px; display: block; }
      .zc-btn:active { background: rgba(0,0,0,.08); }
      .zc-btn.is-active { background: rgba(58,111,240,.16); color: #3a6ff0; }

      /* 色块：48px，横向可滚动；容器上下留白，选中环用 inset 不越界 */
      .zc-colors {
        flex: 1 1 auto; min-width: 0;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 2px; box-sizing: border-box;
        overflow-x: auto; overflow-y: hidden;
        scrollbar-width: none; -webkit-overflow-scrolling: touch;
      }
      .zc-colors::-webkit-scrollbar { display: none; }
      .zc-swatch {
        flex: 0 0 auto; width: 48px; height: 48px; padding: 0;
        border: 0; border-radius: 50%; cursor: pointer;
        box-sizing: border-box;
        box-shadow: inset 0 0 0 1.5px rgba(0,0,0,.22);
        -webkit-tap-highlight-color: transparent;
      }
      .zc-swatch.is-active {
        box-shadow: inset 0 0 0 4px #3a6ff0, inset 0 0 0 6px #ffffff;
      }

      /* ---------- 滑块（仿设置页） ---------- */
      .zc-sliderwrap {
        flex: 1 1 auto; min-width: 0;
        display: flex; align-items: center; gap: 12px;
        padding: 0 12px; box-sizing: border-box;
      }
      .zc-sliderlabel {
        flex: 0 0 auto; font-size: 22px; font-weight: 600; color: #33404f;
      }
      .zc-slider {
        position: relative; flex: 1 1 auto; min-width: 0; height: 44px;
        border-radius: 22px; background: #e2e7ee; cursor: pointer;
        touch-action: none; user-select: none; -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .zc-slider__fill {
        position: absolute; top: 5px; bottom: 5px; left: 5px; width: 0;
        background: #3a6ff0; border-radius: 18px; pointer-events: none;
      }
      .zc-slider__knob {
        position: absolute; top: 50%; left: 24px; width: 26px; height: 26px;
        border-radius: 50%; background: #fff; transform: translate(-50%, -50%);
        box-shadow: 0 2px 7px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.05);
        z-index: 1; pointer-events: none;
      }
      .zc-sliderval {
        flex: 0 0 auto; min-width: 44px; text-align: right;
        font-size: 22px; font-weight: 600; color: #33404f;
        font-variant-numeric: tabular-nums;
      }
    `,

    routes: {
      /* ---------------- 主页 ---------------- */
      home: {
        name: 'home',
        render(routeCtx) {
          const S = session(routeCtx.nav);
          const items = S.list || [];
          const cards = items.length
            ? items.map(it => `
              <div class="zc-card" data-id="${esc(it.id)}">
                <div class="zc-card__thumb" data-thumb="${esc(it.id)}"></div>
                <div class="zc-card__body">
                  <div class="zc-card__name">${esc(it.name || '未命名画布')}</div>
                  <div class="zc-card__meta">${fmtTime(it.updatedAt)}</div>
                </div>
              </div>`).join('')
            : `<div class="zc-empty">还没有画布<br>点右上角 + 新建</div>`;

          return `
            <div class="zc-home">
              <div class="zc-home__head">
                <div class="zc-home__text">
                  <h2 class="zc-home__title">全部画布</h2>
                  <div class="zc-home__hint">长按画布可重命名或删除</div>
                </div>
                <button class="zc-add" id="zcAdd" type="button" aria-label="新建画布">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 5v14"/><path d="M5 12h14"/>
                  </svg>
                </button>
              </div>
              <div class="zc-list" id="zcList">${cards}</div>
            </div>
          `;
        },
        mount(root, ctx) {
          const S = session(ctx.nav);
          const listEl = root.querySelector('#zcList');
          const addBtn = root.querySelector('#zcAdd');

          /* 列表渲染函数（供 mount 与 nav 变更复用） */
          function paintCards() {
            const items = S.list || [];
            listEl.innerHTML = items.length
              ? items.map(it => `
                  <div class="zc-card" data-id="${esc(it.id)}">
                    <div class="zc-card__thumb" data-thumb="${esc(it.id)}"></div>
                    <div class="zc-card__body">
                      <div class="zc-card__name">${esc(it.name || '未命名画布')}</div>
                      <div class="zc-card__meta">${fmtTime(it.updatedAt)}</div>
                    </div>
                  </div>`).join('')
              : `<div class="zc-empty">还没有画布<br>点右上角 + 新建</div>`;
            fillThumbs();
          }

          /* ★ 修复时序竞态：render() 是同步的，此时数据可能还没读完，
             会用空列表生成 DOM；而 mount() 在下一帧才跑，如果那时数据已就绪，
             旧逻辑会跳过重绘 → 页面永远停在默认状态。
             所以：数据已就绪就立即重绘一次；未就绪则等 ready 后重绘。 */
          if (S.loaded) {
            paintCards();
            bindCards();
          } else {
            S.ready.then(() => {
              if (!root.isConnected) return;
              paintCards();
              bindCards();
            }).catch(() => { });
          }

          /* 缩略图异步填充 */
          async function fillThumbs() {
            for (const th of listEl.querySelectorAll('[data-thumb]')) {
              const tid = th.dataset.thumb;
              try {
                const rec = await db().get(ART_KEY(tid));
                if (rec && rec.thumb) th.style.backgroundImage = `url(${rec.thumb})`;
              } catch { }
            }
          }

          function bindCards() {
            listEl.querySelectorAll('.zc-card').forEach(card => {
              const id = card.dataset.id;
              let timer = null, sx = 0, sy = 0;
              card.addEventListener('pointerdown', e => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                card.__longPressed = false;
                sx = e.clientX; sy = e.clientY;
                timer = setTimeout(async () => {
                  timer = null;
                  card.__longPressed = true;
                  if (navigator.vibrate) { try { navigator.vibrate(12); } catch { } }
                  await showCardMenu(ctx, S, id);
                  card.__longPressed = false;
                }, 520);
              });
              card.addEventListener('pointermove', e => {
                if (!timer) return;
                if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) {
                  clearTimeout(timer); timer = null;
                }
              });
              const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
              card.addEventListener('pointerup', cancel);
              card.addEventListener('pointercancel', cancel);
              card.addEventListener('pointerleave', cancel);
            });
          }

          /* ★ 从编辑器返回（pop）或其它路由切回主页时，重绘列表。
             路由 pop 不会重建上一页 DOM，不刷新会看到过期列表。 */
          const offChange = ctx.nav.onChange(() => {
            if (!root.isConnected) return;
            const cur = ctx.nav.current;
            if (!cur || cur.route?.name !== 'home') return;
            paintCards();
            bindCards();
          });

          /* 新建：先弹窗命名，校验通过才进编辑器 */
          addBtn.addEventListener('click', async () => {
            const out = await WujiDialog.show({
              bundlename: BUNDLE,
              title: '新建画布',
              input: { value: '', placeholder: '输入画布名称' },
              buttons: [
                { value: '取消' },
                {
                  value: '创建', primary: true,
                  validate(v) {
                    const n = String(v ?? '').trim();
                    if (!n) return '名称不能为空';
                    if (n.length > 30) return '名称不超过 30 个字';
                    return '';
                  },
                },
              ],
            }).catch(() => null);
            if (!out || typeof out !== 'object' || out.button !== '创建') return;
            const name = String(out.value ?? '').trim();
            if (!name) return;

            const newId = uid();
            S.list.unshift({ id: newId, name, updatedAt: Date.now() });
            await saveList(S);
            ctx.push('edit', { id: newId });
          });

          listEl.addEventListener('click', e => {
            const card = e.target.closest('.zc-card');
            if (!card || card.__longPressed) return;
            ctx.push('edit', { id: card.dataset.id });
          });

          return () => {
            try { offChange(); } catch { }
          };
        },
      },

      /* ---------------- 编辑器 ---------------- */
      edit: {
        name: 'edit',
        render(routeCtx) {
          const S = session(routeCtx.nav);
          const id = routeCtx.data?.id;
          const item = (S.list || []).find(x => x.id === id);
          const name = item ? (item.name || '未命名画布') : '画布';
          return `
            <div class="zc-edit" data-name="${esc(name)}">
              <div class="zc-stage" id="zcStage">
                <canvas class="zc-canvas" id="zcCanvas" width="${CW}" height="${CH}"></canvas>
              </div>
              <div class="zc-tools">
                <div class="zc-row zc-row--tools">
                  <button class="zc-btn is-active" id="zcBrush" type="button" aria-label="画笔" title="画笔">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.9 3.6a2 2 0 0 1 2.8 0l2.7 2.7a2 2 0 0 1 0 2.8l-7.6 7.6-5.5-5.5 7.6-7.6zM6.2 12.3l5.5 5.5-1.4 1.4a2 2 0 0 1-1.4.6H4.3l1.9-1.9a2.6 2.6 0 0 1 0-3.6l.9-1.4z"/></svg>
                  </button>
                  <button class="zc-btn" id="zcEraser" type="button" aria-label="橡皮" title="橡皮">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.2 3.4a2.4 2.4 0 0 1 3.4 0l2 2a2.4 2.4 0 0 1 0 3.4L10.4 19H7.6l-2-2a2.4 2.4 0 0 1 0-3.4l9.6-10.2zM4 20h8v2H4z"/></svg>
                  </button>
                  <button class="zc-btn" id="zcFill" type="button" aria-label="填充" title="填充">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 2.5a1 1 0 0 1 1.4 0l1.4 1.4-1.4 1.4 6.4 6.4a1 1 0 0 1 0 1.4l-5 5a2 2 0 0 1-2.8 0l-5-5a2 2 0 0 1 0-2.8l6.4-6.4-1.4-1.4zM7 12h8.6l-4.3-4.3L7 12z"/><path d="M19.5 15.5c.6 1 1.5 2.2 1.5 3a1.5 1.5 0 0 1-3 0c0-.8.9-2 1.5-3z"/></svg>
                  </button>
                  <button class="zc-btn" id="zcUndo" type="button" aria-label="撤销" title="撤销">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>
                  </button>
                  <button class="zc-btn" id="zcExport" type="button" aria-label="导出" title="导出">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
                  </button>
                </div>
                <div class="zc-row"><div class="zc-colors" id="zcColors"></div></div>
                <div class="zc-row">
                  <div class="zc-sliderwrap">
                    <span class="zc-sliderlabel" id="zcSliderLabel">粗细</span>
                    <div class="zc-slider" id="zcSlider">
                      <div class="zc-slider__fill" id="zcSliderFill"></div>
                      <div class="zc-slider__knob" id="zcSliderKnob"></div>
                    </div>
                    <span class="zc-sliderval" id="zcSliderVal">8</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const S = session(ctx.nav);
          const id = ctx.data?.id;
          const wrap = root.querySelector('.zc-edit');
          const canvasName = wrap.dataset.name || '画布';

          const canvas = root.querySelector('#zcCanvas');
          const octx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
          const colorsEl = root.querySelector('#zcColors');
          const brushBtn = root.querySelector('#zcBrush');
          const eraserBtn = root.querySelector('#zcEraser');
          const fillBtn = root.querySelector('#zcFill');
          const undoBtn = root.querySelector('#zcUndo');
          const exportBtn = root.querySelector('#zcExport');
          const sliderLabel = root.querySelector('#zcSliderLabel');
          const slider = root.querySelector('#zcSlider');
          const sliderFill = root.querySelector('#zcSliderFill');
          const sliderKnob = root.querySelector('#zcSliderKnob');
          const sliderVal = root.querySelector('#zcSliderVal');

          let disposed = false;
          let tool = 'brush';
          let color = PALETTE[0];
          let strokeSize = 8;
          let fillSize = 40;
          const undoStack = [];

          /* 画布就是物理像素：先用白色铺底（无透明通道） */
          function whiteOut() {
            octx.fillStyle = '#ffffff';
            octx.fillRect(0, 0, CW, CH);
          }
          whiteOut();

          /* 画布 buffer 永远是 CW×CH（物理像素，不乘 DPI）。
             显示尺寸「宽度优先」：宽度占满舞台，高度按 CW:CH 比例算，
             只有算出的高度超出可用高度时才改用高度约束（保证不溢出）。 */
          const stage = root.querySelector('#zcStage');
          function fitCanvas() {
            const r = stage.getBoundingClientRect();
            const cs = getComputedStyle(stage);
            const availW = Math.max(1, r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
            const availH = Math.max(1, r.height - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
            /* 先按宽度铺满 */
            let cssW = availW;
            let cssH = cssW * CH / CW;
            if (cssH > availH) {
              /* 高度不够 → 退回按高度约束（此时宽度会小于舞台，但不会溢出） */
              cssH = availH;
              cssW = cssH * CW / CH;
            }
            canvas.style.width = Math.max(1, Math.round(cssW)) + 'px';
            canvas.style.height = Math.max(1, Math.round(cssH)) + 'px';
          }
          fitCanvas();
          /* mount 早于布局完成时可能读到 0 尺寸：下一帧再量一次兜底 */
          requestAnimationFrame(() => { if (!disposed) fitCanvas(); });

          const toXY = e => {
            const r = canvas.getBoundingClientRect();
            return {
              x: Math.max(0, Math.min(CW, (e.clientX - r.left) * (CW / r.width))),
              y: Math.max(0, Math.min(CH, (e.clientY - r.top) * (CH / r.height))),
            };
          };

          /* ---------- 撤销（最多 5 次，控制内存） ---------- */
          function pushUndo() {
            try {
              undoStack.push(octx.getImageData(0, 0, CW, CH));
              while (undoStack.length > MAX_UNDO) undoStack.shift();
            } catch (e) { console.warn('[canvas] snapshot', e); }
          }
          function undo() {
            const snap = undoStack.pop();
            if (!snap) { toast('没有可撤销的操作'); return; }
            octx.putImageData(snap, 0, 0);
            saveSoon();
          }

          /* ---------- 绘制 ---------- */
          function stroke(from, to) {
            octx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
            octx.lineWidth = strokeSize;
            octx.lineCap = 'round';
            octx.lineJoin = 'round';
            octx.beginPath();
            octx.moveTo(from.x, from.y);
            octx.lineTo(to.x, to.y);
            octx.stroke();
          }
          function dot(p) {
            octx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
            octx.beginPath();
            octx.arc(p.x, p.y, strokeSize / 2, 0, Math.PI * 2);
            octx.fill();
          }
          function hex2rgb(c) {
            return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
          }
          function floodFill(sx0, sy0, fillColor, tol) {
            const img = octx.getImageData(0, 0, CW, CH);
            const d = img.data;
            const sx = Math.max(0, Math.min(CW - 1, sx0 | 0));
            const sy = Math.max(0, Math.min(CH - 1, sy0 | 0));
            const i0 = (sy * CW + sx) * 4;
            const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
            const [nr, ng, nb] = hex2rgb(fillColor);
            if (tr === nr && tg === ng && tb === nb) return false;
            const t = Math.max(0, Math.min(255, tol | 0));
            const seen = new Uint8Array(CW * CH);
            const stack = [sy * CW + sx];
            while (stack.length) {
              const pos = stack.pop();
              if (pos < 0 || pos >= CW * CH || seen[pos]) continue;
              seen[pos] = 1;
              const i = pos * 4;
              if (Math.abs(d[i] - tr) > t || Math.abs(d[i + 1] - tg) > t || Math.abs(d[i + 2] - tb) > t) continue;
              d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
              const x = pos % CW, y = (pos / CW) | 0;
              if (x > 0) stack.push(pos - 1);
              if (x < CW - 1) stack.push(pos + 1);
              if (y > 0) stack.push(pos - CW);
              if (y < CH - 1) stack.push(pos + CW);
            }
            octx.putImageData(img, 0, 0);
            return true;
          }

          /* ---------- 保存 ---------- */
          let saveTimer = null;
          function saveSoon() {
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => { saveTimer = null; save(); }, 700);
          }
          function makeThumb() {
            try {
              const t = document.createElement('canvas');
              t.width = 112; t.height = 112;
              const tc = t.getContext('2d', { alpha: false });
              tc.fillStyle = '#fff'; tc.fillRect(0, 0, 112, 112);
              const side = Math.min(CW, CH);
              tc.drawImage(canvas, (CW - side) / 2, (CH - side) / 2, side, side, 0, 0, 112, 112);
              return t.toDataURL('image/jpeg', 0.7);
            } catch { return ''; }
          }
          async function save() {
            if (disposed || !id) return;
            try {
              await db().set(ART_KEY(id), {
                dataUrl: canvas.toDataURL('image/jpeg', 0.92),
                strokeSize,
                fillSize,
                thumb: makeThumb(),
                updatedAt: Date.now(),
              });
              const it = (S.list || []).find(x => x.id === id);
              if (it) { it.updatedAt = Date.now(); saveList(S); }
            } catch (e) { console.warn('[canvas] save', e); }
          }

          /* ---------- 手势（单指，无缩放无平移） ---------- */
          let drawing = false, last = null;
          function onDown(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            try { canvas.setPointerCapture(e.pointerId); } catch { }
            const p = toXY(e);
            if (tool === 'fill') {
              pushUndo();
              if (!floodFill(p.x, p.y, color, fillSize)) undoStack.pop();
              else saveSoon();
            } else {
              drawing = true;
              last = p;
              pushUndo();
              dot(p);
            }
            e.preventDefault();
          }
          function onMove(e) {
            if (!drawing || !last) return;
            const p = toXY(e);
            stroke(last, p);
            last = p;
            e.preventDefault();
          }
          function onUp() {
            if (drawing) { drawing = false; last = null; saveSoon(); }
          }
          canvas.addEventListener('pointerdown', onDown);
          canvas.addEventListener('pointermove', onMove);
          canvas.addEventListener('pointerup', onUp);
          canvas.addEventListener('pointercancel', onUp);

          /* ---------- 滑块 ---------- */
          function isFillMode() { return tool === 'fill'; }
          function sliderRange() { return isFillMode() ? [0, 200] : [1, 40]; }
          function paintSlider() {
            const [min, max] = sliderRange();
            const v = isFillMode() ? fillSize : strokeSize;
            const w = slider.clientWidth;
            if (!w) return;
            const KNOB_R = 13, PAD = 5;
            const usable = Math.max(1, w - (KNOB_R + PAD) * 2);
            const p = Math.max(0, Math.min(1, (v - min) / (max - min)));
            const x = PAD + KNOB_R + usable * p;
            sliderKnob.style.left = x + 'px';
            sliderFill.style.width = (x + KNOB_R - PAD) + 'px';
            sliderLabel.textContent = isFillMode() ? '容积' : '粗细';
            sliderVal.textContent = String(v);
          }
          function valueFromX(clientX) {
            const r = slider.getBoundingClientRect();
            const KNOB_R = 13, PAD = 5;
            const usable = Math.max(1, r.width - (KNOB_R + PAD) * 2);
            const x = Math.max(0, Math.min(usable, clientX - r.left - (KNOB_R + PAD)));
            const [min, max] = sliderRange();
            return Math.round(min + (max - min) * (x / usable));
          }
          function applySlider(v) {
            const [min, max] = sliderRange();
            const val = Math.max(min, Math.min(max, v));
            if (isFillMode()) fillSize = val; else strokeSize = val;
            paintSlider();
          }
          let sDrag = false;
          slider.addEventListener('pointerdown', e => {
            e.preventDefault(); e.stopPropagation();
            sDrag = true;
            try { slider.setPointerCapture(e.pointerId); } catch { }
            applySlider(valueFromX(e.clientX));
          });
          slider.addEventListener('pointermove', e => {
            if (!sDrag) return;
            e.preventDefault();
            applySlider(valueFromX(e.clientX));
          });
          const endSlider = () => { if (!sDrag) return; sDrag = false; saveSoon(); };
          slider.addEventListener('pointerup', endSlider);
          slider.addEventListener('pointercancel', endSlider);

          /* ---------- 工具 ---------- */
          function setTool(t) {
            tool = t;
            brushBtn.classList.toggle('is-active', t === 'brush');
            eraserBtn.classList.toggle('is-active', t === 'eraser');
            fillBtn.classList.toggle('is-active', t === 'fill');
            paintSlider();
          }
          brushBtn.addEventListener('click', () => setTool('brush'));
          eraserBtn.addEventListener('click', () => setTool('eraser'));
          fillBtn.addEventListener('click', () => setTool('fill'));
          undoBtn.addEventListener('click', undo);

          /* 导出到 Pictures */
          exportBtn.addEventListener('click', async () => {
            if (exportBtn.disabled) return;
            exportBtn.disabled = true;
            try {
              const blob = await new Promise((res, rej) => {
                canvas.toBlob(b => b ? res(b) : rej(new Error('生成图片失败')), 'image/jpeg', 0.95);
              });
              const safe = String(canvasName || '画布').replace(/[\\/:*?"<>|]/g, '_');
              const name = `${safe}_${Date.now()}.jpg`;
              const file = new File([blob], name, { type: 'image/jpeg' });
              if (!window.WujiFileSystem?.add) throw new Error('文件系统不可用');
              await WujiFileSystem.add(['Pictures'], file, { name });
              try { window.dispatchEvent(new CustomEvent('wuji:photos-changed')); } catch { }
              toast('已保存到图库');
            } catch (e) {
              console.error('[canvas] export', e);
              toast('导出失败：' + (e?.message || '未知错误'));
            } finally {
              exportBtn.disabled = false;
            }
          });

          /* 颜色 */
          PALETTE.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'zc-swatch' + (c === color ? ' is-active' : '');
            b.style.background = c;
            b.addEventListener('click', () => {
              color = c;
              colorsEl.querySelectorAll('.zc-swatch')
                .forEach(x => x.classList.toggle('is-active', x === b));
              if (tool === 'eraser') setTool('brush');
            });
            colorsEl.appendChild(b);
          });

          /* ---------- 载入已有内容 ---------- */
          (async () => {
            let rec = null;
            try { rec = await db().get(ART_KEY(id)); } catch { }
            if (disposed) return;
            if (rec) {
              if (typeof rec.strokeSize === 'number') strokeSize = rec.strokeSize;
              if (typeof rec.fillSize === 'number') fillSize = rec.fillSize;
              if (rec.dataUrl) {
                const img = new Image();
                await new Promise(res => { img.onload = res; img.onerror = res; img.src = rec.dataUrl; });
                if (img.width && img.height && !disposed) {
                  whiteOut();
                  octx.drawImage(img, 0, 0, CW, CH);
                }
              }
            }
            paintSlider();
          })();

          /* 窗口尺寸变化：重算画布 CSS 尺寸（等比缩放）与滑块布局 */
          const ro = new ResizeObserver(() => {
            if (disposed) return;
            fitCanvas();
            paintSlider();
          });
          ro.observe(stage);

          return () => {
            disposed = true;
            try { ro.disconnect(); } catch { }
            if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
            save();
          };
        },
      },
    },
  });

  /* 长按菜单：重命名 / 删除 */
  async function showCardMenu(ctx, S, id) {
    const item = (S.list || []).find(x => x.id === id);
    if (!item) return;

    const res = await WujiDialog.show({
      bundlename: BUNDLE,
      title: item.name || '未命名画布',
      content: '要重命名还是删除？',
      buttons: [
        { value: '取消' },
        { value: '重命名' },
        { value: '删除', color: 'var(--wj-danger)' },
      ],
    }).catch(() => null);

    if (res === '删除') {
      const ok = await WujiDialog.show({
        bundlename: BUNDLE,
        title: '删除画布',
        content: `确定删除「${item.name || '未命名画布'}」吗？`,
        buttons: [{ value: '取消' }, { value: '删除', primary: true, color: 'var(--wj-danger)' }],
      }).catch(() => null);
      if (ok !== '删除') return;
      S.list = (S.list || []).filter(x => x.id !== id);
      await saveList(S);
      try { await db().remove?.(ART_KEY(id)); } catch { }
      toast('已删除');
      ctx.nav.reset('home');
      return;
    }

    if (res === '重命名') {
      const out = await WujiDialog.show({
        bundlename: BUNDLE,
        title: '重命名',
        input: { value: item.name || '', placeholder: '输入画布名称' },
        buttons: [
          { value: '取消' },
          {
            value: '确定', primary: true,
            validate(v) {
              const n = String(v ?? '').trim();
              if (!n) return '名称不能为空';
              if (n.length > 30) return '名称不超过 30 个字';
              return '';
            },
          },
        ],
      }).catch(() => null);
      if (!out || typeof out !== 'object' || out.button !== '确定') return;
      const name = String(out.value ?? '').trim();
      if (!name) return;
      const it = (S.list || []).find(x => x.id === id);
      if (!it) return;
      it.name = name;
      it.updatedAt = Date.now();
      await saveList(S);
      ctx.nav.reset('home');
    }
  }
})();
