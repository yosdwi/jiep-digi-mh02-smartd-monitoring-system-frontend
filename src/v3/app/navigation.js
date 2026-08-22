// V3 information architecture.
//
// The V1/V2 grouping ("Live" / "Playback") named itself after implementation
// history. "Playback" is the wrong name for the group once playback is a
// secondary interaction inside historical analysis — it is why users open these
// pages expecting a video player.
//
// The four historical pages share one query context (district, time range,
// units), so they are grouped: switching between them keeps the selection
// instead of reopening a filter modal from scratch.

export const V3_BASE = '/v3';

export const navigation = [
  {
    key: 'operasi',
    label: 'Operasi',
    items: [
      { key: 'live', label: 'Live Unit', path: `${V3_BASE}/operasi/live`, glyph: '◉', hint: 'Posisi unit realtime' },
    ],
  },
  {
    key: 'historis',
    label: 'Analisa Historis',
    items: [
      { key: 'cycle-time', label: 'Cycle Time', path: `${V3_BASE}/historis/cycle-time`, glyph: '⟳', hint: 'Jejak & siklus angkut' },
      { key: 'underspeed', label: 'Underspeed', path: `${V3_BASE}/historis/underspeed`, glyph: '⚡', hint: 'Perilaku kecepatan' },
      { key: 'durasi-in-pit', label: 'Durasi In Pit', path: `${V3_BASE}/historis/durasi-in-pit`, glyph: '◷', hint: 'Masuk, keluar, lama tinggal' },
      { key: 'datalog', label: 'Datalog Record', path: `${V3_BASE}/historis/datalog`, glyph: '▤', hint: 'Data mentah per baris' },
    ],
  },
  {
    key: 'peta',
    label: 'Peta & Wilayah',
    items: [
      { key: 'layer', label: 'Layer & Orthophoto', path: `${V3_BASE}/peta/layer`, glyph: '▦', hint: 'Sumber peta dasar' },
      { key: 'area', label: 'Area Operasi', path: `${V3_BASE}/peta/area`, glyph: '⬠', hint: 'Polygon & aturan operasional' },
    ],
  },
  {
    key: 'lab',
    label: 'Development Lab',
    items: [
      { key: 'fixture', label: 'Fixture 1 Hari', path: `${V3_BASE}/lab/fixture`, glyph: '▣', hint: 'Trace ClickHouse 2 detik' },
    ],
  },
];

export const flatNavigation = navigation.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })));

export function findNavItem(pathname) {
  return flatNavigation.find((item) => pathname.startsWith(item.path)) || null;
}

/** Pages that share the historical query context and therefore the context bar. */
export const HISTORICAL_KEYS = new Set(['cycle-time', 'underspeed', 'durasi-in-pit', 'datalog']);
