import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { T } from './mirTokens';

// Top bar bersama 3 layar MIR (Operasi/Perangkat/Firmware) — brand + tab navigasi + jam.
// `right` = slot opsional (Operasi pasang health-pill + badge alert). Tema slate SMARTD.
const TABS = [
  { key: 'operasi', label: 'Operasi', to: '/mir/operasi' },
  { key: 'peringatan', label: 'Peringatan', to: '/mir/peringatan' },
  { key: 'geofence', label: 'Geofence', to: '/mir/geofence' },
  { key: 'perangkat', label: 'Perangkat', to: '/mir/perangkat' },
  { key: 'firmware', label: 'Firmware', to: '/mir/firmware' },
  { key: 'kesehatan', label: 'Kesehatan Sistem', to: '/mir/kesehatan' },
];

function Clock() {
  const [t, setT] = useState(() => new Date().toTimeString().slice(0, 8));
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toTimeString().slice(0, 8)), 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontFamily: T.mono, fontSize: 12, color: '#aeb9c4' }}>{t}</span>;
}

export default function MirTabBar({ active, right }) {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        height: 44, flex: '0 0 44px', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75,
        background: T.navBar, borderBottom: '1px solid #2f3b48', color: '#fff',
      }}
    >
      <Box sx={{ fontSize: 12, color: '#aeb9c4', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
        MIR
      </Box>
      <Box sx={{ display: 'flex', gap: 0.25 }}>
        {TABS.map((tab) => {
          const on = tab.key === active;
          const disabled = !tab.to;
          return (
            <Box
              key={tab.key}
              component="button"
              onClick={() => { if (!on && tab.to) navigate(tab.to); }}
              disabled={disabled}
              sx={{
                border: 'none', px: 1.35, py: 0.7, borderRadius: '3px', fontSize: 13,
                cursor: disabled ? 'not-allowed' : on ? 'default' : 'pointer',
                color: on ? '#fff' : '#b3bdc7',
                background: on ? '#4e5f70' : 'transparent',
                fontWeight: on ? 600 : 400,
                opacity: disabled ? 0.55 : 1,
                '&:hover': { background: on || disabled ? undefined : '#445566' },
              }}
            >
              {tab.label}
            </Box>
          );
        })}
      </Box>

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        {right}
        <Clock />
      </Box>
    </Box>
  );
}
