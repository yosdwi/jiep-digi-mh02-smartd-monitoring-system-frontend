// KML file → geofence feature inputs.
//
// The product's boundaries and haul roads have always been static files dropped
// on the server (`/Monitoring/kml/BOUNDARY_{DISTRICT}.kml`). This is the step
// that turns one of those into managed rows: parse it in the browser, show the
// operator what was found, and let them commit it — rather than uploading an
// opaque file and hoping.
//
// Parsing here rather than server-side is deliberate: it makes the review step
// possible without a staging area, and a malformed file costs a parse instead of
// a round trip and a half-written import.
//
// `hooks/useKml.js` already reads KML for *display*. It is not reused: it is a
// hook bound to a URL and a render, and it discards everything this needs —
// which shape a placemark was, and what it was called.

const KML_NS_TAGS = ['Polygon', 'LineString', 'LinearRing', 'Point'];

function parseCoordinates(text) {
  if (!text) return [];
  return text
    .trim()
    .split(/\s+/)
    .map((triple) => {
      const [lon, lat] = triple.split(',');
      const point = [Number(lon), Number(lat)];
      return Number.isFinite(point[0]) && Number.isFinite(point[1]) ? point : null;
    })
    .filter(Boolean);
}

const firstText = (node, tag) => node.getElementsByTagName(tag)?.[0]?.textContent ?? null;

/** A ring KML left open is still a closed area; GeoJSON requires it to say so. */
function closeRing(ring) {
  if (ring.length < 3) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  return fx === lx && fy === ly ? ring : [...ring, [fx, fy]];
}

/**
 * Reads a KML file into feature inputs ready for `POST /features/bulk`.
 *
 * Returns `{ features, skipped }`. Skipped placemarks are counted and named
 * rather than dropped silently — an import that quietly loses four of forty
 * shapes is worse than one that refuses.
 */
export async function parseKmlFile(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Berkas bukan KML yang valid.');
  }

  const placemarks = [...doc.getElementsByTagName('Placemark')];
  if (placemarks.length === 0) throw new Error('Tidak ada Placemark di dalam berkas ini.');

  const features = [];
  const skipped = [];

  placemarks.forEach((placemark, index) => {
    const name = firstText(placemark, 'name')?.trim() || `Tanpa nama ${index + 1}`;

    const polygon = placemark.getElementsByTagName('Polygon')[0];
    const line = placemark.getElementsByTagName('LineString')[0];

    if (polygon) {
      // Outer boundary only. KML inner boundaries (holes) are rare in this data
      // and a hole the operator cannot see or edit is worse than not importing
      // it — it would silently change what "inside the pit" means.
      const outer = polygon.getElementsByTagName('outerBoundaryIs')[0] || polygon;
      const ring = closeRing(parseCoordinates(firstText(outer, 'coordinates')));
      if (ring.length < 4) { skipped.push({ name, reason: 'kurang dari 3 titik' }); return; }
      features.push({
        name,
        geometryType: 'polygon',
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
      return;
    }

    if (line) {
      const path = parseCoordinates(firstText(line, 'coordinates'));
      if (path.length < 2) { skipped.push({ name, reason: 'kurang dari 2 titik' }); return; }
      features.push({
        name,
        geometryType: 'line',
        geometry: { type: 'LineString', coordinates: path },
      });
      return;
    }

    const kind = KML_NS_TAGS.find((tag) => placemark.getElementsByTagName(tag).length > 0);
    skipped.push({ name, reason: kind ? `${kind} tidak didukung` : 'tanpa geometri' });
  });

  if (features.length === 0) {
    throw new Error('Tidak ada polygon atau garis yang bisa diimpor dari berkas ini.');
  }

  return { features, skipped };
}
