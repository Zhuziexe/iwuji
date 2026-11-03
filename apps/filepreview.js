/* =========================================================
   apps/filepreview.js —— 文件预览（hidden）
   支持：图片 / 视频 / 音频 / 文本
   声明 fileTypes，由 WujiFileOpener 分发调用
   ========================================================= */
(() => {
  const BUNDLE = 'com.wujios.filepreview';
  const MAX_TEXT_SIZE = 5 * 1024 * 1024;   // 文本文件 5MB 上限

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  WujiApps.register({
    bundlename: BUNDLE,
    name: '文件预览',
    icon: './assets/filepreview.svg',
    initialRoute: 'main',
    version: '1.0.0',
    hidden: true,

    fileTypes: [
      {
        ext: ['jpg','jpeg','png','gif','webp','bmp','svg','ico','avif','heic'],
        role: 'viewer',
      },
      {
        ext: ['mp4','webm','mov','m4v','mkv','avi','ogv'],
        role: 'viewer',
      },
      {
        ext: ['mp3','wav','ogg','flac','m4a','aac','opus','wma','amr','aiff','ape','oga'],
        role: 'viewer',
      },
      {
        ext: ['txt','md','markdown','json','xml','html','htm','css',
              'js','mjs','ts','jsx','tsx','yml','yaml','ini','toml','log',
              'sh','bat','ps1','py','rb','go','rs','java','c','h','cpp','hpp',
              'cs','php','sql','lua','csv','tsv'],
        role: 'viewer',
      },
    ],

    styles: `
      .fp-page {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: #0f1116;
        color: #e9ecf2;
        padding-top: var(--statusbar-h, 0px);
        font-size: var(--wj-fs-md);
      }

      .fp-head {
        flex: 0 0 auto;
        display: flex; align-items: center; gap: 8px;
        padding: 10px 16px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        font-size: var(--wj-fs-sm);
      }
      .fp-name {
        flex: 1 1 auto; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .fp-copy {
        flex: 0 0 auto;
        height: 32px; padding: 0 14px;
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 999px;
        background: rgba(255,255,255,.06);
        color: #fff;
        font: inherit; font-size: var(--wj-fs-sm);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .fp-copy:active { background: rgba(255,255,255,.16); }
      .fp-copy[hidden] { display: none; }

      .fp-body {
        flex: 1 1 auto; min-height: 0;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        background: #000;
      }
      .fp-body--text {
        background: #0f1116;
        align-items: stretch;
        justify-content: flex-start;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
      }

      .fp-body img {
        max-width: 100%; max-height: 100%;
        object-fit: contain;
        display: block;
        -webkit-user-drag: none;
        user-select: none;
      }
      .fp-body video {
        max-width: 100%; max-height: 100%;
        display: block;
        background: #000;
      }
      .fp-body audio {
        width: 80%;
        max-width: 360px;
      }
      .fp-body pre {
        margin: 0;
        padding: 16px;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: var(--wj-fs-md);
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        color: #e9ecf2;
        min-width: 0;
      }

      .fp-audio-wrap {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 28px;
        padding: 32px;
        width: 100%;
      }
      .fp-audio-art {
        width: 140px; height: 140px;
        border-radius: 24px;
        background: linear-gradient(135deg, #F9A082, #E05050);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 12px 32px rgba(0,0,0,.4);
      }
      .fp-audio-art svg { width: 64px; height: 64px; }

      .fp-hint {
        padding: 60px 20px;
        text-align: center;
        color: #8a93a4;
        font-size: var(--wj-fs-md);
        line-height: 1.7;
      }
    `,

    routes: {
      main: {
        name: 'main',

        render(routeCtx) {
          const file = routeCtx.data?.file;
          const name = file?.name || '文件预览';
          return `
            <div class="fp-page">
              <div class="fp-head">
                <span class="fp-name">${esc(name)}</span>
                <button class="fp-copy" id="fpCopyBtn" type="button" hidden>复制</button>
              </div>
              <div class="fp-body" id="fpBody">
                <div class="fp-hint">加载中…</div>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const bodyEl = root.querySelector('#fpBody');
          const copyBtn = root.querySelector('#fpCopyBtn');

          let currentURL = null;      // 当前的 objectURL（img/video/audio 共用）
          let currentText = '';       // 当前文本内容（复制用）
          let disposed = false;
          let loadToken = 0;          // 防止并发加载时旧结果覆盖新结果

          function cleanupURL() {
            if (currentURL) {
              URL.revokeObjectURL(currentURL);
              currentURL = null;
            }
          }

          function setHead(file) {
            const nameEl = root.querySelector('.fp-name');
            if (nameEl) nameEl.textContent = file?.name || '文件预览';
          }

          function setBodyClass(cls) {
            bodyEl.className = 'fp-body' + (cls ? ' ' + cls : '');
          }

          function showHint(text) {
            setBodyClass('');
            bodyEl.innerHTML = `<div class="fp-hint">${esc(text)}</div>`;
          }

          async function loadFile(file) {
            if (!file || !file.path) {
              showHint('未指定文件');
              copyBtn.hidden = true;
              return;
            }

            const myToken = ++loadToken;
            cleanupURL();
            currentText = '';
            copyBtn.hidden = true;
            setHead(file);
            showHint('加载中…');

            if (!window.WujiFileSystem?.supported) {
              showHint('文件系统不可用');
              return;
            }

            let blob;
            try {
              blob = await WujiFileSystem.read(file.path);
            } catch (e) {
              console.warn('[filepreview] read failed', e);
              if (myToken === loadToken) showHint('读取失败');
              return;
            }

            if (myToken !== loadToken || disposed) return;
            if (!blob) {
              showHint('文件不存在');
              return;
            }

            const kind = WujiFileSystem.kindOf(file.name);

            /* ---------- 图片 ---------- */
            if (kind === 'image') {
              setBodyClass('');
              currentURL = URL.createObjectURL(blob);
              const img = document.createElement('img');
              img.src = currentURL;
              img.alt = '';
              img.draggable = false;
              img.onerror = () => {
                if (myToken !== loadToken) return;
                showHint('无法显示图片');
              };
              bodyEl.innerHTML = '';
              bodyEl.appendChild(img);
              return;
            }

            /* ---------- 视频 ---------- */
            if (kind === 'video') {
              setBodyClass('');
              currentURL = URL.createObjectURL(blob);
              const v = document.createElement('video');
              v.src = currentURL;
              v.controls = true;
              v.playsInline = true;
              v.setAttribute('playsinline', '');
              v.onerror = () => {
                if (myToken !== loadToken) return;
                showHint('无法播放视频');
              };
              bodyEl.innerHTML = '';
              bodyEl.appendChild(v);
              return;
            }

            /* ---------- 音频 ---------- */
            if (kind === 'audio') {
              setBodyClass('');
              currentURL = URL.createObjectURL(blob);
              const wrap = document.createElement('div');
              wrap.className = 'fp-audio-wrap';
              wrap.innerHTML = `
                <div class="fp-audio-art">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>
              `;
              const a = document.createElement('audio');
              a.src = currentURL;
              a.controls = true;
              a.autoplay = true;
              a.onerror = () => {
                if (myToken !== loadToken) return;
                showHint('无法播放音频');
              };
              wrap.appendChild(a);
              bodyEl.innerHTML = '';
              bodyEl.appendChild(wrap);
              return;
            }

            /* ---------- 文本 ---------- */
            if (kind === 'text') {
              if (blob.size > MAX_TEXT_SIZE) {
                showHint(`文件过大（${(blob.size / 1048576).toFixed(1)} MB），不支持预览`);
                return;
              }
              let text = '';
              try {
                text = await blob.text();
              } catch {
                if (myToken === loadToken) showHint('无法读取文本');
                return;
              }
              if (myToken !== loadToken || disposed) return;
              currentText = text;
              setBodyClass('fp-body--text');
              const pre = document.createElement('pre');
              pre.textContent = text;
              bodyEl.innerHTML = '';
              bodyEl.appendChild(pre);
              copyBtn.hidden = false;
              return;
            }

            /* ---------- 其他 ---------- */
            showHint('此类型不支持预览');
          }

          /* ---------- 复制按钮 ---------- */
          copyBtn.addEventListener('click', async () => {
            if (!currentText) return;
            try {
              await navigator.clipboard.writeText(currentText);
              try { window.WujiToast?.show?.('已复制'); } catch { }
            } catch {
              try { window.WujiToast?.show?.('复制失败'); } catch { }
            }
          });

          /* ---------- 单例窗口切换文件 ---------- */
          const onParams = (e) => {
            if (e.detail?.bundle !== BUNDLE) return;
            const file = e.detail.params?.file;
            if (file) loadFile(file);
          };
          window.addEventListener('wuji:app-params', onParams);

          /* ---------- 首次加载 ---------- */
          loadFile(ctx.data?.file);

          return () => {
            disposed = true;
            window.removeEventListener('wuji:app-params', onParams);
            cleanupURL();
          };
        },
      },
    },
  });
})();