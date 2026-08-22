import axios from 'axios';

// V3 layer / feature management.
//
// District is never sent. The server takes it from the authenticated user, so
// there is no parameter here that could scope a request to someone else's site.

const BASE = '/Monitoring/api/GeofenceV3';

const unwrap = (response) => {
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Permintaan layer gagal.');
  }
  return response.data;
};

const fail = (error) => {
  throw new Error(error.response?.data?.message || error.message || 'Permintaan layer gagal.');
};

const call = (promise) => promise.then(unwrap).catch(fail);

export const listLayers = (signal) => call(axios.get(`${BASE}/layers`, { signal }));

export const createLayer = (input, signal) => call(axios.post(`${BASE}/layers`, input, { signal }));

export const updateLayer = (id, input, signal) => call(axios.put(`${BASE}/layers/${id}`, input, { signal }));

export const deleteLayer = (id, signal) => call(axios.delete(`${BASE}/layers/${id}`, { signal }));

export const listFeatures = (layerId, signal) =>
  call(axios.get(`${BASE}/features`, { params: layerId ? { layerId } : undefined, signal }));

export const createFeature = (input, signal) => call(axios.post(`${BASE}/features`, input, { signal }));

/** One transaction server-side — a KML import either lands whole or not at all. */
export const createFeatures = (inputs, signal) =>
  call(axios.post(`${BASE}/features/bulk`, inputs, { signal }));

export const updateFeature = (id, input, signal) => call(axios.put(`${BASE}/features/${id}`, input, { signal }));

export const deleteFeature = (id, signal) => call(axios.delete(`${BASE}/features/${id}`, { signal }));

export const CATEGORY_LABELS = {
  boundary: 'Batas wilayah',
  pit: 'Pit',
  disposal: 'Disposal',
  haul_road: 'Jalan hauling',
  workshop: 'Workshop',
  restricted: 'Area terbatas',
  other: 'Lainnya',
};

/**
 * Active features for the caller's district, grouped by category — what the
 * map layers (boundary/road/pit) read instead of the legacy static KML. One
 * request covers every category so basemap and dwell detection don't each
 * fetch the same list.
 */
export async function fetchFeaturesByCategory(signal) {
  const { features } = await listFeatures(undefined, signal);
  const byCategory = new Map();
  features.forEach((f) => {
    if (!f.geometry) return;
    const list = byCategory.get(f.category) || [];
    list.push(f);
    byCategory.set(f.category, list);
  });
  return byCategory;
}

/** A category's features as a GeoJSON FeatureCollection, ready for GeoJsonLayer. */
export function featuresToGeoJson(list) {
  return {
    type: 'FeatureCollection',
    features: (list || []).map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: { name: f.name, featureId: f.featureId },
    })),
  };
}
