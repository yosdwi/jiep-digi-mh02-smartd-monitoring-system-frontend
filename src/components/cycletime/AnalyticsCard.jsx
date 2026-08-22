import React, { useState } from 'react';
import { Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails, Divider, Collapse } from '@mui/material';
import { styled } from '@mui/system';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton from '@mui/material/IconButton';
import useCycleTimeStore from '../../stores/cycleTimeStore';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


const AnalyticsContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '16px',
  right: '16px',
  width: '280px',
  maxHeight: 'calc(100% - 32px)',
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
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease-in-out',
  overflow: 'hidden',
  boxShadow: `
    0 32px 80px rgba(15, 23, 42, 0.12),
    0 16px 40px rgba(30, 64, 175, 0.08),
    0 8px 20px rgba(5, 150, 105, 0.04)
  `,
}));

const Header = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 20px',
});

const SummaryGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr', // Changed to 2 columns for better space usage in slimmer card
  gap: '12px',
  padding: '0 20px 16px',
});

const StatCard = styled(Paper)(({ theme }) => ({
    backgroundColor: 'rgba(248, 250, 252, 0.6)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(203, 213, 225, 0.3)',
    borderRadius: '12px',
    padding: '12px',
    textAlign: 'center',
    color: '#1e293b',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.9)',
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(30, 64, 175, 0.08)',
    }
}));

const EquipmentList = styled(Box)({
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '0 8px 8px',
  flex: 1,
  minHeight: 0,
  maxHeight: '300px',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(241, 245, 249, 0.3)',
    borderRadius: '3px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(148, 163, 184, 0.5)',
    borderRadius: '3px',
    '&:hover': {
      background: 'rgba(148, 163, 184, 0.7)',
    },
  },
});

const StyledAccordion = styled(Accordion)({
  backgroundColor: 'transparent',
  color: '#1e293b',
  boxShadow: 'none',
  marginBottom: '8px',
  '&:before': {
    display: 'none',
  },
  '&.Mui-expanded': {
    margin: '0 0 8px 0',
  },
  '&:last-child': {
    marginBottom: 0,
  }
});

const StyledAccordionSummary = styled(AccordionSummary)({
  backgroundColor: 'rgba(248, 250, 252, 0.6)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(203, 213, 225, 0.3)',
  borderRadius: '8px',
  '& .MuiAccordionSummary-content': {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  '& .MuiAccordionSummary-expandIconWrapper': {
    color: '#64748b',
  }
});

const AnalyticsCard = () => {
  const [expanded, setExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { summary, trackingData, filters, targetSpeedData, selectedLoader, haulerSummaries } = useCycleTimeStore();

  const getLoaderName = () => {
    return selectedLoader ? selectedLoader.value : '';
  };

  const getHaulerData = () => {
    if (!trackingData?.length) return [];

    const haulerMap = new Map();
    trackingData.forEach(point => {
      const unit = point.unitNo || point.UnitNo;
      if (!haulerMap.has(unit)) {
        haulerMap.set(unit, {
          name: unit,
          speeds: []
        });
      }
      haulerMap.get(unit).speeds.push(point.speed || point.vehiclespeed || 0);
    });

    return Array.from(haulerMap.entries()).map(([unit, data]) => {
      const haulerSummary = haulerSummaries[unit] || {};
      return {
        name: unit,
        ritase: haulerSummary.totalRitase || 0,
        cycleTime: `${Number(haulerSummary.avgCycleTime || 0).toFixed(2)} min`,
        avgSpeed: `${Number(haulerSummary.averageSpeed || 0).toFixed(1)} kph`,
        jarakMuatan: `${Number(haulerSummary.avgJarakFrontDisposal || 0).toFixed(2)} km`,
        jarakKosongan: `${Number(haulerSummary.avgJarakDisposalFront || 0).toFixed(2)} km`
      };
    });
  };

  const haulerData = getHaulerData();

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <AnalyticsContainer elevation={8}>
      <Header>
        <Typography variant="h6" sx={{fontWeight: 'bold', color: '#1e293b'}}>Summary Analytics</Typography>
        <IconButton size="small" onClick={() => setIsMinimized(!isMinimized)}>
          {isMinimized ? <KeyboardArrowDownIcon sx={{color: '#64748b'}} /> : <KeyboardArrowUpIcon sx={{color: '#64748b'}} />}
        </IconButton>
      </Header>
      <Collapse in={!isMinimized} timeout="auto" unmountOnExit sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Box sx={{padding: '0 20px 16px'}}>
            <Paper sx={{
              background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.1) 0%, rgba(5, 150, 105, 0.08) 100%)',
              border: '1px solid rgba(30, 64, 175, 0.2)',
              padding: '8px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
                <Typography variant="h6" sx={{fontWeight: 'bold', color: '#1e40af'}}>
                  {getLoaderName()}
                </Typography>
            </Paper>
          </Box>

          <SummaryGrid>
            <StatCard>
              <Typography variant="caption" sx={{ color: '#64748b' }}>TOTAL RITASE</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{summary?.totalRitase || 0}</Typography>
            </StatCard>
            <StatCard>
              <Typography variant="caption" sx={{ color: '#64748b' }}>TOTAL HAULERS</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{haulerData.length}</Typography>
            </StatCard>
            <StatCard>
              <Typography variant="caption" sx={{ color: '#64748b' }}>CYCLE TIME</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', margin: 0 }}>{Number(summary?.avgCycleTime || 0).toFixed(2)}</Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>min</Typography>
              </Box>
            </StatCard>
            <StatCard>
              <Typography variant="caption" sx={{ color: '#64748b' }}>ACT/TARGET SPEED</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', margin: 0 }}>{Number(summary?.averageSpeed || 0).toFixed(1)}</Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>/ {Number(targetSpeedData?.targetSpeed || 0).toFixed(1)} kph</Typography>
              </Box>
            </StatCard>
          </SummaryGrid>
          
          <Divider sx={{ borderColor: 'rgba(203, 213, 225, 0.4)', margin: '0 20px' }} />

          <EquipmentList>
            {haulerData.map(hauler => (
                <StyledAccordion key={hauler.name} expanded={expanded === hauler.name} onChange={handleChange(hauler.name)}>
                    <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{fontWeight: 'bold', color: '#1e293b'}}>{hauler.name}</Typography>
                        <Box sx={{textAlign: 'right'}}>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>Ritase</Typography>
                            <Typography sx={{color: '#059669', fontWeight: 'bold'}}>{hauler.ritase}</Typography>
                        </Box>
                    </StyledAccordionSummary>
                    <AccordionDetails sx={{
                      backgroundColor: 'rgba(241, 245, 249, 0.8)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(203, 213, 225, 0.3)',
                      borderRadius: '0 0 8px 8px',
                      borderTop: 'none'
                    }}>
                        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>Cycle Time:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>{hauler.cycleTime}</Typography>
                        </Box>
                        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>Avg Speed:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>{hauler.avgSpeed}</Typography>
                        </Box>
                        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>Jarak Muatan:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>{hauler.jarakMuatan}</Typography>
                        </Box>
                        <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>Jarak Kosongan:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>{hauler.jarakKosongan}</Typography>
                        </Box>
                    </AccordionDetails>
                </StyledAccordion>
            ))}
          </EquipmentList>
        </Box>
      </Collapse>
    </AnalyticsContainer>
  );
};

export default AnalyticsCard;
