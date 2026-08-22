import { useMemo, useSyncExternalStore } from 'react';
import * as registry from '../state/traceRegistry';
import useHistoryStore from '../state/historyStore';
import { color as C, text, space, radius, shadow, font, UNIT_RAMP } from '../foundation/tokens';

// Legend, bottom-left, bound to the ACTIVE colour encoding.
//
// It carries counts, not just swatches. With 1.5-4px dots the classification
// cannot rely on hue discrimination alone (the house principle is "bentuk dulu,
// warna penguat", and at this size shape is unavailable), so the numbers are the
// accessible readout.

const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');

export default function MapLegend() {
  const version = useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);
  const colorMode = useHistoryStore((s) => s.colorMode);
  const speedBands = useHistoryStore((s) => s.speedBands);
  const traceMode = useHistoryStore((s) => s.traceMode);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);

  const devices = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => registry.listDevices(), [version],
  );

  const bandCounts = useMemo(() => {
    if (colorMode !== 'speed') return null;
    const counts = new Uint32Array(speedBands.length);
    devices.forEach((device) => {
      device.chunks.forEach((chunk) => {
        for (let i = 0; i < chunk.n; i++) counts[chunk.band[i]] += 1;
      });
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, colorMode, speedBands.length, devices]);

  if (devices.length === 0) return null;
  if (traceMode === 'density') {
    return (
      <Shell title="Kepadatan">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `4px ${space[3]}px 8px` }}>
          <span style={{ ...text.xs, color: C.g5 }}>jarang</span>
          <div style={{
            flex: 1, height: 8, borderRadius: 2,
            background: 'linear-gradient(90deg,#edf8e9,#c7e9c0,#a1d99b,#74c476,#31a354,#006d2c)',
          }} />
          <span style={{ ...text.xs, color: C.g5 }}>padat</span>
        </div>
      </Shell>
    );
  }

  if (colorMode === 'speed') {
    return (
      <Shell title="Kecepatan">
        {speedBands.map((band, i) => {
          const next = speedBands[i + 1];
          return (
            <LegendRow
              key={band.id}
              color={band.color}
              label={band.label}
              detail={next ? `${band.min}–${next.min - 1} km/j` : `≥ ${band.min} km/j`}
              count={bandCounts ? bandCounts[i] : null}
            />
          );
        })}
      </Shell>
    );
  }

  const shown = devices.slice(0, 10);
  const selected = new Set(selectedIds);

  return (
    <Shell title={`Unit (${devices.length})`}>
      {shown.map((device) => (
        <LegendRow
          key={device.deviceId}
          color={UNIT_RAMP[device.colorIndex % UNIT_RAMP.length]}
          label={device.unitNo}
          count={device.n}
          dim={selected.size > 0 && !selected.has(device.deviceId)}
        />
      ))}
      {devices.length > shown.length ? (
        <div style={{ ...text.sm, color: C.g4, padding: `2px ${space[3]}px 6px` }}>
          +{devices.length - shown.length} unit lain — warna berulang di atas 10 unit
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ title, children }) {
  return (
    <div style={{
      position: 'absolute', left: space[2], bottom: space[2],
      minWidth: 190, maxWidth: 250, maxHeight: '46%', overflowY: 'auto',
      background: C.white, border: `1px solid ${C.lineStrong}`,
      borderRadius: radius.md, boxShadow: shadow.float, zIndex: 10,
    }}>
      <div style={{
        ...text.label, color: C.g5, padding: `6px ${space[3]}px 2px`,
        position: 'sticky', top: 0, background: C.white,
      }}>
        {title}
      </div>
      <div style={{ paddingBottom: 4 }}>{children}</div>
    </div>
  );
}

function LegendRow({ color, label, detail, count, dim }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: `2px ${space[3]}px`, opacity: dim ? 0.4 : 1,
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{
        ...text.sm, color: C.ink, flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      {detail ? <span style={{ ...text.xs, color: C.g4, fontFamily: font.mono }}>{detail}</span> : null}
      {count != null ? (
        <span style={{ ...text.xs, color: C.g5, fontFamily: font.mono, minWidth: 42, textAlign: 'right' }}>
          {fmtInt(count)}
        </span>
      ) : null}
    </div>
  );
}
