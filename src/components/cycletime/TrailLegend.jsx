import React from 'react';
import { Typography, Box } from '@mui/material';
import { styled } from '@mui/system';

const LegendContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: '120px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: '16px',
  backgroundColor: 'rgba(29, 35, 42, 0.7)',
  backdropFilter: 'blur(8px) saturate(1.8)',
  color: '#e2e8f0',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  zIndex: 1100
}));

const LegendItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

const ColorBox = styled(Box)(({ color }) => ({
  width: '10px',
  height: '10px',
  backgroundColor: color,
  borderRadius: '50%',
}));

const LegendText = styled(Typography)({
    fontSize: '11px',
    lineHeight: '1',
    fontWeight: 500,
    whiteSpace: 'nowrap'
});

const TrailLegend = () => {
  return (
    <LegendContainer>
      <LegendText sx={{ fontWeight: 600 }}>Speed:</LegendText>
      <LegendItem>
        <ColorBox color="rgb(59, 130, 246)" />
        <LegendText>&gt;= 30 kph</LegendText>
      </LegendItem>
      <LegendItem>
        <ColorBox color="rgb(34, 197, 94)" />
        <LegendText>25-30 kph</LegendText>
      </LegendItem>
      <LegendItem>
        <ColorBox color="rgb(251, 191, 36)" />
        <LegendText>20-25 kph</LegendText>
      </LegendItem>
      <LegendItem>
        <ColorBox color="rgb(139, 69, 19)" />
        <LegendText>10-20 kph</LegendText>
      </LegendItem>
      <LegendItem>
        <ColorBox color="rgb(239, 68, 68)" />
        <LegendText>&lt; 10 kph</LegendText>
      </LegendItem>
    </LegendContainer>
  );
};

export default TrailLegend;
