import { forwardRef } from 'react';
import {
  ActionIcon,
  Badge,
  Button as MButton,
  Checkbox as MCheckbox,
  Divider as MDivider,
  Group,
  Input as MInput,
  LoadingOverlay,
  Modal as MModal,
  NativeSelect,
  Paper,
  Progress,
  Skeleton as MSkeleton,
  Slider as MSlider,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { color as C, font, text, space, layout } from './tokens';

// The V3 primitive layer, built on Mantine.
//
// This file is an ADAPTER, not a re-export. Twenty components already import
// these names with these prop shapes, so the contracts below are unchanged —
// `variant="primary"`, `tone="crit"`, `onChange(boolean)` — and Mantine sits
// behind them. Swapping the implementation touched one file instead of twenty.
//
// What Mantine brings that the hand-rolled version did not: focus trapping and
// restoration in the modal, keyboard semantics on every control, portal and
// collision handling for overlays, and ARIA wiring. Those were the parts most
// likely to be subtly wrong and least likely to be noticed.
//
// What it does NOT bring is a new look. mantineTheme.js maps the existing token
// palette, type scale, radii and shadows onto Mantine, so this is a change of
// machinery rather than of design language.
//
// `Popover` is deliberately absent. Mantine's is composition-based
// (`Popover.Target` / `Popover.Dropdown`) rather than `anchorRef`-driven, and
// wrapping that back into an imperative shape would reintroduce the manual
// positioning this removes. The three pickers use Mantine's directly.

// Mantine variants carry the behaviour; these names carry the intent the call
// sites already express.
const BUTTON_VARIANTS = {
  default: { variant: 'default' },
  primary: { variant: 'filled', color: 'brand' },
  ghost: { variant: 'subtle', color: 'gray' },
  danger: { variant: 'default', color: 'crit' },
};

// forwardRef is load-bearing, not hygiene: Mantine's Popover.Target clones its
// child and hands it a ref to position against. A plain function component
// swallows that ref and the dropdown anchors to the wrong place — or to the
// document — with only a console warning to say so.
export const Button = forwardRef(({
  variant = 'default', size = 'md', active, disabled, style, children, ...props
}, ref) => {
  const mapped = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.default;
  return (
    <MButton
      ref={ref}
      {...mapped}
      size={size === 'sm' ? 'xs' : 'sm'}
      disabled={disabled}
      // `active` is a selected state, not a pressed one — the toolbar and the
      // picker mode switches stay lit while their surface is open.
      data-active={active || undefined}
      aria-pressed={active === undefined ? undefined : Boolean(active)}
      style={{
        height: size === 'sm' ? layout.controlHeightSm : layout.controlHeight,
        ...(active ? { background: C.selBg, borderColor: C.sel, color: C.sel } : null),
        ...(variant === 'danger' ? { color: C.crit } : null),
        ...style,
      }}
      {...props}
    >
      {/* Mantine centres a single label; these buttons often carry a label plus
          a value plus a caret, which need to sit as a row. */}
      <Group gap={6} wrap="nowrap">{children}</Group>
    </MButton>
  );
});
Button.displayName = 'Button';

export function IconButton({ label, active, style, ...props }) {
  return (
    <ActionIcon
      variant={active ? 'light' : 'default'}
      color={active ? 'brand' : 'gray'}
      aria-label={label}
      title={label}
      size={layout.controlHeight}
      style={style}
      {...props}
    />
  );
}

export function Label({ children, style }) {
  return <div style={{ ...text.label, color: C.g5, ...style }}>{children}</div>;
}

export function Field({ label, children, style }) {
  return (
    <MInput.Wrapper
      label={label}
      styles={{ label: { ...text.label, color: C.g5, marginBottom: 4 } }}
      style={style}
    >
      {children}
    </MInput.Wrapper>
  );
}

export const Input = forwardRef(({ style, ...props }, ref) => (
  <TextInput
    ref={ref}
    styles={{ input: { height: layout.controlHeight, minHeight: layout.controlHeight, ...style } }}
    {...props}
  />
));
Input.displayName = 'Input';

// NativeSelect, not Mantine's Select: every call site passes <option> children
// rather than a `data` array, and a native select is also the right control for
// a short, fixed list — it uses the platform's own picker on touch devices.
export const Select = forwardRef(({ style, children, ...props }, ref) => (
  <NativeSelect
    ref={ref}
    styles={{ input: { height: layout.controlHeight, minHeight: layout.controlHeight, ...style } }}
    {...props}
  >
    {children}
  </NativeSelect>
));
Select.displayName = 'Select';

/** onChange receives a boolean, as the call sites expect — not the event. */
export function Checkbox({ checked, onChange, label, style }) {
  return (
    <MCheckbox
      checked={Boolean(checked)}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      label={label}
      size="xs"
      style={style}
      styles={{
        label: {
          ...text.base, color: C.ink, paddingLeft: 8,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        },
      }}
    />
  );
}

const CHIP_TONES = {
  default: 'gray',
  sel: 'brand',
  ok: 'ok',
  warn: 'warn',
  crit: 'crit',
};

export function Chip({ children, tone = 'default', style, title }) {
  return (
    <Badge color={CHIP_TONES[tone] || 'gray'} title={title} style={style}>
      {children}
    </Badge>
  );
}

export function Panel({ title, actions, children, style, bodyStyle }) {
  return (
    <Paper
      component="section"
      shadow="xs"
      style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
        overflow: 'hidden', ...style,
      }}
    >
      {title ? (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: space[2], height: layout.panelHeaderHeight, padding: `0 ${space[4]}px`,
          borderBottom: `1px solid ${C.line}`, background: C.white, flexShrink: 0,
        }}>
          <span style={{ ...text.md, fontWeight: 600, color: C.ink, letterSpacing: '-0.01em' }}>{title}</span>
          {actions}
        </header>
      ) : null}
      <div style={{ minHeight: 0, overflow: 'auto', flex: 1, ...bodyStyle }}>{children}</div>
    </Paper>
  );
}

export function Modal({ open, onClose, title, description, footer, children, width = 620 }) {
  return (
    <MModal
      opened={Boolean(open)}
      onClose={onClose}
      title={title}
      size={width}
      styles={{ title: { ...text.md, fontWeight: 600, color: C.ink } }}
    >
      <Stack gap={space[3]}>
        {description ? <Text style={{ ...text.sm, color: C.g5 }}>{description}</Text> : null}
        {children}
        {footer ? (
          <Group justify="flex-end" gap={space[2]} mt={space[2]}>
            {footer}
          </Group>
        ) : null}
      </Stack>
    </MModal>
  );
}

export function Divider({ vertical, style }) {
  return <MDivider orientation={vertical ? 'vertical' : 'horizontal'} color={C.line} style={style} />;
}

export function Empty({ title, hint, icon }) {
  return (
    <Stack align="center" justify="center" gap={6} p={space[6]} style={{ textAlign: 'center', height: '100%' }}>
      {icon ? <div style={{ fontSize: 22, opacity: 0.7 }}>{icon}</div> : null}
      <div style={{ ...text.base, fontWeight: 600, color: C.g6 }}>{title}</div>
      {hint ? <div style={{ ...text.sm, color: C.g5, maxWidth: 260 }}>{hint}</div> : null}
    </Stack>
  );
}

/** Definition row for inspectors: label left, value right. */
export function Row({ label, value, mono = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: space[3], padding: `5px ${space[4]}px`,
    }}>
      <span style={{ ...text.sm, color: C.g5, flexShrink: 0 }}>{label}</span>
      <span
        className="tnum"
        style={{
          ...text.sm, color: C.ink, fontWeight: 500, textAlign: 'right',
          fontFamily: mono ? font.mono : undefined,
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function Skeleton({ lines = 1, width = '100%', height = 12, gap = 8, style }) {
  if (lines <= 1) return <MSkeleton width={width} height={height} radius="sm" style={style} />;
  return (
    <Stack gap={gap} style={style}>
      {Array.from({ length: lines }, (_, i) => (
        <MSkeleton
          key={i}
          height={height}
          radius="sm"
          // A ragged last line reads as text; equal bars read as a table. The
          // shape of the skeleton should match the shape of what replaces it.
          width={i === lines - 1 ? '68%' : width}
        />
      ))}
    </Stack>
  );
}

export function ProgressBar({ value = null, label, hint, compact = false, style }) {
  const determinate = typeof value === 'number' && Number.isFinite(value);
  const pct = determinate ? Math.min(100, Math.max(0, value)) : 100;

  return (
    <Stack gap={6} style={style}>
      {/* `compact` is the bar alone, for chrome that carries its own label —
          the context bar puts the wording beside the track, not above it. */}
      {(!compact && (label || determinate)) ? (
        <Group justify="space-between" align="baseline" gap={space[3]} wrap="nowrap">
          {label ? <Text style={{ ...text.sm, color: C.g6 }}>{label}</Text> : <span />}
          {determinate ? (
            <Text className="tnum" style={{ ...text.sm, color: C.g5 }}>{Math.round(pct)}%</Text>
          ) : null}
        </Group>
      ) : null}

      <Progress
        value={pct}
        // Indeterminate work animates rather than sitting at a number it cannot
        // justify: a bar parked at 0% reads as stalled, one parked at 100% reads
        // as finished-but-broken.
        animated={!determinate}
        color="brand"
        size={compact ? 4 : 6}
        radius="xl"
      />

      {hint ? <Text style={{ ...text.xs, color: C.g5 }}>{hint}</Text> : null}
    </Stack>
  );
}

/**
 * Refresh in place. The map keeps whatever it already had; only the panel dims.
 * Blanking a loaded surface to load more of it is the pattern this exists to
 * avoid.
 */
export function BusyOverlay({ show, label = 'Memuat…', progress = null, onCancel }) {
  return (
    <LoadingOverlay
      visible={Boolean(show)}
      zIndex={20}
      overlayProps={{ blur: 0, backgroundOpacity: 0.6, color: C.white }}
      loaderProps={{
        children: (
          <Paper p={space[4]} shadow="md" style={{ minWidth: 220 }}>
            <ProgressBar value={progress} label={label} />
            {onCancel ? (
              <Group justify="flex-end" mt={space[3]}>
                <Button size="sm" onClick={onCancel}>Batalkan</Button>
              </Group>
            ) : null}
          </Paper>
        ),
      }}
    />
  );
}

const NOTE_TONES = {
  empty: { color: C.g5 },
  none: { color: C.g5 },
  error: { color: C.crit },
};

export function StatusNote({ tone = 'empty', title, hint, action, onAction, style }) {
  const t = NOTE_TONES[tone] || NOTE_TONES.empty;
  return (
    <Stack align="center" justify="center" gap={space[2]} p={space[6]} style={{ textAlign: 'center', height: '100%', ...style }}>
      <div style={{ ...text.base, fontWeight: 600, color: t.color }}>{title}</div>
      {hint ? <div style={{ ...text.sm, color: C.g5, maxWidth: 320 }}>{hint}</div> : null}
      {action && onAction ? <Button size="sm" onClick={onAction}>{action}</Button> : null}
    </Stack>
  );
}

export function Slider({ value, onChange, min = 0, max = 1, step = 0.05, style }) {
  return (
    <MSlider
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      color="brand"
      size="sm"
      label={null}
      style={style}
      styles={{ track: { height: 4 }, thumb: { borderWidth: 2, width: 14, height: 14 } }}
    />
  );
}

