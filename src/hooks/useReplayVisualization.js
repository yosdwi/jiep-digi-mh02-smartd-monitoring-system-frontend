import { useMemo } from 'react';
import { PathLayer } from '@deck.gl/layers';
import { circle } from '@turf/turf';
import useCycleTimeStore from '../stores/cycleTimeStore';
import {
  useEnhancedIconMarkerLayers,
  createEnhancedMarkerConfig,
  DEFAULT_UNIT_TYPE_MAP
} from '../components/shared/IconMarker';
import { handleTrailClick } from '../components/shared/TrailTooltip';
import { useBearingLogic, interpolateAngle } from './useBearingLogic';

// Sentinel/invalid GPS values (e.g. -8888, -8887, 0,0) produce huge "loncat"
// jumps across the map. Only keep points whose coordinates are real fixes.
const isValidCoord = (lng, lat) => {
  if (typeof lng !== 'number' || typeof lat !== 'number') return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false; // excludes -8888 / -8887
  if (lng === 0 && lat === 0) return false; // null island
  return true;
};

// Maximum allowed gap (in degrees) between two consecutive fixes before we treat
// it as a GPS glitch and break the trail instead of drawing a line across the pit.
// ~0.01 deg ≈ 1.1 km, well above normal point-to-point spacing for a hauler.
const MAX_TRAIL_JUMP_DEG = 0.01;

const isTrailJump = (a, b) =>
  Math.abs(a.longitude - b.longitude) > MAX_TRAIL_JUMP_DEG ||
  Math.abs(a.latitude - b.latitude) > MAX_TRAIL_JUMP_DEG;

const getTrailColorBySpeedDeviation = (currentSpeed, targetSpeed) => {
  if (currentSpeed >= 30) {
    return [59, 130, 246, 255];   // blue
  } else if (currentSpeed >= 25) {
    return [34, 197, 94, 255];    // green
  } else if (currentSpeed >= 20) {
    return [251, 191, 36, 255];   // amber
  } else if (currentSpeed >= 10) {
    return [139, 69, 19, 255];    // brown
  } else {
    return [239, 68, 68, 255];    // red
  }
};

export const useReplayVisualization = (viewState = {}, onTrailHover = null, setViewState = null) => {
  const {
    trackingData,
    excavatorPositions,
    selectedHauler,
    currentProgress,
    getStatusColor,
    summary,
    filters,
    selectedLoader,
  } = useCycleTimeStore();

  const sortedHaulerData = useMemo(() => {
    if (!trackingData || trackingData.length === 0) return {};

    const haulerMap = {};
    trackingData.forEach(point => {
      // Drop sentinel/invalid GPS fixes so they never get drawn into a trail.
      if (!isValidCoord(point.longitude, point.latitude)) return;
      if (!haulerMap[point.unitNo]) {
        haulerMap[point.unitNo] = [];
      }
      haulerMap[point.unitNo].push(point);
    });

    Object.keys(haulerMap).forEach(hauler => {
      haulerMap[hauler].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    return haulerMap;
  }, [trackingData]);

  const processedHaulerData = useBearingLogic(sortedHaulerData);


  const interpolatePosition = (point1, point2, progress) => {
    if (!point1 || !point2) return point1;

    return {
      longitude: point1.longitude + (point2.longitude - point1.longitude) * progress,
      latitude: point1.latitude + (point2.latitude - point1.latitude) * progress,
      ...point1,
    };
  };

  const getLoaderPositions = useMemo(() => {
    // Only show loader if one is selected from filter modal
    if (!selectedLoader || !excavatorPositions || excavatorPositions.length === 0 || !trackingData) return [];

    // Get current playback time from selected hauler data
    const selectedHaulerData = selectedHauler
      ? processedHaulerData[selectedHauler]
      : Object.values(processedHaulerData)[0];

    if (!selectedHaulerData || selectedHaulerData.length === 0) return [];

    const progressRatio = currentProgress / 100;
    const currentDataIndex = Math.floor(progressRatio * (selectedHaulerData.length - 1));
    const currentTime = selectedHaulerData[currentDataIndex]?.timestamp;

    if (!currentTime) return [];

    // Sort all excavator positions by timestamp
    const allPositions = [...excavatorPositions].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Find the position closest to current playback time
    let closestPosition = null;
    let minTimeDiff = Infinity;

    allPositions.forEach(pos => {
      const timeDiff = Math.abs(new Date(pos.timestamp) - new Date(currentTime));
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPosition = pos;
      }
    });

    if (!closestPosition) return [];

    return [{
      longitude: closestPosition.longitude,
      latitude: closestPosition.latitude,
      unitNo: selectedLoader.value, // Use selected loader name
      deviceType: 'EX',
      status: 'active',
      isLoader: true,
    }];
  }, [excavatorPositions, currentProgress, processedHaulerData, selectedHauler, trackingData, selectedLoader]);

  const currentPositions = useMemo(() => {
    if (!trackingData || trackingData.length === 0 || !processedHaulerData) return [];

    const haulerList = Object.keys(processedHaulerData);
    return haulerList.map(hauler => {
      const haulerData = processedHaulerData[hauler];

      if (!haulerData.length) return null;

      const progressRatio = currentProgress / 100;
      const exactIndex = progressRatio * (haulerData.length - 1);
      const lowerIndex = Math.floor(exactIndex);
      const upperIndex = Math.min(lowerIndex + 1, haulerData.length - 1);
      const localProgress = exactIndex - lowerIndex;

      const currentPoint = haulerData[lowerIndex];
      const nextPoint = haulerData[upperIndex];

      let interpolatedPoint;
      let heading = 0;

      if (localProgress > 0 && nextPoint && currentPoint) {
        interpolatedPoint = interpolatePosition(currentPoint, nextPoint, localProgress);
        heading = interpolateAngle(currentPoint.bearing, nextPoint.bearing, localProgress);
      } else {
        interpolatedPoint = currentPoint;
        if (interpolatedPoint) {
          heading = interpolatedPoint.bearing;
        }
      }

      if (!interpolatedPoint || !interpolatedPoint.longitude || !interpolatedPoint.latitude) return null;

      return {
        longitude: interpolatedPoint.longitude,
        latitude: interpolatedPoint.latitude,
        unitNo: interpolatedPoint.unitNo,
        deviceType: 'DT',
        status: interpolatedPoint.plm_status === 0 ? 'moving' :
                interpolatedPoint.plm_status === 1 || interpolatedPoint.plm_status === 5 ? 'idle' : 'moving',
        speed: interpolatedPoint.speed || interpolatedPoint.vehiclespeed || 0,
        heading: heading,
        isSelected: false, // Remove selection status highlighting
      };
    }).filter(Boolean);
  }, [processedHaulerData, selectedHauler, currentProgress]);

  const allMarkerPositions = useMemo(() => {
    return [...currentPositions, ...getLoaderPositions];
  }, [currentPositions, getLoaderPositions]);

  const replayMarkerLayers = useEnhancedIconMarkerLayers(
    createEnhancedMarkerConfig({
      data: allMarkerPositions,
      id: 'replay-markers',
      zoom: viewState?.zoom || 16,
      unitNoField: 'unitNo',
      deviceTypeField: 'deviceType',
      statusField: 'status',
      headingField: 'heading',
      customGetText: d => {
        if (d.isLoader || d.deviceType === 'EX') {
          return selectedLoader ? selectedLoader.value : '';
        }
        return d.unitNo?.toString().split('-')[1] || d.unitNo;
      },
      customGetHeading: d => d.heading || 0,
      customGetStatus: d => {
        // Special status for loader (excavator)
        if (d.isLoader) {
          return 'loader';
        }
        // Remove special highlighting for selected haulers
        return d.status;
      },
      pickable: true,
      onClick: (info) => {
        const clickedUnit = info.object;
        if (clickedUnit && clickedUnit.unitNo) {
          const store = useCycleTimeStore.getState();
          store.setSelectedHauler(clickedUnit.unitNo);

          // Fly to selected unit
          if (setViewState) {
            setViewState(prevState => ({
              ...prevState,
              longitude: clickedUnit.longitude,
              latitude: clickedUnit.latitude,
              zoom: Math.max(prevState.zoom || 16, 16),
              transitionDuration: 1000
            }));
          }
        }
      },
      unitTypeMap: DEFAULT_UNIT_TYPE_MAP,
      statusColorMap: {
        moving: [46, 204, 113, 255],
        idle: [243, 156, 18, 255],
        down: [231, 76, 60, 255],
        loader: [255, 165, 0, 255], // Orange loader with full opacity
        default: [200, 200, 200, 255],
      },
      lodConfig: {
        ZOOM_THRESHOLD: 14,
        DOT_SIZE: 10,
        ICON_SIZE: 40, // Increased from 30 to 40
        LABEL_SIZE: 14, // Increased label size for better readability
      },
    })
  );

  const loaderBoundaryLayers = useMemo(() => {
    if (getLoaderPositions.length === 0) return [];

    const boundaryData = getLoaderPositions.map(loader => {
      const circleGeo = circle([loader.longitude, loader.latitude], 0.02, { units: 'kilometers' });
      return {
        path: circleGeo.geometry.coordinates[0],
        unitNo: loader.unitNo,
        isLoader: true,
      };
    });

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
          getPath: [currentProgress],
        },
      })
    ];
  }, [getLoaderPositions, currentProgress]);

  const replayLayers = useMemo(() => {
    if (!trackingData || trackingData.length === 0) return [...(replayMarkerLayers || []), ...loaderBoundaryLayers];

    const layers = [];

    const allTrailSegments = Object.keys(processedHaulerData).flatMap(hauler => {
      const haulerData = processedHaulerData[hauler];
      const targetSpeed = useCycleTimeStore.getState().targetSpeedData?.targetSpeed || 0;

      const currentIndex = Math.floor((currentProgress / 100) * haulerData.length);
      const trail = haulerData.slice(0, Math.max(1, currentIndex + 1));

      if (trail.length < 2) return [];

      const segments = [];
      for (let i = 0; i < trail.length - 1; i++) {
        const startPoint = trail[i];
        const endPoint = trail[i+1];

        // Skip glitch segments that would draw a long line across the map.
        if (isTrailJump(startPoint, endPoint)) continue;

        const currentSpeed = startPoint.speed || startPoint.vehiclespeed || 0;
        const color = getTrailColorBySpeedDeviation(currentSpeed);

        segments.push({
          path: [[startPoint.longitude, startPoint.latitude], [endPoint.longitude, endPoint.latitude]],
          color: color,
          width: 10,
          hauler: hauler,
          pointsData: [startPoint, endPoint],
          isActive: true
        });
      }
      return segments;
    });
    
    const backgroundPaths = Object.keys(processedHaulerData).flatMap(hauler => {
        const haulerData = processedHaulerData[hauler];
        const currentIndex = Math.floor((currentProgress / 100) * haulerData.length);
        const trail = haulerData.slice(0, Math.max(1, currentIndex + 1));
        if (trail.length < 2) return [];

        // Split the path wherever a GPS glitch jump occurs so we never draw a
        // straight line bridging the gap.
        const subPaths = [];
        let current = [[trail[0].longitude, trail[0].latitude]];
        for (let i = 1; i < trail.length; i++) {
          if (isTrailJump(trail[i - 1], trail[i])) {
            if (current.length > 1) subPaths.push(current);
            current = [];
          }
          current.push([trail[i].longitude, trail[i].latitude]);
        }
        if (current.length > 1) subPaths.push(current);

        return subPaths.map(path => ({ path, isActive: true, width: 10 }));
    });

    if (backgroundPaths.length > 0) {
      layers.push(new PathLayer({
        id: 'replay-trails-background',
        data: backgroundPaths,
        getPath: d => d.path,
        getColor: [0, 100, 50, 120],
        getWidth: 14,
        widthMinPixels: 6,
        widthMaxPixels: 18,
        rounded: true,
        billboard: false,
        updateTriggers: {
          getPath: [currentProgress, selectedHauler],
          getColor: [selectedHauler],
          getWidth: [selectedHauler],
        },
      }));
    }

    if (allTrailSegments.length > 0) {
      layers.push(new PathLayer({
        id: 'replay-trails',
        data: allTrailSegments,
        getPath: d => d.path,
        getColor: d => d.color,
        getWidth: 10,
        widthMinPixels: 3,
        widthMaxPixels: 14,
        rounded: true,
        billboard: false,
        capRounded: true,
        jointRounded: true,
        pickable: true,
        onClick: (info) => {
          handleTrailClick(info, (hauler) => {
            useCycleTimeStore.getState().setSelectedHauler(hauler);
          });
        },
        onHover: onTrailHover || (() => {}),
        updateTriggers: {
          getPath: [currentProgress, selectedHauler],
          getColor: [currentProgress, selectedHauler, summary?.targetSpeedData],
          getWidth: [selectedHauler],
        },
      }));
    }

    if (replayMarkerLayers && replayMarkerLayers.length > 0) {
      layers.push(...replayMarkerLayers);
    }

    layers.push(...loaderBoundaryLayers);

    return layers;
  }, [processedHaulerData, selectedHauler, currentProgress, getStatusColor, replayMarkerLayers, loaderBoundaryLayers, summary?.targetSpeedData]);

  return replayLayers;
};

export default useReplayVisualization;