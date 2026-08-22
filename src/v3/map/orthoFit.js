// How wide the map actually needs to be, and what is left over for the panel.
//
// The map used to take `flex: 1` — every pixel not spoken for. But an
// orthophoto has a fixed extent, so once it is framed to the canvas height any
// extra width is empty basemap on either side of the imagery. That width was
// being spent on nothing while the summary panel, which is where the numbers
// are, stayed at its minimum.
//
// So the split is derived rather than fixed: give the map the width its imagery
// can fill at the current height, and hand the remainder to the panel.

/**
 * Aspect ratio of a lon/lat extent as it will actually be drawn.
 *
 * Web Mercator is linear in longitude but not in latitude, so the ratio cannot
 * be taken from raw degrees — a site 2° south of the equator is only mildly
 * distorted, but the formula has to be right for the sites that are not.
 */
export function mercatorAspect(extent) {
  if (!Array.isArray(extent) || extent.length !== 4) return null;
  const [west, south, east, north] = extent.map(Number);
  if (![west, south, east, north].every(Number.isFinite)) return null;

  const mercY = (lat) => {
    const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
    return Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
  };

  const xSpan = Math.abs(east - west) * (Math.PI / 180);
  const ySpan = Math.abs(mercY(north) - mercY(south));
  if (!(xSpan > 0) || !(ySpan > 0)) return null;

  return xSpan / ySpan;
}

export const PANEL_MIN = 352;
// Past this the panel is mostly whitespace: the metric tables and unit lists in
// it are not wide-format content, and stretching them further makes the numbers
// harder to scan, not easier.
export const PANEL_MAX = 560;
// Below this the map stops being able to show a trace and its surroundings at
// once, which is the whole point of the surface.
export const MAP_MIN = 520;

/**
 * Splits the workspace row between map and panel.
 *
 * `padding` accounts for the inset fitBounds leaves around the imagery, so the
 * width returned is the width at which the ortho fills the canvas rather than
 * the width at which it exactly touches the edges.
 *
 * Falls back to the panel minimum whenever the aspect is unknown — before any
 * ortho has resolved, the old behaviour is the right behaviour.
 */
export function splitWorkspace({ width, height, aspect, padding = 80 }) {
  if (!(width > 0) || !(height > 0)) return { mapWidth: null, panelWidth: PANEL_MIN };
  if (!(aspect > 0)) return { mapWidth: null, panelWidth: PANEL_MIN };

  const usableHeight = Math.max(1, height - padding);
  const idealMapWidth = usableHeight * aspect + padding;

  // The panel takes what the map does not need, bounded at both ends.
  //
  // Below MAP_MIN + PANEL_MIN the two minima cannot both hold, and the panel
  // wins: it degrades badly — the metric tables have fixed columns and start
  // clipping numbers — while the map just becomes a smaller viewport of the
  // same scene. That tiebreak is asserted in orthoFit.test.mjs so it stays a
  // decision rather than a side effect of clamp ordering.
  const maxPanel = Math.max(PANEL_MIN, Math.min(PANEL_MAX, width - MAP_MIN));
  const panelWidth = Math.round(
    Math.max(PANEL_MIN, Math.min(maxPanel, width - idealMapWidth)),
  );

  return { mapWidth: width - panelWidth, panelWidth };
}
