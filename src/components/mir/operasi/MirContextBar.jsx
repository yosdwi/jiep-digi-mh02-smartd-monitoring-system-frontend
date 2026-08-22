import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Popover } from '@mui/material';
import { T } from './mirTokens';
import useMirAlertStore from '../../../stores/mirAlertStore';
import MirNotifDropdown from './MirNotifDropdown';
import { BreadcrumbActionsContext } from '../../layout/Layout';

// Context action Operasi = badge alert di breadcrumb global.
export default function MirContextBar({ onSelectAlert }) {
  const alerts = useMirAlertStore((s) => s.alerts);
  const badgeRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const setBreadcrumbAction = useContext(BreadcrumbActionsContext);

  const active = alerts.filter((a) => a.status === 'NEW');
  const crossingActive = active.filter((a) => a.type === 'CROSSING');
  const escalate = crossingActive.length > 0;
  const total = active.length;

  const right = useMemo(() => (
    <>
      {/* SATU badge alert — eskalasi saat crossing; klik → layar Peringatan */}
      <Box
        ref={badgeRef}
        onClick={() => { navigate('/mir/peringatan'); }}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
          borderRadius: '16px', px: 1.25, py: 0.6, fontSize: 12, userSelect: 'none',
          border: `1px solid ${escalate ? T.crit : '#5d6d7e'}`,
          background: escalate ? T.crit : '#4e5f70',
          color: '#fff', fontWeight: escalate ? 700 : 400,
        }}
        title={`${total} peringatan aktif — buka layar triage`}
      >
        {escalate && <Box sx={{ width: 4, height: 12, background: '#fff' }} />}
        ⚠ {total} peringatan
      </Box>
    </>
  ), [escalate, navigate, total]);

  useEffect(() => {
    setBreadcrumbAction(right);
    return () => setBreadcrumbAction(null);
  }, [setBreadcrumbAction, right]);

  return (
    <>
      <Popover
        open={notifOpen}
        anchorEl={badgeRef.current}
        onClose={() => setNotifOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: '6px', overflow: 'hidden', width: 362 } } }}
      >
        <MirNotifDropdown
          onSelect={(id) => {
            setNotifOpen(false);
            onSelectAlert?.(id);
          }}
        />
      </Popover>
    </>
  );
}
