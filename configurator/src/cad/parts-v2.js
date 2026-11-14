// B-rep model ClearWay v2, revize 2 (stavební koncept). v1 je archivovaná v parts.js a tady se z ní nic nepoužívá.
//
// Souřadnice: X podél těla (0 = čelo A, na voze nahoře), Y kolmo k oknům (0 = strana k vozu,
// H = vnější plocha s okny), Z napříč. Nohy do -Y.
//
// Architektura (proč je to takhle, viz docs/navrh-v2.md):
//  - KRYT: jeden díl se stropem, bočnicemi i oběma čely. Všechno je přišroubované do něj.
//  - ZÁKLADNA: rovná deska zespodu. Jediná dělicí rovina = jedno obvodové těsnění (šňůra v drážce),
//    šrouby jsou vně těsnění, takže žádný šroub nevede do suchého prostoru.
//  - Lidary procházejí stropem zevnitř, těsní je ucpávka (silikonový rámeček stlačený třmenem).
//  - Segment A (nahoře): hlavní deska, modem (Mini PCIe) a SIM pod servisním víčkem, antény.
//  - Segmenty B a C: dva pakety 1S2P z článků 21700 (celkem 1S4P), dole kvůli těžišti.
//  - Čelo B (dole): napájecí deska s vodotěsným USB-C, odvzdušňovací membrána.
//  - Nohy: T-drážka na základně, saně s kulovým kloubem a převlečnou maticí, přísavka z v1.
//
// Každý díl nese `ex` (posun v rozloženém pohledu, mm při plném rozložení), `label` (čitelný název),
// `spec` (co koupit / jak vyrobit) a `src` (tisk, nakup, pcb, kabel, tesneni).
import { makeBox, makeCylinder, makeSphere, makeCompound, Sketcher } from 'replicad';
import { layout, feet } from '../geometry.js';
import { WIN_NAMES_V2 } from '../names.js';

const v = (P, g, k) => P[g][k].v;

// barvy do STEP (náhled má vlastní PBR materiály v client.js)
const COLORS = {
  pa12: '#c9cbce', pa12Dark: '#3b3d41', silicone: '#cf4a32', rubber: '#1a1b1d', foam: '#2a2b2d', brass: '#c9a35a',
  steel: '#b8bcc0', nickel: '#c3c6ca', pcb: '#1c4a2c', shield: '#c8c8c0', chip: '#202124', jst: '#f0eee4',
  tantalum: '#e6a91d', plasticBlack: '#232427', white: '#f2f1ec', lidar: '#1d1e21', lens: '#1f2f42',
  cell: '#1f8fa3', fishpaper: '#4a6b57', kapton: '#c98a1b', fpc: '#b8741a', ceramic: '#e6dfcc', red: '#d23a2e',
  yellow: '#f3d227', blue: '#1f5fd1', green: '#2f9e55', ledRing: '#33d17a', switch: '#9a9ca0',
};

const Y = [0, 1, 0];
const box = (x0, y0, z0, x1, y1, z1) => makeBox([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)]);
const cbox = (cx, cy, cz, sx, sy, sz) => box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
const cyl = (r, h, at, dir = Y) => makeCylinder(r, h, at, dir);
function tryFillet(shape, r, filter) { try { return shape.fillet(r, filter); } catch { return shape; } }
const filletY = (s, r) => tryFillet(s, r, (e) => e.inDirection('Y'));
// zaoblený obdélník: delší strana lenZ napříč, widX podél těla, výška h od y0
const rrect = (lenZ, widX, h, r, y0 = 0) => filletY(box(-widX / 2, y0, -lenZ / 2, widX / 2, y0 + h, lenZ / 2), r);
function stadiumZ(len, wid, h, y0) {
  const r = wid / 2, s = Math.max(len - wid, 0.01);
  return box(-r, y0, -s / 2, r, y0 + h, s / 2).fuse(cyl(r, h, [0, y0, -s / 2])).fuse(cyl(r, h, [0, y0, s / 2]));
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
// kopie prototypu na místo (translate i rotate v replicadu ruší původní tvar, proto clone)
const at = (proto, x, y, z) => proto.clone().translate([x, y, z]);
// vzájemně se nedotýkající tělesa jako jeden nástroj pro booleovskou operaci
const group = (list) => (list.length === 1 ? list[0] : makeCompound(list));
// kabel: lomená trubka (compound bez booleovských operací)
function tube(pts, r) {
  const items = [makeSphere(r).translate(pts[0])];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(...d);
    if (len < 0.01) continue;
    items.push(cyl(r, len, a, d.map(x => x / len)), makeSphere(r).translate(b));
  }
  return makeCompound(items);
}

// spojovací materiál (hlava dole, dřík do +Y, počátek v rovině dosednutí)
const screwCsk = (d, dk, k, len) => revolveY([[0, 0], [dk / 2, 0], [d / 2, k], [d / 2, len], [0, len]]);
const screwPan = (d, dk, hk, len) => revolveY([[0, -hk], [dk / 2 - 0.4, -hk], [dk / 2, -hk + 0.4], [dk / 2, 0], [d / 2, 0], [d / 2, len], [0, len]]);
const insertM25 = () => revolveY([[1.05, 0], [1.8, 0], [1.8, 4], [1.05, 4]]);
const cskHole = () => revolveY([[0, -0.2], [2.75, -0.2], [2.75, 0], [1.4, 1.35], [1.4, 9], [0, 9]]);

export { layout };

export function buildUnitCad(P, role) {
  const out = [];
  const add = (name, cat, mat, shape, ex = [0, 0, 0], meta = {}) => {
    if (shape) out.push({ name, cat, mat, color: COLORS[mat] || '#888888', shape, ex, ...meta });
  };

  const L = v(P, 'delky', 'celkova');
  const W = v(P, 'profil', 'sirka'), H = v(P, 'profil', 'vyska');
  const t = v(P, 'profil', 'stena'), tr = v(P, 'profil', 'strop'), tb = v(P, 'profil', 'zakladna');
  const R = v(P, 'profil', 'zaobleni');
  const we = v(P, 'delky', 'cep');
  const FW = 9.4, FH = 5.5;               // příruba kolem otvoru krytu: šířka a výška
  const zi = W / 2 - t, zo = W / 2 - FW;  // vnitřní stěna, hrana otvoru
  const yR = H - tr, yF = tb + FH;        // spodek stropu, vršek příruby
  const xs = [1, 2, 3, 4].map(i => v(P, 'delky', `okno_${i}`));
  const lw = v(P, 'lidar', 'sirka'), ld = v(P, 'lidar', 'hloubka'), lh = v(P, 'lidar', 'vyska');
  const oz = v(P, 'okno', 'delka'), ox = v(P, 'okno', 'sirka'), rec = v(P, 'okno', 'zapusteni');
  const total = layout(P).total;
  const ft = feet(P);

  const zIns = W / 2 - 3.0;               // osa šroubů základny
  const nScrew = Math.max(2, Math.round(v(P, 'tesneni', 'srouby_na_stranu')));
  const screwXs = Array.from({ length: nScrew }, (_, i) => 12 + (i * (L - 24)) / (nScrew - 1));
  const zLb = lw / 2 + 7.1;               // osa šroubů třmenu lidaru
  const bx = v(P, 'deska', 'poloha_x'), bl = v(P, 'deska', 'delka'), bw = v(P, 'deska', 'sirka'), bt = v(P, 'deska', 'tloustka');
  const yBt = 19, yBb = yBt - bt;         // deska: horní (ke stropu) a spodní (osazená) plocha
  const sx = bl / 2 - 4, sz = bw / 2 - 4; // sloupky desky
  const packX = [(xs[1] + xs[2]) / 2, (xs[2] + xs[3]) / 2];
  const cd = v(P, 'baterie', 'prumer'), cl = v(P, 'baterie', 'delka');
  const packHalf = cl / 2 + 2.6;
  const yCell = yR - 0.8 - cd / 2;        // osa článků (0,8 mm pěna pod stropem)
  const xPb = L - we - 6;                 // dosedací plocha napájecí desky (konec sloupků)
  // servisní otvor v základně
  const hx0 = bx - 38, hx1 = bx + 42, hz = 17;

  // ============================== KRYT ==============================
  let hood = filletY(box(0, tb, -W / 2, L, H, W / 2), R);
  hood = tryFillet(hood, Math.min(R, 4), (e) => e.inPlane('XZ', H));
  hood = hood.cut(box(we, yF, -zi, L - we, yR, zi))
    .cut(filletY(box(FW, tb - 1, -zo, L - FW, yF + 0.5, zo), 3));

  // ucpávka lidaru: límec pod stropem, kapsa na těsnění, průchod stropem, dva sloupky třmenu
  const collarProto = rrect(lw + 4.6 + 3.2, ld + 4.6 + 3.2, 4.1, 4.6, yR - 4)
    .fuse(cyl(3.2, 5.6, [0, yR - 5.5, zLb])).fuse(cyl(3.2, 5.6, [0, yR - 5.5, -zLb]));
  const pocketProto = rrect(lw + 4.6, ld + 4.6, 4.2, 3.2, yR - 4.1).fuse(rrect(oz, ox, tr + 2, 2.3, yR - 0.5))
    .fuse(cyl(1.8, 4.7, [0, yR - 5.6, zLb])).fuse(cyl(1.8, 4.7, [0, yR - 5.6, -zLb]));

  const adds = [], cuts = [];
  for (const cx of xs) { adds.push(at(collarProto, cx, 0, 0)); cuts.push(at(pocketProto, cx, 0, 0)); }
  // sloupky hlavní desky
  for (const dx of [-sx, sx]) for (const dz of [-sz, sz]) {
    adds.push(cyl(3, yR - yBt + 0.1, [bx + dx, yBt, dz]));
    cuts.push(cyl(1.8, 4.7, [bx + dx, yBt - 0.1, dz]));
  }
  // žebra: dorazy paketů a vyztužení krytu, pod nimi (y < 14) zůstává kanál na kabely
  const ribXs = packX.flatMap(c => [c - packHalf - 2.5, c + packHalf + 0.5]);
  for (const x of ribXs) adds.push(box(x, 14, -zi - 0.1, x + 2, yR + 0.1, zi + 0.1));
  // sloupky napájecí desky na vnitřní straně čela B
  for (const s of [-1, 1]) {
    adds.push(cyl(3, 6.1, [xPb, 27, s * 21.5], [1, 0, 0]));
    cuts.push(cyl(1.8, 4.7, [xPb - 0.1, 27, s * 21.5], [1, 0, 0]));
  }
  // drážka obvodového těsnění ve spodní ploše příruby
  cuts.push(filletY(box(6.4, tb - 0.2, -25.6, L - 6.4, tb + 1.5, 25.6), 4).cut(filletY(box(8.4, tb - 0.3, -23.6, L - 8.4, tb + 1.6, 23.6), 2)));
  // otvory pro závitové vložky základny
  for (const x of screwXs) for (const s of [-1, 1]) cuts.push(cyl(1.8, 4.8, [x, tb - 0.1, s * zIns]));
  // tlačítko ve stropu u čela A, USB-C a odvzdušnění v čele B
  const btn = { x: 11, z: 21 };
  cuts.push(cyl(6.1, tr + 1, [btn.x, yR - 0.5, btn.z]));
  cuts.push(tryFillet(cbox(L - we / 2, 20, 0, we + 1, 3.7, 9.4), 1.7, (e) => e.inDirection('X')));
  cuts.push(cyl(1, we + 1, [L - we - 0.5, 13, -14], [1, 0, 0]));
  hood = hood.fuse(group(adds)).cut(group(cuts));
  add('kryt', 'telo', 'pa12', hood, [0, 0, 0], { label: 'Kryt (tělo se stropem a čely)', src: 'tisk', spec: 'PA12 SLS/MJF, světle šedá; 1 kus, okna a sloupky v jednom dílu' });

  // závitové vložky v krytu
  const ins = insertM25();
  const insSpec = { label: 'Závitová vložka M2,5', src: 'nakup', spec: 'mosaz, zalisovaná teplem, ⌀3,6 × 4 mm' };
  for (const x of screwXs) for (const s of [-1, 1]) add('vlozka_M2.5_zakladna', 'spoj', 'brass', at(ins, x, tb + 0.4, s * zIns), [0, -14, 0], insSpec);
  for (const cx of xs) for (const s of [-1, 1]) add('vlozka_M2.5_lidar', 'spoj', 'brass', at(ins, cx, yR - 5.2, s * zLb), [0, -10, 0], insSpec);
  for (const dx of [-sx, sx]) for (const dz of [-sz, sz]) add('vlozka_M2.5_deska', 'spoj', 'brass', at(ins, bx + dx, yBt + 0.3, dz), [0, -10, 0], insSpec);
  for (const s of [-1, 1]) {
    add('vlozka_M2.5_napajeci_deska', 'spoj', 'brass', ins.clone().rotate(-90, [0, 0, 0], [0, 0, 1]).translate([xPb + 0.3, 27, s * 21.5]), [-10, 0, 0], insSpec);
  }

  // obvodové těsnění (silikonová šňůra v drážce)
  add('tesneni_obvodove', 'tesneni', 'silicone',
    filletY(box(6.55, tb, -25.45, L - 6.55, tb + 1.5, 25.45), 3.9).cut(filletY(box(8.25, tb - 0.1, -23.75, L - 8.25, tb + 1.6, 23.75), 2.1)),
    [0, -92, 0], { label: 'Obvodové těsnění', src: 'tesneni', spec: `silikonová šňůra ⌀${v(P, 'tesneni', 'prumer_snury')} mm, 40–50 ShA, délka ~${Math.round(2 * (L + W) - 60)} mm, spoj lepený na tupo` });

  // ============================== LIDARY ==============================
  const y0L = H - rec - lh;               // zadní plocha lidaru
  const lidProto = rrect(lw, ld, lh, 2, y0L);
  const lensProto = stadiumZ(lw - 6, ld - 7.5, 0.15, H - rec);
  const lblProto = cbox(ld / 2 + 0.06, y0L + lh / 2 - 1, 0, 0.12, 9, 16);
  const conProto = cbox(0, y0L - 1, 6, 6, 2, 8);
  const gasProto = rrect(lw + 4.4, ld + 4.4, 2.6, 3.1, yR - 2.6).cut(rrect(lw, ld, 3, 2, yR - 2.8));
  const yBr = yR - 7;                     // spodek desky třmenu
  let brProto = cbox(0, yBr + 0.75, 0, 26, 1.5, 2 * zLb + 6.4)
    .fuse(rrect(lw + 4.0, ld + 4.0, 2.9, 3, yBr + 1.5))
    .fuse(box(-8, y0L - 2, lw / 2 + 0.8, 8, yBr, lw / 2 + 3.3))
    .fuse(box(-8, y0L - 2, -lw / 2 - 3.3, 8, yBr, -lw / 2 - 0.8))
    .fuse(box(-8, y0L - 2, -lw / 2 - 3.3, 8, y0L - 0.2, lw / 2 + 3.3));
  brProto = brProto.cut(rrect(lw + 0.5, ld + 0.5, 6, 2.2, yBr - 0.5))
    .cut(cbox(0, y0L - 1, 6, 9, 3, 10))
    .cut(group([cyl(1.4, 3, [0, yBr - 0.5, zLb]), cyl(1.4, 3, [0, yBr - 0.5, -zLb])]));
  const panM25x6 = screwPan(2.5, 4.5, 1.7, 6);
  xs.forEach((cx, i) => {
    const n = WIN_NAMES_V2[i];
    add(`lidar_${n}`, 'lidar', 'lidar', at(lidProto, cx, 0, 0), [0, -44, 0], { label: `Lidar ${n} · TFmini Plus`, src: 'nakup', spec: 'Benewake TFmini Plus, UART, 5 V, IP65' });
    add(`lidar_${n}_cocka`, 'lidar', 'lens', at(lensProto, cx, 0, 0), [0, -44, 0], { label: `Čelo lidaru ${n}`, src: 'nakup', spec: 'součást lidaru' });
    add(`lidar_${n}_stitek`, 'lidar', 'white', at(lblProto, cx, 0, 0), [0, -44, 0], { label: `Štítek lidaru ${n}`, src: 'nakup', spec: 'součást lidaru' });
    add(`lidar_${n}_konektor`, 'lidar', 'jst', at(conProto, cx, 0, 0), [0, -44, 0], { label: `Konektor lidaru ${n}`, src: 'nakup', spec: 'JST GH 1,25 mm, 4 piny (součást lidaru)' });
    add(`lidar_${n}_tesneni`, 'tesneni', 'silicone', at(gasProto, cx, 0, 0), [0, -22, 0], { label: `Těsnění lidaru ${n}`, src: 'tesneni', spec: 'silikon 3 mm, 40 ShA, vyříznuté podle obrysu lidaru (vnitřní rozměr s přesahem 0,3 mm)' });
    add(`lidar_${n}_trmen`, 'lidar', 'pa12Dark', at(brProto, cx, 0, 0), [0, -66, 0], { label: `Třmen lidaru ${n}`, src: 'tisk', spec: 'PA12; stlačuje těsnění a drží lidar zezadu' });
    for (const s of [-1, 1]) add('sroub_M2.5x6_trmen', 'spoj', 'steel', at(panM25x6, cx, yBr, s * zLb), [0, -84, 0], { label: 'Šroub M2,5×6 (třmen lidaru)', src: 'nakup', spec: 'ISO 14583 Torx, A2' });
  });

  // ============================== ZÁKLADNA ==============================
  const railProto = (() => {
    const side = (s) => box(-22, -5.6, s * 11, 22, 0, s * 21).cut(box(-23, -2.6, s * 10.9, 23, 0.1, s * 15.2));
    const r = side(1).fuse(side(-1)).fuse(box(-24.5, -5.6, -21, -22, 0, 21)).fuse(box(6, -5.6, 21, 14, 0, W / 2));
    return r.cut(cyl(2.1, 12, [10, -4.1, 20.5], [0, 0, 1])).cut(cyl(1.4, 12, [10, -4.1, 10], [0, 0, 1]));
  })();
  let base = filletY(box(0, 0, -W / 2, L, tb, W / 2), R)
    .fuse(filletY(box(-9, 0, -8, 1, tb, 8), 3))                    // poutko pojistného lanka
    .fuse(group([box(hx0 - 12, tb, -22.4, hx1 + 10, 7.6, 22.4), ...ft.map(f => at(railProto, f.x, 0, 0))]));
  const hole = cskHole();
  const baseCuts = [
    filletY(box(hx0, -1, -hz, hx1, 9, hz), 3),                     // servisní otvor
    cyl(2.5, tb + 1, [-4.5, -0.5, 0]),                             // otvor poutka
    ...screwXs.flatMap(x => [-1, 1].map(s => at(hole, x, 0, s * zIns))),
  ];
  base = base.cut(filletY(box(hx0 - 12, -0.1, -20.7, hx1 + 10, 2.7, 20.7), 3)).cut(group(baseCuts));
  const hatchScrews = [[hx0 - 7, -12], [hx0 - 7, 12], [hx1 + 5, -12], [hx1 + 5, 12]];
  base = base.cut(group(hatchScrews.map(([x, z]) => cyl(1.8, 4.7, [x, 2.6, z]))));
  add('zakladna', 'telo', 'pa12Dark', base, [0, -110, 0], { label: 'Základna s T-drážkami', src: 'tisk', spec: 'PA12 SLS/MJF, černá; drážky pro nohy a rám servisního otvoru v jednom dílu' });
  const cskM25x6 = screwCsk(2.5, 4.7, 1.5, 6);
  for (const x of screwXs) for (const s of [-1, 1]) add('sroub_M2.5x6_zakladna', 'spoj', 'steel', at(cskM25x6, x, 0, s * zIns), [0, -134, 0], { label: 'Šroub M2,5×6 zápustný (základna)', src: 'nakup', spec: 'ISO 14581 Torx T8, A2' });
  for (const [x, z] of hatchScrews) add('vlozka_M2.5_viko', 'spoj', 'brass', at(ins, x, 3, z), [0, -110, 0], insSpec);

  // pěnové podložky paketů (lepené na základnu, drží články přitlačené ke stropu)
  for (const c of packX) for (const dx of [-22, 22]) {
    add('pena_zakladny', 'baterie', 'foam', box(c + dx - 7, tb, -20, c + dx + 7, yCell - cd / 2, 20), [0, -100, 0], { label: 'Pěnová podložka paketu', src: 'nakup', spec: 'EPDM pěna samolepicí, 6 mm' });
  }

  // servisní víčko modemu a SIM
  {
    let lid = filletY(box(hx0 - 11.7, 0, -20.4, hx1 + 9.7, 2, 20.4), 2.8)
      .fuse(filletY(box(hx0 + 0.4, 2, -hz + 0.4, hx1 - 0.4, 4.6, hz - 0.4), 2.6).cut(box(hx0 + 2.4, 2.1, -hz + 2.4, hx1 - 2.4, 4.7, hz - 2.4)));
    lid = lid.cut(group(hatchScrews.map(([x, z]) => at(hole, x, 0, z))));
    add('servisni_viko', 'telo', 'pa12Dark', lid, [0, -142, 0], { label: 'Servisní víčko (modem, SIM)', src: 'tisk', spec: 'PA12; 4 šrouby, přístup bez rozebírání těla' });
    add('servisni_viko_tesneni', 'tesneni', 'silicone',
      filletY(box(hx0 - 3.5, 2, -20.2, hx1 + 3.5, 2.7, 20.2), 2.6).cut(filletY(box(hx0 - 0.3, 1.9, -hz - 0.3, hx1 + 0.3, 2.8, hz + 0.3), 3.2)),
      [0, -128, 0], { label: 'Těsnění servisního víčka', src: 'tesneni', spec: 'silikonová fólie 1 mm, vyříznutý rámeček' });
    const cskM25x5 = screwCsk(2.5, 4.7, 1.5, 5);
    for (const [x, z] of hatchScrews) add('sroub_M2.5x5_viko', 'spoj', 'steel', at(cskM25x5, x, 0, z), [0, -158, 0], { label: 'Šroub M2,5×5 zápustný (víčko)', src: 'nakup', spec: 'ISO 14581 Torx T8, A2' });
  }

  // pojistka nohy (pružinový kolík) v boku každé drážky a pojistné lanko
  for (const f of ft) {
    const px = f.x + 10;
    add('pojistka_kolik', 'noha', 'steel', cyl(2.5, 9, [px, -4.1, 21.5], [0, 0, 1]).fuse(cyl(1.25, 15.5, [px, -4.1, 7], [0, 0, 1])), [0, -110, 26],
      { label: 'Pružinový kolík (pojistka nohy)', src: 'nakup', spec: 'aretační kolík M5 s knoflíkem, typ GN 617' });
    add('pojistka_knoflik', 'noha', 'plasticBlack', cyl(5, 7, [px, -4.1, W / 2 + 0.5], [0, 0, 1]), [0, -110, 26], { label: 'Knoflík pojistky', src: 'nakup', spec: 'součást kolíku' });
  }
  add('lanko_pojistne', 'noha', 'steel', tube([[-4.5, 1.5, 0], [-11, 1.5, 0], [-16, 1.5, 6], [-28, 1.5, 12], [-46, 1.5, 12]], 0.8), [-30, -110, 0],
    { label: 'Pojistné lanko', src: 'nakup', spec: 'nerez lanko ⌀1,5 mm s očky, ~400 mm, karabina do rámu dveří' });
  add('lanko_karabina', 'noha', 'steel', tube([[-46, 1.5, 12], [-52, 1.5, 7], [-64, 1.5, 7], [-70, 1.5, 12], [-64, 1.5, 17], [-52, 1.5, 17], [-46, 1.5, 12]], 1.3), [-30, -110, 0],
    { label: 'Karabina lanka', src: 'nakup', spec: 'nerez, 40 mm' });

  // ============================== HLAVNÍ DESKA (segment A) ==============================
  {
    const exB = [0, -42, 0];
    let pcb = box(bx - bl / 2, yBb, -bw / 2, bx + bl / 2, yBt, bw / 2);
    pcb = pcb.cut(group([-sx, sx].flatMap(dx => [-sz, sz].map(dz => cyl(1.4, bt + 2, [bx + dx, yBb - 1, dz])))));
    add('deska_hlavni', 'elektronika', 'pcb', pcb, exB, { label: 'Hlavní deska', src: 'pcb', spec: `${bl} × ${bw} mm, 4 vrstvy, 1,6 mm; součástky na straně k servisnímu víčku` });
    const panM25x5 = screwPan(2.5, 4.5, 1.7, 5);
    for (const dx of [-sx, sx]) for (const dz of [-sz, sz]) add('sroub_M2.5x5_deska', 'spoj', 'steel', at(panM25x5, bx + dx, yBb, dz), [0, -60, 0], { label: 'Šroub M2,5×5 (hlavní deska)', src: 'nakup', spec: 'ISO 14583 Torx, A2' });
    // součástka na spodní straně: x a z absolutně, výška směrem dolů od desky
    const comp = (name, mat, x, z, sxx, sh, szz, label, spec) => add(name, 'elektronika', mat, cbox(x, yBb - sh / 2, z, sxx, sh, szz), exB, { label, src: 'pcb', spec });
    comp('ESP32-S3-MINI-1', 'shield', bx - 30, 7.25, 15.4, 2.4, 15.5, 'ESP32-S3-MINI-1 (N8)', 'MCU, BLE + ESP-NOW, nativní USB');
    comp('ESP32_antena', 'pcb', bx - 30, 17.5, 15.4, 0.8, 5, 'Anténa modulu ESP32', '2,4 GHz na desce modulu, pod ní nesmí být měď');
    comp('drzak_nanoSIM', 'nickel', bx - 29.5, -10.5, 12.3, 1.4, 13.4, 'Držák nano-SIM', 'push-push, přístupný servisním víčkem');
    comp('GNSS_MAX-M10S', 'shield', bx - 44, 2, 9.7, 2.5, 10.1, 'GNSS přijímač', 'u-blox MAX-M10S, samostatný (modem neumí GNSS a LTE současně)');
    comp('UFL_GNSS', 'nickel', bx - 44, -6, 2.6, 1.3, 2.6, 'U.FL konektor GNSS', '');
    comp('konektor_lidar_J1', 'jst', bx - 47.4, -9.5, 4.25, 4.05, 8.25, 'Konektor lidaru J1', 'JST GH 4p, boční');
    WIN_NAMES_V2.slice(1).forEach((n, i) => comp(`konektor_lidar_${n}`, 'jst', bx + 47.4, (i - 1) * 8.5, 4.25, 4.05, 8.25, `Konektor lidaru ${n}`, 'JST GH 4p, boční'));
    comp('konektor_miniPCIe', 'plasticBlack', bx - 12, 0, 8, 5.6, 30, 'Slot Mini PCIe', '52 pinů, výška 5,6 mm');
    comp('konektor_svazek', 'jst', bx + 4, -17.9, 15.75, 4.05, 4.25, 'Konektor hlavního svazku', 'JST GH 10p, boční');
    comp('konektor_tlacitko', 'jst', bx + 20, 17.9, 9.5, 4.05, 4.25, 'Konektor tlačítka', 'JST GH 5p, boční');
    comp('menic_3V3', 'chip', bx - 20, -14, 3, 0.8, 3, 'Měnič 3,3 V', 'buck-boost (např. TPS63802), z 3,0–4,2 V');
    comp('civka_3V3', 'chip', bx - 19.5, -8.5, 4, 2, 4, 'Cívka měniče 3,3 V', '');
    comp('kondenzator_modem', 'tantalum', bx, 6, 7.3, 2.8, 4.3, 'Kondenzátor modemu', '470 µF, špičky při vysílání');
    comp('kondenzator_modem', 'tantalum', bx, -6, 7.3, 2.8, 4.3, 'Kondenzátor modemu', '470 µF');
    comp('spinac_lidaru', 'chip', bx + 30, 0, 2, 0.8, 2, 'Spínač napájení lidarů', 'load switch 5 V (vypnutí a reset lidarů)');
    comp('IMU', 'chip', bx + 25, 8, 2, 0.9, 2, 'Akcelerometr', 'LIS2DH12: probuzení pohybem, kontrola sklonu a vibrací');
    comp('tlacitko_BOOT', 'switch', bx - 20, 12, 3, 1.5, 2, 'Tlačítko BOOT', 'servisní, pod víčkem');
    comp('tlacitko_EN', 'switch', bx - 20, 17, 3, 1.5, 2, 'Tlačítko EN (reset)', 'servisní, pod víčkem');

    // modem na kartě Mini PCIe (jen master), vyjímá se servisním otvorem
    const yCard = yBb - 4.0;             // horní plocha karty
    for (const dz of [-12.1, 12.1]) {
      add('sloupek_miniPCIe', 'elektronika', 'nickel', cyl(2, 4, [bx + 39.5, yCard, dz]), exB, { label: 'Sloupek karty Mini PCIe', src: 'pcb', spec: 'SMT matice M2, výška 4 mm' });
    }
    if (role === 'master') {
      const exC = [0, -76, 0];
      const meta = { src: 'nakup', spec: 'Mini PCIe karta LTE-M/NB-IoT (např. Quectel BG95-M3 Mini PCIe)' };
      add('modem_karta', 'elektronika', 'pcb', box(bx - 9, yCard - 1, -15, bx + 42, yCard, 15)
        .cut(group([cyl(1.3, 3, [bx + 39.5, yCard - 2, 12.1]), cyl(1.3, 3, [bx + 39.5, yCard - 2, -12.1])])), exC, { label: 'Modem LTE-M (karta Mini PCIe)', ...meta });
      add('modem_modul', 'elektronika', 'shield', cbox(bx + 12, yCard - 1 - 1.15, 0, 24, 2.3, 24), exC, { label: 'Modul modemu', ...meta });
      add('modem_stitek', 'elektronika', 'white', cbox(bx + 12, yCard - 3.36, 0, 18, 0.1, 14), exC, { label: 'Štítek modemu (IMEI)', ...meta });
      add('modem_UFL', 'elektronika', 'nickel', cyl(1.3, 1.3, [bx + 34, yCard - 2.3, 8]), exC, { label: 'U.FL konektor LTE', ...meta });
      for (const dz of [-12.1, 12.1]) add('sroub_M2_karta', 'spoj', 'steel', at(screwPan(2, 3.8, 1.3, 3), bx + 39.5, yCard - 1, dz), [0, -92, 0], { label: 'Šroub M2×3 (karta modemu)', src: 'nakup', spec: 'ISO 7045, A2' });
    }
    // LTE anténa pod stropem nad deskou (vyzařuje ven od vozu), koax na kartu
    add('antena_LTE', 'elektronika', 'fpc', cbox(bx, yR - 0.1, 0, 80, 0.15, 21), [0, -8, 0], { label: 'Anténa LTE (flex)', src: 'nakup', spec: 'širokopásmová FPC ~80 × 21 mm s U.FL, lepená pod strop' });
    if (role === 'master') {
      add('koax_LTE', 'kabely', 'plasticBlack', tube([[bx + 40, yR - 0.5, 0], [bx + 53, yR - 2, 0], [bx + 53, 12, 6], [bx + 37, yCard - 2.6, 8], [bx + 34, yCard - 2.6, 8]], 0.6), [0, -30, 0],
        { label: 'Koax LTE antény', src: 'kabel', spec: 'U.FL, 1,13 mm, ~80 mm (součást antény)' });
    }
  }

  // ============================== ČELO A: GNSS anténa a tlačítko ==============================
  {
    const exG = [0, -36, 0];
    const gz = -6, gy = (yF + yR) / 2;
    add('GNSS_patch', 'elektronika', 'ceramic', cbox(we + 0.2 + 2, gy, gz, 4, 18, 18), exG, { label: 'GNSS patch anténa 18 × 18', src: 'nakup', spec: 'aktivní keramická anténa s LNA a U.FL, lepená na vnitřní stranu čela A (míří nahoru)' });
    add('GNSS_patch_elektroda', 'elektronika', 'nickel', cbox(we + 0.25, gy, gz, 0.1, 13, 13), exG, { label: 'Elektroda patch antény', src: 'nakup', spec: 'součást antény' });
    add('GNSS_zemnici_deska', 'elektronika', 'pcb', cbox(we + 0.2 + 4.8, gy, gz, 1.6, 21, 23), exG, { label: 'Deska GNSS antény', src: 'nakup', spec: 'součást antény' });
    add('GNSS_LNA_kryt', 'elektronika', 'shield', cbox(we + 0.2 + 6.9, gy, gz, 2.2, 10, 10), exG, { label: 'Kryt LNA', src: 'nakup', spec: 'součást antény' });
    add('koax_GNSS', 'kabely', 'plasticBlack', tube([[we + 8, gy - 6, gz], [16, 9.6, -10], [46, 9.6, -10], [bx - 46, 14, -6], [bx - 44, yBb - 1.4, -6]], 0.6), [0, -52, 0],
      { label: 'Koax GNSS antény', src: 'kabel', spec: 'U.FL, 1,13 mm, ~70 mm (součást antény)' });

    // podsvícené tlačítko IP67 ve stropu
    const b = btn;
    add('tlacitko_telo', 'elektronika', 'steel', revolveY([[0, yR - 10], [5.9, yR - 10], [5.9, H], [7.2, H], [7.2, H + 1.6], [5.6, H + 1.6], [5.6, H + 0.9], [0, H + 0.9]]).translate([b.x, 0, b.z]), [0, 44, 0],
      { label: 'Tlačítko s podsvícením', src: 'nakup', spec: 'vandal-proof ⌀12 mm, IP67, momentové, LED kroužek (RGB nebo dvoubarevný), krátké tělo' });
    add('tlacitko_LED_krouzek', 'elektronika', 'ledRing', revolveY([[3.9, H + 0.9], [5.5, H + 0.9], [5.5, H + 1.65], [3.9, H + 1.65]]).translate([b.x, 0, b.z]), [0, 44, 0], { label: 'LED kroužek tlačítka', src: 'nakup', spec: 'součást tlačítka' });
    add('tlacitko_hmatnik', 'elektronika', 'steel', revolveY([[0, H + 0.9], [3.8, H + 0.9], [3.8, H + 1.9], [0, H + 2.2]]).translate([b.x, 0, b.z]), [0, 44, 0], { label: 'Hmatník tlačítka', src: 'nakup', spec: 'součást tlačítka' });
    add('tlacitko_matice', 'elektronika', 'steel', revolveY([[6, yR - 2.5], [7.6, yR - 2.5], [7.6, yR], [6, yR]]).translate([b.x, 0, b.z]), [0, -20, 0], { label: 'Matice tlačítka', src: 'nakup', spec: 'M12×1, součást tlačítka' });
    add('tlacitko_vyvody', 'elektronika', 'plasticBlack', cyl(4.6, 5, [b.x, yR - 15, b.z]), [0, 44, 0], { label: 'Vývody tlačítka', src: 'nakup', spec: 'součást tlačítka' });
    add('kabel_tlacitka', 'kabely', 'rubber', tube([[b.x, yR - 15, b.z], [14, 9.8, 23.3], [bx + 16, 10.5, 23.3], [bx + 19, 12.5, 22], [bx + 20, yBb - 2, 20.2]], 1), [0, -54, 0],
      { label: 'Kabel tlačítka', src: 'kabel', spec: '5 žil AWG28, JST GH 5p, ~140 mm' });
  }

  // ============================== BATERIE (segmenty B a C) ==============================
  packX.forEach((c, pi) => {
    const tag = 'BC'[pi], exP = [0, -48, 0];
    const cellSpec = { src: 'nakup', spec: 'Li-ion 21700, 5 000 mAh, 3,6 V (např. Samsung 50E / Molicel M50A), bodově svařený paket 1S2P' };
    for (const s of [-1, 1]) {
      const z = s * (cd / 2 + 0.15);
      add('clanek_21700', 'baterie', 'cell', cyl(cd / 2, cl - 1, [c - cl / 2 + 0.3, yCell, z], [1, 0, 0]), exP, { label: `Článek 21700 (paket ${tag})`, ...cellSpec });
      add('clanek_21700_dno', 'baterie', 'nickel', cyl(cd / 2 - 0.5, 0.3, [c - cl / 2, yCell, z], [1, 0, 0]), exP, { label: 'Záporný pól článku', ...cellSpec });
      add('clanek_21700_izolator', 'baterie', 'white', cyl(cd / 2 - 0.4, 0.4, [c + cl / 2 - 0.7, yCell, z], [1, 0, 0]), exP, { label: 'Izolační kroužek článku', ...cellSpec });
      add('clanek_21700_plus', 'baterie', 'nickel', cyl(4.2, 0.7, [c + cl / 2 - 0.3, yCell, z], [1, 0, 0]), exP, { label: 'Kladný pól článku', ...cellSpec });
    }
    for (const sgn of [-1, 1]) {
      add('pasek_niklovy', 'baterie', 'nickel', cbox(c + sgn * (cl / 2 + 0.55), yCell, 0, 0.15, 8, cd + 12), exP, { label: 'Niklový pásek', src: 'nakup', spec: 'Ni 0,15 × 8 mm, bodově svařený' });
      add('izolace_cela_paketu', 'baterie', 'fishpaper', cbox(c + sgn * (cl / 2 + 1.0), yCell, 0, 0.5, cd - 1, 2 * cd), exP, { label: 'Izolace čela paketu', src: 'nakup', spec: 'elektroizolační lepenka 0,5 mm' });
    }
    add('NTC_paketu', 'baterie', 'kapton', cbox(c, yCell - cd / 2 + 1.2, 0, 14, 0.4, 9), exP, { label: `Teplotní čidlo paketu ${tag}`, src: 'nakup', spec: 'NTC 10 kΩ pod kaptonovou páskou' });
    for (const dx of [-22, 22]) add('pena_stropu', 'baterie', 'foam', cbox(c + dx, yR - 0.4, 0, 12, 0.8, 40), [0, -12, 0], { label: 'Pěnová páska pod stropem', src: 'nakup', spec: 'oboustranná pěnová páska 1 mm (drží paket při otevřené základně)' });
    // vývody paketu kanálem podél boku k napájecí desce
    const sgn = pi === 0 ? -1 : 1;
    [['red', 24], ['rubber', 26.2]].forEach(([mat, zz], k) => {
      add(`vodic_paketu_${tag}`, 'kabely', mat, tube([
        [c + cl / 2 + 0.6, yCell + (k ? -3 : 3), sgn * 8], [c + packHalf + 5, 12.7, sgn * zz], [xPb - 14, 12.7, sgn * zz], [xPb - 7, 13, sgn * 20 + (k ? -1.5 : 1.5) * sgn]], 1.05), [0, -58, 0],
        { label: `Vodič paketu ${tag} (${k ? '−' : '+'})`, src: 'kabel', spec: 'AWG18 silikon, pojistka PTC u paketu, konektor JST VH 2p' });
    });
  });

  // ============================== ČELO B: napájecí deska, USB-C, odvzdušnění ==============================
  {
    const exE = [-16, -46, 0];
    const xo = xPb, xi = xPb - 1.6;       // vnější a vnitřní plocha desky
    let pcb = box(xi, yF + 1, -25, xo, yR - 1, 25);
    pcb = pcb.cut(group([cyl(1.4, 4, [xi - 1, 27, 21.5], [1, 0, 0]), cyl(1.4, 4, [xi - 1, 27, -21.5], [1, 0, 0])]));
    add('deska_napajeci', 'elektronika', 'pcb', pcb, exE, { label: 'Napájecí deska', src: 'pcb', spec: '50 × 22 mm, 4 vrstvy; USB-C, nabíječ, ochrana, měření, měnič 5 V' });
    const panX = screwPan(2.5, 4.5, 1.7, 6).rotate(-90, [0, 0, 0], [0, 0, 1]);
    for (const s of [-1, 1]) add('sroub_M2.5x6_napajeci_deska', 'spoj', 'steel', at(panX, xi, 27, s * 21.5), [-34, -46, 0], { label: 'Šroub M2,5×6 (napájecí deska)', src: 'nakup', spec: 'ISO 14583 Torx, A2' });
    // USB-C: zásuvka IP67 s přírubou, těsnění mezi přírubou a čelní stěnou
    add('USB-C_zasuvka', 'elektronika', 'nickel', tryFillet(cbox((xo + L - 0.2) / 2, 20, 0, L - 0.2 - xo, 3.26, 8.94), 1.5, (e) => e.inDirection('X'))
      .cut(tryFillet(cbox(L - 3, 20, 0, 7, 2.5, 8.2), 1.1, (e) => e.inDirection('X'))), exE, { label: 'Zásuvka USB-C IP67', src: 'pcb', spec: 'vodotěsná zásuvka s přírubou a těsněním (např. Amphenol MUSBR / CUI UJC-HP), nabíjení i servis' });
    add('USB-C_jazycek', 'elektronika', 'plasticBlack', cbox(L - 3.6, 20, 0, 5.6, 0.7, 6.7), exE, { label: 'Jazýček USB-C', src: 'pcb', spec: 'součást zásuvky' });
    add('USB-C_priruba', 'elektronika', 'steel', cbox(L - we - 1.6, 20, 0, 0.8, 8, 15).cut(cbox(L - we - 1.6, 20, 0, 2, 3.3, 9)), exE, { label: 'Příruba zásuvky', src: 'pcb', spec: 'součást zásuvky' });
    add('USB-C_tesneni', 'tesneni', 'silicone', cbox(L - we - 0.6, 20, 0, 1.2, 8, 15).cut(cbox(L - we - 0.6, 20, 0, 2, 3.5, 9.2)), [-8, -24, 0], { label: 'Těsnění USB-C', src: 'tesneni', spec: 'součást zásuvky (ploché těsnění k čelní stěně)' });
    add('USB-C_zatka', 'telo', 'rubber', tryFillet(cbox(L + 1.6, 20, 0, 3.2, 7.5, 13.5), 1.4, (e) => e.inDirection('X')).fuse(cbox(L - 1.4, 20, 0, 3, 2.3, 8)), [46, 0, 0], { label: 'Zátka USB-C', src: 'nakup', spec: 'silikonová zátka s poutkem' });
    add('USB-C_zatka_poutko', 'telo', 'rubber', box(L, 8, -2.5, L + 0.9, 16.4, 2.5).fuse(cyl(2.2, 1.6, [L + 0.5, 9.5, 0], [1, 0, 0])), [46, 0, 0], { label: 'Poutko zátky', src: 'nakup', spec: 'součást zátky' });
    // součástky na vnitřní straně desky
    const comp = (name, mat, y, z, sd, sy, sz2, label, spec) => add(name, 'elektronika', mat, cbox(xi - sd / 2, y, z, sd, sy, sz2), exE, { label, src: 'pcb', spec });
    comp('konektor_svazek_PB', 'jst', 27, 6, 4.25, 4.05, 15.75, 'Konektor hlavního svazku', 'JST GH 10p');
    comp('PD_radic', 'chip', 27, -8, 0.8, 3, 3, 'Řadič USB PD', 'sink 9–12 V (např. HUSB238)');
    comp('nabijec_BQ25895', 'chip', 20, -12, 0.8, 4, 4, 'Nabíječ Li-ion', 'BQ25895: až 5 A, I2C, lodní režim, tlačítko QON');
    comp('civka_nabijece', 'chip', 20, -19.5, 3, 5, 5, 'Cívka nabíječe', '2,2 µH, 6 A');
    comp('meric_baterie', 'chip', 20, -5, 0.8, 2, 2, 'Měřič stavu baterie', 'fuel gauge (např. MAX17048)');
    comp('menic_5V', 'chip', 20, 10, 0.9, 3, 3, 'Měnič 5 V pro lidary', 'boost 2 A (např. TPS61236P)');
    comp('civka_5V', 'chip', 20, 16.5, 3, 4, 4, 'Cívka měniče 5 V', '1 µH');
    comp('ochrana_baterie', 'chip', 13, -3, 0.9, 3, 3, 'Ochrana baterie', 'přepětí, podpětí, zkrat; druhá úroveň k nabíječi');
    comp('ochrana_MOSFET', 'chip', 13, -10, 1, 5, 6, 'MOSFETy ochrany', 'dvojitý N-MOSFET');
    for (const z of [3, 7, 11]) comp('kondenzator_PB', 'tantalum', 13, z, 2.5, 3.2, 2.5, 'Kondenzátor', 'keramický 1210');
    for (const s of [-1, 1]) comp(`konektor_paketu_${s < 0 ? 'B' : 'C'}`, 'jst', 13, s * 20, 8, 6, 7.5, `Konektor paketu ${s < 0 ? 'B' : 'C'}`, 'JST VH 2p, 10 A');
    // odvzdušňovací membrána nalepená zevnitř na čelo B
    add('odvzdusneni_membrana', 'tesneni', 'white', cyl(4, 0.3, [L - we - 0.3, 13, -14], [1, 0, 0]), [-10, -24, 0], { label: 'Odvzdušňovací membrána', src: 'nakup', spec: 'samolepicí ePTFE membrána ⌀8 mm (typ GORE), nad otvorem ⌀2 mm' });
  }

  // ============================== KABELÁŽ ==============================
  {
    const exK = [0, -56, 0];
    const yb = y0L - 2.7;                // pod zadní deskou třmenu
    const lidCable = (i, pts) => add(`kabel_lidar_${WIN_NAMES_V2[i]}`, 'kabely', 'rubber', tube(pts, 1), exK, { label: `Kabel lidaru ${WIN_NAMES_V2[i]}`, src: 'kabel', spec: '4 žíly AWG28 (5 V, GND, TX, RX), JST GH 4p na obou koncích' });
    const yc = yBb - 2;
    lidCable(0, [[xs[0], yb, 6], [xs[0] + 11, yb, 6], [bx - 52, 13, -5], [bx - 49.6, yc, -9.5]]);
    lidCable(1, [[xs[1], yb, 6], [xs[1] - 11, yb, 6], [bx + 60, 12, 3], [bx + 49.6, yc, 0]]);
    lidCable(2, [[xs[2], yb, 6], [xs[2] - 11, yb, 6], [xs[2] - 13, 10.5, 25.5], [bx + 58, 10.5, 25.5], [bx + 54, 14, 12], [bx + 49.6, yc, 8.5]]);
    lidCable(3, [[xs[3], yb, 6], [xs[3] - 11, yb, 6], [xs[3] - 13, 10.5, 27.7], [bx + 61, 10.5, 27.7], [bx + 56, 13, -4], [bx + 49.6, yc, -8.5]]);
    add('svazek_hlavni', 'kabely', 'rubber', tube([[xPb - 5.9, 27, 6], [xPb - 11, 27, 4], [xPb - 14, 12, -22], [xPb - 18, 10.5, -26.3], [bx + 12, 10.5, -26.3], [bx + 8, 13, -24], [bx + 4, yc, -20.2]], 1.7), exK,
      { label: 'Hlavní svazek (napájecí ↔ hlavní deska)', src: 'kabel', spec: '10 žil: 5 V ×2, VSYS, GND ×3, SDA, SCL, USB D+/D− (kroucený pár); JST GH 10p, ~420 mm' });
  }

  // ============================== NOHY ==============================
  for (const f of ft) {
    for (const s of buildFoot(P, f)) add(`noha_${f.name}_${s.name}`, 'noha', s.mat, s.shape.translate([f.x, 0, 0]), s.ex, s.meta);
  }
  return { parts: out, total };
}

// Noha v místních souřadnicích (počátek = spodek základny nad středem kloubu).
function buildFoot(P, f) {
  const out = [];
  const add = (name, mat, shape, level, meta) => out.push({ name, mat, shape, ex: [0, -150 - level * 22, 0], meta });
  const kv = v(P, 'noha', 'kloub_vyska'), kr = v(P, 'noha', 'kloub_prumer') / 2;
  const pr = v(P, 'noha', 'prisavka_prumer') / 2, ph = v(P, 'noha', 'prisavka_vyska');
  const stem = v(P, 'noha', 'cep_delka');        // střed koule -> vršek těla přísavky
  const body = v(P, 'noha', 'drzak_vyska') - stem - 4; // tělo přísavky s pumpou (změřeno na v1); 4 mm = adaptér pod přírubou čepu

  // saně: T-hlava do drážky, blok se sedlem koule a závitovým nákružkem
  let sled = box(-21.5, -2.5, -14.9, 21.5, -0.1, 14.9)
    .fuse(box(-21.5, -5.7, -10.8, 21.5, -2.5, 10.8))
    .fuse(filletY(box(-22, -(kv - 4), -21, 22, -5.7, 21), 4))
    .fuse(cyl(13.5, 7.2, [0, -(kv + 3.2), 0]));
  sled = sled.cut(makeSphere(kr + 0.15).translate([0, -kv, 0])).cut(cyl(kr + 0.2, 12, [0, -(kv + 12), 0]))
    .cut(cyl(1.5, 4.5, [10, -4.1, 6.5], [0, 0, 1]));
  add('sane', 'pa12Dark', sled, 0, { label: 'Saně nohy', src: 'tisk', spec: 'PA12; T-hlava do drážky základny, sedlo koule, závit M27×2 pro matici' });
  // kulový čep, převlečná matice (aretace kloubu)
  const yb = -kv;
  const ball = makeSphere(kr).translate([0, yb, 0])
    .fuse(revolveY([[0, yb - stem + 1], [7, yb - stem + 1], [7, yb - stem + 4], [4, yb - stem + 5], [4, yb - kr + 2], [0, yb - kr + 2]]));
  const ring = revolveY([[13.8, yb + 3.8], [18.5, yb + 3.8], [18.5, yb - kr], [6.5, yb - kr], [6.5, yb - kr * 0.72], [kr * 1.06, yb - kr * 0.36], [13.8, yb - kr * 0.36]]);
  const lower = [];
  const addL = (name, mat, shape, level, meta) => lower.push({ name, mat, shape, level, meta });
  add('matice_kloubu', 'pa12Dark', ring, 2.2, { label: 'Převlečná matice kloubu', src: 'tisk', spec: 'PA12, vroubkovaná; utažením rukou zajistí kouli (±15°)' });
  addL('kulovy_cep', 'steel', ball, 1.1, { label: 'Kulový čep', src: 'nakup', spec: `ocelová koule ⌀${2 * kr} mm se závitem M8 (kulový čep)` });
  // adaptér na tělo přísavky a přísavka z v1 (změřená)
  let y = yb - stem + 1;
  addL('adapter_prisavky', 'pa12Dark', cyl(25, 5, [0, y - 5, 0]).cut(cyl(3.9, 7, [0, y - 6, 0])), 3.3, { label: 'Adaptér přísavky', src: 'tisk', spec: 'PA12 s vložkou M8; 2 šrouby do příruby přísavky' });
  for (const sx of [-1, 1]) addL('sroub_M4_adapter', 'steel', cyl(3.5, 2.4, [sx * 18, y - 7.4, 0]), 3.3, { label: 'Šroub M4 (adaptér)', src: 'nakup', spec: 'podle příruby přísavky' });
  y -= 6;
  const vr = 35;
  addL('prisavka_telo', 'plasticBlack', revolveY([[0, y + 1], [vr * 0.55, y + 1], [vr * 0.62, y - body * 0.6], [vr * 0.8, y - body + 1], [0, y - body + 1]]), 4.4,
    { label: 'Tělo přísavky', src: 'nakup', spec: 'vakuová přísavka s pumpičkou ⌀117 mm (stejná jako ve v1)' });
  const pyc = y - body * 0.55;
  addL('pumpa', 'blue', revolveX([[0, 0], [0, 9], [26, 9], [28, 8], [28, 0]]).translate([vr * 0.5, pyc, 0]), 4.4, { label: 'Pumpička', src: 'nakup', spec: 'součást přísavky' });
  addL('pumpa_indikator', 'red', cyl(9.3, 2.5, [vr * 0.5 + 18, pyc, 0], [1, 0, 0]), 4.4, { label: 'Indikátor podtlaku', src: 'nakup', spec: 'červený pruh = dopumpovat' });
  addL('pumpa_pist', 'blue', revolveX([[0, 0], [0, 7], [9, 7], [12, 4], [12, 0]]).translate([vr * 0.5 + 28, pyc, 0]), 4.4, { label: 'Píst pumpičky', src: 'nakup', spec: 'součást přísavky' });
  y -= body - 1;
  const neck = vr * 0.75;
  addL('prisavka', 'rubber', revolveY([[0, y], [neck, y], [neck, y - 4], [pr * 0.86, y - ph + 5], [pr, y - ph + 1.5], [pr, y - ph], [0, y - ph]]), 5.6, { label: 'Přísavka', src: 'nakup', spec: 'pryžový zvon ⌀117 mm' });
  addL('prisavka_okraj', 'yellow', revolveY([[pr - 3, y - ph], [pr + 3, y - ph], [pr + 3, y - ph + 4.5], [pr - 1, y - ph + 4.5]]), 5.6, { label: 'Okraj přísavky', src: 'nakup', spec: 'součást přísavky' });
  for (const l of lower) add(l.name, l.mat, f.tilt ? l.shape.rotate(f.tilt, [0, yb, 0], [0, 0, 1]) : l.shape, l.level, l.meta);
  return out;
}
