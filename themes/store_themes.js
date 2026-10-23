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
  {
    id: 'ink',
    name: '墨',
    author: 'Wuji',
    version: '1.0.0',
    description: '极简墨色',
    longdescription: '纯黑底色，两团缓慢漂浮的墨色光晕。适合不打扰的日常使用。',
    src: 'themes/ink/theme.js',
    storeimg: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
        <rect width="60" height="80" fill="#08080a"/>
        <radialGradient id="i1" cx="30%" cy="30%" r="40%">
          <stop offset="0%" stop-color="#5a5a62" stop-opacity=".6"/>
          <stop offset="100%" stop-color="#5a5a62" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="i2" cx="70%" cy="75%" r="35%">
          <stop offset="0%" stop-color="#3a3a42" stop-opacity=".55"/>
          <stop offset="100%" stop-color="#3a3a42" stop-opacity="0"/>
        </radialGradient>
        <rect width="60" height="80" fill="url(#i1)"/>
        <rect width="60" height="80" fill="url(#i2)"/>
      </svg>`
    ),
  },
  {
    id: 'cyber',
    name: '赛博朋克',
    author: 'Wuji',
    version: '1.0.0',
    description: '霓虹网格',
    longdescription: '深紫背景、霓虹青与粉色光晕、滚动的透视网格和扫描线。时钟用青色发光显示。',
    src: 'themes/cyber/theme.js',
    storeimg: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">' +
        '<defs>' +
          '<linearGradient id="c" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%"  stop-color="#0a0014"/>' +
            '<stop offset="100%" stop-color="#1a0030"/>' +
          '</linearGradient>' +
          '<radialGradient id="g1" cx="10%" cy="10%" r="45%">' +
            '<stop offset="0%" stop-color="#00e5ff" stop-opacity=".8"/>' +
            '<stop offset="100%" stop-color="#00e5ff" stop-opacity="0"/>' +
          '</radialGradient>' +
          '<radialGradient id="g2" cx="90%" cy="90%" r="45%">' +
            '<stop offset="0%" stop-color="#ff3d9a" stop-opacity=".8"/>' +
            '<stop offset="100%" stop-color="#ff3d9a" stop-opacity="0"/>' +
          '</radialGradient>' +
        '</defs>' +
        '<rect width="60" height="80" fill="url(#c)"/>' +
        '<rect width="60" height="80" fill="url(#g1)"/>' +
        '<rect width="60" height="80" fill="url(#g2)"/>' +
        '<g stroke="#00e5ff" stroke-width=".3" opacity=".5">' +
          '<line x1="0" y1="55" x2="60" y2="55"/>' +
          '<line x1="0" y1="62" x2="60" y2="62"/>' +
          '<line x1="0" y1="70" x2="60" y2="70"/>' +
          '<line x1="15" y1="55" x2="5"  y2="80"/>' +
          '<line x1="30" y1="55" x2="30" y2="80"/>' +
          '<line x1="45" y1="55" x2="55" y2="80"/>' +
        '</g>' +
      '</svg>'
    ),
  },
  {
    id: 'firefly',
    name: '萤火虫',
    author: 'Wuji',
    version: '1.0.0',
    description: '萤火虫森林',
    longdescription: '墨绿渐变夜空、底部雾气、十几只缓慢飘动的萤火虫。安静而不喧闹。',
    src: 'themes/firefly/theme.js',
    storeimg: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">' +
        '<defs>' +
          '<linearGradient id="f" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%"  stop-color="#0a1410"/>' +
            '<stop offset="50%" stop-color="#102018"/>' +
            '<stop offset="100%" stop-color="#0a1810"/>' +
          '</linearGradient>' +
          '<radialGradient id="fog" cx="50%" cy="100%" r="50%">' +
            '<stop offset="0%" stop-color="#6e9666" stop-opacity=".3"/>' +
            '<stop offset="100%" stop-color="#6e9666" stop-opacity="0"/>' +
          '</radialGradient>' +
        '</defs>' +
        '<rect width="60" height="80" fill="url(#f)"/>' +
        '<circle cx="12" cy="20" r="2"   fill="#b4ff8c" opacity=".9"/>' +
        '<circle cx="12" cy="20" r="5"   fill="#b4ff8c" opacity=".2"/>' +
        '<circle cx="42" cy="30" r="1.6" fill="#b4ff8c" opacity=".85"/>' +
        '<circle cx="42" cy="30" r="4"   fill="#b4ff8c" opacity=".15"/>' +
        '<circle cx="25" cy="48" r="1.8" fill="#b4ff8c" opacity=".8"/>' +
        '<circle cx="25" cy="48" r="4.5" fill="#b4ff8c" opacity=".15"/>' +
        '<circle cx="48" cy="58" r="1.4" fill="#b4ff8c" opacity=".7"/>' +
        '<circle cx="48" cy="58" r="3.5" fill="#b4ff8c" opacity=".12"/>' +
        '<circle cx="10" cy="68" r="1.6" fill="#b4ff8c" opacity=".75"/>' +
        '<circle cx="10" cy="68" r="4"   fill="#b4ff8c" opacity=".15"/>' +
        '<rect y="50" width="60" height="30" fill="url(#fog)"/>' +
      '</svg>'
    ),
  },
];