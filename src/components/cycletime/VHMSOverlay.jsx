import React from 'react';
import { Box, Paper, Typography, LinearProgress, Divider } from '@mui/material';
import { styled } from '@mui/system';
import SpeedIcon from '@mui/icons-material/Speed';
import ScheduleIcon from '@mui/icons-material/Schedule';

const VHMSContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '80px', 
  left: '16px',
  width: '280px',
  backgroundColor: 'rgba(30, 33, 37, 0.9)',
  backdropFilter: 'blur(10px)',
  borderRadius: '16px',
  color: '#ffffff',
  zIndex: 1200,
  padding: '16px',
}));

const Section = styled(Box)({
    marginBottom: '16px',
});

const SectionTitle = styled(Typography)({
    color: '#8e94a0',
    marginBottom: '8px',
    textTransform: 'uppercase',
    fontSize: '0.75rem',
    fontWeight: 'bold',
});

const getStatusInfo = (status) => {
  switch (status) {
    case 0: return { text: 'Kosong', color: '#03a9f4' };
    case 1: return { text: 'Menunggu', color: '#ffeb3b' };
    case 2: return { text: 'Loading', color: '#ff9800' };
    case 3: return { text: 'Dumping', color: '#f44336' };
    default: return { text: 'Tidak Diketahui', color: '#9e9e9e' };
  }
};

const VisualDataRow = ({ label, value, max, unit }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{value} {unit}</Typography>
            </Box>
            <LinearProgress variant="determinate" value={percentage} sx={{height: '8px', borderRadius: '4px'}} />
        </Box>
    );
};

const vhmsData = {
    engine: { hm: '38815.35', vehiclespeed: '0' },
    fuel: { fuel_level_tm: 736 },
    plm: { plm_status: 3, act_tonnage: 28.4 },
};

const VHMSOverlay = () => {
  const statusInfo = getStatusInfo(vhmsData.plm.plm_status);

  return (
    <VHMSContainer>
        {/* Engine Summary Section */}
        <Section sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SpeedIcon sx={{ marginRight: 1 }} /> {vhmsData.engine.vehiclespeed} <span style={{fontSize: '1rem', marginLeft: '4px'}}>kph</span>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e94a0', mt: 1 }}>
                 <ScheduleIcon sx={{ marginRight: 1, fontSize: '1rem' }} />
                 <Typography variant="body2">HM: {vhmsData.engine.hm}</Typography>
            </Box>
        </Section>

        <Divider sx={{ my: 2, borderColor: '#4e555e' }} />

        {/* PLM Section */}
        <Section>
            <SectionTitle>Payload & Status</SectionTitle>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="body2">Status</Typography>
                <Paper sx={{background: `linear-gradient(135deg, ${statusInfo.color} 0%, ${statusInfo.color}dd 100%)`, color: '#ffffff', padding: '3px 14px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.2)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(8px)', fontWeight: 600}}>
                    <Typography variant="body2" sx={{fontWeight: 'bold'}}>{statusInfo.text}</Typography>
                </Paper>
            </Box>
            <VisualDataRow label="Tonnage" value={vhmsData.plm.act_tonnage} max={40} unit="Ton" />
        </Section>
        
        <Divider sx={{ my: 2, borderColor: '#4e555e' }} />

        {/* Fuel Section */}
        <Section>
             <SectionTitle>Fuel</SectionTitle>
             <VisualDataRow label="Level" value={vhmsData.fuel.fuel_level_tm} max={1000} unit="L" />
        </Section>
    </VHMSContainer>
  );
};

export default VHMSOverlay;
