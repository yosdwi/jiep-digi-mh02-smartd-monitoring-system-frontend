import { memo, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

import { getOrthoApiUrl, getOrthoTileUrl, getKmlPath } from '../../config/mapConfig';
import { sanitizeViewState } from '../../utils/geo';
import { useKml } from '../../hooks/useKml';
import { useDeckGlLayers } from '../../hooks/useDeckGlLayers';
import useReplayVisualizationV2 from '../../hooks/useReplayVisualizationV2';
import useCycleTimeStore from '../../stores/cycleTimeStore';
import { useRenderCounter, usePlaybackFrameTiming } from '../../hooks/usePlaybackPerfDebug';

const DEFAULT_VIEW_STATE = {
  longitude: 117.28,
  latitude: 1.91,
  zoom: 13,
  pitch: 0,
  bearing: 0
};

const ORIGIN_SHIFT = 20037508.342789244;

// The ortho service stores layer bounds in Web Mercator metres (they're read
// straight off the reprojected COG). deck.gl's TileLayer `extent` wants the
// layer's own coordinate system, i.e. lon/lat. Values already inside ±180 are
// assumed to be degrees already — some layers predate the reprojection step.
const toLngLatExtent = (layer) => {
  const { boundsMinX, boundsMinY, boundsMaxX, boundsMaxY } = layer;
  if (![boundsMinX, boundsMinY, boundsMaxX, boundsMaxY].every(Number.isFinite)) return null;

  if (Math.abs(boundsMaxX) <= 180 && Math.abs(boundsMaxY) <= 90) {
    return [boundsMinX, boundsMinY, boundsMaxX, boundsMaxY];
  }

  const toLng = (x) => (x / ORIGIN_SHIFT) * 180;
  const toLat = (y) => {
    const deg = (y / ORIGIN_SHIFT) * 180;
    return (180 / Math.PI) * (2 * Math.atan(Math.exp((deg * Math.PI) / 180)) - Math.PI / 2);
  };

  return [toLng(boundsMinX), toLat(boundsMinY), toLng(boundsMaxX), toLat(boundsMaxY)];
};

// deck.gl hands back a viewState carrying transition bookkeeping; only these
// five fields are safe to merge into the next camera command.
const pickCamera = (vs) => ({
  longitude: vs.longitude,
  latitude: vs.latitude,
  zoom: vs.zoom,
  pitch: vs.pitch ?? 0,
  bearing: vs.bearing ?? 0,
});

// Lite variant of MapContainer for pages whose visible content is just the
// orthophoto raster + deck.gl vector layers (tracking paths, markers, boundaries).
// No maplibre-gl/react-map-gl: one WebGL context instead of two, and the ortho
// raster is the only tile pyramid fetched (MapContainer's maplibre style always
// also loads a second ArcGIS/OSM `base-tiles` source underneath it).
//
// The camera is UNCONTROLLED: deck.gl's own controller owns it, and React never
// sees a pan or zoom gesture. The previous shape — `viewState` held in the page
// component and written from `onViewStateChange` — re-rendered the entire page
// (and its whole MUI/Emotion subtree) on every pointermove during a drag, which
// is what made panning feel heavy even with playback stopped. deck.gl's own docs
// note that controlled viewState "will cause a re-render on every interaction".
//
// Programmatic camera moves still work: `cameraCommand` is a low-frequency prop
// (unit focus, auto-follow at ~1Hz). Changing it re-sets deck.gl's internal view
// state, because Deck overwrites its view state whenever `initialViewState`
// deep-compares unequal (@deck.gl/core lib/deck.js).
const MapContainerLite = memo(({
  layerState,
  district,
  cameraCommand = null,
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
  onTrailHover,
}) => {
  useRenderCounter('MapContainerLite (map)');
  usePlaybackFrameTiming();
  const [ortho, setOrtho] = useState(null);

  // Live camera, updated on every gesture but kept OUT of React state.
  const viewStateRef = useRef(DEFAULT_VIEW_STATE);
  // What deck.gl is told to jump to. Only changes on programmatic moves.
  const [appliedCamera, setAppliedCamera] = useState(DEFAULT_VIEW_STATE);
  // Layers only need the camera for level-of-detail, so publish it quantised to
  // whole zoom levels. A pan produces no React state change at all; a zoom
  // produces at most one per integer level crossed.
  const [zoomBucket, setZoomBucket] = useState(Math.round(DEFAULT_VIEW_STATE.zoom));

  const zoomBucketRef = useRef(Math.round(DEFAULT_VIEW_STATE.zoom));

  const handleViewStateChange = useCallback(({ viewState: next }) => {
    viewStateRef.current = next;
    const bucket = Math.round(next.zoom);
    if (bucket === zoomBucketRef.current) return;
    zoomBucketRef.current = bucket;
    // deck.gl fires this synchronously from inside DeckGL's own render, so a
    // direct setState here is a "cannot update a component while rendering a
    // different component" violation. The ref above already absorbed the value;
    // publishing it to React one microtask later is enough.
    queueMicrotask(() => setZoomBucket(bucket));
  }, []);

  const moveCamera = useCallback((target) => {
    setAppliedCamera({ ...pickCamera(viewStateRef.current), ...target });
  }, []);

  useEffect(() => {
    if (cameraCommand) moveCamera(cameraCommand);
  }, [cameraCommand, moveCamera]);
  const trackingData = useCycleTimeStore((state) => state.trackingData);
  const excavatorPositions = useCycleTimeStore((state) => state.excavatorPositions);
  const resolvedDistrict = district || (import.meta.env.DEV ? 'BRCB' : '');

  useEffect(() => {
    if (!resolvedDistrict) return;
    const fetchOrthoLayer = async () => {
      try {
        const apiUrl = await getOrthoApiUrl(resolvedDistrict);
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
        if (!response.ok) return;
        const result = await response.json();
        const latestLayer = result.layers
          ?.filter(layer => layer.converted === true)
          .sort((a, b) => new Date(b.uploadedAt || b.createdAt || 0) - new Date(a.uploadedAt || a.createdAt || 0))[0];
        if (latestLayer) {
          const tileUrl = await getOrthoTileUrl(latestLayer.tileUrl, resolvedDistrict);
          setOrtho({
            url: tileUrl,
            extent: toLngLatExtent(latestLayer),
            maxZoom: Number.isFinite(latestLayer.maxZoom) ? latestLayer.maxZoom : 18,
          });
        }
      } catch (error) {
        console.error('Failed to fetch ortho layer:', error);
      }
    };
    fetchOrthoLayer();
  }, [resolvedDistrict]);

  const boundariesData = useKml(getKmlPath('boundaries', resolvedDistrict, kmlContext), layerState.boundaries);
  const roadsData = useKml(getKmlPath('roads', resolvedDistrict, kmlContext), layerState.roads);

  const initialViewState = useMemo(
    () => sanitizeViewState(appliedCamera, DEFAULT_VIEW_STATE),
    [appliedCamera]
  );

  // Stable across a pan: only the quantised zoom (and programmatic moves) can
  // change it, so the layer list below is not rebuilt on every pointermove.
  const layerViewState = useMemo(
    () => ({ ...initialViewState, zoom: zoomBucket }),
    [initialViewState, zoomBucket]
  );

  const vectorLayers = useDeckGlLayers({
    layerState, boundariesData, roadsData, underspeedData, speedVisibility,
    unitVisibility, speedRanges, pitStopData, liveUnitData, liveTrailsData, onUnitClick,
    viewState: layerViewState,
    onSetViewState: moveCamera,
    cycleTimeTrackingData: trackingData,
    cycleTimeExcavatorPositions: excavatorPositions,
  });

  // Called here (not in the parent page) on purpose: this hook subscribes to
  // the RAF-frequency playhead (useSyncExternalStore, see
  // playbackAnimationRuntime.js). Calling it from the page component would
  // make the *entire page* re-render at ~60fps during playback; calling it
  // here confines that to just this component, which needs to re-render every
  // frame anyway to feed deck.gl new positions/currentTime.
  const replayLayers = useReplayVisualizationV2(zoomBucket, onTrailHover);

  const orthoLayer = useMemo(() => {
    if (!ortho?.url || !layerState.orthophoto) return null;
    return new TileLayer({
      id: 'ortho-tile-layer',
      data: ortho.url,
      minZoom: 0,
      // The ortho pyramid only goes to this level. Asking for deeper tiles made
      // the service fork a gdal_translate per tile for zoom levels the source
      // doesn't have; capping here makes deck.gl over-zoom the deepest real
      // tiles instead, which is both correct and free.
      maxZoom: ortho.maxZoom,
      // Never request tiles outside the ortho footprint. Those came back as
      // uncached 404s, so every pan re-asked the service for the same empty
      // tiles forever.
      ...(ortho.extent ? { extent: ortho.extent } : {}),
      tileSize: 256,
      // Default TileLayer fetch has no request timeout — a hung/unreachable
      // ortho service (real risk: dev network here, or a flaky service in
      // prod) leaves each failed tile occupying one of the browser's ~6
      // per-origin connection slots for the OS's full TCP timeout (can be
      // 20s+), starving every other request through the same origin. Give
      // tiles a short leash instead.
      getTileData: async ({ url, signal }) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const onParentAbort = () => controller.abort();
        signal?.addEventListener('abort', onParentAbort);
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Ortho tile ${response.status}`);
          const blob = await response.blob();
          return await createImageBitmap(blob);
        } finally {
          clearTimeout(timeoutId);
          signal?.removeEventListener('abort', onParentAbort);
        }
      },
      onTileError: () => {}, // best-effort layer — a missing tile just leaves a gap
      renderSubLayers: (props) => {
        const { west, south, east, north } = props.tile.bbox;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north],
        });
      },
    });
  }, [ortho, layerState.orthophoto]);

  const allLayers = useMemo(
    () => [...(orthoLayer ? [orthoLayer] : []), ...vectorLayers, ...replayLayers],
    [orthoLayer, vectorLayers, replayLayers]
  );

  return (
    <div style={{ width: '100%', height: '100%', background: '#e9edf1' }}>
      <DeckGL
        initialViewState={initialViewState}
        onViewStateChange={handleViewStateChange}
        controller={true}
        layers={allLayers}
        onClick={onMapClick}
        useDevicePixels={false}
      />
    </div>
  );
});

MapContainerLite.displayName = 'MapContainerLite';

export default MapContainerLite;
