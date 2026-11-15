// Přiřazení součástek desky CB3 ke knihovnám KiCadu a k sítím.
// sym / fp = [knihovna, regulární výraz názvu]; první shoda v instalovaných knihovnách vyhrává.
// nets = { číslo nebo název vývodu: síť }. Zapojují se jen vývody, u kterých je zapojení jisté
// (konektory podle našeho rozložení, pasivní součástky, jednoduché IO). Zbytek doplní návrhář
// podle doporučeného zapojení v datasheetu – je to popsané v poznámce na listu.

const R = (lib, re) => [lib, re];

// listy schématu = bloky desky
export const SHEETS = {
  napajeni: { title: 'Napájení 9–32 V', file: 'napajeni.kicad_sch' },
  vypocet: { title: 'Počítač CM5', file: 'vypocet.kicad_sch' },
  site: { title: 'Ethernet a porty senzorů', file: 'site.kicad_sch' },
  radio: { title: 'GNSS, LTE, CAN', file: 'radio.kicad_sch' },
  obsluha: { title: 'Obsluha a ladění', file: 'obsluha.kicad_sch' },
};

// Poznámky na listech: co je potřeba dokreslit
export const NOTES = {
  napajeni: [
    'Vstup: J1.1 KL30 → F1 → D1 (TVS proti kostře) → U1 LM74800-Q1 s Q1 (ideální dioda) a Q2 (odpojení) → VIN_P.',
    'U2 LM5176 + Q3–Q6 + L1: buck-boost VIN_P → V12 (12 V / 3 A). Zapojení podle datasheetu, kap. Application and Implementation; spočítat ve WEBENCH.',
    'U3 TPS54560B + L2: buck VIN_P → V5 (5 V / 5 A). Kompenzace a dělič podle datasheetu.',
    'U4 TPS62130 + L3: V5 → V3V8 (3,8 V / 3 A) pro LTE modem. U14 TPS62130 + L5: V5 → V3V3 (3,3 V / 3 A).',
    'U5: EN měničů U2, U3 = KL15 (přes dělič a Zener) NEBO PWR_HOLD z CM5 (GPIO27).',
    'U6 LTC3226 + SC1, SC2: záloha V5 při ztrátě napájení. Ověřit proud zálohy (CM5 + modem ~2 A).',
  ],
  vypocet: [
    'M1 Raspberry Pi CM5 přes J2, J3 (Hirose DF40C-100DS). Zapojení vývodů převzít z CM5 datasheetu a referenčního návrhu CM5 IO Board.',
    'Napájení CM5 z V5, RTC článek BT1 na vývod BAT. Ethernet CM5 → U8 port 4 (síť ETH_CM5_*).',
    'GPIO: GNSS UART0 (14/15), PPS 18, RESET 23; CAN SPI0 (8–11) + INT 25; I2C 2/3; KL15 17; PWR_HOLD 27; porty EN 16/20/21, FAULT 19/26/12; modem RESET 22, W_DISABLE 24, PWR 7; LED 5/6/13.',
  ],
  site: [
    'U8 KSZ8795: porty 1–3 → T1–T3 → J4–J6 (skener L, 3D lidar, skener P). Port 4 → Ethernet CM5 kapacitní vazbou PHY–PHY (ověřit v aplikační poznámce Microchip), port 5 nepoužit.',
    'U9–U11 TPS1H100-Q1: V12 → V12_PORTx, EN z CM5, ST (diagnostika) do CM5. Omezení proudu nastavit na ~1,5 A.',
    'Diferenciální páry 100 Ω, symetrické délky, transformátory u konektorů.',
  ],
  radio: [
    'M2 ZED-F9R: UART1 → CM5 UART0, TIMEPULSE → GPIO18, RESET_N → GPIO23. Anténa J7 přes VCC_RF a L4 (napájení aktivní antény), RF vedení 50 Ω.',
    'J8 M.2 Key B + M3 EM05-G: USB 2.0 z CM5, napájení V3V8, SIM z J9 přes D5, RESET/W_DISABLE z CM5.',
    'U12 MCP2518FD (SPI0, krystal Y2 40 MHz) → U13 TCAN1042 → CAN_H / CAN_L na J1. Jen poslech (listen-only).',
  ],
  obsluha: [
    'J10: servisní USB 2.0 z panelového USB-C → USB OTG CM5 (rpiboot), ochrana D7.',
    'SW1 nRPIBOOT, SW2 vypnutí. LED1–3 přes odpory 1 kΩ z GPIO. J11 ladicí UART (3,3 V).',
  ],
};

export const MAP = {
  // ---------- napájení ----------
  J1: { sym: R('Connector_Generic', /^Conn_02x03_Odd_Even$/), fp: R('Connector_Molex', /Micro-Fit_3\.0_43045-0612_2x03_P3\.00mm_Vertical$/),
    value: 'Micro-Fit 2x3', nets: { 1: 'KL30', 2: 'GND', 3: 'KL15', 4: 'CAN_H', 5: 'CAN_L', 6: 'GND' } },
  F1: { sym: R('Device', /^Fuse$/), fp: R('Fuse', /^Fuse_2410_/), value: '5A slow', nets: { 1: 'KL30', 2: 'VIN_F' } },
  D1: { sym: R('Device', /^D_TVS$/), fp: R('Diode_SMD', /D_SMB|DO-218/), value: 'SM8S36A', nets: { 1: 'VIN_F', 2: 'GND' } },
  U1: { sym: R('Power_Management', /^LM74800/), fp: R('Package_SON', /WSON-12.*3x3/), value: 'LM74800-Q1' },
  Q1: { sym: R('Device', /^Q_NMOS$/), fp: R('Package_TO_SOT_SMD', /LFPAK56/), value: 'NMOS 60V 3mOhm' },
  Q2: { sym: R('Device', /^Q_NMOS$/), fp: R('Package_TO_SOT_SMD', /LFPAK56/), value: 'NMOS 60V 3mOhm' },
  C1: { sym: R('Device', /^C_Polarized$/), fp: R('Capacitor_SMD', /CP_Elec_10x10\.5/), value: '100u 63V', nets: { 1: 'VIN_P', 2: 'GND' } },
  C2: { sym: R('Device', /^C_Polarized$/), fp: R('Capacitor_SMD', /CP_Elec_10x10\.5/), value: '100u 63V', nets: { 1: 'VIN_P', 2: 'GND' } },
  U2: { sym: R('Regulator_Switching', /^LM5176PWP$/), fp: R('Package_SO', /HTSSOP-28.*4\.4x9\.7/), value: 'LM5176' },
  Q3: { sym: R('Device', /^Q_NMOS$/), fp: R('Package_TO_SOT_SMD', /LFPAK56/), value: 'NMOS 60V' },
  Q4: { sym: R('Device', /^Q_NMOS$/), fp: R('Package_TO_SOT_SMD', /LFPAK56/), value: 'NMOS 60V' },
  Q5: { sym: R('Device', /^Q_NMOS$/), fp: R('Package_TO_SOT_SMD', /LFPAK56/), value: 'NMOS 60V' },
  Q6: { sym: R('Device', /^Q_NMOS$/), fp: R('Package_TO_SOT_SMD', /LFPAK56/), value: 'NMOS 60V' },
  L1: { sym: R('Device', /^L$/), fp: R('Inductor_SMD', /Coilcraft_XAL1010/), value: '4.7u', nets: { 1: 'BB_SW1', 2: 'BB_SW2' } },
  C3: { sym: R('Device', /^C_Polarized$/), fp: R('Capacitor_SMD', /CP_Elec_8x10/), value: '220u 25V', nets: { 1: 'V12', 2: 'GND' } },
  U3: { sym: R('Regulator_Switching', /^TPS54560/), fp: R('Package_SO', /^SOIC-8-1EP_3\.9x4\.9mm/), value: 'TPS54560B' },
  L2: { sym: R('Device', /^L$/), fp: R('Inductor_SMD', /Coilcraft_XAL7070/), value: '6.8u', nets: { 1: 'SW_5V', 2: 'V5' } },
  C4: { sym: R('Device', /^C_Polarized$/), fp: R('Capacitor_SMD', /CP_Elec_8x10/), value: '330u 10V', nets: { 1: 'V5', 2: 'GND' } },
  U4: { sym: R('Regulator_Switching', /^TPS62130/), fp: R('Package_DFN_QFN', /QFN-16-1EP_3x3mm_P0\.5mm_EP1\.68/), value: 'TPS62130 3V8' },
  L3: { sym: R('Device', /^L$/), fp: R('Inductor_SMD', /Coilcraft_XAL4020/), value: '1u', nets: { 1: 'SW_3V8', 2: 'V3V8' } },
  U14: { sym: R('Regulator_Switching', /^TPS62130/), fp: R('Package_DFN_QFN', /QFN-16-1EP_3x3mm_P0\.5mm_EP1\.68/), value: 'TPS62130 3V3' },
  L5: { sym: R('Device', /^L$/), fp: R('Inductor_SMD', /Coilcraft_XAL4020/), value: '1u', nets: { 1: 'SW_3V3', 2: 'V3V3' } },
  U5: { sym: R('74xGxx', /^74LVC1G32$/), fp: R('Package_TO_SOT_SMD', /^SOT-353_SC-70-5$/), value: '74LVC1G32' },
  U6: { sym: R('Power_Management', /^LTC3226/), fp: R('Package_DFN_QFN', /QFN-16-1EP_3x3mm/), value: 'LTC3226' },
  SC1: { sym: R('Device', /^C_Polarized$/), fp: R('Capacitor_THT', /CP_Radial_D10\.0mm/), value: '10F 2.7V', nets: { 1: 'VBACK', 2: 'SC_MID' } },
  SC2: { sym: R('Device', /^C_Polarized$/), fp: R('Capacitor_THT', /CP_Radial_D10\.0mm/), value: '10F 2.7V', nets: { 1: 'SC_MID', 2: 'GND' } },
  // ---------- počítač ----------
  J2: { sym: R('Connector_Generic', /^Conn_02x50_Odd_Even$/), fp: R('Connector_Hirose_DF40', /^Hirose_DF40C-100DS-0\.4V_2x50_P0\.4mm$/), value: 'DF40C-100DS (CM5 A)' },
  J3: { sym: R('Connector_Generic', /^Conn_02x50_Odd_Even$/), fp: R('Connector_Hirose_DF40', /^Hirose_DF40C-100DS-0\.4V_2x50_P0\.4mm$/), value: 'DF40C-100DS (CM5 B)' },
  M1: { sym: null, fp: null, value: 'Raspberry Pi CM5' },
  BT1: { sym: R('Device', /^Battery_Cell$/), fp: R('Battery', /Keystone_3034/), value: 'ML2032', nets: { 1: 'RTC_BAT', 2: 'GND' } },
  U7: { sym: R('Sensor_Temperature', /^TMP1075/), fp: R('Package_SON', /WSON-8.*2x2/), value: 'TMP1075' },
  // ---------- ethernet ----------
  U8: { sym: R('Interface_Ethernet', /^KSZ8795/), fp: R('Package_QFP', /^LQFP-80_12x12mm_P0\.5mm$/), value: 'KSZ8795CLX' },
  Y1: { sym: R('Device', /^Crystal_GND24$/), fp: R('Crystal', /Crystal_SMD_3225-4Pin_3\.2x2\.5mm$/), value: '25MHz' },
  ...Object.fromEntries([1, 2, 3].flatMap((i) => {
    const n = ['L', '3D', 'P'][i - 1];
    return [
      [`T${i}`, { sym: R('Transformer', /^HX1188/), fp: R('Package_SO', /^SOIC-16W_7\.5x10\.3mm_P1\.27mm$/), value: 'HX1188NL' }],
      [`U${8 + i}`, { sym: R('Power_Management', /^TPS1H100/), fp: R('Package_SO', /HTSSOP-14/), value: 'TPS1H100-Q1' }],
      [`D${1 + i}`, { sym: R('Power_Protection', /^RClamp0524P/), fp: R('Package_DFN_QFN', /DFN-10_1x2\.5mm_P0\.5mm/), value: 'RClamp0524P' }],
      [`J${3 + i}`, { sym: R('Connector_Generic', /^Conn_01x08$/), fp: R('Connector_JST', /JST_GH_SM08B-GHS-TB_1x08-1MP_P1\.25mm_Horizontal$/), value: `Port ${n}`,
        nets: { 1: `V12_P${n}`, 2: `V12_P${n}`, 3: 'GND', 4: 'GND', 5: `ETH${n}_TX_P`, 6: `ETH${n}_TX_N`, 7: `ETH${n}_RX_P`, 8: `ETH${n}_RX_N` } }],
    ];
  })),
  // ---------- rádio ----------
  M2: { sym: R('RF_GPS', /^ZED-F9/), fp: R('RF_GPS', /ublox_ZED/), value: 'ZED-F9R' },
  J7: { sym: R('Connector', /^Conn_Coaxial$/), fp: R('Connector_Coaxial', /^U\.FL_Hirose_U\.FL-R-SMT-1_Vertical$/), value: 'U.FL GNSS', nets: { 1: 'GNSS_RF', 2: 'GND' } },
  L4: { sym: R('Device', /^L$/), fp: R('Inductor_SMD', /^L_0603_1608Metric$/), value: '47n', nets: { 1: 'GNSS_VCC_RF', 2: 'GNSS_RF' } },
  J8: { sym: R('Connector', /^Bus_M\.2_Socket_B$/), fp: null, value: 'M.2 Key B (TE 2199230-4)' },
  M3: { sym: null, fp: null, value: 'Quectel EM05-G (do slotu J8)' },
  H1: { sym: R('Mechanical', /^MountingHole_Pad$/), fp: R('MountingHole', /^MountingHole_2\.2mm_M2_Pad$/), value: 'M.2 standoff', nets: { 1: 'GND' } },
  J9: { sym: R('Connector', /^SIM_Card$/), fp: R('Connector_Card', /nano.*SIM|SIM.*Nano/i), value: 'nano-SIM' },
  D5: { sym: R('Power_Protection', /^TPD3E001/), fp: R('Package_TO_SOT_SMD', /SOT-553|SOT-5X3/), value: 'TPD3E001' },
  U12: { sym: R('Interface_CAN_LIN', /^MCP2518FD/), fp: R('Package_DFN_QFN', /VDFN-14|DFN-14/), value: 'MCP2518FD' },
  // TCAN1042V má stejné vývody jako TJA1042T/3 (pin 5 = VIO)
  U13: { sym: R('Interface_CAN_LIN', /^TJA1042T-3$/), fp: R('Package_SO', /^SOIC-8_3\.9x4\.9mm_P1\.27mm$/), value: 'TCAN1042HGVDRQ1',
    nets: { TXD: 'CAN_TXD', RXD: 'CAN_RXD', VCC: 'V5', GND: 'GND', CANH: 'CAN_H', CANL: 'CAN_L', STB: 'CAN_STB', S: 'CAN_STB', VIO: 'V3V3' } },
  Y2: { sym: R('Device', /^Crystal_GND24$/), fp: R('Crystal', /Crystal_SMD_3225-4Pin_3\.2x2\.5mm$/), value: '40MHz' },
  D6: { sym: R('Power_Protection', /^NUP2105L$/), fp: R('Package_TO_SOT_SMD', /^SOT-23$/), value: 'PESD2CANFD24V (SOT-23 jako NUP2105L)' },
  // ---------- obsluha ----------
  J10: { sym: R('Connector_Generic', /^Conn_01x04$/), fp: R('Connector_JST', /JST_GH_SM04B-GHS-TB_1x04-1MP_P1\.25mm_Horizontal$/), value: 'USB servis',
    nets: { 1: 'VBUS_SERV', 2: 'USB_SERV_N', 3: 'USB_SERV_P', 4: 'GND' } },
  D7: { sym: R('Power_Protection', /^TPD4E05U06/), fp: R('Package_SON', /USON-10.*2\.5x1/), value: 'TPD4E05U06' },
  SW1: { sym: R('Switch', /^SW_Push$/), fp: R('Button_Switch_SMD', /^SW_Push_1P1T_NO_CK_KMR2$/), value: 'nRPIBOOT', nets: { 1: 'nRPIBOOT', 2: 'GND' } },
  SW2: { sym: R('Switch', /^SW_Push$/), fp: R('Button_Switch_SMD', /^SW_Push_1P1T_NO_CK_KMR2$/), value: 'PWR_BTN', nets: { 1: 'PWR_BTN', 2: 'GND' } },
  LED1: { sym: R('Device', /^LED$/), fp: R('LED_SMD', /^LED_0603_1608Metric$/), value: 'zelená', nets: { 1: 'GND', 2: 'LED_PWR' } },
  LED2: { sym: R('Device', /^LED$/), fp: R('LED_SMD', /^LED_0603_1608Metric$/), value: 'modrá', nets: { 1: 'GND', 2: 'LED_GNSS' } },
  LED3: { sym: R('Device', /^LED$/), fp: R('LED_SMD', /^LED_0603_1608Metric$/), value: 'červená', nets: { 1: 'GND', 2: 'LED_ERR' } },
  J11: { sym: R('Connector_Generic', /^Conn_01x03$/), fp: R('Connector_JST', /JST_GH_SM03B-GHS-TB_1x03-1MP_P1\.25mm_Horizontal$/), value: 'UART debug',
    nets: { 1: 'DBG_TX', 2: 'DBG_RX', 3: 'GND' } },
  // ostatní z tabulky (M2 apod.) mají záznam výše; cokoli chybí, dostane zástupce
};
