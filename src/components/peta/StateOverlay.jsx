import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { FilterList, ErrorOutline, SearchOff } from '@mui/icons-material';

const iconStyle = {
  fontSize: '20px',
  color: '#1e40af',
  filter: 'drop-shadow(0 2px 6px rgba(30, 64, 175, 0.2))',
};

const StateOverlay = ({ isLoading, error, hasData, searchAttempted, loadingLabel = 'Memuat Data...' }) => {
  const ToastContainer = ({ children, type = 'info' }) => (
    <Box
      sx={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: `
          linear-gradient(145deg,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(248, 250, 252, 0.9) 100%
          )
        `,
        backdropFilter: 'blur(20px) saturate(1.1)',
        color: '#1e293b',
        padding: '8px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(203, 213, 225, 0.3)',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
        zIndex: 1301,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.85rem',
      }}
    >
      {children}
    </Box>
  );

  if (isLoading) {
    return (
      <ToastContainer type="loading">
        <CircularProgress size={16} color="inherit" />
        <Typography variant="body2" sx={{
          fontWeight: 500,
          color: '#1e293b',
          fontSize: '0.85rem',
        }}>
          {loadingLabel}
        </Typography>
      </ToastContainer>
    );
  }

  if (error) {
    return (
      <ToastContainer type="error">
        <ErrorOutline sx={{ fontSize: '18px', color: '#dc2626' }} />
        <Typography variant="body2" sx={{
          fontWeight: 500,
          color: '#dc2626',
          fontSize: '0.85rem',
        }}>
          {error}
        </Typography>
      </ToastContainer>
    );
  }

  if (searchAttempted && !hasData) {
    return (
      <ToastContainer type="warning">
        <SearchOff sx={{ fontSize: '18px', color: '#d97706' }} />
        <Typography variant="body2" sx={{
          fontWeight: 500,
          color: '#d97706',
          fontSize: '0.85rem',
        }}>
          Data tidak ditemukan
        </Typography>
      </ToastContainer>
    );
  }

  return null;
};

export default StateOverlay;