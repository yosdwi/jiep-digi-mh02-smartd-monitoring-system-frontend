import { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { v4GridTheme, v4DefaultColDef } from './agGridSetup';
import { buildPerformanceRows } from './performanceRows';

const TREND_METRICS = [
  ['ritase', 'Ritase', true],
  ['cycle', 'Avg Cycle Time', true],
  ['loadedDistance', 'Jarak Muatan', false],
  ['emptyDistance', 'Jarak Kosongan', false],
  ['speed', 'Actual Avg Speed', false],
  ['stop', 'Stop Muatan', false],
];

const TREND_DEMO = [42, 70, 56, 88, 62, 76, 53, 79, 64, 90, 72, 81, 58, 66, 84, 71, 69, 77, 60, 85, 73, 68, 91, 63];

// Ported from the V23.3 mockup's `.performance-card` (ag-grid Community in
// the source file) and `.trend-card` (a hand-rolled SVG line chart). The grid
// is real ag-grid (see agGridSetup.js for the shared theme/module setup),
// fed by the same buildPerformanceRows() the xlsx export uses so the two
// can't drift apart. Selection is wired to the history store's real
// selection where devices exist.
export default function PerformanceTrend({ devices, selection, setSelection, mode, onOpenSpeedPlan, onOpenRoadName }) {
  const rows = useMemo(() => buildPerformanceRows(devices), [devices]);

  const [search, setSearch] = useState('');
  const filtered = rows.filter((r) => `${r.unit} ${r.loader}`.toLowerCase().includes(search.trim().toLowerCase()));

  const columnDefs = useMemo(() => [
    {
      field: 'unit',
      headerName: 'Unit',
      minWidth: 130,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    { field: 'loader', headerName: 'Loader', width: 110 },
    { field: 'ritase', headerName: 'Ritase', width: 95 },
    { field: 'cycle', headerName: 'Avg Cycle', width: 110, valueFormatter: (p) => `${p.value} min` },
    { field: 'loaded', headerName: 'Muatan', width: 100, valueFormatter: (p) => `${p.value} km` },
    { field: 'empty', headerName: 'Kosongan', width: 105, valueFormatter: (p) => `${p.value} km` },
    { field: 'speed', headerName: 'Speed', width: 100, valueFormatter: (p) => `${p.value} km/j` },
  ], []);

  const onSelectionChanged = useCallback((event) => {
    setSelection(event.api.getSelectedRows().map((r) => r.deviceId));
  }, [setSelection]);

  const onGridReady = useCallback((event) => {
    event.api.forEachNode((node) => {
      if (selection.includes(node.data.deviceId)) node.setSelected(true, false, 'api');
    });
  }, [selection]);

  const [activeMetrics, setActiveMetrics] = useState(() => new Set(TREND_METRICS.filter(([, , d]) => d).map(([key]) => key)));
  function toggleMetric(key) {
    setActiveMetrics((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const W = 1200;
  const H = 220;
  const path = useMemo(() => {
    const max = Math.max(...TREND_DEMO);
    return TREND_DEMO.map((v, i) => {
      const x = (i / (TREND_DEMO.length - 1)) * W;
      const y = H - (v / max) * (H - 20) - 10;
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, []);

  return (
    <>
      <section className="card performance-card">
        <div className="head performance-head">
          <div className="title">{mode === 'speed' ? 'Segment Performance' : 'Performance'}</div>
          <div className="performance-actions">
            <span className="selection-count">{selection.length} unit dipilih</span>
            {mode === 'speed' ? (
              <>
                <button type="button" className="btn" disabled={!selection.length} onClick={onOpenRoadName}>Assign Road Name</button>
                <button type="button" className="btn" disabled={!selection.length} onClick={onOpenSpeedPlan}>Edit Speed Plan</button>
              </>
            ) : null}
            <input className="grid-search" type="search" placeholder="Cari loader atau unit…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div id="performanceGrid" style={{ height: 260, width: '100%' }}>
          <AgGridReact
            theme={v4GridTheme}
            rowData={filtered}
            columnDefs={columnDefs}
            defaultColDef={v4DefaultColDef}
            getRowId={(p) => p.data.deviceId}
            rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true }}
            rowHeight={33}
            headerHeight={35}
            onSelectionChanged={onSelectionChanged}
            onGridReady={onGridReady}
          />
        </div>
      </section>

      <section className="card trend-card">
        <div className="head"><div className="title">Trend Performa</div></div>
        <div className="trend-body">
          <div className="trend-toolbar">
            {TREND_METRICS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`metric-toggle${activeMetrics.has(key) ? ' active' : ''}`}
                onClick={() => toggleMetric(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="trend-wrap">
            <div className="trend-readout">
              <strong>{TREND_DEMO[TREND_DEMO.length - 1]}</strong>
              <span>jam terakhir</span>
            </div>
            <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Trend performa per jam">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <line key={f} className="trend-grid" x1="0" y1={H * f} x2={W} y2={H * f} />
              ))}
              <path className="trend-area" d={`${path} L${W},${H} L0,${H} Z`} />
              <path className="trend-line" d={path} />
            </svg>
            <div className="trend-brush-note"><span>Seluruh rentang</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
