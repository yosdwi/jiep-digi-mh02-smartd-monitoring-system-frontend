import React from 'react';
import { Box } from '@mui/material';
import { T } from '../operasi/mirTokens';

// Bits UI bersama layar Perangkat/Firmware + Device Workspace (port wireframe-devices/firmware).

// Pill status (mockup .pill / .pill.solid / .pill.dash).
export function Pill({ children, solid, dash, sx }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block', borderRadius: '10px', px: 0.9, py: '1px', fontSize: 10,
        textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap',
        border: `1px solid ${solid ? T.ink : T.g4}`, borderStyle: dash ? 'dashed' : 'solid',
        background: solid ? T.ink : T.w, color: solid ? T.w : T.g6, ...sx,
      }}
    >
      {children}
    </Box>
  );
}

// Titik status layanan (mockup .svc-dots). state: 'ok'=outline · 'stale'=dashed · 'dead'=filled.
export function ServiceDots({ services }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {(services || []).map((s, i) => (
        <Box
          key={`${s.name}-${i}`}
          title={`${s.name}: ${s.state}`}
          sx={{
            width: 9, height: 9, borderRadius: '50%',
            border: `1.5px ${s.state === 'stale' ? 'dashed' : 'solid'} ${T.g6}`,
            background: s.state === 'dead' ? T.g6 : 'transparent',
          }}
        />
      ))}
    </Box>
  );
}

// Strip ringkasan angka (mockup .summary / .statline).
export function SummaryStrip({ items, big = 20 }) {
  return (
    <Box sx={{ display: 'flex', borderBottom: `1px solid ${T.line}` }}>
      {items.map((it) => (
        <Box key={it.l} sx={{ flex: 1, p: '10px 14px', borderRight: `1px solid ${T.g1}`, '&:last-of-type': { borderRight: 'none' } }}>
          <Box sx={{ fontFamily: T.mono, fontSize: big, fontWeight: 700, color: T.ink }}>{it.n}</Box>
          <Box sx={{ fontSize: 11, color: T.g5, textTransform: 'uppercase', letterSpacing: '.5px' }}>{it.l}</Box>
        </Box>
      ))}
    </Box>
  );
}

// Chip filter (mockup .chip / .chip.on).
export function FilterChips({ chips, value, onChange }) {
  return (
    <>
      {chips.map((c) => {
        const on = c.key === value;
        return (
          <Box
            key={c.key}
            onClick={() => onChange(c.key)}
            sx={{
              border: `1px solid ${on ? T.ink : T.g3}`, borderRadius: '14px', px: 1.4, py: 0.5, fontSize: 11, cursor: 'pointer',
              background: on ? T.ink : T.w, color: on ? T.w : T.g6, whiteSpace: 'nowrap',
            }}
          >
            {c.label}
          </Box>
        );
      })}
    </>
  );
}

// State badge rollout firmware (mockup .state .done/.prog/.fail).
export function FwStateBadge({ state, label }) {
  const filled = state === 'done';
  const fail = state === 'fail';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.9, fontFamily: T.mono, fontSize: 11, color: fail ? T.crit : T.g6 }}>
      <Box sx={{
        width: 9, height: 9, borderRadius: fail ? '1px' : '50%',
        border: `1.5px ${state === 'prog' ? 'dashed' : 'solid'} ${fail ? T.crit : T.g6}`,
        background: filled ? T.g6 : fail ? T.crit : 'transparent',
      }} />
      {label}
    </Box>
  );
}

// Progress bar tipis (mockup .bar).
export function MiniBar({ pct }) {
  return (
    <Box sx={{ width: 120, height: 6, border: `1px solid ${T.g3}`, borderRadius: '3px', overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle' }}>
      <Box sx={{ height: '100%', width: `${Math.max(0, Math.min(100, pct || 0))}%`, background: T.g5 }} />
    </Box>
  );
}

// Status koneksi data: loading / kosong / error (anti-dummy: jelas saat backend belum siap).
export function DataState({ loading, error, empty, emptyText = 'Belum ada data.', children }) {
  if (loading) return <Box sx={{ p: 3, fontSize: 12, color: T.g5, textAlign: 'center' }}>Memuat…</Box>;
  if (error) return <Box sx={{ p: 3, fontSize: 12, color: T.crit, textAlign: 'center', fontFamily: T.mono }}>Gagal memuat: {String(error)}</Box>;
  if (empty) return <Box sx={{ p: 3, fontSize: 12, color: T.g5, textAlign: 'center' }}>{emptyText}</Box>;
  return children;
}
