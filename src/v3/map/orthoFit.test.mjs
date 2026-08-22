// Run: node src/v3/map/orthoFit.test.mjs
//
// The split decides how much screen the panel gets, so the invariants that
// matter are the bounds — the map must stay usable and the panel must never
// collapse, whatever the imagery's shape.

import assert from 'node:assert/strict';
import {
  MAP_MIN, PANEL_MAX, PANEL_MIN, mercatorAspect, splitWorkspace,
} from './orthoFit.js';

// A square extent on the equator is square on screen.
assert.ok(Math.abs(mercatorAspect([100, -0.5, 101, 0.5]) - 1) < 0.01);

// The same degree span away from the equator is stretched vertically by
// Mercator, so it draws NARROWER than square.
assert.ok(mercatorAspect([100, 59.5, 101, 60.5]) < 0.55);

// Kalimantan sites sit near the equator: a 2:1 extent stays close to 2:1.
assert.ok(Math.abs(mercatorAspect([115.0, -2.5, 115.2, -2.4]) - 2) < 0.05);

assert.equal(mercatorAspect(null), null);
assert.equal(mercatorAspect([1, 2, 3]), null);
assert.equal(mercatorAspect([100, 5, 100, 6]), null);   // zero width

// Unknown aspect keeps the old fixed-panel behaviour.
assert.equal(splitWorkspace({ width: 1920, height: 900, aspect: null }).panelWidth, PANEL_MIN);
assert.equal(splitWorkspace({ width: 0, height: 0, aspect: 2 }).panelWidth, PANEL_MIN);

// A wide, letterboxed ortho leaves nothing spare: the panel stays at minimum.
{
  const { panelWidth, mapWidth } = splitWorkspace({ width: 1600, height: 900, aspect: 3 });
  assert.equal(panelWidth, PANEL_MIN);
  assert.equal(mapWidth, 1600 - PANEL_MIN);
}

// A tall ortho needs little width, so the surplus goes to the panel — capped.
{
  const { panelWidth } = splitWorkspace({ width: 2400, height: 900, aspect: 0.6 });
  assert.equal(panelWidth, PANEL_MAX);
}

// The map holds MAP_MIN whenever the window can afford both minima.
{
  const { mapWidth } = splitWorkspace({ width: 1000, height: 900, aspect: 0.4 });
  assert.ok(mapWidth >= MAP_MIN, `map ${mapWidth} below MAP_MIN`);
}

// Below MAP_MIN + PANEL_MIN the two cannot both hold. The panel wins, on
// purpose: its tables clip, the map only shrinks. Asserted so the tiebreak stays
// a decision instead of whatever the clamp order happens to produce.
{
  const width = 800;
  const { panelWidth, mapWidth } = splitWorkspace({ width, height: 900, aspect: 0.4 });
  assert.equal(panelWidth, PANEL_MIN);
  assert.equal(mapWidth, width - PANEL_MIN);
  assert.ok(mapWidth < MAP_MIN);
}

// And the panel never collapses, even when the map would want everything.
for (const width of [700, 1000, 1366, 1920, 2560]) {
  for (const aspect of [0.3, 0.8, 1.5, 2.5, 4]) {
    const { panelWidth, mapWidth } = splitWorkspace({ width, height: 900, aspect });
    assert.ok(panelWidth >= PANEL_MIN, `panel ${panelWidth} < min at ${width}/${aspect}`);
    assert.ok(panelWidth <= PANEL_MAX, `panel ${panelWidth} > max at ${width}/${aspect}`);
    assert.equal(panelWidth + mapWidth, width, 'split must cover the row exactly');
  }
}

console.log('orthoFit: ok');
