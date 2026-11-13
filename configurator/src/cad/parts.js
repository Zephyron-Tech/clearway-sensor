// B-rep model jednotky ClearWay (replicad / OpenCascade).
// Souřadnice stejné jako náhled: X podél těla (0 = konec s anténou u masteru),
// Y kolmo k oknům (směr měření), spodek těla y = 0, nohy do -Y, Z napříč.
// Export do STEP/STL otáčí model tak, aby Z mířilo nahoru (konvence CAD).
//
// Každý díl má: name (do STEP), cat (kategorie pro UI), mat (vzhled v náhledu), color (barva ve STEP).
import { makeBox, makeCylinder, makeSphere, Sketcher } from 'replicad';

const v = (P, g, k) => P[g][k].v;

// Barvy podle fotek (stříbrný „galaxy“ PLA, tmavé čepy, černé přísavky se žlutým okrajem…)
export const MATS = {
  alu: '#d5d8dc', print: '#a9acb1', printDark: '#6d7076', cap: '#4b4e53',
  glass: '#121417', lidar: '#1d1e21', lens: '#26323f', pcb: '#1c4a2c', shield: '#c4c4bc',
  jst: '#f0eee4', terminalBlue: '#2a78c8', terminalGreen: '#2fa564', tantalum: '#e6a91d',
  chip: '#202124', switch: '#3a3a3a', brass: '#c9a35a', nickel: '#b9bcc0', rubber: '#1a1b1d',
  plasticBlack: '#232427', white: '#f2f1ec', yellow: '#f3d227', blue: '#1f5fd1', red: '#d23a2e',
  level: '#cfe24a', joint: '#7b4fd6', led: '#ff4b3a', ledGreen: '#33d17a', tape: '#8e9094',
};

const box = (x0, y0, z0, x1, y1, z1) => makeBox([x0, y0, z0], [x1, y1, z1]);
// kvádr podle středu a rozměrů
const cbox = (cx, cy, cz, sx, sy, sz) => box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);

function tryFillet(shape, r, filter) {
  try { return shape.fillet(r, filter); } catch { return shape; }
}

// Stadion (zaoblené okno) jako těleso podél Y
function stadium(cx, cz, len, wid, y0, h) {
  const r = wid / 2;
  const straight = Math.max(len - wid, 0.01);
  let s = box(cx - straight / 2, y0, cz - r, cx + straight / 2, y0 + h, cz + r);
  s = s.fuse(makeCylinder(r, h, [cx - straight / 2, y0, cz], [0, 1, 0]));
  s = s.fuse(makeCylinder(r, h, [cx + straight / 2, y0, cz], [0, 1, 0]));
  return s;
}

// Rotační těleso: profil [r, y] kolem osy Y
function revolveY(pts) {
  const sk = new Sketcher('XY').movePointerTo(pts[0]);
  for (const p of pts.slice(1)) sk.lineTo(p);
  return sk.close().revolve([0, 1, 0]);
}
// Rotační těleso: profil [a, r] kolem osy X (a = vzdálenost podél osy)
function revolveX(pts) {
  const sk = new Sketcher('XY').movePointerTo(pts[0]);
  for (const p of pts.slice(1)) sk.lineTo(p);
  return sk.close().revolve([1, 0, 0]);
}

export function layout(P) {
  const cep = v(P, 'delky', 'cep');
  const win = v(P, 'delky', 'modul_okna');
  const segs = ['segment_A', 'segment_B', 'segment_C'].map(k => v(P, 'delky', k));
  const parts = [];
  let x = 0;
  parts.push({ kind: 'cap', x0: x, len: cep, end: 0 }); x += cep;
  for (let i = 0; i < 4; i++) {
    parts.push({ kind: 'window', x0: x, len: win, index: i }); x += win;
    if (i < 3) { parts.push({ kind: 'segment', x0: x, len: segs[i], name: 'ABC'[i] }); x += segs[i]; }
  }
  parts.push({ kind: 'cap', x0: x, len: cep, end: 1 }); x += cep;
  return { parts, total: x };
}

/** Vrátí seznam dílů { name, cat, mat, color, shape } pro jednu jednotku. */
export function buildUnitCad(P, role) {
  const out = [];
  const add = (name, cat, mat, shape) => out.push({ name, cat, mat, color: MATS[mat], shape });

  const W = v(P, 'profil', 'sirka');
  const H = v(P, 'profil', 'vyska');
  const t = v(P, 'profil', 'stena');
  const kh = v(P, 'profil', 'kryt_vyska');
  const aluH = H - kh;
  const { parts, total } = layout(P);
  const cep = v(P, 'delky', 'cep');
  const bodyLen = total - 2 * cep;

  // --- hliníkový U profil s vnitřními drážkami ---
  let alu = box(cep, 0, -W / 2, cep + bodyLen, aluH, W / 2)
    .cut(box(cep - 1, t, -W / 2 + t, cep + bodyLen + 1, aluH + 1, W / 2 - t));
  for (const s of [-1, 1]) {
    const zIn = s * (W / 2 - t);
    for (const yy of [aluH * 0.35, aluH * 0.7]) {
      alu = alu.fuse(box(cep, yy - 1, Math.min(zIn, zIn - s * 2.5), cep + bodyLen, yy + 1, Math.max(zIn, zIn - s * 2.5)));
    }
  }
  alu = tryFillet(alu, Math.min(1.5, t * 0.7), (e) => e.inDirection('X').inPlane('XZ', 0));
  add('profil_hlinik', 'telo', 'alu', alu);

  const winL = v(P, 'okno', 'delka');
  const winW = v(P, 'okno', 'sirka');
  const lw = v(P, 'lidar', 'sirka'), ld = v(P, 'lidar', 'hloubka'), lh = v(P, 'lidar', 'vyska');
  const winNames = role === 'master' ? ['J1', 'J4', 'J2', 'J3'] : ['J1', 'J2', 'J4', 'J3'];
  const gap = 0.3;
  const edgeR = Math.min(1.2, kh * 0.25);

  for (const p of parts) {
    const cx = p.x0 + p.len / 2;
    if (p.kind === 'segment') {
      let s = box(p.x0 + gap, aluH, -W / 2, p.x0 + p.len - gap, H, W / 2);
      s = tryFillet(s, edgeR, (e) => e.inDirection('X').inPlane('XZ', H));
      add(`kryt_${p.name}`, 'telo', 'print', s);
    } else if (p.kind === 'window') {
      const name = winNames[p.index];
      let frame = box(p.x0 + gap, aluH, -W / 2, p.x0 + p.len - gap, H, W / 2);
      frame = tryFillet(frame, edgeR, (e) => e.inDirection('X').inPlane('XZ', H));
      frame = frame.cut(stadium(cx, 0, winL, winW, aluH - 1, kh + 2));
      frame = frame.cut(stadium(cx, 0, winL + 3, winW + 3, H - 1.5, 2)); // osazení skla
      add(`okno_${name}`, 'telo', 'print', frame);
      add(`sklo_${name}`, 'telo', 'glass', stadium(cx, 0, winL + 2.6, winW + 2.6, H - 1.5, 1));

      // lidar (TFmini Plus): tělo se zaoblením, dvě čočky v rámečku, konektor vzadu
      const ly1 = aluH;
      let lid = box(cx - ld / 2, ly1 - lh, -lw / 2, cx + ld / 2, ly1, lw / 2);
      lid = tryFillet(lid, 1.5, (e) => e.inDirection('Y'));
      add(`lidar_${name}`, 'lidar', 'lidar', lid);
      for (const z of [-lw * 0.22, lw * 0.22]) {
        add(`lidar_${name}_objimka`, 'lidar', 'plasticBlack', makeCylinder(lw * 0.16, 0.8, [cx, ly1, z], [0, 1, 0]));
        add(`lidar_${name}_cocka`, 'lidar', 'lens', makeCylinder(lw * 0.12, 1.4, [cx, ly1, z], [0, 1, 0]));
      }
      add(`lidar_${name}_konektor`, 'lidar', 'jst', cbox(cx, ly1 - lh - 2, lw * 0.25, 6, 4, 9));
    } else if (p.kind === 'cap') {
      let cap = box(p.x0, 0, -W / 2, p.x0 + p.len, H, W / 2);
      const outX = p.end === 0 ? p.x0 : p.x0 + p.len;
      cap = tryFillet(cap, 2.5, (e) => e.inPlane('YZ', outX));
      addCapFittings(add, P, role, p.end, outX, p.end === 0 ? -1 : 1, H, W, cap);
    }
  }

  addBoard(add, P, role, parts, t);

  // --- nohy ---
  const off = v(P, 'noha', 'odsazeni');
  const tilt = v(P, 'noha', 'kloub_uhel');
  for (const [i, fx] of [off, total - off].entries()) {
    for (const f of buildFoot(P, tilt)) {
      let s = f.shape;
      if (tilt) s = s.rotate(tilt, [0, 0, 0], [1, 0, 0]);
      add(`noha${i + 1}_${f.name}`, 'noha', f.mat, s.translate([fx, 0, 0]));
    }
  }
  return { parts: out, total };
}

// --- deska RICE v segmentu C; rozmístění součástek podle fotky desky (odhad) ---
function addBoard(add, P, role, parts, t) {
  const segC = parts.find(p => p.name === 'C');
  const bw = v(P, 'deska', 'sirka'), bl = v(P, 'deska', 'delka'), bt = v(P, 'deska', 'tloustka');
  const bx = segC.x0 + segC.len / 2, by = t + 6;
  const top = by + bt;
  // u = podél profilu (X), w = napříč (Z), w < 0 je strana s ESP modulem
  const at = (u, w) => [bx + u, w];
  const part = (name, mat, u, w, su, sh, sw) => add(name, 'elektronika', mat, cbox(bx + u, top + sh / 2, w, su, sh, sw));

  let pcb = box(bx - bl / 2, by, -bw / 2, bx + bl / 2, by + bt, bw / 2);
  const holes = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([su, sw]) => at(su * (bl / 2 - 4), sw * (bw / 2 - 4)));
  for (const [x, z] of holes) pcb = pcb.cut(makeCylinder(1.6, bt + 2, [x, by - 1, z], [0, 1, 0]));
  add('deska_RICE', 'elektronika', 'pcb', pcb);
  for (const [x, z] of holes) {
    add('distancni_sloupek', 'elektronika', 'nickel', makeCylinder(2.5, by - t, [x, t, z], [0, 1, 0]));
    add('sroub', 'elektronika', 'nickel', makeCylinder(2.6, 1.6, [x, top, z], [0, 1, 0]));
  }

  // ESP modul (WROOM-1U / 32UE: 18 × 19,2 × 3,2 mm) se stínicím krytem
  const espW = -bw / 2 + 3 + 9.6;
  part(role === 'master' ? 'ESP32-S3-WROOM-1U' : 'ESP32-WROOM-32UE', 'pcb', 3, espW, 18, 0.8, 19.2);
  part('ESP_stineni', 'shield', 3, espW + 1.5, 16, 3.2, 15.5);
  add('ESP_UFL', 'elektronika', 'nickel', makeCylinder(1.2, 1.2, [bx + 9.5, top + 0.8, espW - 7.5], [0, 1, 0]));

  // tlačítka EN a BOOT
  for (const [name, u] of [['tlacitko_EN', -bl / 2 + 11], ['tlacitko_BOOT', bl / 2 - 12]]) {
    part(name, 'switch', u, -bw / 2 + 6, 6, 3.4, 6);
    add(`${name}_hmatnik`, 'elektronika', 'plasticBlack', makeCylinder(1.7, 1.4, [bx + u, top + 3.4, -bw / 2 + 6], [0, 1, 0]));
  }
  // JST konektory lidarů J1–J4 po stranách, programovací hlavička
  for (const [u, w] of [[-bl / 2 + 4.5, -14], [-bl / 2 + 4.5, 2], [bl / 2 - 4.5, -16], [bl / 2 - 4.5, 0]]) {
    part('konektor_JST', 'jst', u, w, 6, 6, 12);
  }
  part('hlavicka_PROG', 'plasticBlack', 6, -5, 2.6, 2.6, 7.6);
  // tantalové kondenzátory, cívka, regulátory, LED, svorkovnice
  for (const [u, w] of [[-bl / 2 + 15, 7], [-bl / 2 + 15, 13], [bl / 2 - 18, 7], [bl / 2 - 18, 13], [-bl / 2 + 11, bw / 2 - 14], [-bl / 2 + 18, bw / 2 - 14]]) {
    part('kondenzator_tantal', 'tantalum', u, w, 7.3, 2.8, 4.3);
  }
  part('civka_L1', 'chip', 0, bw / 2 - 17, 12, 6, 12);
  part('regulator_V2', 'chip', 11, bw / 2 - 16, 6.5, 2.3, 6);
  part('regulator_V1', 'chip', 21, bw / 2 - 11, 6.5, 2.3, 6);
  part('IC_napajeni', 'chip', 2, bw / 2 - 6, 5, 1.5, 4);
  part('LED_3V3', 'led', -2, 3, 1.6, 0.8, 0.8);
  part('LED_5V', 'ledGreen', -2, 6, 1.6, 0.8, 0.8);
  part('svorkovnice', role === 'master' ? 'terminalBlue' : 'terminalGreen', bl / 2 - 8, bw / 2 - 20, 8, 10, 10);
  for (const dw of [-2.5, 2.5]) {
    add('svorkovnice_sroub', 'elektronika', 'nickel', makeCylinder(1.6, 0.8, [bx + bl / 2 - 8, top + 10, bw / 2 - 20 + dw], [0, 1, 0]));
  }
}

function buildFoot(P, tilt) {
  const vh = v(P, 'noha', 'valec_vyska');
  const vr = v(P, 'noha', 'valec_prumer') / 2;
  const dh = v(P, 'noha', 'drzak_vyska');
  const pr = v(P, 'noha', 'prisavka_prumer') / 2;
  const ph = v(P, 'noha', 'prisavka_vyska');
  const out = [];
  const add = (name, mat, shape) => out.push({ name, mat, shape });

  let y = 0;
  if (tilt) {
    // koncept kloubu: kulový čep mezi tělem a válcem
    const jr = Math.min(vr * 0.45, 14);
    add('kloub', 'joint', makeSphere(jr).translate([0, -jr, 0]));
    y = -jr * 1.6;
  }
  // tištěný válec (tmavý) s pruhem pásky jako na fotkách
  const h1 = vh * 0.5, h2 = vh * 0.3, h3 = vh - h1 - h2;
  add('valec', 'printDark', revolveY([[0, y], [vr, y], [vr, y - h1], [0, y - h1]]));
  add('valec_paska', 'tape', makeCylinder(vr + 0.3, h2, [0, y - h1 - h2, 0], [0, 1, 0]));
  add('valec_spodek', 'printDark', makeCylinder(vr, h3, [0, y - vh, 0], [0, 1, 0]));
  y -= vh;
  // držák přísavky: kužel + příruba se šrouby
  add('drzak', 'plasticBlack', revolveY([[0, y], [vr * 0.55, y], [vr * 0.62, y - dh * 0.6], [vr * 0.8, y - dh], [0, y - dh]]));
  let flange = box(-vr * 1.05, y - dh + 1, -vr * 0.55, vr * 1.05, y - dh + 7, vr * 0.55);
  flange = tryFillet(flange, 3, (e) => e.inDirection('Y'));
  add('priruba', 'plasticBlack', flange);
  for (const sx of [-1, 1]) {
    add('priruba_sroub', 'nickel', makeCylinder(4, 2.5, [sx * vr * 0.85, y - dh + 7, 0], [0, 1, 0]));
  }
  // pumpička: tělo, červený indikační kroužek, píst
  const pyc = y - dh * 0.55;
  add('pumpa', 'blue', revolveX([[0, 0], [0, 9], [26, 9], [28, 8], [28, 0]]).translate([vr * 0.5, pyc, 0]));
  add('pumpa_krouzek', 'red', makeCylinder(9.3, 2.5, [vr * 0.5 + 18, pyc, 0], [1, 0, 0]));
  add('pumpa_pist', 'blue', revolveX([[0, 0], [0, 7], [9, 7], [12, 4], [12, 0]]).translate([vr * 0.5 + 28, pyc, 0]));
  y -= dh;
  // přísavka: zvon se zesíleným okrajem a žlutým lemem
  const neck = vr * 0.75;
  add('prisavka', 'rubber', revolveY([[0, y], [neck, y], [neck, y - 4], [pr * 0.86, y - ph + 5], [pr, y - ph + 1.5], [pr, y - ph], [0, y - ph]]));
  add('prisavka_okraj', 'yellow', revolveY([[pr - 3, y - ph], [pr + 3, y - ph], [pr + 3, y - ph + 4.5], [pr - 1, y - ph + 4.5]]));
  return out;
}

function addCapFittings(add, P, role, end, outX, dir, H, W, cap) {
  const kr = v(P, 'konektor', 'prumer') / 2;
  const kl = v(P, 'konektor', 'delka');
  const cy = H * 0.5;
  const holes = [];
  // díl postavený podél +X od čela -> otočit na správnou stranu
  const place = (shape, z) => {
    const s = shape.translate([outX, cy, z]);
    return dir > 0 ? s : s.rotate(180, [outX, cy, z], [0, 1, 0]);
  };

  // kruhový konektor do panelu (GX16): matice, závitové tělo, izolant s piny
  const conn = (z, pins, name) => {
    holes.push(makeCylinder(kr * 0.8, 60, [outX - dir * 30, cy, z], [dir, 0, 0]));
    add(`${name}_matice`, 'konektory', 'nickel', place(revolveX([[0, 0], [0, kr * 1.3], [2.5, kr * 1.3], [2.5, 0]]), z));
    add(`${name}_telo`, 'konektory', 'brass', place(revolveX([[2.5, 0], [2.5, kr], [kl - 0.6, kr], [kl, kr - 0.6], [kl, kr * 0.8], [kl - 3, kr * 0.8], [kl - 3, 0]]), z));
    add(`${name}_izolant`, 'konektory', 'plasticBlack', place(makeCylinder(kr * 0.8, 1, [kl - 3.5, 0, 0], [1, 0, 0]), z));
    for (let i = 0; i < pins; i++) {
      const a = (i / pins) * Math.PI * 2 + Math.PI / 4;
      const r = kr * 0.42;
      add(`${name}_pin`, 'konektory', 'brass', place(makeCylinder(0.8, 2.2, [kl - 3, Math.cos(a) * r, Math.sin(a) * r], [1, 0, 0]), z));
    }
  };
  const level = (z) => {
    const ly = cy + 6;
    holes.push(makeCylinder(9, 3, [dir > 0 ? outX - 3 : outX, ly, z], [1, 0, 0]));
    add('libela', 'konektory', 'level', makeCylinder(8.5, 2.4, [dir > 0 ? outX - 2.8 : outX + 0.4, ly, z], [1, 0, 0]));
    add('libela_krouzek', 'konektory', 'plasticBlack', makeCylinder(4, 0.4, [dir > 0 ? outX : outX - 0.4, ly, z], [1, 0, 0])
      .cut(makeCylinder(3.4, 2, [outX - 1, ly, z], [1, 0, 0])));
  };

  if (role === 'master' && end === 0) {
    const gz = -W * 0.22;
    holes.push(makeCylinder(6, 60, [outX + 30, cy, gz], [-1, 0, 0]));
    // kabelová vývodka (bílá): šestihran, tělo, kopule
    add('vyvodka_matice', 'konektory', 'white', place(makeCylinder(11, 4, [0, 0, 0], [1, 0, 0]), gz));
    add('vyvodka', 'konektory', 'white', place(revolveX([[4, 0], [4, 9.5], [12, 9.5], [16, 7.5], [18, 6], [18, 0]]), gz));
    // prutová anténa: SMA patka, kloub, kuželový prut se zaobleným koncem
    const a = v(P, 'antena', 'uhel');
    const al = Math.max(v(P, 'antena', 'delka'), 30);
    const ant = revolveY([[0, 0], [5.5, 0], [5.5, 9], [5, 9], [5, 17], [4.6, 21], [4, al - 4], [3, al - 1.5], [1.5, al], [0, al]])
      .rotate(90 - a, [0, 0, 0], [0, 0, 1])
      .translate([outX - 18, cy, gz]);
    add('antena', 'konektory', 'rubber', ant);
    level(W * 0.14);
  } else if (role === 'master' && end === 1) {
    conn(-W * 0.22, 4, 'konektor_4pin');
    conn(W * 0.22, 3, 'konektor_3pin');
  } else if (role === 'slave' && end === 0) {
    level(0);
  } else {
    conn(-W * 0.22, 4, 'konektor_4pin');
  }
  for (const h of holes) cap = cap.cut(h);
  add(`cep_${end === 0 ? 'A' : 'B'}`, 'telo', 'cap', cap);
}
