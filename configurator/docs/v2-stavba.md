# ClearWay v2: jak ji vyrobit a složit

Návod k revizi 2 návrhu ([navrh-v2.md](navrh-v2.md)). Model je v konfigurátoru jako „v2 · koncept“. Přesné počty a specifikace dílů jsou v záložce Díly → Kusovník (tlačítko CSV). Počty níže platí pro **jednu jednotku**, pár je dvojnásobek.

Než se cokoli objedná nebo vytiskne, projdi část „Nejdřív změřit“. Na dvou místech model vychází z katalogu, ne z měření.

## Nejdřív změřit

| Co | Proč | Kam zapsat |
|---|---|---|
| Obrys TFmini Plus zepředu (šířka, výška, zaoblení rohů) a kde přesně začíná průhledné čelo | Podle něj je průchod stropem a těsnicí rámeček. Model počítá s 35 × 18,5 mm a zaoblením 2 mm. | parametry `okno.delka`, `okno.sirka`; při jiném zaoblení upravit `rrect` v `parts-v2.js` |
| Hloubka lidaru a kde vzadu vychází kabel | Třmen má vzadu výřez na konektor. | `lidar.vyska`, výřez v třmenu |
| Příruba přísavky z v1: rozteč a velikost šroubů | Adaptér přísavky má v modelu 2 šrouby M4 na rozteči 36 mm. Je to odhad. | adaptér v `buildFoot` |
| Skutečný odběr 4 lidarů při 250 Hz | Určuje výdrž. | `baterie.odber_master`, `baterie.odber_slave` |
| Závitové vložky, které koupíš | Otvory v modelu mají ⌀3,6 mm a hloubku 4,7 mm (pro vložky M2,5 s vnějším ⌀ kolem 4 mm a délkou 4 mm). | průměr otvorů v `parts-v2.js` |

## Výroba dílů

### Tištěné díly (STEP: Export → „STEP tištěných dílů“, STL jednoho dílu: karta dílu → STL)

| Díl | Ks | Poznámka |
|---|---|---|
| Kryt | 1 | 516 × 64 × 31 mm, světle šedý. Hlavní díl, viz níže. |
| Základna s T-drážkami | 1 | 525 × 64 mm, černá. Dosedací plocha těsnění musí být rovná. |
| Servisní víčko | 1 | |
| Třmen lidaru | 4 | |
| Saně nohy | 2 | Závit pro matici kloubu je v modelu hladký válec ⌀27 mm. Závit M27×2 doplnit v CADu nebo vytisknout s vůlí 0,3 mm. |
| Převlečná matice kloubu | 2 | Totéž, vnitřní závit. |
| Adaptér přísavky | 2 | S vložkou M8. |

**Doporučená technologie: PA12, SLS nebo MJF.** Díly jsou vodotěsné bez úprav, pevné a tvarově stálé na slunci.

- Kryt má 516 mm. Vejde se do strojů se stavební výškou 600 mm (např. EOS P3xx). MJF (380 mm) ho zvládne jen úhlopříčně. Při objednávce se ptej na „díl 520 mm v jednom kusu“.
- Tolerance SLS je zhruba ±0,3 mm. Vůle v modelu s tím počítají (lidar 0,3 mm na stranu, T-drážka 0,3 mm).
- Dosedací plochu základny a spodek příruby krytu po tisku přebrousit na rovné desce (brusný papír 240).

**Prototyp na vlastní FDM tiskárně** (jen na zkoušku rozměrů a montáže, ne na vodotěsnost):
- PETG nebo ASA, 4 perimetry, vrstva 0,2 mm.
- Kryt rozdělit na 2 až 3 kusy příčným řezem uprostřed segmentů B a C (mimo lidary) a slepit epoxidem přes vložené kolíky.
- Stěny FDM tisku prosakují. Kdo chce i s FDM zkoušet těsnost, natře vnitřek krytu řídkým epoxidem.

### Těsnění

| Díl | Ks | Jak |
|---|---|---|
| Obvodové těsnění | 1 | Silikonová šňůra ⌀2 mm, 40–50 ShA, asi 1,1 m. Vložit do drážky, konce seříznout šikmo a slepit kyanoakrylátem. Spoj dát na dlouhou stranu, ne do rohu. |
| Těsnění lidaru | 4 | Silikon 3 mm, 40 ShA. Vyříznout rámeček: vnější obrys 39,4 × 22,9 mm, vnitřní podle lidaru s přesahem 0,3 mm. |
| Těsnění servisního víčka | 1 | Silikonová fólie 1 mm, rámeček podle modelu. |
| Odvzdušňovací membrána | 1 | Samolepicí ePTFE ⌀8 mm. |

### Desky

Hlavní deska (100 × 40 mm) a napájecí deska (50 × 22 mm) se musí navrhnout: schéma a plošný spoj. Model udává obrys, montážní otvory, polohy konektorů a výšky součástek, viz Elektronika v návrhu. Součástky jsou na straně k servisnímu víčku, na straně ke stropu nesmí být nic vyššího než 1 mm.

## Zapojení

**Lidar** (konektor JST GH 4p, podle katalogu TFmini Plus; ověřit na kusu):

| Pin | Signál | Barva |
|---|---|---|
| 1 | +5 V | červená |
| 2 | RXD lidaru | bílá |
| 3 | TXD lidaru | zelená |
| 4 | GND | černá |

Úrovně UART jsou 3,3 V, dají se připojit přímo na ESP32. Firmware čte lidary přes RMT a nastavuje jim 250 Hz přes jejich RXD.

**Hlavní svazek** (napájecí deska ↔ hlavní deska, JST GH 10p, asi 420 mm):

| Pin | Signál | Poznámka |
|---|---|---|
| 1, 2 | +5 V | pro lidary, špičky do 2 A |
| 3 | VSYS | 3,0–4,2 V pro měnič 3,3 V |
| 4, 5, 6 | GND | |
| 7 | SDA | nabíječ, měřič baterie |
| 8 | SCL | |
| 9, 10 | USB D+ / D− | kroucený pár, pokud možno stíněný |

Tlačítko a jeho LED jdou vlastním kabelem (5 žil) na hlavní desku. Signál tlačítka pro probuzení a tvrdý reset (QON nabíječe) je potřeba dovést i na napájecí desku: buď jedenáctou žilou ve svazku, nebo přes hlavní desku. Rozhodnout při návrhu schématu.

**Pakety:** každý 1S2P má konektor JST VH 2p, pojistku PTC na kladném vodiči u paketu a čidlo NTC 10 kΩ pod páskou. Pakety se spojují paralelně až na napájecí desce. Před prvním spojením musí mít oba stejné napětí (rozdíl do 0,05 V).

## Montáž

Pořadí odpovídá rozloženému pohledu v aplikaci (posuvník Rozložit), odshora dolů.

1. **Vložky do krytu.** Zatavit 32 vložek M2,5: 18 po obvodu příruby, 8 u lidarů, 4 ve sloupcích desky, 2 ve sloupcích u čela B. Páječka asi 230 °C, vložku zatlačit do roviny. Do základny 4 vložky kolem servisního otvoru.
2. **Tlačítko.** Zvenku do stropu u čela A, zevnitř matice. O-kroužek patří ven pod límec.
3. **GNSS anténa.** Nalepit na vnitřní stranu čela A, keramikou ke stěně.
4. **Lidary.** Do každé kapsy ve stropu vložit těsnicí rámeček, lidar nasadit do třmenu, zasunout zespodu do průchodu a přitáhnout 2 šrouby M2,5×6. Dotahovat střídavě, až třmen dosedne na sloupky. Čelo lidaru má být 0,8 mm pod plochou stropu.
5. **LTE anténa.** Nalepit pod strop v segmentu A.
6. **Hlavní deska.** 4 šrouby M2,5×5 do sloupků, součástkami dolů. Připojit koax GNSS, kabel tlačítka a kabely lidarů (J1 na horním konci desky, J2–J4 na dolním).
7. **Modem (jen master).** Kartu zasunout šikmo do slotu, sklopit a přišroubovat 2× M2×3. Připojit koax LTE. Vložit SIM.
8. **Napájecí deska.** Těsnění USB-C na přírubu zásuvky, desku přiložit zevnitř k čelu B a přitáhnout 2× M2,5×6. Zevnitř nalepit membránu nad odvzdušňovací otvor.
9. **Pakety.** Na strop nalepit pěnovou pásku, paket přitlačit mezi žebra. Vodiče vést kanálem podél boku pod žebry k čelu B. Hlavní svazek vést druhým bokem.
10. **Kontrola před zavřením.** Žádný kabel nesmí ležet na přírubě ani v drážce těsnění.
11. **Základna.** Na základnu nalepit pěnové podložky pod pakety. Šňůru vložit do drážky v krytu, přiložit základnu a dotáhnout 18 šroubů M2,5×6 od středu ke koncům, napoprvé jen lehce, napodruhé nadoraz. Utahovat citem, vložky jsou v plastu.
12. **Servisní víčko.** Těsnění, víčko, 4 šrouby M2,5×5.
13. **Nohy.** Kulový čep zašroubovat do adaptéru, adaptér přišroubovat k přírubě přísavky. Kouli vložit zespodu do saní a zajistit převlečnou maticí. Saně zasunout do T-drážky až na doraz, kolík musí zaskočit.
14. **Lanko.** Provléct poutkem na horním konci základny.

## Zkoušky

1. **Těsnost bez elektroniky.** Složit kryt, základnu, víčko, lidary (nebo záslepky stejného tvaru), tlačítko a zásuvku USB se zátkou. Dovnitř dát suchý papír. Ponořit 1 m hluboko na 30 minut.
2. **První zapnutí.** Napájet z laboratorního zdroje 3,8 V s omezením 1 A místo paketů. Změřit 5 V a 3,3 V, proud v klidu a s lidary.
3. **Nabíjení.** Připojit pakety, zkontrolovat nabíjecí proud a reakci na teplotu čidel.
4. **Výdrž.** Plné nabití, měření naplno až do vypnutí. Zapsat hodiny.
5. **Uchycení.** Na voze: přisát, dotáhnout klouby, zatáhnout za tělo rukou do všech směrů. Pak jízda s pojistným lankem a kontrola indikátorů přísavek po 15 minutách.
6. **Rádio.** ESP-NOW mezi jednotkami na obou bocích vozu, GNSS a LTE za jízdy.
