/* =========================================================
   manual.js —— iWuji 快速入门指南（纸质说明书风格）
   ========================================================= */
window.WujiManual = (() => {
  let hostEl = null;
  let backdropEl = null;
  let paperEl = null;
  let isOpen = false;
  let bound = false;

  const ICON = {
    power: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/></svg>`,
    volUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    volDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    dropDown: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M24 16 L24 36"/><path d="M18 30 L24 36 L30 30"/></svg>`,
    swipeH: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="4" fill="currentColor" stroke="none"/><path d="M10 24 L20 24"/><path d="M14 20 L10 24 L14 28"/><path d="M38 24 L28 24"/><path d="M34 20 L38 24 L34 28"/></svg>`,
    swipeLeft: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="34" cy="24" r="4" fill="currentColor" stroke="none"/><path d="M34 24 L12 24"/><path d="M18 18 L12 24 L18 30"/></svg>`,
    swipeUp: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="36" r="4" fill="currentColor" stroke="none"/><path d="M24 32 L24 12"/><path d="M18 18 L24 12 L30 18"/></svg>`,
    hold: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="4" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="10" opacity="0.5"/><circle cx="24" cy="24" r="16" opacity="0.25"/></svg>`,
  };

  const CONTENT = `
    <div class="wm-cover">
      <div class="wm-cover__brand">iWuji</div>
      <div class="wm-cover__subtitle">快速入门指南</div>
      <div class="wm-cover__desc">
        感谢您选择 iWuji。<br>
        这是一台运行在浏览器里的小设备。
      </div>
    </div>

    <div class="wm-section">
      <div class="wm-section__title"><span class="wm-num">1</span>按键</div>
      <div class="wm-keys">
        <div class="wm-key">
          <span class="wm-key__icon">${ICON.power}</span>
          <div class="wm-key__text">
            <div class="wm-key__name">电源键（右侧）</div>
            <div class="wm-key__desc">短按息屏 / 亮屏，长按弹出关机、重启菜单</div>
          </div>
        </div>
        <div class="wm-key">
          <span class="wm-key__icon">${ICON.volUp}</span>
          <div class="wm-key__text">
            <div class="wm-key__name">音量加（左侧上）</div>
            <div class="wm-key__desc">按住连续增大</div>
          </div>
        </div>
        <div class="wm-key">
          <span class="wm-key__icon">${ICON.volDown}</span>
          <div class="wm-key__text">
            <div class="wm-key__name">音量减（左侧下）</div>
            <div class="wm-key__desc">按住连续减小</div>
          </div>
        </div>
      </div>
    </div>

    <div class="wm-section">
      <div class="wm-section__title"><span class="wm-num">2</span>手势</div>
      <div class="wm-gestures">
        <div class="wm-gesture">
          <div class="wm-gesture__icon">${ICON.dropDown}</div>
          <div class="wm-gesture__text">
            <div class="wm-gesture__title">顶部左侧下拉</div>
            <div class="wm-gesture__desc">打开通知中心</div>
          </div>
        </div>
        <div class="wm-gesture">
          <div class="wm-gesture__icon">${ICON.dropDown}</div>
          <div class="wm-gesture__text">
            <div class="wm-gesture__title">顶部右侧下拉</div>
            <div class="wm-gesture__desc">打开控制中心</div>
          </div>
        </div>
        <div class="wm-gesture">
          <div class="wm-gesture__icon">${ICON.swipeH}</div>
          <div class="wm-gesture__text">
            <div class="wm-gesture__title">桌面左右滑</div>
            <div class="wm-gesture__desc">翻页</div>
          </div>
        </div>
        <div class="wm-gesture">
          <div class="wm-gesture__icon">${ICON.hold}</div>
          <div class="wm-gesture__text">
            <div class="wm-gesture__title">长按桌面图标</div>
            <div class="wm-gesture__desc">拖拽排列，继续按住可卸载</div>
          </div>
        </div>
        <div class="wm-gesture">
          <div class="wm-gesture__icon">${ICON.swipeLeft}</div>
          <div class="wm-gesture__text">
            <div class="wm-gesture__title">应用内左滑</div>
            <div class="wm-gesture__desc">返回上一层，退到桌面</div>
          </div>
        </div>
        <div class="wm-gesture">
          <div class="wm-gesture__icon">${ICON.swipeUp}</div>
          <div class="wm-gesture__text">
            <div class="wm-gesture__title">锁屏上滑</div>
            <div class="wm-gesture__desc">解锁进入桌面</div>
          </div>
        </div>
      </div>
    </div>

    <div class="wm-section">
      <div class="wm-section__title"><span class="wm-num">3</span>首次使用</div>
      <ol class="wm-steps">
        <li>按下右侧电源键开机。</li>
        <li>在锁屏上上滑解锁。如设置了密码，输入 4 位 PIN。</li>
        <li>点击桌面图标打开应用。</li>
        <li>在「应用市场」里安装更多应用。</li>
        <li>在「设置」里更改主题、锁屏密码，备份数据。</li>
      </ol>
    </div>

    <div class="wm-footer">
      如需更多帮助，请访问 iWuji 的 GitHub 仓库。
      <div class="wm-footer__brand">— Powered by OpenWuji —</div>
      <a href="javascript:void(0)" id="wmPrint">打印这份说明书</a>
    </div>
  `;

  const STYLE = `
    .wm-backdrop {
      position: fixed; inset: 0;
      background: rgba(8, 10, 14, 0.72);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      opacity: 0;
      transition: opacity .3s ease;
    }
    .wm-backdrop.is-show { opacity: 1; }

    .wm-paper {
      position: fixed;
      left: 50%; top: 50%;
      width: min(340px, 86vw);
      max-height: 82vh;
      margin: 0;
      background: #ffffff;
      border-radius: 3px;
      box-shadow:
        0 20px 54px rgba(0,0,0,.6),
        0 4px 10px rgba(0,0,0,.25),
        inset 0 0 0 1px rgba(0,0,0,.04);
      color: #000000;
      font-family: Georgia, "Times New Roman", "SimSun", "Songti SC", serif;
      overflow: hidden;
      opacity: 0;
      transform: translate(-50%, calc(-50% + 40px)) scale(.94);
      transition: opacity .3s ease, transform .38s cubic-bezier(.2,.7,.3,1);
    }
    .wm-paper.is-show {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }

    .wm-scroll {
      max-height: 82vh;
      overflow-y: auto;
      padding: 32px 26px 28px;
      position: relative;
      z-index: 2;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,0,0,.15) transparent;
    }
    .wm-scroll::-webkit-scrollbar { width: 6px; }
    .wm-scroll::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,.15);
      border-radius: 3px;
    }

    .wm-close {
      position: absolute;
      top: 10px; right: 12px;
      width: 30px; height: 30px;
      border: 0;
      background: transparent;
      color: rgba(0, 0, 0, .45);
      font-size: 22px;
      line-height: 1;
      font-family: -apple-system, sans-serif;
      cursor: pointer;
      z-index: 3;
      border-radius: 50%;
      transition: background .15s, color .15s;
    }
    .wm-close:hover {
      background: rgba(0,0,0,.06);
      color: rgba(0, 0, 0, .85);
    }

    .wm-cover {
      text-align: center;
      padding: 8px 0 24px;
    }
    .wm-cover__brand {
      font-size: 34px;
      font-weight: 700;
      letter-spacing: .5px;
      color: #000000;
      font-family: serif;
    }
    .wm-cover__subtitle {
      margin-top: 6px;
      margin-bottom: 12px;
      font-size: 12px;
      letter-spacing: 4px;
      color: #3c3c3c;
      font-family: -apple-system, sans-serif;
    }
    .wm-cover__desc {
      font-size: 13px;
      line-height: 1.8;
      color: #333333;
    }

    /* 章节 */
    .wm-section {
      margin-top: 28px;
    }
    .wm-section__title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 17px;
      font-weight: 700;
      color: #000000;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(0,0,0,.08);
      margin-bottom: 14px;
    }
    .wm-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #000000;
      color: #ffffff;
      font-size: 12px;
      font-family: -apple-system, sans-serif;
      font-weight: 700;
    }

    /* 按键 */
    .wm-keys {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .wm-key {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .wm-key__icon {
      flex: 0 0 26px;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333333;
    }
    .wm-key__icon svg { width: 100%; height: 100%; display: block; }
    .wm-key__text { flex: 1 1 auto; min-width: 0; }
    .wm-key__name {
      font-size: 13px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 2px;
    }
    .wm-key__desc {
      font-size: 12px;
      line-height: 1.6;
      color: #333333;
    }

    /* 手势 */
    .wm-gestures {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .wm-gesture {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 12px;
      border-radius: 4px;
      background: rgba(0,0,0,.025);
      border: 1px dashed rgba(0,0,0,.12);
    }
    .wm-gesture__icon {
      flex: 0 0 36px;
      width: 36px;
      height: 36px;
      color: #333333;
    }
    .wm-gesture__icon svg { width: 100%; height: 100%; display: block; }
    .wm-gesture__text { flex: 1 1 auto; min-width: 0; }
    .wm-gesture__title {
      font-size: 13px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 2px;
    }
    .wm-gesture__desc {
      font-size: 12px;
      line-height: 1.5;
      color: #3c3c3c;
    }

    /* 首次使用 */
    .wm-steps {
      list-style: none;
      counter-reset: wmStep;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .wm-steps li {
      counter-increment: wmStep;
      display: flex;
      gap: 10px;
      font-size: 13px;
      line-height: 1.7;
      color: #333333;
    }
    .wm-steps li::before {
      content: counter(wmStep);
      flex: 0 0 20px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1px solid #3c3c3c;
      color: #333333;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }

    /* 页脚 */
    .wm-footer {
      margin-top: 32px;
      padding-top: 18px;
      border-top: 1px solid rgba(0,0,0,.08);
      text-align: center;
      font-size: 11px;
      line-height: 1.8;
      color: #3c3c3c;
      font-family: -apple-system, sans-serif;
    }
    .wm-footer__brand {
      display: block;
      margin-top: 4px;
      letter-spacing: 1px;
      color: #3c3c3c;
    }
    .wm-footer a {
      display: inline-block;
      margin-top: 6px;
      color: #3c3c3c;
      text-decoration: underline;
    }

        /* ============ 打印样式 ============ */
    @media print {
      /* 1. 重置 html/body，让文档可以纵向展开 */
      html, body {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        display: block !important;
        background: #ffffff !important;
      }

      /* 2. 隐藏页面上除说明书宿主之外的所有元素 */
      body > * {
        display: none !important;
      }
      body > #wjManualHost {
        display: block !important;
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        z-index: auto !important;
      }

      /* 3. 隐藏遮罩、关闭按钮、纸张折痕 */
      .wm-backdrop,
      .wm-close,
      .wm-paper::before {
        display: none !important;
      }

      /* 4. 纸张变回普通文档流，去掉所有限制 */
      .wm-paper {
        position: static !important;
        transform: none !important;
        width: 100% !important;
        max-width: none !important;
        max-height: none !important;
        height: auto !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        opacity: 1 !important;
        overflow: visible !important;
        background: #ffffff !important;
      }

      /* 5. 滚动容器展开，全部内容参与打印 */
      .wm-scroll {
        max-height: none !important;
        height: auto !important;
        overflow: visible !important;
        padding: 0 10mm !important;
      }

      /* 6. 打印时去掉「打印这份说明书」链接 */
      .wm-footer a {
        display: none !important;
      }

      /* 7. 避免章节被分页切断 */
      .wm-section,
      .wm-gesture,
      .wm-key,
      .wm-steps li {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* 8. 背景色打印出来 */
      .wm-gesture {
        background: rgba(0,0,0,.03) !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .wm-num {
        background: #000000 !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;

  function ensureHost() {
    if (hostEl && hostEl.isConnected) return hostEl;

    hostEl = document.createElement('div');
    hostEl.id = 'wjManualHost';
    hostEl.style.cssText = 'position:fixed;inset:0;z-index:9000;display:none;';

    const style = document.createElement('style');
    style.textContent = STYLE;
    hostEl.appendChild(style);

    backdropEl = document.createElement('div');
    backdropEl.className = 'wm-backdrop';
    hostEl.appendChild(backdropEl);

    paperEl = document.createElement('div');
    paperEl.className = 'wm-paper';
    paperEl.innerHTML = `
      <button class="wm-close" type="button" aria-label="关闭">×</button>
      <div class="wm-scroll">${CONTENT}</div>
    `;
    hostEl.appendChild(paperEl);

    document.body.appendChild(hostEl);

    backdropEl.addEventListener('click', close);
    paperEl.querySelector('.wm-close').addEventListener('click', close);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) close();
    });

    paperEl.querySelector('#wmPrint')?.addEventListener('click', () => {
      window.print();
    });

    return hostEl;
  }

  function open() {
    if (isOpen) return;
    const host = ensureHost();
    host.style.display = 'block';
    isOpen = true;

    const scrollEl = paperEl.querySelector('.wm-scroll');
    if (scrollEl) scrollEl.scrollTop = 0;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdropEl.classList.add('is-show');
        paperEl.classList.add('is-show');
      });
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    backdropEl.classList.remove('is-show');
    paperEl.classList.remove('is-show');

    setTimeout(() => {
      if (!isOpen && hostEl) hostEl.style.display = 'none';
    }, 400);
  }

  function bind() {
    if (bound) return;
    bound = true;

    const btn = document.getElementById('manualBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (isOpen) close();
        else open();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  return {
    open,
    close,
    get isOpen() { return isOpen; },
  };
})();