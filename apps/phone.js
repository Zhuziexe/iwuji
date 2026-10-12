WujiApps.register({
  bundlename: 'com.wujios.phone',
  name: '电话',
  icon: './assets/phone.svg',

  render() {
    const recent = Store.get('phone.recent', ['138****8888', '10086', '400-000-0000']);
    return `
      <h2 class="wj-title">最近通话</h2>
      ${recent.map(n => `
        <div class="wj-kv">
          <span>${n}</span>
          <span style="color:var(--wj-text-dim);font-weight:400">刚刚</span>
        </div>`).join('')}
      <div style="margin-top:16px">
        <button class="wj-btn wj-btn--primary" data-act="call">拨号</button>
      </div>`;
  },

  mount(root) {
    root.querySelector('[data-act="call"]')?.addEventListener('click', () => {
      alert('演示：拨号中…');
    });
  },
});