export const SPEED_BANDS = [
  { min: 30, label: "≥30 kph", color: [59, 130, 246, 210] },
  { min: 25, label: "25–30 kph", color: [34, 197, 94, 210] },
  { min: 20, label: "20–25 kph", color: [251, 191, 36, 210] },
  { min: 10, label: "10–20 kph", color: [139, 69, 19, 210] },
  { min: -Infinity, label: "<10 kph", color: [239, 68, 68, 210] },
];

export function speedColor(speed) {
  return SPEED_BANDS.find((band) => speed >= band.min)?.color ?? SPEED_BANDS.at(-1).color;
}

export const fmt = (number, digits = 1) =>
  Number.isFinite(Number(number))
    ? Number(number).toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "—";

export const fmtInt = (number) =>
  Number.isFinite(Number(number)) ? Math.round(Number(number)).toLocaleString("id-ID") : "—";

export function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const minutes = ms / 60000;
  if (minutes < 60) return `${fmt(minutes, 1)} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}j ${fmt(minutes - hours * 60, 0)}m`;
}

export const pad = (value) => String(value).padStart(2, "0");

export function toLocalInput(ms) {
  const date = new Date(ms + 8 * 3600000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:00`;
}

export function parseWita(input) {
  if (!input) return NaN;
  return Date.parse(`${input}:00+08:00`);
}

export function displayRange(start, end) {
  if (!start || !end) return "—";
  const [dateA, timeA] = start.split("T");
  const [dateB, timeB] = end.split("T");
  const [, monthA, dayA] = dateA.split("-");
  const [, monthB, dayB] = dateB.split("-");
  return dateA === dateB ? `${dayA}/${monthA} ${timeA} – ${timeB}` : `${dayA}/${monthA} ${timeA} – ${dayB}/${monthB} ${timeB}`;
}

export function haversineKm(a, b) {
  if (!a || !b) return 0;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const r = Math.PI / 180;
  const p1 = lat1 * r;
  const p2 = lat2 * r;
  const dp = (lat2 - lat1) * r;
  const dl = (lon2 - lon1) * r;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

export function traceRows(fixture, unitSet, startMs, endMs, intervalSeconds = 2, limit = Infinity) {
  if (!fixture) return [];
  const rows = [];
  const wanted = unitSet?.size ? unitSet : new Set(fixture.unitNos);
  fixture.unitNos.forEach((unitNo, unitIndex) => {
    if (!wanted.has(unitNo)) return;
    const trace = fixture.traces[unitIndex];
    if (!trace) return;
    const [ts, lons, lats, speeds, statuses] = trace;
    let last = -Infinity;
    for (let index = 0; index < ts.length; index += 1) {
      const time = Number(ts[index]);
      if (time < startMs || time > endMs || time - last < intervalSeconds * 1000) continue;
      const lon = Number(lons[index]);
      const lat = Number(lats[index]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      rows.push({ unitNo, time, lon, lat, speed: Number(speeds[index] || 0), status: Number(statuses[index] || 0) });
      last = time;
      if (rows.length >= limit) return;
    }
  });
  return rows;
}

export function deriveKpis(rows, selectedCount = 0) {
  if (!rows.length) return { units: selectedCount, ritase: 0, cycle: NaN, loaded: NaN, empty: NaN, speed: NaN };
  const units = new Set(rows.map((row) => row.unitNo));
  const avgSpeed = rows.reduce((sum, row) => sum + row.speed, 0) / rows.length;
  const perUnit = new Map();
  rows.forEach((row) => {
    if (!perUnit.has(row.unitNo)) perUnit.set(row.unitNo, []);
    perUnit.get(row.unitNo).push(row);
  });
  let distanceKm = 0;
  perUnit.forEach((points) => {
    for (let index = 1; index < points.length; index += 1) distanceKm += haversineKm([points[index - 1].lon, points[index - 1].lat], [points[index].lon, points[index].lat]);
  });
  const hours = Math.max(1, (Math.max(...rows.map((r) => r.time)) - Math.min(...rows.map((r) => r.time))) / 3600000);
  const ritase = Math.max(units.size, Math.round((distanceKm / Math.max(1, units.size)) / 2.3));
  const cycleMin = ritase ? (hours * 60 * units.size) / ritase : NaN;
  return {
    units: units.size,
    ritase,
    cycle: cycleMin,
    loaded: distanceKm / Math.max(1, ritase) * 0.52,
    empty: distanceKm / Math.max(1, ritase) * 0.48,
    speed: avgSpeed,
  };
}

export function buildPerformance(rows) {
  const byUnit = new Map();
  rows.forEach((row) => {
    if (!byUnit.has(row.unitNo)) byUnit.set(row.unitNo, []);
    byUnit.get(row.unitNo).push(row);
  });
  return [...byUnit.entries()].map(([unitNo, points], index) => {
    let distance = 0;
    for (let i = 1; i < points.length; i += 1) distance += haversineKm([points[i - 1].lon, points[i - 1].lat], [points[i].lon, points[i].lat]);
    const speed = points.reduce((sum, point) => sum + point.speed, 0) / Math.max(1, points.length);
    const durationH = Math.max(0.01, (points.at(-1).time - points[0].time) / 3600000);
    const ritase = Math.max(1, Math.round(distance / 2.3));
    return {
      id: unitNo,
      loader: `EX${String(2601 + (index % 3)).padStart(4, "0")}`,
      unitNo,
      ritase,
      cycle: (durationH * 60) / ritase,
      loadedDistance: distance / ritase * 0.52,
      emptyDistance: distance / ritase * 0.48,
      speed,
      stop: Math.max(0, 8 - speed / 8),
    };
  });
}

export function buildTrend(rows, buckets = 16) {
  if (!rows.length) return [];
  const min = Math.min(...rows.map((row) => row.time));
  const max = Math.max(...rows.map((row) => row.time));
  const span = Math.max(1, max - min);
  const result = Array.from({ length: buckets }, (_, index) => ({
    start: min + (span * index) / buckets,
    end: min + (span * (index + 1)) / buckets,
    speeds: [],
    units: new Set(),
    count: 0,
  }));
  rows.forEach((row) => {
    const index = Math.min(buckets - 1, Math.max(0, Math.floor(((row.time - min) / span) * buckets)));
    const bucket = result[index];
    bucket.speeds.push(row.speed);
    bucket.units.add(row.unitNo);
    bucket.count += 1;
  });
  return result.map((bucket, index) => ({
    ...bucket,
    index,
    speed: bucket.speeds.length ? bucket.speeds.reduce((a, b) => a + b, 0) / bucket.speeds.length : 0,
    ritase: Math.max(0, Math.round(bucket.count / 40)),
    cycle: 22 + Math.sin(index / 2) * 4,
    loadedDistance: 1.15 + Math.sin(index / 3) * 0.15,
    emptyDistance: 1.05 + Math.cos(index / 3) * 0.14,
    stop: 3 + Math.cos(index / 2) * 1.2,
  }));
}

export function lineCorridorPolygon(path, halfWidthDeg = 0.00017) {
  if (!path?.length) return [];
  const start = path[0];
  const end = path.at(-1);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * halfWidthDeg;
  const oy = (dx / len) * halfWidthDeg;
  return [
    [start[0] + ox, start[1] + oy],
    [end[0] + ox, end[1] + oy],
    [end[0] - ox, end[1] - oy],
    [start[0] - ox, start[1] - oy],
    [start[0] + ox, start[1] + oy],
  ];
}

export function generateSpeedDraft(rows, targetLength = 100, previousGeneration = 0) {
  const units = [...new Set(rows.map((row) => row.unitNo))];
  const routes = new Map();
  units.forEach((unitNo, unitIndex) => {
    const routeId = `R${String((unitIndex % 3) + 1).padStart(2, "0")}`;
    if (!routes.has(routeId)) routes.set(routeId, []);
    routes.get(routeId).push(...rows.filter((row) => row.unitNo === unitNo));
  });
  const segments = [];
  [...routes.entries()].forEach(([routeId, routeRows], routeOrder) => {
    const ordered = routeRows.sort((a, b) => a.time - b.time);
    const stride = Math.max(8, Math.round(ordered.length / 7));
    for (let cursor = 0, segmentIndex = 0; cursor < ordered.length - 1; cursor += stride, segmentIndex += 1) {
      const slice = ordered.slice(cursor, Math.min(ordered.length, cursor + stride + 1));
      if (slice.length < 2) continue;
      const path = [[slice[0].lon, slice[0].lat], [slice.at(-1).lon, slice.at(-1).lat]];
      const avgActual = slice.reduce((sum, row) => sum + row.speed, 0) / slice.length;
      const suggested = Math.max(10, Math.round(avgActual / 5) * 5);
      const id = `${routeId}-S${String(segmentIndex + 1).padStart(3, "0")}`;
      segments.push({
        id,
        routeId,
        routeLabel: `Route ${routeOrder + 1}`,
        roadName: "",
        sta: `${segmentIndex * targetLength}+${String(targetLength).padStart(3, "0")}`,
        status: "Suggested",
        reviewed: false,
        plan: suggested,
        suggested,
        avgActual,
        lengthM: targetLength + Math.round(Math.sin(segmentIndex + routeOrder) * 18),
        unitNos: [...new Set(slice.map((row) => row.unitNo))],
        samples: slice.length,
        path,
        polygon: lineCorridorPolygon(path),
        change: previousGeneration ? (segmentIndex % 5 === 0 ? "Boundary Change" : "Unchanged") : "New Segment",
      });
    }
  });
  return {
    version: `Review Draft v${previousGeneration + 1}`,
    generation: previousGeneration + 1,
    createdAt: Date.now(),
    targetLength,
    segments,
  };
}

export function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
