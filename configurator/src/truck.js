import * as THREE from 'three';

// Obecný třínápravový popelářský vůz se zadním nakládáním (není to konkrétní značka ani livrej).
// Rozměry podle běžných vozů 26 t: délka 9,8 m, šířka 2,55 m, kabina 3,0 m, nástavba 3,5 m.
// Příď míří do +X, kola na y = 0, střed délky v počátku, šířka podél Z.
const L = 9800, W = 2550;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wheel(r, w, rimMat, tireMat, side) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 40), tireMat);
  tire.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, w + 8, 32), rimMat);
  rim.rotation.x = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.24, 40, 10), rimMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = side * (w / 2 + 14);
  g.add(tire, rim, hub);
  for (let i = 0; i < 10; i++) {
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 20, 6), rimMat);
    nut.rotation.x = Math.PI / 2;
    const a = (i / 10) * Math.PI * 2;
    nut.position.set(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, side * (w / 2 + 10));
    g.add(nut);
  }
  return g;
}

export function buildTruck() {
  const g = new THREE.Group();
  g.name = 'truck';
  const white = new THREE.MeshPhysicalMaterial({ color: '#eef0ef', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: '#dfe3e1', roughness: 0.45, metalness: 0.15, clearcoat: 0.4 });
  const orange = new THREE.MeshPhysicalMaterial({ color: '#f07f13', roughness: 0.4, clearcoat: 0.6 });
  const dark = new THREE.MeshPhysicalMaterial({ color: '#2b2d31', roughness: 0.7 });
  const chassis = new THREE.MeshPhysicalMaterial({ color: '#1d1e21', roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#16202b', roughness: 0.05, metalness: 0.2, clearcoat: 1 });
  const tireMat = new THREE.MeshPhysicalMaterial({ color: '#151515', roughness: 0.92 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: '#b9bec4', metalness: 1, roughness: 0.3 });
  const steel = new THREE.MeshPhysicalMaterial({ color: '#9ea4aa', metalness: 1, roughness: 0.35 });
  const amber = new THREE.MeshPhysicalMaterial({ color: '#ffae1a', emissive: '#ff9500', emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.92 });
  const lamp = new THREE.MeshPhysicalMaterial({ color: '#f4f6f8', emissive: '#c9d6ff', emissiveIntensity: 0.5, roughness: 0.1 });
  const chevron = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d42a1f';
    for (let x = -h; x < w + h; x += 64) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 32, h); c.lineTo(x + 32 + h, 0); c.lineTo(x + h, 0); c.fill(); }
  });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const xf = L / 2;                       // čelo kabiny

  // --- kabina: boční profil vytažený přes šířku, zaoblené hrany ---
  const cabL = 2050, cabTop = 2980, cabBot = 520;
  const prof = new THREE.Shape();
  prof.moveTo(xf - cabL, cabBot);
  prof.lineTo(xf - 20, cabBot);
  prof.lineTo(xf, cabBot + 300);
  prof.lineTo(xf, 2550);
  prof.quadraticCurveTo(xf - 10, cabTop, xf - 260, cabTop);
  prof.lineTo(xf - cabL, cabTop - 20);
  prof.lineTo(xf - cabL, cabBot);
  const bevel = 60;
  const cabGeo = new THREE.ExtrudeGeometry(prof, { depth: W - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 16 });
  cabGeo.translate(0, 0, -(W - 2 * bevel) / 2);
  add(cabGeo, white, 0, 0, 0);
  // čelní sklo, boční okna, dveře
  const ws = add(new THREE.PlaneGeometry(W - 300, 1050), glass, xf + 6, 2000, 0);
  ws.rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) {
    const sw = add(new THREE.PlaneGeometry(cabL - 600, 950), glass, xf - cabL / 2 + 120, 2050, s * (W / 2 + 4));
    if (s < 0) sw.rotation.y = Math.PI;
    add(new THREE.BoxGeometry(cabL - 520, 20, 12), dark, xf - cabL / 2 + 140, 1450, s * (W / 2 + 6)); // spára dveří
    add(new THREE.BoxGeometry(200, 26, 30), dark, xf - 520, 1300, s * (W / 2 + 14)); // klika
    // schody
    add(new THREE.BoxGeometry(700, 40, 240), chassis, xf - 760, 420, s * (W / 2 - 110));
    // zpětná zrcátka: rameno + hlava
    add(new THREE.BoxGeometry(40, 40, 330), dark, xf - 120, 2350, s * (W / 2 + 160));
    add(new THREE.BoxGeometry(110, 620, 240), dark, xf - 120, 2100, s * (W / 2 + 320));
    // oranžový pruh na kabině
    add(new THREE.BoxGeometry(cabL - 200, 120, 6), orange, xf - cabL / 2, 1180, s * (W / 2 + 3));
    // světlomety, blinkry
    add(new THREE.BoxGeometry(30, 160, 360), lamp, xf + 4, 800, s * (W / 2 - 330));
  }
  add(new THREE.BoxGeometry(260, 360, W - 40), chassis, xf + 40, 600, 0); // nárazník
  add(new THREE.BoxGeometry(20, 520, W - 700), dark, xf + 6, 1150, 0);    // maska chladiče
  // majáky na kabině (vzadu, aby nepřekážely rámu senzoru)
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(90, 100, 150, 20), amber, xf - cabL + 160, cabTop + 75, s * (W / 2 - 220));
    add(new THREE.CylinderGeometry(105, 105, 30, 20), dark, xf - cabL + 160, cabTop + 10, s * (W / 2 - 220));
  }

  // --- rám podvozku, nádrž, boční ochrany ---
  add(new THREE.BoxGeometry(L - 600, 300, 900), chassis, -150, 860, 0);
  add(new THREE.BoxGeometry(900, 520, 600), chassis, xf - 2700, 820, -(W / 2 - 330)); // nádrž
  add(new THREE.BoxGeometry(700, 520, 520), steel, xf - 2700, 820, W / 2 - 300);       // AdBlue / baterie
  for (const s of [-1, 1]) for (const y of [520, 760]) add(new THREE.BoxGeometry(2300, 50, 30), steel, -600, y, s * (W / 2 - 30));

  // --- nástavba (lisovací skříň) ---
  const bx0 = xf - cabL - 120, bx1 = -L / 2 + 1350, bTop = 3500, bBot = 1020;
  const bodyLen = bx0 - bx1;
  add(new THREE.BoxGeometry(bodyLen, bTop - bBot, W - 20), bodyMat, (bx0 + bx1) / 2, (bTop + bBot) / 2, 0);
  // svislá žebra
  for (let x = bx1 + 300; x < bx0 - 100; x += 600) for (const s of [-1, 1]) add(new THREE.BoxGeometry(80, bTop - bBot - 120, 40), bodyMat, x, (bTop + bBot) / 2, s * (W / 2 - 4));
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(bodyLen - 200, 260, 8), orange, (bx0 + bx1) / 2, 1500, s * (W / 2 - 4));
  }
  add(new THREE.BoxGeometry(bodyLen + 40, 80, W + 20), bodyMat, (bx0 + bx1) / 2, bTop + 20, 0);
  // zadní nakládací část: šikmá zadní stěna, násypka, šrafování
  const tail = new THREE.Shape();
  tail.moveTo(bx1, bBot - 150);
  tail.lineTo(bx1, bTop);
  tail.lineTo(bx1 - 650, bTop - 300);
  tail.lineTo(-L / 2, 1700);
  tail.lineTo(-L / 2, 700);
  tail.lineTo(bx1 - 300, bBot - 150);
  tail.lineTo(bx1, bBot - 150);
  const tailGeo = new THREE.ExtrudeGeometry(tail, { depth: W - 60, bevelEnabled: true, bevelThickness: 30, bevelSize: 24, bevelSegments: 2 });
  tailGeo.translate(0, 0, -(W - 60) / 2);
  add(tailGeo, bodyMat, 0, 0, 0);
  const rearPanel = add(new THREE.PlaneGeometry(W - 200, 900), new THREE.MeshStandardMaterial({ map: chevron, roughness: 0.6 }), -L / 2 - 32, 1150, 0);
  rearPanel.rotation.y = -Math.PI / 2;
  add(new THREE.BoxGeometry(60, 420, 1700), dark, -L / 2 - 20, 1250, 0); // násypka
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(60, 140, 140), new THREE.MeshPhysicalMaterial({ color: '#8a1010', emissive: '#a01010', emissiveIntensity: 0.6 }), -L / 2 - 30, 900, s * (W / 2 - 160));
    add(new THREE.BoxGeometry(300, 60, 400), steel, -L / 2 - 120, 560, s * (W / 2 - 420)); // stupačky
    add(new THREE.CylinderGeometry(25, 25, 1300, 10), steel, -L / 2 - 140, 1250, s * (W / 2 - 180));
  }

  // --- kola: přední náprava, zadní tandem (dvojmontáž) ---
  const r = 520, tw = 315;
  for (const [x, dual] of [[xf - 1400, false], [-L / 2 + 2900, true], [-L / 2 + 1550, true]]) {
    for (const s of [-1, 1]) {
      const z = s * (W / 2 - tw / 2 - 20);
      const wh = wheel(r, tw, rimMat, tireMat, s);
      wh.position.set(x, r, z);
      wh.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      g.add(wh);
      if (dual) { const w2 = wheel(r, tw, rimMat, tireMat, s); w2.position.set(x, r, z - s * (tw + 30)); g.add(w2); }
    }
    // podběhy
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(2 * r + 260, 40, 380), chassis, x, 2 * r + 80, s * (W / 2 - 190));
  }
  g.userData = { roofX: xf - cabL / 2 - 120, length: L, width: W, label: 'Popelářský vůz' };
  return g;
}

// ---------- skutečné modely z GLB (public/models) ----------
// Popelář: "GARBAGE TRUCK" od liebherr996litronic, dodávka: "2019 Mercedes-Benz Sprinter" od tonielpro520,
// obojí Sketchfab, CC BY 4.0 (úpravy viz public/models/*-LICENSE.txt).
export const TRUCK_CREDIT = 'Popelář: GARBAGE TRUCK – liebherr996litronic, dodávka: 2019 Mercedes-Benz Sprinter – tonielpro520 (Sketchfab), CC BY 4.0';

/**
 * Načte GLB, převede na mm (`scale`), natočí přídí do +X (`yaw`), postaví kola na y = 0
 * a vycentruje v X i Z. Vrací skupinu; userData.front = x přídě.
 */
async function loadNormalized(file, scale, yaw) {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}`);
  const model = gltf.scene;
  model.scale.setScalar(scale);
  model.rotation.y = yaw;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -box.min.y, -c.z);
  const g = new THREE.Group();
  g.add(model);
  model.traverse((n) => {
    if (!n.isMesh) return;
    n.castShadow = true; n.receiveShadow = true;
    for (const m of [n.material].flat()) if (m && 'envMapIntensity' in m) m.envMapIntensity = 1;
  });
  g.userData.front = box.max.x - c.x;
  g.userData.length = box.max.x - box.min.x;
  return g;
}

/** Popelářský vůz z GLB (v modelu metry, příď do +Z). Střed kabiny ~1,35 m za přídí. */
export async function loadTruck() {
  const g = await loadNormalized('truck.glb', 1000, Math.PI / 2);
  g.name = 'truck';
  g.userData = { ...g.userData, roofX: g.userData.front - 1350, width: 2550, label: 'Popelářský vůz' };
  return g;
}

/** Dodávka z GLB (v modelu palce). Natočení podle modelu, příď do +X. */
export async function loadVan() {
  const g = await loadNormalized('van.glb', 25.4, Math.PI / 2);
  g.name = 'van';
  return g;
}
