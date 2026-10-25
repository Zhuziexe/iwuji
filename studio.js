(() => {
  const STORAGE_KEY = 'studio.project';
  const PROJECT_FORMAT = 'iwuji-studio-project';
  const PROJECT_FORMAT_VERSION = 1;

  /* ---------- 默认图标 ---------- */
  const DEFAULT_ICON_SVG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<defs>' +
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#3a6ff0"/>' +
          '<stop offset="1" stop-color="#2b5adf"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect width="64" height="64" rx="14" fill="url(#g)"/>' +
      '<path d="M22 22 L14 32 L22 42" fill="none" stroke="#fff" stroke-width="3.5" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M42 22 L50 32 L42 42" fill="none" stroke="#fff" stroke-width="3.5" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M36 18 L28 46" stroke="#fff" stroke-width="3.5" ' +
        'stroke-linecap="round" opacity=".85"/>' +
    '</svg>'
  );

  /* ---------- 图标解析 ----------
     统一判定：
       '' → DEFAULT
       '<...' 开头（SVG 源码或中间态）→ 包成 dataURL
       http(s) / data: / / / ./ / ../ → 原样（URL）
       其它（emoji 等）→ 原样（文本）
     这样中间态如 '<' '<sv' '<svg' 都变成 dataURL，
     <img> 加载失败会走 onerror 显示 ?，绝不产生 HTTP 请求。
  ------------------------------------- */
  function resolveIcon(icon) {
    const v = String(icon == null ? '' : icon).trim();
    if (!v) return DEFAULT_ICON_SVG;

    if (v.charAt(0) === '<') {
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(v);
    }
    return v;
  }

  function isImageLike(icon) {
    const v = String(icon == null ? '' : icon).trim();
    if (!v) return true; /* 默认图标是 dataURL */
    if (v.charAt(0) === '<') return true; /* SVG → dataURL */
    if (/^(https?:|data:|\/|\.\/|\.\.\/)/.test(v)) return true;
    return false;
  }

  /* ---------- 默认项目 ---------- */
  const DEFAULT_PROJECT = {
    bundle: 'com.studio.app1',
    name: '我的应用',
    icon: '',
    version: '1.0.0',
    initialRoute: 'home',
    styles: `.page {
  padding: calc(var(--statusbar-h) + 20px) 20px 20px;
  color: var(--wj-text);
  font-family: inherit;
}
.page h1 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 8px;
}
.page p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--wj-text-muted);
}`,
    routes: [
      {
        name: 'home',
        render: `return \`
  <div class="page">
    <h1>Hello iWuji</h1>
    <p>编辑左侧代码，点右上角「预览」查看效果。</p>
  </div>
\`;`,
        mount: `/* el 是路由根元素，ctx 是路由上下文
   - ctx.data      路由参数
   - ctx.push()    打开子页面
   - ctx.pop()     返回
*/`,
        unmount: `/* 清理定时器、window 事件监听等
   这是路由销毁时唯一的清理入口
*/`,
      },
    ],
  };

  /* ---------- 状态 ---------- */
  let project = loadProject() || clone(DEFAULT_PROJECT);
  let activeTab = 'props';
  let activeSubtab = 'render';
  let openTabs = new Set(['props', 'css']);
  let cm = null;

  if (project.routes.length) openTabs.add(project.routes[0].name);

  /* ---------- 工具 ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function formatBytes(n) {
    if (!n || n < 0) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  /* ---------- 持久化 ---------- */
  function saveProject() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }
    catch (e) { console.warn('[studio] 保存失败', e); }
  }

  function loadProject() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) return null;
      const p = JSON.parse(s);
      if (!p || !Array.isArray(p.routes) || !p.routes.length) return null;
      return normalizeProject(p);
    } catch { return null; }
  }

  function normalizeProject(p) {
    const base = clone(DEFAULT_PROJECT);
    const routes = Array.isArray(p.routes) && p.routes.length
      ? p.routes.map((r, i) => ({
          name:    String(r && r.name    || `route${i + 1}`),
          render:  String(r && r.render  || ''),
          mount:   String(r && r.mount   || ''),
          unmount: String(r && r.unmount || ''),
        }))
      : base.routes;

    const initialRoute =
      routes.some(r => r.name === p.initialRoute)
        ? String(p.initialRoute)
        : routes[0].name;

    return {
      bundle:       String(p.bundle || base.bundle),
      name:         String(p.name   || base.name),
      icon:         String(p.icon   || ''),
      version:      String(p.version || base.version),
      initialRoute,
      styles:       String(p.styles || ''),
      routes,
    };
  }

  /* ---------- 编译 ---------- */
  function buildAppJs(p) {
    const routesCode = p.routes.map(r => {
      const render  = r.render  || 'return "";';
      const mount   = r.mount   || '';
      const unmount = r.unmount || '';

      return `      ${JSON.stringify(r.name)}: {
        name: ${JSON.stringify(r.name)},
        render: function(ctx) {
${indent(render, 10)}
        },
        mount: function(el, ctx) {
${indent(mount, 10)}
        },
        unmount: function(el, ctx) {
${indent(unmount, 10)}
        },
      }`;
    }).join(',\n');

    return `(() => {
  WujiApps.registerInstalled({
    bundlename: ${JSON.stringify(p.bundle)},
    name: ${JSON.stringify(p.name)},
    icon: ${JSON.stringify(resolveIcon(p.icon))},
    version: ${JSON.stringify(p.version)},
    initialRoute: ${JSON.stringify(p.initialRoute)},
    styles: ${JSON.stringify(p.styles)},
    routes: {
${routesCode}
    },
  });
})();`;
  }

  function indent(str, spaces) {
    const pad = ' '.repeat(spaces);
    return String(str || '').split('\n').map(l => l ? pad + l : l).join('\n');
  }

  /* =========================================================
     Tab 管理
     ========================================================= */
  function getTabsInOrder() {
    const out = [];
    if (openTabs.has('props')) out.push('props');
    if (openTabs.has('css')) out.push('css');
    for (const r of project.routes) {
      if (openTabs.has(r.name)) out.push(r.name);
    }
    return out;
  }

  function tabLabel(name) {
    if (name === 'props') return '项目属性';
    if (name === 'css') return 'CSS';
    return name;
  }

  function selectTab(name) {
    if (name === 'props' || name === 'css') {
      openTabs.add(name);
    } else if (project.routes.find(r => r.name === name)) {
      openTabs.add(name);
    } else {
      return;
    }

    if (activeTab === name) return;

    activeTab = name;
    activeSubtab = 'render';
    renderTree();
    renderTabs();
    renderSubtabs();
    renderContent();
  }

  function closeTab(name) {
    if (!openTabs.has(name)) return;
    openTabs.delete(name);

    if (activeTab === name) {
      const remaining = getTabsInOrder();
      if (remaining.length) {
        activeTab = remaining[0];
      } else {
        openTabs.add('css');
        activeTab = 'css';
      }
      activeSubtab = 'render';
    }

    renderTree();
    renderTabs();
    renderSubtabs();
    renderContent();
  }

  /* =========================================================
     左栏渲染
     ========================================================= */
  function renderTree() {
    const tree = document.getElementById('tree');
    const parts = [];

    parts.push('<div class="tree__group">项目</div>');
    parts.push(
      `<div class="tree__item tree__item--props ${activeTab === 'props' ? 'is-active' : ''}"
            data-tab="props">项目属性</div>`
    );
    parts.push(
      `<div class="tree__item tree__item--css ${activeTab === 'css' ? 'is-active' : ''}"
            data-tab="css">全局 CSS</div>`
    );

    parts.push('<div class="tree__group">路由</div>');
    for (const r of project.routes) {
      parts.push(
        `<div class="tree__item ${activeTab === r.name ? 'is-active' : ''}"
              data-tab="${escapeHtml(r.name)}">${escapeHtml(r.name)}</div>`
      );
    }

    tree.innerHTML = parts.join('');

    tree.querySelectorAll('.tree__item').forEach(el => {
      el.addEventListener('click', () => selectTab(el.dataset.tab));
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        const tab = el.dataset.tab;
        if (tab === 'props' || tab === 'css') return;
        deleteRoute(tab);
      });
    });
  }

  /* =========================================================
     Tabs / Subtabs
     ========================================================= */
  function renderTabs() {
    const tabsEl = document.getElementById('tabs');
    const list = getTabsInOrder();

    tabsEl.innerHTML = list.map(t => {
      const isActive = t === activeTab;
      return `
        <div class="tab ${isActive ? 'is-active' : ''}" data-tab="${escapeHtml(t)}">
          <span class="tab__label">${escapeHtml(tabLabel(t))}</span>
          <button class="tab__close" data-close="${escapeHtml(t)}"
                  type="button" aria-label="关闭">×</button>
        </div>
      `;
    }).join('');

    tabsEl.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.tab__close')) return;
        selectTab(el.dataset.tab);
      });
    });

    tabsEl.querySelectorAll('.tab__close').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        closeTab(el.dataset.close);
      });
    });
  }

  function renderSubtabs() {
    const subtabs = document.getElementById('subtabs');

    if (activeTab === 'props' || activeTab === 'css') {
      subtabs.innerHTML = '';
      subtabs.style.display = 'none';
      return;
    }

    subtabs.style.display = 'flex';
    const subs = ['render', 'mount', 'unmount'];
    subtabs.innerHTML = subs.map(s => `
      <div class="subtab ${activeSubtab === s ? 'is-active' : ''}"
           data-sub="${s}">${s}</div>
    `).join('');

    subtabs.querySelectorAll('.subtab').forEach(el => {
      el.addEventListener('click', () => {
        const sub = el.dataset.sub;
        if (sub === activeSubtab) return;
        activeSubtab = sub;
        renderSubtabs();
        renderContent();
      });
    });
  }

  /* =========================================================
     内容区
     ========================================================= */
  function renderContent() {
    const wrap = document.getElementById('editorWrap');
    wrap.innerHTML = '';
    cm = null;

    if (activeTab === 'props') {
      renderPropsPanel(wrap);
    } else if (activeTab === 'css') {
      mountCodeMirror(wrap, 'css', project.styles || '', val => {
        project.styles = val;
        saveProject();
      });
    } else {
      const route = project.routes.find(r => r.name === activeTab);
      if (!route) {
        wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#666">未选择</div>';
        return;
      }
      mountCodeMirror(wrap, 'javascript', route[activeSubtab] || '', val => {
        route[activeSubtab] = val;
        saveProject();
      });
    }
  }

  function mountCodeMirror(wrap, mode, initialValue, onChange) {
    if (typeof CodeMirror === 'undefined') {
      mountFallbackEditor(wrap, initialValue, onChange);
      return;
    }

    cm = CodeMirror(wrap, {
      value: initialValue,
      mode,
      theme: 'dracula',
      lineNumbers: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: true,
      viewportMargin: 20,
    });

    /* 查找替换快捷键：
       Ctrl/Cmd+F  查找      （search.js 默认已绑定）
       Ctrl/Cmd+H  替换      （自定义，对齐 VS Code 习惯）
       Ctrl/Cmd+G  下一个    （默认）
       Shift+Ctrl+G 上一个   （默认） */
    if (typeof cm.execCommand === 'function') {
      cm.addKeyMap({
        'Ctrl-H': 'replace',
        'Cmd-Alt-F': 'replace',
      });
    }

    cm.on('change', () => onChange(cm.getValue()));
    requestAnimationFrame(() => { try { cm.refresh(); } catch { } });
  }

  function mountFallbackEditor(wrap, initialValue, onChange) {
    const ta = document.createElement('textarea');
    ta.value = initialValue;
    ta.spellcheck = false;
    ta.style.cssText = `
      width: 100%; height: 100%;
      padding: 14px 16px;
      border: 0; outline: 0;
      background: #1e1e1e; color: #e0e0e0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px; line-height: 1.55;
      resize: none;
      tab-size: 2;
      white-space: pre;
      overflow: auto;
    `;
    ta.addEventListener('input', () => onChange(ta.value));
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        ta.value = val.slice(0, start) + '  ' + val.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
        onChange(ta.value);
      }
    });
    wrap.appendChild(ta);
    requestAnimationFrame(() => ta.focus());
    cm = null;
  }

  /* =========================================================
     项目属性面板
     ========================================================= */
  function renderPropsPanel(wrap) {
    wrap.innerHTML = `
      <div class="props-editor">
        <div class="props-section">
          <div class="props-section__title">基本信息</div>

          <div class="props-field">
            <label>应用名称</label>
            <input id="propName" type="text" placeholder="我的应用">
            <div class="props-field__hint">显示在桌面图标下方的名称</div>
          </div>

          <div class="props-field">
            <label>包名（bundle）</label>
            <input id="propBundle" type="text"
                   placeholder="com.example.app" spellcheck="false">
            <div class="props-field__hint">
              全局唯一标识，形如 <code>com.example.app</code>；侧载和更新时按包名匹配
            </div>
          </div>

          <div class="props-field">
            <label>版本号</label>
            <input id="propVersion" type="text"
                   placeholder="1.0.0" spellcheck="false">
            <div class="props-field__hint">
              数字点分格式，如 <code>1.0.0</code> → <code>1.0.1</code>；用于版本比较
            </div>
          </div>
        </div>

        <div class="props-section">
          <div class="props-section__title">图标</div>

          <div class="props-icon-row">
            <div class="props-icon-preview" id="propIconPreview"></div>
            <div class="props-icon-hint">
              支持 emoji（<code>🎨</code>）、图片 URL（<code>https://</code>）、
              dataURL（<code>data:image/</code>），
              或直接粘贴 <code>&lt;svg&gt;...&lt;/svg&gt;</code> 源码。<br>
              留空使用默认蓝色 <code>&lt;/&gt;</code> 图标。
            </div>
          </div>

          <div class="props-field">
            <textarea id="propIcon" rows="4" spellcheck="false"
                      placeholder="🎨&#10;https://example.com/icon.png&#10;data:image/png;base64,...&#10;&lt;svg&gt;...&lt;/svg&gt;"></textarea>
          </div>
        </div>
      </div>
    `;

    const nameInput    = wrap.querySelector('#propName');
    const bundleInput  = wrap.querySelector('#propBundle');
    const versionInput = wrap.querySelector('#propVersion');
    const iconInput    = wrap.querySelector('#propIcon');
    const iconPreview  = wrap.querySelector('#propIconPreview');

    nameInput.value = project.name;
    bundleInput.value = project.bundle;
    versionInput.value = project.version;
    iconInput.value = project.icon;

    renderIconPreview(iconPreview, project.icon);

    nameInput.addEventListener('input', () => {
      project.name = nameInput.value.trim();
      saveProject();
      updateProjectTitle();
    });
    bundleInput.addEventListener('input', () => {
      project.bundle = bundleInput.value.trim();
      saveProject();
      updateProjectTitle();
    });
    versionInput.addEventListener('input', () => {
      project.version = versionInput.value.trim();
      saveProject();
    });

    /* 图标输入 debounce：避免每个字符都生成一次 <img> */
    let iconTimer = null;
    iconInput.addEventListener('input', () => {
      project.icon = iconInput.value;
      saveProject();

      if (iconTimer) clearTimeout(iconTimer);
      iconTimer = setTimeout(() => {
        if (!iconPreview.isConnected) return;
        renderIconPreview(iconPreview, project.icon);
      }, 250);
    });
  }

  function renderIconPreview(el, icon) {
    el.innerHTML = '';
    el.removeAttribute('title');

    if (isImageLike(icon)) {
      const img = document.createElement('img');
      img.src = resolveIcon(icon);
      img.alt = '';
      img.draggable = false;
      img.onerror = () => {
        el.innerHTML = '';
        el.textContent = '?';
        el.title = '图标加载失败';
      };
      el.appendChild(img);
    } else {
      el.textContent = icon;
    }
  }

  /* =========================================================
     路由增删
     ========================================================= */
  function addRoute() {
    const name = prompt('新路由名称（英文，如 about）');
    if (!name) return;

    const trimmed = name.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed)) {
      alert('路由名只能包含字母、数字、下划线、连字符，且以字母开头');
      return;
    }
    if (trimmed === 'css' || trimmed === 'props') {
      alert('保留名，不能用作路由');
      return;
    }
    if (project.routes.find(r => r.name === trimmed)) {
      alert('路由已存在');
      return;
    }

    project.routes.push({
      name: trimmed,
      render: `return \`
  <div class="page">
    <h1>${trimmed}</h1>
    <p>这是新路由</p>
  </div>
\`;`,
      mount: '',
      unmount: '',
    });

    saveProject();
    openTabs.add(trimmed);
    activeTab = trimmed;
    activeSubtab = 'render';
    renderTree();
    renderTabs();
    renderSubtabs();
    renderContent();
  }

  function deleteRoute(name) {
    if (project.routes.length <= 1) {
      alert('至少保留一个路由');
      return;
    }
    if (!confirm(`确定删除路由「${name}」？`)) return;

    project.routes = project.routes.filter(r => r.name !== name);
    openTabs.delete(name);

    if (project.initialRoute === name) {
      project.initialRoute = project.routes[0].name;
    }
    if (activeTab === name) {
      const remaining = getTabsInOrder();
      activeTab = remaining.length ? remaining[0] : 'css';
      if (!remaining.length) openTabs.add('css');
      activeSubtab = 'render';
    }

    saveProject();
    renderTree();
    renderTabs();
    renderSubtabs();
    renderContent();
  }

  /* =========================================================
     预览区外壳
     ========================================================= */
  const DESIGN_W = 420;
  const DESIGN_H = 560;
  const LONG_PRESS_MS = 650;

  const studioScreenEl = document.getElementById('studioScreen');
  const studioFrame    = document.getElementById('previewFrame');
  const studioPowerKey = document.getElementById('studioPowerKey');
  const studioVolUp    = document.getElementById('studioVolUp');
  const studioVolDown  = document.getElementById('studioVolDown');

  function fitStudio() {
    const r = studioScreenEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const scale = Math.min(r.width / DESIGN_W, r.height / DESIGN_H);
    studioFrame.style.transform = `translate(-50%,-50%) scale(${scale})`;
  }
  new ResizeObserver(fitStudio).observe(studioScreenEl);
  window.addEventListener('load', fitStudio);
  fitStudio();

  function sendToOS(action, payload = {}) {
    try {
      studioFrame.contentWindow?.postMessage(
        { type: 'iwuji:control', action, payload }, '*');
    } catch { }
  }

  let pressStartAt = 0;
  let longPressTimer = null;
  let longPressed = false;

  studioPowerKey.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { studioPowerKey.setPointerCapture(e.pointerId); } catch { }
    pressStartAt = Date.now();
    longPressed = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressed = true;
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch { } }
      sendToOS('hw:power-long');
    }, LONG_PRESS_MS);
  });

  studioPowerKey.addEventListener('pointerup', () => {
    clearTimeout(longPressTimer);
    const d = Date.now() - pressStartAt;
    if (!longPressed && d < LONG_PRESS_MS) sendToOS('hw:power-short');
    longPressed = false;
  });

  studioPowerKey.addEventListener('pointercancel', () => {
    clearTimeout(longPressTimer);
    longPressed = false;
  });

  function bindVolumeKey(el, dir) {
    const pressAction   = dir === 'up' ? 'hw:vol-up-press'   : 'hw:vol-down-press';
    const releaseAction = dir === 'up' ? 'hw:vol-up-release' : 'hw:vol-down-release';

    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { }
      sendToOS(pressAction);
    });
    el.addEventListener('pointerup', () => sendToOS(releaseAction));
    el.addEventListener('pointercancel', () => sendToOS(releaseAction));
    el.addEventListener('pointerleave', () => sendToOS(releaseAction));
  }
  bindVolumeKey(studioVolUp, 'up');
  bindVolumeKey(studioVolDown, 'down');

  /* =========================================================
     日志面板
     ========================================================= */
  const logPanel  = document.getElementById('logPanel');
  const logToggle = document.getElementById('logToggle');
  const logCount  = document.getElementById('logCount');
  const logBody   = document.getElementById('logBody');
  const logClear  = document.getElementById('logClear');
  const logCopy   = document.getElementById('logCopy');

  const MAX_LOGS = 500;
  const logs = [];
  let unreadErrors = 0;

  function formatLogArg(a) {
    if (a == null) return String(a);
    if (typeof a === 'string') return a;
    if (typeof a === 'number' || typeof a === 'boolean') return String(a);
    if (a instanceof Error) return a.stack || a.message || String(a);
    if (typeof a === 'object') {
      try { return JSON.stringify(a); }
      catch { return String(a); }
    }
    return String(a);
  }

  function appendLog(level, args) {
    const text = args.map(formatLogArg).join(' ');
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    logs.push({ time, level, text });
    if (logs.length > MAX_LOGS) logs.shift();

    if (level === 'error') unreadErrors++;
    updateLogCount();

    if (logPanel.classList.contains('is-expanded')) {
      appendLogDOM({ time, level, text });
      logBody.scrollTop = logBody.scrollHeight;
      if (level === 'error') unreadErrors = 0;
      updateLogCount();
    }
  }

  function appendLogDOM(item) {
    const el = document.createElement('div');
    el.className = `log-item log-item--${item.level}`;
    el.innerHTML =
      `<span class="log-item__time">${escapeHtml(item.time)}</span>` +
      `<span class="log-item__level">${escapeHtml(item.level.toUpperCase())}</span>` +
      `<span class="log-item__text">${escapeHtml(item.text)}</span>`;
    logBody.appendChild(el);
  }

  function renderLogs() {
    logBody.innerHTML = '';
    if (!logs.length) {
      logBody.innerHTML = '<div class="log-empty">暂无日志</div>';
      return;
    }
    for (const item of logs) appendLogDOM(item);
    logBody.scrollTop = logBody.scrollHeight;
  }

  function updateLogCount() {
    logCount.textContent = `(${logs.length})`;
    logCount.classList.toggle('has-error', unreadErrors > 0);
    logCount.classList.toggle(
      'has-warn',
      unreadErrors === 0 && logs.some(l => l.level === 'warn')
    );
  }

  logToggle.addEventListener('click', () => {
    const willExpand = !logPanel.classList.contains('is-expanded');
    logPanel.classList.toggle('is-expanded');
    logToggle.textContent = willExpand ? '▾ 日志' : '▸ 日志';

    if (willExpand) {
      renderLogs();
      unreadErrors = 0;
      updateLogCount();
    }
    /* 面板尺寸变化后重算 iframe 缩放 */
    setTimeout(fitStudio, 0);
  });

  logClear.addEventListener('click', () => {
    logs.length = 0;
    unreadErrors = 0;
    updateLogCount();
    logBody.innerHTML = '';
    if (logPanel.classList.contains('is-expanded')) {
      logBody.innerHTML = '<div class="log-empty">暂无日志</div>';
    }
  });

  logCopy.addEventListener('click', async () => {
    if (!logs.length) {
      flashLogBtn(logCopy, '无日志');
      return;
    }
    const text = logs
      .map(l => `[${l.time}] ${l.level.toUpperCase().padEnd(5)} ${l.text}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flashLogBtn(logCopy, '已复制');
    } catch {
      flashLogBtn(logCopy, '失败');
    }
  });

  function flashLogBtn(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = old; }, 1000);
  }

  /* ---------- 注入 iframe 的 console 钩子 ---------- */
  function hookIframeConsole() {
    const win = studioFrame.contentWindow;
    if (!win) return;
    if (win.__studioConsoleHooked) return;

    try {
      win.__studioConsoleHooked = true;

      ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
        const orig = win.console[level];
        if (typeof orig !== 'function') return;
        win.console[level] = function (...args) {
          try { orig.apply(win.console, args); } catch { }
          appendLog(level, args);
        };
      });

      win.addEventListener('error', e => {
        appendLog('error', [e.message || 'Uncaught error']);
        if (e.filename || e.lineno) {
          appendLog('error', [`at ${e.filename || '?'}:${e.lineno || 0}:${e.colno || 0}`]);
        }
      });

      win.addEventListener('unhandledrejection', e => {
        const reason = e.reason;
        appendLog('error', [
          'Unhandled rejection:',
          reason instanceof Error ? (reason.stack || reason.message) : String(reason),
        ]);
      });
    } catch (e) {
      console.warn('[studio] hook iframe console failed', e);
    }
  }

  studioFrame.addEventListener('load', () => {
    fitStudio();
    hookIframeConsole();
    /* 顺带重置日志面板状态（iframe 重载，之前的 console 已失效） */
    appendLog('info', ['[studio] iframe 已重新加载']);
  });

  /* =========================================================
     预览 / 导出
     ========================================================= */
  async function preview() {
    const w = studioFrame.contentWindow;

    if (!w || !w.WujiAppInstaller || !w.WujiAppLauncher) {
      alert('预览 iframe 未就绪，请等 iWuji 加载完成后再点（一般需 3~5 秒）');
      return;
    }

    let power = null;
    try {
      const osEl = w.document.getElementById('os');
      power = osEl && osEl.dataset ? osEl.dataset.power : null;
    } catch { }
    if (power !== 'running') {
      alert('请先开启 iWuji');
      return;
    }

    let appJs;

    try { appJs = buildAppJs(project); }
    catch (e) { alert('代码生成失败：' + e.message); return; }

    console.log('[studio] 生成代码长度', appJs.length);

    try {
      if (w.WujiAppLauncher.getCurrentBundle?.() === project.bundle) {
        w.WujiAppLauncher.close();
      }
    } catch { }

    try {
      const res = await w.WujiAppInstaller.install(
        {
          bundlename:   project.bundle,
          name:         project.name,
          icon:         resolveIcon(project.icon),
          version:      project.version,
          initialRoute: project.initialRoute,
        },
        { force: true, code: appJs }
      );

      if (!res || !res.ok) {
        alert(`预览失败：${res?.action || 'unknown'}` +
          (res?.error?.message ? ' — ' + res.error.message : ''));
        return;
      }
    } catch (e) {
      console.error('[studio] preview install failed', e);
      alert('预览失败：' + e.message);
      return;
    }

    setTimeout(() => {
      try {
        w.postMessage({ type: 'studio:open', bundle: project.bundle }, '*');
      } catch { }
    }, 320);
  }

  function exportJs() {
    let code;
    try { code = buildAppJs(project); }
    catch (e) { alert('导出失败：' + e.message); return; }

    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.bundle.replace(/\./g, '_')}.js`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* =========================================================
     图片转 DataURL
     ========================================================= */
  (function initImage2Data() {
    const modal        = document.getElementById('imgModal');
    const modalClose   = document.getElementById('imgModalClose');
    const dropEl       = document.getElementById('imgDrop');
    const fileInput    = document.getElementById('imgFileInput');

    const optionsEl    = document.getElementById('imgOptions');
    const sizeSel      = document.getElementById('imgSize');
    const formatSel    = document.getElementById('imgFormat');
    const qualityRow   = document.getElementById('imgQualityRow');
    const qualityInput = document.getElementById('imgQuality');
    const qualityVal   = document.getElementById('imgQualityVal');

    const resultEl     = document.getElementById('imgResult');
    const previewImg   = document.getElementById('imgPreview');
    const originalInfo = document.getElementById('imgOriginalInfo');
    const outputInfo   = document.getElementById('imgOutputInfo');
    const dataUrlEl    = document.getElementById('imgDataUrl');
    const copyBtn      = document.getElementById('imgCopyBtn');
    const insertBtn    = document.getElementById('imgInsertBtn');

    let currentImg = null;
    let currentOriginalFormat = 'image/png';

    function openModal() { modal.hidden = false; reset(); }
    function closeModal() { modal.hidden = true; reset(); }

    function reset() {
      currentImg = null;
      fileInput.value = '';
      optionsEl.hidden = true;
      resultEl.hidden = true;
      dropEl.hidden = false;
      dataUrlEl.value = '';
      previewImg.removeAttribute('src');
    }

    document.getElementById('btnImage2Data').addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    dropEl.addEventListener('click', () => fileInput.click());
    dropEl.addEventListener('dragover', e => {
      e.preventDefault();
      dropEl.classList.add('is-dragover');
    });
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('is-dragover'));
    dropEl.addEventListener('drop', e => {
      e.preventDefault();
      dropEl.classList.remove('is-dragover');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (f) handleFile(f);
    });

    function handleFile(file) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        alert('仅支持 PNG / JPEG / WebP');
        return;
      }
      currentOriginalFormat = file.type;

      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          currentImg = img;
          dropEl.hidden = true;
          optionsEl.hidden = false;
          resultEl.hidden = false;

          originalInfo.textContent =
            `${img.naturalWidth} × ${img.naturalHeight} · ${formatBytes(file.size)}`;

          formatSel.value = (file.type === 'image/jpeg') ? 'keep' : 'image/webp';

          updateQualityRow();
          generate();
        };
        img.onerror = () => alert('图片加载失败');
        img.src = String(ev.target.result);
      };
      reader.onerror = () => alert('文件读取失败');
      reader.readAsDataURL(file);
    }

    sizeSel.addEventListener('change', generate);
    formatSel.addEventListener('change', () => { updateQualityRow(); generate(); });
    qualityInput.addEventListener('input', () => {
      qualityVal.textContent = Math.round(qualityInput.value * 100) + '%';
      generate();
    });

    function updateQualityRow() {
      const fmt = resolveFormat();
      qualityRow.hidden = (fmt !== 'image/jpeg' && fmt !== 'image/webp');
    }

    function resolveFormat() {
      return formatSel.value === 'keep' ? currentOriginalFormat : formatSel.value;
    }

    let generateRaf = null;
    function generate() {
      if (!currentImg) return;
      if (generateRaf) cancelAnimationFrame(generateRaf);
      generateRaf = requestAnimationFrame(() => { generateRaf = null; doGenerate(); });
    }

    function doGenerate() {
      const img = currentImg;
      const maxSize = Number(sizeSel.value) || 0;
      const format = resolveFormat();
      const quality = Number(qualityInput.value) || 0.85;

      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (maxSize > 0 && (w > maxSize || h > maxSize)) {
        const scale = Math.min(maxSize / w, maxSize / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);

      let dataUrl;
      try { dataUrl = canvas.toDataURL(format, quality); }
      catch { dataUrl = canvas.toDataURL('image/png'); }

      previewImg.src = dataUrl;
      dataUrlEl.value = dataUrl;

      const base64 = dataUrl.split(',')[1] || '';
      const bytes = Math.round(base64.length * 3 / 4);

      outputInfo.textContent =
        `${w} × ${h} · ${format.replace('image/', '').toUpperCase()} · ${formatBytes(bytes)}`;

      if (bytes > 200 * 1024) {
        outputInfo.style.color = '#e0a030';
        outputInfo.textContent += ' · 偏大，建议缩小尺寸';
      } else {
        outputInfo.style.color = '';
      }
    }

    copyBtn.addEventListener('click', async () => {
      const text = dataUrlEl.value;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        flashBtn(copyBtn, '已复制');
      } catch {
        dataUrlEl.select();
        document.execCommand('copy');
        flashBtn(copyBtn, '已复制');
      }
    });

    insertBtn.addEventListener('click', () => {
      const text = dataUrlEl.value;
      if (!text) return;

      if (!cm) {
        /* 在项目属性 tab 时，插入到图标框 */
        const propIcon = document.querySelector('#propIcon');
        if (propIcon && activeTab === 'props') {
          propIcon.value = text;
          propIcon.dispatchEvent(new Event('input'));
          flashBtn(insertBtn, '已填入图标');
          return;
        }
        alert('当前没有可用的编辑器');
        return;
      }
      cm.replaceSelection(text);
      cm.focus();
      flashBtn(insertBtn, '已插入');
    });

    function flashBtn(btn, text) {
      const old = btn.textContent;
      const oldDisabled = btn.disabled;
      btn.textContent = text;
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = old;
        btn.disabled = oldDisabled;
      }, 1200);
    }
  })();

  /* =========================================================
     标题栏项目名
     ========================================================= */
  const projTitle = document.getElementById('projTitle');

  function updateProjectTitle() {
    const name = project.name || project.bundle || '未命名项目';
    const text = project.bundle && project.bundle !== name
      ? `${name} · ${project.bundle}`
      : name;
    projTitle.textContent = text;
    projTitle.title = text;
  }

  /* =========================================================
     项目文件：保存 / 打开 / 新建
     ========================================================= */
  const projectFileInput = document.getElementById('projectFileInput');

  function sanitizeName(s) {
    return String(s || 'project')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 60) || 'project';
  }

  function flashToolbarBtn(id, text) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const old = btn.textContent;
    const oldDisabled = btn.disabled;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = old;
      btn.disabled = oldDisabled;
    }, 1000);
  }

  function saveProjectFile() {
    saveProject();
    const payload = {
      format: PROJECT_FORMAT,
      version: PROJECT_FORMAT_VERSION,
      savedAt: Date.now(),
      project,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeName(project.name || project.bundle) + '.wujiproj';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flashToolbarBtn('btnSaveFile', '已保存');
  }

  async function openProjectFromFile(file) {
    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch (e) {
      alert('文件解析失败：' + e.message);
      return;
    }
    if (!data || data.format !== PROJECT_FORMAT) {
      alert('这不是有效的 iWuji Studio 项目文件');
      return;
    }
    const p = data.project;
    if (!p || typeof p !== 'object' ||
        !Array.isArray(p.routes) || !p.routes.length) {
      alert('项目数据损坏或缺少路由');
      return;
    }
    if (!confirm(`加载项目「${p.name || p.bundle || '未命名'}」？\n当前项目将被替换。`)) return;

    project = normalizeProject(p);
    activeTab = 'props';
    activeSubtab = 'render';
    openTabs = new Set(['props', 'css']);
    if (project.routes.length) openTabs.add(project.routes[0].name);

    updateProjectTitle();
    saveProject();
    renderTree();
    renderTabs();
    renderSubtabs();
    renderContent();
    flashToolbarBtn('btnOpen', '已加载');
  }

  function newProject() {
    if (!confirm('新建项目？当前项目将被替换。')) return;

    project = clone(DEFAULT_PROJECT);
    project.bundle = 'com.studio.app' + (Date.now() % 100000);
    project.name = '未命名应用';

    activeTab = 'props';
    activeSubtab = 'render';
    openTabs = new Set(['props', 'css']);
    if (project.routes.length) openTabs.add(project.routes[0].name);

    updateProjectTitle();
    saveProject();
    renderTree();
    renderTabs();
    renderSubtabs();
    renderContent();
    flashToolbarBtn('btnNew', '已新建');
  }

  document.getElementById('btnSaveFile').addEventListener('click', saveProjectFile);
  document.getElementById('btnOpen').addEventListener('click', () => projectFileInput.click());
  document.getElementById('btnNew').addEventListener('click', newProject);

  projectFileInput.addEventListener('change', () => {
    const file = projectFileInput.files && projectFileInput.files[0];
    projectFileInput.value = '';
    if (file) openProjectFromFile(file);
  });

  /* =========================================================
     工具栏按钮
     ========================================================= */
  document.getElementById('btnPreview').addEventListener('click', preview);
  document.getElementById('btnExport').addEventListener('click', exportJs);
  document.getElementById('btnAddRoute').addEventListener('click', addRoute);

  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveProjectFile();
    }
  });
  /* =========================================================
     开屏页
     ========================================================= */
  (function initSplash() {
    const splash = document.getElementById('studioSplash');
    if (!splash) return;

    const MIN_SHOW_MS = 1400;    /* 至少显示 1.4 秒，避免闪一下就没了 */
    const MAX_SHOW_MS = 4000;    /* 最多 4 秒，超过就强制关闭 */
    const startAt = performance.now();

    let closed = false;

    function close() {
      if (closed) return;
      closed = true;

      const elapsed = performance.now() - startAt;
      const wait = Math.max(0, MIN_SHOW_MS - elapsed);

      setTimeout(() => {
        splash.classList.add('is-hide');
        setTimeout(() => splash.classList.add('is-gone'), 500);
      }, wait);
    }

    /* 优先等 iframe load；load 太慢就超时兜底 */
    let iframeLoaded = false;
    const onFrameLoad = () => {
      if (iframeLoaded) return;
      iframeLoaded = true;
      close();
    };

    if (studioFrame.contentDocument &&
        studioFrame.contentDocument.readyState === 'complete') {
      onFrameLoad();
    } else {
      studioFrame.addEventListener('load', onFrameLoad, { once: true });
    }

    setTimeout(() => { if (!iframeLoaded) close(); }, MAX_SHOW_MS);
  })();
  /* =========================================================
     初始化
     ========================================================= */
  updateProjectTitle();
  renderTree();
  renderTabs();
  renderSubtabs();
  renderContent();

  if (typeof CodeMirror === 'undefined') {
    console.warn('[studio] CodeMirror 未加载，已降级为纯文本编辑器');
  }
})();