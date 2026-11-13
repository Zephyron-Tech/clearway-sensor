// B-rep model ClearWay v2 (detailní koncept). v1 je archivovaná v parts.js.
// Souřadnice jako v1: X podél těla (0 = čelo A, na voze nahoře), Y kolmo k oknům,
// spodek těla y = 0, nohy do -Y, Z napříč.
//
// Každý díl nese `ex` = posun v rozloženém pohledu (mm při plném rozložení).
//
// Koncept: jedna jednotka pro master i slave, plastové tělo IP67 (skořepina + vana se šňůrovým
// těsněním a šrouby do insertů), čela s O-kroužkem, 3× 21700 (≥ 12 h), modem jako vyměnitelná
// karta pod servisním víčkem, jeden vodotěsný USB-C (nabíjení + servis), kloubové nohy
// s vakuovou přísavkou s pumpičkou, rychloupínákem a očkem na pojistné lanko.
import { makeBox, makeCylinder, makeSphere, makeCompound, Sketcher } from 'replicad';
import { layout, feet } from '../geometry.js';
import { WIN_NAMES_V2 } from '../names.js';
import { MATS } from './parts.js';

const v = (P, g, k) => P[g][k].v;
const box = (x0, y0, z0, x1, y1, z1) => makeBox([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)]);
const cbox = (cx, cy, cz, sx, sy, sz) => box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
const cyl = (r, h, at, dir) => makeCylinder(r, h, at, dir);
function tryFillet(shape, r, filter) { try { return shape.fillet(r, filter); } catch { return shape; } }
function stadiumAcross(cx, len, wid, y0, h) {
  const r = wid / 2, straight = Math.max(len - wid, 0.01);
  return box(cx - r, y0, -straight / 2, cx + r, y0 + h, straight / 2)
    .fuse(cyl(r, h, [cx, y0, -straight / 2], [0, 1, 0]))
    .fuse(cyl(r, h, [cx, y0, straight / 2], [0, 1, 0]));
}
function revolveY(pts) {
  const sk = new Sketcher('XY').movePointerTo(pts[0]);
  for (const p of pts.slice(1)) sk.lineTo(p);
  return sk.close().revolve([0, 1, 0]);
}
function revolveX(pts) {
  const sk = new Sketcher('XY').movePointerTo(pts[0]);
  for (const p of pts.slice(1)) sk.lineTo(p);
  return sk.close().revolve([1, 0, 0]);
}
// lomená trubka (kabel) z válců s kulovými klouby
// (compound bez booleovských operací – rychlé)
function tube(pts, r) {
  const items = [makeSphere(r).translate(pts[0])];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(...d);
    if (L < 0.01) continue;
    items.push(cyl(r, L, a, d.map(x => x / L)), makeSphere(r).translate(b));
  }
  return makeCompound(items);
}
// obdélníková smyčka (těsnicí šňůra / O-kroužek kolem límce) v rovině YZ na pozici x
function loopYZ(x, len, y0, y1, z0, z1, th) {
  return box(x, y0, z0, x + len, y1, z1).cut(box(x - 1, y0 + th, z0 + th, x + len + 1, y1 - th, z1 - th));
}

export { layout };

export function buildUnitCad(P, role) {
  const out = [];
  const add = (name, cat, mat, shape, ex = [0, 0, 0]) => { if (shape) out.push({ name, cat, mat, color: MATS[mat], shape, ex }); };

  const W = v(P, 'profil', 'sirka');
  const H = v(P, 'profil', 'vyska');
  const t = v(P, 'profil', 'stena');
  const R = Math.min(v(P, 'profil', 'zaobleni'), H / 2 - 1, W / 2 - 1);
  const split = H * 0.42;
  const { parts, total } = layout(P);
  const cep = v(P, 'delky', 'cep');
  const collar = 6; // límec čela zasunutý do těla
  const winL = v(P, 'okno', 'delka'), winW = v(P, 'okno', 'sirka');
  const lw = v(P, 'lidar', 'sirka'), ld = v(P, 'lidar', 'hloubka'), lh = v(P, 'lidar', 'vyska');
  const wins = parts.filter(p => p.kind === 'window');
  const segs = [0, 1, 2].map(i => { const a = wins[i], b = wins[i + 1]; const x0 = a.x0 + a.len, x1 = b.x0; return { x0, x1, cx: (x0 + x1) / 2, len: x1 - x0 }; });
  const x0 = cep, x1 = total - cep;
  const zIn = W / 2 - t; // vnitřní stěna
  const lidarBottom = H - lh;

  // ================= tělo: skořepina s okny + vana, pero/drážka, šňůrové těsnění =================
  let outer = tryFillet(box(x0, 0, -W / 2, x1, H, W / 2), R, (e) => e.inDirection('X'));
  const shell = outer.cut(tryFillet(box(x0 - 1, t, -zIn, x1 + 1, H - t, zIn), Math.max(R - t, 0.5), (e) => e.inDirection('X')));
  let top = shell.cut(box(x0 - 1, -1, -W, x1 + 1, split, W));
  let tub = shell.cut(box(x0 - 1, split, -W, x1 + 1, H + 1, W));
  const band = (s) => [s * (W / 2 - t * 0.68), s * (W / 2 - t * 0.32)];
  for (const s of [-1, 1]) {
    const [za, zb] = band(s);
    top = top.fuse(box(x0 + 1, split - 1.4, za, x1 - 1, split + 0.01, zb));          // pero
    tub = tub.cut(box(x0, split - 2.4, za - 0.15, x1, split + 0.1, zb + 0.15));        // drážka
    add(`tesneni_snura_${s > 0 ? 'L' : 'P'}`, 'telo', 'rubber', box(x0 + 1, split - 2.4, za, x1 - 1, split - 1.5, zb), [0, 40, 0]);
  }
  // okna + těsnicí rámečky lidarů
  top = top.cut(wins.map(p => stadiumAcross(p.x0 + p.len / 2, winL, winW, H - t - 1, t + 2)).reduce((a, c) => a.fuse(c)));

  // šrouby skořepina–vana: zespodu do mosazných insertů ve sloupcích skořepiny
  const zb = zIn - 2.6, br = 2.8;
  const screwX = segs.flatMap(s => [s.x0 + 14, s.x1 - 14]);
  // sloupky a otvory se sloučí do jednoho tělesa a přidají/odečtou najednou (rychlejší než po kusech)
  const many = (list) => list.reduce((acc, sh) => (acc ? acc.fuse(sh) : sh), null);
  const pts = screwX.flatMap(x => [-1, 1].map(s => [x, s * zb]));
  top = top.fuse(many(pts.map(([x, z]) => cyl(br, H - t - split, [x, split, z], [0, 1, 0]))))
    .cut(many(pts.map(([x, z]) => cyl(1.9, 5, [x, split - 0.5, z], [0, 1, 0]))));
  tub = tub.fuse(many(pts.map(([x, z]) => cyl(br, split - t, [x, t, z], [0, 1, 0]))))
    .cut(many(pts.flatMap(([x, z]) => [cyl(1.4, split + 2, [x, -1, z], [0, 1, 0]), cyl(2.6, 2.2, [x, -0.01, z], [0, 1, 0])])));
  for (const [x, z] of pts) {
    add('insert_M2.5', 'telo', 'brass', cyl(1.9, 4.5, [x, split, z], [0, 1, 0]).cut(cyl(1.1, 6, [x, split - 1, z], [0, 1, 0])), [0, 85, 0]);
    add('sroub_M2.5_skorepina', 'telo', 'nickel', cyl(2.3, 1.6, [x, 0.3, z], [0, 1, 0]).fuse(cyl(1.25, split + 2.2, [x, 1.9, z], [0, 1, 0])), [0, -55, 0]);
  }

  // kolébky lidarů ve vaně a pryžové podložky
  tub = tub.fuse(many(wins.flatMap(p => [-1, 1].map(sx => { const cx = p.x0 + p.len / 2; return box(cx + sx * (ld / 2 + 0.2), t, -lw / 2 + 2, cx + sx * (ld / 2 + 1.8), lidarBottom - 2, lw / 2 - 2); }))));
  for (const p of wins) {
    const cx = p.x0 + p.len / 2;
    add('podlozka_lidaru', 'lidar', 'rubber', box(cx - ld / 2 + 1, lidarBottom - 2, -lw / 2 + 3, cx + ld / 2 - 1, lidarBottom, lw / 2 - 3), [0, 20, 0]);
  }

  // servisní víčko modemu ve dně vany (segment B), polodrážka + těsnění + 4 šrouby
  const segB = segs[1];
  const hw = 64, hd = 36;
  tub = tub.cut(box(segB.cx - hw / 2, -1, -hd / 2, segB.cx + hw / 2, t + 1, hd / 2))
    .cut(box(segB.cx - hw / 2 - 3, -0.01, -hd / 2 - 3, segB.cx + hw / 2 + 3, 1.2, hd / 2 + 3));
  {
    let lid = box(segB.cx - hw / 2 - 2.8, 0, -hd / 2 - 2.8, segB.cx + hw / 2 + 2.8, 1.2, hd / 2 + 2.8)
      .fuse(box(segB.cx - hw / 2 + 0.4, 1.2, -hd / 2 + 0.4, segB.cx + hw / 2 - 0.4, t, hd / 2 - 0.4));
    const corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => [segB.cx + a * (hw / 2 + 0.2), b * (hd / 2 + 0.2)]);
    for (const [x, z] of corners) lid = lid.cut(cyl(1.4, 4, [x, -1, z], [0, 1, 0]));
    add('servisni_viko', 'telo', 'printDark', lid, [0, -70, 0]);
    add('servisni_viko_tesneni', 'telo', 'rubber', box(segB.cx - hw / 2 - 2.6, 1.2, -hd / 2 - 2.6, segB.cx + hw / 2 + 2.6, 1.7, hd / 2 + 2.6)
      .cut(box(segB.cx - hw / 2 - 0.6, 1, -hd / 2 - 0.6, segB.cx + hw / 2 + 0.6, 2, hd / 2 + 0.6)), [0, -52, 0]);
    for (const [x, z] of corners) add('sroub_M2_viko', 'telo', 'nickel', cyl(2, 1, [x, -0.6, z], [0, 1, 0]).fuse(cyl(1, 6, [x, 0.4, z], [0, 1, 0])), [0, -88, 0]);
  }

  // membránový odvzdušňovací ventil (proti kondenzaci) ve dně vany u čela B
  {
    const vx = segs[2].x1 - 8;
    tub = tub.cut(cyl(3.2, t + 2, [vx, -1, 0], [0, 1, 0]));
    add('ventil_GORE', 'telo', 'white', cyl(4.5, 1.2, [vx, -1.2, 0], [0, 1, 0]).fuse(cyl(3, t, [vx, 0, 0], [0, 1, 0])), [0, -40, 0]);
    add('ventil_matice', 'telo', 'plasticBlack', cyl(4.6, 1.6, [vx, t, 0], [0, 1, 0]).cut(cyl(3.1, 3, [vx, t - 1, 0], [0, 1, 0])), [0, 25, 0]);
  }

  add('kryt_horni_skorepina', 'telo', 'print', top, [0, 95, 0]);
  add('vana_spodni', 'telo', 'printDark', tub, [0, 0, 0]);

  // ================= lidary (TFmini Plus), jedno čelo s čočkou v rovině skořepiny =================
  wins.forEach((p) => {
    const cx = p.x0 + p.len / 2, name = WIN_NAMES_V2[p.index];
    let lid = tryFillet(box(cx - ld / 2, lidarBottom, -lw / 2, cx + ld / 2, H - t, lw / 2), 1.5, (e) => e.inDirection('Y'));
    lid = lid.fuse(stadiumAcross(cx, winL - 0.6, winW - 0.6, H - t - 0.5, t + 0.5));
    const lensL = (winL - 0.6) * 0.84, lensW = (winW - 0.6) * 0.7;
    lid = lid.cut(stadiumAcross(cx, lensL + 0.8, lensW + 0.8, H - 0.8, 1));
    add(`lidar_${name}`, 'lidar', 'lidar', lid, [0, 55, 0]);
    add(`lidar_${name}_cocka`, 'lidar', 'lens', stadiumAcross(cx, lensL, lensW, H - 0.8, 0.6), [0, 55, 0]);
    add(`lidar_${name}_tesneni`, 'lidar', 'rubber',
      stadiumAcross(cx, winL + 2.4, winW + 2.4, H - t - 1, 1).cut(stadiumAcross(cx, winL - 0.6, winW - 0.6, H - t - 2, 3)), [0, 75, 0]);
    add(`lidar_${name}_konektor`, 'lidar', 'jst', cbox(cx, lidarBottom - 1.5, lw * 0.25, 6, 3, 9), [0, 55, 0]);
  });

  // ================= baterie 3× 21700 (2 v segmentu A, 1 v segmentu C) =================
  const bd = v(P, 'baterie', 'prumer'), bl = v(P, 'baterie', 'delka');
  const cy = t + 1.2 + bd / 2;
  const pack = (s, zs, tag) => {
    const L = bl + 7;
    let holder = box(s.cx - L / 2, t, -zIn + 3.4, s.cx + L / 2, cy, zIn - 3.4);
    holder = holder.fuse(box(s.cx - L / 2, t, -zIn + 3.4, s.cx - L / 2 + 2, cy + bd * 0.35, zIn - 3.4))
      .fuse(box(s.cx + L / 2 - 2, t, -zIn + 3.4, s.cx + L / 2, cy + bd * 0.35, zIn - 3.4));
    for (const z of zs) holder = holder.cut(cyl(bd / 2 + 0.3, bl + 1, [s.cx - (bl + 1) / 2, cy, z], [1, 0, 0]));
    add(`drzak_baterii_${tag}`, 'baterie', 'plasticBlack', holder, [0, 18, 0]);
    for (const z of zs) {
      add('clanek_21700', 'baterie', 'blue', cyl(bd / 2, bl - 2, [s.cx - bl / 2 + 1, cy, z], [1, 0, 0]), [0, 36, 0]);
      add('clanek_21700_izolator', 'baterie', 'white', cyl(bd / 2 + 0.05, 0.6, [s.cx + bl / 2 - 1.6, cy, z], [1, 0, 0]), [0, 36, 0]);
      add('clanek_21700_plus', 'baterie', 'nickel', cyl(bd * 0.18, 1, [s.cx + bl / 2 - 1, cy, z], [1, 0, 0]), [0, 36, 0]);
      for (const sx of [-1, 1]) add('kontakt_baterie', 'baterie', 'nickel', cbox(s.cx + sx * (L / 2 - 2.6), cy, z, 0.4, bd * 0.6, bd * 0.6), [0, 18, 0]);
    }
  };
  pack(segs[0], [-(bd / 2 + 0.9), bd / 2 + 0.9], 'A');
  pack(segs[2], [-(bd / 2 + 0.9)], 'C');
  // BMS + NTC vedle samotného článku v segmentu C
  add('BMS_deska', 'baterie', 'pcb', box(segs[2].cx - 22, cy - bd / 2, 5, segs[2].cx + 22, cy - bd / 2 + 1.2, zIn - 4), [0, 30, 0]);
  add('BMS_ochrana_IC', 'baterie', 'chip', cbox(segs[2].cx - 6, cy - bd / 2 + 1.8, 13, 5, 1.2, 4), [0, 30, 0]);
  add('BMS_MOSFET', 'baterie', 'chip', cbox(segs[2].cx + 6, cy - bd / 2 + 1.8, 13, 5, 1.2, 6), [0, 30, 0]);
  add('NTC_cidlo', 'baterie', 'yellow', cyl(1.2, 4, [segs[2].cx, cy, -1.5], [1, 0, 0]), [0, 30, 0]);

  // ================= hlavní deska (segment B) + modem jako karta pod servisním víčkem =================
  const bw = v(P, 'deska', 'sirka'), blen = Math.min(v(P, 'deska', 'delka'), segB.len - 4), bt = v(P, 'deska', 'tloustka');
  const by = 14, btop = by + bt;
  {
    let pcb = box(segB.cx - blen / 2, by, -bw / 2, segB.cx + blen / 2, btop, bw / 2);
    const holes = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => [segB.cx + a * (blen / 2 - 3.5), b * (bw / 2 - 3.5)]);
    for (const [x, z] of holes) pcb = pcb.cut(cyl(1.4, bt + 2, [x, by - 1, z], [0, 1, 0]));
    add('deska_hlavni', 'elektronika', 'pcb', pcb, [0, 28, 0]);
    for (const [x, z] of holes) {
      add('distancni_sloupek', 'elektronika', 'nickel', cyl(2.2, by - t, [x, t, z], [0, 1, 0]), [0, 12, 0]);
      add('sroub_desky', 'elektronika', 'nickel', cyl(2.2, 1.4, [x, btop, z], [0, 1, 0]), [0, 34, 0]);
    }
    const part = (name, mat, u, w, su, sh, sw) => add(name, 'elektronika', mat, cbox(segB.cx + u, btop + sh / 2, w, su, sh, sw), [0, 28, 0]);
    part('ESP32-S3-MINI-1', 'shield', -blen / 2 + 12, -bw / 2 + 11, 15.4, 2.4, 15.4);
    part('ESP32-S3-MINI-1_antena', 'pcb', -blen / 2 + 12, -bw / 2 + 11 + 10.1, 15.4, 0.8, 4.8);
    part('nabijecka_BQ25895', 'chip', 0, 9, 4, 0.9, 4);
    part('fuel_gauge_MAX17048', 'chip', 7, 9, 2, 0.8, 2);
    part('menic_5V_TPS63070', 'chip', 0, -6, 3, 0.9, 3);
    part('civka_5V', 'chip', 7, -6, 4, 2.5, 4);
    part('civka_nabijecky', 'chip', -7, 9, 4, 2.5, 4);
    part('kondenzator', 'tantalum', 14, -6, 3.5, 1.9, 2.8);
    part('kondenzator', 'tantalum', 14, 2, 3.5, 1.9, 2.8);
    part('ochrana_USB_ESD', 'chip', -2, 16, 2, 0.8, 1.6);
    part('LED_stav', 'ledGreen', -blen / 2 + 24, -2, 1.6, 0.8, 0.8);
    for (const [u, w] of [[-blen / 2 + 3, 10], [-blen / 2 + 3, 18], [blen / 2 - 3, 10], [blen / 2 - 3, 18]]) part('konektor_JST_GH_lidar', 'jst', u, w, 4.5, 4.2, 7);
    part('konektor_FFC_celo_B', 'plasticBlack', blen / 2 - 4, -12, 5, 2, 12);
    part('konektor_baterie', 'jst', -blen / 2 + 4, -14, 5, 5, 8);

    // modemová karta v M.2 (key E) na spodní straně desky, vyndá se servisním víčkem
    const cardL = 42, cardW = 30, cy0 = by - 4.6;
    const cx0 = segB.cx - cardL / 2 + 6;
    add('M.2_slot', 'elektronika', 'plasticBlack', cbox(cx0 - 3.5, by - 2, 0, 5, 4, 24), [0, 28, 0]);
    add('M.2_pojistny_sroub', 'elektronika', 'nickel', cyl(2, by - cy0 + 1, [cx0 + cardL - 2.5, cy0 - 1, 0], [0, 1, 0]), [0, 28, 0]);
    if (role === 'master') {
      const ex = [0, -42, 0];
      add('modem_karta', 'elektronika', 'pcb', box(cx0, cy0, -cardW / 2, cx0 + cardL, cy0 + 1, cardW / 2), ex);
      add('modem_SIM7080G', 'elektronika', 'shield', cbox(cx0 + 18, cy0 - 1.15, -3, 17.6, 2.3, 15.7), ex);
      add('drzak_nanoSIM', 'elektronika', 'nickel', cbox(cx0 + 34, cy0 - 0.7, 5, 12, 1.4, 13), ex);
      add('UFL_LTE', 'elektronika', 'nickel', cyl(1.2, 1.2, [cx0 + 30, cy0 - 1.2, -11], [0, 1, 0]), ex);
      add('UFL_GNSS', 'elektronika', 'nickel', cyl(1.2, 1.2, [cx0 + 30, cy0 - 1.2, -6], [0, 1, 0]), ex);
    }
  }

  // ================= kabeláž: lidary pod stropem skořepiny k hlavní desce, koax antén, baterie, FFC =================
  const ceil = H - t - 2;
  wins.forEach((p, i) => {
    const cx = p.x0 + p.len / 2;
    const s = i < 2 ? 1 : -1;               // J1, J2 vlevo; J3, J4 vpravo
    const toward = i < 2 ? 1 : -1;          // směrem k hlavní desce
    const zc = lw * 0.25, zr = s * (zIn - 6.5);
    const endX = i < 2 ? segB.cx - blen / 2 + 3 : segB.cx + blen / 2 - 3;
    const endZ = i % 2 ? 18 : 10;
    const xr = cx + toward * (ld / 2 + 3);
    add(`kabel_lidar_${WIN_NAMES_V2[i]}`, 'elektronika', 'rubber', tube([
      [cx, lidarBottom - 1.5, zc], [xr, lidarBottom - 1.5, zc], [xr, ceil, zc], [xr, ceil, zr],
      [endX - toward * 8, ceil, zr], [endX - toward * 8, btop + 6, endZ], [endX, btop + 4.2, endZ]], 1.1), [0, 10, 0]);
  });
  // koax z antén v čele A k modemu
  for (const [dz, name] of [[0, 'LTE'], [3, 'GNSS']]) {
    add(`koax_${name}`, 'elektronika', 'plasticBlack', tube([
      [cep + 4, H / 2 + 2, -zIn + 8 + dz], [cep + 8, ceil - 1, -zIn + 8 + dz], [segB.cx - 30, ceil - 1, -zIn + 8 + dz],
      [segB.cx - 30, by - 8, -12 + dz * 1.5]], 0.6), [-20, 10, 0]);
  }
  // napájení z baterií
  for (const [s, mat] of [[1, 'red'], [-1, 'rubber']]) {
    add('vodic_baterie_A', 'baterie', mat, tube([[segs[0].cx + bl / 2 + 3, cy + bd * 0.35 + 1, -14 + s * 1.5], [segB.cx - blen / 2 + 4, btop + 5, -14 + s * 1.5]], 0.7), [0, 22, 0]);
    add('vodic_baterie_C', 'baterie', mat, tube([[segs[2].cx - bl / 2 - 3, cy + bd * 0.35 + 1, 8 + s * 1.5], [segB.cx + blen / 2 - 6, btop + 5, 8 + s * 1.5], [segB.cx - blen / 2 + 4, btop + 5, -10 + s * 1.5]], 0.7), [0, 22, 0]);
  }

  // ================= čela =================
  const capShell = (xa, xb, outer) => {
    // duté čelo: vnější stěna 2,5 mm na straně `outer`, límec do těla s drážkou na O-kroužek
    let c = tryFillet(box(xa, 0, -W / 2, xb, H, W / 2), R, (e) => e.inDirection('X'));
    c = tryFillet(c, 2, (e) => e.inPlane('YZ', outer));
    const dir = outer === xa ? 1 : -1; // směr dovnitř tělesa
    const inX0 = outer + dir * 2.5;
    c = c.cut(box(inX0, t, -zIn, outer + dir * (cep + 1), H - t, zIn));
    // límec
    const cx0 = dir > 0 ? xb : xa - collar;
    let col = tryFillet(box(cx0, t + 0.2, -zIn + 0.2, cx0 + collar, H - t - 0.2, zIn - 0.2), Math.max(R - t - 0.2, 0.4), (e) => e.inDirection('X'))
      .cut(box(cx0 - 1, t + 2, -zIn + 2, cx0 + collar + 1, H - t - 2, zIn - 2));
    const gx = cx0 + collar / 2 - 0.8;
    col = col.cut(loopYZ(gx, 1.6, t + 0.1, H - t - 0.1, -zIn + 0.1, zIn - 0.1, 0.9));
    c = c.fuse(col);
    // šroubové sloupky (2 nahoře, 1 dole)
    return { shell: c, dir, gx };
  };
  const capScrews = [[22, -W / 2 + 10], [22, W / 2 - 10], [7, 0]];
  const ends = [
    { end: 0, xa: 0, xb: cep, outer: 0 },
    { end: 1, xa: total - cep, xb: total, outer: total },
  ];
  for (const e of ends) {
    let { shell: capS, dir, gx } = capShell(e.xa, e.xb, e.outer);
    const out = -dir; // směr ven
    const ex = (k) => [out * k, 0, 0];
    for (const [y, z] of capScrews) {
      capS = capS.cut(cyl(1.4, cep + collar + 2, [e.outer - out * 1, y, z], [dir, 0, 0]));
      capS = capS.cut(cyl(2.5, 1.6, [e.outer - out * 0.01, y, z], [dir, 0, 0]));
      add('sroub_M2.5_celo', 'telo', 'nickel', cyl(2.3, 1.4, [e.outer + dir * 0.1, y, z], [dir, 0, 0]).fuse(cyl(1.25, cep + 4, [e.outer + dir * 1.5, y, z], [dir, 0, 0])), ex(150));
    }
    add(`O_krouzek_cela_${e.end ? 'B' : 'A'}`, 'telo', 'rubber', loopYZ(gx + 0.15, 1.3, t + 0.3, H - t - 0.3, -zIn + 0.3, zIn - 0.3, 1.1), ex(80));

    if (e.end === 1) {
      const face = total, cyU = H * 0.45, zU = -12, zBtn = 12, yBtn = 14, yLed = 26;
      // otvory v čele B
      capS = capS.cut(cbox(face - 1.25, cyU, zU, 4, 3.8, 9.4));
      capS = capS.cut(cyl(4.6, 4, [face - 3, yBtn, zBtn], [1, 0, 0]));
      capS = capS.cut(cyl(1.6, 4, [face - 3, yLed, zBtn], [1, 0, 0]));
      // vodotěsná USB-C zásuvka (panel, IP67): příruba zvenku, tělo zevnitř na desce čela
      add('USB-C_IP67_priruba', 'konektory', 'plasticBlack', cbox(face + 0.6, cyU, zU, 1.2, 9.5, 16).cut(cbox(face + 0.6, cyU, zU, 3, 3.4, 9)), ex(100));
      add('USB-C_IP67', 'konektory', 'nickel', cbox(face - 3.6, cyU, zU, 7.2, 3.2, 8.9).cut(cbox(face - 3, cyU, zU, 7.4, 2.4, 8.1)), ex(60));
      add('USB-C_jazycek', 'konektory', 'plasticBlack', cbox(face - 3.4, cyU, zU, 5.6, 0.7, 6.6), ex(60));
      // gumová krytka na poutku (otevřená, visí vedle)
      add('USB-C_krytka', 'konektory', 'rubber', tryFillet(cbox(face + 3.2, cyU - 12, zU, 4, 8, 14), 1.5, (k) => k.inDirection('X'))
        .fuse(cbox(face + 2.2, cyU - 12, zU, 2, 3, 8)), ex(100));
      add('USB-C_poutko', 'konektory', 'rubber', box(face + 0.4, cyU - 8, zU + 6, face + 1.2, cyU - 4.6, zU + 8), ex(100));
      // tlačítko pod silikonovou membránou, světlovod RGB, ventil už je ve dně
      add('tlacitko_membrana', 'konektory', 'rubber', revolveX([[0, 0], [0, 5.2], [0.6, 5.2], [1.4, 3.6], [1.6, 0]]).translate([face - 0.4, yBtn, zBtn]), ex(100));
      add('svetlovod_RGB', 'konektory', 'ledGreen', cyl(1.5, 3.4, [face - 3, yLed, zBtn], [1, 0, 0]), ex(100));
      // destička čela B (svisle za stěnou): USB-C, mikrospínač, RGB LED, FFC k hlavní desce
      const px = face - 2.5 - 7.6;
      add('deska_cela_B', 'konektory', 'pcb', box(px, t + 1.5, -zIn + 3, px + 1.2, H - t - 1.5, zIn - 3), ex(55));
      add('mikrospinac', 'konektory', 'switch', cbox(px + 2.9, yBtn, zBtn, 3.4, 6, 6), ex(55));
      add('mikrospinac_hmatnik', 'konektory', 'plasticBlack', cyl(1.6, 2.5, [px + 4.6, yBtn, zBtn], [1, 0, 0]), ex(55));
      add('LED_RGB', 'konektory', 'ledGreen', cbox(px + 1.8, yLed, zBtn, 1.2, 2, 2), ex(55));
      add('ESD_ochrana_USB', 'konektory', 'chip', cbox(px - 0.5, cyU - 6, zU, 0.8, 2, 2.5), ex(55));
      add('FFC_kabel_cela', 'konektory', 'tantalum', tube([[px - 0.5, t + 3, -12], [px - 6, 9.6, -12], [segs[2].x0 - 2, 9.6, -12], [segB.cx + blen / 2 - 4, btop + 1, -12]], 0.4)
        , [20, 10, 0]);
      add('cep_B', 'telo', 'cap', capS, ex(130));
    } else {
      // čelo A: GNSS patch na vnitřní stěně (míří ven = nahoru na voze), flex anténa LTE/BLE
      add('GNSS_patch_25x25', 'konektory', 'white', cbox(2.5 + 2, H / 2, 0, 4, 25, 25).fuse(cbox(2.5 + 4.3, H / 2, 0, 0.6, 18, 18)), ex(60));
      add('GNSS_patch_drzak', 'konektory', 'plasticBlack', cbox(2.5 + 0.6, H / 2, 0, 1.2, 27, 29).cut(cbox(2.5 + 0.6, H / 2, 0, 2, 24, 24)), ex(60));
      add('antena_LTE_BLE_flex', 'konektory', 'yellow', box(4, t + 2, -zIn + 0.3, cep + collar - 1, H - t - 2, -zIn + 0.6), ex(60));
      add('antena_GNSS_LNA', 'konektory', 'pcb', cbox(2.5 + 7, H / 2, -8, 1, 10, 8), ex(60));
      add('cep_A', 'telo', 'cap', capS, ex(130));
    }
  }

  // ================= nohy =================
  for (const f of feet(P)) {
    for (const s of buildJointFoot(P, f)) add(`noha_${f.name}_${s.name}`, 'noha', s.mat, s.shape.translate([f.x, 0, 0]), s.ex);
  }
  return { parts: out, total };
}

function buildJointFoot(P, f) {
  const out = [];
  const add = (name, mat, shape, level) => out.push({ name, mat, shape, ex: [0, -level * 26, 0] });
  const sr = v(P, 'noha', 'valec_prumer') / 2;
  const kv = v(P, 'noha', 'kloub_vyska');
  const kr = v(P, 'noha', 'kloub_prumer') / 2;
  const dh = v(P, 'noha', 'drzak_vyska');
  const pr = v(P, 'noha', 'prisavka_prumer') / 2;
  const ph = v(P, 'noha', 'prisavka_vyska');
  const W = v(P, 'profil', 'sirka');

  // rychloupínák: základová destička přišroubovaná ke dnu (rybina), saně nohy se západkou
  const pw = Math.min(W - 8, 46);
  add('desticka_zakladni', 'printDark', tryFillet(cbox(0, -1.5, 0, 40, 3, pw), 1, (e) => e.inDirection('Y'))
    .fuse(box(-14, -6, -9, 14, -3, 9)), 0.4);
  for (const sx of [-1, 1]) add('desticka_sroub', 'nickel', cyl(2.2, 1, [sx * 16, -3, 0], [0, 1, 0]), 0.6);
  let sled = tryFillet(box(-20, -12, -pw / 2, 20, -6, pw / 2), 1.5, (e) => e.inDirection('Y'));
  sled = sled.cut(box(-15, -7, -9.4, 15, -5, 9.4));
  add('sane', 'plasticBlack', sled, 1.4);
  add('zapadka', 'blue', box(20, -11, -6, 24, -7, 6).fuse(box(23, -14, -6, 26, -7, 6)), 1.6);
  // očko na pojistné lanko
  add('ocko_lanka', 'nickel', cyl(4.5, 2, [-20, -9, pw / 2 - 1], [0, 0, 1]).cut(cyl(2.4, 4, [-20, -9, pw / 2 - 2], [0, 0, 1])).translate([-4, 0, 0]), 1.4);
  // dřík a pouzdro kloubu s aretačním šroubem a kolečkem
  add('drik', 'printDark', cyl(sr, kv - kr * 0.55 - 12, [0, -(kv - kr * 0.55), 0], [0, 1, 0]), 2.4);
  add('pouzdro_kloubu', 'plasticBlack', cyl(kr * 1.28, kr * 1.15, [0, -kv - kr * 0.3, 0], [0, 1, 0]).cut(makeSphere(kr + 0.2).translate([0, -kv, 0])), 3.2);
  add('aretace_sroub', 'nickel', cyl(2, kr * 1.28 + 5, [0, -kv + kr * 0.25, 0], [0, 0, 1]), 3.2);
  add('aretace_kolecko', 'blue', cyl(7, 4, [0, -kv + kr * 0.25, kr * 1.28 + 4], [0, 0, 1]).cut(cyl(2, 6, [0, -kv + kr * 0.25, kr * 1.28 + 3], [0, 0, 1])), 3.6);
  add('koule', 'nickel', makeSphere(kr).translate([0, -kv, 0]), 4.2);

  // pod kloubem natočené (kolmo ke dveřím): krk, základna s pumpičkou a indikátorem, přísavka
  const lower = [];
  const addL = (name, mat, shape, level) => lower.push({ name, mat, shape, level });
  let y = -kv;
  addL('krk', 'nickel', cyl(kr * 0.42, dh - 4, [0, y - dh + 4, 0], [0, 1, 0]), 5);
  y -= dh;
  addL('zakladna_prisavky', 'plasticBlack', revolveY([[0, y + 6], [pr * 0.42, y + 6], [pr * 0.55, y], [0, y]]), 6);
  const pyc = y + 3.5;
  addL('pumpa', 'blue', revolveX([[0, 0], [0, 7], [20, 7], [22, 6], [22, 0]]).translate([pr * 0.3, pyc, 0]), 6.6);
  addL('pumpa_indikator', 'red', cyl(7.3, 2, [pr * 0.3 + 13, pyc, 0], [1, 0, 0]), 6.6);
  addL('pumpa_pist', 'blue', revolveX([[0, 0], [0, 5.5], [8, 5.5], [10, 3.5], [10, 0]]).translate([pr * 0.3 + 22, pyc, 0]), 7);
  addL('ventil_uvolneni', 'red', cbox(-pr * 0.45, y + 3, 0, 6, 3, 10), 6.6);
  addL('prisavka', 'rubber', revolveY([[0, y], [pr * 0.55, y], [pr * 0.88, y - ph + 4], [pr, y - ph + 1], [pr, y - ph], [0, y - ph]]), 8);
  addL('prisavka_lem', 'yellow', revolveY([[pr - 2.5, y - ph], [pr + 2.5, y - ph], [pr + 2.5, y - ph + 3.5], [pr - 1, y - ph + 3.5]]), 8.2);
  for (const l of lower) {
    const shape = f.tilt ? l.shape.rotate(f.tilt, [0, -kv, 0], [0, 0, 1]) : l.shape;
    out.push({ name: l.name, mat: l.mat, shape, ex: [0, -l.level * 26, 0] });
  }
  return out;
}
