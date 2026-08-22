// Cycle-time analytics, ported from the backend.
//
// WHY THIS EXISTS: the PlaybackV2 path only returns totalRitase, averageSpeed
// and pointCount (Models/PlaybackV2Models.cs, PlaybackV2Summary). The richer
// metrics — loaded/empty distance and duration, front→disposal distance, average
// cycle time — are computed only by the legacy TrackingHistoryController, which
// serves one unit at a time. So on the V2 path `toLegacySummary` fills them with
// zeros, and V1/V2's Summary Analytics card shows 0 for cycle time and both
// jarak figures whenever PlaybackV2 is enabled.
//
// This worker recomputes them on the client from the same plm_status column the
// backend uses, so a multi-unit V3 selection gets the full metric set.
//
// BUSINESS LOGIC IS A FAITHFUL PORT, NOT A REINTERPRETATION. Each function below
// names the C# method it mirrors. Anyone changing one must change both:
//
//   totalRitase            <- CalculateTotalRitase              (TrackingHistoryController.cs)
//   avgCycleTime           <- CalculateAverageCycleTime
//   avgJarakFrontDisposal  <- CalculateFrontDisposal
//   avgJarakDisposalFront  <- CalculateDisposalFront
//   loaded/empty dist+dur  <- CalculateTrailAnalytics main loop
//   averageSpeed           <- CalculateTrailAnalytics (mean of speed > 0)
//   distance               <- CalculateHaversineDistance (R = 6371000 m)
//
// plm_status taxonomy (cycleTimeStore.js getStatusText):
//   0 ACC ON · 1 Standby · 2 Running-Kosongan · 3 Loading
//   4 Running-Muatan · 5 Stop-Muatan · 6 Dumping

const EARTH_RADIUS_M = 6371000;

const LOADED = new Set([4, 5]);   // muatan
const EMPTY = new Set([1, 2]);    // kosongan
const LOADING = 3;
const DUMPING = 6;

export const STATE_META = {
  0: { label: 'ACC ON', color: '#64748b' },
  1: { label: 'Standby', color: '#eab308' },
  2: { label: 'Kosongan', color: '#06b6d4' },
  3: { label: 'Loading', color: '#f97316' },
  4: { label: 'Muatan', color: '#22c55e' },
  5: { label: 'Stop muatan', color: '#a855f7' },
  6: { label: 'Dumping', color: '#ef4444' },
};

function haversine(lat1, lon1, lat2, lon2) {
  if (!(lat1 >= -90 && lat1 <= 90) || !(lat2 >= -90 && lat2 <= 90)) return 0;
  if (!(lon1 >= -180 && lon1 <= 180) || !(lon2 >= -180 && lon2 <= 180)) return 0;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Flatten a device's chunk list into one chronologically ordered view.
 * Chunk keys are WITA hours, so lexical sort is chronological sort.
 */
function flatten(device, startMs, endMs) {
  const ordered = device.chunks.slice().sort((a, b) => (a.key < b.key ? -1 : 1));
  let total = 0;
  ordered.forEach((c) => { total += c.n; });

  const t = new Float64Array(total);
  const lat = new Float64Array(total);
  const lon = new Float64Array(total);
  const speed = new Float32Array(total);
  const plm = new Int16Array(total);
  const tonnage = new Float32Array(total);
  const fuel = new Float32Array(total);
  const hm = new Float32Array(total);

  let n = 0;
  ordered.forEach((chunk) => {
    for (let i = 0; i < chunk.n; i++) {
      const ts = chunk.epochMs[i];
      if (ts < startMs || ts > endMs) continue;
      t[n] = ts;
      lon[n] = chunk.position[i * 2];
      lat[n] = chunk.position[i * 2 + 1];
      speed[n] = chunk.speed[i];
      const p = chunk.plmStatus[i];
      plm[n] = Number.isNaN(p) ? 0 : p;
      tonnage[n] = chunk.actTonnage ? chunk.actTonnage[i] : NaN;
      fuel[n] = chunk.fuelLevel ? chunk.fuelLevel[i] : NaN;
      hm[n] = chunk.hm ? chunk.hm[i] : NaN;
      n += 1;
    }
  });

  return { n, t, lat, lon, speed, plm, tonnage, fuel, hm };
}

/** Port of CalculateTotalRitase: counts Loading(3) -> Dumping(6) transitions. */
function totalRitase({ n, plm }) {
  let count = 0;
  let last = null;
  for (let i = 0; i < n; i++) {
    const p = plm[i];
    if (p !== LOADING && p !== DUMPING) continue;
    if (last === LOADING && p === DUMPING) count += 1;
    else if (last === null && p === DUMPING) count += 1;   // edge case kept as-is
    if (last !== p) last = p;
  }
  return count;
}

/**
 * Port of CalculateAverageCycleTime: minutes between successive Loading(3)
 * starts, requiring a Dumping(6) in between. Also returns the individual cycles,
 * which the backend discards but the UI needs to show cycle-by-cycle detail.
 */
function cycles({ n, t, plm }) {
  const out = [];
  let startMs = null;
  let foundDisposal = false;

  for (let i = 0; i < n; i++) {
    const p = plm[i];
    if (p === LOADING && startMs === null) {
      startMs = t[i];
      foundDisposal = false;
    } else if (p === DUMPING && startMs !== null && !foundDisposal) {
      foundDisposal = true;
    } else if (p === LOADING && startMs !== null && foundDisposal) {
      out.push({ startMs, endMs: t[i], minutes: (t[i] - startMs) / 60000 });
      startMs = t[i];
      foundDisposal = false;
    }
  }
  return out;
}

/**
 * Port of CalculateFrontDisposal / CalculateDisposalFront: accumulated haversine
 * distance from a `from` state until the next `to` state, averaged over segments.
 */
function avgSegmentDistance({ n, lat, lon, plm }, from, to) {
  const distances = [];
  let tracking = false;
  let accumulated = 0;
  let prev = -1;

  for (let i = 0; i < n; i++) {
    const p = plm[i];
    if (p === from && !tracking) {
      tracking = true;
      accumulated = 0;
      prev = i;
    } else if (tracking && prev >= 0) {
      accumulated += haversine(lat[prev], lon[prev], lat[i], lon[i]);
      prev = i;
      if (p === to) {
        distances.push(accumulated);
        tracking = false;
        accumulated = 0;
        prev = -1;
      }
    }
  }

  return distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
}

/** Port of the CalculateTrailAnalytics main loop. */
function trailTotals(track) {
  const { n, t, lat, lon, speed, plm } = track;
  let loadedDistance = 0;
  let emptyDistance = 0;
  let loadedDuration = 0;
  let emptyDuration = 0;
  let speedSum = 0;
  let speedCount = 0;
  let lastLoadedMs = null;
  let lastEmptyMs = null;

  // Time spent in each plm state, for the "where does the time go" readout.
  const stateMs = new Float64Array(7);

  for (let i = 0; i < n; i++) {
    const p = plm[i];
    const s = speed[i];
    if (s > 0) { speedSum += s; speedCount += 1; }

    if (i === 0) {
      if (LOADED.has(p)) lastLoadedMs = t[i];
      else if (EMPTY.has(p)) lastEmptyMs = t[i];
      continue;
    }

    // Distance is classified by the PREVIOUS point's status — matching the
    // backend, which attributes a segment to the state it was travelled in.
    const prevPlm = plm[i - 1];
    const d = haversine(lat[i - 1], lon[i - 1], lat[i], lon[i]);
    if (LOADED.has(prevPlm)) loadedDistance += d;
    else if (EMPTY.has(prevPlm)) emptyDistance += d;

    if (LOADED.has(p)) {
      if (lastLoadedMs != null) loadedDuration += (t[i] - lastLoadedMs) / 1000;
      lastLoadedMs = t[i];
    } else if (EMPTY.has(p)) {
      if (lastEmptyMs != null) emptyDuration += (t[i] - lastEmptyMs) / 1000;
      lastEmptyMs = t[i];
    }

    // Gaps larger than 5 minutes are signal loss, not time spent in the state.
    const dt = t[i] - t[i - 1];
    if (dt > 0 && dt < 300000 && prevPlm >= 0 && prevPlm <= 6) stateMs[prevPlm] += dt;
  }

  return {
    totalLoadedDistance: loadedDistance / 1000,
    totalEmptyDistance: emptyDistance / 1000,
    totalLoadedDuration: loadedDuration / 60,
    totalEmptyDuration: emptyDuration / 60,
    averageSpeed: speedCount > 0 ? speedSum / speedCount : 0,
    stateMs: Array.from(stateMs),
  };
}

/**
 * Run-length encode plm_status into segments for the state timeline.
 * Segments shorter than `minSegmentMs` are absorbed into the previous run so a
 * single flapping sample does not produce a 1px stripe.
 */
function stateSegments({ n, t, plm }, minSegmentMs = 20000) {
  const segments = [];
  if (n === 0) return segments;

  let state = plm[0];
  let startMs = t[0];

  for (let i = 1; i <= n; i++) {
    const p = i < n ? plm[i] : -1;
    if (p === state) continue;
    const endMs = i < n ? t[i] : t[n - 1];
    const last = segments[segments.length - 1];
    if (endMs - startMs < minSegmentMs && last) last.endMs = endMs;
    else segments.push({ state, startMs, endMs });
    state = p;
    startMs = endMs;
  }
  return segments;
}

/** Payload per cycle: the maximum act_tonnage observed while loaded. */
function payloadStats({ n, plm, tonnage }) {
  let sum = 0;
  let count = 0;
  let peak = 0;
  let inLoad = false;
  let cycleMax = 0;

  for (let i = 0; i < n; i++) {
    const p = plm[i];
    const w = tonnage[i];
    if (LOADED.has(p)) {
      inLoad = true;
      if (Number.isFinite(w) && w > cycleMax) cycleMax = w;
    } else if (inLoad) {
      if (cycleMax > 0) { sum += cycleMax; count += 1; if (cycleMax > peak) peak = cycleMax; }
      inLoad = false;
      cycleMax = 0;
    }
  }
  if (inLoad && cycleMax > 0) { sum += cycleMax; count += 1; if (cycleMax > peak) peak = cycleMax; }

  return { avgPayload: count > 0 ? sum / count : 0, peakPayload: peak, loadCount: count };
}

/**
 * Time and distance spent in each speed band, same gap-skip rule as
 * trailTotals (a signal-loss gap is not time spent anywhere). A segment is
 * classified by its STARTING sample's band, matching trailTotals' convention
 * of attributing a segment to the state it was travelled in.
 */
function bySpeedBand({ n, t, lat, lon, speed }, bands) {
  const ms = new Float64Array(bands.length);
  const distanceM = new Float64Array(bands.length);
  if (bands.length === 0) return { bandMs: [], bandDistanceKm: [] };

  const bandIndexFor = (s) => {
    let idx = 0;
    for (let b = 0; b < bands.length; b++) { if (s >= bands[b].min) idx = b; else break; }
    return idx;
  };

  for (let i = 1; i < n; i++) {
    const dt = t[i] - t[i - 1];
    if (!(dt > 0 && dt < 300000)) continue;
    const idx = bandIndexFor(speed[i - 1]);
    ms[idx] += dt;
    distanceM[idx] += haversine(lat[i - 1], lon[i - 1], lat[i], lon[i]);
  }
  return { bandMs: Array.from(ms), bandDistanceKm: Array.from(distanceM, (m) => m / 1000) };
}

self.onmessage = (event) => {
  const { requestId, devices, startMs, endMs, bands = [] } = event.data;

  try {
    const perUnit = [];
    const fleetState = new Float64Array(7);
    const fleetBandMs = new Float64Array(bands.length);
    const fleetBandDistanceKm = new Float64Array(bands.length);

    devices.forEach((device) => {
      const track = flatten(device, startMs, endMs);
      if (track.n === 0) return;

      const totals = trailTotals(track);
      const cycleList = cycles(track);
      const payload = payloadStats(track);
      const avgCycleTime = cycleList.length > 0
        ? cycleList.reduce((sum, c) => sum + c.minutes, 0) / cycleList.length
        : 0;
      const bandStats = bySpeedBand(track, bands);

      totals.stateMs.forEach((ms, i) => { fleetState[i] += ms; });
      bandStats.bandMs.forEach((ms, i) => { fleetBandMs[i] += ms; });
      bandStats.bandDistanceKm.forEach((km, i) => { fleetBandDistanceKm[i] += km; });

      perUnit.push({
        deviceId: device.deviceId,
        unitNo: device.unitNo,
        colorIndex: device.colorIndex,
        pointCount: track.n,
        firstMs: track.t[0],
        lastMs: track.t[track.n - 1],
        totalRitase: totalRitase(track),
        avgCycleTime,
        cycles: cycleList,
        avgJarakFrontDisposal: avgSegmentDistance(track, LOADING, DUMPING) / 1000,
        avgJarakDisposalFront: avgSegmentDistance(track, DUMPING, LOADING) / 1000,
        segments: stateSegments(track),
        lastHm: Number.isFinite(track.hm[track.n - 1]) ? track.hm[track.n - 1] : null,
        lastFuel: Number.isFinite(track.fuel[track.n - 1]) ? track.fuel[track.n - 1] : null,
        ...totals,
        ...payload,
        ...bandStats,
      });
    });

    // Fleet totals: sums for additive metrics, point-weighted means for averages
    // (a unit with 20 samples must not pull the fleet average as hard as one
    // with 40,000).
    const totalPoints = perUnit.reduce((s, u) => s + u.pointCount, 0) || 1;
    const weighted = (key) => perUnit.reduce((s, u) => s + u[key] * u.pointCount, 0) / totalPoints;
    const ritaseUnits = perUnit.filter((u) => u.totalRitase > 0);

    const fleet = {
      unitCount: perUnit.length,
      pointCount: totalPoints,
      totalRitase: perUnit.reduce((s, u) => s + u.totalRitase, 0),
      totalLoadedDistance: perUnit.reduce((s, u) => s + u.totalLoadedDistance, 0),
      totalEmptyDistance: perUnit.reduce((s, u) => s + u.totalEmptyDistance, 0),
      totalLoadedDuration: perUnit.reduce((s, u) => s + u.totalLoadedDuration, 0),
      totalEmptyDuration: perUnit.reduce((s, u) => s + u.totalEmptyDuration, 0),
      averageSpeed: weighted('averageSpeed'),
      // Cycle-time and haul-distance averages count only units that actually
      // completed a cycle; including idle units would drag them toward zero.
      avgCycleTime: ritaseUnits.length
        ? ritaseUnits.reduce((s, u) => s + u.avgCycleTime, 0) / ritaseUnits.length : 0,
      avgJarakFrontDisposal: ritaseUnits.length
        ? ritaseUnits.reduce((s, u) => s + u.avgJarakFrontDisposal, 0) / ritaseUnits.length : 0,
      avgJarakDisposalFront: ritaseUnits.length
        ? ritaseUnits.reduce((s, u) => s + u.avgJarakDisposalFront, 0) / ritaseUnits.length : 0,
      avgPayload: perUnit.length
        ? perUnit.reduce((s, u) => s + u.avgPayload, 0) / perUnit.length : 0,
      stateMs: Array.from(fleetState),
      bandMs: Array.from(fleetBandMs),
      bandDistanceKm: Array.from(fleetBandDistanceKm),
    };

    perUnit.sort((a, b) => b.totalRitase - a.totalRitase || String(a.unitNo).localeCompare(String(b.unitNo)));
    self.postMessage({ requestId, ok: true, fleet, units: perUnit });
  } catch (err) {
    self.postMessage({ requestId, ok: false, error: String(err?.message || err) });
  }
};
