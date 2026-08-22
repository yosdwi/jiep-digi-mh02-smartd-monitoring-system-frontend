import { useMemo, useState } from 'react';
import { Group, Popover } from '@mantine/core';
import { Button, Checkbox, Divider, Input, Skeleton, StatusNote } from '../foundation/ui';
import { color as C, text, space } from '../foundation/tokens';

// Loader as a first-class filter, beside the time range and the units.
//
// It existed only as a "group by loader" checkbox inside the unit picker, which
// made the loader a way of *arranging* the DT list rather than a thing the
// operator filters on — even though "what did LDR-07 haul this shift" is how the
// work is actually assigned and reviewed.
//
// Selecting a loader selects its DTs, and narrows what the unit picker offers.
//
// An earlier version only narrowed, leaving selection to the operator. That was
// wrong for the task: work is assigned by loader, so "LDR-07" already means
// "those trucks", and making someone tick twelve boxes to repeat what they just
// said is busywork. The selection stays editable — see handleLoaderChange in
// ContextBar for how a DT shared between two loaders survives dropping one.

export default function LoaderPicker({
  // The server's loader index, not something derived from the unit rows. Those
  // rows carry loader assignment as decoration and are filtered by the device
  // master, so re-deriving from them undercounts any loader whose DTs are not
  // registered — and drops it entirely when none of them are.
  loaders = null,
  // Whether a response has actually come back. Without it "belum di-fetch" and
  // "fetched, nothing found" both render as an empty array and the picker tells
  // the operator there is no loader data when nothing was ever asked for — which
  // is what happens whenever district is still empty, since the hook returns
  // early and never sets `loading`.
  loaded = false,
  // Set when the server ran but the assignment query itself failed. That used to
  // be swallowed into an empty list, so a broken query and an idle shift looked
  // identical from here.
  assignmentError = null,
  // Set when the query ran clean and still returned nothing, and the server
  // could work out why — currently the region-vs-district mismatch, which is
  // otherwise indistinguishable from a shift where nobody hauled.
  assignmentNote = null,
  // Which system's answer we are reading. It lived inside the unit picker,
  // which put the control that decides the loader→DT mapping behind the control
  // for choosing DTs — two places to look for one question. It belongs here:
  // "who says this DT hauled for that loader" IS the loader question.
  source = 'miforce', onSourceChange,
  value = [], onChange, loading = false, error = null, onOpen, disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const entries = loaders || [];
  const selected = useMemo(() => new Set(value), [value]);

  // Search narrows the list; the bulk actions below operate on what the search
  // left visible, not on everything. "Select all" that quietly reaches past the
  // filter is the classic way these controls surprise people.
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return q ? entries.filter((e) => e.loader.toUpperCase().includes(q)) : entries;
  }, [entries, query]);

  const toggle = (loader) => {
    onChange(selected.has(loader) ? value.filter((v) => v !== loader) : [...value, loader]);
  };

  const label = value.length === 0
    ? 'Semua loader'
    : value.length === 1 ? value[0] : `${value.length} loader`;

  const handleOpen = () => {
    setOpen((o) => {
      if (!o) onOpen?.();
      return !o;
    });
  };

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="bottom-start"
      width={300}
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Button onClick={handleOpen} active={open} disabled={disabled} style={{ minWidth: 120 }}>
          <span style={{ color: C.g5, ...text.sm }}>Loader</span>
          <span style={{ fontWeight: 600 }}>{label}</span>
          <span style={{ color: C.g4 }}>▾</span>
        </Button>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 460 }}>
          {onSourceChange ? (
            <>
              <Group justify="space-between" align="center" p={space[3]} wrap="nowrap">
                <span style={{ ...text.sm, color: C.g5 }}>Sumber penugasan</span>
                <Group gap={0} wrap="nowrap" style={{ border: `1px solid ${C.line}`, borderRadius: 6, overflow: 'hidden' }}>
                  {[
                    { value: 'miforce', label: 'MiForce' },
                    { value: 'timesheet', label: 'Timesheet' },
                  ].map((opt, index) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onSourceChange(opt.value)}
                      style={{
                        border: 'none',
                        borderLeft: index > 0 ? `1px solid ${C.line}` : 'none',
                        padding: `0 ${space[3]}px`, height: 28, cursor: 'pointer',
                        background: source === opt.value ? C.selBg : C.white,
                        color: source === opt.value ? C.sel : C.g6,
                        ...text.sm, fontWeight: 600,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </Group>
              </Group>
              <Divider />
            </>
          ) : null}

          <div style={{ padding: space[3], flexShrink: 0 }}>
            <Input
              placeholder="Cari loader…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Divider />

          <div style={{ flex: 1, overflowY: 'auto', padding: space[2], minHeight: 0 }}>
            {loading ? <Skeleton lines={5} /> : null}

            {!loading && error ? (
              <StatusNote tone="error" title="Gagal memuat loader" hint={error} />
            ) : null}

            {/* The assignment query ran and threw. Distinct from an empty
                result, and the message is the server's so it can be acted on
                rather than guessed at. */}
            {!loading && !error && assignmentError ? (
              <StatusNote
                tone="error"
                title="Penugasan loader gagal dibaca"
                hint={assignmentError}
              />
            ) : null}

            {/* Searched into nothing. Distinct from having no loader data at
                all, and fixed by clearing the box rather than by widening the
                range. */}
            {!loading && !error && !assignmentError && entries.length > 0 && filtered.length === 0 ? (
              <StatusNote
                tone="empty"
                title="Tidak ada loader cocok"
                hint={`Tidak ada loader yang mengandung "${query.trim()}".`}
              />
            ) : null}

            {!loading && !error && !assignmentError && entries.length === 0 ? (
              loaded ? (
                <StatusNote
                  tone="none"
                  title="Tidak ada penugasan loader"
                  hint={assignmentNote
                    || 'Sumber armada tidak mencatat loader mana pun pada rentang jam ini. Coba lebarkan rentang, atau ganti sumber MiForce / Timesheet.'}
                />
              ) : (
                <StatusNote
                  tone="empty"
                  title="Belum dimuat"
                  hint="Penugasan loader dibaca setelah distrik dan rentang waktu terisi."
                />
              )
            ) : null}

            {!loading && !error && !assignmentError && filtered.map((entry) => (
              <div
                key={entry.loader}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: space[2], padding: `6px ${space[2]}px`,
                }}
              >
                <Checkbox
                  checked={selected.has(entry.loader)}
                  onChange={() => toggle(entry.loader)}
                  label={entry.loader}
                  style={{ minWidth: 0, flex: 1 }}
                />
                {/* DTs with data over the total assigned. An operator picking a
                    loader whose fleet reads 0/9 knows before running the query
                    that the answer will be empty. */}
                <span className="tnum" style={{ ...text.xs, color: C.g5, whiteSpace: 'nowrap' }}>
                  {entry.withData}/{entry.unitCount} DT
                </span>
              </div>
            ))}
          </div>

          <Divider />

          {/* Same footer shape as the unit picker: count on the left, bulk
              actions on the right. Two multi-selects sitting next to each other
              in the same bar should not need to be learned separately. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: space[2], padding: space[2], flexShrink: 0, background: C.g0,
          }}>
            <span className="tnum" style={{ ...text.sm, color: C.g5 }}>
              {value.length} dipilih
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={() => onChange([])} disabled={value.length === 0}>
                Kosongkan
              </Button>
              <Button
                size="sm"
                onClick={() => onChange([...new Set([...value, ...filtered.map((e) => e.loader)])])}
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
