import { create } from 'zustand';
import * as geofence from '../services/geofenceApi';

// Operational areas: geometry plus the rules that apply inside them.
//
// PERSISTENCE: areas are geofence features in the DB-backed "Layer wilayah"
// registry (GeofenceV3Service / geofenceApi.js) — the operator picks which
// layer new areas belong to before drawing (see `layerId`/`selectLayer`).
// Drawing, undo/redo and attribute edits still happen entirely in the local
// `collection` buffer, exactly as before; only `save()` and `selectLayer()`
// touch the network, so the editing feel doesn't change, only where a "Simpan"
// actually lands. `savedFeatureIds` tracks which features already exist
// server-side, so `save()` can tell a new area (create) from an edited one
// (update) and notice one that was deleted locally (delete).
//
// Only polygons are supported here — every draw tool in Area Operasi produces
// a closed shape. A layer's 'line' features (haul-road segments imported
// elsewhere) are filtered out on load rather than risking them in editing
// modes that assume a ring.

export const AREA_TYPES = [
  { key: 'pit', label: 'Pit / Front', color: '#e08a3c' },
  { key: 'disposal', label: 'Disposal', color: '#7570b3' },
  { key: 'haul_road', label: 'Jalan hauling', color: '#1f7a96' },
  { key: 'workshop', label: 'Workshop', color: '#2e9e5b' },
  { key: 'restricted', label: 'Area terbatas', color: '#d9483f' },
  { key: 'other', label: 'Lainnya', color: '#76828f' },
];

export const areaTypeMeta = (key) => AREA_TYPES.find((t) => t.key === key) || AREA_TYPES[AREA_TYPES.length - 1];

const emptyCollection = () => ({ type: 'FeatureCollection', features: [] });

/** Default attributes for a newly drawn area. `id` is a client-only key until the first save assigns a real featureId. */
export function newAreaProperties(index) {
  return {
    id: `area-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `Area ${index + 1}`,
    type: 'pit',
    speedPlan: null,        // km/h — the rule Underspeed reads
    maxSpeed: null,         // km/h — hard limit
    note: '',
    updatedAt: new Date().toISOString(),
  };
}

function featureFromDb(f) {
  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      id: f.featureId,
      name: f.name,
      type: f.category,
      speedPlan: f.speedPlan ?? null,
      maxSpeed: f.maxSpeedLoaded ?? f.maxSpeedEmpty ?? null,
      note: f.notes || '',
      derivedFrom: f.source === 'suggested' ? 'jejak historis' : undefined,
      updatedAt: f.modifiedAt || f.createdAt,
    },
  };
}

function featureToInput(feature, layerId) {
  const p = feature.properties || {};
  return {
    layerId,
    name: p.name || 'Tanpa nama',
    category: p.type || 'other',
    geometryType: 'polygon',
    geometry: feature.geometry,
    maxSpeedEmpty: p.maxSpeed ?? null,
    maxSpeedLoaded: p.maxSpeed ?? null,
    speedPlan: p.speedPlan ?? null,
    notes: p.note || null,
    source: p.derivedFrom ? 'suggested' : 'drawn',
  };
}

const useAreaStore = create((set, get) => ({
  layers: [],
  layersLoading: false,
  layerId: null,
  featuresLoading: false,
  saving: false,
  saveError: null,
  savedFeatureIds: new Set(),

  collection: emptyCollection(),
  selectedIndexes: [],
  mode: 'view',            // view | draw-polygon | draw-rectangle | draw-circle |
                           // draw-freehand | modify | translate | rotate | scale |
                           // duplicate | split | delete | measure-distance | measure-area
  snapping: true,
  dirty: false,
  // Bounded undo: 40 steps is well past what an operator retraces, and keeping
  // whole FeatureCollections means each step is a real snapshot.
  history: [],
  future: [],
  suggestion: null,        // { polygon, cellCount, vertexCount, params }

  setMode: (mode) => set({ mode }),
  setSnapping: (snapping) => set({ snapping }),
  setSelected: (selectedIndexes) => set({ selectedIndexes }),
  markClean: () => set({ dirty: false }),

  // ---------------------------------------------------------------- layers

  loadLayers: async () => {
    set({ layersLoading: true });
    try {
      const { layers } = await geofence.listLayers();
      set({ layers, layersLoading: false });
    } catch {
      set({ layers: [], layersLoading: false });
    }
  },

  /** Switches the working buffer to a different layer's features. Discards any unsaved edits in the current one — callers must confirm with the operator first. */
  selectLayer: async (layerId) => {
    set({
      layerId,
      collection: emptyCollection(),
      selectedIndexes: [],
      history: [],
      future: [],
      dirty: false,
      suggestion: null,
      featuresLoading: true,
      saveError: null,
    });
    if (!layerId) { set({ featuresLoading: false }); return; }
    try {
      const { features } = await geofence.listFeatures(layerId);
      const polygons = features.filter((f) => f.geometryType === 'polygon' && f.geometry);
      set({
        collection: { type: 'FeatureCollection', features: polygons.map(featureFromDb) },
        savedFeatureIds: new Set(polygons.map((f) => f.featureId)),
        featuresLoading: false,
      });
    } catch (err) {
      set({ featuresLoading: false, saveError: err.message });
    }
  },

  createLayerAndSelect: async (name, description) => {
    const { layer } = await geofence.createLayer({ name, description: description || null });
    await get().loadLayers();
    await get().selectLayer(layer.layerId);
    return layer;
  },

  // ---------------------------------------------------------------- history

  pushHistory: () => set((s) => ({
    history: [...s.history.slice(-39), s.collection],
    future: [],
  })),

  setCollection: (collection, { record = true } = {}) => set((s) => ({
    collection,
    dirty: true,
    history: record ? [...s.history.slice(-39), s.collection] : s.history,
    future: record ? [] : s.future,
  })),

  undo: () => set((s) => {
    if (s.history.length === 0) return s;
    const previous = s.history[s.history.length - 1];
    return {
      collection: previous,
      history: s.history.slice(0, -1),
      future: [s.collection, ...s.future].slice(0, 40),
      dirty: true,
    };
  }),

  redo: () => set((s) => {
    if (s.future.length === 0) return s;
    return {
      collection: s.future[0],
      future: s.future.slice(1),
      history: [...s.history.slice(-39), s.collection],
      dirty: true,
    };
  }),

  updateProperties: (index, patch) => set((s) => {
    const features = s.collection.features.map((f, i) => (
      i === index
        ? { ...f, properties: { ...f.properties, ...patch, updatedAt: new Date().toISOString() } }
        : f
    ));
    return {
      collection: { ...s.collection, features },
      history: [...s.history.slice(-39), s.collection],
      future: [],
      dirty: true,
    };
  }),

  removeSelected: () => set((s) => {
    if (s.selectedIndexes.length === 0) return s;
    const drop = new Set(s.selectedIndexes);
    return {
      collection: {
        ...s.collection,
        features: s.collection.features.filter((_, i) => !drop.has(i)),
      },
      selectedIndexes: [],
      history: [...s.history.slice(-39), s.collection],
      future: [],
      dirty: true,
    };
  }),

  setSuggestion: (suggestion) => set({ suggestion }),

  /** Turn the current suggestion into a real, editable, UNSAVED feature. */
  acceptSuggestion: () => {
    const { suggestion, collection } = get();
    if (!suggestion?.polygon) return;
    const geometries = suggestion.polygon.geometry.type === 'MultiPolygon'
      ? suggestion.polygon.geometry.coordinates.map((coords) => ({ type: 'Polygon', coordinates: coords }))
      : [suggestion.polygon.geometry];

    const features = [...collection.features];
    geometries.forEach((geometry, i) => {
      features.push({
        type: 'Feature',
        geometry,
        properties: {
          ...newAreaProperties(features.length),
          name: `Usulan ${i + 1}`,
          derivedFrom: 'jejak historis',
          derivedParams: suggestion.params,
        },
      });
    });

    set((s) => ({
      collection: { ...s.collection, features },
      selectedIndexes: [features.length - 1],
      suggestion: null,
      mode: 'modify',
      history: [...s.history.slice(-39), s.collection],
      future: [],
      dirty: true,
    }));
  },

  // ----------------------------------------------------------------- save

  /** Diffs the working buffer against `savedFeatureIds`: create what's new, update what has a server id, delete what's gone. */
  save: async () => {
    const { collection, layerId, savedFeatureIds } = get();
    if (!layerId) { set({ saveError: 'Pilih layer tujuan dulu sebelum menyimpan.' }); return; }

    set({ saving: true, saveError: null });
    try {
      const currentIds = new Set();
      const nextFeatures = [...collection.features];

      for (let i = 0; i < nextFeatures.length; i++) {
        const feature = nextFeatures[i];
        const input = featureToInput(feature, layerId);
        if (savedFeatureIds.has(feature.properties.id)) {
          await geofence.updateFeature(feature.properties.id, input);
          currentIds.add(feature.properties.id);
        } else {
          const { feature: created } = await geofence.createFeature(input);
          nextFeatures[i] = { ...feature, properties: { ...feature.properties, id: created.featureId } };
          currentIds.add(created.featureId);
        }
      }

      const removedIds = [...savedFeatureIds].filter((id) => !currentIds.has(id));
      await Promise.all(removedIds.map((id) => geofence.deleteFeature(id)));

      set((s) => ({
        collection: { ...s.collection, features: nextFeatures },
        savedFeatureIds: currentIds,
        saving: false,
        dirty: false,
      }));
    } catch (err) {
      set({ saving: false, saveError: err.message });
    }
  },

  importCollection: (collection) => set((s) => ({
    collection,
    selectedIndexes: [],
    dirty: true,
    history: [...s.history.slice(-39), s.collection],
    future: [],
  })),
}));

export default useAreaStore;
