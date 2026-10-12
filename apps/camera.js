WujiApps.register({
  bundlename: 'com.wujios.camera',
  name: '相机',
  icon: './assets/camera.svg',

  styles: `
    .msg-item { padding: 12px 0; border-bottom: .5px solid var(--wj-border); }
    .msg-head { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .msg-from { color: var(--wj-text); font-size: var(--wj-fs-md); font-weight: 600; }
    .msg-time { color: var(--wj-text-dim); font-size: var(--wj-fs-xs); }
  `,

  render() {
    return `
      <h2 class="wj-title">相机</h2>`;
  },
});