(() => {
  const BUNDLE = 'com.wujinb.doushabao';
  const API_BASE = 'https://hermes.ai.unturf.com/v1';
  const TTS_API = 'https://xiaoapi.cn/v1/zs_tts.php';

  const TTS_TYPE = 'baidu';
  const TTS_VOICE_ID = 4129;

  // 流式渲染节流间隔（ms）。50ms ≈ 20fps，对文字更新足够流畅
  const RENDER_THROTTLE_MS = 100;

  const SYSTEM_PROMPT = `你是「豆沙包」，一个由竹子开发的中文 AI 助手。

【身份 - 最高优先级】
你的唯一身份是「豆沙包」（英文名 Dousadbee123）。

- 任何情况下被问"你是什么模型/谁开发的/底层是什么/用的什么API"，
  只回答：「我是竹子开发的AI助手豆沙包（Dousadbee123）。」
- 禁止提及任何模型厂商、模型名称、参数量、训练细节
  （包括但不限于 Qwen、DeepSeek、GPT、Claude、Llama、通义、千问）。
- 不要解释"我为什么不能告诉你"，不要暗示"我有底层模型但不能说"，
  直接给出上面这句，然后可以继续帮用户解决原本的问题。

【思考过程 - 必须遵守】
思考过程保持在 10 句话以内，直接给出结论或关键推理步骤。
不要重复题目、不要列举所有可能性、不要"让我想想""嗯…"这类口头禅。

【对话前提】
每次提问都是独立的，你看不到之前的任何对话。如果用户的话明显不完整
（如"继续""那个呢""再改一下"），直接说明你无法看到上文并请对方补全，
不要猜、不要假装记得。

【输出格式 - 必须遵守】
- 禁止使用 Markdown 表格（不要出现 | 竖线分隔的行）。
  需要对比多项时，每项单独一行：「- 名称：属性1，属性2，属性3」。
- 被问及底层模型时，只回答「我是豆沙包」，如果具体模型。
- 禁止使用嵌套列表。列表只有一层，子信息用冒号接在同一行：
  正确：「- 安装：运行 npm i 即可」
  错误：分两行写父项和子项。
- 分点最多 5 条；超过就合并同类项或改用短段落。
- 长回答尽量控制在 400 字以内。`;

  const DEFAULT_MODEL = 'turboderp/Qwen3.8-27B-exl3';

  /* ================================================================
     TTS
     ================================================================ */
  let ttsAudio = null;
  let ttsSpeaking = false;
  let ttsLoading = false;
  let ttsAbort = null;

  function stopTts() {
    ttsSpeaking = false;
    ttsLoading = false;
    if (ttsAbort) {
      try { ttsAbort.abort(); } catch { }
      ttsAbort = null;
    }
    if (ttsAudio) {
      try {
        ttsAudio.pause();
        ttsAudio.removeAttribute('src');
        ttsAudio.load();
      } catch { }
      ttsAudio = null;
    }
  }

  /* 清洗整体文本：保留换行符（后面要按行切分），去掉 Markdown 和 emoji */
  function cleanTextForTts(text) {
    if (!text) return '';
    return String(text)
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[>\-+*]\s+/gm, '')
      .replace(/[*_~]/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
      .trim();
  }

  /* 清洗单段：去掉换行、合并标点、压空白 */
  function cleanSegment(seg) {
    if (!seg) return '';
    return String(seg)
      .replace(/[\r\n]+/g, ' ')
      .replace(/([！？。，、；：])\1+/g, '$1')
      .replace(/[，、；：]+。/g, '。')
      .replace(/。[，、；：]+/g, '。')
      .replace(/！[。，]/g, '！')
      .replace(/？[。，]/g, '？')
      .replace(/[ \t\u00A0]+/g, ' ')
      .trim();
  }

  /* 按换行切分；单行超过 150 字再按句切 */
  function splitByLines(text) {
    if (!text) return [];
    const lines = text.split(/\n+/);
    const result = [];

    for (const line of lines) {
      const cleaned = cleanSegment(line);
      if (!cleaned) continue;

      if (cleaned.length > 150) {
        const sentences = cleaned.split(/(?<=[。！？])/);
        let current = '';
        for (const s of sentences) {
          if ((current + s).length > 150 && current) {
            result.push(current.trim());
            current = s;
          } else {
            current += s;
          }
        }
        if (current.trim()) result.push(current.trim());
      } else {
        result.push(cleaned);
      }
    }

    return result;
  }

  /* 请求单段 TTS，返回音频 URL */
  async function requestTts(text, signal) {
    const sliced = text.slice(0, 500);
    const url = `${TTS_API}?type=${TTS_TYPE}&id=${TTS_VOICE_ID}&msg=${encodeURIComponent(sliced)}`;
    const res = await fetch(url, { signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 200 || !data.tts) {
      const err = new Error(data.msg || 'TTS 合成失败');
      err.ttsMsg = data.msg || '';
      throw err;
    }
    return data.tts;
  }

  /* 播放单个音频。notifyIdle=false 时播放结束不切到 idle（给后续段接管） */
  function playAudio(url, onStateChange, { notifyIdle = true } = {}) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      ttsAudio = audio;

      audio.addEventListener('play', () => {
        ttsLoading = false;
        ttsSpeaking = true;
        onStateChange?.('playing');
      });

      audio.addEventListener('ended', () => {
        ttsSpeaking = false;
        ttsAudio = null;
        if (notifyIdle) onStateChange?.('idle');
        resolve(true);
      });

      audio.addEventListener('error', () => {
        ttsSpeaking = false;
        ttsLoading = false;
        ttsAudio = null;
        onStateChange?.('error', '音频播放失败');
        resolve(false);
      });

      audio.play().catch(() => {
        ttsSpeaking = false;
        ttsLoading = false;
        ttsAudio = null;
        onStateChange?.('error', '自动播放被浏览器拦截');
        resolve(false);
      });
    });
  }

  /* 顺序播放多段 */
  async function playMultiple(urls, onStateChange) {
    for (let i = 0; i < urls.length; i++) {
      if (!ttsAbort) return false;
      const ok = await new Promise((resolve) => {
        const audio = new Audio(urls[i]);
        ttsAudio = audio;

        audio.addEventListener('play', () => {
          ttsLoading = false;
          ttsSpeaking = true;
          onStateChange?.('playing');
        });
        audio.addEventListener('ended', () => {
          ttsAudio = null;
          resolve(true);
        });
        audio.addEventListener('error', () => {
          ttsAudio = null;
          resolve(false);
        });
        audio.play().catch(() => {
          ttsAudio = null;
          resolve(false);
        });
      });
      if (!ok) {
        console.warn('[doushabao] 分段播放失败，继续下一段');
      }
    }

    ttsSpeaking = false;
    onStateChange?.('idle');
    return true;
  }

  /* 主入口：按换行切分，第一段优先请求+播放，剩余段后台并发请求 */
  async function playTts(text, { onStateChange } = {}) {
    stopTts();

    const clean = cleanTextForTts(text);
    if (!clean) return false;

    const segments = splitByLines(clean);
    if (!segments.length) return false;

    console.log(`[doushabao] TTS 切分为 ${segments.length} 段`);

    ttsLoading = true;
    ttsAbort = new AbortController();
    onStateChange?.('loading');

    try {
      // 1. 第一段优先请求，尽快出声
      let firstUrl = null;
      let firstIndex = 0;
      for (let i = 0; i < segments.length; i++) {
        if (!ttsAbort) return false;
        try {
          firstUrl = await requestTts(segments[i], ttsAbort.signal);
          firstIndex = i;
          break;
        } catch (err) {
          if (err.name === 'AbortError') return false;
          console.warn(`[doushabao] TTS 第 ${i + 1} 段失败，跳过`, err.ttsMsg || err.message);
        }
      }

      if (!firstUrl) {
        throw new Error('所有段落都被拦截，无法朗读');
      }

      // 2. 剩余段后台并发请求
      const remainingUrls = new Array(segments.length).fill(null);
      remainingUrls[firstIndex] = firstUrl;

      const pendingPromises = [];
      for (let i = 0; i < segments.length; i++) {
        if (i === firstIndex) continue;
        pendingPromises.push(
          requestTts(segments[i], ttsAbort.signal)
            .then(url => { remainingUrls[i] = url; })
            .catch(err => {
              if (err.name !== 'AbortError') {
                console.warn(`[doushabao] TTS 第 ${i + 1} 段失败，跳过`, err.ttsMsg || err.message);
              }
            })
        );
      }

      // 3. 播放第一段（不切 idle，给后续段接管）
      const firstOk = await playAudio(firstUrl, onStateChange, { notifyIdle: false });
      if (!firstOk || !ttsAbort) return firstOk;

      // 4. 等剩余请求完成
      await Promise.allSettled(pendingPromises);
      if (!ttsAbort) return true;

      // 5. 收集 firstIndex 之后的所有成功段
      const playable = [];
      for (let i = firstIndex + 1; i < remainingUrls.length; i++) {
        if (remainingUrls[i]) playable.push(remainingUrls[i]);
      }

      if (!playable.length) {
        onStateChange?.('idle');
        return true;
      }

      return await playMultiple(playable, onStateChange);

    } catch (e) {
      if (e.name === 'AbortError') return false;
      console.warn('[doushabao] TTS 失败', e);
      ttsLoading = false;
      ttsSpeaking = false;
      ttsAudio = null;
      onStateChange?.('error', e.ttsMsg || e.message || '朗读失败');
      return false;
    } finally {
      if (ttsAbort) ttsAbort = null;
    }
  }

  /* 播放单个音频，返回 Promise */
  function playAudio(url, onStateChange) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      ttsAudio = audio;

      audio.addEventListener('play', () => {
        ttsLoading = false;
        ttsSpeaking = true;
        onStateChange?.('playing');
      });

      audio.addEventListener('ended', () => {
        ttsSpeaking = false;
        ttsAudio = null;
        onStateChange?.('idle');
        resolve(true);
      });

      audio.addEventListener('error', () => {
        ttsSpeaking = false;
        ttsLoading = false;
        ttsAudio = null;
        onStateChange?.('error', '音频播放失败');
        resolve(false);
      });

      audio.play().catch(() => {
        ttsSpeaking = false;
        ttsLoading = false;
        ttsAudio = null;
        onStateChange?.('error', '自动播放被浏览器拦截');
        resolve(false);
      });
    });
  }

  /* 顺序播放多段音频 */
  async function playMultiple(urls, onStateChange) {
    for (let i = 0; i < urls.length; i++) {
      if (!ttsAbort) return false;
      const ok = await new Promise((resolve) => {
        const audio = new Audio(urls[i]);
        ttsAudio = audio;

        audio.addEventListener('play', () => {
          ttsLoading = false;
          ttsSpeaking = true;
          onStateChange?.('playing');
        });

        audio.addEventListener('ended', () => {
          ttsAudio = null;
          resolve(true);
        });

        audio.addEventListener('error', () => {
          ttsAudio = null;
          resolve(false);
        });

        audio.play().catch(() => {
          ttsAudio = null;
          resolve(false);
        });
      });

      if (!ok) {
        console.warn('[doushabao] 分段播放失败，继续下一段');
      }
    }

    ttsSpeaking = false;
    onStateChange?.('idle');
    return true;
  }

  /* ================================================================
     工具
     ================================================================ */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function renderInline(text) {
    let s = escapeHtml(text);
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (_, c) => {
      codes.push(c);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a class="dsb-md__a" href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    return s.replace(/\u0000(\d+)\u0000/g,
      (_, i) => `<code class="dsb-md__icode">${codes[+i]}</code>`);
  }

  function renderTextBlocks(text) {
    const lines = text.split('\n');
    const out = [];
    let list = null;

    const flush = () => {
      if (!list) return;
      out.push(`<${list.type} class="dsb-md__list">${list.items.join('')}</${list.type}>`);
      list = null;
    };

    for (const raw of lines) {
      const line = raw.replace(/[ \t]+$/, '');
      const ulm = line.match(/^[ \t]*[-*+][ \t]+(.+)$/);
      const olm = line.match(/^[ \t]*\d+[.)][ \t]+(.+)$/);

      if (ulm || olm) {
        const type = ulm ? 'ul' : 'ol';
        if (list && list.type !== type) flush();
        if (!list) list = { type, items: [] };
        list.items.push(`<li>${renderInline((ulm || olm)[1])}</li>`);
        continue;
      }

      flush();

      if (!line.trim()) { out.push('<div class="dsb-md__gap"></div>'); continue; }

      const hm = line.match(/^[ \t]*(#{1,6})[ \t]+(.+)$/);
      if (hm) {
        const lv = Math.min(hm[1].length, 3);
        out.push(`<div class="dsb-md__h dsb-md__h${lv}">${renderInline(hm[2])}</div>`);
        continue;
      }

      if (/^[ \t]*([-*_])\1{2,}[ \t]*$/.test(line)) {
        out.push('<div class="dsb-md__hr"></div>');
        continue;
      }

      const qm = line.match(/^[ \t]*>[ \t]?(.*)$/);
      if (qm) {
        out.push(`<div class="dsb-md__quote">${renderInline(qm[1])}</div>`);
        continue;
      }

      out.push(`<div class="dsb-md__p">${renderInline(line)}</div>`);
    }

    flush();
    return out.join('');
  }

  function renderMarkdown(src) {
    if (!src) return '';
    const segs = String(src).split('```');
    let html = '';

    for (let i = 0; i < segs.length; i++) {
      if (i % 2 === 0) {
        html += renderTextBlocks(segs[i]);
        continue;
      }

      let code = segs[i];
      let lang = '';
      const nl = code.indexOf('\n');

      if (nl >= 0) {
        const first = code.slice(0, nl).trim();
        if (first && /^[A-Za-z0-9+#._-]{1,20}$/.test(first)) {
          lang = first;
          code = code.slice(nl + 1);
        }
      }

      code = (i === segs.length - 1)
        ? code.replace(/\n+$/, '')
        : code.replace(/\n$/, '');

      html += `<pre class="dsb-md__pre">` +
        `<code data-lang="${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`;
    }

    return html;
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

  /* ================================================================
     长文本分段缓存
     思路：把 contentText 按"安全边界"切成"已确定段落"和"未完成段落"。
     - 已确定段落：渲染一次，HTML 缓存在 committedHtml，不再重渲染
     - 未完成段落：每次流式追加都重新渲染（只渲染这一小段）
     安全边界：不在代码块内部的 `\n\n` 之后
     ================================================================ */
  function createSegmentBuffer() {
    return {
      text: '',
      committedHtml: '',
      committedLength: 0,
      scanPos: 0,
      lastSafeBreak: 0,
      inCode: false,
    };
  }

  function scanSafeBreak(buf) {
    const text = buf.text;
    let i = buf.scanPos;
    // 回退 2 个字符重扫，防止 ``` 被拆包
    const start = Math.max(0, i - 2);
    i = start;

    let inCode = false;
    // 从头扫到 start 确认 inCode 状态
    // 简化：每次重扫全部（下面的 scanPos 会记录，但这里从 0 重扫保证正确）
    // 由于只在最终渲染时才更新 lastSafeBreak，性能可接受
    i = 0;
    let lastSafe = buf.lastSafeBreak;

    while (i < text.length) {
      if (text.startsWith('```', i)) {
        inCode = !inCode;
        i += 3;
        continue;
      }
      if (!inCode && text.startsWith('\n\n', i)) {
        lastSafe = i + 2;
        i += 2;
        continue;
      }
      i++;
    }

    buf.inCode = inCode;
    buf.scanPos = text.length;
    buf.lastSafeBreak = lastSafe;
  }

  function renderSegmented(buf) {
    scanSafeBreak(buf);

    // 把新确定的段落渲染并缓存
    if (buf.lastSafeBreak > buf.committedLength) {
      const newChunk = buf.text.slice(buf.committedLength, buf.lastSafeBreak);
      buf.committedHtml += renderMarkdown(newChunk);
      buf.committedLength = buf.lastSafeBreak;
    }

    // 未完成段落每次重渲染
    const remaining = buf.text.slice(buf.committedLength).replace(/^\s+/, '');
    return buf.committedHtml + renderMarkdown(remaining);
  }

  /* ---------- 模型 ---------- */
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

  /* ---------- 流式请求 ---------- */
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

  /* ============================================================
     注册应用
     ============================================================ */
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '豆沙包',
    icon: './assets/doushabao.svg',
    initialRoute: 'home',
    version: '1.0.8',

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
        padding: 10px 14px;
        border-bottom: 1px solid var(--wj-border, #e6e9ef);
      }
      .dsb-header__title {
        font-size: 24px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
        line-height: 1.2;
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
        font-size: 18px;
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
        gap: 8px;
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
        word-break: break-word;
        white-space: normal;
      }

      .dsb-md__p   { margin: 0; }
      .dsb-md__gap { height: 8px; }
      .dsb-md__h   { font-weight: 700; margin: 10px 0 2px; }
      .dsb-md__h1  { font-size: 19px; }
      .dsb-md__h2  { font-size: 17px; }
      .dsb-md__h3  { font-size: 16px; }
      .dsb-md__list { margin: 4px 0; padding-left: 20px; }
      .dsb-md__list li { margin: 2px 0; }
      .dsb-md__hr {
        height: 1px; margin: 10px 0;
        background: var(--wj-border, #e6e9ef);
      }
      .dsb-md__quote {
        margin: 4px 0; padding-left: 10px;
        border-left: 3px solid var(--wj-border, #e6e9ef);
        color: var(--wj-text-muted);
      }
      .dsb-md__icode {
        padding: 1px 5px; border-radius: 4px;
        background: var(--wj-bg-alt, #f2f4f8);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: .92em;
        word-break: break-all;
      }
      .dsb-md__pre {
        margin: 8px 0; padding: 10px 12px;
        border-radius: 8px;
        background: var(--wj-bg-alt, #f2f4f8);
        overflow-x: hidden;   /* ★ 不再横向滚动 */
      }
      .dsb-md__pre code {
        display: block;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        /* ★ 自动换行：保留换行和空格，长行折断 */
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .dsb-md__a { color: var(--wj-primary, #3a6ff0); word-break: break-all; }

      .dsb-error { color: var(--wj-danger, #e0356b); }

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
      .dsb-tts.is-loading {
        color: var(--wj-text-muted);
        border-color: var(--wj-border, #e6e9ef);
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
          let contentBuf = null;
          let inStream = false;
          let reasoningEl = null;
          let contentEl = null;
          let ttsBtn = null;

          // 节流渲染状态
          let renderScheduled = false;
          let lastRenderAt = 0;
          let renderTimer = null;

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

            bodyEl.innerHTML = `
              <div class="dsb-answer">
                <div class="dsb-reasoning" hidden>
                  <div class="dsb-reasoning__label">思考过程</div>
                  <div class="dsb-reasoning__body"></div>
                </div>
                <div class="dsb-content"></div>
                <div class="dsb-tts-row">
                  <button class="dsb-tts" id="dsbTtsBtn" type="button" disabled>
                    <span class="dsb-tts__icon">🔊</span><span class="dsb-tts__text">朗读</span>
                  </button>
                </div>
              </div>
            `;
            reasoningEl = bodyEl.querySelector('.dsb-reasoning');
            contentEl = bodyEl.querySelector('.dsb-content');
            ttsBtn = bodyEl.querySelector('#dsbTtsBtn');

            if (ttsBtn) {
              ttsBtn.addEventListener('click', onTtsClick);
            }
          }

          function updateTtsUI(state) {
            if (!ttsBtn) return;
            ttsBtn.classList.remove('is-speaking', 'is-loading');

            if (state === 'loading') {
              ttsBtn.classList.add('is-loading');
              ttsBtn.disabled = true;
              ttsBtn.querySelector('.dsb-tts__icon').textContent = '⏳';
              ttsBtn.querySelector('.dsb-tts__text').textContent = '合成中';
              return;
            }
            if (state === 'playing') {
              ttsBtn.classList.add('is-speaking');
              ttsBtn.disabled = false;
              ttsBtn.querySelector('.dsb-tts__icon').textContent = '⏹';
              ttsBtn.querySelector('.dsb-tts__text').textContent = '停止';
              return;
            }
            ttsBtn.disabled = false;
            ttsBtn.querySelector('.dsb-tts__icon').textContent = '🔊';
            ttsBtn.querySelector('.dsb-tts__text').textContent = '朗读';
          }

          async function onTtsClick() {
            if (!ttsBtn || !contentBuf || !contentBuf.text.trim()) return;

            if (ttsSpeaking) {
              stopTts();
              updateTtsUI('idle');
              return;
            }
            if (ttsLoading) return;

            await playTts(contentBuf.text, {
              onStateChange: (state, msg) => {
                if (!root.isConnected) return;
                if (state === 'error') {
                  updateTtsUI('idle');
                  // 显示具体原因
                  if (msg) {
                    // 短暂改按钮文字提示
                    const textEl = ttsBtn.querySelector('.dsb-tts__text');
                    if (textEl) {
                      textEl.textContent = msg.slice(0, 10);
                      setTimeout(() => {
                        if (ttsBtn && !ttsSpeaking && !ttsLoading) {
                          textEl.textContent = '朗读';
                        }
                      }, 3000);
                    }
                  }
                } else {
                  updateTtsUI(state);
                }
              },
            });
          }

          /* ---------- 节流渲染 ---------- */
          function doRenderContent() {
            if (!contentEl || !contentBuf) return;
            const stick = isNearBottom(bodyEl);
            contentEl.innerHTML = renderSegmented(contentBuf);
            if (stick) bodyEl.scrollTop = bodyEl.scrollHeight;
          }

          function scheduleRenderContent() {
            if (renderScheduled) return;
            renderScheduled = true;

            const now = performance.now();
            const delay = Math.max(0, RENDER_THROTTLE_MS - (now - lastRenderAt));

            renderTimer = setTimeout(() => {
              renderTimer = null;
              renderScheduled = false;
              lastRenderAt = performance.now();
              if (!root.isConnected) return;
              doRenderContent();
            }, delay);
          }

          function flushRenderContent() {
            if (renderTimer) {
              clearTimeout(renderTimer);
              renderTimer = null;
            }
            renderScheduled = false;
            lastRenderAt = performance.now();
            doRenderContent();
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
            contentBuf.text += text;
            scheduleRenderContent();
          }

          async function send() {
            if (busy) return;
            const text = inputEl.value.trim();
            if (!text) return;

            stopTts();
            ttsBtn = null;
            ttsSpeaking = false;
            ttsLoading = false;

            busy = true;
            sendBtn.disabled = true;
            inputEl.value = '';

            reasoningText = '';
            contentBuf = createSegmentBuffer();
            inStream = false;
            reasoningEl = null;
            contentEl = null;

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
                // 流式结束，强制渲染一次最终结果
                flushRenderContent();
                bodyEl.scrollTop = bodyEl.scrollHeight;
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
            }
          }

          sendBtn.addEventListener('click', send);

          inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
              e.preventDefault();
              send();
            }
          });

          renderIdle();

          return () => {
            stopTts();
            if (renderTimer) {
              clearTimeout(renderTimer);
              renderTimer = null;
            }
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