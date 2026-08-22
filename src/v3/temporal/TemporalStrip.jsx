import { useCallback, useMemo, useRef, useState } from 'react';
import useHistoryStore, { BIN_COUNT } from '../state/historyStore';
import { color as C, text, space, font, radius } from '../foundation/tokens';

// Temporal density + brush. This replaces V2's video seek bar.
//
// V2's control mapped 0-100 onto row count, which says nothing about when
// anything happened: two devices with different sample counts sat at different
// wall-clock times at the same "progress". Here the axis is absolute WITA time
// and the bars are GPS sample counts per bin, so the question the strip answers
// is "when was movement dense?" — which is the question that decides what to
// inspect.
//
// Brushing sets the analysis window. That window becomes DataFilterExtension's
// filterRange, so filtering millions of samples costs one uniform update and no
// JavaScript. See map/layers/useTraceLayers.js.

const WITA_OFFSET_MS = 8 * 3600 * 1000;

// The whole system is WITA (UTC+8). Formatting through the browser's local zone
// would silently mislabel every bar for anyone not in UTC+8, which is the
// highest-consequence correctness risk in the temporal work.
function witaLabel(ms, withDate = false) {
  const d = new Date(ms + WITA_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  if (!withDate) return `${hh}:${mm}`;
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${hh}:${mm}`;
}

const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');

export default function TemporalStrip() {
  const bins = useHistoryStore((s) => s.bins);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);
  const window = useHistoryStore((s) => s.window);
  const setWindow = useHistoryStore((s) => s.setWindow);
  const clearWindow = useHistoryStore((s) => s.clearWindow);
  const status = useHistoryStore((s) => s.status);

  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [hoverBin, setHoverBin] = useState(null);

  const span = Number.isFinite(rangeStartMs) && Number.isFinite(rangeEndMs) && rangeEndMs > rangeStartMs
    ? rangeEndMs - rangeStartMs
    : 0;
  const binSpan = span / BIN_COUNT;

  const maxCount = useMemo(() => {
    if (!bins) return 0;
    let max = 0;
    for (let i = 0; i < bins.length; i++) if (bins[i] > max) max = bins[i];
    return max;
  }, [bins]);

  const ratioToMs = useCallback((r) => rangeStartMs + r * span, [rangeStartMs, span]);

  const localRatio = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback((event) => {
    if (!span || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const r = localRatio(event.clientX);
    dragRef.current = { from: r, to: r };
    setDrag({ from: r, to: r });
  }, [span, localRatio]);

  const onPointerMove = useCallback((event) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect && span) {
      const r = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      setHoverBin(Math.min(BIN_COUNT - 1, Math.floor(r * BIN_COUNT)));
    }
    if (!dragRef.current) return;
    const r = localRatio(event.clientX);
    dragRef.current = { ...dragRef.current, to: r };
    setDrag({ ...dragRef.current });
  }, [span, localRatio]);

  const onPointerUp = useCallback((event) => {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const { from, to } = dragRef.current;
    dragRef.current = null;
    setDrag(null);

    // A drag shorter than one bin is a click: snap the window to that single
    // bin rather than producing a zero-width selection.
    if (Math.abs(to - from) < 1 / BIN_COUNT) {
      const bin = Math.min(BIN_COUNT - 1, Math.floor(from * BIN_COUNT));
      setWindow({ startMs: rangeStartMs + bin * binSpan, endMs: rangeStartMs + (bin + 1) * binSpan });
      return;
    }
    const a = Math.min(from, to);
    const b = Math.max(from, to);
    setWindow({ startMs: ratioToMs(a), endMs: ratioToMs(b) });
  }, [setWindow, ratioToMs, rangeStartMs, binSpan]);

  const brush = drag
    ? { left: Math.min(drag.from, drag.to), right: Math.max(drag.from, drag.to) }
    : window && span
      ? {
        left: Math.max(0, (window.startMs - rangeStartMs) / span),
        right: Math.min(1, (window.endMs - rangeStartMs) / span),
      }
      : null;

  const windowCount = useMemo(() => {
    if (!bins || !brush) return null;
    const a = Math.floor(brush.left * BIN_COUNT);
    const b = Math.ceil(brush.right * BIN_COUNT);
    let total = 0;
    for (let i = Math.max(0, a); i < Math.min(BIN_COUNT, b); i++) total += bins[i];
    return total;
  }, [bins, brush]);

  const hasData = Boolean(bins) && maxCount > 0;

  return (
    <div style={{
      flexShrink: 0, background: C.white, borderTop: `1px solid ${C.line}`,
      padding: `6px ${space[3]}px 8px`, display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], height: 18 }}>
        <span style={{ ...text.label, color: C.g5 }}>Kepadatan sampel</span>

        {hoverBin != null && hasData ? (
          <span style={{ ...text.sm, color: C.g6, fontFamily: font.mono }}>
            {witaLabel(rangeStartMs + hoverBin * binSpan)} · {fmtInt(bins[hoverBin])} titik
          </span>
        ) : null}

        <div style={{ flex: 1 }} />

        {window ? (
          <>
            <span style={{ ...text.sm, color: C.sel, fontFamily: font.mono, fontWeight: 600 }}>
              {witaLabel(window.startMs, true)} – {witaLabel(window.endMs, true)}
              {windowCount != null ? ` · ${fmtInt(windowCount)} titik` : ''}
            </span>
            <button
              type="button"
              onClick={clearWindow}
              style={{
                border: `1px solid ${C.line}`, background: C.white, cursor: 'pointer',
                borderRadius: radius.sm, height: 18, padding: '0 6px',
                ...text.sm, color: C.g6, fontFamily: font.sans,
              }}
            >
              seluruh rentang
            </button>
          </>
        ) : (
          <span style={{ ...text.sm, color: C.g4 }}>
            {hasData ? 'Seret untuk memilih periode' : ''}
          </span>
        )}
      </div>

      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoverBin(null)}
        style={{
          position: 'relative', height: 44, display: 'flex', alignItems: 'flex-end', gap: 1,
          background: C.g0, border: `1px solid ${C.line}`, borderRadius: radius.sm,
          padding: '3px 2px', boxSizing: 'border-box',
          cursor: span ? 'ew-resize' : 'default', touchAction: 'none', userSelect: 'none',
        }}
      >
        {hasData ? Array.from({ length: BIN_COUNT }, (_, i) => {
          const ratio = (i + 0.5) / BIN_COUNT;
          const inBrush = !brush || (ratio >= brush.left && ratio <= brush.right);
          // sqrt scale: sample counts are heavily skewed (a queue produces an
          // order of magnitude more samples than transit), and a linear scale
          // flattens every quiet-but-non-zero bin to invisible.
          const h = Math.max(2, Math.round(Math.sqrt(bins[i] / maxCount) * 36));
          return (
            <div
              key={i}
              style={{
                flex: 1, height: h, minWidth: 1,
                background: inBrush ? C.sel : C.g3,
                opacity: inBrush ? 1 : 0.55,
                borderRadius: '1px 1px 0 0',
              }}
            />
          );
        }) : (
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            ...text.sm, color: C.g4,
          }}>
            {status.state === 'loading' ? 'Memuat...' : 'Belum ada data'}
          </div>
        )}

        {brush && span ? (
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${brush.left * 100}%`, width: `${(brush.right - brush.left) * 100}%`,
            border: `1px solid ${C.sel}`, background: 'rgba(31,122,150,0.08)',
            pointerEvents: 'none', borderRadius: 2,
          }} />
        ) : null}
      </div>

      {span ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', ...text.xs, color: C.g4, fontFamily: font.mono }}>
          <span>{witaLabel(rangeStartMs, true)}</span>
          <span>{witaLabel(rangeStartMs + span / 2)}</span>
          <span>{witaLabel(rangeEndMs, true)} WITA</span>
        </div>
      ) : null}
    </div>
  );
}
