(() => {
  const BUNDLE = 'com.niunai.map';

  /* ---------- 瓦片源定义 ---------- */
  const TILE_SOURCES = {
    'amap-vector': {
      name: '高德矢量',
      url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      options: { subdomains: '1234', maxZoom: 18, attribution: '© 高德地图' },
      gcj: true,
    },
    'amap-sat': {
      name: '高德卫星',
      url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      options: { subdomains: '1234', maxZoom: 18, attribution: '© 高德地图' },
      overlay: 'https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
      overlayOptions: { subdomains: '1234', maxZoom: 18, opacity: 1 },
      gcj: true,
    },
    'tencent': {
      name: '腾讯地图',
      url: 'https://rt{s}.map.gtimg.com/realtimerender?z={z}&x={x}&y={y}&type=vector&style=0',
      options: { subdomains: '0123', maxZoom: 18, tms: true, attribution: '© 腾讯地图' },
      gcj: true,
    },
    'osmfr': {
      name: 'OSM.fr',
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      options: { subdomains: 'abc', maxZoom: 19, attribution: '© OpenStreetMap' },
      gcj: false,
    },
    'osm': {
      name: 'OpenStreetMap',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: { maxZoom: 19, attribution: '© OpenStreetMap' },
      gcj: false,
    },
  };
  const DEFAULT_SOURCE = 'amap-vector';

  /* ---------- GCJ-02 纠偏（WGS84 → GCJ02） ---------- */
  const GCJ_A = 6378245.0;
  const GCJ_EE = 0.00669342162296594323;
  function outOfChina(lng, lat) {
    return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
  }
  function tLat(x, y) {
    let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y
      + 0.2 * Math.sqrt(Math.abs(x));
    r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    r += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
    r += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
    return r;
  }
  function tLng(x, y) {
    let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y
      + 0.1 * Math.sqrt(Math.abs(x));
    r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    r += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
    r += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
    return r;
  }
  function wgs84togcj02(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    let dLat = tLat(lng - 105.0, lat - 35.0);
    let dLng = tLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - GCJ_EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180.0) / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI);
    return [lng + dLng, lat + dLat];
  }
  /* GCJ-02 → WGS-84（近似逆变换：减去一次正向偏移量，精度足够切换瓦片源用） */
  function gcj02towgs84(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    const [glng, glat] = wgs84togcj02(lng, lat);
    return [lng - (glng - lng), lat - (glat - lat)];
  }

  /* ---------- 预设城市 ---------- */
  const PRESETS = [
    { name: '上海', lat: 31.2304, lng: 121.4737 },
    { name: '北京', lat: 39.9042, lng: 116.4074 },
    { name: '成都', lat: 30.5728, lng: 104.0668 },
    { name: '杭州', lat: 30.2741, lng: 120.1551 },
  ];
  const DEFAULT_CITY = PRESETS[1]; // 北京

  /* ---------- 本地城市库（离线地理编码，避免 Nominatim 被墙导致搜索失败） ---------- */
  // 坐标为 GCJ-02（与高德/腾讯瓦片一致），搜索结果直接用作显示坐标，不再二次纠偏
  const CITY_DB = [
    { n: '北京', py: 'beijing',      lat: 39.9042, lng: 116.4074 },
    { n: '上海', py: 'shanghai',     lat: 31.2304, lng: 121.4737 },
    { n: '广州', py: 'guangzhou',    lat: 23.1291, lng: 113.2644 },
    { n: '深圳', py: 'shenzhen',     lat: 22.5431, lng: 114.0579 },
    { n: '成都', py: 'chengdu',      lat: 30.5728, lng: 104.0668 },
    { n: '重庆', py: 'chongqing',    lat: 29.5630, lng: 106.5516 },
    { n: '杭州', py: 'hangzhou',     lat: 30.2741, lng: 120.1551 },
    { n: '武汉', py: 'wuhan',        lat: 30.5928, lng: 114.3055 },
    { n: '西安', py: 'xian',         lat: 34.3416, lng: 108.9398 },
    { n: '南京', py: 'nanjing',      lat: 32.0603, lng: 118.7969 },
    { n: '天津', py: 'tianjin',      lat: 39.3434, lng: 117.3616 },
    { n: '苏州', py: 'suzhou',       lat: 31.2989, lng: 120.5853 },
    { n: '青岛', py: 'qingdao',      lat: 36.0671, lng: 120.3826 },
    { n: '沈阳', py: 'shenyang',     lat: 41.8057, lng: 123.4315 },
    { n: '大连', py: 'dalian',       lat: 38.9140, lng: 121.6147 },
    { n: '厦门', py: 'xiamen',       lat: 24.4798, lng: 118.0894 },
    { n: '福州', py: 'fuzhou',       lat: 26.0745, lng: 119.2965 },
    { n: '昆明', py: 'kunming',      lat: 24.8801, lng: 102.8329 },
    { n: '贵阳', py: 'guiyang',      lat: 26.6470, lng: 106.6302 },
    { n: '长沙', py: 'changsha',     lat: 28.2282, lng: 112.9388 },
    { n: '郑州', py: 'zhengzhou',    lat: 34.7466, lng: 113.6254 },
    { n: '济南', py: 'jinan',        lat: 36.6512, lng: 117.1201 },
    { n: '合肥', py: 'hefei',        lat: 31.8206, lng: 117.2272 },
    { n: '南昌', py: 'nanchang',     lat: 28.6829, lng: 115.8579 },
    { n: '太原', py: 'taiyuan',      lat: 37.8706, lng: 112.5489 },
    { n: '石家庄', py: 'shijiazhuang', lat: 38.0428, lng: 114.5149 },
    { n: '哈尔滨', py: 'haerbin',    lat: 45.8038, lng: 126.5349 },
    { n: '长春', py: 'changchun',    lat: 43.8171, lng: 125.3235 },
    { n: '兰州', py: 'lanzhou',      lat: 36.0611, lng: 103.8343 },
    { n: '南宁', py: 'nanning',      lat: 22.8170, lng: 108.3665 },
    { n: '海口', py: 'haikou',       lat: 20.0444, lng: 110.1989 },
    { n: '三亚', py: 'sanya',        lat: 18.2528, lng: 109.5119 },
    { n: '乌鲁木齐', py: 'wulumuqi', lat: 43.8256, lng: 87.6168 },
    { n: '拉萨', py: 'lasa',         lat: 29.6520, lng: 91.1721 },
    { n: '呼和浩特', py: 'huhehaote', lat: 40.8424, lng: 111.7492 },
    { n: '银川', py: 'yinchuan',     lat: 38.4872, lng: 106.2309 },
    { n: '西宁', py: 'xining',       lat: 36.6171, lng: 101.7782 },
    { n: '宁波', py: 'ningbo',       lat: 29.8683, lng: 121.5440 },
    { n: '无锡', py: 'wuxi',         lat: 31.4912, lng: 120.3119 },
    { n: '东莞', py: 'dongguan',     lat: 23.0210, lng: 113.7518 },
    { n: '佛山', py: 'foshan',       lat: 23.0218, lng: 113.1219 },
    { n: '珠海', py: 'zhuhai',       lat: 22.2710, lng: 113.5767 },
    { n: '温州', py: 'wenzhou',      lat: 27.9938, lng: 120.6994 },
    { n: '金华', py: 'jinhua',       lat: 29.0843, lng: 119.6497 },
    { n: '泉州', py: 'quanzhou',     lat: 24.8741, lng: 118.6757 },
    { n: '常州', py: 'changzhou',    lat: 31.8110, lng: 119.9745 },
    { n: '南通', py: 'nantong',      lat: 31.9800, lng: 120.8944 },
    { n: '徐州', py: 'xuzhou',       lat: 34.2618, lng: 117.1850 },
    { n: '唐山', py: 'tangshan',     lat: 39.6304, lng: 118.1802 },
    { n: '香港', py: 'xianggang',    lat: 22.3193, lng: 114.1694 },
    { n: '澳门', py: 'aomen',        lat: 22.1987, lng: 113.5439 },
    { n: '台北', py: 'taibei',       lat: 25.0330, lng: 121.5654 },
    { n: '桂林', py: 'guilin',       lat: 25.2736, lng: 110.2990 },
    { n: '丽江', py: 'lijiang',      lat: 26.8559, lng: 100.2299 },
    { n: '大理', py: 'dali',         lat: 25.6065, lng: 100.2676 },
    { n: '洛阳', py: 'luoyang',      lat: 34.6197, lng: 112.4536 },
    { n: '延安', py: 'yanan',        lat: 36.5965, lng: 109.5000 },
  ];
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* 跨路由共享：搜索子页调用主页地图飞到结果 */
  const AppState = { goToPlace: null };

  /* 本地城市库命中（离线、秒回，坐标同为 GCJ-02） */
  function cityMatch(q) {
    const ql = q.toLowerCase();
    return CITY_DB.filter(c =>
      c.n.includes(q) || q.includes(c.n) ||
      (c.py && (c.py.includes(ql) || ql.includes(c.py)))
    ).map(c => ({ name: c.n, lat: c.lat, lng: c.lng, sys: 'gcj', local: true }));
  }

  /* 国内地理编码：优先 Open-Meteo 免费地理编码（无需 Key，国内可达，返回中文）。
     注意：Open-Meteo 返回 WGS-84 坐标，故在线结果标 sys:'wgs'，由 toDisplay
     按当前瓦片源重投影（默认高德瓦片为 GCJ-02，会自动纠偏）。
     在线无结果 / 失败时回退本地城市库（GCJ-02，覆盖国内主要城市）。 */
  async function geocode(q) {
    q = (q || '').trim();
    if (!q) return { results: [], note: '' };

    const local = cityMatch(q);

    // 1) 在线：Open-Meteo 地理编码（城市 / 自然地物名，非细粒度 POI）
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => { try { ctrl.abort(); } catch {} }, 6000);
      const url = 'https://geocoding-api.open-meteo.com/v1/search?count=8&language=zh&name='
        + encodeURIComponent(q);
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) throw new Error('http ' + resp.status);
      const data = await resp.json();
      const arr = Array.isArray(data.results) ? data.results : [];
      const online = arr.map(r => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;
        const label = [r.name, r.admin1 || r.country].filter(Boolean).join(' · ');
        // Open-Meteo 坐标为 WGS-84
        return { name: label, lat, lng, sys: 'wgs', local: false };
      }).filter(Boolean);
      if (online.length) {
        // 本地城市库命中排前面，方便快速定位大城市
        return { results: local.concat(online), note: '' };
      }
    } catch (e) {
      // 在线失败 → 退本地城市库
      if (local.length) return { results: local, note: '在线搜索失败，已使用本地城市库' };
      return { results: [], note: '网络受限，无法搜索该地点（可试试城市名）' };
    }

    // 2) 在线无结果：退本地城市库
    if (local.length) return { results: local, note: '' };
    return { results: [], note: '未找到相关地点' };
  }

  /* ---------- 地铁图已移除 ---------- */


  /* ---------- Leaflet 懒加载（多 CDN 回退） ---------- */
  const LEAFLET_CDNS = [
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4',
    'https://unpkg.com/leaflet@1.9.4',
    'https://cdn.jsdmirror.com/npm/leaflet@1.9.4',
    'https://lib.baomitu.com/leaflet/1.9.4',
    'https://cdn.bootcdn.net/ajax/libs/leaflet/1.9.4',
  ];
  // Leaflet 关键定位样式内联兜底（应对 Shadow DOM 样式隔离 + CSS CDN 偶发失败）
  // 应用运行在 OS 的 Shadow 根内，主文档注入的 leaflet.css 不会作用到 Shadow 子树，
  // 必须同时把核心定位规则内联进 Shadow 根，否则瓦片面板会退回 static 而堆叠重叠。
  const LEAFLET_CRIT_CSS = `
    .leaflet-pane, .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow,
    .leaflet-tile-container, .leaflet-layer, .leaflet-image-layer, .leaflet-zoom-box {
      position: absolute; left: 0; top: 0;
    }
    .leaflet-map-pane { transform-origin: 0 0; }
    .leaflet-tile-pane { z-index: 200; }
    .leaflet-overlay-pane { z-index: 400; }
    .leaflet-shadow-pane { z-index: 500; }
    .leaflet-marker-pane { z-index: 600; }
    .leaflet-tooltip-pane { z-index: 650; }
    .leaflet-popup-pane { z-index: 700; }
    .leaflet-container { overflow: hidden; -webkit-tap-highlight-color: transparent; background: #ddd; }
    .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow {
      -webkit-user-select: none; -moz-user-select: none; user-select: none; -webkit-user-drag: none;
    }
    .leaflet-top, .leaflet-bottom { position: absolute; z-index: 1000; pointer-events: none; }
    .leaflet-top { top: 0; } .leaflet-bottom { bottom: 0; }
    .leaflet-left { left: 0; } .leaflet-right { right: 0; }
    .leaflet-control { position: absolute; z-index: 800; pointer-events: auto; }
    .leaflet-bar { box-shadow: 0 1px 5px rgba(0,0,0,.65); border-radius: 4px; }
    .leaflet-bar a { display: block; width: 30px; height: 30px; line-height: 30px; text-align: center;
      text-decoration: none; color: #000; background: #fff; border-bottom: 1px solid #ccc; }
    .leaflet-control-attribution { padding: 0 5px; font-size: 11px; background: rgba(255,255,255,.8); color: #333; }
  `;

  let leafletPromise = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => res();
      s.onerror = () => { s.remove(); rej(new Error('script ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadCss(href, target) {
    const t = target || document.head;
    return new Promise((res, rej) => {
      if (t.querySelector(`link[href="${href}"]`)) return res();
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      l.onload = () => res();
      l.onerror = () => { l.remove(); rej(new Error('css ' + href)); };
      t.appendChild(l);
    });
  }
  function loadLeaflet(sr) {
    if (leafletPromise) return leafletPromise;
    const cssTarget = (sr && sr.nodeType === 11 /* ShadowRoot */) ? sr : document.head;
    leafletPromise = (async () => {
      if (window.L && window.L.map) return window.L;
      for (const base of LEAFLET_CDNS) {
        try {
          // CSS 必须注入 Shadow 根，主文档的样式对 Shadow 子树无效
          await loadCss(`${base}/dist/leaflet.css`, cssTarget);
          await loadScript(`${base}/dist/leaflet.js`);
          if (window.L && window.L.map) return window.L;
        } catch (e) {
          console.warn('[map] Leaflet CDN 失败:', base, e);
        }
      }
      throw new Error('无法加载地图组件');
    })();
    return leafletPromise;
  }

  function myLocationIcon(L) {
    return L.divIcon({
      className: 'map-me-icon',
      html: `<span class="map-me-dot"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  /* ========================================================= */
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '牛奶地图',
    icon: './assets/map.svg',
    initialRoute: 'home',
    version: '1.0.2',

    styles: `
      .map-page {
        position: absolute; inset: 0;
        overflow: hidden;
        background: #dfe6ee;
        user-select: none; -webkit-user-select: none;
      }
      #mapC { position: absolute; inset: 0; z-index: 1; }

      .map-top {
        position: absolute;
        top: calc(10px + var(--statusbar-h, 0px));
        left: 10px; right: 10px;
        z-index: 6;
        display: flex; gap: 8px;
        align-items: center;
        justify-content: space-between;
      }
      .map-topbtn {
        flex: 0 0 auto;
        height: 50px; min-width: 50px; padding: 0 14px;
        border: 0; border-radius: 16px;
        background: rgba(255,255,255,.94);
        color: #0a84ff;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,.18);
        cursor: pointer;
        font: inherit; font-size: 18px; font-weight: 600;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .map-topbtn:active { transform: scale(.94); }

      .map-closebtn {
        flex: 0 0 auto;
        width: 50px; height: 50px; padding: 0;
        border: 0; border-radius: 16px;
        background: rgba(255,255,255,.94);
        color: #1c1c1e;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 16px rgba(0,0,0,.18);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .map-closebtn:active { transform: scale(.94); }

      .map-chips {
        position: absolute;
        left: 10px; right: 10px;
        bottom: calc(82px + env(safe-area-inset-bottom, 0px));
        z-index: 6;
        display: flex; gap: 8px; flex-wrap: wrap;
      }
      .map-chip {
        border: 0; cursor: pointer;
        padding: 9px 16px; border-radius: 999px;
        background: rgba(255,255,255,.94);
        color: #1c1c1e; font: inherit; font-size: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,.12);
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .map-chip:active { transform: scale(.95); }

      .map-fab {
        border: 0; cursor: pointer;
        height: 54px; padding: 0 20px;
        display: inline-flex; align-items: center; gap: 8px;
        border-radius: 999px;
        background: #0a84ff; color: #fff;
        font: inherit; font-size: 18px; font-weight: 600;
        box-shadow: 0 6px 20px rgba(10,132,255,.42);
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .map-fab:active { transform: scale(.96); }
      .map-fab--ghost {
        background: rgba(255,255,255,.95); color: #0a84ff;
        box-shadow: 0 4px 16px rgba(0,0,0,.18);
      }

      .map-zoom {
        position: absolute;
        right: 12px;
        bottom: calc(82px + env(safe-area-inset-bottom, 0px));
        z-index: 7;
        display: flex; flex-direction: column;
        border-radius: 14px; overflow: hidden;
        box-shadow: 0 4px 16px rgba(0,0,0,.22);
        background: rgba(255,255,255,.96);
      }
      .map-zoom button {
        width: 48px; height: 48px;
        border: 0; background: transparent;
        font: inherit; font-size: 26px; font-weight: 600; line-height: 1;
        color: #1c1c1e; cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        display: flex; align-items: center; justify-content: center;
      }
      .map-zoom button + button { border-top: 1px solid rgba(0,0,0,.08); }
      .map-zoom button:active { background: #eef2f7; }
      .map-zoom button svg { width: 22px; height: 22px; }

      .map-bottombar {
        position: absolute;
        left: 10px; right: 10px;
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        z-index: 7;
        display: flex; gap: 10px; align-items: stretch;
      }
      .map-searchbtn {
        flex: 1 1 auto; min-width: 0;
        display: flex; align-items: center; gap: 10px;
        height: 54px; padding: 0 18px;
        border: 0; border-radius: 18px;
        background: rgba(255,255,255,.96);
        color: #8a8a8e;
        box-shadow: 0 4px 18px rgba(0,0,0,.18);
        cursor: pointer;
        font: inherit; font-size: 18px;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .map-searchbtn span { color: #8a8a8e; }
      .map-searchbtn:active { transform: scale(.99); background: #f2f4f8; }
      .map-roundbtn {
        flex: 0 0 auto;
        width: 54px; height: 54px; padding: 0;
        border: 0; border-radius: 18px;
        background: rgba(255,255,255,.96);
        color: #0a84ff;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 18px rgba(0,0,0,.18);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .map-roundbtn:active { transform: scale(.94); }

      .map-me-dot {
        display: block; width: 18px; height: 18px;
        border-radius: 50%;
        background: #0a84ff;
        border: 3px solid #fff;
        box-shadow: 0 0 0 4px rgba(10,132,255,.28);
      }

      .map-mask {
        position: absolute; inset: 0; z-index: 10;
        display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 14px;
        background: #eef2f7; color: #6b7280;
        font-size: 20px; text-align: center; padding: 30px;
      }
      .map-spinner {
        width: 38px; height: 38px;
        border: 4px solid rgba(10,132,255,.2);
        border-top-color: #0a84ff;
        border-radius: 50%;
        animation: mapSpin .8s linear infinite;
      }
      @keyframes mapSpin { to { transform: rotate(360deg); } }

      /* ---------- 图层切换面板 ---------- */
      .map-layerpanel {
        position: absolute;
        top: calc(62px + var(--statusbar-h, 0px));
        right: 12px;
        z-index: 8;
        width: 168px;
        background: rgba(255,255,255,.97);
        border-radius: 16px;
        box-shadow: 0 8px 28px rgba(0,0,0,.22);
        padding: 8px;
        overflow: hidden;
      }
      .map-layerpanel[hidden] { display: none; }
      .map-layerpanel__title {
        font-size: 20px; color: #8a8a8e;
        padding: 7px 12px 9px;
      }
      .map-layer-item {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px;
        width: 100%; box-sizing: border-box;
        border: 0; background: transparent;
        padding: 13px 12px; border-radius: 12px;
        font: inherit; font-size: 18px; color: #1c1c1e;
        text-align: left; cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .map-layer-item:active { background: #eef2f7; }
      .map-layer-item.is-active { color: #0a84ff; font-weight: 600; }
      .map-layer-item__check { color: #0a84ff; flex: 0 0 auto; }

      /* ---------- 通用小号 spinner ---------- */
      .map-spinner--sm {
        width: 22px; height: 22px; border-width: 3px;
        border: 3px solid rgba(10,132,255,.2); border-top-color: #0a84ff;
        border-radius: 50%; animation: mapSpin .8s linear infinite;
      }

      /* ---------- 搜索子页 ---------- */
      .map-searchpage { position: absolute; inset: 0; z-index: 100; display: flex; flex-direction: column;
        background: #f2f3f5; }
      .map-sp__bar {
        flex: 0 0 auto;
        display: flex; align-items: center; gap: 10px;
        padding: calc(10px + var(--statusbar-h, 0px)) 12px 10px;
        background: rgba(255,255,255,.98);
        box-shadow: 0 2px 10px rgba(0,0,0,.08);
      }
      .map-sp__icon { flex: 0 0 auto; }
      .map-sp__input {
        flex: 1 1 auto; min-width: 0;
        height: 44px; padding: 0 14px;
        border: 0; border-radius: 12px; background: #eceef1;
        font: inherit; font-size: 18px; color: #1c1c1e;
        outline: 0; -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .map-sp__go {
        flex: 0 0 auto;
        height: 44px; padding: 0 18px;
        border: 0; border-radius: 12px;
        background: #0a84ff; color: #fff;
        font: inherit; font-size: 17px; font-weight: 600;
        cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
      }
      .map-sp__go:active { transform: scale(.96); }
      .map-sp__body {
        flex: 1 1 auto; overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 12px;
      }
      .map-sp__hint {
        color: #8a8a8e; font-size: 16px; text-align: center; padding: 30px 16px;
      }
      .map-sp__row {
        display: flex; align-items: center; gap: 12px;
        width: 100%; box-sizing: border-box;
        border: 0; background: #fff;
        padding: 16px; border-radius: 14px; margin-bottom: 10px;
        text-align: left; cursor: pointer;
        font: inherit; font-size: 18px; color: #1c1c1e;
        box-shadow: 0 1px 4px rgba(0,0,0,.05);
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
      }
      .map-sp__row:active { background: #f0f4f8; }
      .map-sp__name { flex: 1 1 auto; min-width: 0; }
      .map-sp__loading { justify-content: center; color: #8a8a8e; font-size: 16px; }

    `,

    routes: {
      home: {
        name: 'home',
        disableBackGesture: true,  // 地图需要横向拖拽平移，禁用系统返回手势避免冲突

        render() {
          return `
            <div class="map-page">
              <div id="mapC"></div>

              <div class="map-top">
                <button class="map-closebtn" id="mapCloseBtn" type="button" title="退出" aria-label="退出">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
                <button class="map-topbtn" id="mapLayerBtn" type="button" title="切换瓦片源">图层</button>
              </div>

              <div class="map-layerpanel" id="mapLayerPanel" hidden>
                <div class="map-layerpanel__title">瓦片源</div>
                <div id="mapLayerList"></div>
              </div>

              <div class="map-zoom" id="mapZoom">
                <button id="mapZoomIn" type="button" title="放大" aria-label="放大">+</button>
                <button id="mapZoomOut" type="button" title="缩小" aria-label="缩小">−</button>
              </div>

              <div class="map-chips" id="mapChips"></div>

              <div class="map-bottombar">
                <button class="map-searchbtn" id="mapSearchBtn" type="button">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                  <span>搜索城市 / 地点</span>
                </button>
                <button class="map-roundbtn" id="mapLocateBtn" type="button" title="定位到我的位置">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>
                </button>
              </div>

              <div class="map-mask" id="mapMask">
                <div class="map-spinner"></div>
                <div id="mapMaskText">正在加载地图组件…</div>
              </div>
            </div>
          `;
        },

        async mount(root, ctx) {
          const L0 = window.L;
          // 注入 Leaflet 关键定位样式到 Shadow 根（解决 Shadow DOM 样式隔离导致瓦片堆叠）
          const sr = root.getRootNode && root.getRootNode();
          if (sr && sr.nodeType === 11) {
            const crit = document.createElement('style');
            crit.dataset.leafletCrit = '1';
            crit.textContent = LEAFLET_CRIT_CSS;
            sr.appendChild(crit);
          }
          const mapEl    = root.querySelector('#mapC');
          const maskEl   = root.querySelector('#mapMask');
          const maskText = root.querySelector('#mapMaskText');
          const statusEl = root.querySelector('#mapStatus');
          const chipsEl  = root.querySelector('#mapChips');
          const locateBtn= root.querySelector('#mapLocateBtn');
          const searchBtn= root.querySelector('#mapSearchBtn');
          const layerBtn = root.querySelector('#mapLayerBtn');
          const layerPanel = root.querySelector('#mapLayerPanel');
          const layerList = root.querySelector('#mapLayerList');
          const closeBtn = root.querySelector('#mapCloseBtn');
          const zoomInBtn  = root.querySelector('#mapZoomIn');
          const zoomOutBtn = root.querySelector('#mapZoomOut');

          if (!mapEl) return () => {};

          let disposed = false;
          let map = null;
          let meMarker = null;
          let myWgsPos = null;          // 当前“我的位置”坐标（lat, lng）
          let myPosSys = 'wgs';         // 该坐标的系统：'wgs' 真实GPS，'gcj' 高德/CITY_DB
          let tileLayer = null;
          let overlayLayer = null;
          let currentSourceId = (window.Store && Store.get('map.tileSource', DEFAULT_SOURCE)) || DEFAULT_SOURCE;

          const getSource = id => TILE_SOURCES[id] || TILE_SOURCES[DEFAULT_SOURCE];
          const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };
          const toast = (m) => { try { window.WujiToast?.show(m); } catch {} };

          /* ---------- 退出应用（搜索框左侧叉号） ---------- */
          closeBtn?.addEventListener('click', () => {
            try { window.WujiAppLauncher?.close(); } catch { /* ignore */ }
          });

          /**
           * 把“真实坐标”转为当前瓦片源下的显示坐标（Leaflet 内部按 WGS-84 处理，
           * 但 GCJ 瓦片本身已偏移，所以：
           *   - 真实 GPS 为 WGS-84，投到 GCJ 瓦片需再纠偏一次；
           *   - 高德/CITY_DB 搜索结果本就是 GCJ-02，投到 GCJ 瓦片无需再纠偏，
           *     投到 WGS 瓦片则先反算回 WGS-84。
           * @param sys 'wgs'（真实 GPS）或 'gcj'（高德/CITY_DB 已纠偏坐标）
           */
          function toDisplay(lat, lng, sys) {
            const s = getSource(currentSourceId);
            const gcj = s.gcj;
            if (sys === 'gcj') {
              // 输入已是 GCJ-02
              if (gcj) return [lat, lng];
              const [wlng, wlat] = gcj02towgs84(lng, lat); // 返回 [lng, lat]
              return [wlat, wlng];
            }
            // sys === 'wgs'：输入是真实 WGS-84
            if (gcj) { const [glng, glat] = wgs84togcj02(lng, lat); return [glat, glng]; }
            return [lat, lng];
          }

          function showError(msg) {
            if (maskEl) { maskEl.style.display = 'flex'; if (maskText) maskText.textContent = msg; }
            const sp = maskEl?.querySelector('.map-spinner');
            if (sp) sp.style.display = 'none';
          }

          /* ---------- 预设城市胶囊 ---------- */
          if (chipsEl) {
            chipsEl.innerHTML = '';
            PRESETS.forEach(c => {
              const b = document.createElement('button');
              b.className = 'map-chip';
              b.type = 'button';
              b.textContent = c.name;
              b.addEventListener('click', () => {
                if (!map) return;
                map.flyTo(toDisplay(c.lat, c.lng, 'gcj'), 13, { duration: 0.8 });
                setStatus('已切换到 ' + c.name);
                try { if (navigator.vibrate) navigator.vibrate(15); } catch {}
              });
              chipsEl.appendChild(b);
            });
          }

          /* ---------- 自绘 +/- 缩放按钮 ---------- */
          zoomInBtn?.addEventListener('click', () => { try { map.zoomIn(); } catch {} });
          zoomOutBtn?.addEventListener('click', () => { try { map.zoomOut(); } catch {} });

          /* ---------- 放置 / 移动“我的位置”标记 ---------- */
          function placeMe(lat, lng, sys) {
            const useSys = sys || 'wgs';
            const disp = toDisplay(lat, lng, useSys);
            if (!meMarker) meMarker = L.marker(disp, { icon: myLocationIcon(L) }).addTo(map);
            else meMarker.setLatLng(disp);
          }

          /* ---------- 真实定位 ---------- */
          function locate(announce = true) {
            if (!navigator.geolocation) { fallbackToDefault('此浏览器不支持定位'); return; }
            if (announce) setStatus('正在定位…');
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (disposed || !map) return;
                const lat = pos.coords.latitude, lng = pos.coords.longitude;
                myWgsPos = [lat, lng];
                myPosSys = 'wgs';
                placeMe(lat, lng, 'wgs');
                map.flyTo(toDisplay(lat, lng, 'wgs'), 15, { duration: 0.9 });
                setStatus('已定位到您附近的位置');
                try { if (navigator.vibrate) navigator.vibrate(18); } catch {}
              },
              (err) => {
                if (disposed || !map) return;
                const reason = err && err.code === err.PERMISSION_DENIED
                  ? '定位权限被拒绝' : '定位失败';
                fallbackToDefault(reason);
              },
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            );
          }

          function fallbackToDefault(reason) {
            if (!map) return;
            map.flyTo(toDisplay(DEFAULT_CITY.lat, DEFAULT_CITY.lng, 'gcj'), 12, { duration: 0.8 });
            setStatus(`${reason}，已显示默认城市 ${DEFAULT_CITY.name}`);
            toast(`${reason}，显示${DEFAULT_CITY.name}`);
          }

          /* ---------- 飞到某坐标（搜索结果 / 城市胶囊共用） ---------- */
          function goToPlace(lat, lng, sys) {
            if (!map) return;
            myWgsPos = [lat, lng];
            myPosSys = sys || 'gcj';
            placeMe(lat, lng, sys || 'gcj');
            map.flyTo(toDisplay(lat, lng, sys || 'gcj'), 13, { duration: 0.8 });
          }
          // 仅飞过去，不改变「我的位置」大头针（搜索结果点选用）
          function flyToPlace(lat, lng, sys) {
            if (!map) return;
            map.flyTo(toDisplay(lat, lng, sys || 'gcj'), 13, { duration: 0.8 });
          }
          // 暴露给搜索子页调用：搜索结果点选后飞过去
          AppState.goToPlace = (lat, lng, sys) => goToPlace(lat, lng, sys || 'gcj');
          AppState.flyToPlace = (lat, lng, sys) => flyToPlace(lat, lng, sys || 'gcj');

          /* ---------- 底部按钮 ---------- */
          searchBtn?.addEventListener('click', () => {
            try { ctx?.push('search'); } catch (e) { console.warn('[map] push search', e); }
          });
          locateBtn?.addEventListener('click', () => locate(true));

          /* ---------- 图层切换面板 ---------- */
          function updateLayerPanel() {
            if (!layerList) return;
            layerList.innerHTML = '';
            Object.keys(TILE_SOURCES).forEach(id => {
              const s = TILE_SOURCES[id];
              const btn = document.createElement('button');
              btn.className = 'map-layer-item' + (id === currentSourceId ? ' is-active' : '');
              btn.type = 'button';
              btn.innerHTML = `<span>${s.name}</span>`
                + (id === currentSourceId
                  ? `<svg class="map-layer-item__check" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>`
                  : '');
              btn.addEventListener('click', () => {
                applySource(id);
                if (layerPanel) layerPanel.hidden = true;
              });
              layerList.appendChild(btn);
            });
          }
          layerBtn?.addEventListener('click', () => {
            if (!layerPanel) return;
            layerPanel.hidden = !layerPanel.hidden;
          });

          /* ---------- 应用瓦片源 ---------- */
          function applySource(id) {
            const s = getSource(id);
            currentSourceId = id;
            try { window.Store?.set('map.tileSource', id); } catch {}
            try { if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; } } catch {}
            try { if (tileLayer) { map.removeLayer(tileLayer); } } catch {}
            tileLayer = L.tileLayer(s.url, s.options || {});
            tileLayer.addTo(map);
            if (s.overlay) {
              overlayLayer = L.tileLayer(s.overlay, s.overlayOptions || {});
              overlayLayer.addTo(map);
            }
            // 防止当前缩放超过新源支持的最大级别
            const maxZ = (s.options && s.options.maxZoom) || 19;
            if (map.getZoom() > maxZ) map.setZoom(maxZ);
            // 源坐标系变了，重新投影“我的位置”标记
            if (myWgsPos && meMarker) {
              const [lat, lng] = myWgsPos;
              meMarker.setLatLng(toDisplay(lat, lng, myPosSys));
            }
            updateLayerPanel();
            setStatus('瓦片源：' + s.name);
          }

          /* ---------- 初始化 Leaflet ---------- */
          let L = L0;
          try {
            L = await loadLeaflet(sr && sr.nodeType === 11 ? sr : null);
          } catch (e) {
            console.error('[map]', e);
            showError('无法加载地图组件，请检查网络后重试');
            return () => { disposed = true; };
          }
          if (disposed) return () => {};
          if (maskEl) maskEl.style.display = 'none';

          const startCenter = toDisplay(DEFAULT_CITY.lat, DEFAULT_CITY.lng, 'gcj');
          map = L.map(mapEl, {
            center: startCenter,
            zoom: 12,
            zoomControl: false,
            attributionControl: true,
          });

          applySource(currentSourceId);
          updateLayerPanel();

          locate(false);
          setStatus('地图就绪，正在尝试定位…');

          // 应用由 OS 以滑入动画挂载：动画期间祖先元素带 transform，
          // Leaflet 在动画中量到的容器尺寸/像素原点是错的，会导致瓦片错位、重叠。
          // 动画结束（约 720ms）后强制重算尺寸并重置视图中心点。
          const fixSize = () => {
            try {
              map.invalidateSize({ animate: false });
              // 重新设定一次中心点，清除动画期残留的像素原点偏移
              map.setView(map.getCenter(), map.getZoom(), { animate: false });
            } catch {}
          };
          const ro = new ResizeObserver(fixSize);
          ro.observe(mapEl);
          [120, 400, 720, 1200].forEach(d => setTimeout(fixSize, d));

          return () => {
            disposed = true;
            try { ro.disconnect(); } catch {}
            try { if (map) map.remove(); } catch {}
            map = null;
          };
        },
      },

      /* ================= 搜索子页 ================= */
      search: {
        name: 'search',
        title: '搜索',
        render() {
          return `
            <div class="map-searchpage">
              <div class="map-sp__bar">
                <svg class="map-sp__icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#8a8a8e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                <input id="mapSearchInput" class="map-sp__input" type="search" placeholder="城市 / 地点" enterkeyhint="search" autocomplete="off" />
                <button id="mapSearchGo" class="map-sp__go" type="button">搜索</button>
              </div>
              <div class="map-sp__body" id="mapSearchBody">
                <div class="map-sp__hint">输入城市或地点，例如「杭州」「上海」</div>
              </div>
            </div>
          `;
        },
        mount(root, ctx) {
          /* 抬升搜索路由整体层级：首页是 animate:false 无 stacking context，
             其 #mapC(z:1) 等会泄漏进 navHost 上下文并被画在本地图上方；
             本路由带 slide 转场残留 transform，形成 z:auto 的 stacking context，
             需给路由本身一个高于首页子元素(最大 z:7)的 z-index 才能压住地图。 */
          root.style.zIndex = '100';
          const input = root.querySelector('#mapSearchInput');
          const goBtn = root.querySelector('#mapSearchGo');
          const body  = root.querySelector('#mapSearchBody');
          let busy = false;
          const renderResults = (results, note) => {
            if (!body) return;
            if (busy) {
              body.innerHTML = `<div class="map-sp__row map-sp__loading"><span class="map-spinner map-spinner--sm"></span> 搜索中…</div>`;
              return;
            }
            if (note) {
              body.innerHTML = `<div class="map-sp__hint">${escapeHtml(note)}</div>`;
              return;
            }
            if (!results.length) {
              body.innerHTML = `<div class="map-sp__hint">没有找到相关结果</div>`;
              return;
            }
            body.innerHTML = results.map((r, i) => `
              <button class="map-sp__row" data-i="${i}" type="button">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0a84ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.7-7-12a7 7 0 0 1 14 0c0 5.3-7 12-7 12z"/><circle cx="12" cy="9" r="2.6"/></svg>
                <span class="map-sp__name">${escapeHtml(r.name)}</span>
              </button>
            `).join('');
            body.querySelectorAll('.map-sp__row[data-i]').forEach(el => {
              const r = results[+el.dataset.i];
              el.addEventListener('click', () => {
                try { AppState.flyToPlace?.(r.lat, r.lng, r.sys); } catch {}
                try { ctx?.pop(); } catch (e) { console.warn('[map] pop', e); }
              });
            });
          };
          const doSearch = async () => {
            const q = (input && input.value || '').trim();
            if (!q) return;
            busy = true; renderResults([], '');
            const { results, note } = await geocode(q);
            busy = false;
            if (!body) return;
            renderResults(results, note);
          };
          input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
          });
          goBtn?.addEventListener('click', doSearch);
          // 进入即聚焦
          setTimeout(() => { try { input?.focus(); } catch {} }, 250);
          return () => {};
        },
      },
    },
  });
})();
