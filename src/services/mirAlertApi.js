// Service alert-layer MIR — fetch alerts, validate single, validate-bulk.
// Melengkapi mirAlertStore (yang pakai axios); ini pakai fetch langsung agar bisa dipakai
// dari komponen tanpa store sebagai perantara (bulk validate dari MIRAlerts.jsx).
import { MIR_ALERT_API_BASE } from '../config/mirAlertConfig';

const BASE = MIR_ALERT_API_BASE; // '/api/mir'

async function getJSON(path, opts) {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-store', ...opts });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function postJSON(path, body, headers) {
  return getJSON(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Updated-By': 'noc', ...(headers || {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

// GET /api/mir/alerts?status=&unit=&type=&from=&to=
export const fetchAlerts = (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.unit) q.set('unit', params.unit);
  if (params.type) q.set('type', params.type);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const qs = q.toString();
  return getJSON(`/alerts${qs ? '?' + qs : ''}`);
};

// GET /api/mir/alerts/{event_id}/evidence → { pre:[], on:[] }
export const fetchEvidence = (eventId) => getJSON(`/alerts/${encodeURIComponent(eventId)}/evidence`);

// GET /api/mir/geofence → area[]
export const fetchGeofence = () => getJSON('/geofence');

// POST /api/mir/alerts/{event_id}/validate {status, note}
export const validateAlert = (eventId, status, note = '') =>
  postJSON(`/alerts/${encodeURIComponent(eventId)}/validate`, { status, note });

// POST /api/mir/alerts/validate-bulk
// Untuk grup ("X semua"): { unit, type?, status, note }
// Untuk multi-select: { event_ids: [...], status, note }
// Mengembalikan { ok, status, count, event_ids:[] }
export const validateBulk = (body) =>
  postJSON('/alerts/validate-bulk', body);
