// Suggest an operational polygon from historical traces.
//
// METHOD: buffered trajectory union, not alpha shape.
//
// Both are available (turf ships `concave`), and the deciding factor is
// explainability. This pipeline's parameters are "R metres around where trucks
// actually were" and "at least N samples per cell" — an operator can reason
// about both, and about why any piece of the polygon appeared. Alpha shape's α
// has no operational meaning, and small changes in α produce large topology
// changes including holes and disconnected pieces that nobody can predict or
// justify to a supervisor.
//
//   1. keep samples inside the time window
//   2. keep samples below a speed threshold   <- "where trucks WORKED",
//                                                not "where they drove past"
//   3. snap to a grid, keep cells with >= minSamples   <- density threshold
//   4. buffer each surviving cell by R metres
//   5. union the buffers
//   6. simplify
//
// No machine learning. This is deterministic geometry over data already held as
// typed arrays, using functions already in the dependency tree. A model here
// would be less explainable and no more correct.

import { buffer, union, simplify, point, featureCollection } from '@turf/turf';

const METRES_PER_DEG_LAT = 111320;

self.onmessage = (event) => {
  const {
    requestId,
    devices,
    startMs,
    endMs,
    maxSpeed = 5,        // km/h — at or below this a unit is working, not transiting
    cellMetres = 10,
    minSamples = 3,
    bufferMetres = 18,
    simplifyMetres = 3,
  } = event.data;

  try {
    // ---- 1-3: grid density -------------------------------------------------
    const cells = new Map();
    let latRef = null;

    devices.forEach((device) => {
      device.chunks.forEach((chunk) => {
        for (let i = 0; i < chunk.n; i++) {
          const t = chunk.epochMs[i];
          if (t < startMs || t > endMs) continue;
          const speed = chunk.speed[i];
          if (!(speed <= maxSpeed)) continue;

          const lon = chunk.position[i * 2];
          const lat = chunk.position[i * 2 + 1];
          if (latRef === null) latRef = lat;

          // Degrees per cell, corrected for longitude convergence at this
          // latitude so cells stay roughly square on the ground.
          const dLat = cellMetres / METRES_PER_DEG_LAT;
          const dLon = cellMetres / (METRES_PER_DEG_LAT * Math.cos(lat * Math.PI / 180));

          const gx = Math.round(lon / dLon);
          const gy = Math.round(lat / dLat);
          const key = `${gx}:${gy}`;
          const existing = cells.get(key);
          if (existing) existing.count += 1;
          else cells.set(key, { count: 1, lon: gx * dLon, lat: gy * dLat });
        }
      });
    });

    const dense = [...cells.values()].filter((c) => c.count >= minSamples);

    if (dense.length === 0) {
      self.postMessage({
        requestId, ok: true, polygon: null, cellCount: 0,
        message: 'Tidak ada area dengan kepadatan cukup. Turunkan ambang sampel atau naikkan batas kecepatan.',
      });
      return;
    }

    // ---- 4-5: buffer and union --------------------------------------------
    // Unioned incrementally rather than all at once: turf.union on a large
    // FeatureCollection allocates every intermediate, and this way a single
    // pathological geometry cannot take the whole result down.
    const radiusKm = bufferMetres / 1000;
    let merged = null;

    dense.forEach((cell) => {
      const disc = buffer(point([cell.lon, cell.lat]), radiusKm, { units: 'kilometers', steps: 8 });
      if (!disc) return;
      if (!merged) { merged = disc; return; }
      try {
        const next = union(featureCollection([merged, disc]));
        if (next) merged = next;
      } catch {
        // Skip a cell whose union fails rather than losing the whole polygon.
      }
    });

    if (!merged) {
      self.postMessage({ requestId, ok: true, polygon: null, cellCount: dense.length, message: 'Gagal menggabungkan area.' });
      return;
    }

    // ---- 6: simplify -------------------------------------------------------
    let result = merged;
    try {
      result = simplify(merged, {
        tolerance: simplifyMetres / METRES_PER_DEG_LAT,
        highQuality: true,
        mutate: false,
      });
    } catch {
      result = merged;
    }

    let vertexCount = 0;
    const geom = result.geometry;
    if (geom.type === 'Polygon') vertexCount = geom.coordinates[0].length;
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((p) => { vertexCount += p[0].length; });

    self.postMessage({
      requestId,
      ok: true,
      polygon: result,
      cellCount: dense.length,
      vertexCount,
      params: { maxSpeed, cellMetres, minSamples, bufferMetres, simplifyMetres },
    });
  } catch (err) {
    self.postMessage({ requestId, ok: false, error: String(err?.message || err) });
  }
};
