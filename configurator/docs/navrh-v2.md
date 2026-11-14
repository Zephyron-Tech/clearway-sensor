# ClearWay v2: návrh, revize 2

Stav: stavební koncept, 2026-11-14. Výchozí bod je stávající zařízení v1 (v konfigurátoru „v1 · archiv“, změřené posuvkou, git tagy `v1-archiv` a `v1-archiv-2`). v2 je varianta „v2 · koncept“. Jak ji vyrobit a složit, popisuje [v2-stavba.md](v2-stavba.md). Kusovník je v aplikaci v záložce Díly a dá se stáhnout jako CSV.

Čísla v tomto dokumentu jsou návrhová. Co je odhad a co je potřeba změřit nebo vyzkoušet, je vždy napsáno.

## Co se rozhodlo

- Lidary zůstávají: 4× TFmini Plus, rozteč jako ve v1 (152 / 158 / 140 mm). Délku těla proto určuje rozteč.
- Modem je uvnitř a je vyměnitelný bez rozebírání těla.
- Výdrž na baterii aspoň 12 h.
- Jeden vodotěsný USB-C na nabíjení i servis.
- Celé zařízení vodotěsné a přitom rozebíratelné.
- Protokol k serveru se zatím neřeší.

## Revize prvního konceptu: co bylo špatně

První koncept v2 (dělená skořepina s vanou a dvěma zasunutými čely) jsem prošel jako konstrukční revizi. Nalezené problémy a jak je řeší revize 2:

| # | Problém prvního konceptu | Řešení v revizi 2 |
|---|---|---|
| 1 | **Netěsnost v principu.** O-kroužky čel křížily dělicí rovinu skořepiny a vany. V těchto T-spojích těsnění nikdy spolehlivě nedoléhá. | Kryt je jeden díl včetně obou čel. Zůstává jediná dělicí rovina (kryt × základna) a jedno uzavřené těsnění v jedné rovině. |
| 2 | **Šrouby vedly do suchého prostoru.** Každý šroub byl možná netěsnost. | Všech 18 šroubů základny je vně těsnění, ve slepých závitových vložkách. |
| 3 | **Okna lidarů se těsnila zavřením těla.** Při každém servisu by se 4 těsnění rozpojila. | Každý lidar má vlastní ucpávku (silikonový rámeček stlačený třmenem). Při otevření základny se jí nikdo nedotkne. |
| 4 | **Výdrž bez rezervy na zimu.** 3 články dávaly 14 h jen za pokojové teploty, v mrazu pod 12 h. | 4 články 21700 (72 Wh): ~19 h, při −10 °C stále ~14 h. Pakety jsou dva stejné a váhově vyvážené. |
| 5 | **Paralelní články rozdělené 2 + 1** s různě dlouhými vodiči. | Dva shodné pakety 1S2P, každý s vlastní pojistkou a konektorem. |
| 6 | **Modem neumí GNSS a LTE současně** (SIM7080G sdílí rádiovou část). Průběžná poloha by při vysílání vypadávala. | Samostatný GNSS přijímač (u-blox MAX-M10S) na hlavní desce. Modem dělá jen LTE. |
| 7 | **Modem na vlastní kartě M.2** by se musel navrhnout a vyrobit. | Standardní slot Mini PCIe: karty LTE-M se dají koupit hotové (např. Quectel BG95-M3 Mini PCIe). |
| 8 | **Antény vedle baterií.** Kovové články rozlaďují LTE anténu. | Rádiová část je celá v horním segmentu A, baterie ve spodních segmentech B a C. Antény jsou tak i nejvýš na voze. |
| 9 | **Stavová LED a tlačítko na spodním čele** nejsou za provozu vidět ani pohodlně dosažitelné. | Podsvícené tlačítko IP67 je na vnější ploše nahoře. Je vidět z boku vozu u obou jednotek. |
| 10 | **Vlastní membránové tlačítko a světlovod** se špatně těsní a vyrábějí. | Hotové tlačítko ⌀12 mm s vlastním O-kroužkem a maticí. |
| 11 | **Páková přísavka ⌀100** nemá indikaci a není ověřená. | Stejná přísavka s pumpičkou jako ve v1 (změřená, vyzkoušená, už ji máte). |
| 12 | **Aretace kloubu bočním šroubem** v tištěném dílu drží špatně. | Koule sevřená převlečnou maticí po celém obvodu, dotahuje se rukou. |
| 13 | **Nevyřešené zajištění nohy v rybině.** | T-drážka s dorazem a pružinovým kolíkem (kupovaný díl). |
| 14 | **Celý kryt nešel dobře tisknout** (tenké pero a drážka po 500 mm). | Rovná dosedací plocha, drážka 2 × 1,5 mm v masivní přírubě. |

## Architektura

Tělo má dva hlavní díly:

- **Kryt** (PA12, světle šedý): strop s okny, bočnice a obě čela v jednom kusu. Všechno uvnitř je přišroubované do něj: lidary, obě desky, antény. Pakety jsou k němu přilepené pěnovou páskou.
- **Základna** (PA12, černá): rovná deska na straně k vozu. Nese T-drážky pro nohy a servisní víčko. Nejsou na ní žádné elektrické díly, takže se při otevření nic nerozpojuje.

Po délce (čelo A je na voze nahoře):

| Úsek | Obsah |
|---|---|
| Čelo A | GNSS patch anténa (míří nahoru), podsvícené tlačítko ve stropu |
| Lidar J1 | |
| Segment A | hlavní deska: ESP32-S3, GNSS, slot Mini PCIe s modemem, SIM, servisní tlačítka; LTE anténa pod stropem; pod ním servisní víčko |
| Lidar J2 | |
| Segment B | paket 1S2P (2× 21700) |
| Lidar J3 | |
| Segment C | paket 1S2P (2× 21700) |
| Lidar J4 | |
| Čelo B | napájecí deska: USB-C IP67, nabíječ, ochrana, měnič 5 V; odvzdušňovací membrána |

Baterie jsou dole kvůli těžišti, rádio nahoře kvůli výhledu na oblohu a přes okna vozu k druhé jednotce.

## Srovnání s v1

| | v1 (archiv) | v2 revize 2 |
|---|---|---|
| Délka | 506 mm | 516 mm (rozteč lidarů jako v1) |
| Průřez | 80 × 40 mm | 64 × 34 mm |
| Výška s nohou | 137 mm | 120 mm |
| Tělo bez nohou (odhad) | – | ~730 g |
| Lidary | 4× TFmini Plus | 4× TFmini Plus |
| Spoj master ↔ slave | kabel | ESP-NOW |
| Napájení | 12 V ze zapalovače | 4× 21700, 72 Wh |
| Výdrž | jen z vozu | ~19 h master, ~22 h slave |
| Konektory | GX16 (4+2 pin / 4 pin) | 1× USB-C IP67 |
| Data | BLE → telefon | LTE-M + GNSS v masteru |
| Krytí | neřešeno | cíl IP67 |
| Uchycení | pevné klíny | kulový kloub ±15°, T-drážka, pojistné lanko |
| Druhy jednotek | 2 | 1 (role v nastavení) |

Výška s nohou klesla jen o 17 mm, protože přísavka z v1 má sama 48,5 mm a kloub potřebuje dalších 37 mm. Menší výška by znamenala jinou přísavku.

Hmotnost v aplikaci (~1 310 g u masteru) je součet objemů dílů krát hustota. Přísavky jsou v modelu plné, takže je to horní odhad. Tělo bez nohou vychází zhruba takto: kryt 210 g, základna s víčkem 115 g, články 4 × 69 g, lidary ~50 g, desky a modem ~40 g, kabely, šrouby a těsnění ~40 g. Skutečnou hmotnost je potřeba zvážit na prototypu.

## Uchycení

**Přísavka s pumpičkou z v1 na kulovém kloubu, v T-drážce, s pojistným lankem.**

- **Přísavka:** stejný typ jako ve v1 (⌀117 mm, pumpička s červeným indikátorem). Na voze už drží a máte ji. Indikátor ukáže, že podtlak klesá, a dá se dopumpovat.
- **Proč ne magnety:** prach pod magnetem poškrábe lak, nedrží na hliníkových a plastových dílech, ve smyku za jízdy drží mnohem hůř než na odtrh a neukážou, že povolují.
- **Kloub:** ocelová koule ⌀18 mm v sedle saní, sevřená převlečnou maticí. Rozsah ±15° (klíny v1 měly ~10°). Postup: přisát obě přísavky s povolenými klouby, tělo si sedne samo, pak obě matice dotáhnout rukou.
- **T-drážka:** saně nohy se zasunou do drážky na základně. Tělo se nasouvá shora dolů, takže tíha drží doraz. Proti vysunutí je pružinový kolík s knoflíkem na boku.
- **Pojistné lanko:** poutko na horním konci základny, nerez lanko s karabinou do rámu dveří nebo pod těsnění okna. Když povolí obě přísavky, jednotka nespadne na silnici.
- **Ověřit:** moment, při kterém se kloub protočí (vibrace, vítr při 90 km/h); únosnost ve smyku; chování na mokrém a studeném laku.

## Napájení

| Spotřebič | Master | Slave |
|---|---|---|
| 4× TFmini Plus (5 V, ~110 mA) | 2,2 W | 2,2 W |
| ESP32-S3 (ESP-NOW, BLE) | 0,35 W | 0,35 W |
| Modem LTE-M (průměr) + GNSS | 0,4 W | – |
| Měniče, LED, ostatní | 0,25 W | 0,25 W |
| **Celkem (odhad)** | **3,2 W** | **2,8 W** |

- 4× 21700 po 5 000 mAh = 72 Wh. Počítám 85 % využitelné energie.
- Master: 72 × 0,85 / 3,2 = **19 h**. Slave: **22 h**.
- Při −10 °C má Li-ion zhruba o čtvrtinu menší kapacitu: master ~14 h. Požadavek 12 h platí i v zimě.
- Nabíjení: USB-C s Power Delivery (9–12 V), nabíječ BQ25895 do 5 A. Z prázdna zhruba 5–6 h, přes noc.
- Ochrany: nabíječ + samostatný ochranný obvod s MOSFETy, pojistka PTC u každého paketu, čidlo teploty na každém paketu (nabíjení jen při 0–45 °C).
- Vypnutí: lodní režim nabíječe (odběr v µA). Zapnutí tlačítkem nebo připojením USB. Dlouhý stisk = tvrdý reset.
- Lidary mají vlastní spínač napájení, takže je firmware umí vypnout nebo restartovat.
- **Ověřit:** skutečný odběr 4× TFmini Plus při 250 Hz. Od něj se odvíjí celá výdrž.

## Elektronika

Dvě desky spojené jedním svazkem (10 žil, JST GH):

**Hlavní deska** (100 × 40 mm, segment A, součástky směrem k servisnímu víčku):
- ESP32-S3-MINI-1: firmware v1 už na S3 běží. Nativní USB slouží pro flash i konzoli (ve v1 to nešlo, USB piny zabíral spoj ke slave).
- GNSS u-blox MAX-M10S s aktivní patch anténou 18 × 18 mm v čele A.
- Slot Mini PCIe + držák nano-SIM + 2 sloupky. U slave zůstává prázdný.
- 4× konektor lidaru (JST GH 4p), spínač 5 V pro lidary.
- Měnič 3,3 V (buck-boost, funguje přes celý rozsah baterie).
- Akcelerometr: probuzení pohybem, kontrola sklonu a vibrací.
- Tlačítka BOOT a EN pod servisním víčkem.

**Napájecí deska** (50 × 22 mm, svisle za čelem B):
- zásuvka USB-C IP67 s přírubou, ochrana ESD, řadič USB PD,
- nabíječ, měřič stavu baterie, ochrana baterie, měnič 5 V / 2 A pro lidary,
- 2× konektor paketu, konektor svazku.

Spoj slave → master: ESP-NOW. Formát rámce podle specifikace (kap. 6) se nemění, mění se jen přenos. Master vysílá synchronizační rámec s časem.

- **Ověřit:** ztrátovost a zpoždění ESP-NOW mezi jednotkami na opačných bocích vozu za jízdy. Záloha, kdyby to nestačilo: kabel USB-C mezi jednotkami (ESP32-S3 umí USB host).
- **Ověřit:** příjem GNSS z boku vozu (karoserie zakrývá půl oblohy) a přizpůsobení LTE antény v těle (měřit na prototypu).

## Vodotěsnost (cíl IP67)

| Místo | Těsnění |
|---|---|
| Kryt × základna | silikonová šňůra ⌀2 mm v drážce 2,0 × 1,5 mm, 18 šroubů M2,5 vně těsnění |
| 4× lidar ve stropu | ucpávka: silikonový rámeček 3 mm stlačený třmenem (2 šrouby) |
| Servisní víčko | plochý silikonový rámeček 1 mm, 4 šrouby vně těsnění |
| USB-C | zásuvka IP67 s přírubou a plochým těsněním, silikonová zátka |
| Tlačítko | vlastní O-kroužek a matice |
| Odvzdušnění | samolepicí ePTFE membrána nad otvorem ⌀2 mm v čele B |

USB-C a odvzdušnění jsou na spodním čele: voda odtéká pryč a nestojí na nich.

- **Ověřit:** tvar lidaru. Průchod stropem (35,6 × 19,1 mm) a rámeček těsnění vycházejí z katalogových rozměrů TFmini Plus (35 × 18,5 mm). Před tiskem krytu změřit skutečný obrys a zaoblení lidaru a upravit parametry `okno`.
- **Zkouška:** ponoření 1 m na 30 minut s papírovým indikátorem uvnitř, před osazením elektroniky.

## Servis

| Úkon | Jak |
|---|---|
| Nabíjení | USB-C na spodním čele, stav ukazuje kroužek tlačítka |
| Flash, konzole | stejný USB-C (nativní USB ESP32-S3) |
| Výměna SIM nebo modemu | sundat tělo z nohou, 4 šrouby servisního víčka. SIM je push-push, karta má 2 šrouby. |
| Nouzový flash | tlačítka BOOT a EN pod servisním víčkem |
| Výměna lidaru | 18 šroubů základny, 2 šrouby třmenu, konektor JST |
| Výměna paketu | 18 šroubů základny, odpojit konektor u čela B, odlepit paket |

## Rizika a otevřené body

1. Skutečný odběr lidarů (určuje výdrž).
2. ESP-NOW přes vůz.
3. Tvar lidaru a těsnost ucpávek.
4. LTE anténa v těle a GNSS z boku vozu.
5. Moment kloubu a únosnost přísavek za jízdy.
6. Teplota: tmavé tělo na slunci. Kryt je proto světlý, nabíjení hlídá čidlo teploty.
7. Rozteč lidarů: zatím jako v1. Kratší rozteč zkrátí tělo.
8. Výroba krytu: 516 mm se nevejde do malých tiskáren (viz návod stavby).
9. Sériová výroba: vnitřní příruba krytu je podřez, pro vstřikování se tvar upraví. Certifikace CE / RED kvůli rádiu, přeprava Li-ion (UN 38.3).

## Postup

1. **Na stole:** dva devkity ESP32-S3, 4 lidary, měření odběru, test ESP-NOW na voze, GNSS a modem na vývojových deskách.
2. **Mechanický prototyp:** tisk krytu, základny a nohou, osazení lidarů a maket, zkouška těsnosti a jízdní zkouška uchycení.
3. **Desky:** schéma a návrh hlavní a napájecí desky podle rozměrů a rozmístění v modelu.
4. **Testovací pár:** dvě kompletní jednotky, jízdní testy.
5. **Úpravy pro sérii.**

## Kde to je v konfigurátoru

- Parametry: `src/variants/v2/params.json` (všechny `koncept`, dají se měnit v panelu).
- CAD: `src/cad/parts-v2.js`. Každý díl má název, specifikaci, zdroj a posun pro rozložený pohled.
- Kusovník: záložka Díly → Kusovník, tlačítko CSV.
- Export: STEP celé jednotky, STEP jen tištěných dílů, STL jednotlivého dílu (karta dílu nebo záložka Export).
- v1: `src/variants/v1/params.json`, `src/cad/parts.js`. Jen pro čtení.
