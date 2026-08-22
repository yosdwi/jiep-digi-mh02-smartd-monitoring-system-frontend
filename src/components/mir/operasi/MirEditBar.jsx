import React from 'react';
import { Box } from '@mui/material';
import { T } from './mirTokens';

// Top bar EDIT (mockup .edit-bar) — gantikan context bar saat mode "Ubah geofence".
export default function MirEditBar({ group, dirty, saving = false, error = null, onExit, onSave }) {
  const canSave = dirty && !saving;
  return (
    <Box
      sx={{
        height: 44, flex: '0 0 44px', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75,
        background: T.g0, borderBottom: `1px solid ${T.line}`,
      }}
    >
      <Box
        component="button"
        onClick={onExit}
        sx={{ border: `1px solid ${T.g3}`, background: T.w, borderRadius: '4px', px: 1.4, py: 0.6, color: T.g6, fontSize: 12, cursor: 'pointer' }}
      >
        ‹ kembali ke Monitor
      </Box>
      <Box sx={{ fontSize: 14, letterSpacing: '.5px', color: T.ink, fontWeight: 600 }}>
        UBAH GEOFENCE — Grup {group}
      </Box>
      {error ? (
        <Box sx={{ fontSize: 12, color: '#c0392b', fontWeight: 600 }}>⚠ {error}</Box>
      ) : null}
      <Box
        component="button"
        onClick={onSave}
        disabled={!canSave}
        sx={{
          ml: 'auto', background: canSave ? T.ink : T.g3, color: '#fff', border: 'none', borderRadius: '4px',
          px: 2, py: 0.9, fontWeight: 600, fontSize: 13, cursor: canSave ? 'pointer' : 'default',
        }}
      >
        {saving ? 'Menyimpan…' : 'Simpan'}
      </Box>
    </Box>
  );
}
