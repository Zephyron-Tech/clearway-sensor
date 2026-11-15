# ClearWay konfigurátor

Parametrický CAD model páru master + slave. Běží v prohlížeči: Vite + Three.js pro scénu,
replicad (OpenCascade WASM) ve Web Workeru pro skutečnou B-rep geometrii.

```bash
npm install
npm run dev      # http://localhost:5174
```

## Soubory

- `src/variants/v1/params.json`: rozměry stávajícího zařízení (archiv, tag `v1-archiv`, v UI jen pro čtení).
- `src/variants/v2/params.json` + `src/cad/parts-v2.js`: návrh v2 (koncept), popsaný v `docs/navrh-v2.md`.
- `src/variants/v3/params.json` + `src/cad/parts-v3.js`: experiment v3, střešní skener, popsaný v `docs/navrh-v3.md`.
- `src/cad/board-v3-data.js` + `src/cad/board-v3.js`: nosná deska CB3 pro v3 (tabulka součástek a 3D model). `node scripts/export-board.mjs` z ní vygeneruje obrys DXF, osazení a kusovník do `docs/v3-deska/`; popis v `docs/v3-deska.md`.
- `src/scan.js`: ulice s překážkami a simulace průjezdu v3 (paprsky přes BVH, volná šířka, podjezdná výška).
- `src/truck.js`: obecný popelářský vůz pro scénu „Popelář“.
- Každý parametr má `v` (mm / °) a `stav`:
  `odhad` (z fotek), `zmereno` (posuvkou), `koncept` (navržená úprava).
- `src/cad/parts.js`: CAD díly (U profil s drážkami, kryty A/B/C, rámečky oken se stadionovým
  průzorem a sklem, lidary s čočkami, čepy s otvory pro konektory, anténa, libela, deska RICE se
  sloupky, ESP modulem, JST a svorkovnicí, nohy s přísavkou a pumpičkou, pevně nakloněné podél těla: přední u konektorů jinak než zadní).
- `src/cad/worker.js`: OpenCascade ve workeru; síť pro náhled, export STEP (AP242, pojmenované
  a obarvené díly) a STL. Export otáčí model do konvence CAD: **Z nahoru**, osa X podél těla.
- `src/geometry.js`: rozvržení podél těla (polohy oken) a nohy (klínové válce, náklon), sdílené CAD i náhledem.
- `src/names.js`: značení lidarů J1–J4 podle pořadí oken (master od antény, slave od konektoru).
- `src/model.js`: rychlý zjednodušený náhled, dokud se nenačte WASM, a popisky / paprsky.
- `src/main.js`: scéna (na stole / na autě), panel parametrů, exporty.

- `src/cad/client.js`: PBR materiály (hliník, tištěné PLA se zrnem, sklo, PCB…), zvýraznění dílů.
- `src/car.js`, `src/overlay.js`: obecný vůz a silnice, popisky, kóty, kabely.
- `public/foto/`: zmenšené kopie referenčních fotek pro záložku Fotky.

## Ovládání

- Klik na díl ho vybere (karta s názvem, specifikací, rozměry a hmotností), dvojklik přiblíží, Esc zruší.
- Nástroje vlevo: Výběr (V), Přesun dílu úchytem (G), Měření dvou bodů (M), Řez (X), Jen vybraný díl (I),
  Zobrazit vše (Shift+H), Vrátit posunuté díly (Shift+R), Nápověda (?).
- H nebo Delete skryje vybraný díl. Skrytí, posuny a měření se neukládají, jsou jen pro prohlížení.
- Pohledy 1–5 (Izo, Shora, Bok, Čelo, Zdola), F přiblíží výběr, O přepne rovnoběžné promítání.
- Pohyb: WASD nebo šipky, Q/E dolů/nahoru, Shift rychleji, Alt pomaleji. L (tlačítko Let) přepne rozhlížení myší z místa, kolečko pak mění rychlost.
- Nahoře: scéna (stůl / auto / popelář), verze (v1 archiv / v2 koncept / v3 střešní skener), jednotka (obě / master / slave, u v3 není), porovnání verzí.
- Spodní lišta: paprsky, popisky, kóty, hrany, rentgen, kabely, porovnat, rozložený pohled.
- Záložka Díly: strom dílů s hledáním a okem u každého dílu, pod ním kusovník složený z modelu (CSV).
- Záložka Export: STEP a STL celé jednotky, STEP jen tištěných dílů, STL vybraného dílu, parametry, snímek.

## Verze

- **v1 · archiv**: stávající zařízení, změřené. Jen pro čtení (`src/variants/v1`, `src/cad/parts.js`, tagy `v1-archiv`, `v1-archiv-2`).
- **v2 · koncept**: návrh nové verze. Popis a zdůvodnění v `docs/navrh-v2.md`, výroba a montáž v `docs/v2-stavba.md`.
  Každý díl v `src/cad/parts-v2.js` nese název, specifikaci, zdroj (tisk, nákup, deska, kabel, těsnění) a posun pro rozložený pohled.
- **v3 · střešní skener**: experiment s jinou koncepcí: jedna jednotka na střeše, dva profilové skenery a 3D lidar.
  Ve scéně na voze se spustí simulace průjezdu ulicí (přepínač Paprsky) s nejužším místem a podjezdnou výškou.
  Tlačítko **▶ Jízda** (klávesa P) ji přehraje: vůz jede ulicí, profily a koridor přibývají za ním, na konci se ukáže celý výsledek. Popis v `docs/navrh-v3.md`.
- Další verze: nová složka `src/variants/vN`, builder v `src/cad/worker.js`, řádek ve `VARIANTS` v `src/main.js`.

## Workflow měření

V panelu přepiš hodnotu, přepni stav na `změřeno`, pak „Stáhnout parametry (JSON)“
a staženým souborem nahraď `src/variants/v2/params.json` (v1 je archiv a nemění se). Úpravy v panelu se jinak drží jen v prohlížeči (localStorage).

## Scéna na autě

- Vůz: „2025 Skoda Octavia RS Combi“ od tonielpro520
  (https://sketchfab.com/3d-models/2025-skoda-octavia-rs-combi-e584bb09fa6547a0a3ca7c1ec7c2053a), licence CC BY 4.0.
  Zmenšeno z 53 MB na 3 MB: `npx @gltf-transform/cli optimize scene.gltf public/models/car.glb --compress meshopt --simplify-ratio 0.35`.
  Licence je v `public/models/car-LICENSE.txt`.
- Popelář: „GARBAGE TRUCK“ od liebherr996litronic (https://sketchfab.com/3d-models/garbage-truck-9aee01b569f043b290cd7dc1abf38b71),
  dodávka: „2019 Mercedes-Benz Sprinter“ od tonielpro520 (https://sketchfab.com/3d-models/2019-mercedes-benz-sprinter-5788a290ddb5483fbbd5831aeef829a1),
  obojí CC BY 4.0. Z popeláře odstraněna hromada odpadu s vlajkami a knihami a španělský polep, dodávka má prázdnou SPZ.
  Úpravy a licence v `public/models/truck-LICENSE.txt` a `van-LICENSE.txt`. Když se modely nenačtou, použijí se zjednodušené z `src/truck.js` a `src/scan.js`.
- Okolí: centrum Plzně (nám. Republiky) z OpenStreetMap, © přispěvatelé OpenStreetMap, licence ODbL.
  Data obnoví `node scripts/fetch-plzen.mjs` (zapíše `src/plzen.json`), stavbu dělá `src/city.js`.
- Senzory se přisají na skutečný bok vozu (raycast v místě přísavek). Poloha podél vozu je `scena.poloha_x`,
  výška `scena.vyska_montaze`.
