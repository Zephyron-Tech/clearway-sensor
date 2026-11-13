# ClearWay v2: návrh úprav

Stav: koncept k diskusi, 2026-11-13. Výchozí bod je stávající zařízení v1, které je v konfigurátoru archivované (tag `v1-archiv`, varianta „v1 · archiv“) a změřené posuvkou. Návrh v2 je v konfigurátoru jako varianta „v2 · koncept“. Tlačítkem Porovnat se obě verze ukážou vedle sebe na stole i na autě.

## Proč měnit

Co na v1 vadí (z provozu, z modelu a z firmware):

1. **Velikost.** Jednotka má 506 × 80 × 40 mm, s nohou 137 mm. Na voze trčí skoro 14 cm od dveří a master váží odhadem 1,5 kg.
2. **Uchycení.** Nohy jsou pevné klíny (přední 45/33 mm, zadní 23/35 mm), takže úhel sedí jen na jeden tvar dveří. Přísavky s pumpičkou se nasazují pomalu.
3. **Kabely.** Napájení jde ze zapalovače. Kabel COM H4 mezi masterem a slavem musí vést přes střechu nebo pod vozem.
4. **Telefon.** Bez Android aplikace přes BLE zařízení data nikam nepošle.
5. **Dva druhy jednotek.** Master má ESP32-S3 a externí prutovou anténu, slave ESP32 bez antény. Konektory se liší (4+2 pin a 4 pin) a libely i čela jsou jiné.
6. **Hliník a anténa.** Hliníkový profil stíní rádio, proto je anténa venku na čele.

## Co navrhuju

| | v1 (archiv) | v2 (koncept) |
|---|---|---|
| Délka jednotky | 506 mm | 420 mm |
| Průřez | 80 × 40 mm, hliník + tištěný kryt | 60 × 32 mm, plast (PA12 / ASA) |
| Výška s nohou | 137 mm | 82 mm |
| Hmotnost masteru (odhad z objemu CAD) | ~1 480 g | ~580 g |
| Lidary | 4× TFmini Plus | 4× TFmini Plus (beze změny) |
| Rozteč lidarů | ~150 mm | 124 mm (parametr) |
| Spoj master ↔ slave | kabel COM H4, UART | ESP-NOW (bezdrátově) |
| Napájení | 12 V ze zapalovače | 2× 18650, 24,5 Wh, nabíjení USB-C |
| Výdrž | jen z vozu | ~7 h při 3 W |
| Odesílání dat | BLE → telefon → server | LTE-M → server přímo, BLE jen servis |
| Poloha | z telefonu | GNSS v masteru |
| Anténa | prutová, externí | uvnitř plastového čela |
| Uchycení | pevné klíny, přísavka s pumpou ⌀ 117 | kulový kloub + páková přísavka ⌀ 80, rychloupínák |
| Druhy jednotek | 2 (master, slave) | 1 (role v konfiguraci) |

### 1. Jedna jednotka pro master i slave

Stejná deska, stejné tělo, role se nastaví v konfiguraci. Ve výrobě je jen jeden kus a náhradní jednotka pasuje na kteroukoli stranu vozu.
- MCU ESP32-S3-MINI-1. Firmware už na S3 běží (master v1), RMT příjem lidarů zůstává.
- Modem s GNSS se osazuje jen na kusy, které budou master. Slave má stejnou desku bez modemu.
- Riziko: kusová cena desky masteru. Pokud modem vyjde draho, dá se dělat jako nasazovací modul.

### 2. Bezdrátový spoj: ESP-NOW

Nahrazuje UART spoj ze specifikace (kapitola 6). Formát rámce slave → master zůstává, mění se jen transport.
- Latence je v jednotkách ms, šířka vozu (~2 m) je pro ESP-NOW krátká vzdálenost.
- Master vysílá synchronizační rámec s časem, slave k němu vztahuje své odečty.
- Odpadá kabel COM H4, oba GX16 konektory a vývodka.
- **Ověřit:** spolehlivost přes plech vozu, kdy jsou jednotky na opačných bocích (test se dvěma devkity na skutečném voze, ztrátovost a latence při jízdě).

### 3. Baterie a nabíjení

- 2× 18650 paralelně (3 400 mAh, 3,6 V), tj. 24,5 Wh.
- Odběr: 4× TFmini Plus na 5 V (~110 mA každý) + MCU, master navíc modem. Počítám ~3 W, z toho vychází ~7 h provozu. Konfigurátor to přepočítá podle parametrů `baterie`.
- Nabíječka (BQ25895 nebo podobná) s USB-C, BMS, fuel gauge pro stav baterie, vypínač na čele.
- Zapalovač jen jako volitelné nabíjení přes USB-C adaptér.
- **Ověřit:** skutečný odběr TFmini Plus při 250 Hz a výdrž v létě i v zimě. Li-ion v autě na slunci je riziko, je potřeba teplotní ochrana nabíjení.

### 4. Provoz bez telefonu

- Master s LTE-M/NB-IoT modemem a GNSS (např. SIM7080G) posílá data přes MQTT nebo HTTPS rovnou na server, poloha je z GNSS.
- Indikace: RGB LED ve světlovodu na čele B (stav, baterie, spojení se slavem) a bzučák.
- BLE zůstane pro servis a nastavení (role, kalibrace, šířka vozu).
- Výpočet průjezdné šířky zůstává mimo firmware (spec. 1.4), jen se přesune z aplikace na server.
- **Ověřit:** datový objem (min mód 14 B rámec, agregace po sekundách), pokrytí LTE-M a cena SIM.

### 5. Menší tělo

- Lidary zůstávají: TFmini Plus má 250 Hz a IP65 a firmware je na ně odladěný. Zmenšuje se všechno kolem nich.
- Průřez 60 × 32 mm je minimum pro lidar (35 mm napříč, 21 mm na výšku) a článek 18650 (⌀ 18,6 mm).
- Plastové tělo: horní skořepina s okny a spodní vana s těsněním v dělicí rovině. Na prototyp tisk (PA12 nebo ASA), na sérii vstřikování.
- Okna jsou v rovině skořepiny a čelo lidaru je vyplní, stejně jako u v1.
- Rozteč lidarů 124 mm je parametr. Určuje, v jakých výškách boku vozu se měří. **Otázka:** stačí 3 lidary? Ušetří to délku i odběr.

### 6. Nové uchycení

- 2 nohy s kulovým kloubem a aretačním šroubem. Úhel se nastaví na každém voze a nahradí pevné klíny.
- Páková přísavka ⌀ 80 mm bez pumpičky: přitlačit a sklopit páku.
- Rychloupínací destička (rybina): nohy zůstanou na voze a tělo se nacvakne.
- Alternativa pro ocelové dveře jsou magnety s pryží, ale riziko poškození laku a nefunguje to na hliníku a plastu.
- **Ověřit:** únosnost přísavky ⌀ 80 při jízdě 50+ km/h a vibracích. Případně ⌀ 90 nebo třetí bod.

## Postup

1. **Prototyp na stole:** 2 devkity ESP32-S3, ESP-NOW spoj, měření odběru lidarů, baterie, modem na zkušební desce.
2. **Test prototyp (2 kusy):** tištěné tělo, vlastní deska, kloubové nohy. Jízdní testy na dvou typech vozů.
3. **Úpravy podle testů:** počet lidarů, rozteč, velikost přísavek, výdrž.
4. **Produkční verze:** vstřikované tělo, IP krytí (lidar má IP65, tělo má cílit stejně), certifikace CE / RED kvůli rádiu (BLE, ESP-NOW, LTE).

## Rozhodnout

- 3 nebo 4 lidary a jaká rozteč.
- Modem: SIM7080G na desce, nebo nasazovací modul (cena vs. jedna deska pro všechny).
- Přísavky, nebo magnety (podle vozů, na kterých se bude měřit).
- Server: kam data posílat a v jakém formátu (navazuje na protokol 2 z FW).

## Kde to je v konfigurátoru

- Parametry v2: `src/variants/v2/params.json`. Všechny hodnoty jsou `koncept` a dají se měnit v panelu (ukládají se v prohlížeči).
- CAD v2: `src/cad/parts-v2.js`, export STEP/STL se jménem `clearway-v2-*.step`.
- v1 je archiv: `src/variants/v1/params.json`, `src/cad/parts.js` a git tag `v1-archiv`. V panelu je jen pro čtení.
