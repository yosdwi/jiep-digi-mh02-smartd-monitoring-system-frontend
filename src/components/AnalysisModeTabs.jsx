export default function AnalysisModeTabs() {
  return (
    <>
    <nav className="analysis-mode-tabs" aria-label="Mode analisis">
      <button id="modeCycleBtn" className="analysis-mode-tab active" type="button" data-analysis-mode="cycle">
        Cycle Time
      </button>
      <button id="modeSpeedBtn" className="analysis-mode-tab" type="button" data-analysis-mode="speed">
        Speed Analysis
      </button>
      <button id="modeGisBtn" className="analysis-mode-tab" type="button" data-analysis-mode="gis" disabled title="Generate Speed Draft terlebih dahulu">
        GIS Workspace
      </button>
      <button id="modeDurationBtn" className="analysis-mode-tab" type="button" data-analysis-mode="duration">
        Duration In Pit
      </button>
      <button id="modeDatalogBtn" className="analysis-mode-tab" type="button" data-analysis-mode="datalog">
        Data Log Record
      </button>
      <span className="analysis-mode-context">
        Shared map · filter · playback
      </span>
    </nav>
    </>
  );
}
