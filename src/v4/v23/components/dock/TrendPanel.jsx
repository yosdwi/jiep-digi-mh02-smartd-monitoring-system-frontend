import { useMemo, useState } from "react";
import { useWorkspace } from "../../state/WorkspaceContext";
import { fmt } from "../../utils/workspace";

const METRICS = [
  ["ritase", "Ritase"],
  ["cycle", "Avg Cycle Time"],
  ["loadedDistance", "Jarak Muatan"],
  ["emptyDistance", "Jarak Kosongan"],
  ["speed", "Actual Avg Speed"],
  ["stop", "Stop Muatan"],
];

const COLORS = ["#287c94", "#d48a47", "#548767", "#9f6662", "#5c8798", "#929ba6"];

function linePath(points, key, min, max) {
  const W = 1200, H = 220, L = 45, R = 15, T = 14, B = 30;
  return points.map((point, index) => {
    const x = L + (W - L - R) * (index / Math.max(1, points.length - 1));
    const y = T + (H - T - B) * (1 - ((Number(point[key]) || 0) - min) / (max - min || 1));
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export default function TrendPanel() {
  const { state, dispatch, trend } = useWorkspace();
  const [hover, setHover] = useState(null);
  const active = METRICS.filter(([key]) => state.trendMetrics.includes(key));
  const values = useMemo(() => active.flatMap(([key]) => trend.map((row) => Number(row[key]) || 0)), [active, trend]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const hoverRow = hover !== null ? trend[hover] : trend.at(-1);
  const mainMetric = active[0]?.[0] ?? "ritase";
  const pointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * Math.max(0, trend.length - 1)));
  };
  const brush = (event) => {
    if (!trend.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (trend.length - 1));
    const row = trend[index];
    dispatch({ type: "SET_ANALYSIS_WINDOW", value: { startMs: row.start, endMs: row.end } });
  };
  return (
    <section className="card trend-card">
      <div className="head"><div className="title">Trend Performa</div></div>
      <div className="trend-body">
        <div className="trend-toolbar">
          {METRICS.map(([key, label]) => <button key={key} className={`metric-toggle ${state.trendMetrics.includes(key) ? "active" : ""}`} type="button" onClick={() => dispatch({ type: "TOGGLE_TREND_METRIC", metric: key })}>{label}</button>)}
        </div>
        {trend.length ? (
          <div className="trend-wrap">
            <div className="trend-readout"><strong>{hoverRow ? fmt(hoverRow[mainMetric], mainMetric === "ritase" ? 0 : 1) : "—"}</strong><span>{hoverRow ? new Date(hoverRow.start + 8 * 3600000).toISOString().slice(11, 16) + " WITA" : "—"}</span></div>
            <svg className="trend-svg" viewBox="0 0 1200 220" preserveAspectRatio="none" onPointerMove={pointerMove} onPointerLeave={() => setHover(null)} onClick={brush} onDoubleClick={() => dispatch({ type: "SET_ANALYSIS_WINDOW", value: null })}>
              {[0, .25, .5, .75, 1].map((fraction) => <line key={fraction} x1="45" x2="1185" y1={14 + fraction * 176} y2={14 + fraction * 176} className="trend-grid" />)}
              {active.map(([key], index) => <path key={key} d={linePath(trend, key, min, max)} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />)}
              {hover !== null && <line x1={45 + 1140 * (hover / Math.max(1, trend.length - 1))} x2={45 + 1140 * (hover / Math.max(1, trend.length - 1))} y1="14" y2="190" stroke="#98a2b3" strokeDasharray="4 4" />}
            </svg>
            <div className="trend-brush-note"><span>{state.analysisWindow ? "Window analisis aktif · double click untuk reset" : "Seluruh rentang · klik chart untuk fokus window"}</span></div>
          </div>
        ) : <div className="trend-empty">Tidak ada data trend pada rentang ini.</div>}
      </div>
    </section>
  );
}
