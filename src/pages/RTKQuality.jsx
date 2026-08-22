import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Tooltip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import MapContainer from '../components/peta/MapContainer';
import TombolLayer from '../components/peta/TombolLayer';
import PanelLayer from '../components/peta/PanelLayer';
import { getLayerConfigForPath } from '../config/layerConfig';
import { T } from '../components/mir/operasi/mirTokens';
import useUserStore from '../stores/userStore';
import { fetchRtkData, fetchRtkDevices } from '../services/rtkQualityApi';

const WITA_SUFFIX = ':00+08:00';

const pad2 = (value) => String(value).padStart(2, '0');
const nowWitaInput = () => {
  const wita = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return wita.toISOString().slice(0, 13) + ':00';
};
const shiftInput = (value, hours) => {
  const date = new Date(`${value}:00Z`);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString().slice(0, 16);
};
const shiftInputMinutes = (value, minutes) => {
  const date = new Date(`${value}:00Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString().slice(0, 16);
};
const inputFromIso = (value) => value?.slice(0, 16) || '';
const apiDate = (value) => `${value}${WITA_SUFFIX}`;
const fmtHour = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 13)}:00`;
const fmtMinute = (iso) => iso.slice(11, 16);
const fmtSecond = (iso) => iso.slice(11, 19);
const pct = (value) => value == null ? '—' : `${Number(value).toFixed(value === 100 ? 0 : 1)}%`;
const number = (value, digits = 1) => value == null ? '—' : Number(value).toFixed(digits);
const stateForPct = (value) => value == null ? 'none' : value >= 99 ? 'ok' : value >= 95 ? 'warn' : 'crit';
const stateRank = { none: -1, ok: 0, warn: 1, crit: 2 };
const worstState = (...states) => states.reduce((worst, item) => stateRank[item] > stateRank[worst] ? item : worst, 'none');
const stateColors = {
  none: { bg: T.g1, fg: T.g5 },
  ok: { bg: '#bff4d2', fg: '#176238' },
  warn: { bg: '#f8e6a7', fg: '#8a5c0a' },
  crit: { bg: '#f7b4ae', fg: '#923b35' },
};
const RTK_FIX_MAP_COLOR = '#2563eb';
const fixColor = (fix) => Number(fix) === 4 ? RTK_FIX_MAP_COLOR : Number(fix) === 5 ? T.warn : T.crit;
const colorArray = (hex, alpha = 210) => {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16), alpha];
};

const metricDefinitions = [
  {
    key: 'coveragePct', label: 'Data availability',
    format: (b) => pct(b.coveragePct), state: (b) => stateForPct(b.receivedSamples ? b.coveragePct : null),
    detail: (b) => `${b.receivedSamples}/${b.expectedSamples}`,
  },
  {
    key: 'avgCorrectionAgeMs', label: 'Correction age',
    format: (b) => b.avgCorrectionAgeMs == null ? '—' : `${(b.avgCorrectionAgeMs / 1000).toFixed(1)}s`,
    state: (b) => b.avgCorrectionAgeMs == null ? 'none' : b.avgCorrectionAgeMs <= 3000 ? 'ok' : b.avgCorrectionAgeMs <= 7000 ? 'warn' : 'crit',
    detail: () => '',
  },
  {
    key: 'rtkFixPct', label: 'RTK quality',
    format: (b) => pct(b.rtkFixPct), state: (b) => stateForPct(b.rtkFixPct),
    detail: (b) => `${b.fixedSamples}/${b.validGpsSamples}`,
  },
  {
    key: 'avgNumSat', label: 'Numsat',
    format: (b) => number(b.avgNumSat, 0),
    state: (b) => b.avgNumSat == null ? 'none' : b.avgNumSat >= 18 ? 'ok' : b.avgNumSat >= 12 ? 'warn' : 'crit',
    detail: (b) => b.minNumSat == null ? '' : `min ${b.minNumSat}`,
  },
  {
    key: 'avgHdop', label: 'HDOP', format: (b) => number(b.avgHdop, 2),
    state: (b) => b.avgHdop == null ? 'none' : b.avgHdop <= 1.2 ? 'ok' : b.avgHdop <= 2 ? 'warn' : 'crit', detail: () => '',
  },
  {
    key: 'avgPdop', label: 'PDOP', format: (b) => number(b.avgPdop, 2),
    state: (b) => b.avgPdop == null ? 'none' : b.avgPdop <= 2 ? 'ok' : b.avgPdop <= 3.5 ? 'warn' : 'crit', detail: () => '',
  },
];

function RtkMap({ units, unitFilter, onSelectUnit }) {
  const district = useUserStore((state) => state.profile?.distrik);
  const [layerState, setLayerState] = useState(() => ({
    ...getLayerConfigForPath('/playback/rtk-quality'),
  }));
  const [anchorElLayer, setAnchorElLayer] = useState(null);
  const points = useMemo(() => units.flatMap((unit) =>
    (unit.mapPoints || []).map((point) => ({ ...point, unitNo: unit.unitNo }))), [units]);
  const visiblePoints = unitFilter === 'all' ? points : points.filter((point) => point.unitNo === unitFilter);
  const [viewState, setViewState] = useState({ longitude: 117.223, latitude: 1.881, zoom: 14, pitch: 0, bearing: 0 });

  useEffect(() => {
    if (!visiblePoints.length) return;
    const latest = visiblePoints.at(-1);
    setViewState((current) => ({ ...current, longitude: latest.longitude, latitude: latest.latitude }));
  }, [visiblePoints.length]);

  const layers = useMemo(() => {
    const byUnit = new Map();
    visiblePoints.forEach((point) => {
      if (!byUnit.has(point.unitNo)) byUnit.set(point.unitNo, []);
      byUnit.get(point.unitNo).push(point);
    });
    const tracks = [...byUnit.entries()].map(([unitNo, rows]) => ({
      unitNo,
      path: rows.map((row) => [row.longitude, row.latitude]),
    })).filter((track) => track.path.length > 1);
    const lastPoints = [...byUnit.entries()].map(([unitNo, rows]) => ({ ...rows.at(-1), unitNo }));
    return [
      new PathLayer({
        id: 'rtk-quality-tracks', data: tracks, getPath: (row) => row.path,
        getColor: [36, 50, 64, 170], widthMinPixels: unitFilter === 'all' ? 1.2 : 2.4,
      }),
      new ScatterplotLayer({
        id: 'rtk-quality-points', data: visiblePoints, pickable: true,
        onClick: ({ object }) => object && onSelectUnit(object.unitNo),
        getPosition: (row) => [row.longitude, row.latitude],
        getFillColor: (row) => colorArray(fixColor(row.fixQuality), Number(row.fixQuality) === 4 ? 225 : 245),
        getLineColor: [255, 255, 255, 245], stroked: true, lineWidthMinPixels: 1.25,
        radiusUnits: 'pixels', getRadius: (row) => Number(row.fixQuality) === 4 ? 4.2 : 5.6, radiusMinPixels: 4,
      }),
      new TextLayer({
        id: 'rtk-quality-labels', data: unitFilter === 'all' ? lastPoints : lastPoints.filter((row) => row.unitNo === unitFilter),
        getPosition: (row) => [row.longitude, row.latitude], getText: (row) => row.unitNo,
        getColor: [36, 50, 64, 255], getSize: 10, sizeUnits: 'pixels', getPixelOffset: [10, -8],
        getTextAnchor: 'start', getAlignmentBaseline: 'center', fontFamily: 'monospace', fontWeight: 700,
        background: true, getBackgroundColor: [255, 255, 255, 220], backgroundPadding: [4, 2],
      }),
    ];
  }, [visiblePoints, unitFilter, onSelectUnit]);

  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 0, background: T.g1 }}>
      <MapContainer
        layerState={layerState} district={district} basemap="satellite"
        liveUnitData={[]} liveTrailsData={[]} replayLayers={layers}
        viewState={viewState} onViewStateChange={(event) => setViewState(event.viewState)}
      />
      <Box sx={{ position: 'absolute', left: 12, top: 12, zIndex: 3 }}>
        <TombolLayer
          onClick={(event) => setAnchorElLayer(event.currentTarget)}
          active={Boolean(anchorElLayer)}
          layerCount={Number(layerState.boundaries) + Number(layerState.roads)}
        />
      </Box>
      <PanelLayer
        open={Boolean(anchorElLayer)}
        anchorEl={anchorElLayer}
        handleClose={() => setAnchorElLayer(null)}
        layerState={layerState}
        onLayerChange={(event) => {
          const { name, checked } = event.target;
          setLayerState((current) => ({ ...current, [name]: checked }));
        }}
      />
      <Box sx={{ position: 'absolute', left: 12, bottom: 12, zIndex: 2, display: 'flex', gap: 0.75 }}>
        {[['RTK FIX', RTK_FIX_MAP_COLOR], ['RTK FLOAT', T.warn], ['INVALID', T.crit]].map(([label, color]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, background: 'rgba(255,255,255,.94)', border: `1px solid ${T.g3}`, borderRadius: '14px', px: 1, py: 0.45, fontSize: 10, fontFamily: T.mono }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SummaryBand({ units }) {
  const summary = useMemo(() => {
    const buckets = units.flatMap((unit) => unit.buckets || []);
    const expected = buckets.reduce((sum, row) => sum + row.expectedSamples, 0);
    const received = buckets.reduce((sum, row) => sum + row.receivedSamples, 0);
    const valid = buckets.reduce((sum, row) => sum + row.validGpsSamples, 0);
    const fixed = buckets.reduce((sum, row) => sum + row.fixedSamples, 0);
    const duplicates = units.reduce((sum, unit) => sum + unit.duplicateSamples, 0);
    return {
      coverage: expected ? Math.min(received, expected) * 100 / expected : null,
      quality: valid ? fixed * 100 / valid : null,
      missing: Math.max(0, expected - received), duplicates,
    };
  }, [units]);
  const items = [
    ['Unit', units.length], ['Data availability', pct(summary.coverage)], ['RTK quality', pct(summary.quality)],
    ['Missing second', summary.missing.toLocaleString('id-ID')], ['Duplicate heartbeat', summary.duplicates.toLocaleString('id-ID')],
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(5,minmax(0,1fr))' }, borderBottom: `1px solid ${T.line}`, background: T.w }}>
      {items.map(([label, value]) => (
        <Box key={label} sx={{ px: 1.5, py: 0.8, borderRight: `1px solid ${T.g1}`, minWidth: 0 }}>
          <Box sx={{ fontSize: 9, color: T.g5, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</Box>
          <Box sx={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.ink }}>{value}</Box>
        </Box>
      ))}
    </Box>
  );
}

const HeadCell = ({ children, sx }) => <Box component="th" sx={{ position: 'sticky', top: 0, zIndex: 3, p: '7px 10px', background: T.g0, borderBottom: `1px solid ${T.line}`, color: T.g5, textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap', ...sx }}>{children}</Box>;
const DataCell = ({ children, sx, ...props }) => <Box component="td" sx={{ p: '6px 8px', borderRight: `1px solid ${T.w}`, borderBottom: `1px solid ${T.w}`, fontFamily: T.mono, textAlign: 'center', whiteSpace: 'nowrap', ...sx }} {...props}>{children}</Box>;

function Matrix({ data, onDrill }) {
  const resolution = data.resolution;
  const isHour = resolution === 'hour';
  const columns = useMemo(() => {
    const starts = new Set(data.units.flatMap((unit) => unit.buckets.map((bucket) => bucket.start)));
    return [...starts].sort();
  }, [data.units]);
  const title = isHour ? 'RTK Quality per jam' : resolution === 'minute' ? `${data.units[0]?.unitNo || ''} · detail per menit` : `${data.units[0]?.unitNo || ''} · detail per detik`;
  const formatColumn = resolution === 'hour' ? fmtHour : resolution === 'minute' ? fmtMinute : fmtSecond;

  return (
    <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: T.w, borderTop: `1px solid ${T.line}` }}>
      <Box sx={{ flex: '0 0 38px', display: 'flex', alignItems: 'center', px: 1.5, borderBottom: `1px solid ${T.line}`, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: T.g6 }}>
        {title}
      </Box>
      <Box sx={{ minHeight: 0, flex: 1, overflow: 'auto' }}>
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: Math.max(760, 145 + columns.length * (resolution === 'second' ? 62 : 78)), width: '100%', fontSize: 11 }}>
          <thead><tr><HeadCell sx={{ left: 0, zIndex: 5, textAlign: 'left' }}>{isHour ? 'Unit' : 'Metric'}</HeadCell>{columns.map((start) => <HeadCell key={start}>{formatColumn(start)}</HeadCell>)}</tr></thead>
          <tbody>
            {isHour ? data.units.map((unit) => {
              const byStart = new Map(unit.buckets.map((bucket) => [bucket.start, bucket]));
              return (
                <Box component="tr" key={unit.unitNo}>
                  <DataCell sx={{ position: 'sticky', left: 0, zIndex: 2, background: T.w, textAlign: 'left', fontWeight: 700, color: T.ink }}>{unit.unitNo}</DataCell>
                  {columns.map((start) => {
                    const bucket = byStart.get(start);
                    const hasRows = bucket?.receivedSamples > 0;
                    const state = hasRows ? worstState(stateForPct(bucket.rtkFixPct), stateForPct(bucket.coveragePct)) : 'none';
                    const colors = stateColors[state];
                    return <DataCell key={start} onClick={() => bucket && onDrill(unit.unitNo, bucket.start)} title={bucket ? `RTK ${pct(bucket.rtkFixPct)} · availability ${pct(bucket.coveragePct)} · missing ${bucket.missingSamples}` : 'No data'} sx={{ background: colors.bg, color: colors.fg, cursor: bucket ? 'pointer' : 'default', fontWeight: 700 }}>{hasRows ? pct(bucket.rtkFixPct) : '—'}<Box sx={{ fontSize: 8.5, fontWeight: 400 }}>A {bucket ? pct(bucket.coveragePct) : '—'}</Box></DataCell>;
                  })}
                </Box>
              );
            }) : metricDefinitions.map((metric) => {
              const byStart = new Map((data.units[0]?.buckets || []).map((bucket) => [bucket.start, bucket]));
              return (
                <Box component="tr" key={metric.key}>
                  <DataCell sx={{ position: 'sticky', left: 0, zIndex: 2, background: T.w, textAlign: 'left', fontWeight: 700, color: T.ink }}>{metric.label}</DataCell>
                  {columns.map((start) => {
                    const bucket = byStart.get(start);
                    const colors = stateColors[bucket ? metric.state(bucket) : 'none'];
                    const detail = bucket ? metric.detail(bucket) : '';
                    return <DataCell key={start} onClick={() => resolution === 'minute' && bucket && onDrill(data.units[0].unitNo, bucket.start)} title={detail} sx={{ background: colors.bg, color: colors.fg, cursor: resolution === 'minute' ? 'pointer' : 'default', fontWeight: 700 }}>{bucket ? metric.format(bucket) : '—'}{detail && <Box sx={{ fontSize: 8.5, fontWeight: 400 }}>{detail}</Box>}</DataCell>;
                  })}
                </Box>
              );
            })}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}

export default function RTKQuality() {
  const [devices, setDevices] = useState([]);
  const [from, setFrom] = useState(() => shiftInput(nowWitaInput(), -6));
  const [to, setTo] = useState(nowWitaInput);
  const [unitFilter, setUnitFilter] = useState('all');
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });

  const visibleData = useMemo(() => {
    if (!data || unitFilter === 'all') return data;
    return {
      ...data,
      units: data.units.filter((unit) => unit.unitNo === unitFilter),
    };
  }, [data, unitFilter]);

  const loadData = useCallback(async ({ resolution = 'hour', start = from, end = to, units, pushHistory = false } = {}) => {
    const selectedUnits = units || (unitFilter === 'all' ? devices.map((device) => device.unitNo) : [unitFilter]);
    if (!selectedUnits.length || !start || !end) return;
    const previous = data;
    setState({ loading: true, error: null });
    try {
      const result = await fetchRtkData({
        unitNos: selectedUnits, startDateTime: apiDate(start), endDateTime: apiDate(end),
        resolution, includeMap: true,
      });
      if (pushHistory && previous) setHistory((items) => [...items, previous]);
      setData(result);
    } catch (error) {
      setState({ loading: false, error: error.message });
      return;
    }
    setState({ loading: false, error: null });
  }, [data, devices, from, to, unitFilter]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, error: null });
    fetchRtkDevices(controller.signal).then((result) => {
      const roster = result.devices || [];
      setDevices(roster);
      const latest = roster.map((device) => device.latestDataAt).filter(Boolean).sort().at(-1);
      const initialTo = latest ? shiftInput(inputFromIso(latest), 1) : nowWitaInput();
      const initialFrom = shiftInput(initialTo, -6);
      setFrom(initialFrom);
      setTo(initialTo);
      if (!roster.length) {
        setState({ loading: false, error: null });
        return;
      }
      return fetchRtkData({
        unitNos: roster.map((device) => device.unitNo), startDateTime: apiDate(initialFrom),
        endDateTime: apiDate(initialTo), resolution: 'hour', includeMap: true,
      }, controller.signal).then((resultData) => {
        setData(resultData);
        setState({ loading: false, error: null });
      });
    }).catch((error) => {
      if (error.name !== 'AbortError') setState({ loading: false, error: error.message });
    });
    return () => controller.abort();
  }, []);

  const apply = () => {
    setHistory([]);
    loadData({ resolution: 'hour' });
  };
  const drill = (unitNo, start) => {
    const resolution = data?.resolution === 'hour' ? 'minute' : 'second';
    const inputStart = inputFromIso(start);
    const inputEnd = resolution === 'minute' ? shiftInput(inputStart, 1) : shiftInputMinutes(inputStart, 1);
    setUnitFilter(unitNo);
    loadData({ resolution, start: inputStart, end: inputEnd, units: [unitNo], pushHistory: true });
  };
  const back = () => {
    setHistory((items) => {
      const previous = items.at(-1);
      if (previous) setData(previous);
      return items.slice(0, -1);
    });
  };
  const reload = () => {
    if (!visibleData) return;
    loadData({
      resolution: visibleData.resolution,
      start: inputFromIso(visibleData.startDateTime),
      end: inputFromIso(visibleData.endDateTime),
      units: visibleData.units.map((unit) => unit.unitNo),
    });
  };

  return (
    <Box sx={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto minmax(250px,1fr) minmax(230px,300px)', background: T.g0, border: `1px solid ${T.line}`, borderRadius: '6px', overflow: 'hidden', fontFamily: T.ff }}>
      <Box sx={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 1, p: '8px 12px', background: T.w, borderBottom: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
        {history.length > 0 && <Tooltip title="Kembali"><Box component="button" onClick={back} sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', background: T.w, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><ArrowBackIcon sx={{ fontSize: 17 }} /></Box></Tooltip>}
        <Box component="input" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} disabled={history.length > 0} sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', p: '6px 8px', fontFamily: T.mono, fontSize: 11, background: T.g0 }} />
        <Box sx={{ color: T.g5, fontSize: 11 }}>s/d</Box>
        <Box component="input" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} disabled={history.length > 0} sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', p: '6px 8px', fontFamily: T.mono, fontSize: 11, background: T.g0 }} />
        <Box component="select" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} disabled={history.length > 0} sx={{ minWidth: 135, border: `1px solid ${T.g3}`, borderRadius: '4px', p: '6px 8px', fontFamily: T.mono, fontSize: 11, background: T.g0 }}>
          <option value="all">Semua unit</option>{devices.map((device) => <option key={device.unitNo} value={device.unitNo}>{device.unitNo}</option>)}
        </Box>
        <Box component="button" onClick={apply} disabled={state.loading || history.length > 0} sx={{ border: 0, borderRadius: '4px', px: 1.25, py: 0.75, display: 'flex', alignItems: 'center', gap: 0.6, background: T.ink, color: T.w, fontSize: 11, fontWeight: 700, cursor: 'pointer', '&:disabled': { opacity: 0.5 } }}><SearchIcon sx={{ fontSize: 15 }} />Terapkan</Box>
        <Tooltip title="Muat ulang"><Box component="button" onClick={reload} disabled={state.loading || !data} sx={{ ml: 'auto', border: `1px solid ${T.g3}`, borderRadius: '4px', background: T.w, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><RefreshIcon sx={{ fontSize: 17 }} /></Box></Tooltip>
        {data && <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5, textTransform: 'uppercase' }}>{data.resolution}</Box>}
      </Box>

      <SummaryBand units={visibleData?.units || []} />
      <Box sx={{ minHeight: 0, position: 'relative' }}>
        <RtkMap units={visibleData?.units || []} unitFilter={unitFilter} onSelectUnit={setUnitFilter} />
        {state.loading && <Box sx={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', background: 'rgba(248,250,252,.65)' }}><CircularProgress size={26} /></Box>}
        {state.error && <Box sx={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 6, p: 1.25, border: `1px solid ${T.crit}`, borderRadius: '5px', background: '#fff5f5', color: T.crit, fontSize: 12 }}>{state.error}</Box>}
        {!state.loading && !state.error && data?.warnings?.length > 0 && <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 6, p: 0.8, border: `1px solid ${T.warn}`, borderRadius: '4px', background: '#fffdf3', color: '#8a5c0a', fontSize: 10 }}>{data.warnings.join(' ')}</Box>}
      </Box>
      {visibleData ? <Matrix data={visibleData} onDrill={drill} /> : <Box sx={{ borderTop: `1px solid ${T.line}`, background: T.w }} />}
    </Box>
  );
}
