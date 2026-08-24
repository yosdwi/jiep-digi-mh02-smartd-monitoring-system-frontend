import { useMemo, useState } from 'react';

const DEMO_ROWS = [
  { unit: 'DT5204', loader: 'EX3001', ritase: 12, cycle: 28.4, loaded: 2.8, empty: 2.4, speed: 24.6 },
  { unit: 'DT5210', loader: 'EX3001', ritase: 11, cycle: 30.1, loaded: 2.7, empty: 2.5, speed: 23.2 },
  { unit: 'DT5328', loader: 'EX3003', ritase: 10, cycle: 31.7, loaded: 3.2, empty: 2.9, speed: 21.8 },
];

const TREND_METRICS = [
  ['ritase', 'Ritase', true],
  ['cycle', 'Avg Cycle Time', true],
  ['loadedDistance', 'Jarak Muatan', false],
  ['emptyDistance', 'Jarak Kosongan', false],
  ['speed', 'Actual Avg Speed', false],
  ['stop', 'Stop Muatan', false],
];

const TREND_DEMO = [42, 70, 56, 88, 62, 76, 53, 79, 64, 90, 72, 81, 58, 66, 84, 71, 69, 77, 60, 85, 73, 68, 91, 63];

// Ported from the V23.3 mockup's `.performance-card` (ag-grid in the source
// file) and `.trend-card` (a hand-rolled SVG line chart). ag-grid isn't a
// dependency of this app and adding it is a separate call from a UI port, so
// the grid renders as a plain table — same rows/columns/visual language, real
// selection wired to the history store's selection where devices exist.
export default function PerformanceTrend({ devices, selection, setSelection, mode, onOpenSpeedPlan, onOpenRoadName }) {
  const rows = useMemo(() => {
    if (!devices.length) return DEMO_ROWS.map((row) => ({ ...row, deviceId: row.unit }));
    return devices.map((d, i) => ({
      deviceId: d.deviceId,
      unit: d.unitNo,
      loader: DEMO_ROWS[i % DEMO_ROWS.length].loader,
      ritase: DEMO_ROWS[i % DEMO_ROWS.length].ritase,
      cycle: DEMO_ROWS[i % DEMO_ROWS.length].cycle,
      loaded: DEMO_ROWS[i % DEMO_ROWS.length].loaded,
      empty: DEMO_ROWS[i % DEMO_ROWS.length].empty,
      speed: DEMO_ROWS[i % DEMO_ROWS.length].speed,
    }));
  }, [devices]);

  const [search, setSearch] = useState('');
  const filtered = rows.filter((r) => `${r.unit} ${r.loader}`.toLowerCase().includes(search.trim().toLowerCase()));

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
        <div id="performanceGrid">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{['Unit', 'Loader', 'Ritase', 'Avg Cycle', 'Muatan', 'Kosongan', 'Speed'].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.unit}
                    className={selection.includes(row.deviceId) ? 'selected' : ''}
                    onClick={() => setSelection(
                      selection.includes(row.deviceId) ? selection.filter((x) => x !== row.deviceId) : [...selection, row.deviceId],
                    )}
                  >
                    <td><input type="checkbox" readOnly checked={selection.includes(row.deviceId)} /> {row.unit}</td>
                    <td>{row.loader}</td>
                    <td>{row.ritase}</td>
                    <td>{row.cycle} min</td>
                    <td>{row.loaded} km</td>
                    <td>{row.empty} km</td>
                    <td>{row.speed} km/j</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
