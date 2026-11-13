import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import paramsV1 from './variants/v1/params.json';
import paramsV2 from './variants/v2/params.json';
import { buildUnit, footHeight, layout, setBodyOpacity } from './model.js';
import { cadBuild, cadStep, cadStl, cadToGroup, setCadOpacity, setHighlight } from './cad/client.js';
import { buildCar, buildRoad, loadCar, CAR_CREDIT } from './car.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { makeLabel, makeDim, makeCable } from './overlay.js';
import { PHOTOS } from './photos.js';
import { winNames } from './names.js';
import { feet } from './geometry.js';

// v1 = stávající zařízení (archiv, jen pro čtení, neukládá se), v2 = koncept (úpravy v localStorage)
// Další verze = nová složka variants/vN, builder v cad/worker.js a řádek sem.
const VARIANTS = {
  v1: { label: 'v1 · archiv', defaults: paramsV1, readonly: true, color: '#e8590c' },
  v2: { label: 'v2 · koncept', defaults: paramsV2, readonly: false, store: 'clearway-params-v2', color: '#2f7cf6' },
};
const VARIANT_IDS = Object.keys(VARIANTS);
const others = (vr) => VARIANT_IDS.filter(x => x !== vr);
const UI_STORE = 'clearway-ui-v1';
const STAVY = ['odhad', 'zmereno', 'koncept'];
const STAV_LABEL = { odhad: 'odhad', zmereno: 'změřeno', koncept: 'koncept' };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('cs-CZ');

// ---------- stav ----------
const state = Object.assign(
  { scene: 'stul', variant: 'v1', compare: false, compareMode: 'side', shown: {}, beams: true, labels: true, dims: false, edges: true, xray: false, cable: true, explode: 0, tab: 'params',
    hidden: {} },
  loadUi(),
);
if (!VARIANTS[state.variant]) state.variant = 'v1';
const PV = { v1: loadParams('v1'), v2: loadParams('v2') };
let P = PV[state.variant];
const defaults = () => VARIANTS[state.variant].defaults;
const readonly = () => VARIANTS[state.variant].readonly;
// dočasně přepnout aktivní parametry (overlaye, montáž a kabely druhé verze při porovnání)
function withParams(Q, fn) { const old = P; P = Q; try { return fn(); } finally { P = old; } }

function loadParams(vr) {
  const V = VARIANTS[vr];
  if (V.store) {
    try {
      const raw = localStorage.getItem(V.store);
      if (raw) return mergeParams(clone(V.defaults), JSON.parse(raw));
    } catch { /* úložiště nedostupné */ }
  }
  return clone(V.defaults);
}
function saveParams() {
  const V = VARIANTS[state.variant];
  if (V.readonly || !V.store) return;
  try { localStorage.setItem(V.store, JSON.stringify(P)); } catch { /* ignorovat */ }
}
function loadUi() { try { return JSON.parse(localStorage.getItem(UI_STORE)) || {}; } catch { return {}; } }
function saveUi() {
  try {
    const { scene, variant, compare, compareMode, shown, beams, labels, dims, edges, xray, cable, explode, tab, hidden } = state;
    localStorage.setItem(UI_STORE, JSON.stringify({ scene, variant, compare, compareMode, shown, beams, labels, dims, edges, xray, cable, explode, tab, hidden }));
  } catch { /* ignorovat */ }
}
// Přebírá jen známé klíče, aby starý JSON nerozbil novou verzi parametrů
function mergeParams(base, incoming) {
  for (const g of Object.keys(base)) {
    if (g.startsWith('_') || !incoming[g]) continue;
    for (const k of Object.keys(base[g])) {
      const src = incoming[g][k];
      if (src && typeof src.v === 'number') {
        base[g][k].v = src.v;
        if (STAVY.includes(src.stav)) base[g][k].stav = src.stav;
      }
    }
  }
  return base;
}
const v = (g, k) => P[g][k].v;

// ---------- renderer a scéna ----------
const view = $('#view');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
view.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = roomEnv;
scene.environmentIntensity = 0.75;

// Obloha pro scénu na autě: Preethamova obloha, slunce odpoledne nad Plzní
const SUN_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 36), THREE.MathUtils.degToRad(140));
function makeSky(scale) {
  const s = new Sky();
  s.scale.setScalar(scale);
  const u = s.material.uniforms;
  u.turbidity.value = 3.5; u.rayleigh.value = 1.1; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(SUN_DIR);
  return s;
}
const sky = makeSky(2.5e6);
sky.visible = false;
scene.add(sky);
const skyEnv = (() => { const s = new THREE.Scene(); s.add(makeSky(50)); return pmrem.fromScene(s).texture; })();
const cityFog = new THREE.Fog(0xc9d6e3, 120000, 900000);

const camera = new THREE.PerspectiveCamera(35, 1, 5, 80000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.maxPolarAngle = Math.PI * 0.495;

scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x6d6a66, 0.55));
const sun = new THREE.DirectionalLight(0xfff6ea, 1.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
sun.shadow.radius = 4;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.6);
fill.position.set(-2000, 1200, -1500);
scene.add(fill);

// podlaha: zachytávač stínu + jemná mřížka
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.ShadowMaterial({ opacity: 0.22 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(6000, 60, 0x9aa1ad, 0xc4c9d2);
grid.material.transparent = true;
grid.material.opacity = 0.35;
grid.position.y = 0.5;
scene.add(grid);

let content = new THREE.Group();
scene.add(content);
// Trvalá scéna na autě (načítá se jednou): Plzeň z OSM + model vozu
const world = new THREE.Group();
scene.add(world);
const carScene = { city: null, car: null, started: false };
function ensureCarScene() {
  if (carScene.started) return; // načítá se jen jednou, i když selže
  carScene.started = true;
  setStatus('Načítám Plzeň a vůz…', 'busy');
  Promise.allSettled([
    import('./plzen.json').then(async (m) => { const { buildCity } = await import('./city.js'); return buildCity(m.default); }),
    loadCar(),
  ]).then(([city, car]) => {
    if (city.status === 'fulfilled') { carScene.city = city.value; world.add(city.value); } else console.error(city.reason);
    if (car.status === 'fulfilled') { carScene.car = car.value; world.add(car.value); }
    else { console.warn('Model vozu nenačten', car.reason); toast('Model vozu chybí (public/models/car.glb), zobrazuji zjednodušený vůz', true); }
    setStatus(cad.data ? 'CAD připraven' : 'Načítám CAD jádro…', cad.data ? 'ok' : 'busy');
    if (state.scene === 'auto') rebuild(true, false);
  });
}

// Přepíná prostředí podle scény (místnost + mřížka na stole, obloha + město na autě)
function applyEnvironment() {
  const auto = state.scene === 'auto';
  const city = auto && !!carScene.city;
  world.visible = auto;
  if (carScene.car) carScene.car.visible = auto;
  sky.visible = city;
  scene.environment = city ? skyEnv : roomEnv;
  scene.environmentIntensity = city ? 0.9 : 0.75;
  scene.fog = city ? cityFog : null;
  floor.visible = !city;
  grid.visible = !auto;
  camera.near = auto ? 20 : 5;
  camera.far = city ? 3e6 : 80000;
  camera.updateProjectionMatrix();
  const credit = $('#credit');
  if (credit) {
    credit.hidden = !auto;
    credit.textContent = `Mapová data © přispěvatelé OpenStreetMap (ODbL)${carScene.car ? ' · Model vozu: ' + CAR_CREDIT : ''}`;
  }
}

/**
 * Přisaje jednotku na bok skutečného vozu: paprsky zvenku k dveřím ve výšce obou noh najdou
 * povrch, tělo se postaví tak, aby středy přísavek ležely na karoserii, a natočí se podle sklonu dveří.
 * side +1 = pravý bok (+Z), -1 = levý.
 */
const carRay = new THREE.Raycaster();
function mountOnCar(u, side, car, px = v('scena', 'poloha_x')) {
  const total = layout(P).total;
  const yTop = v('scena', 'vyska_montaze') + total / 2; // čelo A (anténa) nahoře
  const L = v('noha', 'drzak_vyska') + v('noha', 'prisavka_vyska');
  const pts = [];
  for (const f of feet(P)) {
    const y = yTop - f.x;
    carRay.set(new THREE.Vector3(px, y, side * 5000), new THREE.Vector3(0, 0, -side));
    const hit = carRay.intersectObject(car, true)[0];
    if (!hit) return false;
    // vzdálenost spodku těla od karoserie v ose přísavky
    const a = THREE.MathUtils.degToRad(f.tilt);
    pts.push({ f, p: new THREE.Vector3(px, y, hit.point.z + side * (f.hc + L * Math.cos(a))) });
  }
  const [p0, p1] = pts;
  const ex = p1.p.clone().sub(p0.p).normalize();                 // podél těla (čelo A -> B), míří dolů
  let ey = new THREE.Vector3(0, -ex.z, ex.y);                    // kolmo ve svislé rovině
  if (Math.sign(ey.z) !== side) ey.negate();                     // okna ven od vozu
  const ez = new THREE.Vector3().crossVectors(ex, ey);
  u.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
  u.position.copy(p0.p).addScaledVector(ex, -p0.f.x);
  return true;
}
const pickables = [];

function disposeTree(o) {
  o.traverse((n) => {
    n.geometry?.dispose();
    if (n.isSprite) { n.material.map?.dispose(); n.material.dispose(); }
  });
}

// ---------- CAD (OpenCascade ve workeru) ----------
// Poslední hotový CAD výsledek se ukazuje, dokud nedorazí nový.
const cad = { data: null, key: null, busy: false, queued: false, timer: 0 };
// výsledky CAD pro obě verze; cad.data/key = aktuální verze
const cadStore = Object.fromEntries(VARIANT_IDS.map(id => [id, { data: null, key: null }]));
// verze zobrazené k porovnání (kromě aktivní)
const compared = () => (state.compare ? others(state.variant).filter(id => state.shown[id] !== false) : []);
const cadKey = (vr) => JSON.stringify(PV[vr]);
function syncCad() { const c = cadStore[state.variant]; cad.data = c.data; cad.key = c.key; }
let compareBusy = false;
// postaví CAD pro porovnávané verze (postupně, aby se neprala o worker s aktivní verzí)
async function ensureCompareCad() {
  if (compareBusy) return;
  const todo = compared().filter(id => cadStore[id].key !== cadKey(id));
  if (!todo.length) return;
  compareBusy = true;
  try {
    for (const id of todo) {
      const key = cadKey(id);
      const res = await cadBuild(JSON.parse(key), id);
      cadStore[id] = { data: res.result, key };
    }
    $('#loading').classList.add('gone');
    rebuild(false, false);
  } catch (err) { console.error(err); } finally { compareBusy = false; }
}
const statusEl = $('#cadStatus');
const setStatus = (text, kind = '') => { statusEl.querySelector('span').textContent = text; statusEl.className = kind; };
setStatus('Načítám CAD jádro…', 'busy');

function requestCad() { clearTimeout(cad.timer); cad.timer = setTimeout(runCad, 220); }
async function runCad() {
  if (cad.busy) { cad.queued = true; return; }
  cad.busy = true;
  const vr = state.variant;
  const key = JSON.stringify(P);
  if (cad.data) setStatus('Přepočítávám model…', 'busy');
  try {
    const res = await cadBuild(JSON.parse(key), vr);
    const first = !Object.values(cadStore).some(c => c.data);
    cadStore[vr] = { data: res.result, key };
    syncCad();
    const n = res.result.master.parts.length + res.result.slave.parts.length;
    setStatus(`CAD · ${n} dílů · ${res.ms} ms`, 'ok');
    rebuild(false, false);
    $('#loading').classList.add('gone');
    if (first || !$('#partsList [data-cat]')) renderPartsTab();
  } catch (err) {
    setStatus('Chyba CAD: ' + err.message, 'err');
    console.error(err);
  } finally {
    cad.busy = false;
    if (cad.queued || JSON.stringify(P) !== key || state.variant !== vr) { cad.queued = false; runCad(); }
  }
}

// ---------- stavba scény ----------
const CATS = {
  telo: 'Tělo a kryty', lidar: 'Lidary', elektronika: 'Elektronika', baterie: 'Baterie', konektory: 'Konektory, anténa, libela', noha: 'Nohy s přísavkami',
};

// v1: díly nohy postupně od těla dolů (úroveň × krok)
const V1_FOOT_LEVEL = { valec: 1, valec_paska: 1.4, drzak: 2.6, priruba: 3.2, priruba_sroub: 3.4, pumpa: 3.8, pumpa_krouzek: 3.8, pumpa_pist: 4.2, prisavka: 5.2, prisavka_okraj: 5.4 };

function explodeOffset(ud, e) {
  if (!e) return [0, 0, 0];
  if (ud.ex) return ud.ex.map(x => x * e); // v2: posun daný přímo v CAD
  const n = ud.name;
  const foot = /^noha_(?:predni|zadni)_(\w+)$/.exec(n);
  if (foot && V1_FOOT_LEVEL[foot[1]] != null) return [0, -V1_FOOT_LEVEL[foot[1]] * 28 * e, 0];
  if (n.startsWith('cep_')) return [(ud.end ? 1 : -1) * 115 * e, 0, 0];
  if (/^(kryt_|okno_)/.test(n)) return [0, 95 * e, 0];
  if (ud.cat === 'lidar') return [0, 50 * e, 0];
  if (ud.cat === 'elektronika') return [0, 18 * e, 0];
  if (ud.cat === 'baterie') return [0, 34 * e, 0];
  if (ud.cat === 'noha') return [0, -80 * e, 0];
  if (n.startsWith('cep_') || ud.cat === 'konektory') return [(ud.end ? 1 : -1) * 70 * e, 0, 0];
  return [0, 0, 0];
}

// průhledný obrys verze při porovnání „přes sebe“
const ghostMats = new Map();
function ghostMat(vr) {
  if (!ghostMats.has(vr)) {
    const c = VARIANTS[vr].color;
    ghostMats.set(vr, {
      mesh: new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.6 }),
      edge: new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7 }),
    });
  }
  return ghostMats.get(vr);
}
function makeGhost(u, vr) {
  const gm = ghostMat(vr);
  u.traverse((n) => {
    if (n.isMesh && !n.userData.noExport) { n.material = gm.mesh; n.castShadow = false; n.receiveShadow = false; n.renderOrder = 5; }
    else if (n.isLineSegments && n.userData.edgeOf) n.material = gm.edge;
  });
}

function buildUnitGroup(role, vr = state.variant, ghost = false) {
  const u = new THREE.Group();
  u.name = vr === state.variant ? role : `${role}_${vr}`;
  const data = cadStore[vr].data;
  if (data) {
    const g = cadToGroup(data[role], { edges: state.edges || ghost, role });
    for (const m of g.children) {
      if (!m.isMesh) continue;
      const o = explodeOffset(m.userData, state.explode);
      m.position.set(...o);
      m.userData.edges?.position.set(...o);
      const vis = !state.hidden[m.userData.cat];
      m.visible = vis;
      if (m.userData.edges) m.userData.edges.visible = vis;
      if (!ghost) pickables.push(m);
    }
    u.add(g);
  } else if (vr === 'v1') {
    // zjednodušený náhled, dokud se nenačte CAD jádro
    u.add(buildUnit(PV.v1, role, { beams: false, labels: false }));
  } else {
    // v2 bez CAD: jen obrys těla
    const { total } = layout(PV.v2);
    const H = PV.v2.profil.vyska.v, W = PV.v2.profil.sirka.v;
    const b = new THREE.Mesh(new THREE.BoxGeometry(total, H, W), new THREE.MeshStandardMaterial({ color: '#9da2a8', roughness: 0.6 }));
    b.position.set(total / 2, H / 2, 0);
    u.add(b);
  }
  if (ghost) makeGhost(u, vr);
  withParams(PV[vr], () => addOverlays(u, role, vr, ghost));
  return u;
}

const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const beamCoreMat = new THREE.LineBasicMaterial({ color: 0xff453a, transparent: true, opacity: 0.85 });

function addOverlays(u, role, vr = state.variant, ghost = false) {
  if (ghost) {
    // obrys jiné verze: jen štítek v barvě verze
    if (!state.labels) return;
    const { total } = layout(P);
    const l = makeLabel(`${role === 'master' ? 'MASTER' : 'SLAVE'} · ${vr}`, { size: 0.9, tone: 'light', strong: true, color: VARIANTS[vr].color });
    l.position.set(total / 2, v('profil', 'vyska') + 115, 0);
    u.add(l);
    return;
  }
  const { parts, total } = layout(P);
  const H = v('profil', 'vyska');
  const W = v('profil', 'sirka');
  // na stole jen naznačit směr, na autě celý dosah
  const reach = state.scene === 'stul' ? Math.min(v('lidar', 'dosah'), 450) : v('lidar', 'dosah');
  const names = winNames(vr, role);
  const lift = 95 * state.explode;
  for (const p of parts) {
    const cx = p.x0 + p.len / 2;
    if (p.kind === 'window') {
      if (state.beams) {
        // TFmini Plus: zorné pole 3,6°
        const r = Math.tan(THREE.MathUtils.degToRad(1.8)) * reach;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, reach, 32, 1, true), beamMat);
        cone.rotation.x = Math.PI; // špička u lidaru
        const by = H + 50 * state.explode; // paprsek vychází z (posunutého) lidaru
        cone.position.set(cx, by + reach / 2, 0);
        cone.userData.noExport = true;
        const core = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cx, by, 0), new THREE.Vector3(cx, by + reach, 0)]), beamCoreMat);
        core.userData.noExport = true;
        u.add(cone, core);
      }
      if (state.labels && state.scene === 'stul') {
        const l = makeLabel(names[p.index], { size: 0.8 });
        l.position.set(cx, H + 28 + lift, W / 2 + 10);
        u.add(l);
      }
    } else if (p.kind === 'segment' && !p.edge && state.labels && state.scene === 'stul') {
      const l = makeLabel(p.name, { size: 0.7 });
      l.position.set(cx, H + 12 + lift, 0);
      u.add(l);
    }
  }
  if (state.labels) {
    const tag = state.compare ? ` · ${vr}` : '';
    const l = makeLabel((role === 'master' ? 'MASTER' : 'SLAVE') + tag, { size: 1.05, tone: 'dark', strong: true, color: state.compare ? VARIANTS[vr].color : null });
    l.position.set(total / 2, H + 75 + lift, 0);
    u.add(l);
  }
  if (state.dims && role === 'master' && vr === state.variant) {
    const fh = footHeight(P);
    u.add(makeDim([0, H, W / 2], [total, H, W / 2], [0, 0, 60], `${fmt(total)} mm`));
    u.add(makeDim([total, 0, -W / 2], [total, 0, W / 2], [70, 0, 0], `${fmt(W)} mm`));
    u.add(makeDim([0, -fh, W / 2], [0, H, W / 2], [-90, 0, 0], `${fmt(H + fh)} mm`));
    const [f0, f1] = feet(P);
    u.add(makeDim([f0.x, -fh, W / 2], [f1.x, -fh, W / 2], [0, 0, 160], `rozteč nohou ${fmt(f1.x - f0.x)} mm`));
  }
}

// bod u konektoru na čepu B (lokální souřadnice jednotky); side +1 = vlevo (4pin), -1 = vpravo (2pin)
const connPoint = (role, side = 1) => [
  layout(P).total + v('konektor', 'delka') + 4 + 70 * state.explode,
  v('konektor', `${role}_vyska`),
  side * v('konektor', `${role}_odsazeni`),
];

function rebuild(resetCamera = false, askCad = true) {
  scene.remove(content);
  disposeTree(content);
  content = new THREE.Group();
  scene.add(content);
  pickables.length = 0;
  selected = hovered = null;

  const vr = state.variant;
  const overlay = state.compareMode === 'overlay';
  const pairs = [[vr, buildUnitGroup('master', vr), buildUnitGroup('slave', vr)]];
  for (const id of compared()) pairs.push([id, buildUnitGroup('master', id, overlay), buildUnitGroup('slave', id, overlay)]);
  if (compared().length) ensureCompareCad();
  const [, master, slave] = pairs[0];
  const total = layout(P).total;
  const fh = footHeight(P);
  const H = v('profil', 'vyska');

  if (state.scene === 'auto') {
    ensureCarScene();
    const car = carScene.car;
    if (car) {
      car.scale.setScalar(v('scena', 'delka_auta'));
      car.updateMatrixWorld(true);
    } else {
      content.add(buildCar(v('scena', 'sirka_auta')));
    }
    if (!carScene.city) content.add(buildRoad());
  }
  pairs.forEach(([pv, m, sl], i) => placePair(pv, m, sl, overlay ? 0 : i));
  applyEnvironment();
  for (const [pv, m, sl] of pairs) {
    content.add(m, sl);
    content.updateMatrixWorld(true);
    // kabely má jen v1, v2 je bezdrátová
    if (state.cable && pv === 'v1' && !(overlay && pv !== vr)) withParams(PV.v1, () => addCables(m, sl));
  }

  setBodyOpacity(state.xray ? 0.22 : 1);
  setCadOpacity(state.xray ? 0.22 : 1);
  if (askCad && cad.key !== JSON.stringify(P)) requestCad();
  // šířka přes senzory: na skutečném voze z polohy jednotek, jinak z parametru
  let carW = v('scena', 'sirka_auta') + 2 * (fh + H);
  if (state.scene === 'auto' && carScene.car) {
    const partsBox = (u) => { const b = new THREE.Box3(); u.traverse((n) => { if (n.isMesh && n.userData.part) b.expandByObject(n); }); return b; };
    const bm = partsBox(master), bs = partsBox(slave);
    if (!bm.isEmpty() && !bs.isEmpty()) carW = bm.max.z - bs.min.z;
  }
  renderStats(total, fh, H, carW);
  fitShadow();
  if (resetCamera) frame();
  hideCard();
  requestRender();
}

/** Rozmístí pár jednotek. slot 0 = zvolená verze, slot 1 = druhá verze při porovnání. */
function placePair(vr, master, slave, slot) {
  withParams(PV[vr], () => {
    const total = layout(P).total;
    const fh = footHeight(P);
    if (state.scene === 'stul') {
      // při rozložení zvednout, aby nohy nezajely pod stůl; druhý pár stojí za prvním
      const lift = fh + 240 * state.explode;
      const dz = slot ? -1000 : 0;
      master.position.set(-total / 2, lift, 230 + dz);
      slave.position.set(-total / 2, lift, -230 + dz);
      return;
    }
    // Montáž svisle: čelo A nahoře, čelo B dole, okna ven, nohy na karoserii. Master vpravo (+Z), slave vlevo.
    // Zvolená verze na předních dveřích, porovnávaná na zadních.
    const car = carScene.car;
    const Wc = v('scena', 'sirka_auta');
    const y = v('scena', 'vyska_montaze');
    const px = v('scena', 'poloha_x') - (slot ? 1150 : 0);
    const down = new THREE.Vector3(0, -1, 0);
    for (const [u, s] of [[master, 1], [slave, -1]]) {
      if (car && mountOnCar(u, s, car, px)) continue;
      const out = new THREE.Vector3(0, 0, s);
      u.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(down, out, new THREE.Vector3().crossVectors(down, out)));
      u.position.set(px, y + total / 2, s * (Wc / 2 + fh));
    }
  });
}

function addCables(master, slave) {
  const w = (u, p) => u.localToWorld(new THREE.Vector3(...p)).toArray();
  const m1 = w(master, connPoint('master', 1)), s1 = w(slave, connPoint('slave', 1));
  const m2 = w(master, connPoint('master', -1));
  if (state.scene === 'stul') {
    // kabel master ↔ slave volně po stole, napájecí kabel pryč ze scény
    content.add(makeCable([m1, [m1[0] + 60, m1[1] - 10, m1[2]], [m1[0] + 140, 4, m1[2] - 40], [m1[0] + 170, 4, 0], [s1[0] + 140, 4, s1[2] + 40], [s1[0] + 60, s1[1] - 10, s1[2]], s1]));
    content.add(makeCable([m2, [m2[0] + 60, m2[1] - 10, m2[2]], [m2[0] + 150, 4, m2[2] + 70], [m2[0] + 320, 4, m2[2] + 150]]));
  } else {
    // konektory míří dolů: kabel ke slave pod prahem pod autem, napájení do dveří k zapalovači
    const lowY = 150;
    content.add(makeCable([m1, [m1[0], m1[1] - 90, m1[2]], [m1[0] - 20, lowY + 60, m1[2] - 50], [m1[0] - 30, lowY, m1[2] - 260], [s1[0] - 30, lowY, s1[2] + 260], [s1[0] - 20, lowY + 60, s1[2] + 50], [s1[0], s1[1] - 90, s1[2]], s1]));
    content.add(makeCable([m2, [m2[0], m2[1] - 90, m2[2]], [m2[0] + 120, m2[1] - 150, m2[2] - 20], [m2[0] + 420, m2[1] - 120, m2[2] - 60], [m2[0] + 520, m2[1] - 60, m2[2] - 260]]));
  }
}

function contentBox() {
  const box = new THREE.Box3();
  content.traverse((n) => {
    if ((n.isMesh && !n.userData.noExport) || n.userData.cable) box.expandByObject(n);
  });
  if (state.scene === 'auto' && carScene.car) box.expandByObject(carScene.car);
  return box;
}

function fitShadow() {
  const box = contentBox();
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2 + 200;
  const dir = state.scene === 'auto' && carScene.city ? SUN_DIR : new THREE.Vector3(0.5, 1.4, 0.7);
  sun.position.copy(c).add(dir.clone().setLength(r * 2));
  sun.target.position.copy(c);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -r; cam.right = cam.top = r;
  cam.near = 10; cam.far = r * 4;
  cam.updateProjectionMatrix();
  sun.shadow.needsUpdate = true;
}

// ---------- kamera ----------
const VIEWS = {
  iso: [0.5, 0.55, 0.68], top: [0.0001, 1, 0.001], side: [0, 0.12, 1], end: [-1, 0.25, 0.0001], front: [1, 0.25, 0.0001],
};
let tween = null;

function frame(dirKey = 'iso', target = null, animate = false) {
  const box = target || contentBox();
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const R = size.length() / 2;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const d = (R / Math.sin(Math.min(vfov, hfov) / 2)) * 0.82;
  const dir = new THREE.Vector3(...VIEWS[dirKey]).normalize();
  const pos = center.clone().addScaledVector(dir, d);
  if (!animate) {
    camera.position.copy(pos); controls.target.copy(center); controls.update(); requestRender();
    return;
  }
  tween = { t: 0, p0: camera.position.clone(), p1: pos, t0: controls.target.clone(), t1: center };
  requestRender();
}

function stepTween(dt) {
  if (!tween) return false;
  tween.t = Math.min(1, tween.t + dt / 0.55);
  const k = 1 - Math.pow(1 - tween.t, 3);
  camera.position.lerpVectors(tween.p0, tween.p1, k);
  controls.target.lerpVectors(tween.t0, tween.t1, k);
  if (tween.t >= 1) tween = null;
  return true;
}

// ---------- vykreslování na vyžádání ----------
let needsRender = true;
let last = performance.now();
const requestRender = () => { needsRender = true; };
controls.addEventListener('change', requestRender);
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const moving = stepTween(dt);
  const damp = controls.update();
  if (needsRender || moving || damp) {
    renderer.render(scene, camera);
    needsRender = false;
  }
});

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
new ResizeObserver(resize).observe(view);

// ---------- výběr dílů ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null, selected = null, downAt = null;
const card = $('#partCard');

function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables.filter(m => m.visible), false)[0];
  return hit ? hit.object : null;
}

const PRETTY = [
  [/^profil_hlinik$/, 'Hliníkový U profil'],
  [/^kryt_(\w)$/, 'Tištěný kryt $1'],
  [/^okno_(J\d)$/, 'Rámeček okna $1'],
  [/^lidar_(J\d)$/, 'Lidar $1 · TFmini Plus'],
  [/^lidar_(J\d)_cocka$/, 'Čočka lidaru $1'],
  [/^lidar_(J\d)_konektor$/, 'Konektor lidaru $1'],
  [/^cep_A$/, 'Koncový čep A'],
  [/^cep_B$/, 'Koncový čep B'],
  [/^deska_RICE$/, 'Deska RICE'],
  [/^konektor_(\d)pin_(\w+)$/, 'Kruhový konektor $1pin · $2'],
  [/^noha(\d)_(\w+)$/, 'Noha $1 · $2'],
  [/^vyvodka(_matice)?$/, 'Kabelová vývodka'],
  [/^kryt_horni_skorepina$/, 'Horní skořepina s okny'],
  [/^vana_spodni$/, 'Spodní vana'],
  [/^clanek_18650(_plus)?$/, 'Článek 18650'],
  [/^noha_(predni|zadni)_(\w+)$/, 'Noha $1 · $2'],
];
const prettyName = (n) => {
  for (const [re, s] of PRETTY) if (re.test(n)) return n.replace(re, s).replace(/_/g, ' ');
  return n.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
};

function showCard(mesh, pinned) {
  const bb = mesh.geometry.boundingBox;
  const s = bb.getSize(new THREE.Vector3());
  const ud = mesh.userData;
  card.innerHTML = `
    <div class="pc-role ${ud.role}">${ud.role}</div>
    <div class="pc-name">${prettyName(ud.name)}</div>
    <div class="pc-meta">${CATS[ud.cat] ?? ud.cat}</div>
    <div class="pc-dims"><span><b>${fmt(s.x)}</b>délka</span><span><b>${fmt(s.y)}</b>výška</span><span><b>${fmt(s.z)}</b>šířka</span></div>
    <div class="pc-hint">${pinned ? 'Dvojklik přiblíží · Esc zruší výběr' : 'Klik vybere díl'}</div>`;
  card.classList.add('on');
}
function hideCard() { card.classList.remove('on'); }

renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  const m = pick(e);
  if (m === hovered) return;
  if (hovered && hovered !== selected) setHighlight(hovered, false);
  hovered = m;
  if (m) { setHighlight(m, true); if (!selected) showCard(m, false); }
  else if (!selected) hideCard();
  renderer.domElement.style.cursor = m ? 'pointer' : '';
  requestRender();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
  const m = pick(e);
  if (selected && selected !== m) setHighlight(selected, false);
  selected = m;
  if (m) { setHighlight(m, true); showCard(m, true); } else hideCard();
  requestRender();
});
renderer.domElement.addEventListener('dblclick', (e) => {
  const m = pick(e);
  if (!m) return;
  const box = new THREE.Box3().setFromObject(m);
  box.expandByScalar(Math.max(15, box.getSize(new THREE.Vector3()).length() * 0.4));
  const dir = camera.position.clone().sub(controls.target).normalize();
  const key = 'iso';
  VIEWS._cur = dir.toArray();
  frame('_cur', box, true);
  void key;
});

// ---------- panel ----------
// souhrn verze pro porovnání (rozměry z parametrů, hmotnost z objemů CAD)
function summary(vr) {
  const Q = PV[vr];
  const mass = cadStore[vr].data?.master.mass;
  const b = Q.baterie;
  const wh = b ? b.pocet.v * b.kapacita.v * 3.6 / 1000 : 0;
  // 85 % využitelné energie (měnič 5 V, rezerva na stárnutí a zimu)
  const hours = (w) => (b && w ? wh * 0.85 / w : 0);
  return {
    total: layout(Q).total,
    height: Q.profil.vyska.v + footHeight(Q),
    section: `${fmt(Q.profil.sirka.v)} × ${fmt(Q.profil.vyska.v)}`,
    mass,
    wh,
    hMaster: hours(b?.odber_master?.v ?? b?.odber?.v),
    hSlave: hours(b?.odber_slave?.v ?? b?.odber?.v),
    need: b?.pozadovana_vydrz?.v ?? 0,
  };
}

function renderStats(total, fh, H, carW = lastCarW) {
  lastCarW = carW;
  const counts = { odhad: 0, zmereno: 0, koncept: 0 };
  for (const g of Object.keys(P)) if (!g.startsWith('_')) for (const k of Object.keys(P[g])) counts[P[g][k].stav]++;
  const meas = counts.zmereno + counts.odhad;
  const refs = (compared().length ? compared() : others(state.variant)).map(id => [id, summary(id)]);
  const cur = summary(state.variant);
  // pod hodnotou ostatní verze (zeleně, když je zvolená verze menší / lehčí)
  const cmp = (a, key, unit = 'mm', round = false) => refs.map(([id, r]) => (r[key]
    ? `<small class="${a < r[key] ? 'better' : ''}">${id}: ${fmt(round ? Math.round(r[key]) : r[key])} ${unit}</small>` : '')).join('');
  const h = (x, need) => `<i class="${need && x < need ? 'bad' : ''}">${fmt(x)} h</i>`;
  const power = cur.wh
    ? `<div class="stat"><b>${fmt(cur.wh)} Wh</b><span>výdrž ${h(cur.hMaster, cur.need)} / ${h(cur.hSlave, cur.need)} (master / slave)</span>${refs.map(([id, r]) => `<small>${id}: ${r.wh ? fmt(r.wh) + ' Wh' : 'napájení z vozu'}</small>`).join('')}</div>`
    : `<div class="stat"><b>12 V</b><span>napájení ze zapalovače</span>${refs.map(([id, r]) => `<small>${id}: ${r.wh ? `${fmt(r.wh)} Wh, ${fmt(r.hMaster)} h` : 'z vozu'}</small>`).join('')}</div>`;
  $('#stats').innerHTML = `
    <div class="stat"><b>${fmt(total)}</b><span>délka jednotky, mm</span>${cmp(total, 'total')}</div>
    <div class="stat"><b>${fmt(H + fh)}</b><span>výška s nohou, mm</span>${cmp(H + fh, 'height')}</div>
    <div class="stat"><b>${fmt(carW)}</b><span>šířka vozu se senzory, mm</span></div>
    <div class="stat"><b>${cur.section}</b><span>průřez těla, mm</span>${refs.map(([id, r]) => `<small>${id}: ${r.section}</small>`).join('')}</div>
    <div class="stat"><b>${cur.mass ? fmt(Math.round(cur.mass)) + ' g' : '…'}</b><span>hmotnost masteru (odhad z objemu)</span>${cur.mass ? cmp(cur.mass, 'mass', 'g', true) : ''}</div>
    ${power}`;
  $('#progress').innerHTML = `
    <div class="pg-top"><span>Změřeno</span><b>${counts.zmereno} z ${meas}</b></div>
    <div class="pg-bar"><i style="width:${meas ? (counts.zmereno / meas) * 100 : 0}%"></i></div>
    <div class="pg-legend"><span class="tag odhad">${counts.odhad} odhad</span><span class="tag zmereno">${counts.zmereno} změřeno</span><span class="tag koncept">${counts.koncept} koncept</span></div>`;
}

let lastCarW = 0;
const GROUP_LABEL = {
  baterie: 'Baterie',
  profil: 'Hliníkový profil', delky: 'Délky a okna', okno: 'Okno lidaru', lidar: 'Lidar',
  deska: 'Deska RICE', noha: 'Noha a přísavka', konektor: 'Konektor', libela: 'Libela', antena: 'Anténa', scena: 'Scéna na autě',
};
const openGroups = new Set(['profil', 'delky', 'noha']);

function renderParams() {
  const root = $('#params');
  const q = ($('#paramSearch').value || '').trim().toLowerCase();
  root.innerHTML = '';
  for (const g of Object.keys(P)) {
    if (g.startsWith('_')) continue;
    const keys = Object.keys(P[g]).filter(k => !q || `${GROUP_LABEL[g]} ${P[g][k].popis} ${k}`.toLowerCase().includes(q));
    if (!keys.length) continue;
    const det = document.createElement('details');
    det.open = q ? true : openGroups.has(g);
    det.addEventListener('toggle', () => { if (!q) det.open ? openGroups.add(g) : openGroups.delete(g); });
    const done = keys.filter(k => P[g][k].stav === 'zmereno').length;
    const label = state.variant === 'v2' ? ({ profil: 'Tělo (plast)', deska: 'Hlavní deska', noha: 'Kloubová noha a přísavka' }[g] ?? GROUP_LABEL[g]) : GROUP_LABEL[g];
    det.innerHTML = `<summary><span>${label ?? g}</span><em>${done}/${keys.length}</em></summary>`;
    for (const k of keys) det.appendChild(paramRow(g, k));
    root.appendChild(det);
  }
  if (!root.children.length) root.innerHTML = '<p class="empty">Nic neodpovídá hledání.</p>';
}

function paramRow(g, k) {
  const p = P[g][k];
  const def = defaults()[g][k].v;
  const ro = readonly();
  const row = document.createElement('div');
  const unit = k.includes('uhel') ? '°' : k === 'kapacita' ? 'mAh' : k === 'odber' ? 'W' : k === 'pocet' ? 'ks' : 'mm';
  const changed = () => row.classList.toggle('changed', p.v !== def);
  row.className = `row ${p.stav}${ro ? ' locked' : ''}`;
  row.innerHTML = `
    <label for="p-${g}-${k}" title="${g}.${k}">${p.popis || k}</label>
    <div class="inp"><input id="p-${g}-${k}" type="number" inputmode="decimal" step="${unit === '°' ? 1 : 0.5}" value="${p.v}" ${ro ? 'disabled' : ''} /><span>${unit}</span></div>
    <button class="undo" title="Vrátit výchozí ${def} ${unit}" aria-label="Vrátit výchozí hodnotu">↺</button>
    <div class="stav" role="group" aria-label="Stav hodnoty">${STAVY.map(s => `<button data-s="${s}" class="${s === p.stav ? 'on' : ''}" title="${STAV_LABEL[s]}">${STAV_LABEL[s]}</button>`).join('')}</div>`;
  const inp = row.querySelector('input');
  changed();
  inp.addEventListener('input', () => {
    const n = parseFloat(inp.value.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    p.v = n; changed(); saveParams(); rebuild();
  });
  row.querySelector('.undo').addEventListener('click', () => {
    p.v = def; inp.value = def; changed(); saveParams(); rebuild();
  });
  for (const b of row.querySelectorAll('.stav button')) {
    b.addEventListener('click', () => {
      if (ro) return;
      p.stav = b.dataset.s;
      row.className = `row ${p.stav}`; changed();
      row.querySelectorAll('.stav button').forEach(x => x.classList.toggle('on', x === b));
      saveParams(); renderStats(layout(P).total, footHeight(P), v('profil', 'vyska'));
    });
  }
  return row;
}

function renderPartsTab() {
  const root = $('#partsList');
  if (!cad.data) { root.innerHTML = '<p class="empty">Čekám na CAD model…</p>'; return; }
  const counts = {};
  for (const r of ['master', 'slave']) for (const p of cad.data[r].parts) counts[p.cat] = (counts[p.cat] || 0) + 1;
  root.innerHTML = Object.entries(CATS).filter(([c]) => counts[c]).map(([c, label]) => `
    <label class="cat">
      <input type="checkbox" data-cat="${c}" ${state.hidden[c] ? '' : 'checked'} />
      <span class="sw sw-${c}"></span><span class="cl">${label}</span><em>${counts[c] || 0}</em>
    </label>`).join('');
  root.querySelectorAll('[data-cat]').forEach((cb) => cb.addEventListener('change', () => {
    state.hidden[cb.dataset.cat] = !cb.checked; saveUi(); rebuild();
  }));
  // seznam dílů masteru (bez opakujících se šroubků)
  // seskupit podle čitelného názvu (např. vývodka = tělo + matice)
  const seen = new Map();
  for (const p of cad.data.master.parts) {
    const k = prettyName(p.name);
    const e = seen.get(k) || { names: new Set(), c: 0 };
    e.names.add(p.name); e.c++;
    seen.set(k, e);
  }
  $('#partsNames').innerHTML = [...seen].map(([k, e]) =>
    `<li data-names="${[...e.names].join(' ')}"><span>${k}</span>${e.c > 1 ? `<em>${e.c}×</em>` : ''}</li>`).join('');
  $('#partsNames').querySelectorAll('li').forEach((li) => {
    const names = new Set(li.dataset.names.split(' '));
    li.addEventListener('mouseenter', () => flashParts(names, true));
    li.addEventListener('mouseleave', () => flashParts(names, false));
    li.addEventListener('click', () => {
      const ms = pickables.filter(m => names.has(m.userData.name) && m.userData.role === 'master');
      if (!ms.length) return;
      const box = new THREE.Box3();
      ms.forEach(m => box.expandByObject(m));
      box.expandByScalar(Math.max(20, box.getSize(new THREE.Vector3()).length() * 0.5));
      VIEWS._cur = camera.position.clone().sub(controls.target).normalize().toArray();
      frame('_cur', box, true);
    });
  });
}
function flashParts(names, on) {
  for (const m of pickables) if (names.has(m.userData.name) && m !== selected) setHighlight(m, on);
  requestRender();
}

function renderPhotos() {
  let lastGroup = '';
  $('#photos').innerHTML = PHOTOS.map((p, i) => {
    const head = p.group !== lastGroup ? `<h4>${p.group}</h4>` : '';
    lastGroup = p.group;
    return `${head}<button class="ph" data-i="${i}" title="${p.caption}"><img src="${p.thumb}" alt="${p.caption}" loading="lazy" /><span>${p.caption}</span></button>`;
  }).join('');
  $('#photos').querySelectorAll('.ph').forEach(b => b.addEventListener('click', () => openLightbox(+b.dataset.i)));
}

// ---------- lightbox a připnutá fotka ----------
let lbIndex = 0;
const lb = $('#lightbox');
function openLightbox(i) {
  lbIndex = (i + PHOTOS.length) % PHOTOS.length;
  const p = PHOTOS[lbIndex];
  lb.querySelector('img').src = p.full;
  lb.querySelector('img').alt = p.caption;
  lb.querySelector('.lb-cap').innerHTML = `<b>${p.group}</b> ${p.caption}<small>${p.file}</small>`;
  lb.classList.add('on');
}
const closeLightbox = () => lb.classList.remove('on');
lb.querySelector('.lb-prev').addEventListener('click', () => openLightbox(lbIndex - 1));
lb.querySelector('.lb-next').addEventListener('click', () => openLightbox(lbIndex + 1));
lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
lb.querySelector('.lb-pin').addEventListener('click', () => {
  const p = PHOTOS[lbIndex];
  const pin = $('#pinned');
  pin.querySelector('img').src = p.full;
  pin.querySelector('span').textContent = p.caption;
  pin.classList.add('on');
  closeLightbox();
});
$('#pinned button').addEventListener('click', () => $('#pinned').classList.remove('on'));

// ---------- ovládání ----------
function renderVariantUi() {
  const vs = $('#variantSwitch');
  vs.innerHTML = VARIANT_IDS.map(id => `<button data-variant="${id}" style="--vc:${VARIANTS[id].color}" title="${VARIANTS[id].readonly ? 'Stávající zařízení (archiv, jen pro čtení)' : 'Návrh (koncept)'}">${VARIANTS[id].label}</button>`).join('');
  vs.querySelectorAll('[data-variant]').forEach((b) => b.addEventListener('click', () => {
    if (state.variant === b.dataset.variant) return;
    state.variant = b.dataset.variant;
    P = PV[state.variant];
    syncCad();
    saveUi(); syncControls(); renderParams(); renderPartsTab(); rebuild(true);
  }));
  const cb = $('#compareBar');
  cb.hidden = !state.compare;
  if (!state.compare) return;
  cb.innerHTML = `<span class="lbl">Porovnat s</span>${others(state.variant).map(id =>
    `<button class="chip ${state.shown[id] !== false ? 'on' : ''}" data-show="${id}" style="--vc:${VARIANTS[id].color}"><i></i>${id}</button>`).join('')}
    <span class="sep"></span>
    <button data-cmode="side" class="${state.compareMode !== 'overlay' ? 'on' : ''}">Vedle sebe</button>
    <button data-cmode="overlay" class="${state.compareMode === 'overlay' ? 'on' : ''}">Přes sebe</button>`;
  cb.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => {
    state.shown[b.dataset.show] = state.shown[b.dataset.show] === false;
    saveUi(); renderVariantUi(); rebuild();
  }));
  cb.querySelectorAll('[data-cmode]').forEach((b) => b.addEventListener('click', () => {
    state.compareMode = b.dataset.cmode; saveUi(); renderVariantUi(); rebuild(true);
  }));
}

function syncControls() {
  renderVariantUi();
  $$('[data-scene]').forEach(x => x.classList.toggle('on', x.dataset.scene === state.scene));
  $$('[data-variant]').forEach(x => x.classList.toggle('on', x.dataset.variant === state.variant));
  $('#archiveNote').hidden = !readonly();
  $('#reset').disabled = readonly();
  $('#importJson').disabled = readonly();
  $('#importJson').closest('label').classList.toggle('disabled', readonly());
  $$('[data-toggle]').forEach(b => b.setAttribute('aria-pressed', String(!!state[b.dataset.toggle])));
  $('#explode').value = state.explode;
  $$('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  $$('.tabpane').forEach(p => p.hidden = p.id !== `tab-${state.tab}`);
}

$$('[data-scene]').forEach((b) => b.addEventListener('click', () => {
  state.scene = b.dataset.scene; saveUi(); syncControls(); rebuild(true);
}));
$$('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.toggle; state[k] = !state[k]; saveUi(); syncControls(); rebuild();
}));
$('#explode').addEventListener('input', (e) => { state.explode = +e.target.value; saveUi(); rebuild(); });
$$('[data-view]').forEach((b) => b.addEventListener('click', () => frame(b.dataset.view, null, true)));
$$('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; saveUi(); syncControls(); }));
$('#paramSearch').addEventListener('input', renderParams);

function download(name, data, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#exportJson').addEventListener('click', () => download(`params-${state.variant}.json`, JSON.stringify(P, null, 2), 'application/json'));
$('#importJson').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (readonly()) return;
    P = PV[state.variant] = mergeParams(clone(defaults()), JSON.parse(await f.text()));
    saveParams(); renderParams(); rebuild(true);
    toast('Parametry nahrány');
  } catch (err) { toast('Neplatný JSON: ' + err.message, true); }
  e.target.value = '';
});
async function cadExport(btn, fn, role, ext, type) {
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Exportuji…';
  try {
    const name = `clearway-${state.variant}-${role}.${ext}`;
    download(name, await fn(clone(P), role, state.variant), type);
    toast(`Staženo ${name}`);
  } catch (err) { toast('Export selhal: ' + err.message, true); }
  finally { btn.disabled = false; btn.innerHTML = label; }
}
$$('[data-export]').forEach((btn) => {
  const [role, f] = btn.dataset.export.split(':');
  btn.addEventListener('click', () => f === 'step'
    ? cadExport(btn, cadStep, role, 'step', 'model/step')
    : cadExport(btn, cadStl, role, 'stl', 'model/stl'));
});
$('#shot').addEventListener('click', () => {
  renderer.render(scene, camera);
  renderer.domElement.toBlob((b) => { download(`clearway-${state.scene}.png`, b, 'image/png'); toast('Snímek uložen'); });
});
$('#reset').addEventListener('click', () => {
  if (readonly() || !confirm(`Vrátit všechny parametry ${state.variant} na výchozí hodnoty?`)) return;
  P = PV[state.variant] = clone(defaults()); saveParams(); renderParams(); rebuild(true);
  toast('Parametry vráceny na výchozí');
});

let toastTimer = 0;
function toast(text, err = false) {
  const t = $('#toast');
  t.textContent = text; t.className = `on${err ? ' err' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ''), 2600);
}

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'Escape') {
    if (lb.classList.contains('on')) return closeLightbox();
    if (selected) { setHighlight(selected, false); selected = null; hideCard(); requestRender(); }
    return;
  }
  if (lb.classList.contains('on')) {
    if (e.key === 'ArrowLeft') openLightbox(lbIndex - 1);
    if (e.key === 'ArrowRight') openLightbox(lbIndex + 1);
    return;
  }
  const map = { f: 'iso', 1: 'iso', 2: 'top', 3: 'side', 4: 'end' };
  if (map[e.key.toLowerCase()]) frame(map[e.key.toLowerCase()], null, true);
});

// ladění z konzole prohlížeče
window.__clearway = { scene, camera, controls, get content() { return content; }, get params() { return P; } };

syncControls();
renderParams();
renderPhotos();
renderPartsTab();
resize();
rebuild(true);
