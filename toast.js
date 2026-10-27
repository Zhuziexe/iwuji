(() => {
  const DURATION = 1600;

  let el = null;
  let timer = null;

  (function injectStyle() {
    if (document.getElementById('wj-toast-style')) return;
    const style = document.createElement('style');
    style.id = 'wj-toast-style';
    style.textContent = `
      .wj-toast {
        position: absolute;
        left: 50%;
        bottom: calc(90px + env(safe-area-inset-bottom, 0px));
        transform: translate(-50%, 8px);
        width: max-content;
        max-width: 80%;
        padding: 14px 26px;
        border-radius: 1399px;
        background: rgba(0, 0, 0, .85);
        color: #fff;
        font-family: var(--wj-font, system-ui, -apple-system, sans-serif);
        font-size: var(--wj-fs-sm, 14px);
        font-weight: 500;
        letter-spacing: .3px;
        line-height: 1.4;
        text-align: center;
        white-space: pre-wrap;
        word-break: break-word;
        box-shadow: 0 6px 22px rgba(0, 0, 0, .25);
        pointer-events: none;
        opacity: 0;
        z-index: 500;
        transition: opacity .2s ease, transform .2s ease;
        will-change: opacity, transform;
        box-sizing: border-box;
      }
      .wj-toast.is-show {
        opacity: 1;
        transform: translate(-50%, 0);
      }
      .wj-toast.is-pulse {
        animation: wj-toast-pulse .28s ease;
      }
      @keyframes wj-toast-pulse {
        0%   { transform: translate(-50%, 0) scale(1); }
        45%  { transform: translate(-50%, 0) scale(1.06); }
        100% { transform: translate(-50%, 0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  })();

  function ensureEl() {
    if (el && el.isConnected) return el;
    const os = document.getElementById('os') || document.body;
    el = document.createElement('div');
    el.className = 'wj-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    os.appendChild(el);
    return el;
  }

  function show(message) {
    if (message == null || message === '') return;

    const node = ensureEl();
    const wasVisible = node.classList.contains('is-show');

    node.textContent = String(message);

    if (timer) { clearTimeout(timer); timer = null; }

    if (wasVisible) {
      // 已经显示：原地换字 + 轻微脉冲，表示“更新了”
      node.classList.remove('is-pulse');
      void node.offsetWidth;
      node.classList.add('is-pulse');
    } else {
      // 首次或刚隐藏：淡入
      void node.offsetWidth;
      node.classList.add('is-show');
    }

    timer = setTimeout(() => {
      node.classList.remove('is-show', 'is-pulse');
      timer = null;
    }, DURATION);
  }

  window.WujiToast = { show };
})();