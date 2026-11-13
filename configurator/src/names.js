// Značení lidarů podle pořadí oken od čela A (x = 0).
// Master: od antény J1, J4, J2, J3. Slave: od konektoru (čelo B) J1, J2, J4, J3.
export const WIN_NAMES = {
  master: ['J1', 'J4', 'J2', 'J3'],
  slave: ['J3', 'J4', 'J2', 'J1'],
};

// v2 (koncept): stejná jednotka pro master i slave, lidary číslované od čela A (na voze nahoře).
export const WIN_NAMES_V2 = ['J1', 'J2', 'J3', 'J4'];
export const winNames = (variant, role) => (variant === 'v2' ? WIN_NAMES_V2 : WIN_NAMES[role]);
