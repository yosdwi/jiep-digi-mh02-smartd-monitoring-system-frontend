import { useCallback, useMemo, useState } from 'react';
import { EditableGeoJsonLayer, ModifyMode, ViewMode } from '@deck.gl-community/editable-layers';
import { color as C, rgb } from '../v3/foundation/tokens';
import { DEFAULT_VIEW_STATE } from '../v3/map/MapWorkspace';

// Real vertex-editing for the GIS Workspace mode, using the same
// EditableGeoJsonLayer + edit-mode classes MapWorkspace already uses for its
// measure tool (@deck.gl-community/editable-layers is an existing app
// dependency, not something new). Ported from the mockup's "Geometry
// Catalog" + "Inspector" panels — draft-editing UX is real (drag vertices,
// select feature, toggle visibility); PERSISTENCE is not, because there is
// no monitor-system endpoint yet for GIS geometry drafts.
//
// TODO(backend): "Save Geometry" below only writes to localStorage. Wire it
// to a real endpoint (e.g. POST /Monitoring/api/gis/geometry-drafts) once
// monitor-system exposes one, and load the draft from there on mount
// instead of localStorage.
const STORAGE_KEY = 'smartd-v4-gis-draft';

const CATALOG = [
  { key: 'haulRoad', name: 'Haul Road' },
  { key: 'speedCorridor', name: 'Speed Corridor' },
  { key: 'pitStopArea', name: 'Pit Stop Area' },
  { key: 'districtBoundary', name: 'District Boundary' },
  { key: 'loaderEstimate', name: 'Loader Estimate' },
];

function squareAround(lng, lat, half) {
  return [[
    [lng - half, lat - half],
    [lng + half, lat - half],
    [lng + half, lat + half],
    [lng - half, lat + half],
    [lng - half, lat - half],
  ]];
}

function seedFeatureCollection() {
  const { longitude, latitude } = DEFAULT_VIEW_STATE;
  return {
    type: 'FeatureCollection',
    features: CATALOG.map((c, i) => ({
      type: 'Feature',
      properties: { name: c.name, key: c.key },
      geometry: {
        type: 'Polygon',
        coordinates: squareAround(longitude + (i - 2) * 0.012, latitude + 0.01, 0.003),
      },
    })),
  };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { fc: seedFeatureCollection(), savedAt: null };
    const parsed = JSON.parse(raw);
    if (parsed?.fc?.type === 'FeatureCollection') return parsed;
  } catch { /* corrupt/unavailable storage — fall back to seed */ }
  return { fc: seedFeatureCollection(), savedAt: null };
}

function mergeEditedFeatures(fullFc, updatedSubsetFc) {
  const byName = new Map(updatedSubsetFc.features.map((f) => [f.properties.name, f]));
  return {
    ...fullFc,
    features: fullFc.features.map((f) => byName.get(f.properties.name) || f),
  };
}

export function useGisDraft(active) {
  const [{ fc, savedAt }, setDraft] = useState(loadDraft);
  const [visibility, setVisibility] = useState(() => Object.fromEntries(CATALOG.map((c) => [c.name, true])));
  const [selectedName, setSelectedName] = useState(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  const visibleFc = useMemo(() => ({
    ...fc,
    features: fc.features.filter((f) => visibility[f.properties.name]),
  }), [fc, visibility]);

  const selectedIndexInView = useMemo(
    () => visibleFc.features.findIndex((f) => f.properties.name === selectedName),
    [visibleFc, selectedName],
  );

  const onEdit = useCallback(({ updatedData }) => {
    setDraft((prev) => ({ fc: mergeEditedFeatures(prev.fc, updatedData), savedAt: prev.savedAt }));
    setDirty(true);
  }, []);

  const layer = useMemo(() => {
    if (!active) return null;
    return new EditableGeoJsonLayer({
      id: 'v4-gis-draft',
      data: visibleFc,
      mode: editing && selectedIndexInView >= 0 ? new ModifyMode() : new ViewMode(),
      selectedFeatureIndexes: selectedIndexInView >= 0 ? [selectedIndexInView] : [],
      onEdit,
      pickable: true,
      filled: true,
      getFillColor: [...rgb(C.sel), 40],
      getLineColor: [...rgb(C.sel), 220],
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      getEditHandlePointColor: [...rgb(C.warn), 255],
      getEditHandlePointOutlineColor: [255, 255, 255, 255],
      getEditHandlePointRadius: 6,
      editHandlePointRadiusUnits: 'pixels',
    });
  }, [active, visibleFc, editing, selectedIndexInView, onEdit]);

  const saveGeometry = useCallback(() => {
    const now = Date.now();
    // TODO(backend): replace this with a real PUT/POST once monitor-system
    // has a geometry-drafts endpoint — see file header.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ fc, savedAt: now })); } catch { /* storage unavailable */ }
    setDraft({ fc, savedAt: now });
    setDirty(false);
  }, [fc]);

  const selectedFeature = fc.features.find((f) => f.properties.name === selectedName) || null;

  return {
    catalog: CATALOG,
    visibility,
    toggleVisibility: (name) => setVisibility((v) => ({ ...v, [name]: !v[name] })),
    selectedName,
    setSelectedName,
    selectedFeature,
    editing,
    setEditing,
    dirty,
    savedAt,
    saveGeometry,
    layer,
  };
}

export function GisPanels({
  catalog, visibility, toggleVisibility,
  selectedName, setSelectedName, selectedFeature,
  editing, setEditing, dirty, savedAt, saveGeometry,
}) {
  const vertexCount = selectedFeature ? selectedFeature.geometry.coordinates[0].length - 1 : 0;
  return (
    <>
      <aside style={{ position: 'absolute', zIndex: 5, top: 10, left: 10, width: 270, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
        <strong>Geometry Catalog</strong>
        <p className="small">Operational Geometry</p>
        {catalog.map(({ name }) => (
          <label
            key={name}
            style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eef1f4',
              fontSize: 13, cursor: 'pointer', fontWeight: selectedName === name ? 700 : 400,
            }}
          >
            <span onClick={(e) => { e.preventDefault(); setSelectedName(name); }}>
              ◉ {name}
            </span>
            <input type="checkbox" checked={visibility[name]} onChange={() => toggleVisibility(name)} />
          </label>
        ))}
      </aside>
      <aside style={{ position: 'absolute', zIndex: 5, top: 10, right: 58, width: 286, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
        <strong>Inspector</strong>
        {selectedFeature ? (
          <p className="small">
            {selectedFeature.properties.name} · {vertexCount} vertex
            {dirty ? ' · perubahan belum disimpan' : savedAt ? ` · tersimpan ${new Date(savedAt).toLocaleTimeString('id-ID')}` : ''}
          </p>
        ) : (
          <p className="small">Pilih feature di Geometry Catalog untuk melihat detail dan mengedit.</p>
        )}
        <button
          type="button"
          className="btn"
          disabled={!selectedFeature}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Selesai Edit' : 'Edit Vertex'}
        </button>
        <button
          type="button"
          className="btn primary"
          style={{ marginLeft: 6 }}
          disabled={!dirty}
          onClick={saveGeometry}
        >
          Save Geometry
        </button>
        {editing && selectedFeature ? (
          <p className="small" style={{ marginTop: 8 }}>Drag titik pada peta untuk memindahkan vertex.</p>
        ) : null}
      </aside>
    </>
  );
}
