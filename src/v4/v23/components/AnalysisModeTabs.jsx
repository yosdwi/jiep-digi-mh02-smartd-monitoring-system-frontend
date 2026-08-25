import { useWorkspace } from "../state/WorkspaceContext";

const MODES = [
  ["cycle", "Cycle Time"],
  ["speed", "Speed Analysis"],
  ["gis", "GIS Workspace"],
  ["duration", "Duration In Pit"],
  ["datalog", "Data Log Record"],
];

export default function AnalysisModeTabs() {
  const { state, dispatch } = useWorkspace();
  return (
    <nav className="analysis-mode-tabs" aria-label="Mode analisis">
      {MODES.map(([mode, label]) => (
        <button key={mode} className={`analysis-mode-tab ${state.mode === mode ? "active" : ""}`} type="button" onClick={() => dispatch({ type: "SET_MODE", mode })}>
          {label}
        </button>
      ))}
      <span className="analysis-mode-context">Shared map · filter · playback</span>
    </nav>
  );
}
