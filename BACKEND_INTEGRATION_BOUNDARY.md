# Backend Integration Boundary (next phase)

This React/Vite port intentionally keeps the V23.3 prototype behavior and fixture semantics unchanged.

For the next phase, replace data access without changing the visual component tree:

1. `VITE_AW_RAW_BASE_URL` — current static fixture/KML/icon source.
2. `VITE_AW_API_BASE_URL` — current HistoryContextV3 API base.
3. Extract `loadAssignment()` and core fixture boot into a React data service/hook.
4. Normalize backend DTOs into the existing workspace domain shape before changing UI components.
5. Keep MapLibre/deck.gl and AG Grid behind imperative adapters; do not rewrite them merely to make them declarative.
6. Migrate filter pending/applied state first so backend fetches only run from the applied context.
7. Then migrate Cycle Time, Speed Analysis, Duration In Pit, Data Log, and GIS persistence one vertical slice at a time.

The visual source of truth remains `reference/analysis-workspace-v23.3-applied-filter-state-fix.html` until a later design decision supersedes it.
