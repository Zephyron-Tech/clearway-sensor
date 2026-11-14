import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { makeLabel } from './overlay.js';

// Rychlé paprsky přes BVH (bez něj by průjezd ulicí znamenal desítky tisíc paprsků proti celému městu).
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ---------------------------------------------------------------------------------------------
// Ulice s překážkami. Vůz (měřicí) stojí v počátku, jede do +X, střed vozu z = 0.
// Silnice ve scéně Plzně: z = -4950 … 1550 (6,5 m). Vpravo za krajnicí parkovací pruh, vlevo
// auta podél chodníku, k tomu typická zúžení: auto ve dvojité řadě, kontejner, strom, značka.
// ---------------------------------------------------------------------------------------------

function vanMesh(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#1a232d', roughness: 0.05, clearcoat: 1 });
  const tire = new THREE.MeshPhysicalMaterial({ color: '#141414', roughness: 0.9 });
  const Lv = 5300, Wv = 2020, Hv = 2500;
  const prof = new THREE.Shape();
  prof.moveTo(-Lv / 2, 350); prof.lineTo(Lv / 2 - 150, 350); prof.lineTo(Lv / 2, 700);
  prof.lineTo(Lv / 2 - 250, 1250); prof.lineTo(Lv / 2 - 1100, Hv - 100); prof.lineTo(Lv / 2 - 1200, Hv);
  prof.lineTo(-Lv / 2, Hv); prof.lineTo(-Lv / 2, 350);
  const geo = new THREE.ExtrudeGeometry(prof, { depth: Wv - 80, bevelEnabled: true, bevelThickness: 40, bevelSize: 35, bevelSegments: 3 });
  geo.translate(0, 0, -(Wv - 80) / 2);
  const body = new THREE.Mesh(geo, paint);
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(Wv - 220, 900), glass);
  ws.position.set(Lv / 2 - 690, 1720, 0); ws.rotation.set(0, Math.PI / 2, -0.95);
  g.add(body, ws);
  for (const x of [Lv / 2 - 900, -Lv / 2 + 1000]) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(340, 340, 220, 28), tire);
    w.rotation.x = Math.PI / 2; w.position.set(x, 340, s * (Wv / 2 - 130));
    g.add(w);
  }
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return g;
}

function container() {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: '#4e5a52', roughness: 0.6, metalness: 0.4 });
  const lid = new THREE.MeshPhysicalMaterial({ color: '#3c4a40', roughness: 0.6, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1370, 1100, 1080), m);
  body.position.y = 1100 / 2 + 160;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(540, 540, 1370, 24, 1, false, 0, Math.PI), lid);
  top.rotation.z = Math.PI / 2; top.position.y = 1260;
  g.add(body, top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(80, 80, 50, 14), new THREE.MeshStandardMaterial({ color: '#1a1a1a' }));
    w.rotation.x = Math.PI / 2; w.position.set(sx * 560, 80, sz * 420);
    g.add(w);
  }
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return g;
}

function tree() {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: '#4d7a3a', roughness: 0.95, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(150, 220, 3600, 12), bark);
  trunk.position.y = 1800;
  // větev nad silnici (právě ta zužuje průjezd v horní části)
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(60, 110, 2600, 8), bark);
  branch.position.set(0, 3300, -1150); branch.rotation.x = -1.05;
  g.add(trunk, branch);
  const blobs = [[0, 5200, 0, 2300], [0, 4300, -1900, 1300], [900, 4700, -900, 1400], [-900, 4800, -700, 1300], [0, 3700, -2600, 900]];
  for (const [x, y, z, r] of blobs) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), leaf);
    s.position.set(x, y, z);
    g.add(s);
  }
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return g;
}

function sign() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.9, roughness: 0.35 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 2700, 12), steel);
  pole.position.y = 1350;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
  x.fillStyle = '#c8102e'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill();
  x.fillStyle = '#1f4fbf'; x.beginPath(); x.arc(64, 64, 44, 0, 7); x.fill();
  x.strokeStyle = '#c8102e'; x.lineWidth = 14; x.beginPath(); x.moveTo(30, 30); x.lineTo(98, 98); x.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.CircleGeometry(300, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  plate.position.set(-20, 2350, 0); plate.rotation.y = -Math.PI / 2;
  g.add(pole, plate);
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; } });
  return g;
}

/** Zaparkovaná auta a překážky. `car` a `vanModel` = načtené modely (klonují se), nebo null. */
export function buildStreet(car, vanModel = null) {
  const g = new THREE.Group();
  g.name = 'ulice';
  const carLen = 4709;
  const parked = (x, z, yaw = 0, dark = false) => {
    let c;
    if (car) {
      c = car.clone(true);
      c.scale.setScalar(carLen);
      c.visible = true;
      if (dark) c.traverse((n) => {
        if (!n.isMesh) return;
        n.material = [n.material].flat().map((m) => { const k = m.clone(); k.color = (k.color ?? new THREE.Color(1, 1, 1)).clone().multiplyScalar(0.18); return k; });
        if (n.material.length === 1) n.material = n.material[0];
      });
    } else {
      c = new THREE.Mesh(new THREE.BoxGeometry(carLen, 1450, 1830), new THREE.MeshStandardMaterial({ color: dark ? '#111' : '#8a8f96' }));
      c.position.y = 725;
    }
    c.position.x = x; c.position.z = z; c.rotation.y = yaw;
    g.add(c);
  };
  // vpravo: parkovací pruh za krajnicí (vnitřní hrana ~1,64 m od osy vozu)
  for (const [x, d] of [[-15500, false], [-10200, true], [-4900, false], [6800, false], [14600, true]]) parked(x, 2550, 0, d);
  // vlevo: auta u chodníku (vnitřní hrana ~3,0 m od osy vozu)
  for (const [x, d] of [[-16800, false], [-11600, false], [2200, true], [16200, false], [21400, false]]) parked(x, -4000, Math.PI, d);
  // zúžení 1: dodávka ve druhé řadě
  const van = vanModel ? vanModel.clone(true) : vanMesh('#d8dde2');
  van.position.set(9200, 0, -2250);
  if (vanModel) van.rotation.y = Math.PI; // stojí v protisměru jako auta vlevo
  g.add(van);
  // zúžení 2: kontejner vytlačený do silnice
  const ct = container();
  ct.position.set(-7800, 0, -2550);
  g.add(ct);
  // zúžení 3: strom s větví nad vozovkou
  const tr = tree();
  tr.position.set(21000, 0, 3300);
  g.add(tr);
  // značka těsně u krajnice
  const sg = sign();
  sg.position.set(11800, 0, 1720);
  g.add(sg);
  g.traverse((n) => { n.userData.noExport = true; n.userData.street = true; });
  return g;
}

// ---------------------------------------------------------------------------------------------
// Simulace průjezdu: boční skenery dělají příčné profily, z nich se počítá volná šířka.
// ---------------------------------------------------------------------------------------------

const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const prepared = new WeakSet();
function prepare(targets) {
  for (const root of targets) root.traverse((n) => {
    if (!n.isMesh || !n.geometry || prepared.has(n.geometry)) return;
    if (!n.geometry.boundsTree) n.geometry.computeBoundsTree();
    prepared.add(n.geometry);
  });
}

/**
 * @param o.scanners [{ origin: Vector3 (svět), side: +1 vpravo / -1 vlevo }]
 * @param o.lidar3d  { origin, up: Vector3 } nebo null
 * @param o.targets  objekty, do kterých paprsky narážejí
 * @param o.P        parametry v3
 * @returns { profiles, points, live, narrowest }
 */
export function simulate({ scanners, lidar3d, targets, P, x0, halfW = 915, vehH = 1500 }) {
  prepare(targets);
  // město se mohlo právě načíst a ještě se nevykreslilo: bez toho by zásahy byly v lokálních souřadnicích
  for (const t of targets) t.updateMatrixWorld(true);
  const v = (g, k) => P[g][k].v;
  const fov = v('skener', 'uhel_pole'), step = Math.max(0.25, v('skener', 'krok_uhlu')), reach = v('skener', 'dosah');
  const tilt = THREE.MathUtils.degToRad(v('skener', 'naklon'));
  const dx = (v('scena', 'rychlost') / 3.6) / v('skener', 'frekvence') * 1000;  // mm mezi profily
  const len = v('scena', 'delka_jizdy');
  const fw = v('hasici', 'sirka_vozu'), fm = v('hasici', 'sirka_zrcatka'), fhM = v('hasici', 'vyska_zrcatek'), fH = v('hasici', 'vyska_vozu'), rez = v('hasici', 'rezerva');
  ray.far = reach;
  const n = Math.max(2, Math.floor(len / dx));
  const xs0 = x0 - len * 0.4;
  const profiles = [];
  const pts = [];
  const dir = new THREE.Vector3();
  const o = new THREE.Vector3();
  const angles = [];
  for (let a = -fov / 2; a <= fov / 2 + 1e-6; a += step) angles.push(THREE.MathUtils.degToRad(a));
  const fanLen = Math.min(reach, 6000);   // délka paprsku bez zásahu ve vějíři
  for (let i = 0; i <= n; i++) {
    const shift = xs0 + i * dx - x0;
    let R = Infinity, L = -Infinity, RM = Infinity, LM = -Infinity, clear = Infinity;
    const p0 = pts.length / 3;
    const fans = [];
    for (const s of scanners) {
      o.copy(s.origin); o.x += shift;
      // vějíř pro animaci: počátek + konec každého paprsku
      const fan = new Float32Array((angles.length + 1) * 3);
      fan[0] = o.x; fan[1] = o.y; fan[2] = o.z;
      fans.push(fan);
      angles.forEach((a, k) => {
        // 0 = vodorovně ven, +90° = nahoru; rovina skenu nakloněná dopředu o `tilt`
        const c = Math.cos(a), sn = Math.sin(a);
        dir.set(Math.sin(tilt) * sn, Math.cos(tilt) * sn, s.side * c).normalize();
        ray.set(o, dir);
        const hit = ray.intersectObjects(targets, true)[0];
        const e = hit ? hit.point : o.clone().addScaledVector(dir, fanLen);
        fan[(k + 1) * 3] = e.x; fan[(k + 1) * 3 + 1] = e.y; fan[(k + 1) * 3 + 2] = e.z;
        if (!hit) return;
        const p = hit.point;
        pts.push(p.x, p.y, p.z);
        if (p.y < 150) return;                         // vozovka, obrubník
        // nad měřicím vozem (ten tudy projel, takže je to nad ním): větve, balkony, vedení
        if (Math.abs(p.z) < halfW + 100 && p.y > vehH) { clear = Math.min(clear, p.y); return; }
        if (p.y <= fH) { if (p.z > 0) R = Math.min(R, p.z); else L = Math.max(L, p.z); }
        if (Math.abs(p.y - fhM) <= 300) { if (p.z > 0) RM = Math.min(RM, p.z); else LM = Math.max(LM, p.z); }
      });
    }
    const width = Math.min(R, reach) - Math.max(L, -reach);
    const widthM = Math.min(RM, reach) - Math.max(LM, -reach);
    const low = clear < fH + 100;
    const fits = width >= fw + 2 * rez && widthM >= fm + 2 * rez && !low;
    const tight = width < fw + 2 * rez + 600 || clear < fH + 600;
    profiles.push({ x: x0 + shift, L: Math.max(L, -reach), R: Math.min(R, reach), width, widthM, clear, low, status: fits ? (tight ? 'tight' : 'ok') : 'bad',
      p0, p1: pts.length / 3, fans });
  }
  // živý pohled v poloze vozu: vějíře skenerů a mrak 3D lidaru
  const live = { fans: [], cloud: [] };
  for (const s of scanners) {
    const fan = new Float32Array((angles.length + 1) * 3);
    s.origin.toArray(fan, 0);
    angles.forEach((a, k) => {
      const c = Math.cos(a), sn = Math.sin(a);
      dir.set(Math.sin(tilt) * sn, Math.cos(tilt) * sn, s.side * c).normalize();
      ray.set(s.origin, dir);
      const hit = ray.intersectObjects(targets, true)[0];
      (hit ? hit.point : s.origin.clone().addScaledVector(dir, fanLen)).toArray(fan, (k + 1) * 3);
    });
    live.fans.push(fan);
  }
  if (lidar3d) {
    // Mid-360: 360° vodorovně, -7° až +52° svisle vůči vlastní ose
    const up = lidar3d.up.clone().normalize();
    const fwd = new THREE.Vector3(1, 0, 0).addScaledVector(up, -up.x).normalize();
    const side = new THREE.Vector3().crossVectors(fwd, up);
    ray.far = Math.min(v('lidar3d', 'dosah'), 30000);
    for (let az = 0; az < 360; az += 2) for (let el = -7; el <= 52; el += 3) {
      const A = THREE.MathUtils.degToRad(az), E = THREE.MathUtils.degToRad(el);
      dir.copy(fwd).multiplyScalar(Math.cos(E) * Math.cos(A)).addScaledVector(side, Math.cos(E) * Math.sin(A)).addScaledVector(up, Math.sin(E));
      ray.set(lidar3d.origin, dir);
      const hit = ray.intersectObjects(targets, true)[0];
      if (hit) live.cloud.push(hit.point.x, hit.point.y, hit.point.z);
    }
  }
  const narrowest = profiles.reduce((a, b) => (b.width < a.width ? b : a), profiles[0]);
  const lowest = profiles.reduce((a, b) => (b.clear < a.clear ? b : a), profiles[0]);
  return { profiles, points: new Float32Array(pts), live, narrowest, lowest: lowest.clear < fH + 600 ? lowest : null, dx, x0 };
}

// barva bodu podle výšky: modrá (zem) → zelená → žlutá → červená (4 m)
function heightColor(y, c) {
  const t = THREE.MathUtils.clamp(y / 4000, 0, 1);
  c.setHSL(0.66 - 0.66 * t, 0.85, 0.52);
  return c;
}

const STATUS_COLOR = { ok: new THREE.Color('#22c55e'), tight: new THREE.Color('#f59e0b'), bad: new THREE.Color('#ef4444') };
const fmtM = (mm) => (mm / 1000).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Vykreslí výsledek simulace do skupiny (světové souřadnice).
 * g.userData.setProgress(i) ukáže jen prvních i profilů a vějíře v profilu i - 1 (animace jízdy);
 * setProgress(null) ukáže celý výsledek a vějíře v poloze vozu.
 */
export function drawScan(res, P, { labels = true } = {}) {
  const v = (g, k) => P[g][k].v;
  const g = new THREE.Group();
  g.name = 'scan';
  const mark = (o) => { o.userData.noExport = true; o.raycast = () => {}; return o; };
  const reveal = [];   // (i) => void, volá se při změně postupu
  // mrak bodů z průjezdu
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(res.points, 3));
    const col = new Float32Array(res.points.length);
    const c = new THREE.Color();
    for (let i = 0; i < res.points.length; i += 3) { heightColor(res.points[i + 1], c); col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(mark(new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }))));
    reveal.push((i) => geo.setDrawRange(0, i == null ? Infinity : (i ? res.profiles[i - 1].p1 : 0)));
  }
  // koridor na vozovce: pás mezi levou a pravou hranicí, barva podle průjezdnosti
  {
    const pos = [], col = [];
    const half = res.dx / 2;
    for (const p of res.profiles) {
      const L = Math.max(p.L, -7000), R = Math.min(p.R, 7000);
      const c = STATUS_COLOR[p.status];
      const q = [[p.x - half, L], [p.x + half, L], [p.x + half, R], [p.x - half, L], [p.x + half, R], [p.x - half, R]];
      for (const [x, z] of q) { pos.push(x, 22, z); col.push(c.r, c.g, c.b); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.add(mark(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide }))));
    reveal.push((i) => geo.setDrawRange(0, i == null ? Infinity : i * 6));
    // hrany koridoru
    const edge = (key) => new THREE.BufferGeometry().setFromPoints(res.profiles.map(p => new THREE.Vector3(p.x, 26, THREE.MathUtils.clamp(p[key], -7000, 7000))));
    const em = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const eL = edge('L'), eR = edge('R');
    g.add(mark(new THREE.Line(eL, em)), mark(new THREE.Line(eR, em)));
    reveal.push((i) => { for (const e of [eL, eR]) e.setDrawRange(0, i == null ? Infinity : i); });
  }
  // vějíře skenerů v poloze vozu
  const fanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const fanLine = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.9 });
  // vějíř = trojúhelníky z počátku (vrchol 0) ke koncům paprsků; při animaci se jen přepisují souřadnice
  res.live.fans.forEach((home, k) => {
    const nv = home.length / 3;
    const attr = new THREE.BufferAttribute(home.slice(), 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    const idx = [];
    for (let i = 1; i < nv - 1; i++) idx.push(0, i, i + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', attr);
    geo.setIndex(idx);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', attr);
    lg.setDrawRange(1, nv - 1);
    const mesh = mark(new THREE.Mesh(geo, fanMat)), line = mark(new THREE.Line(lg, fanLine));
    mesh.frustumCulled = line.frustumCulled = false;
    g.add(mesh, line);
    reveal.push((i) => {
      const src = i == null ? home : res.profiles[Math.max(0, i - 1)].fans[k];
      if (!src) return;
      attr.array.set(src);
      attr.needsUpdate = true;
    });
  });
  if (res.live.cloud.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(res.live.cloud, 3));
    const cloud = mark(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe879f9, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false })));
    g.add(cloud);
    // mrak 3D lidaru platí jen pro polohu vozu na začátku, při jízdě se skryje
    reveal.push((i) => { cloud.visible = i == null; });
  }
  // nejužší místo: obrys cisterny a popisek
  const nw = res.narrowest;
  const after = (p, objs) => {
    const idx = res.profiles.indexOf(p);
    reveal.push((i) => { for (const o of objs) o.visible = i == null || i > idx; });
  };
  if (nw) {
    const n0 = g.children.length;
    const fw = v('hasici', 'sirka_vozu'), fm = v('hasici', 'sirka_zrcatka'), fH = v('hasici', 'vyska_vozu'), fhM = v('hasici', 'vyska_zrcatek');
    const zc = (Math.max(nw.L, -7000) + Math.min(nw.R, 7000)) / 2;
    const ok = nw.status !== 'bad';
    const col = ok ? (nw.status === 'tight' ? 0xf59e0b : 0x22c55e) : 0xef4444;
    const z = (d) => zc + d;
    const prof = [[0, -fw / 2], [fhM - 250, -fw / 2], [fhM - 250, -fm / 2], [fhM + 250, -fm / 2], [fhM + 250, -fw / 2], [fH, -fw / 2],
      [fH, fw / 2], [fhM + 250, fw / 2], [fhM + 250, fm / 2], [fhM - 250, fm / 2], [fhM - 250, fw / 2], [0, fw / 2]];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(prof.map(([y, d]) => new THREE.Vector3(nw.x, Math.max(y, 30), z(d)))),
      new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true }));
    line.renderOrder = 25;
    g.add(mark(line));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(fw, fH), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    fill.rotation.y = Math.PI / 2; fill.position.set(nw.x, fH / 2, zc);
    g.add(mark(fill));
    // hranice vlevo a vpravo v nejužším místě
    const bm = new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true });
    for (const zb of [nw.L, nw.R]) {
      if (Math.abs(zb) >= 7000) continue;
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(nw.x, 0, zb), new THREE.Vector3(nw.x, fH + 300, zb)]), bm);
      l.renderOrder = 25;
      g.add(mark(l));
    }
    if (labels) {
      const txt = `nejužší místo ${fmtM(nw.width)} m · ${nw.status === 'bad' ? 'cisterna neprojede' : nw.status === 'tight' ? 'těsně' : 'projede'}`;
      const lb = makeLabel(txt, { size: 1, strong: true, color: ok ? (nw.status === 'tight' ? '#b45309' : '#15803d') : '#b91c1c' });
      lb.position.set(nw.x, fH + 700, zc);
      g.add(lb);
    }
    after(nw, g.children.slice(n0));
  }
  const lw = res.lowest;
  if (lw && labels) {
    const bad = lw.low;
    const lb = makeLabel(`podjezdná výška ${fmtM(lw.clear)} m · ${bad ? 'větev / překážka nad silnicí' : 'těsně'}`, { size: 0.95, strong: true, color: bad ? '#b91c1c' : '#b45309' });
    lb.position.set(lw.x, Math.min(lw.clear, 6000) + 500, 0);
    g.add(lb);
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(lw.x, 0, 0), new THREE.Vector3(lw.x, Math.min(lw.clear, 8000), 0)]),
      new THREE.LineDashedMaterial({ color: bad ? 0xef4444 : 0xf59e0b, dashSize: 120, gapSize: 80, depthTest: false, transparent: true }));
    l.computeLineDistances();
    l.renderOrder = 25;
    g.add(mark(l));
    after(lw, [lb, l]);
  }
  g.userData.setProgress = (i) => { for (const f of reveal) f(i); };
  g.userData.res = res;
  return g;
}
