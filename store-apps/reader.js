(() => {
  const BUNDLE = 'com.niunai.reader';
  const NAME = '牛奶阅读';
  const ICON_URL = './assets/reader.svg';
  const AUTHOR = 'Niunai';

  // 维基文库（公有领域书）。en/zh 都支持 origin=* 的 CORS。
  const SITES = [
    { id: 'zh', label: '中文', api: 'https://zh.wikisource.org/w/api.php' },
    { id: 'en', label: 'English', api: 'https://en.wikisource.org/w/api.php' },
  ];

  const escapeHtml = window.escapeHtml || (s => String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  )));

  function api(site, params) {
    const u = new URL(site.api);
    u.searchParams.set('format', 'json');
    u.searchParams.set('origin', '*');
    for (const k in params) u.searchParams.set(k, params[k]);
    return fetch(u.toString(), { cache: 'no-store' });
  }

  async function searchBooks(site, q) {
    const r = await api(site, {
      action: 'query', list: 'search', srsearch: q, srlimit: '20', srnamespace: '0',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return (j.query?.search || []).map(it => ({
      title: it.title,
      snippet: (it.snippet || '').replace(/<[^>]+>/g, ''),
    }));
  }

  // 取渲染后的 HTML（prop=text）：MediaWiki 会先把 <pages index=.../> 转引标签展开成真实正文。
  async function fetchHtml(site, title) {
    const r = await api(site, {
      action: 'parse', page: title, prop: 'text',
      disablelimitreport: '1', formatversion: '2',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.info || '获取失败');
    return j.parse?.text || '';
  }

  // 取原始 wikitext（兜底解析用）。
  async function fetchWikitext(site, title) {
    const r = await api(site, {
      action: 'parse', page: title, prop: 'wikitext',
      disablelimitreport: '1', formatversion: '2',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.info || '获取失败');
    return j.parse?.wikitext || '';
  }

  // ── 解析渲染 HTML 里的正文段落 ──────────────────────────────
  // 返回 { items, hasRealText }。hasRealText 表示存在「去掉页码标注后
  // 仍有实质汉字」的正文，用于区分「整本书」与「未内联文字的扫描页」。
  function parseProse(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.querySelector('.mw-parser-output') || doc.body;
    // 移除明显非正文的装饰/导航节点。
    // 注意：不要把 table 整体删掉 —— 很多诗词古籍把正文逐句排在表格里，
    // 真正要剔的是「导航/目录型大表」（含大量链接或 Page: 标注）。
    root.querySelectorAll(
      '.ws-noexport, style, script, .noprint, sup.reference, ' +
      'nav, .mw-editsection, .toc, .plainSister, .ws-header, ' +
      '.licenseContainer, .licensetpl, #headerContainer'
    ).forEach(n => n.remove());

    // 扫描影印页：ProofreadPage 未内联 OCR 文字时，整段只剩
    // 「卷名 + 大量 Page:xxx.djvu 页码标注」，不能当正文。
    // 判据：段内出现 ≥3 个 "Page:" 标注即视为扫描导航段，剔除。
    const pageMarkCount = s => (s.match(/Page:/gi) || []).length;
    const isScanNav = s => pageMarkCount(s) >= 3;
    const hasHan = s => /[一-鿿㐀-䶿]/.test(s);
    // 媒体文件名（webm/ogg 等朗读/影音）不应作为正文显示。
    const hasMedia = s => /\b(webm|ogv|ogg|mp4|mp3|wav|m4a)\b/i.test(s) || /\.(webm|ogv|ogg|mp4|mp3|wav|m4a)(\?|$)/i.test(s);
    const keep = s => s && s.length > 1 && !isScanNav(s) && !hasMedia(s);

    const items = [];
    // 主路径：常规正文容器
    root.querySelectorAll('p, .poem, blockquote, h2, h3, h4').forEach(n => {
      const s = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (keep(s)) items.push({ text: s, kind: n.tagName[0] === 'H' ? 'h' : 'p' });
    });
    // 兜底：正文型表格 / 扫描页的 pagetext —— 仅当主路径几乎为空时启用，
    // 避免把「目录大表」误当正文。
    if (items.filter(it => it.kind === 'p').length < 2) {
      root.querySelectorAll('div.pagetext, div.poem, div.thumbcaption').forEach(n => {
        const s = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (keep(s)) items.push({ text: s, kind: 'p' });
      });
      // 表格兜底：逐单元格取文本，但剔除「导航/目录型大表」。
      // Wikisource 的古籍分类导航表（如《四庫全書》的 multicol 巨表：4 个单元格塞了
      // 上千个链接）会把孙级链接误当正文。判据：表格内「链接数 ≫ 文字单元格数」
      // （内容几乎全是链接）即为导航表，整表跳过；真正诗词正文表每格一句诗、链接极少。
      root.querySelectorAll('table').forEach(tb => {
        const txt = (tb.textContent || '');
        if (isScanNav(txt)) return;                 // 扫描标注表 → 跳过
        const links = tb.querySelectorAll('a[href]').length;
        const cells = tb.querySelectorAll('td, th');
        const textCells = Array.from(cells).filter(c => (c.textContent || '').replace(/\s+/g, ' ').trim().length > 0);
        // 导航表：链接数远超实际文字单元格（内容几乎都是链接）
        if (links > 0 && links >= Math.max(8, textCells.length * 3)) return;
        cells.forEach(c => {
          const s = (c.textContent || '').replace(/\s+/g, ' ').trim();
          if (keep(s)) items.push({ text: s, kind: 'p' });
        });
      });
    }
    const hasRealText = items.some(it => it.kind === 'p' && it.text.length > 24 && hasHan(it.text));
    return { items, hasRealText };
  }

  // ── 解析消歧义/目录页里的条目列表（<ul><li>/<ol><li>/<table><tr> 中的 /wiki/ 链接）──
  function parseEntries(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const seen = new Set();
    const entries = [];
    const push = (a, container) => {
      if (!a) return;
      const path = decodeURIComponent(a.getAttribute('href') || '').slice('/wiki/'.length);
      if (!path || path.includes(':')) return;
      const text = (a.textContent || '').trim();
      if (!text || seen.has(path)) return;
      const sub = ((container?.textContent) || '')
        .replace(text, '').replace(/^[",\s:—–-]+|[",\s:—–-]+$/g, '').trim();
      seen.add(path);
      entries.push({ title: path, text, sub });
    };
    // 优先列表条目
    doc.querySelectorAll('ul li, ol li').forEach(li => push(li.querySelector('a[href^="/wiki/"]'), li));
    // 列表抓不到时，再补表格行（Wikisource 很多目录用 wikitable）
    if (entries.length < 2) {
      doc.querySelectorAll('table.wikitable tr, table tr').forEach(tr => {
        if (entries.length >= 200) return;       // 防止巨表刷屏
        push(tr.querySelector('a[href^="/wiki/"]'), tr);
      });
    }
    return entries;
  }

  // 兜底：本作品「直接子页」链接（如 論語/學而第一、康熙字典/曰部）。
  // 只取深度为 1 的子页，避免像《四庫全書》那样把经/史/子/集转引出来的
  // 海量孙级链接（四庫全書/經部/易類/...）也当成目录项。
  function extractLinks(html, title) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.querySelector('.mw-parser-output') || doc.body;
    const titleKey = decodeURIComponent(title).replace(/ /g, '_');
    const seen = new Set();
    const links = [];
    root.querySelectorAll('a[href^="/wiki/"]').forEach(a => {
      const dec = decodeURIComponent(a.getAttribute('href') || '');
      const path = dec.slice('/wiki/'.length);
      if (path.includes(':')) return;
      if (!path.startsWith(titleKey + '/')) return;
      // 仅保留直接子页（恰好一个 '/'）：titleKey/xxx
      if (path.slice(titleKey.length + 1).includes('/')) return;
      const text = (a.textContent || '').trim();
      if (!text || seen.has(path)) return;
      seen.add(path);
      links.push({ title: path, text });
    });
    return links;
  }

  // 把「导航型巨表」（如《四庫全書》分类导航表：内容与链接几乎等价）里的
  // 链接还原成可点目录。与 parseProse 共用同一套「导航表」判据；只收集被判定为
  // 导航表的表格内的 /wiki/ 链接（顶层书名、分类条目等），避免目录/正文型小表被误收。
  function extractTableNavLinks(html, title) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.querySelector('.mw-parser-output') || doc.body;
    const tk = decodeURIComponent(title).replace(/ /g, '_');
    const seen = new Set();
    const links = [];
    root.querySelectorAll('table').forEach(tb => {
      const txt = (tb.textContent || '');
      const linkEls = tb.querySelectorAll('a[href^="/wiki/"]');
      const linksN = linkEls.length;
      const cells = tb.querySelectorAll('td, th');
      const textCells = Array.from(cells).filter(c => (c.textContent || '').replace(/\s+/g, ' ').trim().length > 0);
      const isScanNav = (txt.match(/Page:/gi) || []).length >= 3;
      // 与原 parseProse 表格兜底同一判据：链接数 ≫ 文字单元格 → 导航表
      if (isScanNav || !(linksN > 0 && linksN >= Math.max(8, textCells.length * 3))) return;
      linkEls.forEach(a => {
        const path = decodeURIComponent(a.getAttribute('href') || '').slice('/wiki/'.length);
        if (!path || path.includes(':') || path === tk) return;
        const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || seen.has(path)) return;
        seen.add(path);
        links.push({ title: path, text });
      });
      if (links.length >= 300) return;
    });
    return links.slice(0, 300);
  }

  // ── 轻量 wikitext 解析器（兜底）────────────────────────────
  // 处理常见语法：去模板/控制标签、章节标题、链接、列表、强调、HTML 标签。
  // 注意：不展开 <pages> 转引（扫描书正文在别的页），也不求值解析函数。
  function stripTemplates(wt) {
    let depth = 0, out = '', i = 0;
    while (i < wt.length) {
      const two = wt.substr(i, 2);
      if (two === '{{') { depth++; i += 2; continue; }
      if (two === '}}') { if (depth > 0) depth--; else out += '}}'; i += 2; continue; }
      if (two === '{{{') { i += 3; continue; }   // 变量/解析函数整体跳过
      if (depth === 0) out += wt[i];
      i++;
    }
    return out;
  }

  function parseWikitext(wt) {
    // 去掉 transclusion / 控制标签
    wt = wt.replace(/<noinclude>[\s\S]*?<\/noinclude>/gi, '');
    wt = wt.replace(/<includeonly>[\s\S]*?<\/includeonly>/gi, '');
    wt = wt.replace(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/gi, '$1');
    wt = wt.replace(/<(pages|pageindex|references|ref|gallery|imagemap|timeline|math|score|section|poem|div|source|audio|video)[^>]*\/?>/gi, '');
    wt = wt.replace(/<\/(pages|pageindex|references|ref|gallery|imagemap|timeline|math|score|section|poem|div|source|audio|video)>/gi, '');
    // 媒体文件链接（朗读/影音 webm/ogg 等）不作为正文
    wt = wt.replace(/https?:\/\/\S+\.(webm|ogv|ogg|mp4|mp3|wav|m4a)(\?|\b)/gi, '');
    // 去掉分类/文件等命名空间链接
    wt = wt.replace(/\[\[(?:Category|Catégorie|File|Image|Media|Datei|Bild|Archivo)\s*:[^\]]*\]\]/gi, '');
    // 魔法字
    wt = wt.replace(/__[A-Z]+__/g, '');
    // 去模板（平衡括号）
    wt = stripTemplates(wt);
    // 链接 [[a|b]] / [[a]] / [a]
    wt = wt.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
           .replace(/\[\[([^\]]+)\]\]/g, '$1')
           .replace(/\[([^\]]+)\]/g, '$1');
    // 去 HTML 标签与强调
    wt = wt.replace(/<[^>]+>/g, '')
           .replace(/'''''|'''|''/g, '');
    // 按行处理：标题 / 段落
    const lines = wt.split(/\n/);
    const items = [];
    let buf = [];
    const flush = () => {
      const t = buf.join(' ').replace(/\s+/g, ' ').trim();
      if (t && t.length > 1) items.push({ kind: 'p', text: t });
      buf = [];
    };
    for (let line of lines) {
      const s = line.trim();
      if (!s) { flush(); continue; }
      const hm = s.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
      if (hm) { flush(); const t = hm[2].trim(); if (t) items.push({ kind: 'h', text: t }); continue; }
      buf.push(s.replace(/^[\*#;:]+/, '').trim());
    }
    flush();
    return items;
  }

  // 从 Index 索引页模板里取出真正的正文页标题。
  function getIndexTitle(wt) {
    const m = wt.match(/\{\{\s*[Ii]ndex\b[\s\S]*?\}\}/);
    if (!m) return null;
    const kv = m[0].match(/(?:\||^)\s*[Tt]itle\s*=\s*([^\n|]+)/);
    return kv ? kv[1].trim().replace(/^:/, '').replace(/\}+$/, '') : null;
  }

  function fmtSnippet(p) {
    const t = p.replace(/\s+/g, ' ').trim();
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: NAME,
    icon: ICON_URL,
    initialRoute: 'home',
    version: '1.0.0',
    author: AUTHOR,
    description: '牛奶阅读官方正版',
    longdescription: '联网阅读维基文库公有领域图书，搜索书名即可开读。',

    styles: `
      .rd-page {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: var(--wj-bg, #fff);
        color: var(--wj-text, #222);
        padding-top: var(--statusbar-h, 0px);
        overflow: hidden;
      }
      .rd-home-head {
        flex: 0 0 auto;
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 14px 16px 10px;
        border-bottom: 1px solid var(--wj-border, #e6e9ef);
      }
      .rd-app-title { font-size: var(--wj-fs-xl, 22px); font-weight: 800; letter-spacing: .5px; }
      .rd-read__titlebar {
        font-size: 24px; font-weight: 800; flex: 1 1 auto; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;
      }
      .rd-font-btns { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }
      .rd-font-btns button {
        border: 1px solid var(--wj-border, #e6e9ef); background: transparent; color: var(--wj-text, #222);
        border-radius: 999px; font: inherit; font-weight: 700; font-size: var(--wj-fs-sm, 13px);
        padding: 6px 12px; cursor: pointer; -webkit-tap-highlight-color: transparent;
      }
      .rd-font-btns button:active { background: var(--wj-surface, #f2f4f8); }
      .rd-lang {
        border: 1px solid var(--wj-border, #e6e9ef); background: var(--wj-bg, #fff);
        color: var(--wj-text, #222); border-radius: 999px; font: inherit;
        font-size: var(--wj-fs-sm, 13px); padding: 5px 12px; cursor: pointer;
        white-space: nowrap; -webkit-tap-highlight-color: transparent;
      }
      .rd-search-row {
        flex: 0 0 auto; display: flex; gap: 8px; align-items: center;
        padding: 12px 16px;
      }
      .rd-input {
        flex: 1 1 auto; min-width: 0; border: 0; outline: 0;
        background: var(--wj-surface, #f2f4f8); border-radius: 999px;
        padding: 11px 16px; font: inherit; font-size: var(--wj-fs-md, 16px); color: inherit;
      }
      .rd-go {
        flex: 0 0 auto; border: 0; border-radius: 999px;
        background: var(--wj-primary, #3a6ff0); color: #fff; font: inherit;
        font-size: var(--wj-fs-md, 16px); font-weight: 600; padding: 11px 18px;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
      }
      .rd-go:active { filter: brightness(.94); }

      .rd-list { flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; }
      .rd-item {
        padding: 13px 16px; border-bottom: 1px solid var(--wj-border, #eef1f6);
        cursor: pointer; -webkit-tap-highlight-color: transparent;
      }
      .rd-item:active { background: var(--wj-surface, #f2f4f8); }
      .rd-item__name { font-size: var(--wj-fs-md, 16px); font-weight: 600; }
      .rd-item__sub { font-size: var(--wj-fs-sm, 13px); color: var(--wj-text-2, #8a93a6); margin-top: 3px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rd-state { padding: 28px 20px; text-align: center; color: var(--wj-text-2, #8a93a6);
        font-size: var(--wj-fs-md, 16px); }
      .rd-err { color: #e5484d; }
      .rd-ext { display: block; margin: 6px 20px 0; padding: 12px 16px; text-align: center;
        text-decoration: none; color: var(--wj-primary, #2f6fed); font-weight: 600;
        border: 1px solid var(--wj-primary, #2f6fed); border-radius: 10px;
        font-size: var(--wj-fs-md, 16px); }

      .rd-read { flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch;
        padding: 18px 20px 60px; line-height: 1.85; font-size: 16px; }
      .rd-read__title { font-size: 1.4em; font-weight: 700; margin: 0 0 14px; line-height: 1.4; }
      .rd-read__h { font-size: 1.15em; font-weight: 700; margin: 20px 0 8px; }
      .rd-read p { margin: 0 0 14px; font-size: 1em; white-space: pre-wrap; text-indent: 2em; }
    `,

    routes: {
      home: {
        name: 'home',
        render(ctx) {
          const site = ctx.state?.site || SITES[0];
          const q = ctx.state?.q || '';
          return `
            <div class="rd-page" data-route="home">
              <div class="rd-home-head">
                <div class="rd-app-title">牛奶阅读</div>
                <button class="rd-lang" data-act="lang">${site.label} ⇋</button>
              </div>
              <div class="rd-search-row">
                <input class="rd-input" placeholder="搜索书名 / 作者…" value="${escapeHtml(q)}"
                       enterkeyhint="search" />
                <button class="rd-go" data-act="search">搜索</button>
              </div>
              <div class="rd-list" data-role="list">
                <div class="rd-state">输入关键词，从维基文库搜索公版书</div>
              </div>
            </div>`;
        },
        mount(root, ctx) {
          let site = ctx.state?.site || SITES[0];
          let loading = false;

          const input = root.querySelector('.rd-input');
          const listEl = root.querySelector('[data-role="list"]');
          const langBtn = root.querySelector('[data-act="lang"]');
          const goBtn = root.querySelector('[data-act="search"]');

          langBtn.textContent = `${site.label} ⇋`;
          langBtn.addEventListener('click', () => {
            site = SITES[(SITES.indexOf(site) + 1) % SITES.length];
            langBtn.textContent = `${site.label} ⇋`;
            ctx.setState?.({ site });
            const q = input.value.trim();
            if (q) doSearch(q);
          });

          function runSearch() {
            const q = input.value.trim();
            if (q) doSearch(q);
          }
          goBtn.addEventListener('click', runSearch);
          input.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });

          async function doSearch(q) {
            if (loading) return;
            loading = true;
            ctx.setState?.({ q, site });
            listEl.innerHTML = `<div class="rd-state">正在搜索「${escapeHtml(q)}」…</div>`;
            try {
              const books = await searchBooks(site, q);
              if (!books.length) {
                listEl.innerHTML = `<div class="rd-state">没有找到相关书籍</div>`;
                return;
              }
              listEl.innerHTML = books.map((b, i) => `
                <div class="rd-item" data-i="${i}">
                  <div class="rd-item__name">${escapeHtml(b.title)}</div>
                  <div class="rd-item__sub">${escapeHtml(fmtSnippet(b.snippet) || b.title)}</div>
                </div>`).join('');
              listEl.querySelectorAll('.rd-item').forEach(el => {
                el.addEventListener('click', () => {
                  const book = books[+el.dataset.i];
                  // 不传 transition：转场交给 navigation.js 默认动画，避免冲突
                  ctx.push('reader', { site, title: book.title });
                });
              });
            } catch (err) {
              listEl.innerHTML = `<div class="rd-state rd-err">搜索失败：${escapeHtml(err.message || '网络错误')}</div>`;
            } finally {
              loading = false;
            }
          }

          const initQ = ctx.state?.q;
          if (initQ) { input.value = initQ; doSearch(initQ); }
        },
      },

      reader: {
        name: 'reader',
        render(ctx) {
          const { title } = ctx.data || {};
          return `
            <div class="rd-page" data-route="reader">
              <div class="rd-home-head">
                <div class="rd-read__titlebar">${escapeHtml(title || '阅读')}</div>
                <div class="rd-font-btns">
                  <button data-act="smaller">A−</button>
                  <button data-act="bigger">A+</button>
                </div>
              </div>
              <div class="rd-read" data-role="read">
                <div class="rd-state">正在加载正文…</div>
              </div>
            </div>`;
        },
        mount(root, ctx) {
          const { site, title } = ctx.data || {};
          const readEl = root.querySelector('[data-role="read"]');

          let fontSize = 16;
          const smaller = root.querySelector('[data-act="smaller"]');
          const bigger = root.querySelector('[data-act="bigger"]');

          function applyFont() { readEl.style.fontSize = fontSize + 'px'; }
          smaller.addEventListener('click', () => { fontSize = Math.max(13, fontSize - 1); applyFont(); });
          bigger.addEventListener('click', () => { fontSize = Math.min(28, fontSize + 1); applyFont(); });

          // 把「前言段落 + 可点列表」拼到阅读区。列表项可点进入子页/作品。
          function renderMixed(prose, list, hint) {
            let h = `<h1 class="rd-read__title">${escapeHtml(currentTitle)}</h1>`;
            if (hint) h += `<div class="rd-state">${escapeHtml(hint)}</div>`;
            if (prose && prose.length) {
              h += prose.map(it => it.kind === 'h'
                ? `<h2 class="rd-read__h">${escapeHtml(it.text)}</h2>`
                : `<p>${escapeHtml(it.text)}</p>`).join('');
            }
            if (list && list.length) {
              h += list.map(l => `
                <div class="rd-item" data-title="${escapeHtml(l.title)}">
                  <div class="rd-item__name">${escapeHtml(l.text)}</div>
                  ${l.sub ? `<div class="rd-item__sub">${escapeHtml(l.sub)}</div>` : ''}
                </div>`).join('');
            }
            readEl.innerHTML = h;
            applyFont();
            readEl.scrollTop = 0;
            readEl.querySelectorAll('.rd-item').forEach(el => {
              el.addEventListener('click', () => {
                ctx.push('reader', { site, title: el.dataset.title });
              });
            });
          }

          // 从 wikitext 子弹点 `*[[标题|显示]]` / `*[[标题]]` 提取消歧义条目。
          function parseDisambigWt(wt) {
            const entries = [];
            for (const raw of wt.split('\n')) {
              const m = raw.match(/^\s*[\*#]+\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
              if (m) {
                const t2 = m[1].trim();
                if (t2.includes(':')) continue;
                entries.push({ title: t2, text: (m[2] || m[1]).trim() });
              }
            }
            return entries;
          }

          let currentTitle = title;
          // 加载流程：识别 消歧义 / 目录 / 整本书 三种形态，逐级兜底。
          async function load(t) {
            currentTitle = t;
            try {
              const [html, wt] = await Promise.all([fetchHtml(site, t), fetchWikitext(site, t)]);

              const isDisambig = /\{\{\s*(消歧义|disambiguation|disambig|dab)/i.test(wt);
              const { items: prose, hasRealText } = parseProse(html);
              const hasProse = hasRealText;
              const links = extractLinks(html, t);   // 本作品直接子页（論語/學而、康熙字典/部首）
              const htmlEntries = parseEntries(html); // 渲染里的 <ul><li>/<table> 条目
              const navLinks = (links.length < 2 && htmlEntries.length < 2)
                ? extractTableNavLinks(html, t)       // 导航巨表（四庫全書分类表）转可点目录
                : [];
              const wtEntries = isDisambig ? parseDisambigWt(wt) : [];

              // 1) 消歧义页：列同名作品（渲染条目优先，wikitext 子弹点兜底）
              if (isDisambig) {
                const ent = htmlEntries.length ? htmlEntries : wtEntries;
                if (ent.length) { renderMixed([], ent, '请选择要阅读的内容：'); return; }
              }
              // 2) 目录页：直接子页 ≥2 或 表格/列表条目 ≥2 → 列章节/部首（保留前言）
              const tocList = links.length >= 2 ? links
                : (htmlEntries.length >= 2 ? htmlEntries
                  : (navLinks.length >= 2 ? navLinks : []));
              if (tocList.length >= 2) {
                renderMixed(prose, tocList, '');
                return;
              }
              // 3) 整本书：直接读正文
              if (hasProse) { renderMixed(prose, [], ''); return; }
              // 4) 其它条目列表（非消歧义但带列表）
              if (htmlEntries.length) { renderMixed([], htmlEntries, '请选择要阅读的内容：'); return; }
              // 5) wikitext 兜底：纯文本古籍/短条目/诗集（阈值放宽，短字典条目也要显示）
              const wprose = parseWikitext(wt);
              if (wprose.some(it => it.kind === 'p' && it.text.length > 0)) { renderMixed(wprose, [], ''); return; }
              // 6) 扫描影印页：wikitext 是 <pages index=…/> 且服务端未内联文字
              //    （ProofreadPage 未校/未展开），客户端无法取得 OCR 文字，
              //    诚实提示并给出维基文库原页链接。
              if (/<pages\b/i.test(wt)) {
                const url = site.api.replace(/\/w\/api\.php$/, '')
                  + '/wiki/' + encodeURIComponent(t.replace(/ /g, '_'));
                readEl.innerHTML = `<h1 class="rd-read__title">${escapeHtml(t)}</h1>` +
                  `<div class="rd-state">这是扫描影印页，维基文库尚未提供可复制的正文文字。` +
                  `请到原站查看原书影像：</div>` +
                  `<a class="rd-ext" href="${escapeHtml(url)}" target="_blank" rel="noopener">在维基文库打开《${escapeHtml(t)}》</a>`;
                applyFont();
                readEl.scrollTop = 0;
                return;
              }
              // 7) Index 索引页 → 真正的正文页
              const idxTitle = getIndexTitle(wt);
              if (idxTitle && idxTitle !== t) { await load(idxTitle); return; }

              readEl.innerHTML = `<div class="rd-state">该书暂无可读正文（可能是版本导航页）</div>`;
            } catch (err) {
              const msg = err && err.message ? err.message : '网络错误';
              // 维基文库里不存在的页面（如消歧义页里红链进来的子页）
              if (/doesn'?t exist|不存在|missingtitle|no such page|invalid/i.test(msg)) {
                readEl.innerHTML = `<div class="rd-state">该页面在维基文库中不存在（可能是失效的链接）</div>`;
              } else {
                readEl.innerHTML = `<div class="rd-state rd-err">加载失败：${escapeHtml(msg)}</div>`;
              }
            }
          }

          load(title);
        },
      },
    },
  });
})();
