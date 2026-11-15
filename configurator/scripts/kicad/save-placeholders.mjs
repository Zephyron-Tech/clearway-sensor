// Zástupná pouzdra z vygenerované desky uloží do knihovny projektu hardware/cb3/cb3.pretty,
// aby je KiCad našel při Aktualizovat DPS ze schématu (pcbnew.FootprintSave to v KiCadu 10 z Pythonu neumí).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, write, str, unq } from '../sexpr.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'hardware', 'cb3');
const pcb = parse(readFileSync(join(dir, 'cb3.kicad_pcb'), 'utf8'));
mkdirSync(join(dir, 'cb3.pretty'), { recursive: true });
let n = 0;
for (const fp of pcb.filter(x => Array.isArray(x) && x[0] === 'footprint')) {
  const id = unq(fp[1]);
  if (!id.startsWith('CB3:')) continue;
  const name = id.slice(4);
  const body = fp.slice(2).filter(x => !(Array.isArray(x) && ['at', 'uuid', 'path', 'sheetname', 'sheetfile'].includes(x[0])));
  const mod = ['footprint', str(name), ['version', '20240108'], ['generator', '"clearway"'], ...body];
  writeFileSync(join(dir, 'cb3.pretty', `${name}.kicad_mod`), write(mod) + '\n');
  n++;
}
console.log(`uloženo ${n} zástupných pouzder do cb3.pretty`);
