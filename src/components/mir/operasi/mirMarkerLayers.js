import { ScatterplotLayer, TextLayer, LineLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';
import { zoneStatus, statusRgb, cabinGlyph, distLabel } from './mirTokens';
import { isValidLonLat } from '../../../utils/geo';

const TEAL = [31, 122, 150];

// Marker rover perimeter (● titik teal) — posisi rover fisik yang membentuk geofence.
// roversLive: array dari /api/mir/rovers/live → {group, rovernumber, gpslat, gpslong, rtkfix}
export function buildRoverMarkerLayers({ rovers, showLabels }) {
  const data = (rovers || [])
    // Buang rover tanpa fix / sentinel (-8888/-8887) supaya tak digambar di posisi bogus.
    .filter(r => isValidLonLat(r.gpslong, r.gpslat))
    .map(r => ({
      position: [Number(r.gpslong), Number(r.gpslat)],
      label: `R.${r.group || '?'}.${r.rovernumber ?? '?'}`,
      fix: r.rtkfix,
    }));
  if (data.length === 0) return [];

  const layers = [
    new ScatterplotLayer({
      id: 'mir-rover-dot', data, getPosition: d => d.position,
      getFillColor: d => d.fix === 4 ? TEAL : [120, 160, 180],
      stroked: true, getLineColor: [255, 255, 255, 220],
      lineWidthMinPixels: 1.5,
      radiusUnits: 'pixels', getRadius: 5, radiusMinPixels: 5,
    }),
  ];
  if (showLabels) {
    layers.push(new TextLayer({
      id: 'mir-rover-label', data, getPosition: d => d.position,
      getText: d => d.label, getColor: TEAL, getSize: 10, sizeUnits: 'pixels',
      getPixelOffset: [10, 0], getTextAnchor: 'start', getAlignmentBaseline: 'center',
      fontFamily: 'monospace', fontWeight: 700, characterSet: 'auto',
      background: true, getBackgroundColor: [255, 255, 255, 190], backgroundPadding: [3, 1],
    }));
  }
  return layers;
}

// Marker MIR Operasi (encoding mockup): cabin = ▲/△ (isi = RTK FIX), warna = status zona.
// Halo merah = area crossing · halo amber = area dumping · ring teal saat terpilih · label unit + jarak/status.
const RED = [217, 72, 63];
const AMBER = [224, 138, 60];
const SEL = [31, 122, 150];

export function buildMirMarkerLayers({ units, selectedUnitId, showLabels, onClick }) {
  const data = units
    // Hanya gambar yang koordinatnya valid; sentinel (-8888/-8887) tetap ada di
    // list (status), cuma tak diplot di peta.
    .filter((u) => isValidLonLat(u.longitude, u.latitude))
    .map((u) => {
      const fix = u.fix_quality ?? u.rtkfix ?? u.FixQuality;
      const status = zoneStatus({ mirDistance: u.mir_distance, mirInArea: u.mir_in_area, mirUnsafe: u.mir_unsafe });
      return {
        deviceId: u.deviceId, unitNo: u.unitNo, position: [u.longitude, u.latitude],
        glyph: cabinGlyph(fix), color: statusRgb(status), status, label: u.unitNo || u.deviceId,
        sub: distLabel(u.mir_distance), // "X m" / "FARAWAY" (-9999) / null (no data)
      };
    });

  const crossing = data.filter((d) => d.status === 'CROSSING');
  const dumping = data.filter((d) => d.status === 'DUMPING');
  const selected = data.filter((d) => d.deviceId === selectedUnitId);

  const layers = [
    // halo amber: di dalam area dumping (perhatian)
    new ScatterplotLayer({
      id: 'mir-mk-halo-dump', data: dumping, getPosition: (d) => d.position, stroked: true, filled: false,
      getLineColor: [...AMBER, 150], lineWidthMinPixels: 2, radiusUnits: 'pixels', getRadius: 15,
    }),
    // halo merah: area crossing (bahaya)
    new ScatterplotLayer({
      id: 'mir-mk-halo', data: crossing, getPosition: (d) => d.position, stroked: true, filled: false,
      getLineColor: [...RED, 170], lineWidthMinPixels: 2, radiusUnits: 'pixels', getRadius: 17,
    }),
    // ring unit terpilih
    new ScatterplotLayer({
      id: 'mir-mk-sel', data: selected, getPosition: (d) => d.position, stroked: true, filled: false,
      getLineColor: [...SEL, 255], lineWidthMinPixels: 2, radiusUnits: 'pixels', getRadius: 13,
    }),
    // glyph penanda (bentuk + warna)
    new TextLayer({
      id: 'mir-mk-glyph', data, pickable: true, onClick, getPosition: (d) => d.position,
      getText: (d) => d.glyph, getColor: (d) => d.color, getSize: 20, sizeUnits: 'pixels',
      characterSet: 'auto', fontFamily: 'monospace', getTextAnchor: 'middle', getAlignmentBaseline: 'center',
    }),
  ];

  if (showLabels) {
    layers.push(
      // baris 1: unitNo
      new TextLayer({
        id: 'mir-mk-label', data, pickable: true, onClick, getPosition: (d) => d.position,
        getText: (d) => d.label, getColor: [36, 50, 64], getSize: 11, sizeUnits: 'pixels',
        getPixelOffset: [13, -6], getTextAnchor: 'start', getAlignmentBaseline: 'center',
        fontFamily: 'monospace', fontWeight: 700, characterSet: 'auto',
        background: true, getBackgroundColor: [255, 255, 255, 190], backgroundPadding: [3, 1],
      }),
      // baris 2: jarak ("X m") / "FARAWAY" — warna = status zona
      new TextLayer({
        id: 'mir-mk-sub', data: data.filter((d) => d.sub), pickable: true, onClick, getPosition: (d) => d.position,
        getText: (d) => d.sub, getColor: (d) => d.color, getSize: 9.5, sizeUnits: 'pixels',
        getPixelOffset: [13, 7], getTextAnchor: 'start', getAlignmentBaseline: 'center',
        fontFamily: 'monospace', fontWeight: 700, characterSet: 'auto',
        background: true, getBackgroundColor: [255, 255, 255, 170], backgroundPadding: [3, 1],
      })
    );
  }

  return layers;
}

// Konektor MIR (port mir-checker MIRLine): garis dari unit → titik terdekat di GARIS DUMPING
// (garis crossing) area tempat unit berada. Bisnis: jarak MIR = jarak ke garis crossing TERDEKAT,
// jadi konektor menjawab "unit ngacu garis yang mana" saat ada >1 garis. Angka jarak ada di marker
// (baris di bawah unitNo), jadi konektor cukup garis + titik kaki (tanpa label, hindari dobel).
// Sumber titik terdekat: telemetry `mir_point` (otoritatif, dari mir-checker) bila ada; selain itu
// dihitung di FE dari geofence dumping_line (turf) — keduanya data nyata.
export function buildMirDistanceLines({ units, geofenceLayers }) {
  // Rakit polygon + garis dumping dari layer geofence (props.data) → turf.
  const dumpingPolys = [];
  const lines = {};
  const closeRing = (ring) => {
    const a = ring[0], b = ring[ring.length - 1];
    return (a[0] === b[0] && a[1] === b[1]) ? ring : [...ring, a]; // turf butuh ring tertutup
  };
  (geofenceLayers || []).forEach((layer) => {
    const id = layer.id || '';
    const d = layer.props?.data?.[0];
    if (!d) return;
    try {
      if (id.startsWith('mir-dumping-area-') && d.polygon?.length >= 4) {
        const p = turf.polygon([closeRing(d.polygon)]); p.properties = { code: d.code ?? id.split('-').pop() }; dumpingPolys.push(p);
      } else if (id.startsWith('mir-dumping-line-') && d.path?.length >= 2) {
        lines[d.code ?? id.split('-').pop()] = turf.lineString(d.path);
      }
    } catch { /* geometri geofence cacat — lewati, jangan crash layer */ }
  });

  const conns = [];
  units.forEach((u) => {
    if (!isValidLonLat(u.longitude, u.latitude)) return;
    const status = zoneStatus({ mirDistance: u.mir_distance, mirInArea: u.mir_in_area, mirUnsafe: u.mir_unsafe });
    if (status !== 'DUMPING' && status !== 'CROSSING') return; // konektor hanya saat di dalam zona
    const src = [u.longitude, u.latitude];
    const srcPt = turf.point(src);
    let target = null;

    if (Array.isArray(u.mir_point) && u.mir_point.length === 2) {
      target = [Number(u.mir_point[0]), Number(u.mir_point[1])]; // otoritatif (mir-checker)
    } else {
      // Pilih garis: area yang memuat unit; fallback = garis global terdekat (bisnis: terdekat).
      let line = null;
      for (const poly of dumpingPolys) {
        if (turf.booleanPointInPolygon(srcPt, poly)) { line = lines[poly.properties.code]; if (line) break; }
      }
      if (!line) {
        let best = Infinity;
        Object.values(lines).forEach((ls) => {
          const np = turf.nearestPointOnLine(ls, srcPt, { units: 'meters' });
          if (np.properties.dist < best) { best = np.properties.dist; line = ls; }
        });
      }
      if (line) target = turf.nearestPointOnLine(line, srcPt, { units: 'meters' }).geometry.coordinates;
    }
    if (!target) return;
    conns.push({ source: src, target, color: statusRgb(status) });
  });
  if (conns.length === 0) return [];

  return [
    new LineLayer({
      id: 'mir-dist-line', data: conns, getSourcePosition: (d) => d.source, getTargetPosition: (d) => d.target,
      getColor: (d) => [...d.color, 230], getWidth: 2, widthUnits: 'pixels',
    }),
    new ScatterplotLayer({
      id: 'mir-dist-foot', data: conns, getPosition: (d) => d.target, stroked: true,
      getFillColor: (d) => d.color, getLineColor: [255, 255, 255, 230], lineWidthMinPixels: 1,
      radiusUnits: 'pixels', getRadius: 3, radiusMinPixels: 3,
    }),
  ];
}

// Marker dari ALERT (saat unit MQTT belum/tak ada) — render alert ber-lat/lon di peta.
// crossing = merah, warning = amber; bentuk ▲ + label unit + ringkasan; klik → detail.
export function buildMirAlertMarkers({ alerts, selectedId, showLabels, onClick }) {
  const data = alerts
    .filter((a) => a.status === 'NEW' && a.lat != null && a.lon != null)
    .map((a) => ({
      id: a.id, deviceId: a.deviceId, unitNo: a.unit, position: [a.lon, a.lat], crossing: a.type === 'CROSSING',
      glyph: '▲', color: a.type === 'CROSSING' ? RED : [224, 138, 60], label: a.unit,
      sub: a.type === 'CROSSING' ? `dalam zona · ${a.peak}` : a.peak.replace(' (band)', ''),
    }));
  if (data.length === 0) return [];

  const crossing = data.filter((d) => d.crossing);
  const selected = data.filter((d) => d.id === selectedId);

  const layers = [
    new ScatterplotLayer({
      id: 'mir-al-halo', data: crossing, getPosition: (d) => d.position, stroked: true, filled: false,
      getLineColor: [...RED, 170], lineWidthMinPixels: 2, radiusUnits: 'pixels', getRadius: 17,
    }),
    new ScatterplotLayer({
      id: 'mir-al-sel', data: selected, getPosition: (d) => d.position, stroked: true, filled: false,
      getLineColor: [...SEL, 255], lineWidthMinPixels: 2, radiusUnits: 'pixels', getRadius: 13,
    }),
    new TextLayer({
      id: 'mir-al-glyph', data, pickable: true, onClick, getPosition: (d) => d.position,
      getText: (d) => d.glyph, getColor: (d) => d.color, getSize: 20, sizeUnits: 'pixels',
      characterSet: 'auto', fontFamily: 'monospace', getTextAnchor: 'middle', getAlignmentBaseline: 'center',
    }),
  ];

  if (showLabels) {
    layers.push(
      new TextLayer({
        id: 'mir-al-label', data, pickable: true, onClick, getPosition: (d) => d.position,
        getText: (d) => d.label, getColor: [36, 50, 64], getSize: 11, sizeUnits: 'pixels',
        getPixelOffset: [13, -6], getTextAnchor: 'start', getAlignmentBaseline: 'center',
        fontFamily: 'monospace', fontWeight: 700, characterSet: 'auto',
        background: true, getBackgroundColor: [255, 255, 255, 190], backgroundPadding: [3, 1],
      }),
      new TextLayer({
        id: 'mir-al-sub', data, pickable: true, onClick, getPosition: (d) => d.position,
        getText: (d) => d.sub, getColor: (d) => d.color, getSize: 9.5, sizeUnits: 'pixels',
        getPixelOffset: [13, 7], getTextAnchor: 'start', getAlignmentBaseline: 'center',
        fontFamily: 'monospace', characterSet: 'auto',
      })
    );
  }

  return layers;
}
