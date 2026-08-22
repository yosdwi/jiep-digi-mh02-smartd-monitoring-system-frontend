// Service layar Perangkat/Firmware MIR — bicara ke SATU origin (.NET gateway) via `/api/mir/*`
// (di-proxy vite ke VITE_MIR_BACKEND). Shape = paritas golden reference server-rover.js (geofence-core),
// yang backend .NET expose dgn baca Redis (lihat dev/PROGRESS-frontend-react.md §UNTUK BACKEND).
// TANPA data dummy: fetch real; pemanggil tangani loading/empty/error.
import { MIR_ALERT_API_BASE } from '../config/mirAlertConfig';

const BASE = MIR_ALERT_API_BASE; // '/api/mir'

async function getJSON(path, opts) {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-store', ...opts });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!r.ok || data?.success === false) throw new Error(data?.error || `${r.status} ${r.statusText}`);
  return data;
}
async function postJSON(path, body, headers) {
  return getJSON(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Updated-By': 'noc', ...(headers || {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

// ── Firmware (per-type rover|cabin) ──
export const fetchFirmwareList = (type) => getJSON(`/firmware/list?type=${type}`);     // {active_version, firmwares:[]}
export const fetchFirmwareActive = (type) => getJSON(`/firmware/active?type=${type}`);  // {active:{version,...}}
export const fetchFirmwareDevices = (type) => getJSON(`/firmware/devices?type=${type}`);// {devices:[{device_id,current_version,state,last_error,...}]}
export const activateFirmware = (type, version) => postJSON(`/firmware/activate/${type}/${encodeURIComponent(version)}`);
export const uploadFirmware = (type, file, { version, notes } = {}) => {
  const qs = new URLSearchParams({ type, filename: file.name, ...(version ? { version } : {}), ...(notes ? { notes } : {}) });
  return fetch(`${BASE}/firmware/upload?${qs}`, { method: 'POST', headers: { 'X-Updated-By': 'noc' }, body: file }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`); return r.json();
  });
};

// ── Edit geofence (geofence-core via .NET proxy) ──
// Set Rover 0 satu grup → geofence-core persist config.json + regen polygon (POST /api/rover0/:group {lat,lon}).
// rover0 di FE = [lon,lat] (deck.gl); endpoint minta {lat,lon}. Balikan: {success, group, lat, lon, regen}.
export const saveRover0 = (group, lat, lon) => postJSON(`/rover0/${encodeURIComponent(group)}`, { lat, lon });

// Registry grup DINAMIS (sumber: geofence-core config + arsip SQL). Ganti hardcode A/B di FE.
// → {success, groups:[{group, line_rovers:[int], rover_0:{lat,lon}|null, has_polygon:bool}]}.
export const fetchGeofenceGroups = () => getJSON('/geofence/groups');
// Tambah/ubah grup (line_rovers anggota perimeter). Grup baru lahir tanpa Rover 0 (user taruh nanti).
export const upsertGeofenceGroup = (group, lineRovers) => postJSON('/geofence/group', { group, line_rovers: lineRovers });
// Hapus grup (geofence-core buang dari config + bersihkan polygon).
export const deleteGeofenceGroup = (group) =>
  getJSON(`/geofence/group/${encodeURIComponent(group)}`, { method: 'DELETE', headers: { 'X-Updated-By': 'noc' } });

// ── Roster / sync ──
export const fetchDeviceInventory = () => getJSON('/devices');          // server-rover parity: {devices:[{services:{svc:{has_config,snapshot,...}}}]}
export const fetchSyncStatus = () => getJSON('/sync/status');           // {server_versions, devices:[{device_id,group,device_version,server_version,age_seconds,status}]}
export const resyncDevice = (id) => postJSON(`/device/${encodeURIComponent(id)}/resync`);
export const fetchPipeline = () => getJSON('/pipeline');
export const fetchCabinsLive = () => getJSON('/cabins/live');           // {cabins:[...]}
export const fetchRoversLive = () => getJSON('/rovers/live');           // {rovers:[...]}

// ── Config per device/service ──
export const fetchDeviceConfig = (id, svc) => getJSON(`/devices/${encodeURIComponent(id)}/config/${encodeURIComponent(svc)}`);     // {config, meta:{version,updated_by,updated_at,source}}
export const fetchDeviceSnapshot = (id, svc) => getJSON(`/devices/${encodeURIComponent(id)}/snapshot/${encodeURIComponent(svc)}`); // running config di device (diff)
export const pushDeviceConfig = (id, svc, config) => postJSON(`/devices/${encodeURIComponent(id)}/config/${encodeURIComponent(svc)}`, config);
export const bulkApplyDeviceConfig = (deviceIds, service, config) => postJSON('/devices/bulk-apply', { device_ids: deviceIds, service, config });

// ── Logs per device/service ──
export const fetchServiceStatus = (id) => getJSON(`/devices/${encodeURIComponent(id)}/services/status`); // {services:[{service,liveness,process_status,listening,...}]}
export const logStreamUrl = (id, svc) => `${BASE}/devices/${encodeURIComponent(id)}/logs/${encodeURIComponent(svc)}/stream`; // EventSource SSE: {ts,level,msg}
export const setLogListen = (id, svc, on) => postJSON(`/devices/${encodeURIComponent(id)}/logs/${encodeURIComponent(svc)}/listen`, { on });
export const fetchLogHistory = (id, svc, opts = {}) => postJSON(`/devices/${encodeURIComponent(id)}/logs/${encodeURIComponent(svc)}/history`, { svc, ...opts }); // {rows:[{ts,level,msg}]}
export const sendAgentCommand = (id, cmd, svc) => postJSON(`/devices/${encodeURIComponent(id)}/agent/cmd`, { cmd, svc });

// ── Pengiriman (delivery) — sudah ada di .NET (§7, truth SQL) ──
export const fetchDelivery = () => getJSON('/delivery');                                  // {devices:[...]}
export const fetchDeviceDelivery = (id) => getJSON(`/delivery/${encodeURIComponent(id)}`);// {device, trend:[]}
export const fetchLeadtime = (id, q = '') => getJSON(`/delivery/${encodeURIComponent(id)}/leadtime${q}`); // {device_id, events:[]}
