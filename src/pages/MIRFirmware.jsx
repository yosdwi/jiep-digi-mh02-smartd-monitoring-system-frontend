import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { T } from '../components/mir/operasi/mirTokens';
import { Pill, SummaryStrip, FilterChips, FwStateBadge, MiniBar, DataState } from '../components/mir/devices/MirDeviceBits';
import MirDeviceWorkspace from '../components/mir/devices/MirDeviceWorkspace';
import { MIR_ALERT_API_BASE } from '../config/mirAlertConfig';
import * as api from '../services/mirDeviceApi';

// Layar FIRMWARE (port wireframe-firmware.html) — OTA per-TYPE (rover/cabin).
// Kiri: pustaka versi + upload. Kanan: monitor penyebaran (device × keadaan). REAL via /api/mir/firmware/*.
const POLL_MS = 8000;
const FILTER = [
  { key: 'all', label: 'Semua' }, { key: 'prog', label: 'Berjalan' }, { key: 'fail', label: 'Gagal' }, { key: 'lag', label: 'Tertinggal' },
];

// state device-agent → kategori UI rollout.
function stateCat(s) {
  const v = (s || '').toLowerCase();
  if (/instal|terpasang|done|ok|verified/.test(v)) return 'done';
  if (/download|unduh|verif|prog|fetch/.test(v)) return 'prog';
  if (/fail|gagal|error/.test(v)) return 'fail';
  return 'idle';
}
const STATE_LABEL = { done: 'terpasang', prog: 'mengunduh', fail: 'gagal', idle: 'diam' };
const fmtAgo = (sec) => { if (!sec) return '—'; const s = Math.max(0, Math.round(Date.now() / 1000 - Number(sec))); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}j`; };

export default function MIRFirmware() {
  const [type, setType] = useState('rover');
  const [state, setState] = useState({ loading: true, error: null });
  const [lib, setLib] = useState({ active_version: null, firmwares: [] });
  const [devices, setDevices] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selVer, setSelVer] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [list, devs] = await Promise.all([api.fetchFirmwareList(type), api.fetchFirmwareDevices(type)]);
      setLib({ active_version: list.active_version, firmwares: list.firmwares || [] });
      setDevices(devs.devices || []);
      setState({ loading: false, error: null });
    } catch (e) {
      setState({ loading: false, error: e.message });
    }
  }, [type]);

  useEffect(() => {
    setState({ loading: true, error: null }); setSelVer(null);
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const target = lib.active_version;
  const rollout = useMemo(() => devices.map((d) => ({
    id: d.device_id, current: d.current_version || '—', target: target || '—',
    cat: stateCat(d.state), label: d.reported === false || d.reported === 'false' ? 'belum melapor' : (STATE_LABEL[stateCat(d.state)] || d.state),
    err: d.last_error || '—', confirm: fmtAgo(d.updated_at),
    lagging: Boolean(target && d.current_version && d.current_version !== target),
  })), [devices, target]);

  const stats = useMemo(() => {
    const c = (cat) => rollout.filter((r) => r.cat === cat).length;
    return [{ n: c('done'), l: 'Terpasang' }, { n: c('prog'), l: 'Mengunduh' }, { n: c('fail'), l: 'Gagal' }, { n: c('idle'), l: 'Belum melapor' }];
  }, [rollout]);
  const installed = stats[0].n;

  const rolloutFiltered = rollout.filter((r) => filter === 'all' ? true : filter === 'lag' ? r.lagging : r.cat === filter);

  const activate = async (version) => {
    setBusy(true);
    try { await api.activateFirmware(type, version); await load(); }
    catch (e) { alert(`Gagal aktifkan: ${e.message}`); }
    setBusy(false);
  };
  const onUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try { const r = await api.uploadFirmware(type, file); await load(); alert(`Upload ${r.deduped ? '(dedup) ' : ''}ok: ${type} ${r.version}`); }
    catch (err) { alert(`Gagal upload: ${err.message}`); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const openDevice = openId ? {
    id: openId, title: openId, type: type === 'rover' ? 'Rover' : 'Cabin', group: '—',
    meta: `${type === 'rover' ? 'Rover' : 'Cabin'} · firmware`, fwType: type,
    services: [{ name: 'geofence', state: 'ok' }, { name: 'telemetry', state: 'ok' }],
  } : null;

  return (
    <Box sx={{ height: '100%', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', background: T.w, fontFamily: T.ff }}>
      {/* subbar: type switch + active banner */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, p: '11px 14px', borderBottom: `1px solid ${T.line}` }}>
        <Box sx={{ display: 'flex', border: `1px solid ${T.g3}`, borderRadius: '5px', overflow: 'hidden' }}>
          {['rover', 'cabin'].map((tp) => (
            <Box key={tp} component="button" onClick={() => setType(tp)}
              sx={{ border: 'none', px: 2, py: 0.9, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize',
                background: type === tp ? T.ink : T.w, color: type === tp ? '#fff' : T.g6 }}>{tp}</Box>
          ))}
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${T.g3}`, borderRadius: '6px', p: '8px 14px', background: T.g0 }}>
          <Box><Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: T.g5 }}>Versi aktif</Box>
            <Box sx={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700 }}>{type} {target || '—'}</Box></Box>
          <Box><Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: T.g5 }}>Perangkat</Box>
            <Box sx={{ fontFamily: T.mono, fontSize: 13 }}>{installed}/{devices.length} terpasang</Box></Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '330px 1fr', minHeight: 0, position: 'relative' }}>
        {/* version library */}
        <Box sx={{ borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ p: '11px 14px', borderBottom: `1px solid ${T.line}`, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5 }}>
            Pustaka versi — {type}
          </Box>
          <Box onClick={() => fileRef.current?.click()}
            sx={{ m: '12px 14px', border: `1.5px dashed ${T.g4}`, borderRadius: '6px', p: 2, textAlign: 'center', color: T.g5, fontSize: 12, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            ⇪ <b style={{ color: T.g6 }}>Tarik .zip bundle</b> / klik untuk upload<br />
            <span style={{ fontSize: 10 }}>checksum dihitung &amp; dedup otomatis</span>
            <input ref={fileRef} type="file" accept=".zip" hidden onChange={onUpload} />
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.75, pb: 1.75 }}>
            <DataState loading={state.loading && lib.firmwares.length === 0} error={state.error}
              empty={!state.loading && lib.firmwares.length === 0} emptyText="Belum ada versi terunggah.">
              {lib.firmwares.map((f) => {
                const active = f.version === target;
                const on = selVer === f.version;
                return (
                  <Box key={f.version} onClick={() => setSelVer(f.version)}
                    sx={{ border: `1px solid ${on ? T.sel : T.g1}`, background: on ? T.selBg : T.w, borderRadius: '5px', p: '11px 12px', mb: 1, cursor: 'pointer' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ fontFamily: T.mono, fontWeight: 700, fontSize: 14 }}>{f.version}</Box>
                      {active && <Pill solid>aktif</Pill>}
                    </Box>
                    <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5, mt: 0.6, lineHeight: 1.5 }}>
                      sha {String(f.sha256 || '').slice(0, 6)}… · {f.size ? `${(Number(f.size) / 1e6).toFixed(1)} MB` : '—'}<br />
                      {f.uploaded_by || '—'} · {fmtAgo(f.uploaded_at)} lalu{f.notes ? <><br />“{f.notes}”</> : null}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 1.1 }}>
                      {active ? (
                        <Box component="button" disabled sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.25, py: 0.6, fontSize: 11, color: T.g5 }}>current</Box>
                      ) : (
                        <Box component="button" disabled={busy} onClick={(e) => { e.stopPropagation(); activate(f.version); }}
                          sx={{ border: `1px solid ${T.ink}`, background: T.ink, color: '#fff', borderRadius: '4px', px: 1.25, py: 0.6, fontSize: 11, cursor: 'pointer' }}>✓ Aktifkan</Box>
                      )}
                      <Box component="a" href={`${MIR_ALERT_API_BASE}/firmware/download/${type}/${encodeURIComponent(f.version)}`} onClick={(e) => e.stopPropagation()}
                        sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.25, py: 0.6, fontSize: 11, color: T.g6, textDecoration: 'none' }}>⤓ Unduh</Box>
                    </Box>
                  </Box>
                );
              })}
            </DataState>
          </Box>
        </Box>

        {/* rollout monitor */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '11px 14px', borderBottom: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
            <Box sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5 }}>Penyebaran — {type} {target || '—'}</Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}><FilterChips chips={FILTER} value={filter} onChange={setFilter} /></Box>
          </Box>
          <SummaryStrip items={stats} big={18} />
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <DataState loading={state.loading && devices.length === 0} error={state.error}
              empty={!state.loading && devices.length === 0} emptyText="Belum ada device melapor status firmware.">
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <Box component="thead" sx={{ '& th': { position: 'sticky', top: 0, background: T.g0, textAlign: 'left', p: '9px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: T.g5, borderBottom: `1px solid ${T.line}` } }}>
                  <tr><th>Perangkat</th><th>Saat ini</th><th>Target</th><th>Keadaan</th><th>Kemajuan</th><th>Error terakhir</th><th>Konfirmasi</th></tr>
                </Box>
                <Box component="tbody" sx={{ '& td': { p: '10px 12px', borderBottom: `1px solid ${T.g1}`, whiteSpace: 'nowrap' }, '& tr': { cursor: 'pointer' }, '& tr:hover': { background: T.g0 } }}>
                  {rolloutFiltered.map((r) => (
                    <Box component="tr" key={r.id} onClick={() => setOpenId(r.id)}>
                      <td style={{ fontWeight: 600, color: T.ink }}>{r.id}</td>
                      <td style={{ fontFamily: T.mono }}>{r.current}</td>
                      <td style={{ fontFamily: T.mono }}>{r.target}</td>
                      <td><FwStateBadge state={r.cat} label={r.label} /></td>
                      <td><MiniBar pct={r.cat === 'done' ? 100 : r.cat === 'fail' ? 100 : r.cat === 'prog' ? 50 : 0} /></td>
                      <td style={{ fontFamily: T.mono, fontSize: 10, color: r.err !== '—' ? T.crit : T.g5 }}>{r.err}</td>
                      <td style={{ fontFamily: T.mono }}>{r.confirm}</td>
                    </Box>
                  ))}
                </Box>
              </Box>
            </DataState>
          </Box>
        </Box>

        {openDevice && <MirDeviceWorkspace device={openDevice} initialTab="fw" onClose={() => setOpenId(null)} />}
      </Box>
    </Box>
  );
}
