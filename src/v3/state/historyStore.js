import { create } from 'zustand';

// Shared state for every historical page (Cycle Time, Underspeed, Durasi In Pit).
//
// Hard rule, from what went wrong in V2: nothing that changes faster than ~1 Hz
// and nothing larger than a few kilobytes lives here. Sample data lives in
// traceRegistry (plain module, typed arrays); the playhead lives in
// playbackAnimationRuntime (plain module, ref + pub/sub). This store holds ids,
// ranges and flags only.

const pad = (n) => String(n).padStart(2, '0');

const toLocalInput = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

function defaultRange() {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  const start = new Date(end.getTime() - 6 * 3600 * 1000);
  return { start: toLocalInput(start), end: toLocalInput(end) };
}

// Seeded from the values hardcoded in pages/UnderspeedPeta.jsx:12-18 so existing
// operational meaning carries over. `min` is the inclusive lower bound; bands are
// contiguous by construction, so the operator edits boundaries and gaps are
// structurally impossible.
export const DEFAULT_SPEED_BANDS = [
  { id: 'stop', min: 0, label: 'Berhenti', color: '#dc2626' },
  { id: 'vslow', min: 1, label: 'Sangat lambat', color: '#f97316' },
  { id: 'slow', min: 20, label: 'Lambat', color: '#eab308' },
  { id: 'normal', min: 30, label: 'Normal', color: '#22c55e' },
  { id: 'fast', min: 36, label: 'Cepat', color: '#3b82f6' },
];

export const BIN_COUNT = 60;

const initialRange = defaultRange();

const useHistoryStore = create((set, get) => ({
  // ---- query context (what the user asked for) -----------------------------
  context: {
    district: null,
    startDateTime: initialRange.start,
    endDateTime: initialRange.end,
    unitNos: [],
    // Loaders the operator has narrowed to. Empty means the whole fleet, which
    // is not the same as "none selected" — a loader filter that defaults to
    // excluding everything would hide the fleet on first load.
    //
    // This narrows which DTs are offered; it never selects them. A loader with
    // twelve DTs assigned is a question ("which of these?"), not an answer, and
    // the operator still says which ones the query runs on.
    loaders: [],
    // Which system said which loader a DT was working to. MiForce and Timesheet
    // disagree often enough that the operator picks per query rather than the
    // product silently trusting one of them.
    source: 'miforce',
  },

  // ---- load status --------------------------------------------------------
  status: {
    state: 'idle',        // idle | resolving | queued | running | loading | ready | error
    progress: 0,
    message: null,
    error: null,
    queryId: null,
    loadedChunks: 0,
    totalChunks: 0,
    stride: 1,
    sampleCount: 0,
  },

  // Resolved from the query; drives the unit list and colour assignment.
  devices: [],            // [{ deviceId, unitNo, colorIndex }]
  availableHours: [],
  rangeStartMs: null,
  rangeEndMs: null,

  // ---- temporal brush -----------------------------------------------------
  // null means "whole range". Values are absolute epoch ms, never percentages:
  // percentage-of-row-count is what made V2's timeline uninterpretable.
  window: null,           // { startMs, endMs }
  bins: null,             // Uint32Array(BIN_COUNT)
  binsVersion: 0,

  // ---- selection ----------------------------------------------------------
  selection: {
    deviceIds: [],
    areaId: null,
    eventId: null,
  },

  // ---- presentation -------------------------------------------------------
  colorMode: 'unit',      // 'unit' | 'speed'
  traceMode: 'dots',      // 'dots' | 'density'
  // Seconds between rendered samples; 0 = off, load full resolution.
  // Same idea as ExportDialog's Resolusi picker, applied to the map trace.
  traceInterval: 0,
  speedBands: DEFAULT_SPEED_BANDS,

  layers: {
    orthophoto: true,
    boundaries: true,
    roads: false,
    areas: true,
    trace: true,
    live: false,
  },
  layerOpacity: {
    orthophoto: 1,
    boundaries: 0.6,
    roads: 0.8,
    areas: 0.8,
    trace: 1,
  },
  orthoVersionId: null,

  // ---- playback -----------------------------------------------------------
  playback: {
    active: false,
    playing: false,
    speed: 10,
    // Absolute epoch ms shown by the UI, updated ~1/s. The RAF-frequency value
    // lives in playbackAnimationRuntime, not here.
    displayMs: null,
    autoFollow: false,
  },

  // Derived cycle-time metrics (analytics.worker.js). Small: one row per unit
  // plus a fleet roll-up, so it belongs here rather than in the registry.
  analytics: { fleet: null, units: [], computing: false, error: null },

  // 'density' = GPS sample histogram (Cycle Time, Underspeed)
  // 'state'   = plm_status occupancy bands (Cycle Time detail)
  temporalMode: 'density',

  panel: 'layers',        // 'layers' | 'inspector' | null

  // ---- actions ------------------------------------------------------------
  setContext: (patch) => set((s) => ({ context: { ...s.context, ...patch } })),
  setStatus: (patch) => set((s) => ({ status: { ...s.status, ...patch } })),

  setQueryResult: ({ devices, availableHours, rangeStartMs, rangeEndMs, queryId }) =>
    set((s) => ({
      devices,
      availableHours,
      rangeStartMs,
      rangeEndMs,
      status: { ...s.status, queryId },
    })),

  setWindow: (window) => set({ window }),
  clearWindow: () => set({ window: null }),
  setBins: (bins) => set((s) => ({ bins, binsVersion: s.binsVersion + 1 })),

  setSelection: (deviceIds) =>
    set((s) => ({ selection: { ...s.selection, deviceIds } })),

  toggleSelection: (deviceId) =>
    set((s) => {
      const list = s.selection.deviceIds;
      const next = list.includes(deviceId) ? list.filter((d) => d !== deviceId) : [...list, deviceId];
      return { selection: { ...s.selection, deviceIds: next } };
    }),

  clearSelection: () => set((s) => ({ selection: { ...s.selection, deviceIds: [], eventId: null } })),

  setColorMode: (colorMode) => set({ colorMode }),
  setTraceMode: (traceMode) => set({ traceMode }),
  setTraceInterval: (traceInterval) => set({ traceInterval }),
  setSpeedBands: (speedBands) => set({ speedBands }),

  setLayer: (key, visible) => set((s) => ({ layers: { ...s.layers, [key]: visible } })),
  setLayerOpacity: (key, value) => set((s) => ({ layerOpacity: { ...s.layerOpacity, [key]: value } })),
  setOrthoVersion: (orthoVersionId) => set({ orthoVersionId }),
  setPanel: (panel) => set({ panel }),

  setPlayback: (patch) => set((s) => ({ playback: { ...s.playback, ...patch } })),
  setAnalytics: (patch) => set((s) => ({ analytics: { ...s.analytics, ...patch } })),
  setTemporalMode: (temporalMode) => set({ temporalMode }),

  /** The window actually applied to the map: the brush, or the full range. */
  effectiveWindow: () => {
    const { window, rangeStartMs, rangeEndMs } = get();
    if (window) return window;
    if (rangeStartMs == null || rangeEndMs == null) return null;
    return { startMs: rangeStartMs, endMs: rangeEndMs };
  },

  reset: () => set({
    status: {
      state: 'idle', progress: 0, message: null, error: null, queryId: null,
      loadedChunks: 0, totalChunks: 0, stride: 1, sampleCount: 0,
    },
    devices: [],
    availableHours: [],
    rangeStartMs: null,
    rangeEndMs: null,
    window: null,
    bins: null,
    selection: { deviceIds: [], areaId: null, eventId: null },
    playback: { active: false, playing: false, speed: 10, displayMs: null, autoFollow: false },
    analytics: { fleet: null, units: [], computing: false, error: null },
  }),
}));

export default useHistoryStore;
