import FilterBar from "./components/FilterBar";
import AnalysisModeTabs from "./components/AnalysisModeTabs";
import KpiRow from "./components/KpiRow";
import MapWorkspaceShell from "./components/MapWorkspaceShell";
import PerformancePanel from "./components/PerformancePanel";
import TrendPanel from "./components/TrendPanel";
import WorkspaceOverlays from "./components/WorkspaceOverlays";
import { useAnalysisWorkspaceRuntime } from "./hooks/useAnalysisWorkspaceRuntime";

export default function AnalysisWorkspace() {
  useAnalysisWorkspaceRuntime();
  return (
    <>
      <div className="app">
        <FilterBar />
        <AnalysisModeTabs />
        <KpiRow />
        <MapWorkspaceShell />
        <PerformancePanel />
        <TrendPanel />
      </div>
      <WorkspaceOverlays />
    </>
  );
}
