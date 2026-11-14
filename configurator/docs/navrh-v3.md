# ClearWay v3: střešní skener (experiment)

v3 je jiná koncepce, ne vylepšení v1/v2. V konfigurátoru je to „v3 · střešní skener“. v1 zůstává archiv a v2 se nemění.

## Proč vůbec v3

Cíl projektu: včas najít místa, kudy hasiči a ostatní složky IZS neprojedou nebo projedou jen pomalu. Měřit se má z městských vozů, které jezdí pravidelně.

Koncepce v1 (a tedy i v2) tento cíl splňuje jen částečně:

| Problém v1/v2 | Dopad | Jak to řeší v3 |
|---|---|---|
| Lidary měří jen ve výšce dveří osobáku (0,5–1 m) | Nevidí větve, značky, balkony, markýzy ani nástavby dodávek ve výšce 2–3,5 m, kde má cisterna zrcátka a nástavbu | Skener vidí celý příčný profil od vozovky po ~4 m a výš |
| 4 bodové paprsky do strany | Měří jen čtyři body v jedné svislé čáře | Profil s ~540 body každých ~0,5 m jízdy |
| Jen kolmo do strany | Nevidí rohy a křižovatky (auto zaparkované u rohu) | Přední 3D lidar vidí před vůz a do stran |
| Přísavky, baterie, dvě jednotky, rádio mezi nimi | Montáž každou směnu, kalibrace, riziko pádu a krádeže, nabíjení | Jedna jednotka pevně na střeše, napájení z vozu |
| Slabý odraz (černý lak, mokro) se zahodí jako „nic v dosahu“ | Úzké místo vyjde jako široké, tedy nejhorší chyba | Profilový skener s jemným krokem a vyhodnocením celého profilu. Riziko zůstává, je potřeba ho ověřit (viz Rizika) |

## Princip měření

1. Dva boční 2D skenery na koncích příčného nosníku mají rovinu skenu svislou a kolmou na směr jízdy. Každý pokrývá 270°: nahoru, celý bok a dolů pod úroveň střechy. Zbylých 90° míří k vozu.
2. Při 15 profilech za sekundu a 30 km/h vznikne příčný profil ulice každých 0,56 m (při 50 km/h každých 0,93 m).
3. Z každého profilu se spočítá:
   - **volná šířka** v pásmu 0,15–3,3 m (výška cisterny): nejbližší překážka vpravo a vlevo,
   - **šířka ve výšce zrcátek** (2,0 ± 0,3 m),
   - **podjezdná výška** nad vozem: větve, balkony, vedení.
4. Výsledek se porovná s profilem cisterny (2,55 m, se zrcátky 3,0 m, výška 3,3 m, vůle 0,2 m na stranu). Stav profilu je *projede*, *těsně* nebo *neprojede*.
5. GNSS s dead reckoningem přiřadí každý profil k místu. Na server jde jen souhrn (poloha, čas, šířka, výška, stav), surová data zůstávají lokálně pro kontrolu sporných míst.
6. Na serveru se průjezdy skládají do mapy. Rozhoduje, jak často a kdy je místo úzké, ne jeden průjezd.

Aplikace to ukazuje v simulaci. Ve scéně „Na autě“ nebo „Popelář“ s v3 projede vůz úsekem náměstí Republiky. V ulici jsou zaparkovaná auta, dodávka ve druhé řadě, kontejner vytlačený do silnice, strom s větví nad vozovkou a značka. Výsledek je vidět ve scéně:

- mrak bodů obarvený podle výšky,
- koridor na vozovce (zelená / oranžová / červená),
- obrys cisterny v nejužším místě,
- podjezdná výška pod větví.

Simulace počítá geometrii přesně a paprsky vrhá BVH. Neumí odrazivost, déšť ani šum.

## Sestava

Souřadnice v CAD: X dopředu, Y nahoru, Z doprava, 0 = horní plocha střešních podélníků uprostřed rámu.

| Skupina | Díl | Návrh | Poznámka |
|---|---|---|---|
| Nosič | 2 příčníky s patkami | koupený střešní nosič 1 150 mm, nosnost ≥ 75 kg | Na popelářském voze adaptér na střechu kabiny |
| Rám | 2 podélné profily 40×40, nosník 40×80, úhelníky, příložky | hliníkové profily s drážkou 8, řezané na míru | Šrouby M8 do T-matic, nic se nevrtá do vozu |
| Senzory | 2 boční 2D skenery | třída SICK TiM781 / Hokuyo UST-20LX: 270°, 15–40 Hz, Ethernet, 9–28 V, IP67 | Držák s drážkami pro doladění sklonu ±5° |
| | přední 3D lidar | třída Livox Mid-360: 360° × 59°, Ethernet, IP67, ~6,5 W | Sklopná konzole 0–30°, výchozí 20° dolů |
| | trysky ostřikovače (volitelné) | napojení na ostřikovač vozu | Okna skenerů se špiní, viz Rizika |
| Skříň | litá hliníková skříň IP67 260×180×66 mm | Hammond 1590 / Bopla Euromas | Víko s žebry podél jízdy, bílé stínítko s mezerou proti slunci |
| | anténa GNSS L1/L5 + LTE MIMO | kombinovaná anténa na šroub | Na stínítku, výhled na oblohu |
| Elektronika | nosná deska (vlastní) | 4 vrstvy, 230×150 mm | Konektory CM5, přepínač Ethernet, slot M.2, GNSS, napájení |
| | Raspberry Pi CM5 | 4 GB RAM, 32 GB eMMC | Linux, zpracování profilů, úložiště, odesílání |
| | GNSS u-blox ZED-F9R | L1/L5, RTK, dead reckoning s IMU | Drží polohu v úzkých ulicích, pod stromy a v podjezdech |
| | LTE modem Quectel EM05-G | M.2, Cat 4 | Vyměnitelný, SIM v držáku na desce |
| | přepínač Ethernet | 5 portů | 2 skenery + 3D lidar + CM5 |
| | vstup napájení | TVS pro load dump 24 V, ideální dioda, buck-boost 12 V, buck 5 V | Funguje z 9–32 V, tedy na osobním (12 V) i nákladním (24 V) voze |
| | superkondenzátory 2× 10 F | ~10 s záloha | Po vypnutí zapalování dopíše data a vypne se |
| Konektory | 3× M12 (hybridní: napájení + Ethernet), Deutsch DT04-4P, ventil ePTFE, vývodka antény, servisní USB-C | | Nic se nepájí na voze, vše jde rozpojit |

Kusovník se skládá přímo z modelu (záložka Díly). Export STEP sestavy je v záložce Export.

## Napájení a provoz

| Spotřebič | W |
|---|---|
| 2× boční skener | 8 |
| 3D lidar | 6,5 |
| CM5 při zpracování | 8 |
| modem, GNSS, přepínač, ztráty | 3 |
| **celkem** | **~25,5 W** (~2,1 A při 12 V, ~1,1 A při 24 V) |

- Trvalé napětí (KL30) přes pojistku 5 A, zapalování (KL15) jako signál.
- Zapnutí se zapalováním, po vypnutí zapalování dopsání dat a vypnutí, klidový odběr pod 1 mA.
- Baterie, nabíjení ani 12h výdrž se neřeší, vůz je zdroj.

## Kam to dát

**Doporučení: popelářské vozy.** Projedou pravidelně skoro všechny obytné ulice, často brzy ráno, kdy stojí auta z noci. Jsou podobně velké jako cisterna, takže co neprojede popelář, neprojede ani hasič.

- Na kabině je rám ve výšce ~3 m. Skenery vidí přes zaparkovaná auta až k fasádám.
- Majáky jsou v modelu vzadu na kabině, rám je před nimi.

Osobní služební vozy (městská policie, technické služby) jsou druhá možnost. Rám se dá přendat mezi vozy, na příčníky se jen přišroubuje. Data ale budou hlavně ze dne.

## Software (co se mění proti specifikaci FW)

Dnešní specifikace říká „žádná matematika ve firmware“ a šířku počítá tablet. U v3 to nejde: profil má stovky bodů 15× za sekundu a posílat ho do tabletu nemá smysl. Proto:

- **Na zařízení (CM5, Linux):** ovladače skenerů a 3D lidaru (ROS 2 nebo vlastní proces), synchronizace času (PTP / GNSS PPS), výpočet šířky a podjezdné výšky z každého profilu, souhrn po 1 m úseku, kruhový buffer surových dat (např. posledních 7 dní), odesílání přes LTE.
- **Na serveru:** příjem souhrnů, mapování na úseky ulic (OSM), statistika podle času a dne v týdnu, výstup pro HZS (mapa a seznam opakovaně úzkých míst).
- **Tablet ani obsluha se nepotřebují.** Řidič o zařízení neví, jede jako obvykle.
- **Osobní údaje:** lidar nesnímá obličeje ani SPZ. Kamera je možné rozšíření pro ověření, co místo blokuje, ale pak je potřeba řešit GDPR (rozmazání, retence).

## Rizika a co ověřit dřív, než se cokoli objedná

1. **Odrazivost.** Černý lak a mokrý povrch pod ostrým úhlem. Ověřit u vybraného skeneru na černém autě za deště, ve vzdálenosti 0,5–4 m. To je hlavní slabina i u v1.
2. **Špína a déšť na oknech.** Skener hlásí znečištění. Rozhodnout mezi ostřikovačem, pravidelným čištěním při servisu vozu a stříškou, která ale nesmí zakrýt pole skenu.
3. **Hustota profilů.** 15 Hz při 50 km/h = profil každých 0,93 m. Na zaparkovaná auta to stačí, na sloupek nebo patník ne. Pro hustší profily skener 25–40 Hz.
4. **Poloha v úzkých ulicích.** GNSS mezi domy skáče, proto ZED-F9R s IMU. Ideálně ještě rychlost z vozu po CAN. Ověřit jízdou.
5. **Homologace a montáž na vůz.** Rám nesmí přesahovat obrys vozu. Na popelářském voze souhlas provozovatele a upevnění bez vrtání.
6. **Vibrace a teplo.** Na střeše je v létě přes 60 °C. Skříň má žebra, tepelný most a stínítko, CM5 bez ventilátoru. Ověřit teplotní zkouškou.
7. **Cena.** Řádový odhad bez práce: skenery a 3D lidar 2–4 tis. EUR, ostatní hardware do 1 tis. EUR na kus. Ceny ověřit u dodavatelů.

## Jak dál (levně, než se rozhodne)

1. **Rozhovor s HZS Plzeň**: kde nejčastěji nemohou projet a proč (šířka, výška, rohy). Rozhodne, jestli je potřeba i 3D lidar.
2. **Zápůjčka jednoho 2D skeneru** (zeptat se distributora na zápůjčku) a jedna jízda s notebookem na střeše osobního vozu přes 3–4 známá úzká místa. Za týden je jasné, jestli to funguje.
3. **Domluva s provozovatelem svozu** na jednom voze na zkoušku.
4. Pak teprve výroba skříně a nosné desky.

## Porovnání verzí

| | v1 (archiv) | v2 (koncept) | v3 (experiment) |
|---|---|---|---|
| Jednotek na voze | 2 (boky, přísavky) | 2 (boky, přísavky) | 1 (střecha, příčníky) |
| Co měří | 4 body na bok v jedné výšce | totéž | celý příčný profil 0–4 m + 3D před vozem |
| Napájení | z vozu, kabel přes vůz | baterie 72 Wh, ≥ 12 h | z vozu 12/24 V, ~25 W |
| Spojení | kabel master–slave, BLE do tabletu | ESP-NOW, LTE | Ethernet uvnitř, LTE ven |
| Obsluha | tablet s aplikací | bez telefonu | žádná |
| Vyhodnocení | tablet | tablet / server | zařízení + server |
| Hmotnost | ~1,5 kg / kus | ~1,3 kg / kus (horní odhad) | ~13–14 kg s nosičem (odhad z modelu) |
| Hlavní riziko | výška měření, montáž | výška měření, montáž | cena, čištění oken, odrazivost |
