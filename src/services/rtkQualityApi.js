const BASE = '/Monitoring/api/RTKQuality';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.title || `RTK Quality API ${response.status}`);
  }
  return body;
}

export const fetchRtkDevices = (signal) => request('/devices', { signal });

export const fetchRtkData = (payload, signal) => request('/data', {
  method: 'POST',
  body: JSON.stringify(payload),
  signal,
});

