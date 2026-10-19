(() => {
  const BUNDLE = 'com.wujinb.doushabao';
  const API_BASE = 'https://hermes.ai.unturf.com/v1';
  const SYSTEM_PROMPT = '你是豆沙包，一个AI助手。回答简洁、友好，用中文。';
  const DEFAULT_MODEL = 'turboderp/Qwen3.8-27B-exl3';

  // ============================================================
  // TTS 支持检测（仅在存在 speechSynthesis 时启用朗读）
  // ============================================================
  const TTS_SUPPORTED =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function';

  // 朗读状态（模块级，切换对话/重新发送时统一停止）
  let isSpeaking = false;
  let activeUtterance = null;

  function stopSpeaking() {
    if (!TTS_SUPPORTED) return;
    try { window.speechSynthesis.cancel(); } catch (_) {}
    isSpeaking = false;
    activeUtterance = null;
  }

  // 去掉 markdown 符号，避免 TTS 把 ** 或 # 念出来
  function cleanTextForTTS(text) {
    if (!text) return '';
    return String(text)
      .replace(/```[\s\S]*?```/g, '')          // 去掉代码块
      .replace(/`([^`]+)`/g, '$1')             // 行内代码只留内容
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接只留文字
      .replace(/^#{1,6}\s+/gm, '')             // 标题井号
      .replace(/^[>\-+*]\s+/gm, '')            // 列表/引用符号
      .replace(/[*_~]/g, '')                   // 粗体斜体
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ---------- 工具 ----------
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function normalizeReasoning(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')
      .replace(/\n{3,}/g, '\n\n');
  }

  function isNearBottom(el, threshold = 60) {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  // ---------- 模型 ----------
  let currentModel = null;
  let modelPromise = null;

  function ensureModel() {
    if (currentModel) return Promise.resolve(currentModel);
    if (!modelPromise) {
      modelPromise = fetch(`${API_BASE}/models`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          const ids = (data.data || []).map(m => m.id).filter(Boolean);
          currentModel = ids[0] || DEFAULT_MODEL;
          return currentModel;
        })
        .catch(err => {
          console.warn('[doushabao] 获取模型失败，使用默认', err);
          currentModel = DEFAULT_MODEL;
          return currentModel;
        })
        .finally(() => { modelPromise = null; });
    }
    return modelPromise;
  }

  // ---------- 流式请求 ----------
  async function streamChat(model, userText, { onReasoning, onContent, signal }) {
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userText }
        ],
        stream: true
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${txt ? ' · ' + txt.slice(0, 120) : ''}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;

        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;
          const r = delta.reasoning ?? delta.reasoning_content;
          if (r) onReasoning(r);
          if (delta.content) onContent(delta.content);
        } catch (_) { /* 忽略半包 */ }
      }
    }
  }

  // ============================================================
  // 注册应用
  // ============================================================
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '豆沙包',
    icon: './assets/doushabao.svg',
    initialRoute: 'home',
    version: '1.0.5',

    styles: `
      .dsb-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        min-height: 0;
      }

      .dsb-header {
        flex: 0 0 auto;
        padding: 8px 14px 6px;
        border-bottom: 1px solid var(--wj-border, #e6e9ef);
      }
      .dsb-header__title {
        font-size: 18px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
        line-height: 1.2;
      }
      .dsb-header__sub {
        font-size: 11px;
        color: var(--wj-text-muted);
        margin-top: 2px;
      }

      .dsb-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 8px 10px;
      }

      .dsb-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        min-height: 100%;
        padding: 12px;
        text-align: center;
      }
      .dsb-state__text {
        font-size: 14px;
        color: var(--wj-text-muted);
        line-height: 1.5;
      }

      .dsb-spinner {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid var(--wj-border-strong, #e6e9ef);
        border-top-color: var(--wj-primary, #3a6ff0);
        animation: dsbSpin .85s linear infinite;
      }
      @keyframes dsbSpin { to { transform: rotate(360deg); } }

      .dsb-answer {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .dsb-reasoning {
        padding: 8px 12px 14px;
        border-left: 2px solid var(--wj-primary, #3a6ff0);
        background: var(--wj-bg-alt);
        border-radius: 6px;
        font-size: 15px;
        color: var(--wj-text-muted);
        line-height: 1.35;
        word-break: break-word;
      }
      .dsb-reasoning[hidden] { display: none !important; }

      .dsb-reasoning__label {
        font-size: 16px;
        font-weight: 700;
        color: var(--wj-primary, #3a6ff0);
        letter-spacing: .8px;
        line-height: 1;
        margin-bottom: 6px;
        opacity: .85;
      }

      .dsb-reasoning__body {
        display: block;
        white-space: pre-wrap;
      }

      .dsb-content {
        font-size: 15px;
        line-height: 1.6;
        color: var(--wj-text);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .dsb-error { color: var(--wj-danger, #e0356b); }

      /* ---- 朗读按钮（仅支持时渲染）---- */
      .dsb-tts-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 4px;
      }
      .dsb-tts {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 28px;
        padding: 0 10px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 999px;
        background: transparent;
        color: var(--wj-text-muted);
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: .3px;
        cursor: pointer;
        transition: background .15s, color .15s, opacity .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .dsb-tts:active:not(:disabled) { transform: scale(.96); }
      .dsb-tts:disabled { opacity: .45; cursor: not-allowed; }
      .dsb-tts.is-speaking {
        color: var(--wj-primary, #3a6ff0);
        border-color: var(--wj-primary, #3a6ff0);
        background: rgba(58, 111, 240, .08);
      }
      .dsb-tts__icon { font-size: 13px; line-height: 1; }

      .dsb-footer {
        flex: 0 0 auto;
        padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid var(--wj-border, #e6e9ef);
        display: flex;
        gap: 6px;
        align-items: center;
        background: var(--wj-bg);
      }

      .dsb-input {
        flex: 1 1 auto;
        min-width: 0;
        height: 48px;
        padding: 0 12px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 10px;
        background: var(--wj-bg-alt);
        color: var(--wj-text);
        font: inherit;
        font-size: 15px;
        outline: none;
        box-sizing: border-box;
      }
      .dsb-input:focus { border-color: var(--wj-primary, #3a6ff0); }
      .dsb-input::placeholder { color: var(--wj-text-dim); }

      .dsb-send {
        flex: 0 0 auto;
        height: 48px;
        padding: 0 16px;
        border: 0;
        border-radius: 10px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity .15s, transform .1s;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
      }
      .dsb-send:active:not(:disabled) { transform: scale(.96); }
      .dsb-send:disabled { opacity: .55; cursor: not-allowed; }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="dsb-page">
              <div class="dsb-header">
                <div class="dsb-header__title">豆沙包</div>
                <div class="dsb-header__sub">我是豆沙包，你的AI助手</div>
              </div>

              <div class="dsb-body" id="dsbBody"></div>

              <div class="dsb-footer">
                <input class="dsb-input"
                       id="dsbInput"
                       type="text"
                       placeholder="输入消息…"
                       autocomplete="off"
                       autocorrect="off"
                       autocapitalize="off"
                       spellcheck="false">
                <button class="dsb-send" id="dsbSend" type="button">发送</button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const bodyEl = root.querySelector('#dsbBody');
          const inputEl = root.querySelector('#dsbInput');
          const sendBtn = root.querySelector('#dsbSend');

          let busy = false;
          let abortController = null;

          let reasoningText = '';
          let contentText = '';
          let inStream = false;
          let reasoningEl = null;
          let contentEl = null;
          let ttsBtn = null;

          function renderIdle() {
            bodyEl.innerHTML = `
              <div class="dsb-state">
                <div class="dsb-state__text">我是豆沙包，你的AI助手</div>
              </div>
            `;
            bodyEl.scrollTop = 0;
          }

          function renderThinking() {
            bodyEl.innerHTML = `
              <div class="dsb-state">
                <div class="dsb-spinner"></div>
                <div class="dsb-state__text">深度思考中...</div>
              </div>
            `;
            bodyEl.scrollTop = 0;
          }

          function prepareStreamUI() {
            if (inStream) return;
            inStream = true;

            // 只有支持 TTS 时才渲染朗读按钮
            const ttsHtml = TTS_SUPPORTED
              ? `<div class="dsb-tts-row">
                   <button class="dsb-tts" id="dsbTtsBtn" type="button" disabled>
                     <span class="dsb-tts__icon">🔊</span><span class="dsb-tts__text">朗读</span>
                   </button>
                 </div>`
              : '';

            bodyEl.innerHTML = `
              <div class="dsb-answer">
                <div class="dsb-reasoning" hidden>
                  <div class="dsb-reasoning__label">思考过程</div>
                  <div class="dsb-reasoning__body"></div>
                </div>
                <div class="dsb-content"></div>
                ${ttsHtml}
              </div>
            `;
            reasoningEl = bodyEl.querySelector('.dsb-reasoning');
            contentEl = bodyEl.querySelector('.dsb-content');
            ttsBtn = bodyEl.querySelector('#dsbTtsBtn');

            if (ttsBtn) {
              ttsBtn.addEventListener('click', onTtsClick);
            }
          }

          function onTtsClick() {
            if (!TTS_SUPPORTED || !ttsBtn) return;

            // 正在朗读：点击停止
            if (isSpeaking) {
              stopSpeaking();
              updateTtsUI();
              return;
            }

            const text = cleanTextForTTS(contentText);
            if (!text) return;

            try {
              window.speechSynthesis.cancel();

              const u = new SpeechSynthesisUtterance(text);
              u.lang = 'zh-CN';
              u.rate = 1;
              u.pitch = 1;

              u.onstart = () => {
                isSpeaking = true;
                updateTtsUI();
              };
              u.onend = () => {
                isSpeaking = false;
                activeUtterance = null;
                updateTtsUI();
              };
              u.onerror = () => {
                isSpeaking = false;
                activeUtterance = null;
                updateTtsUI();
              };

              activeUtterance = u;
              isSpeaking = true;
              updateTtsUI();
              window.speechSynthesis.speak(u);
            } catch (err) {
              console.warn('[doushabao] TTS 失败', err);
              isSpeaking = false;
              activeUtterance = null;
              updateTtsUI();
            }
          }

          function updateTtsUI() {
            if (!ttsBtn) return;
            if (isSpeaking) {
              ttsBtn.classList.add('is-speaking');
              ttsBtn.querySelector('.dsb-tts__icon').textContent = '⏹';
              ttsBtn.querySelector('.dsb-tts__text').textContent = '停止';
            } else {
              ttsBtn.classList.remove('is-speaking');
              ttsBtn.querySelector('.dsb-tts__icon').textContent = '🔊';
              ttsBtn.querySelector('.dsb-tts__text').textContent = '朗读';
            }
          }

          function appendReasoning(text) {
            prepareStreamUI();
            reasoningEl.hidden = false;
            const stick = isNearBottom(bodyEl);
            reasoningText += text;
            reasoningEl.querySelector('.dsb-reasoning__body').textContent =
              normalizeReasoning(reasoningText);
            if (stick) bodyEl.scrollTop = bodyEl.scrollHeight;
          }

          function appendContent(text) {
            prepareStreamUI();
            const stick = isNearBottom(bodyEl);
            contentText += text;
            contentEl.textContent = contentText.replace(/^\s+/, '');
            if (stick) bodyEl.scrollTop = bodyEl.scrollHeight;
          }

          async function send() {
            if (busy) return;
            const text = inputEl.value.trim();
            if (!text) return;

            // 新对话开始前先停止旧朗读
            stopSpeaking();

            busy = true;
            sendBtn.disabled = true;
            inputEl.value = '';

            reasoningText = '';
            contentText = '';
            inStream = false;
            reasoningEl = null;
            contentEl = null;
            ttsBtn = null;

            renderThinking();

            abortController = new AbortController();

            try {
              const model = await ensureModel();
              if (!root.isConnected) return;

              await streamChat(model, text, {
                signal: abortController.signal,
                onReasoning: appendReasoning,
                onContent: appendContent,
              });

              if (!root.isConnected) return;

              if (!inStream) {
                bodyEl.innerHTML = `
                  <div class="dsb-state">
                    <div class="dsb-state__text">没有收到回答</div>
                  </div>
                `;
              } else {
                bodyEl.scrollTop = bodyEl.scrollHeight;
                // 流式结束，启用朗读按钮
                if (ttsBtn) ttsBtn.disabled = false;
              }
            } catch (err) {
              if (err.name === 'AbortError') return;
              console.error('[doushabao]', err);
              if (!root.isConnected) return;
              bodyEl.innerHTML = `
                <div class="dsb-state">
                  <div class="dsb-state__text dsb-error">
                    请求失败：${escapeHtml(err.message || '网络错误')}
                  </div>
                </div>
              `;
            } finally {
              busy = false;
              sendBtn.disabled = false;
              abortController = null;
              try { inputEl.focus(); } catch { }
            }
          }

          sendBtn.addEventListener('click', send);

          inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          });

          renderIdle();

          return () => {
            stopSpeaking();
            if (abortController) {
              try { abortController.abort(); } catch { }
              abortController = null;
            }
          };
        },
      },
    },
  });
})();