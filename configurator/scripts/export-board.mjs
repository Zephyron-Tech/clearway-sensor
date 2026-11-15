// Výrobní podklady nosné desky CB3 z tabulky src/cad/board-v3-data.js:
//   docs/v3-deska/obrys.dxf     obrys desky (Edge.Cuts) a montážní otvory, mm
//   docs/v3-deska/osazeni.csv   souřadnice součástek (pick & place), horní strana
//   docs/v3-deska/kusovnik.csv  kusovník podle typu
// Spuštění: node scripts/export-board.mjs
//
// Souřadnice DPS: počátek v levém dolním rohu při pohledu shora, X doprava = směr k přední stěně
// skříně (zásuvky M12), Y nahoru = levá strana vozu. Převod z modelu: X = x + L/2, Y = W/2 − z.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BOARD, BLOCKS, PARTS, PASSIVE_CLUSTERS } from '../src/cad/board-v3-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'v3-deska');
mkdirSync(out, { recursive: true });
const L = BOARD.length, W = BOARD.width;
const X = (x) => x + L / 2, Yc = (z) => W / 2 - z;
const f = (n) => (Math.round(n * 1000) / 1000).toFixed(3);

// ---------- obrys: obdélník se zaoblenými rohy, z něj odečtené kruhové výřezy ----------
// Hrany obrysu jdou proti směru hodinových ručiček; výřez, který protne hranu, ji přeruší obloukem.
const rect = { x0: 0, y0: 0, x1: L, y1: W };
const cuts = BOARD.cutouts.map(c => ({ cx: X(c.x), cy: Yc(c.z), r: c.r }));
const inside = (x, y) => x > rect.x0 - 1e-6 && x < rect.x1 + 1e-6 && y > rect.y0 - 1e-6 && y < rect.y1 + 1e-6 && !cuts.some(c => Math.hypot(x - c.cx, y - c.cy) < c.r - 1e-6);

// průsečíky kružnic s hranami obdélníku → body na obvodu
const sides = [
  { a: [0, 0], b: [L, 0] }, { a: [L, 0], b: [L, W] }, { a: [L, W], b: [0, W] }, { a: [0, W], b: [0, 0] },
];
const ent = [];
// rohové zaoblení jen u rohů, které nezasáhl výřez
const r0 = BOARD.corner;
const corners = [[0, 0, 180], [L, 0, 270], [L, W, 0], [0, W, 90]];
const cornerCut = (x, y) => cuts.some(c => Math.hypot(x - c.cx, y - c.cy) < c.r + r0);
// úseky hran: rozdělit body průsečíků a nechat jen části mimo výřezy
for (const [si, s] of sides.entries()) {
  const [ax, ay] = s.a, [bx, by] = s.b;
  const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
  const ts = [0, len];
  for (const c of cuts) {
    // průsečík přímky s kružnicí
    const fx = ax - c.cx, fy = ay - c.cy;
    const B = 2 * (fx * ux + fy * uy), Cc = fx * fx + fy * fy - c.r * c.r;
    const D = B * B - 4 * Cc;
    if (D <= 0) continue;
    for (const t of [(-B - Math.sqrt(D)) / 2, (-B + Math.sqrt(D)) / 2]) if (t > 0 && t < len) ts.push(t);
  }
  // zkrátit o zaoblení rohů, které zůstaly
  const startC = corners[si], endC = corners[(si + 1) % 4];
  if (!cornerCut(startC[0], startC[1])) ts[0] = r0;
  if (!cornerCut(endC[0], endC[1])) ts[1] = len - r0;
  const sorted = [...new Set(ts)].sort((p, q) => p - q).filter(t => t >= ts[0] && t <= ts[1]);
  for (let i = 0; i < sorted.length - 1; i++) {
    const tm = (sorted[i] + sorted[i + 1]) / 2;
    if (!inside(ax + ux * tm, ay + uy * tm)) continue;
    ent.push({ t: 'LINE', a: [ax + ux * sorted[i], ay + uy * sorted[i]], b: [ax + ux * sorted[i + 1], ay + uy * sorted[i + 1]] });
  }
}
for (const [x, y, ang] of corners) {
  if (cornerCut(x, y)) continue;
  const cx = x + (x === 0 ? r0 : -r0), cy = y + (y === 0 ? r0 : -r0);
  ent.push({ t: 'ARC', c: [cx, cy], r: r0, s: ang, e: ang + 90 });
}
// oblouky výřezů: část kružnice uvnitř obdélníku
for (const c of cuts) {
  const angs = [];
  for (const s of sides) {
    const [ax, ay] = s.a, [bx, by] = s.b;
    if (ax === bx) { const dx = ax - c.cx; if (Math.abs(dx) < c.r) for (const sg of [-1, 1]) { const y = c.cy + sg * Math.sqrt(c.r ** 2 - dx ** 2); if (y >= 0 && y <= W) angs.push(Math.atan2(y - c.cy, dx)); } }
    else { const dy = ay - c.cy; if (Math.abs(dy) < c.r) for (const sg of [-1, 1]) { const x = c.cx + sg * Math.sqrt(c.r ** 2 - dy ** 2); if (x >= 0 && x <= L) angs.push(Math.atan2(dy, x - c.cx)); } }
  }
  if (angs.length !== 2) continue;
  const deg = angs.map(a => ((a * 180 / Math.PI) + 360) % 360);
  // vybrat oblouk, jehož střed leží uvnitř desky
  for (const [s, e] of [[deg[0], deg[1]], [deg[1], deg[0]]]) {
    const span = (e - s + 360) % 360, m = (s + span / 2) * Math.PI / 180;
    if (inside(c.cx + (c.r + 0.01) * Math.cos(m) * 0 + c.r * Math.cos(m) * 1.0001, c.cy + c.r * Math.sin(m) * 1.0001)) { ent.push({ t: 'ARC', c: [c.cx, c.cy], r: c.r, s, e }); break; }
  }
}
const holes = BOARD.holes.map(h => ({ t: 'CIRCLE', c: [X(h.x), Yc(h.z)], r: h.d / 2 }));

function dxf(entities) {
  const L1 = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
  for (const e of entities) {
    const layer = e.layer;
    if (e.t === 'LINE') L1.push('0', 'LINE', '8', layer, '10', f(e.a[0]), '20', f(e.a[1]), '30', '0', '11', f(e.b[0]), '21', f(e.b[1]), '31', '0');
    if (e.t === 'ARC') L1.push('0', 'ARC', '8', layer, '10', f(e.c[0]), '20', f(e.c[1]), '30', '0', '40', f(e.r), '50', f(e.s), '51', f(e.e));
    if (e.t === 'CIRCLE') L1.push('0', 'CIRCLE', '8', layer, '10', f(e.c[0]), '20', f(e.c[1]), '30', '0', '40', f(e.r));
  }
  L1.push('0', 'ENDSEC', '0', 'EOF');
  return L1.join('\r\n') + '\r\n';
}
writeFileSync(join(out, 'obrys.dxf'), dxf([...ent.map(e => ({ ...e, layer: 'OBRYS' })), ...holes.map(e => ({ ...e, layer: 'OTVORY_PTH' }))]));

// ---------- osazení ----------
const csv = (rows) => '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n') + '\r\n';
const place = [['Designator', 'Popis', 'Typ (MPN)', 'Blok', 'Mid X [mm]', 'Mid Y [mm]', 'Layer', 'Rotation [°]', 'Pouzdro X×Y×výška [mm]']];
for (const p of PARTS) {
  place.push([p.ref, p.label, p.mpn, BLOCKS[p.block], f(X(p.x)), f(Yc(p.z)), 'Top', p.rot || 0, `${p.w}×${p.d}×${p.h}`]);
}
writeFileSync(join(out, 'osazeni.csv'), csv(place));

// ---------- kusovník ----------
const groups = new Map();
for (const p of PARTS) {
  const k = p.mpn;
  if (!groups.has(k)) groups.set(k, { mpn: p.mpn, label: p.label.replace(/ \(.*\)$/, ''), refs: [], block: BLOCKS[p.block] });
  groups.get(k).refs.push(p.ref);
}
const bom = [['Množství', 'Designátory', 'Popis', 'Typ (MPN) – ověřit', 'Blok']];
for (const g of groups.values()) bom.push([g.refs.length, g.refs.join(', '), g.label, g.mpn, g.block]);
const nPass = PASSIVE_CLUSTERS.reduce((a, c) => a + c.n, 0);
bom.push([`~${nPass}`, '—', 'Pasivní součástky 0402/0603 (R, C)', 'hodnoty podle schématu a doporučených zapojení v datasheetech', 'všechny']);
bom.push([1, 'PCB', `DPS ${BOARD.name} rev. ${BOARD.rev}`, `${L}×${W}×${BOARD.thickness} mm, ${BOARD.layers} vrstvy, FR-4 Tg170, ENIG`, '—']);
writeFileSync(join(out, 'kusovnik.csv'), csv(bom));

console.log(`obrys: ${ent.length} hran a oblouků, ${holes.length} otvorů · osazení: ${PARTS.length} součástek · kusovník: ${groups.size} typů + pasivy ~${nPass}`);
