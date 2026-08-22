// Konfigurasi alert layer MIR (kontrak §7).
// Backend sekarang .NET :42070 (SignalR). Override via env kalau perlu balik ke SSE mock.
const env = import.meta.env;

// Base relative → di-proxy vite ke origin backend (lihat vite.config.js).
export const MIR_ALERT_API_BASE = env.VITE_MIR_ALERT_API || '/api/mir';

// 'signalr' (.NET) | 'sse' (mock mir-web :43100)
export const MIR_ALERT_TRANSPORT = env.VITE_MIR_ALERT_TRANSPORT || 'signalr';

// Path SignalR hub saat transport=signalr.
export const MIR_ALERT_HUB = env.VITE_MIR_ALERT_HUB || '/hubs/mir';

// Polling fallback (ms) saat realtime mati / belum terkoneksi.
export const MIR_ALERT_POLL_MS = Number(env.VITE_MIR_ALERT_POLL_MS || 8000);
