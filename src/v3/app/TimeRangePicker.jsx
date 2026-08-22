import { useMemo, useState } from 'react';
import { Group, Popover, Stack } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Button, Divider, Input, Label, Select } from '../foundation/ui';
import { color as C, text, space } from '../foundation/tokens';
import {
  ceilHour, endOfDay, floorHour, plusHours, shiftRange, startOfDay, stepRangeDays, toInput,
} from './timeRange';

// Time range as an anchored popover instead of a modal field.
//
// The model is Metabase's filter picker — a shortcut list, a relative builder
// ("N jam terakhir") and an explicit range, switched by a segmented control —
// adapted to this product: the shortcuts are mine shifts, and the resolved range
// is always spelled out at the bottom because a shift preset that silently
// resolves to a future window is worse than no preset at all.
//
// The explicit range now uses Mantine's DateTimePicker rather than the native
// `datetime-local` control. The earlier argument for native — that a calendar
// grid is several hundred lines to hand-write — stopped applying the moment
// Mantine became the primitive layer, and the native control's rendering width
// varies by browser and locale enough that the popover had to be laid out
// around its worst case.

const SHORTCUTS = [
  { key: 'shift1', label: 'Shift 1', hint: '06–18', build: () => shiftRange(1) },
  { key: 'shift2', label: 'Shift 2', hint: '18–06', build: () => shiftRange(2) },
  { key: 'today', label: 'Hari ini', build: () => { const n = new Date(); return [startOfDay(n), endOfDay(n)]; } },
  { key: 'yesterday', label: 'Kemarin', build: () => { const y = new Date(Date.now() - 864e5); return [startOfDay(y), endOfDay(y)]; } },
  { key: '1h', label: '1 jam terakhir', build: () => { const e = new Date(); return [plusHours(e, -1), e]; } },
  { key: '12h', label: '12 jam terakhir', build: () => { const e = new Date(); return [plusHours(e, -12), e]; } },
];

const RELATIVE_UNITS = [
  { value: 'hour', label: 'jam', hours: 1 },
  { value: 'day', label: 'hari', hours: 24 },
];

const MODES = [
  { key: 'preset', label: 'Pintasan' },
  { key: 'relative', label: 'Relatif' },
  { key: 'custom', label: 'Kustom' },
];

const dayMonth = (isoDate) => { const [, m, d] = isoDate.split('-'); return `${d}/${m}`; };

// Same-day ranges drop the repeated date: "12/08 06:00 – 18:00" reads as one
// window, "12/08 06:00 – 12/08 18:00" reads as two timestamps.
function fmtRange(start, end) {
  if (!start || !end) return '—';
  const [sd, st] = start.split('T');
  const [ed, et] = end.split('T');
  if (!st || !et) return '—';
  return sd === ed
    ? `${dayMonth(sd)} ${st} – ${et}`
    : `${dayMonth(sd)} ${st} – ${dayMonth(ed)} ${et}`;
}

/** `YYYY-MM-DDTHH:mm` is the wire format; DateTimePicker speaks Date. */
const toDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default function TimeRangePicker({ startDateTime, endDateTime, onChange }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('preset');
  // What the user picked, not what the dates happen to equal. A relative range
  // stops matching its own shortcut a minute after it is chosen, so deriving the
  // active state from the dates would make the selection flicker off by itself.
  const [picked, setPicked] = useState(null);
  const [relN, setRelN] = useState(6);
  const [relUnit, setRelUnit] = useState('hour');

  // The single place a range leaves this component, so the single place hours
  // are enforced. The relative shortcuts and "N jam terakhir" all build from
  // `new Date()` and would otherwise carry the current minute into a query whose
  // data only exists per hour.
  const apply = (a, b, key = null) => {
    setPicked(key);
    onChange({ startDateTime: toInput(floorHour(a)), endDateTime: toInput(ceilHour(b)) });
  };

  const applyRelative = (n, unit) => {
    const hours = RELATIVE_UNITS.find((u) => u.value === unit).hours * Math.max(1, Number(n) || 1);
    const end = new Date();
    apply(plusHours(end, -hours), end, `rel:${n}${unit}`);
  };

  // Same window, shifted a day. The repeated task is comparing one shift against
  // the same shift yesterday, which otherwise means editing both fields by hand.
  const stepDays = (delta) => {
    const moved = stepRangeDays(startDateTime, endDateTime, delta);
    if (moved) apply(...moved);
  };

  const durationLabel = useMemo(() => {
    const a = Date.parse(startDateTime);
    const b = Date.parse(endDateTime);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    const hours = (b - a) / 3600e3;
    return hours >= 24 ? `${(hours / 24).toFixed(1)} hari` : `${hours.toFixed(hours < 3 ? 1 : 0)} jam`;
  }, [startDateTime, endDateTime]);

  const invalid = Date.parse(endDateTime) <= Date.parse(startDateTime);
  const pickedLabel = SHORTCUTS.find((s) => s.key === picked)?.label;

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="bottom-start"
      width={360}
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Button onClick={() => setOpen((o) => !o)} active={open}>
          <span style={{ color: C.g5, ...text.sm }}>{pickedLabel || 'Waktu'}</span>
          <span style={{ fontWeight: 600 }}>{fmtRange(startDateTime, endDateTime)}</span>
          {durationLabel ? <span style={{ color: C.g4, ...text.sm }}>({durationLabel})</span> : null}
          <span style={{ color: C.g4 }}>▾</span>
        </Button>
      </Popover.Target>

      <Popover.Dropdown p={space[3]}>
        <Stack gap={space[3]}>
          <Group gap={4} grow>
            {MODES.map((m) => (
              <Button key={m.key} size="sm" active={mode === m.key} onClick={() => setMode(m.key)}>
                {m.label}
              </Button>
            ))}
          </Group>

          {mode === 'preset' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {SHORTCUTS.map((s) => (
                <Button
                  key={s.key}
                  size="sm"
                  active={picked === s.key}
                  onClick={() => apply(...s.build(), s.key)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span>{s.label}</span>
                  {s.hint ? <span style={{ ...text.xs, color: C.g4 }}>{s.hint}</span> : null}
                </Button>
              ))}
            </div>
          ) : null}

          {mode === 'relative' ? (
            <Group gap={space[2]} align="flex-end" wrap="nowrap">
              <div style={{ width: 76 }}>
                <Label style={{ marginBottom: 4 }}>Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  value={relN}
                  onChange={(e) => { setRelN(e.target.value); applyRelative(e.target.value, relUnit); }}
                />
              </div>
              <div style={{ width: 96 }}>
                <Label style={{ marginBottom: 4 }}>Satuan</Label>
                <Select
                  value={relUnit}
                  onChange={(e) => { setRelUnit(e.target.value); applyRelative(relN, e.target.value); }}
                >
                  {RELATIVE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </Select>
              </div>
              <span style={{ ...text.base, color: C.g5, paddingBottom: 8 }}>terakhir</span>
            </Group>
          ) : null}

          {mode === 'custom' ? (
            <Stack gap={space[2]}>
              {/* `step: 3600` makes the time input move in whole hours, and the
                  onChange floors anyway — a typed "06:37" is snapped rather than
                  rejected, because refusing a value the control let them enter
                  is the worse of the two. */}
              <DateTimePicker
                label="Dari"
                value={toDate(startDateTime)}
                onChange={(value) => {
                  if (!value) return;
                  setPicked(null);
                  onChange({ startDateTime: toInput(floorHour(value)), endDateTime });
                }}
                valueFormat="DD MMM YYYY HH:00"
                withSeconds={false}
                timeInputProps={{ step: 3600 }}
                // NOT portalled: the calendar must stay inside this popover's DOM.
                // Portalled, its dates land outside the outer dropdown, which reads
                // that as a click-outside and closes mid-selection.
                popoverProps={{ withinPortal: false }}
                styles={{ label: { ...text.label, color: C.g5, marginBottom: 4 } }}
              />
              <DateTimePicker
                label="Sampai"
                value={toDate(endDateTime)}
                onChange={(value) => {
                  if (!value) return;
                  setPicked(null);
                  onChange({ startDateTime, endDateTime: toInput(floorHour(value)) });
                }}
                valueFormat="DD MMM YYYY HH:00"
                withSeconds={false}
                timeInputProps={{ step: 3600 }}
                error={invalid ? 'Harus setelah waktu mulai' : null}
                // NOT portalled: the calendar must stay inside this popover's DOM.
                // Portalled, its dates land outside the outer dropdown, which reads
                // that as a click-outside and closes mid-selection.
                popoverProps={{ withinPortal: false }}
                styles={{ label: { ...text.label, color: C.g5, marginBottom: 4 } }}
              />
              <Group gap={space[2]} align="center" wrap="nowrap">
                <Label style={{ width: 58, flexShrink: 0 }}>Geser</Label>
                <Group gap={6} wrap="nowrap">
                  <Button size="sm" onClick={() => stepDays(-1)}>◂ 1 hari</Button>
                  <Button size="sm" onClick={() => stepDays(1)}>1 hari ▸</Button>
                </Group>
              </Group>
            </Stack>
          ) : null}

          <Divider />

          {/* The resolved window, always. A preset is only trustworthy if what it
              resolved to is visible without leaving the popover. */}
          <Group justify="space-between" align="baseline" gap={space[2]} wrap="nowrap">
            <span className="tnum" style={{ ...text.base, fontWeight: 600, color: invalid ? C.crit : C.ink }}>
              {fmtRange(startDateTime, endDateTime)}
            </span>
            {durationLabel && !invalid ? (
              <span style={{ ...text.sm, color: C.g5 }}>{durationLabel}</span>
            ) : null}
          </Group>

          <div style={{ ...text.sm, color: invalid ? C.crit : C.g5, marginTop: -space[2] }}>
            {invalid
              ? 'Waktu akhir harus setelah waktu mulai.'
              : 'Semua waktu dalam WITA (UTC+8).'}
          </div>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
