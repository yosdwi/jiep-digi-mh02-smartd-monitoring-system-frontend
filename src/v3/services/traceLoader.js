// Orchestrates: resolve devices -> create query -> poll -> stream every
// device-hour chunk -> decode in the worker pool -> write typed arrays into
// traceRegistry.
//
// Chunks are written to the registry as they land, so the map paints
// progressively instead of waiting for the whole range. For a 12-hour, 20-unit
// selection that is the difference between "blank for 30 s" and "corridors
// appear within a second and fill in".

import * as api from './playbackApi';
import { decodeChunk } from './traceDecoderClient';
import * as registry from '../state/traceRegistry';
import useHistoryStore, { BIN_COUNT } from '../state/historyStore';
import { UNIT_RAMP, rgb } from '../foundation/tokens';

// Concurrent chunk requests. Browsers allow ~6 per origin; leaving headroom
// means ortho tiles and the KML fetches are not starved behind trace chunks.
const FETCH_CONCURRENCY = 4;

let abortController = null;
let runToken = 0;

export function abortLoad() {
  runToken += 1;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

/**
 * Run `worker` over `items` with bounded concurrency, tolerating per-item failure.
 * Returns the number of items that failed.
 *
 * Failures are counted and logged rather than swallowed: a systemic fault (a
 * codec the decoder cannot read, an auth change) fails EVERY chunk, and a silent
 * version of that is indistinguishable from a slow load — which is exactly how
 * an unreadable Arrow codec once looked like a performance problem.
 */
async function pooled(items, limit, worker) {
  let cursor = 0;
  let failed = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        await worker(items[index]);
      } catch (err) {
        // One missing or failed hour must not abort the whole trace; the user
        // gets the rest of the data and the loaded/total counter shows the gap.
        if (err?.name === 'AbortError') throw err;
        failed += 1;
        if (failed === 1) console.error('[traceLoader] chunk gagal:', err);
      }
    }
  });
  await Promise.all(runners);
  return failed;
}

/**
 * Load the full historical trace for the current context.
 * Returns when every chunk has been decoded, or throws on a fatal error.
 */
export async function loadTrace({ district, unitNos, startDateTime, endDateTime }) {
  abortLoad();
  registry.clear();

  const token = ++runToken;
  abortController = new AbortController();
  const { signal } = abortController;

  const store = useHistoryStore.getState();
  const previousQueryId = store.status.queryId;
  await api.cancelQuery(previousQueryId);

  const alive = () => token === runToken;

  store.setStatus({
    state: 'resolving', progress: 0, error: null, message: 'Mencari perangkat...',
    loadedChunks: 0, totalChunks: 0, sampleCount: 0, stride: 1,
  });

  try {
    const resolved = await api.resolveDevices(district, unitNos, signal);
    if (!alive()) return;
    if (resolved.length === 0) throw new Error('Tidak ada perangkat untuk unit yang dipilih.');

    const deviceIds = resolved.map((d) => d.deviceId);
    useHistoryStore.getState().setStatus({ state: 'queued', message: 'Menyiapkan query...' });

    const created = await api.createQuery({ district, deviceIds, startDateTime, endDateTime }, signal);
    if (!alive()) return;
    const queryId = created.queryId;
    if (!queryId) throw new Error('Query id kosong.');

    const status = await api.waitUntilReady(queryId, created, {
      signal,
      onProgress: (s) => {
        if (!alive()) return;
        useHistoryStore.getState().setStatus({
          state: s.state === 'ready' ? 'loading' : s.state,
          progress: s.progress || 0,
          message: s.state === 'queued' ? 'Antre di server...' : 'Server memproses data...',
        });
      },
    });
    if (!alive()) return;

    const statusDevices = (status.devices || []).map((d) => ({
      deviceId: d.deviceid || d.deviceId,
      unitNo: d.unitno || d.unitNo,
    })).filter((d) => d.deviceId);

    const devices = (statusDevices.length > 0 ? statusDevices : resolved)
      .map((d, index) => ({ ...d, colorIndex: index }));

    const hours = status.availableHours || [];
    const rangeStartMs = Date.parse(api.withWitaOffset(startDateTime));
    const rangeEndMs = Date.parse(api.withWitaOffset(endDateTime));

    useHistoryStore.getState().setQueryResult({
      devices, availableHours: hours, rangeStartMs, rangeEndMs, queryId,
    });

    // No auto-thinning: the operator asked for this many units over this many
    // hours, so full resolution is what loads. traceInterval is opt-in manual
    // thinning only, for when the operator wants fewer points on purpose.
    const { traceInterval } = useHistoryStore.getState();
    const stride = traceInterval > 0 ? traceInterval : 1;

    // One job per hour, each covering the whole fleet. The map still fills in
    // chronologically — an operator watching it load sees the shape of the shift
    // emerge — but an hour now costs one request instead of one per truck.
    const jobs = hours.map((hour) => ({ hour }));

    // Colours are resolved here, once, and passed to the worker indexed by
    // device_index: the worker writes RGBA per sample and never sees a device id.
    const unitColors = devices.map((d) => rgb(UNIT_RAMP[d.colorIndex % UNIT_RAMP.length]));

    useHistoryStore.getState().setStatus({
      state: 'loading',
      progress: 0,
      message: null,
      stride,
      totalChunks: jobs.length,
      loadedChunks: 0,
    });

    if (jobs.length === 0) {
      useHistoryStore.getState().setStatus({ state: 'ready', progress: 100, message: 'Tidak ada data pada rentang ini.' });
      return;
    }

    const { colorMode, speedBands } = useHistoryStore.getState();
    let loaded = 0;
    let samples = 0;

    const failedChunks = await pooled(jobs, FETCH_CONCURRENCY, async ({ hour }) => {
      const buffer = await api.fetchHourChunk(queryId, hour, stride, signal);
      if (!alive()) throw new DOMException('aborted', 'AbortError');

      if (buffer && buffer.byteLength > 0) {
        const decoded = await decodeChunk(buffer, {
          // The server already applied `stride`; striding again here would thin
          // the trace a second time.
          stride: 1,
          binCount: BIN_COUNT,
          binStartMs: rangeStartMs,
          binEndMs: rangeEndMs,
          colorMode,
          unitColors,
          speedBands: speedBands.map((b) => ({ min: b.min, color: b.color })),
        });
        if (!alive()) throw new DOMException('aborted', 'AbortError');

        // The hour lands as one buffer set; the registry slices it per device.
        registry.addHour(hour, decoded, decoded.ranges, (i) => devices[i]);
        samples += decoded.n;
      }

      loaded += 1;
      // Status updates are throttled to whole percent so a 480-chunk load does
      // not push 480 store writes through every subscriber's selector.
      const pct = Math.round((loaded / jobs.length) * 100);
      const current = useHistoryStore.getState().status;
      if (pct !== current.progress || loaded === jobs.length) {
        useHistoryStore.getState().setStatus({
          progress: pct, loadedChunks: loaded, sampleCount: samples,
        });
      }
    });

    if (!alive()) return;

    useHistoryStore.getState().setBins(registry.aggregateBins(BIN_COUNT));
    useHistoryStore.getState().setStatus({
      state: 'ready',
      progress: 100,
      loadedChunks: loaded,
      sampleCount: samples,
      message: failedChunks > 0 ? `${failedChunks} dari ${jobs.length} chunk gagal dimuat.` : null,
    });
  } catch (err) {
    if (err?.name === 'AbortError' || !alive()) return;
    useHistoryStore.getState().setStatus({
      state: 'error',
      error: err?.message || 'Gagal memuat data.',
      message: null,
    });
  }
}
