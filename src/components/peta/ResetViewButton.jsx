import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';

const buttonStyle = {
  position: 'absolute',
  bottom: '24px',
  left: '80px', // Posisikan di sebelah kanan tombol ZoomOut
  zIndex: 1300,
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)',
  backdropFilter: 'blur(16px) saturate(1.2)',
  color: '#1e40af',
  border: '1px solid rgba(203, 213, 225, 0.4)',
  borderRadius: '16px',
  width: 48,
  height: 48,
  boxShadow: `
    0 8px 32px rgba(15, 23, 42, 0.06),
    0 4px 16px rgba(30, 64, 175, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.4)
  `,
  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  '&:hover': {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(30, 64, 175, 0.08) 100%)',
    transform: 'translateY(-2px) scale(1.05)',
    boxShadow: `
      0 12px 40px rgba(30, 64, 175, 0.12),
      0 6px 20px rgba(5, 150, 105, 0.08),
      inset 0 2px 0 rgba(255, 255, 255, 0.6)
    `,
    borderColor: 'rgba(30, 64, 175, 0.3)',
  },
  '&:active': {
    transform: 'translateY(0) scale(1.02)',
  }
};

export const ResetViewButton = ({ onClick }) => (
  <Tooltip title="Kembali ke Tampilan Awal" placement="right">
    <IconButton sx={buttonStyle} onClick={onClick} aria-label="reset view">
      <PublicIcon />
    </IconButton>
  </Tooltip>
);
