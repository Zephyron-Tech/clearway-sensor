# ClearWay konfigurátor

Parametrický CAD model páru master + slave. Běží v prohlížeči: Vite + Three.js pro scénu,
replicad (OpenCascade WASM) ve Web Workeru pro skutečnou B-rep geometrii.

```bash
npm install
npm run dev      # http://localhost:5174
```

## Soubory

- `src/params.json`: jediný zdroj rozměrů. Každý parametr má `v` (mm / °) a `stav`:
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

- Klik na díl ukáže název a rozměry, dvojklik přiblíží, Esc zruší výběr.
- Klávesy 1–4 / F: pohledy Izo, Shora, Bok, Čelo.
- Spodní lišta: paprsky, popisky, kóty, hrany, rentgen, kabely, rozložený pohled.
- Záložky: Parametry (hledání, stav, vrácení hodnoty), Díly (skrývání kategorií, seznam),
  Fotky (lightbox, připnutí fotky vedle modelu), Export (STEP, STL, JSON, PNG).

## Workflow měření

V panelu přepiš hodnotu, přepni stav na `změřeno`, pak „Stáhnout parametry (JSON)“
a staženým souborem nahraď `src/params.json`. Úpravy v panelu se jinak drží jen v prohlížeči (localStorage).

## Scéna na autě

- Vůz: „2025 Skoda Octavia RS Combi“ od tonielpro520
  (https://sketchfab.com/3d-models/2025-skoda-octavia-rs-combi-e584bb09fa6547a0a3ca7c1ec7c2053a), licence CC BY 4.0.
  Zmenšeno z 53 MB na 3 MB: `npx @gltf-transform/cli optimize scene.gltf public/models/car.glb --compress meshopt --simplify-ratio 0.35`.
  Licence je v `public/models/car-LICENSE.txt`.
- Okolí: centrum Plzně (nám. Republiky) z OpenStreetMap, © přispěvatelé OpenStreetMap, licence ODbL.
  Data obnoví `node scripts/fetch-plzen.mjs` (zapíše `src/plzen.json`), stavbu dělá `src/city.js`.
- Senzory se přisají na skutečný bok vozu (raycast v místě přísavek). Poloha podél vozu je `scena.poloha_x`,
  výška `scena.vyska_montaze`.
