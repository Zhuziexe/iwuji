(() => {
  WujiApps.register({
    bundlename: 'com.wujios.clock',
    name: '时钟',
    icon: './assets/clock.svg',
    initialRoute: 'home',

    styles: `
      .clock-page {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: var(--wj-bg);
        padding: calc(var(--wj-pad) + var(--statusbar-h)) 20px 24px;
      }

      .clock-title {
        flex: 0 0 auto;
        align-self: flex-start;
        font-size: 22px;
        font-weight: 700;
        color: var(--wj-text);
        letter-spacing: .5px;
        margin-bottom: 4px;
      }

      .clock-stage {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .clock-dial {
        width: min(76vw, 300px);
        height: min(76vw, 300px);
        display: block;
      }

      .clock-time {
        flex: 0 0 auto;
        margin-top: 20px;
        font-family: 'Consolas', 'SF Mono', monospace;
        font-size: 32px;
        font-weight: 600;
        letter-spacing: 2px;
        font-variant-numeric: tabular-nums;
        color: var(--wj-text);
      }
    `,

    routes: {
      home: {
        name: 'home',

        render() {
          return `
            <div class="clock-page">
              <div class="clock-title">时钟</div>

              <div class="clock-stage">
                <svg class="clock-dial" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="94"
                          fill="#ffffff" stroke="#e3e9f2" stroke-width="2"/>

                  <g id="clockTicks" stroke="#c8d2e0"></g>

                  <g id="clockNumbers"
                     fill="#1c2536"
                     font-size="14"
                     font-weight="600"
                     text-anchor="middle"
                     dominant-baseline="central"
                     font-family="var(--wj-font, sans-serif)"></g>

                  <line id="clockHour"
                        x1="100" y1="100" x2="100" y2="52"
                        stroke="#1c2536" stroke-width="5.5" stroke-linecap="round"/>

                  <line id="clockMinute"
                        x1="100" y1="100" x2="100" y2="34"
                        stroke="#1c2536" stroke-width="3.2" stroke-linecap="round"/>

                  <line id="clockSecond"
                        x1="100" y1="108" x2="100" y2="24"
                        stroke="#e0356b" stroke-width="1.6" stroke-linecap="round"/>

                  <circle cx="100" cy="100" r="4.5" fill="#1c2536"/>
                  <circle cx="100" cy="100" r="1.8" fill="#ffffff"/>
                </svg>
              </div>

              <div class="clock-time" id="clockTime">00:00:00</div>
            </div>
          `;
        },

        mount(root) {
          const hourEl  = root.querySelector('#clockHour');
          const minEl   = root.querySelector('#clockMinute');
          const secEl   = root.querySelector('#clockSecond');
          const timeEl  = root.querySelector('#clockTime');
          const ticksG  = root.querySelector('#clockTicks');
          const numsG   = root.querySelector('#clockNumbers');

          /* ---------- 生成刻度 ---------- */
          let ticks = '';
          for (let i = 0; i < 60; i++) {
            const angle = i * 6;
            const isHour = i % 5 === 0;
            const r1 = isHour ? 84 : 88;
            const r2 = 92;
            const rad = (angle - 90) * Math.PI / 180;
            const x1 = (100 + Math.cos(rad) * r1).toFixed(2);
            const y1 = (100 + Math.sin(rad) * r1).toFixed(2);
            const x2 = (100 + Math.cos(rad) * r2).toFixed(2);
            const y2 = (100 + Math.sin(rad) * r2).toFixed(2);
            ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ` +
                     `stroke-width="${isHour ? 2.4 : 1.2}" stroke-linecap="round"/>`;
          }
          ticksG.innerHTML = ticks;

          /* ---------- 生成数字 ---------- */
          let nums = '';
          for (let i = 1; i <= 12; i++) {
            const rad = (i * 30 - 90) * Math.PI / 180;
            const x = (100 + Math.cos(rad) * 70).toFixed(2);
            const y = (100 + Math.sin(rad) * 70).toFixed(2);
            nums += `<text x="${x}" y="${y}">${i}</text>`;
          }
          numsG.innerHTML = nums;

          /* ---------- 更新 ---------- */
          const pad = n => String(n).padStart(2, '0');

          function tick() {
            if (!root.isConnected) return;

            const d  = new Date();
            const h  = d.getHours() % 12;
            const m  = d.getMinutes();
            const s  = d.getSeconds();

            const hourAngle = h * 30 + m * 0.5 + s * (0.5 / 60);
            const minAngle  = m * 6  + s * 0.1;
            const secAngle  = s * 6;

            hourEl.setAttribute('transform', `rotate(${hourAngle} 100 100)`);
            minEl .setAttribute('transform', `rotate(${minAngle}  100 100)`);
            secEl .setAttribute('transform', `rotate(${secAngle}  100 100)`);

            timeEl.textContent =
              `${pad(d.getHours())}:${pad(m)}:${pad(s)}`;
          }

          let intervalTimer = null;
          let alignTimer    = null;

          /* 启动时对齐到下一个整秒，之后每秒一次 */
          tick();
          const now = new Date();
          alignTimer = setTimeout(() => {
            alignTimer = null;
            if (!root.isConnected) return;
            tick();
            intervalTimer = setInterval(tick, 1000);
          }, 1000 - now.getMilliseconds());

          this._cleanup = () => {
            if (alignTimer)    { clearTimeout(alignTimer);    alignTimer = null; }
            if (intervalTimer) { clearInterval(intervalTimer); intervalTimer = null; }
          };
        },

        unmount() {
          this._cleanup?.();
          this._cleanup = null;
        },
      },
    },
  });
})();