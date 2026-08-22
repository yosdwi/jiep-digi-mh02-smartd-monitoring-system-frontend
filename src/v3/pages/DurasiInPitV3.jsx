import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import HistoryWorkspace from './HistoryWorkspace';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import { analyseDwell, loadPitPolygons } from '../services/dwellClient';
import DwellTimeline, { formatDuration } from '../temporal/DwellTimeline';
import { DurasiInPitSummaryPanel, DurasiInPitMetricsTable } from '../panel/DurasiInPitPanels';
import { Button, Empty } from '../foundation/ui';
import { color as C, text, space, font, rgb, UNIT_RAMP } from '../foundation/tokens';

// Durasi In Pit V3.
//
// Three coordinated surfaces, not four KPI cards:
//   MAP        — WHERE. Polygons filled by total dwell; an entry dot per event,
//                radius scaled by duration.
//   TIMELINE   — WHEN and HOW LONG. Occupancy bars per unit (DwellTimeline).
//   PANEL      — PROVE IT. The event table; each row zooms the map.
//
// Same map, same loader, same playback runtime as Cycle Time. The only addition
// is the dwell scan, which runs in a worker over the typed arrays already in
// traceRegistry.

const WITA_OFFSET_MS = 8 * 3600 * 1000;

function witaClock(ms) {
  const d = new Date(ms + WITA_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const eventKey = (e) => `${e.deviceId}|${e.startMs}`;

export default function DurasiInPitV3() {
  const setColorMode = useHistoryStore((s) => s.setColorMode);
  const window = useHistoryStore((s) => s.window);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);
  const status = useHistoryStore((s) => s.status);
  const traceVersion = useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);

  const [polygons, setPolygons] = useState([]);
  const [events, setEvents] = useState([]);
  const [analysing, setAnalysing] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [cameraTarget, setCameraTarget] = useState(null);

  const startMs = window?.startMs ?? rangeStartMs;
  const endMs = window?.endMs ?? rangeEndMs;

  useEffect(() => { setColorMode('unit'); }, [setColorMode]);

  useEffect(() => {
    loadPitPolygons().then(setPolygons).catch(() => setPolygons([]));
  }, []);

  // Re-run whenever the loaded trace, the polygons or the brushed window change.
  // Debounced because brushing emits a window per pointer release and the scan,
  // while off-thread, still costs a structured clone of the position columns.
  useEffect(() => {
    if (polygons.length === 0 || status.state !== 'ready') { setEvents([]); return undefined; }
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;

    const devices = registry.listDevices();
    if (devices.length === 0) { setEvents([]); return undefined; }

    let cancelled = false;
    const timer = setTimeout(() => {
      setAnalysing(true);
      analyseDwell({ devices, polygons, startMs, endMs })
        .then((result) => { if (!cancelled) setEvents(result); })
        .catch(() => { if (!cancelled) setEvents([]); })
        .finally(() => { if (!cancelled) setAnalysing(false); });
    }, 150);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [polygons, startMs, endMs, traceVersion, status.state]);

  const totalsByPolygon = useMemo(() => {
    const totals = new Map();
    events.forEach((e) => totals.set(e.polygon, (totals.get(e.polygon) || 0) + e.durationMs));
    return totals;
  }, [events]);

  const maxTotal = useMemo(
    () => Math.max(1, ...[...totalsByPolygon.values()]),
    [totalsByPolygon],
  );

  const maxDuration = useMemo(
    () => Math.max(1, ...events.map((e) => e.durationMs)),
    [events],
  );

  const extraLayers = useMemo(() => {
    if (polygons.length === 0) return [];

    const out = [new PolygonLayer({
      id: 'v3-pit-polygons',
      data: polygons,
      getPolygon: (d) => d.polygon,
      filled: true,
      stroked: true,
      // Sequential fill by total dwell: darker area held units longer.
      getFillColor: (d) => {
        const total = totalsByPolygon.get(d.name) || 0;
        const t = total / maxTotal;
        return [31, 122, 150, Math.round(20 + t * 110)];
      },
      getLineColor: [...rgb(C.sel), 220],
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      pickable: true,
      updateTriggers: { getFillColor: [maxTotal, events.length] },
    }), new TextLayer({
      id: 'v3-pit-labels',
      data: polygons,
      getPosition: (d) => {
        let x = 0; let y = 0;
        d.polygon.forEach(([lon, lat]) => { x += lon; y += lat; });
        return [x / d.polygon.length, y / d.polygon.length];
      },
      getText: (d) => {
        const total = totalsByPolygon.get(d.name) || 0;
        return total > 0 ? `${d.name}\n${formatDuration(total)}` : d.name;
      },
      getSize: 12,
      getColor: rgb(C.ink),
      background: true,
      getBackgroundColor: [255, 255, 255, 210],
      backgroundPadding: [5, 3],
      getBorderRadius: 3,
      fontFamily: 'ui-sans-serif,system-ui,sans-serif',
      fontWeight: 700,
      fontSettings: { sdf: false },
      pickable: false,
      updateTriggers: { getText: [events.length, maxTotal] },
    })];

    if (events.length > 0) {
      out.push(new ScatterplotLayer({
        id: 'v3-dwell-events',
        data: events,
        getPosition: (d) => [d.lon, d.lat],
        // Radius encodes duration — a long stop is visibly a bigger dot, which
        // is the whole question this page answers.
        getRadius: (d) => 4 + Math.sqrt(d.durationMs / maxDuration) * 14,
        radiusUnits: 'pixels',
        getFillColor: (d) => [...rgb(UNIT_RAMP[d.colorIndex % UNIT_RAMP.length]), 220],
        getLineColor: (d) => (eventKey(d) === selectedKey ? rgb(C.ink) : [255, 255, 255, 230]),
        getLineWidth: (d) => (eventKey(d) === selectedKey ? 3 : 1.5),
        lineWidthUnits: 'pixels',
        stroked: true,
        filled: true,
        pickable: true,
        onClick: (info) => { if (info.object) focusEvent(info.object); },
        updateTriggers: {
          getLineColor: selectedKey,
          getLineWidth: selectedKey,
          getRadius: maxDuration,
        },
      }));
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygons, events, totalsByPolygon, maxTotal, maxDuration, selectedKey]);

  const focusEvent = useCallback((e) => {
    setSelectedKey(eventKey(e));
    setCameraTarget({ longitude: e.lon, latitude: e.lat, zoom: 17, transitionDuration: 800 });
  }, []);

  const sidePanels = useMemo(() => ([
    {
      key: 'summary',
      glyph: '▦',
      title: 'Ringkasan',
      render: () => (
        <DurasiInPitSummaryPanel events={events} analysing={analysing} polygonCount={polygons.length} />
      ),
    },
    {
      key: 'metrics',
      glyph: '▤',
      title: 'Metrik unit',
      render: () => (
        <DurasiInPitMetricsTable
          events={events}
          analysing={analysing}
          polygonCount={polygons.length}
          onSelectUnit={(unit) => unit.longestEvent && focusEvent(unit.longestEvent)}
        />
      ),
    },
    {
      key: 'events',
      title: `Event dwell${events.length ? ` (${events.length})` : ''}`,
      render: () => (
        <EventTable
          events={events}
          analysing={analysing}
          polygonCount={polygons.length}
          selectedKey={selectedKey}
          onSelect={focusEvent}
        />
      ),
    },
  ]), [events, analysing, polygons.length, selectedKey, focusEvent]);

  const temporal = (
    <DwellTimeline
      events={events}
      startMs={startMs}
      endMs={endMs}
      selectedEventId={selectedKey}
      onSelectEvent={(e) => focusEvent(e)}
    />
  );

  return (
    <HistoryWorkspace
      defaultPanel="events"
      sidePanels={sidePanels}
      extraLayers={extraLayers}
      temporal={temporal}
      cameraTarget={cameraTarget}
    />
  );
}

function EventTable({ events, analysing, polygonCount, selectedKey, onSelect }) {
  if (polygonCount === 0) {
    return <Empty title="Polygon area belum dimuat" hint="File KML area operasi tidak tersedia." icon="⬠" />;
  }
  if (analysing) {
    return <Empty title="Menghitung dwell..." hint="Deteksi masuk/keluar berjalan di worker." icon="◷" />;
  }
  if (events.length === 0) {
    return (
      <Empty
        title="Belum ada event"
        hint="Muat jejak lewat context bar di atas. Event lebih pendek dari 30 detik diabaikan sebagai noise GPS."
        icon="◷"
      />
    );
  }

  const totalMs = events.reduce((sum, e) => sum + e.durationMs, 0);

  return (
    <div>
      <div style={{
        display: 'flex', gap: space[3], padding: `${space[2]}px ${space[3]}px`,
        borderBottom: `1px solid ${C.line}`, ...text.sm, color: C.g5,
        position: 'sticky', top: 0, background: C.white, zIndex: 1,
      }}>
        <span>{events.length} event</span>
        <span>total {formatDuration(totalMs)}</span>
        <span>rata-rata {formatDuration(totalMs / events.length)}</span>
      </div>

      {events.map((e) => {
        const key = eventKey(e);
        const isSelected = key === selectedKey;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(e)}
            style={{
              display: 'flex', alignItems: 'center', gap: space[2], width: '100%',
              padding: `6px ${space[3]}px`, textAlign: 'left', cursor: 'pointer',
              border: 'none', borderBottom: `1px solid ${C.g1}`,
              borderLeft: `3px solid ${isSelected ? C.sel : 'transparent'}`,
              background: isSelected ? C.selBg : C.white,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: 2, flexShrink: 0,
              background: UNIT_RAMP[e.colorIndex % UNIT_RAMP.length],
            }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block', ...text.base, fontWeight: 600, color: C.ink,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {e.unitNo}
              </span>
              <span style={{
                display: 'block', ...text.sm, color: C.g5,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {e.polygon}
              </span>
            </span>
            <span style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ display: 'block', ...text.base, fontWeight: 700, color: C.ink, fontFamily: font.mono }}>
                {formatDuration(e.durationMs)}
              </span>
              <span style={{ display: 'block', ...text.xs, color: C.g5, fontFamily: font.mono }}>
                {witaClock(e.startMs)}–{witaClock(e.endMs)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
