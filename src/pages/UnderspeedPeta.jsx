import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import TombolFilter from '../components/peta/TombolFilter';
import TombolLayer from '../components/peta/TombolLayer';
import FilterModal from '../components/modals/FilterModal';
import PanelLayer from '../components/peta/PanelLayer';
import MapContainer from '../components/peta/MapContainer';
import UnderspeedControls from '../components/underspeed/UnderspeedControls'; // Import the new control component
import useUserStore from '../stores/userStore';

// Define speed ranges and their corresponding colors
const speedRanges = [
  { label: 'Speed = 0 km/jam', color: '#dc2626', range: 'zero', min: 0, max: 0 },
  { label: '< 20 km/jam', color: '#f97316', range: 'low', min: 1, max: 19 }, // sedikit orange aja nah jadi speed diatas 0 sampai 19 itu sedikit orange aja
  { label: '20-30 km/jam', color: '#eab308', range: 'medium', min: 20, max: 29 },
  { label: '30-35 km/jam', color: '#22c55e', range: 'high', min: 30, max: 35 },
  { label: '> 35 km/jam', color: '#3b82f6', range: 'very-high', min: 36, max: Infinity },
];

const getSpeedColor = (speed) => {
  if (speed === 0) return '#dc2626';
  if (speed > 0 && speed < 20) return '#f97316';
  if (speed >= 20 && speed < 30) return '#eab308';
  if (speed >= 30 && speed <= 35) return '#22c55e';
  if (speed > 35) return '#3b82f6';
  return '#808080'; // Default color for undefined speeds
};

import { useLocation } from 'react-router-dom';
import { getLayerConfigForPath } from '../config/layerConfig';

const UnderspeedPeta = () => {
  const location = useLocation();
  const [apakahModalFilterBuka, setApakahModalFilterBuka] = useState(false);
  const [anchorElLayer, setAnchorElLayer] = useState(null);
  const district = useUserStore((state) => state.profile?.distrik);
  const [layerState, setLayerState] = useState(getLayerConfigForPath(location.pathname));
  
  // --- TAMBAHKAN MANAJEMEN VIEWSTATE ---
  const [viewState, setViewState] = useState({
    longitude: 117.28, latitude: 1.91, zoom: 12, pitch: 0, bearing: 0,
  });
  const handleViewStateChange = ({ viewState: newViewState }) => setViewState(newViewState);
  // --- SELESAI ---

  // New states for Underspeed functionality
  const [underspeedData, setUnderspeedData] = useState([]);
  const [speedVisibility, setSpeedVisibility] = useState(
    Object.fromEntries(speedRanges.map(range => [range.range, true]))
  );
  const [unitVisibility, setUnitVisibility] = useState({});
  const [realisticDummyData, setRealisticDummyData] = useState([]);

  useEffect(() => {
    const fetchTracksAndProcess = async () => {
      try {
        const response = await fetch('/Monitoring/dummy/unit_tracks.json');
        const data = await response.json();
        
        const processedData = data.unitTracks.flatMap(unit => 
          unit.track.map((point, index) => ({
            id: `${unit.unitId}-${index}`,
            unit: unit.unitId,
            ...point,
            // Inject random speed for realistic underspeed scenario
            speed: Math.floor(Math.random() * 50), 
          }))
        );
        setRealisticDummyData(processedData);
      } catch (error) {
        console.error("Failed to load and process dummy track data:", error);
      }
    };

    fetchTracksAndProcess();
  }, []);

  const handleBukaTutupFilter = () => {
    setApakahModalFilterBuka(!apakahModalFilterBuka);
  };

  const handleBukaLayer = (event) => {
    setAnchorElLayer(event.currentTarget);
  };

  const handleTutupLayer = () => {
    setAnchorElLayer(null);
  };

  const handleLayerChange = (event) => {
    setLayerState({
      ...layerState,
      [event.target.name]: event.target.checked,
    });
  };

  const handleApplyFilter = (filters) => {
    console.log('Menerapkan filter:', filters);
    // Use the realistic dummy data loaded from JSON
    setUnderspeedData(realisticDummyData);

    const uniqueUnits = [...new Set(realisticDummyData.map(d => d.unit))];
    const initialUnitVisibility = Object.fromEntries(uniqueUnits.map(unit => [unit, true]));
    setUnitVisibility(initialUnitVisibility);
  };

  const handleSpeedVisibilityChange = (newVisibility) => {
    setSpeedVisibility(newVisibility);
  };

  const handleUnitVisibilityChange = (newVisibility) => {
    setUnitVisibility(newVisibility);
  };

  const apakahPanelLayerBuka = Boolean(anchorElLayer);

  return (
    <Box 
      sx={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <MapContainer 
        layerState={layerState} 
        district={district} 
        underspeedData={underspeedData} 
        speedVisibility={speedVisibility}
        unitVisibility={unitVisibility}
        speedRanges={speedRanges}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
      />

      {/* Kontainer untuk tombol-tombol mengambang */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1300, // Ensure buttons are on top
          display: 'flex',
          gap: 1,
        }}
      >
        <TombolFilter onClick={handleBukaTutupFilter} />
        <TombolLayer onClick={handleBukaLayer} />
      </Box>

      {/* Underspeed Controls, positioned on the right */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1300, // Ensure it's on top
          width: 280, // Fixed width for the control panel
        }}
      >
        <UnderspeedControls
          speedRanges={speedRanges}
          visibility={speedVisibility}
          onVisibilityChange={handleSpeedVisibilityChange}
          unitVisibility={unitVisibility}
          onUnitVisibilityChange={handleUnitVisibilityChange}
        />
      </Box>
      
      {/* Modal dan Panel */}
      <FilterModal 
        open={apakahModalFilterBuka} 
        handleClose={handleBukaTutupFilter} 
        onApplyFilter={handleApplyFilter}
      />
      <PanelLayer 
        open={apakahPanelLayerBuka}
        anchorEl={anchorElLayer}
        handleClose={handleTutupLayer}
        layerState={layerState}
        onLayerChange={handleLayerChange}
      />
    </Box>
  );
};

export default UnderspeedPeta;
