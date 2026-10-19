/* =========================================================
   dialog.js —— 全局对话框

   用法：
     WujiDialog.show({
       bundlename: 'com.wujios.settings',
       title: '删除主题',
       content: '确定要删除主题「极光」吗？',
       buttons: [
         { value: '取消', color: 'var(--wj-primary)' },
         { value: '删除', color: 'var(--wj-danger)' },
       ],
     }).then(res => { if (res === '删除') { ... } });

   特点：
     - 有 bundlename 字段，应用被关闭/替换时通过 closeByBundle 自动关闭
     - 无法左滑关闭，必须点按钮
     - backdrop 会拦截所有触摸，阻止返回手势穿透
   ========================================================= */
window.WujiDialog = (() => {
  let hostEl = null;
  let active = null;   /* { backdrop, resolve, bundle } */

  function ensureHost() {
    if (hostEl && hostEl.isConnected) return hostEl;
    hostEl = document.createElement('div');
    hostEl.id = 'wjDialogHost';
    hostEl.style.cssText =
      'position:absolute;inset:0;z-index:500;display:none;pointer-events:none;';
    const os = document.getElementById('os') || document.body;
    os.appendChild(hostEl);
    return hostEl;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  function dismiss(entry, value) {
    if (!entry || !entry.backdrop) {
      if (entry && typeof entry.resolve === 'function') entry.resolve(null);
      return;
    }
    const { backdrop, resolve } = entry;
    backdrop.classList.remove('is-show');
    setTimeout(() => {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (!active && hostEl) hostEl.style.display = 'none';
    }, 220);
    if (typeof resolve === 'function') resolve(value);
  }

  async function show(opts) {
    if (!opts || typeof opts !== 'object') return null;

    if (active) {
      dismiss(active, null);
      active = null;
    }

    const host = ensureHost();
    host.style.display = 'block';

    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'wj-dialog-backdrop';

      const btns = Array.isArray(opts.buttons) ? opts.buttons : [];
      const buttonsHtml = btns.map((b, i) => {
        const color = b.color || 'var(--wj-primary, #3a6ff0)';
        return `<button class="wj-dialog__btn" data-idx="${i}" type="button" style="color:${esc(color)}">${esc(b.value || '')}</button>`;
      }).join('');

      const titleHtml   = opts.title   ? `<div class="wj-dialog__title">${esc(opts.title)}</div>` : '';
      const contentHtml = opts.content ? `<div class="wj-dialog__content">${esc(opts.content)}</div>` : '';

      backdrop.innerHTML = `
        <div class="wj-dialog" role="dialog" aria-modal="true">
          ${titleHtml}
          ${contentHtml}
          <div class="wj-dialog__actions">${buttonsHtml}</div>
        </div>
      `;

      host.appendChild(backdrop);

      const stop = e => e.stopPropagation();
      backdrop.addEventListener('touchstart', stop, { passive: true });
      backdrop.addEventListener('touchmove',  stop, { passive: true });
      backdrop.addEventListener('pointerdown', stop, { passive: true });
      backdrop.addEventListener('pointermove', stop, { passive: true });

      const entry = { backdrop, resolve, bundle: opts.bundlename || '' };
      active = entry;

      backdrop.addEventListener('click', async e => {
        e.stopPropagation();
        const btnEl = e.target.closest('.wj-dialog__btn');
        if (!btnEl || btnEl.disabled) return;
        btnEl.disabled = true;

        const idx = +btnEl.dataset.idx;
        const def = btns[idx];
        if (!def) return;

        const value = def.value;
        active = null;
        dismiss(entry, value);

        if (typeof def.action === 'function') {
          try { await def.action(value); }
          catch (err) { console.error('[WujiDialog] action 失败', err); }
        }
      }, true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          backdrop.classList.add('is-show');
        });
      });
    });
  }

  function close() {
    if (!active) return;
    const entry = active;
    active = null;
    dismiss(entry, null);
  }

  function closeByBundle(bundle) {
    if (!active || !bundle) return;
    if (active.bundle === bundle) close();
  }

  return {
    show,
    close,
    closeByBundle,
    get isOpen() { return active !== null; },
    get current() { return active; },
  };
})();