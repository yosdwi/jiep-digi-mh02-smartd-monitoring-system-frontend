// Singleton module-worker client for decoding PlaybackV2 Arrow IPC chunk responses.
let worker = null;
let nextRequestId = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/playbackChunkDecoder.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const { requestId } = event.data || {};
    const resolver = pending.get(requestId);
    if (!resolver) return;
    pending.delete(requestId);
    if (event.data.ok) resolver.resolve(event.data);
    else resolver.reject(new Error(event.data.error || 'Arrow decode failed'));
  };
  worker.onerror = (event) => {
    for (const resolver of pending.values()) resolver.reject(new Error(event.message || 'Playback decoder worker error'));
    pending.clear();
  };
  return worker;
}

// `buffer` is transferred into the worker (detaches the caller's view) — pass a
// buffer the caller no longer needs, e.g. straight from `response.arrayBuffer()`.
export function decodeChunkArrow(buffer) {
  const w = getWorker();
  const requestId = (nextRequestId += 1);
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    w.postMessage({ requestId, buffer }, [buffer]);
  });
}
