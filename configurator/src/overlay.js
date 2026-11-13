import * as THREE from 'three';

// Popisek s konstantní velikostí na obrazovce (nezávisí na zoomu)
export function makeLabel(text, { size = 1, tone = 'light', strong = false, color = null } = {}) {
  const px = 44;
  const font = `${strong ? 650 : 560} ${px}px Inter, system-ui, -apple-system, sans-serif`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  const h = px + 26;
  c.width = w; c.height = h;
  ctx.font = font;
  const dark = tone === 'dark';
  ctx.fillStyle = color || (dark ? 'rgba(18,20,24,0.88)' : 'rgba(255,255,255,0.94)');
  ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, h / 2 - 1); ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(20,24,30,0.14)';
  ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = dark || color ? '#fff' : '#1a1d23';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true }));
  const k = 0.021 * size;
  s.scale.set(k * (w / h), k, 1);
  s.renderOrder = 20;
  s.userData = { isLabel: true, noExport: true };
  return s;
}

const dimMat = new THREE.LineBasicMaterial({ color: 0x2f7cf6, depthTest: false, transparent: true });

// Kóta mezi body a, b (lokální souřadnice), s vynášecími čarami ve směru `ext`
export function makeDim(a, b, ext, text) {
  const g = new THREE.Group();
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), E = new THREE.Vector3(...ext);
  const off = E.clone().setLength(E.length());
  const A2 = A.clone().add(off), B2 = B.clone().add(off);
  const tick = E.clone().setLength(8);
  const pts = [
    A, A2.clone().add(tick), B, B2.clone().add(tick), // vynášecí čáry
    A2, B2,                                             // kótovací čára
  ];
  // šipky
  const dir = B2.clone().sub(A2).normalize();
  const side = new THREE.Vector3().crossVectors(dir, E).normalize();
  const n = E.clone().normalize();
  for (const [P, d] of [[A2, dir], [B2, dir.clone().negate()]]) {
    for (const s of [-1, 1]) {
      pts.push(P, P.clone().addScaledVector(d, 9).addScaledVector(n, s * 3.5));
    }
  }
  void side;
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const lines = new THREE.LineSegments(geo, dimMat);
  lines.renderOrder = 15;
  lines.userData.noExport = true;
  g.add(lines);
  const lbl = makeLabel(text, { size: 0.85, tone: 'dark' });
  lbl.position.copy(A2.clone().add(B2).multiplyScalar(0.5));
  g.add(lbl);
  g.userData.noExport = true;
  return g;
}

const cableMat = new THREE.MeshPhysicalMaterial({ color: '#16171a', roughness: 0.55, clearcoat: 0.3 });

export function makeCable(points, radius = 3.2) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal', 0.5);
  const geo = new THREE.TubeGeometry(curve, Math.max(64, points.length * 24), radius, 10, false);
  const m = new THREE.Mesh(geo, cableMat);
  m.castShadow = true;
  m.userData = { noExport: true, cable: true };
  return m;
}
