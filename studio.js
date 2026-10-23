(() => {
  const STORAGE_KEY = 'studio.project';
  /* ---------- 默认图标（内置 SVG） ---------- */
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

  function resolveIcon(icon) {
    const v = String(icon == null ? '' : icon).trim();
    return v ? v : DEFAULT_ICON_SVG;
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
  let project = loadProject() || JSON.parse(JSON.stringify(DEFAULT_PROJECT));
  let activeTab = 'css';        // 'css' | 路由名
  let activeSubtab = 'render';  // 'render' | 'mount' | 'unmount'
  let cm = null;

  /* ---------- 持久化 ---------- */
  function saveProject() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (e) {
      console.warn('[studio] 保存失败', e);
    }
  }

  function loadProject() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) return null;
      const p = JSON.parse(s);
      if (!p || !Array.isArray(p.routes) || !p.routes.length) return null;
      return p;
    } catch {
      return null;
    }
  }

  /* ---------- 编译：把 project 拼成可注册的 JS 代码 ---------- */
  function buildAppJs(p) {
    const routesCode = p.routes.map(r => {
      const render = r.render || 'return "";';
      const mount = r.mount || '';
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

  /* ---------- 编辑器 ---------- */
  function getActiveRoute() {
    if (activeTab === 'css') return null;
    return project.routes.find(r => r.name === activeTab) || null;
  }

  function getEditorValue() {
    if (activeTab === 'css') return project.styles || '';
    const route = getActiveRoute();
    if (!route) return '';
    return route[activeSubtab] || '';
  }

  function setEditorValue(val) {
    if (activeTab === 'css') {
      project.styles = val;
    } else {
      const route = getActiveRoute();
      if (route) route[activeSubtab] = val;
    }
    saveProject();
  }

  function mountEditor() {
    const wrap = document.getElementById('editorWrap');
    wrap.innerHTML = '';

    const isCss = activeTab === 'css';
    const mode = isCss ? 'css' : 'javascript';

    cm = CodeMirror(wrap, {
      value: getEditorValue(),
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

    cm.on('change', () => {
      setEditorValue(cm.getValue());
    });

    /* 等字体加载后重新测量，避免行高偏移 */
    requestAnimationFrame(() => {
      try { cm.refresh(); } catch { }
    });
  }

  /* ---------- 树 ---------- */
  function renderTree() {
    const tree = document.getElementById('tree');
    const items = [];

    items.push(
      `<div class="tree__item tree__item--css ${activeTab === 'css' ? 'is-active' : ''}"
            data-tab="css">全局 CSS</div>`
    );

    for (const r of project.routes) {
      items.push(
        `<div class="tree__item ${activeTab === r.name ? 'is-active' : ''}"
              data-tab="${escapeHtml(r.name)}">${escapeHtml(r.name)}</div>`
      );
    }

    tree.innerHTML = items.join('');

    tree.querySelectorAll('.tree__item').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.dataset.tab;
        if (tab === activeTab) return;
        activeTab = tab;
        activeSubtab = 'render';
        renderTree();
        renderTabs();
        renderSubtabs();
        mountEditor();
      });

      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (el.dataset.tab === 'css') return;
        deleteRoute(el.dataset.tab);
      });
    });
  }

  /* ---------- Tabs ---------- */
  function renderTabs() {
    const tabs = document.getElementById('tabs');
    const all = ['css', ...project.routes.map(r => r.name)];

    tabs.innerHTML = all.map(t => `
      <div class="tab ${activeTab === t ? 'is-active' : ''}"
           data-tab="${escapeHtml(t)}">
        ${t === 'css' ? 'CSS' : escapeHtml(t)}
      </div>
    `).join('');

    tabs.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.dataset.tab;
        if (tab === activeTab) return;
        activeTab = tab;
        activeSubtab = 'render';
        renderTree();
        renderTabs();
        renderSubtabs();
        mountEditor();
      });
    });
  }

  function renderSubtabs() {
    const subtabs = document.getElementById('subtabs');
    if (activeTab === 'css') {
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
        mountEditor();
      });
    });
  }

  /* ---------- 新增 / 删除路由 ---------- */
  function addRoute() {
    const name = prompt('新路由名称（英文，如 about）');
    if (!name) return;

    const trimmed = name.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed)) {
      alert('路由名只能包含字母、数字、下划线、连字符，且以字母开头');
      return;
    }
    if (trimmed === 'css') {
      alert('"css" 是保留名，不能用作路由');
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
    activeTab = trimmed;
    activeSubtab = 'render';
    renderTree();
    renderTabs();
    renderSubtabs();
    mountEditor();
  }

  function deleteRoute(name) {
    if (project.routes.length <= 1) {
      alert('至少保留一个路由');
      return;
    }
    if (!confirm(`确定删除路由「${name}」？`)) return;

    project.routes = project.routes.filter(r => r.name !== name);

    if (project.initialRoute === name) {
      project.initialRoute = project.routes[0].name;
    }
    if (activeTab === name) {
      activeTab = 'css';
      activeSubtab = 'render';
    }

    saveProject();
    renderTree();
    renderTabs();
    renderSubtabs();
    mountEditor();
  }

  /* ---------- 预览区外壳：适配尺寸 ---------- */
  const DESIGN_W = 300;
  const DESIGN_H = 400;
  const LONG_PRESS_MS = 650;

  const studioScreenEl = document.getElementById('studioScreen');
  const studioFrame = document.getElementById('previewFrame');
  const studioPowerKey = document.getElementById('studioPowerKey');
  const studioVolUp = document.getElementById('studioVolUp');
  const studioVolDown = document.getElementById('studioVolDown');

  function fitStudio() {
    const r = studioScreenEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const scale = Math.min(r.width / DESIGN_W, r.height / DESIGN_H);
    studioFrame.style.transform = `translate(-50%,-50%) scale(${scale})`;
  }
  new ResizeObserver(fitStudio).observe(studioScreenEl);
  studioFrame.addEventListener('load', fitStudio);
  window.addEventListener('load', fitStudio);
  fitStudio();

  /* ---------- 硬件键 → 发消息给 iframe ---------- */
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
    if (!longPressed && d < LONG_PRESS_MS) {
      sendToOS('hw:power-short');
    }
    longPressed = false;
  });

  studioPowerKey.addEventListener('pointercancel', () => {
    clearTimeout(longPressTimer);
    longPressed = false;
  });

  function bindVolumeKey(el, dir) {
    const pressAction = dir === 'up' ? 'hw:vol-up-press' : 'hw:vol-down-press';
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

  /* ---------- 预览：强制覆盖 + 打开应用 ---------- */
  async function preview() {
    const w = studioFrame.contentWindow;

    if (!w || !w.WujiAppInstaller || !w.WujiAppLauncher) {
      alert('预览 iframe 未就绪，请等 iWuji 加载完成后再点（一般需 3~5 秒）');
      return;
    }

    /* 生成代码 */
    let appJs;
    try {
      appJs = buildAppJs(project);
    } catch (e) {
      alert('代码生成失败：' + e.message);
      return;
    }

    console.log('[studio] 生成代码，长度', appJs.length, '字节');

    /* 如果当前正在预览这个应用，先关掉 */
    try {
      if (w.WujiAppLauncher.getCurrentBundle?.() === project.bundle) {
        w.WujiAppLauncher.close();
      }
    } catch { }

    /* 强制覆盖安装 */
    try {
      const res = await w.WujiAppInstaller.install(
        {
          bundlename: project.bundle,
          name: project.name,
          icon: project.icon,
          version: project.version,
          initialRoute: project.initialRoute,
        },
        { force: true, code: appJs }
      );

      console.log('[studio] install 结果', res);

      if (!res || !res.ok) {
        const action = res?.action || 'unknown';
        const err = res?.error?.message || '';
        alert(`预览失败：${action}${err ? ' — ' + err : ''}`);
        return;
      }
    } catch (e) {
      console.error('[studio] preview install failed', e);
      alert('预览失败：' + e.message);
      return;
    }

    /* 延迟后发 open，等 close 动画跑完（S.view 从 app 回到 home） */
    setTimeout(() => {
      try {
        w.postMessage({ type: 'studio:open', bundle: project.bundle }, '*');
      } catch (e) {
        console.warn('[studio] postMessage open 失败', e);
      }
    }, 320);
  }

  /* ---------- 导出 ---------- */
  function exportJs() {
    let code;
    try {
      code = buildAppJs(project);
    } catch (e) {
      alert('导出失败：' + e.message);
      return;
    }

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

  /* ---------- 工具 ---------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /* ---------- 工具栏事件 ---------- */
  document.getElementById('btnPreview').addEventListener('click', preview);
  document.getElementById('btnExport').addEventListener('click', exportJs);
  document.getElementById('btnSave').addEventListener('click', () => {
    saveProject();
    /* 轻提示 */
    const btn = document.getElementById('btnSave');
    const old = btn.textContent;
    btn.textContent = '已保存';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = old;
      btn.disabled = false;
    }, 1000);
  });
  document.getElementById('btnAddRoute').addEventListener('click', addRoute);

  /* 项目元信息输入 */
  const bundleInput = document.getElementById('projBundle');
  const nameInput = document.getElementById('projName');
  const iconInput = document.getElementById('projIcon');
  const iconPreview = document.getElementById('iconPreview');

  bundleInput.value = project.bundle;
  nameInput.value = project.name;
  iconInput.value = project.icon;

  function updateIconPreview() {
    if (!iconPreview) return;
    const icon = resolveIcon(project.icon);

    if (/^(https?:|data:|\.{1,2}\/|\/)/.test(icon)) {
      iconPreview.innerHTML =
        `<img src="${icon}" alt="" draggable="false">`;
    } else {
      iconPreview.innerHTML = '';
      iconPreview.textContent = icon;
    }
  }

  bundleInput.addEventListener('input', () => {
    project.bundle = bundleInput.value.trim();
    saveProject();
  });
  nameInput.addEventListener('input', () => {
    project.name = nameInput.value.trim();
    saveProject();
  });
  iconInput.addEventListener('input', () => {
    project.icon = iconInput.value.trim();
    saveProject();
    updateIconPreview();
  });

  updateIconPreview();

  /* =========================================================
     图片转 DataURL
     ========================================================= */
  (function initImage2Data() {
    const modal = document.getElementById('imgModal');
    const modalClose = document.getElementById('imgModalClose');
    const dropEl = document.getElementById('imgDrop');
    const fileInput = document.getElementById('imgFileInput');

    const optionsEl = document.getElementById('imgOptions');
    const sizeSel = document.getElementById('imgSize');
    const formatSel = document.getElementById('imgFormat');
    const qualityRow = document.getElementById('imgQualityRow');
    const qualityInput = document.getElementById('imgQuality');
    const qualityVal = document.getElementById('imgQualityVal');

    const resultEl = document.getElementById('imgResult');
    const previewImg = document.getElementById('imgPreview');
    const originalInfo = document.getElementById('imgOriginalInfo');
    const outputInfo = document.getElementById('imgOutputInfo');
    const dataUrlEl = document.getElementById('imgDataUrl');
    const copyBtn = document.getElementById('imgCopyBtn');
    const insertBtn = document.getElementById('imgInsertBtn');

    let currentFile = null;
    let currentImg = null;
    let currentOriginalFormat = 'image/png';

    /* ---------- 打开 / 关闭 ---------- */
    function openModal() {
      modal.hidden = false;
      reset();
    }
    function closeModal() {
      modal.hidden = true;
      reset();
    }
    function reset() {
      currentFile = null;
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
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    /* ---------- 文件选择 ---------- */
    dropEl.addEventListener('click', () => fileInput.click());

    dropEl.addEventListener('dragover', e => {
      e.preventDefault();
      dropEl.classList.add('is-dragover');
    });
    dropEl.addEventListener('dragleave', () => {
      dropEl.classList.remove('is-dragover');
    });
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

      currentFile = file;
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

          /* 如果原格式是 JPEG，默认让格式选择器跟过去 */
          if (file.type === 'image/jpeg') formatSel.value = 'keep';
          else formatSel.value = 'image/webp';   /* PNG 默认转 WebP 省空间 */

          updateQualityRow();
          generate();
        };
        img.onerror = () => alert('图片加载失败');
        img.src = String(ev.target.result);
      };
      reader.onerror = () => alert('文件读取失败');
      reader.readAsDataURL(file);
    }

    /* ---------- 选项变化 ---------- */
    sizeSel.addEventListener('change', generate);
    formatSel.addEventListener('change', () => {
      updateQualityRow();
      generate();
    });
    qualityInput.addEventListener('input', () => {
      qualityVal.textContent = Math.round(qualityInput.value * 100) + '%';
      generate();
    });

    function updateQualityRow() {
      const fmt = resolveFormat();
      const showQuality = (fmt === 'image/jpeg' || fmt === 'image/webp');
      qualityRow.hidden = !showQuality;
    }

    function resolveFormat() {
      if (formatSel.value === 'keep') return currentOriginalFormat;
      return formatSel.value;
    }

    /* ---------- 生成 DataURL ---------- */
    let generateRaf = null;

    function generate() {
      if (!currentImg) return;
      if (generateRaf) cancelAnimationFrame(generateRaf);
      generateRaf = requestAnimationFrame(() => {
        generateRaf = null;
        doGenerate();
      });
    }

    function doGenerate() {
      const img = currentImg;
      const maxSize = Number(sizeSel.value) || 0;
      const format = resolveFormat();
      const quality = Number(qualityInput.value) || 0.85;

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      /* 等比缩放到 maxSize 之内 */
      if (maxSize > 0 && (w > maxSize || h > maxSize)) {
        const scale = Math.min(maxSize / w, maxSize / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      /* JPEG 不支持透明背景，先铺白底 */
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, 0, 0, w, h);

      let dataUrl;
      try {
        dataUrl = canvas.toDataURL(format, quality);
      } catch (e) {
        console.warn('[studio] toDataURL 失败', e);
        dataUrl = canvas.toDataURL('image/png');
      }

      /* 更新 UI */
      previewImg.src = dataUrl;
      dataUrlEl.value = dataUrl;

      /* 计算输出字节数 */
      const base64 = dataUrl.split(',')[1] || '';
      const bytes = Math.round(base64.length * 3 / 4);

      outputInfo.textContent =
        `${w} × ${h} · ${format.replace('image/', '').toUpperCase()} · ${formatBytes(bytes)}`;

      /* 太大数据提示 */
      if (bytes > 200 * 1024) {
        outputInfo.style.color = '#e0a030';
        outputInfo.textContent += ' · 偏大，建议缩小尺寸';
      } else {
        outputInfo.style.color = '';
      }
    }

    /* ---------- 复制 ---------- */
    copyBtn.addEventListener('click', async () => {
      const text = dataUrlEl.value;
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        flashBtn(copyBtn, '已复制');
      } catch {
        /* 兜底 */
        dataUrlEl.select();
        document.execCommand('copy');
        flashBtn(copyBtn, '已复制');
      }
    });

    /* ---------- 插入到编辑器 ---------- */
    insertBtn.addEventListener('click', () => {
      const text = dataUrlEl.value;
      if (!text) return;

      if (!cm) {
        alert('当前没有可用的编辑器，请先选择一个路由');
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

    function formatBytes(n) {
      if (!n || n < 0) return '0 B';
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
      return (n / 1024 / 1024).toFixed(2) + ' MB';
    }
  })();

  /* ---------- 初始化 ---------- */
  renderTree();
  renderTabs();
  renderSubtabs();
  mountEditor();
})();