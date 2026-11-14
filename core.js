/* 幕布别买大了 · 计算核心（core.js）
 * 一间屋、一个座位、一台投影机，把「能买到的幕布尺寸」一个个过四道关：
 *   ① 墙放不放得下（宽、高）；② 坐在这儿看，水平视角在不在你定的区间；
 *   ③ 投影机按投射比（镜头到幕面距离 ÷ 画面宽）要放的位置，和你能放的位置有没有交集；
 *   ④ 幕面亮度 = 实际光通量 × 增益 ÷ (π × 面积)（朗伯面近似）够不够。
 * 四关都过的里面挑最大的；想买的那个没过，给出能单独修好那一关的改法，每条回填重算。
 * 纯计算，不碰 DOM。浏览器里挂 window.AppCore，Node 里 module.exports。
 * 视角区间、亮度目标、标称流明打折都是本页的设计值，不是规范或实测。 */
(function (root) {
  'use strict';

  var EPS = 1e-9, INCH = 25.4;
  function leTol(a, b) { return a <= b * (1 + 1e-12) + 1e-12; }
  var DEG = Math.PI / 180;

  var ASPECTS = { '16:9': { r: 16 / 9, name: '16:9（电视、流媒体）' }, '2.35:1': { r: 2.35, name: '2.35:1（宽银幕电影）' }, '4:3': { r: 4 / 3, name: '4:3（老片、PPT）' } };

  var FIELDS = {
    wall: { min: 500, max: 10000, label: '墙上能放幕布的宽度 mm' },
    ceil: { min: 1800, max: 6000, label: '层高 mm' },
    topGap: { min: 0, max: 1000, label: '幕布上沿离天花板至少 mm' },
    bottom: { min: 0, max: 3000, label: '幕布下沿离地 mm' },
    V: { min: 500, max: 15000, label: '眼睛到幕布的距离 mm' },
    amin: { min: 10, max: 80, label: '视角至少 °' },
    amax: { min: 10, max: 80, label: '视角最多 °' },
    want: { min: 20, max: 300, label: '想买的尺寸 英寸' },
    gain: { min: 0.3, max: 3, label: '幕布增益' },
    trMin: { min: 0.1, max: 5, label: '投射比 最小' },
    trMax: { min: 0.1, max: 5, label: '投射比 最大' },
    lm: { min: 50, max: 20000, label: '标称亮度 ANSI 流明' },
    eff: { min: 0.1, max: 1, label: '实际亮度按标称打几折' },
    pMin: { min: 0, max: 15000, label: '镜头离幕布最近能放 mm' },
    pMax: { min: 0, max: 15000, label: '镜头离幕布最远能放 mm' },
    nits: { min: 5, max: 500, label: '想要的幕面亮度 nit' }
  };
  var KEYS = ['wall', 'ceil', 'topGap', 'bottom', 'V', 'amin', 'amax', 'want', 'gain', 'trMin', 'trMax', 'lm', 'eff', 'pMin', 'pMax', 'nits'];
  var MAX_SIZES = 20, NAME_MAX = 40;

  var BASE = {
    name: '客厅（虚构）', aspect: '16:9', sizes: '72, 80, 84, 92, 100, 110, 120, 133', want: '120',
    wall: '3600', ceil: '2700', topGap: '150', bottom: '600', V: '3000', amin: '30', amax: '40',
    gain: '1', trMin: '1.2', trMax: '1.5', lm: '2000', eff: '0.75', pMin: '2600', pMax: '3800', nits: '80'
  };
  function patch(o, p) { var s = JSON.parse(JSON.stringify(o)); Object.keys(p).forEach(function (k) { s[k] = p[k]; }); return s; }
  var PRESETS = [
    { key: 'default', name: '客厅：3 米外的沙发想上 120 寸（虚构）', note: '虚构场景：沙发到幕布 3 米，吸顶投影机 1.2–1.5 倍变焦、标称 2000 流明，吊顶能装在离幕布 2.6–3.8 米之间。视角 30°–40°、亮度目标 80 nit、标称流明打七五折都是本页的设计值，按你的屋子和机器改。', state: BASE },
    { key: 'bedroom', name: '卧室：床头放一台便携机（虚构）', note: '虚构场景：床尾墙 2.8 米宽，人靠在床头离墙 2.5 米；便携投影定焦投射比 1.2、标称 500 流明，只能放在床头柜上（离墙 2.2–2.6 米）。看看是亮度先不够，还是位置先卡住。', state: patch(BASE, { name: '卧室（虚构）', sizes: '60, 72, 80, 84, 100', want: '100', wall: '2800', ceil: '2600', topGap: '100', bottom: '500', V: '2500', trMin: '1.2', trMax: '1.2', lm: '500', eff: '0.7', pMin: '2200', pMax: '2600', nits: '50' }) },
    { key: 'ust', name: '超短焦贴墙放（虚构）', note: '虚构场景：超短焦定焦投射比 0.25，放在电视柜上，镜头离幕面只能 30–50 厘米；抗光幕增益按 0.8 算。超短焦厂家的投射比口径不一，以说明书的尺寸表为准。', state: patch(BASE, { name: '超短焦（虚构）', sizes: '80, 88, 100, 110, 120', want: '120', V: '3200', gain: '0.8', trMin: '0.25', trMax: '0.25', lm: '2500', eff: '0.75', pMin: '300', pMax: '500', nits: '80' }) }
  ];
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function defaultState() { return clone(BASE); }
  function stateFromPreset(key) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].key === key) return clone(PRESETS[i].state); return defaultState(); }
  function presetKey(state) { var t = JSON.stringify(state); for (var i = 0; i < PRESETS.length; i++) if (JSON.stringify(PRESETS[i].state) === t) return PRESETS[i].key; return null; }

  function fmtV(x, d) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var p = Math.pow(10, d), r = Math.round(x * p + (x >= 0 ? EPS : -EPS)) / p;
    if (Object.is(r, -0)) r = 0;
    return r.toFixed(d);
  }
  function parseNum(raw) {
    var t = String(raw == null ? '' : raw).trim();
    if (t === '') return { empty: true };
    if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return { nan: true };
    return { v: parseFloat(t) };
  }
  function checkField(k, raw, errors) {
    var spec = FIELDS[k], p = parseNum(raw);
    if (p.empty) { errors.push({ code: 'empty', field: k, message: spec.label + '没填' }); return null; }
    if (p.nan) { errors.push({ code: 'nan', field: k, message: spec.label + '「' + raw + '」不是数字' }); return null; }
    if (p.v < spec.min || p.v > spec.max) { errors.push({ code: 'range', field: k, message: spec.label + '要在 ' + spec.min + '–' + spec.max + ' 之间，现在是 ' + p.v }); return null; }
    return p.v;
  }

  function validate(state) {
    var errors = [], v = {};
    state = state || {};
    var nm = String(state.name == null ? '' : state.name).trim();
    if (!nm) errors.push({ code: 'name', field: 'name', message: '这间屋没起名字' });
    else if (nm.length > NAME_MAX) errors.push({ code: 'namelen', field: 'name', message: '名字超过 ' + NAME_MAX + ' 个字' });
    v.name = nm;
    if (!ASPECTS[state.aspect]) errors.push({ code: 'aspect', field: 'aspect', message: '画面比例没选' }); else v.aspect = state.aspect;
    KEYS.forEach(function (k) { var x = checkField(k, state[k], errors); if (x != null) v[k] = x; });
    if (v.amin != null && v.amax != null && !(v.amin < v.amax)) errors.push({ code: 'aorder', field: 'amax', message: '视角最多 ' + v.amax + '° 要比至少 ' + v.amin + '° 大' });
    if (v.trMin != null && v.trMax != null && v.trMin > v.trMax) errors.push({ code: 'trorder', field: 'trMax', message: '投射比最大 ' + v.trMax + ' 比最小 ' + v.trMin + ' 还小（定焦机两格填一样）' });
    if (v.pMin != null && v.pMax != null && v.pMin > v.pMax) errors.push({ code: 'porder', field: 'pMax', message: '镜头最远能放 ' + v.pMax + ' mm 比最近 ' + v.pMin + ' mm 还近' });
    if (v.ceil != null && v.topGap != null && v.bottom != null && v.bottom + v.topGap >= v.ceil) errors.push({ code: 'novert', field: 'bottom', message: '下沿 ' + v.bottom + ' mm + 上沿留空 ' + v.topGap + ' mm 已经不低于层高 ' + v.ceil + ' mm，墙上没地方挂幕布' });
    /* 尺寸清单：逗号、顿号、空格分隔的英寸数 */
    var raw = String(state.sizes == null ? '' : state.sizes).trim(), list = [];
    if (!raw) errors.push({ code: 'sizes', field: 'sizes', message: '能买到的尺寸一个都没填' });
    else {
      var bad = [];
      raw.split(/[,，、\s]+/).filter(Boolean).forEach(function (t) {
        var p = parseNum(t);
        if (p.v == null || p.v < 20 || p.v > 300) bad.push(t); else if (list.indexOf(p.v) < 0) list.push(p.v);
      });
      if (bad.length) errors.push({ code: 'sizes', field: 'sizes', message: '尺寸清单里「' + bad.slice(0, 3).join('、') + '」不是 20–300 之间的英寸数' });
      else if (list.length > MAX_SIZES) errors.push({ code: 'sizes', field: 'sizes', message: '尺寸清单最多 ' + MAX_SIZES + ' 个，现在是 ' + list.length });
    }
    list.sort(function (a, b) { return a - b; });
    v.sizes = list;
    return { errors: errors, v: v };
  }

  /* 一个尺寸过四道关。d 英寸对角线。 */
  function evalSize(v, d) {
    var r = ASPECTS[v.aspect].r, diag = d * INCH;
    var w = diag * r / Math.sqrt(r * r + 1), h = w / r;
    var area = w * h / 1e6; /* m² */
    var angle = 2 * Math.atan(w / 2 / v.V) / DEG;
    var fitW = leTol(w, v.wall), top = v.bottom + h, fitH = leTol(top, v.ceil - v.topGap);
    var aStat = angle < v.amin - 1e-9 ? 'small' : angle > v.amax + 1e-9 ? 'big' : 'ok';
    var t0 = v.trMin * w, t1 = v.trMax * w, p0 = Math.max(t0, v.pMin), p1 = Math.min(t1, v.pMax);
    var throwOk = leTol(p0, p1);
    var flux = v.lm * v.eff, nit = flux * v.gain / (Math.PI * area);
    var brightOk = nit >= v.nits * (1 - 1e-12);
    var fails = [];
    if (!fitW) fails.push('wide');
    if (!fitH) fails.push('tall');
    if (aStat === 'big') fails.push('angleBig');
    if (aStat === 'small') fails.push('angleSmall');
    if (!throwOk) fails.push(t1 < v.pMin ? 'throwNear' : 'throwFar');
    if (!brightOk) fails.push('dim');
    /* 这个尺寸合适的座位距离区间（视角在区间内） */
    var vNear = w / 2 / Math.tan(v.amax / 2 * DEG), vFar = w / 2 / Math.tan(v.amin / 2 * DEG);
    return { d: d, w: w, h: h, area: area, angle: angle, aStat: aStat, fitW: fitW, fitH: fitH, top: top, t0: t0, t1: t1, p0: p0, p1: p1, throwOk: throwOk,
      flux: flux, nit: nit, brightOk: brightOk, fails: fails, pass: fails.length === 0, vNear: vNear, vFar: vFar };
  }

  var FAIL_TEXT = {
    wide: '墙放不下', tall: '上下放不下', angleBig: '坐得太近', angleSmall: '坐得太远、显小', throwNear: '投影机得放得更近', throwFar: '投影机得放得更远', dim: '不够亮'
  };

  function ceilTo(x, s) { return Math.ceil(x / s - 1e-9) * s; }
  function floorTo(x, s) { return Math.floor(x / s + 1e-9) * s; }
  function num(x) { return String(+x.toFixed(6)); }

  /* 想买的尺寸没过：每道没过的关给一条只改一个输入的改法；回填重算确认这一关过了才给 */
  function actionsFor(state, v, wr, best) {
    var acts = [];
    function tryPatch(kind, p, text, gate) {
      var s2 = patch(state, p), o2 = compute(s2, true);
      if (!o2.ok) return;
      var r2 = o2.wantR;
      if (gate(r2)) acts.push({ kind: kind, patch: p, text: text, after: { pass: r2.pass, fails: r2.fails.slice() } });
    }
    var f = wr.fails;
    if (f.indexOf('angleBig') >= 0) {
      var vn = ceilTo(wr.vNear, 10);
      if (vn <= FIELDS.V.max) tryPatch('V', { V: num(vn) }, '往后坐到 ' + fmtV(vn, 0) + ' mm（现在 ' + v.V + '）：' + v.want + ' 寸的视角降到 ' + fmtV(2 * Math.atan(wr.w / 2 / vn) / DEG, 1) + '°', function (r) { return r.aStat === 'ok'; });
    }
    if (f.indexOf('angleSmall') >= 0) {
      var vf = floorTo(wr.vFar, 10);
      if (vf >= FIELDS.V.min) tryPatch('V', { V: num(vf) }, '往前坐到 ' + fmtV(vf, 0) + ' mm（现在 ' + v.V + '）：' + v.want + ' 寸的视角升到 ' + fmtV(2 * Math.atan(wr.w / 2 / vf) / DEG, 1) + '°', function (r) { return r.aStat === 'ok'; });
    }
    if (f.indexOf('tall') >= 0) {
      var b = floorTo(v.ceil - v.topGap - wr.h, 10);
      if (b >= 0) tryPatch('bottom', { bottom: num(b) }, '幕布下沿降到离地 ' + fmtV(b, 0) + ' mm（现在 ' + v.bottom + '）：上沿 ' + fmtV(b + wr.h, 0) + ' mm，留得出 ' + v.topGap + ' mm', function (r) { return r.fitH; });
    }
    if (f.indexOf('throwNear') >= 0) {
      var pn = floorTo(wr.t1, 10);
      tryPatch('pMin', { pMin: num(pn) }, '投影机得装得更靠近幕布：镜头离幕布 ' + fmtV(wr.t0, 0) + '–' + fmtV(wr.t1, 0) + ' mm 才投得出 ' + v.want + ' 寸，把最近能放改到 ' + fmtV(pn, 0) + ' mm（现在 ' + v.pMin + '）', function (r) { return r.throwOk; });
    }
    if (f.indexOf('throwFar') >= 0) {
      var pf = ceilTo(wr.t0, 10);
      if (pf <= FIELDS.pMax.max) tryPatch('pMax', { pMax: num(pf) }, '投影机得装得更远：镜头离幕布至少 ' + fmtV(wr.t0, 0) + ' mm 才投得出 ' + v.want + ' 寸，把最远能放改到 ' + fmtV(pf, 0) + ' mm（现在 ' + v.pMax + '）', function (r) { return r.throwOk; });
    }
    if (f.indexOf('dim') >= 0) {
      var need = v.nits * Math.PI * wr.area / (v.eff * v.gain), lmN = ceilTo(need, 100);
      if (lmN <= FIELDS.lm.max) tryPatch('lm', { lm: num(lmN) }, '换一台标称 ' + fmtV(lmN, 0) + ' 流明以上的机器（现在 ' + v.lm + '）：' + v.want + ' 寸幕面约 ' + fmtV(lmN * v.eff * v.gain / (Math.PI * wr.area), 0) + ' nit', function (r) { return r.brightOk; });
      var gN = ceilTo(v.nits * Math.PI * wr.area / (v.lm * v.eff), 0.05);
      if (gN <= FIELDS.gain.max) tryPatch('gain', { gain: num(gN) }, '或换增益 ' + fmtV(gN, 2) + ' 以上的幕布（现在 ' + v.gain + '）：幕面约 ' + fmtV(v.lm * v.eff * gN / (Math.PI * wr.area), 0) + ' nit；高增益幕布侧面看会暗', function (r) { return r.brightOk; });
    }
    if (best && best.d < v.want) tryPatch('want', { want: num(best.d) }, '换成清单里四关都过的最大号：' + num(best.d) + ' 寸', function (r) { return r.pass; });
    return acts;
  }

  function compute(state, noActions) {
    var val = validate(state);
    if (val.errors.length) return { ok: false, errors: val.errors };
    var v = val.v;
    var rows = v.sizes.map(function (d) { return evalSize(v, d); });
    var wantR = evalSize(v, v.want);
    var passing = rows.filter(function (r) { return r.pass; });
    var best = passing.length ? passing[passing.length - 1] : null;
    var warnings = [];
    if (v.eff >= 1) warnings.push({ code: 'eff', message: '标称流明按原样算了：家用机实际出光常比标称低，校色后的模式更低，建议打个折' });
    if (wantR.fails.indexOf('wide') >= 0) warnings.push({ code: 'wide', message: v.want + ' 寸画面宽 ' + fmtV(wantR.w, 0) + ' mm，比墙上能放的 ' + v.wall + ' mm 还宽：这一关只能换小，墙挪不了' });
    if (v.trMin === v.trMax) warnings.push({ code: 'fixed', message: '定焦机（投射比 ' + v.trMin + '）：画面多大全看机器放多远，没有变焦余地' });
    if (passing.length === 0) warnings.push({ code: 'none', message: '清单里没有一个尺寸四关全过：先看下面每个尺寸卡在哪一关' });
    var out = { ok: true, v: v, rows: rows, wantR: wantR, best: best ? best.d : null, bestR: best, warnings: warnings, actions: [] };
    if (!noActions && !wantR.pass) out.actions = actionsFor(state, v, wantR, best);
    return out;
  }
  function applyAction(state, a) { return patch(state, a.patch); }

  function failText(r) { return r.pass ? '四关都过' : r.fails.map(function (k) { return FAIL_TEXT[k]; }).join('、'); }

  function csvCell(x) { var t = String(x == null ? '' : x); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
  function rowCells(r) {
    return [r.d, fmtV(r.w, 0), fmtV(r.h, 0), fmtV(r.angle, 1), fmtV(r.vNear, 0) + '–' + fmtV(r.vFar, 0), r.fitW ? '是' : '否', r.fitH ? '是' : '否',
      fmtV(r.t0, 0) + '–' + fmtV(r.t1, 0), r.throwOk ? fmtV(r.p0, 0) + '–' + fmtV(r.p1, 0) : '无', fmtV(r.nit, 0), failText(r)];
  }
  function toCSV(out, stamp) {
    var L = [['幕布别买大了', '导出 ' + stamp, '默认场景为虚构示例']];
    if (!out.ok) { L.push(['还算不出来']); out.errors.forEach(function (e) { L.push([e.message]); }); return L.map(function (r) { return r.map(csvCell).join(','); }).join('\n') + '\n'; }
    var v = out.v;
    L.push(['屋子', v.name, '比例', v.aspect, '座位距离 mm', v.V, '视角区间 °', v.amin + '–' + v.amax, '投射比', v.trMin + '–' + v.trMax, '能放 mm', v.pMin + '–' + v.pMax, '标称流明', v.lm, '打折', v.eff, '增益', v.gain, '目标 nit', v.nits]);
    L.push(['结论', out.best == null ? '清单里没有四关全过的尺寸' : '四关都过的最大号 ' + out.best + ' 寸', '想买的 ' + v.want + ' 寸', failText(out.wantR)]);
    L.push(['英寸', '画面宽 mm', '画面高 mm', '水平视角 °', '这个尺寸合适的座位 mm', '墙放得下', '上下放得下', '投影机要放 mm', '和能放的交集 mm', '幕面亮度 nit', '结果']);
    out.rows.forEach(function (r) { L.push(rowCells(r)); });
    if (out.rows.every(function (r) { return r.d !== v.want; })) { L.push(['（想买的，不在清单里）']); L.push(rowCells(out.wantR)); }
    if (out.actions.length) { L.push([]); L.push(['改法']); out.actions.forEach(function (a) { L.push([a.text]); }); }
    return L.map(function (r) { return r.map(csvCell).join(','); }).join('\n') + '\n';
  }
  function toMD(out, stamp) {
    var L = ['# 幕布别买大了', '', '导出时间 ' + stamp + '。默认场景为虚构示例；视角区间、亮度目标、标称流明打折都是可改的设计值，不是实测或规范。', ''];
    if (!out.ok) { L.push('## 还算不出来', ''); out.errors.forEach(function (e) { L.push('- ' + e.message); }); return L.join('\n') + '\n'; }
    var v = out.v, w = out.wantR;
    L.push('## 结论', '');
    L.push('- ' + v.name + '，' + v.aspect + '，眼睛离幕布 ' + v.V + ' mm：' + (out.best == null ? '清单里没有四关全过的尺寸。' : '四关都过的最大号是 **' + out.best + ' 寸**。'));
    L.push('- 想买的 ' + v.want + ' 寸：' + (w.pass ? '四关都过。' : '没过：' + failText(w) + '。'));
    L.push('- ' + v.want + ' 寸画面 ' + fmtV(w.w, 0) + ' × ' + fmtV(w.h, 0) + ' mm，视角 ' + fmtV(w.angle, 1) + '°（合适的座位 ' + fmtV(w.vNear, 0) + '–' + fmtV(w.vFar, 0) + ' mm），投影机要放 ' + fmtV(w.t0, 0) + '–' + fmtV(w.t1, 0) + ' mm，幕面约 ' + fmtV(w.nit, 0) + ' nit。', '');
    L.push('## 每个尺寸过了几关', '', '| 英寸 | 宽×高 mm | 视角 | 投影机要放 mm | 亮度 nit | 结果 |', '|---|---|---|---|---|---|');
    out.rows.forEach(function (r) { L.push('| ' + r.d + ' | ' + fmtV(r.w, 0) + '×' + fmtV(r.h, 0) + ' | ' + fmtV(r.angle, 1) + '° | ' + fmtV(r.t0, 0) + '–' + fmtV(r.t1, 0) + ' | ' + fmtV(r.nit, 0) + ' | ' + failText(r) + ' |'); });
    L.push('');
    if (out.actions.length) { L.push('## 改法（每条都回填重算过）', ''); out.actions.forEach(function (a) { L.push('- ' + a.text); }); L.push(''); }
    if (out.warnings.length) { L.push('## 提醒', ''); out.warnings.forEach(function (x) { L.push('- ' + x.message); }); L.push(''); }
    return L.join('\n') + '\n';
  }

  var API = {
    ASPECTS: ASPECTS, FIELDS: FIELDS, KEYS: KEYS, PRESETS: PRESETS, MAX_SIZES: MAX_SIZES, NAME_MAX: NAME_MAX, FAIL_TEXT: FAIL_TEXT,
    defaultState: defaultState, stateFromPreset: stateFromPreset, presetKey: presetKey, fmtV: fmtV, parseNum: parseNum,
    validate: validate, evalSize: evalSize, compute: compute, applyAction: applyAction, failText: failText, toCSV: toCSV, toMD: toMD
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  root.AppCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
