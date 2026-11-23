/* =========================================================
   wuji-multitask.js —— 多任务界面 + 后台管理 + WujiOOMKiller

   职责：
     - 后台栈：应用从前台退出时把 DOM/导航保留在后台（不 unmount）
     - 多任务 UI：壁纸背景、横向三卡布局、滚动吸附、点击进应用、
                  上滑杀后台、桌面/清除按钮
     - 进入动画：白底遮罩+大图标 → 缩小飞入中间卡片
     - 离开动画：桌面/清除/侧滑 → fade 出，桌面/壁纸 fade 入
     - WujiOOMKiller：应用数超阈值 / 系统卡时随机杀后台（不杀前台）

   依赖：WujiApps / WujiToast / WujiLife(可选) / WujiTheme(可选)
   挂载：window.WujiMultitask
   ========================================================= */
(() => {
  'use strict';

  const HOLD_MS = 1200;
  const OOM_THRESHOLD = 4;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /* 大/小应用图标：统一圆角，img 继承容器圆角 */
  function iconMarkup(app, size, cls) {
    const icon = app?.icon || '';
    if (/^(https?:|data:|\.{1,2}\/|\/)/.test(icon)) {
      return `<img class="${cls || ''}" src="${icon}" alt="" draggable="false" style="width:100%;height:100%;border-radius:inherit;object-fit:contain;">`;
    }
    return `<span class="${cls || ''}" style="font-size:${Math.round(size * 0.55)}px;line-height:1;">${escapeHtml(icon)}</span>`;
  }

  function create(hooks) {
    hooks = hooks || {};
    const osEl = hooks.osEl || document.getElementById('os');
    const mountHost = hooks.mountHost || osEl;

    /* ---------------- DOM ---------------- */
    const root = document.createElement('div');
    root.className = 'wj-multitask';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="wj-mt-canvas" id="wjMtCanvas">
        <div class="wj-mt-track" id="wjMtTrack"></div>
        <div class="wj-mt-empty" id="wjMtEmpty" hidden>最近无运行应用</div>
      </div>
      <div class="wj-mt-bottom">
        <button class="wj-mt-btn" data-action="home" type="button">桌面</button>
        <button class="wj-mt-btn" data-action="clear" type="button">清除</button>
      </div>
      <div class="wj-mt-snapshot" id="wjMtSnapshot"></div>
    `;
    mountHost.appendChild(root);

    const canvas = root.querySelector('#wjMtCanvas');
    const track = root.querySelector('#wjMtTrack');
    const emptyEl = root.querySelector('#wjMtEmpty');
    const snapshot = root.querySelector('#wjMtSnapshot');

    /* ---------------- 状态 ---------------- */
    let open = false;
    let entries = [];
    let index = 0;
    let animating = false;

    function getList() {
      try { return hooks.getBackgroundList?.() || []; } catch { return []; }
    }

    function metaFor(bundle) {
      try {
        return hooks.getAppMeta?.(bundle) || (window.WujiApps?.get?.(bundle) || {});
      } catch { return {}; }
    }

    /* ---------------- 构建卡片 ----------------
       需求5：应用是一个透明容器 —— 上面一行 小图标+文字，下面是整张白色圆角卡片。 */
    function buildCard(entry) {
      const meta = entry.meta || metaFor(entry.bundle);
      const bigSize = 73;
      const smallSize = 32;
      const card = document.createElement('div');
      card.className = 'wj-mt-card';   /* 透明容器 */
      card.dataset.bundle = entry.bundle;
      card.innerHTML = `
        <div class="wj-mt-card__head">
          <span class="wj-mt-card__icon" style="${meta.iconStyle || ''}">${iconMarkup(meta, smallSize)}</span>
          <span class="wj-mt-card__name">${escapeHtml(meta.name || entry.bundle)}</span>
        </div>
        <div class="wj-mt-card__body">
          <div class="wj-mt-card__panel" style="${meta.iconStyle || ''}">
            ${iconMarkup(meta, bigSize)}
          </div>
        </div>
      `;
      return card;
    }

    /* ---------------- 布局：三卡 左露一点/中完整/右露一点 ---------------- */
    let cardW = 0, gap = 0, canvasW = 0, canvasH = 0;
    function measure() {
      canvasW = canvas.clientWidth || (osEl?.clientWidth || 0);
      canvasH = canvas.clientHeight || 600;
      cardW = Math.min(Math.round(canvasW * 0.6), Math.round(canvasH * 0.74));
      gap = Math.max(12, Math.round(canvasW * 0.035));
    }

    function cardX(i) {
      return canvasW / 2 - cardW / 2 + (i - index) * (cardW + gap);
    }
    function cardY() {
      /* 卡片总高 = head(50+8) + panel(4/3 * cardW)，垂直居中；略微上移靠近按钮 */
      const totalH = 58 + cardW * 4 / 3;
      return -totalH / 2 - 10;
    }

    function applyLayout(animate) {
      measure();
      Array.prototype.forEach.call(track.children, (card, i) => {
        card.style.transition = animate
          ? 'transform .34s cubic-bezier(.22,.61,.36,1)'
          : 'none';
        card.style.transform = `translate3d(${cardX(i)}px,${cardY()}px,0)`;
        /* 需求4：所有卡片 opacity 一致 */
        card.style.opacity = '1';
        card.style.removeProperty('margin-top');
      });
    }

    function renderCards() {
      track.innerHTML = '';
      const list = getList();
      entries = list.map(e => ({ ...e, meta: e.meta || metaFor(e.bundle) }));
      emptyEl.hidden = entries.length > 0;   /* 需求7 */
      entries.forEach(e => track.appendChild(buildCard(e)));
      if (index >= entries.length) index = Math.max(0, entries.length - 1);
      applyLayout(false);
    }

    /* ---------------- 进入动画 ---------------- */
    function prepareSnapshot(bundle) {
      const meta = metaFor(bundle);
      snapshot.innerHTML = `
        <div class="wj-mt-snapshot__inner" style="${meta.iconStyle || ''}">
          ${iconMarkup(meta, 73)}
        </div>
      `;
      snapshot.style.transition = 'none';
      snapshot.style.transformOrigin = 'top left';
      snapshot.style.transform = '';
      /* 起始：铺满全屏、圆角 0 → 收缩到卡片时圆角渐变到 22px */
      snapshot.style.left = '0px';
      snapshot.style.top = '0px';
      snapshot.style.width = (osEl?.clientWidth || window.innerWidth) + 'px';
      snapshot.style.height = (osEl?.clientHeight || window.innerHeight) + 'px';
      snapshot.style.borderRadius = '0px';
      snapshot.style.opacity = '1';
    }

    function flyToCard() {
      if (!snapshot.firstChild) return;
      measure();
      const toRect = (() => {
        const card = track.children[index];
        if (!card) return { left: canvasW / 2 - 60, top: 100, width: 120, height: 160, radius: '22px' };
        const panel = card.querySelector('.wj-mt-card__panel') || card;
        const r = panel.getBoundingClientRect();
        /* ★ 直接用目标卡片的实际圆角，保证动画结束和卡片圆角完全一致 */
        return {
          left: r.left, top: r.top, width: r.width, height: r.height,
          radius: getComputedStyle(panel).borderRadius || '22px',
        };
      })();
      /* 用 left/top/width/height 收缩，而不是 transform:scale：
         scale 会把 border-radius 一起缩放，导致圆角视觉上不会"渐渐变大"。
         直接改尺寸时，border-radius 在元素自身坐标系里从 0→22px 平滑增长。 */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        snapshot.style.transition =
          'left .42s cubic-bezier(.22,.61,.36,1), top .42s cubic-bezier(.22,.61,.36,1), ' +
          'width .42s cubic-bezier(.22,.61,.36,1), height .42s cubic-bezier(.22,.61,.36,1), ' +
          'border-radius .42s ease, opacity .3s ease .14s';
        snapshot.style.left = toRect.left + 'px';
        snapshot.style.top = toRect.top + 'px';
        snapshot.style.width = toRect.width + 'px';
        snapshot.style.height = toRect.height + 'px';
        snapshot.style.borderRadius = toRect.radius;
        snapshot.style.opacity = '0';
        setTimeout(() => {
          snapshot.style.transition = 'none';
          snapshot.style.left = '';
          snapshot.style.top = '';
          snapshot.style.width = '';
          snapshot.style.height = '';
          snapshot.style.borderRadius = '';
          snapshot.style.opacity = '0';
          snapshot.innerHTML = '';
        }, 560);
      }));
    }

    function show(opts) {
      opts = opts || {};
      if (open) return Promise.resolve();
      open = true;
      root.setAttribute('aria-hidden', 'false');
      measure();
      renderCards();
      root.style.transition = 'none';
      root.style.opacity = '0';
      root.classList.add('is-open');
      if (opts && opts.from) prepareSnapshot(opts.from);
      return new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          root.style.transition = 'opacity .22s ease';
          root.style.opacity = '1';
          setTimeout(resolve, 240);
        }));
      });
    }

    function hide() {
      if (!open) return Promise.resolve();
      return new Promise(resolve => {
        animating = true;
        root.style.transition = 'opacity .24s ease';
        root.style.opacity = '0';
        setTimeout(() => {
          root.classList.remove('is-open');
          root.setAttribute('aria-hidden', 'true');
          root.style.transition = 'none';
          root.style.opacity = '';
          open = false;
          animating = false;
          resolve();
        }, 250);
      });
    }

    /* ---------------- 滚动 / 上滑杀后台 ---------------- */
    let drag = null;
    canvas.addEventListener('pointerdown', e => {
      if (!open || animating) return;
      if (e.target.closest('.wj-mt-btn')) return;
      /* 不 setPointerCapture：否则 click 会被重定向到 canvas，卡片点击失效 */
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, lock: null,
               target: e.target };
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.lock) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (drag.lock === 'v') {
        /* 需求8：上滑从 0 开始跟手，不要瞬间跳下去 */
        const card = track.children[index];
        if (card) {
          const offset = Math.min(0, dy);          // 只向上
          card.style.transition = 'none';
          card.style.transform = `translate3d(${cardX(index)}px, ${cardY() + offset}px, 0)`;
          card.style.opacity = String(Math.max(0.25, 1 + offset / 400));
        }
        return;
      }
      drag.dx = dx;
      Array.prototype.forEach.call(track.children, (card, i) => {
        card.style.transition = 'none';
        card.style.transform = `translate3d(${cardX(i) + dx}px, ${cardY()}px, 0)`;
      });
    });

    function finishDrag(e) {
      if (!drag) return;
      const d = drag;
      drag = null;
      const dyTotal = (e && e.clientY != null) ? (e.clientY - d.y) : (d.dy || 0);

      if (d.lock === 'v') {
        const card = track.children[index];
        if (dyTotal < -140 && entries[index]) {
          killCard(index);
        } else if (card) {
          card.style.transition = 'transform .28s cubic-bezier(.22,.61,.36,1), opacity .22s ease';
          card.style.transform = `translate3d(${cardX(index)}px, ${cardY()}px, 0)`;
          card.style.opacity = '1';
        }
        return;
      }
      const step = cardW + gap;
      const moved = Math.round(-d.dx / step);
      index = Math.max(0, Math.min(entries.length - 1, index + moved));
      applyLayout(true);
    }
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', () => { drag = null; applyLayout(true); });
    window.addEventListener('resize', () => { if (open) applyLayout(false); });

    /* ---------------- 点击中间卡片 → 进入应用 ---------------- */
    track.addEventListener('click', e => {
      if (!open || animating) return;
      const card = e.target.closest('.wj-mt-card');
      if (!card) return;
      const i = Array.prototype.indexOf.call(track.children, card);
      const entry = entries[i];
      if (!entry) return;
      if (i !== index) { index = i; applyLayout(true); return; }

      /* 点击卡片：白底圆角从卡片放大到全屏，图标保持固定大小居中，
         放大完成后切前台并淡出遮罩。避免图标被 inline width:100% 撑大。 */
      const panel = card.querySelector('.wj-mt-card__panel') || card;
      const rect = panel.getBoundingClientRect();
      const meta = entry.meta || metaFor(entry.bundle);

      const fly = document.createElement('div');
      fly.className = 'wj-mt-fly';
      fly.style.left = rect.left + 'px';
      fly.style.top = rect.top + 'px';
      fly.style.width = rect.width + 'px';
      fly.style.height = rect.height + 'px';
      fly.style.borderRadius = getComputedStyle(panel).borderRadius;
      /* 固定尺寸图标，不随 fly 放大（和桌面图标一致 73px / 17px 圆角） */
      const iconSize = 73;
      const iconWrap = document.createElement('div');
      iconWrap.className = 'wj-mt-fly__icon';
      iconWrap.style.cssText = `width:${iconSize}px;height:${iconSize}px;border-radius:17px;overflow:hidden;display:flex;align-items:center;justify-content:center;`;
      iconWrap.innerHTML = iconMarkup(meta, iconSize);
      fly.appendChild(iconWrap);
      root.appendChild(fly);
      animating = true;

      /* 图标在 fly 中相对：先用绝对定位固定在 fly 中心，fly 放大时视觉位置会跟着走，
         但图标本身尺寸不变；放大结束把图标淡出。 */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fly.style.transition = 'left .38s cubic-bezier(.22,.61,.36,1), top .38s cubic-bezier(.22,.61,.36,1), width .38s cubic-bezier(.22,.61,.36,1), height .38s cubic-bezier(.22,.61,.36,1), border-radius .38s cubic-bezier(.22,.61,.36,1)';
        fly.style.left = '0px';
        fly.style.top = '0px';
        fly.style.width = osEl.clientWidth + 'px';
        fly.style.height = osEl.clientHeight + 'px';
        fly.style.borderRadius = '0px';
        setTimeout(() => {
          try { hooks.onSwitchTo?.(entry.bundle, entry); } catch (err) { console.error(err); }
          fly.style.transition = 'opacity .26s ease';
          fly.style.opacity = '0';
          setTimeout(() => {
            fly.remove();
            animating = false;
          }, 270);
        }, 400);
      }));
    });

    /* ---------------- 底部按钮（透明容器 + 半透明胶囊按钮） ---------------- */
    root.querySelector('.wj-mt-bottom').addEventListener('click', e => {
      const btn = e.target.closest('.wj-mt-btn');
      if (!btn) return;
      if (btn.dataset.action === 'home') {
        hide().then(() => hooks.onGoHome?.({ clearAll: false }));
      } else if (btn.dataset.action === 'clear') {
        clearAll();
      }
    });

    /* ---------------- 杀后台 ---------------- */
    function killCard(i) {
      const entry = entries[i];
      if (!entry) return;
      const card = track.children[i];
      /* 记录删除前每张卡片的实际位置，供剩余卡片做平移归位动画。
         必须在 splice / renderCards 之前取，因为那会改变 index 与 DOM。 */
      const before = [];
      Array.prototype.forEach.call(track.children, (c, idx) => {
        before.push({ x: cardX(idx), y: cardY() });
      });
      if (card) {
        card.style.transition = 'transform .34s cubic-bezier(.4,0,.6,1), opacity .28s ease';
        card.style.transform = `translate3d(${cardX(i)}px, ${cardY() - (osEl.clientHeight || 800)}px, 0)`;
        card.style.opacity = '0';
      }
      setTimeout(() => {
        try { hooks.onKill?.(entry.bundle, entry); } catch (e) { console.error(e); }
        entries.splice(i, 1);
        if (index >= entries.length) index = Math.max(0, entries.length - 1);
        renderCards();
        slideOthers(before, i);
        if (entries.length === 0) {
          setTimeout(() => hide().then(() => hooks.onGoHome?.({ clearAll: false })), 180);
        }
      }, 300);
    }

    /* 剩余卡片：从旧位置平移到新位置（不做翻转）。
       renderCards 重建 DOM 后卡片会瞬间落在终点，所以这里用记录下的旧位置
       做一次位移补间，让卡片平滑滑到新位置。WAAPI 默认 fill:none，
       结束后回到 inline 的终点，不会跳变。 */
    function slideOthers(before, killedIndex) {
      Array.prototype.forEach.call(track.children, (card, newIdx) => {
        /* 重建后的新索引 → 删除前的旧索引 */
        const oldIdx = newIdx < killedIndex ? newIdx : newIdx + 1;
        const from = before[oldIdx] || { x: cardX(newIdx), y: cardY() };
        const to = { x: cardX(newIdx), y: cardY() };
        /* 终点先写进 inline style 并把 transition 关掉，避免和 WAAPI 动画抢 transform。 */
        card.style.transition = 'none';
        card.style.transform = `translate3d(${to.x}px, ${to.y}px, 0)`;
        card.animate(
          [
            { transform: `translate3d(${from.x}px,${from.y}px,0)` },
            { transform: `translate3d(${to.x}px,${to.y}px,0)` },
          ],
          { duration: 380, easing: 'cubic-bezier(.22,.61,.36,1)' }
        );
      });
    }

    function clearAll() {
      if (animating) return;
      animating = true;
      const cards = [...track.children];
      cards.forEach((card, i) => {
        card.style.transition = 'transform .34s cubic-bezier(.4,0,.6,1), opacity .3s ease';
        card.style.transform = `translate3d(${cardX(i)}px, ${cardY() - (osEl.clientHeight || 800)}px, 0)`;
        card.style.opacity = '0';
      });
      setTimeout(() => {
        entries.forEach(e => {
          try { hooks.onKill?.(e.bundle, e); } catch { }
        });
        hide().then(() => {
          hooks.onGoHome?.({ clearAll: true });
          try { WujiToast?.show?.('你的iWuji已处于最佳状态'); } catch { }
        });
      }, 340);
    }

    /* ---------------- WujiOOMKiller ----------------
       只保留数量限制：每 3 秒检查一次后台数，超过上限(6)随机杀一个。
       不做掉帧采样，不监听 visibilitychange。 */
    function bgCount() {
      try { return hooks.getBackgroundCount ? hooks.getBackgroundCount() : getList().length; }
      catch { return 0; }
    }

    const oomTimer = setInterval(() => {
      if (bgCount() > OOM_THRESHOLD) oomKill();
    }, 6000);

    function oomKill() {
      const list = getList();
      if (!list.length) return;
      const victim = list[Math.floor(Math.random() * list.length)];
      if (!victim) return;
      try { hooks.onKill?.(victim.bundle, victim); } catch { }
      try { hooks.notifyOOM?.(victim.bundle); } catch { }
    }

    return {
      show, hide, flyToCard, prepareSnapshot,
      get isOpen() { return open; },
      get currentIndex() { return index; },
      get cardCount() { return entries.length; },
      refresh() { if (open) renderCards(); },
      setIndex(i) { index = Math.max(0, i); if (open) applyLayout(false); },
      oomKill,
      destroy() {
        clearInterval(oomTimer);
        hide();
        root.remove();
      },
    };
  }

  window.WujiMultitask = { create, HOLD_MS, OOM_THRESHOLD };
})();
