// RAF-frequency playhead value, deliberately OUTSIDE Zustand.
//
// Why not just another Zustand field: every `set()` call on a Zustand store
// walks *every* subscriber's selector across the whole app to check whether
// its derived slice changed — cheap per-selector, but at 60fps with however
// many components use useCycleTimeStore() for anything, it adds up. A plain
// module-level ref + pub/sub, read via React's own useSyncExternalStore, is
// the smallest primitive that does exactly what's needed here: let ONE
// component (the map) subscribe to a fast-changing value without involving
// anything else that happens to share the app's global store.
//
// This is intentionally NOT a general-purpose store. It holds exactly one
// number (0-100 playback progress) for exactly this purpose.

let playhead = 0;
const listeners = new Set();

export function setPlayhead(value) {
  playhead = typeof value === 'number' ? value : 0;
  listeners.forEach((listener) => listener());
}

export function getPlayhead() {
  return playhead;
}

export function subscribePlayhead(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
