// src/hooks/useKml.js
import { useState, useEffect, useMemo } from 'react';

// Fungsi helper untuk mem-parsing string koordinat KML menjadi array angka.
const parseKMLCoordinates = (coordinateString) => {
  if (!coordinateString) return [];
  return coordinateString.trim().split(/\s+/).map(coord => {
    const parts = coord.split(',');
    if (parts.length >= 2) {
      return [parseFloat(parts[0]), parseFloat(parts[1])]; // [lng, lat]
    }
    return null;
  }).filter(coord => coord !== null);
};

// Hook kustom untuk mengambil dan mem-parsing file KML menjadi GeoJSON.
export const useKml = (kmlUrl, enabled = true) => {
  const [geojsonData, setGeojsonData] = useState(null);
  const [labelData, setLabelData] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!kmlUrl || !enabled) {
      setGeojsonData(null);
      setLabelData([]);
      setLoading(false);
      return;
    }

    const fetchAndParseKml = async () => {
      setLoading(true);
      setError(null);
      console.log(`[useKml] Memulai fetch untuk: ${kmlUrl}`);
      try {
        const response = await fetch(kmlUrl);
        if (!response.ok) {
          throw new Error(`Gagal memuat KML: ${response.status} ${response.statusText}`);
        }
        const kmlText = await response.text();
        
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
        const errorNode = kmlDoc.querySelector('parsererror');
        if (errorNode) {
          throw new Error(`Kesalahan parsing XML: ${errorNode.textContent}`);
        }

        const features = [];
        const labels = [];
        const placemarks = kmlDoc.querySelectorAll('Placemark');

        placemarks.forEach((placemark, index) => {
          const nameEl = placemark.querySelector('name');
          const layerEl = placemark.querySelector('SimpleData[name="Layer"]');
          const name = nameEl ? nameEl.textContent.trim() :
                      layerEl ? layerEl.textContent.trim() : 'Tanpa Nama';
          const properties = { name };

          let labelPosition = null;

          const point = placemark.querySelector('Point coordinates');
          if (point) {
            const coords = parseKMLCoordinates(point.textContent);
            if (coords.length > 0) {
              labelPosition = coords[0];
            }
          }

          const polygon = placemark.querySelector('Polygon coordinates');
          if (polygon) {
            const coordinates = parseKMLCoordinates(polygon.textContent);
            if (coordinates.length > 2) {
              features.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [coordinates] },
                properties,
              });
              if (!labelPosition && coordinates.length > 0) {
                const midIndex = Math.floor(coordinates.length / 2);
                labelPosition = coordinates[midIndex];
              }
            }
          }

          const line = placemark.querySelector('LineString coordinates');
          if (line) {
            const coordinates = parseKMLCoordinates(line.textContent);
            if (coordinates.length > 1) {
              features.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates },
                properties,
              });
              if (!labelPosition) {
                const midIndex = Math.floor(coordinates.length / 2);
                labelPosition = coordinates[midIndex];
              }
            }
          }

          if (labelPosition && name !== 'Tanpa Nama') {
            const offsetMultiplier = 0.002;
            const angle = (index * 60) % 360;
            const radians = angle * Math.PI / 180;

            labels.push({
              position: [
                labelPosition[0],
                labelPosition[1]
              ],
              text: name,
              size: 12,
              color: [255, 255, 255, 220],
              outlineColor: [0, 0, 0, 255],
            });
          }
        });

        console.log(`[useKml] Selesai parsing ${kmlUrl}: Ditemukan ${features.length} features dan ${labels.length} labels.`);
        setGeojsonData({
          type: 'FeatureCollection',
          features: features,
        });
        setLabelData(labels);

      } catch (err) {
        setError(err);
        console.error(`[useKml] Error untuk ${kmlUrl}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseKml();
  }, [kmlUrl, enabled]);

  // Stable object reference so consumers (useDeckGlLayers' useMemo deps) don't
  // recreate GeoJsonLayer/TextLayer every render when the KML content hasn't changed.
  return useMemo(() => ({ data: geojsonData, labels: labelData, loading, error }),
    [geojsonData, labelData, loading, error]);
};
