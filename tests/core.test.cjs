/* 幕布别买大了 · 核心测试。node --test tests/core.test.cjs
 * 锚点来自 evidence/手算锚点.py（Python decimal 50 位、不读 core.js）。
 * 最后一组把错误注入源码再跑同一批锚点，确认锚点够尖。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../core.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8');
const RAND = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'evidence', '随机对拍.json'), 'utf8'));
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) * Math.max(1, Math.abs(b));
const S = (p) => Object.assign(C.defaultState(), p || {});

function load(src) { const sb = { module: { exports: {} } }; sb.globalThis = sb; vm.runInNewContext(src, sb); return sb.module.exports; }

/* 返回 null 表示全部锚点通过 */
function anchors(M) {
  const o = M.compute(M.defaultState());
  if (!o.ok) return '默认算不出来';
  const exp = { 72: [1593.9373, 896.5898, 29.7547, 1912.7248, 2390.9060, 334.0999], 92: [2036.6977, 1145.6425, 37.4995, 2444.0373, 3055.0466, 204.6283],
    100: [2213.8019, 1245.2635, 40.5048, 2656.5622, 3320.7028, 173.1974], 120: [2656.5622, 1494.3163, 47.7637, 3187.8747, 3984.8434, 120.2760] };
  for (const d of Object.keys(exp)) {
    const r = o.rows.filter((x) => x.d === +d)[0], e = exp[d];
    if (!r) return '缺 ' + d;
    const got = [r.w, r.h, r.angle, r.t0, r.t1, r.nit];
    for (let i = 0; i < 6; i++) if (Math.abs(got[i] - e[i]) > 6e-4) return d + ' 寸第 ' + i + ' 项 ' + got[i] + ' ≠ ' + e[i];
  }
  if (o.best !== 92) return '最大号应 92，得 ' + o.best;
  if (o.rows.map((r) => r.fails.join('+') || 'ok').join(',') !== 'angleSmall+throwNear,ok,ok,ok,angleBig,angleBig,angleBig,angleBig') return '默认关卡 ' + o.rows.map((r) => r.fails.join('+')).join(',');
  const a = o.actions.filter((x) => x.kind === 'V')[0];
  if (!a || a.patch.V !== '3650') return '往后坐应 3650';
  /* 卧室：100 寸要 700 lm、增益 1.25 */
  const b = M.compute(M.stateFromPreset('bedroom'));
  const lm = b.actions.filter((x) => x.kind === 'lm')[0], g = b.actions.filter((x) => x.kind === 'gain')[0];
  if (!lm || lm.patch.lm !== '700' || !g || g.patch.gain !== '1.25') return '卧室亮度反解 ' + JSON.stringify(b.actions.map((x) => x.patch));
  if (!b.wantR.fails.includes('throwFar') || b.best !== null) return '卧室应无解且投影机太近';
  /* 增益不为 1 的亮度反解（卧室换 0.8 幕 → 773.3 lm → 800） */
  const b8 = M.compute(Object.assign(M.stateFromPreset('bedroom'), { gain: '0.8' }));
  const lm8 = b8.actions.filter((x) => x.kind === 'lm')[0];
  if (!lm8 || lm8.patch.lm !== '800') return '增益 0.8 流明反解 ' + (lm8 && lm8.patch.lm);
  /* 比例 */
  const w235 = M.evalSize(Object.assign({}, b.v, { aspect: '2.35:1' }), 100), w43 = M.evalSize(Object.assign({}, b.v, { aspect: '4:3' }), 100);
  if (Math.abs(w235.w - 2337.1928) > 6e-4 || Math.abs(w43.h - 1524) > 6e-4) return '比例 ' + w235.w + ' ' + w43.h;
  /* 只有「上下放不下」在卡的锚点：层高 2400、留 150、下沿 900 → 可用 1350；100 寸高 1245.3 过，110 寸 1369.8 不过 */
  const t = M.compute(S({ ceil: '2400', topGap: '150', bottom: '900', V: '4000', amin: '20', amax: '60' }));
  const r100 = t.rows.filter((x) => x.d === 100)[0], r110 = t.rows.filter((x) => x.d === 110)[0];
  if (!r100.fitH || r110.fitH || r110.fails.join() !== 'tall') return '高度关 ' + r110.fails.join();
  /* 只有「墙宽」在卡：墙 2300，100 寸宽 2213.8 过，110 寸不过 */
  const ww = M.compute(S({ wall: '2300', V: '4000', amin: '20', amax: '60' }));
  if (ww.rows.filter((x) => x.d === 100)[0].fails.length || ww.rows.filter((x) => x.d === 110)[0].fails.join() !== 'wide') return '墙宽关';
  /* 只有亮度在卡：目标 150 nit，110 寸 143.1 不过、100 寸 173.2 过 */
  const br = M.compute(S({ nits: '150', V: '4000', amin: '20', amax: '60', pMin: '0', pMax: '15000' }));
  if (br.rows.filter((x) => x.d === 100)[0].fails.length || br.rows.filter((x) => x.d === 110)[0].fails.join() !== 'dim') return '亮度关';
  /* 只有「投影机太远」：最远 3000，92 寸要 2444–3055 有交集（2600–3000）；100 寸 2657–3321 交集 2657–3000 也有 → 用 pMax 2600 卡 100 */
  const tf = M.compute(S({ pMin: '2000', pMax: '2600', V: '4000', amin: '20', amax: '60' }));
  if (tf.rows.filter((x) => x.d === 92)[0].fails.length || tf.rows.filter((x) => x.d === 100)[0].fails.join() !== 'throwFar') return '投射远关 ' + tf.rows.map((x) => x.fails.join('+')).join(',');
  for (let k = 0; k < 80; k++) {
    const R = RAND[k];
    const st = S({ aspect: R.asp, want: String(R.d), sizes: String(R.d), V: String(R.V), trMin: R.tr0, trMax: R.tr1, lm: String(R.lm), eff: R.eff, gain: R.gain, pMin: '0', pMax: '15000', wall: '10000', ceil: '6000', bottom: '0', amin: '10', amax: '80', nits: '5' });
    const z = M.compute(st, true);
    if (!z.ok) return '随机 ' + k + ' 算不出来 ' + JSON.stringify(z.errors);
    const r = z.wantR;
    if (!near(r.w, +R.w, 1e-10) || !near(r.angle, +R.ang, 1e-10) || !near(r.t1, +R.t1, 1e-10) || !near(r.nit, +R.nit, 1e-10)) return '随机 ' + k;
  }
  return null;
}

test('A1 默认：四个尺寸的宽高、视角、投影距离、亮度与 Python 50 位锚点一致；最大号 92', () => {
  assert.equal(anchors(C), null);
});

test('A2 随机 300 组与 Python decimal 对拍（相对误差 ≤ 1e-10）', () => {
  let n = 0;
  for (const R of RAND) {
    const v = { aspect: R.asp, V: R.V, trMin: +R.tr0, trMax: +R.tr1, lm: R.lm, eff: +R.eff, gain: +R.gain, wall: 1e9, ceil: 1e9, topGap: 0, bottom: 0, amin: 10, amax: 80, pMin: 0, pMax: 1e9, nits: 0 };
    const r = C.evalSize(v, R.d);
    for (const [a, b] of [[r.w, R.w], [r.h, R.h], [r.angle, R.ang], [r.t0, R.t0], [r.t1, R.t1], [r.nit, R.nit]]) assert.ok(near(a, +b, 1e-10), a + ' vs ' + b);
    n++;
  }
  assert.equal(n, 300);
});

test('A3 常识与单位：尺寸翻倍 → 宽高翻倍、面积 ×4、亮度 ÷4；16:9 宽高比；视角随距离单调减', () => {
  const v = C.compute(C.defaultState()).v;
  const a = C.evalSize(v, 50), b = C.evalSize(v, 100);
  assert.ok(near(b.w, 2 * a.w) && near(b.area, 4 * a.area) && near(b.nit, a.nit / 4));
  assert.ok(near(a.w / a.h, 16 / 9));
  /* 100 寸 16:9 宽约 2.21 m（常见尺寸表 221 cm） */
  assert.equal(C.fmtV(b.w / 10, 0), '221');
  let prev = 999;
  for (let V = 1000; V <= 8000; V += 500) { const r = C.evalSize(Object.assign({}, v, { V }), 100); assert.ok(r.angle < prev); prev = r.angle; }
});

test('A4 阈值两侧：视角正好 40° 算过；投影交集正好一个点算过；亮度正好到目标算过', () => {
  const o = C.compute(C.defaultState());
  const w = o.wantR.w;
  const Vexact = w / 2 / Math.tan(20 * Math.PI / 180);
  const at = C.evalSize(Object.assign({}, o.v, { V: Vexact }), 120);
  assert.equal(at.aStat, 'ok');
  const just = C.evalSize(Object.assign({}, o.v, { V: Vexact * (1 - 1e-6) }), 120);
  assert.equal(just.aStat, 'big');
  /* 投影交集退化成一个点 */
  const p = C.evalSize(Object.assign({}, o.v, { pMin: o.wantR.t1, pMax: 15000 }), 120);
  assert.equal(p.throwOk, true);
  const p2 = C.evalSize(Object.assign({}, o.v, { pMin: o.wantR.t1 * (1 + 1e-6), pMax: 15000 }), 120);
  assert.equal(p2.throwOk, false);
  const n = C.evalSize(Object.assign({}, o.v, { nits: o.wantR.nit }), 120);
  assert.equal(n.brightOk, true);
  assert.equal(C.evalSize(Object.assign({}, o.v, { nits: o.wantR.nit * (1 + 1e-6) }), 120).brightOk, false);
});

test('A5 改法回填：每条都让它针对的那一关过；往后坐 3650 过、3640 不过', () => {
  for (const k of ['default', 'bedroom', 'ust']) {
    const st = C.stateFromPreset(k), o = C.compute(st);
    assert.ok(o.actions.length > 0, k);
    for (const a of o.actions) {
      const o2 = C.compute(C.applyAction(st, a));
      assert.ok(o2.ok);
      const gate = { V: (r) => r.aStat === 'ok', pMin: (r) => r.throwOk, pMax: (r) => r.throwOk, lm: (r) => r.brightOk, gain: (r) => r.brightOk, bottom: (r) => r.fitH, want: (r) => r.pass }[a.kind];
      assert.ok(gate(o2.wantR), k + ' ' + a.kind);
    }
  }
  const s = C.defaultState(); s.V = '3640';
  assert.equal(C.compute(s).wantR.aStat, 'big');
  s.V = '3650'; assert.equal(C.compute(s).wantR.pass, true);
});

test('A6 改法的最小性：亮度反解再降一档（100 lm / 0.05 增益）就不够', () => {
  const st = C.stateFromPreset('bedroom'), o = C.compute(st);
  const lm = o.actions.filter((a) => a.kind === 'lm')[0], g = o.actions.filter((a) => a.kind === 'gain')[0];
  assert.equal(C.compute(Object.assign({}, st, { lm: String(+lm.patch.lm - 100) })).wantR.brightOk, false);
  assert.equal(C.compute(Object.assign({}, st, { gain: String(+g.patch.gain - 0.05) })).wantR.brightOk, false);
  /* 下沿反解 */
  const t = S({ ceil: '2400', topGap: '150', bottom: '900', want: '110', V: '4000', amin: '20', amax: '60' }), ot = C.compute(t);
  const b = ot.actions.filter((a) => a.kind === 'bottom')[0];
  assert.equal(b.patch.bottom, '880');
  assert.equal(C.compute(Object.assign({}, t, { bottom: '890' })).wantR.fitH, false);
});

test('A7 非法输入：空、非数字、范围、区间颠倒、上下挤满、尺寸清单坏值/超量/空、没名字、比例没选', () => {
  const codes = (p) => { const o = C.compute(S(p)); assert.equal(o.ok, false); return o.errors.map((e) => e.code + ':' + e.field); };
  assert.deepEqual(codes({ V: '' }), ['empty:V']);
  assert.deepEqual(codes({ lm: 'abc' }), ['nan:lm']);
  assert.deepEqual(codes({ gain: '5' }), ['range:gain']);
  assert.deepEqual(codes({ amin: '40', amax: '40' }), ['aorder:amax']);
  assert.deepEqual(codes({ trMin: '1.5', trMax: '1.2' }), ['trorder:trMax']);
  assert.deepEqual(codes({ pMin: '4000', pMax: '3000' }), ['porder:pMax']);
  assert.deepEqual(codes({ bottom: '2600', topGap: '100' }), ['novert:bottom']);
  assert.deepEqual(codes({ sizes: '80, 九十, 500' }), ['sizes:sizes']);
  assert.deepEqual(codes({ sizes: '' }), ['sizes:sizes']);
  assert.deepEqual(codes({ sizes: Array.from({ length: 21 }, (_, i) => 40 + i).join(',') }), ['sizes:sizes']);
  assert.deepEqual(codes({ name: '  ' }), ['name:name']);
  assert.deepEqual(codes({ name: 'x'.repeat(41) }), ['namelen:name']);
  assert.deepEqual(codes({ aspect: '21:9' }), ['aspect:aspect']);
  assert.ok(C.compute(S({ sizes: '100，92、 84  84' })).ok);
  assert.deepEqual(C.compute(S({ sizes: '100，92、 84  84' })).v.sizes, [84, 92, 100]);
});

test('A8 极值：最小/最大输入都算得出、数值有限；定焦与无解提醒', () => {
  const lo = S({ wall: '500', ceil: '1800', topGap: '0', bottom: '0', V: '500', want: '20', sizes: '20', gain: '0.3', trMin: '0.1', trMax: '0.1', lm: '50', eff: '0.1', pMin: '0', pMax: '0', nits: '5' });
  const hi = S({ wall: '10000', ceil: '6000', topGap: '1000', bottom: '3000', V: '15000', want: '300', sizes: '300', gain: '3', trMin: '5', trMax: '5', lm: '20000', eff: '1', pMin: '15000', pMax: '15000', nits: '500' });
  for (const s of [lo, hi]) {
    const o = C.compute(s); assert.ok(o.ok);
    for (const k of ['w', 'h', 'angle', 'nit', 't0', 't1']) assert.ok(isFinite(o.wantR[k]));
    assert.ok(o.warnings.some((w) => w.code === 'fixed'));
  }
  assert.ok(C.compute(hi).warnings.some((w) => w.code === 'eff'));
  assert.ok(C.compute(C.stateFromPreset('bedroom')).warnings.some((w) => w.code === 'none'));
  const wide = C.compute(S({ wall: '2000' }));
  assert.ok(wide.warnings.some((w) => w.code === 'wide'));
  /* 墙放不下时不给「换大流明」之类无关改法，只有换小 */
  assert.ok(wide.actions.every((a) => a.kind !== 'lm'));
});

test('A9 想买的不在清单里：照样逐关判，并给「换成最大号」', () => {
  const o = C.compute(S({ want: '106' }));
  assert.ok(o.ok && o.wantR.d === 106 && o.rows.every((r) => r.d !== 106));
  assert.ok(o.actions.some((a) => a.kind === 'want' && a.patch.want === '92'));
  const p = C.compute(S({ want: '92' }));
  assert.equal(p.wantR.pass, true); assert.equal(p.actions.length, 0);
});

test('A10 导出：CSV/MD 用同一次 out，数字与引擎同口径；预设识别', () => {
  const o = C.compute(C.defaultState());
  const csv = C.toCSV(o, 'T'), md = C.toMD(o, 'T');
  assert.ok(csv.indexOf('120,2657,1494,47.8,3649–4957,是,是,3188–3985,3188–3800,120,坐得太近') > 0, csv);
  assert.ok(csv.indexOf('四关都过的最大号 92 寸') > 0);
  assert.ok(md.indexOf('四关都过的最大号是 **92 寸**') > 0 && md.indexOf('| 92 | 2037×1146 | 37.5° | 2444–3055 | 205 | 四关都过 |') > 0, md);
  assert.ok(md.indexOf('往后坐到 3650 mm') > 0);
  const bad = C.compute(S({ V: 'x' }));
  assert.ok(C.toCSV(bad, 'T').indexOf('还算不出来') > 0 && C.toMD(bad, 'T').indexOf('还算不出来') > 0);
  assert.equal(C.presetKey(C.defaultState()), 'default');
  assert.equal(C.presetKey(C.stateFromPreset('ust')), 'ust');
  assert.equal(C.presetKey(S({ V: '3001' })), null);
  assert.ok(C.toCSV(S({ name: 'a,"b"' }) && C.compute(S({ name: 'a,"b"' })), 'T').indexOf('"a,""b"""') > 0);
});

test('A11 注入错误：每个错误都让锚点不通过（锚点够尖）', () => {
  const muts = [
    ['对角线没乘 25.4', 'diag = d * INCH', 'diag = d * 25'],
    ['宽用 r/(r+1)', 'diag * r / Math.sqrt(r * r + 1)', 'diag * r / (r + 1)'],
    ['视角用半角', '2 * Math.atan(w / 2 / v.V)', 'Math.atan(w / 2 / v.V)'],
    ['视角用 atan(w/V)', 'Math.atan(w / 2 / v.V)', 'Math.atan(w / v.V)'],
    ['投射比乘高', 't0 = v.trMin * w, t1 = v.trMax * w', 't0 = v.trMin * h, t1 = v.trMax * h'],
    ['亮度没除 π', '(Math.PI * area)', '(area)'],
    ['亮度没乘增益', 'flux * v.gain /', 'flux /'],
    ['亮度没打折', 'flux = v.lm * v.eff', 'flux = v.lm'],
    ['面积单位 cm²', 'area = w * h / 1e6', 'area = w * h / 1e4'],
    ['视角上下限互换', "angle > v.amax + 1e-9 ? 'big'", "angle > v.amin + 1e-9 ? 'big'"],
    ['高度没扣上沿留空', 'fitH = leTol(top, v.ceil - v.topGap)', 'fitH = leTol(top, v.ceil)'],
    ['高度没算下沿', 'top = v.bottom + h', 'top = h'],
    ['墙宽用对角线比', 'fitW = leTol(w, v.wall)', 'fitW = leTol(diag, v.wall)'],
    ['交集只看 pMin', 'p1 = Math.min(t1, v.pMax)', 'p1 = t1'],
    ['交集只看 pMax', 'p0 = Math.max(t0, v.pMin)', 'p0 = t0'],
    ['最大号取最小', 'passing[passing.length - 1]', 'passing[0]'],
    ['往后坐取整往下', "var vn = ceilTo(wr.vNear, 10)", "var vn = floorTo(wr.vNear, 10)"],
    ['流明反解没除增益', 'need = v.nits * Math.PI * wr.area / (v.eff * v.gain)', 'need = v.nits * Math.PI * wr.area / v.eff'],
    ['流明反解按 500 取整', 'lmN = ceilTo(need, 100)', 'lmN = ceilTo(need, 500)'],
    ['2.35 比例写成 2.39', "'2.35:1': { r: 2.35", "'2.35:1': { r: 2.39"],
    ['4:3 写成 5:4', "'4:3': { r: 4 / 3", "'4:3': { r: 5 / 4"],
    ['投射远/近判反', "t1 < v.pMin ? 'throwNear' : 'throwFar'", "t1 < v.pMin ? 'throwFar' : 'throwNear'"]
  ];
  const caught = [];
  for (const [name, a, b] of muts) {
    assert.ok(SRC.indexOf(a) >= 0, '注入点不存在：' + name);
    const src = SRC.split(a).join(b);
    let r; try { r = anchors(load(src)); } catch (e) { r = '抛错 ' + e.message; }
    assert.notEqual(r, null, '没抓到：' + name);
    caught.push(name + ' → ' + r);
  }
  fs.writeFileSync(path.join(__dirname, '..', '..', 'evidence', '注入测试明细.txt'), caught.join('\n') + '\n');
  assert.equal(caught.length, muts.length);
});
