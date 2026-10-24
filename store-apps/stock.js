(() => {
  const BUNDLE = 'com.wujinb.stock';
  const SYMBOLS = [
    'sh000001',
    'sz399001',
    'sz399006',
    'sz000858',
    'sh600519',
    'sz300750',
  ];
  const POLL_INTERVAL = 5000;
  const MAX_POINTS = 240;
  const PAD_LR = 4;

  const quoteCache = new Map();
  const historyCache = new Map();
  const historyPending = new Map();
  const listeners = new Set();
  let minuteSeq = 0;
  let pollTimer = null;
  let polling = false;
  let activeViews = 0;
  let lastTickOk = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function loadScript(url, charset) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      if (charset) s.setAttribute('charset', charset);
      s.onload = () => { s.remove(); resolve(); };
      s.onerror = () => { s.remove(); reject(new Error('script load failed')); };
      document.head.appendChild(s);
    });
  }

  const num = v => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const fmt = (n, d = 2) =>
    (n == null || !Number.isFinite(Number(n))) ? '--' : Number(n).toFixed(d);

  function fmtVol(v) {
    if (v == null) return '--';
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return '--';
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(2) + '万';
    return String(Math.round(n));
  }

  const changeClass = p => (p > 0 ? 'stk-up' : p < 0 ? 'stk-down' : 'stk-flat');

  const normalizeCode = c => String(c || '').toLowerCase().replace(/^(sh|sz|bj)/, '');

  function fullSymbol(c) {
    const n = normalizeCode(c);
    for (const s of SYMBOLS) if (normalizeCode(s) === n) return s;
    return String(c).toLowerCase();
  }

  function roundRectPath(g, x, y, w, h, r) {
    if (typeof g.roundRect === 'function') {
      g.beginPath();
      g.roundRect(x, y, w, h, r);
      return;
    }
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function parseQuote(symbol, raw) {
    const p = String(raw).split('~');
    if (p.length < 35) return null;
    return {
      symbol,
      name: p[1],
      code: p[2],
      price: num(p[3]),
      prevClose: num(p[4]),
      open: num(p[5]),
      time: p[30],
      change: num(p[31]),
      changePercent: num(p[32]),
      high: num(p[33]),
      low: num(p[34]),
      volume: num(p[36]),
      amount: num(p[37]),
    };
  }

  async function fetchQuotes(symbols) {
    const url = `https://qt.gtimg.cn/q=${symbols.join(',')}&_t=${Date.now()}`;
    await loadScript(url, 'GBK');
    const out = [];
    for (const sym of symbols) {
      const varName = 'v_' + sym;
      const raw = window[varName];
      if (raw) {
        const parsed = parseQuote(sym, raw);
        if (parsed) out.push(parsed);
      }
      try { window[varName] = undefined; } catch { }
    }
    return out;
  }

  async function fetchMinute(symbol) {
    const varName = `__stk_min_${++minuteSeq}`;
    const url =
      `https://web.ifzq.gtimg.cn/appstock/app/minute/query` +
      `?code=${symbol}&_var=${varName}&_t=${Date.now()}`;
    await loadScript(url);

    const data = window[varName];
    try { window[varName] = undefined; } catch { }

    const inner = data && data.data && data.data[symbol] && data.data[symbol].data;
    if (!inner || !Array.isArray(inner.data) || inner.data.length === 0) return null;

    const date = inner.date;
    const preClose = num(inner.prec);
    const points = [];
    let cumVol = 0, cumAmt = 0;

    for (const line of inner.data) {
      const parts = String(line).trim().split(/\s+/);
      if (parts.length < 3) continue;
      const hhmm = parts[0];
      const price = num(parts[1]);
      const vol = num(parts[2]) || 0;
      const amt = num(parts[3]) || 0;
      if (price == null) continue;
      cumVol += vol; cumAmt += amt;
      const avgPrice = (cumVol > 0 && cumAmt > 0) ? cumAmt / (cumVol * 100) : null;
      const timeStr =
        `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)} ` +
        `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
      points.push({ time: timeStr, price, avgPrice, volume: vol });
    }
    if (points.length === 0) return null;

    const uniqPrices = new Set(points.map(p => p.price));
    if (uniqPrices.size <= 1) return null;

    const priceVals = points.map(p => p.price);
    const pMin = Math.min(...priceVals), pMax = Math.max(...priceVals);
    const lo = pMin * 0.9, hi = pMax * 1.1;
    let cumPrice = 0;
    points.forEach((p, i) => {
      cumPrice += p.price;
      const simpleAvg = cumPrice / (i + 1);
      if (p.avgPrice == null || p.avgPrice < lo || p.avgPrice > hi) {
        p.avgPrice = simpleAvg;
      }
    });
    return { preClose, points };
  }

  async function tick() {
    if (polling) return;
    polling = true;
    let ok = false;
    try {
      const quotes = await fetchQuotes(SYMBOLS);
      quotes.forEach(q => {
        const code = normalizeCode(q.symbol || q.code);
        const prev = quoteCache.get(code) || {};
        quoteCache.set(code, { ...prev, ...q, _code: code });

        const hist = historyCache.get(code);
        if (hist && hist.points.length > 0) {
          hist.points[hist.points.length - 1].price = q.price;
          if (q.prevClose > 0) hist.preClose = q.prevClose;
        }
      });
      ok = true;
    } catch (e) {
      console.warn('[stock] tick 失败', e);
    } finally {
      polling = false;
      lastTickOk = ok;
      emit();
    }
  }

  function ensurePolling() {
    activeViews++;
    if (!pollTimer) {
      tick();
      pollTimer = setInterval(tick, POLL_INTERVAL);
    }
  }

  function releasePolling() {
    activeViews = Math.max(0, activeViews - 1);
    if (activeViews === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function emit() {
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function ensureHistory(code) {
    const n = normalizeCode(code);
    if (historyCache.has(n)) return Promise.resolve(historyCache.get(n));
    if (historyPending.has(n)) return historyPending.get(n);

    const p = (async () => {
      try {
        const result = await fetchMinute(fullSymbol(code));
        if (result) {
          historyCache.set(n, result);
          emit();
          return result;
        }
      } catch (e) {
        console.warn(`[stock] ${code} 分时失败`, e);
      } finally {
        historyPending.delete(n);
      }
      return null;
    })();

    historyPending.set(n, p);
    return p;
  }

  function prepareCanvas(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (w < 4 || h < 4) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.round(w * dpr) ||
      canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  function drawSparkline(canvas, points, preClose) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) return;
    const { g, w, h } = ctx;
    if (!points || points.length < 2) return;

    const prices = points.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = (max - min) || 1;
    const padY = 2;
    const innerH = h - padY * 2;
    const x = i => (i / (points.length - 1)) * w;
    const y = v => padY + (1 - (v - min) / range) * innerH;

    const rising = points[points.length - 1].price >= (preClose ?? points[0].price);
    const color = rising ? '#f85149' : '#3fb950';

    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, rising ? 'rgba(248,81,73,.22)' : 'rgba(63,185,80,.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    g.beginPath();
    g.moveTo(x(0), y(points[0].price));
    for (let i = 1; i < points.length; i++) g.lineTo(x(i), y(points[i].price));
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fillStyle = grad;
    g.fill();

    g.beginPath();
    g.moveTo(x(0), y(points[0].price));
    for (let i = 1; i < points.length; i++) g.lineTo(x(i), y(points[i].price));
    g.strokeStyle = color;
    g.lineWidth = 1.2;
    g.lineJoin = 'round';
    g.stroke();
  }

  function drawDetailChart(canvas, points, preClose, crosshair) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) return;
    const { g, w, h } = ctx;

    if (!points || points.length < 2) {
      g.fillStyle = 'rgba(139,148,158,.8)';
      g.font = '12px sans-serif';
      g.textBaseline = 'middle';
      g.fillText('加载中…', 10, h / 2);
      return;
    }

    const padT = 8, padB = 16, gap = 6;
    const volRatio = 0.22;
    const totalH = h - padT - padB;
    const volH = totalH * volRatio;
    const priceH = totalH - volH - gap;
    const volTop = padT + priceH + gap;

    const innerW = w - PAD_LR * 2;
    const x = i => PAD_LR + (i / (points.length - 1)) * innerW;

    const prices = points.map(p => p.price);
    const avgs = points.map(p => p.avgPrice).filter(v => v != null);
    const all = [...prices, ...avgs];
    const rawMin = Math.min(...all);
    const rawMax = Math.max(...all);

    let yMin = rawMin, yMax = rawMax;
    if (preClose != null) {
      const dMax = Math.max(
        Math.abs(rawMax - preClose),
        Math.abs(preClose - rawMin),
        preClose * 0.001
      );
      yMin = preClose - dMax;
      yMax = preClose + dMax;
    }
    const range = yMax - yMin || 1;
    const y = v => padT + (1 - (v - yMin) / range) * priceH;

    const rising = points[points.length - 1].price >= (preClose ?? points[0].price);
    const lineColor = rising ? '#f85149' : '#3fb950';
    const areaColor = rising ? 'rgba(248,81,73,.20)' : 'rgba(63,185,80,.20)';
    const volColor = rising ? 'rgba(248,81,73,.35)' : 'rgba(63,185,80,.35)';

    if (preClose != null) {
      const yPrev = Math.round(y(preClose)) + 0.5;
      g.beginPath();
      g.setLineDash([4, 4]);
      g.strokeStyle = 'rgba(120,120,120,.55)';
      g.lineWidth = 1;
      g.moveTo(PAD_LR, yPrev);
      g.lineTo(w - PAD_LR, yPrev);
      g.stroke();
      g.setLineDash([]);
    }

    const maxVol = Math.max(1, ...points.map(p => p.volume || 0));
    const barW = Math.max(1, (innerW / points.length) * 0.75);
    for (let i = 0; i < points.length; i++) {
      const v = points[i].volume || 0;
      if (!v) continue;
      const bh = (v / maxVol) * volH;
      g.fillStyle = volColor;
      g.fillRect(x(i) - barW / 2, volTop + volH - bh, barW, bh);
    }

    const grad = g.createLinearGradient(0, padT, 0, padT + priceH);
    grad.addColorStop(0, areaColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    g.beginPath();
    g.moveTo(x(0), y(points[0].price));
    for (let i = 1; i < points.length; i++) g.lineTo(x(i), y(points[i].price));
    g.lineTo(x(points.length - 1), padT + priceH);
    g.lineTo(x(0), padT + priceH);
    g.closePath();
    g.fillStyle = grad;
    g.fill();

    g.beginPath();
    g.moveTo(x(0), y(points[0].price));
    for (let i = 1; i < points.length; i++) g.lineTo(x(i), y(points[i].price));
    g.strokeStyle = lineColor;
    g.lineWidth = 1.5;
    g.lineJoin = 'round';
    g.stroke();

    let started = false;
    g.beginPath();
    for (let i = 0; i < points.length; i++) {
      const v = points[i].avgPrice;
      if (v == null) continue;
      if (!started) { g.moveTo(x(i), y(v)); started = true; }
      else g.lineTo(x(i), y(v));
    }
    if (started) {
      g.strokeStyle = 'rgba(227,179,65,.75)';
      g.lineWidth = 1;
      g.stroke();
    }

    const last = points[points.length - 1];
    g.beginPath();
    g.arc(x(points.length - 1), y(last.price), 2.5, 0, Math.PI * 2);
    g.fillStyle = lineColor;
    g.fill();

    g.fillStyle = 'rgba(139,148,158,.9)';
    g.font = '10px ui-monospace, monospace';
    g.textBaseline = 'bottom';
    [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach((idx, n) => {
      const t = points[idx]?.time?.split(' ')[1]?.slice(0, 5) || '';
      if (!t) return;
      const tx = n === 0 ? PAD_LR : n === 2 ? w - PAD_LR : x(idx);
      g.textAlign = n === 0 ? 'left' : n === 2 ? 'right' : 'center';
      g.fillText(t, tx, h - 2);
    });

    if (crosshair != null && crosshair >= 0 && crosshair < points.length) {
      const idx = crosshair;
      const d = points[idx];
      const cx = x(idx);
      const cy = y(d.price);

      const topY = padT;
      const bottomY = h - padB;
      const drawCx = Math.round(cx) + 0.5;
      const drawCy = Math.round(cy) + 0.5;

      g.save();

      /* 深色十字线 */
      g.strokeStyle = 'rgba(45,45,45,0.72)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(drawCx, topY);
      g.lineTo(drawCx, bottomY);
      g.moveTo(PAD_LR, drawCy);
      g.lineTo(w - PAD_LR, drawCy);
      g.stroke();

      /* 交点：深色圆点 + 白描边 */
      g.beginPath();
      g.arc(cx, cy, 4, 0, Math.PI * 2);
      g.fillStyle = '#2d2d2d';
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = '#ffffff';
      g.stroke();

      /* tooltip：时间 + 价格 + 均价 */
      const timeText = d.time.split(' ')[1] || '';
      const pText = `价 ${fmt(d.price)}`;
      const aText = d.avgPrice != null ? `均 ${fmt(d.avgPrice)}` : '';
      const lines = [timeText, pText, aText].filter(Boolean);

      g.font = '10px ui-monospace, monospace';
      const textW = Math.max(...lines.map(t => g.measureText(t).width));
      const boxW = textW + 14;
      const boxH = lines.length * 13 + 10;

      let bx = cx + 10;
      if (bx + boxW > w - PAD_LR) bx = cx - boxW - 10;
      if (bx < PAD_LR) bx = PAD_LR;

      let by = cy - boxH / 2;
      if (by < padT) by = padT;
      if (by + boxH > padT + priceH) by = padT + priceH - boxH;

      g.fillStyle = 'rgba(30,30,30,0.94)';
      roundRectPath(g, bx, by, boxW, boxH, 5);
      g.fill();

      g.fillStyle = '#ffffff';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      lines.forEach((t, i) => {
        g.fillText(t, bx + 7, by + 5 + 6.5 + i * 13);
      });

      g.restore();
    }
  }

  /* =========== 自适应字号辅助 =========== */

  // 可继续缩小的最小字号（px）
  const MIN_META_FONT = 8;

  // 从 CSS 基准字号开始，逐步缩小直到文本放下或到达下限。
  // 若已经处理过，不重复测量。
  function measureAndShrink(el) {
    if (!el) return;

    // 重置回 CSS 基准字号
    el.style.fontSize = '';

    const base = parseFloat(getComputedStyle(el).fontSize) || 14;
    let size = base;

    // scrollWidth > clientWidth 即溢出；+0.5 抵消亚像素舍入
    while (el.scrollWidth > el.clientWidth + 0.5 && size > MIN_META_FONT) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }

  // 文本变化时才重新测量；文本不变不重复操作（避免闪烁和多余 reflow）
  function fitMetaText(el, text) {
    if (!el) return;
    if (el.textContent === text) return;

    el.textContent = text;
    el.style.fontSize = '';

    // 元素尚未完成布局，等下一帧再测
    if (el.clientWidth < 1) {
      requestAnimationFrame(() => {
        if (el.isConnected) measureAndShrink(el);
      });
      return;
    }

    measureAndShrink(el);
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '吴际财富',
    icon: './assets/stock.svg',
    initialRoute: 'home',
    version: '1.1.6',

    styles: `
      .stk-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }

      .stk-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px 4px;
      }
      .stk-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
      }
      .stk-status {
        font-size: 14px;
        color: var(--wj-text-muted);
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 6px;
        border-radius: 8px;
        -webkit-tap-highlight-color: transparent;
      }
      .stk-status:active { background: var(--wj-bg-alt); }
      .stk-status__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--wj-text-dim, #999);
        transition: background .3s;
      }
      .stk-status.live .stk-status__dot {
        background: #f85149;
        box-shadow: 0 0 6px #f85149;
        animation: stk-pulse 2s infinite;
      }
      @keyframes stk-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .4; }
      }

      .stk-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 4px 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .stk-row {
        flex: 0 0 auto;
        background: var(--wj-bg-alt);
        border-radius: 12px;
        padding: 10px 12px 8px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .08s, filter .12s;
      }
      .stk-row:active {
        transform: scale(.985);
        filter: brightness(.94);
      }

      .stk-row__head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 4px;
      }
      .stk-row__name {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
      .stk-name {
        font-size: 18px;
        font-weight: 600;
        color: var(--wj-text);
        line-height: 1.2;
      }
      .stk-code {
        font-size: 14px;
        color: var(--wj-text-dim);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .stk-row__price {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 1px;
      }
      .stk-price {
        font-size: 18px;
        font-weight: 700;
        line-height: 1.15;
        font-variant-numeric: tabular-nums;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        transition: color .4s;
      }
      .stk-change {
        font-size: 14px;
        font-variant-numeric: tabular-nums;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .stk-up { color: #f85149; }
      .stk-down { color: #3fb950; }
      .stk-flat { color: var(--wj-text-dim); }

      .stk-spark {
        display: block;
        width: 100%;
        height: 28px;
        pointer-events: none;
      }

      /* =========== 详情页 =========== */
      .stk-detail {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
      }

      .stk-d-header {
        flex: 0 0 auto;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 14px 4px;
      }

      .stk-d-name-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        padding-top: 2px;
      }
      .stk-d-name {
        font-size: 20px;
        font-weight: 700;
        color: var(--wj-text);
        line-height: 1.15;
        letter-spacing: .2px;
      }
      .stk-d-code {
        font-size: 14px;
        color: var(--wj-text-dim);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .stk-d-price {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .stk-d-price .stk-price { font-size: 22px; }

      .stk-d-chart-wrap {
        flex: 1 1 auto;
        min-height: 0;
        position: relative;
        margin: 4px 10px 0;
      }
      .stk-d-chart-wrap canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
        touch-action: manipulation;
      }

      /* 3 列等分，绝不参差换行 */
      .stk-d-meta {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px 10px;
        padding: 8px 14px 14px;
        font-size: 14px;
        font-variant-numeric: tabular-nums;
      }
      .stk-d-meta > span {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        min-width: 0;
        gap: 4px;
      }
      .stk-d-meta i {
        font-style: normal;
        color: var(--wj-text-dim);
        flex: 0 0 auto;
      }
      .stk-d-meta b {
        font-weight: 500;
        color: var(--wj-text-muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-variant-numeric: tabular-nums;

        font-size: 14px;        /* 基准字号，JS 会在此基础上缩小 */
        line-height: 1.2;

        min-width: 0;
        flex: 0 1 auto;

        /* 单行显示，溢出时由 JS 缩小字号；极端情况才裁 */
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        text-align: right;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="stk-page">
              <div class="stk-header">
                <div class="stk-title">吴际财富</div>
                <div class="stk-status" id="stkStatus">
                  <span class="stk-status__dot"></span>
                  <span id="stkStatusText">初始化…</span>
                </div>
              </div>
              <div class="stk-list" id="stkList"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const listEl = root.querySelector('#stkList');
          const statusEl = root.querySelector('#stkStatus');
          const statusTextEl = root.querySelector('#stkStatusText');

          const rows = new Map();
          let disposed = false;
          let unsub = null;
          let rafId = null;

          function buildRows() {
            SYMBOLS.forEach(sym => {
              const code = normalizeCode(sym);
              if (rows.has(code)) return;

              const row = document.createElement('div');
              row.className = 'stk-row';
              row.dataset.code = code;
              row.innerHTML = `
                <div class="stk-row__head">
                  <div class="stk-row__name">
                    <span class="stk-name" data-k="name">${escapeHtml(sym.toUpperCase())}</span>
                    <span class="stk-code" data-k="code">${escapeHtml(sym.toUpperCase())}</span>
                  </div>
                  <div class="stk-row__price">
                    <span class="stk-price stk-flat" data-k="price">--</span>
                    <span class="stk-change stk-flat" data-k="change">--</span>
                  </div>
                </div>
                <canvas class="stk-spark"></canvas>
              `;
              row.addEventListener('click', () => {
                ctx.push('detail', { code });
              });
              listEl.appendChild(row);

              rows.set(code, {
                el: row,
                nameEl: row.querySelector('[data-k="name"]'),
                codeEl: row.querySelector('[data-k="code"]'),
                priceEl: row.querySelector('[data-k="price"]'),
                changeEl: row.querySelector('[data-k="change"]'),
                canvasEl: row.querySelector('canvas'),
              });
            });
          }

          function renderAll() {
            if (disposed) return;
            rafId = null;

            let anyLive = false;

            rows.forEach((entry, code) => {
              const q = quoteCache.get(code);
              if (q) {
                anyLive = true;
                if (q.name) entry.nameEl.textContent = q.name;
                if (q.symbol) entry.codeEl.textContent = String(q.symbol).toUpperCase();

                const price = q.price;
                const prev = q.prevClose;
                const change = q.change != null
                  ? q.change
                  : (prev ? price - prev : 0);
                const pct = q.changePercent != null
                  ? q.changePercent
                  : (prev ? change / prev * 100 : 0);

                const cls = changeClass(pct);
                entry.priceEl.textContent = fmt(price);
                entry.priceEl.className = `stk-price ${cls}`;
                entry.changeEl.textContent =
                  `${change >= 0 ? '+' : ''}${fmt(change)} ` +
                  `(${pct >= 0 ? '+' : ''}${fmt(pct)}%)`;
                entry.changeEl.className = `stk-change ${cls}`;
              }

              const hist = historyCache.get(code);
              if (hist && hist.points.length >= 2) {
                drawSparkline(entry.canvasEl, hist.points, hist.preClose);
              }
            });

            if (lastTickOk === true && anyLive) {
              statusEl.classList.add('live');
              statusTextEl.textContent =
                `实时 ${new Date().toLocaleTimeString('zh-CN', {
                  hour12: false, hour: '2-digit', minute: '2-digit'
                })}`;
            } else if (lastTickOk === false) {
              statusEl.classList.remove('live');
              statusTextEl.textContent = '获取失败';
            } else {
              statusEl.classList.remove('live');
              statusTextEl.textContent = '获取中…';
            }
          }

          function scheduleRender() {
            if (rafId != null) return;
            rafId = requestAnimationFrame(renderAll);
          }

          function onStatusTap() {
            if (disposed) return;
            statusEl.classList.remove('live');
            statusTextEl.textContent = '刷新中…';
            tick();
          }

          buildRows();
          SYMBOLS.forEach(sym => ensureHistory(sym));
          ensurePolling();
          unsub = subscribe(scheduleRender);
          statusEl.addEventListener('click', onStatusTap);
          scheduleRender();

          return () => {
            disposed = true;
            if (rafId != null) cancelAnimationFrame(rafId);
            if (unsub) unsub();
            statusEl.removeEventListener('click', onStatusTap);
            releasePolling();
          };
        },
      },

      detail: {
        name: 'detail',

        render(routeCtx) {
          const code = normalizeCode(routeCtx.data?.code);
          const sym = fullSymbol(code).toUpperCase();
          return `
            <div class="stk-detail">
              <div class="stk-d-header">
                <div class="stk-d-name-group">
                  <span class="stk-d-name" data-k="name">${escapeHtml(sym)}</span>
                  <span class="stk-d-code" data-k="code">${escapeHtml(sym)}</span>
                </div>
                <div class="stk-d-price">
                  <span class="stk-price stk-flat" data-k="price">--</span>
                  <span class="stk-change stk-flat" data-k="change">--</span>
                </div>
              </div>
              <div class="stk-d-chart-wrap">
                <canvas></canvas>
              </div>
              <div class="stk-d-meta">
                <span><i>开</i><b data-k="open">--</b></span>
                <span><i>高</i><b data-k="high">--</b></span>
                <span><i>低</i><b data-k="low">--</b></span>
                <span><i>昨收</i><b data-k="prev">--</b></span>
                <span><i>量</i><b data-k="vol">--</b></span>
                <span></span>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const code = normalizeCode(ctx.data?.code);
          if (!code) { ctx.pop(); return; }

          const nameEl = root.querySelector('[data-k="name"]');
          const codeEl = root.querySelector('[data-k="code"]');
          const priceEl = root.querySelector('[data-k="price"]');
          const changeEl = root.querySelector('[data-k="change"]');
          const chartEl = root.querySelector('.stk-d-chart-wrap canvas');
          const metaEls = {
            open: root.querySelector('[data-k="open"]'),
            high: root.querySelector('[data-k="high"]'),
            low: root.querySelector('[data-k="low"]'),
            prev: root.querySelector('[data-k="prev"]'),
            vol: root.querySelector('[data-k="vol"]'),
          };

          let disposed = false;
          let unsub = null;
          let rafId = null;
          let crosshair = null;

          function renderAll() {
            if (disposed) return;
            rafId = null;

            const q = quoteCache.get(code);
            if (q) {
              if (q.name) nameEl.textContent = q.name;
              if (q.symbol) codeEl.textContent = String(q.symbol).toUpperCase();

              const price = q.price;
              const prev = q.prevClose;
              const change = q.change != null ? q.change : (prev ? price - prev : 0);
              const pct = q.changePercent != null
                ? q.changePercent
                : (prev ? change / prev * 100 : 0);

              const cls = changeClass(pct);
              priceEl.textContent = fmt(price);
              priceEl.className = `stk-price ${cls}`;
              changeEl.textContent =
                `${change >= 0 ? '+' : ''}${fmt(change)} ` +
                `(${pct >= 0 ? '+' : ''}${fmt(pct)}%)`;
              changeEl.className = `stk-change ${cls}`;

              fitMetaText(metaEls.open, fmt(q.open));
              fitMetaText(metaEls.high, fmt(q.high));
              fitMetaText(metaEls.low, fmt(q.low));
              fitMetaText(metaEls.prev, fmt(q.prevClose));
              fitMetaText(metaEls.vol, fmtVol(q.volume));
            }

            const hist = historyCache.get(code);
            if (hist) {
              drawDetailChart(chartEl, hist.points, hist.preClose, crosshair);
            } else {
              drawDetailChart(chartEl, null, null, null);
            }
          }

          function scheduleRender() {
            if (rafId != null) return;
            rafId = requestAnimationFrame(renderAll);
          }

          function onChartClick(e) {
            const hist = historyCache.get(code);
            if (!hist || hist.points.length < 2) return;

            const rect = chartEl.getBoundingClientRect();
            if (!rect.width) return;

            const px = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1,
              (px - PAD_LR) / Math.max(1, rect.width - PAD_LR * 2)));
            const idx = Math.round(ratio * (hist.points.length - 1));

            crosshair = crosshair === idx ? null : idx;
            scheduleRender();
          }

          chartEl.addEventListener('click', onChartClick);

          // 字体加载完后可能引起宽度变化，重测一次
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
              if (disposed) return;
              Object.values(metaEls).forEach(el => {
                if (el) measureAndShrink(el);
              });
            }).catch(() => {});
          }

          ensureHistory(code);
          ensurePolling();
          unsub = subscribe(scheduleRender);
          scheduleRender();

          return () => {
            disposed = true;
            if (rafId != null) cancelAnimationFrame(rafId);
            if (unsub) unsub();
            chartEl.removeEventListener('click', onChartClick);
            releasePolling();
          };
        },
      },
    },
  });
})();