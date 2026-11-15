// Generátor kostry projektu KiCad pro nosnou desku CB3: hierarchické schéma po blocích + podklad pro DPS.
// node scripts/kicad/gen-sch.mjs [cesta ke knihovnám symbolů] [cesta ke knihovnám pouzder]
// Výstup: hardware/cb3/ (cb3.kicad_pro, cb3.kicad_sch + 5 listů, cb3.kicad_sym, sym-lib-table, placement.json).
// Deska (cb3.kicad_pcb) se pak dělá skriptem gen-pcb.py v Pythonu KiCadu.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parse, write, str, unq, find, findAll } from '../sexpr.mjs';
import { BOARD, PARTS } from '../../src/cad/board-v3-data.js';
import { MAP, SHEETS, NOTES } from './cb3-map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');                 // kořen repozitáře
const out = join(root, 'hardware', 'cb3');
mkdirSync(out, { recursive: true });
const KI = '/Applications/KiCad/KiCad.app/Contents/SharedSupport';
const SYM_DIR = process.argv[2] || join(KI, 'symbols');
const FP_DIR = process.argv[3] || join(KI, 'footprints');
const PROJECT = 'cb3';

// ---------------- knihovny ----------------
const symCache = new Map();
function symLib(lib) {
  if (!symCache.has(lib)) {
    const f = join(SYM_DIR, `${lib}.kicad_sym`);
    symCache.set(lib, existsSync(f) ? parse(readFileSync(f, 'utf8')) : null);
  }
  return symCache.get(lib);
}
// symbol včetně rozbalení `extends` (do schématu se ukládá plný symbol)
function resolveSymbol(lib, re) {
  const L = symLib(lib);
  if (!L) return null;
  const all = findAll(L, 'symbol');
  const hit = all.find(s => re.test(unq(s[1])));
  if (!hit) return null;
  const name = unq(hit[1]);
  const ext = find(hit, 'extends');
  let node;
  if (ext) {
    const parent = all.find(s => unq(s[1]) === unq(ext[1]));
    if (!parent) return null;
    const pname = unq(parent[1]);
    node = JSON.parse(JSON.stringify(parent));
    // vlastnosti potomka přepíší rodiče
    for (const prop of findAll(hit, 'property')) {
      const i = node.findIndex(n => Array.isArray(n) && n[0] === 'property' && n[1] === prop[1]);
      if (i >= 0) node[i] = prop; else node.push(prop);
    }
    for (const sub of findAll(node, 'symbol')) sub[1] = str(unq(sub[1]).replace(pname, name));
  } else node = JSON.parse(JSON.stringify(hit));
  node[1] = str(`${lib}:${name}`);
  return { id: `${lib}:${name}`, name, node };
}
const fpIndex = new Map();
function resolveFootprint(lib, re) {
  if (!fpIndex.has(lib)) {
    const d = join(FP_DIR, `${lib}.pretty`);
    fpIndex.set(lib, existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.kicad_mod')).map(f => f.slice(0, -10)) : []);
  }
  const name = fpIndex.get(lib).find(n => re.test(n));
  return name ? `${lib}:${name}` : null;
}

// piny symbolu: { name, number, x, y, angle, unit }
function pinsOf(sym) {
  const pins = [];
  for (const sub of findAll(sym.node, 'symbol')) {
    const m = /_(\d+)_(\d+)$/.exec(unq(sub[1]));
    const unit = m ? +m[1] : 0;
    for (const p of findAll(sub, 'pin')) {
      const a = find(p, 'at');
      pins.push({ name: unq(find(p, 'name')[1]), number: unq(find(p, 'number')[1]), x: +a[1], y: +a[2], angle: +(a[3] || 0), unit });
    }
  }
  return pins;
}
function bboxOf(sym) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const addP = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const sub of findAll(sym.node, 'symbol')) {
    for (const r of findAll(sub, 'rectangle')) { const s = find(r, 'start'), e = find(r, 'end'); addP(+s[1], +s[2]); addP(+e[1], +e[2]); }
    for (const p of findAll(sub, 'pin')) { const a = find(p, 'at'); addP(+a[1], +a[2]); }
    for (const pl of findAll(sub, 'polyline')) for (const xy of findAll(find(pl, 'pts') || [], 'xy')) addP(+xy[1], +xy[2]);
  }
  if (!Number.isFinite(x0)) return { x0: -5, y0: -5, x1: 5, y1: 5 };
  return { x0, y0, x1, y1 };
}
const unitsOf = (sym) => Math.max(1, ...findAll(sym.node, 'symbol').map(s => +(/_(\d+)_\d+$/.exec(unq(s[1]))?.[1] || 0)));

// ---------------- zástupné symboly (CM5, modem a cokoli, co v knihovnách není) ----------------
const projectSyms = [];
function placeholder(p) {
  const name = `${p.ref}_${p.mpn.split(' ')[0].replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 40);
  const w = 40.64, h = 15.24;
  const node = ['symbol', str(`CB3:${name}`), ['exclude_from_sim', 'no'], ['in_bom', 'yes'], ['on_board', 'yes'],
    ['property', '"Reference"', str(p.ref.replace(/\d+$/, '')), ['at', '0', String(h / 2 + 2.54), '0'], ['effects', ['font', ['size', '1.27', '1.27']]]],
    ['property', '"Value"', str(name), ['at', '0', String(-h / 2 - 2.54), '0'], ['effects', ['font', ['size', '1.27', '1.27']]]],
    ['property', '"Footprint"', '""', ['at', '0', '0', '0'], ['effects', ['font', ['size', '1.27', '1.27']], ['hide', 'yes']]],
    ['property', '"Datasheet"', '""', ['at', '0', '0', '0'], ['effects', ['font', ['size', '1.27', '1.27']], ['hide', 'yes']]],
    ['property', '"Description"', str(`ZÁSTUPCE – doplnit symbol výrobce: ${p.mpn}`), ['at', '0', '0', '0'], ['effects', ['font', ['size', '1.27', '1.27']], ['hide', 'yes']]],
    ['symbol', str(`${name}_0_1`), ['rectangle', ['start', String(-w / 2), String(h / 2)], ['end', String(w / 2), String(-h / 2)], ['stroke', ['width', '0.254'], ['type', 'dash']], ['fill', ['type', 'background']]],
      ['text', str('doplnit symbol'), ['at', '0', '0', '0'], ['effects', ['font', ['size', '1.27', '1.27']]]]],
  ];
  projectSyms.push(node);
  return { id: `CB3:${name}`, name, node, placeholder: true };
}

// ---------------- sestavení listů ----------------
const rootUuid = randomUUID();
const sheetUuids = Object.fromEntries(Object.keys(SHEETS).map(k => [k, randomUUID()]));
const report = { resolved: [], placeholders: [], noFootprint: [] };
const placement = [];
const fx = (n) => (Math.round(n * 100) / 100).toString();
const eff = (size = 1.27, hide = false, justify = null) => ['effects', ['font', ['size', String(size), String(size)]], ...(justify ? [['justify', justify]] : []), ...(hide ? [['hide', 'yes']] : [])];
const prop = (k, v, x, y, hide = false) => ['property', str(k), str(v), ['at', fx(x), fx(y), '0'], eff(1.27, hide)];
const snap = (v) => Math.round(v / 2.54) * 2.54;

function buildSheet(key) {
  const parts = PARTS.filter(p => p.block === key);
  const libSymbols = new Map();
  const items = [];
  let cx = 25.4, cy = 35.56, rowH = 0;
  const pageW = 420 - 25;
  for (const p of parts) {
    const m = MAP[p.ref] || {};
    let sym = m.sym ? resolveSymbol(m.sym[0], m.sym[1]) : null;
    if (!sym) { sym = placeholder(p); report.placeholders.push(`${p.ref} (${p.mpn})`); } else report.resolved.push(`${p.ref} → ${sym.id}`);
    libSymbols.set(sym.id, sym.node);
    const fp = m.fp ? resolveFootprint(m.fp[0], m.fp[1]) : null;
    if (!fp) report.noFootprint.push(`${p.ref} (${p.mpn})`);
    const fpId = fp || `CB3:PH_${p.ref}`;
    placement.push({ ref: p.ref, fp: fpId, placeholder: !fp, value: m.value || p.label, mpn: p.mpn, x: p.x, z: p.z, w: p.w, d: p.d, rot: p.rot || 0, label: p.label });
    const units = sym.placeholder ? 1 : unitsOf(sym);
    const bb = bboxOf(sym);
    const sw = (bb.x1 - bb.x0) + 30, sh = (bb.y1 - bb.y0) + 20;
    for (let u = 1; u <= units; u++) {
      if (cx + sw > pageW) { cx = 25.4; cy += rowH; rowH = 0; }
      const X = snap(cx - bb.x0 + 12), Y = snap(cy + bb.y1 + 8);
      const uuid = randomUUID();
      const pins = sym.placeholder ? [] : pinsOf(sym).filter(q => q.unit === 0 || q.unit === u);
      const node = ['symbol', ['lib_id', str(sym.id)], ['at', fx(X), fx(Y), '0'], ['unit', String(u)], ['exclude_from_sim', 'no'], ['in_bom', 'yes'], ['on_board', 'yes'], ['dnp', 'no'], ['uuid', str(uuid)],
        prop('Reference', p.ref, X, Y - (bb.y1) - 3),
        prop('Value', m.value || p.label, X, Y - bb.y0 + 3),
        prop('Footprint', fpId, X, Y, true),
        prop('Datasheet', '', X, Y, true),
        prop('Description', p.label, X, Y, true),
        prop('MPN', p.mpn, X, Y, true),
        ...[...new Set(pins.map(q => q.number))].map(n => ['pin', str(n), ['uuid', str(randomUUID())]]),
        ['instances', ['project', str(PROJECT), ['path', str(`/${rootUuid}/${sheetUuids[key]}`), ['reference', str(p.ref)], ['unit', String(u)]]]],
      ];
      items.push(node);
      // sítě: globální popisky přímo na koncích vývodů
      if (m.nets) {
        for (const q of pins) {
          const net = m.nets[q.number] ?? m.nets[q.name];
          if (!net) continue;
          const px = X + q.x, py = Y - q.y;
          const ang = { 0: 180, 180: 0, 90: 270, 270: 90 }[q.angle] ?? 0;
          items.push(['global_label', str(net), ['shape', 'passive'], ['at', fx(px), fx(py), String(ang)], ['fields_autoplaced', 'yes'],
            eff(1.27, false, ang === 180 ? 'right' : ang === 0 ? 'left' : null), ['uuid', str(randomUUID())],
            ['property', '"Intersheetrefs"', '"${INTERSHEET_REFS}"', ['at', fx(px), fx(py), '0'], eff(1.27, true)]]);
        }
      }
      cx += sw;
      rowH = Math.max(rowH, sh);
    }
  }
  // poznámka: co dokreslit
  const notes = [`${SHEETS[key].title} – KOSTRA (koncept rev. A)`, '', ...NOTES[key].map(n => `• ${n}`), '',
    'Zapojené jsou jen konektory, pasivní součástky a jednoduché IO. Ostatní vývody doplnit podle doporučeného zapojení v datasheetech.',
    'Čárkované obdélníky = zástupci: nahradit symbolem výrobce (SnapEDA / Ultra Librarian / web výrobce) se stejným designátorem.'];
  items.push(['text', str(notes.join('\\n')), ['exclude_from_sim', 'no'], ['at', '25.4', '15.24', '0'], eff(1.524, false, 'left top'), ['uuid', str(randomUUID())]]);
  const sch = ['kicad_sch', ['version', '20231120'], ['generator', '"clearway"'], ['generator_version', '"8.0"'], ['uuid', str(sheetUuids[key])], ['paper', '"A3"'],
    ['title_block', ['title', str(`${BOARD.name} – ${SHEETS[key].title}`)], ['rev', '"A"'], ['company', '"ClearWay"'], ['comment', '1', '"Koncept generovaný z board-v3-data.js"']],
    ['lib_symbols', ...libSymbols.values()], ...items];
  writeFileSync(join(out, SHEETS[key].file), write(sch) + '\n');
}

for (const key of Object.keys(SHEETS)) buildSheet(key);

// ---------------- kořenový list ----------------
const sheetNodes = Object.entries(SHEETS).map(([key, s], i) => {
  const x = 30 + (i % 3) * 120, y = 60 + Math.floor(i / 3) * 70, w = 90, h = 40;
  return ['sheet', ['at', fx(x), fx(y)], ['size', fx(w), fx(h)], ['fields_autoplaced', 'yes'], ['stroke', ['width', '0.1524'], ['type', 'solid']], ['fill', ['color', '0', '0', '0', '0.0000']],
    ['uuid', str(sheetUuids[key])],
    ['property', '"Sheetname"', str(s.title), ['at', fx(x), fx(y - 0.7), '0'], eff(1.27, false, 'left bottom')],
    ['property', '"Sheetfile"', str(s.file), ['at', fx(x), fx(y + h + 0.6), '0'], eff(1.27, false, 'left top')],
    ['instances', ['project', str(PROJECT), ['path', str(`/${rootUuid}`), ['page', str(String(i + 2))]]]]];
});
const rootText = [`${BOARD.name} – nosná deska skeneru ClearWay v3 (koncept rev. ${BOARD.rev})`, '',
  `Deska ${BOARD.length} × ${BOARD.width} × ${BOARD.thickness} mm, ${BOARD.layers} vrstvy. Obrys, otvory a rozmístění převzaté z konfigurátoru.`,
  'Popis bloků, volba součástek, piny konektorů a přiřazení GPIO: configurator/docs/v3-deska.md',
  'Sítě mezi listy jsou globální popisky (V12, V5, V3V3, V3V8, GND, CAN_H, …).'];
const rootSch = ['kicad_sch', ['version', '20231120'], ['generator', '"clearway"'], ['generator_version', '"8.0"'], ['uuid', str(rootUuid)], ['paper', '"A3"'],
  ['title_block', ['title', str(`${BOARD.name} – přehled`)], ['rev', '"A"'], ['company', '"ClearWay"']],
  ['lib_symbols'],
  ['text', str(rootText.join('\\n')), ['exclude_from_sim', 'no'], ['at', '30', '25', '0'], eff(1.778, false, 'left top'), ['uuid', str(randomUUID())]],
  ...sheetNodes,
  ['sheet_instances', ['path', '"/"', ['page', '"1"']]]];
writeFileSync(join(out, `${PROJECT}.kicad_sch`), write(rootSch) + '\n');

// ---------------- projekt, knihovna zástupců, tabulky knihoven ----------------
writeFileSync(join(out, `${PROJECT}.kicad_pro`), JSON.stringify({
  meta: { filename: `${PROJECT}.kicad_pro`, version: 1 },
  // pravidla odpovídají běžné 4vrstvé výrobě (JLCPCB / PCBWay standard): 0,1 mm mezera, 0,1 mm spoj
  board: { design_settings: { defaults: {}, rules: { min_clearance: 0.1, min_track_width: 0.1, min_via_diameter: 0.45, min_through_hole_diameter: 0.25, min_copper_edge_clearance: 0.3 } } },
  net_settings: { classes: [
    { name: 'Default', clearance: 0.1, track_width: 0.15, via_diameter: 0.45, via_drill: 0.25, diff_pair_width: 0.15, diff_pair_gap: 0.15, wire_width: 6, bus_width: 12, line_style: 0, pcb_color: 'rgba(0, 0, 0, 0.000)', schematic_color: 'rgba(0, 0, 0, 0.000)' },
    { name: 'Power', clearance: 0.2, track_width: 0.8, via_diameter: 0.8, via_drill: 0.4, diff_pair_width: 0.2, diff_pair_gap: 0.25, wire_width: 6, bus_width: 12, line_style: 0, pcb_color: 'rgba(0, 0, 0, 0.000)', schematic_color: 'rgba(0, 0, 0, 0.000)' },
    { name: 'HV', clearance: 0.5, track_width: 1.0, via_diameter: 0.8, via_drill: 0.4, diff_pair_width: 0.2, diff_pair_gap: 0.25, wire_width: 6, bus_width: 12, line_style: 0, pcb_color: 'rgba(0, 0, 0, 0.000)', schematic_color: 'rgba(0, 0, 0, 0.000)' },
  ], meta: { version: 3 }, net_colors: null,
  netclass_patterns: [{ netclass: 'HV', pattern: 'KL30' }, { netclass: 'HV', pattern: 'VIN_*' }, { netclass: 'Power', pattern: 'V12*' }, { netclass: 'Power', pattern: 'V5' }, { netclass: 'Power', pattern: 'V3V*' }, { netclass: 'Power', pattern: 'GND' }] },
  sheets: [[rootUuid, 'Root'], ...Object.entries(SHEETS).map(([k, s]) => [sheetUuids[k], s.title])],
  text_variables: {},
}, null, 2) + '\n');
writeFileSync(join(out, `${PROJECT}.kicad_sym`), write(['kicad_symbol_lib', ['version', '20231120'], ['generator', '"clearway"'], ['generator_version', '"8.0"'], ...projectSyms]) + '\n');
writeFileSync(join(out, 'sym-lib-table'), `(sym_lib_table\n  (version 7)\n  (lib (name "CB3")(type "KiCad")(uri "\${KIPRJMOD}/cb3.kicad_sym")(options "")(descr "Zástupné symboly desky CB3"))\n)\n`);
writeFileSync(join(out, 'fp-lib-table'), `(fp_lib_table\n  (version 7)\n  (lib (name "CB3")(type "KiCad")(uri "\${KIPRJMOD}/cb3.pretty")(options "")(descr "Zástupná pouzdra desky CB3"))\n)\n`);
writeFileSync(join(out, 'placement.json'), JSON.stringify({ board: BOARD, parts: placement }, null, 2) + '\n');

console.log(`symboly z knihoven: ${report.resolved.length}, zástupci: ${report.placeholders.length}, bez pouzdra: ${report.noFootprint.length}`);
if (report.placeholders.length) console.log('zástupné symboly:\n  ' + report.placeholders.join('\n  '));
if (report.noFootprint.length) console.log('zástupná pouzdra:\n  ' + report.noFootprint.join('\n  '));
writeFileSync(join(out, 'generator-report.json'), JSON.stringify(report, null, 2) + '\n');
