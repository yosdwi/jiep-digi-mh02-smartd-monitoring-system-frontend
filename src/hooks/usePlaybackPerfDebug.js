import { useEffect, useRef } from 'react';

// Dev-only, opt-in via window.__playbackPerfDebug = true (console). No effect
// in production builds and no console noise unless explicitly turned on.
// Summarizes render counts per named component every 2s instead of logging
// every render — answers "how many renders/sec during playback" without
// spamming the console at 60fps.

const counts = new Map();
let summaryTimer = null;

function ensureSummaryLoop() {
  if (summaryTimer || !import.meta.env.DEV) return;
  summaryTimer = setInterval(() => {
    if (!window.__playbackPerfDebug || counts.size === 0) return;
    const rows = [...counts.entries()].map(([name, n]) => `${name}: ${(n / 2).toFixed(1)}/s`);
    counts.clear();
    // eslint-disable-next-line no-console
    console.log('[playback-perf] renders/sec —', rows.join('  |  '));
  }, 2000);
}

export function useRenderCounter(name) {
  if (import.meta.env.DEV) {
    ensureSummaryLoop();
    counts.set(name, (counts.get(name) || 0) + 1);
  }
}

// Logs Long Task entries (>50ms main-thread blocks) and, separately, frames
// exceeding 16.67ms measured via requestAnimationFrame deltas. Mount once
// (e.g. in MapContainerLite) while `window.__playbackPerfDebug = true`.
export function usePlaybackFrameTiming() {
  const lastFrameRef = useRef(0);
  const frameStatsRef = useRef({ count: 0, over16: 0, totalMs: 0, maxMs: 0 });

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    let longTaskObserver;
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        if (!window.__playbackPerfDebug) return;
        for (const entry of list.getEntries()) {
          // eslint-disable-next-line no-console
          console.log(`[playback-perf] long task: ${entry.duration.toFixed(1)}ms`);
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch {
      // longtask not supported in this browser — skip silently
    }

    let rafId;
    const tick = (now) => {
      if (window.__playbackPerfDebug) {
        if (lastFrameRef.current) {
          const delta = now - lastFrameRef.current;
          const stats = frameStatsRef.current;
          stats.count += 1;
          stats.totalMs += delta;
          stats.maxMs = Math.max(stats.maxMs, delta);
          if (delta > 16.67) stats.over16 += 1;
        }
        lastFrameRef.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const summaryInterval = setInterval(() => {
      const stats = frameStatsRef.current;
      if (!window.__playbackPerfDebug || stats.count === 0) return;
      // eslint-disable-next-line no-console
      console.log(
        `[playback-perf] frames: ${stats.count}, avg ${(stats.totalMs / stats.count).toFixed(2)}ms, ` +
        `max ${stats.maxMs.toFixed(2)}ms, over-16.67ms: ${stats.over16} (${((stats.over16 / stats.count) * 100).toFixed(1)}%)`
      );
      frameStatsRef.current = { count: 0, over16: 0, totalMs: 0, maxMs: 0 };
    }, 2000);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(summaryInterval);
      longTaskObserver?.disconnect();
    };
  }, []);
}
