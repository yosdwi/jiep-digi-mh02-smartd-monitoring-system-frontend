import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useUserStore from '../../stores/userStore';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import { computeAnalytics, STATE_META, STATE_ORDER } from '../services/analyticsClient';
import MapWorkspace, { DEFAULT_VIEW_STATE, pointInPolygon } from '../map/MapWorkspace';
import { mercatorAspect, splitWorkspace } from '../map/orthoFit';
import { MapHint, MapStatusBar } from '../map/MapToolbar';
import MapLegend from '../map/MapLegend';
import useBasemapLayers from '../map/layers/useBasemapLayers';
import useTraceLayers from '../map/layers/useTraceLayers';
import usePlaybackLayers from '../map/layers/usePlaybackLayers';
import ContextBar from '../app/ContextBar';
import TemporalPanel from '../temporal/TemporalPanel';
import PlaybackBar from '../temporal/PlaybackBar';
import LayerManager from '../panel/LayerManager';
import UnitList from '../panel/UnitList';
import FleetSummaryPanel from '../panel/FleetSummaryPanel';
import UnitMetricsTable from '../panel/UnitMetricsTable';
import PlaybackInspector from '../panel/PlaybackInspector';
import { Panel } from '../foundation/ui';
import { color as C, font, layout, radius, space, text } from '../foundation/tokens';

// Shared workspace for every historical page.
//
// Cycle Time, Underspeed and Durasi In Pit differ by the layers they add and the
// panels they show — not by having their own map, loader, analytics or playback
// engine.

const MIN_SIDE_PANEL = 300;
const MAX_SIDE_PANEL = 560;
const MIN_BOTTOM_PANEL = 112;
const MAX_BOTTOM_PANEL = 340;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function HistoryWorkspace({
  appearance = 'default',
  extraLayers = [],
  sidePanels = [],
  defaultPanel = 'summary',
  toolGroups = [],
  onSampleClick,
  temporal = null,
  cameraTarget = null,
  headerContent = null,
}) {
  const profileDistrict = useUserStore((s) => s.profile?.distrik);
  const contextDistrict = useHistoryStore((s) => s.appliedContext?.district ?? s.context.district);
  const district = contextDistrict || profileDistrict || (import.meta.env.DEV ? 'BRCB' : '');

  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);
  const setSelection = useHistoryStore((s) => s.setSelection);
  const playbackActive = useHistoryStore((s) => s.playback.active);
  const status = useHistoryStore((s) => s.status);
  const timeWindow = useHistoryStore((s) => s.window);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);
  const setAnalytics = useHistoryStore((s) => s.setAnalytics);
  const speedBands = useHistoryStore((s) => s.speedBands);

  const [tool, setTool] = useState('pan');
  const [panel, setPanel] = useState(defaultPanel);
  const [cameraCommand, setCameraCommand] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_VIEW_STATE.zoom);
  const [cursor, setCursor] = useState(null);
  const [manualPanelWidth, setManualPanelWidth] = useState(null);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(layout.temporalHeight);
  const mapRef = useRef(null);
  const sideResizeRef = useRef(null);
  const bottomResizeRef = useRef(null);

  // The workspace row, measured so the map/panel split can be derived from the
  // orthophoto's shape rather than fixed. See orthoFit.js for the reasoning.
  const rowRef = useRef(null);
  const [rowSize, setRowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = rowRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Only whole pixels: sub-pixel jitter from a scrollbar appearing would
      // otherwise re-render the workspace on every frame.
      setRowSize((prev) => {
        const next = { width: Math.round(width), height: Math.round(height) };
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (sideResizeRef.current) {
        const next = sideResizeRef.current.startWidth - (event.clientX - sideResizeRef.current.startX);
        setManualPanelWidth(clamp(next, MIN_SIDE_PANEL, Math.min(MAX_SIDE_PANEL, Math.max(MIN_SIDE_PANEL, rowSize.width - 360))));
      }
      if (bottomResizeRef.current) {
        const next = bottomResizeRef.current.startHeight - (event.clientY - bottomResizeRef.current.startY);
        setBottomPanelHeight(clamp(next, MIN_BOTTOM_PANEL, MAX_BOTTOM_PANEL));
      }
    };

    const stopResize = () => {
      sideResizeRef.current = null;
      bottomResizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    globalThis.window.addEventListener('pointermove', handlePointerMove);
    globalThis.window.addEventListener('pointerup', stopResize);
    return () => {
      globalThis.window.removeEventListener('pointermove', handlePointerMove);
      globalThis.window.removeEventListener('pointerup', stopResize);
      stopResize();
    };
  }, [rowSize.width]);

  const effectiveCamera = cameraTarget ?? cameraCommand;
  const startMs = timeWindow?.startMs ?? rangeStartMs;
  const endMs = timeWindow?.endMs ?? rangeEndMs;

  const { layers: basemapLayers, orthoVersions, activeOrtho, orthoLoading } = useBasemapLayers({ district });

  // ---- analytics -----------------------------------------------------------
  // Recomputed when the loaded trace or the brushed window changes. Debounced:
  // brushing emits a window per pointer release, and while the scan is off the
  // main thread it still costs a structured clone of the columns.
  useEffect(() => {
    if (status.state !== 'ready' || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;
    if (registry.listDevices().length === 0) { setAnalytics({ fleet: null, units: [] }); return undefined; }

    let cancelled = false;
    setAnalytics({ computing: true, error: null });
    const timer = setTimeout(() => {
      computeAnalytics({ startMs, endMs, speedBands })
        .then(({ fleet, units }) => { if (!cancelled) setAnalytics({ fleet, units, computing: false }); })
        .catch((err) => { if (!cancelled) setAnalytics({ computing: false, error: err.message }); });
    }, 180);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [status.state, status.sampleCount, startMs, endMs, setAnalytics, speedBands]);

  // ---- map -----------------------------------------------------------------
  const handleSampleClick = useCallback((device, info) => {
    onSampleClick?.(device, info);
    useHistoryStore.getState().toggleSelection(device.deviceId);
  }, [onSampleClick]);

  const traceLayers = useTraceLayers({ selectedIds, onSampleClick: handleSampleClick });
  const playbackLayers = usePlaybackLayers();

  const layers = useMemo(
    () => [...basemapLayers, ...extraLayers, ...traceLayers, ...playbackLayers],
    [basemapLayers, extraLayers, traceLayers, playbackLayers],
  );

  // Spatial selection: "whatever drove HERE", which the attribute picker cannot
  // express. Runs over typed arrays, stopping at the first hit per device.
  const handleLasso = useCallback((ring) => {
    if (!ring || ring.length < 3) return;
    const hits = [];
    registry.listDevices().forEach((device) => {
      let found = false;
      device.chunks.forEach((chunk) => {
        if (found) return;
        for (let i = 0; i < chunk.n; i++) {
          if (pointInPolygon(chunk.position[i * 2], chunk.position[i * 2 + 1], ring)) { found = true; break; }
        }
      });
      if (found) hits.push(device.deviceId);
    });
    setSelection(hits);
    setTool('pan');
    setPanel('metrics');
  }, [setSelection]);

  const fitToData = useCallback(() => {
    const devices = registry.listDevices();
    if (devices.length === 0) {
      setCameraCommand({ ...DEFAULT_VIEW_STATE, transitionDuration: 600 });
      return;
    }
    // Percentiles, not min/max. Fleet GPS carries a small tail of wildly wrong
    // fixes -- in one measured 2-hour range, 0.21% of samples from 3 units landed
    // up to 2000 km away. Absolute bounds let that tail dictate the camera: the
    // zoom bottomed out at its floor and centred on empty sea between the mine and
    // the outliers, which reads as a blank map because the ortho has no tiles out
    // there. Trimming the outer 1% frames what the fleet actually did.
    const lons = [];
    const lats = [];
    devices.forEach((device) => device.chunks.forEach((chunk) => {
      for (let i = 0; i < chunk.n; i += 16) {
        lons.push(chunk.position[i * 2]);
        lats.push(chunk.position[i * 2 + 1]);
      }
    }));
    if (lons.length === 0) return;

    lons.sort((a, b) => a - b);
    lats.sort((a, b) => a - b);
    const lo = Math.floor(lons.length * 0.01);
    const hi = Math.max(lo, Math.ceil(lons.length * 0.99) - 1);
    const minLon = lons[lo]; const maxLon = lons[hi];
    const minLat = lats[lo]; const maxLat = lats[hi];
    if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return;

    // Hand the box to the map and let it pick the zoom: framing a box depends on
    // the canvas size, which this component does not know. The previous
    // `log2(360 / span)` estimate ignored it and so sat about three zoom levels
    // too far out -- far enough that the ortho basemap had no tiles left to draw.
    const pad = 0.0005;
    setCameraCommand({
      fitBounds: [
        [minLon - pad, minLat - pad],
        [maxLon + pad, maxLat + pad],
      ],
      transitionDuration: 700,
    });
  }, []);

  // Auto-fit the first time a query produces data, so the user is never left
  // looking at an empty district centre with the trace off-screen.
  const fittedRef = useRef(null);
  useEffect(() => {
    if (status.state === 'ready' && status.queryId && fittedRef.current !== status.queryId) {
      fittedRef.current = status.queryId;
      fitToData();
    }
  }, [status.state, status.queryId, fitToData]);

  // Open on the site, not on a hardcoded coordinate.
  //
  // The default camera was a fixed lon/lat/zoom, so before any query the product
  // opened on "somewhere near the district" and read like a generic world map.
  // The orthophoto footprint is the real spatial context, and its extent is
  // known as soon as the layer list resolves. Runs once, and never fights the
  // data fit: if a query has already framed itself, that wins.
  const siteFittedRef = useRef(false);
  useEffect(() => {
    if (siteFittedRef.current || fittedRef.current) return;
    const extent = activeOrtho?.extent;
    if (!extent) return;
    siteFittedRef.current = true;
    const [west, south, east, north] = extent;
    // No transition: this is the opening frame, and animating into it from a
    // placeholder position looks like a bug rather than a move.
    setCameraCommand({ fitBounds: [[west, south], [east, north]], transitionDuration: 0 });
  }, [activeOrtho]);

  const focusDevice = useCallback((entry) => {
    const device = registry.getDevice(entry.deviceId);
    const first = device?.chunks.values().next().value;
    if (!first || first.n === 0) return;
    setCameraCommand({
      longitude: first.position[0], latitude: first.position[1],
      zoom: 16, transitionDuration: 900,
    });
  }, []);

  const zoomBy = useCallback((delta) => {
    const current = mapRef.current?.getViewState?.() || DEFAULT_VIEW_STATE;
    setCameraCommand({
      longitude: current.longitude,
      latitude: current.latitude,
      zoom: Math.min(20, Math.max(3, (current.zoom || 13) + delta)),
      transitionDuration: 220,
    });
  }, []);

  // ---- panels --------------------------------------------------------------
  // Defaults first, sidePanels layered on top by key: a page whose sidePanels
  // includes 'summary' or 'metrics' replaces the fleet-wide cycle-time view
  // with its own (Underspeed, Durasi In Pit), everyone else keeps the
  // default. Map preserves each key's original slot, so override or not, the
  // tab order never reshuffles.
  const panels = useMemo(() => {
    const defaults = [
      { key: 'summary', title: 'Ringkasan', render: () => <FleetSummaryPanel /> },
      { key: 'metrics', title: 'Metrik unit', render: () => <UnitMetricsTable onFocusDevice={focusDevice} /> },
      { key: 'units', title: 'Unit & jejak', render: () => <UnitList onFocusDevice={focusDevice} /> },
    ];
    const merged = new Map(defaults.map((p) => [p.key, p]));
    sidePanels.forEach((p) => merged.set(p.key, p));
    return [
      ...merged.values(),
      { key: 'playback', title: 'Monitor playback', render: () => <PlaybackInspector /> },
      { key: 'layers', title: 'Layer', render: () => <LayerManager orthoVersions={orthoVersions} /> },
    ];
  }, [orthoVersions, focusDevice, sidePanels]);

  // The panel is never empty. `panel` may still be missing from `panels` while a
  // page swaps its own sidePanels in, so fall back rather than render nothing:
  // an absent panel is how the workspace ended up as a bare map.
  const activePanel = panels.find((p) => p.key === panel) || panels[0];

  // Panel width follows the imagery.
  //
  // The map used to take every pixel the panel did not claim, so a site whose
  // orthophoto is taller than it is wide sat in the middle of a wide canvas with
  // empty basemap either side — width spent on nothing, while the summary that
  // the operator actually reads stayed at its minimum.
  const { panelWidth: fittedPanelWidth } = useMemo(() => splitWorkspace({
    width: rowSize.width,
    height: rowSize.height,
    aspect: mercatorAspect(activeOrtho?.extent),
  }), [rowSize.width, rowSize.height, activeOrtho]);
  const panelWidth = manualPanelWidth ?? fittedPanelWidth;

  // Opening the playback monitor when playback starts is what the user wants
  // nine times out of ten; overriding an explicit panel choice is not.
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (playbackActive && !wasPlayingRef.current) setPanel('playback');
    wasPlayingRef.current = playbackActive;
  }, [playbackActive]);

  // Follow the selection.
  //
  // The panel is one slot with six occupants, and it used to sit on whatever was
  // chosen last regardless of what the operator was doing — so selecting units
  // on the map left the fleet summary up, which answers a question they had
  // already moved on from. Selecting shows the metrics for that selection;
  // clearing it goes back to the fleet. An explicit choice of any *other* panel
  // is left alone: this only ever moves between the two selection-shaped views.
  const hadSelectionRef = useRef(false);
  useEffect(() => {
    const has = selectedIds.length > 0;
    if (has !== hadSelectionRef.current) {
      hadSelectionRef.current = has;
      setPanel((current) => {
        if (has) return current === 'summary' ? 'metrics' : current;
        return current === 'metrics' ? 'summary' : current;
      });
    }
  }, [selectedIds]);

  if (appearance === 'analysis-locked') {
    return (
      <LockedAnalysisWorkspace
        panels={panels}
        activePanel={activePanel}
        onPanelChange={setPanel}
        tool={tool}
        onToolChange={setTool}
        onResetView={fitToData}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        mapRef={mapRef}
        layers={layers}
        cameraCommand={effectiveCamera}
        onLasso={handleLasso}
        onZoomChange={setZoom}
        onCursorMove={setCursor}
        cursor={cursor}
        zoom={zoom}
        orthoLoading={orthoLoading}
        playbackActive={playbackActive}
        temporal={temporal}
        bottomPanelHeight={bottomPanelHeight}
        onResizeStart={(event) => {
          event.preventDefault();
          bottomResizeRef.current = { startY: event.clientY, startHeight: bottomPanelHeight };
          document.body.style.cursor = 'row-resize';
          document.body.style.userSelect = 'none';
        }}
      />
    );
  }

  return (
    <>
      <ContextBar />
      {headerContent}
      <WorkspaceToolStrip
        panels={panels}
        activePanel={activePanel.key}
        onPanelChange={setPanel}
        tool={tool}
        onToolChange={setTool}
        onResetView={fitToData}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        groups={toolGroups}
      />

      <div ref={rowRef} style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <MapWorkspace
            ref={mapRef}
            layers={layers}
            cameraCommand={effectiveCamera}
            tool={tool}
            onLasso={handleLasso}
            onZoomChange={setZoom}
            onCursorMove={setCursor}
          />

          <MapLegend />

          {tool === 'measure' ? (
            <MapHint>Klik titik awal, arahkan ke titik akhir, lalu klik lagi atau Enter untuk selesai</MapHint>
          ) : null}

          {tool === 'lasso' ? (
            <MapHint tone="warn">Lasso masih tersedia dari shortcut lama, tapi bukan tool utama</MapHint>
          ) : null}
        </div>

        {/* Permanent contextual panel.
            It used to be closable to nothing, and closing it left a full-bleed
            map with no second surface — the emptiness this workspace was
            reported for. There is no close now; the toolbar switches which
            question the panel answers, and the map re-frames itself to whatever
            width is left. */}
        <aside style={{
          position: 'relative',
          width: panelWidth, flexShrink: 0,
          borderLeft: `1px solid ${C.line}`, background: C.white,
          display: 'flex', flexDirection: 'column', minHeight: 0,
          // Matches the map's own re-fit transition so the two edges move
          // together rather than the panel snapping and the map catching up.
          transition: 'width 160ms ease',
        }}>
          <div
            role="separator"
            aria-label="Ubah lebar panel kanan"
            aria-orientation="vertical"
            onPointerDown={(event) => {
              event.preventDefault();
              sideResizeRef.current = { startX: event.clientX, startWidth: panelWidth };
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            title="Tarik untuk mengubah lebar panel"
            style={{
              position: 'absolute',
              left: -10,
              top: 0,
              bottom: 0,
              width: 20,
              cursor: 'col-resize',
              zIndex: 2,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <ResizeGrip orientation="vertical" label="Tarik" />
          </div>
          <Panel
            title={activePanel.title}
            style={{ border: 'none', borderRadius: 0, boxShadow: 'none', height: '100%' }}
          >
            {activePanel.render()}
          </Panel>
        </aside>
      </div>

      {playbackActive ? <PlaybackBar /> : null}
      <div style={{ position: 'relative', height: bottomPanelHeight, flexShrink: 0 }}>
        <div
          role="separator"
          aria-label="Ubah tinggi panel bawah"
          aria-orientation="horizontal"
          onPointerDown={(event) => {
            event.preventDefault();
            bottomResizeRef.current = { startY: event.clientY, startHeight: bottomPanelHeight };
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
          }}
          title="Tarik ke atas untuk memperbesar panel bawah"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -12,
            height: 24,
            cursor: 'row-resize',
            zIndex: 4,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <ResizeGrip orientation="horizontal" label="Tarik ke atas" />
        </div>
        {temporal ?? (
          <TemporalPanel
            style={{ height: '100%' }}
            status={<MapStatusBar zoom={zoom} coordinate={cursor} orthoLoading={orthoLoading} />}
          />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Locked Analysis Workspace surface
// ---------------------------------------------------------------------------
// This is intentionally a separate composition from the legacy History page.
// Its inputs are the same optimised V3 runtime objects, but the visible
// hierarchy follows the locked HTML: context → KPI row → full map with a cycle
// overlay → performance/trend dock.  Do not fold this back into the V3 page
// chrome merely because the underlying services are shared.
function LockedAnalysisWorkspace({
  panels,
  activePanel,
  onPanelChange,
  tool,
  onToolChange,
  onResetView,
  onZoomIn,
  onZoomOut,
  mapRef,
  layers,
  cameraCommand,
  onLasso,
  onZoomChange,
  onCursorMove,
  cursor,
  zoom,
  orthoLoading,
  playbackActive,
  temporal,
  bottomPanelHeight,
  onResizeStart,
}) {
  const analytics = useHistoryStore((s) => s.analytics);
  const fleet = analytics.fleet;

  return (
    <section style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      background: C.g0, overflow: 'hidden',
    }}>
      <ContextBar variant="analysis" />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: space[2] }}>
        <AnalysisKpiStrip fleet={fleet} computing={analytics.computing} />

        <article style={{
          position: 'relative', minHeight: 560, overflow: 'hidden', background: C.white,
          border: `1px solid ${C.line}`, borderRadius: radius.lg,
          boxShadow: '0 1px 2px rgba(36,50,64,0.06)',
        }}>
          <MapWorkspace
            ref={mapRef}
            layers={layers}
            cameraCommand={cameraCommand}
            tool={tool}
            onLasso={onLasso}
            onZoomChange={onZoomChange}
            onCursorMove={onCursorMove}
          />

          <MapLegend />
          <LockedMapTools
            tool={tool}
            onToolChange={onToolChange}
            onResetView={onResetView}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
          />
          <CycleComposition fleet={fleet} />

          <div style={{
            position: 'absolute', right: space[2], bottom: space[2], zIndex: 12,
            padding: '5px 8px', border: `1px solid ${C.line}`, borderRadius: radius.md,
            background: 'rgba(255,255,255,.94)', color: C.g5, ...text.micro,
          }}>
            Zoom {Number(zoom || 0).toFixed(0)} · {cursor ? `${cursor[1].toFixed(5)}, ${cursor[0].toFixed(5)}` : orthoLoading ? 'Memuat peta…' : 'Peta siap'}
          </div>
        </article>

        <section style={{
          display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) minmax(300px,.55fr)',
          gap: space[2], marginTop: space[2], alignItems: 'stretch',
        }}>
          <AnalysisSurfaceCard title="Performance Unit">
            <AnalysisPanelTabs panels={panels} active={activePanel.key} onChange={onPanelChange} />
            <div style={{ maxHeight: 320, overflow: 'auto' }}>{activePanel.render()}</div>
          </AnalysisSurfaceCard>
          <AnalysisSurfaceCard title="Ringkasan & Komposisi Cycle">
            <div style={{ maxHeight: 364, overflow: 'auto' }}><FleetSummaryPanel /></div>
          </AnalysisSurfaceCard>
        </section>

        <AnalysisSurfaceCard title="Trend Performance" style={{ marginTop: space[2] }}>
          <div style={{ position: 'relative', height: bottomPanelHeight, minHeight: 132 }}>
            <div
              role="separator"
              aria-label="Ubah tinggi Trend Performance"
              aria-orientation="horizontal"
              onPointerDown={onResizeStart}
              style={{ position: 'absolute', top: -9, left: 0, right: 0, height: 18, cursor: 'row-resize', zIndex: 4 }}
            />
            {temporal ?? <TemporalPanel style={{ height: '100%', borderTop: 'none' }} status={<MapStatusBar zoom={zoom} coordinate={cursor} orthoLoading={orthoLoading} />} />}
          </div>
        </AnalysisSurfaceCard>
      </div>

      {playbackActive ? <PlaybackBar /> : null}
    </section>
  );
}

function AnalysisKpiStrip({ fleet, computing }) {
  const cards = [
    ['Total Unit', fleet?.unitCount, 'unit'],
    ['Total Ritase', fleet?.totalRitase, 'rit'],
    ['Avg Cycle Time', fleet?.avgCycleTime, 'menit'],
    ['Avg Jarak Muatan', fleet?.avgJarakFrontDisposal, 'km'],
    ['Avg Jarak Kosongan', fleet?.avgJarakDisposalFront, 'km'],
    ['Avg Actual Speed', fleet?.averageSpeed, 'km/jam'],
  ];

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: space[2], marginBottom: space[2] }}>
      {cards.map(([label, value, unit]) => (
        <div key={label} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: radius.lg, padding: `${space[2]}px ${space[3]}px`, minHeight: 70 }}>
          <div style={{ ...text.micro, color: C.g5 }}>{label}</div>
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <strong style={{ ...text.metric, color: C.ink }}>{computing ? '…' : formatMetric(value)}</strong>
            <span style={{ ...text.micro, color: C.g5 }}>{computing || value == null ? '' : unit}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function CycleComposition({ fleet }) {
  const rows = STATE_ORDER
    .map((state) => ({ state, ms: fleet?.stateMs?.[state] || 0, ...STATE_META[state] }))
    .filter((row) => row.ms > 0);
  const total = rows.reduce((sum, row) => sum + row.ms, 0) || 1;

  return (
    <aside style={{
      position: 'absolute', top: space[2], left: space[2], zIndex: 12, width: 304,
      padding: space[3], background: 'rgba(255,255,255,.96)', border: `1px solid ${C.line}`,
      borderRadius: radius.lg, boxShadow: '0 2px 10px rgba(36,50,64,.12)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ ...text.sm, color: C.ink, fontWeight: 750 }}>Komposisi Cycle</span>
        <strong style={{ ...text.sm, color: C.sel }}>{fleet ? `${formatMetric(fleet.avgCycleTime)} menit` : '—'}</strong>
      </div>
      <div style={{ height: 8, display: 'flex', overflow: 'hidden', borderRadius: 999, marginTop: 9, background: C.g1 }}>
        {rows.map((row) => <span key={row.state} style={{ width: `${(row.ms / total) * 100}%`, background: row.color }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 8px', marginTop: 9 }}>
        {rows.slice(0, 6).map((row) => (
          <div key={row.state} style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: row.color, flexShrink: 0 }} />
            <span style={{ ...text.micro, color: C.g6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function LockedMapTools({ tool, onToolChange, onResetView, onZoomIn, onZoomOut }) {
  const tools = [
    ['pan', '✋', 'Geser peta', () => onToolChange('pan')],
    ['measure', '↔', 'Ukur jarak', () => onToolChange('measure')],
    ['+', '＋', 'Perbesar', onZoomIn],
    ['-', '−', 'Perkecil', onZoomOut],
    ['fit', '⌗', 'Muat semua data', onResetView],
  ];
  return (
    <div style={{ position: 'absolute', top: space[2], right: space[2], zIndex: 12, overflow: 'hidden', border: `1px solid ${C.line}`, borderRadius: radius.md, boxShadow: '0 2px 8px rgba(36,50,64,.14)' }}>
      {tools.map(([key, glyph, label, action]) => (
        <button key={key} type="button" title={label} aria-label={label} onClick={action} style={{
          display: 'grid', placeItems: 'center', width: 38, height: 38, border: 0,
          borderBottom: `1px solid ${C.line}`, background: tool === key ? C.selBg : C.white,
          color: tool === key ? C.sel : C.g6, cursor: 'pointer', fontSize: 17,
        }}>{glyph}</button>
      ))}
    </div>
  );
}

function AnalysisSurfaceCard({ title, children, style }) {
  return (
    <section style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: radius.lg, overflow: 'hidden', boxShadow: '0 1px 2px rgba(36,50,64,0.05)', ...style }}>
      <header style={{ padding: `${space[2]}px ${space[3]}px`, borderBottom: `1px solid ${C.line}`, ...text.sm, fontWeight: 750, color: C.ink }}>{title}</header>
      {children}
    </section>
  );
}

function AnalysisPanelTabs({ panels, active, onChange }) {
  return (
    <nav aria-label="Tampilan Performance Unit" style={{ display: 'flex', gap: 2, padding: `${space[2]}px ${space[2]}px 0`, borderBottom: `1px solid ${C.line}`, overflowX: 'auto' }}>
      {panels.slice(0, 4).map((item) => {
        const selected = active === item.key;
        return <button key={item.key} type="button" onClick={() => onChange(item.key)} style={{ border: 0, borderBottom: `2px solid ${selected ? C.sel : 'transparent'}`, padding: `7px ${space[2]}px`, background: 'transparent', color: selected ? C.sel : C.g5, fontFamily: font.sans, ...text.micro, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{shortPanelTitle(item.title)}</button>;
      })}
    </nav>
  );
}

function formatMetric(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric.toLocaleString('id-ID') : numeric.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

function WorkspaceToolStrip({
  panels,
  activePanel,
  onPanelChange,
  tool,
  onToolChange,
  onResetView,
  onZoomIn,
  onZoomOut,
  groups,
}) {
  return (
    <div style={{
      flexShrink: 0,
      minHeight: 46,
      display: 'flex',
      alignItems: 'center',
      gap: space[3],
      padding: `0 ${space[3]}px`,
      borderBottom: `1px solid ${C.line}`,
      background: C.g0,
      overflowX: 'auto',
      overflowY: 'hidden',
      whiteSpace: 'nowrap',
    }}>
      <StripGroup label="Panel">
        {panels.map((item) => {
          const active = activePanel === item.key;
          return (
            <StripButton
              key={item.key}
              active={active}
              onClick={() => onPanelChange(item.key)}
              title={item.title}
            >
              {shortPanelTitle(item.title)}
            </StripButton>
          );
        })}
      </StripGroup>

      <StripDivider />

      <StripGroup label="Peta">
        <StripButton active={tool === 'pan'} onClick={() => onToolChange('pan')}>Geser</StripButton>
        <StripButton active={tool === 'measure'} onClick={() => onToolChange('measure')}>Penggaris</StripButton>
        <StripButton onClick={onResetView}>Fit</StripButton>
        <StripButton onClick={onZoomIn}>+</StripButton>
        <StripButton onClick={onZoomOut}>-</StripButton>
      </StripGroup>

      {groups.map((group) => (
        <StripGroup key={group.key} label={group.label}>
          {group.tools.map((item) => (
            <StripButton
              key={item.key}
              active={tool === item.key}
              danger={item.danger}
              disabled={item.disabled}
              onClick={() => (item.onClick ? item.onClick() : onToolChange(item.key))}
              title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            >
              {item.label}
            </StripButton>
          ))}
        </StripGroup>
      ))}
    </div>
  );
}

function ResizeGrip({ orientation, label }) {
  const vertical = orientation === 'vertical';
  return (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      alignItems: 'center',
      gap: vertical ? 6 : 8,
      padding: vertical ? '8px 4px' : '4px 10px',
      border: `1px solid ${C.lineStrong}`,
      borderRadius: 999,
      background: C.white,
      boxShadow: '0 2px 8px rgba(36,50,64,0.16)',
      color: C.g6,
      pointerEvents: 'none',
    }}>
      <span style={{
        display: 'grid',
        gridTemplateColumns: vertical ? 'repeat(2, 3px)' : 'repeat(6, 3px)',
        gridTemplateRows: vertical ? 'repeat(6, 3px)' : 'repeat(2, 3px)',
        gap: 3,
      }}>
        {Array.from({ length: 12 }).map((_, index) => (
          <span
            key={index}
            style={{ width: 3, height: 3, borderRadius: 999, background: C.g4 }}
          />
        ))}
      </span>
      <span style={{
        ...text.micro,
        fontWeight: 800,
        color: C.g6,
        writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </span>
    </div>
  );
}

function StripGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{ ...text.label, color: C.g5 }}>{label}</span>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 3,
        background: C.white,
        border: `1px solid ${C.line}`,
        borderRadius: radius.md,
      }}>
        {children}
      </div>
    </div>
  );
}

function StripButton({ active, danger, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-pressed={active === undefined ? undefined : Boolean(active)}
      style={{
        height: 30,
        minWidth: 34,
        padding: `0 ${space[2]}px`,
        border: `1px solid ${active ? C.selLine : 'transparent'}`,
        borderRadius: radius.sm,
        background: active ? C.selBg : 'transparent',
        color: disabled ? C.g3 : danger ? C.crit : active ? C.sel : C.g6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: font.sans,
        ...text.sm,
        fontWeight: active ? 700 : 600,
      }}
    >
      {children}
    </button>
  );
}

function StripDivider() {
  return <div style={{ width: 1, height: 26, background: C.lineStrong, flexShrink: 0 }} />;
}

function shortPanelTitle(title) {
  switch (title) {
    case 'Metrik unit': return 'Metrik';
    case 'Unit & jejak': return 'Unit';
    case 'Monitor playback': return 'Playback';
    default: return title;
  }
}
