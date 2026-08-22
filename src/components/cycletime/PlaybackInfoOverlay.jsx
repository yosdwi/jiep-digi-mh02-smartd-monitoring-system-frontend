import React from 'react';
import { Box, Paper, Typography, IconButton, Button } from '@mui/material';
import { styled } from '@mui/system';
import useCycleTimeStore from '../../stores/cycleTimeStore';

// Icons
import SpeedIcon from '@mui/icons-material/Speed';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ScaleIcon from '@mui/icons-material/Scale';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const OverlayContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: `
    linear-gradient(145deg,
      rgba(255, 255, 255, 0.98) 0%,
      rgba(248, 250, 252, 0.95) 50%,
      rgba(241, 245, 249, 0.92) 100%
    )
  `,
  backdropFilter: 'blur(24px) saturate(1.2)',
  borderRadius: '16px',
  border: '1px solid rgba(203, 213, 225, 0.4)',
  color: '#1e293b',
  zIndex: 1200,
  padding: '12px 24px',
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  width: 'auto',
  minWidth: '950px',
  maxWidth: '1000px',
  pointerEvents: 'auto',
  boxShadow: `
    0 32px 80px rgba(15, 23, 42, 0.12),
    0 16px 40px rgba(30, 64, 175, 0.08),
    0 8px 20px rgba(5, 150, 105, 0.04)
  `,
}));

const HaulerListContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flex: 1,
  overflow: 'hidden',
});

const HaulerScroller = styled(Box)({
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': {
    display: 'none',
  },
  padding: '4px 0',
  flex: 1,
});

const HaulerChip = styled(Button)(({ selected }) => ({
  backgroundColor: selected ? '#1e40af' : 'rgba(248, 250, 252, 0.6)',
  color: selected ? '#ffffff' : '#1e293b',
  border: `1px solid ${selected ? '#1e40af' : 'rgba(203, 213, 225, 0.4)'}`,
  borderRadius: '20px',
  padding: '6px 16px',
  minWidth: 'auto',
  fontSize: '0.875rem',
  fontWeight: 600,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: selected ? '#1d4ed8' : 'rgba(255, 255, 255, 0.8)',
    transform: 'translateY(-1px)',
  },
}));

const NavigationButton = styled(IconButton)({
  backgroundColor: 'rgba(248, 250, 252, 0.8)',
  border: '1px solid rgba(203, 213, 225, 0.3)',
  width: '32px',
  height: '32px',
  color: '#64748b',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#1e40af',
  },
});

const InfoItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

const PlaybackInfoOverlay = () => {
  const {
    selectedHauler,
    getHaulerList,
    setSelectedHauler,
    getCurrentTrackingPoint,
    getStatusText,
    getStatusColor,
  } = useCycleTimeStore();

  const haulerList = getHaulerList();
  const currentPoint = getCurrentTrackingPoint();

  const scrollLeft = () => {
    const scroller = document.querySelector('[data-hauler-scroller]');
    if (scroller) {
      scroller.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const scroller = document.querySelector('[data-hauler-scroller]');
    if (scroller) {
      scroller.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  if (selectedHauler && currentPoint) {
    const statusColor = getStatusColor(currentPoint.plm_status);
    const statusText = getStatusText(currentPoint.plm_status);

    return (
      <OverlayContainer elevation={8}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%', justifyContent: 'space-around' }}>
          <InfoItem>
            <SpeedIcon sx={{ color: '#64748b' }} />
            <Typography variant="body2" sx={{ color: '#64748b' }}>Kecepatan:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                {currentPoint.speed || currentPoint.vehiclespeed || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>kph</Typography>
            </Box>
          </InfoItem>

          <InfoItem>
            <LocalShippingIcon sx={{ color: '#64748b' }} />
            <Typography variant="body2" sx={{ color: '#64748b' }}>Status:</Typography>
            <Paper sx={{
              background: `linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%)`,
              color: '#ffffff',
              padding: '4px 12px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                {statusText}
              </Typography>
            </Paper>
          </InfoItem>

          <InfoItem>
            <ScaleIcon sx={{ color: '#64748b' }} />
            <Typography variant="body2" sx={{ color: '#64748b' }}>Payload:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                {currentPoint.act_tonnage || '0.0'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>T</Typography>
            </Box>
          </InfoItem>

          <InfoItem>
            <LocalGasStationIcon sx={{ color: '#64748b' }} />
            <Typography variant="body2" sx={{ color: '#64748b' }}>Fuel:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                {currentPoint.fuel_level_tm || '0'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>%</Typography>
            </Box>
          </InfoItem>

          <InfoItem>
            <AccessTimeIcon sx={{ color: '#64748b' }} />
            <Typography variant="body2" sx={{ color: '#64748b' }}>HM:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                {currentPoint.hm ? parseFloat(currentPoint.hm).toFixed(1) : '0.0'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>jam</Typography>
            </Box>
          </InfoItem>
        </Box>
      </OverlayContainer>
    );
  }

  return null;
};

export default PlaybackInfoOverlay;
