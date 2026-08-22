import React from 'react';
import { Box } from '@mui/material';
import { T, rtkLabel, zoneStatus, statusColor, zoneLabel } from './mirTokens';
import useMirAlertStore from '../../../stores/mirAlertStore';
import MirTrace from './MirTrace';

// Slide-over detail (mockup .detail) — dipicu klik alert/marker/baris.
// CROSSING → blok alert (lintasan pre/on + validasi VALID/FALSE).
// WARNING → cukup telemetri unit (pemberitahuan, tanpa validasi) — D6.
const KV = ({ k, v }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.9, borderBottom: `1px solid ${T.g1}`, fontSize: 12 }}>
    <Box sx={{ color: T.g5 }}>{k}</Box>
    <Box sx={{ fontFamily: T.mono, color: T.ink, textAlign: 'right' }}>{v}</Box>
  </Box>
);

const VCHIPS = ['VALID', 'FALSE'];

export default function MirAlertDetail({ unit, onClose, onCenter }) {
  const selectedId = useMirAlertStore((s) => s.selectedId);
  const alert = useMirAlertStore((s) => s.selected);
  const loading = useMirAlertStore((s) => s.loadingDetail);
  const validate = useMirAlertStore((s) => s.validate);

  const open = Boolean(selectedId);
  const isCrossing = alert?.type === 'CROSSING';

  // telemetri unit (real, dari MQTT) — fallback ke field alert
  const fix = unit?.fix_quality ?? unit?.rtkfix ?? unit?.FixQuality;
  const dist = unit?.mir_distance ?? alert?.distance;
  const status = unit ? zoneStatus({ mirDistance: unit.mir_distance, mirInArea: unit.mir_in_area, mirUnsafe: unit.mir_unsafe }) : null;
  const lat = unit?.latitude ?? alert?.lat;
  const lon = unit?.longitude ?? alert?.lon;
  const title = alert?.unit || unit?.unitNo || unit?.deviceId || '—';
  const stale = unit?.timestamp ? Date.now() - unit.timestamp > 5 * 60 * 1000 : false;

  return (
    // Slide-over menutupi sidebar kiri (mockup .detail: inset 0, geser dari kiri) — bukan panel kanan.
    <Box
      sx={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', flexDirection: 'column', fontFamily: T.ff,
        background: T.w, borderRight: `1px solid ${T.line}`, boxShadow: '2px 0 12px rgba(0,0,0,.08)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .18s ease', pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 1.1 }}>
        <Box
          component="button"
          onClick={onClose}
          sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.1, py: 0.5, color: T.g6, cursor: 'pointer' }}
        >
          ‹
        </Box>
        <Box sx={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{title}</Box>
      </Box>

      <Box sx={{ p: 1.75, overflowY: 'auto', flex: 1 }}>
        {/* blok alert (crossing) */}
        {isCrossing && (
          <Box sx={{ mb: 1.75, border: `1px solid ${T.g3}`, borderRadius: '5px', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, px: 1.4, py: 1.1, background: T.crit, color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '.4px' }}>
              <Box sx={{ width: 4, height: 13, background: 'currentColor' }} />
              CROSSING · <span style={{ fontFamily: T.mono }}>{alert.tsLabel}</span>
            </Box>
            <Box sx={{ p: 1.4 }}>
              <MirTrace />
              <KV k="Puncak (peak)" v={alert.peak} />
              <KV k="Durasi" v={alert.dur} />
              <KV k="Kecepatan maks" v={alert.spd} />
              <Box sx={{ mt: 1.5 }}>
                <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, mb: 0.9 }}>Validasi (NOC)</Box>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  {VCHIPS.map((st) => {
                    const on = alert.status === st;
                    return (
                      <Box
                        key={st}
                        component="button"
                        disabled={loading}
                        onClick={() => validate(alert.id, st)}
                        sx={{
                          flex: 1, borderRadius: '4px', py: 0.9, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${on ? T.sel : T.g3}`,
                          background: on ? T.sel : T.w,
                          color: on ? '#fff' : T.g6,
                        }}
                      >
                        {st}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* telemetri unit */}
        <KV k="Tipe" v={unit?.deviceType || alert?.deviceId || '—'} />
        <KV k="Status RTK" v={rtkLabel(fix)} />
        <KV k="Satelit" v={unit?.gpsnumsat ?? unit?.NumSat ?? '—'} />
        <KV k="Jarak ke zona (MIR)" v={dist != null ? `${Number(dist).toFixed(1)} m` : '—'} />
        <KV
          k="Status zona"
          v={
            <span style={{ color: status ? statusColor(status) : T.ink }}>
              {status ? zoneLabel(status) : '—'}{stale && status ? ' (data usang)' : ''}
            </span>
          }
        />
        <KV k="Koordinat" v={lat != null && lon != null ? `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}` : '—'} />
        <KV k="Diperbarui" v={unit?.timestamp ? `${Math.max(0, Math.round((Date.now() - unit.timestamp) / 1000))} dtk lalu` : '—'} />

        <Box sx={{ display: 'flex', gap: 1, mt: 1.75, flexWrap: 'wrap' }}>
          <Box
            component="button"
            onClick={() => onCenter?.({ lat, lon })}
            sx={{ border: `1px solid ${T.ink}`, background: T.ink, color: '#fff', borderRadius: '4px', px: 1.5, py: 1, fontSize: 12, cursor: 'pointer' }}
          >
            ⌖ Pusatkan di peta
          </Box>
          {/* navigasi layar lain / aksi backend — ditampilkan disabled (layar Perangkat & resync = di luar slice Operasi) */}
          <Box
            component="button"
            disabled
            title="Layar Perangkat (Config/Logs) — belum tersedia"
            sx={{ border: `1px solid ${T.g3}`, background: T.w, color: T.g4, borderRadius: '4px', px: 1.5, py: 1, fontSize: 12, cursor: 'not-allowed' }}
          >
            ↗ Buka device
          </Box>
          <Box
            component="button"
            disabled
            title="Sinkron ulang — butuh endpoint backend"
            sx={{ border: `1px solid ${T.g3}`, background: T.w, color: T.g4, borderRadius: '4px', px: 1.5, py: 1, fontSize: 12, cursor: 'not-allowed' }}
          >
            ⟳ Sinkron ulang
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
