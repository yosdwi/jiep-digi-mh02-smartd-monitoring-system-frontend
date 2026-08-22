import React from 'react';
import { Box } from '@mui/material';
import { T } from './mirTokens';

// Toolbar edit di peta (mockup .edit-toolbar, pola Google MyMaps): Pilih · Taruh R0 · Ukur · Ambang.
const TOOLS = [
  { key: 'select', label: '▣ Pilih' },
  { key: 'rover0', label: '◉ Taruh R0' },
  { key: 'measure', label: '📏 Ukur' },
  { key: 'ambang', label: '⚙ Ambang' },
];

export default function MirEditToolbar({ tool, onTool }) {
  return (
    <Box
      sx={{
        position: 'absolute', top: 16, left: 16, zIndex: 12, display: 'flex',
        background: T.w, border: `1px solid ${T.g3}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.12)',
      }}
    >
      {TOOLS.map((t) => (
        <Box
          key={t.key}
          component="button"
          onClick={() => onTool(t.key)}
          sx={{
            border: 'none', borderRight: `1px solid ${T.g2}`, '&:last-of-type': { borderRight: 'none' },
            background: tool === t.key ? T.ink : T.w, color: tool === t.key ? '#fff' : T.g6,
            px: 1.6, py: 1, fontSize: 12, cursor: 'pointer',
          }}
        >
          {t.label}
        </Box>
      ))}
    </Box>
  );
}
