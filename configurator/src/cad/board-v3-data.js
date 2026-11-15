// Nosná deska ClearWay CB3 (v3): jediný zdroj pro 3D model, osazovací CSV, kusovník a obrys DXF.
// Bez závislostí, takže ji čte i Node skript scripts/export-board.mjs.
//
// Souřadnice desky: x podél skříně (+x = přední stěna se zásuvkami M12), z napříč (+z = pravá strana),
// počátek ve středu desky, y = 0 spodní plocha DPS. Součástky jsou jen na horní straně (TOP).
// Rozměry pouzder v mm: w = podél x, d = podél z, h = výška nad deskou.
//
// Stav: KONCEPT. Typy součástek jsou návrh, před objednáním ověřit v datasheetech a u distributora
// (dostupnost, teplotní rozsah -40 až +85 °C, AEC-Q100 tam, kde je uvedeno).

export const BOARD = {
  name: 'ClearWay CB3',
  rev: 'A (koncept)',
  // obrys podle skříně 260×180, stěna 3 mm, vůle 6 mm na každou stranu
  length: 242, width: 162, thickness: 1.6, corner: 3,
  layers: 4,
  // montážní otvory M3 (sloupky ve dně skříně) a výřezy pro sloupky víka
  holes: [[-108, -68], [108, -68], [-108, 68], [108, 68]].map(([x, z]) => ({ x, z, d: 3.4, pad: 6.5 })),
  cutouts: [[-116, -76], [116, -76], [-116, 76], [116, 76], [0, -81], [0, 81]].map(([x, z]) => ({ x, z, r: 7.5 })),
};

// bloky = kategorie v aplikaci a kapitoly v dokumentaci
export const BLOCKS = {
  napajeni: 'Napájení 9–32 V',
  vypocet: 'Počítač CM5',
  site: 'Ethernet a porty senzorů',
  radio: 'GNSS, LTE, CAN',
  obsluha: 'Obsluha a ladění',
};

// pouzdra: druh tvaru pro 3D (box, cyl = válec svisle, cylX = válec ležící podél x, ic = pouzdro s vývody)
const C = (ref, block, label, mpn, x, z, w, d, h, opts = {}) => ({ ref, block, label, mpn, x, z, w, d, h, rot: 0, shape: 'box', mat: 'chip', ...opts });

export const PARTS = [
  // ---------------- NAPÁJENÍ ----------------
  C('J1', 'napajeni', 'Napájecí konektor (od zásuvky Deutsch)', 'Molex 43650-0600 (Micro-Fit 3.0, 6p, svislý)', -110, -40, 10.3, 10, 9.6, { mat: 'plasticBlack', pins: '1 KL30 +12/24 V, 2 KL31 GND, 3 KL15 zapalování, 4 CAN-H, 5 CAN-L, 6 GND' }),
  C('F1', 'napajeni', 'Pojistka 5 A', 'Littelfuse 0456005.ER (2410, pomalá)', -98, -48, 6.1, 2.5, 2.2, { mat: 'yellow' }),
  C('D1', 'napajeni', 'TVS proti load dump', 'Vishay SM8S36A (DO-218AB)', -97, -28, 10.2, 15.2, 4.6, { mat: 'chip' }),
  C('U1', 'napajeni', 'Ideální dioda (přepólování, zpětný proud)', 'TI LM74800QDRRRQ1 (WSON-12, AEC-Q100)', -84, -47, 3, 3, 0.8, { shape: 'ic' }),
  C('Q1', 'napajeni', 'MOSFET ideální diody', 'N-MOSFET 60 V ~3 mΩ LFPAK56 (např. Nexperia BUK7Y3R5-60E)', -84, -37, 5, 6, 1.1),
  C('Q2', 'napajeni', 'MOSFET odpojení zátěže', 'N-MOSFET 60 V ~3 mΩ LFPAK56 (např. Nexperia BUK7Y3R5-60E)', -76, -37, 5, 6, 1.1),
  C('C1', 'napajeni', 'Vstupní kondenzátor 100 µF / 63 V', 'Panasonic EEH-ZK1J101P (hybrid polymer, 10×10)', -71, -60, 10, 10, 10.5, { shape: 'cyl', mat: 'nickel' }),
  C('C2', 'napajeni', 'Vstupní kondenzátor 100 µF / 63 V', 'Panasonic EEH-ZK1J101P (hybrid polymer, 10×10)', -58, -60, 10, 10, 10.5, { shape: 'cyl', mat: 'nickel' }),
  C('U2', 'napajeni', 'Řadič buck-boost 12 V / 3 A (senzory)', 'TI LM5176PWPR (HTSSOP-28, 3,5–55 V)', -70, -20, 9.7, 6.4, 1.2, { shape: 'ic' }),
  C('Q3', 'napajeni', 'MOSFET buck-boost', 'N-MOSFET 60 V LFPAK56', -86, -12, 5, 6, 1.1),
  C('Q4', 'napajeni', 'MOSFET buck-boost', 'N-MOSFET 60 V LFPAK56', -86, -2, 5, 6, 1.1),
  C('Q5', 'napajeni', 'MOSFET buck-boost', 'N-MOSFET 60 V LFPAK56', -54, -12, 5, 6, 1.1),
  C('Q6', 'napajeni', 'MOSFET buck-boost', 'N-MOSFET 60 V LFPAK56', -54, -2, 5, 6, 1.1),
  C('L1', 'napajeni', 'Tlumivka buck-boost 4,7 µH', 'Coilcraft XAL1010-472MEB (10×11,3 mm)', -70, -4, 11.3, 10, 10, { mat: 'ferrite' }),
  C('C3', 'napajeni', 'Výstup 12 V 220 µF / 25 V', 'polymerový Al, ⌀8×8', -40, -18, 8, 8, 8.2, { shape: 'cyl', mat: 'nickel' }),
  C('U3', 'napajeni', 'Měnič 5 V / 5 A (CM5)', 'TI TPS54560BDDAR (HSOIC-8, 4,5–60 V)', -46, -48, 4.9, 6, 1.6, { shape: 'ic' }),
  C('L2', 'napajeni', 'Tlumivka 5 V 6,8 µH', 'Coilcraft XAL7070-682MEB (7×7 mm)', -46, -64, 7.5, 7.2, 7, { mat: 'ferrite' }),
  C('C4', 'napajeni', 'Výstup 5 V 330 µF / 10 V', 'polymerový Al, ⌀8×8', -32, -64, 8, 8, 8.2, { shape: 'cyl', mat: 'nickel' }),
  C('U4', 'napajeni', 'Měnič 3,8 V / 3 A (LTE modem)', 'TI TPS62133RGTR (VQFN-16)', -24, -6, 3, 3, 1, { shape: 'ic' }),
  C('L3', 'napajeni', 'Tlumivka 3,8 V 1 µH', 'Coilcraft XFL4020-102MEB', -24, 4, 4, 4, 2.1, { mat: 'ferrite' }),
  C('U5', 'napajeni', 'Spínač zapnutí (KL15 nebo udržení z CM5)', 'Nexperia 74LVC1G32 + BSS138 (diode-OR na EN měničů)', -90, -58, 3, 3, 1, { shape: 'ic' }),
  C('U6', 'napajeni', 'Nabíječ superkondenzátorů se zálohou 5 V', 'Analog Devices LTC3226EUD (QFN-16) – ověřit proud zálohy', -66, 24, 3, 3, 0.8, { shape: 'ic' }),
  C('SC1', 'napajeni', 'Superkondenzátor 10 F / 2,7 V', 'Eaton HV1030-2R7106-R (⌀10×30)', -103, 18, 30, 10.5, 10.5, { shape: 'cylX', mat: 'blue' }),
  C('SC2', 'napajeni', 'Superkondenzátor 10 F / 2,7 V', 'Eaton HV1030-2R7106-R (⌀10×30)', -103, 31, 30, 10.5, 10.5, { shape: 'cylX', mat: 'blue' }),

  // ---------------- POČÍTAČ ----------------
  C('J2', 'vypocet', 'Konektor CM5 (sběrnice A)', 'Hirose DF40C-100DS-0.4V(51)', 20, -51.5, 29.6, 4.8, 1.5, { mat: 'chip' }),
  C('J3', 'vypocet', 'Konektor CM5 (sběrnice B)', 'Hirose DF40C-100DS-0.4V(51)', 20, -18.5, 29.6, 4.8, 1.5, { mat: 'chip' }),
  C('M1', 'vypocet', 'Raspberry Pi Compute Module 5', 'CM5104032 (4 GB RAM, 32 GB eMMC, bez Wi-Fi)', 20, -35, 55, 40, 4.8, { shape: 'cm5', mat: 'pcb', z0: 1.5 }),
  C('BT1', 'vypocet', 'Záložní článek RTC', 'držák Keystone 3034 + ML2032 (dobíjecí)', -30, 66, 23, 20.5, 5.5, { shape: 'coin', mat: 'nickel' }),
  C('U7', 'vypocet', 'Teploměr desky', 'TI TMP1075DSGR (I²C)', 50, -66, 2, 2, 0.8, { shape: 'ic' }),

  // ---------------- ETHERNET A PORTY ----------------
  C('U8', 'site', 'Přepínač Ethernet 5 portů', 'Microchip KSZ8795CLXIC (LQFP-80, průmyslový)', 64, -8, 14, 14, 1.6, { shape: 'ic', leads: 20 }),
  C('Y1', 'site', 'Krystal 25 MHz', 'Abracon ABM8-25.000MHZ (3,2×2,5)', 64, 6, 3.2, 2.5, 0.8, { mat: 'shield' }),
  ...[['L', -50], ['3D', 0], ['P', 50]].flatMap(([n, z], i) => [
    C(`T${i + 1}`, 'site', `Oddělovací transformátor (${n === '3D' ? '3D lidar' : `skener ${n}`})`, 'Pulse HX1188NL (10/100, SOIC-16)', 92, z, 7.3, 12.7, 6.0, { mat: 'chip' }),
    C(`U${9 + i}`, 'site', `Spínač 12 V s omezením proudu (${n === '3D' ? '3D lidar' : `skener ${n}`})`, 'TI TPS1H100BQPWPRQ1 (HTSSOP-14, 40 V)', 80, z + 13, 5, 6.4, 1.2, { shape: 'ic' }),
    C(`D${2 + i}`, 'site', `Ochrana ESD Ethernet (${n})`, 'Semtech RClamp0524P (SLP2510)', 101, z + 8, 2.5, 1, 0.6),
    C(`J${4 + i}`, 'site', `Konektor portu ${n === '3D' ? '3D lidar' : `skener ${n}`} (propojka k M12)`, 'JST SM08B-GHS-TB (GH 1,25 mm, 8p, ležatý)', 113, z, 6.0, 12.25, 4.25, { mat: 'jst', pins: '1–2 +12 V, 3–4 GND, 5 TX+, 6 TX−, 7 RX+, 8 RX−' }),
  ]),

  // ---------------- GNSS, LTE, CAN ----------------
  C('M2', 'radio', 'GNSS s dead reckoningem', 'u-blox ZED-F9R-02B (LGA-54, 17×22)', -86, 56, 22, 17, 2.4, { mat: 'shield' }),
  C('J7', 'radio', 'Anténa GNSS (U.FL)', 'Hirose U.FL-R-SMT-1', -112, 56, 3, 3, 1.2, { shape: 'ufl' }),
  C('L4', 'radio', 'Napájení aktivní antény', 'Murata LQW18AN (indukčnost RF) + omezení proudu', -103, 46, 1.6, 0.8, 0.8),
  C('J8', 'radio', 'Slot M.2 Key B pro LTE modem', 'TE 2199230-4 (výška 4,2)', -12, 32, 5.5, 22, 4.2, { mat: 'chip' }),
  C('M3', 'radio', 'LTE modem (karta M.2 3042)', 'Quectel EM05-G (LTE Cat 4)', 12, 32, 42, 30, 2.4, { shape: 'm2', mat: 'pcb', z0: 2.6 }),
  C('H1', 'radio', 'Distanční sloupek M.2', 'SMT matice M2 (Würth 9774025151)', 33, 32, 4, 4, 2.5, { shape: 'cyl', mat: 'brass' }),
  C('J9', 'radio', 'Držák nano-SIM', 'Molex 78723-1001 (push-push) – ověřit', 45, 54, 14.5, 12.6, 1.4, { mat: 'shield' }),
  C('D5', 'radio', 'Ochrana ESD SIM', 'TI TPD3E001DRLR', 45, 44, 1.6, 1.2, 0.6),
  C('U12', 'radio', 'Řadič CAN FD (SPI)', 'Microchip MCP2518FDT-E/QBB (VDFN-14)', -54, 46, 3, 4.5, 0.9, { shape: 'ic' }),
  C('U13', 'radio', 'Budič CAN', 'TI TCAN1042HGVDRBRQ1 (SON-8)', -54, 58, 3, 3, 1, { shape: 'ic' }),
  C('Y2', 'radio', 'Krystal 40 MHz (CAN)', 'Abracon ABM8-40.000MHZ', -44, 46, 3.2, 2.5, 0.8, { mat: 'shield' }),
  C('D6', 'radio', 'Ochrana CAN', 'Nexperia PESD2CANFD24V (SOT-23)', -66, 58, 2.9, 1.3, 1),

  // ---------------- OBSLUHA ----------------
  C('J10', 'obsluha', 'Servisní USB (propojka k panelovému USB-C)', 'JST SM04B-GHS-TB (GH, 4p: VBUS, D−, D+, GND)', -112, -54, 6, 7.25, 4.25, { mat: 'jst' }),
  C('D7', 'obsluha', 'Ochrana ESD USB', 'TI TPD4E05U06DQAR', -102, -54, 2.5, 1, 0.6),
  C('SW1', 'obsluha', 'Tlačítko nRPIBOOT (nahrání firmware)', 'C&K PTS526SK15SMTR2LFS', 55, -52, 5.2, 5.2, 1.5, { shape: 'button' }),
  C('SW2', 'obsluha', 'Tlačítko vypnutí / reset', 'C&K PTS526SK15SMTR2LFS', 55, -42, 5.2, 5.2, 1.5, { shape: 'button' }),
  C('LED1', 'obsluha', 'LED napájení (zelená)', 'Würth 150060VS75000 (0603)', 84, 66, 1.6, 0.8, 0.8, { mat: 'ledGreen' }),
  C('LED2', 'obsluha', 'LED GNSS fix (modrá)', 'Würth 150060BS75000 (0603)', 84, 61, 1.6, 0.8, 0.8, { mat: 'blue' }),
  C('LED3', 'obsluha', 'LED chyba (červená)', 'Würth 150060RS75000 (0603)', 84, 56, 1.6, 0.8, 0.8, { mat: 'led' }),
  C('J11', 'obsluha', 'Ladicí UART (3,3 V)', 'JST SM03B-GHS-TB (GH, 3p: TX, RX, GND)', 96, 64, 6, 6.25, 4.25, { mat: 'jst' }),
];

// Rozmístění pasivních součástek (0402/0603) kolem IO – v 3D jako shluky, v kusovníku orientačně.
export const PASSIVE_CLUSTERS = [
  { block: 'napajeni', near: 'U1', n: 10 }, { block: 'napajeni', near: 'U2', n: 24 }, { block: 'napajeni', near: 'U3', n: 14 },
  { block: 'napajeni', near: 'U4', n: 10 }, { block: 'napajeni', near: 'U6', n: 8 }, { block: 'vypocet', near: 'J2', n: 18 },
  { block: 'site', near: 'U8', n: 36 }, { block: 'site', near: 'T1', n: 6 }, { block: 'site', near: 'T2', n: 6 }, { block: 'site', near: 'T3', n: 6 },
  { block: 'radio', near: 'M2', n: 12 }, { block: 'radio', near: 'J8', n: 12 }, { block: 'radio', near: 'U12', n: 10 },
];

// Kam vede každá propojka uvnitř skříně (pro 3D kabely a dokumentaci)
export const LINKS = {
  power: 'J1', usb: 'J10', ports: ['J4', 'J5', 'J6'], gnss: 'J7', cm5: 'M1', soc: { dx: 6, dz: 0 },
};

export const part = (ref) => PARTS.find(p => p.ref === ref);
