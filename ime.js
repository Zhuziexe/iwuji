/* 牛奶阅读 · 系统级软键盘 IME（iWuji 假手机用）
 * - 挂载在 body 上的浮层（z-index 9000），跨 Shadow DOM 工作，页面销毁自动关闭
 * - 三种模式：中文9键 / 中文26键 / 英文
 * - 单一拼音表 DICT：拼音串(音节或词组) -> 候选数组（音节与词组混放）
 * - 分词(读法)：readAll/parseT9 枚举“全部由 DICT 键组成”的完整读法，分词键可在多种读法间循环
 * - 输入框完整显示【第一个分词结果】，候选词取该结果的第一个音节
 * - 点击候选词：上屏该字/词，剩余串(remainder)继续作为新的 composing 重新分词
 */
(function () {
  'use strict';

  // 单一拼音表：window.IME_DATA = { "niu":["牛"], "nihao":["你好"], ... }（词组键优先）
  var DATA = window.IME_DATA || {};
  try { delete window.IME_DATA; } catch (e) { window.IME_DATA = undefined; }

  var MODE = { EN: 0, CN9: 1, CN26: 2 };
  var T9 = { '2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl', '6': 'mno', '7': 'pqrs', '8': 'tuv', '9': 'wxyz' };
  // 每个数字键的“中间字母”：未完成拼读时，尾部残留由剩余数字键推导，
  // 例 644 剩余 '44' -> 'hh' -> 显示 ni'h / mi'h（而不是来自某组合拼写 ni'i）。
  var T9MID = {};
  (function () { for (var k in T9) { if (!T9.hasOwnProperty(k)) continue; var s = T9[k]; T9MID[k] = s.charAt(Math.floor(s.length / 2)); } })();

  // 输入法高度：默认占屏幕 55%（含候选栏）。窗口尺寸变化时同步更新（见 resize 处理）。
  var KB_HEIGHT = 0;
  function computeKBHeight() { KB_HEIGHT = Math.round((window.innerHeight || 640) * 0.55); return KB_HEIGHT; }
  computeKBHeight();

  /* ---------- 单一拼音表：key(拼音串) -> 候选数组（音节与词组混放） ---------- */
  // DICT[key] = 候选数组；词组(汉字长度>1)排在单字前面，单字按数据原序
  var DICT = {};
  var PHRASES = {};                 // 词组键集合：用于 scoreSeg 的短语加分
  (function () {
    function isPhrase(arr) {        // 任一候选为多汉字即视为词组
      for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].length > 1) return true;
      return false;
    }
    for (var k in DATA) {
      if (!DATA.hasOwnProperty(k)) continue;
      var v = DATA[k];
      var arr = Array.isArray(v) ? v : [v];
      if (!DICT[k]) DICT[k] = [];
      if (isPhrase(arr)) {
        PHRASES[k] = 1;
        for (var j = 0; j < arr.length; j++) { if (DICT[k].indexOf(arr[j]) < 0) DICT[k].unshift(arr[j]); } // 词组放前面
      } else {
        for (var t = 0; t < arr.length; t++) { if (DICT[k].indexOf(arr[t]) < 0) DICT[k].push(arr[t]); }
      }
    }
  })();

  // 所有键的前缀集合（用于 9 键快速判断“是否还能继续拼”）
  var PREFIX = {};
  for (var pk in DICT) { if (!DICT.hasOwnProperty(pk)) continue; for (var pp = 1; pp <= pk.length; pp++) PREFIX[pk.slice(0, pp)] = 1; }

  // 字母 -> 数字（T9 反查）：每个拼音字母恰好对应一个 T9 数字。
  var LET2DIG = {};
  (function () {
    for (var dk in T9) { if (!T9.hasOwnProperty(dk)) continue; var ll = T9[dk]; for (var li = 0; li < ll.length; li++) LET2DIG[ll.charAt(li)] = dk; }
  })();
  // 数字串 -> DICT 键 的反向索引（拼音键按 T9 数字串归类），用于跳过 3^n 字母展开。
  var DIGIT2KEYS = {};
  (function () {
    for (var k in DICT) {
      if (!DICT.hasOwnProperty(k)) continue;
      var ds = '', ok = true;
      for (var i = 0; i < k.length; i++) { var d = LET2DIG[k.charAt(i)]; if (!d) { ok = false; break; } ds += d; }
      if (ok) { (DIGIT2KEYS[ds] || (DIGIT2KEYS[ds] = [])).push(k); }
    }
  })();

  // 常用字优先（越靠前越先显示）
  var COMMON = ['你', '好', '的', '了', '是', '在', '我', '有', '他', '这', '中', '大', '来', '上', '国', '到', '说', '们', '为', '子', '和', '那', '没', '看', '要', '去', '也', '很', '得', '它', '里', '后', '能', '对', '她', '还', '给', '都', '把', '让', '从', '向', '但', '与', '或', '已', '又', '最', '再', '更', '比', '就', '被', '等', '着', '个', '时', '会', '自', '己', '道', '怎', '么', '什', '只', '想', '吃', '喝', '睡', '觉', '家', '学', '生', '工', '作', '天', '年', '月', '日', '出', '入', '开', '关', '前', '左', '右', '东', '西', '南', '北', '奶', '牛', '妈', '爱', '谢'];
  function rankOf(ch) { var i = COMMON.indexOf(ch); return i < 0 ? 9999 : i; }

  /* ---------- 9 键：数字 -> 拼音串 的猜测 ---------- */
  // 仅在短数字串（<=8）下列举所有字母组合；长串由 readAll 的数字 DP 直接处理，不再展开。
  function t9Expand(digits) {
    if (!digits) return [];
    var sets = [];
    for (var i = 0; i < digits.length; i++) {
      var d = digits[i];
      if (T9[d]) sets.push(T9[d].split('')); else return [];
    }
    var out = [''];
    for (var s = 0; s < sets.length; s++) {
      var cur = [];
      for (var a = 0; a < out.length; a++) for (var b = 0; b < sets[s].length; b++) cur.push(out[a] + sets[s][b]);
      out = cur;
    }
    return out;
  }
  // 切分择优：词组(ph)键越多越好，其次组成字越常用越好
  function scoreSeg(keys) {
    var phrase = 0, common = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (PHRASES[k]) phrase++;
      var cand = DICT[k] || [];
      for (var j = 0; j < cand.length; j++) { var r = rankOf(cand[j]); if (r < 9999) { common += (9999 - r); break; } }
    }
    return phrase * 100000 + common;
  }
  // 回溯法：在 combo（某个拼音串）上切出“全部由 DICT 键组成”的切分。
  // 完整切分（整串无残留）：例 "nihao" -> [["nihao"],["ni","hao"],...]
  // 若无法完整覆盖（如 "nih"，末尾 h 还不成音节），则取“最长前缀切分”，
  // 把无法成键的尾部当作 tail 保留（显示用，候选忽略）。例 "nih" -> [["ni"]] tail="h"
  function parseT9(combo) {
    var memo = {};
    function dp(i, end) {
      if (i === end) return [[]];
      var mkey = i + ',' + end;
      if (memo[mkey] !== undefined) return memo[mkey];
      var res = [];
      for (var k = 1; k <= 8 && i + k <= end; k++) {
        var w = combo.substr(i, k);
        if (!DICT[w]) continue;
        var rest = dp(i + k, end);
        for (var r = 0; r < rest.length; r++) res.push([w].concat(rest[r]));
      }
      memo[mkey] = res;
      return res;
    }
    var full = dp(0, combo.length);
    if (full.length) {
      for (var f = 0; f < full.length; f++) full[f].tail = '';
      return full;
    }
    for (var j = combo.length - 1; j >= 1; j--) {
      var pc = dp(0, j);
      if (pc.length) {
        for (var c = 0; c < pc.length; c++) { pc[c] = pc[c].slice(); pc[c].tail = combo.substr(j); }
        return pc;
      }
    }
    return [];
  }
  // 数字 DP：直接对数字串切分（不再做 3^n 字母展开），任意长度都不会卡死，也绝不空白。
  // 返回所有“分词结果”数组，每项形如 ["ni","zai","gan","shen","me"]，并附带 .tail（T9 中字母）。
  // 规则：优先完整覆盖整串；无法完整覆盖时取最长前缀切分，剩余数字取中间字母作 tail。
  function digitSeg(digits) {
    var n = digits.length;
    if (!n) return [];
    // 单步切分数量上限：防止极长/极高歧义数字串（如 50 位）导致组合数爆炸卡死浏览器。
    // 正常输入（<=20 位）几乎不会触及；超出时只保留部分读法（最终按 scoreSeg 取最优即可）。
    var CAP = 5000;
    // dp[i] = 到位置 i 为止的所有切分（数组的数组）；dp[0] = [[]]
    var dp = []; dp[0] = [[]];
    for (var i = 1; i <= n; i++) {
      var arr = [];
      for (var k = 1; k <= 8 && k <= i; k++) {
        var ds = digits.substr(i - k, k);
        var keys = DIGIT2KEYS[ds];
        if (!keys) continue;
        var pre = dp[i - k];
        for (var p = 0; p < pre.length; p++) {
          for (var q = 0; q < keys.length; q++) {
            arr.push(pre[p].concat([keys[q]]));
            if (arr.length >= CAP) break;
          }
          if (arr.length >= CAP) break;
        }
        if (arr.length >= CAP) break;
      }
      dp[i] = arr;
    }
    if (dp[n].length) { for (var a = 0; a < dp[n].length; a++) dp[n][a].tail = ''; return dp[n]; }
    // 非完整：取最长前缀 dp[j]（j<n 且 dp[j] 非空），尾部数字 -> 中间字母（按位分写，如 h'k）
    var j = n - 1;
    while (j >= 1 && !dp[j].length) j--;
    if (j < 1) {
      // 完全无法切分（如 hk：45）：整串当作未成音节，逐位取中间字母
      var all2 = '';
      for (var t0 = 0; t0 < n; t0++) all2 += (t0 ? "'" : '') + (T9MID[digits.charAt(t0)] || '');
      var fb = [[]]; fb[0].tail = all2; return fb;
    }
    var tail = '';
    for (var t = j; t < n; t++) tail += (t > j ? "'" : '') + (T9MID[digits.charAt(t)] || '');
    var res = dp[j];
    for (var r = 0; r < res.length; r++) { res[r] = res[r].slice(); res[r].tail = tail; }
    return res;
  }
  // 枚举一个数字串的所有“完整读法”（每刀都是 DICT 键，整串无残留），
  // 去重后按 scoreSeg 降序。例 64426 -> ["nihao","ni,hao","mi,hao",...]
  // 未完成拼读时，尾部残留由剩余数字键推导（每键取中间字母）：
  // 644 -> 剩余 '4' -> 'h' -> 读法 ni'h / mi'h（候选忽略 h）。
  function readAll(digits) {
    var best = {}, all = [];
    var segs = digitSeg(digits);
    for (var i = 0; i < segs.length; i++) {
      var cut = segs[i];
      var tail = cut.tail || '';
      var key = cut.join(',') + '|' + tail;
      var spell = cut.join('') + tail;
      if (best[key]) { if (spell > best[key]._spell) { best[key] = cut; best[key]._spell = spell; } }
      else { cut._spell = spell; best[key] = cut; }
    }
    for (var k in best) {
      if (!best.hasOwnProperty(k)) continue;
      var c = best[k];
      var len = 0; for (var w = 0; w < c.length; w++) len += c[w].length;
      c.tail = ''; for (var p = len; p < digits.length; p++) c.tail += T9MID[digits.charAt(p)] || '';
      c.score = scoreSeg(c); all.push(c);
    }
    all.sort(function (a, b) { return b.score - a.score; });
    return all;
  }
  function guessPinyin(digits) {
    var r = readAll(digits);
    if (!r.length) return '';
    return r[0].join("'") + (r[0].tail ? "'" + r[0].tail : '');
  }

  /* ============ 状态 ============ */
  var state = {
    shown: false, el: null, mode: MODE.CN9,
    base: '',        // 已上屏文本
    cursor: 0,       // 插入位置（支持在中间插入，#4）
    composing: '',   // 当前正在拼的拼音串（无空格），如 "niunailaile"
    digits: '',      // 9 键原始数字串
    segs: null,      // readAll/parseT9 结果（每种完整读法占一项）
    segIdx: 0,       // 当前选用的读法下标（分词键可循环切换）
    keyPos: 0,       // 当前读法内已上屏到第几个键（用于连续组词）
    committed: [],   // 当前读法内已上屏的字符
    candidates: [], selIdx: 0, caps: false,
    dropOpen: false, candBar: null, candList: null, dropEl: null,
    cursorMoved: false   // #4 用户是否手动移动过光标（决定默认插入点为首还是末）
  };
  var kbEl = null;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function add(parent) { for (var i = 1; i < arguments.length; i++) parent.appendChild(arguments[i]); return parent; }
  function dispatchInput() { if (state.el) state.el.dispatchEvent(new Event('input', { bubbles: true })); }
  function isCn() { return state.mode === MODE.CN9 || state.mode === MODE.CN26; }

  // 显示值 = 已提交文本 + 在光标处插入“组合显示” + 光标后的文本（支持中间插入）
  function isFieldDiv(el) { return !!el && el.tagName === 'DIV' && el.getAttribute && el.getAttribute('data-wj-field') === '1'; }
  function displayValue() {
    return state.base.slice(0, state.cursor) + composeDisplay() + state.base.slice(state.cursor);
  }
  // 把光标放到“组合文本之后”，并滚动到输入位置（最右/光标处）
  function placeCaret() {
    if (!state.el || isFieldDiv(state.el)) return;
    // 光标锚定在 state.cursor（组合预览的起点），预览之后即为光标位置。
    var pos = state.cursor, comp = composeDisplay();
    if (comp) pos = state.cursor + comp.length;
    try { state.el.setSelectionRange(pos, pos); } catch (e) {}
    try { state.el.scrollLeft = state.el.scrollWidth; } catch (e) {} // 滚到最右/输入位置
  }
  function applyValue() {
    if (!state.el) return;
    if (isFieldDiv(state.el)) {
      // 自绘 div：把“已上屏文本 + 光标处组合预览”整体渲染，光标置于组合预览之后（与 input 一致）。
      var comp = composeDisplay(), caretPos = state.cursor + comp.length;
      renderFieldDiv(state.el, displayValue(), caretPos);
    } else { state.el.value = displayValue(); placeCaret(); }
  }
  // 在光标处插入纯文本（英文/标点/空格），并推进光标
  function insertTextAtCursor(txt) {
    state.base = state.base.slice(0, state.cursor) + txt + state.base.slice(state.cursor);
    state.cursor += txt.length;
    applyValue(); dispatchInput();
  }

  /* ============ 渲染输入框中的“组合显示” ============ */
  function curSeg() {
    if (state.segs && state.segs.length) return state.segs[state.segIdx % state.segs.length] || state.segs[0];
    return null;
  }
  function composeDisplay() {
    var seg = curSeg();
    if (seg) {
      var part = seg.slice(state.keyPos);
      var d = part.length ? part.join("'") : '';
      if (seg.tail) d += (d ? "'" : '') + seg.tail;   // 保留尾部未成音节部分（如 644 -> ni'h）
      return d;
    }
    return state.composing;
  }
  // 收起/切换前，把尚未成字的不完整拼音(字母)或数字串“上屏”到 base，
  // 避免关闭后重开残留悬空 composing（如 26 键打了 “nih” 没拼完就收起）。
  function flushInput() {
    var pending = state.composing || (state.mode === MODE.CN9 ? state.digits : '');
    if (pending) { state.base = state.base.slice(0, state.cursor) + pending + state.base.slice(state.cursor); state.cursor += pending.length; }
    state.composing = ''; state.digits = '';
    state.segs = null; state.segIdx = 0; state.keyPos = 0;
    applyValue(); dispatchInput();
  }
  // 切换/收起时重置“光标移动”标记，使下次未移动时光标默认在最末（解决首插问题 #1）。
  function resetCursorHint() { state.cursorMoved = false; }

  // 根据当前模式构造“所有读法”（每项即一个完整切分）
  function buildSegs() {
    var list;
    if (state.mode === MODE.CN9) list = readAll(state.digits);
    else list = parseT9(state.composing); // 拼音模式直接对已拼字母切分
    if (!list.length) {
      // 暂无任何读法（数字过长/拼读未完成）：保留“原始待拼内容”显示，避免候选栏空白。
      var tail;
      if (state.mode === MODE.CN9) {
        var lastD = state.digits ? state.digits.charAt(state.digits.length - 1) : '';
        tail = lastD ? T9MID[lastD] : '';
      } else tail = state.composing;
      list = [[]];
      if (tail) list[0].tail = tail;
    }
    // 26 键：让“含词组”的读法排在最前（segIdx 0），这样 nihao 等词语能直接上屏。
    if (state.mode === MODE.CN26 && list.length > 1) {
      list.sort(function (a, b) { return scoreSeg(b) - scoreSeg(a); });
    }
    for (var j = 0; j < list.length; j++) {
      var s = list[j];
      s.disp = s.join("'") + (s.tail ? "'" + s.tail : '');
      s.firstKey = s[0];
    }
    return list;
  }

  // 基于当前 state.segs/segIdx/keyPos 计算候选词与输入框预览（不重建 segs）
  function recomputeCandidates() {
    var seg = curSeg();
    if (seg && state.keyPos >= seg.length) state.keyPos = 0;
    var cand = [];
    if (seg) {
      if (state.mode === MODE.CN9) {
        // 九键：把“所有读法”各自的首音节展开成候选汉字（如 426 -> 嘎/噶/哈/好/号/浩…）。
        // 点击即上屏对应汉字，尾部未成音节部分忽略。
        var seen = {};
        for (var r = 0; r < state.segs.length; r++) {
          var first = state.segs[r] && state.segs[r][0];
          if (!first || seen[first]) continue;
          seen[first] = true;
          var chs = DICT[first] || [];
          for (var ci = 0; ci < chs.length; ci++) cand.push({ disp: chs[ci], char: chs[ci] });
        }
      } else if (seg.tail) {
        // 26 键未完成拼读：尾部还不成音节（如 nih -> ni'h）。
        // 所有读法各自的首音节展开成候选汉字（你、泥…），点击即上屏，尾部 h 被忽略。
        var seen2 = {};
        for (var r2 = 0; r2 < state.segs.length; r2++) {
          var syl2 = state.segs[r2] && state.segs[r2][0];
          if (!syl2 || seen2[syl2]) continue;
          seen2[syl2] = true;
          var chs2 = DICT[syl2] || [];
          for (var ci2 = 0; ci2 < chs2.length; ci2++) cand.push({ disp: chs2[ci2], char: chs2[ci2] });
        }
      } else {
        // 26 键完整拼读：列出“所有读法”的当前音节候选（#1 多读法统一列出）。
        // 比如 niunai 可切 ni,un,ai / niu,nai / niunai 等，互不相同的首音节都展开成候选汉字。
        var seen3 = {};
        for (var r3 = 0; r3 < state.segs.length; r3++) {
          var rs = state.segs[r3];
          if (!rs || !rs.length) continue;
          var syl = rs[state.keyPos < rs.length ? state.keyPos : rs.length - 1];
          if (!syl || seen3[syl]) continue;
          seen3[syl] = true;
          var arr = (DICT[syl] || []).slice();
          arr.sort(function (a, b) {
            var pa = a.length > 1 ? 0 : 1, pb = b.length > 1 ? 0 : 1;
            if (pa !== pb) return pa - pb;
            return rankOf(a) - rankOf(b);
          });
          for (var i3 = 0; i3 < arr.length; i3++) cand.push({ disp: arr[i3], char: arr[i3] });
        }
      }
    }
    state.candidates = cand; state.selIdx = 0;
    applyValue(); renderCandidates();
  }

  function refreshCandidates() {
    if (!kbEl) return;
    if (state.mode === MODE.CN26) state.composing = state.composing.toLowerCase();
    state.segs = buildSegs();
    state.segIdx = 0; state.keyPos = 0;
    recomputeCandidates();
  }

  /* ============ 候选词点击：上屏并让剩余串继续 ============ */
  function commitCandidate(ch) {
    // 找到“产生该候选字”的读法：在当前 keyPos 位置，该读法的音节候选项里包含 ch。
    // 这样点击候选只消费对应音节，剩余字母留在 composing/digits 继续拼读（#5）。
    var seg = null, used = 0;
    if (state.segs && state.segs.length) {
      for (var s = 0; s < state.segs.length; s++) {
        var rs = state.segs[s];
        if (!rs || !rs.length) continue;
        var kp = state.keyPos < rs.length ? state.keyPos : (rs.length - 1);
        var syl = rs[kp];
        if (syl && DICT[syl] && DICT[syl].indexOf(ch) >= 0) {
          seg = rs; used = syl.length; break;
        }
      }
    }
    if (!seg) seg = curSeg();
    if (!seg) { state.digits = ''; state.composing = ''; refreshCandidates(); dispatchInput(); return; }
    if (!used) { var kp2 = state.keyPos < seg.length ? state.keyPos : (seg.length - 1); used = seg[kp2] ? seg[kp2].length : 0; }
    // 在光标处插入选中汉字，并把已消费的字母从原始串中移除（保留剩余部分继续拼读）。
    insertTextAtCursor(ch);
    if (state.mode === MODE.CN9) state.digits = (state.digits || '').slice(used);
    else state.composing = (state.composing || '').slice(used);
    state.segs = null; state.segIdx = 0; state.keyPos = 0;
    refreshCandidates(); dispatchInput();
  }

  /* ============ 输入处理 ============ */
  function typeLetter(ch) {            // 26 键 / 中文
    state.composing += ch.toLowerCase();
    state.digits = '';
    refreshCandidates();
  }
  function typeDigit(d) {              // 9 键
    state.digits += d;
    refreshCandidates();
  }
  function typePunct(p) {
    var c = (state.mode === MODE.EN && p === '.') ? '.' : p;
    if (state.mode === MODE.EN) insertTextAtCursor(c);
    else insertTextAtCursor(c);
  }
  function typeEn(ch) {                // 英文模式
    var c = state.caps ? ch.toUpperCase() : ch;
    insertTextAtCursor(c);
  }
  function onLetter(ch) {
    if (state.mode === MODE.EN) typeEn(ch);
    else if (state.mode === MODE.CN26 && state.caps) {
      // #6/#7 大写锁定：先未拼完的拼音上屏，再像英文一样直接插入大写字母（不再拼读）。
      flushInput();
      typeEn(ch);
    } else typeLetter(ch);
  }

  function backspace() {
    if (state.digits || state.composing) {
      if (state.mode === MODE.CN9) state.digits = state.digits.slice(0, -1);
      else state.composing = state.composing.slice(0, -1);
      state.segIdx = 0; state.keyPos = 0; state.segs = null;
      refreshCandidates();
    } else if (state.base) {
      state.base = state.base.slice(0, -1); applyValue(); dispatchInput();
    }
  }
  function clearAll() {
    // #2 仅清空正在拼读的内容与候选，保留已上屏文本 base 与光标位置。
    state.composing = ''; state.digits = ''; state.segs = null; state.segIdx = 0; state.keyPos = 0; state.candidates = [];
    refreshCandidates();
  }

  function onSpace() {
    if (state.mode === MODE.EN) { typeEn(' '); }
    else if (state.candidates.length) { commitCandidate(state.candidates[0].char); }
    else if (!state.composing && !state.digits) { insertTextAtCursor(' '); }  // #10 空拼读时空格上屏
  }

  // 完成：贪心把剩余拼音/数字用各自首候选填完，再收起键盘
  function finalizeAll() {
    var guard = 0;
    while ((state.digits || state.composing) && guard++ < 50) {
      var list = (state.mode === MODE.CN9) ? readAll(state.digits) : parseT9(state.composing);
      if (!list.length) break;
      var r = list[0];
      var used = 0, ok = true;
      for (var i = 0; i < r.length; i++) {
        var cand = DICT[r[i]];
        if (!cand || !cand.length) { ok = false; break; }
        state.base += cand[0]; used += r[i].length;
      }
      if (!ok || !used) break;
      if (r.tail) used += r.tail.length;   // 尾部未成音节部分一并消费
      if (state.mode === MODE.CN9) state.digits = state.digits.slice(used); else state.composing = state.composing.slice(used);
    }
    state.segs = null; state.segIdx = 0; state.keyPos = 0;
    applyValue(); dispatchInput();
  }
  function done() { finalizeAll(); hideKeyboard(); }

  function setMode(m) {
    if (state.shown) flushInput();   // 切换前把当前拼音上屏（#2）
    state.mode = m;
    if (!state.shown) return;
    state.composing = ''; state.digits = ''; state.segs = null; state.segIdx = 0; state.keyPos = 0;
    buildKeyboard(); refreshCandidates();
  }
  function cycleMode() {
    var order = [MODE.CN9, MODE.CN26, MODE.EN];
    var i = order.indexOf(state.mode);
    setMode(order[(i + 1) % order.length]);
  }
  // 分词键：在多种完整读法之间循环切换（ni / mi / nihao 等）
  function segBtn() {
    var b = el('div', 'wj-k', '分词');
    b.onclick = function () {
      if (state.segs && state.segs.length > 1) {
        state.segIdx = (state.segIdx + 1) % state.segs.length;
        state.keyPos = 0;
        recomputeCandidates();
      }
    };
    return b;
  }
  // 9 键字母组按钮：点击把对应数字累加到 digits
  function letterGroupBtn(label, digit) {
    var b = el('div', 'wj-k', label);
    b.onclick = function () { typeDigit(String(digit)); };
    return b;
  }

  /* ============ 键盘 DOM ============ */
  function grayBtn(label, fn) { var b = el('div', 'wj-k gray', label); b.onclick = fn; return b; }
  function letterBtn(ch) { var b = el('div', 'wj-k', ch); b.onclick = function () { onLetter(ch); }; return b; }
  function punctBtn(p) { var b = el('div', 'wj-k', p); b.onclick = function () { typePunct(p); }; return b; }

  function buildNine(root) {
    var grid = el('div', 'wj-grid9');
    // 第 1 行：， | 分词 | ABC | DEF | ⌫
    grid.appendChild(grayBtn('，', function () { typePunct('，'); }));
    grid.appendChild(segBtn());
    grid.appendChild(letterGroupBtn('ABC', 2));
    grid.appendChild(letterGroupBtn('DEF', 3));
    grid.appendChild(grayBtn('⌫', backspace));
    // 第 2 行：。 | GHI | JKL | MNO | 清空
    grid.appendChild(grayBtn('。', function () { typePunct('。'); }));
    grid.appendChild(letterGroupBtn('GHI', 4));
    grid.appendChild(letterGroupBtn('JKL', 5));
    grid.appendChild(letterGroupBtn('MNO', 6));
    grid.appendChild(grayBtn('清空', clearAll));
    // 第 3 行：？ | PQRS | TUV | WXYZ | 完成（跨两行）
    grid.appendChild(grayBtn('？', function () { typePunct('？'); }));
    grid.appendChild(letterGroupBtn('PQRS', 7));
    grid.appendChild(letterGroupBtn('TUV', 8));
    grid.appendChild(letterGroupBtn('WXYZ', 9));
    var doneBtn = grayBtn('完成', done); doneBtn.className = 'wj-k gray tall'; grid.appendChild(doneBtn);
    // 第 4 行：🌐(切换) | 空格(宽，跨三列) | （完成延续）
    var globe = el('div', 'wj-k emoji gray', '🌐'); globe.title = '切换输入法'; globe.onclick = cycleMode; grid.appendChild(globe);
    var spLabel = state.mode === MODE.EN ? 'space' : '空格';
    var sp = el('div', 'wj-k wide', spLabel); sp.onclick = onSpace; grid.appendChild(sp);
    root.appendChild(grid);
  }

  function buildLetters(root) {
    var box = el('div', 'wj-letters');   // 26 键主键容器（四周留白，见 CSS）
    var rows = [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['caps', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫']
    ];
    for (var r = 0; r < rows.length; r++) {
      var row = el('div', 'wj-row');
      for (var c = 0; c < rows[r].length; c++) {
        var label = rows[r][c];
        var key;
        if (label === 'caps') {
          key = el('div', 'wj-k caps', state.caps ? '▲' : '△');  // ▲ 实心 / △ 空心
          key.title = state.caps ? '大写锁定：开' : '大写锁定：关';
          key.onclick = function () { state.caps = !state.caps; buildKeyboard(); };
        } else if (label === '⌫') {
          key = el('div', 'wj-k gray', '⌫'); key.onclick = backspace;
        } else {
          // 大写开启时按键显示大写字母
          var disp = state.caps ? label.toUpperCase() : label;
          key = el('div', 'wj-k', disp); (function (ch) { key.onclick = function () { onLetter(ch); }; })(label);
        }
        row.appendChild(key);
      }
      box.appendChild(row);
    }
    // 第 4 行：🌐 | ， | 空格 | . | 完成（，。🌐 与"完成"同款灰色）
    var row4 = el('div', 'wj-row');
    var globe = el('div', 'wj-k emoji gray', '🌐'); globe.title = '切换输入法'; globe.onclick = cycleMode; row4.appendChild(globe);
    var comma = el('div', 'wj-k gray', '，'); comma.onclick = function () { typePunct('，'); }; row4.appendChild(comma);
    var spLabel = state.mode === MODE.EN ? 'space' : '空格';
    var sp = el('div', 'wj-k wide', spLabel); sp.onclick = onSpace; row4.appendChild(sp);
    var dot = el('div', 'wj-k gray', '.'); dot.onclick = function () { typePunct('.'); }; row4.appendChild(dot);
    var dn = el('div', 'wj-k gray', '完成'); dn.onclick = done; row4.appendChild(dn);
    box.appendChild(row4);
    root.appendChild(box);
  }

  function buildKeyboard() {
    if (!kbEl) return;
    kbEl.innerHTML = '';
    // 唯一的候选条（组合预览已追加到输入框 value，不再单独显示）
    state.candBar = el('div', 'wj-cands');
    var list = el('div', 'wj-candlist'); state.candList = list;
    state.candBar.appendChild(list);
    // 末尾 ▼：固定在最右边，点击【关闭输入法】（不再展开下拉）
    var drop = el('div', 'wj-dropchip', '▼'); drop.onclick = hideKeyboard;
    state.candBar.appendChild(drop);
    kbEl.appendChild(state.candBar);
    // 主键区（9 键或 26 键，已各自包含空格/完成等行）
    if (state.mode === MODE.CN9) buildNine(kbEl); else buildLetters(kbEl);
    renderCandidates();
  }

  function renderCandidates() {
    if (!state.candBar || !state.candList) return;
    state.candList.innerHTML = '';
    if (!state.candidates.length) {
      // 拼音无效 / 英文：占位提示（▼ 固定在最右，点击关闭输入法）
      var ph = el('div', 'wj-ph', state.mode === MODE.EN ? 'English' : '被被输入法');
      ph.onclick = hideKeyboard;
      state.candList.appendChild(ph);
    } else {
      for (var i = 0; i < state.candidates.length; i++) {
        (function (cand) {
          var c = el('div', 'wj-chip', cand.disp);   // 候选词条（透明背景/黑字）
          if (i === state.selIdx) c.className = 'wj-chip sel';
          c.onclick = (function (w) { return function () { commitCandidate(w); }; })(cand.char);
          state.candList.appendChild(c);
        })(state.candidates[i]);
      }
    }
  }

  /* ============ 显示 / 隐藏 ============ */
  // 键盘是 body 上的 fixed overlay（在 #os 之外）。当聚焦输入框被键盘遮挡时，
  // 通过 translateY 把整个应用 (#os) 上移，露出输入框。隐藏时复位。
  function computePush() {
    var osEl = document.getElementById('os');
    var t = state.el;
    if (!osEl || !t || !t.isConnected) { resetPush(); return; }
    var kbTop = (window.innerHeight || 0) - KB_HEIGHT;   // 键盘上沿的视口 y
    var rect = t.getBoundingClientRect();
    // 减去当前已施加的 translateY，得到“未上移”时的自然位置（#9：重聚焦时不要复位上移）。
    var cur = 0;
    if (osEl.style.transform) { var m = /translateY\((-?[\d.]+)px\)/.exec(osEl.style.transform); if (m) cur = parseFloat(m[1]) || 0; }
    var natBottom = rect.bottom - cur;
    // 输入框底部若落在键盘区域内（留 8px 余量），计算需要上移的距离
    var overflow = natBottom - kbTop + 8;
    if (overflow <= 0) return;   // 已可见：保持当前上移（不复位）
    osEl.style.transition = 'transform .18s ease';
    osEl.style.transform = 'translateY(' + (-overflow) + 'px)';
  }
  function resetPush() {
    var osEl = document.getElementById('os');
    if (osEl && osEl.style.transform) {
      osEl.style.transition = 'transform .18s ease';
      osEl.style.transform = '';
    }
  }

  // #4 自建不可编辑输入框：把文本渲染进自绘 div，并在光标处插入闪烁的光标 span。
  // caret 用 inline style（跨 Shadow DOM 也可生效，因为元素直接建在 field div 内）。
  // 占位符用 ::before+attr（不污染 textContent），保证 getFieldText 读到的就是纯文本。
  function renderFieldDiv(div, text, cursor) {
    if (!div || div.getAttribute('data-wj-field') !== '1') return;
    if (cursor < 0) cursor = 0;
    if (cursor > text.length) cursor = text.length;
    var left = text.slice(0, cursor), right = text.slice(cursor);
    var caret = '<span class="wj-caret" style="' +
      'display:inline-block;width:2px;height:1.1em;vertical-align:text-bottom;' +
      'background:#0a84ff;margin:0 -1px;animation:wj-blink 1s step-start infinite;' +
      'box-shadow:0 0 0 0.5px rgba(10,132,255,0.4);"></span>';
    if (!text) {
      // 空内容：仅放光标，占位符交给 CSS ::before（避免污染 textContent）
      div.classList.add('wj-field-empty');
      div.innerHTML = caret;
    } else {
      div.classList.remove('wj-field-empty');
      div.innerHTML = escHtml(left) + caret + escHtml(right);
    }
    // 滚到光标可见
    try { div.scrollTop = div.scrollHeight; } catch (e) {}
  }
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureKeyboard() {
    if (kbEl) return;
    var style = document.createElement('style');
    style.textContent =
      '.wj-ime{position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#eef0f3;overflow:hidden;' +
      '-webkit-tap-highlight-color:transparent;' +
      'font:18px/1 -apple-system,"PingFang SC",sans-serif;border-top:1px solid #d0d0d4;display:flex;flex-direction:column;}' +
      /* 候选条（唯一一条）：固定高度，▼ 在最右，候选词占剩余部分 */
      '.wj-cands{display:flex;flex:0 0 56px;height:56px;box-sizing:border-box;gap:10px;' +
      'padding:0 10px;background:#fff;border-bottom:1px solid #e5e5e8;align-items:center;}' +
      /* 候选词容器：占剩余空间，可横向滚动 */
      '.wj-candlist{flex:1 1 auto;display:flex;gap:10px;overflow-x:auto;align-items:center;height:100%;' +
      'scrollbar-width:none;}' +
      '.wj-candlist::-webkit-scrollbar{display:none;}' +
      /* 候选词条：默认透明背景、黑色文字；:active 浅灰背景、文字仍黑 */
      '.wj-chip{color:#111;padding:4px 12px;cursor:pointer;white-space:nowrap;font-size:24px;' +
      'background:transparent;border:none;border-radius:10px;' +
      '-webkit-tap-highlight-color:transparent;}' +
      '.wj-chip:hover{color:#111;}' +
      '.wj-chip:active{background:#d8d8d8;color:#111;}' +
      /* 当前选中项：保持透明背景、黑色文字，不加任何边框 */
      '.wj-chip.sel{background:transparent;color:#111;}' +
      /* 拼音无效 / 英文 占位 */
      '.wj-ph{flex:1;text-align:center;color:#999;font-size:22px;cursor:pointer;}' +
      /* 末尾 ▼：固定在最右边，点击关闭输入法 */
      '.wj-dropchip{flex:0 0 auto;color:#888;font-size:22px;padding:6px 12px;cursor:pointer;' +
      'background:transparent;border:1px solid transparent;border-radius:10px;user-select:none;' +
      '-webkit-tap-highlight-color:transparent;}' +
      '.wj-dropchip:active{background:#cfd6e0;}' +
      /* 主键区：4 行 5 列网格（9 键） */
      '.wj-grid9{display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(4,1fr);' +
      'gap:6px;padding:8px;flex:1;min-height:0;}' +
      /* 26 键主键容器：四周留白，与 9 键网格互不干扰 */
      '.wj-letters{flex:1;min-height:0;display:flex;flex-direction:column;padding:10px;box-sizing:border-box;}' +
      '.wj-row{display:flex;gap:4px;justify-content:center;flex:1 1 0;min-height:0;margin-bottom:4px;}' +
      '.wj-row:last-child{margin-bottom:0;}' +
      '.wj-k{display:flex;align-items:center;justify-content:center;background:#fff;' +
      'border-radius:10px;cursor:pointer;user-select:none;color:#222;font-size:24px;min-height:0;' +
      'flex:1 1 0;-webkit-tap-highlight-color:transparent;}' +
      '.wj-k:active{background:#cfd6e0;}' +  /* 点击变色反馈 */
      '.wj-k.wide{grid-column:span 3;flex:3 1 0;}' +   /* 空格跨三列 */
      '.wj-k.tall{grid-row:span 2;}' +      /* 完成跨两行 */
      '.wj-k.emoji{font-size:26px;}' +
      '.wj-k.gray{background:#e9e9ec;color:#555;}' +   /* 退格/清空/完成/符号（浅灰，更醒目） */
      '.wj-k.gray:active{background:#cfd6e0;}' +         /* 灰色键点击反馈 */
      '.wj-k.caps{font-size:28px;background:#e3e3e8;}' +
      /* 自绘 div 输入框光标闪烁 */
      '@keyframes wj-blink{0%,50%{opacity:1;}50.01%,100%{opacity:0;}}' +
      '.wj-field-empty:before{content:attr(data-wj-placeholder);color:#9a9aa0;}' +
      '.wj-caret{animation:wj-blink 1s step-start infinite;}';
    document.head.appendChild(style);

    // 必须挂在 body（在 #os 之外）：overlay 在底部，不顶起应用。
    kbEl = el('div', 'wj-ime');
    kbEl.style.display = 'none';
    kbEl.style.height = KB_HEIGHT + 'px';   // 固定高度
    document.body.appendChild(kbEl);
  }

  function showIME(target) {
    var isNew = (state.el !== target);
    state.el = target;
    ensureKeyboard();
    buildKeyboard();
    kbEl.style.display = '';
    state.shown = true;
    // #4 自绘 div：点击定位光标 + 方向键移动光标（光标可在中间任意位置插入，解决首插问题）。
    if (isFieldDiv(target)) {
      target.onclick = function (ev) { positionCaretAt(target, ev.clientX); };
      target.onkeydown = function (ev) {
        if (ev && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'Home' || ev.key === 'End')) {
          ev.preventDefault();
          var len = (state.base || '').length;
          if (ev.key === 'ArrowLeft') state.cursor = Math.max(0, state.cursor - 1);
          else if (ev.key === 'ArrowRight') state.cursor = Math.min(len, state.cursor + 1);
          else if (ev.key === 'Home') state.cursor = 0;
          else if (ev.key === 'End') state.cursor = len;
          state.cursorMoved = true;
          applyValue();
        }
      };
    }
    // 立即渲染一次（div 首屏光标；input 保持原生光标）。
    applyValue();
    // #9 仅当聚焦到“新的输入框”时才复位上移；同一输入框重聚焦（被键盘顶起后）保持上移。
    if (isNew) resetPush();
    computePush();
    refreshCandidates();
  }
  function hideKeyboard() {
    if (state.shown) flushInput();   // 收起前把未完成拼音上屏（#1）
    state.shown = false;
    if (kbEl) kbEl.style.display = 'none';
    resetPush();
    resetCursorHint();
  }

  function pageDestroyed() {
    if (!state.shown || !state.el) return false;
    if (!state.el.isConnected) return true;
    if (typeof state.el.offsetParent !== 'undefined' && state.el.offsetParent === null) return true;
    var osEl = document.getElementById('os');
    if (osEl && osEl.dataset && osEl.dataset.view === 'locked') return true;
    return false;
  }

  /* ============ 事件 ============ */
  // 受 IME 管辖的控件：普通 INPUT/TEXTAREA，或带 data-wj-field 的自绘 div。
  function isInput(t) {
    if (!t) return false;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
      return t.type !== 'checkbox' && t.type !== 'radio' && t.type !== 'button';
    }
    return t.getAttribute && t.getAttribute('data-wj-field') === '1';
  }
  // focusin 是 composed 事件：Shadow DOM 内聚焦时 e.target 会被重定位到 host，
  // 所以必须沿 composedPath() 找真正的控件（跨 Shadow DOM 探测）。
  function getInput(e) {
    var path = e.composedPath ? e.composedPath() : (e.path || []);
    for (var i = 0; i < path.length; i++) { if (isInput(path[i])) return path[i]; }
    return null;
  }
  // 自绘 div：点击任意位置把光标定位到该处（按字符数近似）。
  function positionCaretAt(el, clientX) {
    if (!isFieldDiv(el)) return;
    var rect = el.getBoundingClientRect();
    var text = state.base || '';
    if (!text) { state.cursor = 0; return; }
    var approx = Math.round(((clientX - rect.left) / rect.width) * text.length);
    if (approx < 0) approx = 0;
    if (approx > text.length) approx = text.length;
    state.cursor = approx; state.cursorMoved = true;
    applyValue();
  }
  function onFocusIn(e) {
    var t = getInput(e);
    if (t) {
      if (state.el !== t) {
        state.base = isFieldDiv(t) ? (t.textContent || '') : (t.value || '');
        state.composing = ''; state.digits = ''; state.segs = null;
        state.segIdx = 0; state.keyPos = 0; state.cursorMoved = false;
      }
      // #4 光标同步：input 用原生 selectionStart；自绘 div 默认末位（除非用户已移动）。
      state.cursor = (typeof t.selectionStart === 'number') ? t.selectionStart
        : (state.cursorMoved ? state.cursor : state.base.length);
      showIME(t);
    }
  }
  // 注意：浏览器/页面获得焦点时【不】自动关闭输入法，仅页面真正销毁才关闭
  function onFocusOut() { /* 不隐藏，保持输入法 */ }

  /* ============ 给页面/app 使用的 API ============ */
  // 清空某个输入框（自绘 div 清 textContent，input 清 value），并让 IME 内部 base 同步为空。
  function clearField(el) {
    if (!el) return;
    if (isFieldDiv(el)) { el.innerHTML = ''; el.textContent = ''; }
    else if (typeof el.value === 'string') { el.value = ''; }
    if (state.el === el) { state.base = ''; state.cursor = 0; state.cursorMoved = false; applyValue(); }
  }
  // 设定某个输入框的文本（自绘 div 用 textContent，input 用 value），并同步 IME 内部 base/光标。
  function setFieldText(el, text) {
    if (!el) return;
    text = text || '';
    if (isFieldDiv(el)) { el.textContent = text; }
    else if (typeof el.value === 'string') { el.value = text; }
    if (state.el === el) { state.base = text; state.cursor = text.length; state.cursorMoved = false; applyValue(); }
  }
  // 读取某个输入框的文本（自绘 div 取 textContent，input 取 value）。
  // 若该控件当前正被 IME 接管，返回已提交文本 state.base（不含未上屏的拼音预览）。
  function getFieldText(el) {
    if (!el) return '';
    if (state.el === el) return state.base || '';
    if (isFieldDiv(el)) return el.textContent || '';
    return el.value || '';
  }
  function hide() { hideKeyboard(); }

  function init() {
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('resize', function () { if (state.shown) { computeKBHeight(); if (kbEl) kbEl.style.height = KB_HEIGHT + 'px'; computePush(); buildKeyboard(); refreshCandidates(); } });
    var osEl = document.getElementById('os');
    if (osEl) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === 'childList') {
            var removed = m.removedNodes;
            for (var j = 0; j < removed.length; j++) {
              var n = removed[j];
              if (n === state.el || (n.contains && n.contains(state.el))) { hideKeyboard(); return; }
            }
          }
        }
        if (pageDestroyed()) hideKeyboard();
      }).observe(osEl, { attributes: true, attributeFilter: ['data-view'], childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.WJ_IME = {
    DATA: DATA, DICT: DICT, MODE: MODE,
    readAll: readAll, parseT9: parseT9, guessPinyin: guessPinyin,
    // 给 app 用的便捷接口（配合自绘 div 输入框）
    clearField: clearField, setFieldText: setFieldText, getFieldText: getFieldText, hide: hide,
    isFieldDiv: isFieldDiv
  };
})();
