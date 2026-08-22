import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Popover } from '@mui/material';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { T, rtkLabel } from '../components/mir/operasi/mirTokens';
import { DataState } from '../components/mir/devices/MirDeviceBits';
import MirDeviceWorkspace from '../components/mir/devices/MirDeviceWorkspace';
import MapContainer from '../components/peta/MapContainer';
import * as api from '../services/mirDeviceApi';
import useUserStore from '../stores/userStore';

// Layar KESEHATAN SISTEM (port wireframe-pipeline.html) — observability (waktu/target/diagnostik).
// Sub-tab: Pipeline (alur+SLO+diagnostik, /api/mir/pipeline) · Pengiriman (roll-up armada, /api/mir/delivery).
// Beda job dari Operasi (spasial). Data REAL; tanpa dummy (DataState loading/empty/error).
const POLL_MS = 8000;

const Sect = ({ children, sx }) => (
  <Box sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, ...sx }}>{children}</Box>
);
const Lvl = ({ level, children }) => {
  const warn = level === 'warning' || level === 'warn';
  const crit = level === 'critical' || level === 'crit';
  return (
    <Box component="span" sx={{ display: 'inline-block', border: `1px ${warn ? 'dashed' : 'solid'} ${crit ? T.ink : T.g4}`,
      background: crit ? T.ink : 'transparent', color: crit ? T.w : T.g6, borderRadius: '3px', px: 0.75, fontSize: 9, textTransform: 'uppercase' }}>
      {children}
    </Box>
  );
};
const SloCard = ({ label, n, unit, t, breach, badge }) => (
  <Box sx={{ border: `1px solid ${breach ? T.g4 : T.line}`, background: breach ? T.g0 : T.w, borderRadius: '6px', p: '13px 14px', position: 'relative' }}>
    {breach && <Box sx={{ position: 'absolute', top: 11, right: 12, fontFamily: T.mono, fontSize: 9, border: `1px solid ${T.crit}`, color: T.crit, borderRadius: '3px', px: 0.6, textTransform: 'uppercase' }}>{badge || 'lewat target'}</Box>}
    <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', color: T.g5 }}>{label}</Box>
    <Box sx={{ fontFamily: T.mono, fontSize: 24, fontWeight: 700, mt: 0.5 }}>{n}{unit && <span style={{ fontSize: 13 }}> {unit}</span>}</Box>
    <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5, mt: '2px' }}>{t}</Box>
  </Box>
);
const Panel = ({ title, status, children }) => (
  <Box sx={{ border: `1px solid ${T.line}`, borderRadius: '6px', overflow: 'hidden' }}>
    <Box sx={{ p: '10px 13px', borderBottom: `1px solid ${T.g1}`, background: T.g0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: T.g6, display: 'flex', alignItems: 'center', gap: 1 }}>
      {title}{status != null && <Box sx={{ ml: 'auto', fontFamily: T.mono, fontSize: 10, color: T.g5, textTransform: 'none', letterSpacing: 0 }}>{status}</Box>}
    </Box>
    <Box>{children}</Box>
  </Box>
);
const KV = ({ k, v }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', p: '8px 13px', borderBottom: `1px solid ${T.g1}`, fontSize: 12, '&:last-of-type': { borderBottom: 'none' } }}>
    <Box sx={{ color: T.g5 }}>{k}</Box><Box sx={{ fontFamily: T.mono, color: T.ink }}>{v}</Box>
  </Box>
);
const Th = (p) => <Box component="th" sx={{ textAlign: 'left', p: '7px 13px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: T.g5, borderBottom: `1px solid ${T.g1}` }} {...p} />;
const Td = (p) => <Box component="td" sx={{ p: '7px 13px', borderBottom: `1px solid ${T.g1}`, fontFamily: T.mono, color: T.g6 }} {...p} />;

const ms = (v) => (v == null || v < 0 ? '—' : v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(1)}s`);

// polygon:version = epoch ms (CONTRACT §REVISI 2026-06-12). Tampilkan "v{epoch}" + waktu singkat.
const fmtEpochVer = (v) => {
  if (v == null || v === '—' || v === '') return '—';
  const n = Number(v);
  if (!n || Number.isNaN(n)) return `v${v}`;
  // epoch ms (>1e12) → label v{epoch} sudah cukup; tambah waktu lokal singkat sebagai tooltip/sub
  const epoch = n > 1e12 ? n : n * 1000; // tolerate epoch-s juga
  const d = new Date(epoch);
  const hhmm = d.toTimeString().slice(0, 5);
  const ddmm = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `v${n} (${ddmm} ${hhmm})`;
};

// ════ PIPELINE ════
function PipelineView({ onDrill }) {
  const [s, setS] = useState({ loading: true, error: null, d: null });
  const [acked, setAcked] = useState(() => new Set());

  const load = useCallback(() => {
    api.fetchPipeline()
      .then((d) => setS({ loading: false, error: null, d }))
      .catch((e) => setS((p) => ({ loading: false, error: e.message, d: p.d })));
  }, []);
  useEffect(() => { load(); const id = setInterval(load, POLL_MS); return () => clearInterval(id); }, [load]);

  const d = s.d;
  const view = useMemo(() => {
    if (!d) return null;
    const slo = d.slo || {};
    const rovers = (d.corr?.rovers || []).filter((r) => r.present);
    const locked = rovers.filter((r) => r.fix === 4).length;
    const groups = d.perim?.groups || [];
    const maxBuild = Math.max(0, ...groups.map((g) => g.gen?.build_ms || 0));
    const cabins = d.perim?.cabins || [];
    const applied = cabins.filter((c) => c.applied?.present).length;
    const synced = cabins.filter((c) => c.sync?.present).length;
    const maxE2e = Math.max(0, ...cabins.map((c) => (c.e2e_lead_ms >= 0 ? c.e2e_lead_ms : 0)));
    const maxApplyLag = Math.max(0, ...cabins.map((c) => (c.applied?.apply_lag_ms >= 0 ? c.applied.apply_lag_ms : 0)));
    const gw = d.corr?.gateway;
    const buildTarget = slo.gen_build_warn_ms || 60;
    return { slo, rovers, locked, groups, maxBuild, cabins, applied, synced, maxE2e, maxApplyLag, gw, buildTarget };
  }, [d]);

  return (
    <DataState loading={s.loading && !d} error={s.error} empty={!s.loading && !d}
      emptyText="Pipeline belum melapor. Butuh /api/mir/pipeline (backend) + geofence-core jalan.">
      {view && (
        <>
          {/* SLO cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1.5, p: 2 }}>
            <SloCard label="Ketersediaan koreksi GPS" n={view.gw?.ntrip_connected ? 'Aktif' : 'Putus'}
              t={`${view.gw?.clients_active ?? 0} klien · sel ${view.gw?.cells_streaming ?? 0}/${view.gw?.cells_total ?? 0}`}
              breach={!view.gw || !view.gw.ntrip_connected} badge="putus" />
            <SloCard label="Rover terkunci RTK" n={`${view.locked} / ${view.rovers.length}`} t="Target ≥ 90%"
              breach={view.rovers.length > 0 && view.locked / view.rovers.length < 0.9} badge="rendah" />
            <SloCard label="Waktu bangun polygon" n={view.maxBuild} unit="ms" t={`Target ≤ ${view.buildTarget} ms`}
              breach={view.maxBuild > view.buildTarget} />
            <SloCard label="Jeda perangkat menerapkan" n={(view.maxE2e / 1000).toFixed(1)} unit="dtk" t="Target ≤ 10 dtk"
              breach={view.maxE2e > 10000} />
          </Box>
          <Box sx={{ px: 2, mt: -0.75, mb: 0.75, fontFamily: T.mono, fontSize: 10, color: T.g5 }}>
            Nilai = sesaat (snapshot). Tren 24j + sparkline + uptime% butuh metrics tersimpan (backend).
          </Box>

          {/* flow */}
          <Box sx={{ p: '6px 16px 18px' }}>
            <Box sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, mb: 1.5 }}>Alur data &amp; jeda antar-tahap</Box>
            <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
              {[
                { t: 'Base station', m: `${view.gw?.clients_active ?? 0} klien`, s: view.gw?.ntrip_connected ? 'aktif' : 'putus', warn: !view.gw?.ntrip_connected, lat: `koreksi ${ms(view.gw?.data_age_ms)}` },
                { t: 'Rover (koreksi)', m: `${view.locked}/${view.rovers.length} terkunci`, s: `${view.rovers.length - view.locked} mengambang`, warn: view.locked < view.rovers.length, lat: 'masuk' },
                { t: 'Pembuat polygon', m: fmtEpochVer(view.groups[0]?.gen?.version), s: `${view.maxBuild}ms${view.maxBuild > view.buildTarget ? ' ⚠' : ''}`, warn: view.maxBuild > view.buildTarget, lat: 'kirim' },
                { t: 'Distribusi', m: `${view.synced}/${view.cabins.length}`, s: `jeda ${(view.maxApplyLag / 1000).toFixed(1)} dtk`, warn: view.synced < view.cabins.length, lat: 'terap' },
                { t: 'Cabin / alat berat', m: `${view.applied}/${view.cabins.length}`, s: 'terapkan polygon', warn: false, last: true },
              ].map((n, i, arr) => (
                <React.Fragment key={n.t}>
                  <Box sx={{ flex: 1, border: `1px solid ${T.line}`, borderTop: `3px ${n.warn ? 'dashed' : 'solid'} ${n.warn ? T.warn : T.g4}`, borderRadius: '5px', p: '11px 12px' }}>
                    <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', color: T.g5 }}>{n.t}</Box>
                    <Box sx={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, mt: 0.5 }}>{n.m}</Box>
                    <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5, mt: '2px' }}>{n.s}</Box>
                  </Box>
                  {!n.last && (
                    <Box sx={{ flex: '0 0 86px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.g5 }}>
                      <Box sx={{ fontSize: 13, color: T.g4 }}>→</Box>
                      <Box sx={{ fontFamily: T.mono, fontSize: 10 }}>{n.lat}</Box>
                    </Box>
                  )}
                </React.Fragment>
              ))}
            </Box>
          </Box>

          {/* diagnostics */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75, p: '0 16px 16px' }}>
            <Panel title="Base station — sumber koreksi (NTRIP)" status={view.gw ? (view.gw.ntrip_connected ? 'terhubung' : 'putus') : 'tak ada data'}>
              <KV k="Klien aktif" v={view.gw?.clients_active ?? '—'} />
              <KV k="Sel mengalir" v={view.gw ? `${view.gw.cells_streaming} / ${view.gw.cells_total}` : '—'} />
              <KV k="Umur data koreksi" v={ms(view.gw?.data_age_ms)} />
              <KV k="Heartbeat gateway" v={ms(view.gw?.age_ms)} />
            </Panel>

            <Panel title="Pembuatan polygon — per grup" status={`${view.maxBuild}ms`}>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead><tr><Th>Grup</Th><Th>Rover masuk</Th><Th>PID</Th><Th>Versi</Th><Th>Waktu</Th><Th>Umur</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {view.groups.map((g) => {
                    const recvIn = (g.recvs || []).filter((r) => r.present).length;
                    const lvl = (g.gen?.build_ms || 0) > view.buildTarget ? 'warning' : 'ok';
                    return (
                      <Box component="tr" key={g.group}>
                        <Td>{g.group}</Td><Td>{recvIn}/{(g.recvs || []).length}</Td><Td>{g.gen?.pid || '—'}</Td>
                        <Td>{fmtEpochVer(g.gen?.version)}</Td><Td>{g.gen?.build_ms != null ? `${g.gen.build_ms}ms` : '—'}</Td>
                        <Td>{ms(g.gen?.age_ms)}</Td><Td><Lvl level={lvl}>{lvl === 'ok' ? 'baik' : 'perhatian'}</Lvl></Td>
                      </Box>
                    );
                  })}
                </tbody>
              </Box>
            </Panel>

            <Panel title="Koreksi rover (RTCM)">
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead><tr><Th>Rover</Th><Th>Kualitas GPS</Th><Th>Sat</Th><Th>Umur koreksi</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {view.rovers.map((r) => (
                    <Box component="tr" key={`${r.group}_${r.rover}`}>
                      <Td>{r.group}_{r.rover}</Td><Td>{rtkLabel(r.fix)}</Td><Td>{r.numsat}</Td>
                      <Td>{ms(r.last_rtcm_age_ms)}</Td>
                      <Td><Lvl level={r.level}>{r.level === 'ok' ? 'baik' : r.level === 'critical' ? 'kritis' : 'perhatian'}</Lvl>{' '}
                        {r.level !== 'ok' && <Box component="span" onClick={() => onDrill(`${r.group}_${r.rover}`)} sx={{ color: T.sel, textDecoration: 'underline', cursor: 'pointer' }}>log ›</Box>}</Td>
                    </Box>
                  ))}
                </tbody>
              </Box>
            </Panel>

            <Panel title="Distribusi — Redis & konfirmasi perangkat">
              <KV k="Redis" v="terhubung" />
              <KV k="Versi server (grup pertama)" v={`v${view.groups[0]?.gen?.version ?? '—'}`} />
              <KV k="Perangkat ter-sinkron" v={`${view.synced} / ${view.cabins.length}`} />
              <KV k="Jeda terap (terburuk)" v={`${(view.maxApplyLag / 1000).toFixed(1)} dtk`} />
            </Panel>
          </Box>

          {/* alert timeline */}
          <Box sx={{ p: '0 16px 24px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
              <Sect>Riwayat peringatan &amp; kejadian (sistem)</Sect>
              <Box sx={{ ml: 'auto', fontFamily: T.mono, fontSize: 10, color: T.g5 }}>ack lokal · simpan riwayat = backend (tbl_mir_system_alert)</Box>
            </Box>
            {(d.alerts || []).length === 0 ? (
              <Box sx={{ fontSize: 12, color: T.g5, p: 1.5, border: `1px solid ${T.g1}`, borderRadius: '5px' }}>Tidak ada peringatan sistem aktif. ✓</Box>
            ) : (d.alerts || []).map((a, i) => {
              const isAck = acked.has(i);
              return (
                <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 1.5, alignItems: 'center', p: '10px 12px', border: `1px solid ${T.g1}`, borderRadius: '5px', mb: 0.75, opacity: isAck ? 0.6 : 1 }}>
                  <Lvl level={a.severity}>{a.severity === 'critical' ? 'kritis' : 'perhatian'}</Lvl>
                  <Box sx={{ fontSize: 12 }}>{a.msg}<Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5 }}>Sumber: {a.source}</Box></Box>
                  {isAck ? <Box sx={{ fontSize: 11, color: T.g5 }}>ditangani</Box> : (
                    <Box component="button" onClick={() => setAcked((p) => new Set(p).add(i))}
                      sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.25, py: 0.5, fontSize: 11, color: T.g6, cursor: 'pointer' }}>Tangani</Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </DataState>
  );
}

// ════ PENGIRIMAN (delivery roll-up armada) ════
function DeliveryView({ onDrill }) {
  const [s, setS] = useState({ loading: true, error: null, devices: [] });
  const [filter, setFilter] = useState('all');
  const load = useCallback(() => {
    api.fetchDelivery()
      .then((d) => setS({ loading: false, error: null, devices: d.devices || [] }))
      .catch((e) => setS((p) => ({ loading: false, error: e.message, devices: p.devices })));
  }, []);
  useEffect(() => { load(); const id = setInterval(load, POLL_MS); return () => clearInterval(id); }, [load]);

  const devs = s.devices;
  const reporting = devs.filter((d) => (d.report_age_ms ?? 1e9) < 60000).length;
  const driftSum = devs.reduce((a, d) => a + (d.alerts_drift || 0), 0);
  const backlogSum = devs.reduce((a, d) => a + (d.outbox_backlog_events || 0), 0);
  const untrusted = devs.filter((d) => !d.clock_trusted).length;

  const rows = useMemo(() => {
    const score = (d) => (d.clock_trusted ? 0 : 100) + (d.alerts_drift || 0) + (d.report_age_ms > 60000 ? 50 : 0);
    let r = [...devs].sort((a, b) => score(b) - score(a));
    if (filter === 'drift') r = r.filter((d) => (d.alerts_drift || 0) > 0);
    if (filter === 'untrusted') r = r.filter((d) => !d.clock_trusted);
    if (filter === 'silent') r = r.filter((d) => (d.report_age_ms ?? 1e9) > 60000);
    return r;
  }, [devs, filter]);

  return (
    <DataState loading={s.loading && devs.length === 0} error={s.error} empty={!s.loading && devs.length === 0}
      emptyText="Belum ada data pengiriman armada (/api/mir/delivery kosong).">
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1.5, p: 2 }}>
        <SloCard label="Perangkat melapor" n={`${reporting} / ${devs.length}`} t={`${devs.length - reporting} diam > 60 dtk`} breach={reporting < devs.length} badge="diam" />
        <SloCard label="Drift alert (armada)" n={driftSum} t="dibuat − diterima" breach={driftSum > 0} badge="drift" />
        <SloCard label="Backlog outbox" n={backlogSum} t="pending di perangkat" breach={backlogSum > 0} badge="backlog" />
        <SloCard label="Jam tak dipercaya" n={untrusted} t="NTP / skew lewat ambang" breach={untrusted > 0} badge="untrusted" />
      </Box>

      <Box sx={{ p: '6px 16px 24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
          <Sect>Keandalan pengiriman per perangkat</Sect>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.75 }}>
            {[['all', 'Semua'], ['drift', 'Ada drift'], ['untrusted', 'Jam untrusted'], ['silent', 'Report diam']].map(([k, l]) => (
              <Box key={k} onClick={() => setFilter(k)} sx={{ border: `1px solid ${filter === k ? T.ink : T.g3}`, background: filter === k ? T.ink : T.w, color: filter === k ? T.w : T.g6, borderRadius: '13px', px: 1.25, py: 0.4, fontSize: 11, cursor: 'pointer' }}>{l}</Box>
            ))}
          </Box>
        </Box>
        <Panel>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead><tr><Th>Perangkat</Th><Th>Alert dibuat→diterima</Th><Th>Evidence</Th><Th>Backlog</Th><Th>Jam</Th><Th>Lapor terakhir</Th><Th></Th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <Box component="tr" key={d.device_id} sx={{ cursor: 'pointer', '&:hover': { background: T.g0 } }} onClick={() => onDrill(d.device_id)}>
                  <Td style={{ fontWeight: 600, color: T.ink }}>{d.device_id}</Td>
                  <Td>{d.alerts_produced} → {d.alerts_received} {d.alerts_drift ? <b style={{ color: T.crit }}>(−{d.alerts_drift})</b> : null}</Td>
                  <Td>{d.evidence_produced} → {d.evidence_received} {d.evidence_drift ? <b style={{ color: T.crit }}>(−{d.evidence_drift})</b> : null}</Td>
                  <Td>{d.outbox_backlog_events}</Td>
                  <Td><Lvl level={d.clock_trusted ? 'ok' : 'warning'}>{d.clock_trusted ? 'baik' : 'untrusted'}</Lvl></Td>
                  <Td>{d.report_age_ms != null ? ms(d.report_age_ms) : '—'}{d.report_age_ms > 60000 ? ' ⚠' : ''}</Td>
                  <Td><Box component="span" sx={{ color: T.sel, textDecoration: 'underline' }}>Pengiriman ›</Box></Td>
                </Box>
              ))}
            </tbody>
          </Box>
        </Panel>
      </Box>
    </DataState>
  );
}

// ════ RTK QUALITY (S3 playback preview) ════
const RTK_UNITS = ['DT4248', 'DT4275', 'DT4461', 'DT4624', 'DT4724', 'DT4766', 'DT4772', 'DT5357', 'DT5372', 'DT5505', 'DT5559', 'NODE 011', 'NODE 014'];
const HOUR_MS = 60 * 60 * 1000;
const EXPECTED_ROWS_PER_HOUR = 3600; // 1Hz S3 row cadence: 60 menit x 60 detik
const RTK_LAYER_STATE = { orthophoto: true, roads: false, boundaries: false, exRadius: false, pitStops: false };

const pad2 = (n) => String(n).padStart(2, '0');
const toInputDateTime = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}T${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
};
const fmtHour = (msValue) => {
  const d = new Date(msValue);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:00`;
};
const fmtMinute = (msValue) => {
  const d = new Date(msValue);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const fmtSecond = (msValue) => {
  const d = new Date(msValue);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;
const qualityColor = (q) => (Number(q) === 4 ? T.ok : Number(q) === 5 ? T.warn : T.crit);
const percentColor = (p) => (p >= 99 ? T.ok : p >= 95 ? T.warn : T.crit);
const pingLabel = (ok) => (ok ? 'Success' : 'RTO');
const metricCell = (state) => {
  if (state === 'ok') return { bg: '#bff4d2', color: '#1e6e3d' };
  if (state === 'warn') return { bg: '#f8e6a7', color: '#9a6a14' };
  return { bg: '#f7b4ae', color: '#a04040' };
};
const reasonOf = (s) => {
  if (Number(s.fixQuality) === 4) return 'RTK FIX';
  if (!s.pingOk) return 'Ping gagal / RTO';
  if (s.lastCorrectionAgeMs > 5000) return 'Last correction telat';
  if (Number(s.fixQuality) === 5) return 'RTK FLOAT';
  return 'GPS degraded';
};
const reasonColor = (reason) => reason === 'RTK FIX' ? T.ok : reason.includes('Ping') ? T.crit : T.warn;

const summarizeRtkSamples = (rows) => {
  const total = rows.length;
  const fixed = rows.filter((s) => Number(s.fixQuality) === 4).length;
  const pingFail = rows.filter((s) => !s.pingOk).length;
  const lateCorrection = rows.filter((s) => s.pingOk && Number(s.fixQuality) !== 4 && s.lastCorrectionAgeMs > 5000).length;
  const float = rows.filter((s) => Number(s.fixQuality) === 5).length;
  const avgCorrection = total ? rows.reduce((a, s) => a + s.lastCorrectionAgeMs, 0) / total : 0;
  const avgPing = rows.filter((s) => s.pingOk).reduce((a, s) => a + s.pingTime, 0) / Math.max(1, rows.filter((s) => s.pingOk).length);
  return {
    total,
    fixed,
    nonFixed: total - fixed,
    fixedPct: total ? fixed / total * 100 : 0,
    pingFail,
    pingFailPct: total ? pingFail / total * 100 : 0,
    lateCorrection,
    float,
    avgCorrection,
    avgPing,
  };
};

function generateRtkSamples(fromMs, toMs) {
  const cappedTo = Math.min(toMs, fromMs + 8 * HOUR_MS); // dummy guard supaya UI tetap ringan
  const samples = [];
  RTK_UNITS.forEach((unit, unitIdx) => {
    const baseLon = 117.204 + (unitIdx % 5) * 0.0027;
    const baseLat = 1.872 + Math.floor(unitIdx / 5) * 0.0032;
    for (let ts = fromMs; ts < cappedTo; ts += 1000) {
      const h = Math.floor((ts - fromMs) / HOUR_MS);
      const sec = Math.floor((ts - fromMs) / 1000);
      const wave = Math.sin(sec / 260 + unitIdx * 0.7);
      const dropout =
        (unitIdx === 0 && h === 0) ||
        ((unitIdx + h) % 7 === 0 && sec % 41 < 6) ||
        ((unitIdx + h) % 11 === 0 && sec % 97 < 9);
      const floaty = !dropout && ((unitIdx + h) % 5 === 0 && sec % 53 < 5);
      const fixQuality = dropout ? 1 : floaty ? 5 : 4;
      const pingOk = !dropout || sec % 3 === 0;
      const lastCorrectionAgeMs = pingOk
        ? (floaty ? 6500 + (sec % 11) * 420 : 450 + (sec % 7) * 120)
        : 12000 + (sec % 17) * 900;
      samples.push({
        unitno: unit,
        ts,
        lat: baseLat + Math.sin(sec / 520 + unitIdx) * 0.0013 + h * 0.00015,
        lon: baseLon + sec * 0.000004 + wave * 0.001,
        fixQuality,
        pingOk,
        pingStatus: pingLabel(pingOk),
        pingTime: pingOk ? 28 + (sec % 12) * 4 + unitIdx : null,
        lastCorrectionAgeMs,
        numsat: fixQuality === 4 ? 20 + (unitIdx % 6) : fixQuality === 5 ? 13 + (unitIdx % 5) : 7 + (unitIdx % 4),
        hdop: fixQuality === 4 ? 0.6 + (sec % 5) * 0.04 : fixQuality === 5 ? 1.2 + (sec % 7) * 0.08 : 2.4 + (sec % 9) * 0.16,
        pdop: fixQuality === 4 ? 1.1 + (sec % 5) * 0.05 : fixQuality === 5 ? 2.0 + (sec % 7) * 0.1 : 3.8 + (sec % 9) * 0.2,
      });
    }
  });
  return samples;
}

function RtkQualityMap({ samples, selectedUnit, onSelectUnit }) {
  const district = useUserStore((s) => s.profile?.distrik);
  const [viewState, setViewState] = useState({ longitude: 117.223, latitude: 1.881, zoom: 14, pitch: 0, bearing: 0 });

  const layers = useMemo(() => {
    const byUnit = new Map();
    samples.forEach((s, i) => {
      if (i % 10 !== 0) return; // map preview: 1 dot / 10 detik, hitungan tabel tetap dari semua row dummy
      if (!byUnit.has(s.unitno)) byUnit.set(s.unitno, []);
      byUnit.get(s.unitno).push(s);
    });
    const visible = selectedUnit === 'all' ? [...byUnit.values()].flat() : (byUnit.get(selectedUnit) || []);
    const tracks = [...byUnit.entries()]
      .filter(([unit]) => selectedUnit === 'all' || selectedUnit === unit)
      .map(([unit, rows]) => ({ unit, path: rows.map((r) => [r.lon, r.lat]) }))
      .filter((x) => x.path.length >= 2);
    const lastPoints = [...byUnit.entries()].map(([unit, rows]) => ({ unit, p: [rows.at(-1).lon, rows.at(-1).lat] }));
    return [
      new PathLayer({
        id: 'rtk-track-line',
        data: tracks,
        getPath: (d) => d.path,
        getColor: [36, 50, 64, 165],
        widthMinPixels: selectedUnit === 'all' ? 1.2 : 2.4,
      }),
      new ScatterplotLayer({
        id: 'rtk-dot-trace',
        data: visible,
        pickable: true,
        onClick: (info) => { if (info.object) onSelectUnit(info.object.unitno); },
        getPosition: (d) => [d.lon, d.lat],
        getFillColor: (d) => {
          const c = qualityColor(d.fixQuality);
          const h = c.replace('#', '');
          return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), Number(d.fixQuality) === 4 ? 135 : 230];
        },
        getLineColor: [255, 255, 255, 150],
        stroked: true,
        lineWidthMinPixels: 0.5,
        radiusUnits: 'pixels',
        getRadius: (d) => (Number(d.fixQuality) === 4 ? 2.4 : 3.6),
        radiusMinPixels: 2,
      }),
      new TextLayer({
        id: 'rtk-unit-labels',
        data: selectedUnit === 'all' ? lastPoints.slice(0, 8) : lastPoints.filter((x) => x.unit === selectedUnit),
        getPosition: (d) => d.p,
        getText: (d) => d.unit,
        getColor: [36, 50, 64, 255],
        getSize: 10,
        sizeUnits: 'pixels',
        getPixelOffset: [10, -8],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        fontFamily: 'monospace',
        fontWeight: 700,
        characterSet: 'auto',
        background: true,
        getBackgroundColor: [255, 255, 255, 210],
        backgroundPadding: [4, 2],
      }),
    ];
  }, [samples, selectedUnit, onSelectUnit]);

  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 0, background: T.g1 }}>
      <MapContainer
        layerState={RTK_LAYER_STATE}
        district={district}
        basemap="satellite"
        liveUnitData={[]}
        liveTrailsData={[]}
        viewState={viewState}
        onViewStateChange={(e) => setViewState(e.viewState)}
        replayLayers={layers}
      />
      <Box sx={{ position: 'absolute', left: 12, bottom: 12, zIndex: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {[['RTK FIX', T.ok], ['RTK FLOAT', T.warn], ['SINGLE/DGPS', T.crit]].map(([label, color]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, background: 'rgba(255,255,255,.92)', border: `1px solid ${T.g3}`, borderRadius: '14px', px: 1, py: 0.45, fontSize: 10, fontFamily: T.mono, color: T.g6 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            {label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

const metricRowsFor = (rows, expected) => {
  const stats = summarizeRtkSamples(rows);
  const avg = (fn) => rows.length ? rows.reduce((a, s) => a + fn(s), 0) / rows.length : 0;
  const min = (fn) => rows.length ? Math.min(...rows.map(fn)) : 0;
  const pingOkPct = rows.length ? rows.filter((s) => s.pingOk).length / rows.length * 100 : 0;
  const correctionAvg = avg((s) => s.lastCorrectionAgeMs);
  const numsatAvg = avg((s) => s.numsat);
  const hdopAvg = avg((s) => s.hdop);
  const pdopAvg = avg((s) => s.pdop);
  return [
    {
      key: 'network',
      label: 'LTE / Network Device',
      value: rows.length ? pingOkPct.toFixed(0) : '—',
      sub: rows.length ? `success % · ${stats.pingFail} RTO` : '',
      state: !rows.length ? 'warn' : pingOkPct >= 99 ? 'ok' : pingOkPct >= 95 ? 'warn' : 'crit',
    },
    {
      key: 'correction',
      label: 'Correction',
      value: rows.length ? (correctionAvg / 1000).toFixed(1) : '—',
      sub: rows.length ? `avg second` : '',
      state: !rows.length ? 'warn' : correctionAvg <= 3000 ? 'ok' : correctionAvg <= 7000 ? 'warn' : 'crit',
    },
    {
      key: 'rtk',
      label: 'RTK Quality',
      value: rows.length ? stats.fixedPct.toFixed(stats.fixedPct === 100 ? 0 : 1) : '—',
      sub: rows.length ? `fix % · ${stats.fixed}/${expected}` : '',
      state: !rows.length ? 'warn' : stats.fixedPct >= 99 ? 'ok' : stats.fixedPct >= 95 ? 'warn' : 'crit',
    },
    {
      key: 'numsat',
      label: 'Numsat',
      value: rows.length ? numsatAvg.toFixed(0) : '—',
      sub: rows.length ? `min ${min((s) => s.numsat)}` : '',
      state: !rows.length ? 'warn' : numsatAvg >= 18 ? 'ok' : numsatAvg >= 12 ? 'warn' : 'crit',
    },
    {
      key: 'hdop',
      label: 'Hdop',
      value: rows.length ? hdopAvg.toFixed(2) : '—',
      sub: '',
      state: !rows.length ? 'warn' : hdopAvg <= 1.2 ? 'ok' : hdopAvg <= 2 ? 'warn' : 'crit',
    },
    {
      key: 'pdop',
      label: 'Pdop',
      value: rows.length ? pdopAvg.toFixed(2) : '—',
      sub: '',
      state: !rows.length ? 'warn' : pdopAvg <= 2 ? 'ok' : pdopAvg <= 3.5 ? 'warn' : 'crit',
    },
  ];
};

function RtkQualityMatrix({ level, drill, setDrill, unitRows, hours, samples, unitFilter, setUnitFilter }) {
  const isHour = level === 'hour';
  const isMinute = level === 'minute';
  const isSecond = level === 'second';
  const activeHourRows = drill?.unit && drill?.hour ? samples.filter((s) => s.unitno === drill.unit && s.ts >= drill.hour && s.ts < drill.hour + HOUR_MS) : [];
  const minuteStarts = drill?.hour ? Array.from({ length: 60 }, (_, i) => drill.hour + i * 60 * 1000) : [];
  const activeMinuteRows = drill?.minute ? activeHourRows.filter((s) => s.ts >= drill.minute && s.ts < drill.minute + 60 * 1000) : [];
  const secondRows = activeMinuteRows.sort((a, b) => a.ts - b.ts);
  const metricRows = isSecond ? metricRowsFor(activeMinuteRows, 60) : isMinute ? metricRowsFor(activeHourRows, EXPECTED_ROWS_PER_HOUR) : [];
  const columns = isSecond ? secondRows.map((s) => s.ts) : minuteStarts;

  const title = isHour
    ? 'Persentase RTK FIX per jam'
    : isMinute
    ? `${drill.unit} · ${fmtHour(drill.hour)} · detail per menit`
    : `${drill.unit} · ${fmtMinute(drill.minute)} · detail per detik`;

  const goBack = () => {
    if (isSecond) setDrill({ level: 'minute', unit: drill.unit, hour: drill.hour });
    else if (isMinute) setDrill({ level: 'hour' });
  };
  const shiftHour = (delta) => {
    if (!drill?.hour) return;
    setDrill({ level: 'minute', unit: drill.unit, hour: drill.hour + delta * HOUR_MS });
  };

  const detailValue = (metric, rows) => {
    const m = metricRowsFor(rows, rows.length || 1).find((x) => x.key === metric.key);
    return m || { value: '—', state: 'warn', sub: '' };
  };

  return (
    <Box sx={{ borderTop: `1px solid ${T.line}`, background: T.w, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: '10px 12px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 1, background: T.w, zIndex: 3, flex: '0 0 auto' }}>
        {!isHour && (
          <Box component="button" onClick={goBack}
            sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1, py: 0.45, color: T.g6, cursor: 'pointer', fontSize: 11 }}>
            ← Kembali
          </Box>
        )}
        <Sect>{title}</Sect>
        {isMinute && (
          <>
            <Box component="button" onClick={() => shiftHour(-1)} sx={{ border: `1px solid ${T.g3}`, background: T.g0, borderRadius: '4px', px: 0.8, py: 0.35, fontSize: 11, cursor: 'pointer' }}>‹ Jam prev</Box>
            <Box component="button" onClick={() => shiftHour(1)} sx={{ border: `1px solid ${T.g3}`, background: T.g0, borderRadius: '4px', px: 0.8, py: 0.35, fontSize: 11, cursor: 'pointer' }}>Jam next ›</Box>
          </>
        )}
        <Box sx={{ ml: 'auto', fontFamily: T.mono, fontSize: 10, color: T.g5 }}>
          {isHour ? `${unitRows.length} unit · klik cell merah/oranye untuk drill` : 'baris = metrik penyebab · kolom = waktu'}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {isHour ? (
          <Box component="table" sx={{ width: '100%', minWidth: Math.max(760, 130 + hours.length * 64), borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
            <thead>
              <tr>
                <Th sx={{ position: 'sticky', left: 0, top: 0, background: T.g0, zIndex: 4 }}>Unit</Th>
                {hours.map((h) => <Th key={h} sx={{ position: 'sticky', top: 0, background: T.g0, zIndex: 3, textAlign: 'center', minWidth: 62 }}>{fmtHour(h)}</Th>)}
                <Th sx={{ position: 'sticky', top: 0, background: T.g0, zIndex: 3, textAlign: 'right' }}>Average %</Th>
              </tr>
            </thead>
            <tbody>
              {unitRows.map((r) => (
                <Box component="tr" key={r.unit} sx={{ '&:hover td': { outline: `1px solid ${T.selBg}` } }}>
                  <Td sx={{ position: 'sticky', left: 0, background: unitFilter === r.unit ? T.selBg : T.w, color: T.ink, fontWeight: 700 }}>{r.unit}</Td>
                  {r.cells.map((c) => {
                    const bg = c.percent >= 99 ? '#bff4d2' : c.percent >= 95 ? '#f8e6a7' : c.rows === 0 ? T.g1 : '#f7b4ae';
                    return (
                      <Td key={c.hour} onClick={() => { setUnitFilter(r.unit); setDrill({ level: 'minute', unit: r.unit, hour: c.hour }); }}
                        title={`${r.unit} · ${fmtHour(c.hour)} · ${c.fixedRows}/${EXPECTED_ROWS_PER_HOUR} RTK FIX · ${c.rows} row ada · klik untuk detail menit`}
                        sx={{ p: '6px 8px', textAlign: 'center', background: bg, color: T.ink, border: `1px solid ${T.w}`, minWidth: 62, cursor: 'pointer' }}>
                        {c.rows === 0 ? '—' : c.percent.toFixed(c.percent === 100 ? 0 : 1)}
                      </Td>
                    );
                  })}
                  <Td sx={{ color: percentColor(r.percent), fontWeight: 700, textAlign: 'right' }}>{pct(r.percent)}</Td>
                </Box>
              ))}
            </tbody>
          </Box>
        ) : (
          <Box component="table" sx={{ width: '100%', minWidth: Math.max(920, 170 + columns.length * (isSecond ? 54 : 48)), borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
            <thead>
              <tr>
                <Th sx={{ position: 'sticky', left: 0, top: 0, background: T.g0, zIndex: 4 }}>Metric</Th>
                {columns.map((c) => <Th key={c} sx={{ position: 'sticky', top: 0, background: T.g0, zIndex: 3, textAlign: 'center', minWidth: isSecond ? 54 : 48 }}>{isSecond ? fmtSecond(c).slice(-2) : pad2(new Date(c).getMinutes())}</Th>)}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((metric) => (
                <Box component="tr" key={metric.key}>
                  <Td sx={{ position: 'sticky', left: 0, background: T.w, color: T.ink, fontWeight: 700 }}>
                    {metric.label}
                    <Box sx={{ fontFamily: T.mono, color: T.g5, fontSize: 9, fontWeight: 400 }}>{metric.value}{metric.sub ? ` · ${metric.sub}` : ''}</Box>
                  </Td>
                  {columns.map((c) => {
                    const rows = isSecond
                      ? activeMinuteRows.filter((s) => s.ts === c)
                      : activeHourRows.filter((s) => s.ts >= c && s.ts < c + 60 * 1000);
                    const v = detailValue(metric, rows);
                    const colors = metricCell(v.state);
                    return (
                      <Td key={`${metric.key}-${c}`} onClick={() => { if (isMinute) setDrill({ level: 'second', unit: drill.unit, hour: drill.hour, minute: c }); }}
                        title={`${metric.label} · ${isSecond ? fmtSecond(c) : fmtMinute(c)} · ${v.value}${v.sub ? ` · ${v.sub}` : ''}`}
                        sx={{ p: '6px 5px', textAlign: 'center', background: colors.bg, color: colors.color, border: `1px solid ${T.w}`, minWidth: isSecond ? 54 : 48, cursor: isMinute ? 'pointer' : 'default', fontFamily: T.mono, fontWeight: 700 }}>
                        {v.value}
                      </Td>
                    );
                  })}
                </Box>
              ))}
            </tbody>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function RtkQualityView() {
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => toInputDateTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0)));
  const [to, setTo] = useState(() => toInputDateTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0)));
  const [unitFilter, setUnitFilter] = useState('all');
  const [unitQuery, setUnitQuery] = useState('');
  const [unitAnchor, setUnitAnchor] = useState(null);
  const [drill, setDrill] = useState({ level: 'hour' });

  const fromMs = useMemo(() => new Date(from).getTime(), [from]);
  const toMs = useMemo(() => new Date(to).getTime(), [to]);
  const samples = useMemo(() => {
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];
    return generateRtkSamples(fromMs, toMs);
  }, [fromMs, toMs]);

  const filteredSamples = useMemo(
    () => unitFilter === 'all' ? samples : samples.filter((s) => s.unitno === unitFilter),
    [samples, unitFilter]
  );

  const filteredUnitOptions = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    return q ? RTK_UNITS.filter((u) => u.toLowerCase().includes(q)) : RTK_UNITS;
  }, [unitQuery]);
  const chooseUnit = useCallback((u) => {
    setUnitFilter(u);
    setUnitQuery('');
    setUnitAnchor(null);
    setDrill({ level: 'hour' });
  }, []);

  const hours = useMemo(() => {
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];
    const first = Math.floor(fromMs / HOUR_MS) * HOUR_MS;
    const last = Math.ceil(toMs / HOUR_MS) * HOUR_MS;
    const arr = [];
    for (let h = first; h < last; h += HOUR_MS) arr.push(h);
    return arr;
  }, [fromMs, toMs]);

  const unitRows = useMemo(() => {
    const units = unitFilter === 'all' ? RTK_UNITS : [unitFilter];
    return units.map((unit) => {
      const unitSamples = samples.filter((s) => s.unitno === unit);
      const fixed = unitSamples.filter((s) => Number(s.fixQuality) === 4).length;
      const cells = hours.map((h) => {
        const rows = unitSamples.filter((s) => s.ts >= h && s.ts < h + HOUR_MS);
        const fixedRows = rows.filter((s) => Number(s.fixQuality) === 4).length;
        const percent = fixedRows / EXPECTED_ROWS_PER_HOUR * 100;
        return { hour: h, rows: rows.length, fixedRows, percent };
      });
      return {
        unit,
        rows: unitSamples.length,
        fixed,
        percent: unitSamples.length ? fixed / unitSamples.length * 100 : 0,
        cells,
      };
    }).sort((a, b) => a.percent - b.percent);
  }, [samples, unitFilter, hours]);

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) minmax(240px,300px)', minHeight: 0, minWidth: 0, background: T.g0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '10px 16px', borderBottom: `1px solid ${T.line}`, background: T.w, flexWrap: 'wrap' }}>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Box component="input" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)}
            sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', px: 0.75, py: 0.55, fontSize: 11, fontFamily: T.mono, color: T.ink, background: T.g0 }} />
          <Box sx={{ color: T.g5, fontSize: 11 }}>s/d</Box>
          <Box component="input" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)}
            sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', px: 0.75, py: 0.55, fontSize: 11, fontFamily: T.mono, color: T.ink, background: T.g0 }} />
          <Box
            component="button"
            onClick={(e) => setUnitAnchor(e.currentTarget)}
            sx={{
              border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.55, minWidth: 150,
              background: T.g0, color: T.ink, fontFamily: T.mono, fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
            }}
          >
            {unitFilter === 'all' ? 'Semua unit' : unitFilter}
            <span style={{ color: T.g5 }}>▾</span>
          </Box>
          <Popover
            open={Boolean(unitAnchor)}
            anchorEl={unitAnchor}
            onClose={() => { setUnitAnchor(null); setUnitQuery(''); }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { mt: 0.5, width: 220, borderRadius: '6px', overflow: 'hidden' } } }}
          >
            <Box sx={{ p: 1, borderBottom: `1px solid ${T.g1}`, background: T.w }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, border: `1px solid ${T.g3}`, borderRadius: '4px', px: 0.8, py: 0.55, background: T.g0 }}>
                <Box component="span" sx={{ color: T.g5, fontSize: 12 }}>⌕</Box>
                <Box
                  component="input"
                  autoFocus
                  value={unitQuery}
                  onChange={(e) => setUnitQuery(e.target.value)}
                  placeholder="Cari unit..."
                  sx={{ border: 'none', outline: 'none', background: 'none', flex: 1, fontFamily: T.mono, fontSize: 11, color: T.ink }}
                />
              </Box>
            </Box>
            <Box sx={{ maxHeight: 260, overflowY: 'auto', background: T.w }}>
              <Box onClick={() => chooseUnit('all')}
                sx={{ px: 1.25, py: 0.9, fontFamily: T.mono, fontSize: 12, cursor: 'pointer', background: unitFilter === 'all' ? T.selBg : T.w, '&:hover': { background: T.g0 } }}>
                Semua unit
              </Box>
              {filteredUnitOptions.map((u) => (
                <Box key={u} onClick={() => chooseUnit(u)}
                  sx={{ px: 1.25, py: 0.9, fontFamily: T.mono, fontSize: 12, cursor: 'pointer', background: unitFilter === u ? T.selBg : T.w, '&:hover': { background: T.g0 } }}>
                  {u}
                </Box>
              ))}
              {filteredUnitOptions.length === 0 && (
                <Box sx={{ px: 1.25, py: 1.2, fontSize: 12, color: T.g5, textAlign: 'center' }}>Unit tidak ditemukan.</Box>
              )}
            </Box>
          </Popover>
        </Box>
      </Box>

      <Box sx={{ minHeight: 0 }}>
        <RtkQualityMap samples={filteredSamples} selectedUnit={unitFilter} onSelectUnit={setUnitFilter} />
      </Box>

      <RtkQualityMatrix
        level={drill.level || 'hour'}
        drill={drill}
        setDrill={setDrill}
        unitRows={unitRows}
        hours={hours}
        samples={samples}
        unitFilter={unitFilter}
        setUnitFilter={setUnitFilter}
      />
    </Box>
  );
}

export default function MIRHealth() {
  const [view, setView] = useState('pipe');
  const [openDevice, setOpenDevice] = useState(null);

  const drillToDevice = (id, tab) => setOpenDevice({
    id, title: id, type: /^DT|^EX/i.test(id) ? 'Cabin' : 'Rover', group: '—',
    meta: `${/^DT|^EX/i.test(id) ? 'Cabin' : 'Rover'} · ${id}`, fwType: /^DT|^EX/i.test(id) ? 'cabin' : 'rover',
    services: [{ name: 'geofence', state: 'ok' }, { name: 'telemetry', state: 'ok' }], _tab: tab,
  });

  return (
    <Box sx={{ height: '100%', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', background: T.w, fontFamily: T.ff }}>
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1.75, p: '11px 16px', borderBottom: `1px solid ${T.line}`, background: T.w, zIndex: 5 }}>
          <Box sx={{ fontSize: 15, fontWeight: 600, color: T.ink }}>Kesehatan Sistem</Box>
          <Box sx={{ display: 'flex', border: `1px solid ${T.g3}`, borderRadius: '5px', overflow: 'hidden', ml: 1 }}>
            {[['pipe', 'Pipeline'], ['del', 'Pengiriman']].map(([k, l]) => (
              <Box key={k} component="button" onClick={() => setView(k)}
                sx={{ border: 'none', px: 1.6, py: 0.75, fontSize: 12, cursor: 'pointer', background: view === k ? T.ink : T.w, color: view === k ? '#fff' : T.g6 }}>{l}</Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {view === 'pipe' && <PipelineView onDrill={(id) => drillToDevice(id, 'log')} />}
          {view === 'del' && <DeliveryView onDrill={(id) => drillToDevice(id, 'del')} />}
        </Box>

        {openDevice && <MirDeviceWorkspace device={openDevice} initialTab={openDevice._tab || 'del'} onClose={() => setOpenDevice(null)} />}
      </Box>
    </Box>
  );
}
