// Worker pool in front of traceDecoder.worker.js.
//
// A pool rather than a single worker because chunk fetches complete in bursts
// (one per device-hour, several in flight at once) and Arrow decode is CPU-bound.
// Sized to hardwareConcurrency - 1, capped at 4: beyond that the workers contend
// for the same cores and the main thread starves, which is the opposite of the
// point.

const POOL_SIZE = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));

let pool = null;
let nextRequestId = 1;

function ensurePool() {
  if (pool) return pool;
  pool = Array.from({ length: POOL_SIZE }, () => {
    const worker = new Worker(new URL('../workers/traceDecoder.worker.js', import.meta.url), { type: 'module' });
    const pending = new Map();
    worker.onmessage = (event) => {
      const { requestId } = event.data;
      const entry = pending.get(requestId);
      if (!entry) return;
      pending.delete(requestId);
      if (event.data.ok) entry.resolve(event.data);
      else entry.reject(new Error(event.data.error || 'trace decode failed'));
    };
    worker.onerror = (err) => {
      pending.forEach((entry) => entry.reject(err));
      pending.clear();
    };
    return { worker, pending };
  });
  return pool;
}

/**
 * Decode one hour-chunk into per-device transferable typed-array columns.
 *
 * Resolves to `{ segments, bins, ... }` where each segment carries a
 * `deviceIndex` into the query's device array.
 *
 * `buffer` is transferred to the worker (it is unusable on this side afterwards)
 * and the resulting columns are transferred back. No structured clone of sample
 * data happens in either direction.
 */
export function decodeChunk(buffer, options = {}) {
  const workers = ensurePool();
  // Least-loaded rather than round-robin: chunk sizes vary by an order of
  // magnitude (a full hour vs. a partial one), so round-robin leaves one worker
  // holding all the big ones.
  const slot = workers.reduce((best, w) => (w.pending.size < best.pending.size ? w : best), workers[0]);
  const requestId = nextRequestId++;

  return new Promise((resolve, reject) => {
    slot.pending.set(requestId, { resolve, reject });
    slot.worker.postMessage({ requestId, buffer, ...options }, [buffer]);
  });
}

export function terminateDecoders() {
  if (!pool) return;
  pool.forEach(({ worker, pending }) => {
    pending.forEach((entry) => entry.reject(new Error('decoder terminated')));
    pending.clear();
    worker.terminate();
  });
  pool = null;
}
