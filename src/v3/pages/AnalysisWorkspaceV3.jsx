import { useState } from 'react';
import AnalysisModeTabs from '../features/analysis-workspace/AnalysisModeTabs';
import CycleTimeV3 from './CycleTimeV3';

// Experimental React entry for the locked V23.3 Analysis Workspace behaviour.
//
// Cycle Time is intentionally the only active mode in this first checkpoint:
// it is the regression baseline. The component reuses HistoryWorkspace below,
// so there is still one applied filter, one trace registry, one deck.gl map and
// one playback runtime. The remaining modes are enabled as their React slices
// reach parity with the prototype.

export default function AnalysisWorkspaceV3() {
  const [activeMode, setActiveMode] = useState('cycle-time');

  return (
    <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <AnalysisModeTabs activeMode={activeMode} onModeChange={setActiveMode} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <CycleTimeV3 />
      </div>
    </section>
  );
}
