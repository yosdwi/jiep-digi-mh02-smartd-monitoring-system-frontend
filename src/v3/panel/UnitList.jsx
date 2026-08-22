import { useSyncExternalStore, useMemo } from 'react';
import * as registry from '../state/traceRegistry';
import useHistoryStore from '../state/historyStore';
import { Button, Empty } from '../foundation/ui';
import { color as C, text, space, font, UNIT_RAMP } from '../foundation/tokens';

// Loaded units, with the colour swatch that identifies them on the map.
//
// This is the third selection affordance (alongside the context-bar picker and
// the map lasso) and the one that answers "what did I actually get?" — a unit
// that was requested but returned no samples is visible here and nowhere else.

const WITA_OFFSET_MS = 8 * 3600 * 1000;
const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');

function witaTime(ms) {
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms + WITA_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export default function UnitList({ onFocusDevice }) {
  const version = useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);
  const selectedIds = useHistoryStore((s) => s.selection.deviceIds);
  const toggleSelection = useHistoryStore((s) => s.toggleSelection);
  const setSelection = useHistoryStore((s) => s.setSelection);
  const clearSelection = useHistoryStore((s) => s.clearSelection);
  const setPlayback = useHistoryStore((s) => s.setPlayback);

  const devices = useMemo(
    () => registry.listDevices().sort((a, b) => String(a.unitNo).localeCompare(String(b.unitNo))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  if (devices.length === 0) {
    return <Empty title="Belum ada jejak" hint="Pilih unit dan rentang waktu di atas, lalu tekan Terapkan." icon="◍" />;
  }

  const selected = new Set(selectedIds);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `${space[2]}px ${space[3]}px`, borderBottom: `1px solid ${C.line}`,
        position: 'sticky', top: 0, background: C.white, zIndex: 1,
      }}>
        <span style={{ ...text.sm, color: C.g5 }}>
          {devices.length} unit · {selectedIds.length} dipilih
        </span>
        <div style={{ flex: 1 }} />
        <Button size="sm" onClick={() => setSelection(devices.map((d) => d.deviceId))}>Semua</Button>
        <Button size="sm" onClick={clearSelection} disabled={selectedIds.length === 0}>Bersihkan</Button>
      </div>

      {devices.map((device) => {
        const isSelected = selected.has(device.deviceId);
        return (
          <div
            key={device.deviceId}
            onClick={() => toggleSelection(device.deviceId)}
            onDoubleClick={() => onFocusDevice?.(device)}
            style={{
              display: 'flex', alignItems: 'center', gap: space[2],
              padding: `6px ${space[3]}px`,
              borderBottom: `1px solid ${C.g1}`,
              cursor: 'pointer',
              background: isSelected ? C.selBg : 'transparent',
              borderLeft: `3px solid ${isSelected ? C.sel : 'transparent'}`,
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: 2, flexShrink: 0,
              background: UNIT_RAMP[device.colorIndex % UNIT_RAMP.length],
            }} />
            <span style={{
              ...text.base, fontWeight: 600, color: C.ink,
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {device.unitNo}
            </span>
            <span style={{ ...text.sm, color: C.g5, fontFamily: font.mono }}>
              {witaTime(device.minMs)}–{witaTime(device.maxMs)}
            </span>
            <span style={{ ...text.sm, color: C.g4, fontFamily: font.mono, width: 52, textAlign: 'right' }}>
              {fmtInt(device.n)}
            </span>
          </div>
        );
      })}

      <div style={{ padding: space[3] }}>
        <Button
          variant="primary"
          disabled={selectedIds.length === 0}
          onClick={() => setPlayback({ active: true, playing: true })}
          style={{ width: '100%' }}
        >
          ▶ Putar {selectedIds.length || ''} unit terpilih
        </Button>
        {selectedIds.length === 0 ? (
          <div style={{ ...text.sm, color: C.g4, marginTop: 6, textAlign: 'center' }}>
            Pilih unit dulu — playback hanya untuk subset, bukan seluruh armada.
          </div>
        ) : null}
      </div>
    </div>
  );
}
