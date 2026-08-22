import { useSyncExternalStore } from 'react';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import { getPlayhead, subscribePlayhead } from '../state/playheadRuntime';
import { STATE_META } from '../services/analyticsClient';
import { Empty } from '../foundation/ui';
import { color as C, text, space, font, UNIT_RAMP } from '../foundation/tokens';

// Live VHMS readout during playback: speed, cycle status, payload, fuel, hour
// meter — per selected unit, at the playhead.
//
// V1/V2 have components for this (VHMSOverlay.jsx, TopVHMSDisplay.jsx) but both
// render a hardcoded object literal (`const vhmsData = { engine: { hm:
// '38815.35', ... } }`), so they show the same frozen numbers regardless of the
// data loaded. These values come from the act_tonnage / fuel_level_tm / hm
// columns of the actual Arrow payload.
//
// Updates at ~4/s, not frame rate: a numeric readout changing 60 times a second
// is unreadable, and the map already carries the motion.

const REFRESH_MS = 250;

let lastEmit = 0;
let cached = 0;

// Coarsened playhead: subscribing to the raw RAF value here would re-render this
// panel 60x/s to display a number nobody can read that fast.
function getCoarsePlayhead() {
  const now = performance.now();
  if (now - lastEmit >= REFRESH_MS) {
    lastEmit = now;
    cached = getPlayhead();
  }
  return cached;
}

export default function PlaybackInspector() {
  const playback = useHistoryStore((s) => s.playback);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);
  const units = useHistoryStore((s) => s.analytics.units);
  useSyncExternalStore(subscribePlayhead, getCoarsePlayhead, getCoarsePlayhead);

  const playheadMs = playback.active ? getPlayhead() : null;

  if (!playback.active) {
    return (
      <Empty
        title="Playback tidak aktif"
        hint="Pilih unit lalu tekan Putar. Nilai VHMS di sini mengikuti posisi playhead."
        icon="▶"
      />
    );
  }
  if (selectedIds.length === 0) {
    return <Empty title="Belum ada unit terpilih" icon="▶" />;
  }

  return (
    <div>
      {selectedIds.map((deviceId) => {
        const device = registry.getDevice(deviceId);
        if (!device) return null;
        const sample = registry.sampleAt(deviceId, playheadMs);
        const metrics = units.find((u) => u.deviceId === deviceId);
        return (
          <UnitReadout
            key={deviceId}
            device={device}
            sample={sample}
            metrics={metrics}
          />
        );
      })}
    </div>
  );
}

function UnitReadout({ device, sample, metrics }) {
  const state = sample && Number.isFinite(sample.plmStatus) ? STATE_META[Math.round(sample.plmStatus)] : null;

  return (
    <div style={{ borderBottom: `1px solid ${C.line}` }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `6px ${space[3]}px`, background: C.g0,
      }}>
        <span style={{
          width: 9, height: 9, borderRadius: 2,
          background: UNIT_RAMP[device.colorIndex % UNIT_RAMP.length],
        }} />
        <span style={{ ...text.base, fontWeight: 700, color: C.ink, flex: 1 }}>{device.unitNo}</span>
        {state ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '1px 6px', borderRadius: 3,
            background: `${state.color}22`, border: `1px solid ${state.color}`,
            ...text.xs, fontWeight: 700, color: C.ink,
          }}>
            {state.label}
          </span>
        ) : (
          <span style={{ ...text.xs, color: C.g4 }}>tidak ada sampel</span>
        )}
      </div>

      {sample ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: C.g1 }}>
            <Tile label="Kecepatan" value={Math.round(sample.speed || 0)} unit="km/j" />
            <Tile
              label="Payload"
              value={Number.isFinite(sample.actTonnage) ? sample.actTonnage.toFixed(1) : '—'}
              unit="ton"
            />
            <Tile
              label="Fuel"
              value={Number.isFinite(sample.fuelLevel) ? Math.round(sample.fuelLevel) : '—'}
              unit="L"
            />
          </div>

          <div style={{ padding: `4px ${space[3]}px` }}>
            <MiniRow label="Hour meter" value={Number.isFinite(sample.hm) ? `${sample.hm.toFixed(1)} jam` : '—'} />
            <MiniRow label="Posisi" value={`${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`} />
            {metrics ? (
              <>
                <MiniRow label="Ritase (periode)" value={`${metrics.totalRitase} rit`} />
                <MiniRow
                  label="Cycle time rata-rata"
                  value={metrics.avgCycleTime > 0 ? `${metrics.avgCycleTime.toFixed(1)} menit` : '—'}
                />
              </>
            ) : null}
          </div>
        </>
      ) : (
        <div style={{ padding: `8px ${space[3]}px`, ...text.sm, color: C.g4 }}>
          Tidak ada sampel pada waktu ini — unit kemungkinan di luar rentang atau sinyal terputus.
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, unit }) {
  return (
    <div style={{ background: C.white, padding: '6px 8px', textAlign: 'center' }}>
      <div style={{ ...text.xs, color: C.g5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
        <span style={{ fontSize: 17, fontWeight: 700, fontFamily: font.mono, color: C.ink }}>{value}</span>
        <span style={{ ...text.xs, color: C.g5 }}>{unit}</span>
      </div>
    </div>
  );
}

function MiniRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: space[2], padding: '2px 0' }}>
      <span style={{ ...text.sm, color: C.g5 }}>{label}</span>
      <span style={{ ...text.sm, color: C.ink, fontFamily: font.mono, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
