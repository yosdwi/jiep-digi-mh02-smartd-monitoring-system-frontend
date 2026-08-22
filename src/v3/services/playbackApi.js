// Playback API wrapper. The backend base path is resolved at runtime from
// /api/configuration: PlaybackV3 (ClickHouse) when its flag is on, PlaybackV2
// (DuckDB over S3) otherwise. Both expose identical routes and identical
// request/response shapes, so nothing below this line differs between them.
//
//   POST /devices/resolve                                  unitNos -> deviceIds
//   POST /queries                                          create server-side query
//   GET  /queries/{id}                                     poll until ready
//   GET  /queries/{id}/devices/{deviceid}/chunks/{hour}    Arrow IPC, full resolution
//   DELETE /queries/{id}                                   release
//
// V3 skips the /preview endpoint. Preview is downsampled JSON built for V2's
// POJO path; the dot trace wants full-resolution binary, which is what the chunk
// endpoint already serves.

import { getPlaybackApiBase } from '../../config/apiConfig';

const FALLBACK_BASE = '/Monitoring/api/PlaybackV2';

// Kept as a named export for callers that only need something to log or display.
// Every request goes through resolveBase() instead, so a stale value here can
// never send a request to the wrong backend.
export const PLAYBACK_BASE = FALLBACK_BASE;

let basePromise = null;

function resolveBase() {
  if (!basePromise) {
    basePromise = getPlaybackApiBase()
      .then((base) => (base ? `/Monitoring${base}` : FALLBACK_BASE))
      .catch(() => FALLBACK_BASE);
  }
  return basePromise;
}

/**
 * Datetimes from the pickers are naive local strings ("2026-08-12T06:00").
 * The whole system is WITA (UTC+8) and the backend expects an explicit offset;
 * this is the same normalisation cycleTimeStore.js:51 applies. Getting this
 * wrong silently shifts every timestamp by 8 hours, so it lives in exactly one
 * place.
 */
export function withWitaOffset(value) {
  if (!value) return value;
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return value;
  return `${value.length === 16 ? `${value}:00` : value}+08:00`;
}

async function asJson(response) {
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function resolveDevices(district, unitNos, signal) {
  const result = await asJson(await fetch(`${await resolveBase()}/devices/resolve`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ district, unitNos }),
  }));
  return (result.devices || [])
    .map((d) => ({ deviceId: d.deviceid || d.deviceId, unitNo: d.unitno || d.unitNo }))
    .filter((d) => d.deviceId);
}

export async function createQuery({ district, deviceIds, startDateTime, endDateTime }, signal) {
  return asJson(await fetch(`${await resolveBase()}/queries`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      district,
      deviceIds,
      startDateTime: withWitaOffset(startDateTime),
      endDateTime: withWitaOffset(endDateTime),
    }),
  }));
}

export async function getStatus(queryId, signal) {
  return asJson(await fetch(`${await resolveBase()}/queries/${queryId}`, { signal, cache: 'no-store' }));
}

export async function cancelQuery(queryId) {
  if (!queryId) return;
  try {
    await fetch(`${await resolveBase()}/queries/${queryId}`, { method: 'DELETE', cache: 'no-store' });
  } catch {
    // best effort — the server expires queries on its own
  }
}

/**
 * Poll until the query reaches a terminal state.
 * `onProgress` is called on every poll so the UI can show real progress rather
 * than an indeterminate spinner.
 */
export async function waitUntilReady(queryId, created, { signal, onProgress } = {}) {
  let status = created;
  while (!['ready', 'failed', 'cancelled'].includes(status.state)) {
    await new Promise((r) => setTimeout(r, status.state === 'queued' ? 700 : 1000));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    status = await getStatus(queryId, signal);
    onProgress?.(status);
  }
  if (status.state !== 'ready') throw new Error(status.message || `Query ${status.state}`);
  // V3 answers "ready" synchronously on create, with devices/availableHours
  // nested under `preview` instead of flat (that shape only exists on
  // GET /queries/{id}, which this ready-on-create path never calls). Lift them
  // to top level so callers can read status.devices / status.availableHours
  // the same way regardless of which path produced `status`.
  if (status.preview) {
    return {
      ...status,
      devices: status.preview.devices || [],
      availableHours: status.preview.availableHours || [],
    };
  }
  return status;
}

/**
 * Fetch one hour for EVERY device in the query as a single Arrow IPC ArrayBuffer.
 *
 * One request per hour rather than per device-hour: the per-device form turned a
 * 137-unit selection into 274 round trips, which dominated load time by an order
 * of magnitude over the query itself. Devices are identified inside the stream by
 * `device_index` — their position in the `devices` array from the query response.
 *
 * `stride` thins the result server-side, so a range wide enough to exceed the
 * client's sample budget costs proportionally less to transfer instead of being
 * downloaded in full and decimated on arrival.
 *
 * An empty hour comes back as a valid Arrow stream with no rows, so there is no
 * 204 case here.
 */
export async function fetchHourChunk(queryId, witaHour, stride, signal) {
  const query = stride > 1 ? `?stride=${stride}` : '';
  const url = `${await resolveBase()}/queries/${queryId}/chunks/${encodeURIComponent(witaHour)}${query}`;
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`chunk ${response.status}`);
  return response.arrayBuffer();
}
