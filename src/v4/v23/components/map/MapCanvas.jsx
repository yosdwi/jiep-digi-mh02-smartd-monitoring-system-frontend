import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";
import { useWorkspace } from "../../state/WorkspaceContext";
import { speedColor } from "../../utils/workspace";

function boundsFromCoordinates(coordinates) {
  const bounds = new maplibregl.LngLatBounds();
  coordinates.forEach((point) => {
    if (Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])) bounds.extend(point);
  });
  return bounds.isEmpty() ? null : bounds;
}

const MapCanvas = forwardRef(function MapCanvas(_, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const { state, rows, fullRows, durationEvents, dispatch } = useWorkspace();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [117.28, 1.91],
      zoom: 13,
      pitch: 0,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
      },
    });
    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    map.addControl(overlay);
    mapRef.current = map;
    overlayRef.current = overlay;
    map.once("load", () => map.resize());
    return () => {
      try { overlay.finalize(); } catch { /* noop */ }
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  const playbackRows = useMemo(() => {
    if (!state.playback.active || !fullRows.length) return [];
    const min = Math.min(...fullRows.map((row) => row.time));
    const max = Math.max(...fullRows.map((row) => row.time));
    const cutoff = min + (max - min) * (state.playback.progress / 1000);
    return fullRows.filter((row) => row.time <= cutoff);
  }, [state.playback.active, state.playback.progress, fullRows]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const sourceRows = state.playback.active ? playbackRows : rows;
    const visibleTrace = state.layers.trace && state.mode !== "datalog" && state.mode !== "duration" && state.mode !== "gis";
    const layers = [];

    if (visibleTrace) {
      layers.push(new ScatterplotLayer({
        id: "aw-trace",
        data: sourceRows,
        getPosition: (row) => [row.lon, row.lat],
        getRadius: 2.5,
        radiusUnits: "pixels",
        getFillColor: (row) => speedColor(row.speed),
        opacity: 0.9,
        pickable: true,
      }));
      if (state.layers.loading) {
        layers.push(new ScatterplotLayer({
          id: "aw-loading",
          data: sourceRows.filter((row) => row.status === 1),
          getPosition: (row) => [row.lon, row.lat],
          getRadius: 4.5,
          radiusUnits: "pixels",
          getFillColor: [39, 54, 74, 235],
        }));
      }
    }

    if (state.playback.active) {
      const byUnit = new Map();
      playbackRows.forEach((row) => {
        if (!byUnit.has(row.unitNo)) byUnit.set(row.unitNo, []);
        byUnit.get(row.unitNo).push([row.lon, row.lat]);
      });
      const paths = [...byUnit.entries()].map(([unitNo, path]) => ({ unitNo, path }));
      layers.push(new PathLayer({ id: "aw-playback-path", data: paths, getPath: (item) => item.path, getColor: [40, 124, 148, 215], getWidth: 3, widthUnits: "pixels" }));
      layers.push(new ScatterplotLayer({ id: "aw-playback-unit", data: paths.filter((item) => item.path.length), getPosition: (item) => item.path.at(-1), getRadius: 7, radiusUnits: "pixels", getFillColor: [23, 32, 51, 240], getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 2, stroked: true }));
    }

    const speedSegments = state.speed.draft?.segments ?? state.speed.active?.segments ?? [];
    if (["speed", "gis"].includes(state.mode) && speedSegments.length) {
      const selected = new Set(state.mode === "gis" ? state.gis.selectedSegments : state.speed.selectedSegments);
      const geojson = { type: "FeatureCollection", features: speedSegments.map((segment) => ({ type: "Feature", properties: { id: segment.id, reviewed: segment.reviewed, selected: selected.has(segment.id) }, geometry: { type: "Polygon", coordinates: [segment.polygon] } })) };
      layers.push(new GeoJsonLayer({
        id: "aw-speed-segments",
        data: geojson,
        filled: true,
        stroked: true,
        pickable: true,
        getFillColor: (feature) => feature.properties.selected ? [40, 124, 148, 75] : feature.properties.reviewed ? [84, 135, 103, 42] : [40, 124, 148, 38],
        getLineColor: (feature) => feature.properties.selected ? [23, 95, 112, 255] : feature.properties.reviewed ? [84, 135, 103, 230] : [40, 124, 148, 210],
        getLineWidth: (feature) => feature.properties.selected ? 4 : 2,
        lineWidthUnits: "pixels",
        onClick: (info, event) => {
          const id = info.object?.properties?.id;
          if (!id) return;
          dispatch({ type: "TOGGLE_SPEED_SEGMENT", id, multi: Boolean(event?.srcEvent?.ctrlKey || event?.srcEvent?.metaKey) });
          if (state.mode === "gis") dispatch({ type: "PATCH_GIS", patch: { inspectorOpen: true } });
        },
      }));
    }

    if (state.mode === "duration") {
      layers.push(new ScatterplotLayer({
        id: "aw-duration-events",
        data: durationEvents,
        getPosition: (event) => [event.lon, event.lat],
        getRadius: (event) => Math.min(14, 4 + event.durationMs / 600000),
        radiusUnits: "pixels",
        getFillColor: (event) => event.review ? [247, 144, 9, 225] : [40, 124, 148, 220],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 1,
        pickable: true,
        onClick: (info) => info.object && dispatch({ type: "PATCH_DURATION", patch: { selectedEvent: info.object.id } }),
      }));
    }

    if (state.mode === "datalog" && state.datalog.view === "map") {
      const logRows = state.datalog.rows;
      layers.push(new ScatterplotLayer({ id: "aw-datalog-map", data: logRows, getPosition: (row) => [row.gpslong, row.gpslat], getRadius: 3, radiusUnits: "pixels", getFillColor: (row) => speedColor(row.gpsspeed), opacity: 0.82 }));
    }

    if (state.mode === "gis" && state.survey.visible && state.survey.coordinates.length) {
      layers.push(new PathLayer({ id: "aw-survey-line", data: [{ path: state.survey.coordinates }], getPath: (item) => item.path, getColor: [123, 97, 168, 235], getWidth: 2.6, widthUnits: "pixels" }));
      layers.push(new ScatterplotLayer({ id: "aw-survey-points", data: state.survey.coordinates, getPosition: (point) => point, getRadius: 2.8, radiusUnits: "pixels", getFillColor: [123, 97, 168, 235], getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 0.8, stroked: true }));
    }

    overlay.setProps({ layers });
  }, [state, rows, fullRows, playbackRows, durationEvents, dispatch]);

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: state.tilt, duration: 250 });
  }, [state.tilt]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn({ duration: 220 }),
    zoomOut: () => mapRef.current?.zoomOut({ duration: 220 }),
    setPitch: (pitch) => mapRef.current?.easeTo({ pitch, duration: 250 }),
    fitRows: (data = rows) => {
      const bounds = boundsFromCoordinates(data.map((row) => [row.lon, row.lat]));
      if (bounds) mapRef.current?.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 450 });
    },
    fitSegments: () => {
      const segments = state.speed.draft?.segments ?? state.speed.active?.segments ?? [];
      const bounds = boundsFromCoordinates(segments.flatMap((segment) => segment.polygon));
      if (bounds) mapRef.current?.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 450 });
    },
    resize: () => mapRef.current?.resize(),
  }), [rows, state.speed.draft, state.speed.active]);

  return <div id="deck-map" ref={containerRef} />;
});

export default MapCanvas;
