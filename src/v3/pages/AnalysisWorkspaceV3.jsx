import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import AnalysisModeTabs from '../features/analysis-workspace/AnalysisModeTabs';
import CycleTimeV3 from './CycleTimeV3';
import SpeedAnalysisV3 from './SpeedAnalysisV3';
import AreaOperasiV3 from './AreaOperasiV3';
import DurasiInPitV3 from './DurasiInPitV3';
import DatalogRecordV3 from './DatalogRecordV3';
import useSpeedAnalysisStore from '../state/speedAnalysisStore';

// Experimental React entry for the locked V23.3 Analysis Workspace behaviour.
//
// Each mode mounts one surface at a time. The stores and typed-array registry
// live above those surfaces, so changing tabs preserves the applied query,
// selection and trace without ever mounting two competing maps.

export default function AnalysisWorkspaceV3() {
  const [params, setParams] = useSearchParams();
  const requestedMode = params.get('mode');
  const activeMode = ['cycle-time', 'speed-analysis', 'gis-workspace', 'duration-in-pit', 'data-log-record']
    .includes(requestedMode) ? requestedMode : 'cycle-time';
  const handoff = useSpeedAnalysisStore((s) => s.handoff);
  const applyHandoff = useSpeedAnalysisStore((s) => s.applyHandoff);

  const setActiveMode = useCallback((mode) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('mode', mode);
      return next;
    }, { replace: true });
  }, [setParams]);

  const content = useMemo(() => {
    if (activeMode === 'speed-analysis') {
      return <SpeedAnalysisV3 onOpenGis={() => setActiveMode('gis-workspace')} />;
    }
    if (activeMode === 'gis-workspace') {
      return (
        <AreaOperasiV3
          handoff={handoff}
          onCommitHandoff={applyHandoff}
          onBackToSpeed={() => setActiveMode('speed-analysis')}
        />
      );
    }
    if (activeMode === 'duration-in-pit') return <DurasiInPitV3 />;
    if (activeMode === 'data-log-record') return <DatalogRecordV3 />;
    return <CycleTimeV3 />;
  }, [activeMode, handoff, applyHandoff, setActiveMode]);

  return (
    <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <AnalysisModeTabs activeMode={activeMode} onModeChange={setActiveMode} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {content}
      </div>
    </section>
  );
}
