import { useCallback } from 'react';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import { Button, Input, Label } from '../foundation/ui';
import { color as C, text, space, font, rgb } from '../foundation/tokens';

// Speed classification editor.
//
// The operator edits BOUNDARIES, not independent min/max pairs: each row's `min`
// is its inclusive lower bound and the next row's `min` is its exclusive upper
// bound. Gaps and overlaps are therefore structurally impossible, which is the
// failure mode a naive two-field-per-row editor invites.
//
// Changing a colour rewrites the RGBA buffers in place (traceRegistry keeps
// buffer identity stable, so deck.gl updates one attribute). Changing a
// threshold rewrites the band index the same way. Neither refetches anything.

const PRESET_COLORS = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#7570b3', '#586473'];

export default function SpeedBandEditor() {
  const bands = useHistoryStore((s) => s.speedBands);
  const setSpeedBands = useHistoryStore((s) => s.setSpeedBands);

  // Recolour every loaded sample from the current bands. Runs over typed arrays
  // in place; no allocation, no refetch, no worker round trip.
  const applyBands = useCallback((next) => {
    setSpeedBands(next);
    const rgbTable = next.map((b) => rgb(b.color));
    registry.listDevices().forEach((device) => {
      device.chunks.forEach((chunk) => {
        // Re-derive the band index: a threshold edit changes which band a sample
        // belongs to, not just its colour.
        for (let i = 0; i < chunk.n; i++) {
          const speed = chunk.speed[i];
          let idx = 0;
          for (let b = 0; b < next.length; b++) {
            if (speed >= next[b].min) idx = b; else break;
          }
          chunk.band[i] = idx;
          const c = rgbTable[idx];
          chunk.color[i * 4] = c[0];
          chunk.color[i * 4 + 1] = c[1];
          chunk.color[i * 4 + 2] = c[2];
        }
      });
    });
    registry.touch();
  }, [setSpeedBands]);

  const update = (index, patch) => {
    const next = bands.map((b, i) => (i === index ? { ...b, ...patch } : b));
    next.sort((a, b) => a.min - b.min);
    applyBands(next);
  };

  const remove = (index) => {
    if (bands.length <= 2) return;
    applyBands(bands.filter((_, i) => i !== index));
  };

  const add = () => {
    const last = bands[bands.length - 1];
    applyBands([...bands, {
      id: `band-${Date.now()}`,
      min: last.min + 10,
      label: 'Baru',
      color: PRESET_COLORS[bands.length % PRESET_COLORS.length],
    }]);
  };

  return (
    <div style={{ padding: space[3], display: 'flex', flexDirection: 'column', gap: space[2] }}>
      <Label>Klasifikasi kecepatan</Label>
      <p style={{ ...text.sm, color: C.g5, margin: 0 }}>
        Batas bawah bersifat inklusif; batas atas otomatis mengikuti baris berikutnya,
        sehingga tidak mungkin ada celah antar kelas.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {bands.map((band, index) => {
          const next = bands[index + 1];
          return (
            <div
              key={band.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: 6, border: `1px solid ${C.line}`, borderRadius: 4, background: C.g0,
              }}
            >
              <input
                type="color"
                value={band.color}
                onChange={(e) => update(index, { color: e.target.value })}
                aria-label={`Warna ${band.label}`}
                style={{
                  width: 22, height: 22, padding: 0, border: `1px solid ${C.line}`,
                  borderRadius: 3, background: 'none', cursor: 'pointer', flexShrink: 0,
                }}
              />

              <Input
                value={band.label}
                onChange={(e) => update(index, { label: e.target.value })}
                aria-label="Nama kelas"
                style={{ flex: 1, minWidth: 0, height: 24, ...text.sm }}
              />

              <Input
                type="number"
                min={0}
                value={band.min}
                onChange={(e) => update(index, { min: Number(e.target.value) })}
                aria-label="Batas bawah km/jam"
                style={{ width: 52, height: 24, ...text.sm, fontFamily: font.mono }}
              />

              <span style={{ ...text.xs, color: C.g4, fontFamily: font.mono, width: 46 }}>
                {next ? `–${next.min - 1}` : '– ∞'}
              </span>

              <button
                type="button"
                onClick={() => remove(index)}
                disabled={bands.length <= 2}
                aria-label={`Hapus ${band.label}`}
                style={{
                  border: 'none', background: 'transparent', cursor: bands.length <= 2 ? 'not-allowed' : 'pointer',
                  color: bands.length <= 2 ? C.g3 : C.g5, fontSize: 13, padding: 2,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" onClick={add}>+ Tambah kelas</Button>
        <Button
          size="sm"
          onClick={() => applyBands(useHistoryStore.getState().speedBands.slice().sort((a, b) => a.min - b.min))}
        >
          Terapkan ulang
        </Button>
      </div>

      <p style={{ ...text.xs, color: C.g4, margin: `${space[2]}px 0 0` }}>
        Nilai awal mengikuti klasifikasi yang sudah dipakai sistem sebelumnya, sehingga
        arti operasionalnya tidak berubah.
      </p>
    </div>
  );
}
