import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Obecný osobní vůz (není to konkrétní model), jen jako měřítko a podklad pro montáž senzorů.
// Přední část míří do +X, šířka vozu podél Z, karoserie končí přesně na z = ±W/2.
export function buildCar(W) {
  const g = new THREE.Group();
  const L = 4500, wb = 2700, wr = 320, arch = 375;
  const fx = wb / 2, rx = -wb / 2;

  const body = new THREE.Shape();
  body.moveTo(-L / 2 + 40, 330);
  body.lineTo(rx - arch, 300);
  body.absarc(rx, wr, arch, Math.PI, 0, true);
  body.lineTo(fx - arch, 300);
  body.absarc(fx, wr, arch, Math.PI, 0, true);
  body.lineTo(L / 2 - 60, 320);
  body.quadraticCurveTo(L / 2 + 20, 420, L / 2, 640);
  body.quadraticCurveTo(L / 2 - 30, 820, L / 2 - 420, 900);
  body.lineTo(900, 1010);
  body.lineTo(-1900, 1030);
  body.quadraticCurveTo(-L / 2 + 30, 1010, -L / 2, 820);
  body.quadraticCurveTo(-L / 2 - 20, 500, -L / 2 + 40, 330);

  const bevel = 70;
  const extrude = (shape, width, b) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: width - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 5, curveSegments: 32,
    });
    geo.translate(0, 0, -(width - 2 * b) / 2);
    return geo;
  };

  const paint = new THREE.MeshPhysicalMaterial({ color: '#2c3e5c', metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const bodyMesh = new THREE.Mesh(extrude(body, W, bevel), paint);
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  g.add(bodyMesh);

  const green = new THREE.Shape();
  green.moveTo(880, 1000);
  green.quadraticCurveTo(450, 1300, 150, 1430);
  green.lineTo(-1250, 1450);
  green.quadraticCurveTo(-1750, 1380, -1950, 1020);
  green.lineTo(880, 1000);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#1b2633', metalness: 0.1, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.82 });
  const gh = new THREE.Mesh(extrude(green, W * 0.84, 60), glass);
  gh.castShadow = true;
  g.add(gh);
  // sloupky a střecha (lakované) přes sklo
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1350, 30, W * 0.82), paint);
  roof.position.set(-560, 1455, 0);
  g.add(roof);

  // kola: pneumatika, disk s paprsky, střed
  const tire = new THREE.MeshPhysicalMaterial({ color: '#141414', roughness: 0.9 });
  const rim = new THREE.MeshPhysicalMaterial({ color: '#c7cbd0', metalness: 1, roughness: 0.25 });
  const tireGeo = new THREE.TorusGeometry(wr - 70, 70, 20, 48);
  const tireCore = new THREE.CylinderGeometry(wr - 60, wr - 60, 200, 48);
  for (const x of [fx, rx]) for (const s of [-1, 1]) {
    const wheel = new THREE.Group();
    const t1 = new THREE.Mesh(tireGeo, tire); t1.scale.z = 1.45;
    const t2 = new THREE.Mesh(tireCore, tire); t2.rotation.x = Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(wr - 110, wr - 110, 12, 40), rim);
    disc.rotation.x = Math.PI / 2; disc.position.z = s * 98;
    wheel.add(t1, t2, disc);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(46, wr - 120, 14), rim);
      sp.position.set(0, (wr - 120) / 2, s * 104);
      const piv = new THREE.Group(); piv.rotation.z = (i / 5) * Math.PI * 2; piv.add(sp);
      wheel.add(piv);
    }
    wheel.position.set(x, wr, s * (W / 2 - 125));
    wheel.traverse((n) => { if (n.isMesh) { n.castShadow = true; } });
    g.add(wheel);
  }

  // světla
  const lightMat = new THREE.MeshPhysicalMaterial({ color: '#f4f6f8', emissive: '#c9d6ff', emissiveIntensity: 0.4, roughness: 0.1 });
  const rearMat = new THREE.MeshPhysicalMaterial({ color: '#8a1010', emissive: '#a01010', emissiveIntensity: 0.5, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(30, 90, 380), lightMat);
    hl.position.set(L / 2 - 120, 760, s * (W / 2 - 280)); hl.rotation.z = -0.5;
    const tl = new THREE.Mesh(new THREE.BoxGeometry(30, 110, 320), rearMat);
    tl.position.set(-L / 2 + 20, 900, s * (W / 2 - 260));
    g.add(hl, tl);
  }
  return g;
}

export function buildRoad() {
  // jízdní pruh 3,5 m: vůz uprostřed, vpravo plná krajní čára, vlevo přerušovaná osa
  const g = new THREE.Group();
  const asphalt = new THREE.MeshPhysicalMaterial({ color: '#45484d', roughness: 0.95 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(40000, 9000), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.z = -1500;
  road.receiveShadow = true;
  g.add(road);
  const paint = new THREE.MeshStandardMaterial({ color: '#ecebe4', roughness: 0.7 });
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(40000, 125), paint);
  edge.rotation.x = -Math.PI / 2; edge.position.set(0, 1, 1750);
  edge.receiveShadow = true;
  g.add(edge);
  for (let x = -20000; x < 20000; x += 9000) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(3000, 125), paint);
    dash.rotation.x = -Math.PI / 2; dash.position.set(x, 1, -1750);
    dash.receiveShadow = true;
    g.add(dash);
  }
  // silnice se nepočítá do rámování kamery
  g.traverse((n) => { n.userData.noExport = true; });
  return g;
}

// ---------- skutečný vůz z GLB (public/models/car.glb) ----------
// Model: 2025 Škoda Octavia RS Combi, autor tonielpro520 (Sketchfab), licence CC BY 4.0.

export const CAR_CREDIT = '2025 Škoda Octavia RS Combi – tonielpro520 (Sketchfab), CC BY 4.0';
// Natočení modelu, aby příď mířila do +X (doladit podle konkrétního souboru)
const CAR_YAW = 0;

let carPromise = null;
/** Načte vůz jednou; vrací skupinu s přídí do +X, koly na y = 0, středem v počátku, délkou 1 (jednotka). */
export function loadCar() {
  if (!carPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    carPromise = loader.loadAsync(`${import.meta.env.BASE_URL}models/car.glb`).then((gltf) => {
      const model = gltf.scene;
      model.rotation.y = CAR_YAW;
      model.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(model);
      let size = box.getSize(new THREE.Vector3());
      // delší vodorovná osa = podélná osa vozu
      if (size.z > size.x) { model.rotation.y += Math.PI / 2; model.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(model); size = box.getSize(new THREE.Vector3()); }
      const c = box.getCenter(new THREE.Vector3());
      const norm = new THREE.Group();
      model.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
      const s = 1 / size.x;
      const scaler = new THREE.Group();
      scaler.scale.setScalar(s);
      scaler.add(model);
      norm.add(scaler);
      model.traverse((n) => {
        if (!n.isMesh) return;
        n.castShadow = true; n.receiveShadow = true;
        n.userData.carBody = true;
        for (const m of [n.material].flat()) if (m && 'envMapIntensity' in m) m.envMapIntensity = 1;
      });
      norm.name = 'car';
      norm.userData.unitLength = true;
      return norm;
    });
  }
  return carPromise;
}
