/* =========================================================
   apps/camera.js —— 相机
   getUserMedia → 全屏预览 → 快门 → 存 /Pictures/photo_xxx.jpg
   ========================================================= */
(() => {
  const BUNDLE = 'com.wujios.camera';

  /* 切换摄像头图标（环形双箭头） */
  const ICON_SWITCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 11a8 8 0 0 0-14.3-4.9" />
    <path d="M4 4v2.6h2.6" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9" />
    <path d="M20 20v-2.6h-2.6" />
  </svg>`;

  /* 水印开关：审批印章（往下的箭头落在横线上） */
  const ICON_STAMP_ON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v10" />
    <path d="M8.5 9.5 12 13l3.5-3.5" />
    <path d="M5 17h14" />
    <path d="M7 20h10" />
  </svg>`;

  /* 水印关闭：印章被斜线划掉 */
  const ICON_STAMP_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v10" />
    <path d="M8.5 9.5 12 13l3.5-3.5" />
    <path d="M5 17h14" />
    <path d="M7 20h10" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>`;

  WujiApps.register({
    bundlename: BUNDLE,
    name: '相机',
    icon: './assets/camera.svg',
    initialRoute: 'home',
    version: '1.0.1',

    styles: `
      .cam-page {
        position: absolute; inset: 0;
        background: #000;
        overflow: hidden;
      }
      .cam-video {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        object-fit: cover;
        background: #000;
        -webkit-tap-highlight-color: transparent;
      }
      .cam-flash {
        position: absolute; inset: 0;
        background: #fff;
        opacity: 0;
        pointer-events: none;
        transition: opacity .06s;
        z-index: 2;
      }
      .cam-flash.is-show { opacity: .85; }

      .cam-error {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 14px;
        padding: 40px 32px;
        background: #101828;
        color: #e9ecf2;
        text-align: center;
        z-index: 5;
      }
      .cam-error[hidden] { display: none; }
      .cam-error__title {
        font-size: var(--wj-fs-lg);
        font-weight: 600;
      }
      .cam-error__msg {
        font-size: var(--wj-fs-md);
        color: #8a93a4;
        line-height: 1.7;
        max-width: 280px;
      }

      .cam-shutter-bar {
        position: absolute;
        left: 0; right: 0;
        bottom: 0;
        padding: 24px 24px calc(28px + env(safe-area-inset-bottom, 0px));
        display: flex; align-items: center; justify-content: space-between;
        z-index: 3;
        pointer-events: none;
      }
      .cam-shutter {
        pointer-events: auto;
        width: 78px; height: 78px;
        border: 0;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        box-shadow:
          0 0 0 4px rgba(255,255,255,.35),
          0 6px 20px rgba(0,0,0,.4);
        transition: transform .1s, background .1s;
        -webkit-tap-highlight-color: transparent;
      }
      .cam-shutter:active { transform: scale(.92); background: #e5e5e5; }
      .cam-shutter:disabled { opacity: .4; cursor: not-allowed; }

      .cam-tool {
        pointer-events: auto;
        flex: 0 0 auto;
        width: 58px; height: 58px;
        border: 0;
        border-radius: 50%;
        background: rgba(0,0,0,.4);
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        z-index: 4;
        -webkit-tap-highlight-color: transparent;
      }
      .cam-tool:active { transform: scale(.92); background: rgba(0,0,0,.6); }
      .cam-tool[disabled] { opacity: .45; cursor: not-allowed; }
      .cam-tool svg { width: 30px; height: 30px; display: block; }
    `,

    routes: {
      home: {
        name: 'home',
        statusBar: { immersive: true },
        render() {
          return `
            <div class="cam-page">
              <video class="cam-video" id="camVideo"
                     autoplay playsinline muted></video>
              <div class="cam-flash" id="camFlash"></div>
              <div class="cam-shutter-bar">
                <button class="cam-tool cam-tool--switch" id="camSwitch"
                        type="button" aria-label="切换摄像头" disabled>${ICON_SWITCH}</button>
                <button class="cam-shutter" id="camShutter"
                        type="button" aria-label="拍照" disabled></button>
                <button class="cam-tool cam-tool--mark" id="camWatermark"
                        type="button" aria-label="水印开关">${ICON_STAMP_OFF}</button>
              </div>
              <div class="cam-error" id="camError" hidden></div>
              <canvas id="camCanvas" hidden></canvas>
            </div>
          `;
        },

        mount(root) {
          const videoEl = root.querySelector('#camVideo');
          const flashEl = root.querySelector('#camFlash');
          const shutterEl = root.querySelector('#camShutter');
          const errorEl = root.querySelector('#camError');
          const canvasEl = root.querySelector('#camCanvas');
          const switchEl = root.querySelector('#camSwitch');
          const markEl = root.querySelector('#camWatermark');

          let stream = null;
          let disposed = false;
          let busy = false;
          let facing = 'environment';   // 'user' 前置 / 'environment' 后置
          let watermark = false;        // 水印开关，默认关

          function showError(title, msg) {
            errorEl.hidden = false;
            errorEl.innerHTML = `
              <div class="cam-error__title">${escapeHtml(title)}</div>
              <div class="cam-error__msg">${escapeHtml(msg)}</div>
            `;
            videoEl.style.display = 'none';
            shutterEl.disabled = true;
            if (switchEl) switchEl.disabled = true;
          }

          async function init() {
            if (!window.WujiFileSystem?.supported) {
              showError('文件系统不可用', '当前浏览器不支持保存照片');
              return;
            }

            if (!navigator.mediaDevices?.getUserMedia) {
              showError('不支持相机', '当前浏览器不支持摄像头访问');
              return;
            }

            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: { ideal: facing },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                },
                audio: false,
              });
            } catch (e) {
              const n = e?.name || '';
              if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
                showError('未授予相机权限', '请在浏览器设置中允许访问摄像头');
              } else if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
                showError('找不到摄像头', '当前设备没有可用的摄像头');
              } else if (n === 'NotReadableError') {
                showError('摄像头被占用', '可能有其他应用正在使用摄像头');
              } else {
                showError('无法打开相机', e?.message || '未知错误');
              }
              return;
            }

            if (disposed) {
              stream.getTracks().forEach(t => t.stop());
              return;
            }

            videoEl.srcObject = stream;
            try { await videoEl.play(); } catch { }
            shutterEl.disabled = false;
            if (switchEl) switchEl.disabled = false;
          }

          /* 切换摄像头：先试 applyConstraints，失败则重启流 */
          async function switchCamera() {
            if (busy || !stream) return;
            busy = true;
            if (switchEl) switchEl.disabled = true;

            const next = facing === 'environment' ? 'user' : 'environment';
            let ok = false;

            try {
              const track = stream.getVideoTracks()[0];
              if (track && track.applyConstraints) {
                try {
                  await track.applyConstraints({ facingMode: { ideal: next } });
                  ok = true;
                } catch { }
              }
              if (!ok) {
                stream.getTracks().forEach(t => t.stop());
                stream = await navigator.mediaDevices.getUserMedia({
                  video: {
                    facingMode: { ideal: next },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                  },
                  audio: false,
                });
                if (disposed) {
                  stream.getTracks().forEach(t => t.stop());
                  stream = null;
                  return;
                }
                videoEl.srcObject = stream;
                try { await videoEl.play(); } catch { }
                ok = true;
              }
              if (ok) facing = next;
            } catch (e) {
              console.error('[camera] switch failed', e);
              try { window.WujiToast?.show?.('切换摄像头失败'); } catch { }
            } finally {
              busy = false;
              if (!disposed && switchEl) switchEl.disabled = false;
            }
          }

          async function capture() {
            if (busy || !stream) return;
            busy = true;
            shutterEl.disabled = true;

            flashEl.classList.add('is-show');
            setTimeout(() => flashEl.classList.remove('is-show'), 120);

            try {
              const vw = videoEl.videoWidth;
              const vh = videoEl.videoHeight;
              if (!vw || !vh) throw new Error('摄像头尚未就绪');

              const cw = videoEl.clientWidth;
              const ch = videoEl.clientHeight;
              if (!cw || !ch) throw new Error('预览区域尺寸异常');

              const scale = Math.max(cw / vw, ch / vh);
              const sw = cw / scale;
              const sh = ch / scale;
              const sx = (vw - sw) / 2;
              const sy = (vh - sh) / 2;

              const outW = Math.round(cw * 2);
              const outH = Math.round(ch * 2);
              canvasEl.width = outW;
              canvasEl.height = outH;

              const ctx = canvasEl.getContext('2d');
              ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outW, outH);

              if (watermark) {
                const wmSize = Math.max(14, Math.round(outW * 0.038));
                ctx.font = `600 ${wmSize}px -apple-system, "PingFang SC", sans-serif`;
                ctx.fillStyle = '#fff';
                ctx.shadowColor = 'rgba(0,0,0,.5)';
                ctx.shadowBlur = wmSize * 0.5;
                ctx.textBaseline = 'bottom';

                const pad = Math.round(wmSize * 0.8);
                const model = (window.WujiDevices?.deviceModel?.() || 'WujiOS');
                const now = new Date();
                const mo = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                const timeText = `${now.getFullYear()}-${mo}-${dd} ${hh}:${mm}`;

                ctx.textAlign = 'left';
                ctx.fillText(model, pad, outH - pad);
                ctx.textAlign = 'right';
                ctx.fillText(timeText, outW - pad, outH - pad);
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
              }

              const blob = await new Promise((resolve, reject) => {
                canvasEl.toBlob(
                  b => b ? resolve(b) : reject(new Error('生成图片失败')),
                  'image/jpeg',
                  0.9
                );
              });

              const name = `photo_${Date.now()}.jpg`;
              const file = new File([blob], name, { type: 'image/jpeg' });

              await WujiFileSystem.add(['Pictures'], file, { name });

              window.dispatchEvent(new CustomEvent('wuji:photos-changed'));

              if (navigator.vibrate) { try { navigator.vibrate(20); } catch { } }
              try { window.WujiToast?.show?.('已保存到 Pictures'); } catch { }
            } catch (e) {
              console.error('[camera] capture failed', e);
              try { window.WujiToast?.show?.('拍照失败：' + (e?.message || '未知')); } catch { }
            } finally {
              busy = false;
              if (!disposed) shutterEl.disabled = false;
            }
          }

          shutterEl.addEventListener('click', capture);

          if (switchEl) switchEl.addEventListener('click', switchCamera);

          if (markEl) {
            markEl.addEventListener('click', () => {
              watermark = !watermark;
              markEl.innerHTML = watermark ? ICON_STAMP_ON : ICON_STAMP_OFF;
              if (navigator.vibrate) { try { navigator.vibrate(8); } catch { } }
              try {
                window.WujiToast?.show?.(watermark ? '水印已开启' : '水印已关闭');
              } catch { }
            });
          }

          init();

          /* ★ 后台时停掉摄像头采集（省电 + 隐私），回前台再重新采集。
             不用 onShutdown，因为后台不卸载；用系统广播的事件。 */
          function stopStream() {
            if (stream) {
              stream.getTracks().forEach(t => t.stop());
              stream = null;
            }
            try { videoEl.srcObject = null; } catch { }
          }
          function onBg(e) {
            if (e?.detail?.bundle !== BUNDLE) return;
            stopStream();
          }
          function onFg(e) {
            if (e?.detail?.bundle !== BUNDLE) return;
            if (!disposed && !stream) init();
          }
          window.addEventListener('wuji:app-background', onBg);
          window.addEventListener('wuji:app-foreground', onFg);

          return () => {
            disposed = true;
            window.removeEventListener('wuji:app-background', onBg);
            window.removeEventListener('wuji:app-foreground', onFg);
            stopStream();
          };
        },
      },
    },
  });
})();