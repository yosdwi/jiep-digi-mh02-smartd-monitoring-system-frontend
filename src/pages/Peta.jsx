import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import TombolFilter from '../components/peta/TombolFilter';
import TombolLayer from '../components/peta/TombolLayer';
import FilterModal from '../components/modals/FilterModal';
import PanelLayer from '../components/peta/PanelLayer';
import MapContainer from '../components/peta/MapContainer';
import { getLayerConfigForPath } from '../config/layerConfig';
import useUserStore from '../stores/userStore';

const Peta = () => {
  const location = useLocation();
  const [apakahModalFilterBuka, setApakahModalFilterBuka] = useState(false);
  const [anchorElLayer, setAnchorElLayer] = useState(null);
  const district = useUserStore((state) => state.profile?.distrik);
  const [layerState, setLayerState] = useState(getLayerConfigForPath(location.pathname));

  // --- TAMBAHKAN MANAJEMEN VIEWSTATE ---
  const [viewState, setViewState] = useState({
    longitude: 117.28,
    latitude: 1.91,
    zoom: 13,
    pitch: 0,
    bearing: 0,
  });

  const handleViewStateChange = ({ viewState: newViewState }) => {
    setViewState(newViewState);
  };
  // --- SELESAI ---

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

  const apakahPanelLayerBuka = Boolean(anchorElLayer);

  // Note: This generic Peta component does not pass any special filter handlers to FilterModal
  const handleGenericFilterApply = (filters) => {
    console.log("Generic filter applied:", filters);
    // No specific data fetching logic in the generic map
  };

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
        viewState={viewState} // Berikan state
        onViewStateChange={handleViewStateChange} // Berikan handler
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
      
      {/* Modal dan Panel */}
      <FilterModal 
        open={apakahModalFilterBuka} 
        handleClose={handleBukaTutupFilter}
        onApplyFilter={handleGenericFilterApply} // Pass a generic handler
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

export default Peta;
