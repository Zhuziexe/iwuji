/* =========================================================
   天气 —— Open-Meteo（无需 API Key）
   路由：
     home      → 当前天气
     forecast  → 未来 7 天
     city      → 选择城市
   缓存：30 分钟；手动刷新间隔 5 分钟；超过 5 分钟自动刷新
   ========================================================= */
(() => {
  const CACHE_TTL     = 30 * 60 * 1000;
  const REFRESH_GAP   = 5  * 60 * 1000;
  const FORECAST_DAYS = 7;
  const DEFAULT_CITY  = '杭州';
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
  /* ---------- 模块状态 ---------- */
  let weatherData       = null;
  let cooldownTimer     = null;
  let autoRefreshTimer  = null;
  let loading           = false;
  /* ---------- 工具 ---------- */
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
  const cacheKey = city => `weather.cache.${city}`;
  async function fetchWeather(city) {
    const params = new URLSearchParams({
      latitude:  city.lat,
      longitude: city.lon,
      current:   'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code',
      daily:     'weather_code,temperature_2m_max,temperature_2m_min',
      timezone:  'auto',
      forecast_days: String(FORECAST_DAYS),
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  /* =========================================================
     注册应用
     ========================================================= */
  WujiApps.register({
    bundlename: 'com.wujios.weather',
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
        padding: calc(var(--wj-pad) + var(--statusbar-h)) 16px 24px;
        background: var(--wj-bg);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .weather-topbar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .city-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: 0;
        border-radius: 999px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: var(--wj-fs-md);
        font-weight: 600;
        cursor: pointer;
        transition: background .15s;
      }
      .city-btn:active { transform: scale(.97); }
      .city-btn__arrow {
        font-size: 10px;
        color: var(--wj-text-dim);
        line-height: 1;
      }
      /* 刷新按钮：文字 + 倒计时 */
      .refresh-btn {
        padding: 8px 16px;
        border: 0;
        border-radius: 999px;
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
      /* ==================== 主体 ==================== */
      .weather-body {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      /* ==================== 主卡片 ==================== */
      .weather-hero {
        position: relative;
        flex: 0 0 auto;
        padding: 26px 20px 24px;
        border-radius: 22px;
        color: #fff;
        text-align: center;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        box-shadow: 0 14px 32px rgba(74,125,255,.28);
        transition: background .35s ease;
      }
      .weather-hero::before {
        content: "";
        position: absolute;
        top: -50%;
        right: -30%;
        width: 200px; height: 200px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,.22), transparent 70%);
        pointer-events: none;
      }
      .weather-hero__icon {
        font-size: 76px;
        line-height: 1;
        margin-bottom: 4px;
        filter: drop-shadow(0 6px 14px rgba(0,0,0,.18));
      }
      .weather-hero__temp {
        font-size: 68px;
        font-weight: 500;
        line-height: 1;
        letter-spacing: -3px;
        display: inline-flex;
        align-items: flex-start;
        text-shadow: 0 2px 12px rgba(0,0,0,.12);
      }
      .weather-hero__temp sup {
        font-size: 30px;
        font-weight: 500;
        letter-spacing: 0;
        margin-top: 10px;
      }
      .weather-hero__desc {
        font-size: 15px;
        opacity: .95;
        letter-spacing: .3px;
      }
      .weather-hero__range {
        margin-top: 8px;
        font-size: 13px;
        opacity: .82;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .weather-hero__range .dot { opacity: .5; }
      /* ==================== 体感 / 湿度 ==================== */
      .weather-meta {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .weather-meta__item {
        padding: 14px 16px;
        border-radius: 16px;
        background: var(--wj-bg-alt);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .weather-meta__label {
        font-size: 12px;
        color: var(--wj-text-dim);
      }
      .weather-meta__value {
        font-size: 22px;
        font-weight: 500;
        color: var(--wj-text);
        line-height: 1.1;
      }
      /* ==================== 未来 7 天入口 ==================== */
      .weather-more {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 16px 18px;
        border: 0;
        border-radius: 16px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: background .15s, transform .1s;
      }
      .weather-more:active { transform: scale(.985); }
      .weather-more__arrow {
        font-size: 22px;
        line-height: 1;
        color: var(--wj-text-dim);
        font-weight: 300;
      }
      .weather-updated {
        flex: 0 0 auto;
        text-align: center;
        font-size: 11px;
        color: var(--wj-text-dim);
        margin-top: -2px;
      }
      /* ==================== 加载 / 错误（全页状态） ==================== */
      .weather-state {
        flex: 1 1 auto;
        min-height: 240px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 40px 20px;
        text-align: center;
      }
      .weather-state__spinner {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 3px solid var(--wj-border-strong);
        border-top-color: var(--wj-primary);
        animation: wSpin .85s linear infinite;
      }
      @keyframes wSpin { to { transform: rotate(360deg); } }
      .weather-state__icon {
        font-size: 52px;
        line-height: 1;
        opacity: .35;
      }
      .weather-state__text {
        font-size: 14px;
        color: var(--wj-text-muted);
        line-height: 1.6;
      }
      .weather-state__retry {
        margin-top: 4px;
        padding: 10px 22px;
        border: 0;
        border-radius: 999px;
        background: var(--wj-primary);
        color: #fff;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background .15s, transform .1s;
      }
      .weather-state__retry:active { transform: scale(.96); }
      /* ==================== 未来 7 天页 ==================== */
      .forecast-title {
        flex: 0 0 auto;
        font-size: 18px;
        font-weight: 600;
        color: var(--wj-text);
        margin-bottom: 4px;
      }
      .forecast-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .forecast-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 14px;
        background: var(--wj-bg-alt);
      }
      .forecast-row__day {
        flex: 0 0 46px;
        font-size: 13px;
        font-weight: 600;
        color: var(--wj-text);
      }
      .forecast-row__icon {
        flex: 0 0 28px;
        font-size: 22px;
        text-align: center;
        line-height: 1;
      }
      .forecast-row__desc {
        flex: 1 1 auto;
        font-size: 12px;
        color: var(--wj-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .forecast-row__temp {
        flex: 0 0 auto;
        font-size: 14px;
        font-weight: 600;
        color: var(--wj-text);
        white-space: nowrap;
      }
      .forecast-row__temp .min {
        color: var(--wj-text-dim);
        font-weight: 400;
        margin-left: 6px;
      }
      /* ==================== 城市选择页 ==================== */
      .city-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .city-item {
        touch-action: pan-y;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-radius: 14px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font-size: 15px;
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
        font-size: 12px;
        opacity: .75;
      }
    `,
    routes: {
      /* ===================================================
         home
         =================================================== */
      home: {
        render() {
          const cityName = Store.get('weather.city', DEFAULT_CITY);
          return `
            <div class="weather-page" id="weatherHome">
              <div class="weather-topbar">
                <button class="city-btn" id="cityBtn" type="button">
                  <span id="cityLabel">${cityName}</span>
                  <span class="city-btn__arrow">▾</span>
                </button>
                <button class="refresh-btn" id="refreshBtn" type="button">刷新</button>
              </div>
              <div id="weatherRoot"></div>
            </div>
          `;
        },
        mount(root, ctx) {
          const weatherRoot = root.querySelector('#weatherRoot');
          const cityLabelEl = root.querySelector('#cityLabel');
          const cityBtn     = root.querySelector('#cityBtn');
          const refreshBtn  = root.querySelector('#refreshBtn');
          let currentCity = Store.get('weather.city', DEFAULT_CITY);
          /* ---------- 状态渲染 ---------- */
          /* 全页加载中：所有内容替换成"加载中" */
          function renderLoading() {
            weatherRoot.innerHTML = `
              <div class="weather-state">
                <div class="weather-state__spinner"></div>
                <div class="weather-state__text">正在获取天气…</div>
              </div>
            `;
          }
          /* 全页错误：所有内容替换成"网络异常，请重试" */
          function renderError() {
            weatherRoot.innerHTML = `
              <div class="weather-state">
                <div class="weather-state__icon">⚠️</div>
                <div class="weather-state__text">网络异常，请重试</div>
                <button class="weather-state__retry" id="retryBtn" type="button">重试</button>
              </div>
            `;
            const btn = weatherRoot.querySelector('#retryBtn');
            btn?.addEventListener('click', () => loadWeather({ force: true }));
          }
          /* 正常渲染：hero + meta + 未来 7 天入口 + 更新时间 */
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
            if (remain <= 0) {
              setRefreshIdle();
              return;
            }
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
          /* ---------- 加载 ---------- */
          async function loadWeather({ force = false } = {}) {
            if (loading) return;
            const city = CITIES.find(c => c.name === currentCity);
            if (!city) { renderError(); return; }
            const cached = Store.get(cacheKey(currentCity));
            const now    = Date.now();
            /* 非强制 → 未过期缓存直接用 */
            if (!force && cached && now - cached.timestamp < CACHE_TTL) {
              weatherData = { city: currentCity, ...cached };
              renderWeather(cached.data, true);
              updateRefreshCooldown(cached.timestamp);
              scheduleAutoRefresh(cached.timestamp);
              return;
            }
            loading = true;
            setRefreshLoading();
            /* 无缓存时显示全页加载；有缓存时保留内容，不闪 */
            if (!cached) renderLoading();
            try {
              const data = await fetchWeather(city);
              const record = { data, timestamp: Date.now() };
              Store.set(cacheKey(currentCity), record);
              weatherData = { city: currentCity, ...record };
              renderWeather(data, false);
              updateRefreshCooldown(record.timestamp);
              scheduleAutoRefresh(record.timestamp);
            } catch (err) {
              console.error('[Weather]', err);
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
          /* ---------- 自动刷新：距上次数据超过 5 分钟重拉 ---------- */
          function scheduleAutoRefresh(timestamp) {
            if (autoRefreshTimer) { clearTimeout(autoRefreshTimer); autoRefreshTimer = null; }
            const remain = REFRESH_GAP - (Date.now() - timestamp);
            const delay  = Math.max(remain, 0) + 500;
            autoRefreshTimer = setTimeout(() => {
              autoRefreshTimer = null;
              loadWeather({ force: true });
            }, delay);
          }
          /* ---------- 事件 ---------- */
          cityBtn.addEventListener('click', () => {
            ctx.push('city');
          });
          refreshBtn.addEventListener('click', () => {
            if (refreshBtn.disabled || loading) return;
            loadWeather({ force: true });
          });
          /* 从城市页返回时，检查城市是否变了 */
          ctx.nav.onChange(() => {
            /* 只有当回到 home 时才处理 */
            if (ctx.nav.current?.route?.name !== 'home') return;
            const storedCity = Store.get('weather.city', DEFAULT_CITY);
            if (storedCity !== currentCity) {
              currentCity = storedCity;
              cityLabelEl.textContent = storedCity;
              loadWeather();
            }
          });
          /* 首次加载 */
          cityLabelEl.textContent = currentCity;
          loadWeather();
        },
        unmount() {
          if (cooldownTimer)    { clearInterval(cooldownTimer);    cooldownTimer = null; }
          if (autoRefreshTimer) { clearTimeout(autoRefreshTimer);  autoRefreshTimer = null; }
          loading = false;
        },
        name: 'home',
      },
      /* ===================================================
         forecast
         =================================================== */
      forecast: {
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
        name:'forecast'
      },
      /* ===================================================
         city —— 城市选择页
         =================================================== */
      city: {
        render() {
          const current = Store.get('weather.city', DEFAULT_CITY);
          return `
            <div class="weather-page">
              <div class="forecast-title">选择城市</div>
              <div class="city-list" id="cityList">
                ${CITIES.map(c => `
                  <div class="city-item ${c.name === current ? 'is-active' : ''}"
                       role="button"
                       tabindex="0"
                       data-city="${c.name}">
                    <span>${c.name}</span>
                    <span class="city-item__hint">${c.name === current ? '当前' : ''}</span>
                  </div>
                `).join('')}
              </div>
            </div>`;
        },
        mount(root, ctx) {
          root.querySelectorAll('.city-item').forEach(el => {
            el.addEventListener('click', () => {
              const name = el.dataset.city;
              if (name) {
                Store.set('weather.city', name);
              }
              ctx.pop();
            });
            el.addEventListener('keydown', e => {
              if(e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const name = el.dataset.city;
                if (name) Store.set('weather.city', name);
                ctx.pop();
              }
            })
          });
        },
        name: 'city'
      },
    },
  });
})();
