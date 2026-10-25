/* =========================================================
   天气 —— Open-Meteo（无需 API Key）
   路由：
     home      → 当前天气 + 空气质量
     forecast  → 未来 7 天
     city      → 选择城市
   缓存：30 分钟；手动刷新间隔 5 分钟；超过 5 分钟自动刷新
        最多保留 3 个城市的缓存（LRU + TTL）
   数据存储：AppStorage（IndexedDB），按包名隔离
   ========================================================= */
(() => {
  const CACHE_TTL         = 30 * 60 * 1000;
  const REFRESH_GAP       = 5  * 60 * 1000;
  const FORECAST_DAYS     = 7;
  const DEFAULT_CITY      = '杭州';
  const BUNDLE            = 'com.wujios.weather';
  const MAX_CACHED_CITIES = 3;

  const CITIES = [
    { name: '杭州', lat: 30.2741, lon: 120.1551 },
    { name: '北京', lat: 39.9042, lon: 116.4074 },
    { name: '上海', lat: 31.2304, lon: 121.4737 },
    { name: '广州', lat: 23.1291, lon: 113.2644 },
    { name: '深圳', lat: 22.5431, lon: 114.0579 },
    { name: '成都', lat: 30.5728, lon: 104.0668 },
    { name: '武汉', lat: 30.5928, lon: 114.3055 },
    { name: '西安', lat: 34.3416, lon: 108.9398 },
    { name: '南京', lat: 32.0603, lon: 118.7969 },
    { name: '重庆', lat: 29.5630, lon: 106.5516 },
    { name: '天津', lat: 39.3434, lon: 117.3616 },
    { name: '苏州', lat: 31.2989, lon: 120.5853 },
    { name: '青岛', lat: 36.0671, lon: 120.3826 },
    { name: '厦门', lat: 24.4798, lon: 118.0894 },
    { name: '长沙', lat: 28.2282, lon: 112.9388 },
    { name: '郑州', lat: 34.7466, lon: 113.6253 },
    { name: '香港', lat: 22.3193, lon: 114.1694 },
    { name: '台北', lat: 25.0330, lon: 121.5654 },
    { name: '东京', lat: 35.6762, lon: 139.6503 },
    { name: '纽约', lat: 40.7128, lon: -74.0060 },
    { name: '伦敦', lat: 51.5074, lon: -0.1278 },
  ];

  const WEATHER_MAP = {
    0:  ['晴',               '☀️'],
    1:  ['基本晴朗',         '🌤️'],
    2:  ['局部多云',         '⛅'],
    3:  ['阴',               '☁️'],
    45: ['雾',               '🌫️'],
    48: ['雾凇',             '🌫️'],
    51: ['小毛毛雨',         '🌦️'],
    53: ['毛毛雨',           '🌦️'],
    55: ['大毛毛雨',         '🌧️'],
    56: ['冻毛毛雨',         '🌧️'],
    57: ['强冻毛毛雨',       '🌧️'],
    61: ['小雨',             '🌧️'],
    63: ['中雨',             '🌧️'],
    65: ['大雨',             '⛈️'],
    66: ['冻雨',             '🌧️'],
    67: ['强冻雨',           '🌧️'],
    71: ['小雪',             '🌨️'],
    73: ['中雪',             '🌨️'],
    75: ['大雪',             '❄️'],
    77: ['雪粒',             '🌨️'],
    80: ['阵雨',             '🌦️'],
    81: ['中阵雨',           '🌧️'],
    82: ['强阵雨',           '⛈️'],
    85: ['阵雪',             '🌨️'],
    86: ['强阵雪',           '❄️'],
    95: ['雷阵雨',           '⛈️'],
    96: ['雷阵雨伴冰雹',     '⛈️'],
    99: ['强雷阵雨伴冰雹', '⛈️'],
  };

  /* ---------- 空气质量分级 ---------- */
  function aqiLevel(aqi) {
    if (aqi <= 50)  return { label: '优',       color: '#34c759' };
    if (aqi <= 100) return { label: '良',       color: '#ffb800' };
    if (aqi <= 150) return { label: '轻度污染', color: '#ff9500' };
    if (aqi <= 200) return { label: '中度污染', color: '#e0356b' };
    if (aqi <= 300) return { label: '重度污染', color: '#8e44ad' };
    return                  { label: '严重污染', color: '#7a2048' };
  }

  function heroGradient(code) {
    if (code === 0 || code === 1)
      return 'linear-gradient(165deg, #5b8dff 0%, #3a5fd0 100%)';
    if (code === 2 || code === 3)
      return 'linear-gradient(165deg, #8aa7d6 0%, #516ba0 100%)';
    if (code === 45 || code === 48)
      return 'linear-gradient(165deg, #a0aabb 0%, #5f6e84 100%)';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
      return 'linear-gradient(165deg, #4e7fbf 0%, #29487e 100%)';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86)
      return 'linear-gradient(165deg, #8fbde0 0%, #4c7cab 100%)';
    if (code >= 95)
      return 'linear-gradient(165deg, #647096 0%, #333c58 100%)';
    return 'linear-gradient(165deg, #5b8dff 0%, #3a5fd0 100%)';
  }

  let weatherData       = null;
  let cooldownTimer     = null;
  let autoRefreshTimer  = null;
  let loading           = false;
  let lastKnownCity     = DEFAULT_CITY;

  function weatherCode(code) {
    const [text, icon] = WEATHER_MAP[code] || ['未知', '❓'];
    return { text, icon };
  }
  function dayName(dateStr, i) {
    if (i === 0) return '今天';
    if (i === 1) return '明天';
    if (i === 2) return '后天';
    const d = new Date(dateStr + 'T00:00:00');
    return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  }
  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /* ---------- 并行拉天气 + 空气质量 ---------- */
  async function fetchWeather(city) {
    const params = new URLSearchParams({
      latitude:  city.lat,
      longitude: city.lon,
      current:   'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code',
      daily:     'weather_code,temperature_2m_max,temperature_2m_min',
      timezone:  'auto',
      forecast_days: String(FORECAST_DAYS),
    });

    const airUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=us_aqi,pm2_5,pm10,european_aqi&timezone=auto`;

    /* 并行请求；空气质量失败不影响天气主流程 */
    const [weatherRes, airRes] = await Promise.allSettled([
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
      fetch(airUrl),
    ]);

    if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) {
      throw new Error('weather fetch failed');
    }

    const weatherJson = await weatherRes.value.json();

    let air = null;
    if (airRes.status === 'fulfilled' && airRes.value.ok) {
      try {
        const airJson = await airRes.value.json();
        const c = airJson && airJson.current;
        if (c) {
          air = {
            usAqi: typeof c.us_aqi === 'number' ? c.us_aqi : null,
            euAqi: typeof c.european_aqi === 'number' ? c.european_aqi : null,
            pm25: typeof c.pm2_5 === 'number' ? c.pm2_5 : null,
            pm10: typeof c.pm10 === 'number' ? c.pm10 : null,
          };
        }
      } catch { }
    }

    return { ...weatherJson, air };
  }

  /* ---------------------------------------------------------
     缓存清理：保证 cache.* 条目数 <= MAX_CACHED_CITIES
     --------------------------------------------------------- */
  async function cleanupCache(db, keepKey) {
    let keys;
    try { keys = await db.keys(); }
    catch { return; }

    const cacheKeys = keys.filter(k => k.startsWith('cache.'));
    if (cacheKeys.length <= MAX_CACHED_CITIES) return;

    const now = Date.now();

    const entries = await Promise.all(cacheKeys.map(async k => {
      let at = 0;
      try { at = (await db.get(k))?.timestamp || 0; }
      catch {}
      return { key: k, at };
    }));

    const others = entries.filter(e => e.key !== keepKey);

    const fresh = others
      .filter(e => now - e.at < CACHE_TTL)
      .sort((a, b) => b.at - a.at);

    const keep = new Set([
      keepKey,
      ...fresh.slice(0, Math.max(0, MAX_CACHED_CITIES - 1)).map(e => e.key),
    ]);

    for (const e of entries) {
      if (!keep.has(e.key)) {
        try { await db.remove(e.key); } catch {}
      }
    }
  }

  /* =========================================================
     注册应用
     ========================================================= */
  WujiApps.register({
    bundlename: BUNDLE,
    name: '天气',
    icon: './assets/weather.svg',
    initialRoute: 'home',

    styles: `
      .weather-page {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: calc(var(--wj-pad) + var(--statusbar-h)) 22px 34px;
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .weather-topbar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }
      .city-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 11px 20px;
        border: 0;
        border-radius: 1399px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 600;
        cursor: pointer;
        transition: background .15s;
      }
      .city-btn:active { transform: scale(.97); }
      .refresh-btn {
        padding: 11px 22px;
        border: 0;
        border-radius: 1399px;
        background: var(--wj-primary);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-sm);
        font-weight: 600;
        letter-spacing: .3px;
        cursor: pointer;
        white-space: nowrap;
        transition: background .15s, opacity .15s, transform .1s;
      }
      .refresh-btn:active:not(:disabled) { transform: scale(.96); }
      .refresh-btn:disabled {
        background: var(--wj-bg-alt);
        color: var(--wj-text-dim);
        cursor: not-allowed;
      }
      .refresh-btn.is-loading {
        background: var(--wj-bg-alt);
        color: var(--wj-text-muted);
      }
      .weather-body {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .weather-hero {
        position: relative;
        flex: 0 0 auto;
        padding: 36px 28px 34px;
        border-radius: 31px;
        color: #fff;
        text-align: center;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        box-shadow: 0 20px 45px rgba(74,125,255,.28);
        transition: background .35s ease;
      }
      .weather-hero::before {
        content: "";
        position: absolute;
        top: -50%;
        right: -30%;
        width: 280px; height: 280px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,.22), transparent 70%);
        pointer-events: none;
      }
      .weather-hero__icon {
        font-size: 106px;
        line-height: 1;
        margin-bottom: 6px;
        filter: drop-shadow(0 8px 20px rgba(0,0,0,.18));
      }
      .weather-hero__temp {
        font-size: 95px;
        font-weight: 500;
        line-height: 1;
        letter-spacing: -3px;
        display: inline-flex;
        align-items: flex-start;
        text-shadow: 0 3px 17px rgba(0,0,0,.12);
      }
      .weather-hero__temp sup {
        font-size: 42px;
        font-weight: 500;
        letter-spacing: 0;
        margin-top: 14px;
      }
      .weather-hero__desc {
        font-size: var(--wj-fs-lg);
        opacity: .95;
        letter-spacing: .3px;
      }
      .weather-hero__range {
        margin-top: 11px;
        font-size: var(--wj-fs-sm);
        opacity: .82;
        display: inline-flex;
        align-items: center;
        gap: 11px;
      }
      .weather-hero__range .dot { opacity: .5; }

      .weather-meta {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .weather-meta__item {
        padding: 20px 22px;
        border-radius: 22px;
        background: var(--wj-bg-alt);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .weather-meta__label {
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-muted);
      }
      .weather-meta__value {
        font-size: var(--wj-fs-3xl);
        font-weight: 500;
        color: var(--wj-text);
        line-height: 1.1;
      }

      /* ---------- 空气质量卡片 ---------- */
      .weather-air {
        flex: 0 0 auto;
        padding: 20px 22px;
        border-radius: 22px;
        background: var(--wj-bg-alt);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .weather-air__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }
      .weather-air__label {
        font-size: var(--wj-fs-md);
        color: var(--wj-text-muted);
        font-weight: 500;
      }
      .weather-air__level {
        padding: 4px 14px;
        border-radius: 1399px;
        font-size: var(--wj-fs-xs);
        font-weight: 600;
        color: #fff;
        letter-spacing: .3px;
      }
      .weather-air__main {
        display: flex;
        align-items: center;
        gap: 22px;
      }
      .weather-air__aqi {
        flex: 0 0 auto;
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .weather-air__num {
        font-size: 45px;
        font-weight: 700;
        line-height: 1;
        color: var(--wj-text);
        font-variant-numeric: tabular-nums;
        letter-spacing: -1px;
      }
      .weather-air__unit {
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-dim);
        font-weight: 500;
      }
      .weather-air__stats {
        flex: 1 1 auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        min-width: 0;
      }
      .weather-air__stat {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .weather-air__stat-label {
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-dim);
      }
      .weather-air__stat-value {
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        color: var(--wj-text);
        font-variant-numeric: tabular-nums;
      }
      .weather-air__stat-value i {
        font-size: var(--wj-fs-xs);
        font-weight: 400;
        font-style: normal;
        color: var(--wj-text-dim);
        margin-left: 3px;
      }
      .weather-air__empty {
        font-size: var(--wj-fs-md);
        color: var(--wj-text-dim);
        padding: 6px 0;
      }

      .weather-more {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 22px 25px;
        border: 0;
        border-radius: 22px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: var(--wj-fs-lg);
        font-weight: 600;
        cursor: pointer;
        transition: background .15s, transform .1s;
      }
      .weather-more:active { transform: scale(.985); }
      .weather-more__arrow {
        font-size: var(--wj-fs-3xl);
        line-height: 1;
        color: var(--wj-text-dim);
        font-weight: 300;
      }
      .weather-updated {
        flex: 0 0 auto;
        text-align: center;
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-dim);
        margin-top: -2px;
      }
      .weather-state {
        flex: 1 1 auto;
        min-height: 336px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        padding: 56px 28px;
        text-align: center;
      }
      .weather-state__spinner {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 4px solid var(--wj-border-strong);
        border-top-color: var(--wj-primary);
        animation: wSpin .85s linear infinite;
      }
      @keyframes wSpin { to { transform: rotate(360deg); } }
      .weather-state__icon {
        font-size: 73px;
        line-height: 1;
        opacity: .35;
      }
      .weather-state__text {
        font-size: var(--wj-fs-md);
        color: var(--wj-text-muted);
        line-height: 1.6;
      }
      .weather-state__retry {
        margin-top: 6px;
        padding: 14px 31px;
        border: 0;
        border-radius: 1399px;
        background: var(--wj-primary);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-sm);
        font-weight: 600;
        cursor: pointer;
        transition: background .15s, transform .1s;
      }
      .weather-state__retry:active { transform: scale(.96); }
      .forecast-title {
        flex: 0 0 auto;
        font-size: var(--wj-fs-xl);
        font-weight: 600;
        color: var(--wj-text);
        margin-bottom: 6px;
      }
      .forecast-list {
        display: flex;
        flex-direction: column;
        gap: 11px;
      }
      .forecast-row {
        display: flex;
        align-items: center;
        gap: 17px;
        padding: 20px 22px;
        border-radius: 20px;
        background: var(--wj-bg-alt);
      }
      .forecast-row__day {
        flex: 0 0 64px;
        font-size: var(--wj-fs-sm);
        font-weight: 600;
        color: var(--wj-text);
      }
      .forecast-row__icon {
        flex: 0 0 39px;
        font-size: var(--wj-fs-3xl);
        text-align: center;
        line-height: 1;
      }
      .forecast-row__desc {
        flex: 1 1 auto;
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .forecast-row__temp {
        flex: 0 0 auto;
        font-size: var(--wj-fs-md);
        font-weight: 600;
        color: var(--wj-text);
        white-space: nowrap;
      }
      .forecast-row__temp .min {
        color: var(--wj-text-dim);
        font-weight: 400;
        margin-left: 8px;
      }
      .city-list {
        display: flex;
        flex-direction: column;
        gap: 11px;
      }
      .city-item {
        touch-action: pan-y;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 25px;
        border-radius: 20px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font-size: var(--wj-fs-lg);
        cursor: pointer;
        text-align: left;
        transition: background .15s;
      }
      .city-item:active { background:#dce3f0; }
      .city-item.is-active {
        background: var(--wj-primary);
        color: #fff;
      }
      .city-item__hint {
        font-size: var(--wj-fs-xs);
        opacity: .75;
      }
    `,

    routes: {
      /* ===================================================
         home
         =================================================== */
      home: {
        name: 'home',

        render() {
          return `
            <div class="weather-page" id="weatherHome">
              <div class="weather-topbar">
                <button class="city-btn" id="cityBtn" type="button">
                  <span id="cityLabel">${lastKnownCity}</span>
                </button>
                <button class="refresh-btn" id="refreshBtn" type="button">刷新</button>
              </div>
              <div id="weatherRoot"></div>
            </div>
          `;
        },

        mount(root, ctx) {
          const db          = AppStorage.for(BUNDLE);
          const weatherRoot = root.querySelector('#weatherRoot');
          const cityLabelEl = root.querySelector('#cityLabel');
          const cityBtn     = root.querySelector('#cityBtn');
          const refreshBtn  = root.querySelector('#refreshBtn');

          let currentCity = lastKnownCity;
          let disposed    = false;

          /* ---------- 状态渲染 ---------- */
          function renderLoading() {
            weatherRoot.innerHTML = `
              <div class="weather-state">
                <div class="weather-state__spinner"></div>
                <div class="weather-state__text">正在获取天气…</div>
              </div>
            `;
          }
          function renderError() {
            weatherRoot.innerHTML = `
              <div class="weather-state">
                <div class="weather-state__icon">⚠️</div>
                <div class="weather-state__text">网络异常，请重试</div>
                <button class="weather-state__retry" id="retryBtn" type="button">重试</button>
              </div>
            `;
            weatherRoot.querySelector('#retryBtn')
              ?.addEventListener('click', () => loadWeather({ force: true }));
          }

          /* ---------- 空气质量卡片 HTML ---------- */
          function renderAirHtml(air) {
            if (!air || air.usAqi == null) {
              return `
                <div class="weather-air">
                  <div class="weather-air__top">
                    <span class="weather-air__label">空气质量</span>
                  </div>
                  <div class="weather-air__empty">暂无空气质量数据</div>
                </div>
              `;
            }

            const lv = aqiLevel(air.usAqi);
            const pm25 = air.pm25 != null ? air.pm25.toFixed(1) : '--';
            const pm10 = air.pm10 != null ? air.pm10.toFixed(1) : '--';

            return `
              <div class="weather-air">
                <div class="weather-air__top">
                  <span class="weather-air__label">空气质量</span>
                  <span class="weather-air__level"
                        style="background:${lv.color}">${lv.label}</span>
                </div>
                <div class="weather-air__main">
                  <div class="weather-air__aqi">
                    <span class="weather-air__num">${air.usAqi}</span>
                    <span class="weather-air__unit">AQI</span>
                  </div>
                  <div class="weather-air__stats">
                    <div class="weather-air__stat">
                      <span class="weather-air__stat-label">PM2.5</span>
                      <span class="weather-air__stat-value">${pm25}<i>μg/m³</i></span>
                    </div>
                    <div class="weather-air__stat">
                      <span class="weather-air__stat-label">PM10</span>
                      <span class="weather-air__stat-value">${pm10}<i>μg/m³</i></span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }

          function renderWeather(data, fromCache) {
            const cur   = data.current;
            const daily = data.daily;
            const w     = weatherCode(cur.weather_code);
            const tMax  = Math.round(daily.temperature_2m_max[0]);
            const tMin  = Math.round(daily.temperature_2m_min[0]);
            const temp  = Math.round(cur.temperature_2m);
            const feel  = Math.round(cur.apparent_temperature);
            const hum   = cur.relative_humidity_2m;

            weatherRoot.innerHTML = `
              <div class="weather-body">
                <div class="weather-hero"
                     style="background:${heroGradient(cur.weather_code)}">
                  <div class="weather-hero__icon">${w.icon}</div>
                  <div class="weather-hero__temp">${temp}<sup>°</sup></div>
                  <div class="weather-hero__desc">${w.text}</div>
                  <div class="weather-hero__range">
                    <span>最高 ${tMax}°</span>
                    <span class="dot">·</span>
                    <span>最低 ${tMin}°</span>
                  </div>
                </div>
                <div class="weather-meta">
                  <div class="weather-meta__item">
                    <span class="weather-meta__label">体感温度</span>
                    <span class="weather-meta__value">${feel}°</span>
                  </div>
                  <div class="weather-meta__item">
                    <span class="weather-meta__label">相对湿度</span>
                    <span class="weather-meta__value">${hum}%</span>
                  </div>
                </div>
                ${renderAirHtml(data.air)}
                <button class="weather-more" id="moreBtn" type="button">
                  <span>未来 ${FORECAST_DAYS} 天</span>
                  <span class="weather-more__arrow">›</span>
                </button>
                <div class="weather-updated">
                  ${fromCache ? '缓存 · ' : ''}更新于 ${fmtTime(cur.time)}
                </div>
              </div>
            `;
            weatherRoot.querySelector('#moreBtn')
              ?.addEventListener('click', () => ctx.push('forecast'));
          }

          function setRefreshIdle() {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('is-loading');
            refreshBtn.textContent = '刷新';
          }
          function setRefreshLoading() {
            refreshBtn.disabled = true;
            refreshBtn.classList.add('is-loading');
            refreshBtn.textContent = '刷新中…';
          }
          function updateRefreshCooldown(timestamp) {
            const remain = REFRESH_GAP - (Date.now() - timestamp);
            if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
            if (remain <= 0) { setRefreshIdle(); return; }

            refreshBtn.disabled = true;
            refreshBtn.classList.remove('is-loading');
            refreshBtn.textContent = `${Math.ceil(remain / 1000)}s 后可刷新`;

            cooldownTimer = setInterval(() => {
              const r = REFRESH_GAP - (Date.now() - timestamp);
              if (r <= 0) {
                clearInterval(cooldownTimer);
                cooldownTimer = null;
                setRefreshIdle();
              } else {
                refreshBtn.textContent = `${Math.ceil(r / 1000)}s 后可刷新`;
              }
            }, 1000);
          }

          async function loadWeather({ force = false } = {}) {
            if (loading || disposed) return;

            const city = CITIES.find(c => c.name === currentCity);
            if (!city) { renderError(); return; }

            const cached = await db.get('cache.' + currentCity, null);
            if (disposed) return;

            const now = Date.now();
            if (!force && cached && now - cached.timestamp < CACHE_TTL) {
              weatherData = { city: currentCity, ...cached };
              renderWeather(cached.data, true);
              updateRefreshCooldown(cached.timestamp);
              scheduleAutoRefresh(cached.timestamp);
              return;
            }

            loading = true;
            setRefreshLoading();
            if (!cached) renderLoading();

            try {
              const data = await fetchWeather(city);
              if (disposed) return;

              const record = { data, timestamp: Date.now() };
              await db.set('cache.' + currentCity, record);
              if (disposed) return;

              cleanupCache(db, 'cache.' + currentCity).catch(() => {});

              weatherData = { city: currentCity, ...record };
              renderWeather(data, false);
              updateRefreshCooldown(record.timestamp);
              scheduleAutoRefresh(record.timestamp);
            } catch (err) {
              console.error('[Weather]', err);
              if (disposed) return;

              if (cached) {
                weatherData = { city: currentCity, ...cached };
                renderWeather(cached.data, true);
                updateRefreshCooldown(cached.timestamp);
                scheduleAutoRefresh(cached.timestamp);
              } else {
                renderError();
                setRefreshIdle();
              }
            } finally {
              loading = false;
            }
          }

          function scheduleAutoRefresh(timestamp) {
            if (autoRefreshTimer) { clearTimeout(autoRefreshTimer); autoRefreshTimer = null; }
            const remain = REFRESH_GAP - (Date.now() - timestamp);
            const delay  = Math.max(remain, 0) + 500;
            autoRefreshTimer = setTimeout(() => {
              autoRefreshTimer = null;
              loadWeather({ force: true });
            }, delay);
          }

          cityBtn.addEventListener('click', () => ctx.push('city'));
          refreshBtn.addEventListener('click', () => {
            if (refreshBtn.disabled || loading) return;
            loadWeather({ force: true });
          });

          const offNav = ctx.nav.onChange(async () => {
            if (disposed) return;
            if (ctx.nav.current?.route?.name !== 'home') return;
            const storedCity = await db.get('city', DEFAULT_CITY);
            if (disposed) return;
            if (storedCity !== currentCity) {
              currentCity = storedCity;
              lastKnownCity = storedCity;
              cityLabelEl.textContent = storedCity;
              loadWeather();
            }
          });

          (async () => {
            const storedCity = await db.get('city', DEFAULT_CITY);
            if (disposed) return;
            currentCity = storedCity;
            lastKnownCity = storedCity;
            cityLabelEl.textContent = storedCity;
            loadWeather();

            const purge = () => cleanupCache(db, 'cache.' + currentCity).catch(() => {});
            if ('requestIdleCallback' in window) {
              requestIdleCallback(purge, { timeout: 4000 });
            } else {
              setTimeout(purge, 3000);
            }
          })();

          return () => {
            disposed = true;
            offNav();
            if (cooldownTimer)    { clearInterval(cooldownTimer);   cooldownTimer = null; }
            if (autoRefreshTimer) { clearTimeout(autoRefreshTimer); autoRefreshTimer = null; }
            loading = false;
          };
        },
      },

      /* ===================================================
         forecast
         =================================================== */
      forecast: {
        name: 'forecast',

        render() {
          return `
            <div class="weather-page">
              <div class="forecast-title">未来 ${FORECAST_DAYS} 天</div>
              <div class="forecast-list" id="forecastList"></div>
            </div>
          `;
        },

        mount(root) {
          const listEl = root.querySelector('#forecastList');
          if (!weatherData || !weatherData.data) {
            listEl.innerHTML = `
              <div class="weather-state">
                <div class="weather-state__icon">📭</div>
                <div class="weather-state__text">暂无数据</div>
              </div>
            `;
            return;
          }
          const daily = weatherData.data.daily;
          listEl.innerHTML = daily.time.map((date, i) => {
            const w    = weatherCode(daily.weather_code[i]);
            const tMax = Math.round(daily.temperature_2m_max[i]);
            const tMin = Math.round(daily.temperature_2m_min[i]);
            return `
              <div class="forecast-row">
                <div class="forecast-row__day">${dayName(date, i)}</div>
                <div class="forecast-row__icon">${w.icon}</div>
                <div class="forecast-row__desc">${w.text}</div>
                <div class="forecast-row__temp">
                  ${tMax}°<span class="min">${tMin}°</span>
                </div>
              </div>
            `;
          }).join('');
        },
      },

      /* ===================================================
         city —— 城市选择页
         =================================================== */
      city: {
        name: 'city',

        render() {
          return `
            <div class="weather-page">
              <div class="forecast-title">选择城市</div>
              <div class="city-list" id="cityList">
                ${CITIES.map(c => `
                  <div class="city-item ${c.name === lastKnownCity ? 'is-active' : ''}"
                       role="button"
                       tabindex="0"
                       data-city="${c.name}">
                    <span>${c.name}</span>
                    <span class="city-item__hint">${c.name === lastKnownCity ? '当前' : ''}</span>
                  </div>
                `).join('')}
              </div>
            </div>`;
        },

        mount(root, ctx) {
          const db = AppStorage.for(BUNDLE);
          const listEl = root.querySelector('#cityList');

          (async () => {
            const stored = await db.get('city', DEFAULT_CITY);
            lastKnownCity = stored;
            listEl.querySelectorAll('.city-item').forEach(el => {
              const on = el.dataset.city === stored;
              el.classList.toggle('is-active', on);
              el.querySelector('.city-item__hint').textContent = on ? '当前' : '';
            });
          })();

          listEl.querySelectorAll('.city-item').forEach(el => {
            el.addEventListener('click', async () => {
              const name = el.dataset.city;
              if (name) {
                lastKnownCity = name;
                await db.set('city', name);
              }
              ctx.pop();
            });
            el.addEventListener('keydown', async e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const name = el.dataset.city;
                if (name) {
                  lastKnownCity = name;
                  await db.set('city', name);
                }
                ctx.pop();
              }
            });
          });
        },
      },
    },
  });
})();