// RAF-frequency playhead, deliberately OUTSIDE any React store.
//
// Same primitive and same reasoning as services/playbackAnimationRuntime.js
// (V2), with one correction: the value here is an ABSOLUTE epoch timestamp in
// milliseconds, not a 0-100 percentage of row count.
//
// V2's percentage-of-rows model is why its timeline could not say anything about
// when events happened: two devices with different sample counts were at
// different wall-clock times at the same "progress". Epoch ms is the same axis
// the temporal strip, the brush and the data all use, so everything lines up by
// construction.

let playheadMs = 0;
const listeners = new Set();

export function setPlayhead(ms) {
  playheadMs = typeof ms === 'number' && Number.isFinite(ms) ? ms : 0;
  listeners.forEach((l) => l());
}

export const getPlayhead = () => playheadMs;

export function subscribePlayhead(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
