# ClearWay v2: návrh úprav

Stav: detailní koncept, 2026-11-13. Výchozí bod je stávající zařízení v1, které je v konfigurátoru archivované jako varianta „v1 · archiv“. Je změřené posuvkou, git tag `v1-archiv` označuje původní stav a `v1-archiv-2` stav s jednou čočkou lidaru a vnitřkem čepu B. Návrh v2 je varianta „v2 · koncept“. Tlačítko **Porovnat** ukáže zvolené verze vedle sebe nebo přes sebe (ostatní jako barevný obrys), na stole i na autě.

## Rozhodnuto

- **Lidary zůstávají jako ve v1:** 4× TFmini Plus se stejnou roztečí (152 / 158 / 140 mm). Rozteč se zatím nepočítala, je to parametr. Proto je v2 dlouhá skoro jako v1 (508 mm proti 506). Zmenšuje se průřez, nohy a hmotnost.
- **Modem je uvnitř a vyměnitelný:** karta v M.2 slotu pod hlavní deskou, dostupná servisním víčkem ve dně bez rozebírání těla.
- **Datový protokol k serveru zatím neřešíme.**
- **Výdrž na baterii aspoň 12 h.**
- **Jeden vodotěsný USB-C** pro nabíjení i servis.
- **Celé zařízení vodotěsné a snadno rozebíratelné.**

## Proč měnit (problémy v1)

1. Velikost: 80 × 40 mm průřez, s nohou 137 mm, master ~1,5 kg (odhad z objemů CAD).
2. Pevné klíny noh (45/33 a 23/35 mm), úhel sedí jen na jeden tvar dveří.
3. Kabel ze zapalovače a kabel master ↔ slave přes střechu nebo pod vozem.
4. Bez telefonu s aplikací nejdou data nikam.
5. Dva různé druhy jednotek, externí prutová anténa (hliník stíní).

## Srovnání

| | v1 (archiv) | v2 (koncept) |
|---|---|---|
| Délka | 506 mm | 508 mm (rozteč lidarů jako v1) |
| Průřez | 80 × 40 mm, hliník + tištěný kryt | 60 × 32 mm, plast PA12 / ASA |
| Výška s nohou | 137 mm | 100 mm |
| Hmotnost masteru (odhad z objemu) | ~1 470 g | ~930 g |
| Lidary | 4× TFmini Plus | 4× TFmini Plus (beze změny) |
| Spoj master ↔ slave | kabel COM H4 | ESP-NOW (bezdrátově) |
| Napájení | 12 V ze zapalovače | 3× 21700, 54 Wh |
| Výdrž | jen z vozu | ~14 h master / ~16 h slave |
| Konektory | GX16 4+2 pin / 4 pin | 1× USB-C IP67 (nabíjení + servis) |
| Data | BLE → telefon → server | LTE-M + GNSS v masteru, BLE jen servis |
| Anténa | prutová, externí | uvnitř plastového čela A |
| Krytí | neřešeno | cíl IP67 |
| Uchycení | pevné klíny, přísavka s pumpou ⌀ 117 | rychloupínák + kulový kloub + přísavka s pumpou ⌀ 100 + pojistné lanko |
| Druhy jednotek | 2 | 1 (role v konfiguraci) |

## Uchycení: doporučení

**Vakuová přísavka s pumpičkou a indikátorem**, ⌀ 100 mm, na kulovém kloubu s aretací, s rychloupínákem a pojistným lankem.

- **Proč přísavka s pumpičkou:** stejný princip jako ve v1, kde drží. Pumpou se vytvoří podtlak a červený pruh na pístu ukáže, když podtlak klesá. Dá se dopumpovat dřív, než povolí. Lak nepoškodí (pryž, žádné tření).
- **Proč ne magnety:** prach mezi magnetem a lakem lak poškrábe. Nedrží na hliníkových a plastových dílech karoserie. Ve smyku (boční síla za jízdy, vibrace) drží výrazně hůř než na odtrh. Nijak neukážou, že povolují.
- **Proč ne páková přísavka:** podtlak časem uniká bez varování a nedá se dopumpovat.
- **Kloub:** úhel se nastaví podle tvaru dveří a zajistí šroubem s kolečkem. Nahrazuje pevné klíny ve v1.
- **Rychloupínák:** nohy zůstanou přisáté a tělo se zasune na rybinu a zacvakne západkou. Dá se tak sundat bez povolení přísavek.
- **Pojistné lanko:** očko na saních nohy, lanko s karabinou do rámu dveří nebo pod těsnění okna. Kdyby přísavka povolila, jednotka nespadne na silnici.
- **Ověřit:** zkouška na odtrh a ve smyku při 50 / 90 km/h, vibrace a teplota (zima, slunce).

## Napájení: rozpočet a 12 h

| Spotřebič | Master | Slave |
|---|---|---|
| 4× TFmini Plus (5 V, ~110 mA) | 2,2 W | 2,2 W |
| ESP32-S3 (ESP-NOW / BLE) | 0,35 W | 0,35 W |
| Modem LTE-M + GNSS (průměr) | 0,4 W | – |
| Měnič 5 V, LED, ostatní | 0,25 W | 0,25 W |
| **Celkem** | **3,2 W** | **2,8 W** |

- 3× 21700 (5 000 mAh, 3,6 V) paralelně = 54 Wh.
- Počítám s 85 % využitelné energie (účinnost měniče, stárnutí, zima): master 54 × 0,85 / 3,2 ≈ **14,3 h**, slave ≈ **16,4 h**.
- Konfigurátor výdrž přepočítává z parametrů `baterie` a pod 12 h ji zvýrazní červeně.
- Rezerva navíc: lidary se dají mezi měřeními uspat (TFmini Plus má příkaz pro vypnutí výstupu).
- Ochrana: BMS (přepětí, podpětí, zkrat), NTC na článku a teplotní okno nabíjení 0–45 °C (Li-ion se v mrazu nesmí nabíjet).
- Fuel gauge hlásí stav baterie do RGB LED a přes BLE.

## Vodotěsnost a rozebírání (cíl IP67)

- **Tělo:** horní skořepina s okny a spodní vana. Ve spoji je pero a drážka se silikonovou šňůrou. Drží je 12 nerezových šroubů M2,5 zespodu do mosazných zalisovaných insertů, takže se dá rozebírat opakovaně bez opotřebení plastu.
- **Čela:** duté, s límcem zasunutým do těla a radiálním O-kroužkem. Každé drží 3 šrouby.
- **Okna lidarů:** pryžový rámeček kolem čela lidaru. Čelo lidaru má samo IP65 a vyplní okno v rovině skořepiny.
- **Odvzdušnění:** membránový ventil (typ GORE) ve dně u čela B proti kondenzaci a tlakovým rázům.
- **USB-C:** panelová zásuvka IP67 s gumovou krytkou na poutku. I bez krytky je zásuvka těsná, krytka ji chrání před nečistotou.
- **Tlačítko:** pod silikonovou membránou. **LED:** světlovod zalitý v čele.

## Servis

- **Nabíjení:** USB-C (5 V, případně PD 9 V), stav ukazuje RGB LED.
- **Flash a konzole:** stejný USB-C. ESP32-S3 má nativní USB, takže není potřeba Raspberry Pi ani PROG kabel. Ve v1 to nešlo, protože USB piny zabíral spoj ke slave.
- **Výměna modemu nebo SIM:** povolit 4 šrouby servisního víčka ve dně, vyjmout kartu z M.2 slotu (1 pojistný šroub).
- **Výměna lidaru nebo baterie:** 12 šroubů zespodu, sundat skořepinu. Lidary leží v kolébkách a mají konektory JST-GH.

## Jedna jednotka pro obě role

- Stejná deska, tělo i firmware. Role master / slave se nastaví přes BLE nebo USB.
- U masteru se osadí modemová karta, u slave zůstane slot prázdný.
- Spoj slave → master: ESP-NOW. Formát rámce zůstává podle spec. kap. 6, mění se jen transport. Master vysílá synchronizační rámec s časem.
- **Ověřit:** ztrátovost a latence ESP-NOW přes plech vozu (jednotky na opačných bocích), za jízdy.

## Kusovník v2 (orientační, jedna jednotka)

| Díl | Ks | Poznámka |
|---|---|---|
| TFmini Plus | 4 | stejné jako v1 |
| Horní skořepina s okny | 1 | PA12 (SLS) / ASA, sériově vstřikování |
| Spodní vana | 1 | dtto |
| Čelo A, čelo B | 2 | duté, s límcem |
| Servisní víčko | 1 | s těsněním |
| Silikonová šňůra, O-kroužky, těsnění oken | sada | |
| Mosazné inserty M2,5 | 12 | zalisované teplem |
| Šrouby M2,5 nerez | 12 + 6 | tělo + čela |
| Šrouby M2 | 4 | víčko |
| Ventil GORE (M8 / lepený) | 1 | |
| Hlavní deska | 1 | ESP32-S3-MINI-1, BQ25895, MAX17048, TPS63070, 4× JST-GH, M.2 key E |
| Modemová karta | 1 (master) | SIM7080G (LTE-M / NB-IoT + GNSS), nano-SIM |
| Deska čela B | 1 | USB-C IP67, mikrospínač, RGB LED, ESD, FFC |
| GNSS patch 25 × 25 + LNA | 1 | v čele A |
| Flex anténa LTE / BLE | 1 | v čele A |
| Články 21700 5 000 mAh | 3 | 1S3P |
| BMS + NTC | 1 | |
| Držáky článků s kontakty | 2 | |
| Kabeláž | sada | 4× lidar, koax ×2, baterie, FFC |
| Noha: destička, saně se západkou, dřík, kloub s aretací, přísavka s pumpou ⌀ 100 | 2 sady | |
| Pojistné lanko s karabinou | 1 | |

## Postup

1. **Na stole:** 2 devkity ESP32-S3, ESP-NOW spoj, měření skutečného odběru 4× TFmini Plus při 250 Hz, test výdrže na 3× 21700.
2. **Testovací prototyp (2 kusy):** tělo z PA12 (SLS), vlastní deska, modemová karta, nohy. Zkouška těsnosti (ponoření 1 m / 30 min) a jízdní testy.
3. **Úpravy podle testů:** rozteč lidarů (zatím jako v1), velikost přísavky, výdrž.
4. **Produkce:** vstřikované díly, certifikace CE / RED kvůli rádiu (BLE, ESP-NOW, LTE), přeprava Li-ion (UN 38.3).

## Otevřené otázky

- Rozteč lidarů: je potřeba spočítat. Kratší rozteč zkrátí tělo.
- Protokol a server: zatím neřešeno.
- Zkouška přísavek ve smyku za jízdy.

## Kde to je v konfigurátoru

- Parametry v2: `src/variants/v2/params.json`. Všechny hodnoty jsou `koncept` a dají se měnit v panelu (ukládají se v prohlížeči).
- CAD v2: `src/cad/parts-v2.js`. Každý díl má vlastní posun pro rozložený pohled. Export STEP/STL se jménem `clearway-v2-*.step`.
- v1: `src/variants/v1/params.json`, `src/cad/parts.js`, tagy `v1-archiv` a `v1-archiv-2`. V panelu jen pro čtení.
- Další verze: nová složka `src/variants/vN` + builder v `src/cad/worker.js` + řádek v `VARIANTS` v `src/main.js`.
