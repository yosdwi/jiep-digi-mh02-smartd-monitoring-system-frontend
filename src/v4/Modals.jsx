// Ported from the V23.3 mockup's secondary dialogs (export, speed plan edit,
// speed history, road name assignment, auto-suggest wizard).
//
// ExportModal is real: it reuses the SAME export-job backend the v3 History
// Workspace's ExportDialog already calls (src/v3/services/exportApi.js →
// /Monitoring/api/ExportV3/*) for the trace file, builds the performance
// summary client-side with the real `xlsx` package from the same rows the
// on-screen Performance grid shows, and bundles both into one .zip with
// `jszip` — matching the mockup's "one ZIP" framing without inventing a
// bundling endpoint the backend doesn't have.
//
// The other four dialogs (speed plan, speed history, road name, auto
// suggest) describe backend actions monitor-system has no endpoint for yet
// (persisting a speed plan value, versioned draft history, road-name
// assignment) — those stay visual shells; each has a TODO(backend) at its
// primary action.
import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { createExport, waitForExport, cancelExport, getExportOptions } from '../v3/services/exportApi';
import { buildPerformanceRows } from './performanceRows';

function buildPerformanceWorkbookBlob(devices) {
  const rows = buildPerformanceRows(devices).map((r) => ({
    Unit: r.unit,
    Loader: r.loader,
    Ritase: r.ritase,
    'Avg Cycle (min)': r.cycle,
    'Jarak Muatan (km)': r.loaded,
    'Jarak Kosongan (km)': r.empty,
    'Actual Speed (km/j)': r.speed,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Performance');
  const arrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function ExportModal({ open, onClose, applied, devices }) {
  const [phase, setPhase] = useState('idle'); // idle | preparing | zipping | ready | error
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [zipUrl, setZipUrl] = useState(null);

  const reset = useCallback(() => {
    setPhase('idle'); setProgress(null); setError(null); setJobId(null);
    if (zipUrl) URL.revokeObjectURL(zipUrl);
    setZipUrl(null);
  }, [zipUrl]);

  const close = useCallback(() => {
    if (jobId) cancelExport(jobId);
    reset();
    onClose?.();
  }, [jobId, reset, onClose]);

  const start = useCallback(async () => {
    if (!applied?.units?.length) return;
    setPhase('preparing');
    setError(null);
    try {
      // Same catalogue the v3 ExportDialog reads from — never hardcode column
      // keys here, the service is the source of truth for what it accepts.
      const options = await getExportOptions();
      const defaultColumns = options.columns.filter((c) => c.defaultOn).map((c) => c.key);
      const format = options.formats.some((f) => f.key === 'xlsx') ? 'xlsx' : options.formats[0]?.key;

      const traceJob = await createExport({
        district: 'BRCB',
        unitNos: applied.units,
        startDateTime: applied.start,
        endDateTime: applied.end,
        intervalSeconds: Number(applied.interval) || 0,
        columns: defaultColumns,
        coordinates: 'utm',
        format,
        fileName: 'cycle-time-trace',
      });
      setJobId(traceJob.id);
      const finished = await waitForExport(traceJob.id, { onProgress: setProgress });
      if (finished.state !== 'ready') {
        setError(finished.message || 'Export trace gagal.');
        setPhase('error');
        return;
      }

      setPhase('zipping');
      const traceRes = await fetch(`/Monitoring${finished.downloadUrl}`);
      if (!traceRes.ok) throw new Error(`Gagal mengunduh trace (HTTP ${traceRes.status})`);
      const traceBlob = await traceRes.blob();
      const perfBlob = buildPerformanceWorkbookBlob(devices);

      const zip = new JSZip();
      zip.file(finished.fileName || 'cycle-time-trace.xlsx', traceBlob);
      zip.file('cycle-time-performance.xlsx', perfBlob);
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      setZipUrl(URL.createObjectURL(zipBlob));
      setPhase('ready');
    } catch (err) {
      setError(err.message || String(err));
      setPhase('error');
    }
  }, [applied, devices]);

  const download = useCallback(() => {
    if (!zipUrl) return;
    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = `cycle-time-export-${(applied?.start || '').slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [zipUrl, applied]);

  if (!open) return null;
  const busy = phase === 'preparing' || phase === 'zipping';
  return (
    <div className="export-modal" role="dialog" aria-modal="true">
      <div className="export-backdrop" onClick={close} />
      <section className="export-dialog">
        <header className="export-head">
          <div>
            <div className="export-title">Export Cycle Time</div>
            <div className="export-subtitle">Satu ZIP, mengikuti filter yang sedang aktif.</div>
          </div>
          <button type="button" className="export-close" aria-label="Tutup" onClick={close}>✕</button>
        </header>
        <div className="export-body">
          <div className="export-context">
            <div className="export-context-row"><span>Rentang Waktu</span><strong>{applied ? `${applied.start} → ${applied.end}` : '—'}</strong></div>
            <div className="export-context-row"><span>Loader</span><strong>{applied?.loaders?.length ? applied.loaders.join(', ') : '—'}</strong></div>
            <div className="export-context-row"><span>Unit</span><strong>{applied?.units?.length ? applied.units.join(', ') : '—'}</strong></div>
            <div className="export-context-row"><span>Koordinat</span><strong>WGS84 / UTM Zone 50N</strong></div>
          </div>
          <div className="export-section-label">Isi ZIP</div>
          <div className="export-file-list">
            <div className="export-file-row">
              <span className="export-file-icon">XLSX</span>
              <div><strong>cycle-time-trace.xlsx</strong><small>Waktu · Loader · Unit · Lat/Lon · UTM X/Y · Speed — dari export job monitor-system</small></div>
            </div>
            <div className="export-file-row">
              <span className="export-file-icon">XLSX</span>
              <div><strong>cycle-time-performance.xlsx</strong><small>Performance loader/unit dari grid yang sedang ditampilkan</small></div>
            </div>
          </div>
          {phase === 'preparing' || phase === 'zipping' ? (
            <div className="export-note">
              {phase === 'preparing'
                ? `Menyiapkan trace… ${progress?.rowsWritten ? `${progress.rowsWritten} baris` : ''}`
                : 'Membuat berkas performance dan menyusun ZIP…'}
            </div>
          ) : error ? (
            <div className="export-note" style={{ color: 'var(--danger, #b42318)' }}>{error}</div>
          ) : (
            <div className="export-note">Loader dibiarkan kosong jika assignment tidak tersedia. Trace mengikuti interval dan rentang waktu aktif.</div>
          )}
        </div>
        <footer className="export-footer">
          <button type="button" className="btn" onClick={close}>{phase === 'ready' ? 'Tutup' : 'Batal'}</button>
          {phase === 'ready' ? (
            <button type="button" className="btn primary" onClick={download}>Unduh ZIP</button>
          ) : (
            <button type="button" className="btn primary" disabled={busy || !applied?.units?.length} onClick={start}>
              {busy ? 'Menyiapkan…' : 'Export ZIP'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function SpeedModalShell({ open, onClose, title, meta, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="speed-modal-backdrop" role="dialog" aria-modal="true">
      <section className={`speed-modal${wide ? ' speed-history-modal' : ''}`}>
        <header className="speed-modal-head">
          <div><div className="title">{title}</div>{meta ? <div className="small">{meta}</div> : null}</div>
          <button type="button" className="speed-modal-x" onClick={onClose}>×</button>
        </header>
        {children}
        {footer}
      </section>
    </div>
  );
}

export function SpeedPlanModal({ open, onClose }) {
  return (
    <SpeedModalShell
      open={open}
      onClose={onClose}
      title="Edit Speed Plan"
      meta="Segment A-01 · Haul Road Utara"
      footer={(
        <footer className="speed-modal-footer">
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          {/* TODO(backend): persist the Speed Plan value once monitor-system
              exposes a speed-segment-plan endpoint. Closes without saving. */}
          <button type="button" className="btn primary" onClick={onClose}>Save to Draft</button>
        </footer>
      )}
    >
      <div className="speed-modal-body">
        <label className="speed-form-row">
          <span>Speed Plan</span>
          <div className="speed-plan-input-wrap">
            <input type="number" min="0" step="1" defaultValue={30} />
            <span>km/h</span>
          </div>
        </label>
        <div className="speed-plan-reference">
          <span>Suggested <strong>28 km/h</strong></span>
          <span>Avg Actual <strong>24 km/h</strong></span>
          <span>Global reference <strong>30 km/h</strong></span>
        </div>
        <p className="speed-modal-note">Mengubah nilai Speed Plan saja. Perubahan geometry segment tetap dilakukan melalui GIS.</p>
      </div>
    </SpeedModalShell>
  );
}

// TODO(backend): the rows below are static demo data — monitor-system has no
// speed-segment version-history endpoint yet to list real draft versions.
export function SpeedHistoryModal({ open, onClose }) {
  return (
    <SpeedModalShell open={open} onClose={onClose} title="Speed Segment Version History" meta="Apply tidak menimpa versi lama." wide footer={(
      <footer className="speed-modal-footer">
        <button type="button" className="btn primary" onClick={onClose}>Tutup</button>
      </footer>
    )}
    >
      <div className="speed-history-body">
        {['v3 · Active', 'v2 · Superseded', 'v1 · Superseded'].map((label) => (
          <div key={label} style={{ padding: '10px 14px', borderBottom: '1px solid #eef1f4', fontSize: 13 }}>{label}</div>
        ))}
      </div>
    </SpeedModalShell>
  );
}

export function SpeedRoadModal({ open, onClose }) {
  return (
    <SpeedModalShell open={open} onClose={onClose} title="Assign Road Name" meta="2 segment dipilih" footer={(
      <footer className="speed-modal-footer">
        <button type="button" className="btn" onClick={onClose}>Batal</button>
        {/* TODO(backend): persist the road-name assignment once
            monitor-system exposes an endpoint for it. Closes without saving. */}
        <button type="button" className="btn primary" onClick={onClose}>Assign to Selected</button>
      </footer>
    )}
    >
      <div className="speed-modal-body">
        <label className="speed-road-field">
          <span>Road Name</span>
          <input type="text" placeholder="Contoh: Kakaban" />
        </label>
        <p className="speed-modal-note">Road Name adalah attribute bisnis. Segment ID tetap stable dan tidak berubah saat nama jalan diubah.</p>
      </div>
    </SpeedModalShell>
  );
}

export function SpeedSuggestModal({ open, onClose, onRun }) {
  return (
    <SpeedModalShell open={open} onClose={onClose} title="Auto Suggest Speed Segment" meta="Discover seluruh corridor telemetry lalu generate polygon segment untuk semuanya." footer={(
      <footer className="speed-modal-footer">
        <button type="button" className="btn" onClick={onClose}>Batal</button>
        <button type="button" className="btn primary" onClick={() => { onRun?.(); onClose(); }}>Generate Auto Suggest</button>
      </footer>
    )}
    >
      <div className="speed-modal-body">
        <div className="suggest-context-grid">
          <div><span>Method</span><strong>Adaptive</strong><small>Geometry + telemetry pattern</small></div>
          <div><span>Scope</span><strong>Unit terpilih</strong><small>Rentang waktu aktif</small></div>
        </div>
        <label className="suggest-length-field">
          <div>
            <strong>Default target segment length</strong>
            <small>Baseline, bukan panjang wajib. Boundary boleh bergeser mengikuti geometry/speed pattern.</small>
          </div>
          <div className="suggest-length-input">
            <input type="number" min="50" max="300" step="10" defaultValue={100} />
            <span>m</span>
          </div>
        </label>
        <div className="suggest-flow">
          <span>1. Cari representative traversal</span><i>→</i>
          <span>2. Detect adaptive boundary</span><i>→</i>
          <span>3. Generate polygon corridor</span><i>→</i>
          <span>4. Assign telemetry evidence</span>
        </div>
        <div className="suggest-note">
          System akan mencari semua movement corridor yang distinct dari telemetry aktif, mengelompokkannya sebagai
          Generated Route, lalu membentuk polygon segment adaptif di masing-masing corridor.
        </div>
      </div>
    </SpeedModalShell>
  );
}
