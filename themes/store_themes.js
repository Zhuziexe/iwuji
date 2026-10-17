window.SYSTEM_THEMES = [
  {
    id: 'sea',
    name: '海景',
    author: 'Wuji',
    version: '1.0.0',
    description: '宁静的海面',
    longdescription: '静态壁纸，适合日常使用。',
    src:   'themes/sea/index.html',
    static:  'themes/sea/static.png',
    storeimg:'themes/sea/store.png',
  },
];

window.STORE_THEMES = [
  {
    id: 'aurora',
    name: '极光',
    author: 'Wuji',
    version: '1.0.0',
    description: '流动的极光粒子',
    longdescription: '动态壁纸，会随解锁进度变化。',
    src:   'themes/aurora/index.html',
    static:  'themes/aurora/static.png',
    storeimg:'themes/aurora/store.png',
  },
    {
    id: 'sunrise',
    name: '日出',
    author: 'Wuji',
    version: '1.0.0',
    description: '晨曦初露',
    longdescription: '纯 CSS 绘制的日出，解锁时太阳会从地平线升起，天空随之变亮。',
    src: 'themes/sunrise/index.html',
    storeimg: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stop-color="#3a2a4a"/>
            <stop offset="50%" stop-color="#d47a5a"/>
            <stop offset="100%" stop-color="#ffd9a0"/>
          </linearGradient>
        </defs>
        <rect width="60" height="80" fill="url(#sky)"/>
        <circle cx="30" cy="52" r="14" fill="#ffd76a"/>
        <rect y="58" width="60" height="22" fill="#1a1020"/>
        <rect y="57" width="60" height="1" fill="#ffd9a0" opacity=".7"/>
      </svg>`
    ),
  },
  {
    id: 'starfield',
    name: '星空',
    author: 'Wuji',
    version: '1.0.0',
    description: '静谧星空',
    longdescription: '纯 CSS 绘制的星空，解锁时星星会向上飘移并变亮。',
    src: 'themes/starfield/index.html',
    storeimg: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
        <defs>
          <radialGradient id="bg" cx="50%" cy="100%" r="100%">
            <stop offset="0%" stop-color="#0d1733"/>
            <stop offset="100%" stop-color="#000000"/>
          </radialGradient>
        </defs>
        <rect width="60" height="80" fill="url(#bg)"/>
        <circle cx="10" cy="15" r="1"   fill="#ffffff"/>
        <circle cx="25" cy="8"  r="0.8" fill="#ffffff"/>
        <circle cx="45" cy="22" r="1.2" fill="#ffffff"/>
        <circle cx="38" cy="45" r="0.9" fill="#ffffff"/>
        <circle cx="15" cy="55" r="1"   fill="#ffffff"/>
        <circle cx="30" cy="30" r="1.1" fill="#ffffff"/>
        <circle cx="52" cy="60" r="0.7" fill="#ffffff"/>
        <circle cx="48" cy="16" r="6"   fill="#fffbe8" opacity="0.92"/>
      </svg>`
    ),
  },
];