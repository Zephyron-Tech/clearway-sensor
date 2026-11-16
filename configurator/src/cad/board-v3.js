// 3D model nosné desky ClearWay CB3 z tabulky board-v3-data.js.
// Používá ho sestava v3 (deska ve skříni) i samostatný náhled desky vedle sestavy.
import { makeBox, makeCylinder, makeCompound } from 'replicad';
import { BOARD, BLOCKS, PARTS } from './board-v3-data.js';

const Y = [0, 1, 0], X = [1, 0, 0];
const box = (x0, y0, z0, x1, y1, z1) => makeBox([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)]);
const cbox = (cx, cy, cz, sx, sy, sz) => box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
const cyl = (r, h, at, dir = Y) => makeCylinder(r, h, at, dir);
const group = (list) => (list.length === 1 ? list[0] : makeCompound(list));
function tryFillet(shape, r, filter) { try { return shape.fillet(r, filter); } catch { return shape; } }

export const BOARD_CATS = Object.fromEntries(Object.entries(BLOCKS).map(([k, v]) => [`deska_${k}`, `Deska: ${v}`]));
const BLOCK_ORDER = Object.keys(BLOCKS);

/**
 * Díly desky. y0 = spodní plocha DPS, ex0 = základní posun v rozloženém pohledu (sestava ho má jiný).
 * Vrací pole { name, cat, mat, shape, ex, label, spec, src } jako ostatní buildery.
 */
export function boardParts({ y0 = 0, ex0 = [0, 0, 0], lift = 1 } = {}) {
  const out = [];
  const t = BOARD.thickness, yT = y0 + t;
  const exB = (block, k = 1) => {
    const i = BLOCK_ORDER.indexOf(block);
    return [ex0[0], ex0[1] + lift * (16 + 5 * i) * k, ex0[2]];
  };
  const add = (name, cat, mat, shape, ex, meta) => out.push({ name, cat, mat, shape, ex, ...meta });

  // --- deska plošného spoje ---
  const L = BOARD.length, W = BOARD.width;
  let pcb = box(-L / 2, y0, -W / 2, L / 2, yT, W / 2);
  pcb = tryFillet(pcb, BOARD.corner, (e) => e.inDirection('Y'));
  pcb = pcb.cut(group([
    ...BOARD.holes.map(h => cyl(h.d / 2, t + 2, [h.x, y0 - 1, h.z])),
    ...BOARD.cutouts.map(c => cyl(c.r, t + 2, [c.x, y0 - 1, c.z])),
  ]));
  add('deska_dps', 'deska_vypocet', 'pcb', pcb, ex0, {
    label: `DPS ${BOARD.name} rev. ${BOARD.rev}`, src: 'pcb',
    spec: `${L}×${W}×${t} mm, ${BOARD.layers} vrstvy, FR-4 Tg 170, ENIG, zelená maska, bílý potisk; výrobní data v hardware/cb3/vyroba`,
  });
  // měď, plošky a potisk z KiCadu: tenká vrstva nahoře a dole s texturou (scripts/kicad/export-texture.py)
  const skin = (yA) => {
    let s = box(-L / 2, yA, -W / 2, L / 2, yA + 0.02, W / 2);
    s = tryFillet(s, BOARD.corner, (e) => e.inDirection('Y'));
    return s.cut(group([
      ...BOARD.holes.map(h => cyl(h.d / 2, 1, [h.x, yA - 0.5, h.z])),
      ...BOARD.cutouts.map(c => cyl(c.r, 1, [c.x, yA - 0.5, c.z])),
    ]));
  };
  const uvBox = [-L / 2, -W / 2, L / 2, W / 2];
  add('deska_med_vrch', 'deska_vypocet', 'pcbTop', skin(yT), ex0,
    { label: 'DPS · měď, plošky a potisk nahoře', src: 'pcb', spec: 'vrstvy F.Cu, F.Mask, F.Silkscreen z hardware/cb3', uvBox });
  add('deska_med_spod', 'deska_vypocet', 'pcbBottom', skin(y0 - 0.02), ex0,
    { label: 'DPS · měď, plošky a potisk dole', src: 'pcb', spec: 'vrstvy B.Cu, B.Mask, B.Silkscreen z hardware/cb3', uvBox });
  // prokovené plošky kolem montážních otvorů (zem)
  add('deska_plosky_otvoru', 'deska_vypocet', 'brass',
    group(BOARD.holes.map(h => cyl(h.pad / 2, 0.05, [h.x, yT, h.z]).cut(cyl(h.d / 2, 1, [h.x, yT - 0.5, h.z])))), ex0,
    { label: 'Plošky montážních otvorů (GND)', src: 'pcb', spec: 'součást DPS' });

  // --- součástky ---
  // malé pasivní součástky (0402–1210) se slučují do jedné skupiny na blok a stranu desky
  const passives = new Map();
  for (const p of PARTS) {
    if (p.passive) {
      const k = `${p.block}|${p.side}`;
      if (!passives.has(k)) passives.set(k, []);
      const y = p.side === 'B' ? y0 - p.h : yT;
      passives.get(k).push(box(p.x - p.w / 2, y, p.z - p.d / 2, p.x + p.w / 2, y + p.h, p.z + p.d / 2));
      continue;
    }
    const cat = `deska_${p.block}`;
    const meta = { label: `${p.ref} · ${p.label}`, spec: p.mpn + (p.pins ? `; piny: ${p.pins}` : ''), src: 'nakup' };
    const ex = exB(p.block, p.shape === 'cm5' || p.shape === 'm2' ? 1.8 : 1);
    const y = p.side === 'B' ? y0 - p.h : yT + (p.z0 ?? 0);
    const { x, z, w, d, h } = p;
    let shape;
    switch (p.shape) {
      case 'cyl': shape = cyl(w / 2, h, [x, y, z]); break;
      case 'cylX': shape = cyl(d / 2, w, [x - w / 2, y + d / 2, z], X); break;
      case 'ic': {
        // tělo + vývody (LQFP: racky po stranách, ostatní: plošky pod tělem)
        const body = cbox(x, y + h / 2 + 0.1, z, w - (p.leads ? 2 : 0), h - 0.1, d - (p.leads ? 2 : 0));
        const legs = [];
        if (p.leads) {
          const n = p.leads, pitch = (w - 4) / (n - 1);
          for (let i = 0; i < n; i++) {
            const a = -w / 2 + 2 + i * pitch;
            legs.push(cbox(x + a, y + 0.15, z - d / 2 + 0.5, 0.22, 0.3, 1.2), cbox(x + a, y + 0.15, z + d / 2 - 0.5, 0.22, 0.3, 1.2),
              cbox(x - w / 2 + 0.5, y + 0.15, z + a, 1.2, 0.3, 0.22), cbox(x + w / 2 - 0.5, y + 0.15, z + a, 1.2, 0.3, 0.22));
          }
          add(`${p.ref}_vyvody`, cat, 'nickel', group(legs), ex, { label: `${p.ref} · vývody`, spec: 'součást pouzdra', src: 'nakup' });
        }
        shape = body;
        // značka pinu 1
        add(`${p.ref}_pin1`, cat, 'white', cyl(Math.min(w, d) * 0.06 + 0.15, 0.02, [x - w / 2 + Math.min(w, d) * 0.22 + (p.leads ? 1 : 0), y + h + 0.01, z - d / 2 + Math.min(w, d) * 0.22 + (p.leads ? 1 : 0)]), ex,
          { label: `${p.ref} · značka pinu 1`, spec: 'součást pouzdra', src: 'nakup' });
        break;
      }
      case 'cm5': {
        shape = cbox(x, y + 0.5, z, w, 1, d);
        const yc = y + 1;
        add('M1_soc', cat, 'chip', cbox(x + 6, yc + 0.7, z, 15, 1.4, 15), ex, { label: 'M1 · procesor BCM2712', spec: 'součást CM5', src: 'nakup' });
        add('M1_ram', cat, 'chip', cbox(x - 12, yc + 0.6, z - 7, 12, 1.2, 10), ex, { label: 'M1 · paměť LPDDR4X', spec: 'součást CM5', src: 'nakup' });
        add('M1_emmc', cat, 'chip', cbox(x - 12, yc + 0.6, z + 9, 11.5, 1.2, 13), ex, { label: 'M1 · eMMC 32 GB', spec: 'součást CM5', src: 'nakup' });
        add('M1_pmic', cat, 'chip', cbox(x + 20, yc + 0.45, z + 12, 7, 0.9, 7), ex, { label: 'M1 · PMIC', spec: 'součást CM5', src: 'nakup' });
        add('M1_otvory', cat, 'brass', group([[-24, -16.5], [24, -16.5], [-24, 16.5], [24, 16.5]].map(([a, b]) => cyl(1.8, 0.04, [x + a, yc + 0.01, z + b]))), ex,
          { label: 'M1 · montážní otvory', spec: 'součást CM5; na nosné desce distanční sloupky M2,5 × 1,5 mm', src: 'nakup' });
        break;
      }
      case 'm2': {
        shape = cbox(x, y + 0.4, z, w, 0.8, d);
        add('M3_stineni', cat, 'shield', cbox(x + 2, y + 1.5, z, 30, 1.4, 24), ex, { label: 'M3 · stínění modemu', spec: 'součást modemu', src: 'nakup' });
        add('M3_ufl', cat, 'brass', group([cyl(1.3, 1.2, [x + 18.6, y + 0.8, z - 10]), cyl(1.3, 1.2, [x + 18.6, y + 0.8, z + 10])]), ex,
          { label: 'M3 · U.FL anténa LTE hlavní / diverzitní', spec: 'součást modemu, kabely k vývodce antény', src: 'nakup' });
        add('M3_sroub', cat, 'steel', cyl(1.9, 1.2, [x + w / 2 - 1.5, y + 0.8, z]), ex, { label: 'M3 · šroub M2×3', spec: 'nerez', src: 'nakup' });
        break;
      }
      case 'coin': {
        shape = box(x - w / 2, y, z - d / 2, x + w / 2, y + 1.2, z + d / 2).fuse(box(x - w / 2, y, z - 1.5, x - w / 2 + 2, y + h, z + 1.5));
        add(`${p.ref}_clanek`, cat, 'nickel', cyl(10, 3.2, [x + 1, y + 1.3, z]), ex, { label: `${p.ref} · článek ML2032`, spec: 'Maxell ML2032 (dobíjecí 3 V)', src: 'nakup' });
        break;
      }
      case 'ufl': shape = cyl(1.3, h, [x, y, z]).fuse(cbox(x, y + 0.2, z, w, 0.4, d)); break;
      case 'tp': shape = cyl(0.75, 0.05, [x, y, z]); break;
      case 'button':
        shape = cbox(x, y + 0.8, z, w, 1.6, d);
        add(`${p.ref}_hmatnik`, cat, 'plasticBlack', cyl(1.5, 0.6, [x, y + 1.6, z]), ex, { label: `${p.ref} · hmatník`, spec: 'součást tlačítka', src: 'nakup' });
        break;
      default: shape = cbox(x, y + h / 2, z, w, h, d);
    }
    add(p.ref, cat, p.mat, shape, ex, meta);
  }

  const SIDE = { T: 'nahoře', B: 'dole' };
  for (const [k, items] of passives) {
    const [block, side] = k.split('|');
    add(`pasivni_${block}_${side}`, `deska_${block}`, 'ceramic', group(items), exB(block, side === 'B' ? -0.6 : 0.9),
      { label: `Pasivní součástky ${SIDE[side]} (${items.length}×)`, src: 'nakup', spec: 'rezistory, kondenzátory a tlumivky 0402–1210; hodnoty a typy v kusovníku hardware/cb3/vyroba/cb3-kusovnik.csv' });
  }
  return out;
}

/** Střed součástky v souřadnicích desky (pro kabely a tepelný most v sestavě). */
export function partXZ(ref) {
  const p = PARTS.find(q => q.ref === ref);
  return p ? { x: p.x, z: p.z, w: p.w, d: p.d, h: p.h, z0: p.z0 ?? 0 } : null;
}
