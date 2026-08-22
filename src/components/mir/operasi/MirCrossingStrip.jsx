import React from 'react';
import { Box } from '@mui/material';
import { T } from './mirTokens';
import useMirAlertStore from '../../../stores/mirAlertStore';

// Strip alarm crossing (mockup .xstrip) — muncul HANYA saat ada crossing aktif.
export default function MirCrossingStrip({ onSelectAlert }) {
  const alerts = useMirAlertStore((s) => s.alerts);
  const crossing = alerts.filter((a) => a.type === 'CROSSING' && a.status === 'NEW');
  if (crossing.length === 0) return null;

  const first = crossing[0];
  const more = crossing.length - 1;

  return (
    <Box
      sx={{
        flex: '0 0 36px', height: 36, display: 'flex', alignItems: 'center', gap: 1.4, px: 1.75,
        background: T.crit, color: '#fff', fontSize: 12,
      }}
    >
      <Box sx={{ width: 5, height: 16, background: '#fff' }} />
      <b style={{ letterSpacing: '.6px' }}>CROSSING</b>
      <span>
        <span style={{ fontFamily: T.mono, fontWeight: 700 }}>{first.unit}</span> melintas unsafe · {first.peak} · {first.tsLabel}
      </span>
      {more > 0 && <span style={{ fontFamily: T.mono, opacity: 0.65, fontSize: 11 }}>+{more} lagi</span>}
      <Box
        component="button"
        onClick={() => onSelectAlert?.(first.id)}
        sx={{
          ml: 'auto', border: '1px solid #fff', background: 'none', color: '#fff', borderRadius: '4px',
          px: 1.4, py: 0.5, fontSize: 11, fontFamily: T.mono, cursor: 'pointer',
        }}
      >
        lihat lintasan ›
      </Box>
    </Box>
  );
}
