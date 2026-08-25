# Analysis Workspace V23.3 — React/Vite fidelity port

This package converts the uploaded `analysis-workspace-v23.3-applied-filter-state-fix.html` into a React 18 + Vite project while preserving the approved UI/UX and prototype behavior.

## What was converted

- Static HTML is split into React components (`FilterBar`, `AnalysisModeTabs`, `KpiRow`, `MapWorkspaceShell`, `PerformancePanel`, `TrendPanel`, `WorkspaceOverlays`).
- Every `<style>` block from the mockup is consolidated, in original order, into `src/styles/analysis-workspace.css`.
- CDN libraries are replaced by npm dependencies.
- Every executable prototype `<script>` is moved into an ES module mounted by `useAnalysisWorkspaceRuntime()`. The v20 `text/plain` extension is included in execution order instead of runtime `eval`.
- MapLibre/deck.gl and AG Grid stay imperative inside the runtime adapter because those libraries are inherently imperative in the original prototype. No iframe or `dangerouslySetInnerHTML` is used for the main page.
- The original HTML is retained under `reference/` for pixel/behavior comparison only.

## Run

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Backend integration next

The current data source remains the mockup's fixture/raw-GitHub source so visual behavior stays identical. The next integration step should replace data access behind the runtime/data-service boundary without redesigning the React component tree.

Recommended first extraction during backend integration:

1. filter state + applied/pending filter contract
2. trace/assignment data source
3. analytics/KPI adapter
4. map layer adapter
5. speed-draft persistence API
6. GIS persistence/version API

## Fidelity rule

Do not redesign while integrating backend. Treat the uploaded V23.3 HTML as the visual/interaction reference.
