// Referenční fotky (kopie ve public/foto, originály v kořeni ClearWaySensor/)
export const PHOTOS = [
  ['par_01_master-vpredu_slave-vzadu_perspektiva', 'Pár', 'Master vpředu, slave vzadu'],
  ['par_02_master-dole_slave-nahore_shora', 'Pár', 'Shora: master dole, slave nahoře'],
  ['master_01_celo-okna-lidaru_antena-vpravo', 'Master', 'Strana s okny, anténa vpravo'],
  ['master_03_celo-okna-lidaru_antena-vlevo', 'Master', 'Strana s okny, anténa vlevo'],
  ['master_02_podelny-pohled-shora_od-konce-s-konektory', 'Master', 'Podélně od konce s konektory'],
  ['master_04_podelny-pohled-shora_od-konce-s-antenou', 'Master', 'Podélně od konce s anténou'],
  ['master_05_bok-profil-prisavky_antena-vpravo', 'Master', 'Profil s nohama, anténa vpravo'],
  ['master_06_bok-profil-prisavky_antena-vlevo', 'Master', 'Profil s nohama, anténa vlevo'],
  ['master_07_cep-2-konektory', 'Master', 'Čep se 2 konektory'],
  ['master_08_cep-antena-libela', 'Master', 'Čep s anténou a libelou'],
  ['slave_01_cep-1-konektor', 'Slave', 'Čep s 1 konektorem'],
  ['slave_02_cep-libela', 'Slave', 'Čep s libelou'],
  ['deska_master_ESP32-S3_detail', 'Deska', 'Master, ESP32-S3'],
  ['deska_slave_ESP32-WROOM-32UE_detail', 'Deska', 'Slave, ESP32-WROOM-32UE'],
  ['deska_master_v-pouzdre_s-lidarem', 'Deska', 'Master v pouzdře, vedle lidar'],
  ['dil_lidar-modul_stitek', 'Díl', 'Lidarový modul'],
  ['dil_kabel-PROG_TX-RX-GND', 'Díl', 'Programovací kabel TX/RX/GND'],
].map(([file, group, caption]) => ({
  group, caption, file: `${file}.jpeg`,
  thumb: `/foto/nahled/${file}.jpeg`, full: `/foto/velke/${file}.jpeg`,
}));
