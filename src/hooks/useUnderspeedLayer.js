import { useEffect } from 'react';

const getSpeedRange = (speed, speedRanges) => {
  if (speed === 0) return 'zero';
  for (const range of speedRanges) {
    if (speed >= range.min && speed <= range.max) {
      return range.range;
    }
  }
  return null;
};

const getSpeedColor = (speed, speedRanges) => {
  const rangeInfo = speedRanges.find(r => speed >= r.min && speed <= r.max);
  return rangeInfo ? rangeInfo.color : '#808080'; // Default gray
};

export const useUnderspeedLayer = ({ 
  map, 
  isMapLoaded, 
  underspeedData, 
  speedVisibility, 
  unitVisibility, 
  speedRanges 
}) => {
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    const sourceId = 'underspeed-source';
    const layerId = 'underspeed-points-layer';

    // 1. Filter data based on visibility toggles
    const visibleData = underspeedData.filter(point => {
      const speedRange = getSpeedRange(point.speed, speedRanges);
      return unitVisibility[point.unit] && speedRange && speedVisibility[speedRange];
    });

    // 2. Convert to GeoJSON format
    const geojsonData = {
      type: 'FeatureCollection',
      features: visibleData.map(point => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lon, point.lat],
        },
        properties: {
          ...point,
          color: getSpeedColor(point.speed, speedRanges),
        },
      })),
    };

    // 3. Add or update the map source and layer
    const source = map.getSource(sourceId);
    if (source) {
      source.setData(geojsonData);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData,
      });

      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    // Set layer visibility based on whether there's data to show
    const layer = map.getLayer(layerId);
    if (layer) {
      const visibility = geojsonData.features.length > 0 ? 'visible' : 'none';
      if (map.getLayoutProperty(layerId, 'visibility') !== visibility) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }

    // No explicit cleanup needed here as we are re-using and updating the same source/layer
  }, [map, isMapLoaded, underspeedData, speedVisibility, unitVisibility, speedRanges]);
};
