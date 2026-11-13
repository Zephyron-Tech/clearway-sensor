import * as THREE from 'three';

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let seq = 0;
const pending = new Map();
worker.onmessage = ({ data }) => {
  const p = pending.get(data.id);
  if (!p) return;
  pending.delete(data.id);
  data.ok ? p.resolve(data) : p.reject(new Error(data.error));
};
function call(msg) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, ...msg });
  });
}

export const cadBuild = (params, variant = 'v1') => call({ type: 'build', params, variant });
export const cadStep = (params, role, variant = 'v1') => call({ type: 'step', params, role, variant }).then(d => d.result);
export const cadStl = (params, role, variant = 'v1') => call({ type: 'stl', params, role, variant }).then(d => d.result);

// ---------- materiály ----------

// Zrnitost tištěného PLA: jemný šum barvy a drsnosti, u „galaxy“ filamentu kovové třpytky.
function addGrain(mat, { amount = 0.06, flakes = 0 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGrainPos;
float grainHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float gN = grainHash(floor(vGrainPos * 1.6));
diffuseColor.rgb *= 1.0 + (gN - 0.5) * ${amount.toFixed(3)};`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (gN - 0.5) * 0.06, 0.05, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
${flakes ? `float gF = grainHash(floor(vGrainPos * 3.1) + 7.0);
if (gF > ${(1 - flakes).toFixed(3)}) { diffuseColor.rgb *= 1.18; roughnessFactor = 0.3; }` : ''}`);
  };
  mat.customProgramCacheKey = () => `grain-${amount}-${flakes}`;
  return mat;
}

const phys = (o) => new THREE.MeshPhysicalMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });

const DEF = {
  alu: () => phys({ color: '#d5d8dc', metalness: 1, roughness: 0.32 }),
  print: () => addGrain(phys({ color: '#979a9f', roughness: 0.6, sheen: 0.2, sheenRoughness: 0.8 }), { amount: 0.035, flakes: 0.012 }),
  printDark: () => addGrain(phys({ color: '#6d7076', roughness: 0.7 }), { amount: 0.035, flakes: 0.006 }),
  cap: () => addGrain(phys({ color: '#4b4e53', roughness: 0.7 }), { amount: 0.035, flakes: 0.004 }),
  tape: () => phys({ color: '#8e9094', roughness: 0.45, metalness: 0.35 }),
  glass: () => phys({ color: '#0d0f12', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.5, specularIntensity: 1 }),
  lidar: () => phys({ color: '#1d1e21', roughness: 0.55 }),
  lens: () => phys({ color: '#1f2f42', roughness: 0.03, metalness: 0.4, clearcoat: 1, iridescence: 0.35 }),
  pcb: () => phys({ color: '#1c4a2c', roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  shield: () => phys({ color: '#c8c8c0', metalness: 1, roughness: 0.28 }),
  jst: () => phys({ color: '#f0eee4', roughness: 0.6 }),
  terminalBlue: () => phys({ color: '#2a78c8', roughness: 0.45 }),
  terminalGreen: () => phys({ color: '#2fa564', roughness: 0.45 }),
  tantalum: () => phys({ color: '#e6a91d', roughness: 0.4 }),
  chip: () => phys({ color: '#202124', roughness: 0.5 }),
  switch: () => phys({ color: '#9a9ca0', metalness: 0.9, roughness: 0.35 }),
  brass: () => phys({ color: '#c9a35a', metalness: 1, roughness: 0.28 }),
  nickel: () => phys({ color: '#c3c6ca', metalness: 1, roughness: 0.22 }),
  rubber: () => phys({ color: '#1a1b1d', roughness: 0.82 }),
  plasticBlack: () => phys({ color: '#232427', roughness: 0.45, clearcoat: 0.2 }),
  white: () => phys({ color: '#f2f1ec', roughness: 0.5 }),
  yellow: () => phys({ color: '#f3d227', roughness: 0.45 }),
  blue: () => phys({ color: '#1f5fd1', roughness: 0.3, clearcoat: 0.6 }),
  red: () => phys({ color: '#d23a2e', roughness: 0.35 }),
  level: () => phys({ color: '#cfe24a', roughness: 0.05, clearcoat: 1, emissive: '#3a4200', emissiveIntensity: 0.6 }),
  joint: () => phys({ color: '#7b4fd6', roughness: 0.35, clearcoat: 0.5 }),
  led: () => phys({ color: '#ff4b3a', emissive: '#ff2a1a', emissiveIntensity: 2 }),
  ledGreen: () => phys({ color: '#33d17a', emissive: '#1fe070', emissiveIntensity: 2 }),
};
// Materiály těla, které se zprůhlední v režimu rentgen
const BODY = new Set(['alu', 'print', 'printDark', 'cap', 'glass']);
const mats = new Map();
const hiMats = new Map();

export function material(key, color) {
  if (!mats.has(key)) mats.set(key, DEF[key] ? DEF[key]() : phys({ color: color || '#888', roughness: 0.6 }));
  return mats.get(key);
}

export const edgeMat = new THREE.LineBasicMaterial({ color: 0x15171b, transparent: true, opacity: 0.32 });

export function setCadOpacity(opacity) {
  for (const [k, m] of mats) {
    if (!BODY.has(k)) continue;
    m.transparent = opacity < 1; m.opacity = opacity; m.depthWrite = opacity >= 1; m.needsUpdate = true;
  }
  edgeMat.opacity = opacity < 1 ? 0.18 : 0.32;
}

/** Zvýraznění dílu (najetí myší / výběr) – sdílený materiál se nahradí kopií s emisí. */
export function setHighlight(mesh, on) {
  if (!mesh) return;
  if (on) {
    if (!mesh.userData.baseMat) mesh.userData.baseMat = mesh.material;
    const base = mesh.userData.baseMat;
    if (!hiMats.has(base)) {
      const h = base.clone();
      h.onBeforeCompile = base.onBeforeCompile;
      h.customProgramCacheKey = base.customProgramCacheKey;
      h.emissive = new THREE.Color('#2f7cf6');
      h.emissiveIntensity = 0.55;
      hiMats.set(base, h);
    }
    mesh.material = hiMats.get(base);
  } else if (mesh.userData.baseMat) {
    mesh.material = mesh.userData.baseMat;
  }
}

/** Z výsledku workeru udělá skupinu meshů (díly) + hran. */
export function cadToGroup(unitResult, { edges = true, role } = {}) {
  const g = new THREE.Group();
  const total = unitResult.total;
  for (const p of unitResult.parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p.vertices, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(p.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(p.triangles, 1));
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, material(p.mat, p.color));
    mesh.name = p.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    mesh.userData = { part: true, name: p.name, cat: p.cat, role, end: cx < total / 2 ? 0 : 1 };
    g.add(mesh);
    if (edges && p.lines.length) {
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.BufferAttribute(p.lines, 3));
      const ls = new THREE.LineSegments(eg, edgeMat);
      ls.userData = { noExport: true, edgeOf: mesh };
      mesh.userData.edges = ls;
      g.add(ls);
    }
  }
  return g;
}
