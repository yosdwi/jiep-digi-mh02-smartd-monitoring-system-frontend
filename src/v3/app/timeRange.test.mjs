// Run: node src/v3/app/timeRange.test.mjs
//
// Guards the one rule that was actually wrong before: a shift preset must never
// resolve to a window that has not started yet.

import assert from 'node:assert/strict';
import { ceilHour, endOfDay, floorHour, shiftRange, startOfDay, stepRangeDays, toInput } from './timeRange.js';

const at = (iso) => new Date(iso);
const range = (which, iso) => shiftRange(which, at(iso)).map(toInput);

// 08:00 — the normal time to review the night that just ended.
assert.deepEqual(range(2, '2026-08-18T08:00'), ['2026-08-17T18:00', '2026-08-18T06:00']);
assert.deepEqual(range(1, '2026-08-18T08:00'), ['2026-08-18T06:00', '2026-08-18T18:00']);

// 20:00 — shift 2 has started, so it is today's.
assert.deepEqual(range(2, '2026-08-18T20:00'), ['2026-08-18T18:00', '2026-08-19T06:00']);

// 03:00 — before either of today's shifts begins; both fall back a day.
assert.deepEqual(range(1, '2026-08-18T03:00'), ['2026-08-17T06:00', '2026-08-17T18:00']);
assert.deepEqual(range(2, '2026-08-18T03:00'), ['2026-08-17T18:00', '2026-08-18T06:00']);

// A shift preset never starts in the future.
for (const hour of ['00:30', '05:59', '06:00', '12:00', '17:59', '18:00', '23:30']) {
  const now = at(`2026-08-18T${hour}`);
  for (const which of [1, 2]) {
    assert.ok(shiftRange(which, now)[0] <= now, `shift ${which} starts in the future at ${hour}`);
  }
}

// Stepping keeps the window length and crosses month boundaries.
assert.deepEqual(
  stepRangeDays('2026-08-01T06:00', '2026-08-01T18:00', -1).map(toInput),
  ['2026-07-31T06:00', '2026-07-31T18:00'],
);
assert.equal(stepRangeDays('not-a-date', '2026-08-01T18:00', 1), null);

// Hour granularity. Availability and both fleet sources are stored per hour, so
// a range must never carry minutes — see the note on toInput.
assert.equal(toInput(at('2026-08-18T06:37')), '2026-08-18T06:00');
assert.equal(toInput(floorHour(at('2026-08-18T06:37'))), '2026-08-18T06:00');

// Ceil takes the end forward so the hour in progress is covered, and leaves an
// already-exact hour alone rather than adding a spurious one.
assert.equal(toInput(ceilHour(at('2026-08-18T09:37'))), '2026-08-18T10:00');
assert.equal(toInput(ceilHour(at('2026-08-18T09:00'))), '2026-08-18T09:00');

// A day is 24 slots, so its exclusive end is the next midnight. At 23:59 the
// last hour of every "hari ini" query would be snapped away.
assert.equal(toInput(startOfDay(at('2026-08-18T13:00'))), '2026-08-18T00:00');
assert.equal(toInput(endOfDay(at('2026-08-18T13:00'))), '2026-08-19T00:00');
assert.equal(
  (endOfDay(at('2026-08-18T13:00')) - startOfDay(at('2026-08-18T13:00'))) / 3600e3,
  24,
);

// Shift presets are already whole hours and must survive the snap unchanged.
for (const which of [1, 2]) {
  for (const bound of shiftRange(which, at('2026-08-18T08:00'))) {
    assert.equal(bound.getMinutes(), 0, `shift ${which} bound carries minutes`);
  }
}

console.log('timeRange: ok');
