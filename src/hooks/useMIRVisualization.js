import { useMemo } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import useMIRStore from '../stores/mirStore';

const useMIRVisualization = (viewState, handleDotHover, filters) => {
  const { trackingData, getDistanceStatusColor, getMirDistanceStatus, getTravelDirection } = useMIRStore();

  const mirLayers = useMemo(() => {
    if (!trackingData || trackingData.length === 0) {
      return [];
    }

    const scatterplotData = trackingData
      .filter(point => point.latitude && point.longitude && point.latitude !== 0 && point.longitude !== 0)
      .map(point => {
        // Gunakan MIR distance status jika tersedia, fallback ke distanceStatus lama
        const mirStatus = getMirDistanceStatus(point.mir_distance, point.mir_in_area, point.mir_unsafe);
        const statusToUse = mirStatus || point.distanceStatus;

        return {
          ...point,
          position: [point.longitude, point.latitude],
          mirDistanceStatus: mirStatus,
          statusToUse: statusToUse,
          color: hexToRgb(getDistanceStatusColor(statusToUse))
        };
      })
      .filter(point => {
        // Apply distance status filter
        if (filters?.distanceFilters && !filters.distanceFilters[point.statusToUse]) {
          return false;
        }

        // Apply GPS quality filter
        if (filters?.gpsFilters && !filters.gpsFilters[point.gpsQuality]) {
          return false;
        }

        // Apply device filter
        if (filters?.deviceFilters && Object.keys(filters.deviceFilters).length > 0) {
          if (!filters.deviceFilters[point.unitNo]) {
            return false;
          }
        }

        // Apply travel direction filter (anomali/null selalu lolos)
        if (filters?.travelDirectionFilters) {
          const direction = getTravelDirection(point.vehiclespeed ?? point.speed, point.shift_indicator);
          if (direction !== null && !filters.travelDirectionFilters[direction]) {
            return false;
          }
        }

        return true;
      });

    return [
      new ScatterplotLayer({
        id: 'mir-movement-dots',
        data: scatterplotData,
        getPosition: d => d.position,
        getRadius: d => Math.max(2, Math.min(4, viewState.zoom * 0.3)),
        getFillColor: d => d.color,
        getLineColor: [255, 255, 255, 120],
        getLineWidth: 0.5,
        radiusScale: 1,
        radiusMinPixels: 2,
        radiusMaxPixels: 6,
        lineWidthMinPixels: 0.5,
        lineWidthMaxPixels: 1,
        pickable: true,
        onHover: handleDotHover,
        updateTriggers: {
          getFillColor: [trackingData],
          getRadius: [viewState.zoom]
        },
        transitions: {
          getRadius: {
            duration: 200,
            easing: t => t * (2 - t)
          },
          getFillColor: {
            duration: 150
          }
        }
      })
    ];
  }, [trackingData, viewState.zoom, handleDotHover, getDistanceStatusColor, getMirDistanceStatus, getTravelDirection, filters]);

  return mirLayers;
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    200
  ] : [100, 100, 100, 200];
}

export default useMIRVisualization;