import { useMemo } from "react";
import { useWorkspace } from "../../state/WorkspaceContext";
import { fmt, fmtDuration } from "../../utils/workspace";

export function DurationOccupancyDock() {
  const { state, dispatch, durationEvents } = useWorkspace();
  const selectedAreas = new Set(state.duration.selectedAreas.length ? state.duration.selectedAreas : ["Pit Stop 1", "Pit Stop 2", "Pit Stop 3", "Pit Stop 4"]);
  const events = durationEvents.filter((event) => selectedAreas.has(event.polygon));
  const byUnit = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      if (!map.has(event.unitNo)) map.set(event.unitNo, { total: 0, events: [] });
      const row = map.get(event.unitNo); row.total += event.durationMs; row.events.push(event);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [events]);
  const min = events.length ? Math.min(...events.map((event) => event.startMs)) : 0;
  const max = events.length ? Math.max(...events.map((event) => event.endMs)) : 1;
  return (
    <div className="duration-dock-content-v21">
      <header className="duration-dock-head-v21"><strong>Occupancy per Unit</strong><span>{events.length} event · {byUnit.length} unit</span><small>Checklist unit untuk playback</small></header>
      <div className="duration-occupancy-rows-v21">
        {byUnit.map(([unitNo, row]) => (
          <div className="duration-occupancy-row-v21" key={unitNo}>
            <input type="checkbox" data-duration-unit={unitNo} checked={state.duration.selectedUnits.includes(unitNo)} onChange={(event) => {
              const next = new Set(state.duration.selectedUnits); event.target.checked ? next.add(unitNo) : next.delete(unitNo); dispatch({ type: "PATCH_DURATION", patch: { selectedUnits: [...next] } });
            }} />
            <strong>{unitNo}</strong>
            <div className="duration-occupancy-track-v21">
              {row.events.map((event) => <button key={event.id} className={`duration-occupancy-bar-v21 ${event.review ? "review" : ""} ${state.duration.selectedEvent === event.id ? "selected" : ""}`} style={{ left: `${((event.startMs - min) / Math.max(1, max - min)) * 100}%`, width: `${Math.max(.5, (event.durationMs / Math.max(1, max - min)) * 100)}%` }} type="button" onClick={() => dispatch({ type: "PATCH_DURATION", patch: { selectedEvent: event.id } })} title={`${event.polygon} · ${fmtDuration(event.durationMs)}`} />)}
            </div>
            <small>{fmtDuration(row.total)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DurationAreaDock() {
  const { state, dispatch, durationEvents } = useWorkspace();
  const events = durationEvents.filter((event) => !state.duration.selectedAreas.length || state.duration.selectedAreas.includes(event.polygon));
  return (
    <div className="duration-dock-content-v21">
      <header className="duration-dock-head-v21"><strong>Area & Event Evidence</strong><span>{events.length} dwell event · checklist untuk review</span><small>Klik row untuk fokus map</small></header>
      <div style={{ overflow: "auto", height: "calc(100% - 40px)" }}>
        <table style={{ minWidth: 720 }}><thead><tr><th></th><th>Pit Stop Area</th><th>Unit</th><th>In</th><th>Out</th><th>Duration</th><th>Review</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className={state.duration.selectedEvent === event.id ? "selected" : ""} onClick={() => dispatch({ type: "PATCH_DURATION", patch: { selectedEvent: event.id } })}><td><input type="checkbox" checked={state.duration.selectedEvents.includes(event.id)} onChange={(e) => { e.stopPropagation(); const next = new Set(state.duration.selectedEvents); e.target.checked ? next.add(event.id) : next.delete(event.id); dispatch({ type: "PATCH_DURATION", patch: { selectedEvents: [...next] } }); }} /></td><td>{event.polygon}</td><td>{event.unitNo}</td><td>{new Date(event.startMs + 8 * 3600000).toISOString().slice(11, 16)}</td><td>{new Date(event.endMs + 8 * 3600000).toISOString().slice(11, 16)}</td><td>{fmtDuration(event.durationMs)}</td><td>{event.review ? "Perlu Review" : "Normal"}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

export function DurationTrendDock() {
  const { durationEvents } = useWorkspace();
  const buckets = useMemo(() => {
    if (!durationEvents.length) return [];
    const min = Math.min(...durationEvents.map((event) => event.startMs)); const max = Math.max(...durationEvents.map((event) => event.endMs)); const count = 12; const span = Math.max(1, max - min);
    return Array.from({ length: count }, (_, index) => ({ start: min + span * index / count, total: 0, review: 0 })).map((bucket, index, array) => {
      const end = index === array.length - 1 ? max : min + span * (index + 1) / count;
      durationEvents.filter((event) => event.startMs >= bucket.start && event.startMs < end).forEach((event) => { bucket.total += event.durationMs / 60000; if (event.review) bucket.review += event.durationMs / 60000; });
      return bucket;
    });
  }, [durationEvents]);
  const max = Math.max(1, ...buckets.map((row) => row.total)); const W = 1000, H = 300, L = 58, R = 22, T = 20, B = 52; const x = (i) => L + (W - L - R) * i / Math.max(1, buckets.length - 1); const y = (v) => T + (H - T - B) * (1 - v / max); const path = (key) => buckets.map((row, i) => `${i ? "L" : "M"}${x(i)},${y(row[key])}`).join(" ");
  return <div className="duration-dock-content-v21"><header className="duration-dock-head-v21"><strong>Trend Duration</strong><span>X: Waktu WITA · Y: dwell per interval</span><small>Telemetry-derived</small></header>{buckets.length ? <div className="duration-trend-wrap-v22"><svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">{[0,.25,.5,.75,1].map((f) => <line key={f} x1={L} x2={W-R} y1={T+f*(H-T-B)} y2={T+f*(H-T-B)} stroke="#e7eaee" />)}<path d={path("total")} fill="none" stroke="#287c94" strokeWidth="3"/><path d={path("review")} fill="none" stroke="#f79009" strokeWidth="3"/></svg><div className="duration-trend-legend-v22"><span><i style={{background:'#287c94'}}></i>Total dwell</span><span><i style={{background:'#f79009'}}></i>Perlu Review</span><strong>{fmt(buckets.reduce((sum,row)=>sum+row.total,0),1)} min</strong></div></div> : null}</div>;
}
