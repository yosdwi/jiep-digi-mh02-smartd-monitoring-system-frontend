import { useMemo } from 'react';
import { color as C, text, space, font, UNIT_RAMP } from '../foundation/tokens';

// Durasi In Pit's temporal view: one row per unit, a bar per dwell event.
//
// This is the "WHEN and HOW LONG" surface. A density histogram cannot show it —
// five bars stacked at the same time on the same polygon is a queue, and no
// chart type states that as plainly as occupancy bars on a shared time axis.
//
// Rows are sorted by total dwell descending, which serves unit comparison
// without needing a separate ranking chart.

const WITA_OFFSET_MS = 8 * 3600 * 1000;

function witaLabel(ms) {
  const d = new Date(ms + WITA_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

export default function DwellTimeline({ events, startMs, endMs, selectedEventId, onSelectEvent }) {
  const span = endMs > startMs ? endMs - startMs : 0;

  const rows = useMemo(() => {
    const byUnit = new Map();
    events.forEach((e) => {
      if (!byUnit.has(e.unitNo)) byUnit.set(e.unitNo, { unitNo: e.unitNo, colorIndex: e.colorIndex, events: [], total: 0 });
      const row = byUnit.get(e.unitNo);
      row.events.push(e);
      row.total += e.durationMs;
    });
    return [...byUnit.values()].sort((a, b) => b.total - a.total);
  }, [events]);

  if (!span || rows.length === 0) {
    return (
      <div style={{
        flexShrink: 0, height: 76, background: C.white, borderTop: `1px solid ${C.line}`,
        display: 'grid', placeItems: 'center', ...text.sm, color: C.g4,
      }}>
        Belum ada event dwell pada rentang ini.
      </div>
    );
  }

  return (
    <div style={{
      flexShrink: 0, maxHeight: 168, overflowY: 'auto',
      background: C.white, borderTop: `1px solid ${C.line}`,
      padding: `6px ${space[3]}px 8px`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginBottom: 4 }}>
        <span style={{ ...text.label, color: C.g5 }}>Okupansi area</span>
        <span style={{ ...text.sm, color: C.g4 }}>
          {events.length} event · {rows.length} unit · diurutkan dari total terlama
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ ...text.xs, color: C.g4, fontFamily: font.mono }}>
          {witaLabel(startMs)} – {witaLabel(endMs)} WITA
        </span>
      </div>

      {rows.map((row) => (
        <div key={row.unitNo} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 2, flexShrink: 0,
            background: UNIT_RAMP[row.colorIndex % UNIT_RAMP.length],
          }} />
          <span style={{
            ...text.sm, color: C.ink, fontWeight: 600, width: 66, flexShrink: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {row.unitNo}
          </span>

          <div style={{
            position: 'relative', flex: 1, height: 12,
            background: C.g0, border: `1px solid ${C.g1}`, borderRadius: 2,
          }}>
            {row.events.map((e) => {
              const left = ((e.startMs - startMs) / span) * 100;
              const width = Math.max(0.4, ((e.endMs - e.startMs) / span) * 100);
              const id = `${e.deviceId}|${e.startMs}`;
              const isSelected = selectedEventId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectEvent?.(e, id)}
                  title={`${e.polygon} · ${witaLabel(e.startMs)}–${witaLabel(e.endMs)} · ${formatDuration(e.durationMs)}`}
                  style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${left}%`, width: `${width}%`, minWidth: 2,
                    background: isSelected ? C.sel : C.g5,
                    border: isSelected ? `1px solid ${C.ink}` : 'none',
                    borderRadius: 1, padding: 0, cursor: 'pointer',
                  }}
                />
              );
            })}
          </div>

          <span style={{ ...text.sm, color: C.g5, fontFamily: font.mono, width: 52, textAlign: 'right' }}>
            {formatDuration(row.total)}
          </span>
        </div>
      ))}
    </div>
  );
}
