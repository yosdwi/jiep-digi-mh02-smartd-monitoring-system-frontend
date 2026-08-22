import { create } from 'zustand';
import axios from 'axios';
import useUserStore from './userStore';
import { getPerformanceV2Config } from '../config/apiConfig';
import { decodeChunkArrow } from '../services/playbackChunkDecoderClient';

const PLAYBACK_V2_BASE = '/Monitoring/api/PlaybackV2';
const MAX_CHUNK_CACHE = 6;

let activePlaybackAbort = null;
let activeChunkAbort = null;
let activePlaybackToken = 0;
let activeChunkToken = 0;

const getReadyDistrict = async () => {
  let district = useUserStore.getState().getDistrik();
  if (!district) {
    const profile = await useUserStore.getState().fetchProfile();
    district = profile?.distrik || useUserStore.getState().getDistrik();
  }
  return district;
};

const normalizePlaybackPoints = (points, preview = false) => points.map((point) => ({
  ...point,
  deviceid: point.deviceid || point.deviceId,
  unitNo: point.unitNo || point.unitno,
  timestamp: point.timestamp,
  timestampEpochMs: point.timestampEpochMs || Date.parse(point.timestamp),
  plm_status: point.plm_status ?? point.plmStatus,
  vehiclespeed: point.vehiclespeed ?? point.vehicleSpeed,
  hm: point.hm,
  fuel_level_tm: point.fuel_level_tm ?? point.fuelLevelTm,
  act_tonnage: point.act_tonnage ?? point.actTonnage,
  preview,
})).sort((a, b) => (a.timestampEpochMs || 0) - (b.timestampEpochMs || 0));

const toLegacySummary = (summary = {}) => ({
  totalRitase: summary.totalRitase || 0,
  totalLoadedDistance: summary.totalLoadedDistance || 0,
  totalEmptyDistance: summary.totalEmptyDistance || 0,
  totalLoadedDuration: summary.totalLoadedDuration || 0,
  totalEmptyDuration: summary.totalEmptyDuration || 0,
  avgJarakFrontDisposal: summary.avgJarakFrontDisposal || 0,
  avgJarakDisposalFront: summary.avgJarakDisposalFront || 0,
  avgCycleTime: summary.avgCycleTime || 0,
  averageSpeed: summary.averageSpeed || 0,
  pointCount: summary.pointCount || 0,
});

const withWitaOffset = (value) => {
  if (!value) return value;
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return value;
  return `${value.length === 16 ? `${value}:00` : value}+08:00`;
};

const cancelPlaybackQuery = async (queryId) => {
  if (!queryId) return;
  try {
    await fetch(`${PLAYBACK_V2_BASE}/queries/${queryId}`, { method: 'DELETE', cache: 'no-store' });
  } catch {
  }
};

const resolvePlaybackDevices = async (district, unitNos, signal) => {
  const response = await fetch(`${PLAYBACK_V2_BASE}/devices/resolve`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ district, unitNos }),
  });
  if (!response.ok) throw new Error(await response.text());
  const result = await response.json();
  const devices = result.devices || [];
  const deviceIds = [...new Set(devices.map((device) => device.deviceid || device.deviceId).filter(Boolean))];
  if (deviceIds.length === 0) throw new Error('Playback V2 device id kosong.');
  return { devices, deviceIds };
};

const getPlaybackDeviceLabel = (device, devices = []) => {
  const unitNo = device.unitno || device.unitNo || '';
  const deviceId = device.deviceid || device.deviceId || '';
  if (!unitNo) return deviceId;
  const duplicateCount = devices.filter((item) => (item.unitno || item.unitNo || '') === unitNo).length;
  return duplicateCount > 1 && deviceId ? `${unitNo} (${deviceId})` : unitNo;
};

const formatPointCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString('id-ID') : '0';
};

const buildTimelines = (points, devices = []) => {
  const timelines = new Map();
  const labelsByDeviceId = new Map(devices.map((device) => [device.deviceid || device.deviceId, getPlaybackDeviceLabel(device, devices)]));
  points.forEach((point) => {
    const label = labelsByDeviceId.get(point.deviceid || point.deviceId) || point.unitNo;
    if (!label) return;
    if (!timelines.has(label)) timelines.set(label, []);
    timelines.get(label).push(point);
  });
  timelines.forEach((items) => items.sort((a, b) => (a.timestampEpochMs || 0) - (b.timestampEpochMs || 0)));
  return timelines;
};

const pointAtProgress = (timeline, progress, rangeStartMs, rangeEndMs) => {
  if (!timeline?.length) return null;
  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs) || rangeEndMs <= rangeStartMs) {
    const index = Math.floor((Math.max(0, Math.min(100, progress)) / 100) * timeline.length);
    return timeline[Math.min(index, timeline.length - 1)];
  }
  const targetMs = rangeStartMs + (Math.max(0, Math.min(100, progress)) / 100) * (rangeEndMs - rangeStartMs);
  let low = 0;
  let high = timeline.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((timeline[mid].timestampEpochMs || 0) < targetMs) low = mid + 1;
    else high = mid;
  }
  return timeline[low] || timeline[timeline.length - 1];
};

const fetchLegacyTrackingData = async (filters, set, get) => {
  set({ isLoading: true, searchAttempted: true, error: null, previewWarning: null, trackingData: [], excavatorPositions: [], summary: {}, haulerSummaries: {}, targetSpeedData: null });
  try {
    let allTrackingData = [];
    let allExcavatorPositions = [];
    let combinedSummary = {};
    const individualSummaries = {};
    let firstTargetSpeedData = null;

    for (const unitNo of filters.unitNos) {
      try {
        const response = await axios.post('/Monitoring/api/TrackingHistory/GetTrackingData', {
          UnitNo: unitNo,
          StartDate: filters.startDate.split('T')[0],
          EndDate: filters.endDate.split('T')[0],
          StartTime: filters.startDate.split('T')[1],
          EndTime: filters.endDate.split('T')[1],
        });

        if (response.data?.success) {
          allTrackingData = [...allTrackingData, ...response.data.data];
          allExcavatorPositions = [...allExcavatorPositions, ...response.data.plmPositions];
          individualSummaries[unitNo] = response.data.summary;

          if (!combinedSummary.totalRitase) {
            combinedSummary = { ...response.data.summary };
          } else {
            combinedSummary.totalRitase += response.data.summary.totalRitase || 0;
            combinedSummary.totalLoadedDistance += response.data.summary.totalLoadedDistance || 0;
            combinedSummary.totalEmptyDistance += response.data.summary.totalEmptyDistance || 0;
            combinedSummary.totalLoadedDuration += response.data.summary.totalLoadedDuration || 0;
            combinedSummary.totalEmptyDuration += response.data.summary.totalEmptyDuration || 0;
          }

          if (response.data.targetSpeedData && !firstTargetSpeedData) {
            firstTargetSpeedData = response.data.targetSpeedData;
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch data for ${unitNo}:`, error);
      }
    }

    const uniqueHaulers = [...new Set(allTrackingData.map((item) => item.unitNo))];
    const normalized = normalizePlaybackPoints(allTrackingData);
    set((state) => ({
      trackingData: normalized,
      excavatorPositions: allExcavatorPositions,
      summary: combinedSummary,
      haulerSummaries: individualSummaries,
      targetSpeedData: firstTargetSpeedData,
      selectedHauler: uniqueHaulers.length > 0 ? uniqueHaulers[0] : null,
      isPlaying: true,
      currentProgress: 0,
      isLoading: false,
      selectedLoader: state.selectedLoader,
      playbackV2: {
        queryId: null,
        state: 'legacy',
        progress: 100,
        devices: uniqueHaulers.map((unitno) => ({ unitno, deviceid: unitno })),
        availableHours: [],
        chunkCache: new Map(),
        loadedChunkKeys: new Set(),
        timelines: buildTimelines(normalized),
        rangeStartMs: Date.parse(withWitaOffset(filters.startDate)),
        rangeEndMs: Date.parse(withWitaOffset(filters.endDate)),
      },
    }));
  } catch (error) {
    console.error('Error fetching legacy tracking data:', error);
    set({ error: error.response?.data?.message || error.message || 'An unknown error occurred.', previewWarning: null, isLoading: false });
  }
};

const useCycleTimeStore = create((set, get) => ({
  filters: {
    unitNo: null,
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // 24 hours ago
    endDate: new Date().toISOString().slice(0, 16), // now
  },
  trackingData: [],
  excavatorPositions: [],
  summary: {},
  haulerSummaries: {}, // Store individual summaries per hauler
  targetSpeedData: null,
  playbackV2: {
    queryId: null,
    state: 'idle',
    progress: 0,
    devices: [],
    availableHours: [],
    chunkCache: new Map(),
    loadedChunkKeys: new Set(),
    timelines: new Map(),
    rangeStartMs: null,
    rangeEndMs: null,
  },
  isLoading: false,
  error: null,
  previewWarning: null,
  searchAttempted: false,

  availableLoaders: [],
  availableHaulers: [],
  loadersLoading: false,
  haulersLoading: false,
  selectedLoader: null,
  sourceMode: 'miforce',
  sourceRows: { miforce: [], timesheet: [] },
  sourceComparisonLoading: false,

  clearAvailableLoaders: () => set({ availableLoaders: [], selectedLoader: null }),
  clearAvailableHaulers: () => set({ availableHaulers: [] }),

  selectedHauler: null,
  isPlaying: false,
  currentProgress: 0,
  playbackSpeed: 1,
  autoFollow: false,
  
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  setSourceMode: (sourceMode) => set({ sourceMode }),

  fetchSourceRows: async (sourceMode = get().sourceMode) => {
    const { filters } = get();
    const district = await getReadyDistrict();
    set({ sourceComparisonLoading: true, sourceRows: { miforce: [], timesheet: [] }, error: null });
    try {
      const response = await axios.get('/Monitoring/api/TrackingHistory/GetAvailableUnits', {
        params: {
          mode: 'fleet-sources',
          startDate: filters.startDate,
          endDate: filters.endDate,
          startHour: Number(filters.startDate.split('T')[1].split(':')[0]),
          endHour: Number(filters.endDate.split('T')[1].split(':')[0]),
          district,
        },
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Gagal mengambil source fleet.');
      set({
        sourceMode,
        sourceRows: {
          miforce: response.data.miforce || [],
          timesheet: response.data.timesheet || [],
        },
      });
      return response.data;
    } catch (err) {
      console.error('Failed to fetch source rows:', err);
      set({ error: err.message || 'Failed to fetch source rows.' });
      throw err;
    } finally {
      set({ sourceComparisonLoading: false });
    }
  },

  fetchAvailableLoaders: async (source = 'miforce') => {
    const { filters } = get();
    const district = await getReadyDistrict();

    set({ loadersLoading: true, availableLoaders: [], availableHaulers: [], error: null });
    try {
      if (source === 'miforce' || source === 'timesheet') {
        const response = await axios.get('/Monitoring/api/TrackingHistory/GetAvailableUnits', {
          params: {
            mode: 'fleet-sources',
            startDate: filters.startDate,
            endDate: filters.endDate,
            startHour: Number(filters.startDate.split('T')[1].split(':')[0]),
            endHour: Number(filters.endDate.split('T')[1].split(':')[0]),
            district,
          },
        });
        if (!response.data?.success) throw new Error(response.data?.message || 'Gagal mengambil source fleet.');
        const sourceLabel = source === 'miforce' ? 'MIFORCE' : 'TIMESHEET';
        const loaderData = response.data[source === 'miforce' ? 'miforceLoaderData' : 'timesheetLoaderData'] || {};
        const loaders = Object.keys(loaderData).sort((a, b) => a.localeCompare(b)).map(loaderName => ({
          label: `${loaderName} [${sourceLabel}] (${loaderData[loaderName].haulerCount}/${loaderData[loaderName].totalHaulerCount} Haulers)`,
          value: loaderName,
          haulers: (loaderData[loaderName].haulers || []).map(h => ({ label: h })),
        }));
        set({ availableLoaders: loaders, sourceMode: source });
        return;
      }
      const response = await axios.get('/Monitoring/api/TrackingHistory/GetAvailableUnits', {
        params: {
          mode: 'fleet',
          startDate: filters.startDate,
          endDate: filters.endDate,
          district,
        },
      });
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Gagal mengambil daftar loader.');
      }
      if (response.data?.success) {
        const loaderData = response.data.loaderData || {};
        const loaders = Object.keys(loaderData).map(loaderName => ({
          label: `${loaderName} [${loaderData[loaderName].source || 'UNKNOWN'}] (${loaderData[loaderName].haulerCount}/${loaderData[loaderName].totalHaulerCount} Haulers)`,
          value: loaderName,
          haulers: loaderData[loaderName].haulers.map(h => ({ label: h })),
        }));
        set({ availableLoaders: loaders });
      }
    } catch (err) {
      console.error('Failed to fetch loaders:', err);
      set({ error: 'Failed to fetch loaders.' });
    } finally {
      set({ loadersLoading: false });
    }
  },

  fetchAvailableHaulers: async (loader) => {
    const { filters } = get();
    const district = await getReadyDistrict();
    set({ haulersLoading: true, availableHaulers: [], error: null });
    try {
      const selectedDateTime = new Date(filters.startDate);
      const selectedHour = selectedDateTime.getHours();

      const response = await axios.get('/Monitoring/api/TrackingHistory/GetAvailableUnits', {
        params: {
          mode: 'fleet-units',
          loader: loader,
          startDate: filters.startDate.split('T')[0],
          endDate: filters.endDate.split('T')[0],
          selectedHour: selectedHour,
          district,
        },
      });
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Gagal mengambil daftar Unit DT.');
      }
      if (response.data?.success) {
        const haulers = response.data.data.map(h => ({ label: h }));
        set({ availableHaulers: haulers });
      }
    } catch (err) {
      console.error('Failed to fetch haulers:', err);
      set({ error: 'Failed to fetch haulers.' });
    } finally {
      set({ haulersLoading: false });
    }
  },

  fetchAllAvailableHaulers: async () => {
    const { filters } = get();
    const district = await getReadyDistrict();
    set({ haulersLoading: true, availableHaulers: [], error: null });

    try {
      const response = await axios.get('/Monitoring/api/TrackingHistory/GetAvailableUnits', {
        params: {
          mode: 'multi-haulers',
          startDate: filters.startDate,
          endDate: filters.endDate,
          district,
        },
      });
      if (response.data?.success) {
        const haulers = (response.data.data || []).map(h => ({
          label: h.label,
          available: h.available,
        }));
        set({ availableHaulers: haulers });
      }
    } catch (err) {
      console.error('Failed to fetch all haulers:', err);
      set({ error: 'Failed to fetch haulers.' });
    } finally {
      set({ haulersLoading: false });
    }
  },

  fetchTrackingData: async (overrideFilters = null) => {
    const currentFilters = get().filters;
    const filters = overrideFilters ? { ...currentFilters, ...overrideFilters } : currentFilters;
    if (!filters.unitNos || filters.unitNos.length === 0) {
      set({ error: 'At least one Unit Number is required.', previewWarning: null, isLoading: false });
      return;
    }

    const performanceV2 = await getPerformanceV2Config();
    if (!performanceV2.playbackEnabled) {
      await fetchLegacyTrackingData(filters, set, get);
      return;
    }

    const previousQueryId = get().playbackV2.queryId;
    if (activePlaybackAbort) activePlaybackAbort.abort();
    if (activeChunkAbort) activeChunkAbort.abort();
    await cancelPlaybackQuery(previousQueryId);
    activePlaybackAbort = new AbortController();
    activeChunkAbort = new AbortController();
    const requestToken = ++activePlaybackToken;
    activeChunkToken++;

    set({
      isLoading: true,
      searchAttempted: true,
      error: null,
      previewWarning: null,
      trackingData: [],
      excavatorPositions: [],
      summary: {},
      haulerSummaries: {},
      targetSpeedData: null,
      playbackV2: {
        queryId: null,
        state: 'queued',
        progress: 1,
        devices: [],
        availableHours: [],
        chunkCache: new Map(),
        loadedChunkKeys: new Set(),
        timelines: new Map(),
        rangeStartMs: Date.parse(withWitaOffset(filters.startDate)),
        rangeEndMs: Date.parse(withWitaOffset(filters.endDate)),
      },
    });

    try {
      const district = await getReadyDistrict();
      const resolvedDevices = await resolvePlaybackDevices(district, filters.unitNos, activePlaybackAbort.signal);
      const createResponse = await fetch(`${PLAYBACK_V2_BASE}/queries`, {
        method: 'POST',
        signal: activePlaybackAbort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district,
          deviceIds: resolvedDevices.deviceIds,
          startDateTime: withWitaOffset(filters.startDate),
          endDateTime: withWitaOffset(filters.endDate),
        }),
      });
      if (!createResponse.ok) throw new Error(await createResponse.text());
      const created = await createResponse.json();
      const queryId = created.queryId;
      if (!queryId) throw new Error('Playback V2 query id kosong.');

      let status = created;
      while (!['ready', 'failed', 'cancelled'].includes(status.state)) {
        if (requestToken !== activePlaybackToken) return;
        await new Promise((resolve) => setTimeout(resolve, status.state === 'queued' ? 700 : 1000));
        const statusResponse = await fetch(`${PLAYBACK_V2_BASE}/queries/${queryId}`, {
          signal: activePlaybackAbort.signal,
          cache: 'no-store',
        });
        if (!statusResponse.ok) throw new Error(await statusResponse.text());
        status = await statusResponse.json();
        set((state) => ({
          playbackV2: {
            ...state.playbackV2,
            queryId,
            state: status.state,
            progress: status.progress || 0,
            devices: status.devices || [],
            availableHours: status.availableHours || [],
          },
        }));
      }

      if (status.state !== 'ready') throw new Error(status.message || `Playback query ${status.state}`);

      const previewResponse = await fetch(`${PLAYBACK_V2_BASE}/queries/${queryId}/preview`, {
        signal: activePlaybackAbort.signal,
        cache: 'no-store',
      });
      if (!previewResponse.ok) throw new Error(await previewResponse.text());
      const preview = await previewResponse.json();
      if (requestToken !== activePlaybackToken) return;

      const previewPoints = normalizePlaybackPoints(preview.points || [], true);
      const devices = preview.devices || [];
      const uniqueHaulers = devices.map((device) => getPlaybackDeviceLabel(device, devices)).filter(Boolean);
      const firstHauler = uniqueHaulers[0] || previewPoints[0]?.unitNo || null;
      const retainedCount = Number(preview.retainedCount ?? previewPoints.length);
      const totalCount = Number(preview.totalCount ?? retainedCount);
      const previewWarning = preview.truncated
        ? `Preview V2 menampilkan ${formatPointCount(retainedCount)}/${formatPointCount(totalCount)} titik. Pilih unit untuk memuat data full-resolution per jam.`
        : null;

      set((state) => ({
        trackingData: previewPoints,
        excavatorPositions: previewPoints.filter((point) => Number(point.plm_status) === 3),
        summary: toLegacySummary(preview.summary),
        haulerSummaries: Object.fromEntries(Object.entries(preview.summaries || {}).map(([unit, summary]) => [unit, toLegacySummary(summary)])),
        targetSpeedData: null,
        selectedHauler: firstHauler,
        isPlaying: true,
        currentProgress: 0,
        isLoading: false,
        previewWarning,
        selectedLoader: state.selectedLoader,
        playbackV2: {
          ...state.playbackV2,
          queryId,
          state: 'ready',
          progress: 100,
          devices,
          availableHours: preview.availableHours || [],
          chunkCache: new Map(),
          loadedChunkKeys: new Set(),
          timelines: buildTimelines(previewPoints, devices),
          rangeStartMs: Date.parse(withWitaOffset(filters.startDate)),
          rangeEndMs: Date.parse(withWitaOffset(filters.endDate)),
          truncated: Boolean(preview.truncated),
          retainedCount,
          totalCount,
        },
      }));

      if (firstHauler) {
        get().ensureSelectedHaulerChunks(0);
      }
    } catch (err) {
      if (err.name === 'AbortError' || requestToken !== activePlaybackToken) return;
      console.error('Error fetching tracking data:', err);
      set({
        error: err.response?.data?.message || err.message || 'An unknown error occurred.',
        previewWarning: null,
        isLoading: false,
      });
    }
  },

  ensureSelectedHaulerChunks: async (progress = get().currentProgress) => {
    const { playbackV2, selectedHauler } = get();
    if (!playbackV2.queryId || !selectedHauler || playbackV2.availableHours.length === 0) return;
    const device = playbackV2.devices.find((item) => getPlaybackDeviceLabel(item, playbackV2.devices) === selectedHauler || item.unitno === selectedHauler || item.deviceid === selectedHauler);
    if (!device?.deviceid) return;
    const queryId = playbackV2.queryId;
    const chunkToken = activeChunkToken;
    const chunkSignal = activeChunkAbort?.signal;
    const hourCount = playbackV2.availableHours.length;
    const activeIndex = Math.max(0, Math.min(hourCount - 1, Math.floor((Math.max(0, Math.min(100, progress)) / 100) * hourCount)));
    const wantedHours = [activeIndex - 1, activeIndex, activeIndex + 1]
      .filter((index) => index >= 0 && index < hourCount)
      .map((index) => playbackV2.availableHours[index]);

    for (const hour of wantedHours) {
      const key = `${device.deviceid}|${hour}`;
      if (get().playbackV2.loadedChunkKeys.has(key)) continue;
      try {
        const response = await fetch(`${PLAYBACK_V2_BASE}/queries/${queryId}/devices/${encodeURIComponent(device.deviceid)}/chunks/${encodeURIComponent(hour)}`, {
          signal: chunkSignal,
          cache: 'no-store',
        });
        if (chunkToken !== activeChunkToken || get().playbackV2.queryId !== queryId || get().selectedHauler !== selectedHauler) return;
        if (response.status === 204) {
          set((state) => {
            if (state.playbackV2.queryId !== queryId || state.selectedHauler !== selectedHauler || chunkToken !== activeChunkToken) {
              return {};
            }
            const loadedChunkKeys = new Set(state.playbackV2.loadedChunkKeys);
            loadedChunkKeys.add(key);
            return { playbackV2: { ...state.playbackV2, loadedChunkKeys } };
          });
          continue;
        }
        if (!response.ok) throw new Error(await response.text());
        const buffer = await response.arrayBuffer();
        const decoded = await decodeChunkArrow(buffer);
        if (chunkToken !== activeChunkToken || get().playbackV2.queryId !== queryId || get().selectedHauler !== selectedHauler) return;
        // decoded.points is already point-objects — built inside the worker now,
        // not on the main thread (see playbackChunkDecoder.worker.js).
        const chunkPoints = decoded.points;
        set((state) => {
          if (state.playbackV2.queryId !== queryId || state.selectedHauler !== selectedHauler || chunkToken !== activeChunkToken) {
            return {};
          }
          const chunkCache = new Map(state.playbackV2.chunkCache);
          chunkCache.set(key, chunkPoints);
          while (chunkCache.size > MAX_CHUNK_CACHE) {
            const oldestKey = chunkCache.keys().next().value;
            chunkCache.delete(oldestKey);
          }
          const loadedChunkKeys = new Set(chunkCache.keys());
          const preview = state.trackingData.filter((point) => (point.deviceid || point.deviceId) !== device.deviceid || point.preview === true);
          const selectedChunks = [...chunkCache.entries()]
            .filter(([cacheKey]) => cacheKey.startsWith(`${device.deviceid}|`))
            .flatMap(([, points]) => points)
            .filter((point) => !point.context);
          const byKey = new Map();
          [...preview, ...selectedChunks].forEach((point) => {
            byKey.set(`${point.deviceid || point.deviceId || point.unitNo}|${point.timestampEpochMs || point.timestamp}`, point);
          });
          const nextTrackingData = [...byKey.values()];
          return {
            trackingData: nextTrackingData,
            excavatorPositions: nextTrackingData.filter((point) => Number(point.plm_status) === 3),
            playbackV2: { ...state.playbackV2, chunkCache, loadedChunkKeys, timelines: buildTimelines(nextTrackingData, state.playbackV2.devices) },
          };
        });
      } catch (error) {
        if (error.name !== 'AbortError') console.warn('Failed to load playback chunk:', error);
      }
    }
  },

  setSelectedHauler: (hauler) => {
    if (activeChunkAbort) activeChunkAbort.abort();
    activeChunkAbort = new AbortController();
    activeChunkToken++;
    set((state) => {
      if (!state.playbackV2.queryId) {
        return { selectedHauler: hauler, currentProgress: 0 };
      }
      const previewPoints = state.trackingData.filter((point) => point.preview === true);
      return {
        selectedHauler: hauler,
        currentProgress: 0,
        trackingData: previewPoints,
        excavatorPositions: previewPoints.filter((point) => Number(point.plm_status) === 3),
        playbackV2: {
          ...state.playbackV2,
          chunkCache: new Map(),
          loadedChunkKeys: new Set(),
          timelines: buildTimelines(previewPoints, state.playbackV2.devices),
        },
      };
    });
    get().ensureSelectedHaulerChunks(0);
  },
  setSelectedLoader: (loader) => set({ selectedLoader: loader }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentProgress: (progress) => {
    const nextProgress = typeof progress === 'number' ? progress : 0;
    set({ currentProgress: nextProgress });
    get().ensureSelectedHaulerChunks(nextProgress);
  },
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setAutoFollow: (autoFollow) => set({ autoFollow }),

  getHaulerList: () => {
    const { playbackV2, trackingData } = get();
    const deviceUnits = playbackV2.devices.map((device) => getPlaybackDeviceLabel(device, playbackV2.devices)).filter(Boolean);
    return deviceUnits.length > 0 ? deviceUnits : [...new Set(trackingData.map(item => item.unitNo))];
  },

  getCurrentTrackingPoint: () => {
    const { playbackV2, selectedHauler, currentProgress } = get();
    if (!selectedHauler) return null;
    return pointAtProgress(
      playbackV2.timelines.get(selectedHauler),
      currentProgress,
      playbackV2.rangeStartMs,
      playbackV2.rangeEndMs,
    );
  },

  getStatusText: (status) => {
    const statusMap = {
      0: 'ACC ON',
      1: 'Standby',
      2: 'Running - Kosongan',
      3: 'Loading',
      4: 'Running - Muatan',
      5: 'Stop -  Muatan',
      6: 'Dumping'
    };
    return statusMap[status] || 'Unknown';
  },

  getStatusColor: (status) => {
    const colorMap = {
      0: '#64748b',
      1: '#eab308',
      2: '#06b6d4',
      3: '#f97316',
      4: '#22c55e',
      5: '#a855f7',
      6: '#ef4444'
    };
    return colorMap[status] || '#64748b';
  },
}));

export default useCycleTimeStore;
