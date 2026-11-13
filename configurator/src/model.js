import * as THREE from 'three';
import { WIN_NAMES } from './names.js';
import { layout, feet, footHeight } from './geometry.js';

export { layout, footHeight };

// Lokální souřadnice jednotky:
//   X podél těla (0 = konec s anténou u masteru),
//   Y kolmo k oknům lidarů (směr měření), spodek těla je y = 0, nohy jdou do -Y,
//   Z napříč šířkou profilu.

const MAT = {
  alu: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.7, roughness: 0.35 }),
  print: new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.85 }),
  printDark: new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.85 }),
  cap: new THREE.MeshStandardMaterial({ color: 0x5b5e63, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0.2, roughness: 0.1 }),
  lidar: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.6 }),
  pcb: new THREE.MeshStandardMaterial({ color: 0x1f4d2b, roughness: 0.6 }),
  esp: new THREE.MeshStandardMaterial({ color: 0xb8b8b0, metalness: 0.8, roughness: 0.3 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.9, roughness: 0.3 }),
  black: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.7 }),
  white: new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf2d22e, roughness: 0.6 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x1f5fd1, roughness: 0.5 }),
  level: new THREE.MeshStandardMaterial({ color: 0xd8e84a, emissive: 0x2a3000, roughness: 0.2 }),
  beam: new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.35, depthWrite: false }),
};

export function setBodyOpacity(opacity) {
  for (const m of [MAT.alu, MAT.print, MAT.printDark, MAT.cap]) {
    m.transparent = opacity < 1;
    m.opacity = opacity;
    m.depthWrite = opacity >= 1;
    m.needsUpdate = true;
  }
}

const v = (P, g, k) => P[g][k].v;

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rt, rb, h, mat, seg = 40) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

function label(text, size = 14) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const px = 64;
  ctx.font = `600 ${px}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w; c.height = px + 24;
  ctx.font = `600 ${px}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(20,22,26,0.82)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, c.height, 14); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  const k = size / c.height;
  s.scale.set(c.width * k, c.height * k, 1);
  s.renderOrder = 10;
  s.userData.isLabel = true;
  return s;
}

function buildFoot(P, ft) {
  const g = new THREE.Group();
  const vh = ft.hc;
  const tiltDeg = ft.tilt;
  const vr = v(P, 'noha', 'valec_prumer') / 2;
  const dh = v(P, 'noha', 'drzak_vyska');
  const pr = v(P, 'noha', 'prisavka_prumer') / 2;
  const ph = v(P, 'noha', 'prisavka_vyska');

  const c1 = cyl(vr, vr, vh * 0.55, MAT.printDark); c1.position.y = -vh * 0.275;
  const c2 = cyl(vr, vr, vh * 0.45, MAT.print); c2.position.y = -vh * 0.55 - vh * 0.225;
  const holder = cyl(vr * 0.55, vr * 0.75, dh, MAT.black); holder.position.y = -vh - dh / 2;
  const plate = box(vr * 2.1, 6, vr * 1.2, MAT.black); plate.position.y = -vh - dh + 3;
  const pump = cyl(9, 9, 42, MAT.blue, 20); pump.rotation.z = Math.PI / 2;
  pump.position.set(vr * 0.9, -vh - dh * 0.55, 0);
  const cup = cyl(vr * 0.7, pr, ph, MAT.black); cup.position.y = -vh - dh - ph / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(pr, 3, 10, 60), MAT.yellow);
  ring.rotation.x = Math.PI / 2; ring.position.y = -vh - dh - ph + 3;
  // spodní část (držák, přísavka) nakloněná kolem spodku válce, + = do +X
  const lower = new THREE.Group();
  lower.position.y = -vh;
  for (const m of [holder, plate, pump, cup, ring]) { m.position.y += vh; lower.add(m); }
  lower.rotation.z = THREE.MathUtils.degToRad(tiltDeg);
  g.add(c1, c2, lower);
  return g;
}

/**
 * role: 'master' | 'slave'
 * opts: { beams, labels }
 */
export function buildUnit(P, role, opts = {}) {
  const unit = new THREE.Group();
  unit.name = role;
  const W = v(P, 'profil', 'sirka');
  const H = v(P, 'profil', 'vyska');
  const t = v(P, 'profil', 'stena');
  const kh = v(P, 'profil', 'kryt_vyska');
  const { parts, total } = layout(P);
  const cep = v(P, 'delky', 'cep');
  const bodyLen = total - 2 * cep;
  const aluH = H - kh;

  // Hliníkový profil: U průřez (dno + boky), shora zakrytý tištěnými díly
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(W / 2, aluH);
  shape.lineTo(W / 2 - t, aluH); shape.lineTo(W / 2 - t, t); shape.lineTo(-W / 2 + t, t);
  shape.lineTo(-W / 2 + t, aluH); shape.lineTo(-W / 2, aluH); shape.closePath();
  const alu = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: bodyLen, bevelEnabled: false }), MAT.alu);
  alu.rotation.y = Math.PI / 2; // extruze do +X
  // po rotaci: tvar X -> -Z, Y -> Y, hloubka -> +X
  alu.position.x = cep;
  unit.add(alu);

  const winL = v(P, 'okno', 'delka');
  const winW = v(P, 'okno', 'sirka');
  const lw = v(P, 'lidar', 'sirka'), ld = v(P, 'lidar', 'hloubka'), lh = v(P, 'lidar', 'vyska');
  const reach = v(P, 'lidar', 'dosah');

  const winNames = WIN_NAMES[role];

  for (const p of parts) {
    const cx = p.x0 + p.len / 2;
    if (p.kind === 'segment') {
      const edge = p.edge;
      const s = box(p.len - 0.6, kh, W, MAT.print);
      s.position.set(cx, H - kh / 2, 0);
      unit.add(s);
      if (opts.labels && !edge) { const l = label(p.name, 22); l.position.set(cx, H + 18, 0); unit.add(l); }
    } else if (p.kind === 'window') {
      // rámeček okna = tištěný modul s průzorem
      const frame = box(p.len - 0.6, kh, W, MAT.printDark);
      frame.position.set(cx, H - kh / 2, 0);
      unit.add(frame);
      // lidar = jeden díl, čelo vyplní průzor až do roviny krytu, dívá se do +Y
      const lid = box(ld, lh, lw, MAT.lidar);
      lid.position.set(cx, H - lh / 2, 0);
      unit.add(lid);
      const nose = box(winW - 0.6, 0.4, winL - 0.6, MAT.glass); // průzor, delší strana napříč
      nose.position.set(cx, H + 0.2, 0);
      unit.add(nose);
      if (opts.beams) {
        const b = cyl(4, 4, reach, MAT.beam, 12);
        b.position.set(cx, H + reach / 2, 0);
        b.userData.noExport = true;
        unit.add(b);
      }
      if (opts.labels) { const l = label(winNames[p.index], 16); l.position.set(cx, H + 40, 0); unit.add(l); }
    } else if (p.kind === 'cap') {
      const c = box(p.len, H, W, MAT.cap);
      c.position.set(cx, H / 2, 0);
      unit.add(c);
      const outX = p.end === 0 ? p.x0 : p.x0 + p.len; // vnější čelo
      const dir = p.end === 0 ? -1 : 1;
      addCapFittings(unit, P, role, p.end, outX, dir, H, W);
    }
  }

  // Deska RICE v segmentu C (na fotce deska u krajního lidaru) – poloha odhadem
  const segC = parts.find(p => p.name === 'C');
  const bw = v(P, 'deska', 'sirka'), bl = v(P, 'deska', 'delka'), bt = v(P, 'deska', 'tloustka');
  const pcb = box(bl, bt, bw, MAT.pcb);
  const bx = segC.x0 + segC.len / 2;
  pcb.position.set(bx, t + 8, 0);
  unit.add(pcb);
  const esp = box(18, 3, role === 'master' ? 25 : 25, MAT.esp);
  esp.position.set(bx - bl / 2 + 16, t + 8 + bt / 2 + 1.5, 0);
  unit.add(esp);
  if (opts.labels) { const l = label(role === 'master' ? 'RICE · ESP32-S3' : 'RICE · ESP32', 12); l.position.set(bx, t + 30, -W / 2 - 30); unit.add(l); }

  // Nohy s přísavkami
  for (const ft of feet(P)) {
    const f = buildFoot(P, ft);
    f.position.x = ft.x;
    unit.add(f);
  }

  if (opts.labels) {
    const l = label(role === 'master' ? 'MASTER' : 'SLAVE', 26);
    l.position.set(total / 2, H + 80, 0);
    unit.add(l);
  }
  unit.userData.total = total;
  return unit;
}

function addCapFittings(unit, P, role, end, outX, dir, H, W) {
  const kr = v(P, 'konektor', 'zavit') / 2;
  const fromLeft = (d) => -W / 2 + d; // pohled zvenku na čelo A
  const kl = v(P, 'konektor', 'delka');
  const addConn = (z, cy = H * 0.5) => {
    const c = cyl(kr, kr, kl, MAT.metal, 24);
    c.rotation.z = Math.PI / 2;
    c.position.set(outX + dir * kl / 2, cy, z);
    unit.add(c);
    const face = cyl(kr * 0.7, kr * 0.7, 1, MAT.black, 24);
    face.rotation.z = Math.PI / 2;
    face.position.set(outX + dir * (kl + 0.5), cy, z);
    unit.add(face);
  };
  const addLevel = () => {
    const lr = v(P, 'libela', 'prumer') / 2;
    const l = cyl(lr, lr, 2, MAT.level, 24);
    l.rotation.z = Math.PI / 2;
    l.position.set(outX + dir * 1, v(P, 'libela', 'vyska'), fromLeft(v(P, 'libela', 'od_leve')));
    unit.add(l);
  };

  if (role === 'master' && end === 0) {
    // anténa s průchodkou + libela
    const pl = v(P, 'antena', 'patka'), py = v(P, 'antena', 'patka_vyska'), pz = fromLeft(v(P, 'antena', 'patka_od_leve'));
    const gland = cyl(9, 9, pl, MAT.white, 24);
    gland.rotation.z = Math.PI / 2;
    gland.position.set(outX - pl / 2, py, pz);
    unit.add(gland);
    const ang = THREE.MathUtils.degToRad(v(P, 'antena', 'uhel'));
    const al = v(P, 'antena', 'delka');
    const ant = cyl(3.5, 5, al, MAT.black, 16);
    const pivot = new THREE.Group();
    pivot.position.set(outX - pl, py, pz);
    ant.position.y = al / 2;
    pivot.add(ant);
    pivot.rotation.z = Math.PI / 2 - ang; // míří ven z čela (-X), skloněná nahoru o `uhel`
    unit.add(pivot);
    addLevel();
  } else if (role === 'master' && end === 1) {
    const cy = v(P, 'konektor', 'master_vyska'), dz = v(P, 'konektor', 'master_odsazeni');
    addConn(dz, cy);  // 4pin, slave (vlevo při pohledu na čelo)
    addConn(-dz, cy); // 2pin, napájení (vpravo)
  } else if (role === 'slave' && end === 0) {
    addLevel();
  } else {
    addConn(v(P, 'konektor', 'slave_odsazeni'), v(P, 'konektor', 'slave_vyska'));
  }
}
