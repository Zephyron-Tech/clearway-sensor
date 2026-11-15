// Minimální čtení a zápis S-výrazů KiCadu (knihovny .kicad_sym, .kicad_mod).
// Atomy zůstávají jako text včetně uvozovek, takže se dají vrátit beze změny.

export function parse(src) {
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  function read() {
    ws();
    if (src[i] === '(') {
      i++;
      const list = [];
      for (;;) {
        ws();
        if (src[i] === ')') { i++; return list; }
        if (i >= src.length) throw new Error('neukončený výraz');
        list.push(read());
      }
    }
    if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      const atom = src.slice(i, j + 1);
      i = j + 1;
      return atom;
    }
    let j = i;
    while (j < src.length && !/[\s()]/.test(src[j])) j++;
    const atom = src.slice(i, j);
    i = j;
    return atom;
  }
  return read();
}

export function write(node, indent = 0) {
  if (!Array.isArray(node)) return node;
  const pad = '  '.repeat(indent);
  const simple = node.every(n => !Array.isArray(n)) && node.length < 12;
  if (simple) return `(${node.join(' ')})`;
  const head = [];
  let k = 0;
  while (k < node.length && !Array.isArray(node[k])) head.push(node[k++]);
  const rest = node.slice(k).map(n => `\n${pad}  ${write(n, indent + 1)}`).join('');
  return `(${head.join(' ')}${rest}\n${pad})`;
}

export const str = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
export const unq = (a) => (typeof a === 'string' && a.startsWith('"') ? a.slice(1, -1).replace(/\\"/g, '"') : a);
export const find = (node, key) => node.find(n => Array.isArray(n) && n[0] === key);
export const findAll = (node, key) => node.filter(n => Array.isArray(n) && n[0] === key);
