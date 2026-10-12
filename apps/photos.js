const PHOTOS = [
  { emoji: '🌅', name: '日出', bg: 'linear-gradient(160deg,#ffd36e,#f08a2c)' },
  { emoji: '🌄', name: '山景', bg: 'linear-gradient(160deg,#ffb37a,#e0632a)' },
  { emoji: '🌊', name: '海浪', bg: 'linear-gradient(160deg,#8ad4ff,#3a6ff0)' },
  { emoji: '🏙️', name: '城市', bg: 'linear-gradient(160deg,#a9b8ff,#5a5ae0)' },
  { emoji: '🌳', name: '大树', bg: 'linear-gradient(160deg,#5ee08a,#22a35a)' },
  { emoji: '⛰️', name: '高山', bg: 'linear-gradient(160deg,#c3cad6,#7b8798)' },
  { emoji: '🌸', name: '樱花', bg: 'linear-gradient(160deg,#ffb3d1,#e0356b)' },
  { emoji: '🌙', name: '月亮', bg: 'linear-gradient(160deg,#a9b8ff,#3a3fa0)' },
  { emoji: '⭐', name: '星星', bg: 'linear-gradient(160deg,#ffe08a,#e0a035)' },
  { emoji: '🍎', name: '苹果', bg: 'linear-gradient(160deg,#ff9f8f,#e03030)' },
  { emoji: '🍊', name: '橘子', bg: 'linear-gradient(160deg,#ffc76e,#e08a20)' },
  { emoji: '🍇', name: '葡萄', bg: 'linear-gradient(160deg,#c39fff,#6a3fe0)' },
  { emoji: '🍓', name: '草莓', bg: 'linear-gradient(160deg,#ff9fb0,#e0356b)' },
  { emoji: '🍕', name: '披萨', bg: 'linear-gradient(160deg,#ffb86e,#e07020)' },
  { emoji: '🍔', name: '汉堡', bg: 'linear-gradient(160deg,#ffcf8a,#c08030)' },
  { emoji: '🍣', name: '寿司', bg: 'linear-gradient(160deg,#ffb3b0,#e05050)' },
  { emoji: '☕', name: '咖啡', bg: 'linear-gradient(160deg,#c09060,#805030)' },
  { emoji: '🐱', name: '小猫', bg: 'linear-gradient(160deg,#ffb88a,#e07020)' },
  { emoji: '🐶', name: '小狗', bg: 'linear-gradient(160deg,#dab888,#a06030)' },
  { emoji: '🐼', name: '熊猫', bg: 'linear-gradient(160deg,#e8e8e8,#888888)' },
  { emoji: '🦊', name: '狐狸', bg: 'linear-gradient(160deg,#ffb06a,#d05000)' },
  { emoji: '🐳', name: '鲸鱼', bg: 'linear-gradient(160deg,#8ad4ff,#2050b0)' },
  { emoji: '🦋', name: '蝴蝶', bg: 'linear-gradient(160deg,#a9b8ff,#5a5ae0)' },
  { emoji: '🌈', name: '彩虹', bg: 'linear-gradient(160deg,#ff9fb0,#a9b8ff)' },
  { emoji: '🎈', name: '气球', bg: 'linear-gradient(160deg,#ff9fb0,#e0356b)' },
];

WujiApps.register({
  bundlename: 'com.wujios.photos',
  name: '图库',
  icon: './assets/photos.svg',
  initialRoute: 'home',

  styles: `
    .photos-page {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      padding: calc(var(--wj-pad) + var(--statusbar-h)) var(--wj-pad) var(--wj-pad);
      background: var(--wj-bg);
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 12px;
      padding-bottom: 12px;
    }

    .photos-cell {
      aspect-ratio: 1;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform .12s;
      box-shadow: 0 4px 10px rgba(15,20,45,.12);
      user-select: none;
      -webkit-user-select: none;
    }
    .photos-cell:active { transform: scale(.92); }

    .photos-cell__emoji {
      font-size: 36px;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,.2));
    }

    .photos-detail {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: var(--wj-pad);
      background: var(--wj-bg);
    }

    .photos-detail__card {
      width: 70%;
      aspect-ratio: 1;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 50px rgba(15,20,45,.3);
      animation: photosDetailIn .4s cubic-bezier(.2,.7,.3,1);
    }

    @keyframes photosDetailIn {
      from { transform: scale(.85); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }

    .photos-detail__emoji {
      font-size: 96px;
      line-height: 1;
      filter: drop-shadow(0 4px 10px rgba(0,0,0,.25));
    }

    .photos-detail__name {
      font-size: var(--wj-fs-lg);
      color: var(--wj-text);
      font-weight: 600;
    }
  `,

  routes: {
    home: {
      render() {
        return `
          <div class="photos-page">
            <h2 class="wj-title">照片</h2>
            <div class="photos-grid" id="photosGrid">
              ${PHOTOS.map((p, i) => `
                <div class="photos-cell" data-index="${i}" style="background:${p.bg}">
                  <span class="photos-cell__emoji">${p.emoji}</span>
                </div>
              `).join('')}
            </div>
          </div>`;
      },

      mount(root, ctx) {
        const grid = root.querySelector('#photosGrid');
        grid.addEventListener('click', e => {
          const cell = e.target.closest('.photos-cell');
          if (!cell) return;
          ctx.push('detail', { index: +cell.dataset.index });
        });
      },
    },

    detail: {
      render(routeCtx) {
        const photo = PHOTOS[routeCtx.data.index] || PHOTOS[0];
        return `
          <div class="photos-detail">
            <div class="photos-detail__card" style="background:${photo.bg}">
              <div class="photos-detail__emoji">${photo.emoji}</div>
            </div>
            <div class="photos-detail__name">${photo.name}</div>
          </div>`;
      },
    },
  },
});