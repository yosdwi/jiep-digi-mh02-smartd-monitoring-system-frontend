let worker;
let requestId = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/speedSuggest.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.requestId);
    if (!request) return;
    pending.delete(data.requestId);
    if (data.ok) request.resolve(data);
    else request.reject(new Error(data.error || 'Auto Suggest gagal.'));
  };
  worker.onerror = (error) => {
    pending.forEach((request) => request.reject(error));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function suggestSpeedSegments(input) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ requestId: id, ...input });
  });
}
