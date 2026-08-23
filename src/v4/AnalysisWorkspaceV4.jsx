import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapWorkspace, { DEFAULT_VIEW_STATE } from '../v3/map/MapWorkspace';
import useBasemapLayers from '../v3/map/layers/useBasemapLayers';
import useTraceLayers from '../v3/map/layers/useTraceLayers';
import usePlaybackLayers from '../v3/map/layers/usePlaybackLayers';
import * as registry from '../v3/state/traceRegistry';
import useHistoryStore from '../v3/state/historyStore';
import { loadTrace, abortLoad } from '../v3/services/traceLoader';

const MODES = [
  ['cycle', 'Cycle Time'], ['speed', 'Speed Analysis'], ['gis', 'GIS Workspace'],
  ['duration', 'Duration In Pit'], ['datalog', 'Data Log Record'],
];
const UNIT_ROWS = [
  { unit: 'DT5204', loader: 'EX3001', ritase: 12, cycle: 28.4, loaded: 2.8, empty: 2.4, speed: 24.6 },
  { unit: 'DT5210', loader: 'EX3001', ritase: 11, cycle: 30.1, loaded: 2.7, empty: 2.5, speed: 23.2 },
  { unit: 'DT5328', loader: 'EX3003', ritase: 10, cycle: 31.7, loaded: 3.2, empty: 2.9, speed: 21.8 },
];
const CARD = { background: '#fff', border: '1px solid #dfe3e8', borderRadius: 10, boxShadow: '0 1px 2px rgba(16,24,40,.05)' };

function localInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AnalysisWorkspaceV4() {
  const mapRef = useRef(null);
  const status = useHistoryStore((s) => s.status);
  const devices = useHistoryStore((s) => s.devices);
  const selection = useHistoryStore((s) => s.selection.deviceIds);
  const setSelection = useHistoryStore((s) => s.setSelection);
  const setContext = useHistoryStore((s) => s.setContext);
  const setTraceInterval = useHistoryStore((s) => s.setTraceInterval);
  const [mode, setMode] = useState('cycle');
  const [draft, setDraft] = useState(() => {
    const end = new Date(); end.setMinutes(0, 0, 0);
    const start = new Date(end.getTime() - 6 * 3600 * 1000);
    return { start: localInput(start), end: localInput(end), loader: '', units: '', interval: '0' };
  });
  const [applied, setApplied] = useState(null);
  const [tool, setTool] = useState('pan');
  const [camera, setCamera] = useState(DEFAULT_VIEW_STATE);
  const [speedState, setSpeedState] = useState('no-layer');
  const [gisEdit, setGisEdit] = useState(false);
  const [durationThreshold, setDurationThreshold] = useState('15');
  const [dataView, setDataView] = useState('table');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [survey, setSurvey] = useState(null);

  const district = 'BRCB';
  const { layers: baseLayers } = useBasemapLayers({ district });
  const traceLayers = useTraceLayers({
    selectedIds: selection,
    onSampleClick: (device) => useHistoryStore.getState().toggleSelection(device.deviceId),
  });
  const playbackLayers = usePlaybackLayers();
  const layers = useMemo(() => [...baseLayers, ...traceLayers, ...playbackLayers], [baseLayers, traceLayers, playbackLayers]);

  useEffect(() => () => abortLoad(), []);

  const applyFilter = useCallback(() => {
    const unitNos = draft.units.split(',').map((item) => item.trim()).filter(Boolean);
    setApplied({ ...draft, unitNos });
    setContext({ district, startDateTime: draft.start, endDateTime: draft.end, unitNos, loaders: draft.loader ? [draft.loader] : [] });
    setTraceInterval(Number(draft.interval));
    if (unitNos.length) loadTrace({ district, unitNos, startDateTime: draft.start, endDateTime: draft.end });
  }, [draft, setContext, setTraceInterval]);

  const handleSurvey = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result || '').split(/\r?\n/).filter(Boolean);
      const sample = lines.slice(0, 5).map((line) => line.trim().split(/[\s,;\t]+/));
      setSurvey({ name: file.name, rows: Math.max(0, lines.length - 1), sample, visible: true });
    };
    reader.readAsText(file);
  }, []);

  const fit = () => mapRef.current?.moveCamera?.({ ...DEFAULT_VIEW_STATE, transitionDuration: 400 });
  const kpis = [
    ['Total Unit', devices.length || '—', 'unit'], ['Total Ritase', devices.length ? devices.length * 11 : '—', 'rit'],
    ['Avg Cycle Time', devices.length ? '29,8' : '—', 'menit'], ['Avg Jarak Muatan', devices.length ? '2,9' : '—', 'km'],
    ['Avg Jarak Kosongan', devices.length ? '2,6' : '—', 'km'], ['Avg Actual Speed', devices.length ? '23,7' : '—', 'km/jam'],
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f4f6f8', color: '#243240', fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif", padding: 10, boxSizing: 'border-box' }}>
      <section style={{ maxWidth: 1800, margin: '0 auto' }}>
        <WorkspaceHeader mode={mode} setMode={setMode} />
        <FilterBar draft={draft} setDraft={setDraft} onApply={applyFilter} status={status} />

        {mode === 'cycle' ? <KpiRow cards={kpis} /> : null}

        <section style={{ ...CARD, height: mode === 'gis' ? 'calc(100vh - 150px)' : 570, minHeight: 480, position: 'relative', overflow: 'hidden' }}>
          <MapWorkspace ref={mapRef} layers={layers} cameraCommand={camera} tool={tool} onZoomChange={() => {}} />
          <MapToolbar tool={tool} setTool={setTool} fit={fit} mapRef={mapRef} />
          {mode === 'cycle' ? <CycleOverlay /> : null}
          {mode === 'speed' ? <SpeedRibbon state={speedState} setState={setSpeedState} onGis={() => setMode('gis')} /> : null}
          {mode === 'gis' ? <GisSurface edit={gisEdit} setEdit={setGisEdit} survey={survey} onSurvey={handleSurvey} /> : null}
          {mode === 'duration' ? <DurationSurface threshold={durationThreshold} setThreshold={setDurationThreshold} onGis={() => setMode('gis')} /> : null}
          {mode === 'datalog' ? <DataLogSurface view={dataView} setView={setDataView} loaded={dataLoaded} setLoaded={setDataLoaded} /> : null}
          <div style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 5, ...CARD, padding: '6px 8px', fontSize: 11, color: '#667085' }}>
            {status.state === 'loading' ? `Memuat jejak · ${status.progress}%` : applied ? `${applied.unitNos.length} unit · filter diterapkan` : 'Pilih unit dan klik Terapkan'}
          </div>
          {survey?.visible ? <div style={{ position: 'absolute', right: 58, bottom: 10, zIndex: 5, ...CARD, padding: '6px 8px', fontSize: 11 }}><b>Data Survei</b> · {survey.name} · {survey.rows.toLocaleString('id-ID')} baris</div> : null}
        </section>

        {mode === 'cycle' ? <CyclePanels selected={selection} setSelected={setSelection} /> : null}
        {mode === 'speed' ? <SpeedPanels state={speedState} /> : null}
        {mode === 'duration' ? <DurationPanels /> : null}
        {mode === 'datalog' ? <DataLogPanels loaded={dataLoaded} /> : null}
      </section>
    </main>
  );
}

function WorkspaceHeader({ mode, setMode }) {
  return <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '4px 2px 10px' }}>
    <div><strong style={{ fontSize: 17 }}>Analysis Workspace</strong><span style={{ marginLeft: 8, fontSize: 12, color: '#667085' }}>V4</span></div>
    <nav aria-label="Mode analisis" style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>{MODES.map(([key, label]) => <button key={key} onClick={() => setMode(key)} style={{ border: 0, borderBottom: `3px solid ${mode === key ? '#1f7a96' : 'transparent'}`, background: 'transparent', padding: '9px 10px 7px', fontWeight: mode === key ? 750 : 600, color: mode === key ? '#1f7a96' : '#667085', whiteSpace: 'nowrap', cursor: 'pointer' }}>{label}</button>)}</nav>
  </header>;
}

function FilterBar({ draft, setDraft, onApply, status }) {
  const busy = ['resolving', 'queued', 'running', 'loading'].includes(status.state);
  const input = { height: 34, border: '1px solid #d0d5dd', borderRadius: 6, padding: '0 9px', font: 'inherit', fontSize: 13, minWidth: 0 };
  return <section style={{ ...CARD, display: 'grid', gridTemplateColumns: 'minmax(210px,1fr) minmax(140px,.65fr) minmax(190px,.8fr) 118px auto', gap: 8, padding: 10, marginBottom: 10, alignItems: 'end' }}>
    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: '#667085' }}>Rentang waktu<input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} style={input} /></label>
    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: '#667085' }}>Sampai<input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} style={input} /></label>
    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: '#667085' }}>Unit<input placeholder="DT5204, DT5210" value={draft.units} onChange={(e) => setDraft({ ...draft, units: e.target.value })} style={input} /></label>
    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: '#667085' }}>Interval<select value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: e.target.value })} style={input}><option value="0">Penuh</option><option value="5">5 detik</option><option value="10">10 detik</option><option value="30">30 detik</option></select></label>
    <button type="button" onClick={onApply} disabled={busy || !draft.units.trim()} style={{ height: 34, border: 0, borderRadius: 6, background: busy ? '#d0d5dd' : '#1f7a96', color: '#fff', padding: '0 14px', fontWeight: 750, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Memuat…' : 'Terapkan'}</button>
  </section>;
}

function KpiRow({ cards }) { return <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 8, marginBottom: 10 }}>{cards.map(([label, value, unit]) => <div key={label} style={{ ...CARD, padding: '10px 11px', minHeight: 64 }}><span style={{ fontSize: 12, color: '#667085' }}>{label}</span><div style={{ marginTop: 5, fontSize: 21, fontWeight: 780 }}>{value} <small style={{ fontSize: 11, fontWeight: 500, color: '#667085' }}>{unit}</small></div></div>)}</section>; }
function MapToolbar({ tool, setTool, fit, mapRef }) { return <div style={{ position: 'absolute', zIndex: 5, top: 10, right: 10, display: 'grid', overflow: 'hidden', ...CARD }}>{[['pan','✋','Geser peta'],['measure','↔','Ukur jarak']].map(([key, glyph, label]) => <button key={key} title={label} onClick={() => setTool(key)} style={{ width: 38, height: 38, border: 0, borderBottom: '1px solid #e4e7ec', background: tool === key ? '#e2f1f5' : '#fff', color: tool === key ? '#1f7a96' : '#53606f', cursor: 'pointer' }}>{glyph}</button>)}<button title="Perbesar" onClick={() => { const v = mapRef.current?.getViewState?.(); if (v) mapRef.current.moveCamera({ ...v, zoom: v.zoom + 1 }); }} style={toolButton}>＋</button><button title="Perkecil" onClick={() => { const v = mapRef.current?.getViewState?.(); if (v) mapRef.current.moveCamera({ ...v, zoom: v.zoom - 1 }); }} style={toolButton}>−</button><button title="Fit data" onClick={fit} style={toolButton}>⌗</button></div>; }
const toolButton = { width: 38, height: 38, border: 0, borderBottom: '1px solid #e4e7ec', background: '#fff', color: '#53606f', cursor: 'pointer' };
function CycleOverlay() { return <aside style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, width: 290, ...CARD, padding: 11, background: 'rgba(255,255,255,.96)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Komposisi Cycle</b><strong style={{ color: '#1f7a96' }}>29,8 menit</strong></div><div style={{ display: 'flex', height: 8, overflow: 'hidden', borderRadius: 99, margin: '10px 0 8px' }}><i style={{ width: '22%', background: '#43a047' }}/><i style={{ width: '31%', background: '#1f7a96' }}/><i style={{ width: '12%', background: '#f59e0b' }}/><i style={{ width: '15%', background: '#8b5cf6' }}/><i style={{ width: '20%', background: '#64748b' }}/></div><span style={{ fontSize: 11, color: '#667085' }}>Loading · Muatan · Stop · Dumping · Kosongan</span></aside>; }
function CyclePanels({ selected, setSelected }) { return <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(290px,.65fr)', gap: 10, marginTop: 10 }}><Panel title="Performance Unit"><table style={table}><thead><tr>{['Unit','Loader','Ritase','Avg Cycle','Muatan','Kosongan','Speed'].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{UNIT_ROWS.map((row) => <tr key={row.unit} onClick={() => setSelected(selected.includes(row.unit) ? selected.filter((x) => x !== row.unit) : [...selected, row.unit])} style={{ background: selected.includes(row.unit) ? '#eaf5f7' : '#fff' }}><td><input type="checkbox" readOnly checked={selected.includes(row.unit)} /> {row.unit}</td><td>{row.loader}</td><td>{row.ritase}</td><td>{row.cycle} min</td><td>{row.loaded} km</td><td>{row.empty} km</td><td>{row.speed} km/j</td></tr>)}</tbody></table></Panel><Panel title="Trend Performance"><div style={{ height: 230, padding: 14, display: 'flex', alignItems: 'end', gap: 10, borderBottom: '1px solid #eef1f4' }}>{[42,70,56,88,62,76,53,79,64,90,72,81].map((n,i) => <i key={i} style={{ flex: 1, height: `${n}%`, minWidth: 5, background: '#82bccd', borderRadius: '3px 3px 0 0' }} />)}</div><p style={{ margin: 0, padding: 10, fontSize: 12, color: '#667085' }}>Ritase · Cycle Time · Jarak · Speed</p></Panel></section>; }
function SpeedRibbon({ state, setState, onGis }) { const active = state === 'active'; return <aside style={{ position: 'absolute', zIndex: 5, top: 10, left: 10, right: 60, ...CARD, padding: 10, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ flex: 1 }}><b>Speed Analysis</b><div style={{ fontSize: 12, color: '#667085', marginTop: 2 }}>{state === 'no-layer' ? 'Belum ada Draft' : active ? 'Active Version v1' : 'Review Draft v1 · 8 segment'}</div></div><button onClick={() => setState('review')} style={secondary}>Auto Suggest</button><button onClick={onGis} disabled={state === 'no-layer'} style={secondary}>Edit in GIS</button><button onClick={() => setState('active')} disabled={state !== 'review'} style={primary}>Apply Draft</button></aside>; }
function SpeedPanels({ state }) { return <section style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 10 }}><Panel title="Segment Review"><table style={table}><thead><tr><th>Road</th><th>Segment</th><th>Actual</th><th>Plan</th><th>Status</th></tr></thead><tbody>{['A-01','A-02','B-01','B-02'].map((x,i) => <tr key={x}><td>Haul Road {i < 2 ? 'Utara' : 'Selatan'}</td><td>{x}</td><td>{22+i} km/j</td><td>30 km/j</td><td><span style={{ color: state === 'no-layer' ? '#98a2b3' : '#b54708' }}>{state === 'no-layer' ? 'Belum dibuat' : 'Review'}</span></td></tr>)}</tbody></table></Panel><Panel title="Draft Health"><p style={muted}>Coverage 82% · Gaps 2 · Perlu review 1</p><button style={secondary}>Review alternatives</button></Panel></section>; }
function GisSurface({ edit, setEdit, survey, onSurvey }) { return <><aside style={{ position: 'absolute', zIndex: 5, top: 10, left: 10, width: 270, ...CARD, padding: 12 }}><b>Geometry Catalog</b><p style={muted}>Operational Geometry</p>{['Haul Road','Speed Corridor','Pit Stop Area','District Boundary','Loader Estimate'].map((x) => <label key={x} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eef1f4', fontSize: 13 }}><span>◉ {x}</span><input type="checkbox" defaultChecked /></label>)}<label style={{ display: 'block', marginTop: 12, fontSize: 12, color: '#475467' }}>Impor Pembanding<input type="file" accept=".txt,.csv,.xlsx" onChange={onSurvey} style={{ display: 'block', marginTop: 5, fontSize: 11 }} /></label></aside><aside style={{ position: 'absolute', zIndex: 5, top: 10, right: 58, width: 286, ...CARD, padding: 12 }}><b>{edit ? 'Edit Geometry' : 'Inspector'}</b><p style={muted}>{edit ? 'Pilih dan geser vertex di peta. Simpan akan mengembalikan perubahan ke Draft.' : 'Pilih feature untuk melihat detail dan evidence.'}</p><button onClick={() => setEdit(!edit)} style={secondary}>{edit ? 'Selesai Edit' : 'Edit Vertex'}</button><button style={{ ...primary, marginLeft: 6 }}>Save Geometry</button>{survey ? <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eef1f4' }}><b style={{ fontSize: 12 }}>Data Survei</b><p style={muted}>{survey.name} · {survey.rows} baris</p><button style={secondary}>Cocokkan Kolom</button></div> : null}</aside></>; }
function DurationSurface({ threshold, setThreshold, onGis }) { return <aside style={{ position: 'absolute', zIndex: 5, inset: 10, pointerEvents: 'none' }}><header style={{ ...CARD, pointerEvents: 'auto', padding: 12, display: 'flex', alignItems: 'center', gap: 14 }}><div><b>Duration In Pit</b><div style={muted}>Polygon Pit Stop · dwell telemetry</div></div>{[['Total dwell','4j 18m'],['Event','14'],['Rata-rata','18m'],['Terpanjang','43m']].map(([a,b]) => <div key={a}><span style={muted}>{a}</span><b style={{ display: 'block' }}>{b}</b></div>)}<label style={{ marginLeft: 'auto', fontSize: 12 }}>Review jika <select value={threshold} onChange={(e) => setThreshold(e.target.value)}><option value="10">&gt; 10 min</option><option value="15">&gt; 15 min</option><option value="20">&gt; 20 min</option></select></label><button onClick={onGis} style={secondary}>Edit Area in GIS</button></header></aside>; }
function DurationPanels() { return <section style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 10 }}><Panel title="Event dwell">{['DT5204 · Pit Selatan · 27m','DT5210 · Pit Selatan · 19m','DT5328 · Pit Timur · 43m'].map((x) => <p key={x} style={{ padding: '10px 12px', margin: 0, borderBottom: '1px solid #eef1f4', fontSize: 13 }}>{x}</p>)}</Panel><Panel title="Okupansi Area"><div style={{ padding: 16 }}><div style={{ height: 115, borderRadius: 6, background: 'repeating-linear-gradient(90deg,#dceff4 0 11%,#fff 11% 13%)' }} /><p style={muted}>Timeline occupancy berdasarkan Unit dan area yang terpilih.</p></div></Panel></section>; }
function DataLogSurface({ view, setView, loaded, setLoaded }) { return <aside style={{ position: 'absolute', zIndex: 5, top: 10, left: 10, right: 60, ...CARD, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}><div><b>Data Log Record</b><div style={muted}>{loaded ? '1.240 baris dimuat' : 'Pilih unit lalu muat data'}</div></div><input placeholder="Cari pada data yang dimuat…" style={{ marginLeft: 'auto', height: 32, border: '1px solid #d0d5dd', borderRadius: 6, padding: '0 8px' }}/>{['table','chart','map'].map((x) => <button key={x} onClick={() => setView(x)} style={{ ...secondary, background: view === x ? '#e2f1f5' : '#fff' }}>{x === 'table' ? 'Tabel' : x === 'chart' ? 'Chart' : 'Map'}</button>)}<button onClick={() => setLoaded(true)} style={primary}>Muat data</button></aside>; }
function DataLogPanels({ loaded }) { return <section style={{ marginTop: 10 }}><Panel title="Data Telemetry"><table style={table}><thead><tr>{['Waktu','Unit','Latitude','Longitude','Speed','Status'].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{loaded ? Array.from({length:8},(_,i) => <tr key={i}><td>08:{String(i*5).padStart(2,'0')}:00</td><td>DT5204</td><td>1.91243</td><td>117.2831</td><td>{18+i} km/j</td><td>RUNNING</td></tr>) : <tr><td colSpan="6" style={{ textAlign: 'center', padding: 28, color: '#667085' }}>Pilih unit lalu tekan Muat data.</td></tr>}</tbody></table></Panel></section>; }
function Panel({ title, children }) { return <section style={{ ...CARD, overflow: 'hidden' }}><header style={{ padding: '10px 12px', borderBottom: '1px solid #e4e7ec', fontSize: 14, fontWeight: 760 }}>{title}</header>{children}</section>; }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 12 }; const primary = { height: 32, border: 0, borderRadius: 6, padding: '0 10px', background: '#1f7a96', color: '#fff', fontWeight: 700, cursor: 'pointer' }; const secondary = { height: 32, border: '1px solid #d0d5dd', borderRadius: 6, padding: '0 9px', background: '#fff', color: '#344054', fontWeight: 650, cursor: 'pointer' }; const muted = { fontSize: 12, color: '#667085', margin: '4px 0' };
