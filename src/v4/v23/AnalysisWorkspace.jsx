import FilterBar from "./components/FilterBar";
import AnalysisModeTabs from "./components/AnalysisModeTabs";
import KpiRow from "./components/KpiRow";
import MapWorkspace from "./components/map/MapWorkspace";
import WorkspaceModals from "./components/modals/WorkspaceModals";
import { WorkspaceProvider } from "./state/WorkspaceContext";

export default function AnalysisWorkspace() {
  return (
    <WorkspaceProvider>
      <div className="app">
        <FilterBar />
        <AnalysisModeTabs />
        <KpiRow />
        <MapWorkspace />
      </div>
      <WorkspaceModals />
    </WorkspaceProvider>
  );
}
