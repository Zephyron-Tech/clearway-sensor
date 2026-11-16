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
// jen díly s daným zdrojem (např. 'tisk'), nebo jeden díl podle indexu
export const cadStepOnly = (params, role, variant, only) => call({ type: 'step', params, role, variant, only }).then(d => d.result);
export const cadStlPart = (params, role, variant, index) => call({ type: 'stlPart', params, role, variant, index }).then(d => d.result);

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
  // --- v2 ---
  pa12: () => addGrain(phys({ color: '#c9cbce', roughness: 0.84, sheen: 0.25, sheenRoughness: 0.9 }), { amount: 0.05 }),
  pa12Dark: () => addGrain(phys({ color: '#3b3d41', roughness: 0.86, sheen: 0.2, sheenRoughness: 0.9 }), { amount: 0.06 }),
  silicone: () => phys({ color: '#cf4a32', roughness: 0.5, sheen: 0.4, sheenRoughness: 0.5 }),
  foam: () => phys({ color: '#2a2b2d', roughness: 1 }),
  steel: () => phys({ color: '#b8bcc0', metalness: 1, roughness: 0.3 }),
  cell: () => phys({ color: '#1f8fa3', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  fishpaper: () => phys({ color: '#4a6b57', roughness: 0.85 }),
  kapton: () => phys({ color: '#c98a1b', roughness: 0.28, clearcoat: 0.5 }),
  fpc: () => phys({ color: '#b8741a', roughness: 0.4, metalness: 0.25, clearcoat: 0.4 }),
  ceramic: () => phys({ color: '#e6dfcc', roughness: 0.55 }),
  green: () => phys({ color: '#2f9e55', roughness: 0.45 }),
  ledRing: () => phys({ color: '#33d17a', emissive: '#1fe070', emissiveIntensity: 1.6 }),
  // --- v3 ---
  anodBlack: () => phys({ color: '#2a2c30', metalness: 0.7, roughness: 0.42, clearcoat: 0.15 }),
  powder: () => addGrain(phys({ color: '#d7dadd', roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }), { amount: 0.025 }),
  copper: () => phys({ color: '#c26e3a', metalness: 1, roughness: 0.3 }),
  ferrite: () => phys({ color: '#3a3b3e', roughness: 0.75 }),
  // moduly na desce: jiná barva než nosná deska, aby nesplývaly
  cm5Pcb: () => phys({ color: '#1e3a5f', roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  m2Pcb: () => phys({ color: '#3a2f55', roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  // měď, plošky a potisk z KiCadu (scripts/kicad/export-texture.py)
  pcbTop: () => phys({ map: boardTex('cb3-top.jpg'), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  pcbBottom: () => phys({ map: boardTex('cb3-bottom.jpg'), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
};
function boardTex(file) {
  const t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}models/${file}`);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- řez ----------
// Rovina řezu sdílená všemi CAD materiály. Odvrácené plochy se při řezu kreslí plnou barvou dílu,
// takže řez vypadá jako plný materiál, ne jako dutá skořepina.
export const section = { plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), on: false };
const capOn = { value: 0 };
function withCap(mat) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  const hasPrevKey = prevKey !== THREE.Material.prototype.customProgramCacheKey;
  const cap = { value: new THREE.Color(mat.color).multiplyScalar(0.62) };
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uCapOn = capOn;
    sh.uniforms.uCapColor = cap;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCapOn;\nuniform vec3 uCapColor;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (uCapOn > 0.5 && !gl_FrontFacing) gl_FragColor = vec4(uCapColor, gl_FragColor.a);');
  };
  mat.customProgramCacheKey = () => `${hasPrevKey ? prevKey.call(mat) : 'plain'}|cap`;
  return mat;
}
function applySection(m) {
  m.clippingPlanes = section.on ? [section.plane] : null;
  m.side = section.on ? THREE.DoubleSide : THREE.FrontSide;
  m.needsUpdate = true;
}
export function setSection(on) {
  section.on = on;
  capOn.value = on ? 1 : 0;
  for (const m of mats.values()) applySection(m);
  for (const m of hiMats.values()) applySection(m);
  edgeMat.clippingPlanes = on ? [section.plane] : null;
  edgeMat.needsUpdate = true;
}
// Materiály těla, které se zprůhlední v režimu rentgen
const BODY = new Set(['alu', 'print', 'printDark', 'cap', 'glass', 'pa12', 'pa12Dark', 'powder']);
const mats = new Map();
const hiMats = new Map();

export function material(key, color) {
  if (!mats.has(key)) {
    const m = withCap(DEF[key] ? DEF[key]() : phys({ color: color || '#888', roughness: 0.6 }));
    if (section.on) applySection(m);
    mats.set(key, m);
  }
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
      h.clippingPlanes = base.clippingPlanes; // sdílená rovina řezu (clone by ji zkopíroval)
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
  unitResult.parts.forEach((p, idx) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p.vertices, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(p.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(p.triangles, 1));
    if (p.uvBox) {
      // textura promítnutá shora: u podél x, v podél z (obrázek z KiCadu má z dolů)
      const [x0, z0, x1, z1] = p.uvBox, v = p.vertices, uv = new Float32Array(v.length / 3 * 2);
      for (let i = 0, j = 0; i < v.length; i += 3, j += 2) { uv[j] = (v[i] - x0) / (x1 - x0); uv[j + 1] = 1 - (v[i + 2] - z0) / (z1 - z0); }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, material(p.mat, p.color));
    mesh.name = p.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    mesh.userData = {
      part: true, idx, name: p.name, cat: p.cat, mat: p.mat, role, end: cx < total / 2 ? 0 : 1,
      ex: p.ex, label: p.label, spec: p.spec, src: p.src, mass: p.mass,
    };
    g.add(mesh);
    if (edges && p.lines.length) {
      // hrany jsou potomek dílu: hýbou se a skrývají s ním
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.BufferAttribute(p.lines, 3));
      const ls = new THREE.LineSegments(eg, edgeMat);
      ls.userData = { noExport: true, edgeOf: mesh };
      ls.raycast = () => {};
      mesh.userData.edges = ls;
      mesh.add(ls);
    }
  });
  return g;
}
