import * as registry from '../state/traceRegistry';
import useHistoryStore, { BIN_COUNT, DEFAULT_SPEED_BANDS } from '../state/historyStore';
import { UNIT_RAMP, rgb } from '../foundation/tokens';

const TRACE_FIXTURE_URL = `${import.meta.env.BASE_URL}fixtures/brcb-2026-08-22-trace-2s.json`;

function bandIndex(speed) {
  let index = 0;
  for (let i = 0; i < DEFAULT_SPEED_BANDS.length; i += 1) {
    if (speed >= DEFAULT_SPEED_BANDS[i].min) index = i;
  }
  return index;
}

function binsFor(timestamps, startMs, endMs) {
  const bins = new Uint32Array(BIN_COUNT);
  const span = Math.max(1, endMs - startMs);
  timestamps.forEach((t) => {
    const index = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(((t - startMs) / span) * BIN_COUNT)));
    bins[index] += 1;
  });
  return bins;
}

function toHourKey(ms) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:00`;
}

export async function loadFixtureTrace() {
  const response = await fetch(TRACE_FIXTURE_URL);
  if (!response.ok) throw new Error(`Fixture trace ${response.status}`);
  const fixture = await response.json();

  registry.clear();

  const unitNos = fixture.unitNos || [];
  const deviceIds = fixture.deviceIds || [];
  const traces = fixture.traces || [];
  const startMs = Date.parse(`${fixture.startDateTime}+08:00`);
  const endMs = Date.parse(`${fixture.endDateTime}+08:00`);
  const total = Number(fixture.sampleCount || 0);

  const position = new Float64Array(total * 2);
  const filter = new Float32Array(total * 2);
  const color = new Uint8Array(total * 4);
  const epochMs = new Float64Array(total);
  const speed = new Float32Array(total);
  const plmStatus = new Float32Array(total);
  const hm = new Float32Array(total);
  const fuelLevel = new Float32Array(total);
  const actTonnage = new Float32Array(total);
  const band = new Uint8Array(total);
  const ranges = [];

  let offset = 0;
  traces.forEach((trace, deviceIndex) => {
    const [timestamps, lons, lats, speeds, statuses] = trace;
    const count = timestamps.length;
    const unitColor = rgb(UNIT_RAMP[deviceIndex % UNIT_RAMP.length]);
    const start = offset;

    for (let i = 0; i < count; i += 1) {
      const target = offset + i;
      const sampleSpeed = Number(speeds[i] || 0);
      const sampleBand = bandIndex(sampleSpeed);
      const speedColor = rgb(DEFAULT_SPEED_BANDS[sampleBand].color);

      position[target * 2] = Number(lons[i]);
      position[target * 2 + 1] = Number(lats[i]);
      filter[target * 2] = Number(timestamps[i]);
      filter[target * 2 + 1] = sampleSpeed;
      color[target * 4] = speedColor[0] ?? unitColor[0];
      color[target * 4 + 1] = speedColor[1] ?? unitColor[1];
      color[target * 4 + 2] = speedColor[2] ?? unitColor[2];
      color[target * 4 + 3] = 190;
      epochMs[target] = Number(timestamps[i]);
      speed[target] = sampleSpeed;
      plmStatus[target] = Number(statuses[i] || 0);
      band[target] = sampleBand;
      hm[target] = Number.NaN;
      fuelLevel[target] = Number.NaN;
      actTonnage[target] = Number.NaN;
    }

    ranges.push({
      deviceIndex,
      start,
      count,
      minMs: Number(timestamps[0]),
      maxMs: Number(timestamps[count - 1]),
      bins: binsFor(timestamps, startMs, endMs),
    });
    offset += count;
  });

  const devices = unitNos.map((unitNo, index) => ({
    unitNo,
    deviceId: deviceIds[index],
    colorIndex: index,
  }));
  const hour = toHourKey(startMs);

  registry.addHour(hour, {
    n: total,
    position,
    filter,
    color,
    epochMs,
    speed,
    plmStatus,
    hm,
    fuelLevel,
    actTonnage,
    band,
  }, ranges, (index) => devices[index]);

  useHistoryStore.getState().setContext({
    district: fixture.district,
    startDateTime: fixture.startDateTime,
    endDateTime: fixture.endDateTime,
    unitNos,
  });
  useHistoryStore.getState().setQueryResult({
    devices,
    availableHours: [hour],
    rangeStartMs: startMs,
    rangeEndMs: endMs,
    queryId: 'fixture-brcb-2026-08-22',
  });
  useHistoryStore.getState().setBins(registry.aggregateBins(BIN_COUNT));
  useHistoryStore.getState().setStatus({
    state: 'ready',
    progress: 100,
    message: 'Fixture ClickHouse 2026-08-22, sampling 2 detik.',
    loadedChunks: 1,
    totalChunks: 1,
    sampleCount: total,
    stride: 2,
  });

  return { devices, startMs, endMs, sampleCount: total };
}
