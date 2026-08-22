import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { T } from './mirTokens';

// Panel kiri EDIT (mockup .edit-side): manajemen grup geofence + authoring per-grup + ambang global.
// Grup = DINAMIS (registry backend, lihat MIRPeta `groupCfg`). line_rovers & rover_0 = PER-GRUP
// (config.json geofence-core). Ambang = settings (global).

const Feat = ({ children, hint, sx }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '7px 12px 7px 24px', fontSize: 12, color: T.g6, borderBottom: `1px solid ${T.g1}`, ...sx }}>
    {children}
    {hint && <Box sx={{ ml: 'auto', fontFamily: T.mono, fontSize: 10, color: T.g5 }}>{hint}</Box>}
  </Box>
);

const ThrRow = ({ label, value, onChange, w = 64 }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, fontSize: 12, color: T.g6 }}>
    {label}
    <Box component="input" value={value} onChange={(e) => onChange(e.target.value)}
      sx={{ width: w, border: `1px solid ${T.g3}`, borderRadius: '3px', px: 0.75, py: 0.5, fontFamily: T.mono, fontSize: 12, textAlign: 'right' }} />
  </Box>
);

// Pill meta kecil (jumlah rover, status R0) — bentuk dulu, warna penguat.
const Pill = ({ children, tone = 'g5' }) => (
  <Box sx={{
    fontFamily: T.mono, fontSize: 9.5, lineHeight: 1.6, px: 0.6, borderRadius: '3px',
    color: tone === 'ok' ? T.ok : T.g5, background: tone === 'ok' ? `${T.ok}1a` : T.g1, whiteSpace: 'nowrap',
  }}>{children}</Box>
);

export default function MirEditPanel({
  groups, groupCfg = [], group, onGroup, onAddGroup, onDeleteGroup, saving,
  lineRovers, onToggleRover, rover0Set, thresholds, onThreshold,
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const metaOf = (g) => groupCfg.find((x) => x.group === g) || null;
  // Meta baris: grup aktif pakai state edit (live), grup lain pakai registry.
  const membersOf = (g) => (g === group ? lineRovers.length : (metaOf(g)?.line_rovers?.length || 0));
  const hasR0Of = (g) => (g === group ? rover0Set : Boolean(metaOf(g)?.rover_0));

  const submitAdd = () => {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    Promise.resolve(onAddGroup?.(name)).then((ok) => {
      if (ok !== false) { setNewName(''); setAdding(false); }
    });
  };
  const cancelAdd = () => { setNewName(''); setAdding(false); };

  // Anggota perimeter: 1..4 default, di-union dgn line_rovers grup ini supaya rover >R4 tetap tampil.
  const roverNums = [...new Set([1, 2, 3, 4, ...lineRovers.map(Number)])].filter((n) => n > 0).sort((a, b) => a - b);

  return (
    <Box sx={{ width: 300, flex: '0 0 300px', borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', background: T.w, minHeight: 0 }}>
      {/* ── Manajemen grup ── */}
      <Box sx={{ p: '10px 12px 8px', borderBottom: `1px solid ${T.line}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5 }}>Geofence per grup</Box>
          {!adding && (
            <Box component="button" type="button" onClick={() => setAdding(true)} disabled={saving}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.4, border: `1px solid ${T.sel}`, color: T.sel,
                background: T.w, borderRadius: '4px', px: 0.85, py: 0.35, fontSize: 11, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
                '&:hover': { background: T.selBg },
              }}>+ Grup</Box>
          )}
        </Box>

        {/* Form tambah grup inline (bukan window.prompt) */}
        {adding && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Box component="input" ref={inputRef} value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') cancelAdd(); }}
              placeholder="Nama grup (mis. C)"
              sx={{ flex: 1, minWidth: 0, border: `1px solid ${T.sel}`, borderRadius: '4px', px: 0.85, py: 0.5, fontSize: 12, outline: 'none' }} />
            <Box component="button" type="button" onClick={submitAdd} title="Tambah"
              sx={{ border: 'none', background: T.sel, color: T.w, borderRadius: '4px', px: 0.85, py: 0.5, fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>✓</Box>
            <Box component="button" type="button" onClick={cancelAdd} title="Batal"
              sx={{ border: `1px solid ${T.g3}`, background: T.w, color: T.g6, borderRadius: '4px', px: 0.85, py: 0.5, fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>✕</Box>
          </Box>
        )}

        {/* Daftar grup — baris terpilih = sedang diedit */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 168, overflowY: 'auto' }}>
          {groups.length === 0 && !adding && (
            <Box sx={{ fontSize: 11, color: T.g5, fontStyle: 'italic', py: 1, textAlign: 'center' }}>
              Belum ada grup — klik <b>+ Grup</b> untuk menambah.
            </Box>
          )}
          {groups.map((g) => {
            const active = g === group;
            const pending = metaOf(g)?.pending;
            return (
              <Box key={g} onClick={() => !active && onGroup(g)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, p: '6px 8px', borderRadius: '6px', cursor: active ? 'default' : 'pointer',
                  border: `1px solid ${active ? T.sel : T.g2}`, background: active ? T.selBg : T.w,
                  '&:hover': { borderColor: active ? T.sel : T.g3, background: active ? T.selBg : T.g0 },
                }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', border: `2px solid ${active ? T.sel : T.g4}`, background: active ? T.sel : 'transparent' }} />
                <Box sx={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? T.sel : T.ink }}>Grup {g}</Box>
                {pending && <Box sx={{ fontSize: 9, color: T.warn, fontStyle: 'italic' }}>baru</Box>}
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Pill>{membersOf(g)}R</Pill>
                  <Pill tone={hasR0Of(g) ? 'ok' : 'g5'}>{hasR0Of(g) ? '◉ R0' : 'tanpa R0'}</Pill>
                  {active && (
                    <Box component="button" type="button" disabled={saving}
                      onClick={(e) => { e.stopPropagation(); if (window.confirm(`Hapus grup ${g}? Polygon & konfigurasinya akan dibuang.`)) onDeleteGroup?.(g); }}
                      title="Hapus grup"
                      sx={{ border: 'none', background: 'transparent', color: T.crit, fontSize: 13, lineHeight: 1, cursor: saving ? 'not-allowed' : 'pointer', p: 0.25, opacity: saving ? 0.4 : 1, '&:hover': { opacity: 0.7 } }}>🗑</Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Editor grup aktif ── */}
      {group ? (
        <Box sx={{ flex: 1, overflowY: 'auto', py: 0.75 }}>
          <Box sx={{ p: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, background: T.g0, borderBottom: `1px solid ${T.g1}` }}>
            Sedang diedit: <b style={{ color: T.ink }}>Grup {group}</b>
          </Box>
          <Feat hint={rover0Set ? 'tersimpan · geser di peta' : 'pakai ◉ Taruh R0'}>◉ Rover 0</Feat>
          <Box sx={{ p: '7px 12px 7px 24px', fontSize: 12, color: T.g6, borderBottom: `1px solid ${T.g1}`, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5 }}>Line rovers (anggota perimeter grup ini):</Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {roverNums.map((n) => (
                <Box key={n} component="label" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={lineRovers.includes(String(n))} onChange={() => onToggleRover(String(n))} /> R{n}
                </Box>
              ))}
            </Box>
          </Box>
          <Feat hint={metaOf(group)?.has_polygon ? 'ada' : 'belum'}><input type="checkbox" defaultChecked /> ▦ Polygon</Feat>
          <Feat><input type="checkbox" defaultChecked /> ▦ Zona bahaya</Feat>
          <Feat><input type="checkbox" defaultChecked /> — Garis dumping</Feat>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, fontSize: 12, color: T.g5, textAlign: 'center' }}>
          Pilih atau tambah grup untuk mulai mengedit geofence.
        </Box>
      )}

      <Box id="mir-ambang-panel" sx={{ p: 1.5, borderTop: `1px solid ${T.line}`, transition: 'background .4s', '&.flash': { background: T.selBg } }}>
        <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, mb: 1 }}>Ambang (global — berlaku semua grup)</Box>
        <ThrRow label="Area dumping (m)" value={thresholds.area} onChange={(v) => onThreshold('area', v)} />
        <ThrRow label="Zona bahaya (m)" value={thresholds.unsafe} onChange={(v) => onThreshold('unsafe', v)} />
        <ThrRow label="Perubahan garis (m)" value={thresholds.lineDelta} onChange={(v) => onThreshold('lineDelta', v)} />
        <ThrRow label="Peringatan garis" value={thresholds.warnBands} onChange={(v) => onThreshold('warnBands', v)} w={84} />
      </Box>
    </Box>
  );
}
