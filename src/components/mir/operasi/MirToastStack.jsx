import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { T } from './mirTokens';
import useMirAlertStore from '../../../stores/mirAlertStore';

// Toast stack (mockup .toasts) — maks 3, terbaru di atas.
// CROSSING = kartu (klik → detail+validasi) · WARNING = bar ramping (pemberitahuan, tanpa detail).
function CloseX({ onClick }) {
  return (
    <Box
      component="span"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      sx={{ position: 'absolute', top: 6, right: 8, color: T.g4, fontSize: 12, cursor: 'pointer' }}
    >
      ✕
    </Box>
  );
}

export default function MirToastStack({ onSelectAlert }) {
  const alerts = useMirAlertStore((s) => s.alerts);
  const dismissedToastIds = useMirAlertStore((s) => s.dismissedToastIds);
  const viewedIds = useMirAlertStore((s) => s.viewedIds);
  const dismissToast = useMirAlertStore((s) => s.dismissToast);

  const toastAlerts = useMemo(
    () => alerts.filter((a) => !a.viewed && !viewedIds.includes(a.id) && !dismissedToastIds.includes(a.id)).slice(0, 3),
    [alerts, viewedIds, dismissedToastIds]
  );

  if (toastAlerts.length === 0) return null;

  return (
    <Box sx={{ position: 'absolute', top: 60, right: 16, zIndex: 14, display: 'flex', flexDirection: 'column', gap: 1, width: 250 }}>
      {toastAlerts.map((a) =>
        a.type === 'CROSSING' ? (
          <Box
            key={a.id}
            onClick={() => onSelectAlert?.(a.id)}
            sx={{
              position: 'relative', background: T.w, border: `1px solid ${T.g3}`, borderLeft: `5px solid ${T.crit}`,
              borderRadius: '5px', boxShadow: '0 3px 12px rgba(0,0,0,.16)', p: '9px 28px 9px 11px', cursor: 'pointer',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 10, fontWeight: 700, letterSpacing: '.5px', color: T.crit }}>
              <Box sx={{ width: 4, height: 11, background: 'currentColor' }} /> CROSSING
            </Box>
            <Box sx={{ fontFamily: T.mono, fontWeight: 700, fontSize: 13, mt: '3px', color: T.ink }}>{a.unit}</Box>
            <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5, mt: '2px' }}>{a.tsLabel} · ketuk untuk detail</Box>
            <CloseX onClick={() => dismissToast(a.id)} />
          </Box>
        ) : (
          <Box
            key={a.id}
            onClick={() => onSelectAlert?.(a.id)}
            sx={{
              position: 'relative', background: T.w, border: `1px solid ${T.g3}`, borderLeft: `3px solid ${T.warn}`,
              borderRadius: '5px', boxShadow: '0 3px 12px rgba(0,0,0,.16)', p: '8px 26px 8px 11px', cursor: 'pointer',
            }}
          >
            <Box sx={{ fontFamily: T.mono, fontSize: 11.5, color: T.ink, display: 'flex', gap: 0.9, alignItems: 'baseline', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span style={{ fontWeight: 700 }}>▲ {a.unit}</span>
              <span style={{ color: T.g6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                dalam zona · {a.peak.replace(' (band)', '')}
              </span>
            </Box>
            <CloseX onClick={() => dismissToast(a.id)} />
          </Box>
        )
      )}
    </Box>
  );
}
