import { create } from 'zustand';
import axios from 'axios';
import {
  MIR_ALERT_API_BASE,
  MIR_ALERT_TRANSPORT,
  MIR_ALERT_HUB,
  MIR_ALERT_POLL_MS,
} from '../config/mirAlertConfig';

// Axios khusus alert layer (base bisa cross-origin ke mock) — tak ganggu axios global.
const api = axios.create({ baseURL: MIR_ALERT_API_BASE });

const isActive = (a) => a.status === 'NEW';
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
const truthy = (v) => v === '1' || v === 1 || v === true;

// ts → epoch ms. Toleran dua kontrak: mir-web (epoch detik/ms, string) & .NET (ISO datetime).
const tsToMs = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v);
    return n < 1e12 ? n * 1000 : n; // detik → ms
  }
  const t = Date.parse(v); // ISO (.NET)
  return Number.isNaN(t) ? null : t;
};

export const fmtTs = (ts) => {
  const ms = tsToMs(ts);
  if (ms == null) return '';
  return new Date(ms).toTimeString().slice(0, 8);
};

// Normalisasi hash mentah (string-string dari Redis/mir-web) → objek alert dipakai UI.
function mapAlert(a, viewedIds) {
  const id = a.event_id;
  const type = a.type || 'WARNING';
  const isCrossing = type === 'CROSSING';
  const minDist = numOrNull(a.min_distance);
  const dist = numOrNull(a.distance);
  return {
    id,
    unit: a.unitno || a.deviceid || id,
    deviceId: a.deviceid || '',
    type,
    status: a.status || 'NEW',
    viewed: viewedIds.includes(id),
    hasEvidence: truthy(a.has_evidence),
    tsStart: tsToMs(a.ts_start),
    tsEnd: tsToMs(a.ts_end),
    tsLabel: fmtTs(a.ts_start),
    lat: numOrNull(a.lat),
    lon: numOrNull(a.lon),
    areaCode: a.area_code || '',
    distance: dist,
    minDistance: minDist,
    durationS: numOrNull(a.duration_s),
    maxSpeed: numOrNull(a.max_speed),
    // ringkasan tampil
    peak: isCrossing
      ? (minDist != null ? minDist.toFixed(1) : '—') + ' m'
      : (dist != null ? dist.toFixed(1) : '—') + ' m (band)',
    dur: a.duration_s ? Number(a.duration_s) + ' dtk' : '—',
    spd: a.max_speed != null && a.max_speed !== '' ? Number(a.max_speed).toFixed(0) + ' km/h' : '—',
    evidence: a.evidence || null,
  };
}

let _conn = null; // EventSource | SignalR HubConnection
let _starting = false; // guard StrictMode double-invoke
let _pollTimer = null;
let _refreshTimer = null;
let _telemetryTimer = null; // poll fallback telemetry live (saat hub mati)

const useMirAlertStore = create((set, get) => ({
  alerts: [],
  activeCount: 0,
  selectedId: null,
  selected: null, // detail (join evidence bila crossing)
  loadingDetail: false,
  dismissedToastIds: [],
  viewedIds: [], // read-flag lokal (≠ status), bertahan lintas fetch
  connected: false,
  error: null,
  // Telemetry live (latest-only) — sumber Redis via .NET (mir:dev/rover:*:latest).
  // Transport: SignalR event `telemetry` (push ~1s) + REST /cabins|rovers/live (fallback/snapshot).
  // Gantikan subscribe MQTT ws:9001 langsung (project_mir_telemetry_transport).
  cabinsLive: [],
  roversLive: [],

  // Catatan: turunan (active/crossing/toast) dihitung di komponen via useMemo —
  // JANGAN bikin selector yg return array baru (getSnapshot loop).

  fetchAlerts: async () => {
    try {
      const { data } = await api.get('/alerts');
      const viewedIds = get().viewedIds;
      const alerts = (data.alerts || []).map((a) => mapAlert(a, viewedIds));
      set({
        alerts,
        activeCount: data.active_count ?? alerts.filter(isActive).length,
        error: null,
      });
    } catch (err) {
      console.warn('[mirAlert] fetchAlerts gagal:', err.message);
      set({ error: 'Gagal memuat alert MIR.' });
    }
  },

  fetchOne: async (id) => {
    set({ loadingDetail: true });
    try {
      const { data } = await api.get('/alerts/' + encodeURIComponent(id));
      set({ selected: mapAlert(data, get().viewedIds), loadingDetail: false });
    } catch (err) {
      console.warn('[mirAlert] fetchOne gagal:', err.message);
      set({ loadingDetail: false });
    }
  },

  selectAlert: async (id) => {
    get().markViewed(id);
    set({ selectedId: id });
    await get().fetchOne(id);
  },

  clearSelection: () => set({ selectedId: null, selected: null }),

  markViewed: (id) => {
    set((s) => ({
      viewedIds: s.viewedIds.includes(id) ? s.viewedIds : [...s.viewedIds, id],
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, viewed: true } : a)),
    }));
  },

  markAllViewed: () => {
    set((s) => ({
      viewedIds: Array.from(new Set([...s.viewedIds, ...s.alerts.map((a) => a.id)])),
      alerts: s.alerts.map((a) => ({ ...a, viewed: true })),
    }));
  },

  dismissToast: (id) =>
    set((s) => ({ dismissedToastIds: [...s.dismissedToastIds, id] })),

  validate: async (id, status, note = '') => {
    try {
      await api.post(
        '/alerts/' + encodeURIComponent(id) + '/validate',
        { status, note },
        { headers: { 'X-Updated-By': 'noc' } }
      );
      // optimistic: update lokal lalu refresh (realtime juga akan push)
      set((s) => ({
        alerts: s.alerts.map((a) => (a.id === id ? { ...a, status, viewed: true } : a)),
        selected: s.selected && s.selected.id === id ? { ...s.selected, status } : s.selected,
      }));
      await get().fetchAlerts();
    } catch (err) {
      console.warn('[mirAlert] validate gagal:', err.message);
      set({ error: 'Gagal mengirim validasi.' });
    }
  },

  // Bulk validate: { unit, type?, status, note } atau { event_ids:[], status, note }
  // Dipakai layar Peringatan — grup "X semua" + multi-select checkbox.
  validateBulk: async (body) => {
    try {
      await api.post('/alerts/validate-bulk', body, { headers: { 'X-Updated-By': 'noc' } });
      // optimistic: jika event_ids eksplisit, update lokal langsung
      if (Array.isArray(body.event_ids) && body.event_ids.length) {
        const ids = new Set(body.event_ids);
        set((s) => ({
          alerts: s.alerts.map((a) => (ids.has(a.id) ? { ...a, status: body.status, viewed: true } : a)),
        }));
      }
      await get().fetchAlerts();
    } catch (err) {
      console.warn('[mirAlert] validateBulk gagal:', err.message);
      set({ error: 'Gagal mengirim validasi massal.' });
    }
  },

  // Snapshot telemetry live (REST) — dipakai sbg fallback saat hub mati + sekali saat connect.
  fetchTelemetry: async () => {
    const [c, r] = await Promise.allSettled([api.get('/cabins/live'), api.get('/rovers/live')]);
    const patch = {};
    if (c.status === 'fulfilled') patch.cabinsLive = c.value.data.cabins || [];
    if (r.status === 'fulfilled') patch.roversLive = r.value.data.rovers || [];
    if (Object.keys(patch).length) set(patch);
  },

  // ── realtime: SSE (mock) atau SignalR (.NET). Fallback poll. Tanpa polling rapat (M3). ──
  connectRealtime: async () => {
    if (_conn || _starting) return;
    _starting = true;

    const scheduleRefresh = () => {
      clearTimeout(_refreshTimer);
      _refreshTimer = setTimeout(async () => {
        await get().fetchAlerts();
        // TASK 3 — ESCALATE: alert bisa naik severity (WARNING→CROSSING) in-place (same event_id).
        // Setelah fetchAlerts refresh list, refresh juga `selected` (detail terbuka) bila event_id
        // ada di list terbaru — supaya badge/severity di detail panel ikut update tanpa close-reopen.
        const sid = get().selectedId;
        if (sid) await get().fetchOne(sid);
      }, 400);
    };
    const startPollFallback = () => {
      clearInterval(_pollTimer);
      _pollTimer = setInterval(() => get().fetchAlerts(), MIR_ALERT_POLL_MS);
      _conn = { close: () => {} }; // sentinel: tetap "tersambung" (poll) → blokir re-entry
    };

    try {
      if (MIR_ALERT_TRANSPORT === 'signalr') {
        const signalR = await import('@microsoft/signalr');
        const hub = new signalR.HubConnectionBuilder()
          .withUrl(MIR_ALERT_HUB)
          .withAutomaticReconnect()
          .build();
        hub.on('alert', scheduleRefresh);
        // Telemetry live push (~1s) — payload { cabins:[], rovers:[], ts_ms }.
        hub.on('telemetry', (p) => set({
          cabinsLive: Array.isArray(p?.cabins) ? p.cabins : [],
          roversLive: Array.isArray(p?.rovers) ? p.rovers : [],
        }));
        hub.onreconnected(() => set({ connected: true }));
        hub.onclose(() => set({ connected: false }));
        _conn = hub; // set sebelum start() agar guard StrictMode efektif
        await hub.start();
        set({ connected: true });
      } else {
        // SSE (default, mock mir-web). EventSource = sinkron → guard langsung aktif.
        const es = new EventSource(MIR_ALERT_API_BASE + '/stream');
        es.addEventListener('alert', scheduleRefresh);
        es.onopen = () => set({ connected: true });
        es.onerror = () => set({ connected: false }); // auto-reconnect bawaan EventSource
        _conn = es;
      }
    } catch (err) {
      console.warn('[mirAlert] realtime gagal → poll fallback:', err.message);
      startPollFallback();
    } finally {
      _starting = false;
    }

    get().fetchAlerts(); // snapshot awal (realtime push akan refresh berikutnya)

    // Telemetry: snapshot awal + poll fallback (hanya saat hub mati; push handle saat connected).
    get().fetchTelemetry();
    clearInterval(_telemetryTimer);
    _telemetryTimer = setInterval(() => { if (!get().connected) get().fetchTelemetry(); }, MIR_ALERT_POLL_MS);
  },

  disconnectRealtime: () => {
    _starting = false;
    clearTimeout(_refreshTimer);
    clearInterval(_pollTimer);
    clearInterval(_telemetryTimer);
    _pollTimer = null;
    _telemetryTimer = null;
    if (_conn) {
      try {
        if (typeof _conn.close === 'function') _conn.close();
        else if (typeof _conn.stop === 'function') _conn.stop();
      } catch (_) { /* noop */ }
      _conn = null;
    }
    set({ connected: false });
  },
}));

export default useMirAlertStore;
