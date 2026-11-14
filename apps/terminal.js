(() => {
  const BUNDLE = 'com.wujios.terminal';

  WujiApps.register({
    bundlename: BUNDLE,
    name: '终端',
    icon: './assets/terminal.svg',
    initialRoute: 'main',
    version: '1.0.0',
    devices: ['pc'],

    styles: `
      .nb-shell {
        position: absolute; inset: 0;
        background: #000; color: #fff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace;
        font-size: 13px; line-height: 1.5;
        padding: 10px 12px; box-sizing: border-box;
      }
      .nb-shell__area {
        width: 100%; height: 100%;
        background: #000; color: #fff;
        border: none; outline: none; resize: none;
        font: inherit; padding: 0; margin: 0;
        white-space: pre-wrap; word-break: break-all;
        caret-color: #fff;
      }
    `,

    routes: {
      main: {
        name: 'main',

        render() {
          return `<div class="nb-shell"><textarea class="nb-shell__area" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea></div>`;
        },

        mount(root) {
          const fs = window.WujiFileSystem;
          const fsOk = !!(fs && fs.supported);

          const ta = root.querySelector('.nb-shell__area');
          let cwd = [];                       // 当前目录（相对 fs 根）路径段数组
          const history = [];
          let hIdx = history.length;

          // committed = 已锁定的会话文本（含提示符）；inputBuffer = 当前正在输入的行
          let committed = '';
          let inputBuffer = '';
          let running = false;

          const promptStr = () => '/' + cwd.join('/') + (cwd.length ? '/' : '') + '>';
          const setCaretEnd = () => { ta.selectionStart = ta.selectionEnd = ta.value.length; };

          function out(text) {
            committed += (text == null ? '' : String(text)) + '\n';
            ta.value = committed + inputBuffer;
            setCaretEnd();
            ta.scrollTop = ta.scrollHeight;
          }
          const clearScreen = () => {
            committed = '';
            ta.value = committed + inputBuffer;
            setCaretEnd();
          };

          /* ---------- 分词器（手写，不使用 eval） ---------- */
          const unquote = (s) => {
            if (!s) return s;
            if ((s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
            return s;
          };
          function tokenize(line) {
            const tokens = []; let i = 0; const n = line.length;
            while (i < n) {
              while (i < n && /\s/.test(line[i])) i++;
              if (i >= n) break;
              const q = line[i];
              if (q === '"' || q === "'") {
                i++; let buf = '';
                while (i < n && line[i] !== q) { buf += line[i]; i++; }
                i++; tokens.push(buf);
              } else {
                let buf = '';
                while (i < n && !/\s/.test(line[i])) { buf += line[i]; i++; }
                tokens.push(buf);
              }
            }
            return tokens;
          }

          const fmtSize = (b) => {
            b = b || 0;
            if (b >= 1048576) return (b / 1048576).toFixed(1) + 'MB';
            if (b >= 1024) return Math.round(b / 1024) + 'KB';
            return b + 'B';
          };
          const buildPath = (input) => (input.startsWith('/') ? [] : cwd.slice()).concat(input.split('/').filter(p => p !== ''));

          async function resolveForCd(input) {
            let base = input.startsWith('/') ? [] : cwd.slice();
            for (const part of input.split('/').filter(p => p !== '')) {
              if (part === '.') continue;
              if (part === '..') { if (base.length) base.pop(); continue; }
              const e = (await fs.list(base)).find(x => x.name === part);
              if (!e) throw new Error(`未找到文件夹:"${part}"`);
              if (e.kind !== 'dir') throw new Error(`"${part}" 不是文件夹`);
              base = base.concat(part);
            }
            return base;
          }
          async function findEntry(path) {
            const entries = await fs.list(path.slice(0, -1));
            return entries.find(x => x.name === path[path.length - 1]) || null;
          }

          /* ---------- 命令 ---------- */
          async function cmdCd(args) {
            const arg = (args[0] || '').trim();
            if (!arg) return out('用法: cd <目录>');
            cwd = await resolveForCd(arg);
          }
          async function cmdDir() {
            if (!fsOk) return out('文件系统不可用 (当前环境不支持 OPFS)');
            const entries = await fs.list(cwd);
            if (!entries.length) return out('(空)');
            for (const e of entries) out(e.name.padEnd(14) + (e.kind === 'dir' ? 'dir' : fmtSize(e.size)));
          }
          async function cmdMkdir(arg) {
            const name = unquote(arg || '');
            if (!name) return out('用法: mkdir <文件夹名>');
            if (!fsOk) return out('文件系统不可用 (当前环境不支持 OPFS)');
            const path = buildPath(name);
            if ((await fs.list(path.slice(0, -1))).find(x => x.name === path[path.length - 1]))
              return out(`文件夹已存在:"${path[path.length - 1]}"`);
            await fs.mkdir(path.slice(0, -1), path[path.length - 1]);
            out(`创建文件夹: /${path.join('/')}`);
          }
          async function cmdDel(arg) {
            const name = unquote(arg || '');
            if (!name) return out('用法: del <文件名>');
            if (!fsOk) return out('文件系统不可用 (当前环境不支持 OPFS)');
            const path = buildPath(name);
            const e = await findEntry(path);
            if (!e) return out(`未找到文件:"${path[path.length - 1]}"`);
            if (e.kind === 'dir') return out(`"${path[path.length - 1]}" 是文件夹，请使用 rmdir`);
            await fs.remove(path);
            out(`删除文件: /${path.join('/')}`);
          }
          async function cmdRmdir(arg) {
            const name = unquote(arg || '');
            if (!name) return out('用法: rmdir <文件夹名>');
            if (!fsOk) return out('文件系统不可用 (当前环境不支持 OPFS)');
            const path = buildPath(name);
            const e = await findEntry(path);
            if (!e) return out(`未找到文件夹:"${path[path.length - 1]}"`);
            if (e.kind !== 'dir') return out(`"${path[path.length - 1]}" 是文件，请使用 del`);
            await fs.remove(path);
            out(`删除文件夹: /${path.join('/')}`);
          }
          async function cmdRename(a, b) {
            const oldN = unquote(a || ''), newN = unquote(b || '');
            if (!oldN || !newN) return out('用法: rename <旧名> <新名>');
            if (!fsOk) return out('文件系统不可用 (当前环境不支持 OPFS)');
            const path = buildPath(oldN);
            if (!(await findEntry(path))) return out(`未找到:"${path[path.length - 1]}"`);
            await fs.rename(path, newN);
            out(`已重命名: /${path.join('/')} -> ${newN}`);
          }
          async function cmdTouch(arg) {
            const name = unquote(arg || '');
            if (!name) return out('用法: touch <文件>');
            if (!fsOk) return out('文件系统不可用 (当前环境不支持 OPFS)');
            const path = buildPath(name);
            if (await findEntry(path)) return out('文件已存在');
            try { await fs.add(path.slice(0, -1), new File([], path[path.length - 1])); out(`已创建: /${path.join('/')}`); }
            catch (e) { out('创建失败: ' + e.message); }
          }
          async function cmdCat(arg) {
            const name = unquote(arg || '');
            if (!name) return out('用法: cat <文件>');
            if (!fsOk) return out('文件系统不可用 (当前环境不支持 OPFS)');
            const path = buildPath(name);
            const e = await findEntry(path);
            if (!e) return out(`未找到文件:"${path[path.length - 1]}"`);
            if (e.kind === 'dir') return out(`"${path[path.length - 1]}" 是文件夹`);
            try {
              const obj = await fs.read(path);
              const text = (obj && typeof obj.text === 'function') ? await obj.text() : (obj && obj.text != null ? obj.text : String(obj));
              out(text);
            } catch (err) { out('读取失败: ' + err.message); }
          }
          async function cmdFind(arg) {
            const name = unquote(arg || '');
            if (!name) return out('用法: find <名称>');
            if (!fsOk) return out('文件系统不可用 (当前环境不支持 OPFS)');
            const results = [];
            async function walk(p) {
              for (const e of await fs.list(p)) {
                const full = p.concat(e.name);
                if (e.name.toLowerCase().includes(name.toLowerCase())) results.push('/' + full.join('/'));
                if (e.kind === 'dir') await walk(full);
              }
            }
            await walk(cwd.slice());
            if (!results.length) return out('未找到匹配');
            results.forEach(r => out(r));
          }

          function cmdWhoami() { out('root@zhuzios'); }
          function cmdVer() { out('ZhuziOS NiubeeShell 1.0.0'); }
          function cmdDate() { out(new Date().toLocaleString()); }

          function cmdTasklist() {
            const list = (window.WujiWindows?.list?.() || []);
            if (!list.length) return out('没有正在运行的应用');
            for (const w of list) {
              const app = window.WujiApps?.get?.(w.bundle);
              out(`${String(w.id).padEnd(6)} ${w.bundle.padEnd(22)} ${(app && app.name) || w.bundle}`);
            }
          }
          function cmdTaskkill(arg) {
            const t = unquote(arg || '');
            if (!t) return out('用法: taskkill <PID|包名>');
            const list = (window.WujiWindows?.list?.() || []);
            const pid = parseInt(t, 10);
            const w = isNaN(pid) ? list.find(x => x.bundle === t && x.bundle !== BUNDLE) : list.find(x => x.id === pid);
            if (!w) return out(`未找到运行中的应用:"${t}"`);
            try { WujiWindows.close(w); } catch { }
            out(`已停止: ${w.bundle}`);
          }
          function cmdExit() {
            const w = (window.WujiWindows?.list?.() || []).find(x => x.bundle === BUNDLE);
            if (w) { try { WujiWindows.close(w); } catch { } }
            else if (typeof WujiAppLauncher?.close === 'function') WujiAppLauncher.close();
          }

          // 手写四则运算求值器（不使用 eval）
          function calcEval(expr) {
            let i = 0; const s = expr;
            const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
            const num = () => { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; const n = parseFloat(s.slice(i, j)); i = j; return n; };
            const factor = () => {
              ws();
              if (s[i] === '-') { i++; return -factor(); }
              if (s[i] === '(') { i++; const v = exprFn(); ws(); if (s[i] === ')') i++; return v; }
              return num();
            };
            const term = () => {
              let v = factor(); ws();
              while (s[i] === '*' || s[i] === '/') { const op = s[i++]; ws(); const r = factor(); v = op === '*' ? v * r : v / r; }
              return v;
            };
            const exprFn = () => {
              let v = term(); ws();
              while (s[i] === '+' || s[i] === '-') { const op = s[i++]; ws(); const r = term(); v = op === '+' ? v + r : v - r; }
              return v;
            };
            ws(); const r = exprFn(); ws();
            if (i < s.length) throw new Error('无法解析的字符: ' + s[i]);
            return r;
          }
          function cmdCalc(args) {
            const e = args.join(' ');
            if (!e) return out('用法: calc <表达式>  例如 calc 1+2*3');
            try { out(String(calcEval(e))); } catch (err) { out('calc: ' + err.message); }
          }

          async function cmdBm(args) {
            const sub = (args[0] || '').toLowerCase();
            const bundle = unquote(args[1] || '');
            if (!sub) return out('用法: bm open|force-stop|uninstall <包名>');
            if (sub === 'open') {
              if (!bundle) return out('用法: bm open <包名>');
              if (window.WujiApps && !WujiApps.has(bundle)) return out(`未找到应用:"${bundle}"`);
              if (typeof WujiAppLauncher?.open === 'function') WujiAppLauncher.open(bundle);
              out(`打开应用: ${bundle}`);
            } else if (sub === 'force-stop') {
              if (!bundle) return out('用法: bm force-stop <包名>');
              const w = (window.WujiWindows?.list?.() || []).find(x => x.bundle === bundle && x.bundle !== BUNDLE);
              if (!w) return out(`未找到运行中的应用:"${bundle}"`);
              try { WujiWindows.close(w); } catch { }
              out(`已停止: ${bundle}`);
            } else if (sub === 'uninstall') {
              if (!bundle) return out('用法: bm uninstall <包名>');
              if (!window.WujiApps || !WujiApps.has(bundle)) return out(`未找到应用:"${bundle}"`);
              if (!WujiApps.isInstalled(bundle)) return out(`系统应用无法卸载: ${bundle}`);
              if (typeof WujiAppInstaller?.uninstall !== 'function') return out('bm: 无法卸载');
              await WujiAppInstaller.uninstall(bundle);
              out(`已卸载: ${bundle}`);
            } else out(`未知 bm 子命令: ${sub}`);
          }

          function cmdHelp() {
            [
              '文件: cd cd.. dir/ls mkdir del rmdir rename touch cat/type find',
              '进程: tasklist taskkill <PID|包名> bm open/force-stop/uninstall exit',
              '系统: echo cls/clear help ver whoami date',
              '计算: calc <表达式>   例如  calc (1+2)*3/4',
              '提示: 路径支持单/双引号，以及相对或绝对(/开头)路径',
            ].forEach(out);
          }

          async function run(line) {
            const tokens = tokenize(line);
            if (!tokens.length) return;
            const cmd = tokens[0].toLowerCase();
            const args = tokens.slice(1);
            switch (cmd) {
              case 'cd':        await cmdCd(args); break;
              case 'cd..':      await cmdCd(['..']); break;
              case 'dir': case 'ls': await cmdDir(); break;
              case 'mkdir':     await cmdMkdir(args[0]); break;
              case 'del':       await cmdDel(args[0]); break;
              case 'rmdir':     await cmdRmdir(args[0]); break;
              case 'rename':    await cmdRename(args[0], args[1]); break;
              case 'touch':     await cmdTouch(args[0]); break;
              case 'cat': case 'type': await cmdCat(args[0]); break;
              case 'find':      await cmdFind(args[0]); break;
              case 'whoami':    cmdWhoami(); break;
              case 'ver': case 'version': cmdVer(); break;
              case 'date': case 'time': cmdDate(); break;
              case 'tasklist':  cmdTasklist(); break;
              case 'taskkill':  cmdTaskkill(args[0]); break;
              case 'exit': case 'quit': cmdExit(); break;
              case 'calc':      cmdCalc(args); break;
              case 'echo':      out(args.join(' ')); break;
              case 'cls': case 'clear': clearScreen(); break;
              case 'help': case '?': cmdHelp(); break;
              case 'bm':        await cmdBm(args); break;
              default: out(`'${cmd}' 不是内部或外部命令，也不是可运行的应用。`);
            }
          }

          /* ---------- 启动 ---------- */
          const refresh = () => { ta.value = committed + inputBuffer; setCaretEnd(); ta.scrollTop = ta.scrollHeight; };

          committed = 'ZhuziOS NiubeeShell 1.0.0\n输入"help"以获取帮助\n' + promptStr();
          inputBuffer = '';
          refresh();
          ta.focus();

          // 保持输入缓冲与文本框一致：把任意输入都视为末尾的当前行
          ta.addEventListener('input', () => {
            if (running) { refresh(); return; }   // 命令执行期间丢弃输入
            inputBuffer = ta.value.slice(committed.length);
            // 若用户删到已锁定区域之前，则截断为只保留锁定部分
            if (!ta.value.startsWith(committed)) { inputBuffer = ''; refresh(); }
          });

          ta.addEventListener('keydown', (e) => {
            if (running) { e.preventDefault(); return; }
            if (e.key === 'Enter') {
              e.preventDefault();
              const line = inputBuffer;
              inputBuffer = '';
              committed += line + '\n';           // 已输入的命令行锁定
              if (line.trim()) { history.push(line); }
              hIdx = history.length;
              running = true;
              (async () => {
                try {
                  await run(line);
                } catch (err) { out('错误: ' + (err && err.message ? err.message : err)); }
                finally {
                  committed += promptStr();
                  inputBuffer = '';
                  running = false;
                  refresh();
                  ta.focus();
                }
              })();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (hIdx > 0) { hIdx--; inputBuffer = history[hIdx] || ''; refresh(); }
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (hIdx < history.length - 1) { hIdx++; inputBuffer = history[hIdx] || ''; refresh(); }
              else { hIdx = history.length; inputBuffer = ''; refresh(); }
            }
          });

          root.addEventListener('mousedown', (e) => { if (e.target !== ta) setTimeout(() => ta.focus(), 0); });

          // 焦点恢复：本窗口仍是系统聚焦窗口时，若文本框意外失焦则夺回焦点，
          // 解决执行异步命令期间焦点被抢、结束后无法输入的问题。
          const reclaimFocus = () => {
            const winEl = ta.closest('.pc-win');
            if (winEl && winEl.classList.contains('is-focused') && document.activeElement !== ta) {
              ta.focus();
            }
          };
          ta.addEventListener('focusout', () => { setTimeout(reclaimFocus, 0); requestAnimationFrame(reclaimFocus); });
        },
      },
    },
  });
})();
