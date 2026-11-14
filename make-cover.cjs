/* 封面 cover.svg（1200×1200），数字全部来自 core.js 默认场景的同一次 compute；再用浏览器截成 cover.png。
 * 字体名用单引号（SVG 是 XML，裸双引号会让整张图变错误页，批次 64 踩过）。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState());
if (!o.ok) throw new Error('默认场景算不出来');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif", M = 'ui-monospace,Menlo,Consolas,monospace';
const v = o.v, b = o.bestR, w = o.wantR;
/* 墙面：按同一比例画墙、120 寸（红虚线）与 92 寸（绿实框） */
/* 墙按比例缩到 860 宽 × 不超过 560 高，放在副标题下方 320 → 地面 floor */
const sc = Math.min(860 / v.wall, 560 / v.ceil), cx = 600, floor = 330 + v.ceil * sc;
const box = (r, attrs) => `<rect x="${(cx - r.w * sc / 2).toFixed(1)}" y="${(floor - r.top * sc).toFixed(1)}" width="${(r.w * sc).toFixed(1)}" height="${(r.h * sc).toFixed(1)}" ${attrs}/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f1efea"/>
  <rect x="60" y="60" width="1080" height="1080" rx="24" fill="#ffffff"/>
  <text x="140" y="200" font-family="${F}" font-size="104" font-weight="700" fill="#1d1f24">幕布别买大了</text>
  <text x="140" y="268" font-family="${F}" font-size="36" fill="#878a92">墙、座位、投影机、亮度，四关都过才是对的尺寸</text>
  <rect x="${cx - v.wall * sc / 2}" y="${floor - v.ceil * sc}" width="${v.wall * sc}" height="${v.ceil * sc}" fill="#efece4" stroke="#b9b4a8" stroke-width="2"/>
  <line x1="120" y1="${floor}" x2="1080" y2="${floor}" stroke="#9a958a" stroke-width="4"/>
  ${box(b, 'fill="rgba(44,106,72,.12)" stroke="#2c6a48" stroke-width="6"')}
  ${box(w, 'fill="none" stroke="#b13a2b" stroke-width="5" stroke-dasharray="18 12"')}
  <text x="${cx}" y="${(floor - b.top * sc + b.h * sc / 2 + 10).toFixed(0)}" text-anchor="middle" font-family="${F}" font-size="72" font-weight="700" fill="#2c6a48">✓ ${o.best} 寸</text>
  <text x="${cx}" y="${(floor - w.top * sc - 18).toFixed(0)}" text-anchor="middle" font-family="${F}" font-size="38" font-weight="700" fill="#b13a2b">✗ ${v.want} 寸：坐 ${v.V / 1000} 米视角 ${A.fmtV(w.angle, 1)}°，太近</text>
  <text x="140" y="${(floor + 80).toFixed(0)}" font-family="${F}" font-size="34" fill="#4c505a">${o.best} 寸：视角 ${A.fmtV(b.angle, 1)}° · ${A.fmtV(b.nit, 0)} nit · 投影机放 ${A.fmtV(b.p0, 0)}–${A.fmtV(b.p1, 0)} mm</text>
  <text x="140" y="${(floor + 140).toFixed(0)}" font-family="${F}" font-size="28" fill="#878a92">虚构示例：墙 ${v.wall} · 层高 ${v.ceil} · 投射比 ${v.trMin}–${v.trMax} · ${v.lm} 流明</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
console.log('cover.svg', svg.length);
