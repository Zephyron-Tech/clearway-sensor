// B-rep model ClearWay v3 – experiment „střešní skener“. Nesouvisí s v1 ani v2, sdílí jen pomocné funkce.
//
// Souřadnice: X dopředu (směr jízdy), Y nahoru, Z doprava. Počátek = střed rámu na horní ploše
// střešních podélníků (tam stojí patky příčníků).
//
// Sestava (proč, viz docs/navrh-v3.md):
//  - NOSIČ: dva koupené příčníky střešního nosiče s patkami na podélníky vozu (u popelářského vozu
//    stejné příčníky na adaptérech na střeše kabiny).
//  - RÁM: dva podélné hliníkové profily 40×40 přes oba příčníky a vpředu příčný nosník 40×80.
//  - SKENERY: na koncích nosníku dva 2D skenery osou dopředu, takže rovina skenu je svislá a kolmá
//    na směr jízdy. 270° pokrývá od svislice nahoru přes bok až pod úroveň střechy.
//  - 3D LIDAR: uprostřed vpředu na sklopné konzoli, vidí rohy a křižovatku před vozem.
//  - SKŘÍŇ: tlakově litý hliník IP67, víko s žebry a stínítkem proti slunci, nahoře anténa GNSS + LTE.
//    Uvnitř nosná deska s Raspberry Pi CM5, GNSS s dead reckoningem, modem M.2, přepínač Ethernet,
//    vstup 12/24 V s ochranami a superkondenzátory pro řádné vypnutí.
//  - Všechny kabely na konektorech M12 / Deutsch, nic se nepájí na voze.
//
// Každý díl nese `ex` (posun v rozloženém pohledu), `label`, `spec` a `src`.
import { makeBox, makeCylinder, makeSphere, makeCompound, Sketcher } from 'replicad';
import { boardParts, partXZ } from './board-v3.js';
import { BOARD, LINKS } from './board-v3-data.js';

const v = (P, g, k) => P[g][k].v;

const COLORS = {
  anodBlack: '#2a2c30', powder: '#d7dadd', alu: '#d5d8dc', steel: '#b8bcc0', rubber: '#1a1b1d', lidar: '#1d1e21',
  lens: '#1f2f42', white: '#f2f1ec', pcb: '#1c4a2c', chip: '#202124', shield: '#c8c8c0', copper: '#c26e3a',
  plasticBlack: '#232427', silicone: '#cf4a32', brass: '#c9a35a', blue: '#1f5fd1', green: '#2f9e55', ledRing: '#33d17a',
  yellow: '#f3d227', jst: '#f0eee4', red: '#d23a2e', ferrite: '#3a3b3e', nickel: '#c3c6ca',
  ceramic: '#b98a5e', ledGreen: '#33d17a', led: '#ff4b3a',
};

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const box = (x0, y0, z0, x1, y1, z1) => makeBox([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)]);
const cbox = (cx, cy, cz, sx, sy, sz) => box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
const cyl = (r, h, at, dir = Y) => makeCylinder(r, h, at, dir);
function tryFillet(shape, r, filter) { try { return shape.fillet(r, filter); } catch { return shape; } }
const filletDir = (s, r, d) => tryFillet(s, r, (e) => e.inDirection(d));
const at = (proto, x, y, z) => proto.clone().translate([x, y, z]);
const group = (list) => (list.length === 1 ? list[0] : makeCompound(list));
function revolveY(pts) {
  const sk = new Sketcher('XY').movePointerTo(pts[0]);
  for (const p of pts.slice(1)) sk.lineTo(p);
  return sk.close().revolve([0, 1, 0]);
}
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
// šroub s válcovou hlavou: hlava nad rovinou y = 0, dřík dolů
const capScrew = (d, len) => revolveY([[0, 0.62 * d * 1.6], [0.8 * d, 0.62 * d * 1.6], [0.8 * d, 0], [d / 2, 0], [d / 2, -len], [0, -len]]);

/**
 * Hliníkový profil s drážkou 8 podél osy. a0..a1 v ose profilu, střed průřezu (c1, c2),
 * rozměry průřezu s1 × s2 (první příčná osa, druhá příčná osa).
 */
function extrusion(axis, a0, a1, c1, c2, s1, s2) {
  const len = a1 - a0;
  const mk = (p0, p1) => (axis === 'x' ? box(a0, p0[0], p0[1], a1, p1[0], p1[1])
    : axis === 'z' ? box(p0[1], p0[0], a0, p1[1], p1[0], a1) : null);
  let b = mk([c1 - s1 / 2, c2 - s2 / 2], [c1 + s1 / 2, c2 + s2 / 2]);
  b = filletDir(b, 1.5, axis === 'x' ? 'X' : 'Z');
  const cuts = [];
  const g = 8.2, d = 3.2;
  // drážky po 40 mm na každé stěně
  const n1 = Math.round(s1 / 40), n2 = Math.round(s2 / 40);
  for (let i = 0; i < n1; i++) {
    const c = c1 - s1 / 2 + 20 + i * 40;
    cuts.push(mk([c - g / 2, c2 + s2 / 2 - d], [c + g / 2, c2 + s2 / 2 + 1]), mk([c - g / 2, c2 - s2 / 2 - 1], [c + g / 2, c2 - s2 / 2 + d]));
  }
  for (let i = 0; i < n2; i++) {
    const c = c2 - s2 / 2 + 20 + i * 40;
    cuts.push(mk([c1 + s1 / 2 - d, c - g / 2], [c1 + s1 / 2 + 1, c + g / 2]), mk([c1 - s1 / 2 - 1, c - g / 2], [c1 - s1 / 2 + d, c + g / 2]));
  }
  // středové otvory profilu
  for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) {
    const p1 = c1 - s1 / 2 + 20 + i * 40, p2 = c2 - s2 / 2 + 20 + j * 40;
    cuts.push(axis === 'x' ? cyl(3.4, len + 2, [a0 - 1, p1, p2], X) : cyl(3.4, len + 2, [p2, p1, a0 - 1], Z));
  }
  return b.cut(group(cuts));
}

export function buildUnitCad(P, role) {
  const out = [];
  // v3 je jedna jednotka; role „slave“ = samostatná nosná deska (náhled vedle sestavy, STEP pro návrháře DPS)
  if (role !== 'master') {
    for (const bp of boardParts({ y0: 0, ex0: [0, 0, 0], lift: 1 })) out.push({ ...bp, color: COLORS[bp.mat] || '#888888' });
    return { parts: out, total: BOARD.length };
  }
  const add = (name, cat, mat, shape, ex = [0, 0, 0], meta = {}) => {
    if (shape) out.push({ name, cat, mat, color: COLORS[mat] || '#888888', shape, ex, ...meta });
  };

  const W = v(P, 'ram', 'sirka'), S = v(P, 'ram', 'rozestup_pricniku'), LB = v(P, 'ram', 'delka_pricniku');
  const hp = v(P, 'ram', 'vyska_patky'), pr = v(P, 'ram', 'profil'), rz = v(P, 'ram', 'rozchod_podelniku') / 2;
  const sw = v(P, 'skener', 'sirka'), sl = v(P, 'skener', 'delka'), tilt = v(P, 'skener', 'naklon');
  const ld = v(P, 'lidar3d', 'prumer'), lh = v(P, 'lidar3d', 'vyska'), lt = v(P, 'lidar3d', 'sklon');
  const BL = v(P, 'skrin', 'delka'), BW = v(P, 'skrin', 'sirka'), BH = v(P, 'skrin', 'vyska');
  const bt = v(P, 'skrin', 'stena'), fh = v(P, 'skrin', 'zebra');

  // ============================== NOSIČ ==============================
  const barH = 22, barD = 86;
  const yBar = hp, yRail = hp + barH;     // spodek a vršek příčníku
  const bar = filletDir(box(-barD / 2, yBar, -LB / 2, barD / 2, yRail, LB / 2), 9, 'Z');
  const foot = filletDir(box(-38, 3, -25, 38, yBar + 30, 25), 6, 'Y').cut(box(-44, yBar, -30, 44, yRail + 0.5, 30)).fuse(box(-38, yRail, -25, 38, yRail + 4, 25));
  const pad = box(-36, 0, -23, 36, 3, 23);
  const footSpec = { label: 'Patka příčníku', src: 'nakup', spec: 'součást střešního nosiče; na podélník vozu, u popelářského vozu adaptér na kabinu' };
  for (const sx of [-1, 1]) {
    const x = sx * S / 2;
    add(`pricnik_${sx > 0 ? 'predni' : 'zadni'}`, 'nosic', 'anodBlack', at(bar, x, 0, 0), [0, -170, 0],
      { label: 'Příčník střešního nosiče', src: 'nakup', spec: `hliníkový aerodynamický příčník ${LB} mm s drážkou, nosnost ≥ 75 kg (Thule WingBar / Yakima a pod.)` });
    for (const sz of [-1, 1]) {
      const z = sz * (LB / 2 - 45);
      add('patka_pricniku', 'nosic', 'plasticBlack', at(foot, x, 0, z), [0, -210, sz * 40], footSpec);
      add('patka_podlozka', 'nosic', 'rubber', at(pad, x, 0, z), [0, -240, sz * 40], { label: 'Pryžová podložka patky', src: 'nakup', spec: 'součást nosiče' });
    }
  }

  // ============================== RÁM ==============================
  const xBeam = S / 2 + 60;               // osa příčného nosníku (před předním příčníkem)
  const xR0 = -S / 2 - 70, xR1 = xBeam + pr / 2;
  for (const sz of [-1, 1]) {
    add(`podelnik_${sz > 0 ? 'pravy' : 'levy'}`, 'nosic', 'anodBlack', extrusion('x', xR0, xR1, yRail + pr / 2, sz * rz, pr, pr), [0, -40, sz * 30],
      { label: 'Podélný profil rámu 40×40', src: 'obrabeni', spec: `hliníkový profil 40×40 drážka 8, délka ${Math.round(xR1 - xR0)} mm, eloxovaný černě; konce zaslepit krytkou` });
  }
  const yBeam0 = yRail + pr, yBeam1 = yBeam0 + 2 * pr;
  const zBeam = W / 2 - 52;               // konce nosníku (skener je předsazený před čelem)
  add('nosnik_skeneru', 'nosic', 'anodBlack', extrusion('z', -zBeam, zBeam, (yBeam0 + yBeam1) / 2, xBeam, 2 * pr, pr), [60, 40, 0],
    { label: 'Příčný nosník skenerů 40×80', src: 'obrabeni', spec: `hliníkový profil 40×80 drážka 8, délka ${Math.round(2 * zBeam)} mm` });
  for (const sz of [-1, 1]) {
    add('krytka_nosniku', 'nosic', 'plasticBlack', box(xBeam - pr / 2, yBeam0, sz * zBeam, xBeam + pr / 2, yBeam1, sz * (zBeam + 3)), [60, 40, sz * 30],
      { label: 'Krytka profilu 40×80', src: 'nakup', spec: 'PA, černá' });
  }
  // úhelníky nosník ↔ podélníky
  const angle = box(0, 0, -18, 36, 4, 18).fuse(box(0, 0, -18, 4, 36, 18));
  const angleSpec = { label: 'Úhelník 40 s výztuhou', src: 'nakup', spec: 'tlakově litý hliník pro profil drážka 8, 2× šroub M8 + T-matice' };
  for (const sz of [-1, 1]) add('uhelnik_nosniku', 'spoj', 'alu', angle.clone().rotate(180, [0, 0, 0], [0, 1, 0]).translate([xBeam - pr / 2, yRail + pr, sz * rz]), [20, 20, sz * 60], angleSpec);
  // příchytky rámu k příčníkům: příložka pod příčníkem + 2 šrouby M8 do T-matic profilu
  const clampPlate = box(-barD / 2 - 14, -8, -22, barD / 2 + 14, 0, 22);
  const m8 = capScrew(8, yRail + pr / 2 - yBar + 10);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * S / 2, z = sz * rz;
    add('prichytka_pricniku', 'spoj', 'steel', at(clampPlate, x, yBar, z), [0, -110, 0],
      { label: 'Příložka pod příčník', src: 'obrabeni', spec: 'nerez 8 mm, 2 otvory ⌀9, pryžová vložka 1 mm k příčníku' });
    for (const dx of [-1, 1]) {
      add('sroub_M8_pricnik', 'spoj', 'steel', m8.clone().rotate(180, [0, 0, 0], [1, 0, 0]).translate([x + dx * (barD / 2 + 7), yBar - 8, z]), [0, -150, 0],
        { label: 'Šroub M8 + T-matice', src: 'nakup', spec: 'ISO 4762 M8×60 A2, T-matice drážka 8, podložka' });
    }
  }

  // ============================== BOČNÍ SKENERY ==============================
  // Skener leží osou dopředu: zadní plocha na držáku, okno vpředu. Rovina skenu = svislá rovina YZ v ose okna.
  const ySc = (yBeam0 + yBeam1) / 2;      // osa skeneru
  const xPl = xBeam + pr / 2;             // čelo nosníku
  const xSc = xPl + 6;                    // zadní plocha skeneru
  const winA = sl - 34, winB = sl - 8;    // okno od–do v ose skeneru
  const scanner = (side) => {
    const zc = side * W / 2;
    const body = filletDir(box(0, -sw / 2, -sw / 2, winA, sw / 2, sw / 2), 7, 'X');
    const fins = group([0, 1, 2].map(i => box(8 + i * 9, -sw / 2 - 1, -sw / 2 + 6, 12 + i * 9, sw / 2 + 1, sw / 2 - 6)));
    // 90° slepý sektor na vnitřní straně (k vozu) je pod krytem
    const blind = box(winA, -sw / 2 + 8, -side * (sw / 2), winB, sw / 2 - 8, -side * (sw / 2 - 12));
    const win = cyl(sw / 2 - 3, winB - winA, [winA, 0, 0], X).cut(blind.clone());
    const cap = filletDir(cyl(sw / 2 - 1, sl - winB, [winB, 0, 0], X), 2, 'X');
    const T = (s) => s.rotate(tilt, [0, 0, 0], [0, 0, 1]).translate([xSc, ySc, zc]);
    const n = side > 0 ? 'P' : 'L';
    const ex = (k) => [200 + 30 * k, 60, side * (180 + 20 * k)];
    const meta = { src: 'nakup', spec: 'součást skeneru' };
    add(`skener_${n}`, 'senzory', 'lidar', T(body.fuse(fins)), ex(0),
      { label: `Boční skener ${n === 'P' ? 'pravý' : 'levý'}`, src: 'nakup', spec: '2D lidar 270°, rovina skenu kolmo na jízdu; třída SICK TiM781 / Hokuyo UST-20LX: Ethernet, 9–28 V, IP67, ~4 W' });
    add(`skener_${n}_okno`, 'senzory', 'lens', T(win), ex(0), { label: `Okno skeneru ${n}`, ...meta });
    add(`skener_${n}_slepy_sektor`, 'senzory', 'plasticBlack', T(blind), ex(0), { label: `Kryt slepého sektoru ${n}`, ...meta });
    add(`skener_${n}_vicko`, 'senzory', 'lidar', T(cap), ex(0), { label: `Víčko skeneru ${n}`, ...meta });
    add(`skener_${n}_led`, 'senzory', 'ledRing', T(cbox(winA - 10, 0, side * (sw / 2 + 0.3), 6, 3, 0.8)), ex(0), { label: `Stavová LED skeneru ${n}`, ...meta });
    // konektory M12 zespodu
    for (const [i, k] of [[0, 'napájení'], [1, 'Ethernet']]) {
      add(`skener_${n}_m12_${i}`, 'konektory', 'nickel', T(cyl(7, 15, [14 + i * 22, -sw / 2 - 16, 0])), ex(0),
        { label: `Konektor M12 skeneru (${k})`, src: 'nakup', spec: i ? 'M12 D-kód 4 piny, Ethernet 100 Mb/s' : 'M12 A-kód 5 pinů, napájení' });
    }
    // držák: deska na čele nosníku, přesahuje přes konec, drážkované otvory pro sklon ±5°
    const zIn = side * (zBeam - 40), zOut = side * (W / 2 + sw / 2 + 2);
    let plate = box(xPl, yBeam0 - 2, zIn, xPl + 6, yBeam1 + 2, zOut);
    plate = filletDir(plate, 4, 'X');
    for (const dy of [-pr / 2, pr / 2]) plate = plate.cut(cbox(xPl + 3, ySc + dy, side * (zBeam - 20), 8, 7, 14));
    add(`drzak_skeneru_${n}`, 'nosic', 'alu', plate, [140, 60, side * 120],
      { label: 'Držák skeneru', src: 'obrabeni', spec: 'hliník 6 mm (laser/CNC), drážky pro sklon ±5°, 2× M8 do nosníku + 4× M4 do skeneru' });
    for (const dy of [-pr / 2, pr / 2]) {
      add('sroub_M8_drzak', 'spoj', 'steel', capScrew(8, 16).rotate(-90, [0, 0, 0], [0, 0, 1]).translate([xPl + 6, ySc + dy, side * (zBeam - 20)]), [180, 60, side * 120],
        { label: 'Šroub M8 + T-matice', src: 'nakup', spec: 'ISO 4762 M8×16 A2, T-matice drážka 8' });
    }
    // ostřikovač okna: tryska na držáku, hadička vede s kabely
    add(`tryska_${n}`, 'senzory', 'plasticBlack',
      cyl(4, 10, [xPl + 6, yBeam1 + 2, zc - side * 18], X).fuse(cyl(2, 30, [xPl + 16, yBeam1 + 2, zc - side * 18], [0.96, -0.27, 0])),
      [230, 120, side * 160], { label: 'Tryska ostřikovače okna', src: 'nakup', spec: 'volitelné: tryska + čerpadlo ostřikovače vozu, 1 s po startu a každých 10 min' });
  };
  scanner(1);
  scanner(-1);

  // ============================== PŘEDNÍ 3D LIDAR ==============================
  // sklopná konzole: svislá deska na čele nosníku, čep, plošina se sklonem dopředu dolů
  const pivot = [xPl + 12, yBeam1 + 30, 0];
  add('konzole_lidaru', 'nosic', 'alu',
    box(xPl, yBeam0 + 10, -35, xPl + 6, pivot[1] + 8, 35).fuse(box(xPl, pivot[1] - 6, -35, xPl + 20, pivot[1] + 8, -29)).fuse(box(xPl, pivot[1] - 6, 29, xPl + 20, pivot[1] + 8, 35))
      .cut(cyl(4.1, 80, [pivot[0], pivot[1], -40], Z)),
    [180, 160, 0], { label: 'Konzole 3D lidaru', src: 'obrabeni', spec: 'hliník 6 mm, čep ⌀8, aretace sklonu 0–30° po 5°' });
  const asm = [];
  asm.push(['plosina_lidaru', 'nosic', 'alu', box(12, -4, -28, 12 + ld + 22, 2, 28).fuse(box(-5.5, -6, -27, 12, 2, 27)).cut(cyl(4.1, 60, [0, 0, -30], Z)), { label: 'Plošina 3D lidaru', src: 'obrabeni', spec: 'hliník 6 mm, 3× M3 do lidaru' }]);
  asm.push(['cep_konzole', 'spoj', 'steel', cyl(4, 72, [0, 0, -36], Z), { label: 'Čep konzole ⌀8', src: 'nakup', spec: 'nerez, s pojistnou podložkou' }]);
  const lx = 12 + (ld + 22) / 2, lr = ld / 2;
  asm.push(['lidar3d', 'senzory', 'lidar', cyl(lr, 20, [lx, 2, 0]).fuse(box(lx - 9, 2, lr - 4, lx + 9, 16, lr + 5)),
    { label: 'Přední 3D lidar', src: 'nakup', spec: '3D lidar 360° × 59°, Ethernet, 9–27 V, IP67, ~6,5 W, 265 g; třída Livox Mid-360' }]);
  asm.push(['lidar3d_okno', 'senzory', 'lens', cyl(lr - 1, lh - 30, [lx, 22, 0]), { label: 'Okno 3D lidaru', src: 'nakup', spec: 'součást lidaru' }]);
  asm.push(['lidar3d_viko', 'senzory', 'lidar', filletDir(cyl(lr, 8, [lx, lh - 8 + 2, 0]), 3, 'Y'), { label: 'Víčko 3D lidaru', src: 'nakup', spec: 'součást lidaru' }]);
  asm.push(['lidar3d_m12', 'konektory', 'nickel', cyl(6, 14, [lx, 9, lr + 5], Z), { label: 'Konektor 3D lidaru (M12)', src: 'nakup', spec: 'kabel lidaru zakončený M12 A-kód 8 pinů (napájení + Ethernet)' }]);
  for (const [name, cat, mat, shape, meta] of asm) {
    add(name, cat, mat, shape.rotate(-lt, [0, 0, 0], [0, 0, 1]).translate(pivot), [230, 230, 0], meta);
  }

  // ============================== SKŘÍŇ ELEKTRONIKY ==============================
  const yB0 = yRail + pr;                 // spodek skříně na podélnících
  const yLid = yB0 + BH - 16;             // dělicí rovina vana / víko
  const yTop = yB0 + BH;                  // vršek víka (bez žeber)
  const r = 9;
  let base = filletDir(box(-BL / 2, yB0, -BW / 2, BL / 2, yLid, BW / 2), r, 'Y');
  base = base.cut(filletDir(box(-BL / 2 + bt, yB0 + 4, -BW / 2 + bt, BL / 2 - bt, yLid + 1, BW / 2 - bt), r - bt, 'Y'));
  // průchodky ve stěnách: vpředu 3× M12, vzadu Deutsch, membrána, vývodka antény, USB-C
  const yConn = yB0 + 24;
  const frontZ = [-50, 0, 50];
  const holes = [
    ...frontZ.map(z => cyl(8.2, bt + 2, [BL / 2 - bt - 1, yConn, z], X)),
    cbox(-BL / 2 + bt / 2, yConn, -40, bt + 2, 20, 24),
    cyl(6.2, bt + 2, [-BL / 2 - 1, yConn, 10], X),
    cyl(6.5, bt + 2, [-BL / 2 - 1, yConn, 48], X),
    cbox(-BL / 2 + bt / 2, yConn, -74, bt + 2, 5, 11),
  ];
  // šroubové sloupky víka v rozích
  const lidScrews = [[-BL / 2 + 14, -BW / 2 + 14], [BL / 2 - 14, -BW / 2 + 14], [-BL / 2 + 14, BW / 2 - 14], [BL / 2 - 14, BW / 2 - 14], [0, -BW / 2 + 9], [0, BW / 2 - 9]];
  base = base.fuse(group(lidScrews.map(([x, z]) => cyl(6, BH - 18, [x, yB0 + 2, z])))).cut(group([...holes, ...lidScrews.map(([x, z]) => cyl(1.7, 12, [x, yLid - 11.9, z]))]));
  // dno: 4 sloupky nosné desky
  const pcbPost = [[-BL / 2 + 22, -BW / 2 + 22], [BL / 2 - 22, -BW / 2 + 22], [-BL / 2 + 22, BW / 2 - 22], [BL / 2 - 22, BW / 2 - 22]];
  base = base.fuse(group(pcbPost.map(([x, z]) => cyl(4, 8, [x, yB0 + 3.9, z]))));
  add('skrin_vana', 'skrin', 'powder', base, [0, 30, 0],
    { label: 'Skříň: vana', src: 'nakup', spec: `tlakově litý hliník IP67 ${BL}×${BW}×${BH} mm (Hammond 1590 / Bopla Euromas), práškově světle šedá, otvory frézovat` });
  let lid = filletDir(box(-BL / 2, yLid, -BW / 2, BL / 2, yTop, BW / 2), r, 'Y');
  lid = tryFillet(lid, 3, (e) => e.inPlane('XZ', yTop));
  lid = lid.cut(filletDir(box(-BL / 2 + bt, yLid - 1, -BW / 2 + bt, BL / 2 - bt, yTop - 5, BW / 2 - bt), r - bt, 'Y'));
  const finN = 11, finP = 12, finT = 3;
  const finZ = Array.from({ length: finN }, (_, i) => (i - (finN - 1) / 2) * finP);
  lid = lid.fuse(group(finZ.map(z => box(-BL / 2 + 22, yTop - 0.5, z - finT / 2, BL / 2 - 22, yTop + fh, z + finT / 2))));
  lid = lid.cut(group(lidScrews.map(([x, z]) => cyl(2.2, 20, [x, yLid - 1, z]))));
  add('skrin_viko', 'skrin', 'powder', lid, [0, 300, 0], { label: 'Skříň: víko s chladicími žebry', src: 'nakup', spec: 'součást skříně; žebra podél jízdy, ofukuje je vzduch' });
  add('skrin_tesneni', 'tesneni', 'silicone',
    filletDir(box(-BL / 2 + bt + 0.3, yLid - 0.6, -BW / 2 + bt + 0.3, BL / 2 - bt - 0.3, yLid + 0.6, BW / 2 - bt - 0.3), r - bt, 'Y')
      .cut(filletDir(box(-BL / 2 + bt + 2.3, yLid - 1, -BW / 2 + bt + 2.3, BL / 2 - bt - 2.3, yLid + 1, BW / 2 - bt - 2.3), r - bt - 2, 'Y')),
    [0, 170, 0], { label: 'Těsnění víka', src: 'tesneni', spec: 'silikonový profil, součást skříně' });
  const m4 = capScrew(4, 14);
  for (const [x, z] of lidScrews) add('sroub_M4_viko', 'spoj', 'steel', at(m4, x, yTop, z), [0, 380, 0], { label: 'Šroub víka M4×14', src: 'nakup', spec: 'nerez, součást skříně' });
  // upevnění skříně do T-drážek podélníků (zevnitř dna)
  const m6 = capScrew(6, 14);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('sroub_M6_skrin', 'spoj', 'steel', at(m6, sx * (BL / 2 - 45), yB0 + 4, sz * rz), [0, 120, 0], { label: 'Šroub M6 + T-matice (skříň k rámu)', src: 'nakup', spec: 'ISO 4762 M6×14 A2, T-matice drážka 8' });

  // stínítko proti slunci (vzduchová mezera nad žebry)
  const yShield = yTop + fh + 14;
  const standoffs = [[-BL / 2 + 40, -BW / 2 + 12], [BL / 2 - 40, -BW / 2 + 12], [-BL / 2 + 40, BW / 2 - 12], [BL / 2 - 40, BW / 2 - 12]];
  for (const [x, z] of standoffs) add('distancni_sloupek', 'skrin', 'steel', cyl(4, yShield - yTop, [x, yTop, z]), [0, 360, 0], { label: 'Distanční sloupek M4×23', src: 'nakup', spec: 'nerez, šestihran' });
  add('stinitko', 'skrin', 'white', filletDir(box(-BL / 2 - 25, yShield, -BW / 2 - 18, BL / 2 + 25, yShield + 1.5, BW / 2 + 18), 12, 'Y'), [0, 440, 0],
    { label: 'Stínítko proti slunci', src: 'obrabeni', spec: 'hliník 1,5 mm, bílý lak; sníží ohřev skříně na přímém slunci o ~10–15 °C' });
  // kombinovaná anténa GNSS + LTE na stínítku
  const xAnt = -BL / 2 + 75;
  add('antena_gnss_lte', 'konektory', 'white',
    revolveY([[0, 0], [44, 0], [44, 3], [40, 12], [30, 20], [14, 24], [0, 25]]).translate([xAnt, yShield + 1.5, 0]),
    [0, 520, 0], { label: 'Anténa GNSS (L1/L5) + LTE', src: 'nakup', spec: 'kombinovaná anténa na šroub, GNSS multiband + LTE 2×2 MIMO, IP67, 3 m koax SMA' });
  add('antena_tesneni', 'tesneni', 'rubber', cyl(40, 1.5, [xAnt, yShield + 1.5 - 0.01, 0]).cut(cyl(8, 3, [xAnt, yShield, 0])), [0, 500, 0], { label: 'Těsnění antény', src: 'nakup', spec: 'součást antény' });
  // koax antény: přes zadní hranu stínítka do vývodky
  add('kabel_antena', 'kabely', 'plasticBlack',
    tube([[xAnt - 30, yShield + 4, 30], [-BL / 2 - 30, yShield + 4, 40], [-BL / 2 - 34, yShield - 10, 44], [-BL / 2 - 30, yConn + 6, 48], [-BL / 2 - 18, yConn, 48]], 2.6),
    [0, 300, 0], { label: 'Koaxiální kabely antény', src: 'kabel', spec: '2× RG174 (GNSS, LTE hlavní) + 1× LTE div, SMA; součást antény' });

  // ============================== PRŮCHODKY A KONEKTORY ==============================
  const xF = BL / 2, xRr = -BL / 2;
  frontZ.forEach((z, i) => {
    const what = ['levý skener', '3D lidar', 'pravý skener'][i];
    add('m12_zasuvka', 'konektory', 'nickel', cyl(8, 12, [xF, yConn, z], X).fuse(cbox(xF + 1, yConn, z, 2, 20, 20)), [90, 40, 0],
      { label: 'Panelová zásuvka M12', src: 'nakup', spec: 'M12 do stěny, IP67; každá nese napájení i Ethernet (hybridní M12 Y-kód) – ' + what });
    add('m12_konektor_kabelu', 'kabely', 'nickel', cyl(9, 14, [xF + 12, yConn, z], X), [120, 40, 0],
      { label: 'Kabelový konektor M12', src: 'kabel', spec: 'přímý, s převlečnou maticí, IP67' });
  });
  add('deutsch_zasuvka', 'konektory', 'plasticBlack',
    cbox(xRr - 9, yConn, -40, 18, 20, 24).fuse(cbox(xRr - 1, yConn, -40, 2, 26, 30)), [-90, 40, 0],
    { label: 'Napájecí zásuvka Deutsch DT04-6P', src: 'nakup', spec: 'automobilová, IP68: 1 = +12/24 V (KL30), 2 = kostra (KL31), 3 = zapalování (KL15), 4 = CAN-H, 5 = CAN-L, 6 = rezerva' });
  add('deutsch_vidlice', 'kabely', 'plasticBlack', cbox(xRr - 27, yConn, -40, 18, 22, 26).fuse(cbox(xRr - 40, yConn, -40, 8, 14, 14)), [-130, 40, 0],
    { label: 'Napájecí vidlice Deutsch DT06-6S', src: 'kabel', spec: 's pryžovými ucpávkami vodičů a zámkem W6S' });
  add('membrana', 'konektory', 'plasticBlack', cyl(6, 4, [xRr, yConn, 10], [-1, 0, 0]).fuse(cyl(8, 3, [xRr - 4, yConn, 10], [-1, 0, 0])), [-90, 40, 0],
    { label: 'Odvzdušňovací ventil', src: 'nakup', spec: 'ePTFE membrána M12×1,5 (Gore PolyVent), proti kondenzaci při změnách teploty' });
  add('vyvodka_antena', 'konektory', 'plasticBlack', cyl(6.5, 4, [xRr, yConn, 48], [-1, 0, 0]).fuse(cyl(7.5, 9, [xRr - 4, yConn, 48], [-1, 0, 0])), [-90, 40, 0],
    { label: 'Kabelová vývodka M16 (anténa)', src: 'nakup', spec: 'PA, IP68, vložka pro 3 koaxy' });
  add('usb_c_servis', 'konektory', 'plasticBlack', cbox(xRr - 3, yConn, -74, 6, 9, 15).fuse(cyl(4, 6, [xRr - 6, yConn, -74], [-1, 0, 0])), [-90, 40, 0],
    { label: 'Servisní USB-C se šroubovací krytkou', src: 'nakup', spec: 'IP67 panelový USB-C; jen pro servis, běžně se data posílají přes LTE' });

  // ============================== ELEKTRONIKA ==============================
  // Nosná deska CB3: celá z tabulky board-v3-data.js (stejná jako samostatný náhled desky)
  const yP = yB0 + 12, pt = BOARD.thickness;  // spodní plocha DPS na sloupcích dna
  const yPt = yP + pt;
  const E = (k) => [0, 110 + 18 * k, 0];
  for (const bp of boardParts({ y0: yP, ex0: E(0), lift: 1.2 })) out.push({ ...bp, color: COLORS[bp.mat] || '#888888' });
  const m3 = capScrew(3, 6);
  for (const h of BOARD.holes) add('sroub_M3_deska', 'spoj', 'steel', at(m3, h.x, yPt, h.z), E(3), { label: 'Šroub M3×6 (deska)', src: 'nakup', spec: 'ISO 7380 A2, s podložkou' });
  // tepelný most z procesoru CM5 do víka
  const cm = partXZ(LINKS.cm5);
  const ySoc = yPt + cm.z0 + 1 + 1.4;     // vršek procesoru
  const yLidIn = yTop - 5;
  const sx = cm.x + LINKS.soc.dx, sz = cm.z + LINKS.soc.dz;
  add('tepelny_most', 'elektronika', 'copper', cbox(sx, (ySoc + 1 + yLidIn - 1) / 2, sz, 20, yLidIn - 1 - (ySoc + 1), 20), E(5),
    { label: 'Tepelný most CM5 → víko', src: 'obrabeni', spec: 'měď 20×20 mm, teplovodivé podložky 1 mm na obou koncích; teplo jde do žeber víka' });
  add('tepelna_podlozka', 'elektronika', 'blue', group([cbox(sx, ySoc + 0.5, sz, 18, 1, 18), cbox(sx, yLidIn - 0.5, sz, 18, 1, 18)]), E(4),
    { label: 'Teplovodivá podložka 1 mm', src: 'nakup', spec: '≥ 6 W/m·K, 20×20 mm' });
  // propojky od stěn skříně ke konektorům desky
  LINKS.ports.forEach((ref, i) => {
    const j = partXZ(ref), z = frontZ[i];
    add('vodice_m12', 'kabely', 'plasticBlack', tube([[xF - bt - 12, yConn, z], [xF - bt - 14, yConn - 4, z], [j.x + j.w / 2 + 2, yPt + 3, j.z]], 2.2), E(2),
      { label: 'Propojka M12 → deska', src: 'kabel', spec: 'součást panelové zásuvky, zakončení JST GH 8p' });
  });
  {
    const j = partXZ(LINKS.power);
    add('kabel_napajeni_vnitrni', 'kabely', 'red', tube([[xRr + bt + 2, yConn, -40], [xRr + 10, yConn - 4, -40], [j.x, yPt + j.h + 2, j.z]], 1.8), E(2),
      { label: 'Propojka napájení → deska', src: 'kabel', spec: '6× 0,75 mm² z vidlice Deutsch, zakončení Micro-Fit 3.0' });
    const u = partXZ(LINKS.usb);
    add('kabel_usb_vnitrni', 'kabely', 'plasticBlack', tube([[xRr + bt + 2, yConn, -74], [xRr + 10, yConn - 6, -70], [u.x - u.w / 2 - 1, yPt + 2, u.z]], 1.4), E(2),
      { label: 'Propojka servisního USB-C → deska', src: 'kabel', spec: 'součást panelového USB-C, zakončení JST GH 4p' });
    const g = partXZ(LINKS.gnss);
    add('koax_gnss_vnitrni', 'kabely', 'plasticBlack', tube([[xRr + bt + 2, yConn, 48], [xRr + 12, yConn - 6, 52], [g.x, yPt + 3, g.z]], 1.0), E(2),
      { label: 'Koax GNSS (vývodka → U.FL)', src: 'kabel', spec: 'součást antény, zakončení U.FL' });
  }

  // ============================== KABELY VEN ==============================
  const xPlug = xF + 26;
  const yUnder = yRail + 18;              // pod nosníkem, nad příčníkem
  for (const side of [-1, 1]) {
    const z = side * 50, zc = side * W / 2;
    add(`kabel_skener_${side > 0 ? 'P' : 'L'}`, 'kabely', 'plasticBlack',
      tube([[xPlug, yConn, z], [xPlug + 60, yConn, z], [xBeam - pr / 2 - 8, yUnder + 20, side * 120], [xBeam - pr / 2 - 8, yUnder, side * (zBeam - 60)],
        [xSc + 25, yUnder, zc - side * 6], [xSc + 25, ySc - sw / 2 - 15, zc]], 3.2),
      [120, 40, side * 80], { label: 'Kabel skeneru M12 (hybrid)', src: 'kabel', spec: 'PUR, odolný UV a oleji, ~1 m, M12 Y-kód → 2× M12 (A + D) u skeneru; vést v drážce profilu' });
  }
  add('kabel_lidar3d', 'kabely', 'plasticBlack',
    tube([[xPlug, yConn, 0], [xPlug + 80, yConn + 10, 0], [xBeam - pr / 2 - 10, yBeam1 + 10, 0], [xBeam, pivot[1] + 14, 30], [pivot[0] + 30, pivot[1] + 26, 60], [pivot[0] + 52, pivot[1] + 22, 50]], 3.2),
    [150, 120, 0], { label: 'Kabel 3D lidaru', src: 'kabel', spec: 'kabel lidaru M12 A-kód 8p ↔ hybridní M12' });
  add('kabel_napajeni', 'kabely', 'plasticBlack',
    tube([[xRr - 44, yConn, -40], [xRr - 110, yConn, -40], [-S / 2 + 40, yRail + 6, -rz - 40], [-S / 2 - 55, yRail + 6, -LB / 2 + 40], [-S / 2 - 55, 20, -LB / 2 - 20], [-S / 2 - 55, 0, -LB / 2 - 40]], 3.6),
    [-150, 30, -60], { label: 'Napájecí kabel do vozu', src: 'kabel', spec: '4× 1 mm², do vozu plochým průchodem pod těsněním dveří, v kabině pojistka 5 A na KL30 a KL15' });

  return { parts: out, total: W };
}
