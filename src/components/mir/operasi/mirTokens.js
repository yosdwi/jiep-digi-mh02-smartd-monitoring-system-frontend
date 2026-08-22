// Design tokens MIR — tema Light SMARTD (sumber: _mockups/DESIGN.md & wireframe-operations.html).
// Encoding: BENTUK dulu, warna penguat (colorblind-safe). Bahasa UI = Indonesia.
export const T = {
  w: '#ffffff',
  g0: '#f4f6f8',
  g1: '#eaeef2',
  g2: '#dde3ea',
  g3: '#cbd3dc',
  g4: '#9aa7b5',
  g5: '#76828f',
  g6: '#586473',
  ink: '#243240',
  line: '#dde3ea',
  sel: '#1f7a96',
  selBg: '#e2f1f5',
  navBar: '#3b4b5c',
  // semantic
  ok: '#2e9e5b', // aman · RTK FIX
  warn: '#e08a3c', // warning · RTK FLOAT/DGPS/SINGLE
  crit: '#d9483f', // crossing · dalam zona unsafe
  ff: "ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif",
  mono: "ui-monospace,'Cascadia Code','Consolas',monospace",
};

// Status zona unit — taksonomi spasial geofence (bukan jarak/awareness):
//   CROSSING = di dalam unsafe area (mir_unsafe)  → "Area crossing" (bahaya)
//   DUMPING  = di dalam dumping area (mir_in_area) → "Area dumping"  (dalam zona)
//   OUTSIDE  = punya posisi, di luar polygon       → "Di luar zona"
//   UNKNOWN  = tak ada data jarak/area
// "Dalam zona" = di dalam polygon (DUMPING|CROSSING), bukan sekadar unsafe.
export function zoneStatus({ mirDistance, mirInArea, mirUnsafe }) {
  if (mirUnsafe === 1 || mirUnsafe === '1') return 'CROSSING';
  if (mirInArea === 1 || mirInArea === '1') return 'DUMPING';
  if (mirDistance == null) return 'UNKNOWN';       // benar-benar tak ada data
  return 'OUTSIDE';                                  // -9999 (faraway) / di luar polygon
}
export const inZone = (status) => status === 'CROSSING' || status === 'DUMPING';

// Teks jarak untuk marker: "X m" saat di dalam zona; "FARAWAY" saat -9999 (di luar);
// null bila tak ada data (marker tanpa baris jarak).
export function distLabel(mirDistance) {
  if (mirDistance == null) return null;
  if (mirDistance === -9999) return 'FARAWAY';
  if (mirDistance < 0) return null;
  return `${mirDistance < 10 ? Number(mirDistance).toFixed(1) : Number(mirDistance).toFixed(0)} m`;
}

// Kualitas GPS → label (rtkfix: 1 SINGLE, 2 DGPS, 4 RTK FIX, 5 RTK FLOAT).
export function rtkLabel(fix) {
  const n = Number(fix);
  return { 1: 'SINGLE', 2: 'DGPS', 4: 'RTK FIX', 5: 'RTK FLOAT' }[n] || (fix ? String(fix) : '—');
}
export const isRtkFix = (fix) => Number(fix) === 4;

// Bentuk penanda (DESIGN.md §2): ● rover · ▲/△ cabin (isi=RTK FIX) · ◆ penanda.
// Di layar Operasi, unit MQTT = CABIN (alat berat ber-MIR); rover = perimeter geofence.
export function cabinGlyph(fix) {
  return isRtkFix(fix) ? '▲' : '△'; // isi penuh = RTK FIX, kosong = di bawah FIX
}

// Eskalasi warna: di luar zona/faraway = netral (abu) → area dumping = perhatian (amber) → area crossing = bahaya (merah).
export function statusColor(status) {
  return { CROSSING: T.crit, DUMPING: T.warn, OUTSIDE: T.g5, UNKNOWN: T.g5 }[status] || T.g5;
}

// Label ramah status zona (sidebar/detail/legenda).
export function zoneLabel(status) {
  return { CROSSING: 'Area crossing ⚠', DUMPING: 'Area dumping', OUTSIDE: 'Di luar zona', UNKNOWN: 'Tak diketahui' }[status] || '—';
}
// Label pendek untuk badge/chip (tanpa simbol).
export function zoneShort(status) {
  return { CROSSING: 'Area crossing', DUMPING: 'Area dumping', OUTSIDE: 'Di luar zona', UNKNOWN: '—' }[status] || '—';
}

// warna semantic per tipe alert
export const alertColor = (type) => (type === 'CROSSING' ? T.crit : T.warn);

// hex → [r,g,b] untuk deck.gl
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const statusRgb = (status) => hexToRgb(statusColor(status));
