import React, { useState } from 'react';
import { Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { styled } from '@mui/system';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const TopVHMSContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'rgba(30, 33, 37, 0.9)',
  backdropFilter: 'blur(10px)',
  borderRadius: '16px',
  color: '#ffffff',
  zIndex: 1200,
  width: 'auto',
  minWidth: '500px',
}));

const StyledAccordion = styled(Accordion)({
  backgroundColor: 'transparent',
  color: '#ffffff',
  boxShadow: 'none',
  '&:before': {
    display: 'none',
  },
  '&.Mui-expanded': {
    margin: 0,
  },
});

const StyledAccordionSummary = styled(AccordionSummary)({
  padding: '0 16px',
  minHeight: '48px',
  '& .MuiAccordionSummary-content': {
    margin: '12px 0',
  }
});

const DataRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, px: 2 }}>
    <Typography variant="body2" sx={{ color: '#8e94a0' }}>{label}:</Typography>
    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{value}</Typography>
  </Box>
);

const vhmsData = {
    engine: { hm: '38815.35', vehiclespeed: '0', eng_oil_temp: 71, eng_oil_press: 168 },
    fuel: { fuel_level_tm: 736, fuel_rate: 0, fuel_injection: 50 },
    plm: { plm_status: 3, act_tonnage: 28.4 },
};


const TopVHMSDisplay = () => {
  return (
    <TopVHMSContainer>
        <StyledAccordion defaultExpanded>
            <StyledAccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
            aria-controls="panel1a-content"
            id="panel1a-header"
            >
                <Typography sx={{fontWeight: 'bold'}}>VHMS Telemetry</Typography>
            </StyledAccordionSummary>
            <AccordionDetails sx={{pt: 0, pb: 2}}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                    {Object.entries(vhmsData.engine).map(([key, value]) => <DataRow key={key} label={key} value={value} />)}
                    {Object.entries(vhmsData.fuel).map(([key, value]) => <DataRow key={key} label={key} value={value} />)}
                    {Object.entries(vhmsData.plm).map(([key, value]) => <DataRow key={key} label={key} value={value} />)}
                </Box>
            </AccordionDetails>
        </StyledAccordion>
    </TopVHMSContainer>
  );
};

export default TopVHMSDisplay;
