import { useMemo, useState } from 'react';
import useHistoryStore from '../state/historyStore';
import { Button, Empty, Label } from '../foundation/ui';
import { color as C, text, space, font } from '../foundation/tokens';

// Underspeed's own Ringkasan / Metrik unit — overrides HistoryWorkspace's
// cycle-time defaults for this page only (see HistoryWorkspace's sidePanels
// merge-by-key). Both read analytics.fleet.bandMs / bandDistanceKm and
// analytics.units[].bandMs / bandDistanceKm, which analytics.worker.js fills
// per the current speedBands order (see bySpeedBand).
//
// "Underspeed" = time/distance in every band below the band whose id is
// 'normal' — that band and anything faster is compliant. If no band is
// literally named 'normal' (bands are user-editable), the second-to-last
// band stands in, so ranking still degrades gracefully instead of breaking.

const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');
const fmt1 = (n) => Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function fmtMs(ms) {
  const total = Math.round((ms || 0) / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function compliantCutoff(bands) {
  const idx = bands.findIndex((b) => b.id === 'normal');
  return idx >= 0 ? idx : Math.max(0, bands.length - 2);
}

export function UnderspeedSummaryPanel() {
  const analytics = useHistoryStore((s) => s.analytics);
  const window = useHistoryStore((s) => s.window);
  const speedBands = useHistoryStore((s) => s.speedBands);
  const fleet = analytics.fleet;

  const bandRows = useMemo(() => {
    if (!fleet?.bandMs) return [];
    const totalMs = fleet.bandMs.reduce((a, b) => a + b, 0) || 1;
    return speedBands.map((band, i) => ({
      ...band,
      ms: fleet.bandMs[i] || 0,
      km: fleet.bandDistanceKm[i] || 0,
      share: (fleet.bandMs[i] || 0) / totalMs,
    })).filter((row) => row.ms > 0);
  }, [fleet, speedBands]);

  if (analytics.computing) {
    return <Empty title="Menghitung metrik..." hint="Analisa kelas kecepatan berjalan di worker." icon="◷" />;
  }
  if (!fleet) {
    return (
      <Empty
        title="Belum ada ringkasan"
        hint="Muat jejak lewat context bar di atas. Metrik dihitung dari data yang termuat."
        icon="▦"
      />
    );
  }

  const cutoff = compliantCutoff(speedBands);
  const totalMs = fleet.bandMs.reduce((a, b) => a + b, 0) || 1;
  const totalKm = fleet.bandDistanceKm.reduce((a, b) => a + b, 0);
  const underspeedMs = fleet.bandMs.slice(0, cutoff).reduce((a, b) => a + b, 0);
  const underspeedKm = fleet.bandDistanceKm.slice(0, cutoff).reduce((a, b) => a + b, 0);
  const underspeedShare = underspeedMs / totalMs;

  return (
    <div style={{ paddingBottom: space[4] }}>
      {window ? (
        <div style={{
          padding: `6px ${space[3]}px`, background: C.selBg,
          borderBottom: `1px solid ${C.line}`, ...text.sm, color: C.sel, fontWeight: 600,
        }}>
          Dihitung untuk periode terpilih saja
        </div>
      ) : null}

      <Section title="Alokasi waktu per kelas kecepatan">
        <div style={{
          display: 'flex', height: 22, borderRadius: 3, overflow: 'hidden',
          border: `1px solid ${C.line}`, marginBottom: 8,
        }}>
          {bandRows.map((row) => (
            <div
              key={row.id}
              title={`${row.label} · ${fmtMs(row.ms)} · ${(row.share * 100).toFixed(1)}%`}
              style={{ width: `${row.share * 100}%`, background: row.color }}
            />
          ))}
        </div>

        {bandRows.map((row) => (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: row.color, flexShrink: 0 }} />
            <span style={{ ...text.sm, color: C.g6, flex: 1 }}>{row.label}</span>
            <span style={{ ...text.xs, color: C.g4, fontFamily: font.mono, width: 56, textAlign: 'right' }}>
              {fmt1(row.km)} km
            </span>
            <span style={{ ...text.sm, color: C.ink, fontFamily: font.mono, fontWeight: 600 }}>
              {fmtMs(row.ms)}
            </span>
            <span style={{ ...text.xs, color: C.g4, fontFamily: font.mono, width: 40, textAlign: 'right' }}>
              {(row.share * 100).toFixed(1)}%
            </span>
          </div>
        ))}

        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.g1}`,
        }}>
          <span style={{ ...text.sm, color: C.g5 }}>Waktu underspeed (di bawah Normal)</span>
          <span style={{
            ...text.md, fontWeight: 700, fontFamily: font.mono,
            color: underspeedShare <= 0.25 ? C.ok : underspeedShare <= 0.5 ? C.warn : C.crit,
          }}>
            {(underspeedShare * 100).toFixed(1)}%
          </span>
        </div>
      </Section>

      <Section title="Ringkasan">
        <Metric label="Total waktu underspeed" value={fmtMs(underspeedMs)} />
        <Metric label="Total jarak underspeed" value={fmt1(underspeedKm)} unit="km" />
        <Metric label="Total jarak termuat" value={fmt1(totalKm)} unit="km" />
        <Metric label="Unit aktif" value={fmtInt(fleet.unitCount)} unit="unit" />
      </Section>

      <div style={{ padding: `${space[2]}px ${space[3]}px`, ...text.xs, color: C.g4, lineHeight: '15px' }}>
        {fmtInt(fleet.pointCount)} sampel GPS · kelas kecepatan bisa diubah lewat panel "Kelas kecepatan"
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ padding: `${space[3]}px ${space[3]}px 0`, borderBottom: `1px solid ${C.g1}` }}>
      <Label style={{ marginBottom: 6 }}>{title}</Label>
      <div style={{ paddingBottom: space[3] }}>{children}</div>
    </div>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2], padding: '3px 0' }}>
      <span style={{ ...text.sm, color: C.g6 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
        <span style={{ fontFamily: font.mono, fontWeight: 700, color: C.ink, fontSize: 13 }}>{value}</span>
        {unit ? <span style={{ ...text.xs, color: C.g5 }}>{unit}</span> : null}
      </span>
    </div>
  );
}

const COLUMNS = [
  { key: 'underspeedShare', label: '% Underspeed', width: 90, digits: 1, bar: true },
  { key: 'underspeedMs', label: 'Durasi', width: 60, fmt: fmtMs },
  { key: 'underspeedKm', label: 'Jarak', width: 60, digits: 1 },
  { key: 'totalMs', label: 'Total', width: 60, fmt: fmtMs },
];

export function UnderspeedMetricsTable({ onFocusDevice }) {
  const units = useHistoryStore((s) => s.analytics.units);
  const computing = useHistoryStore((s) => s.analytics.computing);
  const speedBands = useHistoryStore((s) => s.speedBands);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);
  const toggleSelection = useHistoryStore((s) => s.toggleSelection);
  const setSelection = useHistoryStore((s) => s.setSelection);
  const clearSelection = useHistoryStore((s) => s.clearSelection);
  const setPlayback = useHistoryStore((s) => s.setPlayback);

  const [sortKey, setSortKey] = useState('underspeedShare');
  const [ascending, setAscending] = useState(false);

  const rows = useMemo(() => {
    const cutoff = compliantCutoff(speedBands);
    return units.map((u) => {
      const totalMs = (u.bandMs || []).reduce((a, b) => a + b, 0);
      const underspeedMs = (u.bandMs || []).slice(0, cutoff).reduce((a, b) => a + b, 0);
      const underspeedKm = (u.bandDistanceKm || []).slice(0, cutoff).reduce((a, b) => a + b, 0);
      return {
        ...u,
        totalMs,
        underspeedMs,
        underspeedKm,
        underspeedShare: totalMs > 0 ? (underspeedMs / totalMs) * 100 : 0,
      };
    });
  }, [units, speedBands]);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
      return ascending ? diff : -diff;
    });
    return list;
  }, [rows, sortKey, ascending]);

  const maxima = useMemo(() => {
    const out = {};
    COLUMNS.forEach((col) => { out[col.key] = Math.max(1, ...rows.map((u) => u[col.key] || 0)); });
    return out;
  }, [rows]);

  if (computing) return <Empty title="Menghitung metrik..." icon="◷" />;
  if (units.length === 0) {
    return <Empty title="Belum ada metrik" hint="Muat jejak lewat context bar di atas." icon="▤" />;
  }

  const selected = new Set(selectedIds);

  const toggleSort = (key) => {
    if (key === sortKey) setAscending((a) => !a);
    else { setSortKey(key); setAscending(false); }
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `${space[2]}px ${space[3]}px`, borderBottom: `1px solid ${C.line}`,
        position: 'sticky', top: 0, background: C.white, zIndex: 2,
      }}>
        <span style={{ ...text.sm, color: C.g5 }}>{units.length} unit · {selectedIds.length} dipilih</span>
        <div style={{ flex: 1 }} />
        <Button size="sm" onClick={() => setSelection(units.map((u) => u.deviceId))}>Semua</Button>
        <Button size="sm" onClick={clearSelection} disabled={selectedIds.length === 0}>Bersihkan</Button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: 'left', position: 'sticky', left: 0, background: C.g0, zIndex: 1 }}>
                Unit
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  title={`Urut berdasarkan ${col.label}`}
                  style={{ ...headStyle, width: col.width, cursor: 'pointer', color: sortKey === col.key ? C.sel : C.g5 }}
                >
                  {col.label}{sortKey === col.key ? (ascending ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((unit) => {
              const isSelected = selected.has(unit.deviceId);
              return (
                <tr
                  key={unit.deviceId}
                  onClick={() => toggleSelection(unit.deviceId)}
                  onDoubleClick={() => onFocusDevice?.(unit)}
                  style={{ cursor: 'pointer', background: isSelected ? C.selBg : C.white, borderBottom: `1px solid ${C.g1}` }}
                >
                  <td style={{
                    ...cellStyle, textAlign: 'left', position: 'sticky', left: 0,
                    background: isSelected ? C.selBg : C.white,
                    borderLeft: `3px solid ${isSelected ? C.sel : 'transparent'}`,
                  }}>
                    <span style={{ fontWeight: 600, color: C.ink }}>{unit.unitNo}</span>
                  </td>
                  {COLUMNS.map((col) => {
                    const value = unit[col.key] || 0;
                    const display = col.fmt ? col.fmt(value) : fmt1(value);
                    return (
                      <td key={col.key} style={{ ...cellStyle, position: 'relative' }}>
                        {col.bar ? (
                          <span style={{ position: 'absolute', left: 2, right: 2, bottom: 1, height: 2, background: C.g1, borderRadius: 1 }}>
                            <span style={{
                              display: 'block', height: '100%', borderRadius: 1,
                              width: `${Math.min(100, (value / maxima[col.key]) * 100)}%`,
                              background: value > 50 ? C.crit : C.warn,
                            }} />
                          </span>
                        ) : null}
                        <span style={{ fontFamily: font.mono, color: value > 0 ? C.ink : C.g4 }}>{display}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: `${space[2]}px ${space[3]}px`, ...text.xs, color: C.g4 }}>
        % Underspeed = pangsa waktu di kelas di bawah Normal · Durasi/Total dalam jam:menit · Jarak dalam km
      </div>

      <div style={{ padding: `0 ${space[3]}px ${space[3]}px` }}>
        <Button
          variant="primary"
          disabled={selectedIds.length === 0}
          onClick={() => setPlayback({ active: true, playing: true })}
          style={{ width: '100%' }}
        >
          ▶ Putar {selectedIds.length || ''} unit terpilih
        </Button>
      </div>
    </div>
  );
}

const headStyle = {
  ...text.xs, fontWeight: 700, color: C.g5, textAlign: 'right', padding: '5px 6px',
  background: C.g0, borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap',
  position: 'sticky', top: 33, zIndex: 1,
};

const cellStyle = { ...text.sm, textAlign: 'right', padding: '5px 6px', whiteSpace: 'nowrap' };
