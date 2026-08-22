import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FilterListIcon from '@mui/icons-material/FilterList';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import SearchIcon from '@mui/icons-material/Search';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import MapContainer from '../components/peta/MapContainer';
import DateRangeFilter from '../components/datalog/DateRangeFilter';
import useUserStore from '../stores/userStore';
import { virtualRowSx } from '../utils/tableRowSx';
import { getDatalogSearchApiBase, getPerformanceV2Config } from '../config/apiConfig';

const FALLBACK_DISTRICT = 'BRCB';
const DATALOG_API_BASE = '/Monitoring/api/DatalogRecord';
const DATALOG_V2_API_BASE = '/Monitoring/api/DatalogRecordV2';
const TABLE_ROW_HEIGHT = 37;
const TABLE_OVERSCAN_ROWS = 8;

const defaultVisibleColumns = (columns) => columns.filter((field) => field.defaultVisible || field.fixed).map((field) => field.key);
const MAP_LAYER_STATE = { orthophoto: true, roads: false, boundaries: false, exRadius: false, pitStops: false };
const FILTER_POPOVER_WIDTH = 330;
const FILTER_OPERATORS = [
  { value: 'equals', label: 'Is equal to' },
  { value: 'notEquals', label: 'Is not equal to' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'contains', label: 'Contains' },
  { value: 'notContains', label: 'Does not contain' },
  { value: 'endsWith', label: 'Ends with' },
];
const EMPTY_FILTER_CONDITION = { op: 'equals', value: '' };

const numericValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function getUnitNo(unit) {
  return typeof unit === 'string'
    ? unit
    : unit?.unitno || unit?.unitNo || unit?.unit_no || unit?.device_id || unit?.deviceId || '';
}

function isUnitAvailable(unit) {
  return typeof unit === 'string' ? true : unit?.available === true;
}

function getUnitFileCount(unit) {
  return typeof unit === 'string' ? 0 : Number(unit?.availableFileCount || unit?.available_file_count || 0);
}

function getUnitDeviceIds(unit) {
  if (typeof unit === 'string') return [];
  const ids = unit.device_ids || unit.deviceIds || [];
  return [...new Set([
    ...(Array.isArray(ids) ? ids : []),
    unit.device_id || unit.deviceId || '',
  ].filter(Boolean))];
}

function normalizeColumnFilter(filter) {
  if (filter?.conditions) {
    return {
      logic: filter.logic === 'or' ? 'or' : 'and',
      conditions: [0, 1].map((index) => ({
        ...EMPTY_FILTER_CONDITION,
        ...(filter.conditions[index] || {}),
      })),
    };
  }
  return {
    logic: 'and',
    conditions: [
      { ...EMPTY_FILTER_CONDITION, op: filter?.op || 'equals', value: filter?.value || '' },
      { ...EMPTY_FILTER_CONDITION },
    ],
  };
}

function hasActiveFilter(filter) {
  return normalizeColumnFilter(filter).conditions.some((condition) => String(condition.value ?? '').trim());
}

function conditionMatches(rawValue, condition) {
  const needle = String(condition.value ?? '').trim().toLowerCase();
  if (!needle) return true;
  const value = String(rawValue ?? '').toLowerCase();
  if (condition.op === 'equals') return value === needle;
  if (condition.op === 'notEquals') return value !== needle;
  if (condition.op === 'startsWith') return value.startsWith(needle);
  if (condition.op === 'endsWith') return value.endsWith(needle);
  if (condition.op === 'notContains') return !value.includes(needle);
  return value.includes(needle);
}

function filterMatches(rawValue, filter) {
  const normalized = normalizeColumnFilter(filter);
  const activeConditions = normalized.conditions.filter((condition) => String(condition.value ?? '').trim());
  if (activeConditions.length === 0) return true;
  return normalized.logic === 'or'
    ? activeConditions.some((condition) => conditionMatches(rawValue, condition))
    : activeConditions.every((condition) => conditionMatches(rawValue, condition));
}

function toBackendFilters(columnFilters) {
  return Object.entries(columnFilters).flatMap(([field, filter]) => {
    const normalized = normalizeColumnFilter(filter);
    if (normalized.logic === 'or') return [];
    return normalized.conditions
      .filter((condition) => String(condition.value || '').trim() && ['equals', 'contains'].includes(condition.op))
      .map((condition) => ({ field, operator: condition.op, value: condition.value }));
  });
}

function flattenDistrictDevices(district) {
  const activeDistrict = district || { district: '', types: [] };
  return activeDistrict.types.flatMap((type) => type.units.flatMap((unit) => {
    const deviceIds = getUnitDeviceIds(unit);
    const base = {
      district: activeDistrict.district,
      type: type.type,
      unit: getUnitNo(unit),
      available: isUnitAvailable(unit),
    };
    return deviceIds.length > 0
      ? deviceIds.map((deviceId) => ({ ...base, deviceId }))
      : [{ ...base, deviceId: '' }];
  }));
}

function normalizeDeviceTree(payload, fallbackDistrict) {
  return {
    district: payload?.district || fallbackDistrict,
    types: (payload?.types || []).map((typeGroup) => ({
      type: typeGroup.type || 'UNKNOWN',
      units: (typeGroup.units || [])
        .map((unit) => {
          const unitno = getUnitNo(unit);
          if (!unitno) return null;
          return {
            unitno,
            device_id: typeof unit === 'string' ? '' : unit.device_id || unit.deviceId || '',
            device_ids: getUnitDeviceIds(unit),
            available: isUnitAvailable(unit),
            availableFileCount: getUnitFileCount(unit),
          };
        })
        .filter(Boolean),
    })).filter((typeGroup) => typeGroup.units.length > 0),
  };
}

function formatApiDate(value) {
  if (!value) return value;
  return value.length === 16 ? `${value}:00` : value;
}

function formatV2Date(value) {
  const formatted = formatApiDate(value);
  if (!formatted || /[zZ]$|[+-]\d{2}:\d{2}$/.test(formatted)) return formatted;
  return `${formatted}+08:00`;
}

function parseTimestampValue(value) {
  if (!value) return NaN;
  if (typeof value === 'string' && /^\d{14}$/.test(value)) {
    const isoLike = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
    return Date.parse(isoLike);
  }
  return Date.parse(value);
}

function getTimestampField(columns) {
  return columns.find((column) => column.key === 'timestampiso')?.key
    || columns.find((column) => column.key === 'creation_time')?.key
    || columns.find((column) => column.key === 'report_time')?.key
    || columns.find((column) => column.type === 'datetime')?.key
    || null;
}

function getDisplayTimestamp(row, timestampField) {
  const raw = timestampField ? row[timestampField] : null;
  if (typeof raw === 'string' && /^\d{14}$/.test(raw)) {
    return `${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
  }
  return String(raw || '').slice(11, 16);
}

function getRowUnit(row) {
  return String(row.unitno || row.unitNo || row.device_name_id || row.deviceid || 'Unknown').split('(')[0];
}

// Warna titik dot-trace berdasarkan speed: biru (lambat) -> hijau -> merah (cepat).
function speedColor(speed, max) {
  const t = Math.max(0, Math.min(1, (Number(speed) || 0) / (max || 1)));
  const r = Math.round(255 * Math.min(1, t * 2));
  const g = Math.round(200 * (1 - Math.abs(t - 0.5) * 2) + 40);
  const b = Math.round(255 * Math.min(1, (1 - t) * 2));
  return [r, g, b, 190];
}

// Only /search, /chart and /map are routed by flag: DatalogRecordV3 implements
// exactly those three and nothing else, so /devices and /export always stay on the
// original base.
const V3_ROUTABLE = new Set(['/search', '/chart', '/map']);
let datalogSearchBasePromise = null;

async function resolveDatalogBase(path) {
  if (!V3_ROUTABLE.has(path.split('?')[0])) return DATALOG_API_BASE;
  if (!datalogSearchBasePromise) {
    datalogSearchBasePromise = getDatalogSearchApiBase()
      .then((base) => `/Monitoring${base}`)
      .catch(() => DATALOG_API_BASE);
  }
  return datalogSearchBasePromise;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${await resolveDatalogBase(path)}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Datalog API ${response.status}`);
  }
  return response.json();
}

async function requestV2Json(path, options = {}) {
  const response = await fetch(`${DATALOG_V2_API_BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Datalog V2 API ${response.status}`);
  }
  return response.json();
}

async function deleteV2Query(queryId) {
  if (!queryId) return;
  try {
    await fetch(`${DATALOG_V2_API_BASE}/queries/${queryId}`, { method: 'DELETE', cache: 'no-store' });
  } catch {
  }
}

async function deleteV2Export(exportId) {
  if (!exportId) return;
  try {
    await fetch(`${DATALOG_V2_API_BASE}/exports/${exportId}`, { method: 'DELETE', cache: 'no-store' });
  } catch {
  }
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timeoutId = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function readResponseMessage(response, fallback) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return parsed?.message || text;
  } catch {
    return text;
  }
}

function contentDispositionFileName(disposition, fallback) {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition || '');
  return match ? decodeURIComponent(match[1]) : fallback;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function DatalogRecord() {
  const profileDistrict = useUserStore((s) => s.profile?.distrik);
  const district = profileDistrict || FALLBACK_DISTRICT;
  const [activeTree, setActiveTree] = useState({ district, types: [] });
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({ [district]: true });
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [from, setFrom] = useState('2026-06-22T00:00');
  const [to, setTo] = useState('2026-06-22T23:59');
  const [searched, setSearched] = useState(false);
  const [s3Response, setS3Response] = useState(() => ({ columns: [], rows: [], totalRows: 0, warnings: [] }));
  const [columnAnchor, setColumnAnchor] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  const [filterPosition, setFilterPosition] = useState(null);
  const [activeFilterKey, setActiveFilterKey] = useState(null);
  const [filterDraft, setFilterDraft] = useState(normalizeColumnFilter());
  const [pageSize, setPageSize] = useState(500);
  const [page, setPage] = useState(1);
  const [v2QueryId, setV2QueryId] = useState(null);
  const [v2Cursors, setV2Cursors] = useState({});
  const [v2NextCursor, setV2NextCursor] = useState(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableViewportHeight, setTableViewportHeight] = useState(480);
  const [exporting, setExporting] = useState(false);
  const [chartMetrics, setChartMetrics] = useState([]);
  const [chartApiSeries, setChartApiSeries] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [visualOpen, setVisualOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapApiTracks, setMapApiTracks] = useState([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [showDotTrace, setShowDotTrace] = useState(true);
  const [mapViewState, setMapViewState] = useState({ longitude: 117.28, latitude: 1.91, zoom: 13, pitch: 0, bearing: 0 });
  // Field mapping yang bisa di-custom user ('' = auto-detect dari nama field).
  const [latField, setLatField] = useState('');
  const [lonField, setLonField] = useState('');
  const [speedField, setSpeedField] = useState('');
  const [chartXField, setChartXField] = useState('');
  const [chartHover, setChartHover] = useState(null);
  const [chartWidth, setChartWidth] = useState(900);
  const chartWrapRef = useRef(null);
  const datalogAbortRef = useRef(null);
  const chartAbortRef = useRef(null);
  const mapAbortRef = useRef(null);
  const exportAbortRef = useRef(null);
  const datalogRequestTokenRef = useRef(0);
  const chartRequestTokenRef = useRef(0);
  const mapRequestTokenRef = useRef(0);
  const exportRequestTokenRef = useRef(0);
  const activeExportIdRef = useRef(null);
  const v2QueryIdRef = useRef(null);
  const tableScrollRef = useRef(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [apiMessage, setApiMessage] = useState('');
  const [performanceV2, setPerformanceV2] = useState({ datalogEnabled: false });

  const setActiveV2QueryId = (queryId) => {
    v2QueryIdRef.current = queryId;
    setV2QueryId(queryId);
  };

  const cancelVisualRequests = (cancelExport = false) => {
    if (chartAbortRef.current) chartAbortRef.current.abort();
    if (mapAbortRef.current) mapAbortRef.current.abort();
    if (cancelExport && exportAbortRef.current) exportAbortRef.current.abort();
    if (cancelExport) {
      const exportId = activeExportIdRef.current;
      activeExportIdRef.current = null;
      void deleteV2Export(exportId);
      exportRequestTokenRef.current += 1;
      setExporting(false);
    }
    chartRequestTokenRef.current += 1;
    mapRequestTokenRef.current += 1;
    setLoadingChart(false);
    setLoadingMap(false);
  };

  useEffect(() => {
    let alive = true;
    setLoadingTree(true);
    setApiMessage('');
    const params = new URLSearchParams({
      district,
      startDateTime: formatApiDate(from),
      endDateTime: formatApiDate(to),
    });
    requestJson(`/devices?${params.toString()}`)
      .then((payload) => {
        if (!alive) return;
        const tree = normalizeDeviceTree(payload, district);
        setActiveTree(tree);
        setExpanded((state) => ({ ...state, [tree.district]: true, [tree.types[0]?.type || '']: true }));
        const availableUnits = new Set(flattenDistrictDevices(tree).filter((item) => item.available).map((item) => item.unit));
        setSelectedUnits((state) => state.filter((unit) => availableUnits.has(unit)));
      })
      .catch((error) => {
        if (!alive) return;
        setActiveTree({ district, types: [] });
        setSelectedUnits([]);
        setApiMessage(`Gagal memuat device tree: ${error.message}`);
      })
      .finally(() => {
        if (alive) setLoadingTree(false);
      });
    return () => { alive = false; };
  }, [district, from, to]);

  useEffect(() => {
    let alive = true;
    getPerformanceV2Config()
      .then((config) => {
        if (alive) setPerformanceV2(config);
      })
      .catch(() => {
        if (alive) setPerformanceV2({ datalogEnabled: false });
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => {
    if (datalogAbortRef.current) datalogAbortRef.current.abort();
    if (chartAbortRef.current) chartAbortRef.current.abort();
    if (mapAbortRef.current) mapAbortRef.current.abort();
    if (exportAbortRef.current) exportAbortRef.current.abort();
    void deleteV2Query(v2QueryIdRef.current);
    void deleteV2Export(activeExportIdRef.current);
  }, []);

  useEffect(() => {
    const element = tableScrollRef.current;
    if (!element) return undefined;

    const syncViewport = () => setTableViewportHeight(element.clientHeight || 480);
    syncViewport();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(syncViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTableScrollTop(0);
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
  }, [page, pageSize, s3Response.rows]);

  // Ukur lebar container chart supaya SVG render tajam (tidak distorsi/stretch).
  useEffect(() => {
    if (!visualOpen) return undefined;
    const el = chartWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setChartWidth(w);
    });
    ro.observe(el);
    setChartWidth(el.clientWidth || 900);
    return () => ro.disconnect();
  }, [visualOpen]);

  const filteredTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeTree;
	    return {
	      ...activeTree,
	      types: activeTree.types
	        .map((type) => ({
	          ...type,
	          units: type.units.filter((unit) => getUnitNo(unit).toLowerCase().includes(q) || type.type.toLowerCase().includes(q)),
	        }))
	        .filter((type) => type.units.length > 0),
	    };
	  }, [activeTree, query]);

  const columns = s3Response.columns || [];
  const rows = searched ? s3Response.rows : [];
  const numericColumns = columns.filter((column) => column.type === 'number');
  const timestampField = getTimestampField(columns);
  const selectedDeviceIds = useMemo(() => {
    const selected = new Set(selectedUnits);
    return [...new Set(flattenDistrictDevices(activeTree)
      .filter((item) => selected.has(item.unit) && item.deviceId)
      .map((item) => item.deviceId))]
      .sort();
  }, [activeTree, selectedUnits]);

  // Auto-deteksi field lat/lon/speed dari nama (as-is) sebagai default; user bisa override.
  const pickKey = (list, ...patterns) => {
    for (const re of patterns) {
      const hit = list.find((column) => re.test(column.key));
      if (hit) return hit.key;
    }
    return '';
  };
  const autoLat = pickKey(columns, /^(gpslat|latitude|lat)$/i, /lat/i);
  const autoLon = pickKey(columns, /^(gpslong|gpslon|longitude|lng|lon)$/i, /lon|lng/i);
  const autoSpeed = pickKey(numericColumns, /^(gpsspeed|speed)$/i, /speed/i);
  const hasKey = (key) => Boolean(key) && columns.some((column) => column.key === key);
  const effLat = hasKey(latField) ? latField : autoLat;
  const effLon = hasKey(lonField) ? lonField : autoLon;
  const effSpeed = hasKey(speedField) ? speedField : autoSpeed;
  const effChartX = hasKey(chartXField) ? chartXField : timestampField;

  const filteredRows = rows;
  const totalPages = Math.max(1, Math.ceil((s3Response.totalRows || 0) / pageSize));
  const pagedRows = rows;
  const virtualStart = Math.min(
    pagedRows.length,
    Math.max(0, Math.floor(tableScrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN_ROWS),
  );
  const virtualCount = Math.ceil(tableViewportHeight / TABLE_ROW_HEIGHT) + TABLE_OVERSCAN_ROWS * 2;
  const virtualEnd = Math.min(pagedRows.length, virtualStart + virtualCount);
  const virtualRows = pagedRows.slice(virtualStart, virtualEnd);
  const topSpacerHeight = virtualStart * TABLE_ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (pagedRows.length - virtualEnd) * TABLE_ROW_HEIGHT);
  const visibleFields = visibleColumns.map((key) => columns.find((field) => field.key === key)).filter(Boolean);
  const activeChartMetrics = chartMetrics.filter((key) => numericColumns.some((column) => column.key === key));
  const chartColors = ['#059669', '#2563eb', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];
  const timeSeries = useMemo(() => {
    if (chartApiSeries.length > 0) {
      const byTs = new Map();
      chartApiSeries.forEach((series) => {
        (series.points || []).forEach((point) => {
          const ts = parseTimestampValue(point.ts);
          if (!Number.isFinite(ts)) return;
          if (!byTs.has(ts)) {
            byTs.set(ts, { ts, label: String(point.ts).slice(11, 16), values: {} });
          }
          byTs.get(ts).values[series.metric] = numericValue(point.value);
        });
      });
      return [...byTs.values()].sort((a, b) => a.ts - b.ts).slice(0, 5000);
    }
    return filteredRows
      .map((row) => ({
        ts: parseTimestampValue(effChartX ? row[effChartX] : row.creation_time),
        label: getDisplayTimestamp(row, effChartX || 'creation_time'),
        values: Object.fromEntries(activeChartMetrics.map((key) => [key, numericValue(row[key])])),
      }))
      .filter((point) => Number.isFinite(point.ts))
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 500);
  }, [activeChartMetrics, filteredRows, effChartX, chartApiSeries]);
  // Tiap metric dinormalisasi ke skalanya sendiri supaya field multi-satuan tetap terbaca.
  const metricRanges = useMemo(() => {
    const ranges = {};
    activeChartMetrics.forEach((key) => {
      let min = Infinity; let max = -Infinity;
      timeSeries.forEach((point) => {
        const value = point.values[key];
        if (Number.isFinite(value)) { if (value < min) min = value; if (value > max) max = value; }
      });
      if (!Number.isFinite(min)) { min = 0; max = 1; }
      if (min === max) { min -= 1; max += 1; }
      ranges[key] = { min, max };
    });
    return ranges;
  }, [activeChartMetrics, timeSeries]);
  const activeFilterLabel = activeFilterKey ? columns.find((field) => field.key === activeFilterKey)?.label : '';
  const mapTracks = useMemo(() => {
    if (mapApiTracks.length > 0) {
      return mapApiTracks.map((track) => ({
        unit: track.unitno || track.unitNo || track.device_id || 'Unknown',
        points: (track.path || []).map((point) => ({
          unit: track.unitno || track.unitNo || track.device_id || 'Unknown',
          position: [Number(point.lon), Number(point.lat)],
          ts: parseTimestampValue(point.ts),
          speed: numericValue(point.speed),
        })).filter((point) => Number.isFinite(point.position[0]) && Number.isFinite(point.position[1])),
      })).filter((track) => track.points.length > 0);
    }
    const byUnit = new Map();
    filteredRows.forEach((row) => {
      const lat = Number(row[effLat]);
      const lon = Number(row[effLon]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      if (lat === 0 && lon === 0) return;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
      const unit = getRowUnit(row);
      if (!byUnit.has(unit)) byUnit.set(unit, []);
      byUnit.get(unit).push({
        unit,
        position: [lon, lat],
        ts: parseTimestampValue(effChartX ? row[effChartX] : row.creation_time),
        speed: effSpeed ? numericValue(row[effSpeed]) : 0,
      });
    });
    return [...byUnit.entries()].map(([unit, points]) => ({
      unit,
      points: points.sort((a, b) => a.ts - b.ts),
    })).filter((track) => track.points.length > 0);
  }, [filteredRows, effLat, effLon, effSpeed, effChartX, mapApiTracks]);
  const speedMax = Math.max(1, ...mapTracks.flatMap((track) => track.points.map((point) => point.speed || 0)));
  const nativeSelectSx = { width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', px: 1, py: 0.8, color: '#334155', background: '#fff', fontSize: 13 };

  // Fit view ke bounding box data tiap map dibuka / field lat-lon berubah.
  useEffect(() => {
    if (!mapOpen) return;
    const pts = mapTracks.flatMap((track) => track.points.map((point) => point.position));
    if (pts.length === 0) return;
    let minLon = Infinity; let minLat = Infinity; let maxLon = -Infinity; let maxLat = -Infinity;
    pts.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    const span = Math.max(maxLon - minLon, maxLat - minLat, 0.0008);
    const zoom = Math.min(17, Math.max(10, Math.log2(360 / span) - 1));
    setMapViewState((view) => ({ ...view, longitude: (minLon + maxLon) / 2, latitude: (minLat + maxLat) / 2, zoom }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpen, effLat, effLon]);
  const mapLayers = useMemo(() => {
    const lineData = mapTracks.filter((track) => track.points.length > 1).map((track) => ({
      unit: track.unit,
      path: track.points.map((point) => point.position),
    }));
    const lastPoints = mapTracks.map((track) => track.points.at(-1)).filter(Boolean);
    const allPoints = mapTracks.flatMap((track) => track.points);
    return [
      new PathLayer({
        id: 'datalog-track-lines',
        data: lineData,
        getPath: (d) => d.path,
        getColor: [5, 150, 105, 220],
        widthMinPixels: 3,
      }),
      ...(showDotTrace ? [new ScatterplotLayer({
        id: 'datalog-dot-trace',
        data: allPoints,
        getPosition: (d) => d.position,
        getFillColor: (d) => speedColor(d.speed, speedMax),
        getLineColor: [255, 255, 255, 160],
        stroked: true,
        lineWidthMinPixels: 1,
        radiusUnits: 'pixels',
        getRadius: 3.5,
        radiusMinPixels: 3,
        updateTriggers: { getFillColor: [speedMax, effSpeed] },
      })] : []),
      new ScatterplotLayer({
        id: 'datalog-current-marker',
        data: lastPoints,
        getPosition: (d) => d.position,
        getFillColor: [5, 150, 105, 240],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 2,
        radiusUnits: 'pixels',
        getRadius: 8,
        radiusMinPixels: 8,
      }),
      new TextLayer({
        id: 'datalog-unit-labels',
        data: lastPoints,
        getPosition: (d) => d.position,
        getText: (d) => d.unit,
        getColor: [15, 23, 42, 255],
        getSize: 12,
        sizeUnits: 'pixels',
        getPixelOffset: [12, -10],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        background: true,
        getBackgroundColor: [255, 255, 255, 220],
        backgroundPadding: [5, 3],
      }),
    ];
  }, [mapTracks, showDotTrace, speedMax, effSpeed]);

  const toggleExpanded = (key) => setExpanded((state) => ({ ...state, [key]: !state[key] }));
  const toggleUnit = (unit) => {
    const unitNo = getUnitNo(unit);
    if (!unitNo || !isUnitAvailable(unit)) return;
    setSelectedUnits((state) => (state.includes(unitNo) ? state.filter((item) => item !== unitNo) : [...state, unitNo]));
    setPage(1);
  };
  const selectType = (units) => {
    const availableUnits = units.filter(isUnitAvailable).map(getUnitNo).filter(Boolean);
    if (availableUnits.length === 0) return;
    const allSelected = availableUnits.every((unit) => selectedUnits.includes(unit));
    setSelectedUnits((state) => {
      if (allSelected) return state.filter((unit) => !availableUnits.includes(unit));
      return [...new Set([...state, ...availableUnits])];
    });
  };
  const applySearchResponse = (response) => {
    const nextResponse = {
      columns: response.columns || [],
      rows: response.rows || [],
      totalRows: response.totalRows ?? response.rows?.length ?? 0,
      warnings: response.warnings || [],
    };
    setS3Response(nextResponse);
    setVisibleColumns((state) => {
      const nextKeys = new Set(nextResponse.columns.map((field) => field.key));
      const kept = state.filter((key) => nextKeys.has(key));
      return kept.length ? kept : defaultVisibleColumns(nextResponse.columns);
    });
    setApiMessage(nextResponse.warnings.length ? nextResponse.warnings.join(' · ') : '');
    setSearched(true);
  };
  // Server-side pagination: tiap halaman = 1 request. Backend (DuckDB) yang filter +
  // sort + dedup + potong per halaman, jadi browser cuma pegang satu halaman.
  const fetchPage = async (targetPage, targetSize = pageSize) => {
    if (datalogAbortRef.current) datalogAbortRef.current.abort();
    const controller = new AbortController();
    datalogAbortRef.current = controller;
    const { signal } = controller;
    const requestToken = ++datalogRequestTokenRef.current;
    const isNewV2Query = targetPage === 1;
    setLoadingSearch(true);
    setApiMessage('');
    setChartApiSeries([]);
    setMapApiTracks([]);
    cancelVisualRequests(isNewV2Query);
    try {
      if (!performanceV2.datalogEnabled) {
        if (isNewV2Query) {
          await deleteV2Query(v2QueryIdRef.current);
          setActiveV2QueryId(null);
          setV2Cursors({});
          setV2NextCursor(null);
        }
        const response = await requestJson('/search', {
          method: 'POST',
          signal,
          body: JSON.stringify({
            district,
            unitNos: selectedUnits,
            startDateTime: formatApiDate(from),
            endDateTime: formatApiDate(to),
            page: targetPage,
            pageSize: targetSize,
            filters: toBackendFilters(columnFilters),
          }),
        });
        if (requestToken !== datalogRequestTokenRef.current) return;
        applySearchResponse(response);
        setPage(targetPage);
        setActiveV2QueryId(null);
        return;
      }

      let queryId = v2QueryIdRef.current || v2QueryId;
      if (isNewV2Query || !queryId) {
        await deleteV2Query(v2QueryIdRef.current);
        setActiveV2QueryId(null);
        setV2Cursors({});
        setV2NextCursor(null);
        const created = await requestV2Json('/queries', {
          method: 'POST',
          signal,
          body: JSON.stringify({
            district,
            deviceIds: selectedDeviceIds,
            startDateTime: formatV2Date(from),
            endDateTime: formatV2Date(to),
            pageSize: targetSize,
            filters: toBackendFilters(columnFilters),
          }),
        });
        queryId = created.queryId;
        if (requestToken !== datalogRequestTokenRef.current) {
          void deleteV2Query(queryId);
          return;
        }
        setActiveV2QueryId(queryId);
        setV2Cursors({});
        setV2NextCursor(null);
      }
      const cursor = targetPage <= 1 ? '' : v2Cursors[targetPage] || v2NextCursor || '';
      const params = new URLSearchParams({ limit: String(targetSize) });
      if (cursor) params.set('cursor', cursor);
      const response = await requestV2Json(`/queries/${queryId}/rows?${params.toString()}`, {
        signal,
      });
      if (requestToken !== datalogRequestTokenRef.current) return;
      if (response.nextCursor) {
        setV2Cursors((state) => ({ ...state, [targetPage + 1]: response.nextCursor }));
        setV2NextCursor(response.nextCursor);
      } else {
        setV2NextCursor(null);
      }
      applySearchResponse(response);
      setPage(targetPage);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setS3Response({ columns: [], rows: [], totalRows: 0, warnings: [] });
      setVisibleColumns([]);
      setSearched(true);
      setApiMessage(`Gagal memuat datalog: ${error.message}`);
    } finally {
      if (requestToken === datalogRequestTokenRef.current) setLoadingSearch(false);
    }
  };
  const runSearch = () => {
    return fetchPage(1);
  };

  const loadChart = async () => {
    setVisualOpen(true);
    const queryId = v2QueryIdRef.current || v2QueryId;
    if (!queryId || activeChartMetrics.length === 0) return;
    if (chartAbortRef.current) chartAbortRef.current.abort();
    const controller = new AbortController();
    chartAbortRef.current = controller;
    const { signal } = controller;
    const requestToken = ++chartRequestTokenRef.current;
    setLoadingChart(true);
    try {
      const response = await requestV2Json(`/queries/${queryId}/chart`, {
        method: 'POST',
        signal,
        body: JSON.stringify({
          timestampField: effChartX || 'timestampiso',
          metrics: activeChartMetrics,
          pointBudget: Math.min(5000, Math.max(2000, Math.ceil(chartWidth * 2))),
        }),
      });
      if (requestToken !== chartRequestTokenRef.current) return;
      setChartApiSeries(response.series || []);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setApiMessage(`Gagal memuat chart V2: ${error.message}`);
    } finally {
      if (requestToken === chartRequestTokenRef.current) setLoadingChart(false);
    }
  };

  const loadMap = async () => {
    setMapOpen(true);
    const queryId = v2QueryIdRef.current || v2QueryId;
    if (!queryId) return;
    if (mapAbortRef.current) mapAbortRef.current.abort();
    const controller = new AbortController();
    mapAbortRef.current = controller;
    const { signal } = controller;
    const requestToken = ++mapRequestTokenRef.current;
    setLoadingMap(true);
    try {
      const response = await requestV2Json(`/queries/${queryId}/map`, {
        method: 'POST',
        signal,
        body: JSON.stringify({ includeDotTrace: showDotTrace }),
      });
      if (requestToken !== mapRequestTokenRef.current) return;
      setMapApiTracks(response.tracks || []);
      if (response.truncated) {
        setApiMessage(`Map V2 menampilkan preview ${response.retainedPoints || 0}/${response.totalPoints || 0} titik.`);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      setApiMessage(`Gagal memuat map V2: ${error.message}`);
    } finally {
      if (requestToken === mapRequestTokenRef.current) setLoadingMap(false);
    }
  };

  const exportXlsx = async () => {
    if (exportAbortRef.current) exportAbortRef.current.abort();
    const previousExportId = activeExportIdRef.current;
    activeExportIdRef.current = null;
    void deleteV2Export(previousExportId);
    const controller = new AbortController();
    exportAbortRef.current = controller;
    const { signal } = controller;
    const requestToken = ++exportRequestTokenRef.current;
    setExporting(true);
    setApiMessage('');
    try {
      if (performanceV2.datalogEnabled) {
        let queryId = v2QueryIdRef.current || v2QueryId;
        if (!queryId) {
          const createdQuery = await requestV2Json('/queries', {
            method: 'POST',
            signal,
            body: JSON.stringify({
              district,
              deviceIds: selectedDeviceIds,
              startDateTime: formatV2Date(from),
              endDateTime: formatV2Date(to),
              pageSize,
              filters: toBackendFilters(columnFilters),
            }),
          });
          queryId = createdQuery.queryId;
          setActiveV2QueryId(queryId);
          setV2Cursors({});
          setV2NextCursor(null);
        }

        const createdExport = await requestV2Json(`/queries/${queryId}/exports`, {
          method: 'POST',
          signal,
          body: JSON.stringify({ format: 'csvzip', visibleFields: visibleColumns }),
        });
        activeExportIdRef.current = createdExport.exportId;
        let exportStatus = createdExport;
        for (let attempt = 0; attempt < 450 && exportStatus.state !== 'ready'; attempt += 1) {
          if (requestToken !== exportRequestTokenRef.current) return;
          if (['failed', 'cancelled', 'expired'].includes(exportStatus.state)) {
            throw new Error(exportStatus.message || `Export ${exportStatus.state}`);
          }
          setApiMessage(`Export V2 ${exportStatus.progress || 0}%`);
          await delay(2000, signal);
          exportStatus = await requestV2Json(`/exports/${createdExport.exportId}`, {
            signal,
          });
        }
        if (exportStatus.state !== 'ready') throw new Error('Export belum selesai dalam 15 menit.');
        if (requestToken !== exportRequestTokenRef.current) return;

        const response = await fetch(`${DATALOG_V2_API_BASE}/exports/${createdExport.exportId}?download=true`, {
          cache: 'no-store',
          signal,
        });
        if (!response.ok) {
          throw new Error(await readResponseMessage(response, `Export gagal (${response.status})`));
        }
        const blob = await response.blob();
        const fileName = contentDispositionFileName(
          response.headers.get('Content-Disposition'),
          exportStatus.fileName || `datalog_${district}.csv.zip`,
        );
        downloadBlob(blob, fileName);
        if (requestToken !== exportRequestTokenRef.current) return;
        setApiMessage(exportStatus.message || 'Export V2 selesai.');
        activeExportIdRef.current = null;
        return;
      }

      const response = await fetch(`${DATALOG_API_BASE}/export`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district,
          unitNos: selectedUnits,
          startDateTime: formatApiDate(from),
          endDateTime: formatApiDate(to),
          filters: toBackendFilters(columnFilters),
          visibleFields: visibleColumns,
        }),
      });
      if (!response.ok) {
        throw new Error(await readResponseMessage(response, `Export gagal (${response.status})`));
      }
      const blob = await response.blob();
      const fileName = contentDispositionFileName(response.headers.get('Content-Disposition'), `datalog_${district}.xlsx`);
      downloadBlob(blob, fileName);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setApiMessage(`Gagal export: ${error.message}`);
    } finally {
      if (requestToken === exportRequestTokenRef.current) setExporting(false);
    }
  };

  // Filter kolom berubah → muat ulang dari halaman 1 (filtering kini dikerjakan server).
  const skipFilterRefetch = useRef(true);
  useEffect(() => {
    if (skipFilterRefetch.current) { skipFilterRefetch.current = false; return; }
    if (searched) fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters]);
  const toggleColumn = (key) => {
    setVisibleColumns((state) => {
      const field = columns.find((item) => item.key === key);
      if (field?.fixed) return state;
      return state.includes(key) ? state.filter((item) => item !== key) : [...state, key];
    });
  };
  const openFieldFilter = (event, key) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - FILTER_POPOVER_WIDTH - 8),
    );
    setActiveFilterKey(key);
    setFilterDraft(normalizeColumnFilter(columnFilters[key]));
    setFilterPosition({ top: rect.bottom + 4, left });
  };
  const updateFilterDraftCondition = (index, patch) => {
    setFilterDraft((state) => {
      const next = normalizeColumnFilter(state);
      next.conditions = next.conditions.map((condition, conditionIndex) => (
        conditionIndex === index ? { ...condition, ...patch } : condition
      ));
      return next;
    });
  };
  const applyFilterDraft = () => {
    if (!activeFilterKey) return;
    setColumnFilters((state) => {
      const next = { ...state };
      if (hasActiveFilter(filterDraft)) next[activeFilterKey] = normalizeColumnFilter(filterDraft);
      else delete next[activeFilterKey];
      return next;
    });
    setFilterPosition(null);
    setActiveFilterKey(null);
    setPage(1);
  };
  const clearFilter = (key) => {
    setColumnFilters((state) => {
      const next = { ...state };
      delete next[key];
      return next;
    });
    setFilterDraft(normalizeColumnFilter());
    setPage(1);
  };
  const moveColumn = (key, delta) => {
    setVisibleColumns((state) => {
      const index = state.indexOf(key);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= state.length) return state;
      const copy = [...state];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };
  const toggleChartMetric = (key) => {
    setChartMetrics((state) => {
      if (state.includes(key)) {
        const next = state.filter((item) => item !== key);
        return next.length ? next : state;
      }
      return [...state, key];
    });
  };
	  const showAllColumns = () => setVisibleColumns(columns.map((column) => column.key));
	  const resetColumns = () => setVisibleColumns(defaultVisibleColumns(columns));
	  const allTreeUnits = flattenDistrictDevices(activeTree);
	  const availableTreeCount = allTreeUnits.filter((unit) => unit.available).length;

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 2 }}>
      <Box sx={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 1.25, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton size="small" title="Collapse all" onClick={() => setExpanded({})}>
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>
          <TextField
            size="small"
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Vehicle"
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          <Box
            onClick={() => toggleExpanded(activeTree.district)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.75, px: 0.5, cursor: 'pointer', fontWeight: 800 }}
          >
	            {expanded[activeTree.district] ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
	            {activeTree.district}
	            <Typography component="span" sx={{ color: '#64748b', fontSize: 12 }}>
	              ({availableTreeCount}/{allTreeUnits.length})
	            </Typography>
	          </Box>

          {loadingTree && (
            <Typography sx={{ px: 1, py: 2, color: '#64748b', fontSize: 13 }}>
              Memuat device dari backend...
            </Typography>
          )}
          {!loadingTree && activeTree.types.length === 0 && (
            <Typography sx={{ px: 1, py: 2, color: '#64748b', fontSize: 13 }}>
              Belum ada device untuk distrik ini.
            </Typography>
          )}
	          {expanded[activeTree.district] && filteredTree.types.map((type) => {
	            const availableUnits = type.units.filter(isUnitAvailable);
	            const selectedCount = availableUnits.filter((unit) => selectedUnits.includes(getUnitNo(unit))).length;
	            return (
	              <Box key={type.type}>
	                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.6, pl: 2, pr: 0.5 }}>
	                  <Box onClick={() => toggleExpanded(type.type)} sx={{ cursor: 'pointer', display: 'flex' }}>
	                    {expanded[type.type] ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
	                  </Box>
	                  <Checkbox
	                    size="small"
	                    checked={selectedCount === availableUnits.length && availableUnits.length > 0}
	                    indeterminate={selectedCount > 0 && selectedCount < availableUnits.length}
	                    disabled={availableUnits.length === 0}
	                    onChange={() => selectType(type.units)}
	                  />
	                  <Typography sx={{ fontWeight: 800, flex: 1 }}>{type.type}</Typography>
	                  <Typography sx={{ fontSize: 12, color: '#64748b' }}>({availableUnits.length}/{type.units.length}|{selectedCount})</Typography>
	                </Box>
	                {expanded[type.type] && type.units.map((unit) => {
	                  const unitNo = getUnitNo(unit);
	                  const available = isUnitAvailable(unit);
	                  const checked = selectedUnits.includes(unitNo);
	                  return (
	                    <Box
	                      key={unitNo}
	                      onClick={() => toggleUnit(unit)}
	                      sx={{
	                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
	                        py: 0.75,
	                        pl: 6,
	                        pr: 1,
	                        cursor: available ? 'pointer' : 'not-allowed',
	                        opacity: available ? 1 : 0.48,
	                        background: checked ? '#bfdbfe' : 'transparent',
	                        '&:hover': { background: checked ? '#bfdbfe' : (available ? '#f1f5f9' : 'transparent') },
	                      }}
	                    >
	                      <Checkbox size="small" checked={checked} disabled={!available} />
	                      <Typography sx={{ fontWeight: checked ? 700 : 500, flex: 1 }}>{unitNo}</Typography>
	                      <Typography sx={{ fontSize: 11, color: available ? '#059669' : '#94a3b8' }}>
	                        {available ? `${getUnitFileCount(unit)} file` : 'no data'}
	                      </Typography>
	                    </Box>
	                  );
	                })}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, color: '#475569' }}>Date Range</Typography>
          <DateRangeFilter from={from} to={to} onChange={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); }} />
	          <Button variant="contained" onClick={runSearch} disabled={selectedUnits.length === 0 || loadingSearch} sx={{ px: 4, background: '#059669', '&:hover': { background: '#047857' } }}>
	            {loadingSearch ? 'Loading...' : 'Search'}
	          </Button>
	          <Typography sx={{ ml: 'auto', color: '#64748b', fontSize: 12 }}>
	            {selectedUnits.length} selected · {availableTreeCount}/{allTreeUnits.length} units available for range
	          </Typography>
        </Box>
        {apiMessage && (
          <Box sx={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: '6px', px: 1.25, py: 0.85, fontSize: 12 }}>
            {apiMessage}
          </Box>
        )}

        <Box sx={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={loadChart}
              disabled={filteredRows.length === 0}
              sx={{ borderColor: '#059669', color: '#047857', fontWeight: 700 }}
            >
              {loadingChart ? 'Loading Chart...' : 'Chart'}
            </Button>
            <Button
              variant="outlined"
              onClick={loadMap}
              disabled={filteredRows.length === 0}
              sx={{ borderColor: '#2563eb', color: '#1d4ed8', fontWeight: 700 }}
            >
              {loadingMap ? 'Loading Map...' : 'Maps'}
            </Button>
            <Button
              variant="outlined"
              onClick={exportXlsx}
              disabled={selectedUnits.length === 0 || exporting || loadingSearch}
              sx={{ borderColor: '#0f766e', color: '#0f766e', fontWeight: 700 }}
            >
              {exporting ? 'Exporting...' : 'Export XLSX'}
            </Button>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton title="Column filtering" onClick={(event) => setColumnAnchor(event.currentTarget)}>
                <FilterListIcon />
              </IconButton>
            </Box>
          </Box>

          <Box
            ref={tableScrollRef}
            onScroll={(event) => setTableScrollTop(event.currentTarget.scrollTop)}
            sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
          >
            <Box component="table" sx={{ width: '100%', minWidth: Math.max(980, visibleFields.length * 155), borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <Box component="th" sx={{ position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', width: 72, p: 1.25, color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>No.</Box>
                  {visibleFields.map((field) => (
                    <Box key={field.key} component="th" sx={{ position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', p: 1.25, color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <span>{field.label}</span>
                        <IconButton
	                          size="small"
	                          title={`Filter ${field.label}`}
	                          onClick={(event) => openFieldFilter(event, field.key)}
	                          sx={{
	                            width: 24,
	                            height: 24,
	                            color: hasActiveFilter(columnFilters[field.key]) ? '#059669' : '#94a3b8',
	                            background: hasActiveFilter(columnFilters[field.key]) ? '#ecfdf5' : 'transparent',
	                          }}
	                        >
                          <FilterListIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topSpacerHeight > 0 && (
                  <tr aria-hidden="true">
                    <Box component="td" colSpan={visibleFields.length + 1} sx={{ height: topSpacerHeight, p: 0, border: 0 }} />
                  </tr>
                )}
                {virtualRows.map((row, virtualIndex) => {
                  const rowIndex = virtualStart + virtualIndex;
                  return (
                  <Box component="tr" key={row.id || `${page}-${rowIndex}`} sx={{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc', '&:hover': { background: '#eef6ff' }, ...virtualRowSx(TABLE_ROW_HEIGHT) }}>
                    <Box component="td" sx={{ p: 1.25, borderBottom: '1px solid #edf2f7', color: '#475569' }}>{(page - 1) * pageSize + rowIndex + 1}</Box>
                    {visibleFields.map((field) => (
                      <Box key={field.key} component="td" sx={{ p: 1.25, borderBottom: '1px solid #edf2f7', color: '#334155', whiteSpace: 'nowrap' }}>
                        {row[field.key]}
                      </Box>
                    ))}
                  </Box>
                  );
                })}
                {bottomSpacerHeight > 0 && (
                  <tr aria-hidden="true">
                    <Box component="td" colSpan={visibleFields.length + 1} sx={{ height: bottomSpacerHeight, p: 0, border: 0 }} />
                  </tr>
                )}
                {pagedRows.length === 0 && (
                  <tr>
                    <Box component="td" colSpan={visibleFields.length + 1} sx={{ p: 5, textAlign: 'center', color: '#64748b' }}>
                      Pilih unit, atur date range, lalu klik Search untuk memuat datalog dari backend.
                    </Box>
                  </tr>
                )}
              </tbody>
            </Box>
          </Box>

          <Box sx={{ flex: '0 0 auto', p: 1.25, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ color: '#64748b', fontSize: 13 }}>Total {s3Response.totalRows || 0}</Typography>
            <Box
              component="select"
              value={pageSize}
              onChange={(event) => { const next = Number(event.target.value); setPageSize(next); if (searched) fetchPage(1, next); }}
              sx={{ width: 120, border: '1px solid #cbd5e1', borderRadius: '6px', px: 1, py: 0.8, color: '#334155', background: '#fff' }}
            >
              {[500, 1000].map((size) => <option key={size} value={size}>{size}/page</option>)}
            </Box>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button size="small" disabled={page <= 1 || loadingSearch} onClick={() => fetchPage(page - 1)}>Prev</Button>
              <Typography sx={{ fontSize: 13, color: '#334155' }}>{page} / {totalPages}</Typography>
              <Button size="small" disabled={page >= totalPages || loadingSearch} onClick={() => fetchPage(page + 1)}>Next</Button>
            </Box>
          </Box>
        </Box>
      </Box>

      <Popover
        open={Boolean(filterPosition && activeFilterKey)}
        anchorReference="anchorPosition"
        anchorPosition={filterPosition || { top: 0, left: 0 }}
        onClose={() => { setFilterPosition(null); setActiveFilterKey(null); }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
	        slotProps={{
	          paper: {
	            sx: {
	              width: FILTER_POPOVER_WIDTH,
	              borderRadius: '8px',
	              border: '1px solid #9ca3af',
	              boxShadow: '0 4px 12px rgba(15,23,42,.22)',
	              p: 1.25,
	            },
	          },
	        }}
	      >
	        {activeFilterKey && (
	          <Box>
	            <Typography sx={{ fontSize: 14, color: '#666', mb: 0.8 }}>
	              Show items with value that:
	            </Typography>
	            <Typography sx={{ fontSize: 11, color: '#94a3b8', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
	              {activeFilterLabel}
	            </Typography>
	            {[0, 1].map((index) => (
	              <React.Fragment key={index}>
	                {index === 1 && (
	                  <Box
	                    component="select"
	                    value={filterDraft.logic}
	                    onChange={(event) => setFilterDraft((state) => ({ ...normalizeColumnFilter(state), logic: event.target.value }))}
	                    sx={{
	                      width: 145,
	                      border: '1px solid #c7c7c7',
	                      borderRadius: '9px',
	                      px: 1,
	                      py: 0.8,
	                      mb: 1,
	                      color: '#666',
	                      background: '#f7f7f7',
	                      fontSize: 14,
	                      outline: 'none',
	                    }}
	                  >
	                    <option value="and">And</option>
	                    <option value="or">Or</option>
	                  </Box>
	                )}
	                <Box
	                  component="select"
	                  value={filterDraft.conditions[index]?.op || EMPTY_FILTER_CONDITION.op}
	                  onChange={(event) => updateFilterDraftCondition(index, { op: event.target.value })}
	                  sx={{
	                    width: '100%',
	                    border: '1px solid #c7c7c7',
	                    borderRadius: '9px',
	                    px: 1,
	                    py: 0.9,
	                    mb: 0.8,
	                    color: '#666',
	                    background: '#f7f7f7',
	                    fontSize: 14,
	                    outline: 'none',
	                  }}
	                >
	                  {FILTER_OPERATORS.map((operator) => (
	                    <option key={operator.value} value={operator.value}>{operator.label}</option>
	                  ))}
	                </Box>
	                <TextField
	                  size="small"
	                  fullWidth
	                  value={filterDraft.conditions[index]?.value || ''}
	                  onChange={(event) => updateFilterDraftCondition(index, { value: event.target.value })}
	                  inputProps={{ 'aria-label': `${activeFilterLabel} filter value ${index + 1}` }}
	                  sx={{
	                    mb: index === 0 ? 1 : 1.2,
	                    '& .MuiOutlinedInput-root': {
	                      borderRadius: '9px',
	                      background: '#fff',
	                    },
	                  }}
	                />
	              </React.Fragment>
	            ))}
	            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
	              <Button
	                variant="outlined"
	                onClick={() => clearFilter(activeFilterKey)}
	                sx={{ borderColor: '#c7c7c7', color: '#666', borderRadius: '9px', textTransform: 'none' }}
	              >
	                Clear
	              </Button>
	              <Button
	                variant="outlined"
	                onClick={applyFilterDraft}
	                sx={{ borderColor: '#c7c7c7', color: '#666', borderRadius: '9px', textTransform: 'none' }}
	              >
	                Filter
	              </Button>
	            </Box>
	          </Box>
	        )}
      </Popover>

      <Dialog open={Boolean(columnAnchor)} onClose={() => setColumnAnchor(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
          Column Filtering
          <IconButton onClick={() => setColumnAnchor(null)} sx={{ ml: 'auto' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
            <Button variant="contained" onClick={showAllColumns} sx={{ background: '#059669', '&:hover': { background: '#047857' } }}>
              Show all
            </Button>
            <Button variant="outlined" onClick={resetColumns} sx={{ borderColor: '#059669', color: '#047857' }}>
              Reset default
            </Button>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontSize: 13, mb: 0.5 }}>
            <span>Column Filtering</span>
            <span>Fixed | Hide | Move</span>
          </Box>
          <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
            {columns.map((field) => {
              const checked = visibleColumns.includes(field.key);
              return (
                <Box key={field.key} sx={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto auto', alignItems: 'center', gap: 0.5, py: 0.35 }}>
                  <Checkbox size="small" checked={checked} disabled={field.fixed} onChange={() => toggleColumn(field.key)} />
                  <Typography sx={{ color: checked ? '#0f766e' : '#64748b', fontSize: 13, fontWeight: checked ? 600 : 400 }}>{field.label}</Typography>
                  {field.fixed ? <CheckBoxIcon titleAccess="Fixed column" sx={{ color: '#059669', fontSize: 20 }} /> : (
                    <IconButton size="small" onClick={() => moveColumn(field.key, -1)} disabled={!checked}><KeyboardArrowRightIcon sx={{ transform: 'rotate(180deg)' }} /></IconButton>
                  )}
                  <IconButton size="small" onClick={() => toggleColumn(field.key)} disabled={field.fixed}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => moveColumn(field.key, 1)} disabled={!checked}>
                    <DragIndicatorIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={visualOpen} onClose={() => setVisualOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #e2e8f0' }}>
          Time Series Visualization
          <IconButton onClick={() => setVisualOpen(false)} sx={{ ml: 'auto' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 1.5, mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#64748b', mb: 0.75 }}>Metric fields (Y)</Typography>
              <Box sx={{ border: '1px solid #cbd5e1', borderRadius: '6px', maxHeight: 200, overflow: 'auto', background: '#fff' }}>
                {numericColumns.map((column) => (
                  <Box
                    key={column.key}
                    onClick={() => toggleChartMetric(column.key)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, cursor: 'pointer', '&:hover': { background: '#f8fafc' } }}
                  >
                    <Checkbox size="small" checked={activeChartMetrics.includes(column.key)} />
                    <Typography sx={{ fontSize: 13 }}>{column.key}</Typography>
                  </Box>
                ))}
                {numericColumns.length === 0 && (
                  <Typography sx={{ p: 1, fontSize: 12, color: '#94a3b8' }}>Tidak ada field numerik.</Typography>
                )}
              </Box>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#64748b', mb: 0.75 }}>X-axis (time) field</Typography>
              <Box component="select" value={effChartX || ''} onChange={(event) => setChartXField(event.target.value)} sx={nativeSelectSx}>
                {columns.map((column) => <option key={column.key} value={column.key}>{column.key}</option>)}
              </Box>
              <Typography sx={{ mt: 1.25, color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>
                Tiap metric dinormalisasi ke skalanya sendiri (0–100%) supaya field beda satuan tetap terbaca dalam satu chart. Range asli ada di legend. Chart memakai data HALAMAN AKTIF saja (maks 500 titik); untuk seluruh range gunakan pagination tabel.
              </Typography>
            </Box>
          </Box>

          <Box ref={chartWrapRef} sx={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: '6px', p: 2, background: '#fff' }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
              {activeChartMetrics.map((key, index) => {
                const range = metricRanges[key] || { min: 0, max: 1 };
                return (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, color: '#475569' }}>
                    <Box sx={{ width: 14, height: 3, background: chartColors[index % chartColors.length], borderRadius: '2px' }} />
                    <b>{key}</b>
                    <span style={{ color: '#94a3b8' }}>[{range.min.toLocaleString()} – {range.max.toLocaleString()}]</span>
                  </Box>
                );
              })}
              {activeChartMetrics.length === 0 && (
                <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Pilih minimal satu metric field di kiri.</Typography>
              )}
            </Box>

            {timeSeries.length > 0 && activeChartMetrics.length > 0 ? (() => {
              const W = chartWidth || 900;
              const H = 300;
              const padL = 44; const padR = 16; const padT = 12; const padB = 30;
              const iw = Math.max(10, W - padL - padR);
              const ih = H - padT - padB;
              const n = timeSeries.length;
              const xAt = (i) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
              const yAt = (key, v) => {
                const range = metricRanges[key] || { min: 0, max: 1 };
                const t = (v - range.min) / ((range.max - range.min) || 1);
                return padT + (1 - Math.max(0, Math.min(1, t))) * ih;
              };
              const gridFracs = [0, 0.25, 0.5, 0.75, 1];
              const tickCount = Math.min(7, n);
              const xTickIdx = Array.from({ length: tickCount }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, tickCount - 1)));
              const hover = (chartHover != null && chartHover >= 0 && chartHover < n) ? chartHover : null;
              const onMove = (event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const idx = n <= 1 ? 0 : Math.round(((x - padL) / iw) * (n - 1));
                setChartHover(Math.max(0, Math.min(n - 1, idx)));
              };
              return (
                <Box sx={{ position: 'relative' }}>
                  <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }} onMouseMove={onMove} onMouseLeave={() => setChartHover(null)}>
                    {gridFracs.map((f) => {
                      const y = padT + f * ih;
                      return (
                        <g key={f}>
                          <line x1={padL} y1={y} x2={padL + iw} y2={y} stroke="#eef2f7" strokeWidth="1" />
                          <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round((1 - f) * 100)}%</text>
                        </g>
                      );
                    })}
                    <line x1={padL} y1={padT} x2={padL} y2={padT + ih} stroke="#cbd5e1" />
                    <line x1={padL} y1={padT + ih} x2={padL + iw} y2={padT + ih} stroke="#cbd5e1" />
                    {xTickIdx.map((i, k) => (
                      <text key={k} x={xAt(i)} y={padT + ih + 16} textAnchor="middle" fontSize="10" fill="#64748b">{timeSeries[i]?.label}</text>
                    ))}
                    {activeChartMetrics.map((key, mi) => (
                      <polyline
                        key={key}
                        fill="none"
                        stroke={chartColors[mi % chartColors.length]}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={timeSeries.map((p, i) => `${xAt(i)},${yAt(key, p.values[key] || 0)}`).join(' ')}
                      />
                    ))}
                    {hover != null && (
                      <g>
                        <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + ih} stroke="#94a3b8" strokeDasharray="4 3" />
                        {activeChartMetrics.map((key, mi) => (
                          <circle key={key} cx={xAt(hover)} cy={yAt(key, timeSeries[hover].values[key] || 0)} r="3.5" fill={chartColors[mi % chartColors.length]} stroke="#fff" strokeWidth="1.5" />
                        ))}
                      </g>
                    )}
                  </svg>
                  {hover != null && (
                    <Box sx={{ position: 'absolute', top: 8, left: Math.min(W - 180, Math.max(0, xAt(hover) + 8)), pointerEvents: 'none', background: 'rgba(15,23,42,.92)', color: '#fff', borderRadius: '6px', px: 1.25, py: 0.75, fontSize: 11, minWidth: 140 }}>
                      <Box sx={{ color: '#cbd5e1', mb: 0.5 }}>{timeSeries[hover].label}</Box>
                      {activeChartMetrics.map((key, mi) => (
                        <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                          <span style={{ color: chartColors[mi % chartColors.length] }}>{key}</span>
                          <span>{(timeSeries[hover].values[key] ?? 0).toLocaleString()}</span>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })() : (
              <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
                {activeChartMetrics.length === 0 ? 'Pilih metric field untuk menampilkan chart.' : 'Tidak ada data untuk ditampilkan.'}
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={mapOpen} onClose={() => setMapOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #e2e8f0' }}>
          Datalog Track Maps
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              component="label"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: '#475569', cursor: 'pointer' }}
            >
              <Checkbox size="small" checked={showDotTrace} onChange={(event) => setShowDotTrace(event.target.checked)} />
              Dot trace
            </Box>
            <IconButton onClick={() => setMapOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '72vh', position: 'relative' }}>
          <MapContainer
            layerState={MAP_LAYER_STATE}
            district={district}
            basemap="satellite"
            liveUnitData={[]}
            liveTrailsData={[]}
            viewState={mapViewState}
            onViewStateChange={(event) => setMapViewState(event.viewState)}
            replayLayers={mapLayers}
          />
          <Box sx={{ position: 'absolute', left: 16, top: 16, zIndex: 5, background: 'rgba(255,255,255,.92)', border: '1px solid #e2e8f0', borderRadius: '6px', px: 1.25, py: 0.8, fontSize: 12, color: '#334155' }}>
            {mapTracks.length} unit · {mapTracks.reduce((sum, track) => sum + track.points.length, 0)} GPS rows
          </Box>

          <Box sx={{ position: 'absolute', right: 16, top: 16, zIndex: 5, width: 210, background: 'rgba(255,255,255,.96)', border: '1px solid #e2e8f0', borderRadius: '8px', p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>Field mapping</Typography>
            <Box>
              <Typography sx={{ fontSize: 11, color: '#64748b', mb: 0.25 }}>Latitude</Typography>
              <Box component="select" value={effLat || ''} onChange={(event) => setLatField(event.target.value)} sx={nativeSelectSx}>
                <option value="">(auto: {autoLat || 'none'})</option>
                {columns.map((column) => <option key={column.key} value={column.key}>{column.key}</option>)}
              </Box>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: '#64748b', mb: 0.25 }}>Longitude</Typography>
              <Box component="select" value={effLon || ''} onChange={(event) => setLonField(event.target.value)} sx={nativeSelectSx}>
                <option value="">(auto: {autoLon || 'none'})</option>
                {columns.map((column) => <option key={column.key} value={column.key}>{column.key}</option>)}
              </Box>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: '#64748b', mb: 0.25 }}>Speed (color)</Typography>
              <Box component="select" value={effSpeed || ''} onChange={(event) => setSpeedField(event.target.value)} sx={nativeSelectSx}>
                <option value="">(none)</option>
                {numericColumns.map((column) => <option key={column.key} value={column.key}>{column.key}</option>)}
              </Box>
            </Box>
            {showDotTrace && effSpeed && (
              <Box sx={{ mt: 0.5 }}>
                <Box sx={{ height: 8, borderRadius: '4px', background: 'linear-gradient(90deg, rgb(0,40,255), rgb(40,240,40), rgb(255,40,0))' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', mt: 0.25 }}>
                  <span>0</span>
                  <span>{speedMax.toLocaleString()}</span>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
