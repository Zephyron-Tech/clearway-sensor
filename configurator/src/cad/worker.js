// Web Worker s OpenCascade: staví B-rep díly, vrací trojúhelníky a hrany pro náhled,
// na vyžádání STEP/STL. Běží mimo hlavní vlákno, aby se UI nezasekávalo.
import opencascade from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/wasm?url';
import { setOC, exportSTEP, makeCompound, measureVolume } from 'replicad';
import { buildUnitCad as buildV1 } from './parts.js';
import { buildUnitCad as buildV2 } from './parts-v2.js';

// v1 = archiv (parts.js se nemění), v2 = koncept
const BUILDERS = { v1: buildV1, v2: buildV2 };

// Hustoty v g/cm³ pro hrubý odhad hmotnosti z objemu (tisk s výplní ~60 %, přísavky a držáky plné)
const DENSITY = {
  alu: 2.7, print: 0.8, printDark: 0.8, cap: 0.8, lidar: 0.8, pcb: 1.9, shield: 2.5, nickel: 7.9, brass: 8.5,
  rubber: 1.1, plasticBlack: 1.0, blue: 2.6, glass: 1.2, lens: 1.2, jst: 1.2, chip: 2.0, white: 1.2, yellow: 1.0,
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
  let mass = 0;
  for (const p of parts) { try { mass += measureVolume(p.shape) / 1000 * (DENSITY[p.mat] ?? 1.2); } catch { /* složitý tvar */ } }
  const entry = { parts, total, mass };
  cache.set(ck, { key, parts: entry });
  return entry;
}

// Y nahoru (náhled) -> Z nahoru (CAD): otočit o +90° kolem X
const toZUp = (s) => s.clone().rotate(90, [0, 0, 0], [1, 0, 0]);

function meshParts(parts, fine) {
  const tol = fine ? { tolerance: 0.05, angularTolerance: 0.2 } : { tolerance: 0.2, angularTolerance: 0.4 };
  const out = [];
  const transfer = [];
  for (const p of parts) {
    const m = p.shape.mesh(tol);
    const e = p.shape.meshEdges(tol);
    const item = {
      name: p.name,
      cat: p.cat,
      mat: p.mat,
      color: p.color,
      vertices: new Float32Array(m.vertices),
      normals: new Float32Array(m.normals),
      triangles: new Uint32Array(m.triangles),
      lines: new Float32Array(e.lines),
    };
    transfer.push(item.vertices.buffer, item.normals.buffer, item.triangles.buffer, item.lines.buffer);
    out.push(item);
  }
  return { out, transfer };
}

self.onmessage = async ({ data }) => {
  const { id, type, params, role, variant = 'v1' } = data;
  try {
    await ready;
    const t0 = performance.now();
    if (type === 'build') {
      const result = {};
      const transfer = [];
      for (const r of ['master', 'slave']) {
        const { parts, total, mass } = getParts(params, r, variant);
        const m = meshParts(parts, false);
        result[r] = { parts: m.out, total, mass };
        transfer.push(...m.transfer);
      }
      self.postMessage({ id, ok: true, result, ms: Math.round(performance.now() - t0) }, transfer);
    } else if (type === 'step') {
      const { parts } = getParts(params, role, variant);
      const blob = exportSTEP(parts.map(p => ({ shape: toZUp(p.shape), name: p.name, color: p.color })), { unit: 'MM', modelUnit: 'MM' });
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
