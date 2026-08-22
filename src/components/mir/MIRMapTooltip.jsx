import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const TooltipContainer = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 10000,
  padding: '8px 12px',
  background: `
    linear-gradient(145deg,
      rgba(255, 255, 255, 0.98) 0%,
      rgba(248, 250, 252, 0.95) 50%,
      rgba(241, 245, 249, 0.92) 100%
    )
  `,
  backdropFilter: 'blur(24px) saturate(1.2)',
  border: '1px solid rgba(203, 213, 225, 0.4)',
  borderRadius: '8px',
  boxShadow: `
    0 8px 32px rgba(15, 23, 42, 0.12),
    0 4px 16px rgba(30, 64, 175, 0.08),
    0 2px 8px rgba(5, 150, 105, 0.04)
  `,
  minWidth: '180px',
  color: '#1e293b',
  fontFamily: 'Inter, sans-serif',
  transform: 'translate(8px, -100%)',
  marginTop: '-8px',
}));

const HeaderSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '6px',
  paddingBottom: '6px',
  borderBottom: '1px solid rgba(203, 213, 225, 0.3)',
});

const StatusDot = styled(Box)({
  width: '6px',
  height: '6px',
  background: '#3b82f6',
  borderRadius: '50%',
  boxShadow: '0 0 6px rgba(59, 130, 246, 0.4)',
});

const DeviceName = styled(Typography)({
  fontWeight: 600,
  fontSize: '13px',
  color: '#1e40af',
});

const InfoRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '2px',
});

const InfoLabel = styled(Typography)({
  color: '#64748b',
  fontSize: '11px',
  fontWeight: 500,
});

const InfoValue = styled(Typography)(({ customColor }) => ({
  fontWeight: 600,
  fontSize: '11px',
  color: customColor || '#1e293b',
}));

const MIRMapTooltip = ({ tooltip, position }) => {
  if (!tooltip || !position) return null;

  const { deviceId, unitNo, time, speed, distanceStatus, gpsQuality, mirDistance, mirInArea, mirUnsafe } = tooltip;
  const speedColor = speed > 0 ? '#10b981' : '#f59e0b';

  // Format MIR distance
  const formatMirDistance = (distance) => {
    if (distance === null || distance === undefined || distance === -9999) {
      return 'N/A';
    }
    return `${distance}m`;
  };

  return (
    <TooltipContainer
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <HeaderSection>
        <StatusDot />
        <DeviceName>{deviceId} {unitNo && `(${unitNo})`}</DeviceName>
      </HeaderSection>

      <Box>
        <InfoRow>
          <InfoLabel>Time:</InfoLabel>
          <InfoValue>{time}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>Speed:</InfoLabel>
          <InfoValue customColor={speedColor}>{speed} km/h</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>Distance Status:</InfoLabel>
          <InfoValue>{distanceStatus}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>GPS Quality:</InfoLabel>
          <InfoValue>{gpsQuality}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>MIR Distance:</InfoLabel>
          <InfoValue>{formatMirDistance(mirDistance)}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>In Area:</InfoLabel>
          <InfoValue customColor={mirInArea === 1 ? '#22c55e' : '#64748b'}>
            {mirInArea === 1 ? 'Yes' : 'No'}
          </InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>Unsafe:</InfoLabel>
          <InfoValue customColor={mirUnsafe === 1 ? '#ef4444' : '#22c55e'}>
            {mirUnsafe === 1 ? 'Yes' : 'No'}
          </InfoValue>
        </InfoRow>
      </Box>
    </TooltipContainer>
  );
};

export default MIRMapTooltip;