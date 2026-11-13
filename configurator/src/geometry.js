// Sdílená geometrie bez závislostí (CAD worker, rychlý náhled i scéna).
// X podél těla: 0 = čelo A (anténa / libela), total = čelo B (konektory).
const v = (P, g, k) => P[g][k].v;

/** Rozvržení: čelo A | (kryt) | okno 1 | A | okno 2 | B | okno 3 | C | okno 4 | (kryt) | čelo B */
export function layout(P) {
  const total = v(P, 'delky', 'celkova');
  const cep = v(P, 'delky', 'cep');
  const win = v(P, 'delky', 'modul_okna');
  const centers = [1, 2, 3, 4].map(i => v(P, 'delky', `okno_${i}`));
  const parts = [{ kind: 'cap', x0: 0, len: cep, end: 0 }];
  const names = ['konec_A', 'A', 'B', 'C'];
  let x = cep;
  centers.forEach((c, i) => {
    const a = Math.max(c - win / 2, x);
    const b = Math.min(c + win / 2, total - cep);
    if (a - x > 0.5) parts.push({ kind: 'segment', x0: x, len: a - x, name: names[i], edge: i === 0 });
    if (b - a > 0.5) parts.push({ kind: 'window', x0: a, len: b - a, index: i });
    x = Math.max(x, b);
  });
  if (total - cep - x > 0.5) parts.push({ kind: 'segment', x0: x, len: total - cep - x, name: 'konec_B', edge: true });
  parts.push({ kind: 'cap', x0: total - cep, len: cep, end: 1 });
  return { parts, total };
}

/**
 * Nohy. Tištěný válec je seříznutý do klínu: „blizko“ = výška na straně ke konektorům (+X),
 * „daleko“ = na opačné straně. Z toho plyne náklon podstavy s přísavkou (°, + = ke konektorům)
 * a výška válce v ose (hc), kolem které se spodní část natáčí.
 */
export function feet(P) {
  const { total } = layout(P);
  // v2: kloubové nohy (koule), úhel je nastavitelný, žádné klíny
  if (P.noha.kloub_vyska) {
    const kv = v(P, 'noha', 'kloub_vyska'), tilt = v(P, 'noha', 'kloub_uhel');
    return [
      { name: 'zadni', x: v(P, 'noha', 'odsazeni_zadni'), near: kv, far: kv, hc: kv, tilt },
      { name: 'predni', x: total - v(P, 'noha', 'odsazeni_predni'), near: kv, far: kv, hc: kv, tilt },
    ];
  }
  const D = v(P, 'noha', 'valec_prumer');
  const mk = (name, x, near, far) => ({
    name, x, near, far,
    hc: (near + far) / 2,
    tilt: Math.atan2(far - near, D) * 180 / Math.PI,
  });
  return [
    mk('zadni', v(P, 'noha', 'odsazeni_zadni'), v(P, 'noha', 'zadni_valec_blizko'), v(P, 'noha', 'zadni_valec_daleko')),
    mk('predni', total - v(P, 'noha', 'odsazeni_predni'), v(P, 'noha', 'predni_valec_blizko'), v(P, 'noha', 'predni_valec_daleko')),
  ];
}

/** Nejnižší bod nohou pod spodkem těla (u nakloněné přísavky rozhoduje její okraj). */
export function footHeight(P) {
  const L = v(P, 'noha', 'drzak_vyska') + v(P, 'noha', 'prisavka_vyska');
  const pr = v(P, 'noha', 'prisavka_prumer') / 2;
  return Math.max(...feet(P).map(f => {
    const a = Math.abs(f.tilt) * Math.PI / 180;
    return f.hc + L * Math.cos(a) + pr * Math.sin(a);
  }));
}
