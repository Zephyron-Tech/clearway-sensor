// ClearWay CB3, rev. B – kompletní zapojení nosné desky v3.
// Každá součástka: symbol, pouzdro, hodnota, typ (MPN) a sítě po vývodech. Z tohoto souboru se generuje
// schéma (gen-full.mjs) i deska (gen-pcb-full.py). Pasivní součástky mají `anchor` = IO, ke kterému patří
// (podle něj se rozmisťují na desce).
//
// Zdroje zapojení (datasheety výrobců):
//  TPS54560B (TI SLVSF00, kap. 8.2), TPS62130 (TI SLVSAG7F, kap. 9.2), LM74700-Q1 (TI SNOSD17G),
//  TPS1H100-Q1 (TI SLVSCM2D), KSZ8795CLX (Microchip DS00002112D, kap. 2 a 3.1.10, 3.4),
//  ZED-F9R (u-blox UBX-19054459), CM5 (Raspberry Pi CM5 datasheet + referenční CM5 IO Board, KiCad),
//  MCP2518FD, TJA1042/TCAN1042V, AP2112K, TMP1075 (pinout z knihoven KiCadu).
//
// Sítě: null = vývod úmyslně nezapojený (ve schématu značka „nezapojeno“). ncRest: všechny ostatní vývody
// součástky jsou úmyslně nezapojené.

export const SHEETS = {
  napajeni: 'Napájení 9–32 V',
  vypocet: 'Počítač CM5',
  site: 'Ethernet a porty senzorů',
  radio: 'GNSS, LTE, CAN',
  obsluha: 'Obsluha a ladění',
};

// ---------- pouzdra ----------
const FP = {
  R0402: 'Resistor_SMD:R_0402_1005Metric', R0603: 'Resistor_SMD:R_0603_1608Metric',
  C0402: 'Capacitor_SMD:C_0402_1005Metric', C0603: 'Capacitor_SMD:C_0603_1608Metric', C0805: 'Capacitor_SMD:C_0805_2012Metric',
  C1206: 'Capacitor_SMD:C_1206_3216Metric', C1210: 'Capacitor_SMD:C_1210_3225Metric',
  CPEL10: 'Capacitor_SMD:CP_Elec_10x10.5', L0603: 'Inductor_SMD:L_0603_1608Metric', FB0603: 'Inductor_SMD:L_0603_1608Metric',
  XAL1010: 'Inductor_SMD:L_Coilcraft_XAL1010-XXX', XAL4020: 'Inductor_SMD:L_Coilcraft_XAL4020-XXX',
  SMC: 'Diode_SMD:D_SMC', SOT23: 'Package_TO_SOT_SMD:SOT-23', LED0603: 'LED_SMD:LED_0603_1608Metric',
  TP: 'TestPoint:TestPoint_Pad_D1.5mm',
};

const parts = [];
let sheet = 'napajeni';
let anchor = null;
const counters = {};
const nextRef = (p) => { counters[p] = (counters[p] || 0) + 1; return `${p}${counters[p]}`; };
function add(o) {
  const p = { sheet, anchor, ...o };
  if (!p.ref) { p.ref = nextRef(p.prefix); p.autoRef = true; }
  parts.push(p);
  return p;
}
// hlavní součástka: další pasivy se k ní kotví
const main = (o) => { const p = add({ ...o, anchor: null }); anchor = p.ref; return p; };
const R = (value, a, b, o = {}) => add({ prefix: 'R', sym: 'Device:R', fp: o.fp || FP.R0402, value, mpn: o.mpn || `rezistor ${value} 1 % ${o.fp === FP.R0603 ? '0603' : '0402'}`, nets: { 1: a, 2: b }, ...o });
const C = (value, a, b, o = {}) => add({ prefix: 'C', sym: 'Device:C', fp: o.fp || FP.C0402, value, mpn: o.mpn || `keramický kondenzátor ${value} X7R`, nets: { 1: a, 2: b }, ...o });
const L = (value, a, b, o = {}) => add({ prefix: 'L', sym: 'Device:L', fp: o.fp, value, mpn: o.mpn, nets: { 1: a, 2: b }, ...o });
const FB = (a, b, o = {}) => add({ prefix: 'FB', sym: 'Device:FerriteBead_Small', fp: FP.FB0603, value: '600R@100MHz', mpn: 'Murata BLM18PG601SN1D', nets: { 1: a, 2: b }, ...o });
const TP = (net, o = {}) => add({ prefix: 'TP', sym: 'Connector:TestPoint', fp: FP.TP, value: net, mpn: 'testovací ploška', nets: { 1: net }, ...o });
// PWR_FLAG jen na sítích, které nenapájí žádný výstup typu „power_out“ (U15 a spínače portů ho mají)
const PWR_FLAGS = ['VIN_P', 'VIN_F', 'V12', 'V5', 'V3V3', 'V3V8', 'V1V2_A', 'V3V3_A', 'V3V3_GNSS', 'GND', 'KL30', 'SIM_VCC'];

// =====================================================================================
sheet = 'napajeni';
// ---- vstup, pojistka, TVS, ideální dioda ----
main({ ref: 'J1', sym: 'Connector_Generic:Conn_02x03_Odd_Even', fp: 'Connector_Molex:Molex_Micro-Fit_3.0_43045-0612_2x03_P3.00mm_Vertical', value: 'POWER',
  mpn: 'Molex 43045-0612', nets: { 1: 'KL30', 2: 'GND', 3: 'KL15', 4: 'CAN_H', 5: 'CAN_L', 6: 'GND' } });
add({ ref: 'F1', sym: 'Device:Fuse', fp: 'Fuse:Fuse_1206_3216Metric', value: '5A', mpn: 'Littelfuse 0466005.NR (5 A, 1206) – ověřit jmenovité napětí ≥ 32 V', nets: { 1: 'KL30', 2: 'VIN_F' } });
add({ ref: 'D1', sym: 'Device:D_TVS', fp: FP.SMC, value: 'SMCJ33CA', mpn: 'Littelfuse SMCJ33CA (obousměrný, 1500 W)', nets: { 1: 'VIN_F', 2: 'GND' } });
main({ ref: 'U1', sym: 'Power_Management:LM74700', fp: 'Package_TO_SOT_SMD:SOT-23-6', value: 'LM74700-Q1', mpn: 'TI LM74700QDBVRQ1',
  nets: { 6: 'VIN_F', 4: 'VIN_P', 5: 'IDEAL_G', 1: 'IDEAL_VCAP', 3: 'VIN_F', 2: 'GND' } });
C('100n', 'IDEAL_VCAP', 'VIN_F', { fp: FP.C0603, mpn: 'kondenzátor 100 nF 25 V X7R 0603 (VCAP–ANODE)' });
add({ ref: 'Q1', sym: 'Transistor_FET:BSC028N06LS3', fp: 'Package_TO_SOT_SMD:TDSON-8-1', value: 'BSC028N06LS3', mpn: 'Infineon BSC028N06LS3 (60 V, 2,8 mΩ)',
  nets: { 1: 'VIN_F', 2: 'VIN_F', 3: 'VIN_F', 4: 'IDEAL_G', 5: 'VIN_P' } });
add({ ref: 'C1', sym: 'Device:C_Polarized', fp: FP.CPEL10, value: '100u 63V', mpn: 'Panasonic EEH-ZK1J101P (hybridní polymer)', nets: { 1: 'VIN_P', 2: 'GND' } });
add({ ref: 'C2', sym: 'Device:C_Polarized', fp: FP.CPEL10, value: '100u 63V', mpn: 'Panasonic EEH-ZK1J101P (hybridní polymer)', nets: { 1: 'VIN_P', 2: 'GND' } });
counters.C = 2;

// ---- zapínání: EN_MAIN = KL15 nebo PWR_HOLD z CM5 ----
// UVLO dělič z TPS54560B (start ~6,5 V). Q2 drží EN dole, dokud Q3 (KL15 / HOLD) nepovolí.
anchor = 'U2';
R('442k', 'VIN_P', 'EN_MAIN', { anchor: 'Q2' });
R('90.9k', 'EN_MAIN', 'GND', { anchor: 'Q2' });
main({ ref: 'Q2', sym: 'Transistor_FET:BSS138', fp: FP.SOT23, value: 'BSS138', mpn: 'onsemi BSS138', nets: { 1: 'OFF_G', 2: 'GND', 3: 'EN_MAIN' } });
R('100k', 'VIN_P', 'OFF_G');
add({ ref: 'D2', sym: 'Diode:BZX84Cxx', fp: FP.SOT23, value: 'BZX84C10', mpn: 'Nexperia BZX84-C10', nets: { 1: 'GND', 2: null, 3: 'OFF_G' } });
add({ ref: 'Q3', sym: 'Transistor_FET:BSS138', fp: FP.SOT23, value: 'BSS138', mpn: 'onsemi BSS138', nets: { 1: 'ON_G', 2: 'GND', 3: 'OFF_G' } });
R('100k', 'ON_G', 'GND');
add({ ref: 'D3', sym: 'Diode:BAT54C', fp: FP.SOT23, value: 'BAT54C', mpn: 'Nexperia BAT54C', nets: { 1: 'KL15_DIV', 2: 'PWR_HOLD', 3: 'ON_G' } });
R('100k', 'KL15', 'KL15_DIV');
R('33k', 'KL15_DIV', 'GND');
C('100n', 'KL15_DIV', 'GND');
// detekce zapalování pro CM5 (nízká úroveň = zapalování zapnuté)
add({ ref: 'Q4', sym: 'Transistor_FET:BSS138', fp: FP.SOT23, value: 'BSS138', mpn: 'onsemi BSS138', nets: { 1: 'KL15_DIV', 2: 'GND', 3: 'nKL15' } });
R('10k', 'V3V3', 'nKL15');

// ---- U2: 12 V / 3 A pro senzory (TPS54560B, kompenzace upravená pro 12 V z návrhu TI) ----
main({ ref: 'U2', sym: 'Regulator_Switching:TPS54560BDDA', fp: 'Package_SO:Texas_R-PDSO-G8_EP2.95x4.9mm_Mask2.4x3.1mm_ThermalVias', value: 'TPS54560B 12V',
  mpn: 'TI TPS54560BDDAR', nets: { 1: 'U2_BOOT', 2: 'VIN_P', 3: 'EN_MAIN', 4: 'U2_RT', 5: 'U2_FB', 6: 'U2_COMP', 7: 'GND', 8: 'U2_SW', 9: 'GND' } });
C('2.2u', 'VIN_P', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 2,2 µF 100 V X7R 1210' });
C('2.2u', 'VIN_P', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 2,2 µF 100 V X7R 1210' });
C('100n', 'U2_BOOT', 'U2_SW', { fp: FP.C0603 });
R('243k', 'U2_RT', 'GND');
R('143k', 'V12', 'U2_FB');
R('10.2k', 'U2_FB', 'GND');
R('19.1k', 'U2_COMP', 'U2_CZ');
C('4.7n', 'U2_CZ', 'GND');
C('47p', 'U2_COMP', 'GND', { mpn: 'kondenzátor 47 pF C0G' });
add({ ref: 'D4', sym: 'Device:D_Schottky', fp: FP.SMC, value: 'B560C', mpn: 'Diodes B560C-13-F (60 V, 5 A)', nets: { 1: 'U2_SW', 2: 'GND' } });
L('22u', 'U2_SW', 'V12', { fp: FP.XAL1010, mpn: 'Coilcraft XAL1010-223MEB' });
for (let i = 0; i < 3; i++) C('22u', 'V12', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 22 µF 25 V X7R 1210' });

// ---- U3: 5 V / 5 A pro CM5 (přesně podle návrhu TI, obr. 32) ----
main({ ref: 'U3', sym: 'Regulator_Switching:TPS54560BDDA', fp: 'Package_SO:Texas_R-PDSO-G8_EP2.95x4.9mm_Mask2.4x3.1mm_ThermalVias', value: 'TPS54560B 5V',
  mpn: 'TI TPS54560BDDAR', nets: { 1: 'U3_BOOT', 2: 'VIN_P', 3: 'EN_MAIN', 4: 'U3_RT', 5: 'U3_FB', 6: 'U3_COMP', 7: 'GND', 8: 'U3_SW', 9: 'GND' } });
C('2.2u', 'VIN_P', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 2,2 µF 100 V X7R 1210' });
C('2.2u', 'VIN_P', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 2,2 µF 100 V X7R 1210' });
C('100n', 'U3_BOOT', 'U3_SW', { fp: FP.C0603 });
R('243k', 'U3_RT', 'GND');
R('53.6k', 'V5', 'U3_FB');
R('10.2k', 'U3_FB', 'GND');
R('16.9k', 'U3_COMP', 'U3_CZ');
C('4.7n', 'U3_CZ', 'GND');
C('47p', 'U3_COMP', 'GND', { mpn: 'kondenzátor 47 pF C0G' });
add({ ref: 'D5', sym: 'Device:D_Schottky', fp: FP.SMC, value: 'B560C', mpn: 'Diodes B560C-13-F (60 V, 5 A)', nets: { 1: 'U3_SW', 2: 'GND' } });
L('6.8u', 'U3_SW', 'V5', { fp: FP.XAL1010, mpn: 'Coilcraft XAL1010-682MEB' });
for (let i = 0; i < 3; i++) C('47u', 'V5', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 47 µF 10 V X5R 1210' });

// ---- U14: 3,3 V / 3 A (logika, přepínač, GNSS, CAN) – TPS62130, obr. 9-1 ----
main({ ref: 'U14', sym: 'Regulator_Switching:TPS62130', fp: 'Package_DFN_QFN:VQFN-16-1EP_3x3mm_P0.5mm_EP1.68x1.68mm_ThermalVias', value: 'TPS62130 3V3',
  mpn: 'TI TPS62130RGTR', nets: { 1: 'U14_SW', 2: 'U14_SW', 3: 'U14_SW', 4: 'PG_3V3', 5: 'U14_FB', 6: 'GND', 7: 'GND', 8: 'GND', 9: 'U14_SS',
    10: 'V5', 11: 'V5', 12: 'V5', 13: 'V5', 14: 'V3V3', 15: 'GND', 16: 'GND', 17: 'GND' } });
C('10u', 'V5', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 10 µF 25 V X7R 1210' });
C('100n', 'V5', 'GND', { fp: FP.C0603 });
C('3.3n', 'U14_SS', 'GND');
R('316k', 'V3V3', 'U14_FB');
R('100k', 'U14_FB', 'GND');
R('100k', 'V3V3', 'PG_3V3');
L('2.2u', 'U14_SW', 'V3V3', { fp: FP.XAL4020, mpn: 'Coilcraft XAL4020-222MEC' });
C('22u', 'V3V3', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 22 µF 10 V X5R 0805' });
C('22u', 'V3V3', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 22 µF 10 V X5R 0805' });

// ---- U4: 3,8 V / 3 A pro LTE modem, zapíná CM5 (GPIO7) ----
main({ ref: 'U4', sym: 'Regulator_Switching:TPS62130', fp: 'Package_DFN_QFN:VQFN-16-1EP_3x3mm_P0.5mm_EP1.68x1.68mm_ThermalVias', value: 'TPS62130 3V8',
  mpn: 'TI TPS62130RGTR', nets: { 1: 'U4_SW', 2: 'U4_SW', 3: 'U4_SW', 4: 'PG_3V8', 5: 'U4_FB', 6: 'GND', 7: 'GND', 8: 'GND', 9: 'U4_SS',
    10: 'V5', 11: 'V5', 12: 'V5', 13: 'MODEM_PWR_EN', 14: 'V3V8', 15: 'GND', 16: 'GND', 17: 'GND' } });
C('10u', 'V5', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 10 µF 25 V X7R 1210' });
C('100n', 'V5', 'GND', { fp: FP.C0603 });
C('3.3n', 'U4_SS', 'GND');
R('374k', 'V3V8', 'U4_FB');
R('100k', 'U4_FB', 'GND');
R('100k', 'V3V8', 'PG_3V8');
R('100k', 'MODEM_PWR_EN', 'GND');
L('2.2u', 'U4_SW', 'V3V8', { fp: FP.XAL4020, mpn: 'Coilcraft XAL4020-222MEC' });
C('22u', 'V3V8', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 22 µF 10 V X5R 0805' });
C('22u', 'V3V8', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 22 µF 10 V X5R 0805' });

// ---- U15: 1,2 V pro jádro přepínače (KSZ8795 potřebuje externí 1,2 V) ----
main({ ref: 'U15', sym: 'Regulator_Linear:AP2112K-1.2', fp: 'Package_TO_SOT_SMD:SOT-23-5', value: 'AP2112K-1.2', mpn: 'Diodes AP2112K-1.2TRG1',
  nets: { 1: 'V3V3', 2: 'GND', 3: 'V3V3', 4: null, 5: 'V1V2' } });
C('1u', 'V3V3', 'GND', { fp: FP.C0603 });
C('1u', 'V1V2', 'GND', { fp: FP.C0603 });
C('10u', 'V1V2', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 10 µF 10 V X5R 0805' });

// testovací body
anchor = null;
for (const n of ['VIN_P', 'V12', 'V5', 'V3V3', 'V3V8', 'V1V2', 'GND', 'GND']) TP(n);

// =====================================================================================
sheet = 'vypocet';
// CM5: vývody podle referenční CM5 IO Board (CM5IO.kicad_sch) a datasheetu CM5
const CM5 = { 77: 'V5', 79: 'V5', 81: 'V5', 83: 'V5', 85: 'V5', 87: 'V5', 84: 'CM5_3V3', 86: 'CM5_3V3', 78: 'CM5_3V3',
  12: 'ETHC_TRD0_P', 10: 'ETHC_TRD0_N', 4: 'ETHC_TRD1_P', 6: 'ETHC_TRD1_N',
  21: 'LED_nACT', 76: 'RTC_BAT', 92: 'PWR_BTN', 93: 'nRPIBOOT',
  105: 'USB_SERV_P', 103: 'USB_SERV_N', 134: 'MODEM_USB_P', 136: 'MODEM_USB_N',
  // GPIO (ověřit alternativní funkce RP1: UART4 = GPIO12/13, SPI0 = GPIO8–11, I2C1 = GPIO2/3)
  56: 'I2C_SCL', 58: 'I2C_SDA', 55: 'DBG_TX', 51: 'DBG_RX', 31: 'GNSS_RXD', 28: 'GNSS_TXD', 49: 'GNSS_PPS', 47: 'GNSS_RESET_N',
  39: 'CAN_CS', 40: 'CAN_SDO', 44: 'CAN_SDI', 38: 'CAN_SCK', 41: 'CAN_INT', 30: 'CAN_STB',
  50: 'nKL15', 48: 'PWR_HOLD', 29: 'PORT_EN_L', 27: 'PORT_EN_3D', 25: 'PORT_EN_P', 26: 'PORT_ST_L', 24: 'PORT_ST_3D', 45: 'PORT_ST_P',
  46: 'MODEM_RESET', 37: 'MODEM_PWR_EN', 34: 'LED_STAT', 54: 'KSZ_RST_N' };
main({ ref: 'M1', sym: 'CB3:ComputeModule5-CM5', fp: 'CB3:Raspberry-Pi-5-Compute-Module', value: 'CM5', mpn: 'Raspberry Pi CM5104032 (CM5, 4 GB, 32 GB eMMC, bez Wi-Fi) + 2× Hirose DF40C-100DS-0.4V(51)',
  nets: CM5, gndByName: true, ncRest: true });
for (let i = 0; i < 2; i++) C('47u', 'V5', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 47 µF 10 V X5R 1210' });
for (let i = 0; i < 4; i++) C('100n', 'V5', 'GND');
C('100n', 'CM5_3V3', 'GND');
// RTC článek
add({ ref: 'BT1', sym: 'Device:Battery_Cell', fp: 'Battery:BatteryHolder_Keystone_3034_1x20mm', value: 'ML2032', mpn: 'Keystone 3034 + Maxell ML2032 (dobíjecí)', nets: { 1: 'RTC_BAT', 2: 'GND' } });
// teploměr desky
main({ ref: 'U7', sym: 'Sensor_Temperature:TMP1075DSG', fp: 'Package_SON:Texas_DSG0008A_WSON-8-1EP_2x2mm_P0.5mm_EP0.9x1.6mm_ThermalVias', value: 'TMP1075', mpn: 'TI TMP1075DSGR',
  nets: { 1: 'I2C_SDA', 2: 'I2C_SCL', 3: null, 4: 'GND', 5: 'GND', 6: 'GND', 7: 'GND', 8: 'V3V3', 9: 'GND' } });
C('100n', 'V3V3', 'GND');
R('4.7k', 'V3V3', 'I2C_SDA');
R('4.7k', 'V3V3', 'I2C_SCL');

// =====================================================================================
sheet = 'site';
// KSZ8795: porty 1–3 přes T1–T3 na konektory, port 4 přes T5–T4 (zády k sobě) na Ethernet CM5, port 5 nepoužit
const KSZ = { 1: 'V1V2_A', 26: 'V1V2', 42: 'V1V2', 73: 'V1V2', 2: 'V3V3_A', 12: 'V3V3_A', 76: 'V3V3_A', 34: 'V3V3', 48: 'V3V3', 70: 'V3V3',
  3: 'GND', 21: 'GND', 78: 'GND', 27: 'GND', 33: 'GND', 47: 'GND', 61: 'GND', 71: 'GND',
  4: 'SW1_RXP', 5: 'SW1_RXM', 6: 'SW1_TXP', 7: 'SW1_TXM', 8: 'SW2_RXP', 9: 'SW2_RXM', 10: 'SW2_TXP', 11: 'SW2_TXM',
  13: 'SW3_RXP', 14: 'SW3_RXM', 15: 'SW3_TXP', 16: 'SW3_TXM', 17: 'SW4_RXP', 18: 'SW4_RXM', 19: 'SW4_TXP', 20: 'SW4_TXM',
  72: 'KSZ_RST_N', 77: 'KSZ_ISET', 79: 'KSZ_XI', 80: 'KSZ_XO', 66: 'KSZ_SPIQ' };
main({ ref: 'U8', sym: 'CB3:KSZ8795CLX', fp: 'Package_QFP:LQFP-80_12x12mm_P0.5mm', value: 'KSZ8795CLX', mpn: 'Microchip KSZ8795CLXIC', nets: KSZ, ncRest: true });
FB('V1V2', 'V1V2_A');
FB('V3V3', 'V3V3_A');
C('10u', 'V1V2', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 10 µF 10 V X5R 0805' });
C('10u', 'V3V3_A', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 10 µF 10 V X5R 0805' });
C('10u', 'V3V3', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 10 µF 10 V X5R 0805' });
for (const n of ['V1V2_A', 'V1V2', 'V1V2', 'V1V2', 'V3V3_A', 'V3V3_A', 'V3V3_A', 'V3V3', 'V3V3', 'V3V3']) C('100n', n, 'GND');
R('12.4k', 'KSZ_ISET', 'GND', { mpn: 'rezistor 12,4 kΩ 1 % 0402 (ISET)' });
R('4.7k', 'KSZ_SPIQ', 'GND', { mpn: 'rezistor 4,7 kΩ 0402 (strap: SPI klient)' });
R('10k', 'V3V3', 'KSZ_RST_N');
C('100n', 'KSZ_RST_N', 'GND');
add({ ref: 'Y1', sym: 'Device:Crystal_GND24', fp: 'Crystal:Crystal_SMD_3225-4Pin_3.2x2.5mm', value: '25MHz', mpn: 'Abracon ABM8-25.000MHZ-B2-T (18 pF, ±30 ppm)',
  nets: { 1: 'KSZ_XI', 3: 'KSZ_XO', 2: 'GND', 4: 'GND' } });
C('27p', 'KSZ_XI', 'GND', { mpn: 'kondenzátor 27 pF C0G' });
C('27p', 'KSZ_XO', 'GND', { mpn: 'kondenzátor 27 pF C0G' });

// porty k senzorům: transformátor, Bob Smith zakončení, spínač 12 V s omezením proudu, konektor
const PORTS = [['L', 1, 'J4', 'U9'], ['3D', 2, 'J5', 'U10'], ['P', 3, 'J6', 'U11']];
for (const [n, sw, j, u] of PORTS) {
  const t = `T${sw}`;
  main({ ref: t, sym: 'Transformer:PT61017PEL', fp: 'Transformer_SMD:Transformer_Ethernet_Bourns_PT61017PEL', value: 'PT61017PEL', mpn: 'Bourns PT61017PEL (10/100, 1:1)',
    nets: { 1: `SW${sw}_TXP`, 3: `SW${sw}_TXM`, 2: `${t}_CTD`, 6: `SW${sw}_RXP`, 8: `SW${sw}_RXM`, 7: `${t}_CTR`,
      16: `ETH${n}_TX_P`, 14: `ETH${n}_TX_N`, 15: `${t}_CMT`, 11: `ETH${n}_RX_P`, 9: `ETH${n}_RX_N`, 10: `${t}_CMR` } });
  C('100n', `${t}_CTD`, 'GND');
  C('100n', `${t}_CTR`, 'GND');
  R('75', `${t}_CMT`, `${t}_BS`);
  R('75', `${t}_CMR`, `${t}_BS`);
  C('1n 2kV', `${t}_BS`, 'GND', { fp: FP.C1206, mpn: 'kondenzátor 1 nF 2 kV X7R 1206' });
  main({ ref: u, sym: 'CB3:TPS1H100A', fp: 'Package_SO:TSSOP-14-1EP_4.4x5mm_P0.65mm', value: 'TPS1H100A-Q1', mpn: 'TI TPS1H100AQPWPRQ1 (verze A, výstup ST)',
    nets: { 1: null, 2: 'GND', 3: `PORT_EN_${n}`, 4: null, 5: `V12_P${n}`, 6: `V12_P${n}`, 7: `V12_P${n}`, 8: 'V12', 9: 'V12', 10: 'V12', 11: null,
      12: 'DIAG_EN', 13: `${u}_CL`, 14: `PORT_ST_${n}`, 15: 'GND' } });
  R('1.65k', `${u}_CL`, 'GND', { mpn: 'rezistor 1,65 kΩ 1 % 0402 (omezení proudu ~1,5 A)' });
  R('10k', 'V3V3', `PORT_ST_${n}`);
  R('100k', `PORT_EN_${n}`, 'GND');
  C('100n', 'V12', 'GND', { fp: FP.C0603, mpn: 'kondenzátor 100 nF 50 V X7R 0603' });
  C('1u', `V12_P${n}`, 'GND', { fp: FP.C0805, mpn: 'kondenzátor 1 µF 50 V X7R 0805' });
  main({ ref: j, sym: 'Connector_Generic:Conn_01x08', fp: 'Connector_JST:JST_GH_SM08B-GHS-TB_1x08-1MP_P1.25mm_Horizontal', value: `PORT ${n}`, mpn: 'JST SM08B-GHS-TB',
    nets: { 1: `V12_P${n}`, 2: `V12_P${n}`, 3: 'GND', 4: 'GND', 5: `ETH${n}_TX_P`, 6: `ETH${n}_TX_N`, 7: `ETH${n}_RX_P`, 8: `ETH${n}_RX_N`, MP: 'GND' } });
}
R('10k', 'V3V3', 'DIAG_EN', { anchor: 'U9' });
// spojení přepínač (port 4) – CM5 dvěma transformátory zády k sobě (jako krátký kabel)
main({ ref: 'T5', sym: 'Transformer:PT61017PEL', fp: 'Transformer_SMD:Transformer_Ethernet_Bourns_PT61017PEL', value: 'PT61017PEL', mpn: 'Bourns PT61017PEL (10/100, 1:1)',
  nets: { 1: 'SW4_TXP', 3: 'SW4_TXM', 2: 'T5_CTD', 6: 'SW4_RXP', 8: 'SW4_RXM', 7: 'T5_CTR', 16: 'LINK_A_P', 14: 'LINK_A_N', 15: 'LINK_CMA', 11: 'LINK_B_P', 9: 'LINK_B_N', 10: 'LINK_CMB' } });
C('100n', 'T5_CTD', 'GND');
C('100n', 'T5_CTR', 'GND');
C('10n', 'LINK_CMA', 'GND');
C('10n', 'LINK_CMB', 'GND');
main({ ref: 'T4', sym: 'Transformer:PT61017PEL', fp: 'Transformer_SMD:Transformer_Ethernet_Bourns_PT61017PEL', value: 'PT61017PEL', mpn: 'Bourns PT61017PEL (10/100, 1:1)',
  nets: { 1: 'ETHC_TRD0_P', 3: 'ETHC_TRD0_N', 2: 'T4_CTD', 6: 'ETHC_TRD1_P', 8: 'ETHC_TRD1_N', 7: 'T4_CTR', 16: 'LINK_A_P', 14: 'LINK_A_N', 15: 'LINK_CMA', 11: 'LINK_B_P', 9: 'LINK_B_N', 10: 'LINK_CMB' } });
C('100n', 'T4_CTD', 'GND');
C('100n', 'T4_CTR', 'GND');

// =====================================================================================
sheet = 'radio';
// GNSS ZED-F9R
const ZED = { 1: 'GND', 3: 'GND', 12: 'GND', 14: 'GND', 32: 'GND', 37: 'GND', 41: 'GND', 48: 'GND',
  2: 'GNSS_RF_IN', 7: 'GNSS_VCC_RF', 33: 'V3V3_GNSS', 34: 'V3V3_GNSS', 36: 'V3V3_GNSS', 38: 'GND',
  42: 'GNSS_TXD', 43: 'GNSS_RXD', 49: 'GNSS_RESET_N', 50: 'GNSS_SAFEBOOT', 53: 'GNSS_PPS' };
main({ ref: 'M2', sym: 'CB3:ZED-F9R', fp: 'RF_GPS:ublox_ZED', value: 'ZED-F9R', mpn: 'u-blox ZED-F9R-02B', nets: ZED, ncRest: true });
FB('V3V3', 'V3V3_GNSS');
C('10u', 'V3V3_GNSS', 'GND', { fp: FP.C0805, mpn: 'kondenzátor 10 µF 10 V X5R 0805' });
C('100n', 'V3V3_GNSS', 'GND');
// napájení aktivní antény z VCC_RF přes 10 Ω a tlumivku, oddělovací kondenzátor k RF_IN
R('10', 'GNSS_VCC_RF', 'GNSS_ANT_DC', { mpn: 'rezistor 10 Ω 0402' });
L('47n', 'GNSS_ANT_DC', 'GNSS_RF', { fp: 'Inductor_SMD:L_0402_1005Metric', mpn: 'Murata LQG15HS47NJ02 (47 nH)' });
C('100p', 'GNSS_RF', 'GNSS_RF_IN', { mpn: 'kondenzátor 100 pF C0G 0402 (oddělení DC)' });
add({ ref: 'J7', sym: 'Connector:Conn_Coaxial', fp: 'Connector_Coaxial:U.FL_Hirose_U.FL-R-SMT-1_Vertical', value: 'GNSS', mpn: 'Hirose U.FL-R-SMT-1(10)', nets: { 1: 'GNSS_RF', 2: 'GND' } });
TP('GNSS_SAFEBOOT');

// LTE modem v M.2 Key B, napájení 3,8 V, USB 2.0, SIM
const M2B = { 2: 'V3V8', 4: 'V3V8', 70: 'V3V8', 72: 'V3V8', 74: 'V3V8',
  3: 'GND', 5: 'GND', 11: 'GND', 27: 'GND', 33: 'GND', 39: 'GND', 45: 'GND', 51: 'GND', 57: 'GND', 71: 'GND', 73: 'GND',
  7: 'MODEM_USB_P', 9: 'MODEM_USB_N', 6: 'MODEM_ON', 67: 'MODEM_RESET_N', 36: 'SIM_VCC', 30: 'SIM_RST', 32: 'SIM_CLK', 34: 'SIM_IO',
  M2: 'GND', S1: 'GND', S2: 'GND' };   // M2 = sloupek pro kartu 42 mm (3042), S1/S2 = pájecí úchyty
main({ ref: 'J8', sym: 'Connector:Bus_M.2_Socket_B', fp: 'CB3:M.2_Socket_KeyB_TopMount_H4.2', value: 'M.2 Key B', mpn: 'TE 2199230-3 (M.2 Key B, 4,2 mm) – ověřit klíč na výkresu', nets: M2B, ncRest: true });
R('10k', 'V3V8', 'MODEM_ON', { mpn: 'rezistor 10 kΩ 0402 (FULL_CARD_POWER_OFF# = zapnuto)' });
for (let i = 0; i < 2; i++) C('47u', 'V3V8', 'GND', { fp: FP.C1210, mpn: 'kondenzátor 47 µF 10 V X5R 1210' });
C('100n', 'V3V8', 'GND');
add({ ref: 'Q5', sym: 'Transistor_FET:BSS138', fp: FP.SOT23, value: 'BSS138', mpn: 'onsemi BSS138', nets: { 1: 'MODEM_RESET', 2: 'GND', 3: 'MODEM_RESET_N' } });
R('100k', 'MODEM_RESET', 'GND');
main({ ref: 'J9', sym: 'Connector:SIM_Card', fp: 'Connector_Card:nanoSIM_GCT_SIM8060-6-0-14-00', value: 'nano-SIM', mpn: 'GCT SIM8060-6-0-14-00',
  nets: { 1: 'SIM_VCC', 2: 'SIM_RST', 3: 'SIM_CLK', 5: 'GND', 6: null, 7: 'SIM_IO', SH: 'GND' } });
C('100n', 'SIM_VCC', 'GND');
add({ ref: 'D6', sym: 'Power_Protection:TPD3E001DRLR', fp: 'Package_TO_SOT_SMD:SOT-553', value: 'TPD3E001', mpn: 'TI TPD3E001DRLR', nets: { 1: 'SIM_RST', 2: 'SIM_CLK', 4: 'SIM_IO', 3: 'GND', 5: 'SIM_VCC' } });

// CAN: MCP2518FD (SPI0) + TCAN1042V (pinově shodný s TJA1042T/3), jen poslech
main({ ref: 'U12', sym: 'Interface_CAN_LIN:MCP2518FD-xQBB', fp: 'Package_DFN_QFN:DFN-14-1EP_3x4.5mm_P0.65mm_EP1.65x4.25mm', value: 'MCP2518FD', mpn: 'Microchip MCP2518FDT-E/QBB',
  nets: { 1: 'CAN_TXD', 2: 'CAN_RXD', 3: null, 4: 'CAN_INT', 5: 'CAN_OSC2', 6: 'CAN_OSC1', 7: 'GND', 8: null, 9: null, 10: 'CAN_SCK', 11: 'CAN_SDI', 12: 'CAN_SDO', 13: 'CAN_CS', 14: 'V3V3', 15: 'GND' } });
C('100n', 'V3V3', 'GND');
R('10k', 'V3V3', 'CAN_INT');
add({ ref: 'Y2', sym: 'Device:Crystal_GND24', fp: 'Crystal:Crystal_SMD_3225-4Pin_3.2x2.5mm', value: '40MHz', mpn: 'Abracon ABM8-40.000MHZ-B2-T (18 pF)', nets: { 1: 'CAN_OSC1', 3: 'CAN_OSC2', 2: 'GND', 4: 'GND' } });
C('27p', 'CAN_OSC1', 'GND', { mpn: 'kondenzátor 27 pF C0G' });
C('27p', 'CAN_OSC2', 'GND', { mpn: 'kondenzátor 27 pF C0G' });
main({ ref: 'U13', sym: 'Interface_CAN_LIN:TJA1042T-3', fp: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm', value: 'TCAN1042V', mpn: 'TI TCAN1042VDRQ1 (pin 5 = VIO)',
  nets: { 1: 'CAN_TXD', 2: 'GND', 3: 'V5', 4: 'CAN_RXD', 5: 'V3V3', 6: 'CAN_L', 7: 'CAN_H', 8: 'CAN_STB' } });
C('100n', 'V5', 'GND');
C('100n', 'V3V3', 'GND');
R('10k', 'CAN_STB', 'GND');
add({ ref: 'D7', sym: 'Power_Protection:NUP2105L', fp: FP.SOT23, value: 'PESD2CANFD24V', mpn: 'Nexperia PESD2CANFD24V-T (SOT-23)', nets: { 1: 'CAN_L', 2: 'CAN_H', 3: 'GND' } });

// =====================================================================================
sheet = 'obsluha';
main({ ref: 'J10', sym: 'Connector_Generic:Conn_01x04', fp: 'Connector_JST:JST_GH_SM04B-GHS-TB_1x04-1MP_P1.25mm_Horizontal', value: 'USB servis', mpn: 'JST SM04B-GHS-TB',
  nets: { 1: 'VBUS_SERV', 2: 'USB_SERV_N', 3: 'USB_SERV_P', 4: 'GND', MP: 'GND' } });
add({ ref: 'D8', sym: 'Power_Protection:TPD4E05U06DQA', fp: 'Package_SON:USON-10_2.5x1.0mm_P0.5mm', value: 'TPD4E05U06', mpn: 'TI TPD4E05U06DQAR',
  nets: { 1: 'USB_SERV_P', 2: 'USB_SERV_N', 3: 'GND', 4: null, 5: null, 6: null, 7: null, 8: 'GND', 9: null, 10: null } });
C('100n', 'VBUS_SERV', 'GND');
add({ ref: 'SW1', sym: 'Switch:SW_Push', fp: 'Button_Switch_SMD:SW_Push_1P1T_NO_CK_KMR2', value: 'nRPIBOOT', mpn: 'C&K KMR221GLFS', nets: { 1: 'nRPIBOOT', 2: 'GND' } });
add({ ref: 'SW2', sym: 'Switch:SW_Push', fp: 'Button_Switch_SMD:SW_Push_1P1T_NO_CK_KMR2', value: 'PWR_BTN', mpn: 'C&K KMR221GLFS', nets: { 1: 'PWR_BTN', 2: 'GND' } });
main({ ref: 'J11', sym: 'Connector_Generic:Conn_01x03', fp: 'Connector_JST:JST_GH_SM03B-GHS-TB_1x03-1MP_P1.25mm_Horizontal', value: 'UART debug', mpn: 'JST SM03B-GHS-TB',
  nets: { 1: 'DBG_TX', 2: 'DBG_RX', 3: 'GND', MP: 'GND' } });
// LED: napájení (trvale), aktivita CM5, stav (GPIO5)
add({ ref: 'LED1', sym: 'Device:LED', fp: FP.LED0603, value: 'GREEN', mpn: 'Würth 150060VS75000', nets: { 1: 'GND', 2: 'LED1_A' } });
R('1k', 'V3V3', 'LED1_A');
add({ ref: 'LED2', sym: 'Device:LED', fp: FP.LED0603, value: 'YELLOW', mpn: 'Würth 150060YS75000', nets: { 1: 'LED_nACT', 2: 'LED2_A' } });
R('1k', 'CM5_3V3', 'LED2_A');
add({ ref: 'LED3', sym: 'Device:LED', fp: FP.LED0603, value: 'RED', mpn: 'Würth 150060RS75000', nets: { 1: 'GND', 2: 'LED3_A' } });
R('1k', 'LED_STAT', 'LED3_A');
// montážní otvory (do země)
anchor = null;
for (let i = 1; i <= 4; i++) add({ ref: `MH${i}`, sym: 'Mechanical:MountingHole_Pad', fp: 'MountingHole:MountingHole_3.2mm_M3_Pad_Via', value: 'M3', mpn: 'otvor M3', nets: { 1: 'GND' } });

// Ruční označení (např. C1) mohou kolidovat s automatickým číslováním: automatická součástka
// dostane další volné číslo, ostatní označení se nemění (deska je podle nich rozmístěná).
{
  const used = new Set(parts.filter((p) => !p.autoRef).map((p) => p.ref));
  for (const p of parts) {
    if (!p.autoRef || !used.has(p.ref)) { used.add(p.ref); continue; }
    let n = Math.max(...parts.filter((q) => q.ref.replace(/\d+$/, '') === p.prefix).map((q) => +q.ref.slice(p.prefix.length)));
    while (used.has(`${p.prefix}${++n}`));
    p.ref = `${p.prefix}${n}`; used.add(p.ref);
  }
  const dup = parts.map((p) => p.ref).filter((r, i, a) => a.indexOf(r) !== i);
  if (dup.length) throw new Error(`duplicitní označení: ${dup.join(', ')}`);
}
export const PARTS = parts;
export const POWER_FLAGS = PWR_FLAGS;
