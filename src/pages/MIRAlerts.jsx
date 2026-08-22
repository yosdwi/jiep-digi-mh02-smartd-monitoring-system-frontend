import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { T } from '../components/mir/operasi/mirTokens';
import { DataState } from '../components/mir/devices/MirDeviceBits';
import MapContainer from '../components/peta/MapContainer';
import AlertMiniMap, { buildAlertReplayLayers } from '../components/mir/operasi/AlertMiniMap';
import useMirAlertStore from '../stores/mirAlertStore';
import useUserStore from '../stores/userStore';
import { fetchAlerts, fetchEvidence, fetchGeofence } from '../services/mirAlertApi';

// ── Layar PERINGATAN MIR (route /mir/peringatan) ──────────────────────────────
// Triage queue NOC: tabel alert dikelompokkan per unit. Validasi 1 langkah: True (VALID) / False (FALSE).
// Status chips: NEW=Belum divalidasi, VALID=True, FALSE=False.
// Tabel: expandable per grup unit, checkbox multi-select, bulk action bar.
// Detail drawer kanan: metadata + mini-map (pre+on evidence + geofence).

// ── helpers ───────────────────────────────────────────────────────────────────

const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
const truthy = (v) => v === '1' || v === 1 || v === true;

const tsToMs = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v);
    return n < 1e12 ? n * 1000 : n;
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

const fmtTime = (ts) => {
  const ms = tsToMs(ts);
  if (ms == null) return '—';
  return new Date(ms).toTimeString().slice(0, 8);
};
const fmtDateTimeShort = (ts) => {
  const ms = tsToMs(ts);
  if (ms == null) return '—';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${d.toTimeString().slice(0, 8)}`;
};

const fmtDur = (s) => (s == null ? '—' : `${Number(s)} dtk`);
const fmtDist = (v) => (v == null ? '—' : `${Number(v).toFixed(1)} m`);
const fmtSpd = (v) => (v == null ? '—' : `${Number(v).toFixed(0)} km/h`);

function mapRawAlert(a) {
  return {
    id: a.event_id,
    unit: a.unitno || a.deviceid || a.event_id,
    deviceId: a.deviceid || '',
    type: a.type || 'WARNING',
    status: a.status || 'NEW',
    hasEvidence: truthy(a.has_evidence),
    tsStart: tsToMs(a.ts_start),
    tsEnd: tsToMs(a.ts_end),
    areaCode: a.area_code || '',
    minDistance: numOrNull(a.min_distance),
    durationS: numOrNull(a.duration_s),
    maxSpeed: numOrNull(a.max_speed),
    lat: numOrNull(a.lat),
    lon: numOrNull(a.lon),
    peakLat: numOrNull(a.peak_lat),
    peakLon: numOrNull(a.peak_lon),
    level: numOrNull(a.level),
    validatedBy: a.validated_by || null,
    validatedAt: a.validated_at || null,
    note: a.note || '',
  };
}

// ── design tokens — TEMA LIGHT SMARTD (sama dgn tab Perangkat/Firmware, mirTokens.T) ──
const BG = T.g0;            // #f4f6f8 — main bg
const BG2 = T.w;            // #ffffff — panel/drawer
const BG3 = T.g1;           // #eaeef2 — group header
const BORDER = T.line;      // #dde3ea
const TEXT = T.ink;         // #243240
const MUTED = T.g5;         // #76828f
const SEL_BG = T.selBg;     // #e2f1f5
const HOVER = T.g0;         // baris hover
const GHDR_HOVER = T.g2;    // group header hover

// ── Status helpers ─────────────────────────────────────────────────────────────
function statusLabel(status) {
  return { NEW: 'Belum divalidasi', VALID: 'True', FALSE: 'False' }[status] || status;
}
function statusChipStyle(status) {
  if (status === 'VALID') return { background: '#e6f4ec', color: '#1e6e3d', border: `1px solid ${T.ok}` };
  if (status === 'FALSE') return { background: '#fbeaea', color: '#a04040', border: `1px solid ${T.crit}` };
  // NEW = butuh perhatian (amber)
  return { background: '#fdf3e0', color: '#9a6a14', border: `1px solid ${T.warn}` };
}
function typeBadgeStyle(type) {
  if (type === 'CROSSING') return { background: '#fbeaea', color: '#b3261e', border: `1px solid ${T.crit}` };
  return { background: '#fdf3e0', color: '#9a6a14', border: `1px solid ${T.warn}` };
}
// tombol validasi (True/False) — outline tinted, konsisten light theme
const BTN_VALID = { border: `1px solid ${T.ok}`, background: T.w, color: '#1e6e3d', hover: '#e6f4ec' };
const BTN_FALSE = { border: `1px solid ${T.crit}`, background: T.w, color: '#a04040', hover: '#fbeaea' };

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusChip({ status }) {
  const s = statusChipStyle(status);
  return (
    <Box component="span" sx={{ ...s, borderRadius: '10px', px: 0.9, py: '2px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.4px', display: 'inline-block' }}>
      {statusLabel(status)}
    </Box>
  );
}

function TypeBadge({ type }) {
  const s = typeBadgeStyle(type);
  return (
    <Box component="span" sx={{ ...s, borderRadius: '3px', px: 0.7, py: '2px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.5px', display: 'inline-block' }}>
      {type}
    </Box>
  );
}

// Inline action buttons (True/False)
function ValidateButtons({ alert, onValidate, disabled }) {
  const isNew = alert.status === 'NEW';
  if (!isNew) return null;
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Box
        component="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onValidate(alert.id, 'VALID'); }}
        sx={{
          border: BTN_VALID.border, background: BTN_VALID.background, color: BTN_VALID.color,
          borderRadius: '4px', px: 1, py: '3px', fontSize: 11, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          '&:hover:not(:disabled)': { background: BTN_VALID.hover },
        }}
        title="Validasi: True (VALID)"
      >
        True
      </Box>
      <Box
        component="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onValidate(alert.id, 'FALSE'); }}
        sx={{
          border: BTN_FALSE.border, background: BTN_FALSE.background, color: BTN_FALSE.color,
          borderRadius: '4px', px: 1, py: '3px', fontSize: 11, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          '&:hover:not(:disabled)': { background: BTN_FALSE.hover },
        }}
        title="Validasi: False (FALSE)"
      >
        False
      </Box>
    </Box>
  );
}

// ── Group header row ───────────────────────────────────────────────────────────
function GroupHeader({ unit, rows, expanded, onToggle, onBulkValidate, selectedIds, onSelectGroup, bulkBusy }) {
  const newAlerts = rows.filter((a) => a.status === 'NEW');
  const earliest = rows.reduce((mn, a) => (a.tsStart != null && (mn == null || a.tsStart < mn) ? a.tsStart : mn), null);
  const latest = rows.reduce((mx, a) => (a.tsEnd != null && (mx == null || a.tsEnd > mx) ? a.tsEnd : mx), null);
  const dominantType = rows.some((a) => a.type === 'CROSSING') ? 'CROSSING' : 'WARNING';

  const groupSelected = rows.every((a) => selectedIds.has(a.id));
  const groupIndeterminate = !groupSelected && rows.some((a) => selectedIds.has(a.id));

  const ckRef = useRef(null);
  useEffect(() => {
    if (ckRef.current) ckRef.current.indeterminate = groupIndeterminate;
  }, [groupIndeterminate]);

  return (
    <Box
      component="tr"
      sx={{
        background: BG3,
        cursor: 'pointer',
        '& td': { py: 1, px: 1.25, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT },
        '&:hover': { background: GHDR_HOVER },
      }}
    >
      <td onClick={(e) => e.stopPropagation()}>
        <input
          ref={ckRef}
          type="checkbox"
          checked={groupSelected}
          onChange={() => onSelectGroup(rows.map((a) => a.id), !groupSelected)}
          style={{ accentColor: T.sel, cursor: 'pointer' }}
        />
      </td>
      <td colSpan={2} onClick={onToggle} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
          <Box sx={{ color: MUTED, fontSize: 13, width: 14, textAlign: 'center', flexShrink: 0 }}>
            {expanded ? '▾' : '▸'}
          </Box>
          <Box sx={{ color: T.sel, fontFamily: T.mono, fontWeight: 700 }}>{unit}</Box>
          <Box sx={{ color: MUTED, fontSize: 11, fontFamily: T.mono }}>· {rows.length} alert</Box>
          {earliest != null && (
            <Box sx={{ color: MUTED, fontSize: 10, fontFamily: T.mono }}>
              · {fmtTime(earliest)}{latest != null && latest !== earliest ? `–${fmtTime(latest)}` : ''}
            </Box>
          )}
          <TypeBadge type={dominantType} />
        </Box>
      </td>
      <td colSpan={5} onClick={onToggle} />
      <td onClick={(e) => e.stopPropagation()}>
        {newAlerts.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Box
              component="button"
              disabled={bulkBusy}
              onClick={() => onBulkValidate(unit, 'VALID')}
              sx={{
                border: BTN_VALID.border, background: BTN_VALID.background, color: BTN_VALID.color,
                borderRadius: '4px', px: 0.85, py: '2px', fontSize: 10, fontWeight: 600, cursor: bulkBusy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                '&:hover:not(:disabled)': { background: BTN_VALID.hover },
              }}
            >
              True semua
            </Box>
            <Box
              component="button"
              disabled={bulkBusy}
              onClick={() => onBulkValidate(unit, 'FALSE')}
              sx={{
                border: BTN_FALSE.border, background: BTN_FALSE.background, color: BTN_FALSE.color,
                borderRadius: '4px', px: 0.85, py: '2px', fontSize: 10, fontWeight: 600, cursor: bulkBusy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                '&:hover:not(:disabled)': { background: BTN_FALSE.hover },
              }}
            >
              False semua
            </Box>
          </Box>
        )}
      </td>
    </Box>
  );
}

// ── Alert row ──────────────────────────────────────────────────────────────────
function AlertRow({ alert, active, checked, onSelect, onCheck, onValidate, busy }) {
  return (
    <Box
      component="tr"
      onClick={() => onSelect(alert)}
      sx={{
        cursor: 'pointer',
        background: active ? SEL_BG : 'transparent',
        '& td': { py: '7px', px: 1.25, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, whiteSpace: 'nowrap' },
        '&:hover': { background: active ? SEL_BG : HOVER },
      }}
    >
      <td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onCheck(alert.id)}
          style={{ accentColor: T.sel, cursor: 'pointer' }}
        />
      </td>
      <td style={{ fontFamily: T.mono, color: MUTED }}>{fmtTime(alert.tsStart)}</td>
      <td><TypeBadge type={alert.type} /></td>
      <td style={{ fontFamily: T.mono, color: alert.areaCode ? TEXT : MUTED }}>{alert.areaCode || '—'}</td>
      <td style={{ fontFamily: T.mono }}>{fmtDist(alert.minDistance)}</td>
      <td style={{ fontFamily: T.mono }}>{fmtDur(alert.durationS)}</td>
      <td style={{ fontFamily: T.mono }}>{fmtSpd(alert.maxSpeed)}</td>
      <td><StatusChip status={alert.status} /></td>
      <td onClick={(e) => e.stopPropagation()}>
        <ValidateButtons alert={alert} onValidate={onValidate} disabled={busy} />
      </td>
    </Box>
  );
}

// ── Detail drawer (right side) ─────────────────────────────────────────────────
function DetailDrawer({ alert, geofenceAreas, onClose, onValidate, busy }) {
  const [evidence, setEvidence] = useState(null);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState(null);

  useEffect(() => {
    if (!alert) { setEvidence(null); return; }
    if (!alert.hasEvidence) { setEvidence(null); return; }
    setEvLoading(true);
    setEvError(null);
    fetchEvidence(alert.id)
      .then((d) => setEvidence(d))
      .catch((e) => setEvError(e.message))
      .finally(() => setEvLoading(false));
  }, [alert?.id, alert?.hasEvidence]);

  if (!alert) return null;

  const isCrossing = alert.type === 'CROSSING';
  const isNew = alert.status === 'NEW';

  return (
    <Box
      sx={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 100,
        width: 380, background: BG2, borderLeft: `1px solid ${BORDER}`,
        boxShadow: '-4px 0 24px rgba(0,0,0,.35)',
        display: 'flex', flexDirection: 'column', fontFamily: T.ff,
      }}
    >
      {/* header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.25, borderBottom: `1px solid ${BORDER}` }}>
        <Box
          component="button"
          onClick={onClose}
          sx={{ border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, borderRadius: '4px', px: 1.1, py: 0.5, cursor: 'pointer', fontSize: 14 }}
        >
          ✕
        </Box>
        <Box sx={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{alert.unit}</Box>
        <TypeBadge type={alert.type} />
        <Box sx={{ ml: 'auto' }}><StatusChip status={alert.status} /></Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.75 }}>
        {/* mini-map */}
        <Box sx={{ mb: 1.5 }}>
          {evLoading && <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '4px', background: BG3 }}>Memuat lintasan…</Box>}
          {evError && <Box sx={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T.crit, border: `1px solid ${BORDER}`, borderRadius: '4px' }}>Gagal muat evidence: {evError}</Box>}
          {!evLoading && !evError && (
            <AlertMiniMap
              evidence={evidence}
              geofenceAreas={geofenceAreas}
              areaCode={alert.areaCode}
              peakLat={alert.peakLat}
              peakLon={alert.peakLon}
            />
          )}
        </Box>

        {/* metadata */}
        <Box sx={{ fontSize: 12 }}>
          {[
            ['Unit / Device', `${alert.unit} · ${alert.deviceId}`],
            ['Tipe', alert.type],
            ['Area', alert.areaCode || '—'],
            ['Waktu mulai', fmtTime(alert.tsStart)],
            ['Waktu selesai', fmtTime(alert.tsEnd)],
            ['Jarak puncak', fmtDist(alert.minDistance)],
            ['Durasi', fmtDur(alert.durationS)],
            ['Kec. maks', fmtSpd(alert.maxSpeed)],
            ['Koordinat', alert.lat != null ? `${alert.lat?.toFixed(5)}, ${alert.lon?.toFixed(5)}` : '—'],
            ['Level', alert.level != null ? String(alert.level) : '—'],
            ['Divalidasi oleh', alert.validatedBy || '—'],
            ['Waktu validasi', alert.validatedAt ? fmtTime(alert.validatedAt) : '—'],
            ['Catatan', alert.note || '—'],
          ].map(([k, v]) => (
            <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: `1px solid ${BORDER}`, gap: 1 }}>
              <Box sx={{ color: MUTED, flexShrink: 0 }}>{k}</Box>
              <Box sx={{ fontFamily: T.mono, color: TEXT, textAlign: 'right', wordBreak: 'break-all' }}>{String(v ?? '—')}</Box>
            </Box>
          ))}
        </Box>

        {/* validasi actions */}
        {isNew && (
          <Box sx={{ mt: 1.75 }}>
            <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: MUTED, mb: 0.9 }}>Validasi (NOC)</Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box
                component="button"
                disabled={busy}
                onClick={() => onValidate(alert.id, 'VALID')}
                sx={{
                  flex: 1, border: BTN_VALID.border, background: '#e6f4ec', color: BTN_VALID.color,
                  borderRadius: '5px', py: 1.1, fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                  '&:hover:not(:disabled)': { background: '#d6ecdf' },
                }}
              >
                True
              </Box>
              <Box
                component="button"
                disabled={busy}
                onClick={() => onValidate(alert.id, 'FALSE')}
                sx={{
                  flex: 1, border: BTN_FALSE.border, background: '#fbeaea', color: BTN_FALSE.color,
                  borderRadius: '5px', py: 1.1, fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                  '&:hover:not(:disabled)': { background: '#f6dcdc' },
                }}
              >
                False
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Status / type filter chips ─────────────────────────────────────────────────
const STATUS_CHIPS = [
  { key: 'NEW', label: 'Belum divalidasi' },
  { key: 'VALID', label: 'True' },
  { key: 'FALSE', label: 'False' },
  { key: '', label: 'Semua' },
];
const TYPE_CHIPS = [
  { key: '', label: 'Semua' },
  { key: 'CROSSING', label: 'Crossing' },
  { key: 'WARNING', label: 'Warning' },
];

// Compact version of FilterChips for dark bg
function DarkFilterChips({ chips, value, onChange }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
      {chips.map((c) => {
        const on = c.key === value;
        return (
          <Box
            key={c.key}
            onClick={() => onChange(c.key)}
            sx={{
              border: `1px solid ${on ? T.sel : BORDER}`, borderRadius: '14px', px: 1.2, py: 0.45, fontSize: 11,
              cursor: 'pointer', userSelect: 'none',
              background: on ? SEL_BG : T.w,
              color: on ? T.sel : MUTED,
              whiteSpace: 'nowrap',
              '&:hover': { borderColor: T.g4, color: TEXT },
            }}
          >
            {c.label}
          </Box>
        );
      })}
    </Box>
  );
}

const evidenceRows = (evidence) => [
  ...(evidence?.pre || []).map((s) => ({ phase: 'pre', s })),
  ...(evidence?.on || []).map((s) => ({ phase: 'crossing', s })),
].filter((x) => Array.isArray(x.s) && x.s[1] != null && x.s[2] != null)
  .map((x, i) => ({
    i,
    phase: x.phase,
    ts: Number(x.s[0]),
    lat: Number(x.s[1]),
    lon: Number(x.s[2]),
    speed: Number(x.s[3] ?? 0),
    numsat: Number(x.s[4] ?? 0),
    rtk: Number(x.s[5] ?? 0),
    distance: Number(x.s[6] ?? 0),
    p: [Number(x.s[2]), Number(x.s[1])],
  }))
  .filter((x) => Number.isFinite(x.lon) && Number.isFinite(x.lat));

function AlertReplayStage({ alert, geofenceAreas }) {
  const district = useUserStore((s) => s.profile?.distrik);
  const [viewState, setViewState] = useState({ longitude: 117.28, latitude: 1.91, zoom: 13, pitch: 0, bearing: 0 });
  const [evidence, setEvidence] = useState(null);
  const [playIndex, setPlayIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!alert || alert.type !== 'CROSSING' || !alert.hasEvidence) {
      setEvidence(null);
      setErr(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    fetchEvidence(alert.id)
      .then((d) => setEvidence(d))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [alert?.id, alert?.type, alert?.hasEvidence]);

  const rows = useMemo(() => evidenceRows(evidence), [evidence]);
  const liveArea = useMemo(() => {
    if (!alert?.areaCode) return geofenceAreas?.[0] || null;
    return (geofenceAreas || []).find((a) => a.dumping_area_code === alert.areaCode || a.pid === alert.areaCode) || null;
  }, [geofenceAreas, alert?.areaCode]);
  const devicePolygonVersion = evidence?.polygon_version || evidence?.geofence?.version || null;
  const devicePolygonGeneratedAt = evidence?.polygon_generated_at_ms || evidence?.geofence?.generated_at_ms || null;
  const livePolygonVersion = liveArea?.generated_at_ms || null;

  useEffect(() => {
    setPlayIndex(0);
  }, [alert?.id]);

  useEffect(() => {
    if (!rows.length || alert?.type !== 'CROSSING') return undefined;
    const id = setInterval(() => {
      setPlayIndex((i) => (i >= rows.length - 1 ? 0 : i + 1));
    }, 1000);
    return () => clearInterval(id);
  }, [rows.length, alert?.type]);

  const replay = useMemo(
    () => buildAlertReplayLayers({
      evidence,
      geofenceAreas,
      areaCode: alert?.areaCode,
      peakLat: alert?.peakLat,
      peakLon: alert?.peakLon,
      height: 520,
    }),
    [evidence, geofenceAreas, alert?.areaCode, alert?.peakLat, alert?.peakLon]
  );

  useEffect(() => {
    if (alert?.type === 'CROSSING' && replay.viewState) {
      setViewState((v) => ({ ...v, ...replay.viewState, transitionDuration: 700 }));
    }
  }, [alert?.id, alert?.type, replay.viewState]);

  const playLayers = useMemo(() => {
    if (!rows.length) return [];
    const cur = rows[Math.min(playIndex, rows.length - 1)];
    const trail = rows.slice(0, Math.min(playIndex + 1, rows.length)).map((r) => r.p);
    return [
      new PathLayer({
        id: 'alert-replay-played-trail',
        data: trail.length >= 2 ? [{ path: trail }] : [],
        getPath: (d) => d.path,
        getColor: [224, 138, 60, 255],
        widthMinPixels: 4,
      }),
      new ScatterplotLayer({
        id: 'alert-replay-unit-marker',
        data: [cur],
        getPosition: (d) => d.p,
        getFillColor: cur.phase === 'crossing' ? [217, 72, 63, 255] : [224, 138, 60, 255],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 2.5,
        radiusUnits: 'pixels',
        getRadius: 8,
        radiusMinPixels: 8,
      }),
      new TextLayer({
        id: 'alert-replay-unit-label',
        data: [cur],
        getPosition: (d) => d.p,
        getText: () => alert?.unit || '',
        getColor: [36, 50, 64, 255],
        getSize: 11,
        sizeUnits: 'pixels',
        getPixelOffset: [13, -8],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        fontFamily: 'monospace',
        fontWeight: 700,
        characterSet: 'auto',
        background: true,
        getBackgroundColor: [255, 255, 255, 220],
        backgroundPadding: [4, 2],
      }),
    ];
  }, [rows, playIndex, alert?.unit]);

  return (
    <Box sx={{ position: 'relative', minHeight: 0, background: T.g1, borderBottom: `1px solid ${BORDER}` }}>
      <MapContainer
        layerState={{ orthophoto: true, roads: false, boundaries: false, exRadius: false, pitStops: false }}
        district={district}
        basemap="satellite"
        liveUnitData={[]}
        liveTrailsData={[]}
        viewState={viewState}
        onViewStateChange={(e) => setViewState(e.viewState)}
        replayLayers={alert?.type === 'CROSSING' && !loading && !err ? [...replay.layers, ...playLayers] : []}
      />
      {!alert && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>
          Pilih alert CROSSING di daftar bawah untuk melihat replay lintasan.
        </Box>
      )}
      {alert && alert.type !== 'CROSSING' && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>
          WARNING dipakai sebagai notifikasi. Replay lintasan hanya tersedia untuk CROSSING.
        </Box>
      )}
      {alert?.type === 'CROSSING' && loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>
          Memuat replay lintasan...
        </Box>
      )}
      {alert?.type === 'CROSSING' && err && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.crit, fontSize: 13 }}>
          Gagal memuat replay: {err}
        </Box>
      )}
      {alert && (
        <Box sx={{ position: 'absolute', left: 16, top: 14, zIndex: 5, background: 'rgba(255,255,255,.92)', border: `1px solid ${T.g3}`, borderRadius: '5px', px: 1.2, py: 0.8, boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box sx={{ fontFamily: T.mono, fontWeight: 700, color: T.ink, fontSize: 13 }}>{alert.unit}</Box>
            <TypeBadge type={alert.type} />
            <StatusChip status={alert.status} />
          </Box>
          <Box sx={{ mt: 0.4, fontFamily: T.mono, color: T.g5, fontSize: 10 }}>
            {fmtTime(alert.tsStart)} · {alert.areaCode || 'area —'} · peak {fmtDist(alert.minDistance)}
          </Box>
          {rows.length > 0 && (
            <Box sx={{ mt: 0.4, fontFamily: T.mono, color: T.g5, fontSize: 10 }}>
              row {Math.min(playIndex + 1, rows.length)} / {rows.length} · {fmtTime(rows[Math.min(playIndex, rows.length - 1)]?.ts)} · {rows[Math.min(playIndex, rows.length - 1)]?.speed?.toFixed?.(0) ?? '—'} km/h
            </Box>
          )}
          {devicePolygonVersion && (
            <Box sx={{ mt: 0.4, fontFamily: T.mono, color: T.g5, fontSize: 10 }}>
              device polygon {fmtDateTimeShort(devicePolygonGeneratedAt || devicePolygonVersion)}
              {livePolygonVersion ? ` · live ${fmtDateTimeShort(livePolygonVersion)}` : ''}
            </Box>
          )}
        </Box>
      )}
      <Box sx={{ position: 'absolute', left: 16, bottom: 12, zIndex: 5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {[
          ['Device geofence', T.ok],
          ['Live geofence', T.g6],
          ['Unsafe area', T.crit],
          ['Evidence line', T.warn],
          ['Trace row', T.warn],
        ].map(([label, color]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.55, background: 'rgba(255,255,255,.92)', border: `1px solid ${T.g3}`, borderRadius: '14px', px: 1, py: 0.4, fontSize: 10, fontFamily: T.mono, color: T.g6 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: label.includes('line') ? 0 : '50%', background: color }} />
            {label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MIRAlerts() {
  const [rawAlerts, setRawAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geofenceAreas, setGeofenceAreas] = useState([]);

  const [statusFilter, setStatusFilter] = useState('NEW'); // default: Belum divalidasi
  const [typeFilter, setTypeFilter] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [validateBusy, setValidateBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Fokus dari tab Operasi (?focus=event_id) — buka detail alert tsb.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const focusHandled = useRef(null);

  // store actions (for realtime + optimistic updates)
  const storeValidate = useMirAlertStore((s) => s.validate);
  const storeBulkValidate = useMirAlertStore((s) => s.validateBulk);
  const connectRealtime = useMirAlertStore((s) => s.connectRealtime);
  const disconnectRealtime = useMirAlertStore((s) => s.disconnectRealtime);

  // ── data loading ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (unitSearch.trim()) params.unit = unitSearch.trim();
      if (timeFrom) params.from = timeFrom;
      if (timeTo) params.to = timeTo;

      const data = await fetchAlerts(params);
      setRawAlerts((data.alerts || []).map(mapRawAlert));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, unitSearch, timeFrom, timeTo]);

  useEffect(() => { load(); }, [load]);

  // geofence (for mini-map)
  useEffect(() => {
    fetchGeofence()
      .then((d) => setGeofenceAreas(Array.isArray(d) ? d : (d.areas || [])))
      .catch(() => { /* non-critical */ });
  }, []);

  // realtime: join store realtime (already handles alert push → refetch)
  useEffect(() => {
    connectRealtime();
    return () => disconnectRealtime();
  }, [connectRealtime, disconnectRealtime]);

  // ?focus= dari Operasi: tampilkan SEMUA status (alert mungkin sudah divalidasi) supaya
  // pasti kelihatan, lalu buka detail + expand grupnya. Sekali per focusId.
  useEffect(() => {
    if (focusId && focusHandled.current !== focusId) setStatusFilter('');
  }, [focusId]);

  useEffect(() => {
    if (!focusId || focusHandled.current === focusId) return;
    const a = rawAlerts.find((x) => x.id === focusId);
    if (!a) return;
    focusHandled.current = focusId;
    setSelectedAlert(a);
    if (a.unit) setExpandedGroups((s) => new Set(s).add(a.unit));
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [rawAlerts, focusId, searchParams, setSearchParams]);

  // ── filters + grouping ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = unitSearch.trim().toLowerCase();
    return rawAlerts.filter((a) => {
      if (term && !a.unit.toLowerCase().includes(term) && !a.deviceId.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rawAlerts, unitSearch]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((a) => {
      if (!map.has(a.unit)) map.set(a.unit, []);
      map.get(a.unit).push(a);
    });
    return Array.from(map.entries()).map(([unit, rows]) => ({
      unit,
      rows: rows.sort((a, b) => (b.tsStart || 0) - (a.tsStart || 0)),
    })).sort((a, b) => {
      // sort: most alerts with NEW status first
      const newA = a.rows.filter((x) => x.status === 'NEW').length;
      const newB = b.rows.filter((x) => x.status === 'NEW').length;
      return newB - newA;
    });
  }, [filtered]);

  const summary = useMemo(() => {
    const total = rawAlerts.length;
    const unvalidated = rawAlerts.filter((a) => a.status === 'NEW').length;
    const crossing = rawAlerts.filter((a) => a.type === 'CROSSING').length;
    const valid = rawAlerts.filter((a) => a.status === 'VALID').length;
    const palsu = rawAlerts.filter((a) => a.status === 'FALSE').length;
    return [
      { n: total, l: 'Total' },
      { n: unvalidated, l: 'Belum divalidasi' },
      { n: crossing, l: 'Crossing' },
      { n: valid, l: 'True (VALID)' },
      { n: palsu, l: 'False (FALSE)' },
    ];
  }, [rawAlerts]);

  // ── selection helpers ─────────────────────────────────────────────────────────
  const toggleCheck = useCallback((id) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const selectGroup = useCallback((ids, checked) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      ids.forEach((id) => (checked ? n.add(id) : n.delete(id)));
      return n;
    });
  }, []);

  const toggleGroup = useCallback((unit) => {
    setExpandedGroups((s) => {
      const n = new Set(s);
      n.has(unit) ? n.delete(unit) : n.add(unit);
      return n;
    });
  }, []);

  // ── validate actions ──────────────────────────────────────────────────────────
  const handleValidateSingle = useCallback(async (id, status) => {
    setValidateBusy(true);
    try {
      await storeValidate(id, status);
      setSelectedAlert((prev) => (prev?.id === id ? { ...prev, status } : prev));
      await load();
    } finally {
      setValidateBusy(false);
    }
  }, [storeValidate, load]);

  const handleGroupBulk = useCallback(async (unit, status) => {
    setBulkBusy(true);
    try {
      await storeBulkValidate({ unit, status, note: '' });
      await load();
    } finally {
      setBulkBusy(false);
    }
  }, [storeBulkValidate, load]);

  const handleMultiSelectBulk = useCallback(async (status) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await storeBulkValidate({ event_ids: Array.from(selectedIds), status, note: '' });
      setSelectedIds(new Set());
      await load();
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, storeBulkValidate, load]);

  // ── render ────────────────────────────────────────────────────────────────────
  const hasSelection = selectedIds.size > 0;

  return (
    <Box
      sx={{
        height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
        background: BG, fontFamily: T.ff, color: TEXT, minHeight: 0,
      }}
    >
      {/* bulk action bar (floats above table when something is selected) */}
      {hasSelection && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1,
            background: SEL_BG, borderBottom: `1px solid ${T.g3}`,
            fontSize: 13, color: TEXT,
          }}
        >
          <Box sx={{ fontFamily: T.mono, fontWeight: 600, color: T.sel }}>
            {selectedIds.size} terpilih
          </Box>
          <Box sx={{ color: MUTED, fontSize: 12 }}>—</Box>
          <Box
            component="button"
            disabled={bulkBusy}
            onClick={() => handleMultiSelectBulk('VALID')}
            sx={{ border: BTN_VALID.border, background: '#e6f4ec', color: BTN_VALID.color, borderRadius: '4px', px: 1.25, py: 0.6, fontSize: 12, fontWeight: 700, cursor: bulkBusy ? 'not-allowed' : 'pointer', '&:hover:not(:disabled)': { background: '#d6ecdf' } }}
          >
            True semua
          </Box>
          <Box
            component="button"
            disabled={bulkBusy}
            onClick={() => handleMultiSelectBulk('FALSE')}
            sx={{ border: BTN_FALSE.border, background: '#fbeaea', color: BTN_FALSE.color, borderRadius: '4px', px: 1.25, py: 0.6, fontSize: 12, fontWeight: 700, cursor: bulkBusy ? 'not-allowed' : 'pointer', '&:hover:not(:disabled)': { background: '#f6dcdc' } }}
          >
            False semua
          </Box>
          <Box
            component="button"
            onClick={() => setSelectedIds(new Set())}
            sx={{ ml: 'auto', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, borderRadius: '4px', px: 1, py: 0.5, fontSize: 11, cursor: 'pointer', '&:hover': { color: TEXT } }}
          >
            Batal pilih
          </Box>
        </Box>
      )}

      {/* filter bar */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap',
          px: 1.75, py: 1, borderBottom: `1px solid ${BORDER}`,
          background: BG2,
        }}
      >
        <DarkFilterChips chips={STATUS_CHIPS} value={statusFilter} onChange={setStatusFilter} />
        <Box sx={{ width: '1px', height: 24, background: BORDER, flexShrink: 0 }} />
        <DarkFilterChips chips={TYPE_CHIPS} value={typeFilter} onChange={setTypeFilter} />
        <Box sx={{ width: '1px', height: 24, background: BORDER, flexShrink: 0 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, border: `1px solid ${BORDER}`, borderRadius: '4px', px: 1, py: 0.6, background: BG3, minWidth: 180 }}>
          <Box component="span" sx={{ color: MUTED, fontSize: 13 }}>⌕</Box>
          <Box
            component="input"
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            placeholder="Cari unit (DT-204…)"
            sx={{ border: 'none', outline: 'none', background: 'none', color: TEXT, fontSize: 12, fontFamily: T.mono, width: 140 }}
          />
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Box
            component="input"
            type="datetime-local"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
            sx={{ border: `1px solid ${BORDER}`, borderRadius: '4px', background: BG3, color: TEXT, px: 0.75, py: 0.5, fontSize: 11, fontFamily: T.mono, outline: 'none' }}
          />
          <Box component="span" sx={{ fontSize: 11, color: MUTED }}>s/d</Box>
          <Box
            component="input"
            type="datetime-local"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
            sx={{ border: `1px solid ${BORDER}`, borderRadius: '4px', background: BG3, color: TEXT, px: 0.75, py: 0.5, fontSize: 11, fontFamily: T.mono, outline: 'none' }}
          />
          <Box
            component="button"
            onClick={load}
            disabled={loading}
            sx={{ border: `1px solid ${BORDER}`, background: BG3, color: MUTED, borderRadius: '4px', px: 1.25, py: 0.6, fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer', '&:hover:not(:disabled)': { color: TEXT } }}
          >
            {loading ? 'Memuat…' : '↻ Refresh'}
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'minmax(260px, 1fr) 320px', background: BG }}>
        <AlertReplayStage alert={selectedAlert} geofenceAreas={geofenceAreas} />

        <Box sx={{ minHeight: 0, background: BG2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ p: '9px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 1.25, flex: '0 0 auto' }}>
            <Box sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: MUTED }}>Alert / warning list</Box>
            <Box sx={{ fontFamily: T.mono, fontSize: 10, color: MUTED }}>
              {summary.map((it) => `${it.l}: ${it.n}`).join(' · ')}
            </Box>
            <Box sx={{ ml: 'auto', fontFamily: T.mono, fontSize: 10, color: MUTED }}>
              Klik CROSSING untuk replay row evidence di peta
            </Box>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <DataState loading={loading && rawAlerts.length === 0} error={error} empty={!loading && filtered.length === 0} emptyText="Tidak ada peringatan sesuai filter.">
              <Box
                component="table"
                sx={{
                  width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12,
                  '& thead th': {
                    position: 'sticky', top: 0, background: BG3, textAlign: 'left',
                    p: '8px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px',
                    color: MUTED, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap', zIndex: 2,
                  },
                }}
              >
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Waktu</th>
                    <th>Tipe</th>
                    <th>Area</th>
                    <th>Jarak puncak</th>
                    <th>Durasi</th>
                    <th>Kec. maks</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(({ unit, rows }) => {
                    const expanded = expandedGroups.has(unit);
                    return (
                      <React.Fragment key={unit}>
                        <GroupHeader
                          unit={unit}
                          rows={rows}
                          expanded={expanded}
                          onToggle={() => toggleGroup(unit)}
                          onBulkValidate={handleGroupBulk}
                          selectedIds={selectedIds}
                          onSelectGroup={selectGroup}
                          bulkBusy={bulkBusy}
                        />
                        {expanded && rows.map((a) => (
                          <AlertRow
                            key={a.id}
                            alert={a}
                            active={a.id === selectedAlert?.id}
                            checked={selectedIds.has(a.id)}
                            onSelect={(alrt) => setSelectedAlert((prev) => (prev?.id === alrt.id ? null : alrt))}
                            onCheck={toggleCheck}
                            onValidate={handleValidateSingle}
                            busy={validateBusy}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </Box>
            </DataState>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
