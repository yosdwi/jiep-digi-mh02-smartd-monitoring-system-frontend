import useAreaStore, { AREA_TYPES, areaTypeMeta } from '../state/areaStore';
import { Button, Empty, Field, Input, Label, Select } from '../foundation/ui';
import { color as C, text, space, font } from '../foundation/tokens';

// Area properties.
//
// Not a generic CRUD form: the panel leads with what the area MEANS
// operationally (its type and its speed rule), because that is what makes the
// polygon more than geometry. Provenance and geometry stats sit below, and the
// destructive action is last and visually separate.

const area = (feature) => {
  // Shoelace on the outer ring, converted from square degrees to hectares. Good
  // enough at mine scale (a few km) and avoids a turf round trip per keystroke.
  const ring = feature?.geometry?.type === 'Polygon' ? feature.geometry.coordinates[0] : null;
  if (!ring || ring.length < 4) return null;
  const latRef = ring[0][1] * Math.PI / 180;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  const sqDeg = Math.abs(sum / 2);
  const m2 = sqDeg * (111320 ** 2) * Math.cos(latRef);
  return m2 / 10000;
};

export default function AreaAttributeForm() {
  const collection = useAreaStore((s) => s.collection);
  const selectedIndexes = useAreaStore((s) => s.selectedIndexes);
  const updateProperties = useAreaStore((s) => s.updateProperties);
  const removeSelected = useAreaStore((s) => s.removeSelected);
  const dirty = useAreaStore((s) => s.dirty);
  const save = useAreaStore((s) => s.save);
  const saving = useAreaStore((s) => s.saving);

  const index = selectedIndexes[0];
  const feature = index != null ? collection.features[index] : null;

  if (!feature) {
    return (
      <Empty
        title="Belum ada area terpilih"
        hint="Klik sebuah area di peta, atau gambar area baru dengan alat di toolbar kanan."
        icon="⬠"
      />
    );
  }

  const props = feature.properties || {};
  const hectares = area(feature);
  const meta = areaTypeMeta(props.type);
  const vertexCount = feature.geometry?.type === 'Polygon'
    ? feature.geometry.coordinates[0].length - 1 : null;

  const set = (patch) => updateProperties(index, patch);

  return (
    <div style={{ padding: space[3], display: 'flex', flexDirection: 'column', gap: space[3] }}>
      {props.derivedFrom ? (
        <div style={{
          padding: space[2], background: '#fdf0e3', border: '1px solid #f0d2ad',
          borderRadius: 4, ...text.sm, color: '#a35f1f',
        }}>
          <strong>Usulan dari {props.derivedFrom}</strong> — belum disimpan.
          {props.derivedParams ? (
            <div style={{ ...text.xs, marginTop: 3, fontFamily: font.mono }}>
              ≤{props.derivedParams.maxSpeed} km/j · grid {props.derivedParams.cellMetres} m ·
              min {props.derivedParams.minSamples} sampel · buffer {props.derivedParams.bufferMetres} m
            </div>
          ) : null}
        </div>
      ) : null}

      <Field label="Nama area">
        <Input value={props.name || ''} onChange={(e) => set({ name: e.target.value })} />
      </Field>

      <Field label="Tipe">
        <Select value={props.type || 'other'} onChange={(e) => set({ type: e.target.value })}>
          {AREA_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
      </Field>

      <div style={{
        padding: space[2], border: `1px solid ${C.line}`, borderLeft: `3px solid ${meta.color}`,
        borderRadius: 4, background: C.g0,
      }}>
        <Label style={{ marginBottom: 6 }}>Aturan operasional di area ini</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[2] }}>
          <Field label="Rencana kecepatan">
            <Input
              type="number" min={0} placeholder="—"
              value={props.speedPlan ?? ''}
              onChange={(e) => set({ speedPlan: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </Field>
          <Field label="Kecepatan maksimum">
            <Input
              type="number" min={0} placeholder="—"
              value={props.maxSpeed ?? ''}
              onChange={(e) => set({ maxSpeed: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </Field>
        </div>
        <div style={{ ...text.xs, color: C.g5, marginTop: 5 }}>
          km/jam. Rencana kecepatan dibaca halaman Underspeed sebagai acuan kelas
          untuk unit yang berada di dalam area ini.
        </div>
      </div>

      <Field label="Catatan">
        <textarea
          value={props.note || ''}
          onChange={(e) => set({ note: e.target.value })}
          rows={3}
          style={{
            border: `1px solid ${C.line}`, borderRadius: 4, padding: 6, resize: 'vertical',
            font: `400 13px/18px ${font.sans}`, color: C.ink, outline: 'none', width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </Field>

      <div style={{ borderTop: `1px solid ${C.g1}`, paddingTop: space[2] }}>
        <Label style={{ marginBottom: 4 }}>Geometri</Label>
        <Stat label="Luas" value={hectares != null ? `${hectares.toFixed(2)} ha` : '—'} />
        <Stat label="Titik sudut" value={vertexCount != null ? String(vertexCount) : '—'} />
        <Stat label="Diubah" value={props.updatedAt ? new Date(props.updatedAt).toLocaleString('id-ID') : '—'} />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="primary" onClick={save} disabled={!dirty || saving} style={{ flex: 1 }}>
          {saving ? 'Menyimpan…' : dirty ? 'Simpan perubahan' : 'Tersimpan'}
        </Button>
        <Button variant="danger" onClick={removeSelected}>Hapus</Button>
      </div>

      <div style={{ ...text.xs, color: C.g4, lineHeight: '15px' }}>
        Area tersimpan ke layer terpilih di server. "Simpan perubahan" di sini dan
        "Simpan" di toolbar menulis ke layer yang sama.
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ ...text.sm, color: C.g5 }}>{label}</span>
      <span style={{ ...text.sm, color: C.ink, fontFamily: font.mono, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
