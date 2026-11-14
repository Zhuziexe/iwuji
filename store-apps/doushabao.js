(() => {
  const BUNDLE = 'com.wujinb.doushabao';
  const KB_URL = './assets/com.wujinb.doushabao/data.txt';

  /* ================================================================
     TTS 配置
     ================================================================ */
  const TTS_API = 'https://xiaoapi.cn/v1/zs_tts.php';
  const TTS_TYPE = 'baidu';
  const TTS_VOICE_ID = 4129;

  const TTS_MAX_SEGMENT = 100;
  const TTS_MIN_SEGMENT = 6;
  const TTS_MAX_RETRIES = 2;
  const TTS_CONCURRENCY = 3;
  const TTS_RETRY_BASE_MS = 300;

  /* ================================================================
     TTS 全局状态（全局单例，同一时间只播一条）
     ================================================================ */
  let ttsAudio = null;
  let ttsSpeaking = false;
  let ttsLoading = false;
  let ttsAbort = null;
  let activeTtsBtn = null;

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

  /* ================================================================
     TTS 清洗：去代码块、HTML、图片、Markdown 符号、emoji、零宽字符
     ================================================================ */
  function cleanTextForTts(text) {
    if (!text) return '';
    return String(text)
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[>\-+*]\s+/gm, '')
      .replace(/[*_~]{1,3}/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[ \t\u00A0]+/g, ' ')
      .trim();
  }

  /* ================================================================
     TTS 分段：换行 → 句切 → 逗切 → 硬切，最后合并过短段
     ================================================================ */
  function splitSentences(text) {
    return text
      .split(/(?<=[。！？；.!?;])\s*/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function splitByComma(text) {
    return text
      .split(/(?<=[，、,])/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function hardSplit(text, max) {
    const chars = Array.from(text);
    const out = [];
    for (let i = 0; i < chars.length; i += max) {
      out.push(chars.slice(i, i + max).join(''));
    }
    return out;
  }

  function segmentText(text) {
    if (!text) return [];
    const raw = [];
    const lines = text.split(/\n+/);

    for (const line of lines) {
      const cleaned = line.replace(/\s+/g, ' ').trim();
      if (!cleaned) continue;

      for (const sentence of splitSentences(cleaned)) {
        if (Array.from(sentence).length <= TTS_MAX_SEGMENT) {
          raw.push(sentence);
          continue;
        }
        const parts = splitByComma(sentence);
        let cur = '';
        for (const p of parts) {
          const next = cur + p;
          if (Array.from(next).length > TTS_MAX_SEGMENT && cur) {
            raw.push(cur);
            cur = p;
          } else {
            cur = next;
          }
        }
        if (cur) {
          if (Array.from(cur).length > TTS_MAX_SEGMENT) {
            raw.push(...hardSplit(cur, TTS_MAX_SEGMENT));
          } else {
            raw.push(cur);
          }
        }
      }
    }

    const merged = [];
    for (const seg of raw) {
      if (Array.from(seg).length < TTS_MIN_SEGMENT && merged.length) {
        merged[merged.length - 1] += seg;
      } else {
        merged.push(seg);
      }
    }

    const final = [];
    for (const seg of merged) {
      if (Array.from(seg).length > TTS_MAX_SEGMENT * 1.5) {
        final.push(...hardSplit(seg, TTS_MAX_SEGMENT));
      } else {
        final.push(seg);
      }
    }
    return final;
  }

  /* ================================================================
     TTS 请求
     ================================================================ */
  async function requestTts(text, signal) {
    const sliced = Array.from(text).slice(0, 500).join('');
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

  async function requestTtsWithRetry(text, signal, maxRetries = TTS_MAX_RETRIES) {
    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      try {
        return await requestTts(text, signal);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        lastErr = err;
        if (attempt < maxRetries) {
          const wait = Math.min(3000, TTS_RETRY_BASE_MS * Math.pow(2, attempt));
          console.warn(
            `[doushabao] TTS 重试 ${attempt + 1}/${maxRetries}，${wait}ms 后`,
            err.ttsMsg || err.message
          );
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    throw lastErr;
  }

  async function runWithConcurrency(tasks, limit, signal) {
    const results = new Array(tasks.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (true) {
        const idx = next++;
        if (idx >= tasks.length) return;
        if (signal?.aborted) return;
        try {
          results[idx] = await tasks[idx]();
        } catch {
          results[idx] = null;
        }
      }
    });
    await Promise.all(workers);
    return results;
  }

  /* ================================================================
     TTS 播放
     ================================================================ */
  function playAudio(url, onStateChange, opts = {}) {
    const { notifyIdle = true } = opts;
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
        onStateChange?.('error', '自动播放被拦截');
        resolve(false);
      });
    });
  }

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

  async function playTts(text, { onStateChange } = {}) {
    stopTts();

    const clean = cleanTextForTts(text);
    if (!clean) return false;

    const segments = segmentText(clean);
    if (!segments.length) return false;

    console.log(`[doushabao] TTS 切分为 ${segments.length} 段`);

    ttsLoading = true;
    ttsAbort = new AbortController();
    const signal = ttsAbort.signal;
    onStateChange?.('loading');

    try {
      // 1. 第一段优先请求，尽快出声
      let firstUrl = null;
      let firstIndex = 0;
      for (let i = 0; i < segments.length; i++) {
        if (!ttsAbort) return false;
        try {
          firstUrl = await requestTtsWithRetry(segments[i], signal);
          firstIndex = i;
          break;
        } catch (err) {
          if (err.name === 'AbortError') return false;
          console.warn(`[doushabao] TTS 第 ${i + 1} 段失败，跳过`, err.ttsMsg || err.message);
        }
      }

      if (!firstUrl) throw new Error('所有段落都合成失败，无法朗读');

      // 2. 剩余段并发请求（上限 3）
      const urls = new Array(segments.length).fill(null);
      urls[firstIndex] = firstUrl;

      const tasks = segments.map((seg, i) => {
        if (i === firstIndex) return null;
        return async () => {
          try {
            urls[i] = await requestTtsWithRetry(seg, signal);
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.warn(`[doushabao] TTS 第 ${i + 1} 段失败，跳过`, err.ttsMsg || err.message);
            }
          }
        };
      }).filter(Boolean);

      const pendingPromise = runWithConcurrency(tasks, TTS_CONCURRENCY, signal);

      // 3. 播放第一段（不切 idle，给后续段接管）
      const firstOk = await playAudio(firstUrl, onStateChange, { notifyIdle: false });
      if (!firstOk || !ttsAbort) return firstOk;

      // 4. 等剩余请求完成
      await pendingPromise;
      if (!ttsAbort) return true;

      // 5. 收集后续成功段
      const playable = [];
      for (let i = firstIndex + 1; i < urls.length; i++) {
        if (urls[i]) playable.push(urls[i]);
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

  /* ================================================================
     TTS 按钮 UI
     ================================================================ */
  function resetTtsUI(btn) {
    if (!btn) return;
    btn.classList.remove('is-speaking', 'is-loading');
    btn.disabled = false;
    const icon = btn.querySelector('.dsb-tts-icon');
    const text = btn.querySelector('.dsb-tts-text');
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = '朗读';
  }

  function setTtsUI(btn, state, msg) {
    if (!btn) return;
    btn.classList.remove('is-speaking', 'is-loading');
    const icon = btn.querySelector('.dsb-tts-icon');
    const text = btn.querySelector('.dsb-tts-text');

    if (state === 'loading') {
      btn.classList.add('is-loading');
      btn.disabled = true;
      if (icon) icon.textContent = '⏳';
      if (text) text.textContent = '合成中';
      return;
    }
    if (state === 'playing') {
      btn.classList.add('is-speaking');
      btn.disabled = false;
      if (icon) icon.textContent = '⏹';
      if (text) text.textContent = '停止';
      return;
    }
    if (state === 'error') {
      btn.disabled = false;
      if (icon) icon.textContent = '🔊';
      if (text) text.textContent = (msg || '失败').slice(0, 8);
      setTimeout(() => {
        if (!btn.classList.contains('is-speaking') && !btn.classList.contains('is-loading')) {
          resetTtsUI(btn);
        }
      }, 3000);
      return;
    }
    resetTtsUI(btn);
  }

  async function onTtsClick(btn, text) {
    // 点的是正在播的那条 → 停止
    if (activeTtsBtn === btn && (ttsSpeaking || ttsLoading)) {
      stopTts();
      resetTtsUI(btn);
      activeTtsBtn = null;
      return;
    }

    // 停止其它按钮的播放
    if (activeTtsBtn && activeTtsBtn !== btn) {
      resetTtsUI(activeTtsBtn);
    }
    stopTts();
    activeTtsBtn = btn;

    await playTts(text, {
      onStateChange: (state, msg) => {
        setTtsUI(btn, state, msg);
        if ((state === 'idle' || state === 'error') && activeTtsBtn === btn) {
          activeTtsBtn = null;
        }
      },
    });
  }

  /* ================================================================
     知识库（从 data.txt 异步加载）
     ================================================================ */
  const SYSTEM_RULES = [
    {
      keys: ['帮助', '你会什么', '你会干啥', '能干啥', '会做什么', '有什么功能', '功能列表', '你能干嘛'],
      answer: '我能聊一些百科常识、回答问题、算数、讲讲冷笑话。\n你想问什么，直接说就行。',
      boost: 0.8,
    },
    {
      keys: ['你好', '您好', '嗨', 'hi', 'hello'],
      exactOnly: true,
      answer: '有屁快放',
      boost: 0.8,
    },
  ];

  let KB_RULES = null;
  let kbPromise = null;

  function parseKBText(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf(':');
      if (idx <= 0) continue;
      const keyPart = t.slice(0, idx).trim();
      let val = t.slice(idx + 1).trim();
      if (!keyPart || !val) continue;
      // 字面 \n → 真正的换行
      val = val.replace(/\\n/g, '\n');
      const keys = keyPart.split('|').map(s => s.trim()).filter(Boolean);
      if (keys.length) out.push({ keys, answer: val, boost: 1.2 });
    }
    return out;
  }

  function loadKB() {
    if (KB_RULES) return Promise.resolve(KB_RULES);
    if (kbPromise) return kbPromise;

    kbPromise = fetch(KB_URL, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(text => {
        KB_RULES = parseKBText(text);
        console.log(`[doushabao] 知识库已加载，共 ${KB_RULES.length} 条`);
        return KB_RULES;
      })
      .catch(err => {
        console.warn('[doushabao] 知识库加载失败', err);
        // 失败不缓存 KB_RULES，下次调用可重试
        return null;
      })
      .finally(() => {
        kbPromise = null;
      });

    return kbPromise;
  }

  function getRules() {
    return KB_RULES ? [...SYSTEM_RULES, ...KB_RULES] : SYSTEM_RULES.slice();
  }

  /* ================================================================
     兜底回复
     ================================================================ */
  const FALLBACK_PARTS = {
    open: [
      '这个问题我暂时没有把握。',
      '嗯…这个我不太确定。',
      '说实话，这个超出我的能力范围了。',
      '我好像没见过这个说法。',
      '这个嘛…我得承认我不会。',
      '抱歉，这个我答不上来。',
    ],
    close: [
      '你可以换个说法再问一次。',
      '要不你补充一点细节，我再试试？',
      '换个角度描述一下？',
      '你可以问我天气、节日、百科常识之类的。',
      '试试问得更具体一点？',
      '直接告诉我更多背景，我可能就想起来了。',
    ],
  };

  function randomFallback() {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const open = pick(FALLBACK_PARTS.open);
    const close = pick(FALLBACK_PARTS.close);
    return `${open}\n${close}`;
  }

  /* ================================================================
     归一化
     ================================================================ */
  function normalize(s) {
    const keep = new Set(['+', '#', '.']);
    return Array.from(String(s))
      .filter(c => keep.has(c) || !/[\s\p{P}\p{S}]/u.test(c))
      .map(c => c.toLowerCase())
      .join('');
  }

  /* ================================================================
     前后缀剥离
     ================================================================ */
  const PREFIXES = [
    '请问一下', '请问', '我想问一下', '我想问', '想问一下', '想问', '问一下',
    '什么是', '什么叫', '啥是',
    '帮我查一下', '帮我查', '帮我看看', '帮我', '帮忙',
    '能不能', '可不可以', '可以', '告诉我', '你知道',
    '你好', '您好', '嗨', 'hi', 'hello', 'hey',
  ];

  const SUFFIXES = [
    '是什么呀', '是什么啊', '是什么', '是啥呀', '是啥', '是嘛',
    '有什么用', '有啥用', '干什么用', '能干嘛', '是干什么的', '干什么的',
    '怎么样', '怎么用', '如何', '怎么', '怎样',
    '呀', '啊', '呢', '吧', '吗', '嘛', '哦', '喔', '哟',
    '谢谢', '多谢',
  ];

  function candidates(raw) {
    const norm = normalize(raw);
    const set = new Set([norm]);
    const queue = [norm];

    while (queue.length) {
      const cur = queue.shift();
      for (const p of PREFIXES) {
        const np = normalize(p);
        if (np && cur.startsWith(np) && cur.length > np.length) {
          const next = cur.slice(np.length);
          if (!set.has(next)) { set.add(next); queue.push(next); }
        }
      }
      for (const s of SUFFIXES) {
        const ns = normalize(s);
        if (ns && cur.endsWith(ns) && cur.length > ns.length) {
          const next = cur.slice(0, cur.length - ns.length);
          if (!set.has(next)) { set.add(next); queue.push(next); }
        }
      }
    }
    return [...set];
  }

  /* ================================================================
     相似度
     ================================================================ */
  function editDistance(a, b) {
    const A = Array.from(a), B = Array.from(b);
    const n = A.length, m = B.length;
    if (!n) return m;
    if (!m) return n;
    let prev = new Array(m + 1), cur = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
      cur[0] = i;
      for (let j = 1; j <= m; j++) {
        const cost = A[i - 1] === B[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, cur] = [cur, prev];
    }
    return prev[m];
  }

  function fuzzyContains(text, key) {
    const T = Array.from(text), K = Array.from(key);
    if (!K.length) return 0;
    const tlen = T.length, klen = K.length;
    if (tlen < klen - 1) {
      return 1 - editDistance(T, K) / Math.max(tlen, klen);
    }
    let best = 0;
    for (let w = Math.max(1, klen - 1); w <= klen + 1; w++) {
      if (w > tlen) continue;
      for (let s = 0; s + w <= tlen; s++) {
        const d = editDistance(T.slice(s, s + w), K);
        const sim = 1 - d / Math.max(w, klen);
        if (sim > best) best = sim;
        if (best >= 1) return 1;
      }
    }
    return best;
  }

  function bigramDice(a, b) {
    const A = Array.from(a), B = Array.from(b);
    if (a === b) return 1;
    if (A.length < 2 || B.length < 2) return 0;
    const ma = new Map(), mb = new Map();
    for (let i = 0; i + 1 < A.length; i++) { const g = A[i] + A[i + 1]; ma.set(g, (ma.get(g) || 0) + 1); }
    for (let i = 0; i + 1 < B.length; i++) { const g = B[i] + B[i + 1]; mb.set(g, (mb.get(g) || 0) + 1); }
    let inter = 0, total = 0;
    for (const [g, c] of ma) { total += c; const c2 = mb.get(g) || 0; if (c2) inter += Math.min(c, c2); }
    for (const [, c] of mb) total += c;
    return total ? 2 * inter / total : 0;
  }

  function similarity(text, key) {
    return Math.max(fuzzyContains(text, key), bigramDice(text, key));
  }

  /* ================================================================
     打分
     ================================================================ */
  function scoreRule(input, rule) {
    let best = 0;
    for (const key of rule.keys) {
      const nk = normalize(key);
      if (!nk) continue;
      const rawLen = Array.from(key).length;

      if (rawLen <= 1) {
        if (input === nk) best = Math.max(best, 1.5 * (rule.boost || 1));
        continue;
      }

      const sim = similarity(input, nk);
      if (sim < 0.6) continue;

      const lenBonus = Math.min(0.5, rawLen * 0.08);
      const s = (sim + lenBonus) * (rule.boost || 1);
      if (s > best) best = s;
    }
    return best;
  }

  /* ================================================================
     匹配入口
     ================================================================ */
  const THRESHOLD = 0.75;

  function matchRule(rawInput) {
    const rules = getRules();
    const cands = candidates(rawInput);
    let bestAns = null;
    let bestScore = 0;
    let bestKey = null;

    for (const r of rules) {
      if (!r.exactOnly) continue;
      for (const k of r.keys) {
        const nk = normalize(k);
        if (cands.some(c => c === nk)) {
          return { answer: r.answer, score: 99, key: k };
        }
      }
    }

    for (const input of cands) {
      if (!input) continue;
      for (const r of rules) {
        if (r.exactOnly) continue;
        const s = scoreRule(input, r);
        if (s > bestScore) {
          bestScore = s;
          bestAns = r.answer;
          bestKey = r.keys[0];
        }
      }
    }

    return bestScore >= THRESHOLD
      ? { answer: bestAns, score: bestScore, key: bestKey }
      : null;
  }

  /* ================================================================
     应用注册
     ================================================================ */
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '豆沙包',
    icon: './assets/doushabao.svg',
    initialRoute: 'home',
    version: '1.2.2',
    devices: ['iwuji', 'pc'],

    styles: `
      .dsb-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--wj-bg);
        padding-top: var(--statusbar-h);
        overflow: hidden;
      }

      .dsb-header {
        flex: 0 0 auto;
        padding: 11px 20px 12px;
        border-bottom: 1px solid var(--wj-border, #e6e9ef);
        background: var(--wj-bg);
      }
      .dsb-title {
        font-size: var(--wj-fs-2xl);
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .3px;
      }
      .dsb-subtitle {
        font-size: var(--wj-fs-xs);
        color: var(--wj-text-dim);
        margin-top: 2px;
      }

      .dsb-chat {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: var(--wj-bg-alt, #fafbfc);
      }

      .dsb-msg {
        max-width: 82%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: var(--wj-fs-md);
        line-height: 1.55;
        word-break: break-word;
      }
      .dsb-msg--user {
        align-self: flex-end;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        border-bottom-right-radius: 4px;
        white-space: pre-wrap;
      }
      .dsb-msg--bot {
        align-self: flex-start;
        background: var(--wj-bg, #fff);
        color: var(--wj-text);
        border: 1px solid var(--wj-border, #e6e9ef);
        border-bottom-left-radius: 4px;
      }
      .dsb-msg-body { white-space: pre-wrap; }

      .dsb-disclaimer {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed var(--wj-border, #e6e9ef);
        font-size: var(--wj-fs-xs, 11px);
        color: var(--wj-text-dim);
        line-height: 1.4;
      }

      .dsb-thinking {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        padding: 3px 0;
      }
      .dsb-thinking span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--wj-text-dim, #b0b6c0);
        animation: dsb-blink 1.2s infinite;
      }
      .dsb-thinking span:nth-child(2) { animation-delay: .2s; }
      .dsb-thinking span:nth-child(3) { animation-delay: .4s; }
      @keyframes dsb-blink {
        0%, 60%, 100% { opacity: .3; }
        30% { opacity: 1; }
      }

      .dsb-tts-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 4px;
      }
      .dsb-tts-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 48px;
        padding: 0 16px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 15px;
        background: transparent;
        color: var(--wj-text-dim);
        font: inherit;
        font-size: var(--wj-fs-xs, 12px);
        font-weight: 500;
        cursor: pointer;
        transition: color .15s, border-color .15s, background .15s, opacity .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .dsb-tts-btn:hover:not(:disabled) {
        color: var(--wj-primary, #3a6ff0);
        border-color: var(--wj-primary, #3a6ff0);
      }
      .dsb-tts-btn:active:not(:disabled) { transform: scale(.96); }
      .dsb-tts-btn:disabled { opacity: .45; cursor: not-allowed; }
      .dsb-tts-btn.is-speaking {
        color: var(--wj-primary, #3a6ff0);
        border-color: var(--wj-primary, #3a6ff0);
        background: rgba(58, 111, 240, .08);
      }
      .dsb-tts-btn.is-loading { color: var(--wj-text-dim); }
      .dsb-tts-icon { font-size: 13px; line-height: 1; }

      .dsb-footer {
        flex: 0 0 auto;
        display: flex;
        gap: 8px;
        padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid var(--wj-border, #e6e9ef);
        background: var(--wj-bg);
      }
      .dsb-input {
        flex: 1 1 auto;
        min-width: 0;
        height: 60px;
        padding: 0 14px;
        border: 1px solid var(--wj-border, #e6e9ef);
        border-radius: 10px;
        background: var(--wj-bg-alt, #f5f6f8);
        color: var(--wj-text);
        font: inherit;
        font-size: var(--wj-fs-md, 14px);
        outline: none;
        box-sizing: border-box;
      }
      .dsb-input:focus {
        border-color: var(--wj-primary, #3a6ff0);
        background: var(--wj-bg);
      }
      .dsb-input:disabled { opacity: .6; }
      .dsb-send {
        flex: 0 0 auto;
        height: 60px;
        padding: 0 24px;
        border: 0;
        border-radius: 10px;
        background: var(--wj-primary, #3a6ff0);
        color: #fff;
        font: inherit;
        font-size: var(--wj-fs-md, 14px);
        font-weight: 600;
        cursor: pointer;
        transition: opacity .15s, transform .1s;
        -webkit-tap-highlight-color: transparent;
      }
      .dsb-send:disabled { opacity: .5; cursor: not-allowed; }
      .dsb-send:active:not(:disabled) { transform: scale(.97); }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="dsb-page">
              <header class="dsb-header">
                <div class="dsb-title">豆沙包</div>
                <div class="dsb-subtitle">AI 助手</div>
              </header>
              <div class="dsb-chat" id="dsbChat"></div>
              <div class="dsb-footer">
                ${ window.WJ_IME
                  ? '<div id="dsbInput" class="dsb-input" data-wj-field="1" data-wj-placeholder="输入你的问题…" tabindex="0" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>'
                  : '<input id="dsbInput" class="dsb-input" type="text" placeholder="输入你的问题…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">'
                }
                <button id="dsbSend" class="dsb-send" type="button">发送</button>
              </div>
            </div>
          `;
        },

        mount(root, ctx) {
          const chatEl = root.querySelector('#dsbChat');
          const inputEl = root.querySelector('#dsbInput');
          const sendBtn = root.querySelector('#dsbSend');

          let busy = false;
          let disposed = false;

          const sleep = ms => new Promise(r => setTimeout(r, ms));

          function addUserMsg(text) {
            const div = document.createElement('div');
            div.className = 'dsb-msg dsb-msg--user';
            div.textContent = text;
            chatEl.appendChild(div);
            chatEl.scrollTop = chatEl.scrollHeight;
          }

          function addBotShell() {
            const wrap = document.createElement('div');
            wrap.className = 'dsb-msg dsb-msg--bot';

            const body = document.createElement('div');
            body.className = 'dsb-msg-body';
            wrap.appendChild(body);

            const ttsRow = document.createElement('div');
            ttsRow.className = 'dsb-tts-row';
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'dsb-tts-btn';
            ttsBtn.type = 'button';
            ttsBtn.disabled = true;
            ttsBtn.innerHTML = '<span class="dsb-tts-icon">🔊</span><span class="dsb-tts-text">朗读</span>';
            ttsRow.appendChild(ttsBtn);
            wrap.appendChild(ttsRow);

            const disclaimer = document.createElement('div');
            disclaimer.className = 'dsb-disclaimer';
            disclaimer.textContent = '内容由 AI 生成，请仔细甄别';
            disclaimer.style.display = 'none';
            wrap.appendChild(disclaimer);

            chatEl.appendChild(wrap);
            chatEl.scrollTop = chatEl.scrollHeight;
            return { wrap, body, disclaimer, ttsBtn };
          }

          function streamText(el, text) {
            return new Promise(resolve => {
              let i = 0;
              const len = text.length;
              const baseSpeed = len < 60 ? 34 : len < 180 ? 22 : 14;
              function step() {
                if (i >= len) { resolve(); return; }
                const ch = text[i];
                el.textContent += ch;
                i++;
                chatEl.scrollTop = chatEl.scrollHeight;
                let delay = baseSpeed;
                if ('，、；：'.includes(ch)) delay = 160;
                else if ('。！？'.includes(ch)) delay = 240;
                else if (ch === '\n') delay = 110;
                else if (Math.random() < 0.12) delay = baseSpeed * 1.7;
                setTimeout(step, delay);
              }
              setTimeout(step, 20);
            });
          }

          async function handle() {
            if (busy || disposed) return;
            const getText = window.WJ_IME ? (() => window.WJ_IME.getFieldText(inputEl)) : (() => inputEl.value);
            const raw = getText().trim();
            if (!raw) return;

            // #2 先取出文本再清空：用 IME 接口清空（自绘 div / input 都适用），避免清空后 IME 又把内容填回。
            if (window.WJ_IME) window.WJ_IME.clearField(inputEl); else inputEl.value = '';
            addUserMsg(raw);

            busy = true;
            sendBtn.disabled = true;
            inputEl.disabled = true;

            // 打断上一条正在播的朗读，并复位它的按钮
            if (activeTtsBtn) {
              resetTtsUI(activeTtsBtn);
              activeTtsBtn = null;
            }
            stopTts();

            const { body, disclaimer, ttsBtn } = addBotShell();
            body.innerHTML = '<span class="dsb-thinking"><span></span><span></span><span></span></span>';

            const t0 = Date.now();
            await loadKB();
            if (disposed) return;

            const matched = matchRule(raw);
            const answer = matched ? matched.answer : randomFallback();

            const elapsed = Date.now() - t0;
            const minThink = matched ? 350 : 600;
            if (elapsed < minThink) await sleep(minThink - elapsed);

            body.innerHTML = '';
            await streamText(body, answer);
            disclaimer.style.display = 'block';

            // 流式结束后启用朗读
            ttsBtn.disabled = false;
            ttsBtn.addEventListener('click', () => onTtsClick(ttsBtn, answer));

            busy = false;
            sendBtn.disabled = false;
            inputEl.disabled = false;
          }

          sendBtn.addEventListener('click', handle);
          inputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) {
              e.preventDefault();
              handle();
            }
          });

          // 预加载知识库
          loadKB();

          return () => {
            disposed = true;
            if (activeTtsBtn) {
              resetTtsUI(activeTtsBtn);
              activeTtsBtn = null;
            }
            stopTts();
          };
        },
      },
    },
  });
})();