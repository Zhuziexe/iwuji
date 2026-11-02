/* =========================================================
   file-opener.js —— 文件关联解析 + 启动

   不记录用户偏好：
     - 只有一个候选应用 → 直接打开
     - 多个候选 → 每次弹选择器，不记忆

   依赖：WujiApps / WujiAppLauncher / WujiToast（可选）
     WujiApps 必须暴露 supportsFile(app, file) —— 匹配声明
   被依赖：文件管理器 / 任何需要"打开文件"的应用
   ========================================================= */
window.WujiFileOpener = (() => {
  const ROLE_WEIGHT = { owner: 3, editor: 2, viewer: 1 };
  const ROLE_LABEL  = { owner: '默认', editor: '可编辑', viewer: '查看' };

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function showToast(msg) {
    if (window.WujiToast?.show) {
      try { WujiToast.show(msg); return; } catch { }
    }
    console.warn('[file-opener]', msg);
  }

  /* ---------- 查询支持该文件的所有应用 ---------- */
  function handlers(file) {
    if (!file) return [];

    const list = WujiApps.installeds()
      .filter(app => !app._metaOnly)
      .filter(app => WujiApps.supportsFile(app, file));

    const withRole = list.map(app => {
      const rule = (app.fileTypes || []).find(r => {
        const fake = { name: file.name, mime: file.mime };
        return WujiApps.supportsFile({ fileTypes: [r] }, fake);
      });
      return {
        bundle:     app.bundlename,
        name:       app.name || app.bundlename,
        icon:       app.icon || '',
        role:       rule?.role || 'viewer',
        roleWeight: ROLE_WEIGHT[rule?.role] || 0,
      };
    });

    return withRole.sort((a, b) => b.roleWeight - a.roleWeight);
  }

  /* ---------- 选择器样式（只注入一次） ---------- */
  let styleInjected = false;
  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;

    const style = document.createElement('style');
    style.id = 'wjOpenerStyle';
    style.textContent = `
      .wj-opener-backdrop {
        position: absolute;
        inset: 0;
        z-index: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
        background: rgba(0, 0, 0, .38);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        opacity: 0;
        transition: opacity .2s ease;
        pointer-events: auto;
      }
      .wj-opener-backdrop.is-show { opacity: 1; }

      .wj-opener-card {
        width: 100%;
        max-width: 360px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg, #fff);
        color: var(--wj-text, #101828);
        border-radius: 20px;
        padding: 20px 16px 16px;
        box-shadow: 0 34px 84px rgba(0, 0, 0, .35), 0 3px 11px rgba(0, 0, 0, .15);
        transform: scale(.94);
        transition: transform .22s cubic-bezier(.2, .7, .3, 1);
      }
      .wj-opener-backdrop.is-show .wj-opener-card {
        transform: scale(1);
      }

      .wj-opener-title {
        font-size: var(--wj-fs-lg, 18px);
        font-weight: 700;
        text-align: center;
        margin-bottom: 6px;
      }
      .wj-opener-file {
        font-size: var(--wj-fs-sm, 14px);
        color: var(--wj-text-muted, #5b6478);
        text-align: center;
        margin-bottom: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .wj-opener-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
        -webkit-overflow-scrolling: touch;
      }

      .wj-opener-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: var(--wj-fs-md, 16px);
        text-align: left;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .12s;
      }
      .wj-opener-item:hover  { background: rgba(0, 0, 0, .06); }
      .wj-opener-item:active { background: rgba(0, 0, 0, .10); }

      .wj-opener-icon {
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        object-fit: cover;
        background: var(--wj-bg-alt, #eef1f6);
        pointer-events: none;
      }
      .wj-opener-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wj-opener-role {
        flex: 0 0 auto;
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(58, 111, 240, .12);
        color: var(--wj-primary, #3a6ff0);
      }

      .wj-opener-cancel {
        flex: 0 0 auto;
        height: 44px;
        border: 0;
        border-radius: 22px;
        background: transparent;
        color: var(--wj-text-muted, #5b6478);
        font: inherit;
        font-size: var(--wj-fs-md, 16px);
        font-weight: 500;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .12s;
      }
      .wj-opener-cancel:hover  { background: rgba(0, 0, 0, .06); }
      .wj-opener-cancel:active { background: rgba(0, 0, 0, .10); }
    `;
    document.head.appendChild(style);
  }

  /* ---------- 弹选择器：返回 bundle 或 null ---------- */
  function pickApp(file) {
    const list = handlers(file);
    if (!list.length)          return Promise.resolve(null);
    if (list.length === 1)     return Promise.resolve(list[0].bundle);

    ensureStyle();

    return new Promise(resolve => {
      const host = document.getElementById('os') || document.body;

      const backdrop = document.createElement('div');
      backdrop.className = 'wj-opener-backdrop';

      const itemsHtml = list.map(a => {
        const roleLabel = ROLE_LABEL[a.role] || '';
        return `
          <button class="wj-opener-item" data-bundle="${esc(a.bundle)}" type="button">
            <img class="wj-opener-icon" src="${esc(a.icon)}" alt="">
            <span class="wj-opener-name">${esc(a.name)}</span>
            ${roleLabel ? `<span class="wj-opener-role">${esc(roleLabel)}</span>` : ''}
          </button>
        `;
      }).join('');

      backdrop.innerHTML = `
        <div class="wj-opener-card" role="dialog" aria-modal="true">
          <div class="wj-opener-title">打开方式</div>
          <div class="wj-opener-file">${esc(file.name)}</div>
          <div class="wj-opener-list">${itemsHtml}</div>
          <button class="wj-opener-cancel" type="button">取消</button>
        </div>
      `;

      host.appendChild(backdrop);

      /* 阻止触摸穿透 */
      const stop = e => e.stopPropagation();
      backdrop.addEventListener('touchstart', stop, { passive: true });
      backdrop.addEventListener('touchmove',  stop, { passive: true });

      function close(value) {
        backdrop.classList.remove('is-show');
        setTimeout(() => {
          if (backdrop.parentNode) backdrop.remove();
        }, 220);
        resolve(value);
      }

      backdrop.addEventListener('click', e => {
        const item = e.target.closest('.wj-opener-item');
        if (item) {
          close(item.dataset.bundle || null);
          return;
        }
        if (e.target === backdrop || e.target.closest('.wj-opener-cancel')) {
          close(null);
        }
      });

      backdrop.addEventListener('keydown', e => {
        if (e.key === 'Escape') close(null);
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => backdrop.classList.add('is-show'));
      });
    });
  }

  /* ---------- 打开文件 ---------- */
  /**
   * @param {object} file  { path: [...], name, mime }
   * @param {object} opts
   *   - bundle:   强制指定应用（跳过选择器）
   *   - fallback: 无应用可开时降级回调 (file) => boolean
   * @returns {Promise<boolean>}
   */
  async function open(file, opts = {}) {
    if (!file || !Array.isArray(file.path) || !file.path.length) return false;

    const { bundle, fallback = null } = opts;

    let target = bundle;

    if (!target) {
      const list = handlers(file);

      if (list.length === 0) {
        if (typeof fallback === 'function') return fallback(file);
        showToast('没有应用可以打开此文件');
        return false;
      }

      if (list.length === 1) {
        target = list[0].bundle;
      } else {
        target = await pickApp(file);
        if (!target) return false;   // 用户取消
      }
    }

    try {
      WujiAppLauncher.open(target, { file });
      return true;
    } catch (e) {
      console.error('[file-opener] launch failed', target, e);
      showToast('启动应用失败');
      return false;
    }
  }

  return {
    handlers,
    open,
    pickApp,
  };
})();