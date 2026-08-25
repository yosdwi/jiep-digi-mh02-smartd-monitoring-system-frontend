import { useRef } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { useWorkspace } from "../../state/WorkspaceContext";
import { fmt, fmtInt } from "../../utils/workspace";
import { readSurveyFile, SURVEY_ROLES, surveyCoordinates } from "../../utils/survey";

function ExportModal() {
  const { state, dispatch, fullRows, performance, displayAppliedRange } = useWorkspace();
  if (!state.exportOpen) return null;
  const run = async () => {
    dispatch({ type: "SET_EXPORT_PROGRESS", value: true });
    try {
      const traceData = fullRows.map((row) => ({
        WITA: new Date(row.time + 8 * 3600000).toISOString().replace("T", " ").slice(0, 19),
        Loader: "",
        Unit: row.unitNo,
        Latitude: row.lat,
        Longitude: row.lon,
        Speed_kmh: row.speed,
      }));
      const perfData = performance.map((row) => ({ Loader: row.loader, Unit: row.unitNo, Ritase: row.ritase, Avg_Cycle_Time_min: row.cycle, Avg_Jarak_Muatan_km: row.loadedDistance, Avg_Jarak_Kosongan_km: row.emptyDistance, Avg_Actual_Speed_kmh: row.speed }));
      const traceBook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(traceBook, XLSX.utils.json_to_sheet(traceData), "Trace");
      const perfBook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(perfBook, XLSX.utils.json_to_sheet(perfData), "Performance");
      const zip = new JSZip();
      zip.file("cycle-time-trace.xlsx", XLSX.write(traceBook, { bookType: "xlsx", type: "array" }));
      zip.file("cycle-time-performance.xlsx", XLSX.write(perfBook, { bookType: "xlsx", type: "array" }));
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "cycle-time-export.zip"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      dispatch({ type: "SET_EXPORT_OPEN", value: false });
    } finally { dispatch({ type: "SET_EXPORT_PROGRESS", value: false }); }
  };
  return (
    <div className="export-modal" role="dialog" aria-modal="true">
      <div className="export-backdrop" onClick={() => dispatch({ type: "SET_EXPORT_OPEN", value: false })}></div>
      <section className="export-dialog">
        <header className="export-head"><div><div className="export-title">Export Cycle Time</div><div className="export-subtitle">Satu ZIP, mengikuti filter yang sedang aktif.</div></div><button className="export-close" type="button" onClick={() => dispatch({ type: "SET_EXPORT_OPEN", value: false })}>✕</button></header>
        <div className="export-body">
          <div className="export-context"><div className="export-context-row"><span>Rentang Waktu</span><strong>{displayAppliedRange}</strong></div><div className="export-context-row"><span>Loader</span><strong>{state.appliedFilters.loaders.length ? `${state.appliedFilters.loaders.length} loader` : "Semua loader"}</strong></div><div className="export-context-row"><span>Unit</span><strong>{state.appliedFilters.units.length} unit</strong></div><div className="export-context-row"><span>Koordinat</span><strong>WGS84 / UTM Zone 50N</strong></div></div>
          <div className="export-section-label">Isi ZIP</div>
          <div className="export-file-list"><div className="export-file-row"><span className="export-file-icon">XLSX</span><div><strong>cycle-time-trace.xlsx</strong><small>Waktu · Loader · Unit · Lat/Lon · UTM X/Y · Speed</small></div></div><div className="export-file-row"><span className="export-file-icon">XLSX</span><div><strong>cycle-time-performance.xlsx</strong><small>Performance loader/unit + data Trend Performance</small></div></div></div>
          <div className="export-note">Loader dibiarkan kosong jika assignment tidak tersedia. Trace mengikuti interval dan rentang waktu aktif.</div>
          {state.exportProgress && <div className="export-progress">Menyiapkan file…</div>}
        </div>
        <footer className="export-footer"><button className="btn" type="button" onClick={() => dispatch({ type: "SET_EXPORT_OPEN", value: false })}>Batal</button><button className="btn primary" type="button" onClick={run} disabled={state.exportProgress}>Export ZIP</button></footer>
      </section>
    </div>
  );
}

function SpeedPlanModal() {
  const { state, dispatch } = useWorkspace();
  if (state.speed.modal !== "plan") return null;
  const selected = state.speed.draft?.segments.find((segment) => state.speed.selectedSegments.includes(segment.id));
  return <div className="speed-modal-backdrop" role="dialog" aria-modal="true"><section className="speed-modal"><header className="speed-modal-head"><div><div className="title">Edit Speed Plan</div><div className="small">{selected?.id ?? "Selected segment"}</div></div><button className="speed-modal-x" type="button" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: null } })}>×</button></header><div className="speed-modal-body"><label className="speed-form-row"><span>Speed Plan</span><div className="speed-plan-input-wrap"><input type="number" min="0" step="1" value={state.speed.editPlanValue} onChange={(event) => dispatch({ type: "PATCH_SPEED", patch: { editPlanValue: Number(event.target.value) } })}/><span>km/h</span></div></label><div className="speed-plan-reference"><span>Suggested <strong>{selected ? `${fmt(selected.suggested,0)} km/h` : "—"}</strong></span><span>Avg Actual <strong>{selected ? `${fmt(selected.avgActual,1)} km/h` : "—"}</strong></span><span>Global reference <strong>30 km/h</strong></span></div><p className="speed-modal-note">Mengubah nilai Speed Plan saja. Perubahan geometry segment tetap dilakukan melalui GIS.</p></div><footer className="speed-modal-footer"><button className="btn" type="button" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: null } })}>Batal</button><button className="btn primary" type="button" onClick={() => { dispatch({ type: "UPDATE_SPEED_SEGMENTS", patch: () => ({ plan: state.speed.editPlanValue, status: "Speed Review" }) }); dispatch({ type: "PATCH_SPEED", patch: { modal: null } }); }}>Save to Draft</button></footer></section></div>;
}

function RoadModal() {
  const { state, dispatch } = useWorkspace();
  if (state.speed.modal !== "road") return null;
  return <div className="speed-modal-backdrop" role="dialog" aria-modal="true"><section className="speed-modal"><header className="speed-modal-head"><div><div className="title">Assign Road Name</div><div className="small">{state.speed.selectedSegments.length} segment dipilih</div></div><button className="speed-modal-x" type="button" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: null } })}>×</button></header><div className="speed-modal-body"><label className="speed-road-field"><span>Road Name</span><input type="text" placeholder="Contoh: Kakaban" value={state.speed.roadName} onChange={(event) => dispatch({ type: "PATCH_SPEED", patch: { roadName: event.target.value } })}/></label><p className="speed-modal-note">Road Name adalah attribute bisnis. Segment ID tetap stable dan tidak berubah saat nama jalan diubah.</p></div><footer className="speed-modal-footer"><button className="btn" type="button" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: null } })}>Batal</button><button className="btn primary" type="button" disabled={!state.speed.roadName.trim()} onClick={() => { dispatch({ type: "UPDATE_SPEED_SEGMENTS", patch: () => ({ roadName: state.speed.roadName.trim() }) }); dispatch({ type: "PATCH_SPEED", patch: { modal: null, roadName: "" } }); }}>Assign to Selected</button></footer></section></div>;
}

function SuggestModal() {
  const { state, dispatch, generateDraft, displayAppliedRange } = useWorkspace();
  if (state.speed.modal !== "suggest") return null;
  return <div className="speed-modal-backdrop" role="dialog" aria-modal="true"><section className="speed-modal speed-suggest-modal"><header className="speed-modal-head"><div><div className="title">Auto Suggest Speed Segment</div><div className="small">Discover seluruh corridor telemetry lalu generate polygon segment untuk semuanya.</div></div><button className="speed-modal-x" type="button" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: null } })}>×</button></header><div className="speed-modal-body"><div className="suggest-context-grid"><div><span>Method</span><strong>Adaptive</strong><small>Geometry + telemetry pattern</small></div><div><span>Scope</span><strong>{state.appliedFilters.units.length} unit</strong><small>{displayAppliedRange}</small></div></div><label className="suggest-length-field"><div><strong>Default target segment length</strong><small>Baseline, bukan panjang wajib. Boundary boleh bergeser mengikuti geometry/speed pattern.</small></div><div className="suggest-length-input"><input type="number" min="50" max="300" step="10" value={state.speed.targetLength} onChange={(event) => dispatch({ type: "PATCH_SPEED", patch: { targetLength: Number(event.target.value) } })}/><span>m</span></div></label><div className="suggest-flow"><span>1. Cari representative traversal</span><i>→</i><span>2. Detect adaptive boundary</span><i>→</i><span>3. Generate polygon corridor</span><i>→</i><span>4. Assign telemetry evidence</span></div><div className="suggest-note">System akan mencari semua movement corridor yang distinct dari telemetry aktif, mengelompokkannya sebagai Generated Route, lalu membentuk polygon segment adaptif di masing-masing corridor. Speed Plan suggestion di baseline ini masih heuristic.</div></div><footer className="speed-modal-footer"><button className="btn" type="button" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: null } })}>Batal</button><button className="btn primary" type="button" onClick={generateDraft}>Generate Auto Suggest</button></footer></section></div>;
}

function HistoryModal() {
  const { state, dispatch } = useWorkspace();
  if (state.speed.modal !== "history") return null;
  return <div className="speed-modal-backdrop" role="dialog" aria-modal="true"><section className="speed-modal speed-history-modal"><header className="speed-modal-head"><div><div className="title">Speed Segment Version History</div><div className="small">Apply tidak menimpa versi lama.</div></div><button className="speed-modal-x" type="button" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: null } })}>×</button></header><div className="speed-history-body">{state.speed.history.length ? state.speed.history.map((item, index) => <div className="speed-history-item" key={`${item.version}-${index}`}><div><div className="speed-history-version">{item.version}</div><div className="speed-history-meta">{new Date(item.appliedAt).toLocaleString("id-ID")}</div></div><div className="speed-history-change">{item.segments.length} segment · target {item.targetLength} m</div>{index === 0 && <span className="speed-history-active">ACTIVE</span>}</div>) : <div className="small">Belum ada versi Active.</div>}</div><footer className="speed-modal-footer"><button className="btn primary" type="button" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: null } })}>Tutup</button></footer></section></div>;
}

function SurveyModal() {
  const { state, dispatch, displayAppliedRange } = useWorkspace();
  const inputRef = useRef(null);
  const survey = state.survey;
  const valid = survey.roles.includes("x") && survey.roles.includes("y");
  const chooseFile = async (file) => {
    if (!file) return;
    try { const parsed = await readSurveyFile(file); dispatch({ type: "PATCH_SURVEY", patch: { ...parsed, modalOpen: true, error: "" } }); }
    catch (error) { dispatch({ type: "PATCH_SURVEY", patch: { modalOpen: true, fileName: file.name, error: error.message, headers: [], rows: [], roles: [] } }); }
  };
  const setRole = (index, role) => {
    const roles = survey.roles.map((item, itemIndex) => role !== "ignore" && item === role && itemIndex !== index ? "ignore" : item); roles[index] = role; dispatch({ type: "PATCH_SURVEY", patch: { roles } });
  };
  const showOnMap = () => {
    const coordinates = surveyCoordinates(survey.rows, survey.roles); if (coordinates.length < 2) return dispatch({ type: "PATCH_SURVEY", patch: { error: "Data posisi yang valid belum cukup untuk ditampilkan." } });
    dispatch({ type: "PATCH_SURVEY", patch: { coordinates, visible: true, modalOpen: false, error: "" } });
  };
  return <><input ref={inputRef} type="file" accept=".txt,.csv,.tsv,.xlsx,.xls" hidden onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} />{survey.modalOpen && <div className="survey-import-modal-v23"><div className="survey-import-backdrop-v23" onClick={() => dispatch({ type: "PATCH_SURVEY", patch: { modalOpen: false } })}></div><section className="survey-import-dialog-v23"><header className="survey-import-head-v23"><div><strong>Impor Data Survei Pembanding</strong><span>TXT, CSV, atau Excel · mapping kolom sebelum ditampilkan pada shared map</span></div><button className="survey-import-close-v23" type="button" onClick={() => dispatch({ type: "PATCH_SURVEY", patch: { modalOpen: false } })}>×</button></header><div className="survey-import-body-v23"><div className="survey-file-context-v23"><strong>{survey.fileName || "Belum ada file"}</strong><b>{survey.rows.length ? `${fmtInt(survey.rows.length)} baris` : "Pilih file"}</b><span>Jejak Unit: {state.appliedFilters.units.length} unit · {displayAppliedRange}</span></div>{survey.error && <div className="survey-import-error-v23">{survey.error}</div>}<div className="survey-section-title-v23"><strong>Mapping kolom</strong><span>Pilih satu X dan satu Y</span></div><div className="survey-mapping-v23">{survey.headers.map((header, index) => <label className="survey-mapping-row-v23" key={`${header}-${index}`}><strong>{header}</strong><span title={survey.rows.slice(0,3).map((row)=>row[index]).join(' · ')}>{survey.rows.slice(0,3).map((row)=>row[index]).join(' · ') || '—'}</span><select value={survey.roles[index] || "ignore"} onChange={(event) => setRole(index, event.target.value)}>{SURVEY_ROLES.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>)}</div><div className="survey-section-title-v23"><strong>Preview</strong><span>5 baris pertama</span></div><div className="survey-preview-wrap-v23"><table className="survey-preview-v23"><thead><tr>{survey.headers.map((header)=><th key={header}>{header}</th>)}</tr></thead><tbody>{survey.rows.slice(0,5).map((row,rowIndex)=><tr key={rowIndex}>{survey.headers.map((_,index)=><td key={index}>{String(row[index]??'')}</td>)}</tr>)}</tbody></table></div></div><footer className="survey-import-foot-v23"><span>Data survei hanya menjadi layer pembanding dan tidak mengubah telemetry.</span><button className="btn" type="button" onClick={() => inputRef.current?.click()}>Pilih File Lain</button><button className="btn primary" type="button" disabled={!valid} onClick={showOnMap}>Tampilkan di Peta</button></footer></section></div>}<SurveyFileTrigger inputRef={inputRef} /></>;
}

function SurveyFileTrigger({ inputRef }) {
  useSurveyInputRegistry(inputRef);
  return null;
}

let currentSurveyInput = null;
export function openSurveyFilePicker() { currentSurveyInput?.current?.click(); }
function useSurveyInputRegistry(inputRef) { currentSurveyInput = inputRef; }

export default function WorkspaceModals() {
  const { state, dispatch } = useWorkspace();
  return <><ExportModal/><SpeedPlanModal/><RoadModal/><SuggestModal/><HistoryModal/><SurveyModal/>{state.speed.notice && <div className="speed-notice" onClick={() => dispatch({ type: "PATCH_SPEED", patch: { notice: "" } })}>{state.speed.notice}</div>}</>;
}
