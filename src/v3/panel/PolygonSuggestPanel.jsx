import { useCallback, useState } from 'react';
import useAreaStore from '../state/areaStore';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import { Button, Empty, Field, Input, Label } from '../foundation/ui';
import { color as C, text, space, font } from '../foundation/tokens';

// Suggest an operational polygon from the loaded historical traces.
//
// Every parameter is exposed and named in operational terms, because the whole
// argument for buffered trajectory union over alpha shape is that a supervisor
// can see WHY a piece of the polygon appeared. A hidden α would defeat that.
//
// The result is never auto-saved: accepting it creates a normal editable feature
// marked "usulan", with the generating parameters recorded on it.

let worker = null;
let nextId = 1;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/polygonSuggest.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const entry = pending.get(event.data.requestId);
    if (!entry) return;
    pending.delete(event.data.requestId);
    if (event.data.ok) entry.resolve(event.data);
    else entry.reject(new Error(event.data.error));
  };
  return worker;
}

const DEFAULTS = {
  maxSpeed: 5,
  cellMetres: 10,
  minSamples: 3,
  bufferMetres: 18,
  simplifyMetres: 3,
};

export default function PolygonSuggestPanel() {
  const [params, setParams] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const suggestion = useAreaStore((s) => s.suggestion);
  const setSuggestion = useAreaStore((s) => s.setSuggestion);
  const acceptSuggestion = useAreaStore((s) => s.acceptSuggestion);

  const window = useHistoryStore((s) => s.window);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);
  const sampleCount = useHistoryStore((s) => s.status.sampleCount);

  const startMs = window?.startMs ?? rangeStartMs;
  const endMs = window?.endMs ?? rangeEndMs;

  const run = useCallback(async () => {
    const wanted = selectedIds.length > 0 ? new Set(selectedIds) : null;
    const devices = registry.listDevices()
      .filter((d) => !wanted || wanted.has(d.deviceId))
      .map((device) => ({
        deviceId: device.deviceId,
        chunks: [...device.chunks.values()].map((chunk) => ({
          n: chunk.n,
          epochMs: chunk.epochMs,
          position: chunk.position,
          speed: chunk.speed,
        })),
      }));

    if (devices.length === 0) { setError('Belum ada jejak termuat.'); return; }

    setBusy(true);
    setError(null);
    try {
      const w = ensureWorker();
      const requestId = nextId++;
      const result = await new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        w.postMessage({ requestId, devices, startMs, endMs, ...params });
      });
      if (result.polygon) setSuggestion(result);
      else { setSuggestion(null); setError(result.message || 'Tidak ada area yang memenuhi.'); }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [selectedIds, startMs, endMs, params, setSuggestion]);

  if (sampleCount === 0) {
    return (
      <Empty
        title="Perlu jejak historis"
        hint="Muat jejak lewat context bar di atas. Usulan area dibentuk dari tempat unit benar-benar bekerja."
        icon="✧"
      />
    );
  }

  const num = (key, label, hint, min, max, step = 1) => (
    <Field label={label}>
      <Input
        type="number" min={min} max={max} step={step}
        value={params[key]}
        onChange={(e) => setParams((p) => ({ ...p, [key]: Number(e.target.value) }))}
      />
      <span style={{ ...text.xs, color: C.g4, marginTop: 2 }}>{hint}</span>
    </Field>
  );

  return (
    <div style={{ padding: space[3], display: 'flex', flexDirection: 'column', gap: space[3] }}>
      <p style={{ ...text.sm, color: C.g6, margin: 0, lineHeight: '18px' }}>
        Area dibentuk dari titik-titik tempat unit <strong>bekerja</strong> — bukan sekadar
        lewat — lalu dilebarkan dan digabung. Semua parameter di bawah bisa dijelaskan
        ke lapangan.
      </p>

      <div style={{
        padding: space[2], background: C.g0, border: `1px solid ${C.line}`, borderRadius: 4,
        ...text.sm, color: C.g6,
      }}>
        Sumber: {selectedIds.length > 0 ? `${selectedIds.length} unit terpilih` : 'semua unit termuat'}
        {window ? ' · periode terpilih' : ' · seluruh rentang'}
      </div>

      {num('maxSpeed', 'Batas kecepatan (km/jam)', 'Sampel di atas ini dianggap sedang lewat, bukan bekerja', 0, 60)}
      {num('minSamples', 'Minimal sampel per sel', 'Makin tinggi, makin ketat — area sepi tersaring', 1, 500)}
      {num('cellMetres', 'Ukuran sel (m)', 'Resolusi penilaian kepadatan', 2, 100)}
      {num('bufferMetres', 'Pelebaran (m)', 'Jarak dari titik kerja yang ikut masuk area', 1, 200)}
      {num('simplifyMetres', 'Penyederhanaan (m)', 'Makin besar, makin sedikit titik sudut', 0, 50)}

      <Button variant="primary" onClick={run} disabled={busy}>
        {busy ? 'Menghitung...' : 'Buat usulan area'}
      </Button>

      {error ? (
        <div style={{ ...text.sm, color: C.crit }}>{error}</div>
      ) : null}

      {suggestion ? (
        <div style={{
          padding: space[3], border: `1px solid ${C.warn}`, borderRadius: 4,
          background: '#fdf0e3', display: 'flex', flexDirection: 'column', gap: space[2],
        }}>
          <Label style={{ color: '#a35f1f' }}>Usulan siap ditinjau</Label>
          <div style={{ ...text.sm, color: '#a35f1f', fontFamily: font.mono }}>
            {suggestion.cellCount} sel padat · {suggestion.vertexCount} titik sudut
          </div>
          <p style={{ ...text.sm, color: '#a35f1f', margin: 0 }}>
            Pratinjau tampil oranye di peta. Menerima usulan akan membuat area baru
            yang masih bisa kamu ubah titik sudutnya — belum tersimpan.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="primary" onClick={acceptSuggestion} style={{ flex: 1 }}>
              Terima & ubah
            </Button>
            <Button onClick={() => setSuggestion(null)}>Buang</Button>
          </div>
        </div>
      ) : null}

      <div style={{ ...text.xs, color: C.g4, lineHeight: '15px' }}>
        Metode: buffered trajectory union. Dipilih daripada alpha shape karena
        parameternya punya arti operasional, sementara α tidak — dan perubahan kecil
        pada α bisa mengubah bentuk secara drastis, termasuk memunculkan lubang.
      </div>
    </div>
  );
}
