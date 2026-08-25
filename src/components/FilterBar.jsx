export default function FilterBar() {
  return (
    <>
    <section className="filterbar">
      <button id="timeBtn" className="filterbtn" type="button">
        <span className="label">
          Rentang Waktu
        </span>
        <span id="timeLabel" className="value">
          —
        </span>
        <span className="chev">
          ▾
        </span>
      </button>
      <button id="loaderBtn" className="filterbtn" type="button">
        <span className="label">
          Loader
        </span>
        <span id="loaderLabel" className="value">
          Semua loader
        </span>
        <span className="chev">
          ▾
        </span>
      </button>
      <button id="unitBtn" className="filterbtn" type="button">
        <span className="label">
          Unit
        </span>
        <span id="unitLabel" className="value">
          Semua unit
        </span>
        <span className="chev">
          ▾
        </span>
      </button>
      <button id="intervalBtn" className="filterbtn" type="button">
        <span className="label">
          Interval
        </span>
        <span id="intervalLabel" className="value">
          2 detik
        </span>
        <span className="chev">
          ▾
        </span>
      </button>
      <button id="applyBtn" className="btn primary" type="button" disabled>
        Terapkan
      </button>
      <button id="resetBtn" className="btn" type="button" disabled>
        Reset
      </button>
      <button id="exportBtn" className="btn" type="button" disabled>
        ⇩ Export
      </button>
    </section>
    <div id="timePop" className="popover hidden">
      <div className="segmented">
        <button type="button" className="active" data-time-mode="quick">
          Pintasan
        </button>
        <button type="button" data-time-mode="custom">
          Kustom
        </button>
      </div>
      <div id="timeQuick">
        <div className="pop-title">
          Pilih cepat
        </div>
        <div className="quick-grid">
          <button type="button" data-preset="shift1">
            Shift 1
            <span className="small">
              06–18
            </span>
          </button>
          <button type="button" data-preset="shift2">
            Shift 2
            <span className="small">
              18–06
            </span>
          </button>
          <button type="button" data-preset="today">
            Hari ini
          </button>
          <button type="button" data-preset="full">
            1 hari penuh
          </button>
        </div>
      </div>
      <div id="timeCustom" className="hidden">
        <div className="pop-title">
          Rentang kustom
        </div>
        <div className="range-row">
          <label>
            Mulai
          </label>
          <input id="startDate" className="input" type="date" />
          <select id="startHour" className="input"></select>
        </div>
        <div className="range-row">
          <label>
            Selesai
          </label>
          <input id="endDate" className="input" type="date" />
          <select id="endHour" className="input"></select>
        </div>
        <div id="rangeError" className="small" style={{"color": "#b94f48"}}></div>
      </div>
      <div className="pop-footer">
        <button id="timeCancel" className="btn" type="button">
          Batal
        </button>
        <button id="timeApply" className="btn primary" type="button">
          Pakai
        </button>
      </div>
    </div>
    <div id="loaderPop" className="popover hidden">
      <div className="segmented">
        <button type="button" className="active" data-source="miforce">
          MiForce
        </button>
        <button type="button" data-source="timesheet">
          Timesheet
        </button>
      </div>
      <div className="pop-title">
        Loader
      </div>
      <div className="search-wrap">
        <input id="loaderSearch" className="search-input" type="search" placeholder="Cari loader…" autoComplete="off" />
      </div>
      <div id="loaderList" className="select-scroll">
        <div className="small" style={{"padding": "8px 4px"}}>
          Data loader belum dimuat.
        </div>
      </div>
      <div className="pop-footer">
        <button id="loaderClear" className="btn" type="button">
          Kosongkan
        </button>
        <button id="loaderDone" className="btn primary" type="button">
          Selesai
        </button>
      </div>
    </div>
    <div id="unitPop" className="popover hidden">
      <div className="pop-title" style={{"marginTop": "0"}}>
        Unit
      </div>
      <div className="search-wrap">
        <input id="unitSearch" className="search-input" type="search" placeholder="Cari unit…" autoComplete="off" />
      </div>
      <div id="unitListPop" className="select-scroll">
        <div className="small" style={{"padding": "8px 4px"}}>
          Data unit belum dimuat.
        </div>
      </div>
      <div className="pop-footer">
        <button id="unitClear" className="btn" type="button">
          Kosongkan
        </button>
        <button id="unitDone" className="btn primary" type="button">
          Selesai
        </button>
      </div>
    </div>
    <div id="intervalPop" className="popover hidden" style={{"minWidth": "180px"}}>
      <div id="intervalList"></div>
    </div>
    <div id="exportModal" className="export-modal hidden" role="dialog" aria-modal="true" aria-labelledby="exportTitle">
      <div className="export-backdrop" data-export-close></div>
      <section className="export-dialog">
        <header className="export-head">
          <div>
            <div id="exportTitle" className="export-title">
              Export Cycle Time
            </div>
            <div className="export-subtitle">
              Satu ZIP, mengikuti filter yang sedang aktif.
            </div>
          </div>
          <button id="exportClose" className="export-close" type="button" aria-label="Tutup">
            ✕
          </button>
        </header>
        <div className="export-body">
          <div className="export-context">
            <div className="export-context-row">
              <span>
                Rentang Waktu
              </span>
              <strong id="exportTime">
                —
              </strong>
            </div>
            <div className="export-context-row">
              <span>
                Loader
              </span>
              <strong id="exportLoader">
                —
              </strong>
            </div>
            <div className="export-context-row">
              <span>
                Unit
              </span>
              <strong id="exportUnit">
                —
              </strong>
            </div>
            <div className="export-context-row">
              <span>
                Koordinat
              </span>
              <strong>
                WGS84 / UTM Zone 50N
              </strong>
            </div>
          </div>
          <div className="export-section-label">
            Isi ZIP
          </div>
          <div className="export-file-list">
            <div className="export-file-row">
              <span className="export-file-icon">
                XLSX
              </span>
              <div>
                <strong>
                  cycle-time-trace.xlsx
                </strong>
                <small>
                  Waktu · Loader · Unit · Lat/Lon · UTM X/Y · Speed
                </small>
              </div>
            </div>
            <div className="export-file-row">
              <span className="export-file-icon">
                XLSX
              </span>
              <div>
                <strong>
                  cycle-time-performance.xlsx
                </strong>
                <small>
                  Performance loader/unit + data Trend Performance
                </small>
              </div>
            </div>
          </div>
          <div className="export-note">
            Loader dibiarkan kosong jika assignment tidak tersedia. Trace mengikuti interval dan rentang waktu aktif.
          </div>
          <div id="exportProgress" className="export-progress hidden">
            Menyiapkan file…
          </div>
        </div>
        <footer className="export-footer">
          <button className="btn" type="button" data-export-close>
            Batal
          </button>
          <button id="exportRun" className="btn primary" type="button">
            Export ZIP
          </button>
        </footer>
      </section>
    </div>
    </>
  );
}
