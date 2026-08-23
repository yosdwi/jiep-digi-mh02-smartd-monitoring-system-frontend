import { create } from 'zustand';

const clone = (value) => JSON.parse(JSON.stringify(value));

function centerline(ring) {
  const points = (ring || []).slice(0, -1);
  if (points.length < 4) return points.slice(0, 2);
  const half = Math.floor(points.length / 2);
  return [points[0], points[Math.max(1, half)]];
}

const useSpeedAnalysisStore = create((set, get) => ({
  draft: null,
  active: null,
  history: [],
  selectedIds: [],
  expandedIds: [],
  busy: false,
  error: null,
  handoff: null,

  setBusy: (busy) => set({ busy, error: busy ? null : get().error }),
  setError: (error) => set({ error, busy: false }),
  setDraftFromSuggestion: ({ segments, routes, evidenceKey }) => set((state) => ({
    busy: false,
    error: null,
    draft: {
      version: (state.active?.version || 0) + 1,
      createdAt: new Date().toISOString(),
      routes,
      evidenceKey,
      segments,
    },
    selectedIds: segments.map((segment) => segment.id),
    expandedIds: [],
    handoff: null,
  })),
  toggleSelected: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter((value) => value !== id)
      : [...state.selectedIds, id],
  })),
  selectAll: () => set((state) => ({ selectedIds: (state.draft?.segments || state.active?.segments || []).map((s) => s.id) })),
  clearSelection: () => set({ selectedIds: [] }),
  toggleExpanded: (id) => set((state) => ({
    expandedIds: state.expandedIds.includes(id)
      ? state.expandedIds.filter((value) => value !== id)
      : [...state.expandedIds, id],
  })),
  updateSegment: (id, patch) => set((state) => {
    if (!state.draft) return state;
    return {
      draft: {
        ...state.draft,
        segments: state.draft.segments.map((segment) => (
          segment.id === id ? { ...segment, ...patch, reviewed: true } : segment
        )),
      },
    };
  }),
  applyDraft: () => set((state) => {
    if (!state.draft) return state;
    const approved = clone({
      ...state.draft,
      appliedAt: new Date().toISOString(),
      segments: state.draft.segments.map((segment) => ({
        ...segment,
        approvedPlan: segment.proposedPlan,
        currentPlan: segment.proposedPlan,
        change: 'Active',
      })),
    });
    return {
      active: approved,
      draft: null,
      history: state.active ? [...state.history, clone(state.active)] : state.history,
      selectedIds: approved.segments.map((segment) => segment.id),
      expandedIds: [],
      handoff: null,
    };
  }),
  beginHandoff: () => {
    const state = get();
    const source = state.draft || state.active;
    if (!source) return null;
    const wanted = state.selectedIds.length ? new Set(state.selectedIds) : null;
    const segments = source.segments.filter((segment) => !wanted || wanted.has(segment.id));
    const handoff = {
      id: `speed-${source.version}-${Date.now()}`,
      source: state.draft ? 'draft' : 'active',
      version: source.version,
      collection: {
        type: 'FeatureCollection',
        features: segments.map((segment) => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [segment.polygon] },
          properties: {
            id: segment.id,
            speedSegmentId: segment.id,
            name: segment.roadName || segment.id,
            type: 'haul_road',
            speedPlan: segment.proposedPlan ?? segment.approvedPlan ?? null,
            note: `Review Draft v${source.version}`,
          },
        })),
      },
    };
    set({ handoff });
    return handoff;
  },
  applyHandoff: (collection) => set((state) => {
    if (!state.draft || !state.handoff) return { handoff: null };
    const geometry = new Map(collection.features.map((feature) => [feature.properties?.speedSegmentId, feature.geometry]));
    return {
      draft: {
        ...state.draft,
        segments: state.draft.segments.map((segment) => {
          const next = geometry.get(segment.id);
          if (!next?.coordinates?.[0]) return segment;
          return {
            ...segment,
            polygon: next.coordinates[0],
            path: centerline(next.coordinates[0]),
            change: 'Boundary Change',
            reviewed: true,
          };
        }),
      },
      handoff: null,
    };
  }),
  clearHandoff: () => set({ handoff: null }),
}));

export default useSpeedAnalysisStore;
