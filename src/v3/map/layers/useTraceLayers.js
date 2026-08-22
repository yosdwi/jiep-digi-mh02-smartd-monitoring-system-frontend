import { useEffect, useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { ScreenGridLayer } from '@deck.gl/aggregation-layers';
import { DataFilterExtension } from '@deck.gl/extensions';
import * as registry from '../../state/traceRegistry';
import useHistoryStore from '../../state/historyStore';

// The historical dot trace.
//
// Every sample is one ScatterplotLayer instance fed from typed arrays via
// `data.attributes`, so deck.gl's AttributeManager is bypassed entirely: no
// per-row accessor call, no JS objects, no repacking. The buffers come straight
// out of the decode worker.
//
// Time and speed filtering run on the GPU through DataFilterExtension, which is
// why brushing the temporal strip costs zero JavaScript: `filterRange` is a
// uniform. This is the mechanism that makes "explore first, animate second"
// affordable.
//
// One sublayer per HOUR, not per (device, hour). The decoder already writes an
// hour as a single buffer set covering the whole fleet, and the registry hands
// out per-device subarray views of it, so drawing per hour costs no copying.
//
// This is not a micro-optimisation. A layer per device-hour meant 274 layers for
// a 2-hour, 137-unit range — enough to lose the WebGL context outright, which
// shows up as a blank white map — and 1644 for a 12-hour shift. Per hour it is
// 2 and 12. It also keeps the fleet under deck.gl's 255-layer picking ceiling.
//
// The cost is that per-device visual state can no longer be a layer prop:
// dimming is written into the alpha channel of the shared colour buffer
// (registry.setDimmed) and picking resolves a sample index back to its device
// through the range table (registry.deviceAtSample).

const FILTER_SIZE = 2;   // [timestampMs, speed]

// Radius shrinks as more is on screen so dense corridors read as density rather
// than as a solid blob. Values are in pixels, not metres: at mine scale a
// metre-accurate dot would be invisible when zoomed out.
function radiusForCount(n) {
  if (n > 1_500_000) return { min: 0.7, max: 2 };
  if (n > 400_000) return { min: 1, max: 3 };
  if (n > 80_000) return { min: 1.4, max: 4 };
  return { min: 2, max: 6 };
}

export function useTraceLayers({ selectedIds, onSampleClick }) {
  const traceVersion = useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);
  const hourCount = useSyncExternalStore(registry.subscribe, registry.getHourCount, registry.getHourCount);

  const visible = useHistoryStore((s) => s.layers.trace);
  const opacity = useHistoryStore((s) => s.layerOpacity.trace);
  const traceMode = useHistoryStore((s) => s.traceMode);
  const window = useHistoryStore((s) => s.window);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);
  const playbackActive = useHistoryStore((s) => s.playback.active);

  const startMs = window?.startMs ?? rangeStartMs;
  const endMs = window?.endMs ?? rangeEndMs;

  // Unselected devices fade instead of disappearing: the point of the trace is
  // spatial context, and removing the rest of the fleet while inspecting one
  // truck destroys exactly that. With one layer per hour the fade has to be
  // written into the colour buffer, so it is an effect rather than a layer prop.
  // Keyed on the id list and on the hour count — never on the version counter,
  // which setDimmed itself bumps and would spin forever. The hour count changes
  // only when new data lands, which is exactly when a fresh buffer needs the
  // current selection applied to it.
  const selectionKey = selectedIds.join(',');
  useEffect(() => {
    registry.setDimmed(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, hourCount]);

  return useMemo(() => {
    if (!visible) return [];

    const total = registry.totalSamples();
    if (total === 0) return [];
    const { min: radiusMinPixels, max: radiusMaxPixels } = radiusForCount(total);

    // Absolute epoch ms. Float32 in the filter attribute gives ~131 ms
    // granularity at current epoch values — two orders of magnitude finer than
    // the 1 s sample cadence, so brushing is exact in practice.
    const timeRange = Number.isFinite(startMs) && Number.isFinite(endMs)
      ? [startMs, endMs]
      : [-Infinity, Infinity];

    const filterRange = [timeRange, [-Infinity, Infinity]];

    // While playback runs the static trace stays on screen as spatial context,
    // dimmed so the animated subset reads on top of it. It is not unloaded and
    // not refetched on either transition.
    const baseOpacity = playbackActive ? opacity * 0.35 : opacity;

    const hours = registry.listHours();
    if (hours.length === 0) return [];

    if (traceMode === 'density') {
      // Zoomed-out / multi-day fallback. GPU-aggregated and COUNTED, so the
      // legend can state samples per cell. HeatmapLayer was rejected for this
      // role: unquantified glow is not an operational readout.
      return hours.map((hour) => new ScreenGridLayer({
        id: `v3-density-${hour.key}`,
        data: { length: hour.n, attributes: { getPosition: { value: hour.position, size: 2 } } },
        cellSizePixels: 12,
        opacity: baseOpacity,
        colorRange: [
          [237, 248, 233], [199, 233, 192], [161, 217, 155],
          [116, 196, 118], [49, 163, 84], [0, 109, 44],
        ],
        aggregation: 'SUM',
        getWeight: 1,
      }));
    }

    return hours.map((hour) => new ScatterplotLayer({
      id: `v3-trace-${hour.key}`,
      data: {
        length: hour.n,
        attributes: {
          getPosition: { value: hour.position, size: 2 },
          getFillColor: { value: hour.color, size: 4, normalized: true },
          getFilterValue: { value: hour.filter, size: FILTER_SIZE },
        },
      },
      opacity: baseOpacity,
      radiusUnits: 'pixels',
      getRadius: 1,
      radiusMinPixels,
      radiusMaxPixels,
      stroked: false,
      filled: true,
      pickable: Boolean(onSampleClick),
      onClick: onSampleClick
        ? (info) => {
          const device = registry.deviceAtSample(hour.key, info.index);
          if (device) onSampleClick(device, info);
        }
        : undefined,
      extensions: [new DataFilterExtension({ filterSize: FILTER_SIZE })],
      filterRange,
      updateTriggers: {
        // Colour buffers are mutated in place by recolorDevice /
        // recolorDeviceByBand / setDimmed, which keeps the buffer identity
        // stable so deck.gl updates one attribute instead of rebuilding.
        getFillColor: traceVersion,
      },
    }));
  }, [
    traceVersion, visible, opacity, traceMode, startMs, endMs,
    playbackActive, onSampleClick,
  ]);
}

export default useTraceLayers;
