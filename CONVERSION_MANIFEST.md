# Conversion Manifest

Source: `analysis-workspace-v23.3-applied-filter-state-fix.html`

## React component mapping

| Source surface | React component |
|---|---|
| filterbar + time/loader/unit/interval popovers + export | `FilterBar.jsx` |
| analysis mode tabs | `AnalysisModeTabs.jsx` |
| six KPI cards | `KpiRow.jsx` |
| shared map + Cycle/Speed/Duration/Data Log surfaces + playback | `MapWorkspaceShell.jsx` |
| performance / segment grid host | `PerformancePanel.jsx` |
| trend surface | `TrendPanel.jsx` |
| Speed Plan / History / Road / GIS / Auto Suggest / Survey modals | `WorkspaceOverlays.jsx` |

## Runtime mapping

All original executable scripts are preserved in source order inside `src/runtime/analysisWorkspaceRuntime.js` and mounted from a React hook. This is a fidelity-first migration boundary: DOM-rendered page ownership moved to React/Vite now; backend/data/state logic can be extracted incrementally next without losing the approved behavior.

Included source script blocks:

- runtimeGuardV142
- analysisWorkspaceMainV142
- mapCentricExplorationV2Script
- cycleMapToolKeyboard
- cycleExportZipV7Script
- gisWorkspaceV18Script
- gisWorkspaceV19Script
- analysisWorkspaceV20Source (executed directly, no eval)
- analysisWorkspaceV21Script
- analysisWorkspaceV22Script
- analysisWorkspaceV23Script

## CSS mapping

All style blocks (named and anonymous) are concatenated in original document order into `src/styles/analysis-workspace.css`, preserving cascade/override behavior.
