import { useMemo, useState } from 'react';
import { Popover } from '@mantine/core';
import { Button, Checkbox, Chip, Input, Divider, Skeleton, StatusNote } from '../foundation/ui';
import { color as C, text, space, radius } from '../foundation/tokens';

// Unit selection by attribute. The map's lasso covers selection by space; both
// write to the same selection set.
//
// Three things this has to get right, all of them business rules rather than
// presentation:
//
//  1. A unit with no data still belongs in the list. It is on the fleet for this
//     district and its absence is itself the finding — hiding it turns "we have
//     no data for DT4153" into "DT4153 does not exist".
//  2. Availability is per hour, so the answer is rarely yes/no. A unit with 18
//     of 24 hours is usable and a unit with 2 is probably not, and only a
//     per-hour view lets an operator tell those apart before running a query.
//  3. A DT can be reassigned to another loader mid-range. That is shown, not
//     filtered away, because the operator needs to recognise it rather than
//     wonder why a trace looks discontinuous.

const COVERAGE = {
  full: { tone: 'ok', label: 'lengkap', color: C.ok },
  partial: { tone: 'warn', label: 'sebagian', color: C.warn },
  none: { tone: 'default', label: 'tanpa data', color: C.g3 },
};

/**
 * One cell per hour in the range: filled where data exists, hollow where it
 * does not. Reads as a shape — a solid block, a gap in the middle, a unit that
 * only ran the back half of the shift — which a "18/24" label cannot convey.
 */
function CoverageStrip({ slots, total, labels }) {
  if (!Array.isArray(slots) || !total) return null;
  const present = new Set(slots);
  // Above ~36 cells the individual hour stops being distinguishable; the strip
  // still reads correctly as a density band.
  const gap = total > 36 ? 0 : 1;
  return (
    <div
      style={{ display: 'flex', gap, alignItems: 'stretch', height: 12, minWidth: 0 }}
      title={labels ? `Jam tersedia: ${slots.map((i) => labels[i]).join(', ') || '—'}` : undefined}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            minWidth: 1,
            borderRadius: 1,
            background: present.has(i) ? C.sel : C.g2,
          }}
        />
      ))}
    </div>
  );
}

function LoaderTrail({ loaders }) {
  if (!loaders || loaders.length === 0) {
    return <span style={{ ...text.xs, color: C.g4 }}>tanpa penugasan</span>;
  }
  if (loaders.length === 1) {
    return <span style={{ ...text.xs, color: C.g5 }}>{loaders[0].loader}</span>;
  }
  // The reassignment case, stated plainly. The order is by first hour worked,
  // so it reads as a sequence: this unit moved from one loader to the next.
  const trail = loaders.map((l) => l.loader).join(' → ');
  return (
    <span
      style={{ ...text.xs, color: C.warn, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      title={loaders.map((l) => `${l.loader}: jam ${l.hours.join(', ')}`).join('\n')}
    >
      {trail}
    </span>
  );
}

export default function UnitPicker({
  value, onChange,
  // Availability is fetched once by ContextBar and shared with the loader
  // picker — see useUnitAvailability. This component used to own the call.
  data = null, loading = false, error = null, onOpen,
  loaderFilter = [],
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('withData');   // withData | all
  const [groupByLoader, setGroupByLoader] = useState(false);

  const units = data?.units || [];
  const hoursExpected = data?.hoursExpected || 0;
  const slotLabels = data?.slotLabels || null;

  const loaderSet = useMemo(() => new Set(loaderFilter), [loaderFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return units.filter((u) => {
      if (scope === 'withData' && u.coverage === 'none') return false;
      // A reassigned DT survives the filter if *any* of its loaders is selected:
      // it really did work to that loader for part of the range, and dropping it
      // would silently shorten the trace the operator is about to analyse.
      if (loaderSet.size > 0) {
        const names = u.loaders?.length ? u.loaders.map((l) => l.loader) : ['Tanpa penugasan'];
        if (!names.some((n) => loaderSet.has(n))) return false;
      }
      return !q || String(u.unitNo).toUpperCase().includes(q);
    });
  }, [units, query, scope, loaderSet]);

  const groups = useMemo(() => {
    if (!groupByLoader) return [{ key: '__all__', label: null, units: filtered }];
    const byLoader = new Map();
    filtered.forEach((u) => {
      const keys = u.loaders?.length ? u.loaders.map((l) => l.loader) : ['Tanpa penugasan'];
      // A reassigned unit is listed under every loader it worked to; that is the
      // truthful answer to "what did this loader have", not a rounding of it.
      keys.forEach((k) => {
        if (!byLoader.has(k)) byLoader.set(k, []);
        byLoader.get(k).push(u);
      });
    });
    return [...byLoader.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => ({ key, label: key, units: list }));
  }, [filtered, groupByLoader]);

  const selected = useMemo(() => new Set(value), [value]);
  const counts = useMemo(() => ({
    full: units.filter((u) => u.coverage === 'full').length,
    partial: units.filter((u) => u.coverage === 'partial').length,
    none: units.filter((u) => u.coverage === 'none').length,
  }), [units]);

  const toggle = (unitNo) => {
    onChange(selected.has(unitNo) ? value.filter((v) => v !== unitNo) : [...value, unitNo]);
  };

  const label = value.length === 0
    ? 'Pilih unit'
    : value.length === 1 ? value[0] : `${value.length} unit`;

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="bottom-start"
      width={420}
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Button
          onClick={() => setOpen((o) => { if (!o) onOpen?.(); return !o; })}
          active={open}
          style={{ minWidth: 120 }}
        >
          <span style={{ color: C.g5, ...text.sm }}>Unit</span>
          <span style={{ fontWeight: 600 }}>{label}</span>
          <span style={{ color: C.g4 }}>▾</span>
        </Button>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        {/* Bounded column, the same shape the loader picker uses.
            Without this wrapper the dropdown has no height limit and the list
            has nothing to scroll inside, so a district with 200 DTs rendered a
            dropdown taller than the viewport and the footer actions were cut
            off the bottom of the screen. */}
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 460 }}>
        <div style={{ padding: space[3], display: 'flex', flexDirection: 'column', gap: space[3], flexShrink: 0 }}>
          <Input
            autoFocus
            placeholder="Cari unit…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: 'withData', label: `Ada data (${counts.full + counts.partial})` },
                { value: 'all', label: `Semua (${units.length})` },
              ]}
            />
            <div style={{ flex: 1 }} />
            <Checkbox checked={groupByLoader} onChange={setGroupByLoader} label="Per loader" />
          </div>

        </div>

        <Divider />

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: space[3], display: 'flex', flexDirection: 'column', gap: space[3] }}>
              {/* The row shape is known, so the wait shows the shape rather than
                  a spinner that says nothing about what is coming. */}
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width={i % 2 ? '46%' : '38%'} height={13} />
                  <Skeleton width="100%" height={10} />
                </div>
              ))}
            </div>
          ) : error ? (
            <StatusNote
              tone="error"
              title="Gagal memuat unit"
              hint={error}
              action="Coba lagi"
              onAction={() => { setData(null); setOpen(false); setTimeout(() => setOpen(true), 0); }}
            />
          ) : filtered.length === 0 ? (
            <StatusNote
              tone="none"
              title="Tidak ada unit yang cocok"
              hint={scope === 'withData' && counts.none > 0
                ? `${counts.none} unit distrik ini tidak punya data pada rentang tersebut. Pilih "Semua" untuk melihatnya.`
                : 'Ubah kata kunci atau rentang waktunya.'}
            />
          ) : groups.map((group) => (
            <div key={group.key}>
              {group.label ? (
                <div style={{
                  position: 'sticky', top: 0, zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `6px ${space[3]}px`, background: C.g0,
                  borderBottom: `1px solid ${C.line}`,
                }}>
                  <span style={{ ...text.xs, fontWeight: 600, color: C.g6 }}>{group.label}</span>
                  <span className="tnum" style={{ ...text.xs, color: C.g5 }}>{group.units.length}</span>
                </div>
              ) : null}

              {group.units.map((unit) => {
                const cov = COVERAGE[unit.coverage] || COVERAGE.none;
                const isSelected = selected.has(unit.unitNo);
                return (
                  <div
                    key={`${group.key}-${unit.unitNo}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: space[3],
                      padding: `7px ${space[3]}px`,
                      borderBottom: `1px solid ${C.g1}`,
                      background: isSelected ? C.selBg : 'transparent',
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggle(unit.unitNo)}
                      label={unit.unitNo}
                      style={{ width: 92, flexShrink: 0, fontWeight: isSelected ? 600 : 400 }}
                    />

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <CoverageStrip slots={unit.slots} total={hoursExpected} labels={slotLabels} />
                      <LoaderTrail loaders={unit.loaders} />
                    </div>

                    <div style={{ width: 78, flexShrink: 0, textAlign: 'right' }}>
                      {/* A hauler the fleet source assigned but the device
                          master does not carry has nothing to trace. That is a
                          master-data problem, not an absence of data, and the
                          two get fixed by different people. */}
                      {unit.registered === false ? (
                        <Chip tone="crit" title="Unit tidak terdaftar di master perangkat">
                          tak terdaftar
                        </Chip>
                      ) : unit.coverage === 'full' ? (
                        <span className="tnum" style={{ ...text.xs, color: C.g5 }}>
                          {unit.hoursAvailable} jam
                        </span>
                      ) : (
                        <Chip tone={cov.tone}>
                          {unit.coverage === 'none'
                            ? cov.label
                            : `${unit.hoursAvailable}/${unit.hoursExpected} jam`}
                        </Chip>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <Divider />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: space[2], padding: space[2], flexShrink: 0, background: C.g0,
        }}>
          <span className="tnum" style={{ ...text.sm, color: C.g5 }}>
            {value.length} dipilih
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => onChange([])} disabled={value.length === 0}>Kosongkan</Button>
            <Button
              size="sm"
              onClick={() => onChange([...new Set([...value, ...filtered.map((u) => u.unitNo)])])}
              disabled={filtered.length === 0}
            >
              Pilih {filtered.length}
            </Button>
          </div>
        </div>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 2, gap: 2,
      background: C.g1, borderRadius: radius.md,
    }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              ...text.xs,
              fontWeight: active ? 600 : 500,
              height: 22, padding: '0 10px',
              border: 'none', borderRadius: radius.sm,
              background: active ? C.white : 'transparent',
              color: active ? C.ink : C.g6,
              boxShadow: active ? '0 1px 1px rgba(30,42,54,0.10)' : 'none',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
