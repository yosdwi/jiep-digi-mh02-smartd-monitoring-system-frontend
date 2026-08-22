import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { PolygonLayer, TextLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { EditableGeoJsonLayer, DrawPolygonMode, ModifyMode, TranslateMode, ViewMode } from '@deck.gl-community/editable-layers';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import MapContainer from '../components/peta/MapContainer';
import { T, hexToRgb } from '../components/mir/operasi/mirTokens';
import useUserStore from '../stores/userStore';
import { disposalsToKml, parseKmlToDisposals } from '../utils/kml';

const INITIAL_VIEW_STATE = { longitude: 117.275, latitude: 1.912, zoom: 13.4, pitch: 0, bearing: 0, transitionDuration: 800 };
const LAYER_STATE = { orthophoto: true, roads: false, boundaries: false, exRadius: false, pitStops: false };
const PAGE_SIZE = 8;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const isLonLatPair = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Label peta ringkas: buang prefiks "Disposal " (redundan dengan tabel) — cukup kodenya.
const shortDisposalName = (s) => String(s || '').replace(/^Disposal\s+/i, '');

// Heksagon kecil di sekitar center — polygon default disposal baru.
function hexAround([lon, lat], r = 0.0042) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + i * (Math.PI / 3);
    return [lon + r * 1.45 * Math.cos(a), lat + r * Math.sin(a)];
  });
}

function centroid(polygon) {
  const pts = (polygon || []).filter(isLonLatPair);
  if (!pts.length) return null;
  const sum = pts.reduce((acc, [x, y]) => [acc[0] + Number(x), acc[1] + Number(y)], [0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length];
}

function viewStateForPolygons(polys) {
  const points = (polys || []).flat().filter(isLonLatPair);
  if (!points.length) return null;
  const lons = points.map((p) => Number(p[0]));
  const lats = points.map((p) => Number(p[1]));
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const span = Math.max(maxLon - minLon, maxLat - minLat);
  const zoom = span > 0.08 ? 11.6 : span > 0.04 ? 12.3 : span > 0.02 ? 13.1 : span > 0.01 ? 14 : 15;
  return { longitude: (minLon + maxLon) / 2, latitude: (minLat + maxLat) / 2, zoom, pitch: 0, bearing: 0, transitionDuration: 800 };
}

// disposal.polygon (ring terbuka [lon,lat]) <-> GeoJSON Feature (ring tertutup)
function polygonToFeature(polygon) {
  const ring = (polygon || []).filter(isLonLatPair).map(([lon, lat]) => [Number(lon), Number(lat)]);
  if (ring.length < 3) return null;
  const closed = [...ring, ring[0]];
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closed] } };
}
function featureToPolygon(feature) {
  const ring = feature?.geometry?.coordinates?.[0] || [];
  const open = ring.filter(isLonLatPair).map(([lon, lat]) => [Number(lon), Number(lat)]);
  if (open.length > 3) {
    const [fx, fy] = open[0];
    const [lx, ly] = open[open.length - 1];
    if (fx === lx && fy === ly) open.pop();
  }
  return open;
}

const DEPLOYMENT_ENDPOINTS = [
  '/geofence-management/api/getcurrentactivejob?token=EgZjaHJvbWUyBggAEEUYOdIBCDMxNjJqMGo3qAIAsAIA',
];

// ── Seed mockup (dipakai sebelum / bila deployment API tak terjangkau) ──────────
const SEED = [
  ['Disposal A01', true, [117.262, 1.905], 'NOC', '2026-06-10T08:12:00', 'Supervisor', '2026-06-18T11:25:00'],
  ['Disposal A02', true, [117.250, 1.918], 'NOC', '2026-06-11T09:40:00', 'Planner', '2026-06-19T07:05:00'],
  ['Disposal B07', false, [117.289, 1.901], 'Planner', '2026-05-28T14:10:00', 'NOC', '2026-06-12T16:22:00'],
  ['Disposal C03', true, [117.270, 1.928], 'Supervisor', '2026-06-02T07:55:00', 'Supervisor', '2026-06-20T10:11:00'],
  ['Disposal C05', true, [117.300, 1.920], 'Planner', '2026-06-05T11:30:00', 'Planner', '2026-06-15T08:48:00'],
  ['Disposal D02', false, [117.244, 1.896], 'NOC', '2026-04-30T13:05:00', 'NOC', '2026-05-30T09:00:00'],
  ['Disposal E01', true, [117.298, 1.934], 'Supervisor', '2026-06-08T06:20:00', 'Planner', '2026-06-21T12:40:00'],
  ['Disposal E04', true, [117.255, 1.934], 'Planner', '2026-06-09T15:45:00', 'Supervisor', '2026-06-17T17:30:00'],
  ['Disposal F11', false, [117.283, 1.927], 'NOC', '2026-03-22T10:00:00', 'NOC', '2026-05-02T11:15:00'],
].map(([disposal, isActive, center, createdBy, createdDate, modifiedBy, modifiedDate], i) => ({
  id: `DSP-${String(i + 1).padStart(3, '0')}`,
  disposal, district: 'BRCB', isActive,
  polygon: hexAround(center, 0.0036 + (i % 3) * 0.0009),
  createdBy, createdDate, modifiedBy, modifiedDate,
}));

function normalizeDeployment(active) {
  const raw = active?.jsonData ?? active?.JsonData ?? active?.json_data;
  let list = [];
  try { list = Array.isArray(raw) ? raw : JSON.parse(raw || '[]'); } catch { list = []; }
  return list.map((poly, index) => {
    const ring = (poly?.polygon || poly?.coordinates || []).filter(isLonLatPair).map(([lon, lat]) => [Number(lon), Number(lat)]);
    if (ring.length < 3) return null;
    return {
      id: `DEP-${active?.id || 'x'}-${index}`,
      disposal: poly.location || poly.name || `Disposal ${index + 1}`,
      district: active?.district || active?.District || '—',
      isActive: !!(active?.active ?? active?.Active),
      polygon: ring,
      createdBy: active?.createdBy || active?.CreatedBy || 'GeofenceManagement',
      createdDate: active?.createdAt || active?.CreatedAt || '',
      modifiedBy: active?.modifiedBy || active?.ModifiedBy || active?.createdBy || 'GeofenceManagement',
      modifiedDate: active?.modifiedAt || active?.ModifiedAt || '',
    };
  }).filter(Boolean);
}

// ── Gate / Rover (master MIR dumping) ─────────────────────────────────────────
const DEFAULT_THRESHOLDS = { safe: 20, unsafe: 20, line: 0.1, warning: [15, 7, 5] };
const M_PER_DEG = 111320; // meter per derajat (aproksimasi, cukup untuk mockup)

const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// Rover R0 (anchor) menentukan sisi safe; R1,R2 ujung dumping line.
// Dari posisi rover + ambang (meter) → seluruh geometri ter-generate.
function deriveGateGeometry(rovers, thresholds = DEFAULT_THRESHOLDS) {
  const r0 = rovers?.find((r) => r.role === 'anchor')?.position;
  const lineRovers = (rovers || []).filter((r) => r.role === 'line').map((r) => r.position);
  if (lineRovers.length < 2 || !isLonLatPair(r0) || !isLonLatPair(lineRovers[0]) || !isLonLatPair(lineRovers[1])) return null;
  const [r1, r2] = lineRovers;
  const mid = midpoint(r1, r2);
  // arah safe = dari garis menuju anchor (sisi kerja)
  let sx = r0[0] - mid[0];
  let sy = r0[1] - mid[1];
  const len = Math.hypot(sx, sy) || 1e-9;
  sx /= len; sy /= len;
  const m = 1 / M_PER_DEG;
  const off = (pt, dist) => [pt[0] + sx * dist * m, pt[1] + sy * dist * m];
  const safe = Number(thresholds.safe) || 0;
  const unsafe = Number(thresholds.unsafe) || 0;
  const warn = thresholds.warning || DEFAULT_THRESHOLDS.warning;
  return {
    dumping_line: [r1, r2],
    dumping_area: [r1, r2, off(r2, safe), off(r1, safe), r1],
    dumping_unsafe_area: [r1, r2, off(r2, -unsafe), off(r1, -unsafe), r1],
    warnings: warn.map((w) => [off(r1, w), off(r2, w)]),
  };
}

// Posisi rover awal untuk gate, dihitung dari polygon disposal induk
// supaya gate SELALU berada di dalam disposal-nya (skala mengikuti ukuran polygon).
function seedRovers(polygon, slot = 0) {
  const pts = (polygon || []).filter(isLonLatPair);
  const c = centroid(pts) || [117.275, 1.912];
  const xs = pts.map((p) => Number(p[0]));
  const ys = pts.map((p) => Number(p[1]));
  const hw = pts.length ? (Math.max(...xs) - Math.min(...xs)) / 2 : 0.004;
  const hh = pts.length ? (Math.max(...ys) - Math.min(...ys)) / 2 : 0.004;
  const cx = c[0] + (slot ? 0.20 : -0.20) * hw;
  const cy = c[1] + (slot ? 0.28 : -0.28) * hh;
  const half = 0.30 * hw;
  const r1 = [cx - half, cy - 0.05 * hh];
  const r2 = [cx + half, cy + 0.05 * hh];
  const mid = midpoint(r1, r2);
  const sgn = (c[1] - cy) >= 0 ? 1 : -1; // anchor mengarah ke centroid (sisi dalam disposal)
  return [
    { id: 'R0', role: 'anchor', position: [mid[0], mid[1] + sgn * 0.20 * hh] },
    { id: 'R1', role: 'line', position: r1 },
    { id: 'R2', role: 'line', position: r2 },
  ];
}

const roverColor = (role) => (role === 'anchor' ? [31, 122, 150] : [46, 158, 91]);

function roversToFeatures(rovers) {
  return {
    type: 'FeatureCollection',
    features: (rovers || []).map((r) => ({
      type: 'Feature',
      properties: { roverId: r.id, role: r.role },
      geometry: { type: 'Point', coordinates: r.position },
    })),
  };
}
// Map balik posisi titik hasil edit ke struktur rover (urutan feature == urutan rover).
function featuresToRovers(fc, rovers) {
  return (rovers || []).map((r, i) => {
    const pos = fc?.features?.[i]?.geometry?.coordinates;
    return isLonLatPair(pos) ? { ...r, position: [Number(pos[0]), Number(pos[1])] } : r;
  });
}

// Generate gate dummy untuk sekumpulan disposal — rover dihitung dari polygon-nya,
// jadi gate selalu nempel di dalam disposal (dipakai seed & saat deployment live di-load).
function makeGatesForDisposals(list) {
  return (list || []).slice(0, 6).flatMap((d, i) => {
    const n = (i % 2) + 1; // 1–2 gate per disposal
    return Array.from({ length: n }, (_, g) => ({
      id: `GT-${d.id}-${g + 1}`,
      name: `Gate ${g + 1}`,
      disposalId: d.id,
      district: d.district,
      isActive: !(i === 2 && g === 1),
      rovers: seedRovers(d.polygon, g),
      thresholds: { ...DEFAULT_THRESHOLDS, warning: [...DEFAULT_THRESHOLDS.warning] },
      createdBy: d.createdBy,
      createdDate: d.createdDate,
      modifiedBy: d.modifiedBy,
      modifiedDate: d.modifiedDate,
    }));
  });
}
const GATE_SEED = makeGatesForDisposals(SEED);

// ── Assignment (cabin → disposal/gate) ────────────────────────────────────────
const UNIT_SEED = ['DT4248', 'DT4275', 'DT4461', 'DT4624', 'DT4724', 'DT5357', 'DT4766', 'DT4801', 'DT4815'];

// Generate assignment dummy: tiap unit di-assign ke disposal (round-robin),
// sebagian dengan gate spesifik. Dipakai seed & saat deployment live di-load.
function makeAssignmentsForDisposals(list, gateList) {
  if (!list?.length) return [];
  return UNIT_SEED.map((unit, i) => {
    const d = list[i % list.length];
    const gatesOfD = (gateList || []).filter((g) => g.disposalId === d.id);
    const gate = (i % 3 === 0 && gatesOfD[0]) ? gatesOfD[0] : null;
    return {
      id: `ASG-${String(i + 1).padStart(3, '0')}`,
      unit,
      disposalId: d.id,
      gateId: gate?.id || null,
      plan: i % 4 === 0 ? 'Standby' : `Produksi ${d.disposal.replace('Disposal ', '')}`,
      isActive: i % 5 !== 0,
      createdBy: 'Dispatch', createdDate: '2026-06-19T07:30:00',
      modifiedBy: 'Dispatch', modifiedDate: '2026-06-21T06:10:00',
    };
  });
}
const ASSIGN_SEED = makeAssignmentsForDisposals(SEED, GATE_SEED);

// ── UI atoms ────────────────────────────────────────────────────────────────
function Pill({ children, tone = T.g5, filled = false, onClick, title }) {
  return (
    <Box component={onClick ? 'button' : 'span'} type={onClick ? 'button' : undefined} title={title}
      onClick={onClick}
      sx={{
        display: 'inline-block', border: 'none', px: 0.85, py: 0.35, borderRadius: '4px',
        background: filled ? tone : `${tone}1f`, color: filled ? '#fff' : tone,
        fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
      }}>
      {children}
    </Box>
  );
}

const IconBtn = ({ children, onClick, title, tone = T.g6 }) => (
  <Box component="button" type="button" title={title} onClick={onClick}
    sx={{ border: `1px solid ${T.g3}`, background: T.w, color: tone, borderRadius: '4px', px: 0.55, py: 0.3, fontSize: 13, lineHeight: 1, cursor: 'pointer', '&:hover': { background: T.g0, borderColor: tone } }}>{children}</Box>
);

// Tombol aksi baris (label jelas, bukan ikon ambigu).
const RowBtn = ({ children, onClick, title, tone = T.g6 }) => (
  <Box component="button" type="button" title={title} onClick={onClick}
    sx={{ border: `1px solid ${T.g3}`, background: T.w, color: tone, borderRadius: '5px', px: 0.85, py: 0.4, fontSize: 11.5, fontWeight: 700, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 0.35, '&:hover': { background: `${tone}14`, borderColor: tone } }}>{children}</Box>
);

// Badge status read-only (tidak bisa di-klik untuk ubah — hindari aksi destruktif tak sengaja).
const StatusBadge = ({ active }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.85, py: 0.35, borderRadius: '999px', border: `1px solid ${active ? `${T.ok}55` : T.g3}`, background: active ? `${T.ok}14` : T.g0, color: active ? T.ok : T.g5, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
    <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: active ? T.ok : T.g4 }} />
    {active ? 'Aktif' : 'Nonaktif'}
  </Box>
);

const ToolbarBtn = ({ children, onClick, primary, disabled }) => (
  <Box component="button" type="button" onClick={onClick} disabled={disabled}
    sx={{
      border: `1px solid ${primary ? T.sel : T.g3}`, color: primary ? '#fff' : T.g6,
      background: primary ? T.sel : T.w, borderRadius: '5px', px: 1.1, py: 0.5, fontSize: 12, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
      fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 0.5,
      '&:hover': disabled ? {} : { background: primary ? T.ink : T.g0 },
    }}>{children}</Box>
);

// Tab navigasi master (gaya underline, profesional).
const MASTER_TABS = [
  { key: 'disposal', label: 'Master Disposal' },
  { key: 'gate', label: 'Master Gate' },
  { key: 'assign', label: 'Master Assign' },
];
function MasterTabs({ value, onChange }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0, borderBottom: `1px solid ${T.line}`, background: T.w, px: 0.5 }}>
      {MASTER_TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <Box key={tab.key} component="button" type="button" onClick={() => onChange(tab.key)}
            sx={{ position: 'relative', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', px: 1.6, py: 1.1, fontSize: 13, fontWeight: active ? 800 : 600, color: active ? T.ink : T.g5, '&:hover': { color: T.ink }, '&::after': { content: '""', position: 'absolute', left: 10, right: 10, bottom: -1, height: 2.5, borderRadius: '2px', background: active ? T.sel : 'transparent' } }}>
            {tab.label}
          </Box>
        );
      })}
    </Box>
  );
}

// Search bar profesional: ikon di dalam, focus ring, tombol clear.
function SearchInput({ value, onChange, placeholder }) {
  return (
    <Box sx={{ position: 'relative', width: 280, '&:focus-within .sb': { borderColor: T.sel, boxShadow: `0 0 0 3px ${T.sel}22` } }}>
      <Box className="sb" sx={{ display: 'flex', alignItems: 'center', border: `1px solid ${T.g3}`, borderRadius: '6px', background: T.w, transition: 'box-shadow .12s, border-color .12s' }}>
        <Box sx={{ pl: 0.9, pr: 0.5, color: T.g4, display: 'flex' }}><SearchIcon sx={{ fontSize: 18 }} /></Box>
        <Box component="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          sx={{ flex: 1, border: 'none', outline: 'none', background: 'none', py: 0.6, pr: 0.5, fontSize: 13, color: T.ink, fontFamily: 'inherit', '&::placeholder': { color: T.g4 } }} />
        {value && (
          <Box component="button" type="button" onClick={() => onChange('')} title="Bersihkan"
            sx={{ border: 'none', background: 'none', cursor: 'pointer', color: T.g4, px: 0.6, display: 'flex', alignItems: 'center', fontFamily: 'inherit', '&:hover': { color: T.g6 } }}><CloseIcon sx={{ fontSize: 16 }} /></Box>
        )}
      </Box>
    </Box>
  );
}

const Field = ({ label, children, hint }) => (
  <Box sx={{ mb: 1.25 }}>
    <Box sx={{ fontSize: 10.5, color: T.g5, textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 800, mb: 0.4 }}>{label}</Box>
    {children}
    {hint && <Box sx={{ mt: 0.35, fontSize: 11, color: T.g4 }}>{hint}</Box>}
  </Box>
);

const inputSx = { width: '100%', boxSizing: 'border-box', border: `1px solid ${T.g3}`, borderRadius: '5px', px: 0.85, py: 0.6, fontSize: 13, color: T.ink, outline: 'none', fontFamily: 'inherit', '&:focus': { borderColor: T.sel } };

// ── Map overlay + polygon editor ──────────────────────────────────────────────
function EditorHint({ editMode, count }) {
  if (editMode === 'view') return null;
  const text = editMode === 'draw'
    ? (count ? 'Klik untuk menambah titik · klik ganda untuk menutup polygon' : 'Klik di peta untuk mulai menggambar polygon')
    : editMode === 'translate' ? 'Tarik polygon untuk memindahkan' : 'Tarik titik untuk mengubah · klik titik tengah untuk menambah';
  return (
    <Box sx={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 14, background: T.ink, color: '#fff', px: 1.4, py: 0.7, borderRadius: '6px', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}>
      {text}
    </Box>
  );
}

// Toggle visibilitas layer peta (independen dari tab) — beri konteks saat mengedit.
function LayerToggle({ visible, onToggle }) {
  const rows = [
    { key: 'disposal', label: 'Disposal', swatch: T.ok, disabled: false },
    { key: 'gate', label: 'Gate', swatch: T.crit, disabled: false },
    { key: 'cabin', label: 'Cabin', swatch: '#3f51b5', disabled: false },
  ];
  return (
    <Box sx={{ position: 'absolute', top: 14, left: 14, zIndex: 12, background: 'rgba(255,255,255,.96)', border: `1px solid ${T.line}`, borderRadius: '6px', p: 0.6, boxShadow: '0 3px 12px rgba(20,31,42,.12)', minWidth: 116 }}>
      <Box sx={{ fontSize: 9.5, fontWeight: 800, color: T.g5, textTransform: 'uppercase', letterSpacing: '0.7px', px: 0.6, pt: 0.3, pb: 0.5 }}>Tampilkan</Box>
      {rows.map((r) => {
        const on = !!visible[r.key];
        return (
          <Box key={r.key} component="button" type="button" disabled={r.disabled} onClick={() => onToggle(r.key)}
            sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 0.6, border: 'none', background: 'none', cursor: r.disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', px: 0.6, py: 0.45, borderRadius: '4px', opacity: r.disabled ? 0.5 : 1, '&:hover': r.disabled ? {} : { background: T.g0 } }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '3px', flex: '0 0 auto', border: `1.5px solid ${on && !r.disabled ? T.sel : T.g4}`, background: on && !r.disabled ? T.sel : T.w, color: '#fff', fontSize: 10, lineHeight: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && !r.disabled ? '✓' : ''}</Box>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: r.swatch }} />
            <Box sx={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{r.label}</Box>
            {r.hint && <Box sx={{ ml: 'auto', fontSize: 9, color: T.g4, fontStyle: 'italic' }}>{r.hint}</Box>}
          </Box>
        );
      })}
    </Box>
  );
}

function MapLegend({ tab, cabinOn }) {
  return (
    <Box sx={{ position: 'absolute', bottom: 14, left: 14, zIndex: 12, display: 'flex', alignItems: 'center', gap: 1.4, background: 'rgba(255,255,255,.95)', border: `1px solid ${T.line}`, borderRadius: '6px', px: 1.2, py: 0.7, fontSize: 11, color: T.g6, boxShadow: '0 3px 12px rgba(20,31,42,.12)' }}>
      {tab === 'gate' ? (
        <>
          <span><b style={{ color: T.ok }}>■</b> Dumping area</span>
          <span><b style={{ color: T.crit }}>■</b> Zona bahaya</span>
          <span><b style={{ color: T.warn }}>—</b> Warning</span>
          <span><b style={{ color: '#1f7a96' }}>●</b> Rover 0</span>
          <span><b style={{ color: T.ok }}>●</b> Rover line</span>
        </>
      ) : (
        <>
          <span><b style={{ color: T.sel }}>■</b> Terpilih</span>
          <span><b style={{ color: T.ok }}>■</b> Aktif</span>
          <span><b style={{ color: T.g4 }}>■</b> Nonaktif</span>
        </>
      )}
      {cabinOn && <span><b style={{ color: '#3f51b5' }}>●</b> Cabin</span>}
    </Box>
  );
}

// ── Form drawer (Tambah / Ubah Disposal) ──────────────────────────────────────
function DisposalForm({ draft, setDraft, mode, editMode, setEditMode, onSave, onCancel, districts }) {
  const vertexCount = (draft.polygon || []).length;
  const canSave = draft.disposal?.trim() && vertexCount >= 3;
  return (
    <Box sx={{ position: 'absolute', top: 12, right: 12, bottom: 12, zIndex: 20, width: 330, border: `1px solid ${T.line}`, borderRadius: '8px', background: 'rgba(255,255,255,.98)', boxShadow: '0 10px 30px rgba(20,31,42,.25)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 1.4, py: 1.1, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center' }}>
        <Box>
          <Box sx={{ fontSize: 14, fontWeight: 900, color: T.ink }}>{mode === 'add' ? 'Tambah Disposal' : 'Ubah Disposal'}</Box>
          <Box sx={{ fontSize: 11, color: T.g5, mt: 0.15 }}>Master geofence · polygon editor</Box>
        </Box>
        <Box component="button" onClick={onCancel} sx={{ ml: 'auto', border: `1px solid ${T.g3}`, background: T.w, borderRadius: '5px', px: 0.8, py: 0.4, cursor: 'pointer', color: T.g6, fontFamily: 'inherit' }}>✕</Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.4 }}>
        <Field label="Disposal (nama / primary key)">
          <Box component="input" value={draft.disposal} onChange={(e) => setDraft((d) => ({ ...d, disposal: e.target.value }))} placeholder="cth. Disposal A01" sx={inputSx} />
        </Field>
        <Field label="District">
          <Box component="input" list="district-list" value={draft.district} onChange={(e) => setDraft((d) => ({ ...d, district: e.target.value }))} placeholder="cth. BRCG" sx={inputSx} />
          <Box component="datalist" id="district-list">{districts.map((d) => <option key={d} value={d} />)}</Box>
        </Field>
        <Field label="Status">
          <Box sx={{ display: 'flex', gap: 0.6 }}>
            <Pill tone={T.ok} filled={draft.isActive} onClick={() => setDraft((d) => ({ ...d, isActive: true }))}>Aktif</Pill>
            <Pill tone={T.g5} filled={!draft.isActive} onClick={() => setDraft((d) => ({ ...d, isActive: false }))}>Nonaktif</Pill>
          </Box>
        </Field>

        <Box sx={{ mt: 1.5, mb: 0.6, fontSize: 10.5, color: T.g5, textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 800 }}>Polygon</Box>
        <Box sx={{ border: `1px solid ${T.line}`, borderRadius: '6px', p: 1, background: T.g0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.85 }}>
            <Pill tone={vertexCount >= 3 ? T.ok : T.warn}>{vertexCount} titik</Pill>
            <Box sx={{ fontSize: 11, color: T.g5 }}>{vertexCount >= 3 ? 'polygon valid' : 'butuh ≥ 3 titik'}</Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <ToolbarBtn primary={editMode === 'draw'} onClick={() => { setDraft((d) => ({ ...d, polygon: [] })); setEditMode('draw'); }}>✎ Gambar ulang</ToolbarBtn>
            <ToolbarBtn primary={editMode === 'modify'} onClick={() => setEditMode('modify')} disabled={vertexCount < 3}>⬡ Edit titik</ToolbarBtn>
            <ToolbarBtn primary={editMode === 'translate'} onClick={() => setEditMode('translate')} disabled={vertexCount < 3}>✥ Geser</ToolbarBtn>
            <ToolbarBtn onClick={() => setEditMode('view')} disabled={editMode === 'view'}>Selesai</ToolbarBtn>
          </Box>
        </Box>

        {mode === 'edit' && (
          <Box sx={{ mt: 1.5, border: `1px solid ${T.line}`, borderRadius: '6px', p: 1, fontSize: 11.5, color: T.g6, lineHeight: 1.7 }}>
            <Box><b style={{ color: T.ink }}>Dibuat:</b> {formatDate(draft.createdDate)} · {draft.createdBy || '—'}</Box>
            <Box><b style={{ color: T.ink }}>Diubah:</b> {formatDate(draft.modifiedDate)} · {draft.modifiedBy || '—'}</Box>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 1.4, py: 1.1, borderTop: `1px solid ${T.line}`, display: 'flex', gap: 0.8 }}>
        <ToolbarBtn onClick={onCancel}>Batal</ToolbarBtn>
        <Box sx={{ flex: 1 }} />
        <ToolbarBtn primary disabled={!canSave} onClick={onSave}>Simpan</ToolbarBtn>
      </Box>
    </Box>
  );
}

// Form Gate: pilih disposal induk, set ambang per-gate, geser rover di peta (preview auto).
function GateForm({ draft, setDraft, mode, onSave, onCancel, disposals }) {
  const fmt = (p) => (isLonLatPair(p) ? `${Number(p[0]).toFixed(5)}, ${Number(p[1]).toFixed(5)}` : '—');
  const setThreshold = (key, value) => setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, [key]: value } }));
  const setWarning = (i, value) => setDraft((d) => { const w = [...d.thresholds.warning]; w[i] = value; return { ...d, thresholds: { ...d.thresholds, warning: w } }; });
  const r0 = draft.rovers?.find((r) => r.role === 'anchor');
  const canSave = draft.name?.trim() && draft.disposalId && (draft.rovers || []).length >= 3;
  const numSx = { ...inputSx, py: 0.45, textAlign: 'center' };
  return (
    <Box sx={{ position: 'absolute', top: 12, right: 12, bottom: 12, zIndex: 20, width: 340, border: `1px solid ${T.line}`, borderRadius: '8px', background: 'rgba(255,255,255,.98)', boxShadow: '0 10px 30px rgba(20,31,42,.25)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 1.4, py: 1.1, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center' }}>
        <Box>
          <Box sx={{ fontSize: 14, fontWeight: 900, color: T.ink }}>{mode === 'add' ? 'Tambah Gate' : 'Ubah Gate'}</Box>
          <Box sx={{ fontSize: 11, color: T.g5, mt: 0.15 }}>Master MIR dumping · editor rover</Box>
        </Box>
        <Box component="button" onClick={onCancel} sx={{ ml: 'auto', border: `1px solid ${T.g3}`, background: T.w, borderRadius: '5px', px: 0.8, py: 0.4, cursor: 'pointer', color: T.g6, fontFamily: 'inherit' }}>✕</Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.4 }}>
        <Field label="Nama gate (primary key)">
          <Box component="input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="cth. Gate 1" sx={inputSx} />
        </Field>
        <Field label="Disposal induk">
          <Box component="select" value={draft.disposalId} onChange={(e) => setDraft((d) => ({ ...d, disposalId: e.target.value }))} sx={{ ...inputSx, cursor: 'pointer' }}>
            <option value="" disabled>Pilih disposal…</option>
            {disposals.map((d) => <option key={d.id} value={d.id}>{d.disposal}</option>)}
          </Box>
        </Field>
        <Field label="Status">
          <Box sx={{ display: 'flex', gap: 0.6 }}>
            <Pill tone={T.ok} filled={draft.isActive} onClick={() => setDraft((d) => ({ ...d, isActive: true }))}>Aktif</Pill>
            <Pill tone={T.g5} filled={!draft.isActive} onClick={() => setDraft((d) => ({ ...d, isActive: false }))}>Nonaktif</Pill>
          </Box>
        </Field>

        <Box sx={{ mt: 1.5, mb: 0.6, fontSize: 10.5, color: T.g5, textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 800 }}>Ambang (meter)</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8 }}>
          <Box><Box sx={{ fontSize: 10.5, color: T.g5, mb: 0.3 }}>Safe</Box><Box component="input" type="number" value={draft.thresholds.safe} onChange={(e) => setThreshold('safe', Number(e.target.value))} sx={numSx} /></Box>
          <Box><Box sx={{ fontSize: 10.5, color: T.g5, mb: 0.3 }}>Unsafe</Box><Box component="input" type="number" value={draft.thresholds.unsafe} onChange={(e) => setThreshold('unsafe', Number(e.target.value))} sx={numSx} /></Box>
        </Box>
        <Box sx={{ mt: 0.8, fontSize: 10.5, color: T.g5, mb: 0.3 }}>Warning 1 / 2 / 3</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.8 }}>
          {[0, 1, 2].map((i) => <Box key={i} component="input" type="number" value={draft.thresholds.warning[i]} onChange={(e) => setWarning(i, Number(e.target.value))} sx={numSx} />)}
        </Box>

        <Box sx={{ mt: 1.5, mb: 0.6, fontSize: 10.5, color: T.g5, textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 800 }}>Rover</Box>
        <Box sx={{ border: `1px solid ${T.line}`, borderRadius: '6px', overflow: 'hidden' }}>
          {(draft.rovers || []).map((r) => (
            <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.7, px: 1, py: 0.7, borderBottom: `1px solid ${T.g1}`, '&:last-of-type': { borderBottom: 'none' } }}>
              <Box sx={{ width: 9, height: 9, borderRadius: '50%', background: `rgb(${roverColor(r.role).join(',')})`, flex: '0 0 auto' }} />
              <Box sx={{ fontWeight: 800, color: T.ink, width: 28 }}>{r.id}</Box>
              <Pill tone={r.role === 'anchor' ? T.sel : T.ok}>{r.role === 'anchor' ? 'anchor' : 'line'}</Pill>
              <Box sx={{ ml: 'auto', fontFamily: T.mono, fontSize: 10.5, color: T.g6 }}>{fmt(r.position)}</Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 1, border: `1px solid ${T.line}`, borderRadius: '6px', background: T.g0, p: 1, fontSize: 11.5, color: T.g6, lineHeight: 1.55 }}>
          Geser titik <b style={{ color: T.ink }}>rover</b> di peta. <b style={{ color: '#1f7a96' }}>R0 (anchor)</b> menentukan sisi aman; dumping area, zona bahaya, & garis warning ter-generate otomatis sebagai preview.
        </Box>
      </Box>

      <Box sx={{ px: 1.4, py: 1.1, borderTop: `1px solid ${T.line}`, display: 'flex', gap: 0.8 }}>
        <ToolbarBtn onClick={onCancel}>Batal</ToolbarBtn>
        <Box sx={{ flex: 1 }} />
        <ToolbarBtn primary disabled={!canSave} onClick={onSave}>Simpan</ToolbarBtn>
      </Box>
    </Box>
  );
}

// Form Assign: cabin → disposal (+ gate opsional). Tanpa editor peta — peta cuma highlight target.
function AssignForm({ draft, setDraft, mode, onSave, onCancel, disposals, gates, units, onDisposalChange }) {
  const gatesOfDisposal = gates.filter((g) => g.disposalId === draft.disposalId);
  const canSave = draft.unit?.trim() && draft.disposalId;
  return (
    <Box sx={{ position: 'absolute', top: 12, right: 12, bottom: 12, zIndex: 20, width: 320, border: `1px solid ${T.line}`, borderRadius: '8px', background: 'rgba(255,255,255,.98)', boxShadow: '0 10px 30px rgba(20,31,42,.25)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 1.4, py: 1.1, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center' }}>
        <Box>
          <Box sx={{ fontSize: 14, fontWeight: 900, color: T.ink }}>{mode === 'add' ? 'Tambah Assignment' : 'Ubah Assignment'}</Box>
          <Box sx={{ fontSize: 11, color: T.g5, mt: 0.15 }}>Mapping cabin → disposal / gate</Box>
        </Box>
        <Box component="button" onClick={onCancel} sx={{ ml: 'auto', border: `1px solid ${T.g3}`, background: T.w, borderRadius: '5px', px: 0.8, py: 0.4, cursor: 'pointer', color: T.g6, fontFamily: 'inherit' }}>✕</Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.4 }}>
        <Field label="Cabin / Unit">
          <Box component="input" list="unit-list" value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value.toUpperCase() }))} placeholder="cth. DT4248" sx={inputSx} />
          <Box component="datalist" id="unit-list">{units.map((u) => <option key={u} value={u} />)}</Box>
        </Field>
        <Field label="Disposal">
          <Box component="select" value={draft.disposalId} onChange={(e) => onDisposalChange(e.target.value)} sx={{ ...inputSx, cursor: 'pointer' }}>
            <option value="" disabled>Pilih disposal…</option>
            {disposals.map((d) => <option key={d.id} value={d.id}>{d.disposal}</option>)}
          </Box>
        </Field>
        <Field label="Gate" hint="Kosong = berlaku untuk semua gate di disposal.">
          <Box component="select" value={draft.gateId || ''} onChange={(e) => setDraft((d) => ({ ...d, gateId: e.target.value || null }))} sx={{ ...inputSx, cursor: 'pointer' }}>
            <option value="">Semua gate</option>
            {gatesOfDisposal.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Box>
        </Field>
        <Field label="Plan (opsional)">
          <Box component="input" value={draft.plan} onChange={(e) => setDraft((d) => ({ ...d, plan: e.target.value }))} placeholder="cth. Produksi A01 / Standby" sx={inputSx} />
        </Field>
        <Field label="Status">
          <Box sx={{ display: 'flex', gap: 0.6 }}>
            <Pill tone={T.ok} filled={draft.isActive} onClick={() => setDraft((d) => ({ ...d, isActive: true }))}>Aktif</Pill>
            <Pill tone={T.g5} filled={!draft.isActive} onClick={() => setDraft((d) => ({ ...d, isActive: false }))}>Nonaktif</Pill>
          </Box>
        </Field>
      </Box>

      <Box sx={{ px: 1.4, py: 1.1, borderTop: `1px solid ${T.line}`, display: 'flex', gap: 0.8 }}>
        <ToolbarBtn onClick={onCancel}>Batal</ToolbarBtn>
        <Box sx={{ flex: 1 }} />
        <ToolbarBtn primary disabled={!canSave} onClick={onSave}>Simpan</ToolbarBtn>
      </Box>
    </Box>
  );
}

// ── TanStack table ────────────────────────────────────────────────────────────
function DataGrid({ data, globalFilter, sorting, setSorting, pagination, setPagination, columns, onRowClick, emptyText = 'Tidak ada data yang cocok.', unitLabel = 'baris', minWidth = 1000 }) {
  const table = useReactTable({
    data, columns,
    state: { globalFilter, sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const leaf = table.getVisibleLeafColumns();
  const grid = leaf.map((c) => c.columnDef.meta?.width || '1fr').join(' ');
  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Box sx={{ minWidth }}>
          {/* header */}
          <Box sx={{ display: 'grid', gridTemplateColumns: grid, position: 'sticky', top: 0, zIndex: 2, background: T.g1, borderBottom: `2px solid ${T.g3}` }}>
            {table.getHeaderGroups()[0].headers.map((header) => {
              const def = header.column.columnDef;
              const sortable = header.column.getCanSort();
              const dir = header.column.getIsSorted();
              return (
                <Box key={header.id} onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                  sx={{ px: 1.2, py: 0.85, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.g6, textAlign: def.meta?.align || 'left', cursor: sortable ? 'pointer' : 'default', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 0.4, justifyContent: def.meta?.align === 'right' ? 'flex-end' : def.meta?.align === 'center' ? 'center' : 'flex-start', borderRight: `1px solid ${T.g2}`, '&:last-of-type': { borderRight: 'none' }, '&:hover': sortable ? { color: T.ink } : {} }}>
                  {flexRender(def.header, header.getContext())}
                  {sortable && <Box component="span" sx={{ fontSize: 9, color: dir ? T.sel : T.g3 }}>{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</Box>}
                </Box>
              );
            })}
          </Box>
          {/* rows */}
          {rows.length === 0 ? (
            <Box sx={{ px: 1.2, py: 4, textAlign: 'center', color: T.g5, fontSize: 13 }}>{emptyText}</Box>
          ) : rows.map((row) => (
            <Box key={row.id} onClick={() => onRowClick?.(row.original)} sx={{ display: 'grid', gridTemplateColumns: grid, alignItems: 'center', borderBottom: `1px solid ${T.g2}`, boxShadow: row.original.__selected ? `inset 3px 0 0 ${T.sel}` : 'none', fontSize: 12.5, cursor: 'pointer', background: row.original.__selected ? T.selBg : T.w, '&:hover': { background: row.original.__selected ? T.selBg : T.g0 } }}>
              {row.getVisibleCells().map((cell) => (
                <Box key={cell.id} sx={{ px: 1.2, py: 0.85, textAlign: cell.column.columnDef.meta?.align || 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: `1px solid ${T.g1}`, '&:last-of-type': { borderRight: 'none' } }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>

      {/* pagination */}
      <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 0.85, borderTop: `1px solid ${T.line}`, background: T.w, fontSize: 12, color: T.g6 }}>
        <Box>{total} {unitLabel}{total ? ` · ${pageIndex * PAGE_SIZE + 1}–${Math.min((pageIndex + 1) * PAGE_SIZE, total)}` : ''}</Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <IconBtn title="Pertama" onClick={() => table.setPageIndex(0)}>«</IconBtn>
          <IconBtn title="Sebelumnya" onClick={() => table.previousPage()}>‹</IconBtn>
          <Box sx={{ px: 0.8, fontWeight: 700, color: T.ink }}>{pageCount ? pageIndex + 1 : 0} / {pageCount}</Box>
          <IconBtn title="Berikutnya" onClick={() => table.nextPage()}>›</IconBtn>
          <IconBtn title="Terakhir" onClick={() => table.setPageIndex(pageCount - 1)}>»</IconBtn>
        </Box>
      </Box>
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MIRGeofence() {
  const profile = useUserStore((s) => s.profile);
  const district = profile?.distrik;
  const currentUser = profile?.nama || 'NOC';

  const [disposals, setDisposals] = useState(SEED);
  const [gates, setGates] = useState(GATE_SEED);
  const [assignments, setAssignments] = useState(ASSIGN_SEED);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedGateId, setSelectedGateId] = useState(null);
  const [selectedAssignId, setSelectedAssignId] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [masterTab, setMasterTab] = useState('disposal'); // disposal | gate | assign
  const [visible, setVisible] = useState({ disposal: true, gate: true, cabin: false });
  const toggleLayer = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  // table state
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([{ id: 'disposal', desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [gateSorting, setGateSorting] = useState([{ id: 'name', desc: false }]);
  const [gatePagination, setGatePagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [assignSorting, setAssignSorting] = useState([{ id: 'unit', desc: false }]);
  const [assignPagination, setAssignPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [assignDisposalFilter, setAssignDisposalFilter] = useState('');

  // form/editor state — disposal
  const [form, setForm] = useState(null); // { mode:'add'|'edit', id }
  const [draft, setDraft] = useState(null);
  const [editMode, setEditMode] = useState('view'); // view|draw|modify|translate
  const [editFeatures, setEditFeatures] = useState({ type: 'FeatureCollection', features: [] });
  // form/editor state — gate
  const [gateForm, setGateForm] = useState(null); // { mode:'add'|'edit', id }
  const [gateDraft, setGateDraft] = useState(null);
  const [gateFeatures, setGateFeatures] = useState({ type: 'FeatureCollection', features: [] });
  // form state — assignment
  const [assignForm, setAssignForm] = useState(null); // { mode:'add'|'edit', id }
  const [assignDraft, setAssignDraft] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const url of DEPLOYMENT_ENDPOINTS) {
        try {
          const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
          if (!res.ok) throw new Error(String(res.status));
          const payload = await res.json();
          const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
          const active = list.find((x) => x.active || x.Active) || list[0];
          const normalized = normalizeDeployment(active);
          if (!cancelled && normalized.length) {
            const newGates = makeGatesForDisposals(normalized); // gate & assign dummy ikut ke disposal live
            setDisposals(normalized);
            setGates(newGates);
            setAssignments(makeAssignmentsForDisposals(normalized, newGates));
            const v = viewStateForPolygons(normalized.map((d) => d.polygon));
            if (v) setViewState(v);
          }
          return;
        } catch { /* try next */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Masuk tab Assign → tampilkan cabin otomatis (tetap bisa di-toggle manual setelahnya).
  useEffect(() => { if (masterTab === 'assign') setVisible((v) => (v.cabin ? v : { ...v, cabin: true })); }, [masterTab]);

  const districts = useMemo(() => Array.from(new Set(disposals.map((d) => d.district).filter(Boolean))).sort(), [disposals]);

  const tableData = useMemo(
    () => disposals.map((d) => ({ ...d, __selected: d.id === selectedId })),
    [disposals, selectedId]
  );

  const focusPolygon = (poly) => {
    const v = viewStateForPolygons([poly]);
    if (v) setViewState((cur) => ({ ...cur, ...v, zoom: Math.max(v.zoom, 14.2), transitionDuration: 650 }));
  };

  const openAdd = () => {
    const center = [viewState.longitude, viewState.latitude];
    setDraft({ id: `DSP-${Date.now().toString().slice(-6)}`, disposal: '', district: district || '', isActive: true, polygon: [], createdBy: currentUser, createdDate: new Date().toISOString() });
    setEditFeatures({ type: 'FeatureCollection', features: [] });
    setEditMode('draw');
    setForm({ mode: 'add' });
    focusPolygon(hexAround(center));
  };

  const openEdit = (row, startMode = 'view') => {
    setSelectedId(row.id);
    setDraft({ ...row });
    const f = polygonToFeature(row.polygon);
    setEditFeatures({ type: 'FeatureCollection', features: f ? [f] : [] });
    setEditMode(startMode);
    setForm({ mode: 'edit', id: row.id });
    focusPolygon(row.polygon);
  };

  const closeForm = () => { setForm(null); setDraft(null); setEditMode('view'); setEditFeatures({ type: 'FeatureCollection', features: [] }); };

  const saveForm = () => {
    if (!draft) return;
    const now = new Date().toISOString();
    if (form.mode === 'add') {
      setDisposals((s) => [{ ...draft, modifiedBy: currentUser, modifiedDate: now }, ...s]);
    } else {
      setDisposals((s) => s.map((d) => (d.id === draft.id ? { ...draft, modifiedBy: currentUser, modifiedDate: now } : d)));
    }
    setSelectedId(draft.id);
    closeForm();
  };

  const deleteDisposal = (row) => {
    if (!window.confirm(`Hapus ${row.disposal}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDisposals((s) => s.filter((d) => d.id !== row.id));
    if (selectedId === row.id) setSelectedId(null);
  };

  // KML
  const exportKml = () => {
    const blob = new Blob([disposalsToKml(disposals)], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `master-disposal${district ? `-${district}` : ''}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseKmlToDisposals(await file.text());
      if (!parsed.length) { window.alert('Tidak ada polygon yang ditemukan di file KML.'); return; }
      const now = new Date().toISOString();
      const imported = parsed.map((p, i) => ({
        id: `KML-${Date.now().toString().slice(-5)}-${i}`,
        disposal: p.disposal, district: p.district || district || '—', isActive: p.isActive,
        polygon: p.polygon, createdBy: p.createdBy || currentUser, createdDate: now, modifiedBy: currentUser, modifiedDate: now,
      }));
      setDisposals((s) => [...imported, ...s]);
      const v = viewStateForPolygons(imported.map((d) => d.polygon));
      if (v) setViewState(v);
      window.alert(`${imported.length} disposal di-import dari KML.`);
    } catch (err) {
      window.alert(err.message || 'Gagal membaca file KML.');
    } finally {
      e.target.value = '';
    }
  };

  // onEdit dari EditableGeoJsonLayer
  const onEdit = ({ updatedData, editType }) => {
    setEditFeatures(updatedData);
    const last = updatedData.features[updatedData.features.length - 1];
    if (last) setDraft((d) => (d ? { ...d, polygon: featureToPolygon(last) } : d));
    if (editType === 'addFeature') setEditMode('modify');
  };

  const modeInstance = useMemo(() => {
    if (editMode === 'draw') return new DrawPolygonMode();
    if (editMode === 'modify') return new ModifyMode();
    if (editMode === 'translate') return new TranslateMode();
    return new ViewMode();
  }, [editMode]);

  const columns = useMemo(() => [
    {
      accessorKey: 'disposal', header: 'Disposal', meta: { width: '1.6fr' },
      cell: (ctx) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: ctx.row.original.isActive ? T.ok : T.g4 }} />
          <Box sx={{ fontWeight: 800, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.getValue()}</Box>
        </Box>
      ),
    },
    {
      id: 'polygon', header: 'Polygon', enableSorting: false, meta: { width: '0.9fr' },
      accessorFn: (r) => (r.polygon || []).length,
      cell: (ctx) => (
        <Box component="button" type="button" title="Lihat di peta"
          onClick={(e) => { e.stopPropagation(); setSelectedId(ctx.row.original.id); focusPolygon(ctx.row.original.polygon); }}
          sx={{ border: 'none', background: 'none', p: 0, cursor: 'pointer', fontFamily: 'inherit', color: T.sel, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.4, '&:hover': { textDecoration: 'underline' } }}>
          <span style={{ fontSize: 12 }}>◬</span>{(ctx.row.original.polygon || []).length} titik
        </Box>
      ),
    },
    { accessorKey: 'district', header: 'District', meta: { width: '0.8fr' }, cell: (ctx) => <Box sx={{ color: T.g6, fontWeight: 700 }}>{ctx.getValue() || '—'}</Box> },
    { accessorKey: 'createdDate', header: 'Created Date', meta: { width: '1.2fr' }, cell: (ctx) => <Box sx={{ color: T.g6 }}>{formatDate(ctx.getValue())}</Box> },
    { accessorKey: 'createdBy', header: 'Created By', meta: { width: '0.9fr' }, cell: (ctx) => <Box sx={{ color: T.g6 }}>{ctx.getValue() || '—'}</Box> },
    { accessorKey: 'modifiedDate', header: 'Modified Date', meta: { width: '1.2fr' }, cell: (ctx) => <Box sx={{ color: T.g6 }}>{formatDate(ctx.getValue())}</Box> },
    { accessorKey: 'modifiedBy', header: 'Modified By', meta: { width: '0.9fr' }, cell: (ctx) => <Box sx={{ color: T.g6 }}>{ctx.getValue() || '—'}</Box> },
    {
      accessorKey: 'isActive', header: 'Is Active', meta: { width: '0.8fr', align: 'center' },
      cell: (ctx) => <StatusBadge active={!!ctx.getValue()} />,
    },
    {
      id: 'actions', header: 'Aksi', enableSorting: false, meta: { width: '150px', align: 'right' },
      cell: (ctx) => (
        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
          <RowBtn title="Ubah disposal & polygon" tone={T.sel} onClick={(e) => { e.stopPropagation(); openEdit(ctx.row.original); }}>Edit</RowBtn>
          <RowBtn title="Hapus disposal" tone={T.crit} onClick={(e) => { e.stopPropagation(); deleteDisposal(ctx.row.original); }}>Hapus</RowBtn>
        </Box>
      ),
    },
  ], [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gate (master MIR dumping) ───────────────────────────────────────────────
  const disposalNameOf = useMemo(() => {
    const map = {}; disposals.forEach((d) => { map[d.id] = d.disposal; }); return map;
  }, [disposals]);

  const gateTableData = useMemo(
    () => gates.map((g) => ({ ...g, disposalName: disposalNameOf[g.disposalId] || '—', __selected: g.id === selectedGateId })),
    [gates, selectedGateId, disposalNameOf]
  );

  const focusGate = (gate) => {
    const geo = deriveGateGeometry(gate.rovers, gate.thresholds);
    const polys = [gate.rovers.map((r) => r.position)];
    if (geo) polys.push(geo.dumping_area, geo.dumping_unsafe_area);
    const v = viewStateForPolygons(polys);
    if (v) setViewState((cur) => ({ ...cur, ...v, zoom: Math.max(v.zoom, 15.2), transitionDuration: 650 }));
  };

  const openAddGate = () => {
    const parent = disposals.find((d) => d.id === selectedId) || disposals[0];
    if (!parent) { window.alert('Buat disposal dulu sebelum menambah gate.'); return; }
    const rovers = seedRovers(parent.polygon, (gates.filter((g) => g.disposalId === parent.id).length) % 2);
    const g = { id: `GT-${Date.now().toString().slice(-6)}`, name: '', disposalId: parent.id, district: parent.district, isActive: true, rovers, thresholds: { ...DEFAULT_THRESHOLDS, warning: [...DEFAULT_THRESHOLDS.warning] }, createdBy: currentUser, createdDate: new Date().toISOString() };
    setGateDraft(g);
    setGateFeatures(roversToFeatures(rovers));
    setGateForm({ mode: 'add' });
    focusGate(g);
  };

  const openEditGate = (row) => {
    setSelectedGateId(row.id);
    setGateDraft({ ...row });
    setGateFeatures(roversToFeatures(row.rovers));
    setGateForm({ mode: 'edit', id: row.id });
    focusGate(row);
  };

  const closeGateForm = () => { setGateForm(null); setGateDraft(null); setGateFeatures({ type: 'FeatureCollection', features: [] }); };

  const saveGateForm = () => {
    if (!gateDraft) return;
    const now = new Date().toISOString();
    const rec = { ...gateDraft, district: disposals.find((d) => d.id === gateDraft.disposalId)?.district || gateDraft.district, modifiedBy: currentUser, modifiedDate: now };
    if (gateForm.mode === 'add') setGates((s) => [rec, ...s]);
    else setGates((s) => s.map((g) => (g.id === rec.id ? rec : g)));
    setSelectedGateId(rec.id);
    closeGateForm();
  };

  const deleteGate = (row) => {
    if (!window.confirm(`Hapus ${row.name} (${disposalNameOf[row.disposalId] || ''})?`)) return;
    setGates((s) => s.filter((g) => g.id !== row.id));
    if (selectedGateId === row.id) setSelectedGateId(null);
  };

  const onGateEdit = ({ updatedData }) => {
    setGateFeatures(updatedData);
    setGateDraft((d) => (d ? { ...d, rovers: featuresToRovers(updatedData, d.rovers) } : d));
  };

  const gateModeInstance = useMemo(() => new ModifyMode(), []);

  const gateColumns = useMemo(() => [
    {
      accessorKey: 'name', header: 'Gate', meta: { width: '1.1fr' },
      cell: (ctx) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: ctx.row.original.isActive ? T.ok : T.g4 }} />
          <Box sx={{ fontWeight: 800, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.getValue()}</Box>
        </Box>
      ),
    },
    { accessorKey: 'disposalName', header: 'Disposal', meta: { width: '1.3fr' }, cell: (ctx) => <Box sx={{ color: T.g6, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.getValue()}</Box> },
    { accessorKey: 'district', header: 'District', meta: { width: '0.7fr' }, cell: (ctx) => <Box sx={{ color: T.g6, fontWeight: 700 }}>{ctx.getValue() || '—'}</Box> },
    {
      id: 'rover', header: 'Rover', enableSorting: false, meta: { width: '0.9fr' },
      accessorFn: (r) => (r.rovers || []).length,
      cell: (ctx) => (
        <Box component="button" type="button" title="Lihat di peta"
          onClick={(e) => { e.stopPropagation(); setSelectedGateId(ctx.row.original.id); focusGate(ctx.row.original); }}
          sx={{ border: 'none', background: 'none', p: 0, cursor: 'pointer', fontFamily: 'inherit', color: T.sel, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.4, '&:hover': { textDecoration: 'underline' } }}>
          <span style={{ fontSize: 11 }}>●</span>{(ctx.row.original.rovers || []).length} rover
        </Box>
      ),
    },
    {
      id: 'ambang', header: 'Ambang', enableSorting: false, meta: { width: '1fr' },
      cell: (ctx) => { const t = ctx.row.original.thresholds; return <Box sx={{ color: T.g6, fontFamily: T.mono, fontSize: 11 }}>{`${t.safe}/${t.unsafe} · ${(t.warning || []).join('·')}`}</Box>; },
    },
    { accessorKey: 'modifiedDate', header: 'Last Modified', meta: { width: '1.1fr' }, cell: (ctx) => <Box sx={{ color: T.g6 }}>{formatDate(ctx.getValue())}</Box> },
    { accessorKey: 'modifiedBy', header: 'Modified By', meta: { width: '0.8fr' }, cell: (ctx) => <Box sx={{ color: T.g6 }}>{ctx.getValue() || '—'}</Box> },
    {
      accessorKey: 'isActive', header: 'Is Active', meta: { width: '0.8fr', align: 'center' },
      cell: (ctx) => <StatusBadge active={!!ctx.getValue()} />,
    },
    {
      id: 'actions', header: 'Aksi', enableSorting: false, meta: { width: '150px', align: 'right' },
      cell: (ctx) => (
        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
          <RowBtn title="Ubah gate & rover" tone={T.sel} onClick={(e) => { e.stopPropagation(); openEditGate(ctx.row.original); }}>Edit</RowBtn>
          <RowBtn title="Hapus gate" tone={T.crit} onClick={(e) => { e.stopPropagation(); deleteGate(ctx.row.original); }}>Hapus</RowBtn>
        </Box>
      ),
    },
  ], [selectedGateId, disposals]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Assignment (cabin → disposal/gate) ──────────────────────────────────────
  const gateNameOf = useMemo(() => {
    const map = {}; gates.forEach((g) => { map[g.id] = g.name; }); return map;
  }, [gates]);

  const assignTableData = useMemo(() => {
    const filtered = assignDisposalFilter ? assignments.filter((a) => a.disposalId === assignDisposalFilter) : assignments;
    return filtered.map((a) => ({ ...a, disposalName: disposalNameOf[a.disposalId] || '—', gateName: a.gateId ? (gateNameOf[a.gateId] || '—') : null, __selected: a.id === selectedAssignId }));
  }, [assignments, assignDisposalFilter, selectedAssignId, disposalNameOf, gateNameOf]);

  // Titik cabin di peta diturunkan dari assignment (dekat disposal/gate tujuan; offset biar tak menumpuk).
  const cabinPoints = useMemo(() => {
    const offsets = [[0.0008, 0.0009], [0.0016, 0.0022], [-0.0011, 0.0017], [0.0022, -0.0012], [-0.0017, -0.0008], [0.0012, -0.0019], [-0.0022, 0.0012], [0.0019, 0.0014], [-0.0009, -0.0019]];
    const perDisposal = {};
    return assignments.map((a) => {
      const d = disposals.find((x) => x.id === a.disposalId);
      if (!d) return null;
      let base = centroid(d.polygon);
      if (a.gateId) {
        const r0 = gates.find((x) => x.id === a.gateId)?.rovers?.find((r) => r.role === 'anchor')?.position;
        if (isLonLatPair(r0)) base = r0;
      }
      const idx = (perDisposal[a.disposalId] = (perDisposal[a.disposalId] || 0) + 1) - 1;
      const [dx, dy] = offsets[idx % offsets.length];
      return base ? { ...a, position: [base[0] + dx, base[1] + dy] } : null;
    }).filter(Boolean);
  }, [assignments, disposals, gates]);

  const highlightTarget = (disposalId, gateId) => {
    setSelectedId(disposalId);
    setSelectedGateId(gateId || null);
    const d = disposals.find((x) => x.id === disposalId);
    if (d) focusPolygon(d.polygon);
  };

  const openAddAssign = () => {
    const parent = disposals.find((d) => d.id === selectedId) || disposals[0];
    if (!parent) { window.alert('Buat disposal dulu sebelum assign cabin.'); return; }
    setAssignDraft({ id: `ASG-${Date.now().toString().slice(-6)}`, unit: '', disposalId: parent.id, gateId: null, plan: '', isActive: true, createdBy: currentUser, createdDate: new Date().toISOString() });
    setAssignForm({ mode: 'add' });
    highlightTarget(parent.id, null);
  };

  const openEditAssign = (row) => {
    setSelectedAssignId(row.id);
    setAssignDraft({ ...row });
    setAssignForm({ mode: 'edit', id: row.id });
    highlightTarget(row.disposalId, row.gateId);
  };

  const closeAssignForm = () => { setAssignForm(null); setAssignDraft(null); };

  const onAssignDisposalChange = (disposalId) => {
    setAssignDraft((d) => ({ ...d, disposalId, gateId: null })); // reset gate saat ganti disposal
    highlightTarget(disposalId, null);
  };

  const saveAssignForm = () => {
    if (!assignDraft) return;
    const now = new Date().toISOString();
    const rec = { ...assignDraft, modifiedBy: currentUser, modifiedDate: now };
    if (assignForm.mode === 'add') setAssignments((s) => [rec, ...s]);
    else setAssignments((s) => s.map((a) => (a.id === rec.id ? rec : a)));
    setSelectedAssignId(rec.id);
    closeAssignForm();
  };

  const deleteAssign = (row) => {
    if (!window.confirm(`Hapus assignment ${row.unit}?`)) return;
    setAssignments((s) => s.filter((a) => a.id !== row.id));
    if (selectedAssignId === row.id) setSelectedAssignId(null);
  };

  const assignColumns = useMemo(() => [
    {
      accessorKey: 'unit', header: 'Cabin / Unit', meta: { width: '1fr' },
      cell: (ctx) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: ctx.row.original.isActive ? T.ok : T.g4 }} />
          <Box sx={{ fontWeight: 800, color: T.ink, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.getValue()}</Box>
        </Box>
      ),
    },
    { accessorKey: 'disposalName', header: 'Disposal', meta: { width: '1.3fr' }, cell: (ctx) => <Box sx={{ color: T.ink, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.getValue()}</Box> },
    { accessorKey: 'gateName', header: 'Gate', meta: { width: '0.9fr' }, cell: (ctx) => (ctx.getValue() ? <Pill tone={T.sel}>{ctx.getValue()}</Pill> : <Box sx={{ color: T.g5, fontStyle: 'italic', fontSize: 11.5 }}>Semua gate</Box>) },
    { accessorKey: 'plan', header: 'Plan', meta: { width: '1.1fr' }, cell: (ctx) => <Box sx={{ color: T.g6, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.getValue() || '—'}</Box> },
    {
      accessorKey: 'isActive', header: 'Is Active', meta: { width: '0.8fr', align: 'center' },
      cell: (ctx) => <StatusBadge active={!!ctx.getValue()} />,
    },
    { accessorKey: 'modifiedDate', header: 'Last Modified', meta: { width: '1.1fr' }, cell: (ctx) => <Box sx={{ color: T.g6 }}>{formatDate(ctx.getValue())}</Box> },
    { accessorKey: 'modifiedBy', header: 'Modified By', meta: { width: '0.8fr' }, cell: (ctx) => <Box sx={{ color: T.g6 }}>{ctx.getValue() || '—'}</Box> },
    {
      id: 'actions', header: 'Aksi', enableSorting: false, meta: { width: '150px', align: 'right' },
      cell: (ctx) => (
        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
          <RowBtn title="Ubah assignment" tone={T.sel} onClick={(e) => { e.stopPropagation(); openEditAssign(ctx.row.original); }}>Edit</RowBtn>
          <RowBtn title="Hapus assignment" tone={T.crit} onClick={(e) => { e.stopPropagation(); deleteAssign(ctx.row.original); }}>Hapus</RowBtn>
        </Box>
      ),
    },
  ], [selectedAssignId, disposals, gates]); // eslint-disable-line react-hooks/exhaustive-deps

  const layers = useMemo(() => {
    const out = [];
    // Tab aktif dirender paling akhir (paling atas); tab lain jadi konteks redup.
    const seq = masterTab === 'gate' ? ['disposal', 'gate'] : ['gate', 'disposal'];
    seq.forEach((key) => {
      // dim hanya saat tab geometri LAIN yang aktif; di tab assign keduanya tampil penuh (sbg target highlight).
      if (key === 'disposal' && visible.disposal) out.push(...buildDisposalLayers({ interactive: masterTab === 'disposal', dim: masterTab === 'gate' }));
      if (key === 'gate' && visible.gate) out.push(...buildGateLayers({ interactive: masterTab === 'gate', dim: masterTab === 'disposal' }));
    });
    if (visible.cabin) out.push(...buildCabinLayers());
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterTab, visible, disposals, gates, cabinPoints, selectedId, selectedGateId, selectedAssignId, form, editFeatures, modeInstance, gateForm, gateDraft, gateFeatures, gateModeInstance]);

  function buildCabinLayers() {
    const pts = new ScatterplotLayer({
      id: 'cabin-pts', data: cabinPoints,
      getPosition: (d) => d.position,
      getFillColor: (d) => (d.id === selectedAssignId ? [63, 81, 181, 255] : d.isActive ? [63, 81, 181, 230] : [120, 130, 143, 170]),
      getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 2, radiusUnits: 'pixels',
      getRadius: (d) => (d.id === selectedAssignId ? 7.5 : 6), stroked: true, pickable: true,
      onClick: (info) => { if (info.object) { setSelectedAssignId(info.object.id); highlightTarget(info.object.disposalId, info.object.gateId); } return true; },
      updateTriggers: { getFillColor: [selectedAssignId], getRadius: [selectedAssignId] },
    });
    const labels = new TextLayer({
      id: 'cabin-lbl', data: cabinPoints, getPosition: (d) => d.position, getText: (d) => d.unit,
      getColor: [36, 50, 64, 255], getSize: 10, sizeUnits: 'pixels', getTextAnchor: 'middle', getPixelOffset: [0, -13],
      fontWeight: 600, background: true, getBackgroundColor: [255, 255, 255, 185], backgroundPadding: [4, 2],
    });
    return [pts, labels];
  }

  function buildDisposalLayers({ interactive, dim }) {
    const editingId = interactive && form?.mode === 'edit' ? form.id : null;
    const polygons = new PolygonLayer({
      id: 'dsp-polygons',
      data: disposals.filter((d) => d.id !== editingId),
      getPolygon: (d) => d.polygon,
      getFillColor: (d) => {
        if (dim) return [...hexToRgb(d.isActive ? T.ok : T.g4), 14];
        const tone = d.id === selectedId ? hexToRgb(T.sel) : hexToRgb(d.isActive ? T.ok : T.g4);
        return [...tone, d.id === selectedId ? 80 : 30];
      },
      getLineColor: (d) => {
        if (dim) return [...hexToRgb(d.isActive ? T.ok : T.g4), 110];
        const tone = d.id === selectedId ? hexToRgb(T.sel) : hexToRgb(d.isActive ? T.ok : T.g4);
        return [...tone, d.id === selectedId ? 255 : 170];
      },
      getLineWidth: (d) => (dim ? 1.5 : (d.id === selectedId ? 4 : 2)),
      lineWidthUnits: 'pixels', stroked: true, filled: true,
      pickable: interactive && !form,
      onClick: interactive ? (info) => { if (info.object?.id && !form) { setSelectedId(info.object.id); focusPolygon(info.object.polygon); } return true; } : undefined,
      updateTriggers: { getFillColor: [selectedId, editingId, dim], getLineColor: [selectedId, editingId, dim], getLineWidth: [selectedId, dim] },
    });

    const labels = new TextLayer({
      id: 'dsp-labels',
      data: disposals.filter((d) => d.id !== editingId && centroid(d.polygon)),
      getPosition: (d) => centroid(d.polygon),
      getText: (d) => shortDisposalName(d.disposal),
      getColor: dim ? [110, 122, 137, 210] : [36, 50, 64, 255], getSize: dim ? 10.5 : 11.5, sizeUnits: 'pixels', getTextAnchor: 'middle',
      fontWeight: 600, background: true, getBackgroundColor: [255, 255, 255, dim ? 120 : 185], backgroundPadding: [4, 2],
      updateTriggers: { getColor: [dim], getSize: [dim] },
    });

    const result = [polygons, labels];

    if (interactive && form) {
      result.push(new EditableGeoJsonLayer({
        id: 'dsp-editor',
        data: editFeatures,
        mode: modeInstance,
        selectedFeatureIndexes: editFeatures.features.length ? [0] : [],
        onEdit,
        pickable: true,
        getFillColor: [31, 122, 150, 70],
        getLineColor: [31, 122, 150, 255],
        getEditHandlePointColor: [31, 122, 150, 255],
        getEditHandlePointOutlineColor: [255, 255, 255, 255],
        getTentativeFillColor: [31, 122, 150, 60],
        getTentativeLineColor: [31, 122, 150, 220],
        lineWidthMinPixels: 2,
      }));
    }
    return result;
  }

  function buildGateLayers({ interactive, dim }) {
    const editingGateId = interactive && gateForm ? gateForm.id : null;
    const items = gates
      .filter((g) => g.id !== editingGateId)
      .map((g) => ({ g, geo: deriveGateGeometry(g.rovers, g.thresholds) }))
      .filter((x) => x.geo);
    const isSel = (id) => !dim && id === selectedGateId;

    const unsafe = new PolygonLayer({
      id: 'gt-unsafe', data: items, getPolygon: (x) => x.geo.dumping_unsafe_area,
      getFillColor: (x) => [217, 72, 63, dim ? 20 : (isSel(x.g.id) ? 70 : 38)], getLineColor: [217, 72, 63, dim ? 120 : 200], getLineWidth: 1.5, lineWidthUnits: 'pixels', stroked: true, filled: true,
      updateTriggers: { getFillColor: [selectedGateId, dim], getLineColor: [dim] },
    });
    const area = new PolygonLayer({
      id: 'gt-area', data: items, getPolygon: (x) => x.geo.dumping_area,
      getFillColor: (x) => [46, 158, 91, dim ? 28 : (isSel(x.g.id) ? 90 : 50)], getLineColor: [46, 158, 91, dim ? 140 : 220], getLineWidth: (x) => (isSel(x.g.id) ? 3 : 1.5), lineWidthUnits: 'pixels', stroked: true, filled: true,
      pickable: interactive,
      onClick: interactive ? (info) => { if (info.object?.g) { setSelectedGateId(info.object.g.id); focusGate(info.object.g); } return true; } : undefined,
      updateTriggers: { getFillColor: [selectedGateId, dim], getLineColor: [dim], getLineWidth: [selectedGateId] },
    });
    const lines = new PathLayer({
      id: 'gt-lines', data: items, getPath: (x) => x.geo.dumping_line, getColor: [217, 72, 63, dim ? 150 : 245], getWidth: (x) => (isSel(x.g.id) ? 4 : 2.5), widthUnits: 'pixels',
      updateTriggers: { getColor: [dim], getWidth: [selectedGateId] },
    });
    const warnings = new PathLayer({
      id: 'gt-warnings', data: items.flatMap((x) => x.geo.warnings.map((w) => ({ path: w }))), getPath: (d) => d.path, getColor: [224, 138, 60, dim ? 110 : 200], getWidth: 1.4, widthUnits: 'pixels',
      updateTriggers: { getColor: [dim] },
    });
    const rovers = new ScatterplotLayer({
      id: 'gt-rovers', data: items.flatMap((x) => x.g.rovers.map((r) => ({ ...r, gateId: x.g.id }))),
      getPosition: (d) => d.position, getFillColor: (d) => [...roverColor(d.role), dim ? 150 : 245], getLineColor: [255, 255, 255, dim ? 160 : 255], lineWidthMinPixels: 2, radiusUnits: 'pixels', getRadius: (d) => (dim ? 4 : (d.role === 'anchor' ? 6.5 : 5.5)), stroked: true,
      updateTriggers: { getFillColor: [dim], getRadius: [dim] },
    });
    const labels = new TextLayer({
      id: 'gt-labels', data: dim ? [] : items, getPosition: (x) => x.g.rovers.find((r) => r.role === 'anchor')?.position || x.geo.dumping_line[0],
      getText: (x) => x.g.name, getColor: [36, 50, 64, 255], getSize: 11, sizeUnits: 'pixels', getTextAnchor: 'middle', getPixelOffset: [0, -14],
      fontWeight: 600, background: true, getBackgroundColor: [255, 255, 255, 185], backgroundPadding: [4, 2],
    });

    const result = [unsafe, area, lines, warnings, rovers, labels];

    if (interactive && gateForm && gateDraft) {
      const geo = deriveGateGeometry(gateDraft.rovers, gateDraft.thresholds);
      if (geo) {
        result.push(new PolygonLayer({ id: 'gt-prev-unsafe', data: [geo], getPolygon: (d) => d.dumping_unsafe_area, getFillColor: [217, 72, 63, 60], getLineColor: [217, 72, 63, 230], getLineWidth: 2, lineWidthUnits: 'pixels', stroked: true, filled: true }));
        result.push(new PolygonLayer({ id: 'gt-prev-area', data: [geo], getPolygon: (d) => d.dumping_area, getFillColor: [46, 158, 91, 80], getLineColor: [46, 158, 91, 235], getLineWidth: 2, lineWidthUnits: 'pixels', stroked: true, filled: true }));
        result.push(new PathLayer({ id: 'gt-prev-line', data: [geo], getPath: (d) => d.dumping_line, getColor: [217, 72, 63, 245], getWidth: 3.5, widthUnits: 'pixels' }));
        result.push(new PathLayer({ id: 'gt-prev-warn', data: geo.warnings.map((w) => ({ path: w })), getPath: (d) => d.path, getColor: [224, 138, 60, 220], getWidth: 1.6, widthUnits: 'pixels' }));
      }
      result.push(new EditableGeoJsonLayer({
        id: 'gt-editor', data: gateFeatures, mode: gateModeInstance,
        selectedFeatureIndexes: gateFeatures.features.map((_, i) => i),
        onEdit: onGateEdit, pickable: true,
        getEditHandlePointColor: (h) => [...roverColor(h?.properties?.role === 'anchor' ? 'anchor' : 'line'), 255],
        getEditHandlePointOutlineColor: [255, 255, 255, 255],
        editHandlePointRadiusScale: 2.2,
        getFillColor: [0, 0, 0, 0], getLineColor: [0, 0, 0, 0],
      }));
      result.push(new TextLayer({
        id: 'gt-editor-labels', data: gateDraft.rovers,
        getPosition: (r) => r.position, getText: (r) => r.id,
        getColor: [36, 50, 64, 255], getSize: 11, sizeUnits: 'pixels', getTextAnchor: 'middle', getPixelOffset: [0, -16],
        fontWeight: 800, background: true, getBackgroundColor: [255, 255, 255, 230], backgroundPadding: [4, 2],
      }));
    }
    return result;
  }

  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, background: T.w, fontFamily: T.ff }}>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* MAP */}
        <Box sx={{ flex: '0 0 42%', minHeight: 220, position: 'relative', background: T.g1 }}>
          <MapContainer
            layerState={LAYER_STATE}
            district={district}
            basemap="satellite"
            liveUnitData={[]}
            liveTrailsData={[]}
            viewState={viewState}
            onViewStateChange={(e) => setViewState(e.viewState)}
            onSetViewState={setViewState}
            replayLayers={layers}
          />
          <LayerToggle visible={visible} onToggle={toggleLayer} />
          <MapLegend tab={masterTab} cabinOn={visible.cabin} />
          {masterTab === 'disposal' && <EditorHint editMode={editMode} count={(draft?.polygon || []).length} />}
          {masterTab === 'gate' && gateForm && (
            <Box sx={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 14, background: T.ink, color: '#fff', px: 1.4, py: 0.7, borderRadius: '6px', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}>
              Tarik titik rover (R0/R1/R2) untuk mengatur gate · preview ter-update otomatis
            </Box>
          )}
          {masterTab === 'disposal' && form && draft && (
            <DisposalForm
              draft={draft} setDraft={setDraft} mode={form.mode}
              editMode={editMode} setEditMode={setEditMode}
              onSave={saveForm} onCancel={closeForm} districts={districts}
            />
          )}
          {masterTab === 'gate' && gateForm && gateDraft && (
            <GateForm
              draft={gateDraft} setDraft={setGateDraft} mode={gateForm.mode}
              onSave={saveGateForm} onCancel={closeGateForm} disposals={disposals}
            />
          )}
          {masterTab === 'assign' && assignForm && assignDraft && (
            <AssignForm
              draft={assignDraft} setDraft={setAssignDraft} mode={assignForm.mode}
              onSave={saveAssignForm} onCancel={closeAssignForm} onDisposalChange={onAssignDisposalChange}
              disposals={disposals} gates={gates} units={UNIT_SEED}
            />
          )}
        </Box>

        {/* MANAGEMENT PANEL */}
        <Box sx={{ flex: 1, minHeight: 0, borderTop: `1px solid ${T.line}`, background: T.w, display: 'flex', flexDirection: 'column' }}>
          <MasterTabs value={masterTab} onChange={setMasterTab} />

          {masterTab === 'disposal' && (
            <>
              {/* toolbar */}
              <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 0.9, borderBottom: `1px solid ${T.line}`, background: T.g0, flexWrap: 'wrap' }}>
                <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="Cari disposal atau user…" />
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <ToolbarBtn onClick={() => fileInputRef.current?.click()}>⬆ Import KML</ToolbarBtn>
                  <ToolbarBtn onClick={exportKml}>⬇ Export KML</ToolbarBtn>
                  <ToolbarBtn primary onClick={openAdd}>+ Disposal</ToolbarBtn>
                  <Box component="input" type="file" accept=".kml,application/vnd.google-earth.kml+xml,text/xml" ref={fileInputRef} onChange={onImportFile} sx={{ display: 'none' }} />
                </Box>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0 }}>
                <DataGrid
                  data={tableData}
                  columns={columns}
                  globalFilter={globalFilter}
                  sorting={sorting} setSorting={setSorting}
                  pagination={pagination} setPagination={setPagination}
                  onRowClick={(row) => { setSelectedId(row.id); focusPolygon(row.polygon); }}
                  emptyText="Tidak ada disposal yang cocok."
                  unitLabel="disposal"
                />
              </Box>
            </>
          )}

          {masterTab === 'gate' && (
            <>
              {/* toolbar */}
              <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 0.9, borderBottom: `1px solid ${T.line}`, background: T.g0, flexWrap: 'wrap' }}>
                <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="Cari gate atau disposal…" />
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <ToolbarBtn primary onClick={openAddGate}>+ Gate</ToolbarBtn>
                </Box>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0 }}>
                <DataGrid
                  data={gateTableData}
                  columns={gateColumns}
                  globalFilter={globalFilter}
                  sorting={gateSorting} setSorting={setGateSorting}
                  pagination={gatePagination} setPagination={setGatePagination}
                  onRowClick={(row) => { setSelectedGateId(row.id); focusGate(row); }}
                  emptyText="Belum ada gate. Klik + Gate untuk membuat."
                  unitLabel="gate"
                  minWidth={960}
                />
              </Box>
            </>
          )}

          {masterTab === 'assign' && (
            <>
              {/* toolbar */}
              <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 0.9, borderBottom: `1px solid ${T.line}`, background: T.g0, flexWrap: 'wrap' }}>
                <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="Cari unit, disposal, gate, atau plan…" />
                <Box component="select" value={assignDisposalFilter} onChange={(e) => setAssignDisposalFilter(e.target.value)}
                  sx={{ ...inputSx, width: 'auto', py: 0.6, cursor: 'pointer' }}>
                  <option value="">Semua disposal</option>
                  {disposals.map((d) => <option key={d.id} value={d.id}>{d.disposal}</option>)}
                </Box>
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <ToolbarBtn primary onClick={openAddAssign}>+ Assignment</ToolbarBtn>
                </Box>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0 }}>
                <DataGrid
                  data={assignTableData}
                  columns={assignColumns}
                  globalFilter={globalFilter}
                  sorting={assignSorting} setSorting={setAssignSorting}
                  pagination={assignPagination} setPagination={setAssignPagination}
                  onRowClick={(row) => { setSelectedAssignId(row.id); highlightTarget(row.disposalId, row.gateId); }}
                  emptyText="Belum ada assignment. Klik + Assignment untuk membuat."
                  unitLabel="assignment"
                  minWidth={920}
                />
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
