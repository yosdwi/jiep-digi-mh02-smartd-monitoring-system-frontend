import React, { useState } from 'react';
import { Box } from '@mui/material';
import { T } from './mirTokens';

// Surface monitor peta (port wireframe-operations.html): search · CTA edit · kontrol map
// (Ukur/Layers/Fit/Zoom) · panel Layers · legenda · chips. Tema light SMARTD.
const CtrlBtn = ({ children, title, onClick, active }) => (
  <Box
    component="button"
    title={title}
    onClick={onClick}
    sx={{
      border: 'none', background: active ? T.selBg : T.w, color: active ? T.sel : T.g6,
      borderBottom: `1px solid ${T.g2}`, width: 38, height: 34, fontSize: 15, cursor: 'pointer',
      '&:last-of-type': { borderBottom: 'none' }, '&:hover': { background: active ? T.selBg : T.g0 },
    }}
  >
    {children}
  </Box>
);

const Lyr = ({ checked, onChange, type = 'checkbox', name, children }) => (
  <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6, fontSize: 12, color: T.g6, cursor: 'pointer' }}>
    <input type={type} name={name} checked={checked} onChange={onChange} style={{ accentColor: T.g6 }} />
    {children}
  </Box>
);

export default function MirMapOverlays({
  layers, onToggleLayer, basemap, onBasemap, measure, onToggleMeasure,
  onZoomIn, onZoomOut, onFit, counts, onEditGeofence,
}) {
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <>
      {/* CTA ubah geofence (kanan-atas) */}
      <Box
        component="button"
        onClick={onEditGeofence}
        sx={{
          position: 'absolute', top: 16, right: 16, zIndex: 10, border: `1px solid ${T.ink}`, background: T.w,
          borderRadius: '4px', px: 1.6, py: 1, color: T.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,.1)',
        }}
      >
        ✎ Ubah geofence
      </Box>

      {/* chips ringkas (kiri-bawah) — ringkasan armada hidup */}
      <Box sx={{ position: 'absolute', left: 16, bottom: 16, zIndex: 10, display: 'flex', gap: 0.9, flexWrap: 'wrap', maxWidth: 'calc(100% - 90px)' }}>
        {[
          { t: `Cabin ${counts.cabin}` },
          counts.rover != null && { t: `Rover ${counts.rover}` },
          counts.crossing > 0 && { t: `⚠ Area crossing ${counts.crossing}`, dot: T.crit, strong: true },
          counts.dumping > 0 && { t: `Area dumping ${counts.dumping}`, dot: T.warn },
        ].filter(Boolean).map((c) => (
          <Box key={c.t} sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.6,
            background: c.strong ? T.crit : T.w, border: `1px solid ${c.strong ? T.crit : T.g3}`, borderRadius: '14px',
            px: 1.4, py: 0.6, fontSize: 11, color: c.strong ? T.w : T.g6, fontFamily: T.mono, fontWeight: c.strong ? 600 : 400,
          }}>
            {c.dot && !c.strong && <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: c.dot }} />}
            {c.t}
          </Box>
        ))}
      </Box>

      {/* legenda (kiri-bawah, di atas chips; expand saat hover) */}
      <Box sx={{ position: 'absolute', left: 16, bottom: 56, zIndex: 10, '&:hover .lgkey': { display: 'block' } }}>
        <Box sx={{ background: T.w, border: `1px solid ${T.g3}`, borderRadius: '14px', px: 1.4, py: 0.6, fontFamily: T.mono, fontSize: 10, color: T.g6, boxShadow: '0 1px 4px rgba(0,0,0,.1)', cursor: 'default' }}>
          ⓘ Tanda peta
        </Box>
        <Box
          className="lgkey"
          sx={{
            display: 'none', position: 'absolute', left: 0, bottom: 'calc(100% + 6px)', background: T.w,
            border: `1px solid ${T.g3}`, borderRadius: '5px', p: '8px 11px', boxShadow: '0 2px 10px rgba(0,0,0,.14)',
            lineHeight: 1.95, whiteSpace: 'nowrap', fontSize: 11, color: T.ink,
          }}
        >
          <Box sx={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.6px', color: T.g5 }}>Jenis penanda</Box>
          <div><b style={{ color: T.ok }}>●</b> rover · <b style={{ color: T.sel }}>◉</b> Rover 0 (referensi grup) · <b style={{ color: T.crit }}>▲</b> cabin/alat berat</div>
          <Box sx={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.6px', color: T.g5, mt: 0.7 }}>Kualitas GPS (isi)</Box>
          <div><span style={{ color: T.ok }}>●</span> solid = RTK FIX · <span style={{ color: T.warn }}>○</span> kosong = di bawah FIX</div>
          <Box sx={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.6px', color: T.g5, mt: 0.7 }}>Status zona</Box>
          <div><span style={{ color: T.crit }}>▲</span> area crossing · <span style={{ color: T.warn }}>▲</span> area dumping · <span style={{ color: T.g5 }}>▲</span> di luar zona</div>
          <Box sx={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.6px', color: T.g5, mt: 0.7 }}>Jarak MIR</Box>
          <div><span style={{ color: T.warn }}>—</span> garis unit → garis crossing terdekat · jarak / <b style={{ color: T.g5 }}>FARAWAY</b> di label unit</div>
        </Box>
      </Box>

      {/* kontrol map (kanan-bawah): Ukur · Layers · Fit · Zoom */}
      <Box sx={{ position: 'absolute', right: 16, bottom: 16, zIndex: 11, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
        <Box sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}>
          <CtrlBtn title="Ukur jarak" active={measure} onClick={onToggleMeasure}>📏</CtrlBtn>
        </Box>
        <Box sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}>
          <CtrlBtn title="Layer" active={layersOpen} onClick={() => setLayersOpen((v) => !v)}>≣</CtrlBtn>
        </Box>
        <Box sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}>
          <CtrlBtn title="Paskan tampilan" onClick={onFit}>⤢</CtrlBtn>
        </Box>
        <Box sx={{ border: `1px solid ${T.g3}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}>
          <CtrlBtn title="Perbesar" onClick={onZoomIn}>＋</CtrlBtn>
          <CtrlBtn title="Perkecil" onClick={onZoomOut}>－</CtrlBtn>
        </Box>
      </Box>

      {/* panel Layers (absolute, di kiri kolom kontrol — hindari mispositisi Popover akibat body scale) */}
      {layersOpen && (
        <>
          <Box onClick={() => setLayersOpen(false)} sx={{ position: 'absolute', inset: 0, zIndex: 12 }} />
          <Box sx={{
            position: 'absolute', right: 62, bottom: 16, zIndex: 13, background: T.w, border: `1px solid ${T.g3}`,
            borderRadius: '6px', p: 1.4, minWidth: 190, boxShadow: '0 4px 18px rgba(0,0,0,.18)',
          }}>
            <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, mb: 1 }}>
              Geofence
            </Box>
            <Lyr checked={layers.area} onChange={() => onToggleLayer('area')}>Area dumping</Lyr>
            <Lyr checked={layers.line} onChange={() => onToggleLayer('line')}>Garis crossing (dumping)</Lyr>
            <Lyr checked={layers.warning} onChange={() => onToggleLayer('warning')}>Pita peringatan (W1·W2·W3)</Lyr>
            <Lyr checked={layers.unsafe} onChange={() => onToggleLayer('unsafe')}>Area crossing (unsafe)</Lyr>
            <Lyr checked={layers.rover0} onChange={() => onToggleLayer('rover0')}>Rover 0 (referensi grup)</Lyr>
            <Box sx={{ borderTop: `1px solid ${T.g2}`, my: 1 }} />
            <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, mb: 1 }}>Penanda</Box>
            <Lyr checked={layers.units} onChange={() => onToggleLayer('units')}>Cabin / unit</Lyr>
            <Lyr checked={layers.labels} onChange={() => onToggleLayer('labels')}>Label jarak &amp; status</Lyr>
            <Box sx={{ borderTop: `1px solid ${T.g2}`, my: 1 }} />
            <Lyr type="radio" name="bm" checked={basemap === 'satellite'} onChange={() => onBasemap('satellite')}>Peta dasar: Satelit</Lyr>
            <Lyr type="radio" name="bm" checked={basemap === 'light'} onChange={() => onBasemap('light')}>Terang</Lyr>
          </Box>
        </>
      )}
    </>
  );
}
