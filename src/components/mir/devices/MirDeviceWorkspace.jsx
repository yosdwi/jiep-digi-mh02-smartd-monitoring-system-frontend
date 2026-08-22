import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { T, rtkLabel, zoneLabel, zoneStatus } from '../operasi/mirTokens';
import { Pill, DataState } from './MirDeviceBits';
import * as api from '../../../services/mirDeviceApi';

// Device Workspace (mockup wireframe-devices §drawer) — slide-over kanan, tab:
// Ringkasan / Config / Log / Firmware / Pengiriman. Dibuka dari roster Perangkat & rollout Firmware.
// Semua pane fetch REAL (mirDeviceApi → /api/mir/*). Tanpa dummy: loading/empty/error eksplisit.
const TABS = [
  { key: 'ov', label: 'Ringkasan' },
  { key: 'cfg', label: 'Config' },
  { key: 'log', label: 'Log' },
  { key: 'fw', label: 'Firmware' },
  { key: 'del', label: 'Pengiriman' },
];

const Sect = ({ children, sx }) => (
  <Box sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, mb: 1.25, ...sx }}>{children}</Box>
);
const KV = ({ k, v }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: `1px solid ${T.g1}`, fontSize: 12, '&:last-of-type': { borderBottom: 'none' } }}>
    <Box sx={{ color: T.g5 }}>{k}</Box>
    <Box sx={{ fontFamily: T.mono, color: T.ink, textAlign: 'right' }}>{v}</Box>
  </Box>
);
const Card = ({ title, children }) => (
  <Box sx={{ border: `1px solid ${T.line}`, borderRadius: '5px', p: 1.5 }}>
    {title && <Sect sx={{ mb: 1.25 }}>{title}</Sect>}
    {children}
  </Box>
);

const fwTypeOf = (device) => (device?.devicetype || device?.fwType || device?.type || '').toLowerCase() === 'rover' ? 'rover' : 'cabin';
const fmtTs = (sec) => (sec ? new Date(sec * 1000).toTimeString().slice(0, 8) : '—');
const fmtAge = (s) => (s == null ? '—' : s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}j`);
const num = (v) => (v == null || v === '' ? null : Number(v));
const fmtCoord = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : '—');
const serviceLabel = (s) => s?.hasConfig ? `server v${s.version || 0}` : s?.snapshot ? 'snapshot only' : 'no config';
const svcStateLabel = (s) => s === 'ok' ? 'ready' : s === 'stale' ? 'snapshot' : 'down';
const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const cloneJson = (v) => JSON.parse(JSON.stringify(v ?? {}));
const setPath = (obj, path, value) => {
  const next = cloneJson(obj);
  let cur = next;
  for (let i = 0; i < path.length - 1; i += 1) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
  return next;
};
const pathLabel = (path) => path.join('.');

function JsonValueInput({ value, onChange }) {
  if (typeof value === 'boolean') {
    return (
      <Box component="select" value={value ? 'true' : 'false'} onChange={(e) => onChange(e.target.value === 'true')}
        sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.7, fontSize: 12, fontFamily: T.mono, background: T.w }}>
        <option value="true">true</option>
        <option value="false">false</option>
      </Box>
    );
  }
  if (typeof value === 'number') {
    return (
      <Box component="input" type="number" value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        sx={{ width: '100%', border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.7, fontSize: 12, fontFamily: T.mono, color: T.ink }} />
    );
  }
  if (value == null) {
    return (
      <Box component="input" value="" placeholder="null" onChange={(e) => onChange(e.target.value || null)}
        sx={{ width: '100%', border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.7, fontSize: 12, fontFamily: T.mono, color: T.ink }} />
    );
  }
  return (
    <Box component="input" value={String(value)} onChange={(e) => onChange(e.target.value)}
      sx={{ width: '100%', border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.7, fontSize: 12, fontFamily: T.mono, color: T.ink }} />
  );
}

function JsonArrayForm({ value, onChange, path }) {
  const canRowEdit = value.every((item) => isPlainObject(item));
  if (!canRowEdit) {
    return (
      <Box component="textarea" value={JSON.stringify(value, null, 2)}
        onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch (_) {} }}
        sx={{ width: '100%', minHeight: 76, border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.8, fontSize: 12, fontFamily: T.mono, color: T.ink, background: T.w, lineHeight: 1.55 }} />
    );
  }

  const keys = [...new Set(value.flatMap((item) => Object.keys(item)))];
  const updateCell = (rowIdx, key, nextValue) => {
    const next = cloneJson(value);
    next[rowIdx][key] = nextValue;
    onChange(next);
  };
  const addRow = () => {
    const template = Object.fromEntries(keys.map((key) => [key, '']));
    onChange([...cloneJson(value), template]);
  };
  const removeRow = (idx) => onChange(cloneJson(value).filter((_, i) => i !== idx));

  return (
    <Box sx={{ border: `1px solid ${T.g1}`, borderRadius: '5px', overflow: 'hidden', background: T.w }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `${keys.map(() => 'minmax(120px, 1fr)').join(' ')} 34px`, background: T.g0, borderBottom: `1px solid ${T.g1}` }}>
        {keys.map((key) => <Box key={key} sx={{ p: '7px 8px', fontFamily: T.mono, fontSize: 10, color: T.g5 }}>{key}</Box>)}
        <Box />
      </Box>
      {value.map((item, rowIdx) => (
        <Box key={`${pathLabel(path)}-${rowIdx}`} sx={{ display: 'grid', gridTemplateColumns: `${keys.map(() => 'minmax(120px, 1fr)').join(' ')} 34px`, borderBottom: rowIdx === value.length - 1 ? 'none' : `1px solid ${T.g1}` }}>
          {keys.map((key) => (
            <Box key={key} sx={{ p: 0.6 }}>
              <JsonValueInput value={item[key] ?? ''} onChange={(next) => updateCell(rowIdx, key, next)} />
            </Box>
          ))}
          <Box component="button" onClick={() => removeRow(rowIdx)} title="Remove row"
            sx={{ border: 'none', background: 'transparent', color: T.g5, cursor: 'pointer', fontSize: 16 }}>×</Box>
        </Box>
      ))}
      <Box component="button" onClick={addRow}
        sx={{ border: 'none', borderTop: `1px solid ${T.g1}`, background: T.w, color: T.g6, px: 1, py: 0.8, fontSize: 11, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
        + Add row
      </Box>
    </Box>
  );
}

function JsonForm({ value, onChange, path = [] }) {
  if (!isPlainObject(value)) {
    return (
      <Box component="textarea" value={JSON.stringify(value, null, 2)} onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch (_) {} }}
        sx={{ width: '100%', minHeight: 140, border: `1px solid ${T.g3}`, borderRadius: '5px', fontFamily: T.mono, fontSize: 12, background: T.g0, p: 1.5, color: T.ink, lineHeight: 1.7 }} />
    );
  }
  return (
    <Box sx={{ display: 'grid', gap: 0.9 }}>
      {Object.entries(value).map(([key, child]) => {
        const childPath = [...path, key];
        if (isPlainObject(child)) {
          return (
            <Box key={pathLabel(childPath)} sx={{ border: `1px solid ${T.g1}`, borderRadius: '5px', p: 1.1, background: '#fff' }}>
              <Box sx={{ fontFamily: T.mono, fontSize: 11, color: T.g5, mb: 1 }}>{pathLabel(childPath)}</Box>
              <JsonForm value={child} path={childPath} onChange={(nextChild) => onChange(setPath(value, [key], nextChild))} />
            </Box>
          );
        }
        if (Array.isArray(child)) {
          return (
            <Box key={pathLabel(childPath)} sx={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 1, alignItems: 'start' }}>
              <Box sx={{ fontFamily: T.mono, fontSize: 11, color: T.g6, pt: 0.8 }}>{key}</Box>
              <JsonArrayForm value={child} path={childPath} onChange={(nextChild) => onChange(setPath(value, [key], nextChild))} />
            </Box>
          );
        }
        return (
          <Box key={pathLabel(childPath)} sx={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 1, alignItems: 'center' }}>
            <Box sx={{ fontFamily: T.mono, fontSize: 11, color: T.g6, overflow: 'hidden', textOverflow: 'ellipsis' }} title={pathLabel(childPath)}>{key}</Box>
            <JsonValueInput value={child} onChange={(nextChild) => onChange(setPath(value, [key], nextChild))} />
          </Box>
        );
      })}
    </Box>
  );
}

// ── Ringkasan ──
function PaneOverview({ device }) {
  const svc = device.services || [];
  const [telemetry, setTelemetry] = useState({ loading: true, error: null, data: null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const isRover = fwTypeOf(device) === 'rover';
        const payload = isRover ? await api.fetchRoversLive() : await api.fetchCabinsLive();
        const rows = isRover ? (payload.rovers || []) : (payload.cabins || []);
        const id = String(device.id || '').toLowerCase();
        const unit = String(device.unitNo || device.unit_no || '').toLowerCase();
        const group = String(device.group || '').replace(/^—$/, '').toLowerCase();
        const roverNo = id.match(/(?:rover|r)[-_ .]?([a-z])?[-_ .]?(\d+)/i)?.[2];
        const found = rows.find((r) => {
          const rid = String(r.device_id || r.deviceid || '').toLowerCase();
          const runit = String(r.unit_no || r.unitno || '').toLowerCase();
          if (rid && rid === id) return true;
          if (unit && runit && runit === unit) return true;
          if (isRover) {
            const rg = String(r.group || '').toLowerCase();
            const rn = String(r.rovernumber ?? r.rover_no ?? r.rover ?? '');
            if (group && roverNo && rg === group && rn === roverNo) return true;
            if (rid && id && (rid.includes(id) || id.includes(rid))) return true;
          }
          return false;
        }) || null;
        if (alive) setTelemetry({ loading: false, error: null, data: found });
      } catch (e) {
        if (alive) setTelemetry({ loading: false, error: e.message, data: null });
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [device]);

  const isRover = fwTypeOf(device) === 'rover';
  const t = telemetry.data;
  const lat = num(t?.gpslat ?? t?.latitude ?? t?.lat);
  const lon = num(t?.gpslong ?? t?.longitude ?? t?.lon);
  const fix = t?.gpsrtkquality ?? t?.fix_quality ?? t?.rtkfix ?? t?.RTKFix;
  const sat = t?.gpsnumsat ?? t?.numsat ?? t?.NumSat;
  const speed = num(t?.VehicleSpeed ?? t?.speed_kmph ?? t?.gpsspeed ?? t?.speedgps);
  const mirDistance = num(t?.mir_distance);
  const mirInArea = num(t?.mir_in_area);
  const mirUnsafe = num(t?.mir_unsafe);
  const zone = zoneStatus({ mirDistance, mirInArea, mirUnsafe });
  const ageMs = num(t?.age_ms);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
      <Card title="Sinkron polygon">
        <KV k="Grup" v={device.group || '—'} />
        <KV k="Versi perangkat" v={`v${device.deviceVersion ?? '—'}`} />
        <KV k="Versi server" v={`v${device.serverVersion ?? '—'}`} />
        <KV k="Status" v={`${device.status || '—'}${device.ageSeconds != null ? ` · ${device.ageSeconds}s` : ''}`} />
      </Card>
      <Card title="Layanan">
        {svc.length === 0 ? <KV k="—" v="—" /> : svc.map((s) => (
          <KV key={s.name} k={s.name} v={`${svcStateLabel(s.state)} · ${serviceLabel(s)}`} />
        ))}
      </Card>
      <Card title="Firmware">
        <KV k="Saat ini" v={device.fwVersion || '—'} />
        <KV k="Target (armada)" v={device.fwTarget || '—'} />
        <KV k="Keadaan" v={device.fwState || '—'} />
      </Card>
      <Card title="Telemetri live">
        {telemetry.loading ? (
          <KV k="Status" v="loading" />
        ) : telemetry.error ? (
          <KV k="Status" v={`error · ${telemetry.error}`} />
        ) : !t ? (
          <>
            <KV k="Status" v="belum ada sample live" />
            <KV k="Sumber" v={isRover ? 'rovers/live' : 'cabins/live'} />
          </>
        ) : (
          <>
            <KV k="Koordinat" v={fmtCoord(lat, lon)} />
            <KV k="GPS / sat" v={`${rtkLabel(fix)} · ${sat ?? '—'} sat`} />
            <KV k="Kecepatan" v={speed != null && Number.isFinite(speed) ? `${speed.toFixed(0)} km/h` : '—'} />
            {isRover ? (
              <KV k="Rover" v={`R.${t.group ?? device.group ?? '—'}.${t.rovernumber ?? '—'}`} />
            ) : (
              <>
                <KV k="Status zona" v={zoneLabel(zone)} />
                <KV k="Jarak MIR" v={mirDistance != null ? `${mirDistance} m` : '—'} />
              </>
            )}
            <KV k="Age" v={ageMs != null ? `${Math.round(ageMs / 1000)}s` : '—'} />
          </>
        )}
      </Card>
    </Box>
  );
}

// ── Config ──
function PaneConfig({ device }) {
  const svcs = device.services || [];
  const [svc, setSvc] = useState(svcs[0]?.name || 'geofence');
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [draft, setDraft] = useState({});
  const [rawDraft, setRawDraft] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [rawError, setRawError] = useState('');
  const [saving, setSaving] = useState(false);
  const [snapDiff, setSnapDiff] = useState(null);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, data: null }); setSnapDiff(null);
    api.fetchDeviceConfig(device.id, svc)
      .then((d) => {
        if (!alive) return;
        setState({ loading: false, error: null, data: { ...d, source: d.meta?.source || 'server-push' } });
        setDraft(d.config || {});
        setRawDraft(JSON.stringify(d.config || {}, null, 2));
        setRawError('');
      })
      .catch(async () => {
        try {
          const snap = await api.fetchDeviceSnapshot(device.id, svc);
          if (!alive) return;
          setState({ loading: false, error: null, data: { ...snap, source: 'device-snapshot', snapshotOnly: true } });
          setDraft(snap.config || {});
          setRawDraft(JSON.stringify(snap.config || {}, null, 2));
          setRawError('');
        } catch (e2) {
          if (alive) {
            const empty = { device_id: device.id };
            setState({ loading: false, error: null, data: { config: empty, meta: {}, source: 'new', empty: true } });
            setDraft(empty);
            setRawDraft(JSON.stringify(empty, null, 2));
            setRawError('');
          }
        }
      });
    return () => { alive = false; };
  }, [device.id, svc]);

  const save = async () => {
    setSaving(true);
    try {
      const cfg = advanced ? JSON.parse(rawDraft) : draft;
      const r = await api.pushDeviceConfig(device.id, svc, cfg);
      setState((s) => ({ ...s, data: { ...s.data, config: cfg, snapshotOnly: false, empty: false, source: 'server-push', meta: { ...s.data?.meta, version: r.version, updated_at: r.updated_at, updated_by: r.updated_by, source: 'server-push' } } }));
      setDraft(cfg);
      setRawDraft(JSON.stringify(cfg, null, 2));
      setRawError('');
    } catch (e) { alert(`Gagal simpan: ${e.message}`); }
    setSaving(false);
  };
  const compare = async () => {
    try {
      const snap = await api.fetchDeviceSnapshot(device.id, svc);
      const cfg = advanced ? JSON.parse(rawDraft || '{}') : draft;
      const same = JSON.stringify(snap.config) === JSON.stringify(cfg);
      setSnapDiff(same ? 'match device snapshot' : 'beda dari running config');
    } catch (e) { setSnapDiff(`snapshot: ${e.message}`); }
  };
  const setDraftObj = (next) => {
    setDraft(next);
    setRawDraft(JSON.stringify(next, null, 2));
    setRawError('');
  };
  const setRaw = (text) => {
    setRawDraft(text);
    try { setDraft(JSON.parse(text)); setRawError(''); }
    catch (e) { setRawError(e.message); }
  };

  const meta = state.data?.meta || {};
  const source = state.data?.snapshotOnly ? 'snapshot device' : state.data?.empty ? 'config baru' : (meta.source || state.data?.source || 'server');
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '180px 1fr', height: '100%', minHeight: 0 }}>
      <Box sx={{ borderRight: `1px solid ${T.line}`, overflowY: 'auto' }}>
        <Sect sx={{ p: '12px 12px 8px', mb: 0 }}>Layanan</Sect>
        {svcs.map((s) => (
          <Box key={s.name} onClick={() => setSvc(s.name)}
            sx={{ p: '10px 12px', borderBottom: `1px solid ${T.g1}`, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 1,
              background: svc === s.name ? T.selBg : 'transparent', boxShadow: svc === s.name ? `inset 3px 0 0 ${T.sel}` : 'none' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px ${s.state === 'stale' ? 'dashed' : 'solid'} ${T.g6}`, background: s.state === 'dead' ? T.g6 : 'transparent' }} />
            <Box sx={{ minWidth: 0 }}>
              <Box>{s.name}</Box>
              <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5 }}>{serviceLabel(s)}</Box>
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ overflowY: 'auto', p: 1.75 }}>
        <DataState loading={state.loading} error={state.error}>
          <Box sx={{ display: 'flex', gap: 2, fontFamily: T.mono, fontSize: 11, color: T.g5, mb: 1.25, flexWrap: 'wrap' }}>
            <span>versi <b style={{ color: T.ink }}>v{meta.version ?? '—'}</b></span>
            <span>oleh <b style={{ color: T.ink }}>{meta.updated_by || '—'}</b></span>
            <span>diperbarui <b style={{ color: T.ink }}>{meta.updated_at ? fmtTs(Number(meta.updated_at)) : '—'}</b></span>
            <span>sumber <b style={{ color: state.data?.snapshotOnly ? T.warn : T.ink }}>{source}</b></span>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 1 }}>
            <Box component="button" onClick={() => setAdvanced((v) => !v)}
              sx={{ border: `1px solid ${T.g3}`, background: advanced ? T.ink : T.w, color: advanced ? '#fff' : T.g6, borderRadius: '4px', px: 1.2, py: 0.6, fontSize: 11, cursor: 'pointer' }}>
              {advanced ? 'Form view' : 'Raw JSON'}
            </Box>
          </Box>
          {advanced ? (
            <>
              <Box component="textarea" value={rawDraft} onChange={(e) => setRaw(e.target.value)} spellCheck={false}
                sx={{ width: '100%', minHeight: 260, border: `1px solid ${rawError ? T.crit : T.g3}`, borderRadius: '5px', fontFamily: T.mono, fontSize: 12,
                  background: T.g0, p: 1.5, color: T.ink, lineHeight: 1.7, resize: 'vertical', outline: 'none', whiteSpace: 'pre' }} />
              {rawError && <Box sx={{ mt: 0.8, color: T.crit, fontSize: 11, fontFamily: T.mono }}>JSON invalid: {rawError}</Box>}
            </>
          ) : (
            <Box sx={{ border: `1px solid ${T.g3}`, borderRadius: '5px', background: T.g0, p: 1.25, maxHeight: 420, overflow: 'auto' }}>
              <JsonForm value={draft} onChange={setDraftObj} />
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
            <Box component="button" onClick={save} disabled={saving || Boolean(rawError)}
              sx={{ border: `1px solid ${T.ink}`, background: T.ink, color: '#fff', borderRadius: '4px', px: 1.6, py: 1, fontSize: 12, cursor: saving || rawError ? 'not-allowed' : 'pointer', opacity: saving || rawError ? 0.5 : 1 }}>
              ⇪ Save &amp; push
            </Box>
            <Box component="button" onClick={() => setDraftObj(state.data?.config || {})}
              sx={{ border: `1px solid ${T.g3}`, background: T.w, color: T.g6, borderRadius: '4px', px: 1.6, py: 1, fontSize: 12, cursor: 'pointer' }}>
              ↺ Revert
            </Box>
            <Box component="button" onClick={compare}
              sx={{ border: `1px solid ${T.g3}`, background: T.w, color: T.g6, borderRadius: '4px', px: 1.6, py: 1, fontSize: 12, cursor: 'pointer' }}>
              ⇄ Compare snapshot
            </Box>
            {snapDiff && <Box sx={{ ml: 'auto', fontSize: 11, color: T.g5, fontFamily: T.mono }}>{snapDiff}</Box>}
          </Box>
        </DataState>
      </Box>
    </Box>
  );
}

// ── Log ──
const LV_COLOR = { ERROR: '#d77', WARN: '#cfa84a', INFO: '#9ab' };
function PaneLog({ device }) {
  const svcs = device.services || [];
  const [svc, setSvc] = useState(svcs[0]?.name || 'geofence');
  const [mode, setMode] = useState('live'); // live | history
  const [level, setLevel] = useState('');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState('');
  const [svcStatus, setSvcStatus] = useState([]);
  const [listenOn, setListenOn] = useState(false);
  const esRef = useRef(null);
  const svcOptions = useMemo(() => {
    const names = new Set([svc, ...(svcs || []).map((s) => s.name), ...(svcStatus || []).map((s) => s.service)]);
    return [...names].filter(Boolean).sort();
  }, [svc, svcs, svcStatus]);
  const activeSvc = svcStatus.find((s) => s.service === svc);

  useEffect(() => () => {
    if (svc) api.setLogListen(device.id, svc, false).catch(() => {});
  }, [device.id, svc]);

  useEffect(() => {
    let alive = true;
    api.fetchServiceStatus(device.id)
      .then((d) => {
        if (!alive) return;
        const list = d.services || [];
        setSvcStatus(list);
        const current = list.find((s) => s.service === svc);
        if (current) setListenOn(Boolean(current.listening));
        if (!svc && list[0]?.service) setSvc(list[0].service);
      })
      .catch(() => { if (alive) setSvcStatus([]); });
    return () => { alive = false; };
  }, [device.id, svc]);

  useEffect(() => {
    if (!svc) return undefined;
    setLines([]);
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (mode === 'live' && listenOn) {
      setStatus('connecting');
      api.setLogListen(device.id, svc, true).catch(() => {});
      const es = new EventSource(api.logStreamUrl(device.id, svc));
      esRef.current = es;
      es.onopen = () => setStatus('live tail on');
      es.addEventListener('hello', (ev) => {
        try {
          const d = JSON.parse(ev.data);
          setLines((p) => [...p.slice(-400), {
            id: `hello-${d.ts || Date.now()}`,
            ts: d.ts || Date.now(),
            level: 'INFO',
            msg: `[sse] connected · ${d.stream || svc}`,
            meta: true,
          }]);
        } catch (_) {
          setLines((p) => [...p.slice(-400), {
            id: `hello-${Date.now()}`,
            ts: Date.now(),
            level: 'INFO',
            msg: '[sse] connected',
            meta: true,
          }]);
        }
      });
      es.onmessage = (ev) => {
        try { const d = JSON.parse(ev.data); if (d.msg != null) setLines((p) => [...p.slice(-400), d]); } catch (_) { /* keepalive */ }
      };
      es.onerror = () => setStatus('stream disconnected');
      return () => { es.close(); esRef.current = null; };
    }
    if (mode === 'live') {
      setStatus('listen off');
      return undefined;
    }
    // history
    setStatus('loading history');
    let alive = true;
    api.fetchLogHistory(device.id, svc, { limit: 500, level })
      .then((d) => { if (alive) { setLines(d.rows || d.logs || []); setStatus(`history · ${(d.rows || []).length} rows`); } })
      .catch((e) => { if (alive) setStatus(`failed: ${e.message}`); });
    return () => { alive = false; };
  }, [device.id, svc, mode, level, listenOn]);

  const toggleListen = async () => {
    if (!svc) return;
    try {
      const next = !listenOn;
      await api.setLogListen(device.id, svc, next);
      setListenOn(next);
      setStatus(next ? 'listen on' : 'listen off');
    } catch (e) { setStatus(`listen failed: ${e.message}`); }
  };
  const sendCmd = async (cmd) => {
    if (!svc) return;
    try {
      await api.sendAgentCommand(device.id, cmd, svc);
      setStatus(`${cmd} sent · ${svc}`);
    } catch (e) { setStatus(`${cmd} failed: ${e.message}`); }
  };

  const shown = lines.filter((l) => (!level || l.level === level) && (!q || (l.msg || '').toLowerCase().includes(q.toLowerCase())));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1.25, borderBottom: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
        <Box component="select" value={svc} onChange={(e) => setSvc(e.target.value)}
          sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.6, fontSize: 12, fontFamily: T.mono }}>
          {svcOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </Box>
        <Box sx={{ display: 'flex', border: `1px solid ${T.g3}`, borderRadius: '4px', overflow: 'hidden' }}>
          {['live', 'history'].map((m) => (
            <Box key={m} component="button" onClick={() => setMode(m)}
              sx={{ border: 'none', px: 1.4, py: 0.6, fontSize: 12, cursor: 'pointer', background: mode === m ? T.ink : T.w, color: mode === m ? '#fff' : T.g6 }}>
              {m === 'live' ? 'Live' : 'History'}
            </Box>
          ))}
        </Box>
        <Box component="select" value={level} onChange={(e) => setLevel(e.target.value)}
          sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.6, fontSize: 12, fontFamily: T.mono }}>
          <option value="">all level</option><option value="WARN">WARN+</option><option value="ERROR">ERROR</option>
        </Box>
        <Box component="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter teks…"
          sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.6, fontSize: 12, fontFamily: T.mono, width: 140 }} />
        <Box component="button" onClick={toggleListen} disabled={!svc}
          sx={{ border: `1px solid ${listenOn ? T.ink : T.g3}`, background: listenOn ? T.ink : T.w, color: listenOn ? '#fff' : T.g6, borderRadius: '4px', px: 1.2, py: 0.6, fontSize: 12, cursor: svc ? 'pointer' : 'not-allowed' }}>
          {listenOn ? 'Listening · stop' : 'Start listen'}
        </Box>
        <Box component="button" onClick={() => sendCmd('start')} disabled={!svc}
          sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.2, py: 0.6, fontSize: 12, color: T.g6, cursor: svc ? 'pointer' : 'not-allowed' }}>
          Start
        </Box>
        <Box component="button" onClick={() => sendCmd('stop')} disabled={!svc}
          sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.2, py: 0.6, fontSize: 12, color: T.g6, cursor: svc ? 'pointer' : 'not-allowed' }}>
          Stop
        </Box>
        <Box component="button" onClick={() => sendCmd('restart')} disabled={!svc}
          sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.2, py: 0.6, fontSize: 12, color: T.g6, cursor: svc ? 'pointer' : 'not-allowed' }}>
          Restart
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.9, fontSize: 11, color: T.g6, fontFamily: T.mono }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: listenOn ? T.ok : T.g4 }} />
          {activeSvc ? `${activeSvc.liveness || 'unknown'} · ${activeSvc.process_status || 'process ?'} · ${fmtAge(activeSvc.age_seconds)} · stream ${activeSvc.stream_length ?? '—'}` : status}
        </Box>
      </Box>
      {activeSvc?.last_message ? (
        <Box sx={{ mt: 1, border: `1px dashed ${T.g3}`, borderRadius: '5px', p: 1, color: T.g6, fontFamily: T.mono, fontSize: 11 }}>
          {activeSvc.last_message}
        </Box>
      ) : null}
      <Box sx={{ flex: 1, overflowY: 'auto', background: '#1e1e1e', borderRadius: '5px', mt: 1.25, p: '10px 12px', fontFamily: T.mono, fontSize: 11.5, lineHeight: 1.65, color: '#d7d7d7' }}>
        {shown.length === 0 ? (
          <Box sx={{ color: '#7f7f7f' }}>{mode === 'live' ? (listenOn ? 'waiting for live logs' : 'listen is off') : 'no history rows'}</Box>
        ) : shown.map((l, i) => (
          <Box key={l.id || i} sx={{ whiteSpace: 'pre-wrap' }}>
            <span style={{ color: '#7f7f7f' }}>{l.ts ? new Date(Number(l.ts)).toTimeString().slice(0, 12) : ''}</span>{' '}
            <span style={{ color: LV_COLOR[l.level] || '#9ab' }}>{(l.level || 'INFO').padEnd(5)}</span>{' '}{l.msg}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Firmware (status per device; pilih versi di layar Firmware) ──
function PaneFirmware({ device }) {
  const type = fwTypeOf(device);
  const [state, setState] = useState({ loading: true, error: null, active: null, dev: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, active: null, dev: null });
    Promise.all([api.fetchFirmwareActive(type), api.fetchFirmwareDevices(type)])
      .then(([a, ds]) => {
        if (!alive) return;
        const dev = (ds.devices || []).find((x) => x.device_id === device.id) || null;
        setState({ loading: false, error: null, active: a.active, dev });
      })
      .catch((e) => { if (alive) setState({ loading: false, error: e.message, active: null, dev: null }); });
    return () => { alive = false; };
  }, [device.id, type]);

  const retry = async () => {
    if (!state.active?.version) return;
    try { await api.activateFirmware(type, state.active.version); alert('Trigger update dikirim ulang.'); }
    catch (e) { alert(`Gagal: ${e.message}`); }
  };

  return (
    <DataState loading={state.loading} error={state.error}>
      <Box sx={{ border: `1px solid ${T.line}`, borderRadius: '5px', p: 1.5, display: 'flex', alignItems: 'center', gap: 2, mb: 1.75 }}>
        <Box><Sect sx={{ mb: 0.5 }}>Saat ini</Sect><Box sx={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700 }}>{type} {state.dev?.current_version || '—'}</Box></Box>
        <Box><Sect sx={{ mb: 0.5 }}>Target armada</Sect><Box sx={{ fontFamily: T.mono }}>{type} {state.active?.version || '—'}</Box></Box>
        <Box><Sect sx={{ mb: 0.5 }}>Keadaan</Sect><Box sx={{ fontFamily: T.mono }}>{state.dev?.state || '—'}</Box></Box>
        <Box sx={{ ml: 'auto' }}>
          <Box component="button" onClick={retry}
            sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.5, py: 1, fontSize: 12, color: T.g6, cursor: 'pointer' }}>
            ⟳ Coba update lagi
          </Box>
        </Box>
      </Box>
      {state.dev?.last_error ? (
        <Box sx={{ fontFamily: T.mono, fontSize: 11, color: T.crit, mb: 1 }}>error terakhir: {state.dev.last_error}</Box>
      ) : null}
      <Sect>Catatan</Sect>
      <Box sx={{ fontSize: 12, color: T.g5, fontFamily: T.mono, lineHeight: 1.6 }}>
        Firmware itu per-TYPE — pilih/aktifkan versi di layar <b style={{ color: T.ink }}>Firmware</b>. Tab ini = status perangkat + coba lagi.
        {state.dev?.current_sha256 ? <><br />sha256: {String(state.dev.current_sha256).slice(0, 16)}…</> : null}
      </Box>
    </DataState>
  );
}

// ── Pengiriman (delivery) — REAL via .NET §7 ──
function Funnel({ label, pct, num, recv }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.6, fontFamily: T.mono, fontSize: 10, color: T.g6 }}>
      <Box sx={{ width: 62, color: T.g5 }}>{label}</Box>
      <Box sx={{ flex: 1, height: 9, background: T.g1, borderRadius: '2px', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, background: recv ? T.ink : T.g4 }} />
      </Box>
      <Box sx={{ width: 52, textAlign: 'right', color: T.ink }}>{num}</Box>
    </Box>
  );
}
function PaneDelivery({ device }) {
  const [state, setState] = useState({ loading: true, error: null, d: null, lt: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, d: null, lt: null });
    Promise.all([api.fetchDeviceDelivery(device.id), api.fetchLeadtime(device.id).catch(() => null)])
      .then(([dd, lt]) => { if (alive) setState({ loading: false, error: null, d: dd.device, lt: (lt?.events || [])[0] || null }); })
      .catch((e) => { if (alive) setState({ loading: false, error: e.message, d: null, lt: null }); });
    return () => { alive = false; };
  }, [device.id]);

  const d = state.d;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  return (
    <DataState loading={state.loading} error={state.error} empty={!d} emptyText="Belum ada data pengiriman untuk perangkat ini.">
      {d && (
        <>
          <Sect>Rekonsiliasi — dibuat (perangkat) vs diterima (server)</Sect>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
            <Card title="Alert · mir:events">
              <Funnel label="dibuat" pct={100} num={d.alerts_produced} />
              <Funnel label="terkirim" pct={pct(d.alerts_sent, d.alerts_produced)} num={d.alerts_sent} />
              <Funnel label="diterima" pct={pct(d.alerts_received, d.alerts_produced)} num={d.alerts_received} recv />
              <Box sx={{ mt: 1 }}>
                <KV k="Backlog perangkat" v={d.outbox_backlog_events} />
                <KV k="Wire-gap" v={d.alerts_wire_gap} />
                <KV k="Drift" v={`${d.alerts_drift}${d.alerts_drift > 0 ? ' ⚠' : ' ✓'}`} />
              </Box>
            </Card>
            <Card title="Evidence · mir:evidence (crossing-only)">
              <Funnel label="dibuat" pct={100} num={d.evidence_produced} />
              <Funnel label="terkirim" pct={pct(d.evidence_sent, d.evidence_produced)} num={d.evidence_sent} />
              <Funnel label="diterima" pct={pct(d.evidence_received, d.evidence_produced)} num={d.evidence_received} recv />
              <Box sx={{ mt: 1 }}>
                <KV k="Backlog perangkat" v={d.outbox_backlog_evidence} />
                <KV k="Drift" v={`${d.evidence_drift}${d.evidence_drift > 0 ? ' ⚠' : ' ✓'}`} />
              </Box>
            </Card>
          </Box>

          <Sect sx={{ mt: 2.5 }}>Lead-time (event terakhir)</Sect>
          <Card>
            <KV k="Outbox lag" v={state.lt?.outbox_lag_ms != null ? `${state.lt.outbox_lag_ms} ms ✓` : '—'} />
            <KV k="Transit" v={state.lt?.transit_ms != null ? `${state.lt.transit_ms} ms` : '—'} />
            <KV k="E2E total" v={state.lt?.e2e_ms != null ? <>{state.lt.e2e_ms} ms · <Pill dash>{state.lt.clock_trusted ? 'trusted' : 'untrusted'}</Pill></> : '—'} />
            <KV k="Retry (s/d sukses)" v={state.lt?.send_attempts != null ? `${state.lt.send_attempts}×` : '—'} />
          </Card>

          <Sect sx={{ mt: 2.5 }}>Jam &amp; NTP — perangkat lapor, server menilai</Sect>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
            <Card>
              <KV k="NTP sinkron (perangkat)" v={d.dev_ntp_synced ? 'ya ✓' : 'tidak ✗'} />
              <KV k="Offset jam perangkat" v={d.dev_clock_offset_ms != null ? `${d.dev_clock_offset_ms > 0 ? '+' : ''}${d.dev_clock_offset_ms} ms` : '—'} />
              <KV k="Apparent skew" v={d.apparent_skew_ms != null ? `${d.apparent_skew_ms > 0 ? '+' : ''}${d.apparent_skew_ms} ms` : '—'} />
              <KV k="Jam dipercaya" v={<Pill dash>{d.clock_trusted ? 'trusted' : 'untrusted'}</Pill>} />
            </Card>
            <Card>
              <KV k="Boot id" v={d.dev_boot_id ? `${String(d.dev_boot_id).slice(0, 8)}…` : '—'} />
              <KV k="Report terakhir" v={d.report_age_ms != null ? `${Math.round(d.report_age_ms / 1000)} dtk lalu` : '—'} />
              <KV k="Snapshot" v={d.snapshot_ts ? new Date(d.snapshot_ts).toTimeString().slice(0, 8) : '—'} />
            </Card>
          </Box>
        </>
      )}
    </DataState>
  );
}

export default function MirDeviceWorkspace({ device, initialTab = 'ov', onClose }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab, device?.id]);
  if (!device) return null;

  return (
    <>
      <Box onClick={onClose} sx={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.18)', zIndex: 40 }} />
      <Box sx={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '66%', minWidth: 680, background: T.w, borderLeft: `1px solid ${T.line}`,
        boxShadow: '-8px 0 28px rgba(0,0,0,.14)', zIndex: 41, display: 'flex', flexDirection: 'column', fontFamily: T.ff }}>
        <Box sx={{ p: '13px 16px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="button" onClick={onClose} sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.25, py: 0.6, color: T.g6, cursor: 'pointer' }}>‹</Box>
          <Box>
            <Box sx={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{device.title || device.id}</Box>
            <Box sx={{ fontFamily: T.mono, fontSize: 11, color: T.g5, mt: '2px' }}>{device.meta || `${device.type} · Grp ${device.group}`}</Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', px: 2, borderBottom: `1px solid ${T.line}` }}>
          {TABS.map((t) => (
            <Box key={t.key} component="button" onClick={() => setTab(t.key)}
              sx={{ border: 'none', background: 'none', p: '11px 14px', fontSize: 13, cursor: 'pointer', mb: '-1px',
                color: tab === t.key ? T.ink : T.g5, fontWeight: tab === t.key ? 600 : 400,
                borderBottom: `2px solid ${tab === t.key ? T.ink : 'transparent'}` }}>
              {t.label}
            </Box>
          ))}
        </Box>
        <Box sx={{ flex: 1, overflow: tab === 'cfg' || tab === 'log' ? 'hidden' : 'auto', position: 'relative', p: tab === 'cfg' || tab === 'log' ? 0 : 2 }}>
          {tab === 'ov' && <PaneOverview device={device} />}
          {tab === 'cfg' && <Box sx={{ position: 'absolute', inset: 0 }}><PaneConfig device={device} /></Box>}
          {tab === 'log' && <Box sx={{ position: 'absolute', inset: 0, p: 2 }}><PaneLog device={device} /></Box>}
          {tab === 'fw' && <PaneFirmware device={device} />}
          {tab === 'del' && <PaneDelivery device={device} />}
        </Box>
      </Box>
    </>
  );
}
