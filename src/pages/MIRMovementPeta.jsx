import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import TombolFilter from '../components/peta/TombolFilter';
import TombolLayer from '../components/peta/TombolLayer';
import TombolDiagnostik from '../components/peta/TombolDiagnostik';
import MIRFilterModal from '../components/modals/MIRFilterModal';
import MIRDiagnosticPanel from '../components/mir/MIRDiagnosticPanel';
import PanelLayer from '../components/peta/PanelLayer';
import MapContainer from '../components/peta/MapContainer';
import StateOverlay from '../components/peta/StateOverlay';
import useMIRStore from '../stores/mirStore';
import useUserStore from '../stores/userStore';

import MIRLegend from '../components/mir/MIRLegend';
import MIRMapTooltip from '../components/mir/MIRMapTooltip';
import useMIRVisualization from '../hooks/useMIRVisualization';
import { useMirLayers } from '../hooks/useMirLayers';

const MIRMovementPeta = () => {
  const [apakahModalFilterBuka, setApakahModalFilterBuka] = useState(false);
  const [apakahPanelDiagnostikBuka, setApakahPanelDiagnostikBuka] = useState(false);
  const [anchorElLayer, setAnchorElLayer] = useState(null);
  const district = useUserStore((state) => state.profile?.distrik);
  const [layerState, setLayerState] = useState({
    orthophoto: true,
    roads: false,
    boundaries: false,
    exRadius: false,
  });

  const [viewState, setViewState] = useState({
    longitude: 117.28, latitude: 1.91, zoom: 13, pitch: 0, bearing: 0,
  });

  const [tooltip, setTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [filters, setFilters] = useState({
    distanceFilters: {
      'CROSSING': true,
      'FARAWAY': true,
      'ON AWARENESS': true
    },
    gpsFilters: {
      'SINGLE': true,
      'DGPS': true,
      'RTK FIX': true,
      'RTK FLOAT': true,
      'NO GPS': true
    },
    deviceFilters: {},
    travelDirectionFilters: {
      'FORWARD': true,
      'REVERSE': true,
      'STATIONARY': true,
    }
  });

  const {
    isLoading,
    error,
    trackingData,
    searchAttempted,
    summary,
    devices
  } = useMIRStore();

  const handleDotHover = (info, event) => {
    if (info.object && info.coordinate) {
      const point = info.object;
      const time = new Date(point.timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      setTooltip({
        deviceId: point.deviceId,
        unitNo: point.unitNo,
        time: time,
        speed: point.speed,
        distanceStatus: point.mirDistanceStatus || point.distanceStatus,
        gpsQuality: point.gpsQuality,
        // MIR distance fields
        mirDistance: point.mir_distance,
        mirInArea: point.mir_in_area,
        mirUnsafe: point.mir_unsafe
      });

      const x = (event.srcEvent?.clientX || event.offsetCenter?.x || 0);
      const y = (event.srcEvent?.clientY || event.offsetCenter?.y || 0);
      setTooltipPosition({ x, y });
    } else {
      setTooltip(null);
      setTooltipPosition(null);
    }
  };

  const mirTrackingLayers = useMIRVisualization(viewState, handleDotHover, filters);
  const mirDumpingLayers = useMirLayers();
  const allMirLayers = [...mirDumpingLayers, ...mirTrackingLayers];
  const hasData = trackingData && trackingData.length > 0;

  const handleBukaTutupFilter = () => setApakahModalFilterBuka(!apakahModalFilterBuka);
  const handleBukaLayer = (event) => setAnchorElLayer(event.currentTarget);
  const handleTutupLayer = () => setAnchorElLayer(null);
  const handleLayerChange = (event) => setLayerState({ ...layerState, [event.target.name]: event.target.checked });
  const handleViewStateChange = ({ viewState: newViewState }) => setViewState(newViewState);

  const apakahPanelLayerBuka = Boolean(anchorElLayer);
  const showDataComponents = searchAttempted && hasData && !isLoading && !error;

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        layerState={layerState}
        district={district}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        replayLayers={allMirLayers}
      />

      {!apakahModalFilterBuka && (
        <StateOverlay
          isLoading={isLoading}
          error={error}
          hasData={hasData}
          searchAttempted={searchAttempted}
        />
      )}

      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1300, display: 'flex', gap: 1 }}>
        <TombolFilter onClick={handleBukaTutupFilter} />
        <TombolLayer onClick={handleBukaLayer} />
        <TombolDiagnostik
          onClick={() => setApakahPanelDiagnostikBuka(true)}
          active={apakahPanelDiagnostikBuka}
        />
      </Box>

      <MIRFilterModal open={apakahModalFilterBuka} handleClose={handleBukaTutupFilter} />
      <MIRDiagnosticPanel
        open={apakahPanelDiagnostikBuka}
        onClose={() => setApakahPanelDiagnostikBuka(false)}
      />
      <PanelLayer
        open={apakahPanelLayerBuka}
        anchorEl={anchorElLayer}
        handleClose={handleTutupLayer}
        layerState={layerState}
        onLayerChange={handleLayerChange}
      />

      {showDataComponents && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: 400,
            pr: 2
          }}
        >
          <MIRLegend onFiltersChange={setFilters} />
        </Box>
      )}

      <MIRMapTooltip tooltip={tooltip} position={tooltipPosition} />
    </Box>
  );
};

export default MIRMovementPeta;
