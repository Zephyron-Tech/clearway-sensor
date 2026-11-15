// Načítání symbolů z knihoven KiCadu (včetně rozbalení `extends`) a výpis jejich vývodů.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse, str, unq, find, findAll } from '../sexpr.mjs';

const cache = new Map();
export function loadLib(file) {
  if (!cache.has(file)) cache.set(file, existsSync(file) ? parse(readFileSync(file, 'utf8')) : null);
  return cache.get(file);
}

/** Symbol `name` z knihovny (soubor), zploštělý, pojmenovaný `libName:name`. */
export function getSymbol(file, libName, name) {
  const L = loadLib(file);
  if (!L) throw new Error(`knihovna ${file} neexistuje`);
  const all = findAll(L, 'symbol');
  const hit = all.find(s => unq(s[1]) === name);
  if (!hit) throw new Error(`symbol ${libName}:${name} nenalezen`);
  const ext = find(hit, 'extends');
  let node;
  if (ext) {
    const parent = getSymbol(file, libName, unq(ext[1])).node;
    const pname = unq(parent[1]).split(':')[1];
    node = JSON.parse(JSON.stringify(parent));
    for (const prop of findAll(hit, 'property')) {
      const i = node.findIndex(n => Array.isArray(n) && n[0] === 'property' && n[1] === prop[1]);
      if (i >= 0) node[i] = prop; else node.push(prop);
    }
    for (const sub of findAll(node, 'symbol')) sub[1] = str(unq(sub[1]).replace(pname, name));
  } else node = JSON.parse(JSON.stringify(hit));
  node[1] = str(`${libName}:${name}`);
  return { id: `${libName}:${name}`, name, node };
}

export function pinsOf(sym) {
  const pins = [];
  for (const sub of findAll(sym.node, 'symbol')) {
    const m = /_(\d+)_(\d+)$/.exec(unq(sub[1]));
    const unit = m ? +m[1] : 0;
    for (const p of findAll(sub, 'pin')) {
      const a = find(p, 'at');
      pins.push({ name: unq(find(p, 'name')[1]), number: unq(find(p, 'number')[1]), type: p[1], x: +a[1], y: +a[2], angle: +(a[3] || 0), unit,
        hidden: p.some(x => Array.isArray(x) && x[0] === 'hide' && x[1] === 'yes') });
    }
  }
  return pins;
}
export const unitsOf = (sym) => Math.max(1, ...findAll(sym.node, 'symbol').map(s => +(/_(\d+)_\d+$/.exec(unq(s[1]))?.[1] || 0)));
export function propOf(sym, key) {
  const p = findAll(sym.node, 'property').find(q => unq(q[1]) === key);
  return p ? unq(p[2]) : '';
}

// samostatně: node symlib.mjs <adresář knihoven> Lib:Name ...
if (process.argv[1]?.endsWith('symlib.mjs')) {
  const [dir, ...ids] = process.argv.slice(2);
  for (const id of ids) {
    const [lib, name] = id.split(':');
    try {
      const s = getSymbol(join(dir, `${lib}.kicad_sym`), lib, name);
      const fp = propOf(s, 'Footprint');
      console.log(`== ${id}  [${fp}]`);
      console.log('   ' + pinsOf(s).map(p => `${p.number}:${p.name}${p.unit ? '@' + p.unit : ''}`).join('  '));
    } catch (e) { console.log(`== ${id}: ${e.message}`); }
  }
}
