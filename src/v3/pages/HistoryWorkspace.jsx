import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useUserStore from '../../stores/userStore';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import { computeAnalytics } from '../services/analyticsClient';
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
  extraLayers = [],
  sidePanels = [],
  defaultPanel = 'summary',
  toolGroups = [],
  onSampleClick,
  temporal = null,
  cameraTarget = null,
}) {
  const profileDistrict = useUserStore((s) => s.profile?.distrik);
  const contextDistrict = useHistoryStore((s) => s.context.district);
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

  return (
    <>
      <ContextBar />
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
