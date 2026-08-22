import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select, TextField } from '@mui/material';
import { T } from '../components/mir/operasi/mirTokens';
import { Pill, ServiceDots, SummaryStrip, FilterChips, DataState } from '../components/mir/devices/MirDeviceBits';
import MirDeviceWorkspace from '../components/mir/devices/MirDeviceWorkspace';
import * as api from '../services/mirDeviceApi';

// Layar PERANGKAT (port wireframe-devices.html) — roster fleet (sync + firmware + health) → klik baris
// = Device Workspace. Data REAL: gabung /api/mir/sync/status + /api/mir/firmware/devices (single origin .NET).
const POLL_MS = 8000;
const CHIPS = [
  { key: 'all', label: 'Semua' }, { key: 'rover', label: 'Rover' }, { key: 'cabin', label: 'Cabin' },
  { key: 'unsync', label: 'Belum sync' }, { key: 'svcdead', label: 'Service down' },
];

const inferType = (id, fwType, inv) => {
  const authoritative = String(inv?.devicetype || fwType || '').toLowerCase();
  if (authoritative === 'rover') return 'Rover';
  if (authoritative === 'cabin') return 'Cabin';
  const sid = String(id || '').toUpperCase();
  const svcNames = Object.keys(inv?.services || {}).join(' ').toLowerCase();
  if (inv?.unit_no || /^(DT|EX|HD|LV|TR|WT|CN|CABIN)/.test(sid)) return 'Cabin';
  if (/^(R|ROVER)[-_ ]?\d+/.test(sid) || svcNames.includes('rover')) return 'Rover';
  if (svcNames.includes('config-sync') || svcNames.includes('mir-publisher') || svcNames.includes('telemetry')) return 'Cabin';
  return 'Cabin';
};

function deriveServices(type, status, age, serviceMap) {
  const fromInventory = Object.entries(serviceMap || {}).map(([name, m]) => ({
    name,
    state: m.has_config ? 'ok' : m.snapshot ? 'stale' : 'dead',
    version: m.version || 0,
    updatedAt: m.updated_at || null,
    updatedBy: m.updated_by || null,
    hasConfig: Boolean(m.has_config),
    snapshot: Boolean(m.snapshot),
  }));
  if (fromInventory.length) return fromInventory.sort((a, b) => a.name.localeCompare(b.name));
  const presence = age == null ? 'dead' : age < 30 ? 'ok' : age < 300 ? 'stale' : 'dead';
  const syncState = status === 'in_sync' ? 'ok' : status === 'offline' ? 'dead' : 'stale';
  const base = [{ name: 'geofence', state: syncState }, { name: 'telemetry', state: presence }];
  if (type === 'Cabin') base.push({ name: 'config-sync', state: status === 'in_sync' ? 'ok' : presence });
  return base;
}

const SYNC_PILL = {
  in_sync: { label: 'sinkron' }, pending: { label: 'menunggu' }, stale: { label: 'usang' },
  offline: { label: 'offline' }, unknown: { label: '—' },
};

export default function MIRDevices() {
  const [state, setState] = useState({ loading: true, error: null });
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [bulk, setBulk] = useState({ open: false, service: '', draft: '{\n  "device_id": "(auto-set per device)"\n}' });
  const [restart, setRestart] = useState({ open: false, service: '' });

  const load = useCallback(async () => {
    try {
      const [sync, inventory, fwRover, fwCabin, actRover, actCabin] = await Promise.all([
        api.fetchSyncStatus(),
        api.fetchDeviceInventory().catch(() => ({ devices: [] })),
        api.fetchFirmwareDevices('rover').catch(() => ({ devices: [] })),
        api.fetchFirmwareDevices('cabin').catch(() => ({ devices: [] })),
        api.fetchFirmwareActive('rover').catch(() => ({ active: null })),
        api.fetchFirmwareActive('cabin').catch(() => ({ active: null })),
      ]);
      const fwMap = new Map();
      [...(fwRover.devices || []), ...(fwCabin.devices || [])].forEach((d) => fwMap.set(d.device_id, d));
      const invMap = new Map((inventory.devices || []).map((d) => [d.device_id, d]));
      const tgt = { rover: actRover.active?.version || null, cabin: actCabin.active?.version || null };

      const ids = new Set([...(sync.devices || []).map((d) => d.device_id), ...(inventory.devices || []).map((d) => d.device_id)]);
      const syncMap = new Map((sync.devices || []).map((d) => [d.device_id, d]));
      const merged = [...ids].map((id) => {
        const d = syncMap.get(id) || {};
        const inv = invMap.get(id) || {};
        const fw = fwMap.get(id) || {};
        const type = inferType(id, fw.type, inv);
        const fwType = fw.type || inv.devicetype || type.toLowerCase();
        const target = tgt[fwType];
        const deviceVersion = d.device_version ?? inv.polygon_version ?? null;
        const serverVersion = d.server_version ?? null;
        return {
          id,
          title: id,
          type,
          devicetype: inv.devicetype || fwType,
          unitNo: inv.unit_no || null,
          group: d.group || inv.group || '—',
          meta: `${type} · Grp ${d.group || inv.group || '—'}${inv.unit_no ? ` · unit ${inv.unit_no}` : ''}`,
          deviceVersion,
          serverVersion,
          status: d.status || (inv.online ? 'in_sync' : 'offline'),
          ageSeconds: d.age_seconds ?? (inv.last_seen_ms ? Math.floor((Date.now() - inv.last_seen_ms) / 1000) : null),
          // device_version / server_version = epoch ms (int64, e.g. 1781251168003) — CONTRACT §REVISI 2026-06-12
          syncNote: serverVersion == null
            ? (deviceVersion != null ? `device v${deviceVersion}` : 'belum ada versi')
            : deviceVersion === serverVersion
              ? `v${serverVersion}`
              : `dev:v${deviceVersion ?? '—'} < srv:v${serverVersion}`,
          fwType,
          fwVersion: fw.current_version ? `${fwType} ${fw.current_version}` : '—',
          fwTarget: target ? `${fwType} ${target}` : '—',
          fwState: fw.state || '—',
          fwLagging: Boolean(target && fw.current_version && fw.current_version !== target),
          services: deriveServices(type, d.status, d.age_seconds, inv.services),
        };
      });
      setRows(merged);
      setState({ loading: false, error: null });
    } catch (e) {
      setState({ loading: false, error: e.message });
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !`${r.id} ${r.group}`.toLowerCase().includes(term)) return false;
      if (chip === 'rover') return r.type === 'Rover';
      if (chip === 'cabin') return r.type === 'Cabin';
      if (chip === 'unsync') return r.status !== 'in_sync';
      if (chip === 'svcdead') return r.services.some((s) => s.state === 'dead');
      return true;
    });
  }, [rows, q, chip]);

  const summary = useMemo(() => [
    { n: rows.length, l: 'Perangkat' },
    { n: rows.filter((r) => r.status === 'in_sync').length, l: 'Ter-sinkron' },
    { n: rows.filter((r) => r.status === 'pending' || r.status === 'stale').length, l: 'Menunggu / usang' },
    { n: rows.filter((r) => r.services.some((s) => s.state === 'dead')).length, l: 'Layanan mati' },
    { n: rows.filter((r) => r.fwLagging).length, l: 'Firmware tertinggal' },
  ], [rows]);

  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkResync = async () => {
    const ids = [...selected];
    await Promise.allSettled(ids.map((id) => api.resyncDevice(id)));
    setSelected(new Set());
    load();
  };
  const knownServices = useMemo(() => [...new Set(rows.flatMap((r) => (r.services || []).map((s) => s.name)))].sort(), [rows]);
  const openBulkConfig = () => setBulk((b) => ({ ...b, open: true, service: b.service || knownServices[0] || '' }));
  const applyBulkConfig = async () => {
    try {
      const cfg = JSON.parse(bulk.draft);
      await api.bulkApplyDeviceConfig([...selected], bulk.service, cfg);
      setBulk((b) => ({ ...b, open: false }));
      setSelected(new Set());
      load();
    } catch (e) { alert(`Bulk config gagal: ${e.message}`); }
  };
  const openBulkRestart = () => setRestart((r) => ({ ...r, open: true, service: r.service || knownServices[0] || '' }));
  const applyBulkRestart = async () => {
    const ids = [...selected];
    await Promise.allSettled(ids.map((id) => api.sendAgentCommand(id, 'restart', restart.service)));
    setRestart((r) => ({ ...r, open: false }));
    setSelected(new Set());
  };

  const openDevice = rows.find((r) => r.id === openId) || null;

  return (
    <Box sx={{ height: '100%', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', background: T.w, fontFamily: T.ff }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {/* toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '10px 14px', borderBottom: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1.1, py: 0.75, color: T.g5, width: 240 }}>
            🔍<Box component="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="cari perangkat / unit / grup…"
              sx={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'none', color: T.ink }} />
          </Box>
          <FilterChips chips={CHIPS} value={chip} onChange={setChip} />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.9, alignItems: 'center' }}>
            <Box sx={{ fontSize: 11, color: T.g5, fontFamily: T.mono }}>{selected.size} dipilih</Box>
            <Box component="button" onClick={bulkResync} disabled={selected.size === 0}
              sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.25, py: 0.75, fontSize: 12, color: T.g6, cursor: selected.size ? 'pointer' : 'not-allowed', opacity: selected.size ? 1 : 0.4 }}>
              ⟳ Sinkron ulang polygon
            </Box>
            <Box component="button" onClick={openBulkConfig} disabled={selected.size === 0 || knownServices.length === 0}
              sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.25, py: 0.75, fontSize: 12, color: selected.size && knownServices.length ? T.g6 : T.g4, cursor: selected.size && knownServices.length ? 'pointer' : 'not-allowed' }}>⚙ Push config</Box>
            <Box component="button" onClick={openBulkRestart} disabled={selected.size === 0 || knownServices.length === 0}
              sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.25, py: 0.75, fontSize: 12, color: selected.size && knownServices.length ? T.g6 : T.g4, cursor: selected.size && knownServices.length ? 'pointer' : 'not-allowed' }}>⭯ Restart service</Box>
          </Box>
        </Box>

        <SummaryStrip items={summary} />

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <DataState loading={state.loading && rows.length === 0} error={state.error} empty={!state.loading && rows.length === 0}
            emptyText="Belum ada device report. Cek geofence-core, Redis, dan device-agent.">
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <Box component="thead" sx={{ '& th': { position: 'sticky', top: 0, background: T.g0, textAlign: 'left', p: '9px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: T.g5, borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap' } }}>
                <tr><th></th><th>Perangkat</th><th>Grup</th><th>Tipe</th><th>Sinkron polygon</th><th>Layanan</th><th>Firmware</th><th>Terakhir terlihat</th><th></th></tr>
              </Box>
              <Box component="tbody" sx={{ '& td': { p: '10px 12px', borderBottom: `1px solid ${T.g1}`, whiteSpace: 'nowrap' }, '& tr': { cursor: 'pointer' }, '& tr:hover': { background: T.g0 } }}>
                {filtered.map((r) => (
                  <Box component="tr" key={r.id} onClick={() => setOpenId(r.id)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} />
                    </td>
                    <td style={{ fontWeight: 600, color: T.ink }}>{r.id}</td>
                    <td>{r.group}</td>
                    <td>{r.type}</td>
                    <td>
                      <Pill solid={r.status === 'in_sync'}>{SYNC_PILL[r.status]?.label || r.status}</Pill>{' '}
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.g5 }}>{r.syncNote}{r.ageSeconds != null ? ` · ${r.ageSeconds}s` : ''}</span>
                    </td>
                    <td><ServiceDots services={r.services} /></td>
                    <td style={{ fontFamily: T.mono, color: r.fwLagging ? T.crit : T.ink }}>{r.fwVersion}</td>
                    <td style={{ fontFamily: T.mono, color: T.g6 }}>{r.ageSeconds != null ? `${r.ageSeconds}s` : '—'}</td>
                    <td><span style={{ color: T.sel, textDecoration: 'underline', textUnderlineOffset: 2 }}>buka ›</span></td>
                  </Box>
                ))}
              </Box>
            </Box>
          </DataState>
        </Box>

        {openDevice && <MirDeviceWorkspace device={openDevice} initialTab="ov" onClose={() => setOpenId(null)} />}
        <Dialog open={bulk.open} onClose={() => setBulk((b) => ({ ...b, open: false }))} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontSize: 16 }}>Push config ke {selected.size} device</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
            <Select size="small" value={bulk.service} onChange={(e) => setBulk((b) => ({ ...b, service: e.target.value }))}>
              {knownServices.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
            <Box sx={{ fontSize: 11, color: T.g5, fontFamily: T.mono }}>
              Server akan set <b style={{ color: T.ink }}>device_id</b> per target, increment version, publish <b style={{ color: T.ink }}>device-config:update</b>.
            </Box>
            <TextField multiline minRows={12} value={bulk.draft} onChange={(e) => setBulk((b) => ({ ...b, draft: e.target.value }))}
              inputProps={{ spellCheck: false }} sx={{ '& textarea': { fontFamily: T.mono, fontSize: 12 } }} />
          </DialogContent>
          <DialogActions>
            <Box component="button" onClick={() => setBulk((b) => ({ ...b, open: false }))} sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.5, py: 0.8, color: T.g6 }}>Batal</Box>
            <Box component="button" onClick={applyBulkConfig} sx={{ border: `1px solid ${T.ink}`, background: T.ink, color: '#fff', borderRadius: '4px', px: 1.5, py: 0.8 }}>Push</Box>
          </DialogActions>
        </Dialog>
        <Dialog open={restart.open} onClose={() => setRestart((r) => ({ ...r, open: false }))} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: 16 }}>Restart service</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
            <Select size="small" value={restart.service} onChange={(e) => setRestart((r) => ({ ...r, service: e.target.value }))}>
              {knownServices.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
            <Box sx={{ fontSize: 11, color: T.g5, fontFamily: T.mono }}>Kirim command restart ke {selected.size} device terpilih.</Box>
          </DialogContent>
          <DialogActions>
            <Box component="button" onClick={() => setRestart((r) => ({ ...r, open: false }))} sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.5, py: 0.8, color: T.g6 }}>Batal</Box>
            <Box component="button" onClick={applyBulkRestart} sx={{ border: `1px solid ${T.ink}`, background: T.ink, color: '#fff', borderRadius: '4px', px: 1.5, py: 0.8 }}>Restart</Box>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
