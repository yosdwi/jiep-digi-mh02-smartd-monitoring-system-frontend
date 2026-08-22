import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, GeoJsonLayer, SolidPolygonLayer } from '@deck.gl/layers';
import { getOrthoApiUrl, getOrthoTileUrl, getKmlPath } from '../../../config/mapConfig';
import { useKml } from '../../../hooks/useKml';
import useHistoryStore from '../../state/historyStore';
import { fetchFeaturesByCategory, featuresToGeoJson } from '../../services/geofenceApi';
import { rgb, color as C } from '../../foundation/tokens';

const ORIGIN_SHIFT = 20037508.342789244;

// The ortho service stores layer bounds in Web Mercator metres (read off the
// reprojected COG). TileLayer's `extent` wants the layer's own coordinate
// system, i.e. lon/lat. Values already inside ±180/±90 are assumed to be degrees
// — some layers predate the reprojection step.
function toLngLatExtent(layer) {
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
}

/**
 * Lists every converted ortho layer for the district, newest first.
 *
 * V2 fetched the same list and silently kept only the newest
 * (MapContainerLite.jsx:60-62), discarding the rest. Comparing this month's
 * orthophoto against last month's is a real operational need the API already
 * supports, so V3 keeps the whole list and lets the layer manager choose.
 */
export function useOrthoVersions(district) {
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    if (!district) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const fixtureMode = import.meta.env.VITE_V3_DATA_MODE === 'fixture';
        const url = fixtureMode
          ? `${import.meta.env.BASE_URL}fixtures/brcb-orthophoto-layers.json`
          : await getOrthoApiUrl(district);
        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) return;
        const result = await response.json();
        const layers = (result.layers || [])
          .filter((l) => l.converted === true)
          .sort((a, b) => new Date(b.uploadedAt || b.createdAt || 0) - new Date(a.uploadedAt || a.createdAt || 0));

        const resolved = await Promise.all(layers.map(async (l) => ({
          id: l.id,
          name: l.name,
          uploadedAt: l.uploadedAt,
          maxZoom: Number.isFinite(l.maxZoom) ? l.maxZoom : 18,
          extent: toLngLatExtent(l),
          url: fixtureMode
            ? `${import.meta.env.BASE_URL}${String(l.localTileUrl || `fixtures/ortho/brcb/${l.id}/{z}/{x}/{y}.png`).replace(/^\/+/, '')}`
            : l.staticTileUrl || await getOrthoTileUrl(l.tileUrl, district),
          isStatic: Boolean(l.staticTileUrl),
        })));

        if (!cancelled) setVersions(resolved);
      } catch {
        // Ortho is best-effort context, never a blocker for the trace.
      }
    })();

    return () => { cancelled = true; };
  }, [district]);

  return versions;
}

/**
 * Boundary and road geometry now lives in the managed geofence layers
 * (`GeofenceV3Service`, categories 'boundary' / 'haul_road'), imported from the
 * legacy KML via the "Impor KML" flow on the Layer & Orthophoto page. This
 * fetches that once per district. The static KML fetch below stays as a
 * fallback for a district that has not been backfilled yet — once its layer
 * has features, the DB copy wins and the KML fetch becomes dead weight worth
 * deleting.
 */
function useDbVectorFeatures(district) {
  const [byCategory, setByCategory] = useState(new Map());

  useEffect(() => {
    if (!district) return undefined;
    let cancelled = false;
    fetchFeaturesByCategory()
      .then((map) => { if (!cancelled) setByCategory(map); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [district]);

  return byCategory;
}

export function useBasemapLayers({ district, kmlContext = null }) {
  const layers = useHistoryStore((s) => s.layers);
  const opacity = useHistoryStore((s) => s.layerOpacity);
  const orthoVersionId = useHistoryStore((s) => s.orthoVersionId);

  const versions = useOrthoVersions(district);
  const ortho = useMemo(
    () => versions.find((v) => v.id === orthoVersionId) || versions[0] || null,
    [versions, orthoVersionId],
  );

  const dbFeatures = useDbVectorFeatures(district);
  const boundaries = useKml(getKmlPath('boundaries', district, kmlContext), layers.boundaries);
  const roads = useKml(getKmlPath('roads', district, kmlContext), layers.roads);

  // In-flight ortho tile count, surfaced so the workspace can say the imagery is
  // still arriving. Kept in a ref and mirrored to state only on the 0 <-> n
  // transition: a tile pyramid fires dozens of fetches and a setState per tile
  // would re-render the map mid-pan.
  const pendingTiles = useRef(0);
  const [orthoLoading, setOrthoLoading] = useState(false);
  const markTile = useCallback((delta) => {
    const before = pendingTiles.current;
    pendingTiles.current = Math.max(0, before + delta);
    const nowLoading = pendingTiles.current > 0;
    if (nowLoading !== (before > 0)) setOrthoLoading(nowLoading);
  }, []);

  // The site footprint, drawn under the imagery as soon as the extent is known.
  //
  // Without it a site whose tiles have not arrived yet is indistinguishable from
  // a broken page: deck.gl draws nothing and the user sees the white page
  // underneath. A neutral fill in the shape of the survey area means "imagery is
  // coming" instead, and it is the only thing on screen that can be drawn before
  // a single tile has been fetched.
  const footprintLayer = useMemo(() => {
    if (!ortho?.extent || !layers.orthophoto) return null;
    const [west, south, east, north] = ortho.extent;
    return new SolidPolygonLayer({
      id: 'v3-ortho-footprint',
      data: [{ polygon: [[west, south], [east, south], [east, north], [west, north]] }],
      getPolygon: (d) => d.polygon,
      getFillColor: [...rgb(C.g2), 255],
      pickable: false,
    });
  }, [ortho, layers.orthophoto]);

  const orthoLayer = useMemo(() => {
    if (!ortho?.url || !layers.orthophoto) return null;
    return new TileLayer({
      id: `v3-ortho-${ortho.id}`,
      data: ortho.url,
      minZoom: 0,
      // Capped at the pyramid's real depth. Asking deeper made the tile service
      // fork a gdal_translate per tile for zoom levels the source does not have;
      // deck.gl over-zooms the deepest real tiles instead, which is free.
      maxZoom: ortho.maxZoom,
      // Never request tiles outside the footprint: those returned uncached 404s,
      // so every pan re-asked the service for the same empty tiles.
      ...(ortho.extent ? { extent: ortho.extent } : {}),
      tileSize: 256,
      opacity: opacity.orthophoto,
      // Default TileLayer fetch has no timeout. An unreachable ortho service
      // otherwise holds one of the browser's ~6 per-origin connection slots for
      // the OS TCP timeout (20 s+) per tile, starving the trace chunk requests
      // that share the origin.
      // A static pyramid on a CDN answers in tens of milliseconds; the dynamic
      // endpoint has to fork GDAL, so it gets a longer leash before being
      // abandoned. Either way the timeout is bounded: a hung tile otherwise
      // holds one of the browser's ~6 per-origin connections for the OS TCP
      // timeout and starves the trace chunk requests sharing that origin.
      getTileData: async ({ url, signal }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ortho.isStatic ? 6000 : 4000);
        const onAbort = () => controller.abort();
        signal?.addEventListener('abort', onAbort);
        markTile(1);
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`ortho ${response.status}`);
          return createImageBitmap(await response.blob());
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          markTile(-1);
        }
      },
      onTileError: () => {},
      renderSubLayers: (props) => {
        const { west, south, east, north } = props.tile.bbox;
        return new BitmapLayer(props, { data: null, image: props.data, bounds: [west, south, east, north] });
      },
    });
  }, [ortho, layers.orthophoto, opacity.orthophoto, markTile]);

  const dbBoundaries = useMemo(() => featuresToGeoJson(dbFeatures.get('boundary')), [dbFeatures]);
  const dbRoads = useMemo(() => featuresToGeoJson(dbFeatures.get('haul_road')), [dbFeatures]);
  const boundaryData = dbBoundaries.features.length > 0 ? dbBoundaries : boundaries.data;
  const roadData = dbRoads.features.length > 0 ? dbRoads : roads.data;

  const vectorLayers = useMemo(() => {
    const out = [];

    if (layers.boundaries && boundaryData) {
      out.push(new GeoJsonLayer({
        id: 'v3-boundaries',
        data: boundaryData,
        stroked: true,
        filled: false,
        getLineColor: [...rgb(C.warn), 210],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 1,
        opacity: opacity.boundaries,
        pickable: false,
      }));
    }

    if (layers.roads && roadData) {
      out.push(new GeoJsonLayer({
        id: 'v3-roads',
        data: roadData,
        stroked: true,
        filled: false,
        getLineColor: [...rgb(C.g4), 200],
        getLineWidth: 1.5,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 1,
        opacity: opacity.roads,
        pickable: false,
      }));
    }

    return out;
  }, [layers.boundaries, layers.roads, boundaryData, roadData, opacity.boundaries, opacity.roads]);

  // Footprint under the imagery, imagery under the vectors.
  const all = useMemo(
    () => [
      ...(footprintLayer ? [footprintLayer] : []),
      ...(orthoLayer ? [orthoLayer] : []),
      ...vectorLayers,
    ],
    [footprintLayer, orthoLayer, vectorLayers],
  );

  return { layers: all, orthoVersions: versions, activeOrtho: ortho, orthoLoading };
}

export default useBasemapLayers;
