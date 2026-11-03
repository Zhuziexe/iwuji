/* =========================================================
   apps/camera.js —— 相机
   getUserMedia → 全屏预览 → 快门 → 存 /Pictures/photo_xxx.jpg
   ========================================================= */
(() => {
  const BUNDLE = 'com.wujios.camera';

  WujiApps.register({
    bundlename: BUNDLE,
    name: '相机',
    icon: './assets/camera.svg',
    initialRoute: 'home',
    version: '1.0.0',

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
        padding: 24px 0 calc(28px + env(safe-area-inset-bottom, 0px));
        display: flex; align-items: center; justify-content: center;
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
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="cam-page">
              <video class="cam-video" id="camVideo"
                     autoplay playsinline muted></video>
              <div class="cam-flash" id="camFlash"></div>
              <div class="cam-shutter-bar">
                <button class="cam-shutter" id="camShutter"
                        type="button" aria-label="拍照" disabled></button>
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

          let stream = null;
          let disposed = false;
          let busy = false;

          function showError(title, msg) {
            errorEl.hidden = false;
            errorEl.innerHTML = `
              <div class="cam-error__title">${escapeHtml(title)}</div>
              <div class="cam-error__msg">${escapeHtml(msg)}</div>
            `;
            videoEl.style.display = 'none';
            shutterEl.disabled = true;
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
                  facingMode: { ideal: 'environment' },
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

              canvasEl.getContext('2d')
                .drawImage(videoEl, sx, sy, sw, sh, 0, 0, outW, outH);

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
          init();

          return () => {
            disposed = true;
            if (stream) {
              stream.getTracks().forEach(t => t.stop());
              stream = null;
            }
            try { videoEl.srcObject = null; } catch { }
          };
        },
      },
    },
  });
})();