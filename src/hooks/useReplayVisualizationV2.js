import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { PathLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { circle } from '@turf/turf';
import useCycleTimeStore from '../stores/cycleTimeStore';
import { getPlayhead, subscribePlayhead } from '../services/playbackAnimationRuntime';
import {
  useEnhancedIconMarkerLayers,
  createEnhancedMarkerConfig,
  DEFAULT_UNIT_TYPE_MAP
} from '../components/shared/IconMarker';
import { handleTrailClick } from '../components/shared/TrailTooltip';
import { useBearingLogic, interpolateAngle } from './useBearingLogic';

// V2, take 2: replace the hand-rolled PathLayer trail (rebuilt every tick, even
// after the incremental-cache fix) with deck.gl's TripsLayer — the layer
// deck.gl ships specifically for time-scrubbed trail playback (same one used
// in Uber's own trip-animation demos). The trail geometry (`data`) is built
// ONCE per search result via useMemo keyed only on processedHaulerData; every
// tick just changes the `currentTime` number prop, which deck.gl updates as a
// GPU uniform — no JS-side data rebuild, no re-upload of path buffers, at all.
// This also removes the "ms per row" timing-guess bug class entirely: reveal
// position is index-normalized to the same 0-100 progress scale the rest of
// the app already uses (matching how marker interpolation indexes haulerData),
// not derived from an assumed real-time gap between rows.
//
// Trade-off: TripsLayer colors a whole trip entry with one `getColor`, not
// per-segment — so the previous per-segment speed-bracket trail coloring
// (blue/green/amber/brown/red) is dropped in this layer. Current per-truck
// status (moving/idle/down) is still shown live on the marker itself.

const isValidCoord = (lng, lat) => {
  if (typeof lng !== 'number' || typeof lat !== 'number') return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  if (lng === 0 && lat === 0) return false;
  return true;
};

const MAX_TRAIL_JUMP_DEG = 0.01;

const isTrailJump = (a, b) =>
  Math.abs(a.longitude - b.longitude) > MAX_TRAIL_JUMP_DEG ||
  Math.abs(a.latitude - b.latitude) > MAX_TRAIL_JUMP_DEG;

const TRAIL_COLOR = [52, 152, 219, 220];
const TRAIL_COLOR_SELECTED = [255, 165, 0, 255];

// Module-level so their identity is stable across renders. These end up inside
// deck.gl `updateTriggers`; an inline object literal here would be a new
// reference every frame, which tells deck.gl the colour/size attributes changed
// and makes it regenerate them for every marker, 60 times a second.
const MARKER_STATUS_COLORS = {
  moving: [46, 204, 113, 255],
  idle: [243, 156, 18, 255],
  down: [231, 76, 60, 255],
  loader: [255, 165, 0, 255],
  default: [200, 200, 200, 255],
};

const MARKER_LOD = {
  ZOOM_THRESHOLD: 14,
  DOT_SIZE: 10,
  ICON_SIZE: 40,
  LABEL_SIZE: 14,
};

const getMarkerStatus = (d) => (d.isLoader ? 'loader' : d.status);
const getMarkerHeading = (d) => d.heading || 0;
const getMarkerDeviceType = (d) => d.deviceType;

const statusFromPlmStatus = (plmStatus) =>
  plmStatus === 1 || plmStatus === 5 ? 'idle' : 'moving';

// One hauler's points can become multiple trip entries: a GPS glitch jump
// starts a new entry instead of drawing a straight line across the gap.
// `timestamps` is the point's index normalized to 0-100 (not real elapsed
// time) so `currentTime` lines up with the same currentProgress scale used
// everywhere else (marker interpolation, the playback slider).
const buildTripsForHauler = (hauler, points) => {
  const n = points.length;
  if (n < 2) return [];

  const trips = [];
  let path = [];
  let timestamps = [];
  let pointsData = [];

  const flush = () => {
    if (path.length > 1) trips.push({ hauler, path, timestamps, pointsData });
    path = [];
    timestamps = [];
    pointsData = [];
  };

  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (i > 0 && isTrailJump(points[i - 1], p)) flush();
    path.push([p.longitude, p.latitude]);
    timestamps.push((i / (n - 1)) * 100);
    pointsData.push(p);
  }
  flush();

  return trips;
};

// `zoom` is a plain number, not the full viewState object: the only thing this
// hook needs the camera for is marker level-of-detail, and taking the whole
// viewState here would re-run everything below on every pan frame.
export const useReplayVisualizationV2 = (zoom = 16, onTrailHover = null) => {
  const trackingData = useCycleTimeStore((state) => state.trackingData);
  const excavatorPositions = useCycleTimeStore((state) => state.excavatorPositions);
  const selectedHauler = useCycleTimeStore((state) => state.selectedHauler);
  // RAF-frequency value from outside Zustand — see playbackAnimationRuntime.js.
  // This is the one subscription in the whole page that legitimately re-renders
  // at ~60fps; it's scoped to this hook (called only from MapContainerLite), not
  // the page component, so nothing else re-renders because of it.
  const currentProgress = useSyncExternalStore(subscribePlayhead, getPlayhead, getPlayhead);
  const summary = useCycleTimeStore((state) => state.summary);
  const selectedLoader = useCycleTimeStore((state) => state.selectedLoader);

  const sortedHaulerData = useMemo(() => {
    if (!trackingData || trackingData.length === 0) return {};

    const haulerMap = {};
    trackingData.forEach(point => {
      if (!isValidCoord(point.longitude, point.latitude)) return;
      if (!haulerMap[point.unitNo]) {
        haulerMap[point.unitNo] = [];
      }
      haulerMap[point.unitNo].push(point);
    });

    Object.keys(haulerMap).forEach(hauler => {
      // timestampEpochMs is already a number on every point (normalizePlaybackPoints
      // and the chunk decoder worker both set it) — comparing it directly skips
      // re-parsing the ISO string on every comparison, which a plain
      // `new Date(a.timestamp)` sort would otherwise do O(n log n) times.
      haulerMap[hauler].sort((a, b) => (a.timestampEpochMs || 0) - (b.timestampEpochMs || 0));
    });

    return haulerMap;
  }, [trackingData]);

  const processedHaulerData = useBearingLogic(sortedHaulerData);

  // Excavator track sorted once, not re-sorted on every playhead tick.
  const sortedExcavatorPositions = useMemo(() => {
    if (!excavatorPositions || excavatorPositions.length === 0) return [];
    return [...excavatorPositions].sort(
      (a, b) => (a.timestampEpochMs || 0) - (b.timestampEpochMs || 0)
    );
  }, [excavatorPositions]);

  // One marker slot per hauler, plus one for the loader when a loader is
  // selected. This array and the objects in it are allocated ONCE per search
  // result and then mutated in place every frame (see `markerVersion` below) —
  // handing deck.gl a fresh array 60x/second makes it treat every attribute as
  // invalid and re-tessellate every TextLayer label, which is the expensive
  // thing this avoids.
  const markerSlots = useMemo(() => {
    const slots = Object.keys(processedHaulerData).map((unitNo) => ({
      unitNo,
      deviceType: 'DT',
      status: 'moving',
      speed: 0,
      heading: 0,
      longitude: 0,
      latitude: 0,
      isLoader: false,
      visible: false,
    }));

    if (selectedLoader) {
      slots.push({
        unitNo: selectedLoader.value,
        deviceType: 'EX',
        status: 'loader',
        speed: 0,
        heading: 0,
        longitude: 0,
        latitude: 0,
        isLoader: true,
        visible: false,
      });
    }

    return slots;
  }, [processedHaulerData, selectedLoader]);

  const markerVersionRef = useRef(0);
  const loaderSlotRef = useRef(null);

  // Mutation during render, on purpose. These objects are not React state and
  // nothing else reads them; recomputing them from `currentProgress` is
  // idempotent, so StrictMode's double render is harmless. Doing it here rather
  // than in an effect keeps the layers below in sync with the playhead within
  // the same frame.
  markerVersionRef.current += 1;
  const markerVersion = markerVersionRef.current;
  const progressRatio = currentProgress / 100;

  loaderSlotRef.current = null;

  for (let i = 0; i < markerSlots.length; i++) {
    const slot = markerSlots[i];

    if (slot.isLoader) {
      // Loader position is time-matched to the selected hauler's current point,
      // not index-matched — the two devices have independent sample counts.
      const refData = selectedHauler
        ? processedHaulerData[selectedHauler]
        : Object.values(processedHaulerData)[0];
      const refPoint = refData?.length
        ? refData[Math.floor(progressRatio * (refData.length - 1))]
        : null;
      const refTimeMs = refPoint?.timestampEpochMs;

      let closest = null;
      if (refTimeMs && sortedExcavatorPositions.length > 0) {
        let minDiff = Infinity;
        for (let j = 0; j < sortedExcavatorPositions.length; j++) {
          const diff = Math.abs((sortedExcavatorPositions[j].timestampEpochMs || 0) - refTimeMs);
          // Sorted ascending: once the gap starts growing again the nearest
          // sample is behind us, so stop instead of scanning the whole track.
          if (diff > minDiff) break;
          minDiff = diff;
          closest = sortedExcavatorPositions[j];
        }
      }

      slot.visible = Boolean(closest);
      if (closest) {
        slot.longitude = closest.longitude;
        slot.latitude = closest.latitude;
        loaderSlotRef.current = slot;
      }
      continue;
    }

    const haulerData = processedHaulerData[slot.unitNo];
    if (!haulerData || haulerData.length === 0) {
      slot.visible = false;
      continue;
    }

    const exactIndex = progressRatio * (haulerData.length - 1);
    const lowerIndex = Math.floor(exactIndex);
    const upperIndex = Math.min(lowerIndex + 1, haulerData.length - 1);
    const localProgress = exactIndex - lowerIndex;

    const currentPoint = haulerData[lowerIndex];
    const nextPoint = haulerData[upperIndex];

    if (!currentPoint || !isValidCoord(currentPoint.longitude, currentPoint.latitude)) {
      slot.visible = false;
      continue;
    }

    if (localProgress > 0 && nextPoint) {
      slot.longitude = currentPoint.longitude + (nextPoint.longitude - currentPoint.longitude) * localProgress;
      slot.latitude = currentPoint.latitude + (nextPoint.latitude - currentPoint.latitude) * localProgress;
      slot.heading = interpolateAngle(currentPoint.bearing, nextPoint.bearing, localProgress);
    } else {
      slot.longitude = currentPoint.longitude;
      slot.latitude = currentPoint.latitude;
      slot.heading = currentPoint.bearing || 0;
    }

    slot.status = statusFromPlmStatus(currentPoint.plm_status);
    slot.speed = currentPoint.speed || currentPoint.vehiclespeed || 0;
    slot.visible = true;
  }

  // A slot can drop out (hauler with no usable point at this index, loader with
  // no time-matched sample). Filtering allocates a new array, so only do it when
  // the visibility pattern actually flips — otherwise the whole point of the
  // stable-slot array is lost.
  const visibilityKeyRef = useRef(null);
  const slotsRef = useRef(null);
  const markerDataRef = useRef([]);
  const visibilityKey = markerSlots.reduce((acc, s) => acc + (s.visible ? '1' : '0'), '');
  if (slotsRef.current !== markerSlots || visibilityKey !== visibilityKeyRef.current) {
    slotsRef.current = markerSlots;
    visibilityKeyRef.current = visibilityKey;
    markerDataRef.current = markerSlots.filter((s) => s.visible);
  }
  const markerData = markerDataRef.current;

  const getMarkerText = useCallback((d) => {
    if (d.isLoader || d.deviceType === 'EX') return selectedLoader ? selectedLoader.value : '';
    return d.unitNo?.toString().split('-')[1] || d.unitNo;
  }, [selectedLoader]);

  const handleMarkerClick = useCallback((info) => {
    const clickedUnit = info.object;
    if (clickedUnit?.unitNo && !clickedUnit.isLoader) {
      // Selecting the hauler is enough — the page's selectedHauler effect owns
      // the camera move, so this no longer touches view state directly.
      useCycleTimeStore.getState().setSelectedHauler(clickedUnit.unitNo);
    }
  }, []);

  const replayMarkerLayers = useEnhancedIconMarkerLayers(
    createEnhancedMarkerConfig({
      data: markerData,
      positionVersion: markerVersion,
      id: 'replay-markers',
      zoom,
      unitNoField: 'unitNo',
      deviceTypeField: 'deviceType',
      statusField: 'status',
      headingField: 'heading',
      customGetText: getMarkerText,
      customGetHeading: getMarkerHeading,
      customGetStatus: getMarkerStatus,
      customGetDeviceType: getMarkerDeviceType,
      pickable: true,
      onClick: handleMarkerClick,
      unitTypeMap: DEFAULT_UNIT_TYPE_MAP,
      statusColorMap: MARKER_STATUS_COLORS,
      lodConfig: MARKER_LOD,
    })
  );

  // Ring around the loader. Recomputing a 64-vertex turf circle every frame is
  // wasted work when the loader barely moves — regenerate only when its
  // position changes by more than ~1m.
  const loaderRingKey = loaderSlotRef.current
    ? `${loaderSlotRef.current.longitude.toFixed(5)},${loaderSlotRef.current.latitude.toFixed(5)}`
    : null;

  const loaderBoundaryLayers = useMemo(() => {
    if (!loaderRingKey) return [];

    const [lng, lat] = loaderRingKey.split(',').map(Number);
    const circleGeo = circle([lng, lat], 0.02, { units: 'kilometers' });
    const boundaryData = [{ path: circleGeo.geometry.coordinates[0], isLoader: true }];

    return [
      new PathLayer({
        id: 'loader-boundaries',
        data: boundaryData,
        getPath: d => d.path,
        getColor: [255, 165, 0, 100],
        getWidth: 2,
        widthMinPixels: 1,
        widthMaxPixels: 3,
        filled: false,
        stroked: true,
        lineWidthScale: 1,
        updateTriggers: {
          getPath: [loaderRingKey],
        },
      })
    ];
  }, [loaderRingKey]);

  // Built once per search result — does NOT depend on currentProgress, so
  // this never recomputes during playback.
  const tripsData = useMemo(() => {
    return Object.keys(processedHaulerData).flatMap(
      hauler => buildTripsForHauler(hauler, processedHaulerData[hauler])
    );
  }, [processedHaulerData]);

  const tripsLayer = useMemo(() => {
    if (tripsData.length === 0) return null;

    return new TripsLayer({
      id: 'replay-trips',
      data: tripsData,
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      getColor: d => (d.hauler === selectedHauler ? TRAIL_COLOR_SELECTED : TRAIL_COLOR),
      opacity: 0.85,
      widthMinPixels: 4,
      widthMaxPixels: 10,
      capRounded: true,
      jointRounded: true,
      fadeTrail: false, // full played-so-far trail, no comet fade-out
      trailLength: 100,
      currentTime: currentProgress,
      pickable: true,
      onClick: (info) => {
        handleTrailClick(info, (hauler) => {
          useCycleTimeStore.getState().setSelectedHauler(hauler);
        });
      },
      onHover: onTrailHover || (() => {}),
      updateTriggers: {
        getColor: [selectedHauler],
      },
    });
  }, [tripsData, selectedHauler, currentProgress, onTrailHover]);

  const replayLayers = useMemo(() => {
    const layers = [];
    if (tripsLayer) layers.push(tripsLayer);
    if (replayMarkerLayers && replayMarkerLayers.length > 0) {
      layers.push(...replayMarkerLayers);
    }
    layers.push(...loaderBoundaryLayers);
    return layers;
  }, [tripsLayer, replayMarkerLayers, loaderBoundaryLayers]);

  return replayLayers;
};

export default useReplayVisualizationV2;
