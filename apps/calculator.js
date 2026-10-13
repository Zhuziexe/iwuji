WujiApps.register({
  bundlename: 'com.wujios.calculator',
  name: '计算器',
  icon: './assets/calculator.svg',
  initialRoute: 'calc',

  styles: `
    /* ---------------- 页面骨架 ---------------- */
    .calc-page {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: var(--wj-bg, #fff);
      padding-top: var(--statusbar-h, 26px);
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }

    /* ---------------- 显示区（更紧凑） ---------------- */
    .calc-display {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: flex-end;
      gap: 2px;
      padding: 4px 16px 8px;
      overflow: hidden;
    }

    .calc-expr {
      font-size: 14px;
      line-height: 1.15;
      font-weight: 600;
      color: var(--wj-text-dim, #9aa4b8);
      letter-spacing: .3px;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-variant-numeric: tabular-nums;
    }
    .calc-expr:empty { display: none; }

    .calc-value {
      font-size: 60px;          /* 实际由 JS 动态计算 */
      font-weight: 700;         /* 加粗 */
      line-height: 1.04;
      color: var(--wj-text, #101828);
      letter-spacing: -.5px;
      font-variant-numeric: tabular-nums;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      transition: color .15s ease;
    }
    .calc-value.is-error {
      color: var(--wj-danger, #e0356b);
      font-weight: 700;
    }

    /* ---------------- 键盘：更大按钮、更小间距 ---------------- */
    .calc-pad {
      flex: 0 0 auto;
      height: clamp(280px, 48vh, 380px);
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: repeat(5, minmax(0, 1fr));
      gap: 6px;
      padding: 6px 8px calc(10px + env(safe-area-inset-bottom, 0px));
      box-sizing: border-box;
    }

    .calc-key {
      border: 0;
      border-radius: 16px;
      background: var(--wj-bg-alt, #eef1f6);
      color: var(--wj-text, #101828);
      font: inherit;
      font-size: 28px;          /* 更大 */
      font-weight: 700;         /* 加粗 */
      letter-spacing: .2px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      min-height: 0;
      cursor: pointer;
      transition: transform .08s ease, background .12s ease, color .12s ease, box-shadow .12s ease;
      -webkit-tap-highlight-color: transparent;
      -webkit-user-select: none;
      user-select: none;
    }
    .calc-key:active { transform: scale(.94); }

    .calc-key--fn {
      color: var(--wj-text-muted, #5b6478);
      font-size: 23px;
      font-weight: 700;
    }

    .calc-key--op,
    .calc-key--eq {
      background: #3a6ff0;
      color: #fff;
      font-size: 30px;
      font-weight: 700;
    }
    .calc-key--op:active,
    .calc-key--eq:active { background: #2c5ad0; }

    .calc-key--op.is-active {
      background: var(--wj-bg, #fff);
      color: #3a6ff0;
      box-shadow: inset 0 0 0 2.5px #3a6ff0;
    }

    .calc-key--wide { grid-column: span 2; }
  `,

  routes: {
    calc: {
      name: 'calc',
      _cleanup: null,

      render() {
        return `
          <div class="calc-page">
            <div class="calc-display" id="calcDisplay">
              <div class="calc-expr" id="calcExpr"></div>
              <div class="calc-value" id="calcValue">0</div>
            </div>

            <div class="calc-pad" id="calcPad">
              <button class="calc-key calc-key--fn" data-act="clear"   type="button">AC</button>
              <button class="calc-key calc-key--fn" data-act="sign"    type="button">±</button>
              <button class="calc-key calc-key--fn" data-act="percent" type="button">%</button>
              <button class="calc-key calc-key--op" data-op="÷"        type="button">÷</button>

              <button class="calc-key" data-digit="7" type="button">7</button>
              <button class="calc-key" data-digit="8" type="button">8</button>
              <button class="calc-key" data-digit="9" type="button">9</button>
              <button class="calc-key calc-key--op" data-op="×" type="button">×</button>

              <button class="calc-key" data-digit="4" type="button">4</button>
              <button class="calc-key" data-digit="5" type="button">5</button>
              <button class="calc-key" data-digit="6" type="button">6</button>
              <button class="calc-key calc-key--op" data-op="−" type="button">−</button>

              <button class="calc-key" data-digit="1" type="button">1</button>
              <button class="calc-key" data-digit="2" type="button">2</button>
              <button class="calc-key" data-digit="3" type="button">3</button>
              <button class="calc-key calc-key--op" data-op="+" type="button">+</button>

              <button class="calc-key calc-key--wide" data-digit="0" type="button">0</button>
              <button class="calc-key" data-act="dot"    type="button">.</button>
              <button class="calc-key calc-key--eq" data-act="equals" type="button">=</button>
            </div>
          </div>
        `;
      },

      mount(root) {
        const displayEl = root.querySelector('#calcDisplay');
        const valueEl   = root.querySelector('#calcValue');
        const exprEl    = root.querySelector('#calcExpr');
        const padEl     = root.querySelector('#calcPad');

        /* ---------------- 状态 ---------------- */
        const S = {
          current: '0',
          stored: null,
          op: null,
          overwrite: true,
          expr: '',
          error: false,
        };

        /* ---------------- 数值格式化 ---------------- */
        function fmt(n) {
          if (typeof n !== 'number' || !isFinite(n)) return null;
          const abs = Math.abs(n);
          if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
            return n.toExponential(8)
              .replace(/\.?0+e/, 'e')
              .replace('e+', 'e');
          }
          return String(parseFloat(n.toPrecision(13)));
        }

        function displayText(s) {
          if (s === '错误' || s.includes('e') || s.includes('E')) return s;
          const neg  = s.startsWith('-');
          const body = neg ? s.slice(1) : s;
          const dot  = body.indexOf('.');
          const int  = dot === -1 ? body : body.slice(0, dot);
          const dec  = dot === -1 ? ''   : body.slice(dot);
          const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          return (neg ? '-' : '') + grouped + dec;
        }

        /* ---------------- 字号自适应 ---------------- */
        function fit(text) {
          const len = Math.max(1, text.length);

          const availH = displayEl.clientHeight
                       - 12
                       - (S.expr ? 18 : 0);
          const availW = displayEl.clientWidth - 32;

          if (availH <= 0 || availW <= 0) return;

          const byH = availH / 1.04;
          const byW = availW / (len * 0.62);   /* 粗体略宽 */

          const size = Math.max(22, Math.min(64, byH, byW));
          valueEl.style.fontSize = size.toFixed(1) + 'px';
        }

        /* ---------------- 渲染 ---------------- */
        function update() {
          const text = displayText(S.current);
          valueEl.textContent = text;
          valueEl.classList.toggle('is-error', S.error);
          exprEl.textContent = S.expr || '';

          padEl.querySelectorAll('[data-op]').forEach(el => {
            el.classList.toggle(
              'is-active',
              S.op !== null && S.overwrite && el.dataset.op === S.op
            );
          });

          fit(text);
        }

        /* ---------------- 运算 ---------------- */
        function compute(a, b, op) {
          let r;
          switch (op) {
            case '+': r = a + b; break;
            case '−': r = a - b; break;
            case '×': r = a * b; break;
            case '÷': r = b === 0 ? null : a / b; break;
            default:  r = b;
          }
          if (r === null || !isFinite(r)) return null;
          return r;
        }

        function resetAll() {
          S.current   = '0';
          S.stored    = null;
          S.op        = null;
          S.overwrite = true;
          S.expr      = '';
          S.error     = false;
        }

        function fail() {
          resetAll();
          S.current = '错误';
          S.error   = true;
          if (navigator.vibrate) { try { navigator.vibrate([40, 60, 40]); } catch (e) {} }
          update();
        }

        /* ---------------- 输入处理 ---------------- */
        function inputDigit(d) {
          if (S.error) resetAll();

          if (S.overwrite) {
            if (S.op === null) S.expr = '';
            S.current   = d;
            S.overwrite = false;
          } else if (S.current === '0') {
            S.current = d;
          } else if (S.current.replace(/[-.]/g, '').length < 15) {
            S.current += d;
          }
          update();
        }

        function inputDot() {
          if (S.error) resetAll();

          if (S.overwrite) {
            if (S.op === null) S.expr = '';
            S.current   = '0.';
            S.overwrite = false;
          } else if (!S.current.includes('.')) {
            S.current += '.';
          }
          update();
        }

        function inputOp(op) {
          if (S.error) return;

          const value = parseFloat(S.current);

          if (S.op !== null && !S.overwrite) {
            const r = compute(S.stored, value, S.op);
            if (r === null) return fail();
            S.stored  = r;
            S.current = fmt(r);
          } else if (S.stored === null) {
            S.stored = value;
          }

          S.op        = op;
          S.overwrite = true;
          S.expr      = `${fmt(S.stored)} ${op}`;
          update();
        }

        /* 计算完成：清空上面那行表达式 */
        function doEquals() {
          if (S.error) return;
          if (S.op === null || S.stored === null) return;

          const value = parseFloat(S.current);
          const r = compute(S.stored, value, S.op);
          if (r === null) return fail();

          S.expr      = '';
          S.current   = fmt(r);
          S.stored    = null;
          S.op        = null;
          S.overwrite = true;
          update();
        }

        function toggleSign() {
          if (S.error) return;
          if (S.current === '0') return;

          S.current = S.current.startsWith('-')
            ? S.current.slice(1)
            : '-' + S.current;
          update();
        }

        function toPercent() {
          if (S.error) return;

          const r = compute(parseFloat(S.current), 100, '÷');
          if (r === null) return fail();

          S.current   = fmt(r);
          S.overwrite = true;
          update();
        }

        function backspace() {
          if (S.error) { resetAll(); update(); return; }

          if (S.overwrite) {
            S.current = '0';
            update();
            return;
          }

          const s = S.current;
          if (s.length <= 1 || (s.length === 2 && s.startsWith('-'))) {
            S.current   = '0';
            S.overwrite = true;
          } else {
            S.current = s.slice(0, -1);
          }
          update();
        }

        /* ---------------- 事件 ---------------- */
        function onPadClick(e) {
          const key = e.target.closest('.calc-key');
          if (!key) return;

          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }

          if (key.dataset.digit !== undefined) return inputDigit(key.dataset.digit);
          if (key.dataset.op)                  return inputOp(key.dataset.op);

          switch (key.dataset.act) {
            case 'dot':     inputDot();            break;
            case 'clear':   resetAll(); update();  break;
            case 'sign':    toggleSign();          break;
            case 'percent': toPercent();           break;
            case 'equals':  doEquals();            break;
          }
        }

        function onKeydown(e) {
          const os = document.getElementById('os');
          if (!os || os.dataset.view !== 'app') return;
          if (!root.isConnected) return;

          const k = e.key;

          if (/^\d$/.test(k))                    inputDigit(k);
          else if (k === '.' || k === ',')       inputDot();
          else if (k === '+')                    inputOp('+');
          else if (k === '-')                    inputOp('−');
          else if (k === '*' || k.toLowerCase() === 'x') inputOp('×');
          else if (k === '/')                    inputOp('÷');
          else if (k === 'Enter' || k === '=')   doEquals();
          else if (k === 'Backspace')            backspace();
          else if (k === 'Escape' || k === 'Delete') { resetAll(); update(); }
          else if (k === '%')                    toPercent();
          else return;

          e.preventDefault();
        }

        function onResize() { update(); }

        padEl.addEventListener('click', onPadClick);
        window.addEventListener('keydown', onKeydown);
        window.addEventListener('resize', onResize);

        this._cleanup = () => {
          padEl.removeEventListener('click', onPadClick);
          window.removeEventListener('keydown', onKeydown);
          window.removeEventListener('resize', onResize);
        };

        update();
      },

      unmount() {
        this._cleanup?.();
        this._cleanup = null;
      },
    },
  },
});