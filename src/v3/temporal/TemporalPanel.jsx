import useHistoryStore from '../state/historyStore';
import TemporalStrip from './TemporalStrip';
import StateTimeline from './StateTimeline';
import { color as C, text, space, radius, layout } from '../foundation/tokens';

// The temporal dock.
//
// Two views over the same time axis, switched explicitly:
//
//   Kepadatan  — GPS sample histogram. Answers "when was the fleet busy" and
//                carries the brush that sets the analysis window.
//   Status     — plm_status occupancy per unit. Answers "what were they doing".
//
// They are not merged into one chart: the histogram is an aggregate the user
// drags on, the status view is per-unit rows the user clicks. Combining them
// would compromise both interactions.
//
// The switcher used to float over the chart at a hardcoded `top: 5, left: 148`
// in 18px-tall buttons. It is now a titled dock header, which is also where the
// map's status readout lands so it stops sitting on top of the map.

const MODES = [
  { key: 'density', label: 'Kepadatan' },
  { key: 'state', label: 'Status siklus' },
];

export default function TemporalPanel({ status = null, style }) {
  const mode = useHistoryStore((s) => s.temporalMode);
  const setMode = useHistoryStore((s) => s.setTemporalMode);
  const hasAnalytics = useHistoryStore((s) => s.analytics.units.length > 0);

  return (
    <section style={{
      height: '100%',
      minHeight: 0,
      flexShrink: 0,
      background: C.white,
      borderTop: `1px solid ${C.line}`,
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}>
      <header style={{
        height: layout.dockHeaderHeight, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: space[3],
        padding: `0 ${space[4]}px`,
        borderBottom: `1px solid ${C.line}`,
      }}>
        <span style={{ ...text.label, color: C.g5, whiteSpace: 'nowrap' }}>
          Analisa waktu
        </span>

        <div style={{
          display: 'flex', border: `1px solid ${C.line}`,
          borderRadius: radius.md, overflow: 'hidden',
        }}>
          {MODES.map((item, index) => {
            const disabled = item.key === 'state' && !hasAnalytics;
            const selected = mode === item.key;
            return (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                title={disabled ? 'Tersedia setelah analitik unit dihitung' : undefined}
                onClick={() => setMode(item.key)}
                style={{
                  border: 'none',
                  borderLeft: index > 0 ? `1px solid ${C.line}` : 'none',
                  padding: `0 ${space[3]}px`,
                  height: layout.controlHeightSm,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  background: selected ? C.selBg : C.white,
                  color: disabled ? C.g3 : selected ? C.sel : C.g6,
                  ...text.sm, fontWeight: 600,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {status}
      </header>

      {mode === 'state' && hasAnalytics ? <StateTimeline /> : <TemporalStrip />}
    </section>
  );
}
