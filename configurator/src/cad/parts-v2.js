// B-rep model ClearWay v2 (koncept). v1 je archivovaná v parts.js a nemění se.
// Souřadnice stejné jako v1: X podél těla (0 = čelo A, na voze nahoře), Y kolmo k oknům,
// spodek těla y = 0, nohy do -Y, Z napříč.
//
// Hlavní změny proti v1: jedna jednotka pro master i slave, plastové tělo místo hliníku s krytem,
// bezdrátový spoj (bez konektorů a kabelů), 2× 18650 s nabíjením přes USB-C, LTE-M + GNSS
// (osazeno jen u masteru), anténa uvnitř čela A, kloubové nohy s pákovou přísavkou.
import { makeBox, makeCylinder, makeSphere, Sketcher } from 'replicad';
import { layout, feet } from '../geometry.js';
import { WIN_NAMES_V2 } from '../names.js';
import { MATS } from './parts.js';

const v = (P, g, k) => P[g][k].v;
const box = (x0, y0, z0, x1, y1, z1) => makeBox([x0, y0, z0], [x1, y1, z1]);
const cbox = (cx, cy, cz, sx, sy, sz) => box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
function tryFillet(shape, r, filter) { try { return shape.fillet(r, filter); } catch { return shape; } }
function stadiumAcross(cx, len, wid, y0, h) {
  // stadion delší stranou napříč (Z), vytažený podél Y
  const r = wid / 2, straight = Math.max(len - wid, 0.01);
  return box(cx - r, y0, -straight / 2, cx + r, y0 + h, straight / 2)
    .fuse(makeCylinder(r, h, [cx, y0, -straight / 2], [0, 1, 0]))
    .fuse(makeCylinder(r, h, [cx, y0, straight / 2], [0, 1, 0]));
}
function revolveY(pts) {
  const sk = new Sketcher('XY').movePointerTo(pts[0]);
  for (const p of pts.slice(1)) sk.lineTo(p);
  return sk.close().revolve([0, 1, 0]);
}

export { layout };

export function buildUnitCad(P, role) {
  const out = [];
  const add = (name, cat, mat, shape) => out.push({ name, cat, mat, color: MATS[mat], shape });

  const W = v(P, 'profil', 'sirka');
  const H = v(P, 'profil', 'vyska');
  const t = v(P, 'profil', 'stena');
  const R = Math.min(v(P, 'profil', 'zaobleni'), H / 2 - 1, W / 2 - 1);
  const split = H * 0.42; // dělicí rovina horní skořepiny a spodní vany
  const { parts, total } = layout(P);
  const cep = v(P, 'delky', 'cep');
  const winL = v(P, 'okno', 'delka'), winW = v(P, 'okno', 'sirka');
  const lw = v(P, 'lidar', 'sirka'), ld = v(P, 'lidar', 'hloubka'), lh = v(P, 'lidar', 'vyska');
  const names = WIN_NAMES_V2;
  const wins = parts.filter(p => p.kind === 'window');

  // --- tělo: zaoblený plastový profil, dutý, rozdělený na skořepinu (s okny) a vanu ---
  const x0 = cep, x1 = total - cep;
  let outer = box(x0, 0, -W / 2, x1, H, W / 2);
  outer = tryFillet(outer, R, (e) => e.inDirection('X'));
  let shell = outer.cut(box(x0 - 1, t, -W / 2 + t, x1 + 1, H - t, W / 2 - t));
  for (const p of wins) shell = shell.cut(stadiumAcross(p.x0 + p.len / 2, winL, winW, H - t - 1, t + 2));
  const top = shell.cut(box(x0 - 1, -1, -W, x1 + 1, split, W));
  const tub = shell.cut(box(x0 - 1, split, -W, x1 + 1, H + 1, W));
  add('kryt_horni_skorepina', 'telo', 'print', top);
  add('vana_spodni', 'telo', 'printDark', tub);
  // těsnění v dělicí rovině
  add('tesneni', 'telo', 'rubber', box(x0 + 2, split - 0.4, -W / 2 + t * 0.3, x1 - 2, split + 0.4, -W / 2 + t * 0.7)
    .fuse(box(x0 + 2, split - 0.4, W / 2 - t * 0.7, x1 - 2, split + 0.4, W / 2 - t * 0.3)));

  // --- lidary TFmini Plus (stejné jako v1), čelo s čočkami vyplní okno v rovině skořepiny ---
  wins.forEach((p) => {
    const cx = p.x0 + p.len / 2, name = names[p.index];
    let lid = box(cx - ld / 2, H - lh, -lw / 2, cx + ld / 2, H - t, lw / 2);
    lid = tryFillet(lid, 1.5, (e) => e.inDirection('Y'));
    lid = lid.fuse(stadiumAcross(cx, winL - 0.6, winW - 0.6, H - t - 0.5, t + 0.5));
    const lenses = [-lw * 0.22, lw * 0.22];
    for (const z of lenses) lid = lid.cut(makeCylinder(lw * 0.12 + 0.4, 1, [cx, H - 0.8, z], [0, 1, 0]));
    add(`lidar_${name}`, 'lidar', 'lidar', lid);
    for (const z of lenses) add(`lidar_${name}_cocka`, 'lidar', 'lens', makeCylinder(lw * 0.12, 0.6, [cx, H - 0.8, z], [0, 1, 0]));
    add(`lidar_${name}_konektor`, 'lidar', 'jst', cbox(cx, H - lh - 2, lw * 0.25, 6, 4, 9));
  });

  const seg = (i) => { const a = wins[i], b = wins[i + 1]; return { x0: a.x0 + a.len, x1: b.x0, cx: (a.x0 + a.len + b.x0) / 2, len: b.x0 - a.x0 - a.len }; };

  // --- baterie 2× 18650 v držáku (segment mezi okny 1 a 2) ---
  {
    const s = seg(0);
    const n = Math.round(v(P, 'baterie', 'pocet'));
    const bd = v(P, 'baterie', 'prumer'), bl = v(P, 'baterie', 'delka');
    const cy = t + 0.8 + bd / 2;
    const zs = n === 1 ? [0] : Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * (bd + 1.6));
    let holder = cbox(s.cx, cy - bd * 0.15, 0, bl + 6, bd * 0.7, zs.length * (bd + 1.6) + 3);
    for (const z of zs) holder = holder.cut(makeCylinder(bd / 2 + 0.3, bl + 1, [s.cx - (bl + 1) / 2, cy, z], [1, 0, 0]));
    add('drzak_baterii', 'baterie', 'plasticBlack', holder);
    for (const z of zs) {
      add('clanek_18650', 'baterie', 'blue', makeCylinder(bd / 2, bl - 1.5, [s.cx - bl / 2, cy, z], [1, 0, 0]));
      add('clanek_18650_plus', 'baterie', 'nickel', makeCylinder(bd * 0.3, 1.5, [s.cx + bl / 2 - 1.5, cy, z], [1, 0, 0]));
    }
    add('BMS_ochrana', 'baterie', 'pcb', cbox(s.cx, cy + bd / 2 + 1.5, 0, 30, 1.2, 14));
  }

  // --- hlavní deska (segment mezi okny 2 a 3): ESP32-S3-MINI, nabíječka, fuel gauge, JST lidarů ---
  {
    const s = seg(1);
    const bw = v(P, 'deska', 'sirka'), bl = Math.min(v(P, 'deska', 'delka'), s.len - 2), bt = v(P, 'deska', 'tloustka');
    const by = t + 3, top = by + bt;
    add('deska_hlavni', 'elektronika', 'pcb', box(s.cx - bl / 2, by, -bw / 2, s.cx + bl / 2, top, bw / 2));
    const part = (name, mat, u, w, su, sh, sw) => add(name, 'elektronika', mat, cbox(s.cx + u, top + sh / 2, w, su, sh, sw));
    part('ESP32-S3-MINI-1', 'shield', -bl / 2 + 14, -bw / 2 + 12, 15.4, 2.4, 20.5);
    part('nabijecka_BQ25895', 'chip', 6, 10, 4, 0.9, 4);
    part('fuel_gauge', 'chip', 14, 10, 3, 0.9, 3);
    part('menic_5V', 'chip', 6, 18, 5, 1.2, 5);
    part('civka_5V', 'chip', 15, 18, 6, 3, 6);
    for (const [u, w] of [[bl / 2 - 4, -16], [bl / 2 - 4, -4], [bl / 2 - 4, 8], [bl / 2 - 4, 20]]) part('konektor_JST_lidar', 'jst', u, w, 5, 5, 8);
    part('LED_stav', 'led', -bl / 2 + 30, 2, 1.6, 0.8, 0.8);
  }

  // --- LTE-M/NB-IoT + GNSS (jen master; slave má stejnou desku neosazenou) ---
  if (role === 'master') {
    const s = seg(2);
    const by = t + 3;
    add('deska_modem', 'elektronika', 'pcb', box(s.cx - 22, by, -16, s.cx + 22, by + 1.6, 16));
    add('modem_SIM7080G', 'elektronika', 'shield', cbox(s.cx - 6, by + 1.6 + 1.2, -2, 17.6, 2.4, 15.7));
    add('drzak_nanoSIM', 'elektronika', 'nickel', cbox(s.cx + 12, by + 1.6 + 0.7, 4, 12, 1.4, 14));
  }

  // --- čela: A (nahoře) s anténami uvnitř, B (dole) s USB-C, tlačítkem a stavovou LED ---
  for (const end of [0, 1]) {
    const xa = end === 0 ? 0 : total - cep, xb = xa + cep;
    let cap = box(xa, 0, -W / 2, xb, H, W / 2);
    cap = tryFillet(cap, R, (e) => e.inDirection('X'));
    cap = tryFillet(cap, 2, (e) => e.inPlane('YZ', end === 0 ? 0 : total));
    const outX = end === 0 ? 0 : total;
    if (end === 1) {
      const cy = H * 0.42;
      // USB-C (zásuvka 8,9 × 3,2 mm), tlačítko, světlovod RGB LED
      cap = cap.cut(cbox(outX - cep / 2, cy, -10, cep + 2, 3.6, 9.4));
      cap = cap.cut(makeCylinder(4.2, cep + 2, [outX - cep - 1, cy, 9], [1, 0, 0]));
      cap = cap.cut(makeCylinder(2.2, cep + 2, [outX - cep - 1, cy + 9, 0], [1, 0, 0]));
      add('USB-C', 'konektory', 'nickel', cbox(outX - 3.6, cy, -10, 7.2, 3.2, 8.9).cut(cbox(outX - 3.2, cy, -10, 7, 2.4, 8.1)));
      add('tlacitko_zap', 'konektory', 'plasticBlack', makeCylinder(3.8, cep + 1, [outX - cep, cy, 9], [1, 0, 0]));
      add('LED_RGB_svetlovod', 'konektory', 'ledGreen', makeCylinder(2, cep + 0.6, [outX - cep, cy + 9, 0], [1, 0, 0]));
    } else {
      // průhled pro anténu není potřeba: plast RF propouští; uvnitř GNSS patch + flex anténa LTE/BLE
      add('GNSS_patch', 'konektory', 'white', cbox(cep + 2.5, H / 2, 0, 4, 18, 18));
      add('antena_LTE_BLE_flex', 'konektory', 'yellow', cbox(cep + 0.6, H / 2, 0, 0.3, H - 2 * t - 4, W - 2 * t - 6));
    }
    add(`cep_${end === 0 ? 'A' : 'B'}`, 'telo', 'cap', cap);
  }

  // --- nohy: rychloupínací destička, kulový kloub s aretací, páková přísavka ---
  for (const f of feet(P)) {
    for (const s of buildJointFoot(P, f)) add(`noha_${f.name}_${s.name}`, 'noha', s.mat, s.shape.translate([f.x, 0, 0]));
  }
  return { parts: out, total };
}

function buildJointFoot(P, f) {
  const out = [];
  const add = (name, mat, shape) => out.push({ name, mat, shape });
  const sr = v(P, 'noha', 'valec_prumer') / 2;
  const kv = v(P, 'noha', 'kloub_vyska');
  const kr = v(P, 'noha', 'kloub_prumer') / 2;
  const dh = v(P, 'noha', 'drzak_vyska');
  const pr = v(P, 'noha', 'prisavka_prumer') / 2;
  const ph = v(P, 'noha', 'prisavka_vyska');
  const W = v(P, 'profil', 'sirka');

  // rychloupínací destička (rybina) pod tělem
  add('rychloupinak', 'printDark', tryFillet(cbox(0, -2.5, 0, 40, 5, Math.min(W - 8, 44)), 1.2, (e) => e.inDirection('Y')));
  // dřík a pouzdro kloubu se zajišťovacím šroubem
  add('drik', 'printDark', makeCylinder(sr, kv - kr * 0.6 - 5, [0, -(kv - kr * 0.6), 0], [0, 1, 0]));
  add('pouzdro_kloubu', 'plasticBlack', makeCylinder(kr * 1.25, kr * 1.1, [0, -kv - kr * 0.25, 0], [0, 1, 0]).cut(makeSphere(kr + 0.2).translate([0, -kv, 0])));
  add('aretace', 'blue', makeCylinder(3.5, kr * 1.25 + 6, [0, -kv + kr * 0.2, 0], [0, 0, 1]));
  add('koule', 'nickel', makeSphere(kr).translate([0, -kv, 0]));

  // část pod kloubem se natočí o úhel kloubu (kolmo k povrchu dveří)
  const lower = [];
  const addL = (name, mat, shape) => lower.push({ name, mat, shape });
  let y = -kv;
  addL('krk', 'nickel', makeCylinder(kr * 0.45, dh - 4, [0, y - dh + 4, 0], [0, 1, 0]));
  y -= dh;
  addL('zakladna_prisavky', 'plasticBlack', revolveY([[0, y + 4], [pr * 0.55, y + 4], [pr * 0.62, y], [0, y]]));
  // páka: oblouk nad přísavkou (zjednodušeně kvádr se zaoblením)
  addL('paka', 'blue', tryFillet(cbox(pr * 0.15, y + 7, 0, pr * 1.1, 4, 12), 1.8, (e) => e.inDirection('Z')));
  addL('prisavka', 'rubber', revolveY([[0, y], [pr * 0.62, y], [pr * 0.9, y - ph + 3], [pr, y - ph + 0.8], [pr, y - ph], [0, y - ph]]));
  for (const l of lower) add(l.name, l.mat, f.tilt ? l.shape.rotate(f.tilt, [0, -kv, 0], [0, 0, 1]) : l.shape);
  return out;
}
