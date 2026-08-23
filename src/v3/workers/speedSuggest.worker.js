import { buffer, lineString, simplify } from '@turf/turf';

const EARTH_METRES = 111320;

function metres(a, b) {
  const lat = ((a[1] + b[1]) / 2) * Math.PI / 180;
  return Math.hypot((a[0] - b[0]) * EARTH_METRES * Math.cos(lat), (a[1] - b[1]) * EARTH_METRES);
}

function pathLength(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += metres(path[i - 1], path[i]);
  return total;
}

function gridKey(point, size = 45) {
  const x = point[0] * EARTH_METRES * Math.cos(point[1] * Math.PI / 180);
  const y = point[1] * EARTH_METRES;
  return `${Math.round(x / size)}:${Math.round(y / size)}`;
}

function routeCells(path) {
  return new Set(path.map((point) => gridKey(point)));
}

function overlapRatio(a, b) {
  let hit = 0;
  a.forEach((key) => { if (b.has(key)) hit += 1; });
  return hit / Math.max(1, Math.min(a.size, b.size));
}

function collectCandidates(devices, startMs, endMs) {
  const candidates = [];
  devices.forEach((device) => device.chunks.forEach((chunk) => {
    let path = [];
    let previousTime = null;
    const flush = () => {
      if (path.length >= 3 && pathLength(path) >= 120) candidates.push({ path, cells: routeCells(path) });
      path = [];
    };

    for (let i = 0; i < chunk.n; i++) {
      const time = chunk.epochMs[i];
      if (time < startMs || time > endMs) continue;
      const point = [chunk.position[i * 2], chunk.position[i * 2 + 1]];
      if (!point.every(Number.isFinite)) continue;

      const previous = path[path.length - 1];
      if (previous && (time - previousTime > 180000 || metres(previous, point) > 250)) flush();
      const last = path[path.length - 1];
      if (!last || metres(last, point) >= 10) path.push(point);
      previousTime = time;
    }
    flush();
  }));
  return candidates.sort((a, b) => pathLength(b.path) - pathLength(a.path));
}

function distinctRoutes(candidates, maxRoutes) {
  const routes = [];
  for (const candidate of candidates) {
    if (routes.some((route) => overlapRatio(route.cells, candidate.cells) > 0.55)) continue;
    routes.push(candidate);
    if (routes.length >= maxRoutes) break;
  }
  return routes;
}

function splitPath(path, targetMetres) {
  const segments = [];
  let current = [path[0]];
  let distance = 0;
  for (let i = 1; i < path.length; i++) {
    let from = path[i - 1];
    const to = path[i];
    let edge = metres(from, to);
    if (!Number.isFinite(edge) || edge > 250) continue;

    // Interpolate the cut point instead of ending at the next GPS sample. A
    // sparse interval can contain a 180 m edge; simply pushing that sample is
    // how the prototype produced one visually giant segment among 100 m cells.
    while (distance + edge >= targetMetres && edge > 0) {
      const remaining = targetMetres - distance;
      const ratio = remaining / edge;
      const cut = [
        from[0] + (to[0] - from[0]) * ratio,
        from[1] + (to[1] - from[1]) * ratio,
      ];
      current.push(cut);
      segments.push(current);
      current = [cut];
      from = cut;
      edge = metres(from, to);
      distance = 0;
    }
    if (edge > 0) { current.push(to); distance += edge; }
  }
  if (current.length >= 2 && pathLength(current) >= Math.min(35, targetMetres * 0.35)) segments.push(current);
  return segments;
}

function bbox(ring) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  ring.forEach(([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
  return [minX, minY, maxX, maxY];
}

function inside(point, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-12) + xi) hit = !hit;
  }
  return hit;
}

function pointToEdge(point, a, b) {
  const lat = ((point[1] + a[1] + b[1]) / 3) * Math.PI / 180;
  const sx = EARTH_METRES * Math.cos(lat); const sy = EARTH_METRES;
  const px = point[0] * sx; const py = point[1] * sy;
  const ax = a[0] * sx; const ay = a[1] * sy; const bx = b[0] * sx; const by = b[1] * sy;
  const vx = bx - ax; const vy = by - ay; const wx = px - ax; const wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function pointToPath(point, path) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, pointToEdge(point, path[i - 1], path[i]));
  return best;
}

function corridor(path, widthMetres) {
  let polygon = buffer(lineString(path), widthMetres / 2000, { units: 'kilometers', steps: 2 });
  polygon = simplify(polygon, { tolerance: 1 / EARTH_METRES, highQuality: true, mutate: false });
  if (polygon.geometry.type === 'Polygon') return polygon.geometry.coordinates[0];
  return polygon.geometry.coordinates[0]?.[0] || [];
}

function segmentSignature(path) {
  const midpoint = path[Math.floor(path.length / 2)];
  const first = path[0]; const last = path[path.length - 1];
  const lat = ((first[1] + last[1]) / 2) * Math.PI / 180;
  let heading = Math.atan2((last[1] - first[1]) * EARTH_METRES, (last[0] - first[0]) * EARTH_METRES * Math.cos(lat));
  // A road driven in the opposite direction is the same corridor.
  heading = ((heading % Math.PI) + Math.PI) % Math.PI;
  return { midpoint, heading };
}

function headingGap(a, b) {
  const raw = Math.abs(a - b);
  return Math.min(raw, Math.PI - raw);
}

function isDuplicateCorridor(signature, accepted) {
  // This is the overlap guard the prototype lacked. Repeated trips over the
  // same road must strengthen evidence for one cell, not create another orange
  // polygon on top of it. Heading keeps a real crossing as two distinct roads.
  return accepted.some((entry) => (
    metres(signature.midpoint, entry.signature.midpoint) < 52
    && headingGap(signature.heading, entry.signature.heading) < Math.PI / 6
  ));
}

function assignEvidence(segments, devices, startMs, endMs) {
  const meta = segments.map((segment) => ({ segment, bbox: bbox(segment.polygon), sum: 0, count: 0, units: new Map() }));
  if (meta.length === 0) return;
  const latRef = meta[0].segment.path[0][1] * Math.PI / 180;
  const cellMetres = 80;
  const cell = (point) => [
    Math.floor((point[0] * EARTH_METRES * Math.cos(latRef)) / cellMetres),
    Math.floor((point[1] * EARTH_METRES) / cellMetres),
  ];
  const index = new Map();
  meta.forEach((item) => {
    const [x0, y0] = cell([item.bbox[0], item.bbox[1]]);
    const [x1, y1] = cell([item.bbox[2], item.bbox[3]]);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = `${x}:${y}`;
      const list = index.get(key) || [];
      list.push(item); index.set(key, list);
    }
  });
  devices.forEach((device) => device.chunks.forEach((chunk) => {
    for (let i = 0; i < chunk.n; i++) {
      const time = chunk.epochMs[i];
      const speed = chunk.speed[i];
      if (time < startMs || time > endMs || !Number.isFinite(speed)) continue;
      const point = [chunk.position[i * 2], chunk.position[i * 2 + 1]];
      const [gx, gy] = cell(point);
      let match = null; let distance = Infinity;
      for (const item of index.get(`${gx}:${gy}`) || []) {
        const b = item.bbox;
        if (point[0] < b[0] || point[0] > b[2] || point[1] < b[1] || point[1] > b[3]) continue;
        if (!inside(point, item.segment.polygon)) continue;
        const next = pointToPath(point, item.segment.path);
        if (next < distance) { match = item; distance = next; }
      }
      if (!match) continue;
      match.sum += speed; match.count += 1;
      const unit = match.units.get(device.deviceId) || { deviceId: device.deviceId, unitNo: device.unitNo, sum: 0, samples: 0 };
      unit.sum += speed; unit.samples += 1; match.units.set(device.deviceId, unit);
    }
  }));

  meta.forEach(({ segment, sum, count, units }) => {
    segment.samples = count;
    segment.avgActual = count ? sum / count : null;
    segment.suggestedPlan = count ? Math.max(5, Math.round((sum / count) / 5) * 5) : null;
    segment.proposedPlan = segment.suggestedPlan;
    segment.units = [...units.values()].map((unit) => ({ ...unit, avgSpeed: unit.sum / unit.samples }));
  });
}

self.onmessage = (event) => {
  const { requestId, devices, startMs, endMs, targetMetres = 100, corridorWidthMetres = 36, maxRoutes = 12 } = event.data;
  try {
    const routes = distinctRoutes(collectCandidates(devices, startMs, endMs), maxRoutes);
    const accepted = [];
    const segments = [];
    routes.forEach((route, routeIndex) => {
      splitPath(route.path, targetMetres).forEach((path, index) => {
        const signature = segmentSignature(path);
        if (isDuplicateCorridor(signature, accepted)) return;
        const polygon = corridor(path, corridorWidthMetres);
        if (polygon.length < 4) return;
        const segment = {
          id: `R${String(routeIndex + 1).padStart(2, '0')}-S${String(segments.filter((value) => value.routeId === `R${String(routeIndex + 1).padStart(2, '0')}`).length + 1).padStart(3, '0')}`,
          routeId: `R${String(routeIndex + 1).padStart(2, '0')}`,
          routeName: `Generated Route ${routeIndex + 1}`,
          roadName: '', path, polygon, distanceMetres: Math.round(pathLength(path)),
          samples: 0, avgActual: null, units: [], suggestedPlan: null, proposedPlan: null,
          reviewed: false, change: 'Suggested', source: 'auto-suggest',
        };
        accepted.push({ signature, segment });
        segments.push(segment);
      });
    });
    assignEvidence(segments, devices, startMs, endMs);
    self.postMessage({ requestId, ok: true, routes: new Set(segments.map((segment) => segment.routeId)).size, segments });
  } catch (error) {
    self.postMessage({ requestId, ok: false, error: error?.message || String(error) });
  }
};
