import { useState, useEffect, useMemo } from 'react';
import Map from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { getOrthoApiUrl, getOrthoTileUrl, getKmlPath } from '../../config/mapConfig';
import { sanitizeViewState } from '../../utils/geo';
import { useKml } from '../../hooks/useKml';
import { useDeckGlLayers } from '../../hooks/useDeckGlLayers';
import useCycleTimeStore from '../../stores/cycleTimeStore';

const DEFAULT_VIEW_STATE = {
  longitude: 117.28,
  latitude: 1.91,
  zoom: 16,
  pitch: 0,
  bearing: 0
};

const MapContainer = ({
  layerState,
  district,
  viewState,
  onViewStateChange,
  onSetViewState,
  liveUnitData = [],
  liveTrailsData = [],
  onUnitClick,
  onMapClick,
  kmlContext = null,
  pitStopData = null,
  underspeedData = [],
  speedVisibility = {},
  unitVisibility = {},
  speedRanges = [],
  replayLayers = [],
  basemap = 'satellite',
}) => {
  const [orthoTileUrl, setOrthoTileUrl] = useState(null);
  const { trackingData, excavatorPositions } = useCycleTimeStore();
  const resolvedDistrict = district || (import.meta.env.DEV ? 'BRCB' : '');

  useEffect(() => {
    if (!resolvedDistrict) return;
    const fetchOrthoLayer = async () => {
      try {
        const apiUrl = await getOrthoApiUrl(resolvedDistrict);
        const response = await fetch(apiUrl);
        if (!response.ok) return;
        const result = await response.json();
        const latestLayer = result.layers
          ?.filter(layer => layer.converted === true)
          .sort((a, b) => new Date(b.uploadedAt || b.createdAt || 0) - new Date(a.uploadedAt || a.createdAt || 0))[0];
        if (latestLayer) {
          const tileUrl = await getOrthoTileUrl(latestLayer.tileUrl, resolvedDistrict);
          setOrthoTileUrl(tileUrl);
        }
      } catch (error) {
        console.error('Failed to fetch ortho layer:', error);
      }
    };
    fetchOrthoLayer();
  }, [resolvedDistrict]);

  const boundariesData = useKml(getKmlPath('boundaries', resolvedDistrict, kmlContext), layerState.boundaries);
  const roadsData = useKml(getKmlPath('roads', resolvedDistrict, kmlContext), layerState.roads);

  // Guard terakhir sebelum ke maplibre: lon/lat di luar rentang (sentinel rover
  // -8888 / swap lat-lon) bikin maplibre throw & peta crash. Jatuhkan ke default.
  const currentViewState = sanitizeViewState(viewState, DEFAULT_VIEW_STATE);

  const layers = useDeckGlLayers({
    layerState, boundariesData, roadsData, underspeedData, speedVisibility,
    unitVisibility, speedRanges, pitStopData, liveUnitData, liveTrailsData, onUnitClick,
    viewState: currentViewState,
    onSetViewState: onSetViewState,
    cycleTimeTrackingData: trackingData,
    cycleTimeExcavatorPositions: excavatorPositions,
  });

  // Combine with replay layers if provided
  const allLayers = useMemo(() => [...layers, ...replayLayers], [layers, replayLayers]);

  const mapStyle = useMemo(() => {
    const light = basemap === 'light';
    const baseTiles = light
      ? ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png']
      : ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];
    return {
      version: 8,
      sources: {
        'base-tiles': { type: 'raster', tiles: baseTiles, tileSize: 256 },
        ...(orthoTileUrl && layerState.orthophoto && { 'ortho-source': { type: 'raster', tiles: [orthoTileUrl], tileSize: 256 } }),
      },
      layers: [
        // bg netral (DESIGN.md #e9edf1) — kelihatan saat tile basemap gagal/loading
        { id: 'neutral-bg', type: 'background', paint: { 'background-color': '#e9edf1' } },
        { id: 'base-background', type: 'raster', source: 'base-tiles' },
        ...(orthoTileUrl && layerState.orthophoto ? [{ id: 'ortho-layer', type: 'raster', source: 'ortho-source', paint: { 'raster-opacity': 0.9 } }] : []),
      ],
    };
  }, [orthoTileUrl, layerState.orthophoto, basemap]);
  
  return (
    <DeckGL
      viewState={currentViewState}
      onViewStateChange={onViewStateChange}
      controller={true}
      layers={allLayers}
      onClick={onMapClick}
      useDevicePixels={false}
    >
      <Map
        {...currentViewState}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        mapLib={maplibregl}
        onError={() => {}}
        transformRequest={(url) => {
          if (url.includes('api-ortho')) {
            return { url, credentials: 'omit' };
          }
          return { url };
        }}
      />
    </DeckGL>
  );
};

export default MapContainer;
