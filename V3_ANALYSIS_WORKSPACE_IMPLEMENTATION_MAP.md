# V3 Analysis Workspace — implementation map

This is the thin migration contract for the locked V23.3 prototype. The HTML remains a behaviour reference; production code is implemented as React components inside the existing V3 application.

## Reuse without rewriting

| Concern | Existing V3 implementation | Decision |
| --- | --- | --- |
| Authentication and API transport | Existing app stores and API clients | Reuse |
| Applied historical filter | `ContextBar`, `historyStore`, `traceLoader` | Reuse behaviour; restyle incrementally |
| Trace loading and decoding | Hour-chunk loader, Arrow decoder worker, typed-array registry | Reuse |
| Shared map | `MapWorkspace`, MapLibre, deck.gl layer hooks | Reuse as the only map surface |
| Selection and playback | `historyStore`, playback layers and temporal components | Reuse |
| Cycle Time analytics | analytics worker and Cycle Time panels | Reuse as the regression baseline |
| Analysis modes and review workflows | Locked V23.3 behaviour | New React feature components |
| Backend payload differences | Feature adapters at the service boundary | Map; do not leak API shapes into UI |

## Delivery order

1. Mount an experimental Analysis Workspace route with Cycle Time as the locked baseline.
2. Move the V23.3 layout into React while retaining the shared store, map, loader and workers.
3. Add Speed Analysis domain state: `no-layer -> draft -> review -> active`.
4. Add Duration In Pit and Data Log Record on the same applied filter and map context.
5. Add GIS Workspace with persistent typed geometry layers and version history.
6. Replace the current V3 entry route only after Cycle Time parity and regression checks pass.

## Domain boundary

The UI consumes normalized frontend models, not raw backend responses:

- `AnalysisContext`: district, applied time range, loaders and units.
- `TraceDataset`: devices, typed sample chunks, bounds and query metadata.
- `GeometryLayer`: layer id, type, feature collection, version and lifecycle state.
- `SpeedPlan`: version, routes, corridor segments, evidence and review state.
- `PitStopArea`: persistent polygon geometry plus dwell classification metadata.

The first checkpoint deliberately changes no backend contract and leaves all current V3 routes available for comparison.
