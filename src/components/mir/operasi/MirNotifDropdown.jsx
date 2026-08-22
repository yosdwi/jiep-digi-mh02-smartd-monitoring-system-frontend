import React from 'react';
import { Box } from '@mui/material';
import { T } from './mirTokens';
import useMirAlertStore from '../../../stores/mirAlertStore';

// Notif dropdown (mockup .notif-pop): gabung Crossing/Warning, read-flag (viewed) + tag status.
// CROSSING bawa tag status validasi · WARNING cuma pemberitahuan (tanpa tag).
function NotifRow({ a, onSelect }) {
  const isC = a.type === 'CROSSING';
  const ic = isC ? '▮' : '▲';
  const sub = isC ? `melintas unsafe · peak ${a.peak}` : `dalam zona · ${a.peak.replace(' (band)', '')}`;
  return (
    <Box
      onClick={() => onSelect(a.id)}
      sx={{
        display: 'grid', gridTemplateColumns: '12px 1fr auto', gap: 1.1, alignItems: 'start',
        px: 1.6, py: 1.25, borderBottom: `1px solid ${T.g1}`, cursor: 'pointer',
        '&:hover': { background: T.g0 },
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', mt: '3px', background: a.viewed ? T.w : T.ink, border: a.viewed ? `1px solid ${T.g3}` : 'none' }} />
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ fontWeight: a.viewed ? 400 : 700, fontSize: 13, color: isC ? T.crit : a.viewed ? T.g6 : T.ink }}>
          {ic} {a.unit}
        </Box>
        <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5, mt: '2px' }}>{sub}</Box>
        {isC && (
          <Box
            component="span"
            sx={{
              display: 'inline-block', mt: 0.5, px: 0.65, fontSize: 9, letterSpacing: '.5px', textTransform: 'uppercase',
              borderRadius: '3px',
              border: `1px solid ${a.status !== 'NEW' ? T.crit : T.g4}`,
              background: a.status !== 'NEW' ? T.crit : 'transparent',
              color: a.status !== 'NEW' ? '#fff' : T.g6,
            }}
          >
            {a.status}
          </Box>
        )}
      </Box>
      <Box sx={{ textAlign: 'right', fontFamily: T.mono, fontSize: 10, color: T.g5, whiteSpace: 'nowrap' }}>{a.tsLabel}</Box>
    </Box>
  );
}

export default function MirNotifDropdown({ onSelect }) {
  const alerts = useMirAlertStore((s) => s.alerts);
  const markAllViewed = useMirAlertStore((s) => s.markAllViewed);

  const crossing = alerts.filter((a) => a.type === 'CROSSING');
  const warning = alerts.filter((a) => a.type === 'WARNING');

  const Section = ({ title, arr }) =>
    arr.length === 0 ? null : (
      <>
        <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5, px: 1.6, pt: 1, pb: 0.5, background: T.g0 }}>
          {title} ({arr.length})
        </Box>
        {arr.map((a) => (
          <NotifRow key={a.id} a={a} onSelect={onSelect} />
        ))}
      </>
    );

  return (
    <Box sx={{ background: T.w, fontFamily: T.ff }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.6, py: 1.4, borderBottom: `1px solid ${T.line}` }}>
        <Box sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5 }}>Peringatan</Box>
        <Box
          component="button"
          onClick={markAllViewed}
          sx={{ ml: 'auto', border: 'none', background: 'none', color: T.sel, fontSize: 11, fontFamily: T.mono, cursor: 'pointer' }}
        >
          tandai semua dibaca
        </Box>
      </Box>
      <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
        {alerts.length === 0 ? (
          <Box sx={{ p: 2, fontSize: 12, color: T.g5, textAlign: 'center' }}>Tidak ada peringatan.</Box>
        ) : (
          <>
            <Section title="Crossing" arr={crossing} />
            <Section title="Warning" arr={warning} />
          </>
        )}
      </Box>
    </Box>
  );
}
