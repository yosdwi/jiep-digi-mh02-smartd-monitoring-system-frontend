import { useMemo } from 'react';
import { GeoJsonLayer, TextLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import Supercluster from 'supercluster';
import { WebMercatorViewport } from 'deck.gl';
import {
  useIconMarkerLayers,
  useClusterMarkerLayer,
  createMarkerConfig,
  useEnhancedIconMarkerLayers,
  createEnhancedMarkerConfig,
  enhanceDataWithHeading,
  DEFAULT_UNIT_TYPE_MAP
} from '../components/shared/IconMarker';

const UNIT_TYPE_MAP = DEFAULT_UNIT_TYPE_MAP;

const getSpeedRange = (speed, speedRanges) => {
  if (speed === 0) return 'zero';
  for (const range of speedRanges) { if (speed >= range.min && speed <= range.max) return range.range; }
  return null;
};
const getSpeedColor = (speed, speedRanges) => {
  const rangeInfo = speedRanges.find(r => speed >= r.min && speed <= r.max);
  return rangeInfo ? rangeInfo.color.match(/\w\w/g).map(x => parseInt(x, 16)) : [128, 128, 128];
};

export const useDeckGlLayers = ({
  layerState, boundariesData, roadsData, underspeedData, speedVisibility,
  unitVisibility, speedRanges, pitStopData, liveUnitData, liveTrailsData,
  onUnitClick, onSetViewState, viewState,
  cycleTimeTrackingData, cycleTimeExcavatorPositions,
}) => {

  const clusterIndex = useMemo(() => {
    if (!liveUnitData || liveUnitData.length === 0) return null;

    const sc = new Supercluster({
      radius: 20,
      maxZoom: 16,
    });

    const validPoints = liveUnitData
      .filter(unit => {
        const lat = parseFloat(unit.latitude);
        const lng = parseFloat(unit.longitude);
        return !isNaN(lat) && !isNaN(lng) &&
               lat >= -90 && lat <= 90 &&
               lng >= -180 && lng <= 180;
      })
      .map(unit => ({
        type: 'Feature',
        properties: { ...unit, cluster: false },
        geometry: { type: 'Point', coordinates: [parseFloat(unit.longitude), parseFloat(unit.latitude)] }
      }));

    if (validPoints.length === 0) return null;

    sc.load(validPoints);
    return sc;
  }, [liveUnitData]);

  const clustersAndPoints = useMemo(() => {
    if (!viewState || !clusterIndex) return [];

    // Validate viewState coordinates
    const lat = viewState.latitude;
    const lng = viewState.longitude;
    const zoom = viewState.zoom;

    if (!lat || !lng || !zoom ||
        lat < -90 || lat > 90 ||
        lng < -180 || lng > 180 ||
        zoom < 0 || zoom > 24) {
      return [];
    }

    try {
      const viewport = new WebMercatorViewport(viewState);
      const bounds = viewport.getBounds();

      const clusters = clusterIndex.getClusters(bounds, Math.floor(viewState.zoom));

      return clusters.map(cluster => {
        if (cluster.properties.cluster) {
          const leaves = clusterIndex.getLeaves(cluster.properties.cluster_id, Infinity);
          const typeCounts = leaves.reduce((acc, leaf) => {
            const type = leaf.properties.deviceType || 'N/A';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});
          cluster.properties.typeCounts = typeCounts;
        }
        return cluster;
      });
    } catch (error) {
      console.error('Error creating viewport or clusters:', error);
      return [];
    }

  }, [viewState, clusterIndex]);
  const clusterLayers = useClusterMarkerLayer({
    data: clustersAndPoints?.filter(p => p.properties.cluster) || [],
    id: 'cluster-layer',
    getPosition: d => d.geometry.coordinates,
    getText: d => Object.entries(d.properties.typeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join('\n'),
    onClick: (info) => {
      if (clusterIndex && onSetViewState) {
        const expansionZoom = clusterIndex.getClusterExpansionZoom(info.object.properties.cluster_id);
        onSetViewState({
          longitude: info.object.geometry.coordinates[0],
          latitude: info.object.geometry.coordinates[1],
          zoom: expansionZoom + 0.5,
          pitch: 0,
          transitionDuration: 1000,
        });
      }
    }
  });

  const individualUnitLayers = useEnhancedIconMarkerLayers(
    createEnhancedMarkerConfig({
      data: clustersAndPoints?.filter(p => !p.properties.cluster) || [],
      id: 'individual-unit',
      zoom: viewState?.zoom || 17,
      positionFields: { longitude: 'geometry.coordinates.0', latitude: 'geometry.coordinates.1' },
      customGetPosition: d => d.geometry.coordinates,
      customGetText: d => d.properties.unitNo,
      customGetDeviceType: d => d.properties.deviceType,
      customGetStatus: d => {
        if (d.properties.lastSpeed > 0) return 'moving';
        return 'idle';
      },
      customGetHeading: d => d.properties.calculatedHeading || d.properties.heading || 0,
      onClick: (info) => onUnitClick && onUnitClick({ object: info.object.properties }),
      unitTypeMap: UNIT_TYPE_MAP,
    })
  );

  const cycleTimePathData = useMemo(() =>
    cycleTimeTrackingData?.length > 0
      ? [{ path: cycleTimeTrackingData.map(p => [p.Longitude, p.Latitude]) }]
      : [],
    [cycleTimeTrackingData]
  );

  const excavatorMarkerLayers = useEnhancedIconMarkerLayers(
    createEnhancedMarkerConfig({
      data: cycleTimeExcavatorPositions || [],
      id: 'cycle-time-excavator',
      zoom: viewState?.zoom || 12,
      positionFields: { longitude: 'Longitude', latitude: 'Latitude' },
      customGetText: d => d.UnitNo || 'EX',
      customGetDeviceType: () => 'EX',
      customGetStatus: () => 'idle',
      customGetHeading: () => 0,
      onClick: (info) => console.log('Excavator clicked:', info.object),
      unitTypeMap: UNIT_TYPE_MAP,
    })
  );

  return useMemo(() => {
    const deckLayers = [];

    // 1. Background layers first (bottom)
    if (layerState.boundaries && boundariesData.data) {
      const boundaryWidth = Math.max(2, Math.min(6, (viewState?.zoom || 12) - 9));
      deckLayers.push(new GeoJsonLayer({
        id: 'boundaries-layer',
        data: boundariesData.data,
        stroked: true,
        filled: true,
        lineWidthMinPixels: 2,
        lineWidthMaxPixels: 8,
        getLineColor: [255, 50, 50, 240],
        getFillColor: [255, 50, 50, 30],
        getLineWidth: boundaryWidth,
        widthScale: 1,
        updateTriggers: {
          getLineWidth: [viewState?.zoom],
        },
      }));
    }

    if (layerState.roads && roadsData.data) {
      const currentZoom = viewState?.zoom || 12;
      const roadWidth = Math.max(3, Math.min(15, currentZoom - 8));
      deckLayers.push(new GeoJsonLayer({
        id: 'roads-layer',
        data: roadsData.data,
        stroked: true,
        lineWidthMinPixels: 2,
        lineWidthMaxPixels: 15,
        getLineColor: [0, 0, 0, 255],
        getLineWidth: roadWidth,
        widthScale: 1,
        lineCapRounded: true,
        lineJointRounded: true,
        updateTriggers: {
          getLineWidth: [currentZoom],
        },
      }));
    }

    if (layerState.pitStops && pitStopData) {
      deckLayers.push(new GeoJsonLayer({
        id: 'pitstops-layer',
        data: pitStopData,
        stroked: true,
        filled: true,
        lineWidthMinPixels: 2,
        getLineColor: [128, 0, 128, 200],
        getFillColor: [128, 0, 128, 50]
      }));
    }

    // 2. Trail layers (middle)
    if (liveTrailsData && liveTrailsData.length > 0) {
      deckLayers.push(new PathLayer({
        id: 'live-trails-layer',
        data: liveTrailsData,
        pickable: false,
        getPath: d => d,
        getColor: [255, 165, 0, 200],
        getWidth: 2
      }));
    }

    if (cycleTimePathData.length > 0) {
      deckLayers.push(new PathLayer({
        id: 'cycle-time-tracking-path',
        data: cycleTimePathData,
        pickable: true,
        widthScale: 2,
        widthMinPixels: 2,
        getPath: d => d.path,
        getColor: [52, 152, 219, 255],
        getWidth: 2,
      }));
    }

    // 3. Data point layers
    if (underspeedData.length > 0) {
      const visibleData = underspeedData.filter(p => unitVisibility[p.unit] && speedVisibility[getSpeedRange(p.speed, speedRanges)]);
      deckLayers.push(new GeoJsonLayer({
        id: 'underspeed-layer',
        data: visibleData.map(d => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
          properties: d
        })),
        pointType: 'circle',
        getFillColor: d => getSpeedColor(d.properties.speed, speedRanges),
        getPointRadius: 8,
        radiusMinPixels: 3,
        pickable: true,
        onHover: info => {
          if (info.object) {
            info.layer.deck.setProps({
              getTooltip: () => ({
                html: `<strong>Unit:</strong> ${info.object.properties.unit}<br/><strong>Kecepatan:</strong> ${info.object.properties.speed} km/jam`
              })
            });
          }
        }
      }));
    }

    // 4. Unit markers 
    if (excavatorMarkerLayers && excavatorMarkerLayers.length > 0) {
      deckLayers.push(...excavatorMarkerLayers);
    }
    if (clusterLayers) {
      deckLayers.push(clusterLayers);
    }
    if (individualUnitLayers && individualUnitLayers.length > 0) {
      deckLayers.push(...individualUnitLayers);
    }

    const currentZoom = viewState?.zoom || 12;

    if (layerState.boundaries && boundariesData.labels && boundariesData.labels.length > 0 && currentZoom >= 12) {
      const boundaryLabelSize = Math.max(14, Math.min(20, currentZoom));
      deckLayers.push(new TextLayer({
        id: 'boundary-labels',
        data: boundariesData.labels,
        getPosition: d => d.position,
        getText: d => d.text,
        getSize: boundaryLabelSize,
        getColor: [255, 255, 255, 255],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontWeight: '900',
        getOutlineColor: [0, 0, 0, 255],
        getOutlineWidth: 4,
        billboard: true,
        sizeScale: 1,
        sizeMinPixels: 14,
        sizeMaxPixels: 28,
        characterSet: 'auto',
        updateTriggers: {
          getSize: [currentZoom],
        },
      }));
    }

    if (layerState.roads && roadsData.labels && roadsData.labels.length > 0 && currentZoom >= 14) {
      const roadLabelSize = Math.max(12, Math.min(18, currentZoom - 2));
      deckLayers.push(new TextLayer({
        id: 'roads-labels',
        data: roadsData.labels,
        getPosition: d => d.position,
        getText: d => d.text,
        getSize: roadLabelSize,
        getColor: [255, 255, 0, 255],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        fontFamily: 'Arial Bold, Arial, sans-serif',
        fontWeight: '800',
        getOutlineColor: [0, 0, 0, 255],
        getOutlineWidth: 3,
        billboard: true,
        sizeScale: 1,
        sizeMinPixels: 12,
        sizeMaxPixels: 24,
        characterSet: 'auto',
        updateTriggers: {
          getSize: [currentZoom],
        },
      }));
    }

    return deckLayers;
  }, [
    layerState, boundariesData, roadsData, underspeedData, speedVisibility,
    unitVisibility, speedRanges, pitStopData, liveTrailsData, onUnitClick,
    onSetViewState, clustersAndPoints, viewState, clusterIndex,
    cycleTimePathData, excavatorMarkerLayers, clusterLayers, individualUnitLayers
  ]);
};
