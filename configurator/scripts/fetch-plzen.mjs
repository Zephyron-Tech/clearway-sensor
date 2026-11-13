// Jednorázově stáhne okolí nám. Republiky v Plzni z OpenStreetMap (Overpass API)
// a uloží zjednodušená data v lokálních milimetrech do src/plzen.json.
// Data © přispěvatelé OpenStreetMap, licence ODbL.
//   node scripts/fetch-plzen.mjs
import { writeFileSync } from 'node:fs';

const LAT = 49.74753, LON = 13.37766, R = 320; // střed náměstí, poloměr v m
const q = `[out:json][timeout:60];
(
  way["building"](around:${R},${LAT},${LON});
  relation["building"](around:${R},${LAT},${LON});
  way["building:part"](around:${R},${LAT},${LON});
  way["highway"](around:${R + 80},${LAT},${LON});
  way["railway"="tram"](around:${R + 80},${LAT},${LON});
  way["place"="square"](around:${R},${LAT},${LON});
  way["area:highway"](around:${R},${LAT},${LON});
);
(._;>;);
out body;`;

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
let res;
for (const url of MIRRORS) {
  res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'clearway-configurator/1.0' },
  body: 'data=' + encodeURIComponent(q),
});
  if (res.ok) break;
  console.warn(url, res.status);
}
if (!res.ok) throw new Error(`Overpass ${res.status}`);
const osm = await res.json();

const nodes = new Map();
for (const e of osm.elements) if (e.type === 'node') nodes.set(e.id, [e.lon, e.lat]);
const ways = new Map();
for (const e of osm.elements) if (e.type === 'way') ways.set(e.id, e);

// rovnoběžková projekce kolem středu, výsledek v mm: x = východ, y = sever
const kx = 111320 * Math.cos(LAT * Math.PI / 180) * 1000, ky = 110574 * 1000;
const proj = (id) => { const [lo, la] = nodes.get(id); return [Math.round((lo - LON) * kx), Math.round((la - LAT) * ky)]; };
const num = (s) => { const m = /[\d.]+/.exec(s || ''); return m ? parseFloat(m[0]) : null; };

const heightOf = (t) => {
  const h = num(t.height) ?? (num(t['building:levels']) != null ? num(t['building:levels']) * 3.2 + 1.5 : null);
  return Math.round((h ?? 14) * 1000);
};
const minOf = (t) => Math.round((num(t.min_height) ?? (num(t['building:min_level']) != null ? num(t['building:min_level']) * 3.2 : 0)) * 1000);

const buildings = [], parts = [], roads = [], trams = [], squares = [];
const ring = (w) => w.nodes.filter(n => nodes.has(n)).map(proj);

for (const w of ways.values()) {
  const t = w.tags || {};
  if (t.building && w.nodes[0] === w.nodes.at(-1)) {
    buildings.push({ p: ring(w), h: heightOf(t), min: minOf(t), kind: t.building, name: t.name || undefined, roof: t['roof:shape'] || undefined });
  } else if (t['building:part'] && w.nodes[0] === w.nodes.at(-1)) {
    parts.push({ p: ring(w), h: heightOf(t), min: minOf(t), roof: t['roof:shape'] || undefined, name: t.name || undefined });
  } else if (t.railway === 'tram') {
    trams.push(ring(w));
  } else if (t.highway && !['footway', 'steps', 'path', 'cycleway', 'service', 'corridor', 'elevator'].includes(t.highway)) {
    roads.push({ p: ring(w), type: t.highway, lanes: num(t.lanes) || undefined, area: t.area === 'yes' || undefined, name: t.name || undefined });
  } else if ((t.place === 'square' || t['area:highway']) && w.nodes[0] === w.nodes.at(-1)) {
    squares.push(ring(w));
  }
}
// multipolygon budovy: vnější prstence
for (const e of osm.elements) {
  if (e.type !== 'relation' || !e.tags?.building) continue;
  for (const m of e.members) {
    if (m.type !== 'way' || m.role !== 'outer') continue;
    const w = ways.get(m.ref);
    if (w && w.nodes[0] === w.nodes.at(-1)) buildings.push({ p: ring(w), h: heightOf(e.tags), min: minOf(e.tags), kind: e.tags.building, name: e.tags.name });
  }
}

const out = {
  _info: 'Okolí nám. Republiky, Plzeň. Data © přispěvatelé OpenStreetMap (ODbL). Souřadnice v mm, x = východ, y = sever, střed náměstí = 0.',
  center: [LAT, LON], buildings, parts, roads, trams, squares,
};
writeFileSync(new URL('../src/plzen.json', import.meta.url), JSON.stringify(out));
console.log('budovy', buildings.length, 'části', parts.length, 'silnice', roads.length, 'tram', trams.length, 'náměstí', squares.length);
const big = [...buildings, ...parts].filter(b => b.name).map(b => `${b.name} ${b.h}`);
console.log(big.slice(0, 20).join('\n'));
