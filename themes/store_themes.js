/* =========================================================
   主题清单
   SYSTEM_THEMES：内置主题（随 OS 发布，不可删除）
   STORE_THEMES ：主题市场（需下载）
   注意：src 现在指向 .js（主题脚本），不再是 .html
   ========================================================= */

window.SYSTEM_THEMES = [
  {
    id: 'sea',
    name: '海景',
    author: 'Wuji',
    version: '1.0.0',
    description: '宁静的海面',
    longdescription: '静态壁纸，适合日常使用。',
    src:      'themes/sea/theme.js',
    storeimg: 'themes/sea/store.png',
  },
  {
    id: 'aurora',
    name: '极光',
    author: 'Wuji',
    version: '1.0.0',
    description: '流动的极光粒子',
    longdescription: '动态壁纸，会随解锁进度变化。',
    src:      'themes/aurora/theme.js',
    storeimg: 'themes/aurora/store.png',
  },
];

window.STORE_THEMES = [
  {
    id: 'sunrise',
    name: '日出',
    author: 'Wuji',
    version: '1.0.0',
    description: '晨曦初露',
    longdescription: '纯 CSS 绘制的日出，解锁时太阳升起、天空变亮。',
    src:      'themes/sunrise/theme.js',
    storeimg: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
        <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stop-color="#3a2a4a"/>
          <stop offset="50%" stop-color="#d47a5a"/>
          <stop offset="100%" stop-color="#ffd9a0"/>
        </linearGradient></defs>
        <rect width="60" height="80" fill="url(#s)"/>
        <circle cx="30" cy="52" r="14" fill="#ffd76a"/>
        <rect y="58" width="60" height="22" fill="#1a1020"/>
      </svg>`
    ),
  },
  {
    id: 'bamboo',
    name: '竹林',
    author: 'Zhuzi',
    version: '1.0.0',
    description: '竹林',
    longdescription: '竹林壁纸',
    src:      'themes/bamboo/theme.js',
    storeimg: 'themes/bamboo/static.png'
  },
  {
    id: 'wujiniubee',
    name: '吴际牛逼',
    author: 'Wuji',
    version: '1.0.0',
    description: '吴际牛逼',
    longdescription: '有 点 牛 逼',
    src:      'themes/nb/theme.js',
    storeimg: 'themes/nb/store.png',
  },
  {
    id: 'starfield',
    name: '星空',
    author: 'Wuji',
    version: '1.0.0',
    description: '静谧星空',
    longdescription: '纯 CSS 绘制的星空，解锁时星星上移、变亮。',
    src:      'themes/starfield/theme.js',
    storeimg: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
        <defs><radialGradient id="b" cx="50%" cy="100%" r="100%">
          <stop offset="0%" stop-color="#0d1733"/>
          <stop offset="100%" stop-color="#000"/>
        </radialGradient></defs>
        <rect width="60" height="80" fill="url(#b)"/>
        <circle cx="10" cy="15" r="1"   fill="#fff"/>
        <circle cx="45" cy="22" r="1.2" fill="#fff"/>
        <circle cx="38" cy="45" r="0.9" fill="#fff"/>
        <circle cx="15" cy="55" r="1"   fill="#fff"/>
        <circle cx="30" cy="30" r="1.1" fill="#fff"/>
        <circle cx="48" cy="16" r="6"   fill="#fffbe8" opacity=".92"/>
      </svg>`
    ),
  },
];