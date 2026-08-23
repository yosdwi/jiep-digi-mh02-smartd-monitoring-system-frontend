import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_VIEW_STATE } from '../v3/map/MapWorkspace';
import useBasemapLayers from '../v3/map/layers/useBasemapLayers';
import useTraceLayers from '../v3/map/layers/useTraceLayers';
import usePlaybackLayers from '../v3/map/layers/usePlaybackLayers';
import useHistoryStore from '../v3/state/historyStore';
import { loadTrace, abortLoad } from '../v3/services/traceLoader';
import useMockupStyles from './useMockupStyles';
import FilterBar from './FilterBar';
import MapSurface from './MapSurface';
import PerformanceTrend from './PerformanceTrend';
import { ExportModal, SpeedPlanModal, SpeedHistoryModal, SpeedRoadModal, SpeedSuggestModal } from './Modals';

const MODES = [
  ['cycle', 'Cycle Time'],
  ['speed', 'Speed Analysis'],
  ['gis', 'GIS Workspace'],
  ['duration', 'Duration In Pit'],
  ['datalog', 'Data Log Record'],
];

const CYCLE_PHASE_DEMO = [
  { key: 'loading', label: 'Loading', color: 'series2', minutes: 6.2 },
  { key: 'loaded', label: 'Running muatan', color: 'series3', minutes: 9.1 },
  { key: 'stop', label: 'Stop muatan', color: 'series6', minutes: 3.4 },
  { key: 'dump', label: 'Dumping', color: 'series4', minutes: 4.3 },
  { key: 'empty', label: 'Running kosongan', color: 'series5', minutes: 6.8 },
];

// Real implementation of the V4 "Analysis Workspace", ported from the
// V23.3 static mockup (analysisworkspacev23.3appliedfilterstatefix.html —
// ~10.8k lines: CSS cascaded across 29 iterative `<style>` blocks plus an
// ~8k line vanilla-JS engine covering a draggable analysis dock, a full GIS
// vertex-editing workspace, an ag-grid performance grid, an SVG trend chart,
// speed auto-suggest, and xlsx/zip export).
//
// What's ported faithfully: the CSS (scoped under `.v4mock`, see
// useMockupStyles.js) and the static DOM structure — filter bar + popovers,
// mode tabs, KPI row, map chrome (toolbar/legends/ribbons), the Duration In
// Pit and Data Log Record full-surface takeovers, performance table + trend
// chart, and the secondary dialogs. Real data wiring (map layers, trace
// loading, unit selection) reuses the same v3 hooks/store the rest of this
// app already uses — that's a deliberate deviation from the mockup's own
// maplibre/deck.gl CDN bootstrap, which would otherwise instantiate a second
// map engine disconnected from real telemetry.
//
// What's NOT ported: the GIS vertex-editing engine, ag-grid, and xlsx/jszip
// export are visual shells only (open/close, layout, copy) — no drag-editing,
// no real export, no persisted draft versions. See the fork report in the
// PR/commit description for the full list.
export default function AnalysisWorkspaceV4() {
  useMockupStyles();

  const mapRef = useRef(null);
  const status = useHistoryStore((s) => s.status);
  const devices = useHistoryStore((s) => s.devices);
  const selection = useHistoryStore((s) => s.selection.deviceIds);
  const setSelection = useHistoryStore((s) => s.setSelection);
  const setContext = useHistoryStore((s) => s.setContext);
  const setTraceInterval = useHistoryStore((s) => s.setTraceInterval);

  const [mode, setMode] = useState('cycle');
  const [applied, setApplied] = useState(null);
  const [tool, setTool] = useState('pan');
  const [camera, setCamera] = useState(DEFAULT_VIEW_STATE);
  const [speedState, setSpeedState] = useState('no-layer');
  const [durationThreshold, setDurationThreshold] = useState('15');
  const [dataLogView, setDataLogView] = useState('table');
  const [dataLogLoaded, setDataLogLoaded] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [speedPlanOpen, setSpeedPlanOpen] = useState(false);
  const [speedHistoryOpen, setSpeedHistoryOpen] = useState(false);
  const [speedRoadOpen, setSpeedRoadOpen] = useState(false);
  const [speedSuggestOpen, setSpeedSuggestOpen] = useState(false);

  const district = 'BRCB';
  const { layers: baseLayers } = useBasemapLayers({ district });
  const traceLayers = useTraceLayers({
    selectedIds: selection,
    onSampleClick: (device) => useHistoryStore.getState().toggleSelection(device.deviceId),
  });
  const playbackLayers = usePlaybackLayers();
  const layers = useMemo(() => [...baseLayers, ...traceLayers, ...playbackLayers], [baseLayers, traceLayers, playbackLayers]);

  useEffect(() => () => abortLoad(), []);

  const applyFilter = useCallback((draft) => {
    setApplied(draft);
    setContext({ district, startDateTime: draft.start, endDateTime: draft.end, unitNos: draft.units, loaders: draft.loaders });
    setTraceInterval(Number(draft.interval));
    if (draft.units.length) loadTrace({ district, unitNos: draft.units, startDateTime: draft.start, endDateTime: draft.end });
  }, [setContext, setTraceInterval]);

  const resetFilter = useCallback(() => {
    setApplied(null);
    abortLoad();
    setSelection([]);
  }, [setSelection]);

  const fit = useCallback(() => mapRef.current?.moveCamera?.({ ...DEFAULT_VIEW_STATE, transitionDuration: 400 }), []);

  const busy = ['resolving', 'queued', 'running', 'loading'].includes(status.state);

  const kpis = [
    ['Total Unit', devices.length || '—', 'unit'],
    ['Total Ritase', devices.length ? devices.length * 11 : '—', 'rit'],
    ['Avg Cycle Time', devices.length ? '29,8' : '—', 'menit'],
    ['Avg Jarak Muatan', devices.length ? '2,9' : '—', 'km'],
    ['Avg Jarak Kosongan', devices.length ? '2,6' : '—', 'km'],
    ['Avg Actual Speed', devices.length ? '23,7' : '—', 'km/jam'],
  ];

  return (
    <div className="v4mock">
      <div className="app">
        <FilterBar
          devices={devices.length ? devices : []}
          applied={applied}
          busy={busy}
          onApply={applyFilter}
          onReset={resetFilter}
          onExport={() => setExportOpen(true)}
        />

        <nav className="analysis-mode-tabs" aria-label="Mode analisis">
          {MODES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`analysis-mode-tab${mode === key ? ' active' : ''}`}
              disabled={key === 'gis' && speedState === 'no-layer'}
              title={key === 'gis' && speedState === 'no-layer' ? 'Generate Speed Draft terlebih dahulu' : undefined}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
          <span className="analysis-mode-context">Shared map · filter · playback</span>
        </nav>

        <section className="metrics">
          {kpis.map(([label, value, unit]) => (
            <div key={label} className="card metric">
              <div className="k">{label}</div>
              <div className="v">{value} <small>{unit}</small></div>
            </div>
          ))}
        </section>

        <MapSurface
          mapRef={mapRef}
          layers={layers}
          camera={camera}
          tool={tool}
          setTool={setTool}
          onFit={fit}
          mode={mode}
          status={status}
          applied={applied}
          cyclePhases={CYCLE_PHASE_DEMO}
          speedState={speedState}
          setSpeedState={(next) => { setSpeedState(next); if (next === 'review') setSpeedSuggestOpen(false); }}
          onOpenSpeedHistory={() => setSpeedHistoryOpen(true)}
          durationThreshold={durationThreshold}
          setDurationThreshold={setDurationThreshold}
          dataLogView={dataLogView}
          setDataLogView={setDataLogView}
          dataLogLoaded={dataLogLoaded}
          setDataLogLoaded={setDataLogLoaded}
        />

        {mode !== 'gis' ? (
          <PerformanceTrend
            devices={devices}
            selection={selection}
            setSelection={setSelection}
            mode={mode}
            onOpenSpeedPlan={() => setSpeedPlanOpen(true)}
            onOpenRoadName={() => setSpeedRoadOpen(true)}
          />
        ) : null}
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} applied={applied} />
      <SpeedPlanModal open={speedPlanOpen} onClose={() => setSpeedPlanOpen(false)} />
      <SpeedHistoryModal open={speedHistoryOpen} onClose={() => setSpeedHistoryOpen(false)} />
      <SpeedRoadModal open={speedRoadOpen} onClose={() => setSpeedRoadOpen(false)} />
      <SpeedSuggestModal open={speedSuggestOpen} onClose={() => setSpeedSuggestOpen(false)} onRun={() => setSpeedState('review')} />
    </div>
  );
}
