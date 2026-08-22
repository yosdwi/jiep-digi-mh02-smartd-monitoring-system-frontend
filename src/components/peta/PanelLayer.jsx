import React from 'react';
import { Popover, List, ListItem, ListItemText, Switch, Box, Typography, Divider } from '@mui/material';

const PanelLayer = ({ open, anchorEl, handleClose, layerState, onLayerChange, isMirPage = false }) => {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      PaperProps={{
        sx: {
          width: 260,
          padding: 0,
          background: `
            linear-gradient(145deg,
              rgba(255, 255, 255, 0.98) 0%,
              rgba(248, 250, 252, 0.95) 50%,
              rgba(241, 245, 249, 0.92) 100%
            )
          `,
          backdropFilter: 'blur(24px) saturate(1.2)',
          border: '1px solid rgba(203, 213, 225, 0.4)',
          borderRadius: '16px',
          color: '#1e293b',
          boxShadow: `
            0 20px 64px rgba(15, 23, 42, 0.08),
            0 8px 32px rgba(30, 64, 175, 0.06),
            0 4px 16px rgba(5, 150, 105, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.4)
          `,
          overflow: 'hidden',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #1e40af 0%, #3b82f6 25%, #059669 50%, #10b981 75%, #1e40af 100%)',
            backgroundSize: '200% 100%',
            animation: 'gradient-flow 3s ease-in-out infinite',
          },
          '@keyframes gradient-flow': {
            '0%, 100%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
          },
        },
        elevation: 0,
      }}
    >
      <Box sx={{
        p: 3,
        pb: 2,
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(203, 213, 225, 0.3)',
        position: 'relative',
        zIndex: 2,
      }}>
        <Typography variant="subtitle1" sx={{
          fontWeight: 700,
          textAlign: 'center',
          color: '#1e293b',
          fontSize: '1.1rem',
          letterSpacing: '-0.02em',
          textShadow: '0 1px 2px rgba(15, 23, 42, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}>
          Kontrol Layer
        </Typography>
      </Box>
      <List dense>
        {isMirPage && (
          <>
            <ListItem sx={{
              py: 1.5,
              px: 3,
              borderRadius: 2,
              mx: 1,
              my: 0.5,
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'rgba(30, 64, 175, 0.05)',
                transform: 'translateX(2px)',
              }
            }}>
              <ListItemText
                primary="MIR Dumping Areas"
                primaryTypographyProps={{
                  sx: {
                    color: '#059669',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    letterSpacing: '0.01em',
                  }
                }}
              />
              <Switch
                checked={layerState.mirDumpingAreas}
                onChange={onLayerChange}
                name="mirDumpingAreas"
                size="small"
                sx={{
                  '& .MuiSwitch-track': {
                    backgroundColor: 'rgba(203, 213, 225, 0.4)',
                  },
                  '& .MuiSwitch-thumb': {
                    boxShadow: '0 2px 8px rgba(30, 64, 175, 0.2)',
                  },
                  '&.Mui-checked .MuiSwitch-track': {
                    backgroundColor: '#059669 !important',
                  },
                  '&.Mui-checked .MuiSwitch-thumb': {
                    backgroundColor: '#ffffff',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                  }
                }}
              />
            </ListItem>
            <Box sx={{ height: '1px', background: 'rgba(203, 213, 225, 0.2)', mx: 2, my: 1 }} />
          </>
        )}
        <ListItem>
          <ListItemText primary="Orthophoto" />
          <Switch
            checked={layerState.orthophoto}
            onChange={onLayerChange}
            name="orthophoto"
            size="small"
          />
        </ListItem>
        <ListItem>
          <ListItemText primary="Batas Wilayah" />
          <Switch
            checked={layerState.boundaries}
            onChange={onLayerChange}
            name="boundaries"
            size="small"
          />
        </ListItem>
        <ListItem>
          <ListItemText primary="Jalan" />
          <Switch
            checked={layerState.roads}
            onChange={onLayerChange}
            name="roads"
            size="small"
          />
        </ListItem>
      </List>
    </Popover>
  );
};

export default PanelLayer;
