(() => {
  const BUNDLE = 'com.wujios.calendar';
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const pad2 = n => String(n).padStart(2, '0');

  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: '日历',
    icon: './assets/calendar.svg',
    initialRoute: 'home',
    version: '1.0.0',

    styles: `
      .cal-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        padding: calc(14px + var(--statusbar-h)) 16px
                 calc(20px + env(safe-area-inset-bottom, 0px));
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        box-sizing: border-box;
      }

      /* ---------------- 标题（左上） ---------------- */
      .cal-title {
        flex: 0 0 auto;
        align-self: flex-start;
        font-size: 22px;
        font-weight: 700;
        color: #000000;
        letter-spacing: .5px;
        margin-top: 6px;
        margin-bottom: 14px;
      }

      /* ---------------- 月份栏 ---------------- */
      .cal-bar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 2px 12px;
      }

      .cal-month {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 19px;
        font-weight: 600;
        color: #101828;
        letter-spacing: .3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-variant-numeric: tabular-nums;
      }

      .cal-today-btn {
        flex: 0 0 auto;
        padding: 6px 12px;
        border: 0;
        border-radius: 999px;
        background: #f2f5fa;
        color: #3a6ff0;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: .3px;
        cursor: pointer;
        transition: background .12s, transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .cal-today-btn:active { background: #e2e8f2; transform: scale(.96); }

      .cal-nav-btn {
        flex: 0 0 auto;
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: #f2f5fa;
        color: #101828;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
        transition: background .12s, transform .08s;
        -webkit-tap-highlight-color: transparent;
      }
      .cal-nav-btn:active { background: #e2e8f2; transform: scale(.92); }
      .cal-nav-btn svg { width: 18px; height: 18px; display: block; }

      /* ---------------- 星期行 ---------------- */
      .cal-weekdays {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 2px;
        padding: 0 2px 6px;
        font-size: 12px;
        font-weight: 600;
        color: #9aa4b8;
        letter-spacing: .3px;
        text-align: center;
      }
      .cal-weekdays span { padding: 4px 0; }
      .cal-weekdays span:first-child,
      .cal-weekdays span:last-child { color: #e0356b; }

      /* ---------------- 日期网格 ---------------- */
      .cal-grid {
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        grid-template-rows: repeat(6, minmax(0, 1fr));
        gap: 2px;
        padding: 0 2px;
      }

      .cal-day {
        border: 0;
        background: transparent;
        border-radius: 12px;
        color: #101828;
        font: inherit;
        font-size: clamp(14px, 4.2vw, 17px);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        min-width: 0;
        min-height: 0;
        transition: background .12s ease, color .12s ease, transform .08s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .cal-day:active { transform: scale(.92); }

      .cal-day.is-other {
        color: #c0c8d6;
        font-weight: 400;
      }

      .cal-day.is-today {
        color: #e0356b;
        font-weight: 700;
      }

      .cal-day.is-selected,
      .cal-day.is-selected.is-today,
      .cal-day.is-selected.is-other {
        background: #3a6ff0;
        color: #ffffff;
        font-weight: 700;
        box-shadow: 0 4px 12px rgba(58, 111, 240, .32);
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="cal-page">
              <div class="cal-title">日历</div>

              <div class="cal-bar">
                <div class="cal-month" id="calMonth">----</div>
                <button class="cal-today-btn" id="calTodayBtn" type="button">今天</button>
                <button class="cal-nav-btn" id="calPrevBtn" type="button" aria-label="上个月">
                  <svg viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.4"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 6l-6 6 6 6"/>
                  </svg>
                </button>
                <button class="cal-nav-btn" id="calNextBtn" type="button" aria-label="下个月">
                  <svg viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.4"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 6l6 6-6 6"/>
                  </svg>
                </button>
              </div>

              <div class="cal-weekdays">
                ${WEEKDAYS.map(w => `<span>${w}</span>`).join('')}
              </div>

              <div class="cal-grid" id="calGrid"></div>
            </div>
          `;
        },

        mount(root) {
          const monthEl  = root.querySelector('#calMonth');
          const gridEl   = root.querySelector('#calGrid');
          const prevBtn  = root.querySelector('#calPrevBtn');
          const nextBtn  = root.querySelector('#calNextBtn');
          const todayBtn = root.querySelector('#calTodayBtn');
          if (!monthEl || !gridEl) return;

          const today = new Date();
          const todayY = today.getFullYear();
          const todayM = today.getMonth();
          const todayD = today.getDate();

          let viewYear  = todayY;
          let viewMonth = todayM;
          let selected  = { y: todayY, m: todayM, d: todayD };

          function render() {
            monthEl.textContent = `${viewYear}年${pad2(viewMonth + 1)}月`;

            const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
            const startDate = new Date(viewYear, viewMonth, 1 - firstWeekday);

            let html = '';
            for (let i = 0; i < 42; i++) {
              const d = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate() + i
              );
              const y = d.getFullYear();
              const m = d.getMonth();
              const day = d.getDate();

              const classes = ['cal-day'];
              if (m !== viewMonth) classes.push('is-other');
              if (y === todayY && m === todayM && day === todayD) {
                classes.push('is-today');
              }
              if (selected && y === selected.y && m === selected.m && day === selected.d) {
                classes.push('is-selected');
              }

              html +=
                `<button class="${classes.join(' ')}" type="button" ` +
                `data-y="${y}" data-m="${m}" data-d="${day}">${day}</button>`;
            }
            gridEl.innerHTML = html;
          }

          function goPrev() {
            viewMonth--;
            if (viewMonth < 0) { viewMonth = 11; viewYear--; }
            render();
          }

          function goNext() {
            viewMonth++;
            if (viewMonth > 11) { viewMonth = 0; viewYear++; }
            render();
          }

          function goToday() {
            viewYear  = todayY;
            viewMonth = todayM;
            selected  = { y: todayY, m: todayM, d: todayD };
            render();
          }

          function onGridClick(e) {
            const btn = e.target.closest('.cal-day');
            if (!btn) return;

            const y = +btn.dataset.y;
            const m = +btn.dataset.m;
            const d = +btn.dataset.d;

            selected = { y, m, d };

            /* 点到相邻月份的日期，顺便翻页 */
            if (y !== viewYear || m !== viewMonth) {
              viewYear  = y;
              viewMonth = m;
            }

            render();

            if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
          }

          prevBtn?.addEventListener('click', goPrev);
          nextBtn?.addEventListener('click', goNext);
          todayBtn?.addEventListener('click', goToday);
          gridEl.addEventListener('click', onGridClick);

          render();

          return () => {
            prevBtn?.removeEventListener('click', goPrev);
            nextBtn?.removeEventListener('click', goNext);
            todayBtn?.removeEventListener('click', goToday);
            gridEl.removeEventListener('click', onGridClick);
          };
        },
      },
    },
  });
})();