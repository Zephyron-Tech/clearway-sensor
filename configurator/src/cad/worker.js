// Web Worker s OpenCascade: staví B-rep díly, vrací trojúhelníky a hrany pro náhled,
// na vyžádání STEP/STL. Běží mimo hlavní vlákno, aby se UI nezasekávalo.
import opencascade from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/wasm?url';
import { setOC, exportSTEP, makeCompound } from 'replicad';
import { buildUnitCad as buildV1 } from './parts.js';
import { buildUnitCad as buildV2 } from './parts-v2.js';
import { buildUnitCad as buildV3 } from './parts-v3.js';

// v1 = archiv (parts.js se nemění), v2 = koncept, v3 = experiment střešní skener (jen „master“)
const BUILDERS = { v1: buildV1, v2: buildV2, v3: buildV3 };

// Hustoty v g/cm³ pro hrubý odhad hmotnosti z objemu (tisk s výplní ~60 %, přísavky a držáky plné)
const DENSITY = {
  alu: 2.7, print: 0.8, printDark: 0.8, cap: 0.8, lidar: 0.8, pcb: 1.9, shield: 2.5, nickel: 7.9, brass: 8.5,
  rubber: 1.1, plasticBlack: 1.0, blue: 2.6, glass: 1.2, lens: 1.2, jst: 1.2, chip: 2.0, white: 1.2, yellow: 1.0,
  // v2: PA12 ze SLS je plný materiál; článek 21700 váží ~69 g (objem 26,2 cm³)
  pa12: 1.0, pa12Dark: 1.0, silicone: 1.15, foam: 0.15, steel: 7.9, cell: 2.63, fishpaper: 1.2, kapton: 1.4, fpc: 1.6,
  ceramic: 4.5, green: 1.2, ledRing: 1.2, tantalum: 3.0, switch: 3.0,
  // v3: profily a příčníky jsou duté (~1,1 kg/m pro 40×40), skříň litý hliník
  anodBlack: 0.7, powder: 2.7, copper: 8.9, ferrite: 4.8,
};

const ready = (async () => {
  const OC = await opencascade({ locateFile: () => wasmUrl });
  setOC(OC);
})();

const cache = new Map(); // `${variant}:${role}` -> { key, parts }

function getParts(P, role, variant = 'v1') {
  const key = JSON.stringify(P);
  const ck = `${variant}:${role}`;
  const hit = cache.get(ck);
  if (hit && hit.key === key) return hit.parts;
  const { parts, total } = BUILDERS[variant](P, role);
  const entry = { parts, total };
  cache.set(ck, { key, parts: entry });
  return entry;
}

// Y nahoru (náhled) -> Z nahoru (CAD): otočit o +90° kolem X
const toZUp = (s) => s.clone().rotate(90, [0, 0, 0], [1, 0, 0]);

// objem uzavřené sítě (součet orientovaných čtyřstěnů), mm³
function meshVolume(v, t) {
  let vol = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    vol += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1])
      - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c])
      + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]);
  }
  return Math.abs(vol / 6);
}

function meshParts(parts, fine) {
  const tol = fine ? { tolerance: 0.05, angularTolerance: 0.2 } : { tolerance: 0.2, angularTolerance: 0.4 };
  const out = [];
  const transfer = [];
  let mass = 0;
  for (const p of parts) {
    const m = p.shape.mesh(tol);
    const e = p.shape.meshEdges(tol);
    const item = {
      name: p.name,
      cat: p.cat,
      mat: p.mat,
      color: p.color,
      ex: p.ex, label: p.label, spec: p.spec, src: p.src, uvBox: p.uvBox,
      vertices: new Float32Array(m.vertices),
      normals: new Float32Array(m.normals),
      triangles: new Uint32Array(m.triangles),
      lines: new Float32Array(e.lines),
    };
    item.mass = meshVolume(item.vertices, item.triangles) / 1000 * (DENSITY[p.mat] ?? 1.2);
    mass += item.mass;
    transfer.push(item.vertices.buffer, item.normals.buffer, item.triangles.buffer, item.lines.buffer);
    out.push(item);
  }
  return { out, transfer, mass };
}

self.onmessage = async ({ data }) => {
  const { id, type, params, role, variant = 'v1', only, index } = data;
  try {
    await ready;
    const t0 = performance.now();
    if (type === 'build') {
      const result = {};
      const transfer = [];
      for (const r of ['master', 'slave']) {
        const { parts, total } = getParts(params, r, variant);
        const m = meshParts(parts, false);
        result[r] = { parts: m.out, total, mass: m.mass };
        transfer.push(...m.transfer);
      }
      self.postMessage({ id, ok: true, result, ms: Math.round(performance.now() - t0) }, transfer);
    } else if (type === 'step') {
      let { parts } = getParts(params, role, variant);
      if (only) parts = parts.filter(p => p.src === only);
      const blob = exportSTEP(parts.map(p => ({ shape: toZUp(p.shape), name: p.name, color: p.color })), { unit: 'MM', modelUnit: 'MM' });
      self.postMessage({ id, ok: true, result: blob });
    } else if (type === 'stlPart') {
      const { parts } = getParts(params, role, variant);
      const blob = toZUp(parts[index].shape).blobSTL({ binary: true, tolerance: 0.03, angularTolerance: 0.15 });
      self.postMessage({ id, ok: true, result: blob });
    } else if (type === 'stl') {
      const { parts } = getParts(params, role, variant);
      const blob = makeCompound(parts.map(p => toZUp(p.shape))).blobSTL({ binary: true, tolerance: 0.05, angularTolerance: 0.2 });
      self.postMessage({ id, ok: true, result: blob });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
