import { useMemo, useState } from 'react';
import { formatDuration } from '../temporal/DwellTimeline';
import { Button, Empty, Label } from '../foundation/ui';
import { color as C, text, space, font, UNIT_RAMP } from '../foundation/tokens';

// Durasi In Pit's own Ringkasan / Metrik unit — overrides HistoryWorkspace's
// cycle-time defaults for this page only (see HistoryWorkspace's sidePanels
// merge-by-key). Both are pure aggregates over the `events` array DurasiInPitV3
// already computes via the dwell worker — no separate data fetch.

export function DurasiInPitSummaryPanel({ events, analysing, polygonCount }) {
  const byPolygon = useMemo(() => {
    const totals = new Map();
    events.forEach((e) => totals.set(e.polygon, (totals.get(e.polygon) || 0) + e.durationMs));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  if (polygonCount === 0) {
    return <Empty title="Polygon area belum dimuat" hint="File KML area operasi tidak tersedia." icon="⬠" />;
  }
  if (analysing) {
    return <Empty title="Menghitung dwell..." hint="Deteksi masuk/keluar berjalan di worker." icon="◷" />;
  }
  if (events.length === 0) {
    return <Empty title="Belum ada ringkasan" hint="Muat jejak lewat context bar di atas." icon="▦" />;
  }

  const totalMs = events.reduce((sum, e) => sum + e.durationMs, 0);
  const topArea = byPolygon[0];

  return (
    <div style={{ paddingBottom: space[4] }}>
      <Section title="Ringkasan dwell">
        <Metric label="Total durasi dwell" value={formatDuration(totalMs)} emphasis />
        <Metric label="Jumlah event" value={events.length.toLocaleString('id-ID')} unit="event" />
        <Metric label="Rata-rata durasi" value={formatDuration(totalMs / events.length)} />
        <Metric label="Area paling lama ditempatin" value={topArea[0]} hint={formatDuration(topArea[1])} />
      </Section>

      <Section title="Total durasi per area">
        {byPolygon.map(([name, ms]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <span style={{ ...text.sm, color: C.g6, flex: 1 }}>{name}</span>
            <span style={{ ...text.sm, color: C.ink, fontFamily: font.mono, fontWeight: 600 }}>
              {formatDuration(ms)}
            </span>
          </div>
        ))}
      </Section>
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

function Metric({ label, value, unit, hint, emphasis }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2], padding: '3px 0' }}>
      <span style={{ ...text.sm, color: C.g6, minWidth: 0 }}>
        {label}
        {hint ? <span style={{ ...text.xs, color: C.g4 }}> · {hint}</span> : null}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
        <span style={{ fontFamily: font.mono, fontWeight: 700, color: C.ink, fontSize: emphasis ? 15 : 13 }}>
          {value}
        </span>
        {unit ? <span style={{ ...text.xs, color: C.g5 }}>{unit}</span> : null}
      </span>
    </div>
  );
}

export function DurasiInPitMetricsTable({ events, analysing, polygonCount, onSelectUnit }) {
  const [sortKey, setSortKey] = useState('totalMs');
  const [ascending, setAscending] = useState(false);

  const units = useMemo(() => {
    const byDevice = new Map();
    events.forEach((e) => {
      const row = byDevice.get(e.deviceId) || {
        deviceId: e.deviceId, unitNo: e.unitNo, colorIndex: e.colorIndex,
        totalMs: 0, eventCount: 0, longestMs: 0, longestEvent: null,
      };
      row.totalMs += e.durationMs;
      row.eventCount += 1;
      if (e.durationMs > row.longestMs) { row.longestMs = e.durationMs; row.longestEvent = e; }
      byDevice.set(e.deviceId, row);
    });
    return [...byDevice.values()].map((row) => ({ ...row, avgMs: row.totalMs / row.eventCount }));
  }, [events]);

  const sorted = useMemo(() => {
    const list = [...units];
    list.sort((a, b) => {
      const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
      return ascending ? diff : -diff;
    });
    return list;
  }, [units, sortKey, ascending]);

  const maxTotal = useMemo(() => Math.max(1, ...units.map((u) => u.totalMs)), [units]);

  if (polygonCount === 0) {
    return <Empty title="Polygon area belum dimuat" hint="File KML area operasi tidak tersedia." icon="⬠" />;
  }
  if (analysing) {
    return <Empty title="Menghitung dwell..." icon="◷" />;
  }
  if (units.length === 0) {
    return <Empty title="Belum ada metrik" hint="Muat jejak lewat context bar di atas." icon="▤" />;
  }

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
        <span style={{ ...text.sm, color: C.g5 }}>{units.length} unit</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380 }}>
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
            {sorted.map((unit) => (
              <tr
                key={unit.deviceId}
                onClick={() => onSelectUnit?.(unit)}
                style={{ cursor: onSelectUnit ? 'pointer' : 'default', background: C.white, borderBottom: `1px solid ${C.g1}` }}
              >
                <td style={{ ...cellStyle, textAlign: 'left', position: 'sticky', left: 0, background: C.white }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: UNIT_RAMP[unit.colorIndex % UNIT_RAMP.length] }} />
                    <span style={{ fontWeight: 600, color: C.ink }}>{unit.unitNo}</span>
                  </span>
                </td>
                {COLUMNS.map((col) => {
                  const value = unit[col.key] || 0;
                  const display = col.fmt ? col.fmt(value) : value.toLocaleString('id-ID');
                  return (
                    <td key={col.key} style={{ ...cellStyle, position: 'relative' }}>
                      {col.bar ? (
                        <span style={{ position: 'absolute', left: 2, right: 2, bottom: 1, height: 2, background: C.g1, borderRadius: 1 }}>
                          <span style={{
                            display: 'block', height: '100%', borderRadius: 1,
                            width: `${Math.min(100, (value / maxTotal) * 100)}%`,
                            background: C.sel,
                          }} />
                        </span>
                      ) : null}
                      <span style={{ fontFamily: font.mono, color: value > 0 ? C.ink : C.g4 }}>{display}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: `${space[2]}px ${space[3]}px`, ...text.xs, color: C.g4 }}>
        Total = jumlah durasi dwell semua event · klik baris untuk lihat event terlama di peta
      </div>
    </div>
  );
}

const COLUMNS = [
  { key: 'totalMs', label: 'Total', width: 60, fmt: formatDuration, bar: true },
  { key: 'eventCount', label: 'Event', width: 50 },
  { key: 'avgMs', label: 'Rata-rata', width: 70, fmt: formatDuration },
  { key: 'longestMs', label: 'Terlama', width: 60, fmt: formatDuration },
];

const headStyle = {
  ...text.xs, fontWeight: 700, color: C.g5, textAlign: 'right', padding: '5px 6px',
  background: C.g0, borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap',
  position: 'sticky', top: 33, zIndex: 1,
};

const cellStyle = { ...text.sm, textAlign: 'right', padding: '5px 6px', whiteSpace: 'nowrap' };
