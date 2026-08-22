import { useEffect, useState } from 'react';
import useHistoryStore from '../state/historyStore';
import { Chip, Label, Select, Slider } from '../foundation/ui';
import { color as C, radius, shadow, text, space, font } from '../foundation/tokens';
import { getExportOptions } from '../services/exportApi';

// Persistent layer manager, replacing V1/V2's three-checkbox popover
// (config/layerConfig.js).
//
// Grouped by authority: operational data over spatial context over base imagery.
// Ordering WITHIN the map is fixed — putting the orthophoto above the traces has
// no valid operational use and only produces broken states — so the manager
// exposes visibility and opacity, not drag-to-reorder. That is the deliberate
// difference from a general GIS layer tree.

const GROUPS = [
  {
    key: 'data',
    label: 'Data operasi',
    rows: [
      { key: 'trace', label: 'Jejak historis', opacity: true },
    ],
  },
  {
    key: 'wilayah',
    label: 'Wilayah',
    rows: [
      { key: 'boundaries', label: 'Boundary distrik', opacity: true },
      { key: 'roads', label: 'Jalan tambang', opacity: true },
    ],
  },
  {
    key: 'dasar',
    label: 'Peta dasar',
    rows: [
      { key: 'orthophoto', label: 'Orthophoto', opacity: true },
    ],
  },
];

const ICONS = {
  trace: IconTrace,
  boundaries: IconBoundary,
  roads: IconRoad,
  orthophoto: IconOrtho,
};

const DESCRIPTIONS = {
  trace: 'Titik dan jalur unit dari query aktif.',
  boundaries: 'Batas area kerja di distrik.',
  roads: 'Konteks jalan angkut di atas peta.',
  orthophoto: 'Citra dasar hasil konversi ortho.',
};

export default function LayerManager({ orthoVersions = [] }) {
  const layers = useHistoryStore((s) => s.layers);
  const opacity = useHistoryStore((s) => s.layerOpacity);
  const setLayer = useHistoryStore((s) => s.setLayer);
  const setLayerOpacity = useHistoryStore((s) => s.setLayerOpacity);
  const traceMode = useHistoryStore((s) => s.traceMode);
  const setTraceMode = useHistoryStore((s) => s.setTraceMode);
  const traceInterval = useHistoryStore((s) => s.traceInterval);
  const setTraceInterval = useHistoryStore((s) => s.setTraceInterval);
  const orthoVersionId = useHistoryStore((s) => s.orthoVersionId);
  const setOrthoVersion = useHistoryStore((s) => s.setOrthoVersion);
  const activeCount = GROUPS.flatMap((group) => group.rows)
    .filter((row) => layers[row.key]).length;

  // Same catalogue ExportDialog uses, so "5s" here and "5s" in export always
  // mean the same server-side interval instead of two hand-maintained lists
  // drifting apart.
  const [intervals, setIntervals] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    getExportOptions(controller.signal)
      .then((data) => setIntervals(data.intervals || []))
      .catch((err) => { if (err.name !== 'AbortError') setIntervals([]); });
    return () => controller.abort();
  }, []);

  return (
    <div style={{ padding: `${space[2]}px 0` }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: space[2], padding: `${space[1]}px ${space[3]}px ${space[3]}px`,
      }}>
        <div>
          <div style={{ ...text.md, fontWeight: 700, color: C.ink }}>Layer peta</div>
          <div style={{ ...text.xs, color: C.g5 }}>Urutan gambar tetap, visibility dan opacity bisa diatur.</div>
        </div>
        <Chip tone={activeCount > 0 ? 'sel' : 'default'}>{activeCount} aktif</Chip>
      </div>

      {GROUPS.map((group) => (
        <div key={group.key} style={{ marginBottom: space[3] }}>
          <Label style={{ padding: `0 ${space[3]}px ${space[1]}px` }}>{group.label}</Label>

          {group.rows.map((row) => (
            <LayerRow
              key={row.key}
              row={row}
              active={Boolean(layers[row.key])}
              opacity={opacity[row.key] ?? 1}
              onToggle={() => setLayer(row.key, !layers[row.key])}
            >

              {row.opacity && layers[row.key] ? (
                <Slider
                  value={opacity[row.key] ?? 1}
                  onChange={(v) => setLayerOpacity(row.key, v)}
                  style={{ marginTop: 8 }}
                />
              ) : null}

              {/* Ortho version selector. V2 fetched the same list and silently
                  kept only the newest; comparing months is a real need the API
                  already supports. */}
              {row.key === 'orthophoto' && layers.orthophoto && orthoVersions.length > 0 ? (
                <Select
                  value={orthoVersionId ?? orthoVersions[0]?.id ?? ''}
                  onChange={(e) => setOrthoVersion(e.target.value)}
                  style={{ marginTop: 8, height: 28, ...text.sm }}
                >
                  {orthoVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.uploadedAt ? ` · ${String(v.uploadedAt).slice(0, 10)}` : ''}
                    </option>
                  ))}
                </Select>
              ) : null}

              {row.key === 'trace' && layers.trace ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {[
                    { key: 'dots', label: 'Titik' },
                    { key: 'density', label: 'Kepadatan' },
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setTraceMode(mode.key)}
                      style={{
                        flex: 1, height: 22, cursor: 'pointer',
                        border: `1px solid ${traceMode === mode.key ? C.sel : C.line}`,
                        background: traceMode === mode.key ? C.selBg : C.white,
                        color: traceMode === mode.key ? C.sel : C.g6,
                        borderRadius: radius.sm, ...text.sm, fontWeight: 600, fontFamily: font.sans,
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {row.key === 'trace' && layers.trace && intervals?.length > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {intervals.map((opt) => (
                      <button
                        key={opt.seconds}
                        type="button"
                        onClick={() => setTraceInterval(opt.seconds)}
                        title={opt.label}
                        style={{
                          flex: '1 0 auto', height: 22, padding: '0 6px', cursor: 'pointer',
                          border: `1px solid ${traceInterval === opt.seconds ? C.sel : C.line}`,
                          background: traceInterval === opt.seconds ? C.selBg : C.white,
                          color: traceInterval === opt.seconds ? C.sel : C.g6,
                          borderRadius: radius.sm, ...text.sm, fontWeight: 600, fontFamily: font.sans,
                        }}
                      >
                        {opt.seconds === 0 ? 'Auto' : `${opt.seconds}s`}
                      </button>
                    ))}
                  </div>
                  <div style={{ ...text.xs, color: C.g4, marginTop: 2 }}>
                    Interval jejak · tekan Terapkan untuk memuat ulang
                  </div>
                </>
              ) : null}
            </LayerRow>
          ))}
        </div>
      ))}
    </div>
  );
}

function LayerRow({ row, active, opacity, onToggle, children }) {
  const Icon = ICONS[row.key];
  const pct = Math.round(opacity * 100);

  return (
    <div style={{ padding: `4px ${space[3]}px` }}>
      <button
        type="button"
        aria-pressed={active}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '34px minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: space[2],
          minHeight: 58,
          padding: `${space[2]}px ${space[2]}px`,
          border: `1px solid ${active ? C.selLine : C.line}`,
          borderRadius: radius.md,
          background: active ? C.selBg : C.white,
          color: C.ink,
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: active ? '0 0 0 1px rgba(31,122,150,0.08)' : shadow.panel,
          transition: 'background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease',
        }}
      >
        <span style={{
          width: 34, height: 34, borderRadius: radius.sm,
          display: 'grid', placeItems: 'center',
          background: active ? C.sel : C.g1,
          color: active ? C.white : C.g5,
          flexShrink: 0,
        }}>
          <Icon />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', ...text.base, fontWeight: 700, color: active ? C.ink : C.g6 }}>
            {row.label}
          </span>
          <span style={{
            display: 'block', ...text.xs, color: C.g5,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {DESCRIPTIONS[row.key]}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
          <span style={{
            ...text.xs,
            color: active ? C.sel : C.g4,
            fontWeight: 700,
          }}>
            {active ? 'ON' : 'OFF'}
          </span>
          <span style={{
            ...text.xs,
            color: C.g5,
            fontFamily: font.mono,
            minWidth: 34,
            textAlign: 'right',
          }}>
            {pct}%
          </span>
        </span>
      </button>

      {children ? (
        <div style={{
          marginLeft: 44,
          padding: `${space[1]}px 0 ${space[1]}px`,
          opacity: active ? 1 : 0.55,
        }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function LayerSvg({ children }) {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

const layerStroke = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconTrace() {
  return (
    <LayerSvg>
      <path {...layerStroke} d="M4 14c2.5-5.8 5.2 1.8 8-4 1.2-2.5 2.4-3.4 4-3.2" />
      <path {...layerStroke} d="M4 14h.1M10 12h.1M16 6.8h.1" />
    </LayerSvg>
  );
}

function IconBoundary() {
  return (
    <LayerSvg>
      <path {...layerStroke} d="M5 4.5h7.5L16 8v7.5H7.5L4 12V6.5l1-2Z" />
      <path {...layerStroke} d="M7 7.2h5.2v5.2H7z" />
    </LayerSvg>
  );
}

function IconRoad() {
  return (
    <LayerSvg>
      <path {...layerStroke} d="M4 15c1.8-2.4 3.3-3.2 5-2.5 2.4 1 4.7-.5 7-5.5" />
      <path {...layerStroke} d="M3.5 10.5c2.1-1.5 4-1.9 5.8-1.1 1.8.8 3.7.2 5.7-1.9" opacity=".55" />
    </LayerSvg>
  );
}

function IconOrtho() {
  return (
    <LayerSvg>
      <path {...layerStroke} d="M3.5 5.2 8 3.5l4 1.7 4.5-1.7v11.3L12 16.5l-4-1.7-4.5 1.7V5.2Z" />
      <path {...layerStroke} d="M8 3.5v11.3M12 5.2v11.3" />
    </LayerSvg>
  );
}
