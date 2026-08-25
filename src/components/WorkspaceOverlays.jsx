export default function WorkspaceOverlays() {
  return (
    <>
    <div id="speedPlanModal" className="speed-modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="speedPlanModalTitle">
      <section className="speed-modal">
        <header className="speed-modal-head">
          <div>
            <div id="speedPlanModalTitle" className="title">
              Edit Speed Plan
            </div>
            <div id="speedPlanModalMeta" className="small">
              —
            </div>
          </div>
          <button id="speedPlanModalClose" className="speed-modal-x" type="button">
            ×
          </button>
        </header>
        <div className="speed-modal-body">
          <label className="speed-form-row">
            <span>
              Speed Plan
            </span>
            <div className="speed-plan-input-wrap">
              <input id="speedPlanInput" type="number" min="0" step="1" />
              <span>
                km/h
              </span>
            </div>
          </label>
          <div className="speed-plan-reference">
            <span>
              Suggested
              <strong id="speedPlanSuggested">
                —
              </strong>
            </span>
            <span>
              Avg Actual
              <strong id="speedPlanActual">
                —
              </strong>
            </span>
            <span>
              Global reference
              <strong id="speedPlanGlobalRef">
                —
              </strong>
            </span>
          </div>
          <p className="speed-modal-note">
            Mengubah nilai Speed Plan saja. Perubahan geometry segment tetap dilakukan melalui GIS.
          </p>
        </div>
        <footer className="speed-modal-footer">
          <button id="speedPlanCancel" className="btn" type="button">
            Batal
          </button>
          <button id="speedPlanSave" className="btn primary" type="button">
            Save to Draft
          </button>
        </footer>
      </section>
    </div>
    <div id="speedHistoryModal" className="speed-modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="speedHistoryTitle">
      <section className="speed-modal speed-history-modal">
        <header className="speed-modal-head">
          <div>
            <div id="speedHistoryTitle" className="title">
              Speed Segment Version History
            </div>
            <div className="small">
              Apply tidak menimpa versi lama.
            </div>
          </div>
          <button id="speedHistoryClose" className="speed-modal-x" type="button">
            ×
          </button>
        </header>
        <div id="speedHistoryBody" className="speed-history-body"></div>
        <footer className="speed-modal-footer">
          <button id="speedHistoryDone" className="btn primary" type="button">
            Tutup
          </button>
        </footer>
      </section>
    </div>
    <div id="speedNotice" className="speed-notice hidden"></div>
    <div id="speedRoadModal" className="speed-modal-backdrop hidden" role="dialog" aria-modal="true">
      <section className="speed-modal">
        <header className="speed-modal-head">
          <div>
            <div className="title">
              Assign Road Name
            </div>
            <div id="speedRoadModalMeta" className="small">
              —
            </div>
          </div>
          <button id="speedRoadModalClose" className="speed-modal-x" type="button">
            ×
          </button>
        </header>
        <div className="speed-modal-body">
          <label className="speed-road-field">
            <span>
              Road Name
            </span>
            <input id="speedRoadNameInput" type="text" placeholder="Contoh: Kakaban" />
          </label>
          <p className="speed-modal-note">
            Road Name adalah attribute bisnis. Segment ID tetap stable dan tidak berubah saat nama jalan diubah.
          </p>
        </div>
        <footer className="speed-modal-footer">
          <button id="speedRoadCancel" className="btn" type="button">
            Batal
          </button>
          <button id="speedRoadSave" className="btn primary" type="button">
            Assign to Selected
          </button>
        </footer>
      </section>
    </div>
    <div id="speedGisHandoffModal" className="speed-modal-backdrop gis-workspace-backdrop hidden" role="region" aria-label="GIS Workspace">
      <section className="speed-modal gis-workspace-shell">
        <header className="gis-command-bar">
          <button id="speedGisHandoffClose" className="btn" type="button">
            ← Speed Analysis
          </button>
          <div className="gis-command-title">
            <span id="gisDirtyDot" className="gis-dirty-dot clean" aria-hidden="true"></span>
            <div>
              <strong>
                GIS Workspace · Speed Segment Geometry
              </strong>
              <span id="speedGisHandoffMeta">
                Shared map · geometry tersimpan kembali ke Review Draft
              </span>
            </div>
          </div>
          <div className="gis-command-actions">
            <button id="gisCompareDraftBtn" className="btn" type="button">
              Compare Draft
            </button>
            <button id="speedGisHandoffDone" className="btn" type="button">
              Kembali tanpa Save
            </button>
            <button id="speedGisHandoffSimulate" className="btn primary" type="button">
              Save to Draft
            </button>
          </div>
        </header>
        <aside className="gis-workspace-sidebar" aria-label="Layer GIS">
          <div className="gis-sidebar-head">
            <strong>
              Layers
            </strong>
            <span>
              Draft, route, dan seluruh segment
            </span>
            <input id="gisTreeSearch" className="gis-tree-search" type="search" placeholder="Cari Segment ID atau Road Name…" />
          </div>
          <div className="gis-layer-scroll">
            <span id="gisDraftGroupTitle" className="hidden">
              Review Draft
            </span>
            <span id="gisDraftLayerCount" className="hidden">
              0
            </span>
            <span id="gisSelectedLayerCount" className="hidden">
              0
            </span>
            <span id="gisReviewLayerCount" className="hidden">
              0
            </span>
            <span id="gisValidLayerCount" className="hidden">
              0
            </span>
            <span id="gisAlternativeLayerCount" className="hidden">
              0
            </span>
            <section id="gisLayerTree" className="gis-layer-tree" aria-label="Hierarchy Review Draft"></section>
            <section className="gis-layer-group">
              <div className="gis-layer-group-head">
                <strong>
                  Evidence
                </strong>
                <small>
                  read-only
                </small>
              </div>
              <label className="gis-layer-row-v18">
                <input data-gis-layer="trace" type="checkbox" defaultChecked />
                <i className="gis-layer-symbol trace"></i>
                <span className="gis-layer-name">
                  Speed Telemetry
                </span>
              </label>
              <label className="gis-layer-row-v18">
                <input data-gis-layer="loading" type="checkbox" defaultChecked />
                <i className="gis-layer-symbol loading"></i>
                <span className="gis-layer-name">
                  PLM Loading
                </span>
              </label>
              <label className="gis-layer-row-v18">
                <input data-gis-layer="loader" type="checkbox" defaultChecked />
                <i className="gis-layer-symbol valid"></i>
                <span className="gis-layer-name">
                  Estimasi Loader Area
                </span>
              </label>
            </section>
            <section className="gis-layer-group">
              <div className="gis-layer-group-head">
                <strong>
                  Reference
                </strong>
                <small>
                  read-only
                </small>
              </div>
              <label className="gis-layer-row-v18">
                <input data-gis-layer="roads" type="checkbox" defaultChecked />
                <i className="gis-layer-symbol road"></i>
                <span className="gis-layer-name">
                  Jalan Tambang
                </span>
              </label>
              <label className="gis-layer-row-v18">
                <input data-gis-layer="boundary" type="checkbox" />
                <i className="gis-layer-symbol boundary"></i>
                <span className="gis-layer-name">
                  Boundary Distrik
                </span>
              </label>
              <label className="gis-layer-row-v18">
                <input data-gis-layer="ortho" type="checkbox" />
                <i className="gis-layer-symbol ortho"></i>
                <span className="gis-layer-name">
                  Orthophoto
                </span>
              </label>
            </section>
          </div>
          <div className="gis-sidebar-context">
            <div>
              <span>
                Dataset
              </span>
              <strong>
                Speed Segments
              </strong>
            </div>
            <div>
              <span>
                Draft
              </span>
              <strong id="gisDraftVersion">
                —
              </strong>
            </div>
            <div>
              <span>
                Selection
              </span>
              <strong id="gisSegmentSelection">
                —
              </strong>
            </div>
            <div>
              <span>
                Sumber
              </span>
              <strong>
                Auto Suggest + telemetry
              </strong>
            </div>
          </div>
        </aside>
        <div id="gisMapTools" className="gis-map-tools" aria-label="GIS tools">
          <button id="gisPanTool" className="toolbtn active" type="button" title="Pan / geser peta">
            ✋
          </button>
          <button id="gisSelectTool" className="toolbtn" type="button" title="Select segment">
            ◇
          </button>
          <button id="gisBoxTool" className="toolbtn" type="button" title="Box Select">
            ⛶
          </button>
          <span className="tool-sep" aria-hidden="true"></span>
          <button id="gisVertexTool" className="toolbtn" type="button" title="Edit Vertex">
            ●
          </button>
          <button id="gisAddVertexToolV20" className="toolbtn" type="button" title="Tambah Vertex">
            ＋•
          </button>
          <button id="gisRemoveVertexToolV20" className="toolbtn" type="button" title="Hapus Vertex">
            −•
          </button>
          <button id="gisRedrawTool" className="toolbtn" type="button" title="Redraw Boundary">
            ✎
          </button>
          <button id="gisSplitTool" className="toolbtn" type="button" title="Split Segment">
            ◫
          </button>
          <button id="gisMergeTool" className="toolbtn" type="button" title="Merge Adjacent">
            ⊕
          </button>
          <button id="gisExcludeTool" className="toolbtn" type="button" title="Keluarkan dari Draft">
            ×
          </button>
          <span className="tool-sep" aria-hidden="true"></span>
          <button id="gisMeasureTool" className="toolbtn" type="button" title="Ukur jarak">
            ↔
          </button>
          <button id="gisFitSelectionTool" className="toolbtn" type="button" title="Fit Selection">
            ◎
          </button>
          <button id="gisFitDraftTool" className="toolbtn" type="button" title="Fit Draft">
            ⌗
          </button>
          <button id="gisTiltTool" className="toolbtn" type="button" title="Tilt map">
            ◩
          </button>
          <span className="tool-sep" aria-hidden="true"></span>
          <button id="gisUndoTool" className="toolbtn" type="button" title="Undo" disabled>
            ↶
          </button>
          <button id="gisRedoTool" className="toolbtn" type="button" title="Redo" disabled>
            ↷
          </button>
          <button id="gisResetTool" className="toolbtn" type="button" title="Reset selected geometry">
            ⟲
          </button>
          <span className="tool-sep" aria-hidden="true"></span>
          <button id="gisCompareTool" className="toolbtn" type="button" title="Compare Draft">
            ⇄
          </button>
          <button id="gisZoomInTool" className="toolbtn" type="button" title="Perbesar">
            ＋
          </button>
          <button id="gisZoomOutTool" className="toolbtn" type="button" title="Perkecil">
            −
          </button>
        </div>
        <aside id="gisInspector" className="gis-workspace-inspector hidden" aria-label="Detail segment">
          <div className="gis-inspector-head">
            <div>
              <strong id="gisInspectorTitle">
                Segment
              </strong>
              <span id="gisInspectorSubtitle">
                Geometry dan evidence
              </span>
            </div>
            <button id="gisInspectorClose" className="speed-modal-x" type="button">
              ×
            </button>
          </div>
          <div className="gis-inspector-body">
            <div id="gisInspectorStatus" className="gis-inspector-status">
              Perlu Review
            </div>
            <div className="gis-inspector-kv">
              <span>
                Road Name
              </span>
              <strong id="gisInspectorRoad">
                —
              </strong>
              <span>
                Route
              </span>
              <strong id="gisInspectorRoute">
                —
              </strong>
              <span>
                Panjang
              </span>
              <strong id="gisInspectorLength">
                —
              </strong>
              <span>
                Actual Speed
              </span>
              <strong id="gisInspectorSpeed">
                —
              </strong>
              <span>
                Unit Evidence
              </span>
              <strong id="gisInspectorUnits">
                —
              </strong>
              <span>
                Geometry
              </span>
              <strong id="gisInspectorGeometry">
                —
              </strong>
            </div>
            <div className="gis-evidence-list">
              <strong>
                Selected Geometry
              </strong>
              <div id="gisSelectedChips"></div>
            </div>
            <div className="gis-inspector-actions">
              <button id="gisInspectorEdit" className="btn primary" type="button">
                Edit Geometry
              </button>
              <button id="gisInspectorFit" className="btn" type="button">
                Fit Segment
              </button>
              <button id="gisInspectorReview" className="btn" type="button">
                Mark Reviewed
              </button>
              <button id="gisInspectorExclude" className="btn" type="button">
                Keluarkan
              </button>
            </div>
          </div>
        </aside>
        <section id="gisComparePanel" className="gis-compare-panel hidden" aria-label="Compare Draft">
          <div className="gis-compare-head">
            <div>
              <strong>
                Compare Draft
              </strong>
              <span id="gisCompareMeta">
                Bandingkan hasil Auto Suggest antar-Draft
              </span>
              <div className="gis-compare-selects">
                <select id="gisCompareBase" aria-label="Draft pembanding"></select>
                <span>
                  vs
                </span>
                <select id="gisCompareTarget" aria-label="Draft terbaru"></select>
              </div>
            </div>
            <button id="gisCompareClose" className="speed-modal-x" type="button">
              ×
            </button>
          </div>
          <div id="gisCompareContent"></div>
        </section>
        <div id="gisToolReadout" className="gis-tool-readout hidden">
          Select segment
        </div>
        <footer className="gis-status-bar">
          <span id="gisStatusDot" className="gis-status-dot"></span>
          <strong id="gisStatusText">
            Ready
          </strong>
          <span id="gisStatusSelection">
            0 segment dipilih
          </span>
          <span className="spacer"></span>
          <span>
            WGS84
          </span>
          <span id="gisStatusZoom">
            z13.0
          </span>
        </footer>
      </section>
    </div>
    <div id="speedSuggestModal" className="speed-modal-backdrop hidden" role="dialog" aria-modal="true">
      <section className="speed-modal speed-suggest-modal">
        <header className="speed-modal-head">
          <div>
            <div className="title">
              Auto Suggest Speed Segment
            </div>
            <div className="small">
              Discover seluruh corridor telemetry lalu generate polygon segment untuk semuanya.
            </div>
          </div>
          <button id="speedSuggestClose" className="speed-modal-x" type="button">
            ×
          </button>
        </header>
        <div className="speed-modal-body">
          <div className="suggest-context-grid">
            <div>
              <span>
                Method
              </span>
              <strong>
                Adaptive
              </strong>
              <small>
                Geometry + telemetry pattern
              </small>
            </div>
            <div>
              <span>
                Scope
              </span>
              <strong id="suggestScopeUnits">
                —
              </strong>
              <small id="suggestScopeTime">
                —
              </small>
            </div>
          </div>
          <label className="suggest-length-field">
            <div>
              <strong>
                Default target segment length
              </strong>
              <small>
                Baseline, bukan panjang wajib. Boundary boleh bergeser mengikuti geometry/speed pattern.
              </small>
            </div>
            <div className="suggest-length-input">
              <input id="suggestTargetLength" type="number" min="50" max="300" step="10" defaultValue="100" />
              <span>
                m
              </span>
            </div>
          </label>
          <div className="suggest-flow">
            <span>
              1. Cari representative traversal
            </span>
            <i>
              →
            </i>
            <span>
              2. Detect adaptive boundary
            </span>
            <i>
              →
            </i>
            <span>
              3. Generate polygon corridor
            </span>
            <i>
              →
            </i>
            <span>
              4. Assign telemetry evidence
            </span>
          </div>
          <div className="suggest-note">
            System akan mencari semua movement corridor yang distinct dari telemetry aktif, mengelompokkannya sebagai
          Generated Route, lalu membentuk polygon segment adaptif di masing-masing corridor.
          Speed Plan suggestion di prototype ini masih heuristic: Avg Actual dibulatkan ke bucket 5 km/h.
          </div>
        </div>
        <footer className="speed-modal-footer">
          <button id="speedSuggestCancel" className="btn" type="button">
            Batal
          </button>
          <button id="speedSuggestRun" className="btn primary" type="button">
            Generate Auto Suggest
          </button>
        </footer>
      </section>
    </div>
    <input id="surveyFileInputV23" type="file" accept=".txt,.csv,.xlsx,.xls,text/plain,text/csv" hidden />
    <div id="surveyImportModalV23" className="survey-import-modal-v23 hidden" role="dialog" aria-modal="true" aria-labelledby="surveyImportTitleV23">
      <div className="survey-import-backdrop-v23" data-survey-close-v23></div>
      <section className="survey-import-dialog-v23">
        <header className="survey-import-head-v23">
          <div>
            <strong id="surveyImportTitleV23">
              Impor Jalur Pembanding
            </strong>
            <span>
              Cocokkan kolom, lalu tampilkan data survei bersama Jejak Unit.
            </span>
          </div>
          <button className="survey-import-close-v23" type="button" data-survey-close-v23 aria-label="Tutup">
            ×
          </button>
        </header>
        <div className="survey-import-body-v23">
          <div className="survey-file-context-v23">
            <strong id="surveyFileNameV23">
              —
            </strong>
            <b id="surveyFileMetaV23">
              —
            </b>
            <span id="surveyFilterContextV23">
              Mengikuti filter aktif.
            </span>
          </div>
          <div id="surveyImportErrorV23" className="survey-import-error-v23 hidden"></div>
          <div className="survey-section-title-v23">
            <strong>
              Cocokkan Kolom
            </strong>
            <span>
              Sistem sudah mengisi rekomendasi awal.
            </span>
          </div>
          <div id="surveyMappingV23" className="survey-mapping-v23"></div>
          <div className="survey-section-title-v23">
            <strong>
              Contoh Data
            </strong>
            <span>
              Lima baris pertama
            </span>
          </div>
          <div className="survey-preview-wrap-v23">
            <table id="surveyPreviewV23" className="survey-preview-v23"></table>
          </div>
        </div>
        <footer className="survey-import-foot-v23">
          <span>
            Elevasi disimpan sebagai informasi dan tidak dibandingkan dengan Jejak Unit.
          </span>
          <button className="btn" type="button" data-survey-close-v23>
            Batal
          </button>
          <button id="surveyShowMapV23" className="btn primary" type="button">
            Tampilkan di Peta
          </button>
        </footer>
      </section>
    </div>
    </>
  );
}
