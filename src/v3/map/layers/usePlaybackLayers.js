import { useMemo, useRef, useSyncExternalStore } from 'react';
import { TripsLayer } from '@deck.gl/geo-layers';
import { IconLayer, TextLayer } from '@deck.gl/layers';
import * as registry from '../../state/traceRegistry';
import { getPlayhead, subscribePlayhead } from '../../state/playheadRuntime';
import useHistoryStore from '../../state/historyStore';
import { UNIT_RAMP, rgb, color as C } from '../../foundation/tokens';

// Focused playback.
//
// Complexity scales with SELECTED units and the brushed window, never with total
// historical row count. The static trace stays loaded and dimmed underneath; this
// layer set only ever sees the subset the user asked to animate.
//
// Per frame the only work is:
//   - TripsLayer.currentTime  -> one GPU uniform
//   - marker slot mutation    -> one small position attribute
// Trail geometry is built once when the subset changes and never per frame.

const ICON_ATLAS = '/Monitoring/icons/mining-atlas.png';
const ICON_MAPPING = {
  truck: { x: 0, y: 0, width: 128, height: 128, mask: false },
  excavator: { x: 128, y: 0, width: 128, height: 128, mask: false },
  dot: { x: 256, y: 0, width: 128, height: 128, mask: true },
};

// A gap larger than this starts a new trip entry instead of drawing a straight
// line across it. 2 minutes at a 1 s cadence means ~120 missing samples: that is
// a real signal loss, not jitter, and joining across it invents a path the truck
// never took.
const MAX_GAP_MS = 120_000;

function buildTrips(deviceIds, startMs, endMs) {
  const trips = [];

  deviceIds.forEach((deviceId) => {
    const device = registry.getDevice(deviceId);
    if (!device) return;

    const color = rgb(UNIT_RAMP[device.colorIndex % UNIT_RAMP.length]);
    let path = [];
    let timestamps = [];

    const flush = () => {
      if (path.length > 1) {
        trips.push({ deviceId, unitNo: device.unitNo, color, path, timestamps });
      }
      path = [];
      timestamps = [];
    };

    // Chunks are keyed by WITA hour, so lexical order is chronological order.
    const keys = [...device.chunks.keys()].sort();
    let previousMs = null;

    keys.forEach((key) => {
      const chunk = device.chunks.get(key);
      for (let i = 0; i < chunk.n; i++) {
        const t = chunk.epochMs[i];
        if (t < startMs || t > endMs) continue;
        if (previousMs != null && t - previousMs > MAX_GAP_MS) flush();
        path.push([chunk.position[i * 2], chunk.position[i * 2 + 1]]);
        timestamps.push(t);
        previousMs = t;
      }
    });

    flush();
  });

  return trips;
}

export function usePlaybackLayers() {
  const active = useHistoryStore((s) => s.playback.active);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);
  const window = useHistoryStore((s) => s.window);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);
  const traceVersion = useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);

  // The one subscription in the app that runs at frame rate. It is scoped to
  // this hook, which is called only from MapWorkspace — the component that has
  // to re-render every frame anyway to hand deck.gl new props.
  const playheadMs = useSyncExternalStore(subscribePlayhead, getPlayhead, getPlayhead);

  const startMs = window?.startMs ?? rangeStartMs;
  const endMs = window?.endMs ?? rangeEndMs;

  // Built once per (subset, window). Does NOT depend on playheadMs, so it never
  // recomputes during playback.
  const trips = useMemo(() => {
    if (!active || selectedIds.length === 0) return [];
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];
    return buildTrips(selectedIds, startMs, endMs);
  }, [active, selectedIds, startMs, endMs, traceVersion]);

  // Stable marker array, mutated in place each frame. A fresh array per frame
  // would make deck.gl treat every attribute as invalid and re-run TextLayer's
  // glyph layout for every label, 60 times a second.
  const slots = useMemo(
    () => selectedIds.map((deviceId) => {
      const device = registry.getDevice(deviceId);
      return {
        deviceId,
        unitNo: device?.unitNo || deviceId,
        colorIndex: device?.colorIndex ?? 0,
        longitude: 0,
        latitude: 0,
        speed: 0,
        visible: false,
      };
    }),
    [selectedIds, traceVersion],
  );

  const versionRef = useRef(0);
  const visibleKeyRef = useRef(null);
  const slotsRef = useRef(null);
  const dataRef = useRef([]);

  // Mutation during render, on purpose: these objects are not React state,
  // nothing else reads them, and recomputing from playheadMs is idempotent so
  // StrictMode's double render is harmless.
  versionRef.current += 1;
  const positionVersion = versionRef.current;

  if (active) {
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sample = registry.sampleAt(slot.deviceId, playheadMs);
      if (sample) {
        slot.longitude = sample.longitude;
        slot.latitude = sample.latitude;
        slot.speed = sample.speed;
        slot.visible = true;
      } else {
        slot.visible = false;
      }
    }
  }

  // Filtering allocates, so only do it when the visibility pattern flips.
  const visibleKey = slots.reduce((acc, s) => acc + (s.visible ? '1' : '0'), '');
  if (slotsRef.current !== slots || visibleKey !== visibleKeyRef.current) {
    slotsRef.current = slots;
    visibleKeyRef.current = visibleKey;
    dataRef.current = slots.filter((s) => s.visible);
  }
  const markerData = dataRef.current;

  return useMemo(() => {
    if (!active) return [];
    const out = [];

    if (trips.length > 0) {
      out.push(new TripsLayer({
        id: 'v3-playback-trips',
        data: trips,
        getPath: (d) => d.path,
        getTimestamps: (d) => d.timestamps,
        getColor: (d) => d.color,
        // Absolute epoch ms on both axes — same clock as the data, the brush and
        // the temporal strip.
        currentTime: playheadMs,
        trailLength: 180_000,   // 3 minutes of visible tail
        fadeTrail: true,
        widthMinPixels: 3,
        widthMaxPixels: 8,
        capRounded: true,
        jointRounded: true,
        opacity: 0.95,
        pickable: false,
      }));
    }

    if (markerData.length > 0) {
      out.push(new IconLayer({
        id: 'v3-playback-markers',
        data: markerData,
        iconAtlas: ICON_ATLAS,
        iconMapping: ICON_MAPPING,
        getIcon: () => 'truck',
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: 34,
        getColor: (d) => rgb(UNIT_RAMP[d.colorIndex % UNIT_RAMP.length]),
        sizeUnits: 'pixels',
        pickable: true,
        updateTriggers: { getPosition: positionVersion },
      }));

      out.push(new TextLayer({
        id: 'v3-playback-labels',
        data: markerData,
        getPosition: (d) => [d.longitude, d.latitude],
        getText: (d) => String(d.unitNo).split('-')[1] || String(d.unitNo),
        getSize: 12,
        getColor: rgb(C.white),
        getPixelOffset: [0, 24],
        background: true,
        getBackgroundColor: [...rgb(C.ink), 225],
        backgroundPadding: [5, 2],
        getBorderRadius: 3,
        fontFamily: "ui-sans-serif,system-ui,sans-serif",
        fontWeight: 700,
        fontSettings: { sdf: false },
        pickable: false,
        // Deliberately NOT keyed on positionVersion: re-running getText makes
        // TextLayer re-tessellate every label's glyphs, and the text does not
        // change when a marker merely moves.
        updateTriggers: { getPosition: positionVersion },
      }));
    }

    return out;
  }, [active, trips, playheadMs, markerData, positionVersion]);
}

export default usePlaybackLayers;
