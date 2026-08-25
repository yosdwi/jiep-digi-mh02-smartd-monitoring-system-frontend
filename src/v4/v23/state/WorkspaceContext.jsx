import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { loadFixture } from "../data/demoFixture";
import {
  buildPerformance,
  buildTrend,
  deriveKpis,
  displayRange,
  generateSpeedDraft,
  parseWita,
  toLocalInput,
  traceRows,
} from "../utils/workspace";

const WorkspaceContext = createContext(null);

function nowFixtureRange(fixture) {
  const timestamps = fixture?.traces?.flatMap((trace) => [trace?.[0]?.[0], trace?.[0]?.at(-1)]).filter(Number.isFinite) ?? [];
  const min = timestamps.length ? Math.min(...timestamps) : Date.parse("2026-08-22T00:00:00+08:00");
  const max = timestamps.length ? Math.max(...timestamps) : min + 12 * 3600000;
  return { start: toLocalInput(min), end: toLocalInput(max) };
}

const initialState = {
  boot: { loading: true, error: null, text: "Membaca fixture BRCB dan layer peta." },
  fixture: null,
  mode: "cycle",
  draftFilters: { start: "", end: "", source: "miforce", loaders: [], units: [], interval: 2 },
  appliedFilters: { start: "", end: "", source: "miforce", loaders: [], units: [], interval: 2 },
  initialFilters: null,
  popover: null,
  timeMode: "quick",
  filterDirty: false,
  selectedRows: [],
  gridSearch: "",
  dock: { state: "half", tab: "performance", height: 36 },
  layers: { trace: true, loading: true, boundary: true, roads: true, ortho: true },
  mapTool: "pan",
  tilt: 0,
  analysisWindow: null,
  trendMetrics: ["ritase", "cycle"],
  trendHover: null,
  exportOpen: false,
  exportProgress: false,
  playback: { active: false, playing: false, speed: 10, progress: 0, focusedUnit: null },
  speed: {
    draft: null,
    active: null,
    history: [],
    selectedSegments: [],
    groupBy: "none",
    modal: null,
    editPlanValue: 0,
    roadName: "",
    targetLength: 100,
    notice: "",
    draftHealthOpen: false,
  },
  gis: {
    dirty: false,
    selectedSegments: [],
    search: "",
    tool: "pan",
    compareOpen: false,
    inspectorOpen: false,
    layers: { trace: true, loading: true, loader: true, roads: true, boundary: false, ortho: false },
    undo: [],
    redo: [],
    catalogLayer: "speed_corridor",
  },
  duration: {
    threshold: 15,
    areaQuery: "",
    selectedAreas: [],
    selectedEvents: [],
    selectedUnits: [],
    dockTab: "occupancy",
    selectedEvent: null,
  },
  datalog: {
    selectedUnits: [],
    expanded: ["BRCB"],
    groupBy: "unitType",
    treeSearch: "",
    query: "",
    view: "table",
    loaded: false,
    rows: [],
    columnPanel: false,
    columnSearch: "",
    visibleColumns: ["timestampiso", "district", "unitno", "unittype", "deviceid", "gpslat", "gpslong", "gpsspeed", "plmstatus", "statusname"],
    chartMetric: "gpsspeed",
    mapFields: { lat: "gpslat", lon: "gpslong", speed: "gpsspeed", dotTrace: true },
  },
  survey: {
    modalOpen: false,
    fileName: "",
    headers: [],
    rows: [],
    roles: [],
    error: "",
    visible: true,
    coordinates: [],
  },
};

function reducer(state, action) {
  switch (action.type) {
    case "BOOT_SUCCESS": {
      const range = nowFixtureRange(action.fixture);
      const units = action.fixture.unitNos ?? [];
      const filters = { start: range.start, end: range.end, source: "miforce", loaders: [], units, interval: 2 };
      return {
        ...state,
        fixture: action.fixture,
        boot: { loading: false, error: null, text: "" },
        draftFilters: filters,
        appliedFilters: filters,
        initialFilters: filters,
        datalog: { ...state.datalog, selectedUnits: units },
      };
    }
    case "BOOT_ERROR":
      return { ...state, boot: { loading: false, error: action.error, text: String(action.error?.message ?? action.error) } };
    case "SET_MODE":
      return { ...state, mode: action.mode, popover: null };
    case "SET_POPOVER":
      return { ...state, popover: state.popover === action.name ? null : action.name };
    case "CLOSE_POPOVERS":
      return { ...state, popover: null };
    case "SET_TIME_MODE":
      return { ...state, timeMode: action.value };
    case "PATCH_DRAFT_FILTERS": {
      const draftFilters = { ...state.draftFilters, ...action.patch };
      return { ...state, draftFilters, filterDirty: JSON.stringify(draftFilters) !== JSON.stringify(state.appliedFilters) };
    }
    case "APPLY_FILTERS": {
      const appliedFilters = { ...state.draftFilters, units: [...state.draftFilters.units], loaders: [...state.draftFilters.loaders] };
      return {
        ...state,
        appliedFilters,
        filterDirty: false,
        selectedRows: [],
        analysisWindow: null,
        survey: { ...state.survey, coordinates: [], fileName: "", headers: [], rows: [], roles: [] },
        datalog: { ...state.datalog, loaded: false, rows: [], selectedUnits: appliedFilters.units },
      };
    }
    case "RESET_FILTERS":
      return state.initialFilters
        ? {
            ...state,
            draftFilters: { ...state.initialFilters, units: [...state.initialFilters.units], loaders: [...state.initialFilters.loaders] },
            appliedFilters: { ...state.initialFilters, units: [...state.initialFilters.units], loaders: [...state.initialFilters.loaders] },
            filterDirty: false,
            selectedRows: [],
            analysisWindow: null,
            datalog: { ...state.datalog, loaded: false, rows: [], selectedUnits: [...state.initialFilters.units] },
          }
        : state;
    case "SET_SELECTED_ROWS":
      return { ...state, selectedRows: action.value };
    case "SET_GRID_SEARCH":
      return { ...state, gridSearch: action.value };
    case "SET_DOCK":
      return { ...state, dock: { ...state.dock, ...action.patch } };
    case "SET_LAYER":
      return { ...state, layers: { ...state.layers, [action.key]: action.value } };
    case "SET_MAP_TOOL":
      return { ...state, mapTool: action.tool };
    case "SET_TILT":
      return { ...state, tilt: action.value };
    case "SET_ANALYSIS_WINDOW":
      return { ...state, analysisWindow: action.value };
    case "TOGGLE_TREND_METRIC": {
      const exists = state.trendMetrics.includes(action.metric);
      const next = exists ? state.trendMetrics.filter((item) => item !== action.metric) : [...state.trendMetrics, action.metric];
      return { ...state, trendMetrics: next.length ? next : [action.metric] };
    }
    case "SET_EXPORT_OPEN":
      return { ...state, exportOpen: action.value, exportProgress: false };
    case "SET_EXPORT_PROGRESS":
      return { ...state, exportProgress: action.value };
    case "START_PLAYBACK": {
      const units = action.units?.length ? action.units : state.appliedFilters.units;
      return {
        ...state,
        dock: { ...state.dock, state: "collapsed", height: 46 },
        playback: { ...state.playback, active: true, playing: true, progress: 0, focusedUnit: units[0] ?? null },
      };
    }
    case "PATCH_PLAYBACK":
      return { ...state, playback: { ...state.playback, ...action.patch } };
    case "CLOSE_PLAYBACK":
      return { ...state, playback: { ...initialState.playback }, dock: { ...state.dock, state: "half", height: 36 } };
    case "SET_SPEED_DRAFT":
      return {
        ...state,
        mode: "speed",
        speed: { ...state.speed, draft: action.draft, selectedSegments: [], modal: null, notice: `Auto Suggest selesai · ${action.draft.segments.length} segment.` },
      };
    case "PATCH_SPEED":
      return { ...state, speed: { ...state.speed, ...action.patch } };
    case "TOGGLE_SPEED_SEGMENT": {
      const current = new Set(state.speed.selectedSegments);
      if (action.multi) current.has(action.id) ? current.delete(action.id) : current.add(action.id);
      else { current.clear(); current.add(action.id); }
      return { ...state, speed: { ...state.speed, selectedSegments: [...current] }, gis: { ...state.gis, selectedSegments: [...current] } };
    }
    case "UPDATE_SPEED_SEGMENTS": {
      if (!state.speed.draft) return state;
      const selected = new Set(state.speed.selectedSegments);
      const segments = state.speed.draft.segments.map((segment) => (selected.has(segment.id) ? { ...segment, ...action.patch(segment) } : segment));
      return { ...state, speed: { ...state.speed, draft: { ...state.speed.draft, segments } } };
    }
    case "REMOVE_SPEED_SEGMENTS": {
      if (!state.speed.draft) return state;
      const selected = new Set(state.speed.selectedSegments);
      const segments = state.speed.draft.segments.filter((segment) => !selected.has(segment.id));
      return { ...state, speed: { ...state.speed, draft: { ...state.speed.draft, segments }, selectedSegments: [] } };
    }
    case "APPLY_SPEED_DRAFT": {
      if (!state.speed.draft) return state;
      const active = { ...state.speed.draft, version: `ACTIVE v${state.speed.history.length + 1}`, appliedAt: Date.now() };
      return {
        ...state,
        speed: {
          ...state.speed,
          active,
          history: [active, ...state.speed.history],
          draft: null,
          selectedSegments: [],
          notice: `${active.version} diterapkan.`,
        },
      };
    }
    case "PATCH_GIS":
      return { ...state, gis: { ...state.gis, ...action.patch } };
    case "PATCH_DURATION":
      return { ...state, duration: { ...state.duration, ...action.patch } };
    case "PATCH_DATALOG":
      return { ...state, datalog: { ...state.datalog, ...action.patch } };
    case "PATCH_SURVEY":
      return { ...state, survey: { ...state.survey, ...action.patch } };
    default:
      return state;
  }
}

function buildLoaderRows(units) {
  const groups = new Map();
  units.forEach((unitNo, index) => {
    const loader = `EX${String(2601 + (index % 3)).padStart(4, "0")}`;
    if (!groups.has(loader)) groups.set(loader, []);
    groups.get(loader).push(unitNo);
  });
  return [...groups.entries()].map(([loader, assigned]) => ({ loader, units: assigned, unitCount: assigned.length, withData: assigned.length }));
}

export function WorkspaceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let active = true;
    loadFixture()
      .then((fixture) => active && dispatch({ type: "BOOT_SUCCESS", fixture }))
      .catch((error) => active && dispatch({ type: "BOOT_ERROR", error }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("gis-workspace-mode", state.mode === "gis");
    document.body.classList.toggle("duration-mode-v20", state.mode === "duration");
    document.body.classList.toggle("datalog-mode-v20", state.mode === "datalog");
    return () => {
      document.body.classList.remove("gis-workspace-mode", "duration-mode-v20", "datalog-mode-v20");
    };
  }, [state.mode]);

  const appliedStart = parseWita(state.appliedFilters.start);
  const appliedEnd = parseWita(state.appliedFilters.end);
  const effectiveStart = state.analysisWindow?.startMs ?? appliedStart;
  const effectiveEnd = state.analysisWindow?.endMs ?? appliedEnd;
  const unitSet = useMemo(() => new Set(state.appliedFilters.units), [state.appliedFilters.units]);
  const rows = useMemo(
    () => traceRows(state.fixture, unitSet, effectiveStart, effectiveEnd, state.appliedFilters.interval, 45000),
    [state.fixture, unitSet, effectiveStart, effectiveEnd, state.appliedFilters.interval],
  );
  const fullRows = useMemo(
    () => traceRows(state.fixture, unitSet, appliedStart, appliedEnd, state.appliedFilters.interval, 70000),
    [state.fixture, unitSet, appliedStart, appliedEnd, state.appliedFilters.interval],
  );
  const kpis = useMemo(() => deriveKpis(rows, state.appliedFilters.units.length), [rows, state.appliedFilters.units.length]);
  const performance = useMemo(() => buildPerformance(rows), [rows]);
  const trend = useMemo(() => buildTrend(fullRows), [fullRows]);
  const loaders = useMemo(() => buildLoaderRows(state.fixture?.unitNos ?? []), [state.fixture]);

  const durationEvents = useMemo(() => {
    if (!rows.length) return [];
    const events = [];
    const byUnit = new Map();
    rows.forEach((row) => {
      if (!byUnit.has(row.unitNo)) byUnit.set(row.unitNo, []);
      byUnit.get(row.unitNo).push(row);
    });
    byUnit.forEach((points, unitNo) => {
      for (let index = 40; index < points.length; index += 95) {
        const start = points[index];
        const minutes = 5 + ((index / 7) % 28);
        const endMs = Math.min(points.at(-1).time, start.time + minutes * 60000);
        const areaIndex = (index + unitNo.charCodeAt(unitNo.length - 1)) % 4;
        events.push({
          id: `${unitNo}-${start.time}`,
          unitNo,
          polygon: `Pit Stop ${areaIndex + 1}`,
          startMs: start.time,
          endMs,
          durationMs: endMs - start.time,
          lon: start.lon,
          lat: start.lat,
          review: minutes > state.duration.threshold,
        });
      }
    });
    return events.sort((a, b) => a.startMs - b.startMs);
  }, [rows, state.duration.threshold]);

  const datalogRows = useMemo(() => {
    const wanted = new Set(state.datalog.selectedUnits);
    return fullRows
      .filter((row) => wanted.has(row.unitNo))
      .slice(0, 6000)
      .map((row) => ({
        timestampms: row.time,
        timestampiso: new Date(row.time).toISOString(),
        district: "BRCB",
        unitno: row.unitNo,
        unittype: row.unitNo.startsWith("DT") ? "DT" : "Hauler",
        deviceid: `DEV-${row.unitNo}`,
        gpslat: row.lat,
        gpslong: row.lon,
        gpsspeed: row.speed,
        plmstatus: row.status,
        statusname: row.status === 1 ? "PLM Loading" : "Running",
      }));
  }, [fullRows, state.datalog.selectedUnits]);

  const generateDraft = useCallback(() => {
    const generation = state.speed.draft?.generation ?? state.speed.history.length;
    const draft = generateSpeedDraft(fullRows, state.speed.targetLength, generation);
    dispatch({ type: "SET_SPEED_DRAFT", draft });
  }, [fullRows, state.speed.draft?.generation, state.speed.history.length, state.speed.targetLength]);

  const applyFilters = useCallback(() => dispatch({ type: "APPLY_FILTERS" }), []);
  const resetFilters = useCallback(() => dispatch({ type: "RESET_FILTERS" }), []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      rows,
      fullRows,
      kpis,
      performance,
      trend,
      loaders,
      durationEvents,
      datalogRows,
      applyFilters,
      resetFilters,
      generateDraft,
      displayAppliedRange: displayRange(state.appliedFilters.start, state.appliedFilters.end),
      displayDraftRange: displayRange(state.draftFilters.start, state.draftFilters.end),
    }),
    [state, rows, fullRows, kpis, performance, trend, loaders, durationEvents, datalogRows, applyFilters, resetFilters, generateDraft],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
