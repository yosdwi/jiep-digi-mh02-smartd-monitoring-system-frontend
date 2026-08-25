import { useMemo } from "react";
import { useWorkspace } from "../../state/WorkspaceContext";
import { fmtDuration, fmtInt } from "../../utils/workspace";

export default function DurationWorkspace() {
  const { state, dispatch, durationEvents } = useWorkspace();
  if (state.mode !== "duration") return null;
  const areas = useMemo(() => {
    const map = new Map();
    ["Pit Stop 1", "Pit Stop 2", "Pit Stop 3", "Pit Stop 4"].forEach((name) => map.set(name, { name, count: 0, total: 0 }));
    durationEvents.forEach((event) => { const row = map.get(event.polygon) ?? { name: event.polygon, count: 0, total: 0 }; row.count += 1; row.total += event.durationMs; map.set(event.polygon, row); });
    return [...map.values()].filter((item) => !state.duration.areaQuery || item.name.toLowerCase().includes(state.duration.areaQuery.toLowerCase()));
  }, [durationEvents, state.duration.areaQuery]);
  const selectedAreas = new Set(state.duration.selectedAreas.length ? state.duration.selectedAreas : areas.map((item) => item.name));
  const visible = durationEvents.filter((event) => selectedAreas.has(event.polygon));
  const total = visible.reduce((sum, event) => sum + event.durationMs, 0);
  const longest = Math.max(0, ...visible.map((event) => event.durationMs));
  const review = visible.filter((event) => event.review).length;
  const toggleArea = (name) => { const next = new Set(selectedAreas); next.has(name) ? next.delete(name) : next.add(name); dispatch({ type: "PATCH_DURATION", patch: { selectedAreas: [...next] } }); };
  return (
    <section className="duration-workspace-v20" aria-label="Duration In Pit Workspace">
      <header className="duration-topbar-v20">
        <div className="duration-title-v20"><strong>Duration In Pit</strong><span>Polygon Pit Stop · dwell telemetry</span></div>
        <div className="duration-kpis-v20"><div><span>Total dwell</span><strong>{fmtDuration(total)}</strong></div><div><span>Event</span><strong>{fmtInt(visible.length)}</strong></div><div><span>Rata-rata</span><strong>{visible.length ? fmtDuration(total / visible.length) : "—"}</strong></div><div><span>Terpanjang</span><strong>{longest ? fmtDuration(longest) : "—"}</strong></div><div className="review"><span>Perlu Review</span><strong>{fmtInt(review)}</strong></div></div>
        <label className="duration-threshold-v20"><span>Review jika</span><select value={state.duration.threshold} onChange={(event) => dispatch({ type: "PATCH_DURATION", patch: { threshold: Number(event.target.value) } })}><option value="10">&gt; 10 min</option><option value="15">&gt; 15 min</option><option value="20">&gt; 20 min</option><option value="30">&gt; 30 min</option></select></label>
        <div className="duration-actions-v22"><button className="btn" type="button" onClick={() => dispatch({ type: "SET_MODE", mode: "gis" })}>Edit Pit Stop in GIS</button><button className="btn primary" type="button" disabled={!state.duration.selectedUnits.length} onClick={() => dispatch({ type: "START_PLAYBACK", units: state.duration.selectedUnits })}>▶ Playback{state.duration.selectedUnits.length ? ` ${state.duration.selectedUnits.length} unit` : ""}</button></div>
      </header>
      <aside className="duration-sidebar-v20">
        <div className="duration-side-head-v20"><strong>Pit Stop Area</strong><span>{state.appliedFilters.units.length} unit · {selectedAreas.size}/{areas.length} area aktif</span><span className="mode-scope-chip-v21">Scope: filter Unit global</span></div>
        <div className="duration-tree-tools-v21"><input type="search" placeholder="Cari area Pit Stop…" value={state.duration.areaQuery} onChange={(event) => dispatch({ type: "PATCH_DURATION", patch: { areaQuery: event.target.value } })}/><button type="button" onClick={() => dispatch({ type: "PATCH_DURATION", patch: { selectedAreas: areas.map((item) => item.name) } })}>Pilih semua</button></div>
        <div className="duration-event-list-v20"><div className="duration-tree-root-v21">▾ Pit Stop Area <small>· {areas.length} area</small></div>{areas.map((area) => <label className="duration-tree-row-v21" key={area.name}><input type="checkbox" checked={selectedAreas.has(area.name)} onChange={() => toggleArea(area.name)}/><strong>{area.name}</strong><small>{area.count} event · {fmtDuration(area.total)}</small></label>)}</div>
      </aside>
    </section>
  );
}
