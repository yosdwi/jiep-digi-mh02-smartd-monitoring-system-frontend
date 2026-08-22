import { useMemo } from 'react';
import useHistoryStore from '../state/historyStore';
import { STATE_META, STATE_ORDER } from '../services/analyticsClient';
import { Empty, Label } from '../foundation/ui';
import { color as C, text, space, font } from '../foundation/tokens';

// Fleet-level operational output.
//
// Deliberately NOT a row of giant KPI cards. Management's question is not "what
// is the ritase number" — it is "where is the fleet's time going, and which
// units are behind". So the panel leads with a time-allocation bar (the
// productivity split), then gives the numbers as a dense, scannable definition
// list, then the derived production figure.
//
// Every metric here is computed by analytics.worker.js, which is a faithful port
// of TrackingHistoryController's CalculateTrailAnalytics. The PlaybackV2 API
// itself only returns ritase, average speed and point count, which is why V1/V2
// show 0 for cycle time and both jarak figures on the V2 path.

const fmt = (n, digits = 1) => Number(n || 0).toLocaleString('id-ID', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');

function fmtMinutes(minutes) {
  const total = Math.round(minutes || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function fmtMs(ms) {
  return fmtMinutes((ms || 0) / 60000);
}

export default function FleetSummaryPanel() {
  const analytics = useHistoryStore((s) => s.analytics);
  const status = useHistoryStore((s) => s.status);
  const window = useHistoryStore((s) => s.window);
  const fleet = analytics.fleet;

  const stateRows = useMemo(() => {
    if (!fleet?.stateMs) return [];
    const total = fleet.stateMs.reduce((a, b) => a + b, 0) || 1;
    return STATE_ORDER
      .map((state) => ({
        state,
        ms: fleet.stateMs[state] || 0,
        share: (fleet.stateMs[state] || 0) / total,
        ...STATE_META[state],
      }))
      .filter((row) => row.ms > 0);
  }, [fleet]);

  if (analytics.computing) {
    return <Empty title="Menghitung metrik..." hint="Analisa siklus berjalan di worker." icon="◷" />;
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

  // Productive = actually in the haul cycle. Standby and ACC-ON are not.
  const productiveMs = [3, 4, 5, 6, 2].reduce((sum, s) => sum + (fleet.stateMs[s] || 0), 0);
  const totalMs = fleet.stateMs.reduce((a, b) => a + b, 0) || 1;
  const utilisation = productiveMs / totalMs;

  const estimatedTonnage = fleet.totalRitase * fleet.avgPayload;
  const totalDistance = fleet.totalLoadedDistance + fleet.totalEmptyDistance;

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

      {/* ---- time allocation: the productivity split ---- */}
      <Section title="Alokasi waktu armada">
        <div style={{
          display: 'flex', height: 22, borderRadius: 3, overflow: 'hidden',
          border: `1px solid ${C.line}`, marginBottom: 8,
        }}>
          {stateRows.map((row) => (
            <div
              key={row.state}
              title={`${row.label} · ${fmtMs(row.ms)} · ${(row.share * 100).toFixed(1)}%`}
              style={{ width: `${row.share * 100}%`, background: row.color }}
            />
          ))}
        </div>

        {stateRows.map((row) => (
          <div key={row.state} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0',
          }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: row.color, flexShrink: 0 }} />
            <span style={{ ...text.sm, color: C.g6, flex: 1 }}>{row.label}</span>
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
          <span style={{ ...text.sm, color: C.g5 }}>Waktu dalam siklus</span>
          <span style={{
            ...text.md, fontWeight: 700, fontFamily: font.mono,
            color: utilisation >= 0.75 ? C.ok : utilisation >= 0.5 ? C.warn : C.crit,
          }}>
            {(utilisation * 100).toFixed(1)}%
          </span>
        </div>
      </Section>

      {/* ---- production ---- */}
      <Section title="Produksi">
        <Metric label="Total ritase" value={fmtInt(fleet.totalRitase)} unit="rit" emphasis />
        <Metric label="Payload rata-rata" value={fmt(fleet.avgPayload, 1)} unit="ton" />
        <Metric
          label="Estimasi tonase"
          value={fmtInt(Math.round(estimatedTonnage))}
          unit="ton"
          hint="ritase × payload rata-rata"
        />
        <Metric label="Unit aktif" value={fmtInt(fleet.unitCount)} unit="unit" />
      </Section>

      {/* ---- cycle ---- */}
      <Section title="Siklus">
        <Metric label="Cycle time rata-rata" value={fmt(fleet.avgCycleTime, 2)} unit="menit" emphasis />
        <Metric label="Jarak front → disposal" value={fmt(fleet.avgJarakFrontDisposal, 2)} unit="km" />
        <Metric label="Jarak disposal → front" value={fmt(fleet.avgJarakDisposalFront, 2)} unit="km" />
      </Section>

      {/* ---- haul ---- */}
      <Section title="Angkutan">
        <Metric label="Jarak muatan" value={fmt(fleet.totalLoadedDistance, 2)} unit="km" />
        <Metric label="Jarak kosongan" value={fmt(fleet.totalEmptyDistance, 2)} unit="km" />
        <Metric label="Total jarak" value={fmt(totalDistance, 2)} unit="km" />
        <Metric label="Durasi muatan" value={fmtMinutes(fleet.totalLoadedDuration)} />
        <Metric label="Durasi kosongan" value={fmtMinutes(fleet.totalEmptyDuration)} />
        <Metric label="Kecepatan rata-rata" value={fmt(fleet.averageSpeed, 1)} unit="km/jam" />
      </Section>

      <div style={{ padding: `${space[2]}px ${space[3]}px`, ...text.xs, color: C.g4, lineHeight: '15px' }}>
        {fmtInt(fleet.pointCount)} sampel GPS
        {status.stride > 1 ? ` · dijarangkan 1 dari ${status.stride}, metrik dihitung dari sampel yang termuat` : ''}
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

function Metric({ label, value, unit, hint, emphasis }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: space[2], padding: '3px 0',
    }}>
      <span style={{ ...text.sm, color: C.g6, minWidth: 0 }}>
        {label}
        {hint ? <span style={{ ...text.xs, color: C.g4 }}> · {hint}</span> : null}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
        <span style={{
          fontFamily: font.mono, fontWeight: 700, color: C.ink,
          fontSize: emphasis ? 15 : 13,
        }}>
          {value}
        </span>
        {unit ? <span style={{ ...text.xs, color: C.g5 }}>{unit}</span> : null}
      </span>
    </div>
  );
}
