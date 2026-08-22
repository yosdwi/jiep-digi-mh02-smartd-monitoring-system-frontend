// V3 design tokens.
//
// Promoted from components/mir/operasi/mirTokens.js rather than invented: that
// file already carries a validated light, colourblind-safe palette and the house
// encoding principle ("bentuk dulu, warna penguat" — shape first, colour as
// reinforcement). V3 keeps those values byte-for-byte and adds only the scales a
// full application shell needs (spacing, type, elevation, layout metrics).
//
// Light-first, single theme. See V3_PRODUCT_AND_ARCHITECTURE_PLAN.md §18.

export const color = {
  // greys — g0 lightest surface, ink darkest text
  white: '#ffffff',
  g0: '#f4f6f8',
  g1: '#eaeef2',
  g2: '#dde3ea',
  g3: '#cbd3dc',
  g4: '#9aa7b5',
  g5: '#76828f',
  g6: '#586473',
  ink: '#243240',

  line: '#dde3ea',
  lineStrong: '#cbd3dc',

  // selection
  sel: '#1f7a96',
  selBg: '#e2f1f5',
  selLine: '#1f7a96',

  // chrome
  navBar: '#3b4b5c',

  // semantic
  ok: '#2e9e5b',
  warn: '#e08a3c',
  crit: '#d9483f',
  info: '#1f7a96',
};

// Inter is the intended face: it was drawn for UI at small sizes, its figures
// are unambiguous at a glance (1/l, 0/O), and it ships a real tabular set —
// which this product leans on for every metric column.
//
// ponytail: named first in the stack rather than bundled, so nothing here
// depends on a network fetch or a new package. On a machine without Inter this
// falls back to the platform UI face, which is metrically close enough that the
// scale below still holds. To guarantee it, `npm i @fontsource-variable/inter`
// and import it in theme.css — that is the whole upgrade.
export const font = {
  sans: "Inter,'Inter Variable',ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif",
  mono: "ui-monospace,'Cascadia Code','Consolas',monospace",
};

// Type scale. Mirrors the --text-* tokens in theme.css; keep the two in step.
//
// The previous scale ran 11/12/13/14/16 and stopped there. With no tier above
// 16 every heading, label and value competed at the same visual weight, which
// is what made the product read flat regardless of how the panels were laid
// out. Body moves 13 -> 14 and a real top end (lg/xl) and a tabular metric tier
// are added; 11-13 stay for the dense tabular surfaces operations still needs.
// The floor moved up by one step across the board. The previous scale was not
// missing a top end any more, but it still *started* at 11px, and 11px uppercase
// with letter-spacing is where the product read as instrumentation: every label
// in the filter bar, every panel overline and every table header sat there.
//
// 12px is now the smallest thing rendered, and only for overlines and the
// densest table cells. Controls and body sit at 15px, which is the size the
// filter bar needed to stop feeling cramped.
export const text = {
  micro: { fontSize: 12, lineHeight: '16px' },
  xs: { fontSize: 13, lineHeight: '18px' },
  sm: { fontSize: 14, lineHeight: '20px' },
  base: { fontSize: 15, lineHeight: '22px' },
  md: { fontSize: 16, lineHeight: '24px' },
  lg: { fontSize: 19, lineHeight: '26px' },
  xl: { fontSize: 24, lineHeight: '32px' },
  // Figures. `fontVariantNumeric` keeps columns from reflowing as digits change.
  metric: { fontSize: 24, lineHeight: '30px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  metricLg: { fontSize: 32, lineHeight: '38px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  // Overline for section headers inside panels. Letter-spacing eased from 0.06em
  // to 0.04em: tracking that wide is a 11px mannerism and reads as noise at 12.
  label: { fontSize: 12, lineHeight: '16px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 },
};

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 };

export const radius = { sm: 4, md: 6, lg: 10 };

// Deliberately shallow. Panels are separated by borders, not shadows; the only
// shadows are on things that genuinely float above the map.
export const shadow = {
  panel: '0 1px 2px rgba(36,50,64,0.08), 0 0 0 1px rgba(36,50,64,0.06)',
  float: '0 2px 8px rgba(36,50,64,0.14), 0 0 0 1px rgba(36,50,64,0.08)',
};

// Chrome sizing.
//
// The navigation is now labelled by default (`navWidth`) rather than a 56px
// icon rail that had to be hovered to be read. Nine destinations in three groups
// is an application menu, and hiding it behind a hover was optimising for map
// pixels at the cost of the product reading as a tool someone shipped. The rail
// width survives as the *collapsed* state, which is a user choice rather than
// the default.
export const layout = {
  navWidth: 232,
  navWidthCollapsed: 60,
  contextBarHeight: 60,
  panelWidth: 352,
  panelHeaderHeight: 48,
  controlHeight: 36,
  controlHeightSm: 30,
  dockHeaderHeight: 40,
  temporalHeight: 132,
  temporalHeightPlayback: 168,
};

export const zIndex = {
  map: 0,
  mapOverlay: 10,
  panel: 20,
  contextBar: 30,
  rail: 40,
  popover: 50,
  modal: 60,
};

// hex → [r,g,b] for deck.gl accessors.
export function rgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgba(hex, alpha = 255) {
  return [...rgb(hex), alpha];
}

// Categorical ramp for "colour by unit". Ordered so adjacent entries stay
// distinguishable under deuteranopia and protanopia; 10 entries then cycles,
// because beyond ~10 simultaneous units colour identity stops being readable and
// the user should be filtering, not squinting.
export const UNIT_RAMP = [
  '#1f77b4', '#d95f02', '#2e9e5b', '#7570b3', '#e7298a',
  '#66a61e', '#a6761d', '#1f7a96', '#e08a3c', '#666666',
];

export const unitColor = (index) => UNIT_RAMP[index % UNIT_RAMP.length];
