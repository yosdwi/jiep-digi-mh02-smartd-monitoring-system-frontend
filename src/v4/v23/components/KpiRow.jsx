import { useWorkspace } from "../state/WorkspaceContext";
import { fmt, fmtInt } from "../utils/workspace";

export default function KpiRow() {
  const { state, kpis } = useWorkspace();
  if (["gis", "duration", "datalog"].includes(state.mode)) return null;
  const speedDraft = state.speed.draft;
  const values = state.mode === "speed" && speedDraft ? [
    ["Total Segment", fmtInt(speedDraft.segments.length)],
    ["Global Speed Plan", "30 km/h"],
    ["Avg Actual Speed", `${fmt(speedDraft.segments.reduce((sum, segment) => sum + segment.avgActual, 0) / Math.max(1, speedDraft.segments.length), 1)} km/h`],
    ["Avg Segment Plan", `${fmt(speedDraft.segments.reduce((sum, segment) => sum + segment.plan, 0) / Math.max(1, speedDraft.segments.length), 1)} km/h`],
    ["Evidence Unit", fmtInt(new Set(speedDraft.segments.flatMap((segment) => segment.unitNos)).size)],
    ["Distance Analyzed", `${fmt(speedDraft.segments.reduce((sum, segment) => sum + segment.lengthM, 0) / 1000, 1)} km`],
  ] : [
    ["Total Unit", fmtInt(kpis.units)],
    ["Total Ritase", fmtInt(kpis.ritase)],
    ["Avg Cycle Time", `${fmt(kpis.cycle, 1)} min`],
    ["Avg Jarak Muatan", `${fmt(kpis.loaded, 2)} km`],
    ["Avg Jarak Kosongan", `${fmt(kpis.empty, 2)} km`],
    ["Avg Actual Speed", `${fmt(kpis.speed, 1)} km/h`],
  ];
  return (
    <section className="metrics">
      {values.map(([label, value]) => <div className="card metric" key={label}><div className="k">{label}</div><div className="v">{value}</div></div>)}
    </section>
  );
}
