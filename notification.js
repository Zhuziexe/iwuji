/* =========================================================
   notification.js —— 通知数据 + 通知中心 UI + 横幅

   面板容器（backdrop + track + 两个 pane）由 PanelSystem 负责，
   本模块只负责：
     - 通知数据（Store 持久化）
     - 通知列表渲染 / 横滑删除 / 点击拉起
     - 顶部时间日期刷新
     - 横幅通知（3 秒自动消失 / 左右滑关闭 / 上滑打开通知中心 / 点击拉起）
   ========================================================= */
window.WujiNotification = (() => {
    const DAYS = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];

  const listeners = new Set();

  let osEl = null;
  let launchApp = null;

  /* =========================================================
     数据层 —— 内存态，不持久化
     页面刷新 / 开机后全部清空
     ========================================================= */
  let memList = [];

  function loadAll() {
    return memList;
  }

  function saveAll(list) {
    memList = Array.isArray(list) ? list : [];
    listeners.forEach(fn => {
      try { fn(memList); } catch (e) { console.error(e); }
    });
  }

  function sameKey(n, b, i) {
    return n.bundlename === b && String(n.id) === String(i);
  }

  function publish(opts) {
    if (!opts || !opts.bundlename) return false;
    const id = opts.id === undefined ? Date.now() : opts.id;

    const list = loadAll();
    const idx = list.findIndex(n => sameKey(n, opts.bundlename, id));

    const next = {
      bundlename:  opts.bundlename,
      id,
      title:       String(opts.title   || ''),
      content:     String(opts.content || ''),
      showtime:    opts.showtime !== false,
      notifyuser:  !!opts.notifyuser,
      clickparams: opts.clickparams || {},
    };

    let record;

    if (idx >= 0) {
      const prev = list[idx];
      /* 内容完全相同 → 不刷新 UI */
      if (prev.title === next.title &&
          prev.content === next.content &&
          prev.showtime === next.showtime &&
          JSON.stringify(prev.clickparams) === JSON.stringify(next.clickparams)) {
        return true;
      }
      record = { ...prev, ...next, time: Date.now() };
      list[idx] = record;
    } else {
      record = { ...next, time: Date.now() };
      list.unshift(record);
    }

    saveAll(list);

    if (record.notifyuser) banner(record);
    return true;
  }

  function unpublish(q) {
    if (!q || !q.bundlename) return false;
    const list = loadAll();
    const filtered = list.filter(n => !sameKey(n, q.bundlename, q.id));
    if (filtered.length === list.length) return false;
    saveAll(filtered);
    return true;
  }

  function clearAll() { saveAll([]); }

  function clearByBundle(bundle) {
    if (!bundle) return 0;
    const list = loadAll();
    const filtered = list.filter(n => n.bundlename !== bundle);
    const removed = list.length - filtered.length;
    if (removed > 0) saveAll(filtered);
    return removed;
  }

  function all() { return loadAll(); }

  function existing(q) {
    if (!q || !q.bundlename) return false;
    return loadAll().some(n => sameKey(n, q.bundlename, q.id));
  }

  /* =========================================================
     工具
     ========================================================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function iconHtml(icon) {
    if (!icon) return '<span></span>';
    if (/^(https?:|data:|\.{1,2}\/|\/)/.test(icon)) {
      return `<img src="${esc(icon)}" alt="" draggable="false">`;
    }
    return `<span>${esc(icon)}</span>`;
  }

  function fmtHHMM(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /* =========================================================
     横幅通知
     ========================================================= */
  let bannerEl = null;
  let bannerTimer = null;
  let audioCtx = null;

  function playSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const t0 = audioCtx.currentTime;
      [880, 1174].forEach((freq, i) => {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.09);
        gain.gain.linearRampToValueAtTime(0.12, t0 + i * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0 + i * 0.09);
        osc.stop(t0 + i * 0.09 + 0.24);
      });
    } catch (e) { }
  }

  function hideBanner() {
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
    if (bannerEl) {
      bannerEl.classList.remove('is-show');
      bannerEl.style.transition = '';
      bannerEl.style.transform  = '';
      bannerEl.style.opacity    = '';
    }
  }

  function triggerLaunch(record) {
    if (typeof launchApp !== 'function') return;
    launchApp(record.bundlename, record.clickparams || {});
  }

  function banner(record) {
    if (!record) return;
    if (!osEl || osEl.dataset.power !== 'running') return;
    if (window.WujiOverlay?.isOpen) return;
    if (window.PanelSystem?.isOpen) return;

    const os = document.getElementById('os');
    if (!os) return;

    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.className = 'wj-banner';
      os.appendChild(bannerEl);
    }

    const app = WujiApps.get(record.bundlename);

    bannerEl.innerHTML = `
      <div class="wj-banner__icon">${iconHtml(app?.icon || '')}</div>
      <div class="wj-banner__body">
        <div class="wj-banner__title">${esc(record.title)}</div>
        <div class="wj-banner__content">${esc(record.content)}</div>
      </div>
    `;

    /* 复位 */
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
    bannerEl.style.transition = '';
    bannerEl.style.transform  = '';
    bannerEl.style.opacity    = '';
    bannerEl.classList.remove('is-show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('is-show');

    const silent =
      (window.WujiControlCenter?.getToggle?.('soundmode'))
      ?? !!Store.get('control.soundmode', false);

    if (!silent) playSound();

    /* ---- 手势状态 ---- */
    let pressed = false;
    let moved   = false;
    let pid     = null;
    let sx = 0, sy = 0;
    let bx = 0, by = 0;

    function scheduleAutoHide() {
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => {
        bannerTimer = null;
        hideBannerInstant();
      }, 3000);
    }

    function hideBannerInstant() {
      clearTimeout(bannerTimer);
      bannerTimer = null;
      bannerEl.classList.remove('is-show');
      bannerEl.style.transition = '';
      bannerEl.style.transform  = '';
      bannerEl.style.opacity    = '';
    }

    function slideOutTo(dirX) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
      const W = window.innerWidth + 60;
      const H = 140;

      bannerEl.style.transition =
        'transform .28s cubic-bezier(.2,.7,.3,1), opacity .22s ease';

      if (dirX === 0) {
        bannerEl.style.transform = `translateY(${-H}px)`;
      } else {
        bannerEl.style.transform = `translateX(${dirX * W}px)`;
      }
      bannerEl.style.opacity = '0';

      setTimeout(() => {
        bannerEl.classList.remove('is-show');
        bannerEl.style.transition = '';
        bannerEl.style.transform  = '';
        bannerEl.style.opacity    = '';
      }, 260);
    }

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pressed = true;
      moved = false;
      pid = e.pointerId;
      sx = e.clientX; sy = e.clientY;
      bx = 0; by = 0;

      clearTimeout(bannerTimer);
      bannerTimer = null;

      bannerEl.style.transition = 'none';
      try { bannerEl.setPointerCapture(e.pointerId); } catch { }
    }

    function onMove(e) {
      if (!pressed || e.pointerId !== pid) return;
      bx = e.clientX - sx;
      by = e.clientY - sy;

      if (Math.abs(bx) > 6 || Math.abs(by) > 6) moved = true;

      const useBy = by < 0 ? by : 0;
      bannerEl.style.transform = `translate(${bx}px, ${useBy}px)`;

      const fade = Math.max(0.15,
        1 - Math.abs(bx) / 220 - Math.max(0, -by) / 180);
      bannerEl.style.opacity = String(fade);
    }

    function onUp(e) {
      if (!pressed || e.pointerId !== pid) return;
      pressed = false;
      try { bannerEl.releasePointerCapture(e.pointerId); } catch { }

      const W_THRESH  = 60;
      const UP_THRESH = 42;

      if (!moved) {
        hideBannerInstant();
        triggerLaunch(record);
        return;
      }

      if (by < -UP_THRESH && Math.abs(by) > Math.abs(bx)) {
        slideOutTo(0);
        return;
      }

       if (Math.abs(bx) > W_THRESH) {
        slideOutTo(bx > 0 ? 1 : -1);
        try {
          unpublish({ bundlename: record.bundlename, id: record.id });
        } catch (e) {
          console.warn('[banner] unpublish failed', e);
        }
        return;
      }

      /* 回弹 */
      bannerEl.style.transition =
        'transform .26s cubic-bezier(.2,.7,.3,1), opacity .22s ease';
      bannerEl.style.transform = '';
      bannerEl.style.opacity   = '';
      scheduleAutoHide();
    }

    bannerEl.onpointerdown   = onDown;
    bannerEl.onpointermove   = onMove;
    bannerEl.onpointerup     = onUp;
    bannerEl.onpointercancel = onUp;

    scheduleAutoHide();
  }

  /* =========================================================
     通知中心：头部时间日期 + 列表渲染
     ========================================================= */
  let ncListEl = null;
  let ncEmptyEl = null;
  let ncClearBtn = null;
  let ncClockEl = null;
  let ncDateEl = null;
  let statusBarIconsEl = null;

  function updateHeadClock() {
    if (!ncClockEl || !ncDateEl) return;
    const d = new Date();
    ncClockEl.textContent =
      `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    ncDateEl.textContent =
      `${d.getMonth() + 1}月${d.getDate()}日 ${DAYS[d.getDay()]}`;
  }

  function updateListMask() {
    if (!ncListEl) return;
    const { scrollTop, scrollHeight, clientHeight } = ncListEl;

    const canScroll = scrollHeight > clientHeight + 1;
    const atTop     = scrollTop <= 1;
    const atBottom  = scrollTop + clientHeight >= scrollHeight - 1;

    ncListEl.classList.toggle('has-top-mask',    canScroll && !atTop);
    ncListEl.classList.toggle('has-bottom-mask', canScroll && !atBottom);
  }

  function renderList() {
    if (!ncListEl) return;
    const list = loadAll();

    ncEmptyEl.hidden  = list.length > 0;
    ncListEl.hidden   = list.length === 0;
    ncClearBtn.hidden = list.length === 0;

    const keys = new Set(list.map(n => n.bundlename + '::' + n.id));

    /* 移除已不存在的 */
    [...ncListEl.children].forEach(el => {
      if (!keys.has(el.dataset.key)) el.remove();
    });

    list.forEach((n, i) => {
      const key = n.bundlename + '::' + n.id;
      let el = [...ncListEl.children].find(c => c.dataset.key === key);
      if (!el) {
        el = createItem(n);
        ncListEl.appendChild(el);
      } else {
        updateItem(el, n);
      }
      if (ncListEl.children[i] !== el) {
        ncListEl.insertBefore(el, ncListEl.children[i] || null);
      }
    });

    requestAnimationFrame(updateListMask);
    updateStatusBarIcons();
  }

  const STATUS_ICON_MAX = 2;

  function updateStatusBarIcons() {
    if (!statusBarIconsEl) return;

    const list = loadAll();

    if (!list.length) {
      statusBarIconsEl.hidden = true;
      statusBarIconsEl.innerHTML = '';
      return;
    }

    /* 按 bundlename 去重，保留首次出现的顺序 */
    const seen   = new Set();
    const unique = [];
    for (const n of list) {
      if (seen.has(n.bundlename)) continue;
      seen.add(n.bundlename);
      unique.push(n.bundlename);
    }

    const shown    = unique.slice(0, STATUS_ICON_MAX);
    const hasMore  = unique.length > STATUS_ICON_MAX;

    let html = '';
    for (const bundle of shown) {
      const app = WujiApps.get(bundle);
      html += `<span class="statusbar-notif-icon">${iconHtml(app?.icon || '')}</span>`;
    }
    if (hasMore) {
      html += `<span class="statusbar-notif-more">…</span>`;
    }

    statusBarIconsEl.innerHTML = html;
    statusBarIconsEl.hidden = false;
  }

  function createItem(n) {
    const app = WujiApps.get(n.bundlename);
    const el = document.createElement('div');
    el.className = 'nc-item';
    el.dataset.key = n.bundlename + '::' + n.id;
    el.innerHTML = `
      <div class="nc-item__icon">${iconHtml(app?.icon || '')}</div>
      <div class="nc-item__body">
        <div class="nc-item__head">
          <span class="nc-item__title"></span>
          <span class="nc-item__time"></span>
        </div>
        <div class="nc-item__content"></div>
      </div>
    `;
    updateItem(el, n);
    bindItemSwipe(el, n);
    return el;
  }

  function updateItem(el, n) {
    el.querySelector('.nc-item__title').textContent   = n.title   || '';
    el.querySelector('.nc-item__content').textContent = n.content || '';

    const timeEl = el.querySelector('.nc-item__time');
    if (n.showtime) {
      timeEl.textContent = fmtHHMM(n.time);
      timeEl.hidden = false;
    } else {
      timeEl.textContent = '';
      timeEl.hidden = true;
    }
  }

  function bindItemSwipe(el, n) {
    let pointerId = null;
    let sx = 0, sy = 0, dx = 0;
    let lock = null;
    let active = false;

    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerId = e.pointerId;
      sx = e.clientX; sy = e.clientY;
      dx = 0; lock = null; active = true;
      el.style.transition = 'none';
    });

    el.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== pointerId) return;
      const mx = e.clientX - sx;
      const my = e.clientY - sy;

      if (!lock) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        lock = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
        if (lock === 'v') { active = false; el.style.transform = ''; return; }
        try { el.setPointerCapture(e.pointerId); } catch { }
      }
      if (lock !== 'h') return;

      dx = mx;
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / 260));
    });

    function finish(e) {
      if (!active || (e && e.pointerId !== pointerId)) return;
      active = false;

      const moved  = Math.abs(dx);
      const tapped = moved < 6;

      el.style.transition =
        'transform .22s ease, opacity .22s ease, height .24s ease, margin .24s ease, padding .24s ease';
      el.style.transform = '';
      el.style.opacity   = '';

      if (tapped) {
        triggerLaunch(n);
        return;
      }
      if (moved > 60) {
        const dir = dx > 0 ? 1 : -1;

        /* 1) 记录其余项的当前位置，作为 FLIP 起点 */
        const siblings = [...ncListEl.children].filter(c => c !== el);
        const oldTops  = siblings.map(c => c.getBoundingClientRect().top);

        /* 2) 被删项先水平滑出 + 淡出 */
        el.style.transition = 'transform .18s ease, opacity .18s ease';
        el.style.transform  = `translateX(${dir * (el.offsetWidth + 40)}px)`;
        el.style.opacity    = '0';

        /* 3) 从数据中移除 → 触发 renderList 移除 DOM */
        setTimeout(() => {
          unpublish({ bundlename: n.bundlename, id: n.id });

          /* 4) FLIP：把剩余项从旧位置"滑"到新位置 */
          siblings.forEach((c, i) => {
            if (!c.isConnected) return;
            const newTop = c.getBoundingClientRect().top;
            const dy = oldTops[i] - newTop;
            if (Math.abs(dy) < 0.5) return;

            c.style.transition = 'none';
            c.style.transform  = `translateY(${dy}px)`;
            void c.offsetHeight;                  /* 强制重排 */
            c.style.transition = 'transform .22s cubic-bezier(.2,.7,.3,1)';
            c.style.transform  = '';
          });
        }, 170);
      }
    }

    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  }

  /* =========================================================
     init
     ========================================================= */
  function init(options) {
    osEl = options.osEl;
    launchApp = options.openApp;

    try { Store.remove('notifications'); } catch { }

    ncListEl     = document.getElementById('ncList');
    ncEmptyEl    = document.getElementById('ncEmpty');
    ncClearBtn   = document.getElementById('ncClearBtn');
    ncClockEl    = document.getElementById('ncClock');
    ncDateEl     = document.getElementById('ncDate');
    statusBarIconsEl = document.getElementById('statusbarNotifIcons');

    updateHeadClock();
    renderList();
    listeners.add(renderList);
    updateStatusBarIcons();

    if (ncListEl) {
      ncListEl.addEventListener('scroll', updateListMask, { passive: true });
      requestAnimationFrame(updateListMask);
    }

    setInterval(updateHeadClock, 10000);

    if (ncClearBtn) {
      ncClearBtn.addEventListener('click', () => {
        clearAll();
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch { } }
      });
    }
  }

  /* =========================================================
     导出
     ========================================================= */
  return {
    init,
    publish,
    unpublish,
    existing,
    clearAll,
    clearByBundle,
    all,

    hideBanner,

    /* 面板控制 —— 全部委托给 PanelSystem */
    open()    { window.PanelSystem?.open('nc'); },
    close()   { window.PanelSystem?.close(); },
    isOpen()  {
      return !!window.PanelSystem?.isOpen && window.PanelSystem.panel === 'nc';
    },
    openFromLeft() { window.PanelSystem?.open('nc'); },
    switchToControlCenter() { window.PanelSystem?.setPanel('cc'); },
  };
})();