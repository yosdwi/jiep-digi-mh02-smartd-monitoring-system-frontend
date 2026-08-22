// Validasi koordinat geografis. Sumber rover (mir-correction) memakai sentinel
// -8888 (disconnect) / -8887 (no-signal); backend kadang menukar lat/lon (lat
// terisi nilai longitude ~117 di distrik Kalimantan). Keduanya harus ditolak
// sebelum masuk ke viewState maplibre — kalau tidak: "Invalid LngLat latitude
// value: must be between -90 and 90" (maplibre melempar, peta crash).

export function isValidLat(lat) {
  const n = Number(lat);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isValidLon(lon) {
  const n = Number(lon);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

// isValidLonLat menerima (lon, lat) — urutan deck.gl/GeoJSON.
export function isValidLonLat(lon, lat) {
  return isValidLon(lon) && isValidLat(lat);
}

// coordSentinelLabel memetakan sentinel posisi dari rover/cabin (mir-correction
// createPayload) ke status human-readable. -8888 = device terputus (>5s tanpa
// data), -8887 = tanpa sinyal GPS (fix 0). null = bukan sentinel yang dikenal.
export function coordSentinelLabel(v) {
  const n = Number(v);
  if (n === -8888) return 'Terputus';
  if (n === -8887) return 'Tanpa sinyal';
  return null;
}

// sanitizeViewState mengembalikan viewState dengan lon/lat valid; bila tidak
// valid, jatuh ke fallback (pakai field per-koordinat supaya zoom/pitch tetap).
export function sanitizeViewState(vs, fallback) {
  if (!vs) return fallback;
  const lonOK = isValidLon(vs.longitude);
  const latOK = isValidLat(vs.latitude);
  if (lonOK && latOK) return vs;
  return {
    ...vs,
    longitude: lonOK ? vs.longitude : fallback.longitude,
    latitude: latOK ? vs.latitude : fallback.latitude,
  };
}
