import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormGroup,
  FormControlLabel,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const CustomSwitch = styled(Switch)(({ color }) => ({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: color,
    '&:hover': {
      backgroundColor: `${color}20`,
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: color,
  },
}));

const UnderspeedControls = ({
  speedRanges,
  visibility,
  onVisibilityChange,
  unitVisibility,
  onUnitVisibilityChange,
}) => {
  const [speedLegendExpanded, setSpeedLegendExpanded] = React.useState(true);
  const [unitListExpanded, setUnitListExpanded] = React.useState(true);

  const handleSpeedToggle = (range) => {
    onVisibilityChange({ ...visibility, [range]: !visibility[range] });
  };

  const handleUnitToggle = (unit) => {
    onUnitVisibilityChange({ ...unitVisibility, [unit]: !unitVisibility[unit] });
  };

  const unitKeys = Object.keys(unitVisibility);

  return (
    <Card sx={{ 
      minWidth: 275, 
      borderRadius: '12px', 
      backgroundColor: 'rgba(46, 50, 56, 0.9)', 
      color: '#ffffff',
      backdropFilter: 'blur(5px)',
    }}>
      <CardContent sx={{ padding: '12px !important' }}>
        {/* Speed Legend Section */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setSpeedLegendExpanded(!speedLegendExpanded)}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            Legenda Kecepatan
          </Typography>
          <IconButton
            aria-expanded={speedLegendExpanded}
            aria-label="show speed legend"
            sx={{ color: '#ffffff' }}
          >
            <ExpandMoreIcon
              sx={{ transform: speedLegendExpanded ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
            />
          </IconButton>
        </Box>
        <Collapse in={speedLegendExpanded} timeout="auto" unmountOnExit>
          <FormGroup sx={{ pl: 1, mt: 1 }}>
            {speedRanges.map(({ label, color, range }) => (
              <FormControlLabel
                key={range}
                control={
                  <CustomSwitch
                    checked={visibility[range] || false}
                    onChange={() => handleSpeedToggle(range)}
                    color={color}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 12, height: 12, backgroundColor: color, borderRadius: '50%', mr: 1.5 }} />
                    <Typography variant="body2">{label}</Typography>
                  </Box>
                }
              />
            ))}
          </FormGroup>
        </Collapse>

        {unitKeys.length > 0 && <Divider sx={{ my: 1.5, borderColor: '#4e555e' }} />}

        {/* Unit List Section */}
        {unitKeys.length > 0 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', mt: 1 }} onClick={() => setUnitListExpanded(!unitListExpanded)}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Daftar Unit
              </Typography>
              <IconButton
                aria-expanded={unitListExpanded}
                aria-label="show unit list"
                sx={{ color: '#ffffff' }}
              >
                <ExpandMoreIcon
                  sx={{ transform: unitListExpanded ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
                />
              </IconButton>
            </Box>
            <Collapse in={unitListExpanded} timeout="auto" unmountOnExit>
              <FormGroup sx={{ pl: 1, mt: 1, maxHeight: 150, overflowY: 'auto' }}>
                {unitKeys.map((unit) => (
                  <FormControlLabel
                    key={unit}
                    control={
                      <Switch
                        checked={unitVisibility[unit] || false}
                        onChange={() => handleUnitToggle(unit)}
                      />
                    }
                    label={<Typography variant="body2">{unit}</Typography>}
                  />
                ))}
              </FormGroup>
            </Collapse>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default UnderspeedControls;
