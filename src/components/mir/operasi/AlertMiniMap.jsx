import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { WebMercatorViewport } from '@deck.gl/core';
import { LineLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';
import { T } from './mirTokens';

// Mini-map detail drawer layar Peringatan — pakai stack deck.gl proyek (BUKAN leaflet).
// Render geofence + MIR line + track pre/on + distance line, selaras visual Operasi.
// Tanpa basemap tile supaya ringan & tak butuh token. Koordinat deck = [lon,lat].
// Evidence tuple: [ts, lat(1), lon(2), ...] → coord = [s[2], s[1]].

const W = 340;
const H = 240;

const trackCoords = (arr) =>
  (arr || [])
    .filter((s) => Array.isArray(s) && s[1] != null && s[2] != null)
    .map((s) => [Number(s[2]), Number(s[1])])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));

const metersLabel = (m) => {
  if (!Number.isFinite(m)) return '';
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
};

const midPoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

const normalizeEvidenceGeofence = (gf) => {
  if (!gf || typeof gf !== 'object') return null;
  return {
    pid: gf.pid,
    dumping_area_code: gf.area_code || gf.dumping_area_code,
    generated_at_ms: gf.generated_at_ms,
    dumping_area: gf.dumping_area,
    dumping_unsafe_area: gf.dumping_unsafe_area,
    dumping_line: gf.dumping_line,
    dumping_line_warning1: gf.dumping_line_warning1,
    dumping_line_warning2: gf.dumping_line_warning2,
    dumping_line_warning3: gf.dumping_line_warning3,
  };
};

const cleanLine = (line) =>
  (line || [])
    .map((p) => [Number(p?.[0]), Number(p?.[1])])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));

export function buildAlertReplayLayers({ evidence, geofenceAreas, areaCode, peakLat, peakLon, height = H }) {
    const mapHeight = typeof height === 'number' ? height : H;
    const areas = Array.isArray(geofenceAreas) ? geofenceAreas : [];
    const liveArea = areaCode
      ? areas.find((a) => a.dumping_area_code === areaCode || a.pid === areaCode)
      : areas[0];
    const deviceArea = normalizeEvidenceGeofence(evidence?.geofence);
    const area = deviceArea || liveArea;

    const pre = trackCoords(evidence?.pre);
    const on = trackCoords(evidence?.on);
    const peak =
      peakLat != null && peakLon != null
        ? [Number(peakLon), Number(peakLat)]
        : on.length
        ? on[Math.floor(on.length / 2)]
        : pre.length
        ? pre[pre.length - 1]
        : null;

    const all = [];
    const ls = [];
    let mirLine = null;

    const pushGeofenceLayers = (srcArea, prefix, tone, label) => {
      if (!srcArea) return;
      if (srcArea.dumping_area?.length >= 3) {
        ls.push(
          new PolygonLayer({
            id: `${prefix}-area`,
            data: [{ polygon: srcArea.dumping_area }],
            getPolygon: (d) => d.polygon,
            getFillColor: tone.areaFill,
            getLineColor: tone.areaLine,
            getLineWidth: 2,
            lineWidthMinPixels: 2,
          }),
        );
        all.push(...srcArea.dumping_area);
      }
      if (srcArea.dumping_unsafe_area?.length >= 3) {
        ls.push(
          new PolygonLayer({
            id: `${prefix}-unsafe`,
            data: [{ polygon: srcArea.dumping_unsafe_area }],
            getPolygon: (d) => d.polygon,
            getFillColor: tone.unsafeFill,
            getLineColor: tone.unsafeLine,
            getLineWidth: 2,
            lineWidthMinPixels: 2,
          }),
        );
        all.push(...srcArea.dumping_unsafe_area);
      }
      const line = cleanLine(srcArea.dumping_line);
      if (line.length >= 2) {
        if (prefix === 'amm-device' || !mirLine) mirLine = line;
          ls.push(
            new PathLayer({
              id: `${prefix}-line`,
              data: [{ path: line }],
              getPath: (d) => d.path,
              getColor: tone.line,
              widthMinPixels: prefix === 'amm-device' ? 4 : 2,
            }),
          );
          all.push(...line);
          ls.push(new TextLayer({
            id: `${prefix}-line-label`,
            data: [{ p: line[Math.floor(line.length / 2)], t: label }],
            getPosition: (d) => d.p,
            getText: (d) => d.t,
            getColor: tone.line,
            getSize: 10,
            sizeUnits: 'pixels',
            getPixelOffset: [0, -12],
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            fontFamily: 'monospace',
            fontWeight: 700,
            characterSet: 'auto',
            background: true,
            getBackgroundColor: [255, 255, 255, 220],
            backgroundPadding: [4, 2],
          }));
      }
    };

    if (liveArea && deviceArea) {
      pushGeofenceLayers(liveArea, 'amm-live', {
        areaFill: [118, 130, 143, 18],
        areaLine: [118, 130, 143, 165],
        unsafeFill: [118, 130, 143, 22],
        unsafeLine: [118, 130, 143, 180],
        line: [88, 100, 115, 190],
      }, 'Live MIR line');
    }
    pushGeofenceLayers(area, deviceArea ? 'amm-device' : 'amm-live', deviceArea ? {
      areaFill: [46, 158, 91, 36],
      areaLine: [46, 158, 91, 235],
      unsafeFill: [217, 72, 63, 44],
      unsafeLine: [217, 72, 63, 240],
      line: [36, 50, 64, 255],
    } : {
      areaFill: [46, 158, 91, 38],
      areaLine: [46, 158, 91, 210],
      unsafeFill: [217, 72, 63, 42],
      unsafeLine: [217, 72, 63, 225],
      line: [88, 100, 115, 255],
    }, deviceArea ? 'Device MIR line' : 'MIR line');

    const evidenceMirLine = cleanLine(evidence?.mir_line);
    if (evidenceMirLine.length >= 2) {
      ls.push(new PathLayer({
        id: 'amm-evidence-mir-line',
        data: [{ path: evidenceMirLine }],
        getPath: (d) => d.path,
        getColor: [224, 138, 60, 245],
        widthMinPixels: 3,
      }));
      all.push(...evidenceMirLine);
    }

    if (pre.length >= 2) {
      ls.push(
        new PathLayer({
          id: 'amm-pre',
          data: [{ path: pre }],
          getPath: (d) => d.path,
          getColor: [118, 130, 143, 230],
          widthMinPixels: 2.5,
        }),
      );
      all.push(...pre);
    }
    if (on.length >= 2) {
      ls.push(
        new PathLayer({
          id: 'amm-on',
          data: [{ path: on }],
          getPath: (d) => d.path,
          getColor: [217, 72, 63, 255],
          widthMinPixels: 4,
        }),
      );
      all.push(...on);
    }
    if (pre.length || on.length) {
      const points = [
        ...(pre[0] ? [{ p: pre[0], kind: 'start', color: [118, 130, 143] }] : []),
        ...(on[0] ? [{ p: on[0], kind: 'crossing', color: [217, 72, 63] }] : []),
      ];
      const sampleDots = [
        ...pre.map((p) => ({ p, color: [118, 130, 143], r: 2.8 })),
        ...on.map((p) => ({ p, color: [217, 72, 63], r: 3.4 })),
      ];
      ls.push(new ScatterplotLayer({
        id: 'amm-sample-dots',
        data: sampleDots,
        getPosition: (d) => d.p,
        getFillColor: (d) => [...d.color, 185],
        getLineColor: [255, 255, 255, 150],
        stroked: true,
        lineWidthMinPixels: 0.5,
        radiusUnits: 'pixels',
        getRadius: (d) => d.r,
        radiusMinPixels: 2,
      }));
      ls.push(new ScatterplotLayer({
        id: 'amm-track-points',
        data: points,
        getPosition: (d) => d.p,
        getFillColor: (d) => [...d.color, 245],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 1.5,
        radiusUnits: 'pixels',
        getRadius: (d) => (d.kind === 'crossing' ? 5 : 4),
        radiusMinPixels: 4,
      }));
    }

    if (peak && mirLine?.length >= 2) {
      try {
        const foot = turf.nearestPointOnLine(turf.lineString(mirLine), turf.point(peak), { units: 'kilometers' }).geometry.coordinates;
        const distanceM = turf.distance(turf.point(peak), turf.point(foot), { units: 'kilometers' }) * 1000;
        const labelPoint = midPoint(peak, foot);
        ls.push(new LineLayer({
          id: 'amm-distance-line',
          data: [{ source: peak, target: foot }],
          getSourcePosition: (d) => d.source,
          getTargetPosition: (d) => d.target,
          getColor: [217, 72, 63, 235],
          getWidth: 2,
          widthUnits: 'pixels',
        }));
        ls.push(new ScatterplotLayer({
          id: 'amm-distance-foot',
          data: [{ p: foot }],
          getPosition: (d) => d.p,
          getFillColor: [88, 100, 115, 255],
          getLineColor: [255, 255, 255, 255],
          stroked: true,
          lineWidthMinPixels: 1.5,
          radiusUnits: 'pixels',
          getRadius: 4,
          radiusMinPixels: 4,
        }));
        ls.push(new TextLayer({
          id: 'amm-distance-label',
          data: [{ p: labelPoint, t: metersLabel(distanceM) }],
          getPosition: (d) => d.p,
          getText: (d) => d.t,
          getColor: [217, 72, 63, 255],
          getSize: 10,
          sizeUnits: 'pixels',
          getPixelOffset: [0, -10],
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          fontFamily: 'monospace',
          fontWeight: 700,
          characterSet: 'auto',
          background: true,
          getBackgroundColor: [255, 255, 255, 230],
          backgroundPadding: [4, 2],
        }));
        all.push(foot, labelPoint);
      } catch {
        // Geometri evidence/geofence bisa invalid; minimap tetap render track.
      }
    }

    if (peak) {
      ls.push(
        new ScatterplotLayer({
          id: 'amm-peak',
          data: [{ p: peak }],
          getPosition: (d) => d.p,
          getFillColor: [217, 72, 63, 255],
          getLineColor: [255, 255, 255],
          stroked: true,
          lineWidthMinPixels: 2,
          radiusUnits: 'pixels',
          getRadius: 7,
          radiusMinPixels: 7,
        }),
      );
      ls.push(new TextLayer({
        id: 'amm-peak-label',
        data: [{ p: peak, t: 'peak' }],
        getPosition: (d) => d.p,
        getText: (d) => d.t,
        getColor: [217, 72, 63, 255],
        getSize: 10,
        sizeUnits: 'pixels',
        getPixelOffset: [12, 0],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        fontFamily: 'monospace',
        fontWeight: 700,
        characterSet: 'auto',
        background: true,
        getBackgroundColor: [255, 255, 255, 225],
        backgroundPadding: [3, 1],
      }));
      all.push(peak);
    }

    // fit bounds → viewState
    let vs = { longitude: 106.89, latitude: -6.19, zoom: 14, pitch: 0, bearing: 0 };
    if (all.length) {
      const lons = all.map((p) => p[0]);
      const lats = all.map((p) => p[1]);
      const minLon = Math.min(...lons), maxLon = Math.max(...lons);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      if (minLon === maxLon && minLat === maxLat) {
        vs = { ...vs, longitude: minLon, latitude: minLat, zoom: 17 };
      } else {
        try {
          const fit = new WebMercatorViewport({ width: W, height: mapHeight }).fitBounds(
            [[minLon, minLat], [maxLon, maxLat]],
            { padding: 34 },
          );
          vs = { ...vs, longitude: fit.longitude, latitude: fit.latitude, zoom: Math.min(fit.zoom, 19) };
        } catch {
          vs = { ...vs, longitude: (minLon + maxLon) / 2, latitude: (minLat + maxLat) / 2, zoom: 15 };
        }
      }
    }

    return { layers: ls, viewState: vs };
}

export default function AlertMiniMap({ evidence, geofenceAreas, areaCode, peakLat, peakLon, height = H }) {
  const { layers, viewState } = useMemo(
    () => buildAlertReplayLayers({ evidence, geofenceAreas, areaCode, peakLat, peakLon, height }),
    [evidence, geofenceAreas, areaCode, peakLat, peakLon, height]
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 4,
        border: `1px solid ${T.g2}`,
        overflow: 'hidden',
        backgroundColor: T.g0,
        backgroundImage: `linear-gradient(${T.g1} 1px, transparent 1px), linear-gradient(90deg, ${T.g1} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    >
      <DeckGL
        key={`${viewState.longitude.toFixed(5)}|${viewState.latitude.toFixed(5)}|${viewState.zoom.toFixed(2)}`}
        initialViewState={viewState}
        controller={true}
        layers={layers}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  );
}
