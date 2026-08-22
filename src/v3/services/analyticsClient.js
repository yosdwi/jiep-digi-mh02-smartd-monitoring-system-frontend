// Client for analytics.worker.js.
//
// Runs over the columns already in traceRegistry, so producing the full metric
// set costs one worker round trip and no extra network request.

import * as registry from '../state/traceRegistry';

let worker = null;
let nextId = 1;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/analytics.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const entry = pending.get(event.data.requestId);
    if (!entry) return;
    pending.delete(event.data.requestId);
    if (event.data.ok) entry.resolve({ fleet: event.data.fleet, units: event.data.units });
    else entry.reject(new Error(event.data.error));
  };
  return worker;
}

export function computeAnalytics({ startMs, endMs, deviceIds = null, speedBands = [] }) {
  const w = ensureWorker();
  const requestId = nextId++;
  const wanted = deviceIds ? new Set(deviceIds) : null;

  const devices = registry.listDevices()
    .filter((d) => !wanted || wanted.has(d.deviceId))
    .map((device) => ({
      deviceId: device.deviceId,
      unitNo: device.unitNo,
      colorIndex: device.colorIndex,
      chunks: [...device.chunks.entries()].map(([key, chunk]) => ({
        key,
        n: chunk.n,
        epochMs: chunk.epochMs,
        position: chunk.position,
        speed: chunk.speed,
        plmStatus: chunk.plmStatus,
        hm: chunk.hm,
        fuelLevel: chunk.fuelLevel,
        actTonnage: chunk.actTonnage,
      })),
    }));

  return new Promise((resolve, reject) => {
    if (devices.length === 0) { resolve({ fleet: null, units: [] }); return; }
    pending.set(requestId, { resolve, reject });
    const bands = speedBands.map((b) => ({ min: b.min }));
    w.postMessage({ requestId, devices, startMs, endMs, bands });
  });
}

// Mirrors cycleTimeStore.js getStatusText / getStatusColor so V3 labels the
// plm_status taxonomy exactly as the rest of the product does.
export const STATE_META = {
  0: { label: 'ACC ON', short: 'ACC', color: '#64748b' },
  1: { label: 'Standby', short: 'Standby', color: '#eab308' },
  2: { label: 'Running kosongan', short: 'Kosongan', color: '#06b6d4' },
  3: { label: 'Loading', short: 'Loading', color: '#f97316' },
  4: { label: 'Running muatan', short: 'Muatan', color: '#22c55e' },
  5: { label: 'Stop muatan', short: 'Stop muatan', color: '#a855f7' },
  6: { label: 'Dumping', short: 'Dumping', color: '#ef4444' },
};

export const STATE_ORDER = [3, 4, 5, 6, 2, 1, 0];
