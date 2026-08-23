// Ported from the V23.3 mockup's secondary dialogs (export, speed plan edit,
// speed history, road name assignment, auto-suggest wizard). These are
// static/visual shells: layout and copy match the mockup, but the actions
// they describe (ZIP export via xlsx/jszip, draft version history, speed
// segment persistence) have no backend in this app yet, so primary buttons
// just close the dialog. See the fork report for what's intentionally not
// wired up.

export function ExportModal({ open, onClose, applied }) {
  if (!open) return null;
  return (
    <div className="export-modal" role="dialog" aria-modal="true">
      <div className="export-backdrop" onClick={onClose} />
      <section className="export-dialog">
        <header className="export-head">
          <div>
            <div className="export-title">Export Cycle Time</div>
            <div className="export-subtitle">Satu ZIP, mengikuti filter yang sedang aktif.</div>
          </div>
          <button type="button" className="export-close" aria-label="Tutup" onClick={onClose}>✕</button>
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
              <div><strong>cycle-time-trace.xlsx</strong><small>Waktu · Loader · Unit · Lat/Lon · UTM X/Y · Speed</small></div>
            </div>
            <div className="export-file-row">
              <span className="export-file-icon">XLSX</span>
              <div><strong>cycle-time-performance.xlsx</strong><small>Performance loader/unit + data Trend Performance</small></div>
            </div>
          </div>
          <div className="export-note">Loader dibiarkan kosong jika assignment tidak tersedia. Trace mengikuti interval dan rentang waktu aktif.</div>
        </div>
        <footer className="export-footer">
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button type="button" className="btn primary" onClick={onClose}>Export ZIP</button>
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
