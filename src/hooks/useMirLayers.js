import { useState, useEffect } from 'react';
import { PolygonLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';

const ROVER0_TEAL = [31, 122, 150];

function processData(data) {
  const layers = [];
  (Array.isArray(data) ? data : []).forEach(area => {
    if (area.dumping_area && area.dumping_area.length >= 4) {
      layers.push(new PolygonLayer({
        id: `mir-dumping-area-${area.dumping_area_code || area.pid}`,
        data: [{ polygon: area.dumping_area, code: area.dumping_area_code }],
        getPolygon: d => d.polygon,
        filled: true, stroked: true, lineWidthMinPixels: 2,
        getFillColor: [40, 167, 69, 50], getLineColor: [40, 167, 69, 255], pickable: true,
      }));
    }
    if (area.dumping_unsafe_area && area.dumping_unsafe_area.length >= 4) {
      layers.push(new PolygonLayer({
        id: `mir-unsafe-area-${area.dumping_area_code || area.pid}`,
        data: [{ polygon: area.dumping_unsafe_area }],
        getPolygon: d => d.polygon,
        filled: true, stroked: true, lineWidthMinPixels: 2,
        getFillColor: [220, 53, 69, 50], getLineColor: [220, 53, 69, 255], pickable: true,
      }));
    }
    if (area.dumping_line && area.dumping_line.length >= 2) {
      layers.push(new PathLayer({
        id: `mir-dumping-line-${area.dumping_area_code || area.pid}`,
        data: [{ path: area.dumping_line }],
        getPath: d => d.path, widthMinPixels: 3,
        getColor: [88, 100, 115, 255], pickable: true,
      }));
    }
    [1, 2, 3].forEach((n) => {
      const band = area[`dumping_line_warning${n}`];
      if (band && band.length >= 2) {
        layers.push(new PathLayer({
          id: `mir-warning-${n}-${area.dumping_area_code || area.pid}`,
          data: [{ path: band }],
          getPath: d => d.path, widthMinPixels: 1.6,
          getColor: [224, 138, 60, 220], pickable: false,
        }));
      }
    });
    // Rover 0 = titik referensi orientasi geofence per-grup (server-rover/geofence-core `rover_0`).
    // Marker ◉ + label R.<grup>.0 supaya operator tahu posisi Rover 0 tiap grup.
    if (Array.isArray(area.rover_0) && area.rover_0.length === 2) {
      const code = area.dumping_area_code || area.pid;
      const pos = [Number(area.rover_0[0]), Number(area.rover_0[1])];
      const d = [{ position: pos, label: `R.${code}.0` }];
      layers.push(new ScatterplotLayer({
        id: `mir-rover0-${code}`, data: d, getPosition: x => x.position, pickable: true,
        stroked: true, filled: true, getFillColor: [...ROVER0_TEAL, 235], getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 2, radiusUnits: 'pixels', getRadius: 6, radiusMinPixels: 6,
      }));
      layers.push(new TextLayer({
        id: `mir-rover0-label-${code}`, data: d, getPosition: x => x.position, getText: x => x.label,
        getColor: ROVER0_TEAL, getSize: 11, sizeUnits: 'pixels', getPixelOffset: [0, -15],
        getTextAnchor: 'middle', getAlignmentBaseline: 'center', fontFamily: 'monospace', fontWeight: 700,
        characterSet: 'auto', background: true, getBackgroundColor: [255, 255, 255, 225], backgroundPadding: [4, 2],
      }));
    }
  });
  return layers;
}

// Polygon geofence live dari backend (.NET atau mir-web) yang baca Redis polygon:data:*.
// Poll setiap 15s agar terupdate saat server-rover regen dari rover sim.
export const useMirLayers = () => {
  const [mirLayers, setMirLayers] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const r = await fetch('/api/mir/geofence', { cache: 'no-store' });
        if (!r.ok) throw new Error(`/api/mir/geofence ${r.status}`);
        const json = await r.json();
        const areas = Array.isArray(json) ? json : (json.areas || []);
        if (isMounted) setMirLayers(processData(areas));
      } catch (err) {
        console.warn('[useMirLayers] geofence fetch failed:', err.message);
      }
    }

    load();
    const timer = setInterval(load, 3000);
    return () => { isMounted = false; clearInterval(timer); };
  }, []);

  return mirLayers;
};
