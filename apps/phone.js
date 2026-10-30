(() => {
  const BUNDLE = 'com.wujios.phone';
  const pad2 = n => String(n).padStart(2, '0');
  const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
  const MAX_DIGITS = 8;

  let peerJsPromise = null;
  function ensurePeerJs() {
    if (window.Peer) return Promise.resolve();
    if (peerJsPromise) return peerJsPromise;
    peerJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PEERJS_CDN;
      s.onload = () => resolve();
      s.onerror = () => { peerJsPromise = null; reject(new Error('PeerJS 加载失败')); };
      document.head.appendChild(s);
    });
    return peerJsPromise;
  }

  const S = {
    peer: null,
    myPeerId: '',
    stream: null,
    activeCall: null,
    pendingCall: null,
    ready: false,
    status: 'idle',
    target: '',
    callStart: 0,
  };

  const listeners = new Set();
  function notify() {
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error('[phone]', e); } });
  }

  function resetState() {
    if (S.activeCall) { try { S.activeCall.close(); } catch {} }
    if (S.pendingCall) { try { S.pendingCall.close(); } catch {} }
    S.activeCall = null;
    S.pendingCall = null;
    S.status = 'idle';
    S.target = '';
    S.callStart = 0;
  }

  async function ensureMic() {
    if (S.stream && S.stream.active) return S.stream;
    try {
      S.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      return S.stream;
    } catch (err) {
      let msg = '无法获取麦克风';
      if (err.name === 'NotAllowedError') msg = '麦克风权限被拒绝';
      else if (err.name === 'NotFoundError') msg = '没有麦克风设备';
      try { WujiToast.show(msg); } catch {}
      throw err;
    }
  }

  function attachRemoteAudio(stream) {
    let audio = document.getElementById('wujiPhoneRemoteAudio');
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'wujiPhoneRemoteAudio';
      audio.autoplay = true;
      audio.playsInline = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;
    audio.play().catch(() => {});
  }

  function detachRemoteAudio() {
    const audio = document.getElementById('wujiPhoneRemoteAudio');
    if (audio) { try { audio.srcObject = null; } catch {} }
  }

  function sendReject(targetId) {
    if (!S.peer || S.peer.destroyed || !targetId) return;
    try {
      const conn = S.peer.connect(targetId, { reliable: true });
      conn.on('open', () => {
        try { conn.send({ type: 'reject' }); } catch {}
        setTimeout(() => { try { conn.close(); } catch {} }, 200);
      });
      conn.on('error', () => {});
    } catch (e) { console.warn('[phone] sendReject', e); }
  }

  function handleRemoteReject() {
    if (S.status !== 'dialing' && S.status !== 'active') return;
    const call = S.activeCall;
    S.activeCall = null;
    if (call) { try { call.close(); } catch {} }
    S.status = 'idle';
    S.target = '';
    S.callStart = 0;
    detachRemoteAudio();
    try { WujiOverlay.close(); } catch {}
    notify();
    try { WujiToast.show('对方正忙'); } catch {}
  }

  async function initPeer() {
    if (S.peer && !S.peer.destroyed) return;
    try { await ensurePeerJs(); } catch (e) { console.warn('[phone] PeerJS 加载失败', e); return; }

    const id = String(Math.floor(100000 + Math.random() * 900000));
    S.myPeerId = id;

    let peer;
    try { peer = new window.Peer(id); } catch (e) { console.warn('[phone] new Peer', e); return; }
    S.peer = peer;

    peer.on('open', pid => {
      S.myPeerId = pid;
      S.ready = true;
      notify();
    });

    peer.on('connection', conn => {
      conn.on('data', data => {
        if (data && data.type === 'reject') {
          handleRemoteReject();
        }
        try { conn.close(); } catch {}
      });
      conn.on('error', () => {});
    });

    peer.on('call', call => {
      if (S.activeCall || S.pendingCall) {
        const callerId = call.peer;
        try { call.close(); } catch {}
        sendReject(callerId);
        return;
      }
      S.pendingCall = call;
      S.status = 'incoming';
      S.target = call.peer;
      notify();
      try { WujiOverlay.open({ bundlename: BUNDLE, name: 'call' }); } catch {}

      call.on('close', () => {
        if (S.pendingCall !== call) return;
        S.pendingCall = null;
        S.status = 'idle';
        S.target = '';
        try { WujiOverlay.close(); } catch {}
        notify();
        try { WujiToast.show('来电已挂断'); } catch {}
      });
    });

    peer.on('error', err => {
      console.warn('[phone] peer error:', err.type);
      if (err.type === 'unavailable-id') {
        try { peer.destroy(); } catch {}
        S.peer = null;
        S.ready = false;
        S.myPeerId = '';
        notify();
        setTimeout(() => { initPeer(); }, 300);
      }
    });

    peer.on('disconnected', () => {
      S.ready = false;
      notify();
      if (peer && !peer.destroyed) { try { peer.reconnect(); } catch {} }
    });

    peer.on('close', () => {
      S.ready = false;
      S.myPeerId = '';
      notify();
    });
  }

  function destroyPeer() {
    resetState();
    if (S.peer) { try { S.peer.destroy(); } catch {} S.peer = null; }
    if (S.stream) {
      try { S.stream.getTracks().forEach(t => t.stop()); } catch {}
      S.stream = null;
    }
    S.myPeerId = '';
    S.ready = false;
    detachRemoteAudio();
    notify();
  }

  async function dial(target) {
    if (!S.ready) { try { WujiToast.show('号码未就绪'); } catch {} return; }
    if (!target) return;
    if (target === S.myPeerId) { try { WujiToast.show('不能拨打自己的号码'); } catch {} return; }
    if (S.activeCall || S.pendingCall) { try { WujiToast.show('通话中'); } catch {} return; }

    try { await ensureMic(); } catch { return; }

    S.status = 'dialing';
    S.target = target;

    const call = S.peer.call(target, S.stream);
    if (!call) {
      S.status = 'idle';
      S.target = '';
      notify();
      try { WujiToast.show('拨打失败'); } catch {}
      return;
    }
    S.activeCall = call;
    notify();

    try { WujiOverlay.open({ bundlename: BUNDLE, name: 'call' }); } catch {}

    call.on('stream', remote => {
      S.status = 'active';
      S.callStart = Date.now();
      attachRemoteAudio(remote);
      notify();
    });

    call.on('close', () => {
      if (S.activeCall !== call) return;
      const wasActive = S.status === 'active';
      S.activeCall = null;
      S.status = 'idle';
      S.target = '';
      S.callStart = 0;
      detachRemoteAudio();
      try { WujiOverlay.close(); } catch {}
      notify();
      if (wasActive) {
        try { WujiToast.show('对方已挂断'); } catch {}
      }
    });

    call.on('error', err => {
      if (S.activeCall !== call) return;
      if (err && err.type === 'peer-unavailable') {
        try { WujiToast.show('对方不在线'); } catch {}
      }
      S.activeCall = null;
      S.status = 'idle';
      S.target = '';
      S.callStart = 0;
      detachRemoteAudio();
      try { WujiOverlay.close(); } catch {}
      notify();
    });
  }

  async function answer() {
    if (!S.pendingCall) return;
    const call = S.pendingCall;
    S.pendingCall = null;

    try { await ensureMic(); }
    catch {
      try { call.close(); } catch {}
      S.status = 'idle'; S.target = '';
      try { WujiOverlay.close(); } catch {}
      notify();
      return;
    }

    try { call.answer(S.stream); } catch {}
    S.activeCall = call;
    S.status = 'active';
    S.callStart = Date.now();
    notify();

    call.on('stream', remote => { attachRemoteAudio(remote); });

    call.on('close', () => {
      if (S.activeCall !== call) return;
      S.activeCall = null;
      S.status = 'idle';
      S.target = '';
      S.callStart = 0;
      detachRemoteAudio();
      try { WujiOverlay.close(); } catch {}
      notify();
      try { WujiToast.show('对方已挂断'); } catch {}
    });

    call.on('error', () => {
      if (S.activeCall !== call) return;
      S.activeCall = null;
      S.status = 'idle';
      S.target = '';
      S.callStart = 0;
      detachRemoteAudio();
      try { WujiOverlay.close(); } catch {}
      notify();
    });
  }

  function reject() {
    if (S.pendingCall) {
      const call = S.pendingCall;
      const callerId = call.peer;
      S.pendingCall = null;
      try { call.close(); } catch {}
      sendReject(callerId);
    }
    S.status = 'idle';
    S.target = '';
    try { WujiOverlay.close(); } catch {}
    notify();
  }

  function hangup() {
    const call = S.activeCall;
    S.activeCall = null;
    if (call) { try { call.close(); } catch {} }
    S.status = 'idle';
    S.target = '';
    S.callStart = 0;
    detachRemoteAudio();
    try { WujiOverlay.close(); } catch {}
    notify();
  }

  WujiApps.register({
    bundlename: BUNDLE,
    name: '电话',
    icon: './assets/phone.svg',
    initialRoute: 'dialer',
    version: '2.3.0',

    onBoot() {
      resetState();
      initPeer().catch(() => {});
    },

    onShutdown() {
      resetState();
      destroyPeer();
      try { WujiOverlay.close(); } catch {}
    },

    styles: `
      .phone-page {
        position: absolute; inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg, #fff);
        padding-top: var(--statusbar-h, 36px);
        overflow: hidden;
        box-sizing: border-box;
        user-select: none; -webkit-user-select: none;
        --key-size: min(80px, 19vw, 14.3vh);
      }

      /* ============ 我的号码：小胶囊 ============ */
      .phone-my-number {
        flex: 0 0 auto;
        align-self: center;
        margin: 4px 0 0;
        padding: 3px 14px;
        border-radius: 999px;
        background: linear-gradient(135deg, #e8f0ff 0%, #d6e2ff 100%);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background .15s, transform .08s;
        width: fit-content;
      }
      .phone-my-number__label {
        font-size: 18px;
        font-weight: 500;
        color: var(--wj-text-dim, #9aa4b8);
        letter-spacing: .3px;
      }
      .phone-my-number__value {
        font-family: 'Consolas', 'SF Mono', monospace;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 1.5px;
        color: var(--wj-text, #101828);
        font-variant-numeric: tabular-nums;
      }

      /* ============ 号码显示 ============ */
      .phone-display {
        flex: 0 0 auto;
        padding: 4px 24px 6px;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-x;
      }
      .phone-display::-webkit-scrollbar { display: none; }

      .phone-number {
        display: block;
        text-align: center;
        white-space: nowrap;
        font-size: 46px;
        font-weight: 600;
        color: var(--wj-text, #101828);
        letter-spacing: 2px;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
        min-height: 50px;
      }
      .phone-number:empty::before {
        content: '输入号码';
        color: var(--wj-text-dim, #9aa4b8);
        font-weight: 400;
        letter-spacing: .5px;
        font-size: 28px;
        line-height: 50px;
      }

      /* ============ 键盘 ============ */
      .phone-pad {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        margin: 0 auto;
        padding: 0 18px;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-template-rows: repeat(4, minmax(0, 1fr));
        gap: 3px;
        place-items: center;
        overflow: hidden;
      }

      .phone-key {
        width: var(--key-size);
        height: var(--key-size);
        border: 0;
        border-radius: 50%;
        background: var(--wj-bg-alt, #eef1f6);
        color: var(--wj-text, #101828);
        font: inherit;
        font-size: 36px;
        font-weight: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;
        padding: 0;
        cursor: pointer;
        line-height: 1;
        transition: transform .08s ease, background .12s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .phone-key:active { transform: scale(.93); background: #dce3ef; }

      .phone-key__sub {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.5px;
        color: var(--wj-text-dim, #9aa4b8);
        margin-top: 2px;
        line-height: 1;
      }

      /* ============ 拨号按钮 ============ */
      .phone-actions {
        flex: 0 0 auto;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px 0 calc(14px + env(safe-area-inset-bottom, 0px));
      }

      .phone-dial-btn {
        width: clamp(80px, 19vw, 92px);
        height: clamp(80px, 19vw, 92px);
        border-radius: 50%;
        border: 0;
        background: #34c759;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 8px 25px rgba(52, 199, 89, .35);
        transition: transform .08s ease, filter .12s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .phone-dial-btn:active { transform: scale(.93); filter: brightness(.9); }
      .phone-dial-btn svg { width: 55%; height: 55%; display: block; }

      .phone-back-btn {
        position: absolute;
        right: 24px;
        top: 50%;
        transform: translateY(-50%);
        width: 60px;
        height: 60px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        color: var(--wj-text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transition: opacity .15s ease, transform .08s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .phone-back-btn.is-visible { opacity: 1; pointer-events: auto; }
      .phone-back-btn:active { transform: translateY(-50%) scale(.9); }
      .phone-back-btn svg { width: 32px; height: 32px; display: block; }

      /* ============ 通话 overlay ============ */
      .ph-call-ov {
        position: absolute; inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: calc(96px + var(--statusbar-h, 36px)) 42px
                 calc(64px + env(safe-area-inset-bottom, 0px));
        background: rgba(12, 18, 36, .82);
        backdrop-filter: blur(36px) saturate(150%);
        -webkit-backdrop-filter: blur(36px) saturate(150%);
        color: #fff;
        text-align: center;
        box-sizing: border-box;
        user-select: none; -webkit-user-select: none;
      }

      .ph-call-ov__info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        width: 100%;
        min-width: 0;
      }

      .ph-call-ov__avatar {
        font-size: 88px;
        line-height: 1;
        filter: drop-shadow(0 6px 20px rgba(0,0,0,.4));
      }

      .ph-call-ov__number {
        font-size: 45px;
        font-weight: 600;
        letter-spacing: 3px;
        color: #fff;
        text-shadow: 0 3px 17px rgba(0, 0, 0, .35);
        font-variant-numeric: tabular-nums;
        word-break: break-all;
        max-width: 100%;
      }

      .ph-call-ov__status {
        font-size: var(--wj-fs-xl, 18px);
        font-weight: 400;
        color: rgba(255, 255, 255, .72);
        letter-spacing: 3px;
        min-height: 34px;
      }

      .ph-call-ov__actions {
        display: flex;
        gap: 60px;
        justify-content: center;
      }

      .ph-call-btn {
        width: 101px;
        height: 101px;
        border-radius: 50%;
        border: 0;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .08s ease, filter .12s ease;
      }
      .ph-call-btn:active { transform: scale(.92); filter: brightness(.9); }
      .ph-call-btn svg { width: 46px; height: 46px; display: block; }

      .ph-call-btn--hangup { background: #ff3b30; box-shadow: 0 11px 34px rgba(255, 59, 48, .45); }
      .ph-call-btn--reject { background: #ff3b30; box-shadow: 0 11px 34px rgba(255, 59, 48, .45); }
      .ph-call-btn--answer { background: #34c759; box-shadow: 0 11px 34px rgba(52, 199, 89, .45); }
    `,

    overlays: [
      {
        name: 'call',

        render() {
          return `
            <div class="ph-call-ov" data-overlay-interactive>
              <div class="ph-call-ov__info">
                <div class="ph-call-ov__avatar" id="phCallAvatar">📞</div>
                <div class="ph-call-ov__number" id="phCallNumber">—</div>
                <div class="ph-call-ov__status" id="phCallStatus">正在拨号…</div>
              </div>
              <div class="ph-call-ov__actions" id="phCallActions"></div>
            </div>
          `;
        },

        mount(root) {
          const avatarEl = root.querySelector('#phCallAvatar');
          const numberEl = root.querySelector('#phCallNumber');
          const statusEl = root.querySelector('#phCallStatus');
          const actionsEl = root.querySelector('#phCallActions');

          let tickTimer = null;
          let lastSig = '';

          const HANGUP_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>`;
          const ANSWER_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02z"/></svg>`;

          function fmtDuration(ms) {
            const s = Math.max(0, Math.floor(ms / 1000));
            return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
          }

          function render() {
            if (S.status === 'idle') {
              try { WujiOverlay.close(); } catch {}
              return;
            }

            numberEl.textContent = S.target || '—';

            if (S.status === 'dialing') {
              avatarEl.textContent = '📞';
              statusEl.textContent = '正在呼叫…';
              if (lastSig !== 'dialing') {
                lastSig = 'dialing';
                actionsEl.innerHTML = `
                  <button class="ph-call-btn ph-call-btn--hangup" id="phHangup" type="button">
                    ${HANGUP_SVG}
                  </button>
                `;
                actionsEl.querySelector('#phHangup').addEventListener('pointerup', e => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  e.preventDefault();
                  if (navigator.vibrate) { try { navigator.vibrate(15); } catch {} }
                  hangup();
                });
              }
            } else if (S.status === 'active') {
              avatarEl.textContent = '💬';
              if (lastSig !== 'active') {
                lastSig = 'active';
                actionsEl.innerHTML = `
                  <button class="ph-call-btn ph-call-btn--hangup" id="phHangup" type="button">
                    ${HANGUP_SVG}
                  </button>
                `;
                actionsEl.querySelector('#phHangup').addEventListener('pointerup', e => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  e.preventDefault();
                  if (navigator.vibrate) { try { navigator.vibrate(15); } catch {} }
                  hangup();
                });
              }
              statusEl.textContent = fmtDuration(Date.now() - S.callStart);
            } else if (S.status === 'incoming') {
              avatarEl.textContent = '📞';
              statusEl.textContent = '来电';
              if (lastSig !== 'incoming') {
                lastSig = 'incoming';
                actionsEl.innerHTML = `
                  <button class="ph-call-btn ph-call-btn--reject" id="phReject" type="button">
                    ${HANGUP_SVG}
                  </button>
                  <button class="ph-call-btn ph-call-btn--answer" id="phAnswer" type="button">
                    ${ANSWER_SVG}
                  </button>
                `;
                actionsEl.querySelector('#phReject').addEventListener('pointerup', e => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  e.preventDefault();
                  if (navigator.vibrate) { try { navigator.vibrate(15); } catch {} }
                  reject();
                });
                actionsEl.querySelector('#phAnswer').addEventListener('pointerup', e => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  e.preventDefault();
                  if (navigator.vibrate) { try { navigator.vibrate(15); } catch {} }
                  answer();
                });
              }
            }
          }

          const onState = () => { lastSig = ''; render(); };
          listeners.add(onState);
          render();

          tickTimer = setInterval(() => {
            if (S.status === 'active') {
              statusEl.textContent = fmtDuration(Date.now() - S.callStart);
            }
          }, 500);

          this._cleanup = () => {
            listeners.delete(onState);
            if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
          };
        },

        unmount() {
          this._cleanup?.();
          this._cleanup = null;
        },
      },
    ],

    routes: {
      dialer: {
        name: 'dialer',

        render() {
          return `
            <div class="phone-page">
              <div class="phone-my-number" id="phoneMyNumberWrap">
                <span class="phone-my-number__label">我的号码</span>
                <span class="phone-my-number__value" id="phoneMyNumber">— — — — — —</span>
              </div>

              <div class="phone-display">
                <div class="phone-number" id="phoneNumber"></div>
              </div>

              <div class="phone-pad">
                <button class="phone-key" data-digit="1" type="button">1</button>
                <button class="phone-key" data-digit="2" type="button">2<span class="phone-key__sub">ABC</span></button>
                <button class="phone-key" data-digit="3" type="button">3<span class="phone-key__sub">DEF</span></button>
                <button class="phone-key" data-digit="4" type="button">4<span class="phone-key__sub">GHI</span></button>
                <button class="phone-key" data-digit="5" type="button">5<span class="phone-key__sub">JKL</span></button>
                <button class="phone-key" data-digit="6" type="button">6<span class="phone-key__sub">MNO</span></button>
                <button class="phone-key" data-digit="7" type="button">7<span class="phone-key__sub">PQRS</span></button>
                <button class="phone-key" data-digit="8" type="button">8<span class="phone-key__sub">TUV</span></button>
                <button class="phone-key" data-digit="9" type="button">9<span class="phone-key__sub">WXYZ</span></button>
                <button class="phone-key" data-digit="*" type="button">*</button>
                <button class="phone-key" data-digit="0" type="button">0</button>
                <button class="phone-key" data-digit="#" type="button">#</button>
              </div>

              <div class="phone-actions">
                <button class="phone-back-btn" id="phoneBack" type="button" aria-label="删除">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/>
                    <path d="M15 9l-5 6"/>
                    <path d="M10 9l5 6"/>
                  </svg>
                </button>
                <button class="phone-dial-btn" id="phoneDial" type="button" aria-label="拨号">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02z"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
        },

        mount(root) {
          const myNumEl = root.querySelector('#phoneMyNumber');
          const numberEl = root.querySelector('#phoneNumber');
          const backBtn = root.querySelector('#phoneBack');
          const dialBtn = root.querySelector('#phoneDial');
          const padEl = root.querySelector('.phone-pad');

          let number = '';

          function updateMyNumber() {
            if (S.myPeerId) myNumEl.textContent = S.myPeerId;
            else if (S.peer) myNumEl.textContent = '连接中';
            else myNumEl.textContent = '未连接';
          }

          function updateNumber() {
            numberEl.textContent = number;
            backBtn.classList.toggle('is-visible', number.length > 0);
          }

          function appendDigit(d) {
            if (!d) return;
            if (number.length >= MAX_DIGITS) return;
            number += d;
            updateNumber();
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch {} }
          }

          function backspace() {
            if (!number) return;
            number = number.slice(0, -1);
            updateNumber();
            if (navigator.vibrate) { try { navigator.vibrate(6); } catch {} }
          }

          function onDial() {
            if (!number) return;
            if (S.status !== 'idle') { try { WujiToast.show('通话中'); } catch {} return; }
            if (navigator.vibrate) { try { navigator.vibrate(20); } catch {} }
            dial(number);
          }

          function onPadClick(e) {
            const key = e.target.closest('.phone-key');
            if (!key) return;
            appendDigit(key.dataset.digit);
          }

          function onKeydown(e) {
            if (!root.isConnected) return;
            if (S.status !== 'idle') return;
            if (/^[0-9*#]$/.test(e.key)) { appendDigit(e.key); e.preventDefault(); }
            else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
            else if (e.key === 'Enter') { onDial(); e.preventDefault(); }
          }

          const onState = () => updateMyNumber();
          listeners.add(onState);
          updateMyNumber();
          updateNumber();

          padEl.addEventListener('click', onPadClick);
          backBtn.addEventListener('click', backspace);
          dialBtn.addEventListener('click', onDial);
          window.addEventListener('keydown', onKeydown);

          return () => {
            listeners.delete(onState);
            padEl.removeEventListener('click', onPadClick);
            backBtn.removeEventListener('click', backspace);
            dialBtn.removeEventListener('click', onDial);
            window.removeEventListener('keydown', onKeydown);
          };
        },
      },
    },
  });
})();