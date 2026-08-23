import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EditableGeoJsonLayer,
  DrawPolygonMode, DrawRectangleMode, DrawCircleFromCenterMode, DrawPolygonByDraggingMode,
  ModifyMode, TranslateMode, RotateMode, ScaleMode, DuplicateMode, SplitPolygonMode,
  MeasureDistanceMode, MeasureAreaMode, SnappableMode, ViewMode,
} from '@deck.gl-community/editable-layers';
import { TextLayer } from '@deck.gl/layers';
import useUserStore from '../../stores/userStore';
import useAreaStore, { AREA_TYPES, areaTypeMeta, newAreaProperties } from '../state/areaStore';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import MapWorkspace, { DEFAULT_VIEW_STATE } from '../map/MapWorkspace';
import MapToolbar, { MapHint, MapStatusBar } from '../map/MapToolbar';
import useBasemapLayers from '../map/layers/useBasemapLayers';
import useTraceLayers from '../map/layers/useTraceLayers';
import ContextBar from '../app/ContextBar';
import LayerManager from '../panel/LayerManager';
import AreaAttributeForm from '../panel/AreaAttributeForm';
import AreaListPanel from '../panel/AreaListPanel';
import PolygonSuggestPanel from '../panel/PolygonSuggestPanel';
import { Panel } from '../foundation/ui';
import { color as C, layout, space, text, rgb } from '../foundation/tokens';

// Area Operasi — the GIS surface.
//
// Built on @deck.gl-community/editable-layers, which is already a dependency and
// already used by MIRGeofence. The full mode set is exposed rather than just
// draw+modify, because "lengkap seperti GIS" is the requirement: an operator who
// mis-draws a corner needs vertex editing, one who needs a second identical
// stockpile needs duplicate, and one arguing about an overlap needs measurement.
//
// Snapping is on by default (SnappableMode wraps the active mode). Adjacent
// operational areas that do not share an exact edge produce slivers, and slivers
// produce dwell events that belong to neither area.

const MODES = {
  view: () => new ViewMode(),
  'draw-polygon': () => new DrawPolygonMode(),
  'draw-rectangle': () => new DrawRectangleMode(),
  'draw-circle': () => new DrawCircleFromCenterMode(),
  'draw-freehand': () => new DrawPolygonByDraggingMode(),
  modify: () => new ModifyMode(),
  translate: () => new TranslateMode(),
  rotate: () => new RotateMode(),
  scale: () => new ScaleMode(),
  duplicate: () => new DuplicateMode(),
  split: () => new SplitPolygonMode(),
  'measure-distance': () => new MeasureDistanceMode(),
  'measure-area': () => new MeasureAreaMode(),
};

const DRAW_MODES = new Set(['draw-polygon', 'draw-rectangle', 'draw-circle', 'draw-freehand']);
const MEASURE_MODES = new Set(['measure-distance', 'measure-area']);

const HINTS = {
  'draw-polygon': 'Klik untuk menambah titik · klik dua kali atau Enter untuk menutup · Esc batal',
  'draw-rectangle': 'Klik dan seret untuk membuat persegi',
  'draw-circle': 'Klik titik pusat lalu seret untuk mengatur radius',
  'draw-freehand': 'Tahan dan seret untuk menggambar bebas',
  modify: 'Seret titik sudut untuk mengubah · klik di tengah ruas untuk menambah titik · Alt+klik untuk menghapus titik',
  translate: 'Seret area untuk memindahkan seluruhnya',
  rotate: 'Seret pegangan untuk memutar area',
  scale: 'Seret pegangan sudut untuk mengubah ukuran',
  duplicate: 'Seret area untuk menggandakan',
  split: 'Gambar garis melintasi area untuk membelahnya',
  'measure-distance': 'Klik berurutan untuk mengukur jarak · klik dua kali untuk selesai',
  'measure-area': 'Klik berurutan untuk mengukur luas · klik dua kali untuk selesai',
};

export default function AreaOperasiV3({ handoff = null, onCommitHandoff, onBackToSpeed }) {
  const profileDistrict = useUserStore((s) => s.profile?.distrik);
  const contextDistrict = useHistoryStore((s) => s.appliedContext?.district ?? s.context.district);
  const district = contextDistrict || profileDistrict || (import.meta.env.DEV ? 'BRCB' : '');

  const collection = useAreaStore((s) => s.collection);
  const setCollection = useAreaStore((s) => s.setCollection);
  const selectedIndexes = useAreaStore((s) => s.selectedIndexes);
  const setSelected = useAreaStore((s) => s.setSelected);
  const mode = useAreaStore((s) => s.mode);
  const setMode = useAreaStore((s) => s.setMode);
  const snapping = useAreaStore((s) => s.snapping);
  const setSnapping = useAreaStore((s) => s.setSnapping);
  const undo = useAreaStore((s) => s.undo);
  const redo = useAreaStore((s) => s.redo);
  const historyLength = useAreaStore((s) => s.history.length);
  const futureLength = useAreaStore((s) => s.future.length);
  const removeSelected = useAreaStore((s) => s.removeSelected);
  const dirty = useAreaStore((s) => s.dirty);
  const save = useAreaStore((s) => s.save);
  const saving = useAreaStore((s) => s.saving);
  const suggestion = useAreaStore((s) => s.suggestion);
  const layerId = useAreaStore((s) => s.layerId);
  const loadLayers = useAreaStore((s) => s.loadLayers);
  const importCollection = useAreaStore((s) => s.importCollection);
  const markClean = useAreaStore((s) => s.markClean);

  useEffect(() => { loadLayers(); }, [loadLayers]);

  const loadedHandoffRef = useRef(null);
  useEffect(() => {
    if (!handoff || loadedHandoffRef.current === handoff.id) return;
    loadedHandoffRef.current = handoff.id;
    importCollection(handoff.collection);
    setSelected(handoff.collection.features.map((_, index) => index));
    setMode('modify');
    setPanel('list');
  }, [handoff, importCollection, setSelected, setMode]);

  const canEdit = Boolean(layerId || handoff);
  const persist = useCallback(() => {
    if (handoff) {
      onCommitHandoff?.(collection);
      markClean();
    }
    else save();
  }, [handoff, onCommitHandoff, collection, markClean, save]);

  const selectedTraceIds = useHistoryStore((s) => s.selection.deviceIds);

  const [panel, setPanel] = useState('list');
  const [cameraCommand, setCameraCommand] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_VIEW_STATE.zoom);
  const [cursor, setCursor] = useState(null);
  const mapRef = useRef(null);

  const { layers: basemapLayers, orthoVersions } = useBasemapLayers({ district });
  // The historical trace is the evidence a polygon is drawn from, so it stays
  // available here at reduced prominence.
  const traceLayers = useTraceLayers({ selectedIds: selectedTraceIds, onSampleClick: null });

  // ---- keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        persist();
        return;
      }
      if (event.key === 'Escape') { setMode('view'); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIndexes.length > 0) { event.preventDefault(); removeSelected(); }
        return;
      }
      const shortcuts = {
        v: 'view', p: 'draw-polygon', r: 'draw-rectangle', c: 'draw-circle',
        f: 'draw-freehand', e: 'modify', m: 'translate', d: 'measure-distance', a: 'measure-area',
      };
      const next = shortcuts[event.key.toLowerCase()];
      // Draw/edit shortcuts need a target layer, same as their toolbar buttons.
      // View and measure modes don't write anything, so they stay unguarded.
      const needsLayer = next && next !== 'view' && !MEASURE_MODES.has(next);
      if (next && (!needsLayer || canEdit)) setMode(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, persist, setMode, removeSelected, selectedIndexes.length, canEdit]);

  // ---- edit layer ----------------------------------------------------------
  const editMode = useMemo(() => {
    const factory = MODES[mode] || MODES.view;
    const instance = factory();
    // Snapping applies to geometry work, not to measurement or plain viewing.
    if (snapping && !MEASURE_MODES.has(mode) && mode !== 'view') {
      return new SnappableMode(instance);
    }
    return instance;
  }, [mode, snapping]);

  const handleEdit = useCallback(({ updatedData, editType }) => {
    // Intermediate events (a vertex being dragged, a cursor moving during a
    // draw) must not each become an undo step.
    const committing = [
      'addFeature', 'addPosition', 'removePosition', 'finishMovePosition',
      'translated', 'rotated', 'scaled', 'duplicated', 'split',
    ].includes(editType);

    let next = updatedData;

    if (editType === 'addFeature') {
      const features = [...updatedData.features];
      const last = features.length - 1;
      features[last] = {
        ...features[last],
        properties: { ...newAreaProperties(last), ...(features[last].properties || {}) },
      };
      next = { ...updatedData, features };
      setSelected([last]);
      setMode('modify');
      setPanel('attributes');
    }

    setCollection(next, { record: committing });
  }, [setCollection, setSelected, setMode]);

  const areaLayers = useMemo(() => {
    const layers = [new EditableGeoJsonLayer({
      id: 'v3-areas',
      data: collection,
      mode: editMode,
      selectedFeatureIndexes: selectedIndexes,
      onEdit: handleEdit,
      pickable: true,
      onClick: (info) => {
        if (mode !== 'view' && mode !== 'modify') return;
        if (info.index != null && info.index >= 0) {
          setSelected([info.index]);
          setPanel('attributes');
        }
      },
      getFillColor: (feature, isSelected) => {
        const meta = areaTypeMeta(feature.properties?.type);
        return [...rgb(meta.color), isSelected ? 90 : 45];
      },
      getLineColor: (feature, isSelected) => {
        const meta = areaTypeMeta(feature.properties?.type);
        return [...rgb(isSelected ? C.sel : meta.color), 235];
      },
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      getEditHandlePointColor: [...rgb(C.sel), 255],
      getEditHandlePointRadius: 5,
      editHandlePointRadiusUnits: 'pixels',
      updateTriggers: {
        getFillColor: selectedIndexes,
        getLineColor: selectedIndexes,
      },
    })];

    // Labels: name plus the speed rule, so the map itself answers "what applies
    // here" without opening the panel.
    if (collection.features.length > 0) {
      layers.push(new TextLayer({
        id: 'v3-area-labels',
        data: collection.features
          .map((feature, index) => ({ feature, index }))
          .filter(({ feature }) => feature.geometry?.type === 'Polygon'),
        getPosition: ({ feature }) => {
          const ring = feature.geometry.coordinates[0];
          let x = 0; let y = 0;
          ring.forEach(([lon, lat]) => { x += lon; y += lat; });
          return [x / ring.length, y / ring.length];
        },
        getText: ({ feature }) => {
          const p = feature.properties || {};
          const rule = p.speedPlan != null ? `\n${p.speedPlan} km/j` : '';
          return `${p.name || 'Tanpa nama'}${rule}`;
        },
        getSize: 12,
        getColor: rgb(C.ink),
        background: true,
        getBackgroundColor: [255, 255, 255, 215],
        backgroundPadding: [5, 3],
        getBorderRadius: 3,
        fontFamily: 'ui-sans-serif,system-ui,sans-serif',
        fontWeight: 700,
        fontSettings: { sdf: false },
        pickable: false,
        updateTriggers: { getText: collection },
      }));
    }

    return layers;
  }, [collection, editMode, selectedIndexes, handleEdit, mode, setSelected]);

  const layers = useMemo(
    () => [...basemapLayers, ...traceLayers, ...areaLayers],
    [basemapLayers, traceLayers, areaLayers],
  );

  // ---- toolbar -------------------------------------------------------------
  // Nothing to draw or edit without a target layer — see the picker in
  // AreaListPanel. Measure and history tools stay usable regardless: they
  // don't write anything.
  const toolGroups = useMemo(() => ([
    {
      key: 'draw',
      label: 'Gambar',
      tools: [
        { key: 'draw-polygon', glyph: '⬠', label: 'Gambar polygon', shortcut: 'P', disabled: !canEdit, onClick: () => setMode('draw-polygon') },
        { key: 'draw-rectangle', glyph: '▭', label: 'Gambar persegi', shortcut: 'R', disabled: !canEdit, onClick: () => setMode('draw-rectangle') },
        { key: 'draw-circle', glyph: '◯', label: 'Gambar lingkaran', shortcut: 'C', disabled: !canEdit, onClick: () => setMode('draw-circle') },
        { key: 'draw-freehand', glyph: '✎', label: 'Gambar bebas', shortcut: 'F', disabled: !canEdit, onClick: () => setMode('draw-freehand') },
      ],
    },
    {
      key: 'edit',
      label: 'Ubah',
      tools: [
        { key: 'modify', glyph: '⬡', label: 'Ubah titik sudut', shortcut: 'E', disabled: !canEdit, onClick: () => setMode('modify') },
        { key: 'translate', glyph: '✥', label: 'Pindahkan area', shortcut: 'M', disabled: !canEdit, onClick: () => setMode('translate') },
        { key: 'rotate', glyph: '↻', label: 'Putar area', disabled: !canEdit, onClick: () => setMode('rotate') },
        { key: 'scale', glyph: '⤢', label: 'Ubah ukuran', disabled: !canEdit, onClick: () => setMode('scale') },
        { key: 'duplicate', glyph: '⧉', label: 'Gandakan area', disabled: !canEdit, onClick: () => setMode('duplicate') },
        { key: 'split', glyph: '⑂', label: 'Belah area', disabled: !canEdit, onClick: () => setMode('split') },
        {
          key: 'delete-selected', glyph: '🗑', label: 'Hapus area terpilih', shortcut: 'Del',
          danger: true, disabled: selectedIndexes.length === 0, onClick: removeSelected,
        },
      ],
    },
    {
      key: 'measure',
      label: 'Ukur',
      tools: [
        { key: 'measure-distance', glyph: '📏', label: 'Ukur jarak', shortcut: 'D', onClick: () => setMode('measure-distance') },
        { key: 'measure-area', glyph: '⬛', label: 'Ukur luas', shortcut: 'A', onClick: () => setMode('measure-area') },
      ],
    },
    {
      key: 'history',
      label: 'Riwayat',
      tools: [
        { key: 'undo', glyph: '↶', label: 'Urungkan', shortcut: 'Ctrl+Z', disabled: historyLength === 0, onClick: undo },
        { key: 'redo', glyph: '↷', label: 'Ulangi', shortcut: 'Ctrl+Shift+Z', disabled: futureLength === 0, onClick: redo },
        { key: 'snap', glyph: '⊹', label: snapping ? 'Snap aktif' : 'Snap mati', onClick: () => setSnapping(!snapping) },
        {
          key: 'save', glyph: '💾', label: saving ? 'Menyimpan…' : dirty ? 'Simpan (Ctrl+S)' : 'Tersimpan',
          disabled: !dirty || saving || !canEdit, onClick: persist,
        },
      ],
    },
  ]), [
    setMode, canEdit, selectedIndexes.length, removeSelected, historyLength, futureLength,
    undo, redo, snapping, setSnapping, dirty, saving, persist, handoff,
  ]);

  const panels = useMemo(() => ([
    { key: 'list', glyph: '☰', title: `Area (${collection.features.length})`, render: () => <AreaListPanel handoff={handoff} onSaveHandoff={persist} onFocus={setCameraCommand} onOpenAttributes={() => setPanel('attributes')} /> },
    { key: 'attributes', glyph: 'ⓘ', title: 'Properti area', render: () => <AreaAttributeForm /> },
    { key: 'suggest', glyph: '✧', title: 'Usulan dari jejak', render: () => <PolygonSuggestPanel /> },
    { key: 'layers', glyph: '◱', title: 'Layer', render: () => <LayerManager orthoVersions={orthoVersions} /> },
  ]), [collection.features.length, orthoVersions, handoff, persist]);

  const activePanel = panels.find((p) => p.key === panel) || null;
  const activeTool = mode === 'view' ? 'pan' : mode;

  // Suggested geometry gets its own preview so it is visibly NOT yet a saved
  // area until the user accepts it.
  const suggestionLayer = useMemo(() => {
    if (!suggestion?.polygon) return [];
    return [new EditableGeoJsonLayer({
      id: 'v3-area-suggestion',
      data: { type: 'FeatureCollection', features: [suggestion.polygon] },
      mode: new ViewMode(),
      selectedFeatureIndexes: [],
      pickable: false,
      getFillColor: [...rgb(C.warn), 70],
      getLineColor: [...rgb(C.warn), 255],
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
    })];
  }, [suggestion]);

  return (
    <>
      <ContextBar />

      {handoff ? (
        <div style={{
          minHeight: 48, display: 'flex', alignItems: 'center', gap: space[3],
          padding: `6px ${space[4]}px`, background: C.selBg, borderBottom: `1px solid ${C.selLine}`,
        }}>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', ...text.sm, color: C.ink }}>Geometry handoff · Review Draft v{handoff.version}</strong>
            <span style={{ ...text.xs, color: C.g6 }}>Ubah titik sudut, tambah/hapus vertex, lalu simpan kembali ke Review Draft.</span>
          </div>
          <button type="button" onClick={onBackToSpeed} style={{ border: `1px solid ${C.lineStrong}`, background: C.white, borderRadius: 4, height: 30, padding: '0 10px', cursor: 'pointer' }}>
            ← Kembali ke Speed Analysis
          </button>
          <button type="button" onClick={persist} disabled={!dirty} style={{ border: 0, background: dirty ? C.sel : C.g3, color: C.white, borderRadius: 4, height: 30, padding: '0 12px', cursor: dirty ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
            Simpan ke Review Draft
          </button>
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <MapWorkspace
            ref={mapRef}
            layers={[...layers, ...suggestionLayer]}
            cameraCommand={cameraCommand}
            tool={activeTool === 'pan' ? 'pan' : 'edit'}
            onZoomChange={setZoom}
            onCursorMove={setCursor}
            getCursor={() => (DRAW_MODES.has(mode) || MEASURE_MODES.has(mode) ? 'crosshair' : 'grab')}
          />

          <MapToolbar
            tool={activeTool}
            onToolChange={(t) => setMode(t === 'pan' ? 'view' : t)}
            panel={panel}
            onPanelChange={setPanel}
            onResetView={() => setCameraCommand({ ...DEFAULT_VIEW_STATE, transitionDuration: 600 })}
            onZoomIn={() => {
              const vs = mapRef.current?.getViewState?.() || DEFAULT_VIEW_STATE;
              setCameraCommand({ ...vs, zoom: Math.min(20, vs.zoom + 1), transitionDuration: 220 });
            }}
            onZoomOut={() => {
              const vs = mapRef.current?.getViewState?.() || DEFAULT_VIEW_STATE;
              setCameraCommand({ ...vs, zoom: Math.max(3, vs.zoom - 1), transitionDuration: 220 });
            }}
            panels={panels}
            groups={toolGroups}
          />

          {HINTS[mode] ? <MapHint>{HINTS[mode]}</MapHint> : null}
          {/* Floating here: this page is all map and has no temporal dock to
              host the readout. */}
          <MapStatusBar zoom={zoom} coordinate={cursor} floating />

          <AreaTypeLegend />
        </div>

        {activePanel ? (
          <aside style={{
            width: layout.panelWidth, flexShrink: 0,
            borderLeft: `1px solid ${C.line}`, background: C.white,
            display: 'flex', flexDirection: 'column', minHeight: 0,
          }}>
            <Panel
              title={activePanel.title}
              style={{ border: 'none', borderRadius: 0, boxShadow: 'none', height: '100%' }}
              actions={
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  aria-label="Tutup panel"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.g5, fontSize: 14 }}
                >
                  ✕
                </button>
              }
            >
              {activePanel.render()}
            </Panel>
          </aside>
        ) : null}
      </div>
    </>
  );
}

function AreaTypeLegend() {
  return (
    <div style={{
      position: 'absolute', left: space[2], bottom: space[2],
      background: C.white, border: `1px solid ${C.lineStrong}`, borderRadius: 5,
      padding: `6px ${space[3]}px`, zIndex: 11,
    }}>
      <div style={{ ...text.label, color: C.g5, marginBottom: 3 }}>Tipe area</div>
      {AREA_TYPES.map((t) => (
        <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: t.color }} />
          <span style={{ ...text.sm, color: C.g6 }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}
