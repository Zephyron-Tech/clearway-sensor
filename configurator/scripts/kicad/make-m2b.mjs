// Pouzdro slotu M.2 s klíčem B odvozené z pouzdra M.2 M-key referenční desky Raspberry Pi CM5 IO Board.
// Rozteč vývodů je podle normy M.2 stejná (0,5 mm, liché nahoře, sudé dole, vývod n na x = −9,5 + 0,25·n);
// klíč B vynechává vývody 12–19, klíč M vývody 59–66. Ze sloupků pro kartu zůstává jen 42 mm (karta 3042).
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, write, str, unq, find } from '../sexpr.mjs';
const [src, dst] = process.argv.slice(2);
const fp = parse(readFileSync(src, 'utf8'));
fp[1] = str('M.2_Socket_KeyB_TopMount_H4.2');
const isPad = (n) => Array.isArray(n) && n[0] === 'pad';
const pads = fp.filter(isPad);
const template = pads.find(p => unq(p[1]) === '1');
const out = fp.filter(n => {
  if (!isPad(n)) return !(Array.isArray(n) && n[0] === 'property' && unq(n[1]) === 'Value') || true;
  const num = unq(n[1]);
  if (/^\d+$/.test(num) && +num >= 12 && +num <= 19) return false;   // klíč B
  if (['M1', 'M3', 'M4'].includes(num)) return false;                // sloupky pro jiné délky karet
  return true;
});
for (let n = 59; n <= 66; n++) {
  const p = JSON.parse(JSON.stringify(template));
  p[1] = str(String(n));
  const at = find(p, 'at');
  at[1] = String(-9.5 + 0.25 * n);
  at[2] = n % 2 ? '-5.275' : '2.275';
  const u = find(p, 'uuid'); if (u) u[1] = str(crypto.randomUUID());
  out.push(p);
}
for (const n of out) if (Array.isArray(n) && n[0] === 'property' && unq(n[1]) === 'Value') n[2] = str('M.2_Socket_KeyB_TopMount_H4.2');
writeFileSync(dst, write(out) + '\n');
console.log('ploška', out.filter(isPad).length);
