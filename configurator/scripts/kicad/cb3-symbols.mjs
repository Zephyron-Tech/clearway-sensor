// Vlastní symboly desky CB3 pro součástky, které knihovny KiCadu nemají. Vývody přesně podle datasheetů:
//  KSZ8795CLX – Microchip DS00002112D, tab. 2-1 (LQFP-80)
//  ZED-F9R    – u-blox UBX-19054459 R06, kap. 3.1 (LGA-54)
//  TPS1H100A  – TI SLVSCM2D, verze A (HTSSOP-14 PWP, ST = stavový výstup), tepelná ploška = 15
//  CM5        – převzatý z referenčního projektu Raspberry Pi CM5 IO Board (CM5IO.kicad_sym)
import { str } from '../sexpr.mjs';
import { getSymbol } from './symlib.mjs';

const KSZ8795 = [
  [1, 'VDD12A', 'power_in'], [2, 'VDDAT', 'power_in'], [3, 'GNDA', 'power_in'], [4, 'RXP1'], [5, 'RXM1'], [6, 'TXP1'], [7, 'TXM1'],
  [8, 'RXP2'], [9, 'RXM2'], [10, 'TXP2'], [11, 'TXM2'], [12, 'VDDAT', 'power_in'], [13, 'RXP3'], [14, 'RXM3'], [15, 'TXP3'], [16, 'TXM3'],
  [17, 'RXP4'], [18, 'RXM4'], [19, 'TXP4'], [20, 'TXM4'], [21, 'GNDA', 'power_in'], [22, 'NC', 'no_connect'], [23, 'INTR_N'], [24, 'LED3_1'], [25, 'LED3_0'],
  [26, 'VDD12D', 'power_in'], [27, 'GNDD', 'power_in'], [28, 'LED4_1'], [29, 'TXEN5'], [30, 'TXD5_0'], [31, 'LED4_0'], [32, 'TXD5_1'], [33, 'GNDD', 'power_in'],
  [34, 'VDDIO', 'power_in'], [35, 'TXD5_2'], [36, 'TXD5_3'], [37, 'TXER5'], [38, 'TXD5_4'], [39, 'TXD5_5'], [40, 'TXD5_6'], [41, 'TXD5_7'], [42, 'VDD12D', 'power_in'],
  [43, 'TXC5'], [44, 'RXC5'], [45, 'RXD5_0'], [46, 'RXD5_1'], [47, 'GNDD', 'power_in'], [48, 'VDDIO', 'power_in'], [49, 'RXD5_2'], [50, 'RXD5_3'], [51, 'RXDV5'],
  [52, 'RXER5'], [53, 'CRS5'], [54, 'COL5'], [55, 'REFCLKO'], [56, 'PME_N'], [57, 'RXD5_4'], [58, 'RXD5_5'], [59, 'RXD5_6'], [60, 'RXD5_7'], [61, 'GNDD', 'power_in'],
  [62, 'LED2_1'], [63, 'LED2_0'], [64, 'LED1_1'], [65, 'LED1_0'], [66, 'SPIQ'], [67, 'SCL_MDC'], [68, 'SDA_MDIO'], [69, 'SPIS_N'], [70, 'VDDIO', 'power_in'],
  [71, 'GNDD', 'power_in'], [72, 'RST_N'], [73, 'VDD12D', 'power_in'], [74, 'NC', 'no_connect'], [75, 'ATST', 'no_connect'], [76, 'VDDAT', 'power_in'], [77, 'ISET'],
  [78, 'GNDA', 'power_in'], [79, 'XI'], [80, 'XO'],
];

const ZEDF9R = [
  [1, 'GND', 'power_in'], [2, 'RF_IN'], [3, 'GND', 'power_in'], [4, 'ANT_DETECT'], [5, 'ANT_OFF'], [6, 'ANT_SHORT_N'], [7, 'VCC_RF', 'power_out'],
  ...[8, 9, 10, 11].map(n => [n, 'Reserved', 'no_connect']), [12, 'GND', 'power_in'], [13, 'Reserved', 'no_connect'], [14, 'GND', 'power_in'],
  ...[15, 16, 17, 18].map(n => [n, 'Reserved', 'no_connect']), [19, 'GEOFENCE_STAT'], [20, 'RTK_STAT'], [21, 'Reserved', 'no_connect'], [22, 'WT'], [23, 'DIR'],
  [24, 'Reserved', 'no_connect'], [25, 'Reserved', 'no_connect'], [26, 'RXD2'], [27, 'TXD2'], ...[28, 29, 30, 31].map(n => [n, 'Reserved', 'no_connect']),
  [32, 'GND', 'power_in'], [33, 'VCC', 'power_in'], [34, 'VCC', 'power_in'], [35, 'Reserved', 'no_connect'], [36, 'V_BCKP', 'power_in'], [37, 'GND', 'power_in'],
  [38, 'V_USB'], [39, 'USB_DM'], [40, 'USB_DP'], [41, 'GND', 'power_in'], [42, 'TXD/SPI_MISO'], [43, 'RXD/SPI_MOSI'], [44, 'SDA/SPI_CS_N'], [45, 'SCL/SPI_CLK'],
  [46, 'TX_READY'], [47, 'D_SEL'], [48, 'GND', 'power_in'], [49, 'RESET_N'], [50, 'SAFEBOOT_N'], [51, 'EXT_INT'], [52, 'Reserved', 'no_connect'], [53, 'TIMEPULSE'],
  [54, 'Reserved', 'no_connect'],
];

const TPS1H100A = [
  [1, 'NC', 'no_connect'], [2, 'GND', 'power_in'], [3, 'IN'], [4, 'NC', 'no_connect'], [5, 'OUT', 'power_out'], [6, 'OUT', 'passive'], [7, 'OUT', 'passive'],
  [8, 'VS', 'power_in'], [9, 'VS', 'passive'], [10, 'VS', 'passive'], [11, 'NC', 'no_connect'], [12, 'DIAG_EN'], [13, 'CL'], [14, 'ST'], [15, 'PAD', 'passive'],
];

/** Obdélníkový symbol: první polovina vývodů vlevo, druhá vpravo, rozteč 2,54 mm. */
function rectSymbol(name, refPrefix, pins, description) {
  const n = pins.length, left = Math.ceil(n / 2);
  const rows = Math.max(left, n - left);
  const h = (rows + 1) * 2.54, w = 30.48;
  const top = (rows - 1) * 2.54 / 2;
  const fx = (v) => String(Math.round(v * 100) / 100);
  const pinNodes = pins.map(([num, pname, type = 'passive'], i) => {
    const onLeft = i < left;
    const row = onLeft ? i : i - left;
    const y = top - row * 2.54;
    const x = onLeft ? -w / 2 - 5.08 : w / 2 + 5.08;
    const ang = onLeft ? 0 : 180;
    return ['pin', type, 'line', ['at', fx(x), fx(y), String(ang)], ['length', '5.08'],
      ['name', str(pname), ['effects', ['font', ['size', '1.27', '1.27']]]], ['number', str(String(num)), ['effects', ['font', ['size', '1.27', '1.27']]]]];
  });
  const prop = (k, v, y, hide = false) => ['property', str(k), str(v), ['at', '0', fx(y), '0'], ['effects', ['font', ['size', '1.27', '1.27']], ...(hide ? [['hide', 'yes']] : [])]];
  return {
    id: `CB3:${name}`, name,
    node: ['symbol', str(`CB3:${name}`), ['pin_names', ['offset', '1.016']], ['exclude_from_sim', 'no'], ['in_bom', 'yes'], ['on_board', 'yes'],
      prop('Reference', refPrefix, h / 2 + 1.27), prop('Value', name, -h / 2 - 1.27), prop('Footprint', '', 0, true), prop('Datasheet', '', 0, true),
      prop('Description', description, 0, true),
      ['symbol', str(`${name}_0_1`), ['rectangle', ['start', fx(-w / 2), fx(h / 2)], ['end', fx(w / 2), fx(-h / 2)], ['stroke', ['width', '0.254'], ['type', 'default']], ['fill', ['type', 'background']]]],
      ['symbol', str(`${name}_1_1`), ...pinNodes]],
  };
}

export function customSymbols(cm5ioLib) {
  const cm5 = getSymbol(cm5ioLib, 'CB3', 'ComputeModule5-CM5');
  return {
    'CB3:KSZ8795CLX': rectSymbol('KSZ8795CLX', 'U', KSZ8795, 'Microchip KSZ8795CLX, 5portový přepínač Ethernet (DS00002112D)'),
    'CB3:ZED-F9R': rectSymbol('ZED-F9R', 'M', ZEDF9R, 'u-blox ZED-F9R, GNSS s dead reckoningem (UBX-19054459)'),
    'CB3:TPS1H100A': rectSymbol('TPS1H100A', 'U', TPS1H100A, 'TI TPS1H100-Q1 verze A, spínač 40 V s omezením proudu (SLVSCM2D)'),
    'CB3:ComputeModule5-CM5': cm5,
  };
}
