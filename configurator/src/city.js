import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Centrum Plzně (nám. Republiky) z OpenStreetMap, data © přispěvatelé OpenStreetMap (ODbL).
// Vstup v mm: x = východ, y = sever. Ve scéně: východ = +X, sever = -Z, nahoru = +Y.
// Vše je jen kulisa (noExport), nepočítá se do rámování kamery ani do stínu.

const ROAD_W = { primary: 9000, primary_link: 6500, tertiary: 7500, residential: 6500, living_street: 5000 };
const PLASTER = ['#efe6d2', '#e8d7b5', '#dcc9a6', '#f1ece2', '#d9c4a0', '#e9dcc8', '#cfd6cf', '#e6d0c0', '#d8cdb8', '#f0e2bf', '#c9b79c', '#e4e0d6'];

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(...repeat);
  return t;
}

// Jedno okenní pole fasády (3,4 × 3,3 m): omítka, okno s ostěním a parapetem
const facadeTex = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, h - 10, w, 10); // kordonová římsa
  g.fillStyle = '#d9d4ca'; g.fillRect(36, 22, 56, 78);            // šambrána
  g.fillStyle = '#2b333d'; g.fillRect(42, 28, 44, 66);            // sklo
  g.fillStyle = '#56606b'; g.fillRect(42, 28, 44, 18);            // odlesk nahoře
  g.fillStyle = '#e9e4da'; g.fillRect(62, 28, 4, 66); g.fillRect(42, 50, 44, 3); // příčle
  g.fillStyle = '#cfc8ba'; g.fillRect(32, 100, 64, 6);            // parapet
}, [1 / 3400, 1 / 3300]);

const stoneTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b9b2a5'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -20 : 0; x < w; x += 40) {
    const l = 160 + Math.random() * 40 | 0;
    g.fillStyle = `rgb(${l},${l - 6},${l - 16})`; g.fillRect(x + 1, y + 1, 38, 14);
  }
}, [1 / 4000, 1 / 1600]);

// Žulová kostka (dlažba náměstí a chodníků)
const cobbleTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5d5a55'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) {
    const l = 120 + Math.random() * 45 | 0;
    g.fillStyle = `rgb(${l},${l - 3},${l - 8})`;
    g.beginPath(); g.roundRect(x + 1.2, y + 1.2, 13.6, 13.6, 3); g.fill();
  }
}, [1 / 1600, 1 / 1600]);

const asphaltTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3d3f43'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) {
    const l = 45 + Math.random() * 40 | 0;
    g.fillStyle = `rgba(${l},${l},${l + 3},0.55)`; g.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
  }
}, [1 / 2500, 1 / 2500]);

// ExtrudeGeometry má skupiny 0 = podstavy (střecha), 1 = stěny; rozdělit na dvě geometrie
function splitGroups(geo) {
  const out = [];
  for (const gr of geo.groups) {
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) {
      g.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(gr.start * attr.itemSize, (gr.start + gr.count) * attr.itemSize), attr.itemSize));
    }
    out[gr.materialIndex] = g;
  }
  return out;
}

function tint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

function shapeOf(ring) {
  const s = new THREE.Shape();
  ring.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}

function extrudeRing(ring, h, min) {
  const geo = new THREE.ExtrudeGeometry(shapeOf(ring), { depth: Math.max(h - min, 500), bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // tvar (x, sever) -> (x, -z), výška do +Y
  geo.translate(0, min, 0);
  return geo;
}

const rand = (seed) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };
const isChurch = (b) => /church|cathedral|chapel/.test(b.kind || '') || /svat|kostel|kaple|Bartolom/i.test(b.name || '');

// Pás (silnice / kolejnice) podél lomené čáry, ležící na zemi ve výšce y
function strip(pts, width, y) {
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L * width / 2, nz = dx / L * width / 2;
    pos.push(x0 + nx, y, z0 + nz, x1 + nx, y, z1 + nz, x0 - nx, y, z0 - nz, x0 - nx, y, z0 - nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
function joints(pts, r, y) {
  return pts.map(([x, z]) => {
    const c = new THREE.CircleGeometry(r, 16).toNonIndexed();
    c.deleteAttribute('normal'); c.deleteAttribute('uv');
    c.rotateX(-Math.PI / 2); c.translate(x, y, z);
    return c;
  });
}
// planární UV podle světových souřadnic (pro opakované textury)
function worldUV(geo) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Najde rovný úsek ulice kolem náměstí, kde bude stát vůz: { mid: [x, z], dir: úhel } ve scéně. */
export function parkingSpot(data) {
  let best = null;
  for (const r of data.roads) {
    if (r.name !== 'náměstí Republiky' || r.type !== 'residential') continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [x0, y0] = r.p[i], [x1, y1] = r.p[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (!best || L > best.L) best = { L, a: [x0, -y0], b: [x1, -y1] };
    }
  }
  if (!best) return { mid: [0, 0], angle: 0 };
  // jet tak, aby vůz mířil na východ (stabilní pohled), osa ulice -> +X
  let [a, b] = [best.a, best.b];
  if (b[0] < a[0]) [a, b] = [b, a];
  return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

/**
 * Postaví město. Vrací skupinu natočenou a posunutou tak, že vybraný úsek ulice leží
 * podél osy X a vůz (na počátku) stojí v pravém pruhu.
 */
export function buildCity(data, { laneOffset = 1700 } = {}) {
  const root = new THREE.Group();
  root.name = 'plzen';
  const inner = new THREE.Group();
  root.add(inner);

  // --- budovy (sloučené podle materiálu) ---
  const walls = [], roofs = [], stoneWalls = [], stoneRoofs = [], spires = [];
  const all = [...data.buildings.map(b => ({ ...b, part: false })), ...data.parts.map(b => ({ ...b, part: true }))];
  all.forEach((b, i) => {
    if (b.p.length < 4) return;
    let geo;
    try { geo = extrudeRing(b.p, b.h, b.min || 0); } catch { return; }
    const [caps, sides] = splitGroups(geo);
    geo.dispose();
    if (!caps || !sides) return;
    const church = isChurch(b) || (b.part && b.h >= 20000);
    if (church) {
      stoneWalls.push(tint(sides, '#ffffff'));
      stoneRoofs.push(tint(caps, '#4f5650'));
    } else {
      walls.push(tint(sides, PLASTER[Math.floor(rand(i + 1) * PLASTER.length)]));
      roofs.push(tint(caps, new THREE.Color('#8f4f3a').offsetHSL(0, 0, (rand(i + 7) - 0.5) * 0.12)));
    }
    // věž katedrály sv. Bartoloměje (102,3 m): jehlan nad nejvyššími částmi
    if (b.part && b.h >= 50000) {
      let cx = 0, cy = 0, r = 0;
      for (const [x, y] of b.p) { cx += x; cy += y; }
      cx /= b.p.length; cy /= b.p.length;
      for (const [x, y] of b.p) r = Math.max(r, Math.hypot(x - cx, y - cy));
      spires.push({ cx, cz: -cy, r, base: b.h });
    }
  });

  const facade = facadeTex();
  const wallMat = new THREE.MeshStandardMaterial({ map: facade, vertexColors: true, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex(), vertexColors: true, roughness: 0.95 });
  const addMerged = (list, mat) => {
    if (!list.length) return;
    const m = new THREE.Mesh(mergeGeometries(list), mat);
    m.receiveShadow = true;
    inner.add(m);
    list.forEach(g => g.dispose());
  };
  addMerged(walls, wallMat);
  addMerged(roofs, roofMat);
  addMerged(stoneWalls, stoneMat);
  addMerged(stoneRoofs, roofMat);

  // jedna společná věž: nejvyšší části dohromady, jehlan do 102,3 m
  if (spires.length) {
    const s = spires.reduce((a, b) => ({ cx: a.cx + b.cx, cz: a.cz + b.cz, r: Math.max(a.r, b.r), base: Math.max(a.base, b.base) }));
    s.cx /= spires.length; s.cz /= spires.length;
    const h = 102300 - s.base;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(s.r * 0.75, h, 8), new THREE.MeshStandardMaterial({ color: '#3f5a52', roughness: 0.6, metalness: 0.3 }));
    cone.position.set(s.cx, s.base + h / 2, s.cz);
    inner.add(cone);
  }

  // --- zem: dlažba všude, asfalt na silnicích, koleje tramvaje ---
  // UV dlažby podle světa (CircleGeometry leží v XY, po otočení X -> X, Y -> -Z)
  const groundGeo = new THREE.CircleGeometry(900000, 64);
  {
    const p = groundGeo.attributes.position, uv = groundGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i));
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: cobbleTex(), roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  inner.add(ground);

  const roadGeos = [];
  for (const r of data.roads) {
    const w = ROAD_W[r.type];
    if (!w || r.area) continue;
    const pts = r.p.map(([x, y]) => [x, -y]);
    roadGeos.push(strip(pts, w, 4), ...joints(pts, w / 2, 4));
  }
  if (roadGeos.length) {
    const g = worldUV(mergeGeometries(roadGeos));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.88 }));
    m.receiveShadow = true;
    inner.add(m);
  }

  // koleje: dvě kolejnice (rozchod 1435 mm) se žlábkem
  const railGeos = [], grooveGeos = [];
  for (const t of data.trams) {
    const pts = t.map(([x, y]) => [x, -y]);
    for (const s of [-1, 1]) {
      const off = offsetLine(pts, s * 1435 / 2);
      railGeos.push(strip(off, 70, 9));
      grooveGeos.push(strip(offsetLine(pts, s * (1435 / 2 + 60)), 45, 8));
    }
    grooveGeos.push(strip(pts, 2600, 6)); // pás tramvajového tělesa
  }
  if (railGeos.length) {
    const rg = mergeGeometries(railGeos); rg.computeVertexNormals();
    inner.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: '#b7bcc2', metalness: 1, roughness: 0.3 })));
    const gm = new THREE.Mesh(worldUV(mergeGeometries(grooveGeos)), new THREE.MeshStandardMaterial({ color: '#4a4b4e', roughness: 0.8 }));
    gm.receiveShadow = true;
    inner.add(gm);
  }

  // natočit tak, aby místo vozu leželo na ose X a vůz stál v pravém pruhu
  const spot = parkingSpot(data);
  inner.position.set(-spot.mid[0], 0, -spot.mid[1]);
  root.rotation.y = spot.angle;
  root.position.z = -laneOffset;
  root.traverse((n) => { n.userData.noExport = true; n.userData.city = true; });
  return root;
}

function offsetLine(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    return [p[0] - dz / L * d, p[1] + dx / L * d];
  });
}
