import { useMemo, useState } from 'react';
import useHistoryStore from '../state/historyStore';
import { Button, Empty } from '../foundation/ui';
import { color as C, text, space, font, UNIT_RAMP } from '../foundation/tokens';

// Per-unit operational metrics, ranked.
//
// The comparison question ("which units are behind") is answered by ordering
// plus an in-cell bar on the sorted column, not by a separate bar chart. That
// keeps the numbers legible and the ranking visible in the same glance, which is
// what a shift supervisor scanning 20 units actually needs.

const COLUMNS = [
  { key: 'totalRitase', label: 'Rit', width: 46, digits: 0, bar: true },
  { key: 'avgCycleTime', label: 'CT', width: 52, digits: 1, unit: 'm', lowerIsBetter: true },
  { key: 'averageSpeed', label: 'Kec', width: 48, digits: 1 },
  { key: 'avgJarakFrontDisposal', label: 'Muatan', width: 56, digits: 2 },
  { key: 'avgJarakDisposalFront', label: 'Kosong', width: 56, digits: 2 },
  { key: 'avgPayload', label: 'Payload', width: 56, digits: 1 },
];

const fmt = (n, d) => Number(n || 0).toLocaleString('id-ID', {
  minimumFractionDigits: d, maximumFractionDigits: d,
});

export default function UnitMetricsTable({ onFocusDevice }) {
  const units = useHistoryStore((s) => s.analytics.units);
  const computing = useHistoryStore((s) => s.analytics.computing);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);
  const toggleSelection = useHistoryStore((s) => s.toggleSelection);
  const setSelection = useHistoryStore((s) => s.setSelection);
  const clearSelection = useHistoryStore((s) => s.clearSelection);
  const setPlayback = useHistoryStore((s) => s.setPlayback);

  const [sortKey, setSortKey] = useState('totalRitase');
  const [ascending, setAscending] = useState(false);

  const sorted = useMemo(() => {
    const list = [...units];
    list.sort((a, b) => {
      const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
      return ascending ? diff : -diff;
    });
    return list;
  }, [units, sortKey, ascending]);

  const maxima = useMemo(() => {
    const out = {};
    COLUMNS.forEach((col) => {
      out[col.key] = Math.max(1, ...units.map((u) => u[col.key] || 0));
    });
    return out;
  }, [units]);

  if (computing) return <Empty title="Menghitung metrik..." icon="◷" />;
  if (units.length === 0) {
    return <Empty title="Belum ada metrik" hint="Muat jejak lewat context bar di atas." icon="▤" />;
  }

  const selected = new Set(selectedIds);
  const sortCol = COLUMNS.find((c) => c.key === sortKey);

  const toggleSort = (key) => {
    if (key === sortKey) setAscending((a) => !a);
    else {
      setSortKey(key);
      setAscending(COLUMNS.find((c) => c.key === key)?.lowerIsBetter ?? false);
    }
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `${space[2]}px ${space[3]}px`, borderBottom: `1px solid ${C.line}`,
        position: 'sticky', top: 0, background: C.white, zIndex: 2,
      }}>
        <span style={{ ...text.sm, color: C.g5 }}>
          {units.length} unit · {selectedIds.length} dipilih
        </span>
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
                  style={{
                    ...headStyle, width: col.width, cursor: 'pointer',
                    color: sortKey === col.key ? C.sel : C.g5,
                  }}
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
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? C.selBg : C.white,
                    borderBottom: `1px solid ${C.g1}`,
                  }}
                >
                  <td style={{
                    ...cellStyle, textAlign: 'left', position: 'sticky', left: 0,
                    background: isSelected ? C.selBg : C.white,
                    borderLeft: `3px solid ${isSelected ? C.sel : 'transparent'}`,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                        background: UNIT_RAMP[unit.colorIndex % UNIT_RAMP.length],
                      }} />
                      <span style={{ fontWeight: 600, color: C.ink }}>{unit.unitNo}</span>
                    </span>
                  </td>

                  {COLUMNS.map((col) => {
                    const value = unit[col.key] || 0;
                    const showBar = col.key === sortKey;
                    return (
                      <td key={col.key} style={{ ...cellStyle, position: 'relative' }}>
                        {showBar ? (
                          <span style={{
                            position: 'absolute', left: 2, right: 2, bottom: 1, height: 2,
                            background: C.g1, borderRadius: 1,
                          }}>
                            <span style={{
                              display: 'block', height: '100%', borderRadius: 1,
                              width: `${Math.min(100, (value / maxima[col.key]) * 100)}%`,
                              background: C.sel,
                            }} />
                          </span>
                        ) : null}
                        <span style={{ fontFamily: font.mono, color: value > 0 ? C.ink : C.g4 }}>
                          {fmt(value, col.digits)}
                        </span>
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
        CT = cycle time (menit) · Kec = km/jam · Muatan/Kosong = km rata-rata per rit · Payload = ton
        {sortCol?.lowerIsBetter ? ' · kolom ini makin kecil makin baik' : ''}
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
  ...text.xs,
  fontWeight: 700,
  color: C.g5,
  textAlign: 'right',
  padding: '5px 6px',
  background: C.g0,
  borderBottom: `1px solid ${C.line}`,
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 33,
  zIndex: 1,
};

const cellStyle = {
  ...text.sm,
  textAlign: 'right',
  padding: '5px 6px',
  whiteSpace: 'nowrap',
};
