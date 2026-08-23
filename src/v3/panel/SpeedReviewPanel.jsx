import { useMemo, useState } from 'react';
import useSpeedAnalysisStore from '../state/speedAnalysisStore';
import { Button, Checkbox, Empty, Input } from '../foundation/ui';
import { color as C, font, radius, space, text } from '../foundation/tokens';

const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';

export default function SpeedReviewPanel() {
  const draft = useSpeedAnalysisStore((s) => s.draft);
  const active = useSpeedAnalysisStore((s) => s.active);
  const selectedIds = useSpeedAnalysisStore((s) => s.selectedIds);
  const expandedIds = useSpeedAnalysisStore((s) => s.expandedIds);
  const toggleSelected = useSpeedAnalysisStore((s) => s.toggleSelected);
  const toggleExpanded = useSpeedAnalysisStore((s) => s.toggleExpanded);
  const selectAll = useSpeedAnalysisStore((s) => s.selectAll);
  const clearSelection = useSpeedAnalysisStore((s) => s.clearSelection);
  const updateSegment = useSpeedAnalysisStore((s) => s.updateSegment);
  const [search, setSearch] = useState('');

  const source = draft || active;
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();
    (source?.segments || []).filter((segment) => !q || [segment.id, segment.routeName, segment.roadName]
      .some((value) => String(value || '').toLowerCase().includes(q)))
      .forEach((segment) => {
        const list = map.get(segment.routeId) || [];
        list.push(segment); map.set(segment.routeId, list);
      });
    return [...map.entries()];
  }, [source, search]);

  if (!source) {
    return <Empty title="Belum ada Speed Layer" hint="Tekan Auto Suggest setelah jejak selesai dimuat." icon="✧" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ padding: space[3], borderBottom: `1px solid ${C.line}`, display: 'grid', gap: space[2] }}>
        <Input placeholder="Cari segment atau road…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
          <Button size="sm" onClick={selectAll}>Pilih semua</Button>
          <Button size="sm" onClick={clearSelection}>Kosongkan</Button>
          <span style={{ marginLeft: 'auto', ...text.sm, color: C.g5 }}>{selectedIds.length} dipilih</span>
        </div>
      </div>

      {groups.map(([routeId, segments]) => (
        <section key={routeId}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: `7px ${space[3]}px`, background: C.g0, borderBottom: `1px solid ${C.line}`,
          }}>
            <strong style={{ ...text.sm, color: C.ink }}>{segments[0]?.routeName || routeId}</strong>
            <span style={{ ...text.xs, color: C.g5 }}>{segments.length} segment</span>
          </div>

          {segments.map((segment) => {
            const selected = selectedIds.includes(segment.id);
            const expanded = expandedIds.includes(segment.id);
            return (
              <div key={segment.id} style={{ borderBottom: `1px solid ${C.g1}`, background: selected ? C.selBg : C.white }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: space[2], padding: `7px ${space[3]}px` }}>
                  <Checkbox checked={selected} onChange={() => toggleSelected(segment.id)} />
                  <button
                    type="button"
                    onClick={() => toggleExpanded(segment.id)}
                    style={{ flex: 1, border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ ...text.sm, color: C.ink, fontFamily: font.mono }}>{segment.id}</strong>
                      <ChangeChip value={segment.change} />
                    </span>
                    <span style={{ display: 'block', marginTop: 2, ...text.xs, color: C.g5 }}>
                      {segment.roadName || 'Unassigned'} · {segment.distanceMetres} m · {segment.samples.toLocaleString('id-ID')} titik
                    </span>
                  </button>
                  <button type="button" onClick={() => toggleExpanded(segment.id)} aria-label="Buka evidence" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.g5 }}>
                    {expanded ? '▾' : '▸'}
                  </button>
                </div>

                {expanded ? (
                  <div style={{ padding: `0 ${space[3]}px ${space[3]}px 34px`, display: 'grid', gap: space[2] }}>
                    <label style={{ ...text.xs, color: C.g5 }}>
                      Road Name
                      <Input
                        value={segment.roadName || ''}
                        disabled={!draft}
                        placeholder="Assign Road Name"
                        onChange={(event) => updateSegment(segment.id, { roadName: event.target.value })}
                        style={{ marginTop: 3 }}
                      />
                    </label>
                    <label style={{ ...text.xs, color: C.g5 }}>
                      Speed Plan (km/jam)
                      <Input
                        type="number"
                        value={segment.proposedPlan ?? ''}
                        disabled={!draft}
                        onChange={(event) => updateSegment(segment.id, { proposedPlan: event.target.value === '' ? null : Number(event.target.value) })}
                        style={{ marginTop: 3 }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: space[3], ...text.xs, color: C.g6 }}>
                      <span>Actual <strong>{fmt(segment.avgActual)} km/jam</strong></span>
                      <span>Suggest <strong>{fmt(segment.suggestedPlan, 0)} km/jam</strong></span>
                    </div>
                    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 5 }}>
                      {(segment.units || []).length ? segment.units.map((unit) => (
                        <div key={unit.deviceId} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', ...text.xs, color: C.g6 }}>
                          <span>{unit.unitNo || unit.deviceId}</span>
                          <span>{fmt(unit.avgSpeed)} km/jam · {unit.samples} titik</span>
                        </div>
                      )) : <span style={{ ...text.xs, color: C.g4 }}>Belum ada Unit evidence.</span>}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function ChangeChip({ value }) {
  const tone = value === 'No Recent Coverage' ? C.warn
    : value === 'New Segment' ? '#7b61a8'
      : value === 'Boundary Change' ? C.sel
        : value === 'Active' || value === 'Unchanged' ? C.ok : C.g5;
  return (
    <span style={{
      padding: '1px 5px', borderRadius: radius.full, background: `${tone}18`, color: tone,
      ...text.micro, fontWeight: 800,
    }}>
      {value}
    </span>
  );
}
