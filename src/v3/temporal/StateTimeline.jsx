import { useMemo } from 'react';
import useHistoryStore from '../state/historyStore';
import { STATE_META, STATE_ORDER } from '../services/analyticsClient';
import { color as C, text, space, font, UNIT_RAMP } from '../foundation/tokens';

// Cycle state occupancy: one row per unit, coloured bands for plm_status runs.
//
// This is the readout the density histogram cannot give. A GPS sample histogram
// says "the fleet was busy at 07:00"; this says WHAT they were doing — and a
// column of amber Standby across every unit at the same minute is a stoppage
// that no aggregate number surfaces.
//
// Segments come from analytics.worker.js (run-length encoded plm_status), so the
// rendering cost is proportional to state changes, not to sample count.

const WITA_OFFSET_MS = 8 * 3600 * 1000;

function witaLabel(ms) {
  const d = new Date(ms + WITA_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function fmtMs(ms) {
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

export default function StateTimeline() {
  const units = useHistoryStore((s) => s.analytics.units);
  const computing = useHistoryStore((s) => s.analytics.computing);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);
  const toggleSelection = useHistoryStore((s) => s.toggleSelection);
  const window = useHistoryStore((s) => s.window);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);

  const startMs = window?.startMs ?? rangeStartMs;
  const endMs = window?.endMs ?? rangeEndMs;
  const span = endMs > startMs ? endMs - startMs : 0;

  const legend = useMemo(() => STATE_ORDER.map((s) => ({ state: s, ...STATE_META[s] })), []);
  const selected = new Set(selectedIds);

  if (computing || units.length === 0 || !span) {
    return (
      <div style={{
        flexShrink: 0, height: 84, background: C.white, borderTop: `1px solid ${C.line}`,
        display: 'grid', placeItems: 'center', ...text.sm, color: C.g4,
      }}>
        {computing ? 'Menghitung status siklus...' : 'Belum ada data status siklus.'}
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto',
      background: C.white, borderTop: `1px solid ${C.line}`,
      padding: `6px ${space[3]}px 8px`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ ...text.label, color: C.g5 }}>Status siklus</span>
        {legend.map((item) => (
          <span key={item.state} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
            <span style={{ ...text.xs, color: C.g6 }}>{item.short}</span>
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ ...text.xs, color: C.g4, fontFamily: font.mono }}>
          {witaLabel(startMs)} – {witaLabel(endMs)} WITA
        </span>
      </div>

      {units.map((unit) => {
        const isSelected = selected.has(unit.deviceId);
        return (
          <div
            key={unit.deviceId}
            onClick={() => toggleSelection(unit.deviceId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 19, cursor: 'pointer',
              background: isSelected ? C.selBg : 'transparent',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: 2, flexShrink: 0,
              background: UNIT_RAMP[unit.colorIndex % UNIT_RAMP.length],
            }} />
            <span style={{
              ...text.sm, color: C.ink, fontWeight: isSelected ? 700 : 600,
              width: 66, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {unit.unitNo}
            </span>

            <div style={{
              position: 'relative', flex: 1, height: 13,
              background: C.g0, border: `1px solid ${C.g1}`, borderRadius: 2, overflow: 'hidden',
            }}>
              {unit.segments.map((seg, i) => {
                const left = ((seg.startMs - startMs) / span) * 100;
                const width = ((seg.endMs - seg.startMs) / span) * 100;
                if (left > 100 || left + width < 0) return null;
                const meta = STATE_META[seg.state];
                if (!meta) return null;
                return (
                  <span
                    key={i}
                    title={`${meta.label} · ${witaLabel(seg.startMs)}–${witaLabel(seg.endMs)} · ${fmtMs(seg.endMs - seg.startMs)}`}
                    style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: `${Math.max(0, left)}%`,
                      width: `${Math.max(0.15, Math.min(100 - Math.max(0, left), width))}%`,
                      background: meta.color,
                    }}
                  />
                );
              })}

              {/* Loading markers: the cycle boundary an operator counts by. */}
              {unit.cycles.map((cycle, i) => {
                const left = ((cycle.startMs - startMs) / span) * 100;
                if (left < 0 || left > 100) return null;
                return (
                  <span
                    key={`c${i}`}
                    title={`Siklus ${i + 1} · ${cycle.minutes.toFixed(1)} menit`}
                    style={{
                      position: 'absolute', top: 0, bottom: 0, left: `${left}%`,
                      width: 1, background: C.ink, opacity: 0.55,
                    }}
                  />
                );
              })}
            </div>

            <span style={{ ...text.xs, color: C.g5, fontFamily: font.mono, width: 34, textAlign: 'right' }}>
              {unit.totalRitase} rit
            </span>
            <span style={{ ...text.xs, color: C.g5, fontFamily: font.mono, width: 44, textAlign: 'right' }}>
              {unit.avgCycleTime > 0 ? `${unit.avgCycleTime.toFixed(1)}m` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
