/* 幕布别买大了 · 界面（ui.js）
 * 把输入读成 state → 交给 AppCore.compute → 把同一次输出画出来。页面不自己算数。
 * 表单只在换预设 / 恢复 / 点改法时整体回填；打字时只刷新结果，不丢光标。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'screen-fit:v1';
  var $ = function (id) { return document.getElementById(id); };
  var ALLK = ['name', 'aspect', 'sizes'].concat(A.KEYS);
  var state = load() || A.defaultState();
  var out = null;
  var f0 = function (x) { return A.fmtV(x, 0); }, f1 = function (x) { return A.fmtV(x, 1); };

  function str(v) { return String(v == null ? '' : v); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState(), any = false;
    ALLK.forEach(function (k) { if (s[k] != null && typeof s[k] !== 'object') { d[k] = str(s[k]); any = true; } });
    return any ? d : null;
  }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return sanitize(j && j.state); } catch (e) { return null; } }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state })); $('saveTag').textContent = '· 已存到本机'; }
    catch (e) { $('saveTag').textContent = '· 没能存到本机'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  $('aspect').innerHTML = Object.keys(A.ASPECTS).map(function (k) { return '<option value="' + k + '">' + esc(A.ASPECTS[k].name) + '</option>'; }).join('');

  function renderPresets() {
    var k = A.presetKey(state);
    $('presets').innerHTML = A.PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (k === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = A.PRESETS.filter(function (p) { return p.key === k; })[0];
    $('presetNote').textContent = cur ? cur.note : '已按你的输入计算（不是预设）。';
  }
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = A.stateFromPreset(b.getAttribute('data-p')); fill(); update(); });

  function fill() { ALLK.forEach(function (k) { $(k).value = state[k]; }); }
  $('form').addEventListener('input', function (e) { var k = e.target.getAttribute('data-k'); if (!k || e.target.tagName === 'SELECT') return; state[k] = e.target.value; update(); });
  $('form').addEventListener('change', function (e) { var k = e.target.getAttribute('data-k'); if (!k || e.target.tagName !== 'SELECT') return; state[k] = e.target.value; update(); });

  function markErrors() {
    document.querySelectorAll('.f.bad').forEach(function (f) { f.classList.remove('bad'); });
    (out.errors || []).forEach(function (e) { if ($('f_' + e.field)) $('f_' + e.field).classList.add('bad'); });
  }

  /* 表：列 = 尺寸（想买的不在清单里就补一列），行 = 画面 / 四关 / 结果 */
  function cols() {
    var c = out.rows.slice();
    if (c.every(function (r) { return r.d !== out.v.want; })) { c.push(out.wantR); c.sort(function (a, b) { return a.d - b.d; }); }
    return c;
  }
  function cell(ok, main, sub) { return '<td class="' + (ok ? 'y' : 'x') + '">' + main + (sub ? '<small>' + sub + '</small>' : '') + '</td>'; }
  function renderTable() {
    var v = out.v, c = cols();
    var cls = function (r) { return (r.d === v.want ? ' wantcol' : '') + (out.best === r.d ? ' bestcol' : ''); };
    var h = '<thead><tr><th>尺寸</th>' + c.map(function (r) { return '<th class="' + cls(r) + '" id="col_' + r.d + '">' + r.d + ' 寸' + (out.rows.indexOf(r) < 0 ? '<small>不在清单</small>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    h += '<tr><td>画面 宽×高 mm</td>' + c.map(function (r) { return '<td>' + f0(r.w) + '×' + f0(r.h) + '</td>'; }).join('') + '</tr>';
    h += '<tr id="row_wall"><td>① 墙放得下</td>' + c.map(function (r) { var ok = r.fitW && r.fitH; return cell(ok, ok ? '✓' : (!r.fitW ? '宽了 ' + f0(r.w - v.wall) : '高了 ' + f0(r.top - (v.ceil - v.topGap))), '上沿离地 ' + f0(r.top)); }).join('') + '</tr>';
    h += '<tr id="row_angle"><td>② 视角 ' + v.amin + '°–' + v.amax + '°</td>' + c.map(function (r) { return cell(r.aStat === 'ok', f1(r.angle) + '°', r.aStat === 'big' ? '太近' : r.aStat === 'small' ? '太远' : '坐 ' + f0(r.vNear) + '–' + f0(r.vFar)); }).join('') + '</tr>';
    h += '<tr id="row_throw"><td>③ 投影机放得到</td>' + c.map(function (r) { return cell(r.throwOk, f0(r.t0) + (r.t1 > r.t0 + 0.5 ? '–' + f0(r.t1) : ''), r.throwOk ? '放在 ' + f0(r.p0) + (r.p1 > r.p0 + 0.5 ? '–' + f0(r.p1) : '') : r.t1 < v.pMin ? '得更近' : '得更远'); }).join('') + '</tr>';
    h += '<tr id="row_nit"><td>④ 亮度 ≥ ' + v.nits + ' nit</td>' + c.map(function (r) { return cell(r.brightOk, f0(r.nit) + ' nit'); }).join('') + '</tr>';
    h += '<tr class="sum"><td>结果</td>' + c.map(function (r) { return cell(r.pass, r.pass ? '四关都过' : r.fails.length + ' 关没过'); }).join('') + '</tr></tbody>';
    $('cmp').innerHTML = h;
  }

  /* 墙面正视图：墙、天花板留空、各尺寸外框（灰）、想买的（蓝）、最大号（绿） */
  function wallView() {
    var v = out.v, W = 440, H = 300, pad = 20, c = cols();
    var maxW = Math.max(v.wall, out.wantR.w, c[c.length - 1].w), maxH = Math.max(v.ceil, out.wantR.top, c[c.length - 1].top);
    var sc = Math.min((W - 2 * pad) / maxW, (H - 2 * pad - 20) / maxH);
    var ox = (W - v.wall * sc) / 2, fy = H - pad - 10; /* 地面 y */
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#faf9f6"/>';
    s += '<rect x="' + ox.toFixed(1) + '" y="' + (fy - v.ceil * sc).toFixed(1) + '" width="' + (v.wall * sc).toFixed(1) + '" height="' + (v.ceil * sc).toFixed(1) + '" fill="#efece4" stroke="#b9b4a8"/>';
    s += '<rect x="' + ox.toFixed(1) + '" y="' + (fy - v.ceil * sc).toFixed(1) + '" width="' + (v.wall * sc).toFixed(1) + '" height="' + (v.topGap * sc).toFixed(1) + '" fill="#e2ddd2"/>';
    s += '<line x1="0" y1="' + fy + '" x2="' + W + '" y2="' + fy + '" stroke="#9a958a" stroke-width="2"/>';
    var cx = ox + v.wall * sc / 2;
    function box(r, stroke, wdt, dash, fill) {
      return '<rect x="' + (cx - r.w * sc / 2).toFixed(1) + '" y="' + (fy - r.top * sc).toFixed(1) + '" width="' + (r.w * sc).toFixed(1) + '" height="' + (r.h * sc).toFixed(1) + '" fill="' + (fill || 'none') + '" stroke="' + stroke + '" stroke-width="' + wdt + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
    }
    c.forEach(function (r) { if (r.d !== v.want && r.d !== out.best) s += box(r, '#c9c4b9', 1, '3 3'); });
    if (out.bestR) s += box(out.bestR, '#2c6a48', 2.5, '', 'rgba(44,106,72,.10)');
    s += box(out.wantR, out.wantR.pass ? '#3b4a6b' : '#b13a2b', 2.5, '6 4');
    s += '<text x="' + (W / 2) + '" y="' + (H - 6) + '" font-size="13" text-anchor="middle" fill="#4c505a">墙宽 ' + v.wall + ' mm · 层高 ' + v.ceil + ' mm</text>';
    $('wallSvg').innerHTML = s;
    $('wallNote').textContent = (out.bestR ? '绿框 = 四关都过的最大号 ' + out.best + ' 寸；' : '清单里没有四关都过的尺寸；') + '虚线框 = 想买的 ' + v.want + ' 寸' + (out.wantR.pass ? '（过）' : '（没过）') + '；顶上深色条是要留的 ' + v.topGap + ' mm。';
  }
  /* 侧视图：左墙幕布，座位眼睛与视角线，吊顶可装区间（黄条）与投影机要放的区间（蓝条） */
  function sideView() {
    var v = out.v, r = out.wantR, W = 440, H = 300, pad = 24;
    var depth = Math.max(v.V, r.t1, v.pMax, 1000) * 1.08;
    var sc = Math.min((W - 2 * pad) / depth, (H - 2 * pad - 30) / v.ceil);
    var x0 = pad, fy = H - pad - 16, X = function (mm) { return x0 + mm * sc; }, Y = function (mm) { return fy - mm * sc; };
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#faf9f6"/>';
    s += '<line x1="' + x0 + '" y1="' + fy + '" x2="' + (W - 6) + '" y2="' + fy + '" stroke="#9a958a" stroke-width="2"/>';
    s += '<line x1="' + x0 + '" y1="' + Y(v.ceil).toFixed(1) + '" x2="' + (W - 6) + '" y2="' + Y(v.ceil).toFixed(1) + '" stroke="#9a958a" stroke-width="2"/>';
    s += '<line x1="' + x0 + '" y1="' + fy + '" x2="' + x0 + '" y2="' + Y(v.ceil).toFixed(1) + '" stroke="#9a958a" stroke-width="3"/>';
    s += '<line x1="' + (x0 + 3) + '" y1="' + Y(v.bottom).toFixed(1) + '" x2="' + (x0 + 3) + '" y2="' + Y(Math.min(r.top, v.ceil + 300)).toFixed(1) + '" stroke="' + (r.fitH ? '#3b4a6b' : '#b13a2b') + '" stroke-width="6"/>';
    var eye = Math.min(v.ceil - 50, 1100), mid = v.bottom + r.h / 2;
    /* 视角线：眼睛到幕布上下沿（侧视看的是竖直视角，用来示意，结论按水平视角） */
    s += '<path d="M' + X(v.V).toFixed(1) + ' ' + Y(eye).toFixed(1) + ' L' + (x0 + 3) + ' ' + Y(v.bottom).toFixed(1) + ' M' + X(v.V).toFixed(1) + ' ' + Y(eye).toFixed(1) + ' L' + (x0 + 3) + ' ' + Y(r.top).toFixed(1) + '" stroke="#878a92" stroke-dasharray="4 4" fill="none"/>';
    s += '<circle cx="' + X(v.V).toFixed(1) + '" cy="' + Y(eye).toFixed(1) + '" r="6" fill="' + (r.aStat === 'ok' ? '#2c6a48' : '#b13a2b') + '"/>';
    s += '<text x="' + X(v.V).toFixed(1) + '" y="' + (Y(eye) + 22).toFixed(1) + '" font-size="12.5" text-anchor="middle" fill="#4c505a">眼睛 ' + v.V + '</text>';
    /* 能装的区间（黄）与要放的区间（蓝） */
    var yc = Y(v.ceil) + 10;
    s += '<rect x="' + X(v.pMin).toFixed(1) + '" y="' + yc.toFixed(1) + '" width="' + Math.max(2, (v.pMax - v.pMin) * sc).toFixed(1) + '" height="8" fill="#f2c14e"/>';
    s += '<rect x="' + X(r.t0).toFixed(1) + '" y="' + (yc + 12).toFixed(1) + '" width="' + Math.max(3, (r.t1 - r.t0) * sc).toFixed(1) + '" height="8" fill="' + (r.throwOk ? '#3b4a6b' : '#b13a2b') + '"/>';
    if (r.throwOk) {
      var px = X((r.p0 + r.p1) / 2);
      s += '<path d="M' + px.toFixed(1) + ' ' + (yc + 24).toFixed(1) + ' L' + (x0 + 3) + ' ' + Y(r.top).toFixed(1) + ' L' + (x0 + 3) + ' ' + Y(v.bottom).toFixed(1) + ' Z" fill="rgba(242,193,78,.22)"/>';
    }
    s += '<text x="' + (W - 8) + '" y="' + (yc + 42).toFixed(1) + '" font-size="12" text-anchor="end" fill="#4c505a">黄 = 能装 ' + v.pMin + '–' + v.pMax + ' · ' + (r.throwOk ? '蓝' : '红') + ' = ' + v.want + ' 寸要放 ' + f0(r.t0) + (r.t1 > r.t0 + 0.5 ? '–' + f0(r.t1) : '') + '</text>';
    s += '<text x="' + (W / 2) + '" y="' + (H - 4) + '" font-size="12.5" text-anchor="middle" fill="#4c505a">离幕布的距离（mm），按 1 : ' + f0(1 / sc) + ' 画</text>';
    $('sideSvg').innerHTML = s;
    $('sideNote').textContent = '眼睛高度按 ' + eye + ' mm 示意；结论按水平视角 ' + f1(r.angle) + '° 判，竖直方向只画不判。';
  }

  function render() {
    var bad = !out.ok;
    $('errBox').classList.toggle('hide', !bad);
    $('resCard').classList.toggle('hide', bad);
    $('viewCard').classList.toggle('hide', bad);
    if (bad) { $('errBox').innerHTML = '<b>还算不出来</b>，先把这些改对（原文都保留着）：<ul>' + out.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    var v = out.v, w = out.wantR, b = out.bestR;
    $('vBest').innerHTML = b ? '<div class="k">四关都过的最大号</div><div class="n" id="bestN">' + out.best + ' 寸</div><div class="d">' + f0(b.w) + ' × ' + f0(b.h) + ' mm · 视角 ' + f1(b.angle) + '° · ' + f0(b.nit) + ' nit · 投影机放 ' + f0(b.p0) + (b.p1 > b.p0 + 0.5 ? '–' + f0(b.p1) : '') + ' mm</div>'
      : '<div class="k">四关都过的最大号</div><div class="n" id="bestN">没有</div><div class="d">清单里每个尺寸都至少卡一关，看下表卡在哪。</div>';
    $('vWant').className = 'vb want' + (w.pass ? '' : ' no');
    $('vWant').innerHTML = '<div class="k">想买的 ' + v.want + ' 寸</div><div class="n" id="wantN">' + (w.pass ? '✓ 四关都过' : '✗ ' + esc(A.failText(w))) + '</div><div class="d">' + f0(w.w) + ' × ' + f0(w.h) + ' mm · 视角 ' + f1(w.angle) + '°（坐 ' + f0(w.vNear) + '–' + f0(w.vFar) + ' mm 合适）· ' + f0(w.nit) + ' nit · 投影机要放 ' + f0(w.t0) + (w.t1 > w.t0 + 0.5 ? '–' + f0(w.t1) : '') + ' mm</div>';
    $('actsBlock').classList.toggle('hide', !out.actions.length);
    $('acts').innerHTML = out.actions.map(function (a, i) {
      return '<button type="button" class="act" id="act_' + a.kind + '" data-a="' + i + '">→ ' + esc(a.text) + '<small>改完：' + (a.after.pass ? (a.patch.want || v.want) + ' 寸四关都过' : '这一关过了，还剩 ' + a.after.fails.map(function (k) { return A.FAIL_TEXT[k]; }).join('、')) + '</small></button>';
    }).join('');
    $('warnBox').classList.toggle('hide', !out.warnings.length);
    $('warnBox').innerHTML = '<ul>' + out.warnings.map(function (x) { return '<li>' + esc(x.message) + '</li>'; }).join('') + '</ul>';
    renderTable(); wallView(); sideView();
  }
  $('acts').addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (!b) return; state = A.applyAction(state, out.actions[+b.getAttribute('data-a')]); fill(); update(); });

  function update() { out = A.compute(state); markErrors(); render(); renderPresets(); save(); }

  /* ── 导出 ── */
  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  $('dlCsv').addEventListener('click', function () { download('幕布别买大了.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { download('幕布别买大了.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('幕布别买大了-备份.json', new Blob([JSON.stringify({ app: '幕布别买大了', slug: 'screen-fit', version: 1, exported_at: stamp(), state: state, out: out }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { importText(String(r.result)); }; r.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    state = s; fill(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); fill(); update(); });

  /* PNG 对照卡 1080×1350：所有文字取自 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var F = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', M = 'ui-monospace,Menlo,Consolas,monospace';
    g.fillStyle = '#f1efea'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff'; g.fillRect(56, 48, W - 112, H - 96);
    var L = 104, R = W - 104, maxW = R - L, y = 136;
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function text(t, size, color, bold, font) { g.font = (bold ? '700 ' : '') + size + 'px ' + (font || F); g.fillStyle = color; g.fillText(clip(t, maxW), L, y); }
    text('幕布别买大了 · 尺寸对照', 50, '#1d1f24', true); y += 44;
    text('导出 ' + stamp() + ' · 默认场景为虚构示例', 22, '#878a92'); y += 40;
    if (!out.ok) {
      y += 20; text('还算不出来', 44, '#b13a2b', true); y += 60;
      out.errors.slice(0, 14).forEach(function (e) { text('· ' + e.message, 25, '#4c505a'); y += 40; });
      return cv;
    }
    var v = out.v, w = out.wantR;
    text(v.name + ' · ' + v.aspect + ' · 眼睛离幕布 ' + v.V + ' mm', 26, '#4c505a'); y += 64;
    /* 两块结论 */
    var bw = (maxW - 24) / 2;
    g.fillStyle = out.best == null ? '#f8e1dc' : '#e1efe6'; g.fillRect(L, y - 40, bw, 150);
    g.fillStyle = w.pass ? '#e5e9f2' : '#f8e1dc'; g.fillRect(L + bw + 24, y - 40, bw, 150);
    g.font = '24px ' + F; g.fillStyle = '#4c505a'; g.fillText('四关都过的最大号', L + 20, y); g.fillText('想买的 ' + v.want + ' 寸', L + bw + 44, y);
    g.font = '700 56px ' + F; g.fillStyle = out.best == null ? '#b13a2b' : '#2c6a48'; g.fillText(out.best == null ? '没有' : out.best + ' 寸', L + 20, y + 70);
    /* 想买的没过：字号从 34 往下缩到放得下（最小 22），还放不下就按「、」拆两行 */
    var wt = w.pass ? '✓ 四关都过' : '✗ ' + A.failText(w), fs = w.pass ? 44 : 34;
    g.fillStyle = w.pass ? '#3b4a6b' : '#b13a2b';
    while (fs > 22) { g.font = '700 ' + fs + 'px ' + F; if (g.measureText(wt).width <= bw - 40) break; fs -= 2; }
    g.font = '700 ' + fs + 'px ' + F;
    if (g.measureText(wt).width <= bw - 40) g.fillText(wt, L + bw + 44, y + 66);
    else { var parts = wt.split('、'), h1 = Math.ceil(parts.length / 2); g.fillText(clip(parts.slice(0, h1).join('、') + '、', bw - 40), L + bw + 44, y + 40); g.fillText(clip(parts.slice(h1).join('、'), bw - 40), L + bw + 44, y + 70); }
    g.font = '21px ' + F; g.fillStyle = '#4c505a';
    if (out.bestR) g.fillText(clip(f0(out.bestR.w) + '×' + f0(out.bestR.h) + ' mm · ' + f1(out.bestR.angle) + '° · ' + f0(out.bestR.nit) + ' nit', bw - 40), L + 20, y + 98);
    g.fillText(clip(f0(w.w) + '×' + f0(w.h) + ' mm · ' + f1(w.angle) + '° · ' + f0(w.nit) + ' nit', bw - 40), L + bw + 44, y + 98);
    y += 150;
    /* 表：最多 8 列 */
    /* 超过 8 列：必留想买的和最大号，其余按离想买的尺寸最近的补满（不是取最大的几个） */
    var c = cols(), dropped = 0;
    if (c.length > 8) {
      var keep = c.filter(function (r) { return r.d === v.want || r.d === out.best; });
      var rest = c.filter(function (r) { return keep.indexOf(r) < 0; }).sort(function (a, b) { return Math.abs(a.d - v.want) - Math.abs(b.d - v.want) || a.d - b.d; });
      dropped = c.length - 8; c = keep.concat(rest.slice(0, 8 - keep.length)).sort(function (a, b) { return a.d - b.d; });
    }
    var lab = 190, cw = (maxW - lab) / c.length, rows = [
      ['尺寸', function (r) { return [r.d + ' 寸', null]; }],
      ['墙放得下', function (r) { return [r.fitW && r.fitH ? '✓' : '✗', r.fitW && r.fitH]; }],
      ['视角', function (r) { return [f1(r.angle) + '°', r.aStat === 'ok']; }],
      ['投影机', function (r) { return [r.throwOk ? '✓' : r.t1 < v.pMin ? '要更近' : '要更远', r.throwOk]; }],
      ['亮度 nit', function (r) { return [f0(r.nit), r.brightOk]; }],
      ['结果', function (r) { return [r.pass ? '过' : r.fails.length + ' 关没过', r.pass]; }]
    ];
    rows.forEach(function (row, ri) {
      var yy = y + ri * 62;
      g.font = '22px ' + F; g.fillStyle = '#4c505a'; g.textAlign = 'left'; g.fillText(row[0], L, yy + 40);
      c.forEach(function (r, ci) {
        var x = L + lab + ci * cw, cv2 = row[1](r);
        if (cv2[1] === true) { g.fillStyle = '#e1efe6'; g.fillRect(x + 3, yy + 6, cw - 6, 52); }
        if (cv2[1] === false) { g.fillStyle = '#f8e1dc'; g.fillRect(x + 3, yy + 6, cw - 6, 52); }
        g.font = (ri === 0 ? '700 ' : '') + (cw < 100 ? 18 : 22) + 'px ' + (ri === 4 ? M : F);
        g.fillStyle = cv2[1] === false ? '#b13a2b' : cv2[1] === true ? '#2c6a48' : '#1d1f24'; g.textAlign = 'center';
        g.fillText(clip(cv2[0], cw - 10), x + cw / 2, yy + 40);
      });
    });
    c.forEach(function (r, ci) {
      var x = L + lab + ci * cw;
      if (r.d === v.want) { g.strokeStyle = '#3b4a6b'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, cw - 4, rows.length * 62); }
      if (r.d === out.best) { g.fillStyle = '#2c6a48'; g.fillRect(x + 3, y + rows.length * 62 + 6, cw - 6, 8); }
    });
    g.textAlign = 'left';
    if (dropped) { g.font = '20px ' + F; g.fillStyle = '#878a92'; g.fillText('另有 ' + dropped + ' 个尺寸离想买的较远，没画进来，见 CSV', L, y + rows.length * 62 + 44); }
    y += rows.length * 62 + 60 + (dropped ? 24 : 0);
    if (out.actions.length) {
      g.strokeStyle = '#e0ddd6'; g.lineWidth = 2; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); y += 46;
      text('想买的 ' + v.want + ' 寸这样改（每条只改一项）', 27, '#1d1f24', true); y += 46;
      out.actions.forEach(function (a) {
        if (y > H - 170) return;
        g.font = '22px ' + F; g.fillStyle = '#24314f';
        /* 按字宽折两行 */
        /* 按词折行：数字串连同单位不拆（批次 67 的教训），标点粘在前一个词上 */
        var toks = ('→ ' + a.text).match(/[0-9.]+ ?(?:mm|nit|°|寸)?|[A-Za-z]+|\s|./g) || [], lines = [], cur = '';
        toks.forEach(function (tk) {
          if (cur && /^[，。、；：）%,.;:)]$/.test(tk)) { cur += tk; return; }
          if (cur && g.measureText(cur + tk).width > maxW) { lines.push(cur); cur = /^\s$/.test(tk) ? '' : tk; } else cur += tk;
        });
        lines.push(cur);
        if (lines.length > 2) { lines = lines.slice(0, 2); lines[1] = clip(lines[1] + '…', maxW); }
        lines.forEach(function (l) { g.fillText(l, L, y); y += 32; }); y += 10;
      });
    }
    /* 剩下的空白写「按最大号怎么装」：座位区间与投影机位置都取自同一次 out */
    if (out.bestR && y < H - 72 - 230) {
      var b = out.bestR;
      g.strokeStyle = '#e0ddd6'; g.lineWidth = 2; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); y += 46;
      text('按 ' + out.best + ' 寸装', 27, '#1d1f24', true); y += 40;
      [['幕布', f0(b.w) + ' × ' + f0(b.h) + ' mm，下沿离地 ' + v.bottom + '，上沿离地 ' + f0(b.top) + ' mm'],
       ['座位', '眼睛离幕布 ' + f0(b.vNear) + '–' + f0(b.vFar) + ' mm 视角都在 ' + v.amin + '°–' + v.amax + '°（现在 ' + v.V + '）'],
       ['投影机', '镜头离幕布 ' + f0(b.p0) + (b.p1 > b.p0 + 0.5 ? '–' + f0(b.p1) : '') + ' mm（镜头要 ' + f0(b.t0) + '–' + f0(b.t1) + '，你能装 ' + v.pMin + '–' + v.pMax + '）'],
       ['亮度', '约 ' + f0(b.nit) + ' nit（目标 ' + v.nits + '；实际 ' + f0(b.flux) + ' lm × 增益 ' + v.gain + '）']].forEach(function (kv) {
        g.font = '700 22px ' + F; g.fillStyle = '#2c6a48'; g.fillText(kv[0], L, y);
        g.font = '22px ' + F; g.fillStyle = '#4c505a'; g.fillText(clip(kv[1], maxW - 110), L + 110, y); y += 34;
      });
    }
    g.font = '21px ' + F; g.fillStyle = '#878a92';
    g.fillText(clip('视角、亮度目标和流明打折都是可改的设计值；估算，不是实测', maxW), L, H - 72);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (b) { if (b) download('幕布别买大了-1080x1350.png', b); }, 'image/png'); });

  window.__screenUi = { state: function () { return JSON.parse(JSON.stringify(state)); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };

  fill(); update();
})();
