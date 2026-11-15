// Generátor kompletního schématu desky CB3 z cb3-design.mjs.
// node scripts/kicad/gen-full.mjs <KiCad SharedSupport> <CM5IO projekt>
// Výstup do hardware/cb3: kořenové schéma + listy bloků, knihovna symbolů a pouzder CB3, netlist.json pro desku.
import { writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { write, str, unq, find } from '../sexpr.mjs';
import { getSymbol, pinsOf, unitsOf } from './symlib.mjs';
import { customSymbols } from './cb3-symbols.mjs';
import { PARTS, SHEETS, POWER_FLAGS } from './cb3-design.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const out = join(root, 'hardware', 'cb3');
const KI = process.argv[2] || join(process.env.HOME, 'Applications/KiCad/KiCad.app/Contents/SharedSupport');
const CM5IO = process.argv[3];
const SYM = join(KI, 'symbols'), FPD = join(KI, 'footprints');
const PROJECT = 'cb3';
mkdirSync(join(out, 'cb3.pretty'), { recursive: true });

const custom = customSymbols(join(CM5IO, 'CM5IO.kicad_sym'));
const symCache = new Map();
function sym(id) {
  if (!symCache.has(id)) {
    if (custom[id]) symCache.set(id, custom[id]);
    else { const [lib, name] = id.split(':'); symCache.set(id, getSymbol(join(SYM, `${lib}.kicad_sym`), lib, name)); }
  }
  return symCache.get(id);
}
// projektová pouzdra: CM5 z referenčního projektu
copyFileSync(join(CM5IO, 'CM5IO.pretty', 'Raspberry-Pi-5-Compute-Module.kicad_mod'), join(out, 'cb3.pretty', 'Raspberry-Pi-5-Compute-Module.kicad_mod'));
function fpExists(id) {
  const [lib, name] = id.split(':');
  if (lib === 'CB3') return existsSync(join(out, 'cb3.pretty', `${name}.kicad_mod`));
  return existsSync(join(FPD, `${lib}.pretty`, `${name}.kicad_mod`));
}

// ---------------- kontrola zapojení ----------------
const errors = [], netlist = {};
const PAD_ONLY = ['MP', 'SH', 'M2', 'S1', 'S2'];
const resolved = PARTS.map((p) => {
  const s = sym(p.sym);
  const pins = pinsOf(s);
  const byNum = new Map(pins.map(q => [q.number, q]));
  const assign = new Map();   // číslo vývodu -> síť | null
  for (const [k, net] of Object.entries(p.nets || {})) {
    if (PAD_ONLY.includes(k)) continue;   // jen plošky pouzdra (úchyty, stínění, sloupky)
    let q = byNum.get(k);
    if (!q) { const byName = pins.filter(x => x.name === k); if (byName.length === 1) q = byName[0]; else if (byName.length > 1) { byName.forEach(x => assign.set(x.number, net)); continue; } }
    if (!q) { errors.push(`${p.ref}: vývod „${k}“ v symbolu ${p.sym} není`); continue; }
    assign.set(q.number, net);
  }
  for (const q of pins) {
    if (assign.has(q.number)) continue;
    if (p.gndByName && /^GND/.test(q.name)) assign.set(q.number, 'GND');
    else if (p.ncRest || q.type === 'no_connect') assign.set(q.number, null);
    else errors.push(`${p.ref}: vývod ${q.number} (${q.name}) není zapojený ani označený jako nezapojený`);
  }
  if (!fpExists(p.fp)) errors.push(`${p.ref}: pouzdro ${p.fp} neexistuje`);
  const pads = {};
  for (const [num, net] of assign) if (net) pads[num] = net;
  for (const k of PAD_ONLY) if (p.nets?.[k]) pads[k] = p.nets[k];
  netlist[p.ref] = { fp: p.fp, value: p.value, mpn: p.mpn, sheet: p.sheet, anchor: p.anchor, pads };
  return { p, s, pins, assign };
});
// sítě s jediným vývodem (překlep v názvu sítě)
const netCount = new Map();
for (const r of resolved) for (const net of r.assign.values()) if (net) netCount.set(net, (netCount.get(net) || 0) + 1);
const singles = [...netCount].filter(([, n]) => n < 2).map(([k]) => k);
if (errors.length) { console.error('CHYBY:\n  ' + errors.join('\n  ')); process.exit(1); }

// ---------------- listy ----------------
const rootUuid = randomUUID();
const sheetUuid = Object.fromEntries(Object.keys(SHEETS).map(k => [k, randomUUID()]));
const fx = (n) => (Math.round(n * 100) / 100).toString();
const snap = (v) => Math.round(v / 2.54) * 2.54;
const eff = (size = 1.27, hide = false, justify = null) => ['effects', ['font', ['size', String(size), String(size)]], ...(justify ? [['justify', ...justify.split(' ')]] : []), ...(hide ? [['hide', 'yes']] : [])];
const prop = (k, v, x, y, hide = false) => ['property', str(k), str(v), ['at', fx(x), fx(y), '0'], eff(1.27, hide)];
function bbox(s) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const addP = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const q of pinsOf(s)) addP(q.x, q.y);
  for (const sub of s.node.filter(n => Array.isArray(n) && n[0] === 'symbol')) for (const r of sub.filter(n => Array.isArray(n) && n[0] === 'rectangle')) { const a = find(r, 'start'), b = find(r, 'end'); addP(+a[1], +a[2]); addP(+b[1], +b[2]); }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : { x0: -5, y0: -5, x1: 5, y1: 5 };
}
const labelAt = (net, x, y, ang) => ['global_label', str(net), ['shape', 'passive'], ['at', fx(x), fx(y), String(ang)], ['fields_autoplaced', 'yes'],
  eff(1.27, false, ang === 180 ? 'right' : ang === 0 ? 'left' : null), ['uuid', str(randomUUID())],
  ['property', '"Intersheetrefs"', '"${INTERSHEET_REFS}"', ['at', fx(x), fx(y), '0'], eff(1.27, true)]];
const LABEL_ANG = { 0: 180, 180: 0, 90: 270, 270: 90 };

function buildSheet(key) {
  const libSymbols = new Map();
  const items = [];
  const PAGE_W = 594 - 20;
  let cx = 15, cy = 30, rowH = 0;
  const place = (s, w, h) => {
    if (cx + w > PAGE_W) { cx = 15; cy += rowH + 6; rowH = 0; }
    const pos = [cx, cy];
    cx += w + 8; rowH = Math.max(rowH, h);
    return pos;
  };
  for (const r of resolved.filter(x => x.p.sheet === key)) {
    const { p, s } = r;
    libSymbols.set(s.id, s.node);
    const units = unitsOf(s);
    const bb = bbox(s);
    for (let u = 1; u <= units; u++) {
      const upins = r.pins.filter(q => q.unit === 0 || q.unit === u);
      const ubb = units > 1 ? (() => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of upins) { a = Math.min(a, q.x); c = Math.max(c, q.x); b = Math.min(b, q.y); d = Math.max(d, q.y); } return { x0: a, y0: b, x1: c, y1: d }; })() : bb;
      const lw = 28;     // místo na popisky sítí
      const [px, py] = place(s, (ubb.x1 - ubb.x0) + 2 * lw, (ubb.y1 - ubb.y0) + 12);
      const X = snap(px + lw - ubb.x0), Y = snap(py + 6 + ubb.y1);
      items.push(['symbol', ['lib_id', str(s.id)], ['at', fx(X), fx(Y), '0'], ['unit', String(u)], ['exclude_from_sim', 'no'], ['in_bom', p.ref.startsWith('TP') || p.ref.startsWith('MH') || p.ref === 'H1' ? 'no' : 'yes'], ['on_board', 'yes'], ['dnp', 'no'],
        ['uuid', str(randomUUID())],
        prop('Reference', p.ref, X, Y - ubb.y1 - 2.54), prop('Value', p.value, X, Y - ubb.y0 + 2.54), prop('Footprint', p.fp, X, Y, true),
        prop('Datasheet', '', X, Y, true), prop('Description', '', X, Y, true), prop('MPN', p.mpn || '', X, Y, true),
        ...[...new Set(upins.map(q => q.number))].map(n => ['pin', str(n), ['uuid', str(randomUUID())]]),
        ['instances', ['project', str(PROJECT), ['path', str(`/${rootUuid}/${sheetUuid[key]}`), ['reference', str(p.ref)], ['unit', String(u)]]]]]);
      for (const q of upins) {
        if (!r.assign.has(q.number)) continue;
        const net = r.assign.get(q.number);
        const x = X + q.x, y = Y - q.y;
        if (net == null) { if (q.type !== 'no_connect') items.push(['no_connect', ['at', fx(x), fx(y)], ['uuid', str(randomUUID())]]); }
        else items.push(labelAt(net, x, y, LABEL_ANG[q.angle] ?? 0));
      }
    }
  }
  // značky PWR_FLAG na napájecích sítích (jen na listu napájení)
  if (key === 'napajeni') {
    const pf = getSymbol(join(SYM, 'power.kicad_sym'), 'power', 'PWR_FLAG');
    libSymbols.set(pf.id, pf.node);
    POWER_FLAGS.forEach((net, i) => {
      const X = snap(20 + i * 22), Y = snap(cy + rowH + 30);
      items.push(['symbol', ['lib_id', '"power:PWR_FLAG"'], ['at', fx(X), fx(Y), '0'], ['unit', '1'], ['exclude_from_sim', 'no'], ['in_bom', 'yes'], ['on_board', 'yes'], ['dnp', 'no'], ['uuid', str(randomUUID())],
        prop('Reference', `#FLG0${String(i + 1).padStart(2, '0')}`, X, Y - 4, true), prop('Value', 'PWR_FLAG', X, Y - 3), prop('Footprint', '', X, Y, true), prop('Datasheet', '', X, Y, true), prop('Description', '', X, Y, true),
        ['pin', '"1"', ['uuid', str(randomUUID())]],
        ['instances', ['project', str(PROJECT), ['path', str(`/${rootUuid}/${sheetUuid[key]}`), ['reference', str(`#FLG0${String(i + 1).padStart(2, '0')}`)], ['unit', '1']]]]]);
      items.push(labelAt(net, X, Y, 270));
    });
  }
  const sch = ['kicad_sch', ['version', '20231120'], ['generator', '"clearway"'], ['generator_version', '"8.0"'], ['uuid', str(sheetUuid[key])], ['paper', '"A2"'],
    ['title_block', ['title', str(`ClearWay CB3 – ${SHEETS[key]}`)], ['rev', '"B"'], ['company', '"ClearWay"'], ['comment', '1', '"Generováno z configurator/scripts/kicad/cb3-design.mjs"']],
    ['lib_symbols', ...libSymbols.values()], ...items];
  writeFileSync(join(out, `${key}.kicad_sch`), write(sch) + '\n');
}
for (const k of Object.keys(SHEETS)) buildSheet(k);

// ---------------- kořen ----------------
const sheetNodes = Object.entries(SHEETS).map(([key, title], i) => {
  const x = 30 + (i % 3) * 120, y = 70 + Math.floor(i / 3) * 70, w = 90, h = 40;
  return ['sheet', ['at', fx(x), fx(y)], ['size', fx(w), fx(h)], ['fields_autoplaced', 'yes'], ['stroke', ['width', '0.1524'], ['type', 'solid']], ['fill', ['color', '0', '0', '0', '0.0000']],
    ['uuid', str(sheetUuid[key])],
    ['property', '"Sheetname"', str(title), ['at', fx(x), fx(y - 0.7), '0'], eff(1.27, false, 'left bottom')],
    ['property', '"Sheetfile"', str(`${key}.kicad_sch`), ['at', fx(x), fx(y + h + 0.6), '0'], eff(1.27, false, 'left top')],
    ['instances', ['project', str(PROJECT), ['path', str(`/${rootUuid}`), ['page', str(String(i + 2))]]]]];
});
const text = ['ClearWay CB3 rev. B – nosná deska skeneru ClearWay v3', '',
  'Kompletní zapojení podle datasheetů výrobců (seznam zdrojů v cb3-design.mjs a configurator/docs/v3-deska.md).',
  'Sítě mezi listy jsou globální popisky. Netlist pro desku: netlist.json.'];
const rootSch = ['kicad_sch', ['version', '20231120'], ['generator', '"clearway"'], ['generator_version', '"8.0"'], ['uuid', str(rootUuid)], ['paper', '"A3"'],
  ['title_block', ['title', '"ClearWay CB3 – přehled"'], ['rev', '"B"'], ['company', '"ClearWay"']], ['lib_symbols'],
  ['text', str(text.join('\\n')), ['exclude_from_sim', 'no'], ['at', '30', '25', '0'], eff(1.778, false, 'left top'), ['uuid', str(randomUUID())]],
  ...sheetNodes, ['sheet_instances', ['path', '"/"', ['page', '"1"']]]];
writeFileSync(join(out, `${PROJECT}.kicad_sch`), write(rootSch) + '\n');
// staré listy kostry, které už nejsou
for (const f of readdirSync(out)) if (f.endsWith('.kicad_sch') && f !== `${PROJECT}.kicad_sch` && !Object.keys(SHEETS).some(k => f === `${k}.kicad_sch`)) rmSync(join(out, f));

// knihovna symbolů CB3 a tabulky knihoven
const cbSyms = Object.values(custom).map(s => s.node);
writeFileSync(join(out, `${PROJECT}.kicad_sym`), write(['kicad_symbol_lib', ['version', '20231120'], ['generator', '"clearway"'], ['generator_version', '"8.0"'],
  ...cbSyms.map(n => { const c = JSON.parse(JSON.stringify(n)); c[1] = str(unq(c[1]).split(':')[1]); return c; })]) + '\n');
writeFileSync(join(out, 'sym-lib-table'), `(sym_lib_table\n  (version 7)\n  (lib (name "CB3")(type "KiCad")(uri "\${KIPRJMOD}/cb3.kicad_sym")(options "")(descr "Symboly desky CB3"))\n)\n`);
writeFileSync(join(out, 'fp-lib-table'), `(fp_lib_table\n  (version 7)\n  (lib (name "CB3")(type "KiCad")(uri "\${KIPRJMOD}/cb3.pretty")(options "")(descr "Pouzdra desky CB3"))\n)\n`);
writeFileSync(join(out, 'netlist.json'), JSON.stringify(netlist, null, 1) + '\n');
// projekt: třídy sítí
const pro = existsSync(join(out, `${PROJECT}.kicad_pro`)) ? JSON.parse(readFileSync(join(out, `${PROJECT}.kicad_pro`), 'utf8')) : { meta: { filename: `${PROJECT}.kicad_pro`, version: 1 } };
pro.sheets = [[rootUuid, 'Root'], ...Object.entries(SHEETS).map(([k, t]) => [sheetUuid[k], t])];
writeFileSync(join(out, `${PROJECT}.kicad_pro`), JSON.stringify(pro, null, 2) + '\n');

console.log(`součástek ${PARTS.length}, sítí ${netCount.size}`);
if (singles.length) console.log('sítě s jediným vývodem (zkontrolovat): ' + singles.join(', '));
