// Service untuk layar Device Service Management — bicara ke monitor-system .NET
// (/Monitoring/api/ServiceManagement/*, di-proxy vite ke MONITOR_BACKEND). Backend membaca
// control plane Redis per-distrik (svc:*) yang dipublish servicewatcher.py di device.
// Password menu disimpan di backend; frontend hanya mengirim yang diketik user (tidak hardcode).

const DEFAULT_ROOT = 'http://smartd-mh02-brcb.apps.pamapersada.net/deviceservices';
const configuredRoot = import.meta.env.VITE_SVCMGMT_BASE || DEFAULT_ROOT;
const BASE = configuredRoot.replace(/\/$/, '').replace(/\/api$/, '') + '/api';
const PW_KEY = 'svcmgmt_pw';

export const getStoredPassword = () => sessionStorage.getItem(PW_KEY) || '';
export const setStoredPassword = (pw) => sessionStorage.setItem(PW_KEY, pw);
export const clearStoredPassword = () => sessionStorage.removeItem(PW_KEY);

async function getJSON(path, opts) {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-store', ...opts });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!r.ok) throw new Error(data?.error || `${r.status} ${r.statusText}`);
  return data;
}

async function postJSON(path, body, headers) {
  return getJSON(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

// → { ok: boolean }
export const verifyPassword = (password) =>
  postJSON('/verify', { password });

// → { districts: string[] }
export const fetchDistricts = () =>
  getJSON('/districts');

// → { district, devices: [{ deviceId, unitNo, online, ts, epoch, ageSeconds, services:[{name,base,version,status}] }] }
export const fetchDevices = (district) =>
  getJSON(`/devices?district=${encodeURIComponent(district)}`);

// → { ok, reqId, ... }
export const sendCommand = (district, deviceId, service, action) =>
  postJSON('/command', { district, deviceId, service, action }, { 'X-Mgmt-Password': getStoredPassword() });

// → ack JSON { ok, status, ... } | { pending: true }
export const fetchAck = (district, deviceId, reqId) =>
  getJSON(`/ack?district=${encodeURIComponent(district)}&deviceId=${encodeURIComponent(deviceId)}&reqId=${encodeURIComponent(reqId)}`);

export const fetchLogFiles = (deviceIp) =>
  getJSON(`/logfiles?deviceIp=${encodeURIComponent(deviceIp)}`);

export const fetchLog = (deviceIp, service, file) => {
  const q = `/log?deviceIp=${encodeURIComponent(deviceIp)}&service=${encodeURIComponent(service || '')}${file ? `&file=${encodeURIComponent(file)}` : ''}`;
  return getJSON(q);
};

// Poll ack sampai device membalas (atau timeout). Mengembalikan ack object | null.
export async function pollAck(district, deviceId, reqId, { tries = 12, intervalMs = 1500 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetchAck(district, deviceId, reqId).catch(() => null);
    if (res && !res.pending) return res;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
  }
  return null;
}
