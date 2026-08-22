// Historical trace storage. Deliberately NOT a React store.
//
// Two reasons, both from V2's measured problems:
//  1. Every Zustand `set()` walks every subscriber's selector app-wide. Trace
//     chunks land in bursts; putting them in the store would run that walk once
//     per chunk for data only the map cares about.
//  2. Typed arrays are structurally hostile to immutable-update semantics. The
//     entire point is that a buffer's identity stays STABLE so deck.gl does not
//     re-upload it to the GPU. A store that hands out new references on every
//     change defeats the binary-attribute path.
//
// React reads this through useSyncExternalStore on a version counter, which is
// exactly the notification it needs and nothing more. Same pattern as
// services/playbackAnimationRuntime.js, applied to data instead of the playhead.

const devices = new Map();   // deviceId -> DeviceTrace
const hours = new Map();     // hourKey  -> HourBuffers
let version = 0;
const listeners = new Set();

// Two views of the same memory.
//
// `hours` holds one flat buffer set per hour — what the map draws, one deck.gl
// layer each. `devices` holds per-device columns that are subarray VIEWS into
// those same buffers, which is what every analytics, playback and panel consumer
// reads. Nothing is copied and nothing is duplicated: recolouring a device
// writes through its view into the hour buffer the GPU already has.
//
// The alternative — a buffer per (device, hour) — made the layer count devices x
// hours and lost the WebGL context at fleet scale.

/**
 * @typedef {Object} ChunkColumns
 * @property {number} n
 * @property {Float64Array} position   interleaved [lon,lat]
 * @property {Float32Array} filter     interleaved [tMs,speed]
 * @property {Uint8Array}   color      RGBA
 * @property {Float64Array} epochMs
 * @property {Float32Array} speed
 * @property {Float32Array} plmStatus
 * @property {Uint8Array}   band
 */

function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getVersion = () => version;

/**
 * Notify subscribers after an in-place buffer mutation (recolour, reband).
 * The buffers themselves keep their identity — that is the point — so React and
 * deck.gl need an explicit signal that their contents changed.
 */
export const touch = bump;

/**
 * Append one decoded chunk to a device's trace.
 *
 * Chunks are kept as a list rather than concatenated into one growing buffer.
 * Concatenating would reallocate and re-upload the whole device trace on every
 * arriving hour — O(n²) uploads over a day. One deck.gl sublayer per chunk costs
 * one extra draw call each, which is far cheaper than re-uploading megabytes.
 */
export function addChunk(deviceId, key, columns, meta = {}) {
  insertChunk(deviceId, key, columns, meta);
  bump();
}

// Same insert without the notification, so a whole hour lands as one update
// instead of one per device — 137 subscriber walks per hour is not free.
function insertChunk(deviceId, key, columns, meta = {}) {
  let entry = devices.get(deviceId);
  if (!entry) {
    entry = {
      deviceId,
      unitNo: meta.unitNo || deviceId,
      colorIndex: meta.colorIndex ?? devices.size,
      chunks: new Map(),
      n: 0,
      minMs: Infinity,
      maxMs: -Infinity,
    };
    devices.set(deviceId, entry);
  }
  if (entry.chunks.has(key)) return;

  entry.chunks.set(key, columns);
  entry.n += columns.n;
  if (meta.minMs != null && meta.minMs < entry.minMs) entry.minMs = meta.minMs;
  if (meta.maxMs != null && meta.maxMs > entry.maxMs) entry.maxMs = meta.maxMs;
  if (meta.unitNo) entry.unitNo = meta.unitNo;
}

/**
 * Store one hour's flat buffers and register every device's slice of them.
 *
 * `ranges` comes from the decoder: [{ deviceIndex, start, count, ... }] in
 * buffer order. `resolve(deviceIndex)` maps that to { deviceId, unitNo,
 * colorIndex } — the loader owns the device list, the registry does not.
 */
export function addHour(key, columns, ranges, resolve) {
  if (hours.has(key)) return;

  const entries = [];
  ranges.forEach((range) => {
    const device = resolve(range.deviceIndex);
    if (!device) return;
    const { start, count } = range;
    entries.push({ deviceId: device.deviceId, start, count });

    insertChunk(device.deviceId, key, {
      n: count,
      // Views, not copies: writes through these land in the hour buffer.
      position: columns.position.subarray(start * 2, (start + count) * 2),
      filter: columns.filter.subarray(start * 2, (start + count) * 2),
      color: columns.color.subarray(start * 4, (start + count) * 4),
      epochMs: columns.epochMs.subarray(start, start + count),
      speed: columns.speed.subarray(start, start + count),
      plmStatus: columns.plmStatus.subarray(start, start + count),
      hm: columns.hm.subarray(start, start + count),
      fuelLevel: columns.fuelLevel.subarray(start, start + count),
      actTonnage: columns.actTonnage.subarray(start, start + count),
      band: columns.band.subarray(start, start + count),
      bins: range.bins,
    }, {
      unitNo: device.unitNo,
      colorIndex: device.colorIndex,
      minMs: range.minMs,
      maxMs: range.maxMs,
    });
  });

  hours.set(key, {
    key,
    n: columns.n,
    position: columns.position,
    filter: columns.filter,
    color: columns.color,
    entries,
  });
  bump();
}

/**
 * How many hours are loaded.
 *
 * A stable scalar for useSyncExternalStore: it changes only when an hour lands,
 * not on every in-place colour mutation, so an effect keyed on it re-runs when
 * there is new data to treat and stays quiet when a bump was merely a recolour.
 */
export const getHourCount = () => hours.size;

/** Hour buffers in key order — one deck.gl layer each. */
export function listHours() {
  return [...hours.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

/**
 * Which device a picked sample belongs to.
 * Ranges are contiguous and in buffer order, so this is a binary search over
 * one entry per device rather than a per-sample lookup table.
 */
export function deviceAtSample(hourKey, index) {
  const hour = hours.get(hourKey);
  if (!hour) return null;
  const list = hour.entries;
  let lo = 0;
  let hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const entry = list[mid];
    if (index < entry.start) hi = mid - 1;
    else if (index >= entry.start + entry.count) lo = mid + 1;
    else return devices.get(entry.deviceId) || null;
  }
  return null;
}

export function getDevice(deviceId) {
  return devices.get(deviceId);
}

export function listDevices() {
  return [...devices.values()];
}

export function totalSamples() {
  let total = 0;
  devices.forEach((d) => { total += d.n; });
  return total;
}

/** Sum per-chunk bin counts into one histogram for the temporal strip. */
export function aggregateBins(binCount, deviceIds = null) {
  const out = new Uint32Array(binCount);
  const wanted = deviceIds ? new Set(deviceIds) : null;
  devices.forEach((device, id) => {
    if (wanted && !wanted.has(id)) return;
    device.chunks.forEach((chunk) => {
      const bins = chunk.bins;
      if (!bins || bins.length !== binCount) return;
      for (let i = 0; i < binCount; i++) out[i] += bins[i];
    });
  });
  return out;
}

/**
 * Recolour every sample of a device in place.
 *
 * Mutating the existing Uint8Array keeps the buffer identity stable, so deck.gl
 * updates one attribute instead of rebuilding the layer. Callers must bump a
 * colour version so the layer's updateTriggers fire.
 */
// Alpha is left alone by both recolour paths: it carries selection dimming (see
// setDimmed), and rewriting it here would undim the fleet every time a colour or
// a speed band changed. Pass an explicit `alpha` only to force one.
export function recolorDevice(deviceId, rgbTriple, alpha = null) {
  const entry = devices.get(deviceId);
  if (!entry) return;
  const [r, g, b] = rgbTriple;
  entry.chunks.forEach((chunk) => {
    const c = chunk.color;
    for (let i = 0; i < chunk.n; i++) {
      c[i * 4] = r;
      c[i * 4 + 1] = g;
      c[i * 4 + 2] = b;
      if (alpha !== null) c[i * 4 + 3] = alpha;
    }
  });
}

/** Recolour by speed band. `bandRgb[i]` is the colour for band index i. */
export function recolorDeviceByBand(deviceId, bandRgb, alpha = null) {
  const entry = devices.get(deviceId);
  if (!entry) return;
  entry.chunks.forEach((chunk) => {
    const c = chunk.color;
    const band = chunk.band;
    for (let i = 0; i < chunk.n; i++) {
      const t = bandRgb[band[i]] || bandRgb[0];
      c[i * 4] = t[0];
      c[i * 4 + 1] = t[1];
      c[i * 4 + 2] = t[2];
      if (alpha !== null) c[i * 4 + 3] = alpha;
    }
  });
}

export function clear() {
  devices.clear();
  hours.clear();
  bump();
}

/**
 * Fade every device outside `selectedIds` by writing the alpha channel in place.
 *
 * Dimming used to be a per-layer `opacity`, which only worked while each device
 * owned a layer. With one layer per hour the distinction has to live in the data,
 * and alpha is already per sample. Passing an empty selection restores all.
 *
 * Only the alpha byte is touched, so this composes with the speed-band and unit
 * recolouring rather than fighting it.
 */
export function setDimmed(selectedIds, dimAlpha = 40, fullAlpha = 190) {
  const selected = selectedIds && selectedIds.length > 0 ? new Set(selectedIds) : null;
  devices.forEach((entry, deviceId) => {
    const alpha = !selected || selected.has(deviceId) ? fullAlpha : dimAlpha;
    entry.chunks.forEach((chunk) => {
      const c = chunk.color;
      for (let i = 0; i < chunk.n; i++) c[i * 4 + 3] = alpha;
    });
  });
  bump();
}

/**
 * Nearest sample to a timestamp, for playback interpolation.
 * Binary search per chunk after locating the chunk by its time span.
 */
export function sampleAt(deviceId, tMs) {
  const entry = devices.get(deviceId);
  if (!entry) return null;

  for (const chunk of entry.chunks.values()) {
    const e = chunk.epochMs;
    if (chunk.n === 0) continue;
    if (tMs < e[0] || tMs > e[chunk.n - 1]) continue;

    let lo = 0;
    let hi = chunk.n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (e[mid] < tMs) lo = mid + 1;
      else hi = mid;
    }
    const i = lo > 0 && Math.abs(e[lo - 1] - tMs) < Math.abs(e[lo] - tMs) ? lo - 1 : lo;
    const next = Math.min(i + 1, chunk.n - 1);
    const span = e[next] - e[i];
    const f = span > 0 ? Math.min(1, Math.max(0, (tMs - e[i]) / span)) : 0;

    return {
      // Position is interpolated so motion is smooth between 1 Hz samples.
      longitude: chunk.position[i * 2] + (chunk.position[next * 2] - chunk.position[i * 2]) * f,
      latitude: chunk.position[i * 2 + 1] + (chunk.position[next * 2 + 1] - chunk.position[i * 2 + 1]) * f,
      // Everything else is taken from the nearest real sample, NOT interpolated:
      // a payload of 14.2 t halfway between an empty and a full reading never
      // existed, and plm_status is categorical.
      speed: chunk.speed[i],
      plmStatus: chunk.plmStatus[i],
      hm: chunk.hm ? chunk.hm[i] : NaN,
      fuelLevel: chunk.fuelLevel ? chunk.fuelLevel[i] : NaN,
      actTonnage: chunk.actTonnage ? chunk.actTonnage[i] : NaN,
      epochMs: e[i],
    };
  }
  return null;
}
