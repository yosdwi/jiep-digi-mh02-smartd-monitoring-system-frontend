// KML import/export untuk Master Disposal (gaya Google My Maps).
// Polygon disimpan sebagai array [lon, lat]. KML coordinates pakai urutan lon,lat,alt.

const xmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Tutup ring (titik pertama == terakhir) sesuai spesifikasi LinearRing KML.
function closeRing(polygon) {
  const pts = (polygon || []).filter((p) => Array.isArray(p) && p.length >= 2);
  if (pts.length < 3) return pts;
  const [fx, fy] = pts[0];
  const [lx, ly] = pts[pts.length - 1];
  return (fx === lx && fy === ly) ? pts : [...pts, pts[0]];
}

function polygonToCoordString(polygon) {
  return closeRing(polygon)
    .map(([lon, lat]) => `${Number(lon)},${Number(lat)},0`)
    .join(' ');
}

// disposals[] → string KML siap di-download.
export function disposalsToKml(disposals, documentName = 'Master Disposal') {
  const placemarks = (disposals || [])
    .filter((d) => Array.isArray(d.polygon) && d.polygon.length >= 3)
    .map((d) => `    <Placemark>
      <name>${xmlEscape(d.disposal)}</name>
      <ExtendedData>
        <Data name="district"><value>${xmlEscape(d.district)}</value></Data>
        <Data name="isActive"><value>${d.isActive ? 'true' : 'false'}</value></Data>
        <Data name="createdBy"><value>${xmlEscape(d.createdBy)}</value></Data>
        <Data name="createdDate"><value>${xmlEscape(d.createdDate)}</value></Data>
      </ExtendedData>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${polygonToCoordString(d.polygon)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xmlEscape(documentName)}</name>
${placemarks}
  </Document>
</kml>`;
}

function parseCoordString(text) {
  if (!text) return [];
  return text.trim().split(/\s+/).map((tuple) => {
    const [lon, lat] = tuple.split(',');
    const lo = parseFloat(lon);
    const la = parseFloat(lat);
    return (Number.isFinite(lo) && Number.isFinite(la)) ? [lo, la] : null;
  }).filter(Boolean);
}

// string KML → array { disposal, polygon, district, isActive, createdBy }.
// Mengambil semua Placemark yang punya Polygon (outer ring saja).
export function parseKmlToDisposals(kmlText) {
  const doc = new DOMParser().parseFromString(kmlText, 'text/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('File KML tidak valid / gagal di-parse.');
  }
  const readExt = (placemark, key) => {
    const el = placemark.querySelector(`ExtendedData Data[name="${key}"] value`)
      || placemark.querySelector(`ExtendedData SimpleData[name="${key}"]`);
    return el ? el.textContent.trim() : '';
  };

  const out = [];
  doc.querySelectorAll('Placemark').forEach((placemark, index) => {
    const coordsEl = placemark.querySelector('Polygon outerBoundaryIs LinearRing coordinates')
      || placemark.querySelector('Polygon coordinates');
    if (!coordsEl) return;
    const polygon = parseCoordString(coordsEl.textContent);
    if (polygon.length < 3) return;
    // Buang titik penutup yang duplikat (editor pakai ring terbuka).
    if (polygon.length > 3) {
      const [fx, fy] = polygon[0];
      const [lx, ly] = polygon[polygon.length - 1];
      if (fx === lx && fy === ly) polygon.pop();
    }
    const nameEl = placemark.querySelector('name');
    out.push({
      disposal: nameEl ? nameEl.textContent.trim() : `Import ${index + 1}`,
      polygon,
      district: readExt(placemark, 'district'),
      isActive: readExt(placemark, 'isActive') !== 'false',
      createdBy: readExt(placemark, 'createdBy'),
    });
  });
  return out;
}
