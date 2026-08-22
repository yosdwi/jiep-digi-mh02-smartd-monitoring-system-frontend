// Dwell detection (Durasi In Pit), moved off the main thread.
//
// The state machine is lifted verbatim from pages/DurasiPitStopPeta.jsx:108-185.
// Its four business rules are the operational definition of "durasi in pit" and
// are preserved exactly:
//
//   1. MIN_DURATION_SECONDS = 30 — shorter events are GPS noise, discarded.
//   2. MERGE_GAP_SECONDS = 60    — exit and re-entry into the SAME polygon
//                                  within 60 s is one event, not two.
//   3. Moving directly from polygon A into polygon B closes the A event at the
//      first B sample.
//   4. An event still open at the last sample is closed at that sample's time.
//
// Two things change, neither of which alters a result:
//   - It runs here instead of in a useEffect on the main thread.
//   - A bounding-box prefilter skips the point-in-polygon test when a sample
//     cannot possibly be inside. The bbox test is a conservative superset, so
//     every point that would have passed still passes.
//
// Input is the typed arrays already in traceRegistry — no GeoJSON feature is
// allocated per sample.

const MIN_DURATION_MS = 30 * 1000;
const MERGE_GAP_MS = 60 * 1000;

// Ray casting over a flat [lon, lat, lon, lat, ...] ring.
function inRing(x, y, ring) {
  let inside = false;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function findPolygon(lon, lat, polygons) {
  for (let p = 0; p < polygons.length; p++) {
    const poly = polygons[p];
    const b = poly.bbox;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    if (inRing(lon, lat, poly.ring)) return poly;
  }
  return null;
}

self.onmessage = (event) => {
  const { requestId, devices, polygons, startMs, endMs } = event.data;

  try {
    const events = [];

    devices.forEach((device) => {
      // Chunks arrive keyed by WITA hour; lexical order is chronological order.
      const ordered = device.chunks.slice().sort((a, b) => (a.key < b.key ? -1 : 1));

      let current = null;      // polygon name currently occupied
      let entryMs = null;
      let entryLon = 0;
      let entryLat = 0;
      let lastMs = null;
      const raw = [];

      const close = (exitMs) => {
        raw.push({ polygon: current, startMs: entryMs, endMs: exitMs, lon: entryLon, lat: entryLat });
        current = null;
        entryMs = null;
      };

      ordered.forEach(({ position, epochMs, n }) => {
        for (let i = 0; i < n; i++) {
          const t = epochMs[i];
          if (t < startMs || t > endMs) continue;

          const lon = position[i * 2];
          const lat = position[i * 2 + 1];
          const hit = findPolygon(lon, lat, polygons);
          lastMs = t;

          if (hit && !current) {
            current = hit.name;
            entryMs = t;
            entryLon = lon;
            entryLat = lat;
          } else if (hit && current && hit.name !== current) {
            // Rule 3: A -> B closes A at the first B sample.
            close(t);
            current = hit.name;
            entryMs = t;
            entryLon = lon;
            entryLat = lat;
          } else if (!hit && current) {
            close(t);
          }
        }
      });

      // Rule 4: still inside at the end of the track.
      if (current && entryMs != null && lastMs != null) close(lastMs);

      // Rule 2: merge same-polygon re-entries within the gap.
      const merged = [];
      raw.forEach((e) => {
        const last = merged[merged.length - 1];
        if (last && last.polygon === e.polygon && e.startMs - last.endMs <= MERGE_GAP_MS) {
          last.endMs = e.endMs;
          return;
        }
        merged.push({ ...e });
      });

      // Rule 1: drop noise-length events.
      merged.forEach((e) => {
        const duration = e.endMs - e.startMs;
        if (duration < MIN_DURATION_MS) return;
        events.push({
          deviceId: device.deviceId,
          unitNo: device.unitNo,
          colorIndex: device.colorIndex,
          polygon: e.polygon,
          startMs: e.startMs,
          endMs: e.endMs,
          durationMs: duration,
          lon: e.lon,
          lat: e.lat,
        });
      });
    });

    events.sort((a, b) => a.startMs - b.startMs);
    self.postMessage({ requestId, ok: true, events });
  } catch (err) {
    self.postMessage({ requestId, ok: false, error: String(err?.message || err) });
  }
};
