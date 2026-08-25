export const RAW_BASE = "https://raw.githubusercontent.com/yosdwi/jiep-digi-mh02-smartd-monitoring-system-frontend/main";

export const DATA_URLS = {
  trace: `${RAW_BASE}/public/fixtures/brcb-2026-08-22-trace-2s.json`,
  ortho: `${RAW_BASE}/public/fixtures/brcb-orthophoto-layers.json`,
  boundary: `${RAW_BASE}/public/kml/BOUNDARY_BRCB.kml`,
  roads: `${RAW_BASE}/public/kml/ROADS_BRCB.kml`,
  pitStops: `${RAW_BASE}/public/kml/durasipitstop/pitstops.kml`,
};

const pad = (value) => String(value).padStart(2, "0");

export function createSyntheticFixture() {
  const unitNos = ["DT5204", "DT5207", "DT5211", "DT5220", "DT5231", "DT5242", "DT5255", "DT5261"];
  const start = new Date("2026-08-22T00:00:00+08:00").getTime();
  const durationSeconds = 12 * 60 * 60;
  const stepSeconds = 20;
  const traces = unitNos.map((unitNo, unitIndex) => {
    const ts = [];
    const lons = [];
    const lats = [];
    const speeds = [];
    const statuses = [];
    const route = unitIndex % 3;
    const cx = 117.278 + route * 0.008;
    const cy = 1.907 + (unitIndex % 2) * 0.008;
    for (let sec = 0; sec <= durationSeconds; sec += stepSeconds) {
      const t = sec / durationSeconds;
      const phase = t * Math.PI * 8 + unitIndex * 0.45;
      const wiggle = Math.sin(phase * 2.2) * 0.0011;
      ts.push(start + sec * 1000);
      lons.push(cx + Math.cos(phase) * (0.011 + route * 0.0018) + wiggle);
      lats.push(cy + Math.sin(phase * 0.82) * (0.007 + route * 0.0014) + Math.cos(phase * 1.7) * 0.0007);
      const baseSpeed = 23 + Math.sin(phase * 1.4) * 10 + Math.cos(phase * 0.55) * 4;
      speeds.push(Math.max(3, Math.min(43, baseSpeed)));
      statuses.push((Math.floor(sec / 1200) + unitIndex) % 5 === 0 ? 1 : 0);
    }
    return [ts, lons, lats, speeds, statuses];
  });
  return {
    district: "BRCB",
    unitNos,
    traces,
    generated: true,
    start: new Date(start).toISOString(),
    end: new Date(start + durationSeconds * 1000).toISOString(),
    label: `${pad(unitNos.length)} unit synthetic fallback`,
  };
}

export async function loadFixture() {
  try {
    const response = await fetch(DATA_URLS.trace, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (!Array.isArray(json?.unitNos) || !Array.isArray(json?.traces)) throw new Error("Fixture shape tidak dikenali");
    return { ...json, generated: false };
  } catch (error) {
    console.warn("Analysis Workspace: using synthetic fixture fallback", error);
    return createSyntheticFixture();
  }
}
