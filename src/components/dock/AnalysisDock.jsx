import PerformancePanel from "./PerformancePanel";
import TrendPanel from "./TrendPanel";
import { DurationAreaDock, DurationOccupancyDock, DurationTrendDock } from "./DurationDock";
import { useWorkspace } from "../../state/WorkspaceContext";

export default function AnalysisDock() {
  const { state, dispatch } = useWorkspace();
  if (["gis", "datalog"].includes(state.mode)) return null;
  const duration = state.mode === "duration";
  const tabs = duration ? [["performance", "Occupancy"], ["trend", "Area"], ["durationtrend", "Trend Duration"]] : [["performance", state.mode === "speed" ? "Segment Performance" : "Performance"], ["trend", state.mode === "speed" ? "Trend Speed" : "Trend Performa"]];
  const stateName = state.dock.state;
  const toggleCollapsed = () => dispatch({ type: "SET_DOCK", patch: { state: stateName === "collapsed" ? "half" : "collapsed", height: stateName === "collapsed" ? 36 : 46 } });
  const toggleFull = () => dispatch({ type: "SET_DOCK", patch: { state: stateName === "full" ? "half" : "full", height: stateName === "full" ? 36 : 74 } });
  return (
    <section id="analysisDock" className={`analysis-dock state-${stateName} ${duration ? "duration-dock-v21" : ""}`} style={{ height: stateName === "collapsed" ? 46 : `${state.dock.height}%` }}>
      <header className="dock-header">
        <button className="dock-grab" type="button" title="Klik untuk ganti level" onClick={() => dispatch({ type: "SET_DOCK", patch: { state: stateName === "half" ? "full" : stateName === "full" ? "collapsed" : "half", height: stateName === "half" ? 74 : stateName === "full" ? 46 : 36 } })}></button>
        <span className="dock-title">{duration ? "Duration In Pit Analysis" : state.mode === "speed" ? "Speed Analysis" : "Analisa Cycle Time"}</span>
        <nav className="dock-tabs">{tabs.map(([key, label]) => <button key={key} className={`dock-tab ${state.dock.tab === key ? "active" : ""}`} type="button" onClick={() => dispatch({ type: "SET_DOCK", patch: { tab: key, state: stateName === "collapsed" ? "half" : stateName, height: stateName === "collapsed" ? 36 : state.dock.height } })}>{label}</button>)}</nav>
        <span className="dock-spacer"></span>
        <span className="dock-state-text">{stateName === "half" ? `Half · ${state.dock.height}%` : stateName === "full" ? `Full · ${state.dock.height}%` : "Collapsed"}</span>
        <button className="dock-icon-btn" type="button" title="Collapse" onClick={toggleCollapsed}>⌄</button>
        <button className="dock-icon-btn" type="button" title="Tampilkan semua analisa" onClick={toggleFull}>⛶</button>
      </header>
      <div className="dock-content">
        <div className="dock-panels">
          <div className={`dock-panel dock-performance ${state.dock.tab === "performance" ? "active" : ""}`}>{duration ? <DurationOccupancyDock /> : <PerformancePanel />}</div>
          <div className={`dock-panel dock-trend ${state.dock.tab === "trend" ? "active" : ""}`}>{duration ? <DurationAreaDock /> : <TrendPanel />}</div>
          {duration && <div className={`dock-panel dock-duration-trend-v21 ${state.dock.tab === "durationtrend" ? "active" : ""}`}><DurationTrendDock /></div>}
        </div>
      </div>
    </section>
  );
}
