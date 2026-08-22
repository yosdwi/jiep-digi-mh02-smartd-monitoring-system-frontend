import { useMemo } from 'react';
import { LineLayer, TextLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';

/**
 * Hook kustom untuk menangani semua logika tracking yang spesifik untuk MIR.
 * @param {Array<Object>} liveUnits - Array dari data unit yang aktif.
 * @param {Array<Object>} mirGeofences - Array dari geofence MIR (dari useMirLayers).
 * @param {string|null} selectedUnitId - ID dari unit yang sedang dipilih.
 * @returns {Object} - Mengembalikan { mirVisualLayers, selectedUnitMirData }.
 */
export const useMirTrackingLogic = (liveUnits, mirGeofences, selectedUnitId) => {
  const { mirPolygons, mirLines } = useMemo(() => {
    const polygons = { dumping: [], unsafe: [] };
    const lines = {};

    if (!mirGeofences || mirGeofences.length === 0) {
      return { mirPolygons: polygons, mirLines: lines };
    }
    
    mirGeofences.forEach(layer => {
      const id = layer.id;
      const layerData = layer.props.data && layer.props.data[0];
      if (!layerData) return;

      if (id.startsWith('mir-dumping-area-')) {
        // --- PENGECEKAN KEAMANAN UNTUK POLYGON ---
        if (layerData.polygon && layerData.polygon.length >= 4) {
          const turfPoly = turf.polygon([layerData.polygon]); // Turf butuh array of rings
          turfPoly.properties = { code: layerData.code || id.split('-').pop() };
          polygons.dumping.push(turfPoly);
        }
      } else if (id.startsWith('mir-unsafe-area-')) {
        // --- PENGECEKAN KEAMANAN UNTUK POLYGON ---
        if (layerData.polygon && layerData.polygon.length >= 4) {
          const turfPoly = turf.polygon([layerData.polygon]); // Turf butuh array of rings
          polygons.unsafe.push(turfPoly);
        }
      } else if (id.startsWith('mir-dumping-line-')) {
        // --- PENGECEKAN KEAMANAN UNTUK GARIS ---
        if (layerData.path && layerData.path.length >= 2) {
          const areaCode = layerData.code || id.split('-').pop();
          lines[areaCode] = turf.lineString(layerData.path);
        }
      }
    });
    
    return { mirPolygons: polygons, mirLines: lines };
  }, [mirGeofences]);

  const { distanceLines, crossingLabels, selectedUnitMirData } = useMemo(() => {
    const newDistanceLines = [];
    const newCrossingLabels = [];
    let newSelectedUnitMirData = { inDisposalArea: null, distanceToLine: null };

    for (const unit of Object.values(liveUnits)) {
      const unitPoint = turf.point([unit.longitude, unit.latitude]);

      // Cek apakah di dalam DUMPING AREA (SAFE)
      for (const poly of mirPolygons.dumping) {
        if (turf.booleanPointInPolygon(unitPoint, poly)) {
          const areaCode = poly.properties.code;
          const targetLine = mirLines[areaCode];
          
          if (targetLine) {
            const nearestPoint = turf.nearestPointOnLine(targetLine, unitPoint, { units: 'meters' });
            newDistanceLines.push({
              source: [unit.longitude, unit.latitude],
              target: nearestPoint.geometry.coordinates,
            });

            if (unit.deviceId === selectedUnitId) {
              newSelectedUnitMirData.inDisposalArea = areaCode;
              newSelectedUnitMirData.distanceToLine = nearestPoint.properties.dist.toFixed(1);
            }
          }
          break; // Unit hanya bisa di satu disposal pada satu waktu
        }
      }

      // Cek apakah di dalam UNSAFE AREA
      for (const poly of mirPolygons.unsafe) {
        if (turf.booleanPointInPolygon(unitPoint, poly)) {
          newCrossingLabels.push({
            position: [unit.longitude, unit.latitude],
            text: 'CROSSING',
          });
          break;
        }
      }
    }

    return { 
      distanceLines: newDistanceLines, 
      crossingLabels: newCrossingLabels,
      selectedUnitMirData: newSelectedUnitMirData
    };
  }, [liveUnits, mirPolygons, mirLines, selectedUnitId]);

  // Membuat layer visual dari data yang sudah diproses
  const mirVisualLayers = useMemo(() => {
    const layers = [];

    // Layer untuk garis jarak
    if (distanceLines.length > 0) {
      layers.push(new LineLayer({
        id: 'mir-distance-lines',
        data: distanceLines,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: [255, 255, 0, 200], // Kuning
        getWidth: 3,
        pickable: false,
      }));
    }

    // Layer untuk label "CROSSING"
    if (crossingLabels.length > 0) {
      layers.push(new TextLayer({
        id: 'mir-crossing-labels',
        data: crossingLabels,
        getPosition: d => d.position,
        getText: d => d.text,
        getSize: 24,
        getColor: [255, 0, 0, 255], // Merah
        getAngle: 0,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        billboard: true,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'bold',
        outlineWidth: 7,
        outlineColor: [255, 255, 255, 255]
      }));
    }

    return layers;
  }, [distanceLines, crossingLabels]);

  return { mirVisualLayers, selectedUnitMirData };
};