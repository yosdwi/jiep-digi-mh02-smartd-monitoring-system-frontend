import PerformanceGrid from "./PerformanceGrid";
import { useWorkspace } from "../../state/WorkspaceContext";

export default function PerformancePanel() {
  const { state, dispatch } = useWorkspace();
  const speed = state.mode === "speed";
  const selected = speed ? state.speed.selectedSegments : state.selectedRows;
  const selectedCount = selected.length;
  return (
    <section className="card performance-card">
      <div className="head performance-head">
        <div className="title">{speed ? "Segment Performance" : "Performance"}</div>
        <div className="performance-actions">
          <span className="selection-count">{selectedCount} {speed ? "segment" : "unit"} dipilih</span>
          {speed && (
            <>
              <label className="speed-group-wrap"><span>Group by</span><select value={state.speed.groupBy} onChange={(event) => dispatch({ type: "PATCH_SPEED", patch: { groupBy: event.target.value } })}><option value="none">None</option><option value="route">Generated Route</option><option value="road">Road Name</option><option value="status">Review Status</option></select></label>
              <button className="btn" type="button" disabled={!selectedCount} onClick={() => dispatch({ type: "PATCH_SPEED", patch: { modal: "road", roadName: "" } })}>Assign Road Name</button>
              <button className="btn" type="button" disabled={!selectedCount} onClick={() => dispatch({ type: "UPDATE_SPEED_SEGMENTS", patch: () => ({ reviewed: true, status: "Reviewed" }) })}>✓ Mark Reviewed</button>
              <button className="btn" type="button" disabled={!selectedCount} onClick={() => {
                const segment = state.speed.draft?.segments.find((item) => selected.includes(item.id));
                dispatch({ type: "PATCH_SPEED", patch: { modal: "plan", editPlanValue: segment?.plan ?? 0 } });
              }}>Edit Speed Plan</button>
              <button className="btn speed-cleanup-btn" type="button">Box Select</button>
              <button className="btn" type="button" disabled={!selectedCount}>Suggest Selected Area</button>
              <button className="btn" type="button" disabled={!selectedCount} onClick={() => dispatch({ type: "REMOVE_SPEED_SEGMENTS" })}>Remove from Draft</button>
              <button className="btn" type="button" disabled>Undo</button>
            </>
          )}
          <button className="btn primary performance-playback-btn" type="button" disabled={!selectedCount && !state.appliedFilters.units.length} onClick={() => dispatch({ type: "START_PLAYBACK", units: speed ? [...new Set((state.speed.draft?.segments ?? []).filter((segment) => selected.includes(segment.id)).flatMap((segment) => segment.unitNos))] : selected })}>▶ Playback{selectedCount ? ` ${selectedCount} ${speed ? "segment" : "unit"}` : ""}</button>
          <input className="grid-search" type="search" placeholder={speed ? "Cari segment atau road…" : "Cari loader atau unit…"} value={state.gridSearch} onChange={(event) => dispatch({ type: "SET_GRID_SEARCH", value: event.target.value })} />
        </div>
      </div>
      <PerformanceGrid />
    </section>
  );
}
