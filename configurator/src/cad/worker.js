// Web Worker s OpenCascade: staví B-rep díly, vrací trojúhelníky a hrany pro náhled,
// na vyžádání STEP/STL. Běží mimo hlavní vlákno, aby se UI nezasekávalo.
import opencascade from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/wasm?url';
import { setOC, exportSTEP, makeCompound } from 'replicad';
import { buildUnitCad } from './parts.js';

const ready = (async () => {
  const OC = await opencascade({ locateFile: () => wasmUrl });
  setOC(OC);
})();

const cache = new Map(); // role -> { key, parts }

function getParts(P, role) {
  const key = JSON.stringify(P);
  const hit = cache.get(role);
  if (hit && hit.key === key) return hit.parts;
  const { parts, total } = buildUnitCad(P, role);
  const entry = { parts, total };
  cache.set(role, { key, parts: entry });
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
  const { id, type, params, role } = data;
  try {
    await ready;
    const t0 = performance.now();
    if (type === 'build') {
      const result = {};
      const transfer = [];
      for (const r of ['master', 'slave']) {
        const { parts, total } = getParts(params, r);
        const m = meshParts(parts, false);
        result[r] = { parts: m.out, total };
        transfer.push(...m.transfer);
      }
      self.postMessage({ id, ok: true, result, ms: Math.round(performance.now() - t0) }, transfer);
    } else if (type === 'step') {
      const { parts } = getParts(params, role);
      const blob = exportSTEP(parts.map(p => ({ shape: toZUp(p.shape), name: p.name, color: p.color })), { unit: 'MM', modelUnit: 'MM' });
      self.postMessage({ id, ok: true, result: blob });
    } else if (type === 'stl') {
      const { parts } = getParts(params, role);
      const blob = makeCompound(parts.map(p => toZUp(p.shape))).blobSTL({ binary: true, tolerance: 0.05, angularTolerance: 0.2 });
      self.postMessage({ id, ok: true, result: blob });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
