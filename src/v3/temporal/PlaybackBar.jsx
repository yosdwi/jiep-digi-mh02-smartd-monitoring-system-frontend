import { useCallback, useEffect, useRef, useState } from 'react';
import useHistoryStore from '../state/historyStore';
import { getPlayhead, setPlayhead, subscribePlayhead } from '../state/playheadRuntime';
import { Button, Chip, Divider } from '../foundation/ui';
import { color as C, text, space, font, radius } from '../foundation/tokens';

// Transport controls for focused playback.
//
// Two write rates, deliberately:
//  - playheadRuntime.setPlayhead  — every RAF frame. Plain module, no store, so
//    only the map subtree re-renders at frame rate.
//  - playback.displayMs (Zustand) — throttled to ~4/s, for the clock readout
//    here. Everything else reads that instead.
//
// Speed is a real-time multiplier against wall-clock, so "10×" means ten seconds
// of recorded time per second of watching. V2 derived duration from row count,
// which made playback speed depend on how much data a truck happened to produce.

const WITA_OFFSET_MS = 8 * 3600 * 1000;
const SPEEDS = [1, 5, 10, 30, 60, 120];

function witaClock(ms) {
  if (!Number.isFinite(ms)) return '--:--:--';
  const d = new Date(ms + WITA_OFFSET_MS);
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    .map((n) => String(n).padStart(2, '0')).join(':');
}

export default function PlaybackBar() {
  const playback = useHistoryStore((s) => s.playback);
  const setPlayback = useHistoryStore((s) => s.setPlayback);
  const window = useHistoryStore((s) => s.window);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);

  const startMs = window?.startMs ?? rangeStartMs;
  const endMs = window?.endMs ?? rangeEndMs;
  const span = Number.isFinite(startMs) && Number.isFinite(endMs) ? endMs - startMs : 0;

  const rafRef = useRef(null);
  const lastUiRef = useRef(0);
  const trackRef = useRef(null);
  const [scrubRatio, setScrubRatio] = useState(null);

  // Reset the playhead whenever the animated window changes.
  useEffect(() => {
    if (playback.active && Number.isFinite(startMs)) {
      setPlayhead(startMs);
      setPlayback({ displayMs: startMs });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.active, startMs, endMs]);

  useEffect(() => {
    if (!playback.playing || !playback.active || span <= 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return undefined;
    }

    let previous = performance.now();

    const tick = (now) => {
      const deltaMs = (now - previous) * playback.speed;
      previous = now;

      const next = getPlayhead() + deltaMs;
      if (next >= endMs) {
        setPlayhead(endMs);
        useHistoryStore.getState().setPlayback({ playing: false, displayMs: endMs });
        return;
      }

      setPlayhead(next);

      if (now - lastUiRef.current >= 250) {
        lastUiRef.current = now;
        useHistoryStore.getState().setPlayback({ displayMs: next });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playback.playing, playback.active, playback.speed, span, endMs]);

  const seekTo = useCallback((ratio) => {
    const ms = startMs + Math.min(1, Math.max(0, ratio)) * span;
    setPlayhead(ms);
    setPlayback({ displayMs: ms });
  }, [startMs, span, setPlayback]);

  const onTrackPointer = useCallback((event) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setScrubRatio(ratio);
    seekTo(ratio);
  }, [seekTo]);

  const ratio = span > 0 && Number.isFinite(playback.displayMs)
    ? Math.min(1, Math.max(0, (playback.displayMs - startMs) / span))
    : 0;
  const shown = scrubRatio != null ? scrubRatio : ratio;

  if (!playback.active) return null;

  return (
    <div style={{
      flexShrink: 0, background: C.g0, borderTop: `1px solid ${C.line}`,
      padding: `6px ${space[3]}px`, display: 'flex', alignItems: 'center', gap: space[2],
    }}>
      <Button
        variant="primary"
        onClick={() => setPlayback({ playing: !playback.playing })}
        style={{ width: 34, padding: 0 }}
        aria-label={playback.playing ? 'Jeda' : 'Putar'}
      >
        {playback.playing ? '❚❚' : '▶'}
      </Button>

      <Button size="sm" onClick={() => seekTo(0)} aria-label="Ke awal">⏮</Button>

      <span style={{ ...text.base, fontFamily: font.mono, fontWeight: 700, color: C.ink, minWidth: 68 }}>
        {witaClock(playback.displayMs)}
      </span>

      <div
        ref={trackRef}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onTrackPointer(e); }}
        onPointerMove={(e) => { if (scrubRatio != null) onTrackPointer(e); }}
        onPointerUp={(e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setScrubRatio(null); }}
        style={{
          flex: 1, height: 20, display: 'flex', alignItems: 'center',
          cursor: 'pointer', touchAction: 'none',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: 4, background: C.g2, borderRadius: 2 }}>
          <div style={{ width: `${shown * 100}%`, height: '100%', background: C.sel, borderRadius: 2 }} />
          <div style={{
            position: 'absolute', top: -4, left: `${shown * 100}%`, marginLeft: -6,
            width: 12, height: 12, borderRadius: '50%',
            background: C.white, border: `2px solid ${C.sel}`,
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2 }}>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPlayback({ speed: s })}
            style={{
              border: `1px solid ${playback.speed === s ? C.sel : C.line}`,
              background: playback.speed === s ? C.selBg : C.white,
              color: playback.speed === s ? C.sel : C.g6,
              borderRadius: radius.sm, height: 22, padding: '0 6px', cursor: 'pointer',
              ...text.sm, fontWeight: 600, fontFamily: font.mono,
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      <Divider vertical style={{ height: 20 }} />

      <Chip tone="sel">{selectedIds.length} unit</Chip>

      <Button
        size="sm"
        onClick={() => {
          setPlayback({ active: false, playing: false });
        }}
      >
        Tutup playback
      </Button>
    </div>
  );
}
