import { getOrthoBaseUrl } from '../../config/apiConfig';

// Write-side client for the orthophoto service.
//
// The read side already lives in map/layers/useBasemapLayers.js. This is what
// the management page needs on top of it: uploading a new GeoTIFF, watching it
// convert, and removing one.
//
// Two properties of that service shape everything here:
//
//  1. Upload is chunked and the CLIENT drives the protocol — N calls to
//     `upload/chunk`, then one `upload/complete` carrying `totalChunks`. A
//     missing chunk fails the merge server-side, so a dropped request has to be
//     retried rather than skipped.
//
//  2. There is NO conversion-status endpoint. `upload/complete` returns as soon
//     as the chunks are merged and runs the conversion in a fire-and-forget
//     background task. The only observable signal is the layer's `converted`
//     flag in the list. A conversion that fails deletes the file and leaves the
//     row unconverted forever — it never reports an error — so waiting has to be
//     bounded and the timeout has to be described as "check back", not "failed".

// 8 MB. Large enough that a 2 GB orthophoto is ~250 requests rather than
// thousands, small enough to stay under typical proxy body limits and to make
// progress move visibly rather than in three jumps.
const CHUNK_SIZE = 8 * 1024 * 1024;

const POLL_INTERVAL_MS = 5000;
// Conversion is minutes for a big raster. Past this the page stops watching and
// says so; it does not claim the upload failed, because it usually has not.
const POLL_TIMEOUT_MS = 20 * 60 * 1000;

const newUploadId = () => (
  crypto.randomUUID?.() ?? `up-${Date.now()}-${Math.random().toString(16).slice(2)}`
);

async function orthoUrl(path) {
  const base = await getOrthoBaseUrl();
  return `${base}/api/ortho/${path}`;
}

/**
 * Uploads one GeoTIFF, then waits for the service to finish converting it.
 *
 * `onProgress` receives a phase and a 0..100 value. The phases are separate
 * because they fail differently and take differently long: bytes leaving the
 * browser is measurable, conversion is not, and presenting one bar for both
 * would show a progress bar that stalls at 100% for several minutes.
 *
 *   { phase: 'uploading', value }   bytes sent — real, monotonic
 *   { phase: 'merging' }            complete() in flight
 *   { phase: 'converting' }         indeterminate, server-side
 *   { phase: 'done', layer }
 */
export async function uploadOrtho({ file, district, signal, onProgress }) {
  if (!file) throw new Error('Tidak ada berkas yang dipilih.');
  if (!district) throw new Error('Distrik tidak diketahui.');

  const uploadId = newUploadId();
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const chunkEndpoint = await orthoUrl('upload/chunk');

  for (let index = 0; index < totalChunks; index++) {
    if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError');

    const slice = file.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
    const body = new FormData();
    body.append('chunk', slice);
    body.append('uploadId', uploadId);
    body.append('chunkIndex', String(index));

    const response = await fetch(chunkEndpoint, { method: 'POST', body, signal });
    if (!response.ok) {
      throw new Error(`Potongan ${index + 1} dari ${totalChunks} gagal terkirim.`);
    }

    onProgress?.({ phase: 'uploading', value: ((index + 1) / totalChunks) * 100 });
  }

  onProgress?.({ phase: 'merging' });

  const completeBody = new FormData();
  completeBody.append('uploadId', uploadId);
  completeBody.append('fileName', file.name);
  completeBody.append('totalChunks', String(totalChunks));
  completeBody.append('district', String(district).toUpperCase());

  const completed = await fetch(await orthoUrl('upload/complete'), {
    method: 'POST', body: completeBody, signal,
  });
  const result = await completed.json().catch(() => null);
  if (!completed.ok || !result?.success) {
    throw new Error(result?.error || 'Gagal menggabungkan berkas di server.');
  }

  onProgress?.({ phase: 'converting' });
  const layer = await waitForConversion({ layerId: result.layerId, district, signal, onProgress });
  onProgress?.({ phase: 'done', layer });
  return layer;
}

/**
 * Polls the layer list until the given layer reports `converted`.
 *
 * Resolves with the layer, or throws a message that says the conversion is still
 * running rather than that it failed — the service gives us no way to tell those
 * apart, and telling an operator their two-hour upload failed when it did not is
 * the worse error.
 */
export async function waitForConversion({ layerId, district, signal, onProgress }) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  for (;;) {
    if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError');

    const layers = await listOrthoLayers({ district, signal }).catch(() => null);
    const match = layers?.find((l) => l.id === layerId);
    if (match?.converted) return match;

    if (Date.now() > deadline) {
      throw new Error(
        'Konversi masih berjalan di server dan belum selesai setelah 20 menit. '
        + 'Berkas tidak hilang — buka halaman ini lagi nanti untuk melihat hasilnya.',
      );
    }

    onProgress?.({ phase: 'converting' });
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export async function listOrthoLayers({ district, signal }) {
  const base = await getOrthoBaseUrl();
  const query = district ? `?district=${encodeURIComponent(String(district).toUpperCase())}` : '';
  const response = await fetch(`${base}/api/ortho/layers${query}`, { signal });
  if (!response.ok) throw new Error('Gagal mengambil daftar orthophoto.');
  const result = await response.json();
  return result?.layers || [];
}

export async function deleteOrthoLayer({ layerId, signal }) {
  const response = await fetch(await orthoUrl(`layers/${encodeURIComponent(layerId)}`), {
    method: 'DELETE', signal,
  });
  if (!response.ok) throw new Error('Gagal menghapus orthophoto.');
  return true;
}

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};
