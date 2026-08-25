export default function PerformancePanel() {
  return (
    <>
    <section className="card performance-card">
      <div className="head performance-head">
        <div id="perfTitle" className="title">
          Performance
        </div>
        <div className="performance-actions">
          <span id="gridSelectionCount" className="selection-count">
            0 unit dipilih
          </span>
          <label id="speedGroupWrap" className="speed-group-wrap hidden">
            <span>
              Group by
            </span>
            <select id="speedGroupBy">
              <option value="none">
                None
              </option>
              <option value="route">
                Generated Route
              </option>
              <option value="road">
                Road Name
              </option>
              <option value="status">
                Review Status
              </option>
            </select>
          </label>
          <button id="speedAssignRoadBtn" className="btn hidden" type="button">
            Assign Road Name
          </button>
          <button id="speedMarkReviewedBtn" className="btn hidden" type="button">
            ✓ Mark Reviewed
          </button>
          <button id="speedEditPlanBtn" className="btn hidden" type="button">
            Edit Speed Plan
          </button>
          <button id="speedBoxSelectBtn" className="btn speed-cleanup-btn hidden" type="button">
            Box Select
          </button>
          <button id="speedSuggestSelectionBtn" className="btn hidden" type="button">
            Suggest Selected Area
          </button>
          <button id="speedRemoveDraftBtn" className="btn hidden" type="button">
            Remove from Draft
          </button>
          <button id="speedUndoBtn" className="btn hidden" type="button">
            Undo
          </button>
          <button id="speedOpenGisBtn" className="btn hidden" type="button">
            Open GIS Workspace
          </button>
          <button id="playbackStartBtn" className="btn primary performance-playback-btn hidden" type="button">
            ▶ Playback
          </button>
          <input id="gridSearch" className="grid-search" type="search" placeholder="Cari loader atau unit…" />
        </div>
      </div>
      <div id="performanceGrid"></div>
    </section>
    </>
  );
}
