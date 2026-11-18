/* =========================================================
   主题清单
   SYSTEM_THEMES：内置主题（随 OS 发布，不可删除）
   STORE_THEMES ：主题市场（需下载）
   注意：src 指向 .js（主题脚本），不再是 .html

   ★ 轻量主题约定（务必遵守）：
     主题只允许使用「纯 CSS 伪元素 / background:url('png') / 纯色或渐变背景」，
     禁止 canvas、requestAnimationFrame 逐帧绘制、WebGL 等重绘方案，避免滚动时
     性能骤降。交互（如笑脸移动）请用 CSS transform + CSS 变量 calc 驱动，
     JS 只在状态变化时写一个变量值，不做逐帧布局。
   ========================================================= */

/* 商城缩略图（inline SVG，零额外请求） */
const NIULI_IMG = (c1, c2) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="60" height="80" fill="url(#g)"/>
    <circle cx="30" cy="40" r="16" fill="#fff" opacity=".12"/>
  </svg>`
);

window.SYSTEM_THEMES = [
  {
    id: 'niu-blue',
    name: '牛逼蓝',
    author: 'Wuji',
    version: '1.0.0',
    description: '深蓝光影',
    longdescription: '系统主题',
    src: 'themes/blue/theme.js',
    storeimg: NIULI_IMG('#0a1c4a', '#12306e'),
  },
  {
    id: 'niu-red',
    name: '牛逼红',
    author: 'Wuji',
    version: '1.0.0',
    description: '酒红光影',
    longdescription: '系统主题',
    src: 'themes/red/theme.js',
    storeimg: NIULI_IMG('#4a0c1c', '#7d1830'),
  },
  {
    id: 'sea',
    name: '海景',
    author: 'Wuji',
    version: '1.0.0',
    description: '宁静的海面',
    longdescription: '经典主题',
    src:      'themes/sea/theme.js',
    storeimg: 'themes/sea/static.png',
  },
];

window.STORE_THEMES = [
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
    storeimg: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
        <defs><radialGradient id="f" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#fff1a0"/><stop offset="100%" stop-color="#f2bb16"/>
        </radialGradient></defs>
        <rect width="60" height="80" fill="#955809"/>
        <circle cx="30" cy="42" r="20" fill="url(#f)" stroke="#000" stroke-width="3"/>
        <circle cx="23" cy="37" r="2.4" fill="#000"/><circle cx="37" cy="37" r="2.4" fill="#000"/>
        <path d="M18 44 Q30 60 42 44" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
      </svg>`
    ),
  },
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
];
