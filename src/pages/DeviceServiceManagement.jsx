import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Select, Snackbar,
} from '@mui/material';
import { T } from '../components/mir/operasi/mirTokens';
import useUserStore from '../stores/userStore';
import * as api from '../services/serviceMgmtApi';

const POLL_MS = 6000;
const LOG_TAIL_KB = 256;

const CHIPS = [
  { key: 'all', label: 'Semua' },
  { key: 'problem', label: 'Ada masalah' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
];

const STATUS_TONE = {
  RUNNING: { label: 'running', color: '#1a7a4c' },
  STOPPED: { label: 'stopped', color: '#b42318' },
  PAUSED: { label: 'paused', color: '#a15c12' },
  UNKNOWN: { label: 'unknown', color: '#98a1b0' },
  NOT_FOUND: { label: 'not found', color: '#b42318' },
};

const sx = {
  page: { flex: 1, minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f4f5f7', color: '#1a2030', fontFamily: T.ff },
  bar: { flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 1.5, px: 2.5, py: 1.5, background: '#fff', borderBottom: '1px solid #e3e6ea', flexWrap: 'wrap' },
  fld: { display: 'flex', flexDirection: 'column', gap: 0.6 },
  lbl: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#98a1b0' },
  btn: { border: '1px solid #d3d8df', background: '#fff', borderRadius: '6px', px: 1.5, py: 0.9, fontSize: 12.5, fontWeight: 700, color: '#3d4657', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.8, whiteSpace: 'nowrap', '&:hover': { background: '#fafbfc', borderColor: '#c3c9d2' }, '&:disabled': { opacity: 0.55, cursor: 'progress' } },
  act: { border: '1px solid #d3d8df', background: '#fff', borderRadius: '5px', px: 1.1, py: 0.6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#3d4657', '&:hover': { background: '#fafbfc', borderColor: '#c3c9d2' }, '&:disabled': { color: '#c2c8d1', cursor: 'not-allowed', background: '#fafbfc' } },
};

const tone = (s) => STATUS_TONE[s] || { label: String(s || '—').toLowerCase(), color: '#98a1b0' };
const isProblem = (s) => s !== 'RUNNING';
const groupKey = (name) => String(name || '').toLowerCase().replace(/\d+$/, '') || String(name || '').toLowerCase();
const typeKey = (d) => (d.deviceType || '').trim().toUpperCase() || 'LAINNYA';
const fmtAge = (s) => {
  if (s == null || s < 0) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
};

function DotStatus({ status, optimistic }) {
  const t = tone(status);
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.7, fontSize: 11, fontWeight: 800, color: t.color, fontFamily: T.mono }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: t.color }} />
      {t.label}
      {optimistic && <Box component="span" sx={{ ml: 0.5, color: '#6b7382', fontFamily: T.ff, fontSize: 10, fontWeight: 500 }}>menunggu konfirmasi...</Box>}
    </Box>
  );
}

function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api.verifyPassword(pw);
      if (r?.ok) {
        api.setStoredPassword(pw);
        onUnlock();
      } else setErr('Password salah.');
    } catch (e2) {
      setErr(e2.message || 'Gagal verifikasi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={sx.page}>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box component="form" onSubmit={submit} sx={{ width: 360, background: '#fff', border: '1px solid #e3e6ea', borderRadius: '10px', p: '26px', boxShadow: '0 1px 2px rgba(16,24,40,.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '7px', background: '#1c2434', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>MH</Box>
            <Box sx={{ fontSize: 15, fontWeight: 800 }}>MH02 Service Management</Box>
          </Box>
          <Box sx={{ color: '#6b7382', fontSize: 12.5, lineHeight: 1.5, mb: 2 }}>Masukkan password untuk mengelola service pada device.</Box>
          <Box sx={sx.lbl}>Password</Box>
          <Box component="input" type="password" value={pw} autoFocus onChange={(e) => setPw(e.target.value)} placeholder="Password"
            sx={{ mt: 0.7, width: '100%', boxSizing: 'border-box', border: '1px solid #d3d8df', borderRadius: '7px', px: 1.4, py: 1.2, fontSize: 14, outline: 'none', '&:focus': { borderColor: '#2f5bd6', boxShadow: '0 0 0 3px #eef2fd' } }} />
          {err && <Box sx={{ color: '#b42318', fontSize: 12, mt: 1, fontFamily: T.mono }}>{err}</Box>}
          <Box component="button" type="submit" disabled={busy || !pw} sx={{ mt: 2.2, width: '100%', border: 'none', borderRadius: '7px', py: 1.3, fontSize: 14, fontWeight: 800, background: busy || !pw ? '#c2c8d1' : '#1c2434', color: '#fff', cursor: busy || !pw ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Memverifikasi...' : 'Masuk'}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function Kpi({ label, value, sub, hot }) {
  return (
    <Box sx={{ flex: 1, minWidth: 118, background: '#fff', border: '1px solid #e3e6ea', borderRadius: '8px', px: 1.7, py: 1.3, boxShadow: '0 1px 2px rgba(16,24,40,.05)' }}>
      <Box sx={sx.lbl}>{label}</Box>
      <Box sx={{ mt: 0.5, fontFamily: T.mono, fontWeight: 900, fontSize: 22, lineHeight: 1.1, color: hot ? '#b42318' : '#1a2030' }}>{value}</Box>
      <Box sx={{ minHeight: 13, fontFamily: T.mono, color: '#98a1b0', fontSize: 10.5 }}>{sub}</Box>
    </Box>
  );
}

function DeviceDrawer({ device, busy, onClose, onAction, onRestartProblems, onOpenLog }) {
  if (!device) return null;
  const services = [...(device.services || [])].sort((a, b) => Number(!!b.problem) - Number(!!a.problem) || a.name.localeCompare(b.name));
  const problems = services.filter((s) => s.problem);
  const pct = device.total ? Math.round((device.running / device.total) * 100) : 0;

  return (
    <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,.42)', zIndex: 1200, display: 'flex', justifyContent: 'flex-end' }}>
      <Box onClick={(e) => e.stopPropagation()} sx={{ width: 'min(820px,94vw)', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 32px rgba(16,24,40,.16)' }}>
        <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1.5, px: 2.2, py: 1.7, borderBottom: '1px solid #e3e6ea' }}>
          <Box>
            <Box sx={{ fontSize: 15, fontWeight: 900 }}>{device.unitNo || device.deviceId}</Box>
            <Box sx={{ fontSize: 11.5, color: '#6b7382', fontFamily: T.mono, mt: 0.2 }}>{device.deviceId} · {device.deviceIp || 'IP tidak tersedia'} · {device.deviceType || 'tanpa tipe'}</Box>
          </Box>
          <Box component="button" onClick={onClose} title="Tutup (Esc)" sx={{ ...sx.btn, ml: 'auto', width: 30, height: 30, p: 0, justifyContent: 'center' }}>×</Box>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2.2, background: '#fafbfc' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 1, mb: 1.7 }}>
            <Mini label="Koneksi" value={device.online ? 'online' : 'offline'} />
            <Mini label="Service" value={`${device.running}/${device.total} (${pct}%)`} />
            <Mini label="Bermasalah" value={problems.length} />
            <Mini label="Update" value={fmtAge(device.ageSeconds)} />
          </Box>
          <Box sx={{ background: '#fff', border: '1px solid #e3e6ea', borderRadius: '8px', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.6, py: 1.3, borderBottom: '1px solid #e3e6ea' }}>
              <Box sx={{ ...sx.lbl, color: '#6b7382' }}><b style={{ color: '#1a2030' }}>{services.length}</b> service · <b style={{ color: '#1a2030' }}>{problems.length}</b> bermasalah</Box>
              <Box component="button" onClick={() => onRestartProblems(device)} disabled={problems.length === 0 || !device.online} sx={{ ...sx.act, ml: 'auto', background: '#1c2434', borderColor: '#1c2434', color: '#fff', '&:hover': { opacity: 0.92, background: '#1c2434' } }}>
                Restart semua bermasalah ({problems.length})
              </Box>
            </Box>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {['Service', 'Versi', 'Status', 'Aksi'].map((h) => <th key={h} style={{ textAlign: h === 'Aksi' ? 'right' : 'left', padding: '8px 12px', background: '#fafbfc', borderBottom: '1px solid #e3e6ea', color: '#6b7382', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {services.map((s) => {
                  const key = `${device.deviceId}|${s.name}`;
                  const working = busy.has(key);
                  const running = s.status === 'RUNNING';
                  const stopped = s.status === 'STOPPED' || s.status === 'NOT_FOUND';
                  return (
                    <tr key={s.name} style={{ background: s.problem ? '#f9ebe9' : '#fff' }}>
                      <td style={{ width: '38%', padding: '8px 12px', borderBottom: '1px solid #e3e6ea', fontWeight: 700 }}>{s.name}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #e3e6ea', fontFamily: T.mono, color: '#6b7382' }}>{s.version || '—'}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #e3e6ea' }}><DotStatus status={s.status} optimistic={s.optimistic} /></td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #e3e6ea', textAlign: 'right' }}>
                        {working ? (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, color: '#6b7382', fontSize: 11, fontFamily: T.mono }}><CircularProgress size={12} /> proses...</Box>
                        ) : (
                          <Box sx={{ display: 'inline-flex', gap: 0.7, alignItems: 'center' }}>
                            <Box component="button" onClick={() => onOpenLog(device, s.name)} disabled={!device.deviceIp} sx={sx.act}>log</Box>
                            <Box component="button" onClick={() => onAction(device, s.name, 'start')} disabled={running} sx={{ ...sx.act, color: '#1a7a4c' }}>start</Box>
                            <Box component="button" onClick={() => onAction(device, s.name, 'stop')} disabled={stopped} sx={{ ...sx.act, color: '#b42318' }}>stop</Box>
                            <Box component="button" onClick={() => onAction(device, s.name, 'restart')} sx={{ ...sx.act, color: '#2f5bd6' }}>restart</Box>
                          </Box>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function Mini({ label, value }) {
  return (
    <Box sx={{ background: '#fff', border: '1px solid #e3e6ea', borderRadius: '7px', p: 1.2 }}>
      <Box sx={sx.lbl}>{label}</Box>
      <Box sx={{ mt: 0.4, fontFamily: T.mono, fontWeight: 900, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Box>
    </Box>
  );
}

function LogDrawer({ log, onClose, onRefresh, onFile, onAuto }) {
  if (!log) return null;
  const files = log.files?.length ? log.files : [''];
  const rawHref = log.deviceIp ? `http://${log.deviceIp}/log/${log.file || ''}` : '#';
  return (
    <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,.42)', zIndex: 1210, display: 'flex', justifyContent: 'flex-end' }}>
      <Box onClick={(e) => e.stopPropagation()} sx={{ width: 'min(760px,94vw)', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 32px rgba(16,24,40,.16)' }}>
        <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1.5, px: 2.2, py: 1.7, borderBottom: '1px solid #e3e6ea' }}>
          <Box>
            <Box sx={{ fontSize: 14, fontWeight: 900, fontFamily: T.mono }}>{log.service}</Box>
            <Box sx={{ fontSize: 11.5, color: '#6b7382', fontFamily: T.mono, mt: 0.2 }}>{log.unitNo} · {log.deviceIp}</Box>
          </Box>
          <Box component="button" onClick={onClose} sx={{ ...sx.btn, ml: 'auto', width: 30, height: 30, p: 0, justifyContent: 'center' }}>×</Box>
        </Box>
        <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1.2, px: 2.2, py: 1.1, borderBottom: '1px solid #e3e6ea', background: '#fafbfc', flexWrap: 'wrap' }}>
          <Select size="small" value={log.file || ''} onChange={(e) => onFile(e.target.value)} sx={{ minWidth: 220, fontSize: 12, background: '#fff', '& .MuiSelect-select': { py: 0.75 } }}>
            {files.map((f) => <MenuItem key={f || 'auto'} value={f} sx={{ fontSize: 12 }}>{f || '(otomatis dari service)'}</MenuItem>)}
          </Select>
          <Box component="button" onClick={() => onRefresh(log.file || undefined)} sx={sx.btn}>Refresh</Box>
          <Box component="label" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, fontSize: 12, color: '#6b7382', fontWeight: 700 }}><input type="checkbox" checked={log.auto} onChange={(e) => onAuto(e.target.checked)} /> auto</Box>
          <Box component="a" href={rawHref} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 12, fontWeight: 700, color: '#2f5bd6', textDecoration: 'none' }}>buka mentah ↗</Box>
          <Box sx={{ ml: 'auto', fontSize: 11, color: '#98a1b0', fontFamily: T.mono }}>{[log.at ? `diperbarui ${log.at}` : '', log.truncated ? `ekor ${LOG_TAIL_KB} KB` : ''].filter(Boolean).join(' · ')}</Box>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#0e1116' }}>
          {log.loading && !log.content ? (
            <LogState><CircularProgress size={24} sx={{ color: '#7aa2f7' }} /><Box>Memuat log...</Box></LogState>
          ) : log.error ? (
            <LogState err><Box sx={{ maxWidth: 420, lineHeight: 1.5 }}>{log.error}</Box><Box component="button" onClick={() => onRefresh(log.file || undefined)} sx={sx.btn}>Coba lagi</Box></LogState>
          ) : (
            <Box component="pre" sx={{ m: 0, p: 2, fontFamily: T.mono, fontSize: 12, lineHeight: 1.55, color: '#cdd6e2', whiteSpace: 'pre', tabSize: 4 }}>{log.content || '(log kosong)'}</Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function LogState({ children, err }) {
  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: err ? '#e08b84' : '#8a93a3', textAlign: 'center', p: 5 }}>{children}</Box>;
}

export default function DeviceServiceManagement() {
  const profileDistrik = useUserStore((s) => s.profile?.distrik);
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState('');
  const [devices, setDevices] = useState([]);
  const [master, setMaster] = useState({ total: 0, byType: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastOk, setLastOk] = useState(false);
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [detailId, setDetailId] = useState('');
  const [busy, setBusy] = useState(() => new Set());
  const [optimistic, setOptimisticMap] = useState(() => new Map());
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState({ open: false, severity: 'info', msg: '' });
  const [log, setLog] = useState(null);

  useEffect(() => {
    const pw = api.getStoredPassword();
    if (!pw) { setChecking(false); return; }
    api.verifyPassword(pw)
      .then((r) => { if (r?.ok) setUnlocked(true); else api.clearStoredPassword(); })
      .catch(() => api.clearStoredPassword())
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    api.fetchDistricts().then((r) => {
      const list = r?.districts || [];
      setDistricts(list);
      const preferred = (profileDistrik || '').toUpperCase();
      setDistrict((cur) => cur || (list.includes(preferred) ? preferred : list[0] || ''));
    }).catch(() => {});
  }, [unlocked, profileDistrik]);

  const rows = useMemo(() => devices.map((d) => {
    let services = (d.services || []).map((s) => {
      const o = optimistic.get(`${d.deviceId}|${s.name}`);
      if (!o) return s;
      if (Date.now() - o.at > 12000 || s.status === o.status) return s;
      return { ...s, status: o.status, optimistic: true };
    });
    const groupRunning = {};
    services.forEach((s) => { if (s.status === 'RUNNING') groupRunning[groupKey(s.name)] = true; });
    services = services.map((s) => ({ ...s, problem: isProblem(s.status) && !groupRunning[groupKey(s.name)] }));
    return {
      ...d,
      services,
      total: services.length,
      running: services.filter((s) => s.status === 'RUNNING').length,
      problems: services.filter((s) => s.problem).length,
    };
  }), [devices, optimistic]);

  const currentDevice = useCallback((id) => rows.find((d) => d.deviceId === id) || null, [rows]);

  const load = useCallback(async () => {
    if (!district) return;
    try {
      const r = await api.fetchDevices(district);
      setDevices(r?.devices || []);
      setMaster(r?.master || { total: 0, byType: {} });
      setLoading(false);
      setError(null);
      setLastOk(true);
    } catch (e) {
      setLoading(false);
      setError(e.message);
      setLastOk(false);
    }
  }, [district]);

  useEffect(() => {
    if (!unlocked || !district) return undefined;
    setLoading(true);
    setError(null);
    setOptimisticMap(new Map());
    setDetailId('');
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [unlocked, district, load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((d) => {
      if (typeFilter && typeKey(d) !== typeFilter) return false;
      if (term) {
        const hay = `${d.unitNo || ''} ${d.deviceId || ''} ${d.deviceIp || ''} ${d.deviceType || ''} ${(d.services || []).map((s) => s.name).join(' ')}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (chip === 'problem') return d.problems > 0;
      if (chip === 'online') return d.online;
      if (chip === 'offline') return !d.online;
      return true;
    }).sort((a, b) => String(a.deviceId).localeCompare(String(b.deviceId), undefined, { numeric: true, sensitivity: 'accent' }));
  }, [rows, q, chip, typeFilter]);

  const counts = useMemo(() => {
    const online = rows.filter((d) => d.online).length;
    const probDev = rows.filter((d) => d.problems > 0).length;
    return {
      all: rows.length,
      problem: probDev,
      online,
      offline: rows.length - online,
      svc: rows.reduce((a, d) => a + d.total, 0),
      probSvc: rows.reduce((a, d) => a + d.problems, 0),
    };
  }, [rows]);

  const typeCards = useMemo(() => {
    const stats = {};
    rows.forEach((d) => {
      const t = typeKey(d);
      if (!stats[t]) stats[t] = { reporting: 0, online: 0 };
      stats[t].reporting += 1;
      if (d.online) stats[t].online += 1;
    });
    const m = master.byType || {};
    const types = Array.from(new Set([...Object.keys(m), ...Object.keys(stats)]))
      .sort((a, b) => (m[b] || 0) - (m[a] || 0) || (stats[b]?.reporting || 0) - (stats[a]?.reporting || 0));
    return [{ type: '', label: 'Semua', reporting: rows.length, master: master.total || 0, online: counts.online }, ...types.map((t) => ({
      type: t, label: t === 'LAINNYA' ? 'Lainnya' : t, reporting: stats[t]?.reporting || 0, master: m[t] || 0, online: stats[t]?.online || 0,
    }))];
  }, [rows, master, counts.online]);

  const addOptimistic = (deviceId, service, status) => {
    setOptimisticMap((m) => {
      const n = new Map(m);
      n.set(`${deviceId}|${service}`, { status, at: Date.now() });
      return n;
    });
  };

  const runService = async (device, service, action) => {
    const key = `${device.deviceId}|${service}`;
    setBusy((s) => new Set(s).add(key));
    try {
      const cmd = await api.sendCommand(district, device.deviceId, service, action);
      const ack = await api.pollAck(district, device.deviceId, cmd.reqId);
      if (!ack) setToast({ open: true, severity: 'warning', msg: `${action} ${service}: terkirim, device belum membalas (mungkin offline).` });
      else if (ack.ok) {
        addOptimistic(device.deviceId, service, action === 'stop' ? 'STOPPED' : 'RUNNING');
        setToast({ open: true, severity: 'success', msg: `${action} ${service} di ${device.unitNo || device.deviceId} berhasil → ${ack.status}` });
      } else setToast({ open: true, severity: 'error', msg: `${action} ${service} gagal: ${ack.reason || 'unknown'}` });
    } catch (e) {
      setToast({ open: true, severity: 'error', msg: `Gagal mengirim perintah: ${e.message}` });
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(key); return n; });
      load();
      setTimeout(load, 2500);
    }
  };

  const runDeviceRestartProblems = async (device) => {
    const problems = (device.services || []).filter((s) => s.problem);
    if (!problems.length) return;
    setBusy((s) => { const n = new Set(s); problems.forEach((p) => n.add(`${device.deviceId}|${p.name}`)); return n; });
    try {
      await Promise.all(problems.map((p) => api.sendCommand(district, device.deviceId, p.name, 'restart').catch(() => {})));
      problems.forEach((p) => addOptimistic(device.deviceId, p.name, 'RUNNING'));
      setToast({ open: true, severity: 'success', msg: `Restart ${problems.length} service bermasalah di ${device.unitNo || device.deviceId} terkirim.` });
    } catch (e) {
      setToast({ open: true, severity: 'error', msg: `Gagal: ${e.message}` });
    } finally {
      setBusy((s) => { const n = new Set(s); problems.forEach((p) => n.delete(`${device.deviceId}|${p.name}`)); return n; });
      setTimeout(load, 1600);
    }
  };

  const runBulkRestart = async (list) => {
    const pairs = [];
    list.forEach((d) => (d.services || []).filter((s) => s.problem).forEach((s) => pairs.push({ deviceId: d.deviceId, name: s.name })));
    if (!pairs.length) return;
    setBusy((s) => { const n = new Set(s); pairs.forEach((p) => n.add(`${p.deviceId}|${p.name}`)); return n; });
    try {
      await Promise.all(pairs.map((p) => api.sendCommand(district, p.deviceId, p.name, 'restart').catch(() => {})));
      pairs.forEach((p) => addOptimistic(p.deviceId, p.name, 'RUNNING'));
      setToast({ open: true, severity: 'success', msg: `Restart ${pairs.length} service bermasalah di ${list.length} device terkirim.` });
    } catch (e) {
      setToast({ open: true, severity: 'error', msg: `Gagal: ${e.message}` });
    } finally {
      setBusy((s) => { const n = new Set(s); pairs.forEach((p) => n.delete(`${p.deviceId}|${p.name}`)); return n; });
      setTimeout(load, 1600);
    }
  };

  const openLog = async (device, service) => {
    if (!device.deviceIp) {
      setToast({ open: true, severity: 'warning', msg: 'IP unit tidak tersedia (butuh data SQL tbl_r_device).' });
      return;
    }
    setLog({ deviceId: device.deviceId, deviceIp: device.deviceIp, unitNo: device.unitNo || device.deviceId, service, file: '', files: null, loading: true, error: null, content: '', truncated: false, at: null, auto: false });
    api.fetchLogFiles(device.deviceIp).then((r) => setLog((l) => (l ? { ...l, files: r.files || [] } : l))).catch(() => {});
    fetchLogContent(device.deviceIp, service);
  };

  const fetchLogContent = async (deviceIp, service, file, silent) => {
    setLog((l) => (l ? { ...l, loading: !silent, error: null } : l));
    try {
      const r = await api.fetchLog(deviceIp, service, file);
      setLog((l) => (l ? { ...l, file: r.file || file || '', content: r.content || '', truncated: !!r.truncated, loading: false, error: null, at: new Date().toLocaleTimeString() } : l));
    } catch (e) {
      setLog((l) => (l ? { ...l, loading: false, error: e.message } : l));
    }
  };

  useEffect(() => {
    if (!log?.auto) return undefined;
    const id = setInterval(() => fetchLogContent(log.deviceIp, log.service, log.file || undefined, true), 4000);
    return () => clearInterval(id);
  }, [log?.auto, log?.deviceIp, log?.service, log?.file]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirm) setConfirm(null);
      else if (log) setLog(null);
      else if (detailId) setDetailId('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, log, detailId]);

  const doConfirm = () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === 'service') runService(c.device, c.service, c.action);
    else if (c.kind === 'device') runDeviceRestartProblems(c.device);
    else if (c.kind === 'bulk') runBulkRestart(c.devices);
  };

  if (checking) return <Box sx={sx.page}><Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={22} /></Box></Box>;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  const fProb = filtered.filter((d) => d.problems > 0);
  const detailDevice = currentDevice(detailId);

  return (
    <Box sx={sx.page}>
      <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1.3, px: 2.5, py: 1.3, background: '#fff', borderBottom: '1px solid #e3e6ea' }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '7px', background: '#1c2434', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>MH</Box>
        <Box sx={{ fontSize: 14, fontWeight: 900 }}>MH02 Service Management</Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: '#6b7382', fontSize: 12 }}><Box sx={{ width: 7, height: 7, borderRadius: '50%', background: error ? '#b42318' : lastOk ? '#1a7a4c' : '#c2c8d1' }} />{error ? 'gagal terhubung' : loading ? 'memuat...' : `live · auto ${POLL_MS / 1000}s`}</Box>
          <Box component="button" onClick={() => { api.clearStoredPassword(); setUnlocked(false); }} sx={sx.btn}>Keluar</Box>
        </Box>
      </Box>

      <Box sx={sx.bar}>
        <Box sx={sx.fld}><Box sx={sx.lbl}>Distrik</Box><Select size="small" value={district} onChange={(e) => { setDistrict(e.target.value); setTypeFilter(''); setDetailId(''); }} sx={{ minWidth: 110, fontSize: 13, background: '#fff', '& .MuiSelect-select': { py: 0.85 } }}>{districts.length === 0 && <MenuItem value="">—</MenuItem>}{districts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</Select></Box>
        <Box sx={sx.fld}><Box sx={sx.lbl}>Cari</Box><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 0.85, border: '1px solid #d3d8df', borderRadius: '6px', color: '#98a1b0', width: 290, background: '#fff' }}>⌕<Box component="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="unit / device id / ip / tipe / service..." sx={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'none', color: '#1a2030' }} /></Box></Box>
        <Box sx={sx.fld}><Box sx={sx.lbl}>Filter status</Box><Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>{CHIPS.map((c) => <Box key={c.key} component="button" onClick={() => setChip(c.key)} sx={{ ...sx.btn, py: 0.85, background: chip === c.key ? '#1c2434' : '#fff', borderColor: chip === c.key ? '#1c2434' : '#d3d8df', color: chip === c.key ? '#fff' : '#3d4657' }}>{c.label}<Box component="span" sx={{ fontFamily: T.mono, fontSize: 11, borderRadius: '4px', px: 0.7, background: chip === c.key ? 'rgba(255,255,255,.16)' : '#f4f5f7' }}>{counts[c.key]}</Box></Box>)}</Box></Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          {fProb.length > 0 && <Box component="button" onClick={() => setConfirm({ kind: 'bulk', devices: fProb })} sx={{ ...sx.btn, color: '#b42318', borderColor: '#e6bcb7' }}>Perbaiki semua <Box component="span" sx={{ fontFamily: T.mono, background: '#f9ebe9', borderRadius: '4px', px: 0.7 }}>{fProb.length}</Box></Box>}
          <Box component="button" onClick={() => { setLoading(true); load(); }} sx={sx.btn}>Muat ulang</Box>
        </Box>
      </Box>

      <Box sx={{ flex: '0 0 auto', display: 'flex', gap: 1.2, px: 2.5, pt: 1.7, pb: 0.25, flexWrap: 'wrap' }}>
        <Kpi label="Unit Master (SQL)" value={master.total || 0} sub={`${Object.keys(master.byType || {}).length} tipe unit`} />
        <Kpi label="Terpantau" value={rows.length} sub={master.total ? `dari ${master.total} master` : 'via Redis'} />
        <Kpi label="Online" value={counts.online} sub={rows.length ? `${Math.round((counts.online / rows.length) * 100)}% tersync` : ''} />
        <Kpi label="Offline" value={counts.offline} />
        <Kpi label="Total Service" value={counts.svc} />
        <Kpi label="Service Bermasalah" value={counts.probSvc} sub={`di ${counts.problem} device`} hot={counts.probSvc > 0} />
      </Box>

      <Box sx={{ flex: '0 0 auto', display: 'flex', gap: 1, px: 2.5, pt: 1.5, pb: 0.25, overflowX: 'auto', alignItems: 'stretch' }}>
        <Box sx={{ ...sx.lbl, alignSelf: 'center', whiteSpace: 'nowrap' }}>Tipe unit</Box>
        {typeCards.map((c) => {
          const active = typeFilter === c.type;
          const offline = Math.max(0, c.reporting - c.online);
          const missing = Math.max(0, c.master - c.reporting);
          return (
            <Box key={c.type || 'all'} component="button" onClick={() => setTypeFilter(active ? '' : c.type)} sx={{ flex: '0 0 auto', minWidth: 124, textAlign: 'left', background: '#fff', border: `1px solid ${active ? '#2f5bd6' : '#e3e6ea'}`, borderRadius: '8px', px: 1.5, py: 1.1, cursor: 'pointer', boxShadow: active ? '0 0 0 1px #2f5bd6' : '0 1px 2px rgba(16,24,40,.05)' }}>
              <Box sx={{ fontSize: 11, fontWeight: 900, color: '#3d4657', textTransform: 'uppercase' }}>{c.label} {active ? '✓' : ''}</Box>
              <Box sx={{ fontFamily: T.mono, fontWeight: 900, fontSize: 17, mt: 0.4 }}>{c.reporting}<Box component="span" sx={{ fontSize: 12, color: '#98a1b0' }}> / {c.master || '–'}</Box></Box>
              <Box sx={{ fontSize: 10, color: '#6b7382', mt: 0.4, fontFamily: T.mono }}>{c.online} on · {offline} off{missing > 0 ? ` · ${missing} belum sync` : ''}</Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, mx: 2.5, mt: 1.5, mb: 2.2, background: '#fff', border: '1px solid #e3e6ea', borderRadius: '8px', boxShadow: '0 1px 2px rgba(16,24,40,.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
            <thead>
              <tr>
                {['', 'Unit No', 'Device ID', 'Device IP', 'Tipe', 'Koneksi', 'Service', 'Update', 'Aksi'].map((h) => <th key={h || 'exp'} style={{ position: 'sticky', top: 0, background: '#fafbfc', textAlign: h === 'Aksi' ? 'right' : 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: '#6b7382', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap', zIndex: 2 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const open = detailId === d.deviceId;
                const pct = d.total ? Math.round((d.running / d.total) * 100) : 0;
                const anyBusy = (d.services || []).some((s) => s.problem && busy.has(`${d.deviceId}|${s.name}`));
                return (
                  <tr key={d.deviceId} onClick={() => setDetailId(d.deviceId)} style={{ cursor: 'pointer', background: open ? '#eef2fd' : '#fff' }}>
                    <td style={{ width: 30, textAlign: 'center', color: '#98a1b0', padding: '10px 14px', borderBottom: '1px solid #e3e6ea', boxShadow: d.problems > 0 ? 'inset 3px 0 0 #b42318' : 'none' }}>{open ? '▾' : '▸'}</td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap', fontWeight: 800 }}>{d.unitNo || '—'}</td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap', fontFamily: T.mono, color: '#3d4657' }}>{d.deviceId}</td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap', fontFamily: T.mono, color: d.deviceIp ? '#3d4657' : '#98a1b0' }}>{d.deviceIp || '—'}</td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap' }}><span style={{ fontSize: 10.5, fontWeight: 800, fontFamily: T.mono, color: '#3d4657', background: '#f4f5f7', border: '1px solid #e3e6ea', borderRadius: 4, padding: '1px 7px' }}>{d.deviceType || '—'}</span></td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 4, color: d.online ? '#1a7a4c' : '#6b7382', background: d.online ? '#e8f3ec' : '#f4f5f7' }}>{d.online ? '● online' : '○ offline'}</span></td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap' }}><Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.2 }}><Box sx={{ fontFamily: T.mono, fontWeight: 900, minWidth: 40 }}>{d.running}/{d.total}</Box><Box sx={{ width: 76, height: 5, borderRadius: 3, background: '#f4f5f7', overflow: 'hidden', border: '1px solid #e3e6ea' }}><Box sx={{ height: '100%', width: `${pct}%`, background: '#1a7a4c' }} /></Box>{d.problems > 0 && <Box component="span" sx={{ fontSize: 10.5, fontWeight: 900, background: '#f9ebe9', color: '#b42318', border: '1px solid #e6bcb7', borderRadius: '4px', px: 0.8 }}>{d.problems} bermasalah</Box>}</Box></td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap', fontFamily: T.mono, color: d.online && d.ageSeconds > 30 ? '#a15c12' : '#6b7382' }}>{d.online && d.ageSeconds > 30 ? `${fmtAge(d.ageSeconds)} · lama` : fmtAge(d.ageSeconds)}</td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap', textAlign: 'right' }}>{d.problems > 0 ? <Box component="button" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'device', device: currentDevice(d.deviceId) || d, action: 'restart' }); }} disabled={anyBusy} sx={{ ...sx.btn, color: '#b42318', borderColor: '#e6bcb7' }}>{anyBusy ? 'proses...' : 'Perbaiki'}</Box> : <span style={{ color: '#cfd4dc', fontSize: 14 }}>✓</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Box>
        </Box>
        {loading && devices.length === 0 && <Overlay><CircularProgress size={24} /><Box>Memuat data device...</Box></Overlay>}
        {error && <Overlay err><Box sx={{ fontWeight: 800, color: '#b42318' }}>Gagal memuat data</Box><Box sx={{ maxWidth: 460, lineHeight: 1.5 }}>{error}</Box></Overlay>}
        {!loading && !error && filtered.length === 0 && <Overlay><Box sx={{ fontWeight: 800, color: '#1a2030' }}>Tidak ada device yang cocok</Box><Box sx={{ maxWidth: 460, lineHeight: 1.5 }}>Ubah filter/pencarian, atau cek koneksi Redis distrik & device-agent (servicewatcher).</Box></Overlay>}
      </Box>

      <DeviceDrawer
        device={detailDevice}
        busy={busy}
        onClose={() => setDetailId('')}
        onAction={(device, service, action) => setConfirm({ kind: 'service', device, service, action })}
        onRestartProblems={(device) => setConfirm({ kind: 'device', device, action: 'restart' })}
        onOpenLog={openLog}
      />

      <LogDrawer
        log={log}
        onClose={() => setLog(null)}
        onRefresh={(file) => log && fetchLogContent(log.deviceIp, log.service, file)}
        onFile={(file) => { setLog((l) => (l ? { ...l, file } : l)); if (log) fetchLogContent(log.deviceIp, log.service, file); }}
        onAuto={(auto) => setLog((l) => (l ? { ...l, auto } : l))}
      />

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth sx={{ zIndex: 1400 }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 900 }}>{confirm?.kind === 'bulk' ? 'Perbaiki semua device bermasalah' : confirm?.kind === 'device' ? 'Restart service bermasalah' : `Konfirmasi ${confirm?.action}`}</DialogTitle>
        <DialogContent sx={{ fontSize: 13.5, color: '#3d4657', lineHeight: 1.55 }}>
          {confirm?.kind === 'bulk' && <>Restart <b>{confirm.devices.reduce((a, d) => a + (d.services || []).filter((s) => s.problem).length, 0)} service bermasalah</b> di <b>{confirm.devices.length} device</b> pada distrik <b>{district}</b>?</>}
          {confirm?.kind === 'service' && <>Jalankan <b>{confirm.action}</b> pada service <b>{confirm.service}</b> di unit <b>{confirm.device.unitNo || confirm.device.deviceId}</b> ({confirm.device.deviceId})?</>}
          {confirm?.kind === 'device' && <>Restart <b>semua service bermasalah</b> di unit <b>{confirm.device.unitNo || confirm.device.deviceId}</b> ({confirm.device.deviceId})?</>}
          {confirm?.device && !confirm.device.online && <Box sx={{ mt: 1.2, color: '#a15c12', fontSize: 12, background: '#f8efe1', borderRadius: '6px', px: 1.2, py: 1 }}>Unit offline — perintah menunggu di antrian sampai unit online kembali.</Box>}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #e3e6ea', background: '#fafbfc', px: 2.5, py: 1.5 }}>
          <Box component="button" onClick={() => setConfirm(null)} sx={sx.btn}>Batal</Box>
          <Box component="button" onClick={doConfirm} sx={{ ...sx.btn, background: '#1c2434', borderColor: '#1c2434', color: '#fff' }}>Ya, lanjut</Box>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ fontSize: 13 }}>{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function Overlay({ children, err }) {
  return (
    <Box sx={{ position: 'absolute', inset: 0, top: 39, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: err ? '#b42318' : '#6b7382', background: '#fff', textAlign: 'center', p: 5 }}>
      {children}
    </Box>
  );
}
