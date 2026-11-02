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

   带输入框：
     WujiDialog.show({
       title: '重命名',
       input: { value: '旧名称', placeholder: '输入新名称' },
       buttons: [
         { value: '取消' },
         {
           value: '确定',
           primary: true,
           validate(v) {
             const name = String(v ?? '').trim();
             if (!name) return '名称不能为空';
             if (/[\\/:*?"<>|]/.test(name)) return '名称不能包含 \\ / : * ? " < > |';
             return '';
           },
         },
       ],
     }).then(res => {
       if (res && res.button === '确定') { const newName = res.value.trim(); ... }
     });

   返回值：
     - 无 input：resolve 按钮的 value（字符串），和原来一致
     - 有 input：resolve { button, value }
     - close() / 被替换：resolve(null)

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
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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
        const cls = 'wj-dialog__btn' + (b.primary ? ' wj-dialog__btn--primary' : '');
        return `<button class="${cls}" data-idx="${i}" type="button" style="color:${esc(color)}">${esc(b.value || '')}</button>`;
      }).join('');

      // 图标：只有路径形式才渲染，空串 / null / undefined / emoji 都不显示
      const iconSrc = opts.icon && /^(https?:|data:|\.{1,2}\/|\/)/.test(String(opts.icon))
        ? String(opts.icon)
        : '';
      const iconHtml = iconSrc
        ? `<div style="width:56px;height:56px;margin:0 auto 14px;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--wj-bg-alt,#eef1f6);box-shadow:0 2px 8px rgba(0,0,0,.06);">
       <img src="${esc(iconSrc)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">
     </div>`
        : '';

      const titleHtml = opts.title ? `<div class="wj-dialog__title">${esc(opts.title)}</div>` : '';
      const contentHtml = opts.content ? `<div class="wj-dialog__content">${esc(opts.content)}</div>` : '';

      // 输入框
      const inputOpt = (opts.input && typeof opts.input === 'object') ? opts.input : null;
      const inputHtml = inputOpt
        ? `<div class="wj-dialog__field">
     <input class="wj-dialog__input"
            type="${esc(inputOpt.type || 'text')}"
            value="${esc(inputOpt.value == null ? '' : inputOpt.value)}"
            placeholder="${esc(inputOpt.placeholder || '')}"
            autocomplete="off" autocapitalize="off" spellcheck="false">
     <div class="wj-dialog__error"></div>
   </div>`
        : '';

      backdrop.innerHTML = `
  <div class="wj-dialog" role="dialog" aria-modal="true">
    ${iconHtml}
    ${titleHtml}
    ${contentHtml}
    ${inputHtml}
    <div class="wj-dialog__actions">${buttonsHtml}</div>
  </div>
`;

      host.appendChild(backdrop);

      const stop = e => e.stopPropagation();
      backdrop.addEventListener('touchstart', stop, { passive: true });
      backdrop.addEventListener('touchmove', stop, { passive: true });
      backdrop.addEventListener('pointerdown', stop, { passive: true });
      backdrop.addEventListener('pointermove', stop, { passive: true });

      const entry = { backdrop, resolve, bundle: opts.bundlename || '' };
      active = entry;

      const inputEl = backdrop.querySelector('.wj-dialog__input');
      const errEl = backdrop.querySelector('.wj-dialog__error');

      function clearError() {
        if (!errEl) return;
        errEl.textContent = '';
        errEl.style.display = 'none';
      }
      function showError(msg) {
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }

      if (inputEl) {
        inputEl.addEventListener('input', clearError);
      }

      backdrop.addEventListener('click', async e => {
        e.stopPropagation();
        const btnEl = e.target.closest('.wj-dialog__btn');
        if (!btnEl || btnEl.disabled) return;
        btnEl.disabled = true;

        const idx = +btnEl.dataset.idx;
        const def = btns[idx];
        if (!def) return;

        const rawValue = inputEl ? inputEl.value : undefined;

        // 校验（只有带 input 且按钮定义了 validate 时才执行）
        if (inputEl && typeof def.validate === 'function') {
          let msg = '';
          try {
            msg = def.validate(rawValue, def.value) || '';
          } catch (err) {
            console.error('[WujiDialog] validate 异常', err);
            msg = '输入无效';
          }
          if (msg) {
            showError(msg);
            btnEl.disabled = false;
            if (inputEl) inputEl.focus();
            return;
          }
        }

        active = null;

        const out = inputEl
          ? { button: def.value, value: rawValue }
          : def.value;

        dismiss(entry, out);

        if (typeof def.action === 'function') {
          try { await def.action(out); }
          catch (err) { console.error('[WujiDialog] action 失败', err); }
        }
      }, true);

      // Enter 确认（有输入框时）：触发 primary 按钮，没有 primary 则触发最后一个按钮
      if (inputEl) {
        backdrop.addEventListener('keydown', e => {
          if (e.key !== 'Enter' || e.isComposing) return;
          e.preventDefault();
          const btnEls = backdrop.querySelectorAll('.wj-dialog__btn');
          if (!btnEls.length) return;
          const primary = backdrop.querySelector('.wj-dialog__btn--primary')
            || btnEls[btnEls.length - 1];
          if (primary && !primary.disabled) primary.click();
        });
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          backdrop.classList.add('is-show');
          if (inputEl) {
            inputEl.focus();
            try { inputEl.select(); } catch (_) { /* ignore */ }
          }
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