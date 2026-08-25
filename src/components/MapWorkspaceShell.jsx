export default function MapWorkspaceShell() {
  return (
    <>
    <section className="workspace">
      <article className="card map-card">
        <div className="map-shell">
          <div id="deck-map"></div>
          <div id="speedSelectionBox" className="speed-selection-box" aria-hidden="true"></div>
          <div id="measureReadout" className="measure-readout hidden">
            Klik titik awal
          </div>
          <div id="drawReadout" className="measure-readout hidden">
            Klik titik polygon · double click untuk selesai
          </div>
          <div className="map-tools">
            <button id="panTool" className="toolbtn active" type="button" title="Pan / geser peta" aria-label="Pan / geser peta">
              ✋
            </button>
            <button id="drawTool" className="toolbtn" type="button" title="Draw area" aria-label="Draw area">
              ◇
            </button>
            <button id="measureTool" className="toolbtn" type="button" title="Ukur jarak" aria-label="Ukur jarak">
              ↔
            </button>
            <button id="tiltTool" className="toolbtn" type="button" title="Tilt 0°" aria-label="Tilt peta" data-pitch="0°">
              ◩
            </button>
            <span className="tool-sep" aria-hidden="true"></span>
            <button id="zoomIn" className="toolbtn" type="button" title="Perbesar" aria-label="Perbesar">
              ＋
            </button>
            <button id="zoomOut" className="toolbtn" type="button" title="Perkecil" aria-label="Perkecil">
              −
            </button>
            <button id="fitMap" className="toolbtn" type="button" title="Fit / reset extent" aria-label="Fit / reset extent">
              ⌗
            </button>
            <span className="tool-sep" aria-hidden="true"></span>
            <button id="layerBtn" className="toolbtn" type="button" title="Layer" aria-label="Layer">
              ▦
            </button>
          </div>
          <div id="layerPop" className="popover hidden" style={{"position": "absolute", "top": "8px", "right": "52px", "minWidth": "260px"}}>
            <div className="pop-title" style={{"marginTop": "0"}}>
              Layer Peta
            </div>
            <label className="check-row">
              <span className="check-main">
                <input data-layer="trace" type="checkbox" defaultChecked />
                Dot trace historis
              </span>
            </label>
            <label className="check-row">
              <span className="check-main">
                <input data-layer="loading" type="checkbox" defaultChecked />
                PLM Loading
              </span>
            </label>
            <label className="check-row">
              <span className="check-main">
                <input data-layer="boundary" type="checkbox" defaultChecked />
                Boundary distrik
              </span>
            </label>
            <label className="check-row">
              <span className="check-main">
                <input data-layer="roads" type="checkbox" defaultChecked />
                Jalan tambang
              </span>
            </label>
            <label className="check-row">
              <span className="check-main">
                <input data-layer="ortho" type="checkbox" defaultChecked />
                Orthophoto
              </span>
            </label>
          </div>
          <section id="durationWorkspaceV20" className="duration-workspace-v20 hidden" aria-label="Duration In Pit Workspace">
            <header className="duration-topbar-v20">
              <div className="duration-title-v20">
                <strong>
                  Duration In Pit
                </strong>
                <span>
                  Polygon Pit Stop · dwell telemetry
                </span>
              </div>
              <div className="duration-kpis-v20">
                <div>
                  <span>
                    Total dwell
                  </span>
                  <strong id="durationTotalV20">
                    —
                  </strong>
                </div>
                <div>
                  <span>
                    Event
                  </span>
                  <strong id="durationEventCountV20">
                    —
                  </strong>
                </div>
                <div>
                  <span>
                    Rata-rata
                  </span>
                  <strong id="durationAverageV20">
                    —
                  </strong>
                </div>
                <div>
                  <span>
                    Terpanjang
                  </span>
                  <strong id="durationLongestV20">
                    —
                  </strong>
                </div>
                <div className="review">
                  <span>
                    Perlu Review
                  </span>
                  <strong id="durationReviewCountV20">
                    —
                  </strong>
                </div>
              </div>
              <label className="duration-threshold-v20">
                <span>
                  Review jika
                </span>
                <select id="durationThresholdV20" defaultValue="15">
                  <option value="10">
                    > 10 min
                  </option>
                  <option value="15">
                    > 15 min
                  </option>
                  <option value="20">
                    > 20 min
                  </option>
                  <option value="30">
                    > 30 min
                  </option>
                </select>
              </label>
            </header>
            <aside className="duration-sidebar-v20">
              <div className="duration-side-head-v20">
                <strong>
                  Event dwell
                </strong>
                <span id="durationContextV20">
                  Filter aktif
                </span>
              </div>
              <div className="duration-side-tabs-v20">
                <button className="active" type="button" data-duration-filter="all">
                  Semua
                </button>
                <button type="button" data-duration-filter="review">
                  Review
                </button>
              </div>
              <div id="durationEventListV20" className="duration-event-list-v20"></div>
            </aside>
            <section className="duration-timeline-v20">
              <header>
                <strong>
                  Okupansi area
                </strong>
                <span id="durationTimelineMetaV20">
                  —
                </span>
                <small id="durationTimelineRangeV20">
                  —
                </small>
              </header>
              <div id="durationTimelineRowsV20" className="duration-timeline-rows-v20"></div>
            </section>
          </section>
          <section id="dataLogWorkspaceV20" className="datalog-workspace-v20 hidden" aria-label="Data Log Record Workspace">
            <header className="datalog-topbar-v20">
              <div className="datalog-title-v20">
                <strong>
                  Data Log Record
                </strong>
                <span>
                  Raw telemetry · filter V3 aktif
                </span>
              </div>
              <input id="datalogSearchV20" type="search" placeholder="Cari pada data yang dimuat…" />
              <div className="datalog-view-tabs-v20">
                <button className="active" type="button" data-datalog-view="table">
                  Tabel
                </button>
                <button type="button" data-datalog-view="chart">
                  Chart
                </button>
                <button type="button" data-datalog-view="map">
                  Map
                </button>
              </div>
              <button id="datalogColumnsBtnV20" className="btn" type="button">
                Columns
              </button>
              <button id="datalogLoadBtnV20" className="btn primary" type="button">
                Muat data
              </button>
              <span id="datalogRowsMetaV20" className="datalog-rows-meta-v20">
                Belum dimuat
              </span>
            </header>
            <aside className="datalog-tree-v20">
              <div className="datalog-tree-head-v20">
                <strong>
                  Units
                </strong>
                <input id="datalogTreeSearchV20" type="search" placeholder="Cari unit…" />
              </div>
              <div id="datalogTreeBodyV20" className="datalog-tree-body-v20"></div>
            </aside>
            <section id="datalogStageV20" className="datalog-stage-v20 table-view">
              <div id="datalogTableViewV20" className="datalog-table-view-v20">
                <div className="datalog-empty-v20">
                  Pilih unit lalu tekan
                  <strong>
                    Muat data
                  </strong>
                  .
                </div>
              </div>
              <div id="datalogChartViewV20" className="datalog-chart-view-v20 hidden">
                <div className="datalog-chart-config-v20">
                  <label>
                    X-axis
                    <select id="datalogChartXV20"></select>
                  </label>
                  <label>
                    Metric
                    <select id="datalogChartMetricV20"></select>
                  </label>
                </div>
                <div className="datalog-chart-canvas-v20">
                  <svg id="datalogChartSvgV20" viewBox="0 0 1000 360" preserveAspectRatio="none"></svg>
                  <div id="datalogChartLegendV20"></div>
                </div>
              </div>
              <div id="datalogMapViewV20" className="datalog-map-view-v20 hidden">
                <aside className="datalog-map-config-v20">
                  <strong>
                    Field mapping
                  </strong>
                  <label>
                    Latitude
                    <select id="datalogLatV20"></select>
                  </label>
                  <label>
                    Longitude
                    <select id="datalogLonV20"></select>
                  </label>
                  <label>
                    Speed color
                    <select id="datalogSpeedV20"></select>
                  </label>
                  <label className="check">
                    <input id="datalogDotTraceV20" type="checkbox" defaultChecked />
                    Dot trace
                  </label>
                </aside>
              </div>
            </section>
            <aside id="datalogColumnsPanelV20" className="datalog-columns-panel-v20 hidden">
              <header>
                <strong>
                  Columns
                </strong>
                <button id="datalogColumnsCloseV20" type="button">
                  ×
                </button>
              </header>
              <div id="datalogColumnsListV20"></div>
            </aside>
          </section>
          <div className="cycle-overlay">
            <div id="cycleAnalysisRibbon" className="cycle-analysis-ribbon">
              <div className="cycle-ribbon-head">
                <div className="cycle-ribbon-title-wrap">
                  <span className="cycle-ribbon-title">
                    Komposisi Cycle
                  </span>
                  <span id="cycleTotalAvg" className="cycle-ribbon-value">
                    —
                  </span>
                  <span className="cycle-ribbon-meta">
                    teramati per unit
                  </span>
                </div>
              </div>
              <div className="cycle-stack cycle-ribbon-stack">
                <span id="stackLoading" style={{"width": "0", "background": "var(--series2)"}}></span>
                <span id="stackLoaded" style={{"width": "0", "background": "var(--series3)"}}></span>
                <span id="stackStop" style={{"width": "0", "background": "var(--series6)"}}></span>
                <span id="stackDump" style={{"width": "0", "background": "var(--series4)"}}></span>
                <span id="stackEmpty" style={{"width": "0", "background": "var(--series5)"}}></span>
              </div>
              <div className="cycle-ribbon-legend">
                <div className="cycle-ribbon-item">
                  <span className="cycle-mini-label">
                    <i className="cycle-mini-dot" style={{"background": "var(--series2)"}}></i>
                    Loading
                  </span>
                  <strong id="ovLoading" className="cycle-ribbon-time">
                    —
                  </strong>
                  <span id="ovLoadingPct" className="cycle-ribbon-pct">
                    —
                  </span>
                </div>
                <div className="cycle-ribbon-item">
                  <span className="cycle-mini-label">
                    <i className="cycle-mini-dot" style={{"background": "var(--series3)"}}></i>
                    Running muatan
                  </span>
                  <strong id="ovLoaded" className="cycle-ribbon-time">
                    —
                  </strong>
                  <span id="ovLoadedPct" className="cycle-ribbon-pct">
                    —
                  </span>
                </div>
                <div className="cycle-ribbon-item">
                  <span className="cycle-mini-label">
                    <i className="cycle-mini-dot" style={{"background": "var(--series6)"}}></i>
                    Stop muatan
                  </span>
                  <strong id="ovStop" className="cycle-ribbon-time">
                    —
                  </strong>
                  <span id="ovStopPct" className="cycle-ribbon-pct">
                    —
                  </span>
                </div>
                <div className="cycle-ribbon-item">
                  <span className="cycle-mini-label">
                    <i className="cycle-mini-dot" style={{"background": "var(--series4)"}}></i>
                    Dumping
                  </span>
                  <strong id="ovDump" className="cycle-ribbon-time">
                    —
                  </strong>
                  <span id="ovDumpPct" className="cycle-ribbon-pct">
                    —
                  </span>
                </div>
                <div className="cycle-ribbon-item">
                  <span className="cycle-mini-label">
                    <i className="cycle-mini-dot" style={{"background": "var(--series5)"}}></i>
                    Running kosongan
                  </span>
                  <strong id="ovEmpty" className="cycle-ribbon-time">
                    —
                  </strong>
                  <span id="ovEmptyPct" className="cycle-ribbon-pct">
                    —
                  </span>
                </div>
              </div>
            </div>
            <div id="speedAnalysisRibbon" className="speed-analysis-ribbon hidden">
              <div className="speed-ribbon-brand">
                <div>
                  <span className="speed-ribbon-title">
                    Speed Analysis
                  </span>
                  <strong id="speedLayerState">
                    Review Draft v1
                  </strong>
                </div>
                <span id="speedReviewSummary" className="speed-review-summary">
                  Generate Draft dari telemetry aktif
                </span>
              </div>
              <button id="speedDraftHealthBtn" className="speed-draft-health" type="button" disabled title="Draft Health tersedia setelah Auto Suggest">
                <span id="speedCoveredChip">
                  Coverage —
                </span>
                <i></i>
                <span id="speedUncoveredChip">
                  Gaps —
                </span>
                <i></i>
                <span id="speedConflictChip">
                  Review —
                </span>
                <b>
                  ⌄
                </b>
              </button>
              <span id="speedGlobalPlan" className="hidden">
                —
              </span>
              <span id="speedAvgActual" className="hidden">
                —
              </span>
              <span id="speedSegmentCount" className="hidden">
                —
              </span>
              <span id="speedReviewedCount" className="hidden">
                —
              </span>
              <span id="speedRemovedChip" className="hidden">
                Removed 0
              </span>
              <span id="speedOverlapStep" className="hidden"></span>
              <span id="speedGisStep" className="hidden"></span>
              <div className="speed-ribbon-actions">
                <button id="speedReevaluateBtn" className="btn speed-ribbon-btn" type="button">
                  Auto Suggest
                </button>
                <button id="speedOpenGisTopBtn" className="btn primary speed-ribbon-btn" type="button" disabled>
                  Edit in GIS
                </button>
                <button id="speedApplyDraftBtn" className="btn speed-ribbon-btn" type="button" disabled>
                  Apply Draft
                </button>
                <button id="speedHistoryBtn" className="btn speed-ribbon-btn hidden" type="button">
                  History
                </button>
              </div>
            </div>
            <div id="speedCoveragePanel" className="speed-coverage-panel hidden" aria-live="polite">
              <button id="speedOverlapReviewBtn" className="btn speed-overlap-review-btn hidden" type="button">
                Review alternatives
              </button>
            </div>
            <aside id="speedOverlapDrawer" className="speed-overlap-drawer hidden" aria-label="Overlap alternatives">
              <div className="speed-overlap-head">
                <div>
                  <strong>
                    Draft Health
                  </strong>
                  <span id="speedOverlapDrawerMeta">
                    Coverage, gaps, dan geometry review.
                  </span>
                </div>
                <button id="speedOverlapDrawerClose" className="speed-modal-x" type="button">
                  ×
                </button>
              </div>
              <div id="speedOverlapList" className="speed-overlap-list"></div>
            </aside>
            <div id="playbackTelemetry" className="playback-telemetry hidden">
              <div className="playback-mode-badge">
                <span className="playback-live-dot"></span>
                PLAYBACK
              </div>
              <label className="playback-focus-wrap">
                <span>
                  Unit
                </span>
                <select id="playbackFocusUnit" className="playback-focus-select"></select>
              </label>
              <div className="playback-telemetry-divider"></div>
              <div className="playback-stat">
                <span className="playback-stat-label">
                  Loader
                </span>
                <strong id="pbLoader">
                  —
                </strong>
              </div>
              <div className="playback-stat">
                <span className="playback-stat-label">
                  Speed
                </span>
                <strong>
                  <span id="pbSpeed">
                    —
                  </span>
                  <small>
                    km/h
                  </small>
                </strong>
              </div>
              <div className="playback-stat playback-status-stat">
                <span className="playback-stat-label">
                  PLM Status
                </span>
                <strong id="pbStatus">
                  <i id="pbStatusDot"></i>
                  —
                </strong>
              </div>
              <div className="playback-stat">
                <span className="playback-stat-label">
                  Waktu
                </span>
                <strong id="pbTime">
                  —
                </strong>
              </div>
              <div className="playback-stat playback-position-stat">
                <span className="playback-stat-label">
                  Posisi
                </span>
                <strong id="pbPosition">
                  —
                </strong>
              </div>
              <div id="pbPayloadWrap" className="playback-stat hidden">
                <span className="playback-stat-label">
                  Payload
                </span>
                <strong>
                  <span id="pbPayload">
                    —
                  </span>
                  <small>
                    t
                  </small>
                </strong>
              </div>
              <div id="pbFuelWrap" className="playback-stat hidden">
                <span className="playback-stat-label">
                  Fuel
                </span>
                <strong>
                  <span id="pbFuel">
                    —
                  </span>
                  <small>
                    %
                  </small>
                </strong>
              </div>
              <div id="pbHmWrap" className="playback-stat hidden">
                <span className="playback-stat-label">
                  HM
                </span>
                <strong>
                  <span id="pbHm">
                    —
                  </span>
                  <small>
                    jam
                  </small>
                </strong>
              </div>
            </div>
          </div>
          <div id="speedHandoffTray" className="speed-handoff-tray hidden">
            <div className="speed-handoff-summary">
              <strong id="speedHandoffTitle">
                0 segment selected
              </strong>
              <span id="speedHandoffMeta">
                Pilih segment primer untuk geometry handoff.
              </span>
            </div>
            <button id="speedHandoffClear" className="btn" type="button">
              Clear
            </button>
            <button id="speedHandoffOpen" className="btn primary speed-handoff-cta" type="button">
              Open GIS Workspace →
            </button>
          </div>
          <div id="mapStatus" className="map-status">
            z13.0
          </div>
          <div className="context-legend" aria-label="Legenda konteks peta">
            <div className="leg">
              <span className="ctx-boundary"></span>
              Boundary
            </div>
            <div className="leg">
              <span className="ctx-road"></span>
              Jalan Tambang
            </div>
            <div className="leg">
              <span className="ctx-loading"></span>
              PLM Loading
            </div>
            <div className="leg">
              <span className="ctx-loader"></span>
              Estimasi Loader Area
            </div>
          </div>
          <div className="legend">
            <div className="leg">
              <span className="sw" style={{"background": "rgb(59,130,246)"}}></span>
              ≥30 kph
            </div>
            <div className="leg">
              <span className="sw" style={{"background": "rgb(34,197,94)"}}></span>
              25–30 kph
            </div>
            <div className="leg">
              <span className="sw" style={{"background": "rgb(251,191,36)"}}></span>
              20–25 kph
            </div>
            <div className="leg">
              <span className="sw" style={{"background": "rgb(139,69,19)"}}></span>
              10–20 kph
            </div>
            <div className="leg">
              <span className="sw" style={{"background": "rgb(239,68,68)"}}></span>
              &lt;10 kph
            </div>
          </div>
          <div id="playbackBar" className="playback-bar hidden">
            <div className="playback-transport">
              <button id="playbackToggle" className="playback-btn primary" type="button" title="Play / Pause">
                ▶
              </button>
              <button id="playbackStop" className="playback-btn" type="button" title="Stop dan kembali ke awal">
                ■
              </button>
            </div>
            <span id="playbackClock" className="playback-clock">
              --:--:--
            </span>
            <div className="playback-timeline-wrap">
              <input id="playbackTimeline" className="playback-timeline" type="range" min="0" max="1000" defaultValue="0" step="1" aria-label="Timeline playback" />
            </div>
            <div id="playbackSpeeds" className="playback-speeds">
              <button type="button" data-play-speed="1">
                1×
              </button>
              <button type="button" data-play-speed="5">
                5×
              </button>
              <button type="button" data-play-speed="10" className="active">
                10×
              </button>
              <button type="button" data-play-speed="30">
                30×
              </button>
              <button type="button" data-play-speed="60">
                60×
              </button>
              <button type="button" data-play-speed="120">
                120×
              </button>
            </div>
            <span id="playbackUnitCount" className="playback-unit-count">
              0 unit
            </span>
            <button id="playbackClose" className="playback-close" type="button">
              Tutup
            </button>
          </div>
          <div id="loadingMask" className="loading">
            <div className="card loadingbox">
              <div className="title">
                Memuat data Cycle Time
              </div>
              <div id="loadingText" className="sub">
                Membaca fixture BRCB dan layer peta.
              </div>
              <div className="progress">
                <span></span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
    </>
  );
}
