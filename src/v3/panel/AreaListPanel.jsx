import { useRef, useState } from 'react';
import useAreaStore, { areaTypeMeta } from '../state/areaStore';
import { loadPitPolygons } from '../services/dwellClient';
import { Button, Empty, Field, Input, Modal, Select, StatusNote } from '../foundation/ui';
import { color as C, text, space, font } from '../foundation/tokens';

// Layer picker plus area roster plus import/export.
//
// Areas are geofence features that belong to a layer (see areaStore's
// PERSISTENCE note) — the picker at the top is not a filter, it's choosing
// where "Simpan" writes. Switching layers replaces the whole working buffer,
// so it asks first when there are unsaved edits.
//
// Import from the existing pit-stop KML is offered explicitly: those polygons
// are the operational areas the fleet already runs against, and re-drawing them
// by hand would be both wasteful and a source of drift.

function centroid(feature) {
  const ring = feature.geometry?.type === 'Polygon' ? feature.geometry.coordinates[0] : null;
  if (!ring?.length) return null;
  let x = 0; let y = 0;
  ring.forEach(([lon, lat]) => { x += lon; y += lat; });
  return [x / ring.length, y / ring.length];
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AreaListPanel({ onFocus, onOpenAttributes, handoff = null, onSaveHandoff }) {
  const collection = useAreaStore((s) => s.collection);
  const selectedIndexes = useAreaStore((s) => s.selectedIndexes);
  const setSelected = useAreaStore((s) => s.setSelected);
  const importCollection = useAreaStore((s) => s.importCollection);
  const dirty = useAreaStore((s) => s.dirty);
  const save = useAreaStore((s) => s.save);
  const saveError = useAreaStore((s) => s.saveError);
  const layers = useAreaStore((s) => s.layers);
  const layersLoading = useAreaStore((s) => s.layersLoading);
  const layerId = useAreaStore((s) => s.layerId);
  const featuresLoading = useAreaStore((s) => s.featuresLoading);
  const selectLayer = useAreaStore((s) => s.selectLayer);
  const createLayerAndSelect = useAreaStore((s) => s.createLayerAndSelect);
  const fileRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = new Set(selectedIndexes);
  const ready = Boolean(layerId || handoff);

  const switchLayer = (id) => {
    if (dirty && !window.confirm('Ada perubahan belum disimpan di layer ini. Ganti layer dan buang perubahan?')) return;
    selectLayer(id || null);
  };

  const createLayer = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createLayerAndSelect(newName.trim(), null);
      setCreating(false);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  const focus = (index) => {
    setSelected([index]);
    onOpenAttributes?.();
    const c = centroid(collection.features[index]);
    if (c) onFocus?.({ longitude: c[0], latitude: c[1], zoom: 16, transitionDuration: 700 });
  };

  const importPitKml = async () => {
    try {
      const polygons = await loadPitPolygons();
      const features = polygons.map((p, i) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [p.polygon] },
        properties: {
          id: `pit-${i}`,
          name: p.name,
          type: 'pit',
          speedPlan: null,
          maxSpeed: null,
          note: 'Diimpor dari KML pit stop',
          updatedAt: new Date().toISOString(),
        },
      }));
      importCollection({
        type: 'FeatureCollection',
        features: [...collection.features, ...features],
      });
    } catch {
      // KML absent in this environment; the button simply does nothing visible.
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.type === 'FeatureCollection') importCollection(parsed);
    } catch {
      // Ignore malformed input rather than clearing the user's work.
    }
    event.target.value = '';
  };

  return (
    <div>
      {handoff ? (
        <div style={{ padding: space[3], borderBottom: `1px solid ${C.line}`, background: C.selBg }}>
          <strong style={{ display: 'block', ...text.sm, color: C.ink }}>Speed Segments · Draft v{handoff.version}</strong>
          <span style={{ ...text.xs, color: C.g6 }}>{collection.features.length} segment dalam handoff ini.</span>
        </div>
      ) : <div style={{
        padding: space[3], borderBottom: `1px solid ${C.line}`,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <Field label="Layer tujuan">
          <div style={{ display: 'flex', gap: 6 }}>
            <Select
              value={layerId || ''}
              onChange={(e) => switchLayer(e.target.value)}
              disabled={layersLoading}
              style={{ flex: 1 }}
            >
              <option value="">— pilih layer —</option>
              {layers.map((l) => (
                <option key={l.layerId} value={l.layerId}>{l.name} ({l.featureCount})</option>
              ))}
            </Select>
            <Button size="sm" onClick={() => setCreating(true)}>Layer baru</Button>
          </div>
        </Field>
        {!layerId ? (
          <div style={{ ...text.xs, color: C.g5 }}>
            Area digambar akan tersimpan ke layer ini. Layer lain dikelola di halaman Layer &amp; Orthophoto.
          </div>
        ) : null}
        {saveError ? <StatusNote tone="error" title="Gagal menyimpan" hint={saveError} /> : null}
      </div>}

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        padding: space[3], borderBottom: `1px solid ${C.line}`,
        position: 'sticky', top: 0, background: C.white, zIndex: 1,
      }}>
        <Button size="sm" disabled={!layerId || Boolean(handoff)} onClick={importPitKml}>Impor KML pit</Button>
        <Button size="sm" disabled={!layerId || Boolean(handoff)} onClick={() => fileRef.current?.click()}>Impor GeoJSON</Button>
        <Button
          size="sm"
          disabled={collection.features.length === 0}
          onClick={() => download('area-operasi.geojson', JSON.stringify(collection, null, 2), 'application/geo+json')}
        >
          Ekspor
        </Button>
        <Button size="sm" variant={dirty ? 'primary' : 'default'} disabled={!dirty || !ready} onClick={handoff ? onSaveHandoff : save}>
          {dirty ? (handoff ? 'Simpan ke Draft' : 'Simpan') : 'Tersimpan'}
        </Button>
        <input ref={fileRef} type="file" accept=".geojson,.json" onChange={importFile} style={{ display: 'none' }} />
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Layer baru"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Batal</Button>
            <Button variant="primary" disabled={!newName.trim() || busy} onClick={createLayer}>Simpan</Button>
          </>
        }
      >
        <Field label="Nama layer">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Area Operasi 2026" autoFocus />
        </Field>
      </Modal>

      {!ready ? (
        <Empty
          title="Belum ada layer terpilih"
          hint="Pilih atau buat layer di atas dulu — area yang digambar butuh rumah untuk tersimpan."
          icon="◱"
        />
      ) : featuresLoading ? (
        <Empty title="Memuat area..." icon="◷" />
      ) : collection.features.length === 0 ? (
        <Empty
          title="Belum ada area"
          hint="Gambar area baru dengan alat di toolbar kanan, impor dari KML, atau buat usulan dari jejak historis."
          icon="⬠"
        />
      ) : collection.features.map((feature, index) => {
        const props = feature.properties || {};
        const meta = areaTypeMeta(props.type);
        const isSelected = selected.has(index);
        return (
          <button
            key={props.id || index}
            type="button"
            onClick={() => focus(index)}
            style={{
              display: 'flex', alignItems: 'center', gap: space[2], width: '100%',
              padding: `7px ${space[3]}px`, textAlign: 'left', cursor: 'pointer',
              border: 'none', borderBottom: `1px solid ${C.g1}`,
              borderLeft: `3px solid ${isSelected ? C.sel : 'transparent'}`,
              background: isSelected ? C.selBg : C.white,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block', ...text.base, fontWeight: 600, color: C.ink,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {props.name || 'Tanpa nama'}
              </span>
              <span style={{ display: 'block', ...text.sm, color: C.g5 }}>
                {meta.label}
                {props.derivedFrom ? ' · usulan' : ''}
              </span>
            </span>
            {props.speedPlan != null ? (
              <span style={{ ...text.sm, color: C.g6, fontFamily: font.mono, flexShrink: 0 }}>
                {props.speedPlan} km/j
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
