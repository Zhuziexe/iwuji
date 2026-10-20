(() => {
  const BUNDLE = 'com.niunai.niunairailway';

  // ============================================================
  // 车站数据（stopId + 权威坐标，来自 Transitous geocode）
  // ============================================================
  const STATIONS = {
    '杭州东':   { stopId: 'cn-china-railway_HGH', lat: 30.293549, lon: 120.208206 },
    '杭州南':   { stopId: 'cn-china-railway_XHH', lat: 30.174688, lon: 120.290050 },
    '北京南':   { stopId: 'cn-china-railway_VNP', lat: 39.863483, lon: 116.372400 },
    '北京丰台': { stopId: 'cn-china-railway_FTP', lat: 39.849995, lon: 116.295340 },
    '上海南':   { stopId: 'cn-china-railway_SNH', lat: 31.155012, lon: 121.424880 },
    '上海虹桥': { stopId: 'cn-china-railway_AOH', lat: 31.195978, lon: 121.316200 },
    '成都东':   { stopId: 'cn-china-railway_ICW', lat: 30.631298, lon: 104.138920 },
    '长沙南':   { stopId: 'cn-china-railway_CWQ', lat: 28.150078, lon: 113.059880 },
    '济南西':   { stopId: 'cn-china-railway_JGK', lat: 36.668804, lon: 116.886000 },
    '邵阳北':   { stopId: 'cn-china-railway_OVQ', lat: 27.577555, lon: 111.498980 },
    '南京南':   { stopId: 'cn-china-railway_NKH', lat: 31.970797, lon: 118.793050 },
    '北京西':   { stopId: 'cn-china-railway_BXP', lat: 39.893670, lon: 116.315100 },
    '青岛':     { stopId: 'cn-china-railway_QDK', lat: 36.063100, lon: 120.307460 },
  };

  const STATION_ORDER = Object.keys(STATIONS);
  const PLACEHOLDER = '请选择';

  // ============================================================
  // 拼音站名 → 中文
  // ============================================================
  const STATION_CN = {
    shanghaihongqiao: '上海虹桥',
    beijingfengtai:   '北京丰台',
    beijingnan:       '北京南',
    shanghainan:      '上海南',
    changshanan:      '长沙南',
    hangzhoudong:     '杭州东',
    hangzhounan:      '杭州南',
    jinanxi:          '济南西',
    chengdudong:      '成都东',
    shaoyangbei:      '邵阳北',
  };

  const CITY_CN = {
    hangzhou: '杭州', beijing: '北京', shanghai: '上海',
    changsha: '长沙', chengdu: '成都', tianjin: '天津',
    shaoyang: '邵阳', jinan: '济南', nanjing: '南京',
    suzhou: '苏州', wuxi: '无锡', changzhou: '常州',
    xuzhou: '徐州', zhengzhou: '郑州', wuhan: '武汉',
    hefei: '合肥', nanchang: '南昌', fuzhou: '福州',
    xiamen: '厦门', kunming: '昆明', guiyang: '贵阳',
    nanning: '南宁', qingdao: '青岛', shenyang: '沈阳',
    changchun: '长春', harbin: '哈尔滨', jiaxing: '嘉兴',
    jinhua: '金华', yiwu: '义乌', ningbo: '宁波',
    wenzhou: '温州', shaoxing: '绍兴', huzhou: '湖州',
    quzhou: '衢州', lishui: '丽水', guangzhou: '广州',
    shenzhen: '深圳', zhuhai: '珠海', xian: '西安',
    lanzhou: '兰州', taiyuan: '太原', shijiazhuang: '石家庄',
    zhenjiang: '镇江', yazhou: '亚洲',
    huangshan: '黄山', anqing: '安庆', chizhou: '池州',
    tongling: '铜陵', wuhu: '芜湖', maanshan: '马鞍山',
    chuzhou: '滁州', bengbu: '蚌埠', huaian: '淮安',
    yancheng: '盐城', nantong: '南通', taizhou: '泰州',
    yangzhou: '扬州', chongqing: '重庆', linyi: '临沂',
    weifang: '潍坊', zibo: '淄博', dezhou: '德州',
    liaocheng: '聊城', taian: '泰安', qufu: '曲阜',
    tengzhou: '滕州', zaozhuang: '枣庄', suqian: '宿迁',
  };

  const DIR = { dong: '东', nan: '南', xi: '西', bei: '北' };

  function cnName(name) {
    if (!name) return '';
    const raw = String(name).trim();
    if (!raw) return '';

    if (/[\u4e00-\u9fa5]/.test(raw)) return raw;

    const key = raw.toLowerCase().replace(/[\s\-_.]/g, '');

    if (STATION_CN[key]) return STATION_CN[key];

    for (const d of ['dong', 'nan', 'xi', 'bei']) {
      if (key.length > d.length && key.endsWith(d)) {
        const base = key.slice(0, -d.length);
        if (CITY_CN[base]) return CITY_CN[base] + DIR[d];
      }
    }

    if (CITY_CN[key]) return CITY_CN[key];

    return raw;
  }

  // ============================================================
  // 工具函数
  // ============================================================
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]
    );
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return ''; }
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h > 0) return `${h}小时${m}分`;
    return `${m}分钟`;
  }

  function isWalk(leg) {
    return (leg.mode || '').toUpperCase() === 'WALK';
  }

  function modeVisual(mode) {
    const m = (mode || '').toUpperCase();
    if (m === 'WALK' || m === 'WALKING')           return { icon: '🚶' };
    if (m === 'BUS' || m === 'COACH')              return { icon: '🚌' };
    if (m === 'TRAM')                              return { icon: '🚋' };
    if (m === 'SUBWAY' || m === 'METRO')           return { icon: '🚇' };
    if (m.includes('RAIL') || m.includes('TRAIN')) return { icon: '🚆' };
    if (m === 'FERRY')                             return { icon: '⛴️' };
    return { icon: '➡️' };
  }

  function modeLabel(mode) {
    const m = (mode || '').toUpperCase();
    if (m.includes('RAIL') || m.includes('TRAIN')) return '火车';
    if (m === 'SUBWAY' || m === 'METRO')           return '地铁';
    if (m === 'BUS' || m === 'COACH')              return '公交';
    if (m === 'TRAM')                              return '有轨电车';
    if (m === 'FERRY')                             return '轮渡';
    if (m === 'WALK')                              return '步行';
    return mode || '交通';
  }

  // ============================================================
  // Transitous 查询
  //   裸 stopId 优先 → 坐标兜底
  // ============================================================
  async function planOnce(fromPlace, toPlace) {
    const url = new URL('https://api.transitous.org/api/v6/plan');
    url.searchParams.set('fromPlace', fromPlace);
    url.searchParams.set('toPlace',   toPlace);
    url.searchParams.set('numItineraries', '6');

    const resp = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    return resp.json();
  }

  function hasCoord(s) {
    return typeof s.lat === 'number' && typeof s.lon === 'number'
      && s.lat !== 0 && s.lon !== 0;
  }

  async function queryRoutes(fromName, toName) {
    const from = STATIONS[fromName];
    const to   = STATIONS[toName];
    if (!from || !to) throw new Error('车站数据缺失');

    const candidates = [];
    if (from.stopId && to.stopId) {
      candidates.push([from.stopId, to.stopId]);
    }
    if (hasCoord(from) && hasCoord(to)) {
      candidates.push([`${from.lat},${from.lon}`, `${to.lat},${to.lon}`]);
    }

    if (!candidates.length) throw new Error('车站坐标缺失');

    let lastErr = null;

    for (const [fp, tp] of candidates) {
      try {
        const data = await planOnce(fp, tp);
        const list = (data.itineraries || []).filter(itin =>
          (itin.legs || []).some(leg => !isWalk(leg))
        );
        if (list.length) return list;
      } catch (e) {
        lastErr = e;
      }
    }

    if (lastErr) throw lastErr;
    return [];
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '牛奶铁路',
    icon: './assets/niunairailway.svg',
    initialRoute: 'home',
    version: '1.0.4',

    styles: `
      .rail-page {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: calc(var(--wj-pad) + var(--statusbar-h)) 16px 24px;
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .rail-title {
        font-size: 22px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .5px;
        margin-top: 4px;
      }

      .rail-subtitle {
        font-size: 15px;
        color: var(--wj-text-muted);
        margin-top: -8px;
        letter-spacing: .3px;
        line-height: 1.5;
      }

      .rail-picker {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 18px;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        cursor: pointer;
        transition: background .15s, transform .08s;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .rail-picker:active {
        transform: scale(.99);
        background: #dae2f0;
      }
      .rail-picker__label {
        flex: 0 0 auto;
        font-size: 17px;
        font-weight: 600;
        color: var(--wj-text);
      }
      .rail-picker__value {
        flex: 1 1 auto;
        font-size: 17px;
        color: var(--wj-text);
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rail-picker__value.is-empty {
        color: var(--wj-text-dim);
      }

      .rail-btn {
        margin-top: 8px;
        width: 100%;
        padding: 16px;
        border: 0;
        border-radius: 999px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        transition: transform .08s, opacity .15s, background .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .rail-btn:active:not(:disabled) { transform: scale(.98); }
      .rail-btn:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .rail-error {
        text-align: center;
        font-size: 15px;
        font-weight: 500;
        color: var(--wj-danger, #e0356b);
        min-height: 20px;
        letter-spacing: .3px;
      }

      .rail-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .rail-station {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px 6px;
        border: 0;
        border-radius: 12px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 17px;
        font-weight: 500;
        cursor: pointer;
        transition: transform .08s, background .15s, color .15s;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .rail-station:active {
        transform: scale(.96);
        background: #dae2f0;
      }
      .rail-station.is-active {
        background: rgba(58, 111, 240, .12);
        color: var(--wj-primary, #3a6ff0);
        font-weight: 600;
      }

      .rail-end {
        text-align: center;
        font-size: 13px;
        color: var(--wj-text-dim);
        padding: 18px 0 6px;
        letter-spacing: .5px;
      }

      .rail-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 60px 16px 40px;
      }
      .rail-loading[hidden] { display: none !important; }

      .rail-loading__img {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        animation: rail-spin 2s linear infinite;
      }

      .rail-loading__text {
        font-size: 17px;
        color: var(--wj-text-muted);
        letter-spacing: .5px;
      }

      @keyframes rail-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }

      .rail-result-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .rail-result-body[hidden] { display: none !important; }

      .rail-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 16px 18px;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        cursor: pointer;
        transition: transform .08s, background .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .rail-card:active {
        transform: scale(.99);
        background: #dae2f0;
      }
      .rail-card__times {
        font-size: 20px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: -.3px;
      }
      .rail-card__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        color: var(--wj-text-muted);
        flex-wrap: wrap;
      }
      .rail-card__dur {
        color: var(--wj-primary, #3a6ff0);
        font-weight: 600;
      }
      .rail-card__routes {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 2px;
      }
      .rail-card__tag {
        display: inline-flex;
        align-items: center;
        padding: 4px 11px;
        border-radius: 999px;
        background: rgba(58, 111, 240, .10);
        color: var(--wj-primary, #3a6ff0);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: .3px;
      }

      .rail-legs {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .rail-leg {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 16px 18px;
        border-radius: 14px;
        background: var(--wj-bg-alt);
      }
      .rail-leg__head {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .rail-leg__icon {
        flex: 0 0 34px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
      }
      .rail-leg__content {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .rail-leg__route {
        font-size: 17px;
        font-weight: 600;
        color: var(--wj-text);
      }
      .rail-leg__time {
        font-size: 14px;
        color: var(--wj-text-muted);
        letter-spacing: .3px;
      }
      .rail-leg__stops {
        position: relative;
        padding-left: 46px;
      }
      .rail-leg__stops::before {
        content: '';
        position: absolute;
        left: 16px;
        top: 8px;
        bottom: 8px;
        width: 2px;
        background: var(--wj-border, #e6e9ef);
        border-radius: 1px;
      }
      .rail-stop {
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding: 6px 0;
        font-size: 15px;
        color: var(--wj-text-muted);
        position: relative;
      }
      .rail-stop::before {
        content: '';
        position: absolute;
        left: -34px;
        top: 50%;
        transform: translateY(-50%);
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid var(--wj-border, #e6e9ef);
        box-sizing: border-box;
      }
      .rail-stop--endpoint {
        color: var(--wj-text);
        font-weight: 600;
      }
      .rail-stop--endpoint::before {
        background: var(--wj-primary, #3a6ff0);
        border-color: var(--wj-primary, #3a6ff0);
      }
      .rail-stop__time {
        flex: 0 0 auto;
        min-width: 48px;
        font-variant-numeric: tabular-nums;
        color: var(--wj-text-dim);
      }
      .rail-stop--endpoint .rail-stop__time {
        color: var(--wj-primary, #3a6ff0);
      }
      .rail-stop__name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rail-empty {
        text-align: center;
        padding: 40px 16px;
        color: var(--wj-text-muted);
        font-size: 16px;
        line-height: 1.6;
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="rail-page">
              <div class="rail-title">牛奶铁路</div>

              <div class="rail-picker" data-target="from">
                <span class="rail-picker__label">起点</span>
                <span class="rail-picker__value is-empty" id="railFromValue">${PLACEHOLDER}</span>
              </div>

              <div class="rail-picker" data-target="to">
                <span class="rail-picker__label">终点</span>
                <span class="rail-picker__value is-empty" id="railToValue">${PLACEHOLDER}</span>
              </div>

              <button class="rail-btn" id="railQueryBtn" type="button">查询路线</button>
              <div class="rail-error" id="railError"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const fromValue = root.querySelector('#railFromValue');
          const toValue   = root.querySelector('#railToValue');
          const queryBtn  = root.querySelector('#railQueryBtn');
          const errorEl   = root.querySelector('#railError');

          function readValue(el) {
            const t = (el.textContent || '').trim();
            return t === PLACEHOLDER ? '' : t;
          }

          function writeValue(el, name) {
            el.textContent = name || PLACEHOLDER;
            el.classList.toggle('is-empty', !name);
          }

          root.querySelectorAll('.rail-picker').forEach(el => {
            el.addEventListener('click', () => {
              const target = el.dataset.target;
              const current = readValue(target === 'from' ? fromValue : toValue);

              ctx.push('select', { target, current }, {
                onResult: (name) => {
                  if (!name) return;
                  writeValue(target === 'from' ? fromValue : toValue, name);
                },
              });
            });
          });

          queryBtn.addEventListener('click', () => {
            errorEl.textContent = '';

            const from = readValue(fromValue);
            const to   = readValue(toValue);

            if (!from) { errorEl.textContent = '请选择起点'; return; }
            if (!to)   { errorEl.textContent = '请选择终点'; return; }
            if (from === to) {
              errorEl.textContent = '起点和终点不能相同';
              return;
            }

            ctx.push('result', { fromName: from, toName: to });
          });
        },
      },

      select: {
        name: 'select',

        render(routeCtx) {
          const current = routeCtx.data?.current || '';

          const cells = STATION_ORDER.map(name => `
            <button class="rail-station${name === current ? ' is-active' : ''}"
                    data-name="${esc(name)}" type="button">${esc(name)}</button>
          `).join('');

          return `
            <div class="rail-page">
              <div class="rail-title">选择车站</div>
              <div class="rail-grid">${cells}</div>
              <div class="rail-end">没有更多了</div>
            </div>
          `;
        },

        mount(root, ctx) {
          root.querySelectorAll('.rail-station').forEach(el => {
            el.addEventListener('click', () => {
              ctx.pop(el.dataset.name);
            });
          });
        },
      },

      result: {
        name: 'result',

        render(routeCtx) {
          const fromName = routeCtx.data?.fromName || '';
          const toName   = routeCtx.data?.toName   || '';

          return `
            <div class="rail-page">
              <div class="rail-title">查询结果</div>
              <div class="rail-subtitle">${esc(fromName)} → ${esc(toName)}</div>

              <div class="rail-loading" id="railLoading">
                <img class="rail-loading__img"
                     src="./assets/com.niunai.niunairailway/loading.png"
                     alt="">
                <div class="rail-loading__text">加载中</div>
              </div>

              <div class="rail-result-body" id="railResultBody" hidden></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const fromName  = ctx.data?.fromName || '';
          const toName    = ctx.data?.toName   || '';
          const loadingEl = root.querySelector('#railLoading');
          const bodyEl    = root.querySelector('#railResultBody');

          let cancelled = false;

          (async () => {
            let list = [];
            let err  = null;

            try {
              list = await queryRoutes(fromName, toName);
            } catch (e) {
              err = e;
            }

            if (cancelled || !root.isConnected) return;

            loadingEl.hidden = true;

            if (err) {
              console.error('[railway] query failed', err);
              bodyEl.innerHTML = `<div class="rail-empty">查询失败：${esc(err.message || '网络错误')}</div>`;
              bodyEl.hidden = false;
              return;
            }

            if (!list.length) {
              bodyEl.innerHTML = '<div class="rail-empty">未找到可用路线，请稍后再试</div>';
              bodyEl.hidden = false;
              return;
            }

            bodyEl.innerHTML = list.map((itin, idx) => {
              const startTime = formatTime(itin.startTime) || '—';
              const endTime   = formatTime(itin.endTime)   || '—';
              const duration  = formatDuration(itin.duration);
              const transfers = itin.transfers || 0;

              const tags = (itin.legs || [])
                .filter(leg => !isWalk(leg))
                .map(leg => {
                  const name = leg.routeShortName || leg.routeLongName || leg.route || modeLabel(leg.mode);
                  return `<span class="rail-card__tag">${esc(name)}</span>`;
                })
                .join('');

              return `
                <div class="rail-card" data-idx="${idx}">
                  <div class="rail-card__times">${startTime} → ${endTime}</div>
                  <div class="rail-card__meta">
                    ${duration ? `<span class="rail-card__dur">${duration}</span>` : ''}
                    <span>${transfers} 次换乘</span>
                  </div>
                  <div class="rail-card__routes">${tags}</div>
                </div>
              `;
            }).join('');

            bodyEl.hidden = false;

            bodyEl.querySelectorAll('.rail-card').forEach(el => {
              el.addEventListener('click', () => {
                const idx = +el.dataset.idx;
                const itin = list[idx];
                if (!itin) return;

                ctx.push('detail', {
                  itinerary: itin,
                  fromName,
                  toName,
                });
              });
            });
          })();

          return () => { cancelled = true; };
        },
      },

      detail: {
        name: 'detail',

        render(routeCtx) {
          const itin     = routeCtx.data?.itinerary;
          const fromName = routeCtx.data?.fromName || '';
          const toName   = routeCtx.data?.toName   || '';

          if (!itin) {
            return `
              <div class="rail-page">
                <div class="rail-title">方案详情</div>
                <div class="rail-empty">方案数据缺失</div>
              </div>
            `;
          }

          const startTime = formatTime(itin.startTime) || '—';
          const endTime   = formatTime(itin.endTime)   || '—';
          const duration  = formatDuration(itin.duration);

          const metaLine = [startTime + ' → ' + endTime, duration]
            .filter(Boolean).join(' · ');

          const legs = (itin.legs || []).filter(leg => !isWalk(leg));

          const legsHtml = legs.map((leg, legIdx) => {
            const { icon }  = modeVisual(leg.mode);
            const routeName = leg.routeShortName || leg.routeLongName || leg.route || modeLabel(leg.mode);
            const legStart  = formatTime(leg.startTime);
            const legEnd    = formatTime(leg.endTime);
            const legDur    = formatDuration(leg.duration);

            const timeLine = [legStart, legEnd].filter(Boolean).join(' - ');
            const timeText = [timeLine, legDur].filter(Boolean).join(' · ');

            const isFirst = legIdx === 0;
            const isLast  = legIdx === legs.length - 1;
            const fromSt  = isFirst ? fromName : cnName(leg.from?.name);
            const toSt    = isLast  ? toName   : cnName(leg.to?.name);

            const stops = (leg.intermediateStops || []).map(s => {
              const t = formatTime(s.arrival) || formatTime(s.departure);
              return `
                <div class="rail-stop">
                  <span class="rail-stop__time">${esc(t)}</span>
                  <span class="rail-stop__name">${esc(cnName(s.name || ''))}</span>
                </div>
              `;
            }).join('');

            return `
              <div class="rail-leg">
                <div class="rail-leg__head">
                  <div class="rail-leg__icon">${icon}</div>
                  <div class="rail-leg__content">
                    <div class="rail-leg__route">${esc(routeName)}</div>
                    ${timeText ? `<div class="rail-leg__time">${esc(timeText)}</div>` : ''}
                  </div>
                </div>
                <div class="rail-leg__stops">
                  <div class="rail-stop rail-stop--endpoint">
                    <span class="rail-stop__time">${esc(legStart)}</span>
                    <span class="rail-stop__name">${esc(fromSt)}</span>
                  </div>
                  ${stops}
                  <div class="rail-stop rail-stop--endpoint">
                    <span class="rail-stop__time">${esc(legEnd)}</span>
                    <span class="rail-stop__name">${esc(toSt)}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('');

          return `
            <div class="rail-page">
              <div class="rail-title">方案详情</div>
              <div class="rail-subtitle">${esc(fromName)} → ${esc(toName)}<br />${esc(metaLine)}</div>
              <div class="rail-legs">
                ${legs.length ? legsHtml : '<div class="rail-empty">该方案没有可用路段</div>'}
              </div>
            </div>
          `;
        },
      },
    },
  });
})();