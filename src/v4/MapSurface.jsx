import { useState } from 'react';
import MapWorkspace from '../v3/map/MapWorkspace';

const LAYER_TOGGLES = [
  ['trace', 'Dot trace historis'],
  ['loading', 'PLM Loading'],
  ['boundary', 'Boundary distrik'],
  ['roads', 'Jalan tambang'],
  ['ortho', 'Orthophoto'],
];

const SPEED_BUCKETS = [
  ['rgb(59,130,246)', '≥30 kph'],
  ['rgb(34,197,94)', '25–30 kph'],
  ['rgb(251,191,36)', '20–25 kph'],
  ['rgb(139,69,19)', '10–20 kph'],
  ['rgb(239,68,68)', '<10 kph'],
];

// Ported from the V23.3 mockup's `.map-shell`: toolbar, layer popover, the
// per-mode ribbons/overlays and full-surface takeovers for Duration In Pit /
// Data Log Record. The map itself stays the app's real MapWorkspace (deck.gl
// via v3's layer hooks) rather than the mockup's own maplibre/deck.gl CDN
// bootstrap — that bootstrap would instantiate a second, disconnected map
// engine alongside the one already wired to real trace data.
export default function MapSurface({
  mapRef, layers, camera, tool, setTool, onFit,
  mode, status, applied,
  cyclePhases,
  speedState, setSpeedState, onOpenSpeedHistory,
  durationThreshold, setDurationThreshold,
  dataLogView, setDataLogView, dataLogLoaded, setDataLogLoaded,
}) {
  const [layerPopOpen, setLayerPopOpen] = useState(false);
  const [layerState, setLayerState] = useState({ trace: true, loading: true, boundary: true, roads: true, ortho: true });

  const loading = status.state === 'loading' || status.state === 'resolving' || status.state === 'queued' || status.state === 'running';

  return (
    <section className="workspace">
      <article className="card map-card">
        <div className="map-shell">
          <MapWorkspace ref={mapRef} layers={layers} cameraCommand={camera} tool={tool === 'measure' ? 'measure' : 'pan'} onZoomChange={() => {}} />

          <div className="map-tools">
            <button type="button" className={`toolbtn${tool === 'pan' ? ' active' : ''}`} title="Pan / geser peta" onClick={() => setTool('pan')}>✋</button>
            <button type="button" className={`toolbtn${tool === 'draw' ? ' active' : ''}`} title="Draw area" onClick={() => setTool('draw')}>◇</button>
            <button type="button" className={`toolbtn${tool === 'measure' ? ' active' : ''}`} title="Ukur jarak" onClick={() => setTool('measure')}>↔</button>
            <button type="button" className="toolbtn" title="Tilt peta" data-pitch="0°" onClick={() => {}}>◩</button>
            <span className="tool-sep" aria-hidden="true" />
            <button type="button" className="toolbtn" title="Perbesar" onClick={() => { const v = mapRef.current?.getViewState?.(); if (v) mapRef.current.moveCamera({ ...v, zoom: v.zoom + 1 }); }}>＋</button>
            <button type="button" className="toolbtn" title="Perkecil" onClick={() => { const v = mapRef.current?.getViewState?.(); if (v) mapRef.current.moveCamera({ ...v, zoom: v.zoom - 1 }); }}>−</button>
            <button type="button" className="toolbtn" title="Fit / reset extent" onClick={onFit}>⌗</button>
            <span className="tool-sep" aria-hidden="true" />
            <button type="button" className={`toolbtn${layerPopOpen ? ' active' : ''}`} title="Layer" onClick={() => setLayerPopOpen((v) => !v)}>▦</button>
          </div>

          {layerPopOpen ? (
            <div id="layerPop" className="popover" style={{ position: 'absolute', top: 8, right: 52, minWidth: 260 }}>
              <div className="pop-title" style={{ marginTop: 0 }}>Layer Peta</div>
              {LAYER_TOGGLES.map(([key, label]) => (
                <label key={key} className="check-row">
                  <span className="check-main">
                    <input
                      type="checkbox"
                      checked={layerState[key]}
                      onChange={() => setLayerState((s) => ({ ...s, [key]: !s[key] }))}
                    />
                    {label}
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {mode === 'duration' ? (
            <DurationSurface threshold={durationThreshold} setThreshold={setDurationThreshold} />
          ) : null}
          {mode === 'datalog' ? (
            <DataLogSurface view={dataLogView} setView={setDataLogView} loaded={dataLogLoaded} setLoaded={setDataLogLoaded} />
          ) : null}
          {mode === 'gis' ? <GisSurface /> : null}

          {mode === 'cycle' ? <CycleRibbon phases={cyclePhases} /> : null}
          {mode === 'speed' ? <SpeedRibbon state={speedState} setState={setSpeedState} onOpenHistory={onOpenSpeedHistory} /> : null}

          <div id="mapStatus" className="map-status">z13.0</div>

          {mode !== 'duration' && mode !== 'datalog' && mode !== 'gis' ? (
            <>
              <div className="context-legend" aria-label="Legenda konteks peta">
                <div className="leg"><span className="ctx-boundary" />Boundary</div>
                <div className="leg"><span className="ctx-road" />Jalan Tambang</div>
                <div className="leg"><span className="ctx-loading" />PLM Loading</div>
                <div className="leg"><span className="ctx-loader" />Estimasi Loader Area</div>
              </div>
              {mode === 'speed' ? (
                <div className="legend">
                  {SPEED_BUCKETS.map(([color, label]) => (
                    <div key={label} className="leg"><span className="sw" style={{ background: color }} /> {label}</div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {loading ? (
            <div id="loadingMask" className="loading">
              <div className="card loadingbox">
                <div className="title">Memuat data {mode === 'speed' ? 'Speed Analysis' : 'Cycle Time'}</div>
                <div className="sub">{status.message || 'Membaca fixture BRCB dan layer peta.'}</div>
                <div className="progress"><span /></div>
              </div>
            </div>
          ) : null}

          {!loading && !applied ? (
            <div className="map-sample">Pilih unit lalu klik Terapkan</div>
          ) : null}
        </div>
      </article>
    </section>
  );
}

function CycleRibbon({ phases }) {
  const total = phases.reduce((sum, p) => sum + p.minutes, 0);
  return (
    <div className="cycle-overlay">
      <div id="cycleAnalysisRibbon" className="cycle-analysis-ribbon">
        <div className="cycle-ribbon-head">
          <div className="cycle-ribbon-title-wrap">
            <span className="cycle-ribbon-title">Komposisi Cycle</span>
            <span className="cycle-ribbon-value">{total ? `${total.toFixed(1)} menit` : '—'}</span>
            <span className="cycle-ribbon-meta">teramati per unit</span>
          </div>
        </div>
        <div className="cycle-stack cycle-ribbon-stack">
          {phases.map((p) => (
            <span key={p.key} style={{ width: total ? `${(p.minutes / total) * 100}%` : 0, background: `var(--${p.color})` }} />
          ))}
        </div>
        <div className="cycle-ribbon-legend">
          {phases.map((p) => (
            <div key={p.key} className="cycle-ribbon-item">
              <span className="cycle-mini-label"><i className="cycle-mini-dot" style={{ background: `var(--${p.color})`, display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginRight: 4 }} />{p.label}</span>
              <strong className="cycle-ribbon-time">{total ? `${p.minutes.toFixed(1)}m` : '—'}</strong>
              <span className="cycle-ribbon-pct">{total ? `${Math.round((p.minutes / total) * 100)}%` : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpeedRibbon({ state, setState, onOpenHistory }) {
  const label = state === 'no-layer' ? 'Belum ada Draft' : state === 'active' ? 'Active Version v1' : 'Review Draft v1 · 8 segment';
  return (
    <div className="cycle-overlay">
      <div id="speedAnalysisRibbon" className="speed-analysis-ribbon">
        <div className="speed-ribbon-brand">
          <div>
            <span className="speed-ribbon-title">Speed Analysis</span>
            <strong>{label}</strong>
          </div>
          <span className="speed-review-summary">{state === 'no-layer' ? 'Generate Draft dari telemetry aktif' : 'Coverage 82% · Gaps 2 · Review 1'}</span>
        </div>
        <button type="button" className="speed-draft-health" disabled={state === 'no-layer'} title="Draft Health">
          <span>Coverage {state === 'no-layer' ? '—' : '82%'}</span><i />
          <span>Gaps {state === 'no-layer' ? '—' : '2'}</span><i />
          <span>Review {state === 'no-layer' ? '—' : '1'}</span><b>⌄</b>
        </button>
        <div className="speed-ribbon-actions">
          <button type="button" className="btn speed-ribbon-btn" onClick={() => setState('review')}>Auto Suggest</button>
          <button type="button" className="btn primary speed-ribbon-btn" disabled={state === 'no-layer'}>Edit in GIS</button>
          <button type="button" className="btn speed-ribbon-btn" disabled={state !== 'review'} onClick={() => setState('active')}>Apply Draft</button>
          {state === 'active' ? (
            <button type="button" className="btn speed-ribbon-btn" onClick={onOpenHistory}>History</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const DURATION_EVENTS = [
  { unit: 'DT5204', area: 'Pit Selatan', minutes: 27 },
  { unit: 'DT5210', area: 'Pit Selatan', minutes: 19 },
  { unit: 'DT5328', area: 'Pit Timur', minutes: 43 },
  { unit: 'DT5401', area: 'Pit Utara', minutes: 12 },
];

function DurationSurface({ threshold, setThreshold }) {
  const [filter, setFilter] = useState('all');
  const events = filter === 'review' ? DURATION_EVENTS.filter((e) => e.minutes > Number(threshold)) : DURATION_EVENTS;
  const total = DURATION_EVENTS.reduce((sum, e) => sum + e.minutes, 0);
  const reviewCount = DURATION_EVENTS.filter((e) => e.minutes > Number(threshold)).length;
  return (
    <section className="duration-workspace-v20" aria-label="Duration In Pit Workspace">
      <header className="duration-topbar-v20">
        <div className="duration-title-v20"><strong>Duration In Pit</strong><span>Polygon Pit Stop · dwell telemetry</span></div>
        <div className="duration-kpis-v20">
          <div><span>Total dwell</span><strong>{Math.floor(total / 60)}j {total % 60}m</strong></div>
          <div><span>Event</span><strong>{DURATION_EVENTS.length}</strong></div>
          <div><span>Rata-rata</span><strong>{Math.round(total / DURATION_EVENTS.length)}m</strong></div>
          <div><span>Terpanjang</span><strong>{Math.max(...DURATION_EVENTS.map((e) => e.minutes))}m</strong></div>
          <div className="review"><span>Perlu Review</span><strong>{reviewCount}</strong></div>
        </div>
        <label className="duration-threshold-v20">
          <span>Review jika</span>
          <select value={threshold} onChange={(e) => setThreshold(e.target.value)}>
            <option value="10">&gt; 10 min</option>
            <option value="15">&gt; 15 min</option>
            <option value="20">&gt; 20 min</option>
            <option value="30">&gt; 30 min</option>
          </select>
        </label>
      </header>

      <aside className="duration-sidebar-v20">
        <div className="duration-side-head-v20"><strong>Event dwell</strong><span>Filter aktif</span></div>
        <div className="duration-side-tabs-v20">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Semua</button>
          <button type="button" className={filter === 'review' ? 'active' : ''} onClick={() => setFilter('review')}>Review</button>
        </div>
        <div className="duration-event-list-v20">
          {events.map((e) => (
            <p key={`${e.unit}-${e.area}`} style={{ padding: '10px 12px', margin: 0, borderBottom: '1px solid #eef1f4', fontSize: 13 }}>
              {e.unit} · {e.area} · {e.minutes}m{e.minutes > Number(threshold) ? ' · Review' : ''}
            </p>
          ))}
        </div>
      </aside>

      <section className="duration-timeline-v20">
        <header><strong>Okupansi area</strong><span>{DURATION_EVENTS.length} event</span><small>Rentang filter aktif</small></header>
        <div className="duration-timeline-rows-v20">
          <div style={{ height: 115, borderRadius: 6, background: 'repeating-linear-gradient(90deg,#dceff4 0 11%,#fff 11% 13%)' }} />
        </div>
      </section>
    </section>
  );
}

const DATALOG_ROWS = Array.from({ length: 8 }, (_, i) => ({
  time: `08:${String(i * 5).padStart(2, '0')}:00`,
  unit: 'DT5204',
  lat: (1.91243 + i * 0.0002).toFixed(5),
  lon: (117.2831 + i * 0.0002).toFixed(4),
  speed: 18 + i,
  status: 'RUNNING',
}));

function DataLogSurface({ view, setView, loaded, setLoaded }) {
  return (
    <section className="datalog-workspace-v20" aria-label="Data Log Record Workspace">
      <header className="datalog-topbar-v20">
        <div className="datalog-title-v20"><strong>Data Log Record</strong><span>{loaded ? `${DATALOG_ROWS.length} baris dimuat` : 'Raw telemetry · filter aktif'}</span></div>
        <input type="search" placeholder="Cari pada data yang dimuat…" />
        <div className="datalog-view-tabs-v20">
          {[['table', 'Tabel'], ['chart', 'Chart'], ['map', 'Map']].map(([key, label]) => (
            <button key={key} type="button" className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>
          ))}
        </div>
        <button type="button" className="btn">Columns</button>
        <button type="button" className="btn primary" onClick={() => setLoaded(true)}>Muat data</button>
        <span className="datalog-rows-meta-v20">{loaded ? `${DATALOG_ROWS.length} baris` : 'Belum dimuat'}</span>
      </header>

      <aside className="datalog-tree-v20">
        <div className="datalog-tree-head-v20"><strong>Units</strong><input type="search" placeholder="Cari unit…" /></div>
        <div className="datalog-tree-body-v20" />
      </aside>

      <section className={`datalog-stage-v20 ${view}-view`}>
        {view === 'table' ? (
          <div className="datalog-table-view-v20">
            {loaded ? (
              <table className="datalog-table-v20">
                <thead>
                  <tr>{['Waktu', 'Unit', 'Latitude', 'Longitude', 'Speed', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {DATALOG_ROWS.map((row) => (
                    <tr key={row.time}>
                      <td>{row.time}</td><td>{row.unit}</td><td>{row.lat}</td><td>{row.lon}</td><td>{row.speed} km/j</td><td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="datalog-empty-v20">Pilih unit lalu tekan <strong>Muat data</strong>.</div>
            )}
          </div>
        ) : null}
        {view === 'chart' ? (
          <div className="datalog-chart-view-v20">
            <div className="datalog-chart-config-v20">
              <label>X-axis<select><option>Waktu</option></select></label>
              <label>Metric<select><option>Speed</option></select></label>
            </div>
            <div className="datalog-chart-canvas-v20">
              <svg viewBox="0 0 1000 360" preserveAspectRatio="none">
                <polyline
                  fill="none" stroke="#287c94" strokeWidth="2"
                  points={DATALOG_ROWS.map((r, i) => `${(i / (DATALOG_ROWS.length - 1)) * 1000},${360 - r.speed * 8}`).join(' ')}
                />
              </svg>
            </div>
          </div>
        ) : null}
        {view === 'map' ? (
          <div className="datalog-map-view-v20">
            <aside className="datalog-map-config-v20">
              <strong>Field mapping</strong>
              <label>Latitude<select><option>gpslat</option></select></label>
              <label>Longitude<select><option>gpslong</option></select></label>
              <label>Speed color<select><option>gpsspeed</option></select></label>
              <label className="check"><input type="checkbox" defaultChecked /> Dot trace</label>
            </aside>
          </div>
        ) : null}
      </section>
    </section>
  );
}

const GIS_LAYERS = ['Haul Road', 'Speed Corridor', 'Pit Stop Area', 'District Boundary', 'Loader Estimate'];

function GisSurface() {
  return (
    <>
      <aside style={{ position: 'absolute', zIndex: 5, top: 10, left: 10, width: 270, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
        <strong>Geometry Catalog</strong>
        <p className="small">Operational Geometry</p>
        {GIS_LAYERS.map((name) => (
          <label key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eef1f4', fontSize: 13 }}>
            <span>◉ {name}</span>
            <input type="checkbox" defaultChecked />
          </label>
        ))}
      </aside>
      <aside style={{ position: 'absolute', zIndex: 5, top: 10, right: 58, width: 286, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
        <strong>Inspector</strong>
        <p className="small">Pilih feature untuk melihat detail dan evidence.</p>
        <button type="button" className="btn">Edit Vertex</button>
        <button type="button" className="btn primary" style={{ marginLeft: 6 }}>Save Geometry</button>
      </aside>
    </>
  );
}
