// Nosná deska ClearWay CB3 (v3): data pro 3D model, osazovací CSV, kusovník a obrys DXF v konfigurátoru.
// Bez závislostí, takže ji čte i Node skript scripts/export-board.mjs.
//
// Rev. B: polohy, strany a rozměry těl všech 214 součástek jsou z hotové desky v KiCadu
// (board-v3-pcb.js, generuje scripts/kicad/export-3d.py). Tady je jen vzhled pro 3D: tvar, materiál,
// výška a popisky. Zdrojem pravdy je projekt hardware/cb3.
//
// Souřadnice desky: x podél skříně (+x = přední stěna se zásuvkami M12), z napříč (+z = pravá strana),
// počátek ve středu desky, y = 0 spodní plocha DPS. Rozměry v mm: w = podél x, d = podél z, h = výška.
import { PCB_PARTS, PCB_SIZE } from './board-v3-pcb.js';

export const BOARD = {
  name: 'ClearWay CB3',
  rev: 'B',
  // obrys podle skříně 260×180, stěna 3 mm, vůle 6 mm na každou stranu
  length: Math.round(PCB_SIZE.length), width: Math.round(PCB_SIZE.width), thickness: 1.6, corner: 3,
  layers: 4,
  // montážní otvory M3 (sloupky ve dně skříně) a výřezy pro sloupky víka
  holes: [[-108, -68], [108, -68], [-108, 68], [108, 68]].map(([x, z]) => ({ x, z, d: 3.4, pad: 6.5 })),
  cutouts: [[-116, -76], [116, -76], [-116, 76], [116, 76], [0, -81], [0, 81]].map(([x, z]) => ({ x, z, r: 7.5 })),
};

// bloky = listy schématu, kategorie v aplikaci a kapitoly v dokumentaci
export const BLOCKS = {
  napajeni: 'Napájení 9–32 V',
  vypocet: 'Počítač CM5',
  site: 'Ethernet a porty senzorů',
  radio: 'GNSS, LTE, CAN',
  obsluha: 'Obsluha a ladění',
};

// Vzhled podle pouzdra (první shoda). shape: box, cyl (válec svisle), ic (tělo + značka pinu 1),
// cm5, m2, coin, ufl, button, tp (testovací ploška). passive = v 3D sloučené do skupin.
const STYLE = [
  [/^R_0402/, { h: 0.35, mat: 'chip', passive: true }],
  [/^C_0402/, { h: 0.5, mat: 'ceramic', passive: true }],
  [/^L_0402/, { h: 0.5, mat: 'ferrite', passive: true }],
  [/^(C|L)_0603/, { h: 0.8, mat: 'ceramic', passive: true }],
  [/^C_0805/, { h: 1.0, mat: 'ceramic', passive: true }],
  [/^C_12(06|10)/, { h: 1.6, mat: 'ceramic', passive: true }],
  [/^CP_Elec/, { h: 10.5, shape: 'cyl', mat: 'nickel' }],
  [/^L_Coilcraft_XAL1010/, { h: 10, mat: 'ferrite' }],
  [/^L_Coilcraft_XAL4020/, { h: 2.1, mat: 'ferrite' }],
  [/^D_SMC/, { h: 2.3, mat: 'chip' }],
  [/^Fuse_/, { h: 0.8, mat: 'yellow' }],
  [/^SOT-553|^USON/, { h: 0.6, shape: 'ic' }],
  [/^SOT-23/, { h: 1.1, shape: 'ic' }],
  [/^TDSON/, { h: 1.0, shape: 'ic' }],
  [/^(VQFN|DFN|Texas_DSG)/, { h: 0.9, shape: 'ic' }],
  [/^(SOIC|Texas_R-PDSO)/, { h: 1.6, shape: 'ic' }],
  [/^TSSOP/, { h: 1.2, shape: 'ic' }],
  [/^LQFP/, { h: 1.6, shape: 'ic', leads: 20 }],
  [/^Crystal/, { h: 0.8, mat: 'shield' }],
  [/^LED_/, { h: 0.8 }],
  [/^Molex_Micro-Fit/, { h: 9.6, mat: 'plasticBlack' }],
  [/^JST_GH/, { h: 4.25, mat: 'jst' }],
  [/^U\.FL/, { h: 1.2, shape: 'ufl' }],
  [/^M\.2_Socket/, { h: 4.2, mat: 'chip' }],
  [/^nanoSIM/, { h: 1.4, mat: 'shield' }],
  [/^SW_Push/, { h: 1.9, shape: 'button' }],
  [/^BatteryHolder/, { h: 5.5, shape: 'coin', mat: 'nickel' }],
  [/^ublox_ZED/, { h: 2.4, mat: 'shield' }],
  [/^Raspberry-Pi-5-Compute-Module/, { h: 4.8, shape: 'cm5', mat: 'pcb', z0: 1.5 }],
  [/^Transformer_Ethernet/, { h: 4.5, mat: 'chip' }],
  [/^TestPoint/, { h: 0.05, shape: 'tp', mat: 'brass' }],
];
const LED_MAT = { GREEN: 'ledGreen', RED: 'led', YELLOW: 'yellow' };

// popisky hlavních součástek (ostatní z hodnoty)
const LABELS = {
  J1: 'Napájecí konektor (od zásuvky Deutsch)', F1: 'Pojistka 5 A', D1: 'TVS proti přepětí', U1: 'Ideální dioda (přepólování, zpětný proud)',
  Q1: 'MOSFET ideální diody', C1: 'Vstupní kondenzátor 100 µF / 63 V', C2: 'Vstupní kondenzátor 100 µF / 63 V',
  U2: 'Měnič 12 V / 3 A (senzory)', L1: 'Tlumivka 12 V', D4: 'Dioda měniče 12 V', U3: 'Měnič 5 V / 5 A (CM5)', L2: 'Tlumivka 5 V', D5: 'Dioda měniče 5 V',
  U14: 'Měnič 3,3 V / 3 A', L3: 'Tlumivka 3,3 V', U4: 'Měnič 3,8 V / 3 A (LTE modem)', L4: 'Tlumivka 3,8 V', U15: 'Stabilizátor 1,2 V (jádro přepínače)',
  Q2: 'Blokování EN měničů (vypnuto)', Q3: 'Zapnutí od KL15 nebo PWR_HOLD', Q4: 'Detekce zapalování pro CM5', Q5: 'Reset modemu (převod úrovně)', D2: 'Zenerova ochrana hradla Q2', D3: 'Dvojitá dioda (KL15 nebo PWR_HOLD)', L5: 'Napájení aktivní antény GNSS',
  M1: 'Raspberry Pi Compute Module 5', BT1: 'Záložní článek RTC', U7: 'Teploměr desky',
  U8: 'Přepínač Ethernet 5 portů', Y1: 'Krystal 25 MHz (přepínač)',
  T1: 'Oddělovací transformátor (skener L)', T2: 'Oddělovací transformátor (3D lidar)', T3: 'Oddělovací transformátor (skener P)',
  T4: 'Transformátor CM5 ↔ přepínač (strana CM5)', T5: 'Transformátor CM5 ↔ přepínač (strana přepínače)',
  U9: 'Spínač 12 V s omezením proudu (skener L)', U10: 'Spínač 12 V s omezením proudu (3D lidar)', U11: 'Spínač 12 V s omezením proudu (skener P)',
  J4: 'Konektor portu skener L (propojka k M12)', J5: 'Konektor portu 3D lidar (propojka k M12)', J6: 'Konektor portu skener P (propojka k M12)',
  M2: 'GNSS s dead reckoningem', J7: 'Anténa GNSS (U.FL)', J8: 'Slot M.2 Key B pro LTE modem', J9: 'Držák nano-SIM', D6: 'Ochrana ESD SIM',
  U12: 'Řadič CAN FD (SPI)', U13: 'Budič CAN', Y2: 'Krystal 40 MHz (CAN)', D7: 'Ochrana CAN',
  J10: 'Servisní USB (propojka k panelovému USB-C)', D8: 'Ochrana ESD USB', SW1: 'Tlačítko nRPIBOOT (nahrání systému)', SW2: 'Tlačítko vypnutí',
  LED1: 'LED napájení (zelená)', LED2: 'LED aktivita eMMC (žlutá)', LED3: 'LED stav (červená)', J11: 'Ladicí UART (3,3 V)',
};
const PINS = {
  J1: '1 KL30 +12/24 V, 2 GND, 3 KL15 zapalování, 4 CAN-H, 5 CAN-L, 6 GND',
  J4: '1–2 +12 V, 3–4 GND, 5 TX+, 6 TX−, 7 RX+, 8 RX−', J5: '1–2 +12 V, 3–4 GND, 5 TX+, 6 TX−, 7 RX+, 8 RX−', J6: '1–2 +12 V, 3–4 GND, 5 TX+, 6 TX−, 7 RX+, 8 RX−',
  J10: 'VBUS, D−, D+, GND', J11: 'TX, RX, GND',
};
const KIND = { R: 'Rezistor', C: 'Kondenzátor', L: 'Tlumivka', FB: 'Feritová perla', TP: 'Testovací ploška' };

function fromPcb(p) {
  const st = (STYLE.find(([re]) => re.test(p.fp)) || [null, { h: 1 }])[1];
  const prefix = p.ref.replace(/\d+$/, '');
  const part = {
    ref: p.ref, block: p.sheet in BLOCKS ? p.sheet : 'obsluha',
    label: LABELS[p.ref] || `${KIND[prefix] || p.ref} ${p.value}`,
    mpn: p.mpn || p.value, value: p.value, footprint: p.fp,
    x: p.x, z: p.z, w: p.w, d: p.d, rot: p.rot, side: p.side,
    shape: 'box', mat: 'chip', ...st,
  };
  if (/^LED/.test(p.ref)) part.mat = LED_MAT[p.value] || 'led';
  if (st.leads) { part.w += 2; part.d += 2; }   // LQFP: obrys těla bez vývodů
  if (PINS[p.ref]) part.pins = PINS[p.ref];
  return part;
}

const j8 = PCB_PARTS.find((p) => p.ref === 'J8');
export const PARTS = [
  ...PCB_PARTS.filter((p) => !p.ref.startsWith('MH')).map(fromPcb),
  // karta modemu se zasouvá do J8 (není součástí osazení desky), šroub v otvoru 2242
  {
    ref: 'M3', block: 'radio', label: 'LTE modem (karta M.2 3042)', mpn: 'Quectel EM05-G (LTE Cat 4), dodat zvlášť',
    x: j8.x + j8.w / 2 - 3 + 21, z: j8.z, w: 42, d: 30, h: 2.4, rot: 0, side: 'T', shape: 'm2', mat: 'pcb', z0: 2.6, loose: true,
  },
];

// Kam vede každá propojka uvnitř skříně (pro 3D kabely a dokumentaci)
export const LINKS = {
  power: 'J1', usb: 'J10', ports: ['J4', 'J5', 'J6'], gnss: 'J7', cm5: 'M1', soc: { dx: 6, dz: 0 },
};

export const part = (ref) => PARTS.find(p => p.ref === ref);
