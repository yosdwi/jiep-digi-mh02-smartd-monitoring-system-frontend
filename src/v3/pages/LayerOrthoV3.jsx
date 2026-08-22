import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useUserStore from '../../stores/userStore';
import useHistoryStore from '../state/historyStore';
import * as geofence from '../services/geofenceApi';
import { CATEGORY_LABELS } from '../services/geofenceApi';
import { parseKmlFile } from '../services/kmlImport';
import {
  deleteOrthoLayer, formatBytes, listOrthoLayers, uploadOrtho,
} from '../services/orthoAdmin';
import {
  Button, Chip, Divider, Empty, Field, Input, Modal, Panel,
  ProgressBar, Select, Skeleton, StatusNote,
} from '../foundation/ui';
import { color as C, layout, radius, space, text } from '../foundation/tokens';

// Dedicated management for everything the map draws *under* the trace.
//
// Two sections, deliberately not one list. Imagery and vector data look alike in
// a layer tree and behave nothing alike: an orthophoto is uploaded, converted
// server-side over minutes and then immutable, while a vector layer is drawn,
// edited and given operational rules. ArcGIS and QGIS both keep basemap and
// operational layers apart for the same reason, and merging them here would put
// an upload progress bar next to a speed-limit field.
//
// Everything is district-scoped. The district comes from the signed-in user, not
// from a control on this page — it is identity, not a filter.

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LayerOrthoV3() {
  const profileDistrict = useUserStore((s) => s.profile?.distrik);
  const contextDistrict = useHistoryStore((s) => s.context.district);
  const district = contextDistrict || profileDistrict || (import.meta.env.DEV ? 'BRCB' : '');

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: C.g0 }}>
      <header style={{
        height: layout.contextBarHeight, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: space[2],
        padding: `0 ${space[5]}px`,
        background: C.white, borderBottom: `1px solid ${C.line}`,
      }}>
        <span style={{ ...text.md, fontWeight: 600, color: C.ink }}>Layer &amp; Orthophoto</span>
        <Chip tone="sel">{district || '—'}</Chip>
        <span style={{ ...text.sm, color: C.g5 }}>
          Semua layer di halaman ini milik distrik ini saja.
        </span>
      </header>

      <div style={{
        display: 'grid', gap: space[4], padding: space[5],
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        alignItems: 'start',
      }}>
        <OrthoSection district={district} />
        <VectorSection district={district} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- orthophoto

function OrthoSection({ district }) {
  const [layers, setLayers] = useState(null);
  const [error, setError] = useState(null);
  const [upload, setUpload] = useState(null);   // { name, phase, value, error }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!district) return;
    try {
      setError(null);
      setLayers(await listOrthoLayers({ district }));
    } catch (err) {
      setError(err.message);
      setLayers([]);
    }
  }, [district]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';           // same file twice in a row must re-trigger
    if (!file) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setUpload({ name: file.name, size: file.size, phase: 'uploading', value: 0 });

    try {
      await uploadOrtho({
        file,
        district,
        signal: controller.signal,
        onProgress: ({ phase, value }) => setUpload((u) => (u ? { ...u, phase, value } : u)),
      });
      setUpload(null);
      await refresh();
    } catch (err) {
      if (err.name === 'AbortError') { setUpload(null); return; }
      setUpload((u) => (u ? { ...u, phase: 'error', error: err.message } : u));
      // The layer row exists even when the wait timed out, so the list is still
      // worth refreshing — the operator may find it already converted.
      refresh();
    } finally {
      abortRef.current = null;
    }
  };

  const remove = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await deleteOrthoLayer({ layerId: target.id });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Panel
      title="Orthophoto"
      actions={
        <Button
          size="sm"
          variant="primary"
          disabled={!district || Boolean(upload && upload.phase !== 'error')}
          onClick={() => fileRef.current?.click()}
        >
          Unggah GeoTIFF
        </Button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".tif,.tiff"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {upload ? <UploadProgress upload={upload} onCancel={() => abortRef.current?.abort()} onDismiss={() => setUpload(null)} /> : null}

      {error ? (
        <div style={{ padding: space[4] }}>
          <StatusNote tone="error" title="Gagal memuat orthophoto" hint={error} action="Coba lagi" onAction={refresh} />
        </div>
      ) : null}

      {layers === null && !error ? <div style={{ padding: space[4] }}><Skeleton lines={3} height={44} /></div> : null}

      {layers?.length === 0 && !error ? (
        <div style={{ padding: space[4] }}>
          <Empty
            title="Belum ada orthophoto"
            hint={`Unggah GeoTIFF untuk distrik ${district}. Konversi berjalan di server dan butuh beberapa menit.`}
          />
        </div>
      ) : null}

      {layers?.map((layer) => (
        <div
          key={layer.id}
          style={{
            display: 'flex', alignItems: 'center', gap: space[3],
            padding: `${space[3]}px ${space[4]}px`,
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              ...text.base, fontWeight: 600, color: C.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {layer.name}
            </div>
            <div style={{ ...text.sm, color: C.g5 }}>
              {fmtDate(layer.uploadedAt)} · {formatBytes(layer.fileSize)} · z{layer.maxZoom}
            </div>
          </div>

          {/* An unconverted layer has no tiles. Saying so is the difference
              between "still processing" and a basemap that silently draws
              nothing when it is selected. */}
          {layer.converted
            ? <Chip tone="ok">siap</Chip>
            : <Chip tone="warn">memproses</Chip>}

          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(layer)}>Hapus</Button>
        </div>
      ))}

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Hapus orthophoto"
        description={`"${confirmDelete?.name}" akan dihapus beserta seluruh tile-nya. Tindakan ini tidak bisa dibatalkan.`}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Batal</Button>
            <Button variant="danger" onClick={remove}>Hapus</Button>
          </>
        }
      />
    </Panel>
  );
}

/**
 * Upload and conversion are reported as two phases, not one bar.
 *
 * Bytes leaving the browser is measurable and monotonic; conversion is a
 * server-side job with no status endpoint, so it can only be described, not
 * measured. One bar covering both would sit at 100% for several minutes and
 * read as a hang.
 */
function UploadProgress({ upload, onCancel, onDismiss }) {
  const { phase, value, name, size, error } = upload;

  if (phase === 'error') {
    return (
      <div style={{ padding: space[4], borderBottom: `1px solid ${C.line}` }}>
        <StatusNote tone="error" title={name} hint={error} action="Tutup" onAction={onDismiss} />
      </div>
    );
  }

  const copy = {
    uploading: { label: 'Mengunggah', hint: `${formatBytes(size)} · dikirim bertahap` },
    merging: { label: 'Menggabungkan di server', hint: 'Menyatukan potongan berkas' },
    converting: {
      label: 'Mengonversi',
      hint: 'Membuat piramida tile. Ini berjalan di server dan bisa beberapa menit — halaman boleh ditinggal.',
    },
  }[phase] || { label: 'Memproses', hint: null };

  return (
    <div style={{
      padding: space[4], borderBottom: `1px solid ${C.line}`, background: C.g0,
      display: 'flex', flexDirection: 'column', gap: space[2],
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] }}>
        <span style={{
          ...text.base, fontWeight: 600, color: C.ink, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </span>
        <Button size="sm" variant="ghost" onClick={onCancel}>Batalkan</Button>
      </div>

      <ProgressBar
        // Indeterminate once the bytes are gone: a bar frozen at 100% while the
        // server works reads as stalled, an indeterminate one reads as busy.
        value={phase === 'uploading' ? value : null}
        label={copy.label}
        hint={copy.hint}
      />
    </div>
  );
}

// ------------------------------------------------------------- vector layers

function VectorSection({ district }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [importTarget, setImportTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setData(await geofence.listLayers());
    } catch (err) {
      setError(err.message);
      setData({ layers: [] });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const layers = data?.layers || [];

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await geofence.createLayer({ name: newName.trim(), description: newDescription.trim() || null });
      setCreating(false);
      setNewName('');
      setNewDescription('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    setBusy(true);
    try {
      await geofence.deleteLayer(target.layerId);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Layer wilayah"
      actions={
        <Button size="sm" variant="primary" disabled={!district || busy} onClick={() => setCreating(true)}>
          Layer baru
        </Button>
      }
    >
      {error ? (
        <div style={{ padding: space[4] }}>
          <StatusNote tone="error" title="Gagal memuat layer" hint={error} action="Coba lagi" onAction={refresh} />
        </div>
      ) : null}

      {data === null && !error ? <div style={{ padding: space[4] }}><Skeleton lines={3} height={44} /></div> : null}

      {data && layers.length === 0 && !error ? (
        <div style={{ padding: space[4] }}>
          <Empty
            title="Belum ada layer"
            hint="Buat layer untuk mengelompokkan area — misalnya “Boundary 2026” atau “Jalan hauling utara” — lalu impor KML atau gambar area di halaman Area Operasi."
          />
        </div>
      ) : null}

      {layers.map((layer) => (
        <div
          key={layer.layerId}
          style={{
            display: 'flex', alignItems: 'center', gap: space[3],
            padding: `${space[3]}px ${space[4]}px`,
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              ...text.base, fontWeight: 600, color: C.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {layer.name}
            </div>
            <div style={{ ...text.sm, color: C.g5 }}>
              {layer.featureCount} area · dibuat {fmtDate(layer.createdAt)}
              {layer.createdBy ? ` · ${layer.createdBy}` : ''}
            </div>
          </div>

          <Button size="sm" onClick={() => setImportTarget(layer)}>Impor KML</Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(layer)}>Hapus</Button>
        </div>
      ))}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Layer baru"
        description={`Layer ini akan menjadi milik distrik ${district}.`}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Batal</Button>
            <Button variant="primary" disabled={!newName.trim() || busy} onClick={create}>Simpan</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
          <Field label="Nama layer">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Boundary 2026"
              autoFocus
            />
          </Field>
          <Field label="Keterangan (opsional)">
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Sumber, tanggal survei, atau catatan lain"
            />
          </Field>
        </div>
      </Modal>

      <KmlImportModal
        layer={importTarget}
        categories={data?.categories}
        onClose={() => setImportTarget(null)}
        onImported={async () => { setImportTarget(null); await refresh(); }}
      />

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Hapus layer"
        description={
          `"${confirmDelete?.name}" beserta ${confirmDelete?.featureCount ?? 0} area di dalamnya akan dinonaktifkan. `
          + 'Data tidak dihapus permanen, tapi tidak lagi muncul di peta.'
        }
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Batal</Button>
            <Button variant="danger" onClick={remove}>Hapus</Button>
          </>
        }
      />
    </Panel>
  );
}

/**
 * Parse, review, then commit.
 *
 * The file is read in the browser and shown as a list before anything is
 * written. Importing forty shapes into the wrong layer is tedious to undo, and
 * "34 area, 2 dilewati" answers before the write whether the file was the one
 * they meant.
 */
function KmlImportModal({ layer, categories, onClose, onImported }) {
  const [parsed, setParsed] = useState(null);
  const [category, setCategory] = useState('other');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!layer) { setParsed(null); setError(null); setCategory('other'); }
  }, [layer]);

  const options = useMemo(
    () => (categories?.length ? categories : Object.keys(CATEGORY_LABELS)),
    [categories],
  );

  const read = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      setParsed({ file, ...(await parseKmlFile(file)) });
    } catch (err) {
      setParsed(null);
      setError(err.message);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      await geofence.createFeatures(parsed.features.map((f) => ({
        layerId: layer.layerId,
        name: f.name,
        category,
        geometryType: f.geometryType,
        geometry: f.geometry,
        source: 'kml',
      })));
      await onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(layer)}
      onClose={onClose}
      title={`Impor KML ke "${layer?.name || ''}"`}
      description="Berkas dibaca di browser dan ditampilkan dulu. Tidak ada yang disimpan sampai kamu menekan Impor."
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" disabled={!parsed || busy} onClick={commit}>
            {busy ? 'Menyimpan…' : `Impor ${parsed?.features.length || 0} area`}
          </Button>
        </>
      }
    >
      <input ref={fileRef} type="file" accept=".kml" onChange={read} style={{ display: 'none' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
          <Button onClick={() => fileRef.current?.click()}>Pilih berkas KML…</Button>
          <span style={{ ...text.sm, color: C.g5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {parsed?.file.name || 'Belum ada berkas dipilih'}
          </span>
        </div>

        {error ? <StatusNote tone="error" title="Berkas tidak bisa dibaca" hint={error} /> : null}

        {parsed ? (
          <>
            <Field label="Kategori untuk semua area yang diimpor">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {options.map((key) => (
                  <option key={key} value={key}>{CATEGORY_LABELS[key] || key}</option>
                ))}
              </Select>
            </Field>

            <Divider />

            <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
              <Chip tone="ok">{parsed.features.length} akan diimpor</Chip>
              {parsed.skipped.length > 0 ? <Chip tone="warn">{parsed.skipped.length} dilewati</Chip> : null}
            </div>

            <div style={{
              maxHeight: 200, overflowY: 'auto',
              border: `1px solid ${C.line}`, borderRadius: radius.md,
            }}>
              {parsed.features.map((feature, index) => (
                <div
                  key={`${feature.name}-${index}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: space[2], padding: `6px ${space[3]}px`,
                    ...text.sm, color: C.ink,
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {feature.name}
                  </span>
                  <span style={{ ...text.xs, color: C.g5, flexShrink: 0 }}>
                    {feature.geometryType === 'polygon' ? 'area' : 'segmen'}
                  </span>
                </div>
              ))}

              {/* Named, not just counted: "2 dilewati" invites the question this
                  answers, and the answer is usually a shape worth fixing. */}
              {parsed.skipped.map((item, index) => (
                <div
                  key={`skip-${item.name}-${index}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: space[2], padding: `6px ${space[3]}px`,
                    ...text.sm, color: C.g4,
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <span style={{ ...text.xs, flexShrink: 0 }}>{item.reason}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
