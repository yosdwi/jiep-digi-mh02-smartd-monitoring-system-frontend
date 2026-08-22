import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Checkbox, Chip, Divider, Input, Label, Modal, ProgressBar, Skeleton, StatusNote,
} from '../foundation/ui';
import { color as C, text, space, radius } from '../foundation/tokens';
import {
  cancelExport, createExport, downloadExport, getExportOptions, waitForExport,
} from '../services/exportApi';

// Raw/historical export.
//
// Built as a scope-then-shape form rather than a wizard: every choice here is
// independent, an operator changing one should not have to walk past the others,
// and the whole thing has to fit the answer to "what am I about to get".
//
// The estimate line is the point of the design. Interval and format decide
// whether this is a 40 MB download or a 4 GB one, and that consequence is stated
// before the job is started rather than discovered afterwards.

const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');

function fmtBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function Section({ title, hint, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: space[2], paddingBottom: space[4] }}>
      <div>
        <Label>{title}</Label>
        {hint ? <div style={{ ...text.xs, color: C.g5, marginTop: 2 }}>{hint}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Choice({ options, value, onChange, describe }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'inline-flex', padding: 2, gap: 2, background: C.g1, borderRadius: radius.md, alignSelf: 'flex-start' }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              disabled={opt.disabled}
              title={opt.title}
              style={{
                ...text.sm,
                fontWeight: active ? 600 : 500,
                height: 26, padding: '0 12px',
                border: 'none', borderRadius: radius.sm,
                background: active ? C.white : 'transparent',
                color: opt.disabled ? C.g4 : active ? C.ink : C.g6,
                boxShadow: active ? '0 1px 1px rgba(30,42,54,0.10)' : 'none',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {describe ? <div style={{ ...text.xs, color: C.g5 }}>{describe}</div> : null}
    </div>
  );
}

export default function ExportDialog({ open, onClose, context, district }) {
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState(null);

  const [format, setFormat] = useState('csv');
  const [interval, setInterval] = useState(0);
  const [coordinates, setCoordinates] = useState('lonlat');
  const [columns, setColumns] = useState(null);
  const [fileName, setFileName] = useState('');

  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setOptionsError(null);
    getExportOptions(controller.signal)
      .then((data) => {
        setOptions(data);
        setColumns((current) => current ?? data.columns.filter((c) => c.defaultOn).map((c) => c.key));
      })
      .catch((err) => { if (err.name !== 'AbortError') setOptionsError(err.message); });
    return () => controller.abort();
  }, [open]);

  // Parquet is streamed straight out of the query engine, which has no
  // projection maths; UTM is applied row by row in the service. Rather than
  // silently ignoring one of the two choices, the impossible pair is disabled
  // and says why.
  const utmBlocked = format === 'parquet';
  useEffect(() => {
    if (utmBlocked && coordinates === 'utm') setCoordinates('lonlat');
  }, [utmBlocked, coordinates]);

  const unitCount = context?.unitNos?.length || 0;
  const hours = useMemo(() => {
    const start = Date.parse(context?.startDateTime);
    const end = Date.parse(context?.endDateTime);
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, (end - start) / 3600000) : 0;
  }, [context?.startDateTime, context?.endDateTime]);

  // One sample per second per unit is the known cadence, so the row count is
  // arithmetic rather than a guess. Deliberately labelled an estimate: units
  // with gaps produce fewer.
  const estimatedRows = useMemo(() => {
    const perUnitPerHour = 3600 / Math.max(1, interval || 1);
    return Math.round(unitCount * hours * perUnitPerHour);
  }, [unitCount, hours, interval]);

  const busy = job && ['queued', 'running'].includes(job.state);
  const ready = job?.state === 'ready';

  const start = useCallback(async () => {
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const created = await createExport({
        district,
        unitNos: context.unitNos,
        startDateTime: context.startDateTime,
        endDateTime: context.endDateTime,
        intervalSeconds: interval,
        columns,
        coordinates,
        format,
        fileName: fileName.trim() || null,
      }, controller.signal);
      setJob(created);
      const finished = await waitForExport(created.id, { signal: controller.signal, onProgress: setJob });
      setJob(finished);
      if (finished.state === 'failed') setError(finished.message || 'Export gagal.');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    }
  }, [district, context, interval, columns, coordinates, format, fileName]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (job?.id) cancelExport(job.id);
    setJob(null);
  }, [job]);

  const close = useCallback(() => {
    // A running job is left running: the file is still being written and the
    // user may reopen to collect it. Only the polling stops.
    abortRef.current?.abort();
    onClose?.();
  }, [onClose]);

  const toggleColumn = (key) => {
    setColumns((current) => (current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key]));
  };

  const canStart = unitCount > 0 && hours > 0 && (columns?.length || 0) > 0 && !busy;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Export data historis"
      description="Data mentah sesuai konteks yang sedang dilihat."
      width={640}
      footer={
        ready ? (
          <>
            <Button variant="ghost" onClick={close}>Tutup</Button>
            <Button variant="primary" onClick={() => downloadExport(job)}>
              Unduh {fmtBytes(job.sizeBytes)}
            </Button>
          </>
        ) : busy ? (
          <>
            <Button variant="ghost" onClick={stop}>Batalkan</Button>
            <Button variant="primary" disabled>Menyiapkan…</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Batal</Button>
            <Button variant="primary" onClick={start} disabled={!canStart}>Siapkan berkas</Button>
          </>
        )
      }
    >
      {optionsError ? (
        <StatusNote tone="error" title="Gagal memuat pilihan export" hint={optionsError} />
      ) : !options ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <Skeleton lines={3} height={14} />
          <Skeleton lines={4} height={14} />
        </div>
      ) : (
        <>
          {/* Scope is shown, not edited: it is the context bar's job, and
              duplicating those controls here is how two sources of truth start. */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: space[2], alignItems: 'center',
            padding: space[3], marginBottom: space[4],
            background: C.g0, border: `1px solid ${C.line}`, borderRadius: radius.md,
          }}>
            <Chip tone="sel">{district || '—'}</Chip>
            <span style={{ ...text.sm, color: C.g6 }}>
              {unitCount} unit · {hours.toFixed(hours % 1 ? 1 : 0)} jam
            </span>
            <span style={{ ...text.xs, color: C.g5 }}>
              {context?.startDateTime?.replace('T', ' ')} → {context?.endDateTime?.replace('T', ' ')}
            </span>
          </div>

          {busy || ready || error ? (
            <div style={{ marginBottom: space[4] }}>
              {error ? (
                <StatusNote
                  tone="error"
                  title="Export gagal"
                  hint={error}
                  action="Coba lagi"
                  onAction={() => { setError(null); setJob(null); }}
                />
              ) : (
                <div style={{
                  padding: space[3], border: `1px solid ${C.line}`, borderRadius: radius.md,
                }}>
                  <ProgressBar
                    value={ready ? 100 : job?.progress ?? null}
                    label={ready ? 'Berkas siap' : job?.message || 'Menyiapkan berkas…'}
                    hint={job?.totalRows
                      ? `${fmtInt(job.rowsWritten)} dari ${fmtInt(job.totalRows)} baris`
                      : 'Menghitung jumlah baris…'}
                  />
                </div>
              )}
            </div>
          ) : null}

          <Section title="Format">
            <Choice
              options={options.formats.map((f) => ({ value: f.key, label: f.label, title: f.note }))}
              value={format}
              onChange={setFormat}
              describe={options.formats.find((f) => f.key === format)?.note}
            />
          </Section>

          <Divider style={{ marginBottom: space[4] }} />

          <Section
            title="Resolusi"
            hint="Data terekam satu baris per detik per unit. Menjarangkan sampel memperkecil berkas secara proporsional."
          >
            <Choice
              options={options.intervals.map((i) => ({
                value: i.seconds,
                label: i.seconds === 0 ? 'Asli' : `${i.seconds}s`,
                title: i.label,
              }))}
              value={interval}
              onChange={setInterval}
              describe={`Perkiraan ${fmtInt(estimatedRows)} baris`}
            />
          </Section>

          <Divider style={{ marginBottom: space[4] }} />

          <Section title="Koordinat">
            <Choice
              options={[
                { value: 'lonlat', label: 'Lat / Lon (WGS84)' },
                {
                  value: 'utm',
                  label: 'UTM',
                  disabled: utmBlocked,
                  title: utmBlocked ? 'Parquet ditulis langsung oleh mesin kueri, yang tidak melakukan proyeksi. Pilih CSV atau XLSX untuk UTM.' : undefined,
                },
              ]}
              value={coordinates}
              onChange={setCoordinates}
              describe={utmBlocked
                ? 'UTM tidak tersedia untuk Parquet — pilih CSV atau XLSX.'
                : coordinates === 'utm'
                  ? 'Zona ditentukan dari titik pertama dan dipakai untuk seluruh berkas.'
                  : null}
            />
          </Section>

          <Divider style={{ marginBottom: space[4] }} />

          <Section title={`Kolom (${columns?.length || 0})`}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: `${space[1]}px ${space[3]}px`,
            }}>
              {options.columns.map((col) => (
                <Checkbox
                  key={col.key}
                  checked={columns?.includes(col.key) || false}
                  onChange={() => toggleColumn(col.key)}
                  label={col.label}
                />
              ))}
            </div>
          </Section>

          <Divider style={{ marginBottom: space[4] }} />

          <Section title="Nama berkas" hint="Kosongkan untuk memakai nama otomatis dari distrik dan rentang waktu.">
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="datalog-BRCB-…"
            />
          </Section>
        </>
      )}
    </Modal>
  );
}
