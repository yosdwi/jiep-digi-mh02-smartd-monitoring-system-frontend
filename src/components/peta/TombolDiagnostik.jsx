import React from 'react';
import { Button } from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';

const TombolDiagnostik = ({ onClick, active = false }) => {
  return (
    <Button
      variant="contained"
      startIcon={<GpsFixedIcon />}
      onClick={onClick}
      sx={{
        position: 'relative',
        background: active
          ? 'linear-gradient(135deg, rgba(30, 64, 175, 0.95) 0%, rgba(5, 150, 105, 0.9) 100%)'
          : 'linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.9) 100%)',
        color: active ? '#ffffff' : '#1e293b',
        borderRadius: '16px',
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.95rem',
        letterSpacing: '0.02em',
        padding: '10px 20px',
        backdropFilter: 'blur(16px) saturate(1.2)',
        border: active
          ? '1px solid rgba(255, 255, 255, 0.2)'
          : '1px solid rgba(203, 213, 225, 0.4)',
        boxShadow: active
          ? '0 8px 32px rgba(30, 64, 175, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          : '0 4px 16px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        '&:hover': {
          transform: 'translateY(-2px) scale(1.05)',
          background: active
            ? 'linear-gradient(135deg, rgba(30, 64, 175, 1) 0%, rgba(5, 150, 105, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)',
          borderColor: active ? 'rgba(255, 255, 255, 0.4)' : 'rgba(30, 64, 175, 0.2)',
        },
        '&:active': {
          transform: 'translateY(0px) scale(1.02)',
        },
      }}
    >
      Diagnostik
    </Button>
  );
};

export default TombolDiagnostik;
