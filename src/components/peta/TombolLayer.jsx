import React from 'react';
import { Button } from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';

const TombolLayer = ({ onClick, active = false, layerCount = 0 }) => {
  return (
    <Button
      variant="contained"
      startIcon={<LayersIcon sx={{
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: active ? 'rotate(180deg)' : 'rotate(0deg)',
      }} />}
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
          ? `0 8px 32px rgba(30, 64, 175, 0.25),
             0 4px 16px rgba(5, 150, 105, 0.15),
             inset 0 1px 0 rgba(255, 255, 255, 0.2)`
          : `0 4px 16px rgba(15, 23, 42, 0.06),
             0 2px 8px rgba(30, 64, 175, 0.04),
             inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        overflow: 'hidden',

        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
          transition: 'left 0.6s ease',
        },

        '&:hover': {
          transform: 'translateY(-2px) scale(1.05)',
          background: active
            ? 'linear-gradient(135deg, rgba(30, 64, 175, 1) 0%, rgba(5, 150, 105, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)',
          boxShadow: active
            ? `0 12px 40px rgba(30, 64, 175, 0.3),
               0 6px 20px rgba(5, 150, 105, 0.2),
               inset 0 2px 0 rgba(255, 255, 255, 0.3)`
            : `0 8px 25px rgba(15, 23, 42, 0.1),
               0 4px 12px rgba(30, 64, 175, 0.08),
               inset 0 2px 0 rgba(255, 255, 255, 0.6)`,
          borderColor: active
            ? 'rgba(255, 255, 255, 0.4)'
            : 'rgba(30, 64, 175, 0.2)',

          '&::before': {
            left: '100%',
          }
        },

        '&:active': {
          transform: 'translateY(0px) scale(1.02)',
        },

        // Layer count badge
        ...(layerCount > 0 && {
          '&::after': {
            content: `"${layerCount}"`,
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            minWidth: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #ffffff',
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
          }
        })
      }}
    >
      Layer
    </Button>
  );
};

export default TombolLayer;

