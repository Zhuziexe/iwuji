/* =========================================================
   claude-mario.js —— 《Claude 大冒险》WujiOS 移植版

   来源：claude-mario.html（独立 12 关平台跳跃小游戏）
   接入：两个 route —— home（选关）用 ctx.push('game', {level}) 打开游戏；
         game（canvas 关卡）由框架返回手势/按钮 pop 回 home，故不再放「回家」按钮。
         全部逻辑/状态包在 createGame(root) 闭包内，mount 返回 dispose，
         卸载时统一收尾 rAF、键盘/指针监听、触摸监听、计时器与 AudioContext。

   ★ 修复「Claude 一直抖」：
     原版 resolveY() 落地探测用 e.y + e.h - 1。角色静止站在地砖上沿时
     feet 恰好等于 ty*T（如 644 = 14*46）；重力推进 ~1px 后 bottom=feet-1
     落在上一行(空行 13)，地面被漏检 → 下沉一帧；下一帧又踩到 row 14 被
     拉回 → 每帧上下 2~3px 反复弹跳，站着/走著都「一直抖」。
     改用「脚底」e.y + e.h 作为探测点，落地当帧即吸附且每帧幂等，彻底静止。
     另附加固：camX 取整、Claude 绘制坐标取整、canvas 关闭平滑。

   ★ 修复「洞下面也是棕色」：
     原版 drawBackground 用一整条棕色泥土 fillRect 铺满地面以下全部宽度，
     深坑(gap)列下方也是棕色，看起来像被填平了。改为逐列判断：有地砖的
     列才画棕色泥土，深坑列画向下的深色虚空，让洞看起来真的是洞。
   ========================================================= */
(() => {
  'use strict';

  const BUNDLE = 'com.wujinb.claudemario';

  /* ===================== 角色贴图（真实 SVG，逐字复制自原 HTML） ===================== */
  const CLAUDE_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+DQogIDx0aXRsZT5DbGF1ZGUgQ29kZTwvdGl0bGU+DQogIDxwYXRoIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTIwLjk5OCAxMC45NDlIMjR2My4xMDJoLTN2My4wMjhoLTEuNDg3VjIwSDE4di0yLjkyMWgtMS40ODdWMjBIMTV2LTIuOTIxSDlWMjBINy40ODh2LTIuOTIxSDZWMjBINC40ODd2LTIuOTIxSDNWMTQuMDVIMFYxMC45NWgzVjVoMTcuOTk4djUuOTQ5ek02IDEwLjk0OWgxLjQ4OFY4LjEwMkg2djIuODQ3em0xMC41MSAwSDE4VjguMTAyaC0xLjQ5djIuODQ3eiIgZmlsbD0iI0Q5Nzc1NyIgZmlsbC1ydWxlPSJldmVub2RkIiAvPg0KPC9zdmc+";
  const DEEPSEEK_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHNoYXBlLXJlbmRlcmluZz0iZ2VvbWV0cmljUHJlY2lzaW9uIiB0ZXh0LXJlbmRlcmluZz0iZ2VvbWV0cmljUHJlY2lzaW9uIiBpbWFnZS1yZW5kZXJpbmc9Im9wdGltaXplUXVhbGl0eSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCA1MTIgNTA5LjY0Ij48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTE1LjYxMiAwaDI4MC43NzVDNDU5Ljk3NCAwIDUxMiA1Mi4wMjYgNTEyIDExNS42MTJ2Mjc4LjQxNWMwIDYzLjU4Ny01Mi4wMjYgMTE1LjYxMy0xMTUuNjEzIDExNS42MTNIMTE1LjYxMkM1Mi4wMjYgNTA5LjY0IDAgNDU3LjYxNCAwIDM5NC4wMjdWMTE1LjYxMkMwIDUyLjAyNiA1Mi4wMjYgMCAxMTUuNjEyIDB6Ii8+PHBhdGggZmlsbD0iIzRENkJGRSIgZmlsbC1ydWxlPSJub256ZXJvIiBkPSJNNDQwLjg5OCAxMzkuMTY3Yy00LjAwMS0xLjk2MS01LjcyMyAxLjc3Ni04LjA2MiAzLjY3My0uODAxLjYxMi0xLjQ3OSAxLjQwNy0yLjE1NCAyLjE0MS01Ljg0OCA2LjI0Ni0xMi42ODEgMTAuMzQ5LTIxLjYwNyA5Ljg1OS0xMy4wNDgtLjczNC0yNC4xOTIgMy4zNjgtMzQuMDQgMTMuMzQ4LTIuMDkzLTEyLjMwNy05LjA0OC0xOS42NTgtMTkuNjM1LTI0LjM3LTUuNTQtMi40NDktMTEuMTQxLTQuOS0xNS4wMi0xMC4yMjctMi43MDgtMy43OTUtMy40NDctOC4wMjEtNC44MDEtMTIuMTg1LS44NjEtMi41MDktMS43MjUtNS4wODItNC42MTgtNS41MTItMy4xMzktLjQ5LTQuMzcyIDIuMTQyLTUuNjAxIDQuMzQ5LTQuOTI1IDkuMDAyLTYuODMzIDE4LjkyMS02LjY0NyAyOC45NjIuNDMyIDIyLjU5NyA5Ljk3MiA0MC41OTcgMjguOTMyIDUzLjM5NyAyLjE1NCAxLjQ3IDIuNzA3IDIuOTM5IDIuMDMyIDUuMDgyLTEuMjkzIDQuNDEtMi44MzIgOC42OTUtNC4xODYgMTMuMTA1LS44NjIgMi44MTctMi4xNTcgMy40MjktNS4xNzIgMi4yMDUtMTAuNDAyLTQuMzQ2LTE5LjM5MS0xMC43NzgtMjcuMzMyLTE4LjU1My0xMy40ODEtMTMuMDQ0LTI1LjY2OC0yNy40MzQtNDAuODczLTM4LjcwMmExNzcuNjE0IDE3Ny42MTQgMCAwMC0xMC44MzQtNy40MDljLTE1LjUxMi0xNS4wNjMgMi4wMzItMjcuNDM0IDYuMDk0LTI4LjkwMiA0LjI0Ny0xLjUzMiAxLjQ3OC02Ljc5Ny0xMi4yNTEtNi43MzYtMTMuNzI3LjA2MS0yNi4yODUgNC42NTMtNDIuMjg4IDEwLjc3Ny0yLjM0LjkyLTQuODAxIDEuNTkzLTcuMzI2IDIuMTQyLTE0LjUyNy0yLjc1Ni0yOS42MDgtMy4zNjgtNDUuMzY3LTEuNTkzLTI5LjY3MSAzLjMwNS01My4zNjggMTcuMzI5LTcwLjc4OCA0MS4yNzItMjAuOTI4IDI4Ljc4NS0yNS44NTQgNjEuNDgyLTE5LjgyMSA5NS41OSA2LjM0IDM1Ljk0MyAyNC42ODMgNjUuNzA0IDUyLjg3NiA4OC45NzQgMjkuMjM5IDI0LjEyMyA2Mi45MTEgMzUuOTQzIDEwMS4zMiAzMy42NzcgMjMuMzI5LTEuMzQ2IDQ5LjMwNy00LjQ2OCA3OC42MDctMjkuMjcgNy4zODcgMy42NzMgMTUuMTQyIDUuMTQ0IDI4LjAwOCA2LjI0NiA5LjkxMS45MiAxOS40NTItLjQ5IDI2LjgzOS0yLjAxOSAxMS41NzMtMi40NDkgMTAuNzczLTEzLjE2NiA2LjU4Ni0xNS4xMjQtMzMuOTE1LTE1Ljc5Ny0yNi40Ny05LjM2OC0zMy4yNC0xNC41NzMgMTcuMjM1LTIwLjM5IDQzLjIxMy00MS41NzcgNTMuMzY5LTExMC4yMjIuOC01LjQ0OC4xMjEtOC44NzcgMC0xMy4yODctLjA2MS0yLjY5Mi41NTMtMy43MzQgMy42MzItNC4wNDEgOC40OTQtLjk4MSAxNi43NDItMy4zMDUgMjQuMzE0LTcuNDcxIDIxLjk3NS0xMi4wMDIgMzAuODQtMzEuNzE5IDMyLjkzMy01NS4zNTUuMzA3LTMuNjEyLS4wNjEtNy4zNDgtMy44NzktOS4yNDV2LS4wMDN6TTI0OS40IDM1MS44OWMtMzIuODcyLTI1LjgzOC00OC44MTQtMzQuMzUyLTU1LjQtMzMuOTg0LTYuMTU1LjM2OC01LjA0OCA3LjQxLTMuNjk0IDEyLjAwMiAxLjQxNSA0LjUzMiAzLjI2NCA3LjY1NCA1Ljg0OCAxMS42MzQgMS43ODUgMi42MzQgMy4wMTcgNi41NTEtMS43ODQgOS40OTMtMTAuNTg3IDYuNTUtMjguOTkzLTIuMjA1LTI5Ljg1Ni0yLjYzNS0yMS40MjEtMTIuNjE0LTM5LjMzNC0yOS4yNjktNTEuOTU0LTUyLjA0Ny0xMi4xODctMjEuOTI0LTE5LjI2Ny00NS40MzUtMjAuNDM1LTcwLjU0Mi0uMzA4LTYuMDYxIDEuNDc4LTguMjA3IDcuNTA5LTkuMzA3IDcuOTQtMS40NzEgMTYuMTI3LTEuNzc4IDI0LjA2OC0uNjE1IDMzLjU0NyA0LjkgNjIuMTA4IDE5LjkwMiA4Ni4wNTQgNDMuNjYgMTMuNjY2IDEzLjUzMSAyNC4wMDcgMjkuNjk5IDM0LjY1OCA0NS40OTYgMTEuMzI2IDE2Ljc3OCAyMy41MTQgMzIuNzYxIDM5LjAyNiA0NS44NjUgNS40NzkgNC41OTIgOS44NDggOC4wODMgMTQuMDM1IDEwLjY1Ni0xMi42MiAxLjQwNy0zMy42NzMgMS43MTQtNDguMDc1LTkuNjc2em0xNS44OTktMTAyLjUxOWMuNTIxLTIuMTExIDIuNDIxLTMuNjU4IDQuNzIyLTMuNjU4YTQuNzQgNC43NCAwIDAxMS42NjEuMzA1Yy42NzguMjQ2IDEuMjkzLjYxNCAxLjc4NiAxLjE2My44NjEuODU5IDEuMzU0IDIuMDgzIDEuMzU0IDMuMzY4IDAgMi42OTUtMi4xNTQgNC44MzctNC44NjIgNC44MzdhNC43NDggNC43NDggMCAwMS00LjczOC00LjAzNCA1LjAxIDUuMDEgMCAwMS4wNzctMS45ODF6bTQ3LjIwOCAyNi45MTVjLTIuNjA2Ljk5Ni01LjIgMS43NzgtNy43MDcgMS44OC00LjY3OS4yNDQtOS43ODctMS42NTQtMTIuNTU2LTMuOTgxLTQuMzA4LTMuNjEyLTcuMzg2LTUuNjMxLTguNjc5LTExLjk0MS0uNTU0LTIuNjk1LS4yNDctNi44NTguMjQ2LTkuMjQ2IDEuMTA4LTUuMTQ0LS4xMjQtOC40NTEtMy43NTQtMTEuNDUxLTIuOTU0LTIuNDQ5LTYuNzExLTMuMTIyLTEwLjgzNC0zLjEyMi0xLjUzOSAwLTIuOTU0LS42NzMtNC4wMDEtMS4yMjQtMS43MjQtLjg1Ni0zLjEzOS0zLTEuNzg1LTUuNjM0LjQzMi0uODU2IDIuNTI1LTIuOTM5IDMuMDE4LTMuMzA1IDUuNi0zLjE4NSAxMi4wNjUtMi4xNDQgMTguMDM0LjI0NCA1LjU0IDIuMjY2IDkuNzI3IDYuNDI5IDE1Ljc1OSAxMi4zMDcgNi4xNTUgNy4xMDIgNy4yNjMgOS4wNjMgMTAuNzczIDE0LjM5IDIuNzcxIDQuMTYzIDUuMjk0IDguNDUxIDcuMDE4IDEzLjM0OC44NzcgMi41NjEuMDcxIDQuNzQtMi4zNDEgNi4yNzctLjk4MS42MjUtMi4xMDkgMS4wNDQtMy4xOTEgMS40NTh6Ii8+PC9zdmc+";

  /* Canvas 同款 Claude 标记（与 imgClaude 完全同一 path / #D97757），用于标题左侧 */
  const CLAUDE_MARK = `<svg class="cm-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" fill="#D97757" fill-rule="evenodd" clip-rule="evenodd"/></svg>`;

  /* ===================== 关卡数据（逐字复制） ===================== */
  const LEVELS = [
    {name:"1-1 初入代码谷", w:40, gaps:[], plats:[], poop:[[22,14]], deep:[],
      coins:[[7,12],[8,12],[9,12],[15,11],[16,11],[28,12],[29,12]],
      blocks:[[12,11,'?'],[13,11,'?']], startX:2, goalX:37},

    {name:"1-2 初遇粑粑", w:44, gaps:[[19,20]], plats:[[34,12,4]], poop:[[10,14]], deep:[[27,14]],
      coins:[[6,12],[7,12],[24,12],[25,12],[35,11],[36,11],[37,11]],
      blocks:[[14,11,'?']], startX:2, goalX:41},

    {name:"1-3 深坑跳跃", w:48, gaps:[[15,16],[31,32]], plats:[[18,12,3],[34,12,4]],
      poop:[[8,14],[22,14],[40,14]], deep:[[26,14]],
      coins:[[9,12],[10,12],[19,11],[20,11],[35,11],[36,11],[44,12]],
      blocks:[[12,11,'?'],[13,11,'?']], startX:2, goalX:45},

    {name:"2-1 双怪出击", w:52, gaps:[[13,14],[25,26],[39,40]], plats:[[16,12,3],[28,12,3],[42,12,4]],
      poop:[[8,14],[20,14],[34,14],[46,14]], deep:[[30,14],[44,14]],
      coins:[[9,12],[17,11],[29,11],[43,11],[47,12]],
      blocks:[[10,11,'?'],[22,11,'?']], startX:2, goalX:49},

    {name:"2-2 平台迷宫", w:56, gaps:[[11,12],[21,22],[33,34],[45,46]],
      plats:[[14,12,3],[24,12,3],[36,12,3],[48,12,4]],
      poop:[[6,14],[18,14],[28,14],[38,14],[50,14]], deep:[[26,14],[42,14]],
      coins:[[15,11],[25,11],[37,11],[49,11],[51,12]],
      blocks:[[8,11,'?'],[30,11,'?']], startX:2, goalX:53},

    {name:"2-3 粑粑军团", w:60, gaps:[[13,14],[23,24],[35,36],[47,48],[55,56]],
      plats:[[16,12,3],[26,12,3],[38,12,3],[50,12,4]],
      poop:[[8,14],[18,14],[30,14],[40,14],[52,14]], deep:[[28,14],[44,14],[58,14]],
      coins:[[17,11],[27,11],[39,11],[51,11],[55,12]],
      blocks:[[10,11,'?'],[32,11,'?']], startX:2, goalX:57},

    {name:"3-1 高层栈道", w:58, gaps:[[13,14],[27,28],[41,42]],
      plats:[[16,12,3],[20,10,3],[30,12,3],[44,12,3],[48,10,3]],
      poop:[[8,14],[22,14],[36,14],[52,14]], deep:[[34,14],[50,14]],
      coins:[[17,11],[21,9],[31,11],[45,11],[49,9],[53,12]],
      blocks:[[10,11,'?'],[38,11,'?']], startX:2, goalX:55},

    {name:"3-2 深蓝突袭", w:62, gaps:[[11,12],[23,24],[35,36],[49,50]],
      plats:[[14,12,3],[26,12,3],[38,12,3],[52,12,4]],
      poop:[[7,14],[18,14],[30,14],[42,14],[54,14]], deep:[[16,14],[28,14],[40,14],[46,14],[58,14]],
      coins:[[15,11],[27,11],[39,11],[53,11],[56,12]],
      blocks:[[12,11,'?'],[32,11,'?'],[44,11,'?']], startX:2, goalX:59},

    {name:"3-3 峡谷飞跃", w:64, gaps:[[13,14],[25,26],[37,38],[49,50],[59,60]],
      plats:[[16,12,3],[28,12,3],[40,12,3],[52,12,3],[56,10,3]],
      poop:[[8,14],[20,14],[32,14],[44,14],[54,14]], deep:[[18,14],[30,14],[42,14],[50,14],[62,14]],
      coins:[[17,11],[29,11],[41,11],[53,11],[57,9],[60,12]],
      blocks:[[10,11,'?'],[34,11,'?'],[46,11,'?']], startX:2, goalX:61},

    {name:"4-1 怪潮汹涌", w:66, gaps:[[13,14],[25,26],[37,38],[51,52],[61,62]],
      plats:[[16,12,3],[28,12,3],[40,12,3],[44,10,3],[54,12,3]],
      poop:[[8,14],[20,14],[32,14],[46,14],[56,14],[64,14]], deep:[[18,14],[30,14],[42,14],[48,14],[58,14]],
      coins:[[17,11],[29,11],[41,11],[45,9],[55,11],[62,12]],
      blocks:[[10,11,'?'],[34,11,'?'],[52,11,'?']], startX:2, goalX:63},

    {name:"4-2 天梯云桥", w:68, gaps:[[15,16],[29,30],[43,44],[57,58]],
      plats:[[18,12,3],[22,10,3],[32,12,3],[36,10,3],[46,12,3],[50,10,3],[60,12,4]],
      poop:[[9,14],[24,14],[38,14],[52,14],[64,14]], deep:[[20,14],[34,14],[48,14],[54,14],[62,14],[66,14]],
      coins:[[19,11],[23,9],[33,11],[37,9],[47,11],[51,9],[61,11],[65,12]],
      blocks:[[12,11,'?'],[40,11,'?'],[54,11,'?']], startX:2, goalX:65},

    {name:"4-3 终焉之殿", w:72, gaps:[[13,14],[27,28],[41,42],[55,56],[65,66]],
      plats:[[16,12,3],[20,10,3],[30,12,3],[34,10,3],[44,12,3],[48,10,3],[58,12,3],[62,10,3],[68,12,3]],
      poop:[[8,14],[22,14],[36,14],[50,14],[58,14],[70,14]],
      deep:[[18,14],[32,14],[46,14],[54,14],[60,14],[68,14],[71,14]],
      coins:[[17,11],[21,9],[31,11],[35,9],[45,11],[49,9],[59,11],[63,9],[69,11]],
      blocks:[[10,11,'?'],[38,11,'?'],[52,11,'?'],[66,11,'?']], startX:2, goalX:69}
  ];

  /* ===================== 样式（注入在本 app 的 shadow root，统一加 .cm-root 作用域） ===================== */
  const STYLES = `
    .cm-root {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      background: #0d1117; color: #fff;
      font-family: "Segoe UI", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      touch-action: none; user-select: none; -webkit-user-select: none;
      overflow: hidden;
      --cm-claude:#E8643C; --cm-claude-d:#C24A26; --cm-deep:#2F6BFF; --cm-deep-d:#1B47C2;
    }
    .cm-root *{ box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    /* ---------- HOME ---------- */
    .cm-root #home{ flex:1; overflow:auto; padding: calc(var(--statusbar-h, 0px) + 22px) 16px 32px; text-align:center;
      background: radial-gradient(120% 120% at 50% 0%, #1b2440 0%, #0d1117 70%); }
    .cm-root .cm-title{ display:flex; align-items:center; justify-content:center; gap:12px;
      margin:10px 0 4px; font-size:34px; letter-spacing:1px; font-weight:800; }
    .cm-root .cm-title span{
      background: linear-gradient(90deg, var(--cm-claude), #ffd28a, var(--cm-deep));
      -webkit-background-clip:text; background-clip:text; color:transparent; }
    .cm-root .cm-mark{ width:40px; height:40px; flex:0 0 auto; display:block; }
    .cm-root #home .sub{ opacity:.85; font-size:15px; margin-bottom:18px; }
    .cm-root .levels{ display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:12px; max-width:760px; margin:0 auto; }
    .cm-root .lvl{ position:relative; border:none; border-radius:14px; padding:14px 10px; cursor:pointer;
      background:linear-gradient(160deg,#26324f,#1a2238); color:#fff; font-size:15px; font-weight:600;
      box-shadow:0 6px 0 #0c1120,0 8px 18px rgba(0,0,0,.4); transition:transform .08s,box-shadow .08s; }
    .cm-root .lvl:active{ transform:translateY(4px); box-shadow:0 2px 0 #0c1120; }
    .cm-root .lvl .n{ font-size:22px; font-weight:800; display:block; }
    .cm-root .help{ max-width:640px; margin:18px auto 0; font-size:12.5px; line-height:1.7; opacity:.85;
      background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px 16px; text-align:left; }
    .cm-root .help b{ color:#ffd28a; }

    /* ---------- GAME ---------- */
    .cm-root #game{ flex:1; position:relative; display:flex; flex-direction:column; background:#0d1117; }
    .cm-root #stage{ position:relative; flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    .cm-root canvas{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; image-rendering:pixelated; display:block;
      background:#7ec8ff; touch-action:none; }

    /* 顶部 HUD：文字/按钮整体放大 */
    .cm-root #hud{ position:absolute; top:calc(var(--statusbar-h, 0px) + 10px); left:10px; right:10px;
      display:flex; gap:10px; align-items:center; font-size:20px; font-weight:800;
      pointer-events:none; text-shadow:0 2px 3px rgba(0,0,0,.6); z-index:5; }
    .cm-root #hud .pill{ background:rgba(0,0,0,.42); padding:9px 18px; border-radius:24px; font-size:19px; }
    .cm-root #hud .spacer{ flex:1; }
    .cm-root #hud button{ pointer-events:auto; border:none; border-radius:18px;
      min-width:56px; height:52px; padding:0 16px; font-weight:800;
      font-size:26px; line-height:1; cursor:pointer; background:rgba(0,0,0,.46); color:#fff; }
    .cm-root #hud button:active{ transform:scale(.94); }

    /* 底部操作条：完全透明、不画背景；放在最底部、只覆盖地面内侧，绝不遮挡上方玩法区 */
    .cm-root #touch{ position:absolute; left:0; right:0; bottom:0; z-index:60;
      height:104px; display:none; align-items:flex-start; justify-content:space-between;
      padding:18px 26px calc(18px + env(safe-area-inset-bottom, 0px)); pointer-events:none;
      background:none; }
    .cm-root .cm-touch-left{ display:flex; align-items:flex-start; gap:16px; pointer-events:none; }
    .cm-root .ctrl{ width:86px; height:86px; border-radius:50%;
      background:rgba(255,255,255,.18); border:2px solid rgba(255,255,255,.42);
      display:flex; align-items:center; justify-content:center; font-size:40px; color:#fff;
      pointer-events:auto; user-select:none; -webkit-user-select:none; }
    .cm-root .ctrl:active{ background:rgba(255,255,255,.36); }
    .cm-root #btnJ{ width:86px; height:86px; font-size:26px; font-weight:800;
      background:rgba(232,100,60,.46); border-color:rgba(255,200,150,.7); }
    .cm-root #btnJ:active{ background:rgba(232,100,60,.78); }

    /* overlays（去掉 backdrop-filter，避免合成层重绘抖动） */
    .cm-root .overlay{ position:absolute; inset:0; z-index:10; display:none; flex-direction:column;
      align-items:center; justify-content:center; gap:16px; text-align:center;
      background:rgba(8,12,24,.82); padding:20px; }
    .cm-root .overlay.show{ display:flex; }
    .cm-root .overlay h2{ font-size:34px; margin:0; }
    .cm-root .overlay p{ margin:0; opacity:.9; font-size:17px; }
    .cm-root .overlay .row{ display:flex; gap:14px; flex-wrap:wrap; justify-content:center; }
    .cm-root .obtn{ border:none; border-radius:16px; padding:14px 26px; font-size:18px; font-weight:800; cursor:pointer;
      color:#fff; background:linear-gradient(160deg,var(--cm-claude),var(--cm-claude-d)); box-shadow:0 5px 0 #7a2e16; }
    .cm-root .obtn:active{ transform:translateY(3px); box-shadow:none; }
  `;

  /* ===================== 结构：两个 route 各自的 DOM ===================== */
  const HOME_HTML = `
    <div class="cm-root">
      <section id="home">
        <h1 class="cm-title">${CLAUDE_MARK}<span>Claude 大冒险</span></h1>
        <div class="sub">12 关 · 踩扁粑粑怪 &amp; DeepSeek 怪 · 抵达终点旗</div>
        <div class="levels" id="levelGrid"></div>
        <div class="help">
          <b>玩法：</b> 操控 <b>Claude</b> 小人穿越 12 关，跳过深坑、踩扁怪物、收集金币，抵达终点旗即可过关。<br>
          <b>电脑：</b> ← → / A D 移动，↑ / W / 空格 跳跃。<br>
          <b>手机：</b> 使用屏幕左下方向键与右下跳跃键。<br>
          <b>返回：</b> 用系统返回手势 / 按钮即可回到选关首页。<br>
          <b>技巧：</b> 从上方落到怪物头上可踩扁它并弹起；从侧面碰到怪物会立刻失败并弹出遮罩。碰到 ❓ 砖块会从下方顶出金币。
        </div>
      </section>
    </div>
  `;

  const GAME_HTML = `
    <div class="cm-root">
      <section id="game">
        <div id="stage">
          <canvas id="cv" width="420" height="560"></canvas>
          <div id="hud">
            <span class="pill" id="hLevel">1-1</span>
            <span class="pill">🪙 <span id="hCoin">0</span></span>
            <span class="spacer"></span>
            <button id="bSound">🔊</button>
            <button id="bRestart">↻</button>
          </div>
          <div id="touch">
            <div class="cm-touch-left">
              <div class="ctrl" id="btnL">◀</div>
              <div class="ctrl" id="btnR">▶</div>
            </div>
            <div class="ctrl" id="btnJ">跳</div>
          </div>

          <div class="overlay" id="ovWin">
            <h2 id="winTitle">🎉 过关！</h2>
            <p id="winInfo"></p>
            <div class="row">
              <button class="obtn" id="winNext">下一关 ▶</button>
            </div>
          </div>
          <div class="overlay" id="ovOver">
            <h2>💀 游戏结束</h2>
            <p>你被怪物击败了，再试一次吧！</p>
            <div class="row">
              <button class="obtn" id="overRetry">重试本关</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  /* ===================== 游戏实例（闭包内自洽，返回 dispose） ===================== */
  function createGame(root, startIdx) {
    /* 原生 420×560：瓦片 T=42 正好整除 420（可见 10 列），画布缓冲即屏幕，1:1 不缩放。
       物理按 42/46 ≈ 0.913 同比缩小，跳跃高度/水平位移与可通关性与原版完全一致。 */
    const T = 42, VIEW_W = 10, VIEW_H = 15;
    const VIEW_OFF = 130;        // 世界整体上移量：地面落在底部并露出泥土带
    const GRAV = 0.867, MOVE = 3.65, JUMP = -13.24, MAXFALL = 14.6, BOUNCE = -9.86;
    const SPEED_POOP = 1.31, SPEED_DEEP = 1.97;
    const W_P = 31, H_P = 53;

    let disposed = false;
    function isActive() {
      if (disposed || !root.isConnected) return false;
      const sr = root.getRootNode();
      const hostEl = sr && sr.host;               /* 应用挂在 shadow root 里 */
      return !(hostEl && hostEl.parentElement
        && hostEl.parentElement.id === 'appScreenFrozen');
    }
    const listeners = [];
    const timers = [];
    function on(el, type, fn, opts) {
      el.addEventListener(type, fn, opts);
      listeners.push(() => el.removeEventListener(type, fn, opts));
    }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    const q = id => root.querySelector('#' + id);

    /* ---- DOM ---- */
    const cv = q('cv');
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    /* 画布缓冲 = 屏幕 420×560，世界坐标直接 1:1 绘制，不做任何缩放变换（像素清晰）。 */
    const SCREEN_W = 420, SCREEN_H = 560;

    const touchUI = q('touch');
    const ovWin = q('ovWin'), ovOver = q('ovOver');
    const hLevel = q('hLevel'), hCoin = q('hCoin');
    const winTitle = q('winTitle'), winInfo = q('winInfo'), winNext = q('winNext');

    /* ---- 贴图 ---- */
    const imgClaude = new Image(); imgClaude.src = CLAUDE_SVG;
    const imgDeep = new Image(); imgDeep.src = DEEPSEEK_SVG;

    /* ---- 音效 ---- */
    let actx = null, soundOn = true;
    function audio() {
      if (disposed) return null;
      if (!actx) {
        try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { return null; }
      }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    }
    function tone(f1, f2, dur, type, vol) {
      if (!soundOn || disposed) return;
      const a = audio(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f1, a.currentTime);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), a.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.16, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0008, a.currentTime + dur);
      o.connect(g).connect(a.destination);
      o.start(); o.stop(a.currentTime + dur + 0.02);
    }
    function noise(dur, vol) {
      if (!soundOn || disposed) return;
      const a = audio(); if (!a) return;
      const len = Math.floor(a.sampleRate * dur);
      const b = a.createBuffer(1, len, a.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const s = a.createBufferSource(); s.buffer = b;
      const g = a.createGain(); g.gain.value = vol || 0.22;
      s.connect(g).connect(a.destination); s.start();
    }
    const sfx = {
      jump() { tone(420, 720, 0.13, 'sine', 0.16); },
      coin() { tone(988, 0, 0.06, 'square', 0.14); later(() => tone(1319, 0, 0.09, 'square', 0.14), 55); },
      stomp() { noise(0.13, 0.28); tone(180, 90, 0.12, 'square', 0.12); },
      die() { tone(440, 80, 0.5, 'sawtooth', 0.18); },
      win() { [523, 659, 784, 1047].forEach((f, i) => later(() => tone(f, 0, 0.18, 'square', 0.16), i * 120)); },
      bump() { tone(150, 0, 0.08, 'square', 0.14); }
    };

    /* ---- 状态 ---- */
    let grid, coins, monsters, player, goal, W, H = 15, camX = 0;
    let curLevel = 0, totalCoins = 0, state = 'play', invuln = 0, prevJump = false, jumpBuffer = 0, coyote = 0;

    function makeMonster(type, px, py) {
      const w = type === 'poop' ? 35 : 38;
      const h = type === 'poop' ? 35 : 38;
      return { type, x: px, y: py - h, w, h, vx: (type === 'poop' ? -SPEED_POOP : -SPEED_DEEP), vy: 0,
               alive: true, onGround: false, dir: -1, t: Math.random() * 6 };
    }
    function buildLevel(idx) {
      const cfg = LEVELS[idx];
      W = cfg.w; H = 15;
      const g = Array.from({ length: H }, () => Array(W).fill(' '));
      const ground = H - 1;
      for (let x = 0; x < W; x++) {
        const inGap = (cfg.gaps || []).some(([a, b]) => x >= a && x <= b);
        if (!inGap) g[ground][x] = 'X';
      }
      (cfg.plats || []).forEach(([x, y, len]) => { for (let i = 0; i < len; i++) if (x + i < W) g[y][x + i] = 'P'; });
      g[ground][cfg.goalX] = 'X';
      (cfg.blocks || []).forEach(([x, y, ch]) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; });
      coins = (cfg.coins || []).map(([x, y]) => ({ x: x * T + T / 2, y: y * T + T / 2, r: 8, got: false, t: Math.random() * 6 }));
      monsters = [];
      (cfg.poop || []).forEach(([x, row]) => monsters.push(makeMonster('poop', x * T, row * T)));
      (cfg.deep || []).forEach(([x, row]) => monsters.push(makeMonster('deep', x * T, row * T)));
      player = { x: cfg.startX * T, y: ground * T - H_P, w: W_P, h: H_P, vx: 0, vy: 0, onGround: false, dir: 1, t: 0 };
      goal = { x: cfg.goalX * T + 4, y: ground * T - 2 * T, w: 24, h: 2 * T };
      grid = g; camX = 0; invuln = 0; totalCoins = 0; jumpBuffer = 0; coyote = 0; prevJump = false;
    }

    /* ---- 碰撞 ---- */
    function solid(tx, ty) {
      if (tx < 0 || tx >= W || ty < 0 || ty >= H) return false;
      const c = grid[ty][tx];
      return c === 'X' || c === 'B' || c === '?' || c === 'P';
    }
    function resolveX(e) {
      const top = e.y, bottom = e.y + e.h - 1, left = e.x, right = e.x + e.w - 1;
      if (e.vx > 0) {
        const tx = Math.floor(right / T);
        for (let ty = Math.floor(top / T); ty <= Math.floor(bottom / T); ty++) {
          if (solid(tx, ty)) { e.x = tx * T - e.w; e.vx = 0; return true; }
        }
      } else if (e.vx < 0) {
        const tx = Math.floor(left / T);
        for (let ty = Math.floor(top / T); ty <= Math.floor(bottom / T); ty++) {
          if (solid(tx, ty)) { e.x = (tx + 1) * T; e.vx = 0; return true; }
        }
      }
      return false;
    }
    function resolveY(e, isPlayer) {
      const top = e.y;
      /* ★ 抖动修复：落地探测点必须是「脚底」 e.y + e.h，不能用 e.y + e.h - 1。
         站在地砖上沿(feet === ty*T)时，重力推进 ~1px 后 -1 会把探测点算进上一行
         (空行) 导致地面漏检 → 下沉一帧 → 下一帧又被拉回 → 每帧 2~3px 永久抖动。
         用脚底后落地当帧即吸附，且 e.y = ty*T - e.h 是幂等的，静止时纹丝不动。 */
      const bottom = e.y + e.h;
      const left = e.x, right = e.x + e.w - 1;
      if (e.vy > 0) {
        const ty = Math.floor(bottom / T);
        for (let tx = Math.floor(left / T); tx <= Math.floor(right / T); tx++) {
          if (solid(tx, ty)) { e.y = ty * T - e.h; e.vy = 0; e.onGround = true; return; }
        }
      } else if (e.vy < 0) {
        const ty = Math.floor(top / T);
        for (let tx = Math.floor(left / T); tx <= Math.floor(right / T); tx++) {
          if (solid(tx, ty)) {
            e.y = (ty + 1) * T; e.vy = 0;
            if (isPlayer && grid[ty][tx] === '?') { grid[ty][tx] = 'B'; totalCoins++; sfx.coin(); }
            return;
          }
        }
      }
    }

    /* ---- 更新 ---- */
    function overlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    function update() {
      if (state !== 'play') return;

      const dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      player.vx = dir * MOVE;
      if (dir !== 0) player.dir = dir;

      if (keys.jump && !prevJump) jumpBuffer = 7;
      if (jumpBuffer > 0) jumpBuffer--;
      prevJump = keys.jump;

      player.vy += GRAV;
      if (player.vy > MAXFALL) player.vy = MAXFALL;

      player.x += player.vx;
      if (player.x < 0) player.x = 0;
      if (player.x > W * T - player.w) player.x = W * T - player.w;
      resolveX(player);
      player.y += player.vy;
      player.onGround = false;
      resolveY(player, true);

      if (player.onGround) coyote = 7; else if (coyote > 0) coyote--;
      if (jumpBuffer > 0 && coyote > 0) {
        player.vy = JUMP; player.onGround = false; coyote = 0; jumpBuffer = 0; sfx.jump();
      }
      player.t += 1;

      if (invuln > 0) invuln--;

      if (player.y > H * T + 20) { die(); return; }

      for (const m of monsters) {
        if (!m.alive) continue;
        m.t += 0.05;
        const footRow = Math.floor((m.y + m.h) / T);
        const aheadTx = Math.floor((m.dir > 0 ? m.x + m.w + 2 : m.x - 2) / T);
        if (m.onGround && !solid(aheadTx, footRow) && m.onGround) {
          m.dir *= -1; m.vx = Math.abs(m.vx) * m.dir;
        }
        m.vx = (m.type === 'poop' ? SPEED_POOP : SPEED_DEEP) * m.dir;
        m.vy += GRAV; if (m.vy > MAXFALL) m.vy = MAXFALL;
        m.x += m.vx;
        const hitWall = resolveX(m);
        if (hitWall) m.dir *= -1;
        m.y += m.vy;
        m.onGround = false;
        resolveY(m, false);

        if (overlap(player, m)) {
          const fromTop = player.vy > 0 && (player.y + player.h) - m.y < m.h * 0.6;
          if (fromTop) {
            m.alive = false; player.vy = BOUNCE; totalCoins += 2; sfx.stomp();
          } else {
            die(); return;
          }
        }
      }

      for (const c of coins) {
        if (c.got) continue;
        c.t += 0.12;
        const dx = (player.x + player.w / 2) - c.x, dy = (player.y + player.h / 2) - c.y;
        if (dx * dx + dy * dy < (c.r + 16) * (c.r + 16)) {
          c.got = true; totalCoins++; sfx.coin();
        }
      }

      if (overlap(player, goal)) { win(); return; }

      let target = player.x + player.w / 2 - (VIEW_W * T) / 2;
      const maxCam = Math.max(0, (W - VIEW_W) * T);
      camX = Math.max(0, Math.min(maxCam, target));
      camX = Math.floor(camX); /* ★ 加固：相机取整，杜绝亚像素平移导致的画面微抖 */

      hCoin.textContent = totalCoins;
    }

    function die() {
      state = 'over';
      sfx.die();
      touchUI.style.display = 'none';
      show(ovOver);
    }
    function win() {
      state = 'win'; sfx.win();
      const isLast = curLevel >= LEVELS.length - 1;
      winTitle.textContent = isLast ? '👑 全部通关！' : '🎉 过关！';
      winInfo.textContent = `关卡：${LEVELS[curLevel].name}　收集金币：${totalCoins}`;
      /* 最后一关没有「下一关」时，把按钮改成「再玩一次」重开首关，
         避免遮罩里一个按钮都没有、只能靠返回手势的死胡同。 */
      winNext.textContent = isLast ? '再玩一次 ↻' : '下一关 ▶';
      winNext.style.display = '';
      touchUI.style.display = 'none';
      show(ovWin);
    }

    /* ---- 绘制 ---- */
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function drawBackground() {
      const sky = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
      sky.addColorStop(0, '#5fb3ff'); sky.addColorStop(1, '#bfe9ff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      const cl = (camX * 0.3) % 400;
      for (let i = 0; i < 5; i++) {
        let cx = (i * 220 - cl); cx = ((cx % 900) + 900) % 900 - 100;
        cloud(cx, 50 + (i % 3) * 30);
      }
      /* 地表基线 = 地面瓦片（第 ground 行）顶边的屏幕 y；棕色泥土与山丘都以此为准。 */
      if (!grid) return;
      const ground = H - 1;
      const dirtTop = ground * T - VIEW_OFF;

      ctx.fillStyle = 'rgba(120,200,140,.5)';
      const hl = (camX * 0.5) % 300;
      for (let i = 0; i < 6; i++) {
        let hx = (i * 260 - hl); hx = ((hx % 1200) + 1200) % 1200 - 200;
        hill(hx, dirtTop, 120);
      }

      /* 地面以下逐列着色：有地砖的列画棕色泥土 + 缺口侧深色断口（立体）；
         深坑(gap)列完全留空（露出天空蓝），不画任何深色，读起来就是洞。 */
      const c0 = Math.floor(camX / T), c1 = c0 + VIEW_W + 1;
      for (let tx = Math.max(0, c0); tx <= Math.min(W - 1, c1); tx++) {
        const x = tx * T - camX;
        const solid = grid[ground][tx] !== ' ';
        if (solid) {
          /* 有地砖：从地表线向下一直铺到画布底部，与地砖连成一体 */
          ctx.fillStyle = '#7a4f2a';
          ctx.fillRect(x, dirtTop, T, SCREEN_H - dirtTop);
          /* 砖块左右侧面：靠缺口的一侧描深色断口，立体感 */
          const leftGap = tx > 0 && grid[ground][tx - 1] === ' ';
          const rightGap = tx < W - 1 && grid[ground][tx + 1] === ' ';
          if (leftGap) { ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.fillRect(x, dirtTop, 5, SCREEN_H - dirtTop); }
          if (rightGap) { ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.fillRect(x + T - 5, dirtTop, 5, SCREEN_H - dirtTop); }
          /* 地表高光 */
          ctx.fillStyle = 'rgba(0,0,0,.18)';
          ctx.fillRect(x, dirtTop, T, 4);
        }
        /* 深坑列：什么都不画，保留天空背景，让洞是开放的 */
      }
    }
    function cloud(x, y) { ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.arc(x + 20, y + 4, 22, 0, 7); ctx.arc(x + 44, y, 16, 0, 7); ctx.fill(); }
    function hill(x, y, r) { ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y - r, x + r, y); ctx.fill(); }

    function drawTiles() {
      const c0 = Math.floor(camX / T), c1 = c0 + VIEW_W + 1;
      for (let ty = 0; ty < H; ty++) {
        for (let tx = Math.max(0, c0); tx <= Math.min(W - 1, c1); tx++) {
          const c = grid[ty][tx];
          if (c === ' ') continue;
          const x = tx * T - camX, y = ty * T - VIEW_OFF;
          if (c === 'X') {
            ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x, y, T, T);
            ctx.fillStyle = '#5fae3a'; ctx.fillRect(x, y, T, 6);
            ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x, y + 6, T, T - 6);
            ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.strokeRect(x + .5, y + .5, T - 1, T - 1);
          } else if (c === 'B') {
            ctx.fillStyle = '#c8743a'; ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = '#7a3f17'; ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
            ctx.beginPath(); ctx.moveTo(x, y + T / 2); ctx.lineTo(x + T, y + T / 2); ctx.stroke();
          } else if (c === '?') {
            const bob = Math.sin((performance.now() / 300) + tx) * 1.5;
            ctx.fillStyle = '#f4b400'; roundRect(x + 1, y + 1 + bob, T - 2, T - 2, 5); ctx.fill();
            ctx.fillStyle = '#7a5400'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('?', x + T / 2, y + T / 2 + bob);
          } else if (c === 'P') {
            ctx.fillStyle = '#3aa0e0'; ctx.fillRect(x, y, T, 10);
            ctx.fillStyle = '#2b7bb8'; ctx.fillRect(x, y + 10, T, T - 10);
            ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y, T, 3);
          }
        }
      }
    }
    function drawCoin(c) {
      if (c.got) return;
      const x = c.x - camX, y = c.y - VIEW_OFF + Math.sin(c.t) * 3;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.ellipse(x, y, c.r * 0.7, c.r, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff0a8';
      ctx.beginPath(); ctx.ellipse(x - 2, y - 2, c.r * 0.3, c.r * 0.5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c79a1f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, c.r * 0.7, c.r, 0, 0, 7); ctx.stroke();
    }
    function drawGoal() {
      const x = goal.x - camX, topY = goal.y - VIEW_OFF, botY = (goal.y + goal.h) - VIEW_OFF;
      ctx.fillStyle = '#ddd'; ctx.fillRect(x, topY, 4, goal.h);
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(x + 2, topY, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff5a5a'; ctx.beginPath();
      ctx.moveTo(x + 4, topY + 4); ctx.lineTo(x + 28, topY + 12); ctx.lineTo(x + 4, topY + 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 1, botY - 4, 8, 4);
    }
    function drawClaude(p) {
      /* ★ 加固：屏幕坐标取整，配合 imageSmoothingEnabled=false，Claude 不再亚像素闪烁 */
      const x = Math.round(p.x - camX), y = Math.round(p.y - VIEW_OFF), w = p.w, h = p.h;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h, w / 2, 5, 0, 0, 7); ctx.fill();
      if (imgClaude.complete && imgClaude.naturalWidth) {
        ctx.drawImage(imgClaude, x - 2, y, w + 4, h);
      } else {
        ctx.fillStyle = '#E8643C'; roundRect(x, y + 4, w, h - 4, 6); ctx.fill();
      }
    }
    function drawPoop(m) {
      const x = m.x - camX, y = m.y - VIEW_OFF, w = m.w, h = m.h;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h, w / 2, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a5a2b';
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 4, w / 2, 7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 12, w / 2.6, 7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 20, w / 4.5, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6f4420';
      ctx.beginPath(); ctx.ellipse(x + w / 2 - 3, y + h - 22, 2.4, 3.5, -0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w * 0.36, y + h - 15, 3, 0, 7); ctx.arc(x + w * 0.64, y + h - 15, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + w * 0.36, y + h - 15, 1.4, 0, 7); ctx.arc(x + w * 0.64, y + h - 15, 1.4, 0, 7); ctx.fill();
    }
    function drawDeep(m) {
      const x = m.x - camX, y = m.y - VIEW_OFF, w = m.w, h = m.h;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h, w / 2, 4, 0, 0, 7); ctx.fill();
      if (imgDeep.complete && imgDeep.naturalWidth) {
        ctx.drawImage(imgDeep, x, y, w, h);
      } else {
        ctx.fillStyle = '#2F6BFF'; roundRect(x, y, w, h, 6); ctx.fill();
      }
    }
    function render() {
      /* 画布缓冲 = 屏幕 420×560，世界坐标直接 1:1 绘制，无任何缩放变换。 */
      drawBackground();
      if (!grid) return;
      drawTiles();
      for (const c of coins) drawCoin(c);
      drawGoal();
      for (const m of monsters) if (m.alive) { if (m.type === 'poop') drawPoop(m); else drawDeep(m); }
      if (state !== 'over') drawClaude(player);
    }

    /* ---- 主循环（rAF id 受控，卸载时取消） ---- */
    let rafId = 0, last = performance.now(), acc = 0;
    const STEP = 1000 / 60;
    function frame(now) {
      if (disposed) return;
      /* 应用被冻结（切到别的应用）或 DOM 已脱离时，暂停推进：不吞按键、不空转物理。
         用 last=now 重置时基，恢复时不会积压一大段 delta。 */
      if (!isActive()) {
        last = now; acc = 0;
        keys.left = keys.right = keys.jump = false;
        horizStack.length = 0;
        rafId = requestAnimationFrame(frame);
        return;
      }
      acc += now - last; last = now;
      if (acc > 200) acc = 200;
      while (acc >= STEP) { update(); acc -= STEP; }
      render();
      rafId = requestAnimationFrame(frame);
    }

    /* ---- 输入 ---- */
    const keys = { left: false, right: false, jump: false };
    const horizStack = [];
    function pressHoriz(prop, src, down) {
      const i = horizStack.findIndex(e => e.prop === prop && e.src === src);
      if (i >= 0) horizStack.splice(i, 1);
      if (down) horizStack.unshift({ prop, src });
      let dir = 0;
      for (const e of horizStack) {
        if (e.prop === 'left') { dir = -1; break; }
        if (e.prop === 'right') { dir = 1; break; }
      }
      keys.left = dir === -1;
      keys.right = dir === 1;
    }
    function setKey(e, down) {
      if (!isActive()) return;   /* 冻结/已卸载时不拦截系统按键 */
      const k = e.key;
      let prop = null;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') prop = 'left';
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') prop = 'right';
      else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ' || k === 'Spacebar') prop = 'jump';
      else return;
      e.preventDefault();
      if (prop === 'jump') { keys.jump = down; return; }
      pressHoriz(prop, 'kbd', down);
    }
    on(window, 'keydown', e => setKey(e, true));
    on(window, 'keyup', e => setKey(e, false));

    const holdMap = new Map();
    function bindTouch(id, prop) {
      const el = q(id);
      const down = e => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        holdMap.set(e.pointerId, prop);
        if (prop === 'jump') keys.jump = true; else pressHoriz(prop, 'touch', true);
        audio();
      };
      const up = e => {
        e.preventDefault();
        if (holdMap.get(e.pointerId) === prop) holdMap.delete(e.pointerId);
        let still = false;
        holdMap.forEach(p => { if (p === prop) still = true; });
        if (!still) { if (prop === 'jump') keys.jump = false; else pressHoriz(prop, 'touch', false); }
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      on(el, 'pointerdown', down);
      on(el, 'pointerup', up);
      on(el, 'pointercancel', up);
    }
    bindTouch('btnL', 'left'); bindTouch('btnR', 'right'); bindTouch('btnJ', 'jump');

    /* 首次用户手势恢复 AudioContext（原版 {once:true}，这里用命名函数以便卸载时移除） */
    const resumeAudio = () => { audio(); window.removeEventListener('pointerdown', resumeAudio); };
    on(window, 'pointerdown', resumeAudio);

    /* ---- 界面切换 ---- */
    function show(el) { el.classList.add('show'); }
    function hide(el) { el.classList.remove('show'); }

    function startLevel(idx) {
      curLevel = idx;
      buildLevel(idx);
      hLevel.textContent = LEVELS[idx].name.split(' ')[0];
      hCoin.textContent = '0';
      state = 'play';
      touchUI.style.display = 'flex';
      hide(ovWin); hide(ovOver);
      audio();
    }

    on(q('bRestart'), 'click', () => startLevel(curLevel));
    on(q('bSound'), 'click', function () {
      soundOn = !soundOn; this.textContent = soundOn ? '🔊' : '🔇'; if (soundOn) audio();
    });
    on(q('winNext'), 'click', () => startLevel(
      curLevel >= LEVELS.length - 1 ? 0 : curLevel + 1));
    on(q('overRetry'), 'click', () => startLevel(curLevel));

    startLevel(startIdx);
    rafId = requestAnimationFrame(frame);

    /* ---- 卸载：所有副作用统一收尾 ---- */
    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      listeners.forEach(f => { try { f(); } catch (e) {} });
      listeners.length = 0;
      timers.forEach(t => clearTimeout(t));
      timers.length = 0;
      holdMap.clear();
      try { if (actx && actx.state !== 'closed') actx.close(); } catch (e) {}
      actx = null;
    };
  }

  /* ===================== 注册到 WujiOS 应用生态 ===================== */
  WujiApps.registerInstalled({
    bundlename: BUNDLE,
    name: 'Claude 大冒险',
    icon: './assets/claude-mario.svg',
    version: '1.0.1',
    author: 'wujinb',
    description: '12 关平台跳跃',
    initialRoute: 'home',
    devices: ['iwuji', 'pc'],
    styles: STYLES,
    routes: {
      /* 选关首页：点击关卡用 ctx.push 打开游戏页；返回由框架手势/按钮处理 */
      home: {
        name: 'home',
        render() { return HOME_HTML; },
        mount(root, ctx) {
          const gridEl = root.querySelector('#levelGrid');
          if (!gridEl) return;
          LEVELS.forEach((lv, i) => {
            const b = document.createElement('button');
            b.className = 'lvl';
            b.innerHTML = `<span class="n">${lv.name.split(' ')[0]}</span>${lv.name.split(' ').slice(1).join(' ')}`;
            b.addEventListener('click', () => ctx.push('game', { level: i }));
            gridEl.appendChild(b);
          });
        },
      },

      /* 游戏页：读取 push 传来的 level，构建关卡；pop（系统返回）时 dispose 收尾 */
      game: {
        name: 'game',
        render() { return GAME_HTML; },
        mount(root, ctx) {
          const n = Number(ctx && ctx.data && ctx.data.level);
          const startIdx = Number.isFinite(n) ? Math.max(0, Math.min(LEVELS.length - 1, n)) : 0;
          return createGame(root, startIdx);
        },
      },
    },
  });
})();
