// Export job client.
//
// Preparation is a job, not a download: a shift of raw datalog takes long enough
// that holding a request open would let a proxy timeout decide whether the user
// gets their file. Create, poll, then hand the browser a finished file.

const BASE = '/Monitoring/api/ExportV3';

async function asJson(response) {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch { /* keep the status */ }
    throw new Error(message);
  }
  return response.json();
}

/** Column catalogue, formats and sampling intervals — served, never hardcoded here. */
export async function getExportOptions(signal) {
  return asJson(await fetch(`${BASE}/columns`, { signal, cache: 'no-store' }));
}

export async function createExport(request, signal) {
  return asJson(await fetch(`${BASE}/jobs`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }));
}

export async function getExportStatus(id, signal) {
  return asJson(await fetch(`${BASE}/jobs/${id}`, { signal, cache: 'no-store' }));
}

export async function cancelExport(id) {
  if (!id) return;
  try {
    await fetch(`${BASE}/jobs/${id}`, { method: 'DELETE', cache: 'no-store' });
  } catch {
    // best effort — the server expires jobs on its own
  }
}

/**
 * Poll until the job reaches a terminal state.
 *
 * The interval widens as the job runs: a small export finishes in the first
 * second and a large one does not benefit from being asked twice a second for
 * ten minutes.
 */
export async function waitForExport(id, { signal, onProgress } = {}) {
  let delay = 400;
  for (;;) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const status = await getExportStatus(id, signal);
    onProgress?.(status);
    if (['ready', 'failed', 'cancelled'].includes(status.state)) return status;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(2500, Math.round(delay * 1.4));
  }
}

/**
 * Hand the finished file to the browser.
 *
 * A plain navigation rather than fetch+blob: the file is already on disk on the
 * server, and pulling tens of megabytes through JS memory only to re-emit it as
 * a blob costs the user's RAM for nothing.
 */
export function downloadExport(job) {
  if (!job?.downloadUrl) return;
  const link = document.createElement('a');
  link.href = `/Monitoring${job.downloadUrl}`;
  link.download = job.fileName || '';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
