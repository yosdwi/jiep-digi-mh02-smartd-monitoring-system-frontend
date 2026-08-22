import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { PolygonLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import { EditableGeoJsonLayer, MeasureDistanceMode } from '@deck.gl-community/editable-layers';
import { color as C, rgb } from '../foundation/tokens';

// The single deck.gl surface for the whole product. Live, Cycle Time,
// Underspeed, Durasi In Pit and GIS all mount THIS component and pass different
// layer sets; none of them instantiates its own map.
//
// The camera is UNCONTROLLED. deck.gl's controller owns it and React never sees
// a pan or zoom gesture. Holding viewState in a page component re-rendered that
// page — and its whole MUI/Emotion subtree — on every pointermove of a drag,
// which is what made panning feel heavy in V1/V2 even with playback stopped.
// deck.gl's own docs note controlled viewState "will cause a re-render on every
// interaction".
//
// Programmatic moves still work: `cameraCommand` is a low-frequency prop, and
// deck.gl overwrites its internal view state whenever `initialViewState`
// deep-compares unequal (@deck.gl/core lib/deck.js:323-327).

export const DEFAULT_VIEW_STATE = {
  longitude: 117.28,
  latitude: 1.91,
  zoom: 13,
  pitch: 0,
  bearing: 0,
};

const pickCamera = (vs) => ({
  longitude: vs.longitude,
  latitude: vs.latitude,
  zoom: vs.zoom,
  pitch: vs.pitch ?? 0,
  bearing: vs.bearing ?? 0,
});

// Ray casting. Kept here rather than pulled from turf because it runs over raw
// Float64Array coordinates without allocating a GeoJSON feature per sample.
export function pointInPolygon(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Padding for a framed box, in canvas pixels.
//
// Asymmetric because the canvas is not all usable: the toolbar floats top-right
// and the legend and status readout sit along the bottom edge. Padding every
// side equally would either tuck the site under those overlays or, to avoid
// that, inset all four by the worst case — which is what leaves wide empty
// margins around the orthophoto. 24px is breathing room; the rest is chrome.
const FIT_PADDING = { top: 24, right: 72, bottom: 56, left: 24 };

// Degenerate viewports (a panel mid-animation, a hidden tab) make fitBounds
// return a nonsense zoom. Below this there is nothing worth framing into.
const MIN_FIT_SIZE = 80;
const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

function formatMeasureDistance(kilometers) {
  if (kilometers >= 1) return `${kilometers.toFixed(kilometers >= 10 ? 1 : 2)} km`;
  return `${Math.round(kilometers * 1000)} m`;
}

const MapWorkspace = memo(forwardRef(({
  layers = [],
  cameraCommand = null,
  tool = 'pan',              // 'pan' | 'lasso' | page-defined edit tool
  onLasso,                   // (ringLngLat) => void
  onZoomChange,
  onCursorMove,              // ([lng, lat]) => void — throttled to the map's own frames
  onClick,
  onHover,
  getCursor = ({ isDragging }) => (isDragging ? 'grabbing' : 'grab'),
  getTooltip,
  children,
}, forwardedRef) => {
  const viewStateRef = useRef(DEFAULT_VIEW_STATE);
  const [appliedCamera, setAppliedCamera] = useState(DEFAULT_VIEW_STATE);

  // Layers need the camera only for level-of-detail, so publish it quantised to
  // whole zoom levels: a pan produces no React state change at all, and a zoom
  // produces at most one per integer level crossed.
  const [zoomBucket, setZoomBucket] = useState(Math.round(DEFAULT_VIEW_STATE.zoom));
  const zoomBucketRef = useRef(Math.round(DEFAULT_VIEW_STATE.zoom));

  const containerRef = useRef(null);
  const [lassoPath, setLassoPath] = useState(null);
  const lassoRef = useRef(null);
  // The bounding box the view is currently framed to, or null once the operator
  // has moved the camera themselves. Drives the re-fit on resize.
  const lastFitRef = useRef(null);

  const handleViewStateChange = useCallback(({ viewState, interactionState }) => {
    viewStateRef.current = viewState;

    // Panning or zooming by hand replaces the framing intent. Without this the
    // next layout change — opening a panel, collapsing the nav — would re-fit
    // the remembered box and yank the operator back from wherever they had
    // navigated to. Transitions are excluded: deck.gl reports those here too,
    // and a programmatic fit must not cancel itself.
    if (lastFitRef.current
        && (interactionState?.isDragging || interactionState?.isZooming || interactionState?.isPanning)) {
      lastFitRef.current = null;
    }
    const bucket = Math.round(viewState.zoom);
    if (bucket === zoomBucketRef.current) return;
    zoomBucketRef.current = bucket;
    // deck.gl fires this synchronously from inside DeckGL's own render, so a
    // direct setState here is a "cannot update a component while rendering a
    // different component" violation. The ref already absorbed the value.
    queueMicrotask(() => setZoomBucket(bucket));
  }, []);

  useEffect(() => { onZoomChange?.(zoomBucket); }, [zoomBucket, onZoomChange]);

  const moveCamera = useCallback((target) => {
    // A command may name a bounding box instead of a zoom. Only this component
    // knows the canvas size, and the zoom that frames a box depends on it, so the
    // conversion happens here through deck.gl's own fitBounds rather than through
    // a caller-side approximation of it.
    if (target?.fitBounds) {
      const rect = containerRef.current?.getBoundingClientRect();
      const [[west, south], [east, north]] = target.fitBounds;
      if (rect?.width > MIN_FIT_SIZE && rect?.height > MIN_FIT_SIZE
          && [west, south, east, north].every(Number.isFinite)) {
        // Remembered so the framing can be reproduced at a new canvas size —
        // see the resize observer below.
        lastFitRef.current = target.fitBounds;
        const { longitude, latitude, zoom } = new WebMercatorViewport({
          ...viewStateRef.current, width: rect.width, height: rect.height,
        }).fitBounds([[west, south], [east, north]], { padding: FIT_PADDING });
        setAppliedCamera({
          ...pickCamera(viewStateRef.current),
          longitude,
          latitude,
          zoom: Math.min(17, zoom),
          transitionDuration: target.transitionDuration ?? 700,
        });
        return;
      }
    }
    // Any camera move the user or a caller makes by hand replaces the framing
    // intent: re-fitting an old box on the next resize would yank the view back
    // from wherever they had navigated to.
    lastFitRef.current = null;
    setAppliedCamera({ ...pickCamera(viewStateRef.current), ...target });
  }, []);

  useEffect(() => {
    if (!cameraCommand) return;
    moveCamera(cameraCommand);
  }, [cameraCommand, moveCamera]);

  // Re-frame when the canvas changes size.
  //
  // Framing was computed once, against whatever the canvas measured at that
  // instant. Every later change to the workspace — opening the contextual panel,
  // collapsing the navigation, the temporal dock growing for playback, a browser
  // resize — left the site framed for a canvas that no longer existed, which is
  // exactly what produced the wide empty margins around the orthophoto.
  //
  // Only a remembered fit is reproduced, and without a transition: this is the
  // view holding still against a layout change, not a camera move.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (!lastFitRef.current) return;
      // Coalesce: a panel opening emits a resize per animation frame, and each
      // one would otherwise recompute and re-set the camera.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = lastFitRef.current;
        if (bounds) moveCamera({ fitBounds: bounds, transitionDuration: 0 });
      });
    });

    observer.observe(node);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [moveCamera]);

  // Imperative handle rather than lifting viewState into React state: the zoom
  // buttons and "fit to data" need to READ the live camera, and exposing it
  // through state would put the camera back in the render path — the exact
  // problem the uncontrolled design removes.
  useImperativeHandle(forwardedRef, () => ({
    getViewState: () => viewStateRef.current,
    moveCamera,
  }), [moveCamera]);

  // ---- lasso ---------------------------------------------------------------
  // Screen-space capture; unprojected to lng/lat once on release. Doing it the
  // other way round would unproject on every pointermove.
  const lassoActive = tool === 'lasso';
  const measureActive = tool === 'measure';

  const toLocal = (event) => {
    const rect = containerRef.current.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const handlePointerDown = useCallback((event) => {
    if (!lassoActive || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toLocal(event);
    lassoRef.current = [point];
    setLassoPath(lassoRef.current.slice());
  }, [lassoActive]);

  const handlePointerMove = useCallback((event) => {
    if (!lassoActive || !lassoRef.current) return;
    const point = toLocal(event);
    const last = lassoRef.current[lassoRef.current.length - 1];
    // Drop sub-3px moves: a freehand drag emits far more points than the shape
    // needs, and every extra vertex costs a ray-cast crossing per sample later.
    if (Math.abs(point[0] - last[0]) < 3 && Math.abs(point[1] - last[1]) < 3) return;
    lassoRef.current.push(point);
    setLassoPath(lassoRef.current.slice());
  }, [lassoActive]);

  const handlePointerUp = useCallback((event) => {
    if (!lassoActive || !lassoRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const screenRing = lassoRef.current;
    lassoRef.current = null;
    setLassoPath(null);

    if (screenRing.length < 3) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewport = new WebMercatorViewport({
      ...viewStateRef.current,
      width: rect.width,
      height: rect.height,
    });
    onLasso?.(screenRing.map(([x, y]) => viewport.unproject([x, y])));
  }, [lassoActive, onLasso]);

  const initialViewState = useMemo(() => appliedCamera, [appliedCamera]);

  const lassoLayer = useMemo(() => {
    if (!lassoPath || lassoPath.length < 2) return null;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const viewport = new WebMercatorViewport({
      ...viewStateRef.current, width: rect.width, height: rect.height,
    });
    return new PolygonLayer({
      id: 'v3-lasso',
      data: [{ polygon: lassoPath.map(([x, y]) => viewport.unproject([x, y])) }],
      getPolygon: (d) => d.polygon,
      filled: true,
      stroked: true,
      getFillColor: [...rgb(C.sel), 40],
      getLineColor: [...rgb(C.sel), 220],
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      pickable: false,
    });
  }, [lassoPath]);

  const measureLayer = useMemo(() => {
    if (!measureActive) return null;
    return new EditableGeoJsonLayer({
      id: 'v3-measure-distance',
      data: EMPTY_FEATURE_COLLECTION,
      mode: new MeasureDistanceMode(),
      modeConfig: {
        centerTooltipsOnLine: true,
        turfOptions: { units: 'kilometers' },
        formatTooltip: formatMeasureDistance,
      },
      selectedFeatureIndexes: [],
      onEdit: () => {},
      pickable: true,
      getTentativeLineColor: [...rgb(C.warn), 255],
      getTentativeLineWidth: 3,
      getEditHandlePointColor: [...rgb(C.warn), 255],
      getEditHandlePointOutlineColor: [255, 255, 255, 255],
      getEditHandlePointRadius: 5,
      editHandlePointRadiusUnits: 'pixels',
    });
  }, [measureActive]);

  const allLayers = useMemo(
    () => [...layers, ...(lassoLayer ? [lassoLayer] : []), ...(measureLayer ? [measureLayer] : [])],
    [layers, lassoLayer, measureLayer],
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'absolute',
        inset: 0,
        background: C.g1,
        cursor: lassoActive || measureActive ? 'crosshair' : undefined,
        touchAction: lassoActive || measureActive ? 'none' : undefined,
      }}
    >
      <DeckGL
        initialViewState={initialViewState}
        onViewStateChange={handleViewStateChange}
        controller={!lassoActive}
        layers={allLayers}
        onClick={onClick}
        onHover={(info) => {
          // deck.gl already throttles hover to its own frame loop, so this does
          // not need further debouncing.
          if (onCursorMove && info.coordinate) onCursorMove(info.coordinate);
          onHover?.(info);
        }}
        getCursor={getCursor}
        getTooltip={getTooltip}
        useDevicePixels={false}
      />
      {children}
    </div>
  );
}));

MapWorkspace.displayName = 'MapWorkspace';

export default MapWorkspace;
