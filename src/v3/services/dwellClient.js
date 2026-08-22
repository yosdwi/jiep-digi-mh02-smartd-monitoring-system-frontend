// Client for dwell.worker.js, plus the pit-polygon loader.
//
// Polygons come from the managed geofence layer (category 'pit'), imported
// from the legacy static KML via the "Impor KML" flow on the Layer &
// Orthophoto page — see plan §17 R6. A district that has not been backfilled
// yet falls back to the static KML (/Monitoring/kml/durasipitstop/pitstops.kml)
// so the page does not go blank in the meantime. Either source ends up as the
// same {name, ring, bbox, polygon} shape, which is all the dwell worker reads.

import { fetchFeaturesByCategory } from './geofenceApi';

let worker = null;
let nextId = 1;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/dwell.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const entry = pending.get(event.data.requestId);
    if (!entry) return;
    pending.delete(event.data.requestId);
    if (event.data.ok) entry.resolve(event.data.events);
    else entry.reject(new Error(event.data.error));
  };
  return worker;
}

/** Builds the {name, ring, bbox, polygon} shape the dwell worker reads, from any source of lon/lat pairs. */
function polygonFromPairs(name, pairs) {
  if (!name || pairs.length < 3) return null;

  const ring = new Float64Array(pairs.length * 2);
  let minLon = Infinity; let minLat = Infinity;
  let maxLon = -Infinity; let maxLat = -Infinity;
  pairs.forEach(([lon, lat], i) => {
    ring[i * 2] = lon;
    ring[i * 2 + 1] = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  return {
    name,
    ring,
    bbox: [minLon, minLat, maxLon, maxLat],
    polygon: pairs.map(([lon, lat]) => [lon, lat]),
  };
}

/** Pit polygons from the DB-managed 'pit' geofence features. Only the outer ring — same simplification the KML importer already makes for a hole. */
function pitPolygonsFromDb(features) {
  return features.map((f) => {
    const geom = f.geometry;
    const coords = geom?.type === 'Polygon' ? geom.coordinates?.[0]
      : geom?.type === 'MultiPolygon' ? geom.coordinates?.[0]?.[0]
        : null;
    if (!coords) return null;
    return polygonFromPairs(f.name, coords);
  }).filter(Boolean);
}

/** Parse pit polygons from the legacy static KML into flat rings with precomputed bounding boxes. */
async function pitPolygonsFromKml(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`KML ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/xml');

  return Array.from(doc.getElementsByTagName('Placemark')).map((placemark) => {
    const name = placemark.getElementsByTagName('name')[0]?.textContent?.trim();
    const coords = placemark.getElementsByTagName('coordinates')[0]?.textContent?.trim();
    if (!name || !coords) return null;

    const pairs = coords.split(/\s+/)
      .map((s) => s.split(',').map(Number))
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    return polygonFromPairs(name, pairs);
  }).filter(Boolean);
}

/** Pit polygons for dwell detection: DB-managed layer first, static KML if that district has not been backfilled yet. */
export async function loadPitPolygons(fallbackUrl = '/Monitoring/kml/durasipitstop/pitstops.kml') {
  try {
    const byCategory = await fetchFeaturesByCategory();
    const fromDb = pitPolygonsFromDb(byCategory.get('pit') || []);
    if (fromDb.length > 0) return fromDb;
  } catch {
    // DB unreachable — fall through to the static KML rather than leaving the page blank.
  }
  return pitPolygonsFromKml(fallbackUrl);
}

/**
 * Run dwell detection. Device columns are passed by reference into the
 * structured clone — position/epochMs are copied, not transferred, because the
 * registry still needs them for the trace.
 */
export function analyseDwell({ devices, polygons, startMs, endMs }) {
  const w = ensureWorker();
  const requestId = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    w.postMessage({
      requestId,
      startMs,
      endMs,
      polygons: polygons.map((p) => ({ name: p.name, ring: p.ring, bbox: p.bbox })),
      devices: devices.map((device) => ({
        deviceId: device.deviceId,
        unitNo: device.unitNo,
        colorIndex: device.colorIndex,
        chunks: [...device.chunks.entries()].map(([key, chunk]) => ({
          key,
          n: chunk.n,
          position: chunk.position,
          epochMs: chunk.epochMs,
        })),
      })),
    });
  });
}
