/* =========================================================
   dialog.js —— 全局对话框（挂载在「对应应用」内）

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
     - close() / 被替换 / 侧滑关闭：resolve(null)

   特点（重要）：
     - 弹窗 DOM 挂在「对应应用的 ShadowRoot / DOM」里，而不是全局覆盖层：
       · 只在对应应用/窗口内居中显示
       · 切到别的应用时随之隐藏，切回来还在
       · backdrop 只覆盖该应用/窗口，不影响侧滑返回/多任务手势
     - 宿主 Shell 通过 WujiDialog.setHostProvider(provider) 提供
       「当前应用根节点」；provider(bundle) 返回 { root, bundle } 或 null。
       找不到应用根节点时回退到 #os / body（系统级弹窗，如卸载确认）。
     - 有 bundlename 字段，应用被关闭/替换时通过 closeByBundle 自动关闭
     - dismissBySwipe()：侧滑返回手势优先关闭当前弹窗（resolve(null)）
     - 不再 stopPropagation 触摸事件 —— 手势交给系统正常处理
   ========================================================= */
window.WujiDialog = (() => {
  let active = null;          /* { backdrop, resolve, bundle } */
  let hostProvider = null;    /* function(bundle) -> { root, bundle } | null */
  let fallbackHost = null;    /* 系统级弹窗的兜底宿主 */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function ensureFallbackHost() {
    if (fallbackHost && fallbackHost.isConnected) return fallbackHost;
    fallbackHost = document.createElement('div');
    fallbackHost.id = 'wjDialogFallbackHost';
    fallbackHost.style.cssText = 'position:absolute;inset:0;z-index:500;pointer-events:none;';
    const os = document.getElementById('os') || document.body;
    os.appendChild(fallbackHost);
    return fallbackHost;
  }

  /** Shell 注入：返回当前应用的挂载根节点（ShadowRoot 或普通元素） */
  function setHostProvider(provider) {
    hostProvider = typeof provider === 'function' ? provider : null;
  }

  function hostFor(bundle) {
    let info = null;
    if (hostProvider) {
      try { info = hostProvider(bundle); } catch { info = null; }
    }
    if (info && info.root && typeof info.root.appendChild === 'function') {
      /* 同一个宿主里附一个透明层，让 backdrop 的 position:absolute 填满它。
         pointer-events:none 让手势穿透到宿主；backdrop 自己是 auto。 */
      let layer = info.root.querySelector(':scope > #wjDialogLayer');
      if (!layer) {
        layer = info.root.ownerDocument.createElement('div');
        layer.id = 'wjDialogLayer';
        layer.style.cssText = 'position:absolute;inset:0;z-index:900;pointer-events:none;';
        info.root.appendChild(layer);
      }
      return layer;
    }
    return ensureFallbackHost();
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
    }, 220);
    if (typeof resolve === 'function') resolve(value);
  }

  async function show(opts) {
    if (!opts || typeof opts !== 'object') return null;

    if (active) {
      const prev = active;
      active = null;
      dismiss(prev, null);
    }

    const bundle = opts.bundlename || '';
    const host = hostFor(bundle);

    return new Promise(resolve => {
      const backdrop = host.ownerDocument.createElement('div');
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

      // 输入框：wujios（有 WJ_IME）用自绘 div，避免移动端原生焦点弹系统键盘；
      // zhuzios 无 WJ_IME，继续用原生 input。
      const inputOpt = (opts.input && typeof opts.input === 'object') ? opts.input : null;
      const useImeField = !!window.WJ_IME;
      const inputHtml = inputOpt
        ? (useImeField
          ? `<div class="wj-dialog__field">
     <div class="wj-dialog__input" data-wj-field="1"
          data-wj-placeholder="${esc(inputOpt.placeholder || '')}"
          data-wj-value="${esc(inputOpt.value == null ? '' : inputOpt.value)}"
          tabindex="0" inputmode="none"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
     <div class="wj-dialog__error"></div>
   </div>`
          : `<div class="wj-dialog__field">
     <input class="wj-dialog__input"
            type="${esc(inputOpt.type || 'text')}"
            value="${esc(inputOpt.value == null ? '' : inputOpt.value)}"
            placeholder="${esc(inputOpt.placeholder || '')}"
            autocomplete="off" autocapitalize="off" spellcheck="false">
     <div class="wj-dialog__error"></div>
   </div>`)
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

      const entry = { backdrop, resolve, bundle };
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

      /* 自绘 div 字段：把初始值写进去（占位符交给 CSS :empty）。
         IME 的取值统一走 WJ_IME.getFieldText，原生 input 走 .value。 */
      const isFieldDiv = !!inputEl && inputEl.tagName === 'DIV';
      if (isFieldDiv) {
        const initVal = inputEl.dataset.wjValue || '';
        if (initVal) {
          try { window.WJ_IME?.setFieldText?.(inputEl, initVal); }
          catch { inputEl.textContent = initVal; }
        }
      }
      function readInputValue() {
        if (!inputEl) return undefined;
        if (isFieldDiv) {
          try { return window.WJ_IME?.getFieldText?.(inputEl) ?? inputEl.textContent ?? ''; }
          catch { return inputEl.textContent || ''; }
        }
        return inputEl.value;
      }

      if (inputEl && !isFieldDiv) {
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

        const rawValue = readInputValue();

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
            /* 自绘 div 不主动 focus 弹键盘：用户点一下字段才唤起 IME（和地图/备忘录一致）。
               原生 input（zhuzios）保持原行为。 */
            if (isFieldDiv) {
              try { window.WJ_IME?.ensureFieldStyle?.(inputEl.getRootNode()); } catch { }
            } else {
              inputEl.focus();
              try { inputEl.select(); } catch (_) { /* ignore */ }
            }
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

  /* 侧滑返回手势优先调用：关闭当前弹窗并 resolve(null)。
     传 bundle 时只关闭属于该应用的弹窗（多窗口场景避免误关别的窗口）。 */
  function dismissBySwipe(bundle) {
    if (!active) return false;
    if (bundle && active.bundle && active.bundle !== bundle) return false;
    close();
    return true;
  }

  function closeByBundle(bundle) {
    if (!active || !bundle) return;
    if (active.bundle === bundle) close();
  }

  return {
    show,
    close,
    dismissBySwipe,
    closeByBundle,
    setHostProvider,
    get isOpen() { return active !== null; },
    isOpenFor(bundle) { return !!active && (!bundle || active.bundle === bundle); },
    get current() { return active; },
  };
})();
