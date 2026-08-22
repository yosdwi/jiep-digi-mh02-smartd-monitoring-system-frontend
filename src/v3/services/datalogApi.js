import axios from 'axios';

// Datalog Record over ClickHouse.
//
// V1/V2/V3 share one request and response contract — the page switches engine by
// base path alone. That is deliberate on the server side, so this client keeps
// the base configurable rather than hardcoding V3 and forcing a code change to
// fall back.

const BASE = '/Monitoring/api/DatalogRecordV3';

export async function searchDatalog(request, signal) {
  const response = await axios.post(`${BASE}/search`, request, { signal });
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Gagal mengambil datalog.');
  }
  return response.data;
}

/**
 * The API returns numbers, ISO timestamps and booleans as-is. Formatting by
 * declared column type keeps a coordinate at full precision while a metric stays
 * readable — and keeps every number on tabular figures so columns do not reflow
 * as digits change.
 */
export function formatCell(value, type) {
  if (value === null || value === undefined || value === '') return '—';

  switch (type) {
    case 'datetime': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    case 'geo':
      // Six decimals is ~0.1 m. Rounding further would merge samples that the
      // trace genuinely distinguishes.
      return Number.isFinite(Number(value)) ? Number(value).toFixed(6) : String(value);
    case 'number': {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return Number.isInteger(n) ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    }
    case 'boolean':
      return value === true || value === 1 || value === '1' ? 'ya' : 'tidak';
    default:
      return String(value);
  }
}

export const isNumericType = (type) => type === 'number' || type === 'geo';
