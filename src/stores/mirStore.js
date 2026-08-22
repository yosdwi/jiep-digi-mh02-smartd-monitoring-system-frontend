import { create } from 'zustand';
import axios from 'axios';

const useMIRStore = create((set, get) => ({
  filters: {
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    endDate: new Date().toISOString().slice(0, 16),
    deviceIds: [],
  },

  trackingData: [],
  summary: {},
  devices: [],
  isLoading: false,
  error: null,
  searchAttempted: false,

  selectedDevice: null,

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  setSelectedDevice: (deviceId) => set({ selectedDevice: deviceId }),

  fetchMIRDevices: async () => {
    try {
      const response = await axios.get('/Monitoring/api/MIR/GetMIRDevices');
      if (response.data?.success) {
        set({ devices: response.data.data });
      }
    } catch (err) {
      console.error('Failed to fetch MIR devices:', err);
      set({ error: 'Failed to fetch MIR devices.' });
    }
  },

  fetchTrackingData: async () => {
    const { filters } = get();

    set({
      isLoading: true,
      searchAttempted: true,
      error: null,
      trackingData: [],
      summary: {}
    });

    try {
      // Step 1: Get device list
      const devicesResponse = await axios.get('/Monitoring/api/MIR/GetMIRDevices');
      if (!devicesResponse.data?.success || !devicesResponse.data.data?.length) {
        set({ error: 'No MIR devices found.', isLoading: false });
        return;
      }

      const allDevices = devicesResponse.data.data;
      set({ devices: allDevices });

      // Filter ke unit hauler terpilih bila ada; kosong = semua unit
      const devices = filters.deviceIds && filters.deviceIds.length > 0
        ? allDevices.filter(d => filters.deviceIds.includes(d.deviceId))
        : allDevices;

      if (!devices.length) {
        set({ error: 'No MIR devices match the selected haulers.', isLoading: false });
        return;
      }

      const basePayload = {
        StartDate: filters.startDate.split('T')[0],
        EndDate: filters.endDate.split('T')[0],
        StartTime: filters.startDate.split('T')[1],
        EndTime: filters.endDate.split('T')[1],
      };

      // Step 2: Fetch per device sequentially to avoid gateway timeout
      const allTrackingData = [];
      const summaries = [];

      for (const device of devices) {
        try {
          const response = await axios.post('/Monitoring/api/MIR/GetMIRTrackingData', {
            ...basePayload,
            DeviceId: device.deviceId,
          });

          if (response.data?.success && response.data.data?.length) {
            allTrackingData.push(...response.data.data);
            if (response.data.summary) summaries.push(response.data.summary);
          }
        } catch (deviceErr) {
          console.warn(`Failed to fetch data for device ${device.deviceId}:`, deviceErr.message);
        }
      }

      // Merge summaries
      const mergedSummary = summaries.reduce((acc, s) => ({
        totalPoints: (acc.totalPoints || 0) + (s.totalPoints || 0),
        totalDevices: (acc.totalDevices || 0) + (s.totalDevices || 0),
        timeSpanHours: Math.max(acc.timeSpanHours || 0, s.timeSpanHours || 0),
        averageSpeed: summaries.length > 0
          ? summaries.reduce((sum, x) => sum + (x.averageSpeed || 0), 0) / summaries.length
          : 0,
      }), {});

      set({
        trackingData: allTrackingData,
        summary: mergedSummary,
        selectedDevice: allTrackingData.length > 0 ? allTrackingData[0].deviceId : null,
        isLoading: false,
      });

    } catch (err) {
      console.error('Error fetching MIR tracking data:', err);
      set({
        error: err.response?.data?.message || err.message || 'An unknown error occurred.',
        isLoading: false,
      });
    }
  },

  getDeviceList: () => {
    const { trackingData } = get();
    return [...new Set(trackingData.map(item => item.deviceId))];
  },

  // MIR distance categorization berdasarkan 4 kategori
  getMirDistanceStatus: (mirDistance, mirInArea, mirUnsafe) => {
    // 1. UNKNOWN - null/tidak ada data
    if (mirDistance === null || mirDistance === undefined) {
      return 'UNKNOWN';
    }

    // 2. CROSSING - mir_unsafe = 1
    if (mirUnsafe === 1) {
      return 'CROSSING';
    }

    // 3. FARAWAY - lebih dari 15m atau -9999
    if (mirDistance === -9999 || mirDistance > 15) {
      return 'FARAWAY';
    }

    // 4. ON AWARENESS - mir_in_area = 1 dan dalam range 15m
    if (mirInArea === 1 && mirDistance <= 15) {
      return 'ON AWARENESS';
    }

    // Default fallback
    return 'UNKNOWN';
  },

  getDistanceStatusColor: (status) => {
    const colorMap = {
      'UNKNOWN': '#64748b',         // gray
      'CROSSING': '#ef4444',        // red
      'FARAWAY': '#3b82f6',         // blue
      'ON AWARENESS': '#22c55e'     // green
    };
    return colorMap[status] || '#64748b';
  },

  getTravelDirection: (vehiclespeed, shift_indicator) => {
    const speed = vehiclespeed ?? 0;
    const shift = shift_indicator ?? 0;

    if (shift === 1) {
      if (speed > 15) return null; // anomali — jangan dikategorikan
      return 'REVERSE';
    }
    if (shift >= 2 && speed >= 3) return 'FORWARD';
    return 'STATIONARY';
  },

  getGpsQualitySymbol: (quality) => {
    const symbolMap = {
      'SINGLE': '●',
      'DGPS': '▲',
      'RTK FIX': '◆',
      'RTK FLOAT': '■',
      'NO GPS': 'x'
    };
    return symbolMap[quality] || '●';
  },

  clearData: () => set({
    trackingData: [],
    summary: {},
    error: null,
    searchAttempted: false,
    selectedDevice: null
  })
}));

export default useMIRStore;