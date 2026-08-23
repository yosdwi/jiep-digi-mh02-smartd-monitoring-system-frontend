import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './app/AppShell';
import CycleTimeV3 from './pages/CycleTimeV3';
import UnderspeedV3 from './pages/UnderspeedV3';
import DurasiInPitV3 from './pages/DurasiInPitV3';
import LiveUnitV3 from './pages/LiveUnitV3';
import AreaOperasiV3 from './pages/AreaOperasiV3';
import LayerOrthoV3 from './pages/LayerOrthoV3';
import DatalogRecordV3 from './pages/DatalogRecordV3';
import FixtureCycleTimeLab from './pages/FixtureCycleTimeLab';
import AnalysisWorkspaceV3 from './pages/AnalysisWorkspaceV3';
import { V3_BASE } from './app/navigation';

// V3 is additive. It mounts under /v3/* and modifies nothing in V1, V2 or MIR,
// which stay shippable throughout.

export default function V3Routes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="historis/cycle-time" replace />} />

        <Route path="historis/cycle-time" element={<CycleTimeV3 />} />
        <Route path="historis/underspeed" element={<UnderspeedV3 />} />

        <Route path="historis/durasi-in-pit" element={<DurasiInPitV3 />} />

        <Route path="historis/datalog" element={<DatalogRecordV3 />} />

        <Route path="operasi/live" element={<LiveUnitV3 />} />

        <Route path="peta/layer" element={<LayerOrthoV3 />} />

        <Route path="peta/area" element={<AreaOperasiV3 />} />

        <Route path="lab/fixture" element={<FixtureCycleTimeLab />} />

        <Route path="lab/analysis-workspace" element={<AnalysisWorkspaceV3 />} />

        <Route path="*" element={<Navigate to={`${V3_BASE}/historis/cycle-time`} replace />} />
      </Route>
    </Routes>
  );
}
