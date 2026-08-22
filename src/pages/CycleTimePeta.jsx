import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import TombolFilter from '../components/peta/TombolFilter';
import TombolLayer from '../components/peta/TombolLayer';
import FilterModal from '../components/modals/FilterModal';
import PanelLayer from '../components/peta/PanelLayer';
import MapContainer from '../components/peta/MapContainer';
import StateOverlay from '../components/peta/StateOverlay';
import useCycleTimeStore from '../stores/cycleTimeStore';
import useUserStore from '../stores/userStore';

import PlaybackControls from '../components/cycletime/PlaybackControls';
import AnalyticsCard from '../components/cycletime/AnalyticsCard';
import PlaybackInfoOverlay from '../components/cycletime/PlaybackInfoOverlay';
import useReplayVisualization from '../hooks/useReplayVisualization';
import MapTooltip from '../components/shared/MapTooltip';
import TrailLegend from '../components/cycletime/TrailLegend';

const CycleTimePeta = () => {
  const [apakahModalFilterBuka, setApakahModalFilterBuka] = useState(false);
  const [anchorElLayer, setAnchorElLayer] = useState(null);
  const district = useUserStore((state) => state.profile?.distrik);
  const [layerState, setLayerState] = useState({
    orthophoto: true,
    roads: true,
    boundaries: true,
    exRadius: false,
  });

  const [viewState, setViewState] = useState({
    longitude: 117.28, latitude: 1.91, zoom: 13, pitch: 0, bearing: 0,
  });

  // Tooltip state
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);

  const {
    isLoading,
    error,
    previewWarning,
    trackingData,
    searchAttempted,
    selectedHauler,
    currentProgress,
    autoFollow, // Add autoFollow state
    getStatusText, // Mengambil fungsi dari store
    getCurrentTrackingPoint,
    playbackV2,
  } = useCycleTimeStore();

  const playbackLoadingLabel = playbackV2.state === 'queued'
    ? `Antre query... ${playbackV2.progress || 0}%`
    : playbackV2.state === 'running'
      ? `Memproses data... ${playbackV2.progress || 0}%`
      : 'Memuat Data...';

  // Tooltip handlers for trails
  const handleTrailHover = (info, event) => {
    if (info.object?.hauler && info.coordinate && info.object.pointsData) {
      const closest = info.object.pointsData.reduce((best, point) => {
        const dist = Math.abs(info.coordinate[0] - point.longitude) +
                    Math.abs(info.coordinate[1] - point.latitude);
        return dist < best.distance ? { point, distance: dist } : best;
      }, { distance: Infinity, point: null });

      if (closest?.point) {
        const speed = closest.point.speed || closest.point.vehiclespeed || 0;
        const time = new Date(closest.point.timestamp).toLocaleTimeString('id-ID', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        // Menerjemahkan status angka ke teks
        const status = getStatusText(closest.point.status); 

        setTooltip({ hauler: info.object.hauler, time, speed, status });
        const x = (event.srcEvent?.clientX || event.offsetCenter?.x || 0);
        const y = (event.srcEvent?.clientY || event.offsetCenter?.y || 0);
        setTooltipPosition({ x, y });
      }
    } else {
      setTooltip(null);
      setTooltipPosition(null);
    }
  };

  const replayLayers = useReplayVisualization(viewState, handleTrailHover, setViewState);
  const hasData = trackingData && trackingData.length > 0;

  // Auto fly to selected hauler when first selected
  useEffect(() => {
    if (selectedHauler && trackingData?.length > 0) {
      const haulerData = trackingData.filter(point => point.unitNo === selectedHauler);
      if (haulerData.length > 0) {
        const firstPoint = haulerData[0];
        setViewState(prevState => ({
          ...prevState,
          longitude: firstPoint.longitude,
          latitude: firstPoint.latitude,
          zoom: 16,
          pitch: 0,
          transitionDuration: 1500,
          transitionEasing: t => t * (2 - t) // ease out
        }));
      }
    }
  }, [selectedHauler, trackingData]);

  const lastCameraUpdateRef = useRef(0);
  const cameraUpdateThrottleRef = useRef(null);

  const smoothCameraFollow = useCallback((position) => {
    if (cameraUpdateThrottleRef.current) {
      clearTimeout(cameraUpdateThrottleRef.current);
    }

    cameraUpdateThrottleRef.current = setTimeout(() => {
      setViewState(prevState => ({
        ...prevState,
        longitude: position.longitude,
        latitude: position.latitude,
        transitionDuration: 500,
        transitionInterpolator: null
      }));
      lastCameraUpdateRef.current = Date.now();
    }, 150);
  }, []);

  useEffect(() => {
    // Only follow if autoFollow is enabled
    if (selectedHauler && trackingData?.length > 0 && currentProgress > 0 && autoFollow) {
      const currentPoint = getCurrentTrackingPoint();

      if (currentPoint && currentPoint.longitude && currentPoint.latitude) {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastCameraUpdateRef.current;

        if (timeSinceLastUpdate >= 800) {
          smoothCameraFollow(currentPoint);
        }
      }
    }

    return () => {
      if (cameraUpdateThrottleRef.current) {
        clearTimeout(cameraUpdateThrottleRef.current);
      }
    };
  }, [selectedHauler, currentProgress, trackingData, smoothCameraFollow, autoFollow, getCurrentTrackingPoint]);

  const handleBukaFilter = () => setApakahModalFilterBuka(true);
  const handleTutupFilter = () => setApakahModalFilterBuka(false);
  const handleBukaLayer = (event) => setAnchorElLayer(event.currentTarget);
  const handleTutupLayer = () => setAnchorElLayer(null);
  const handleLayerChange = (event) => setLayerState({ ...layerState, [event.target.name]: event.target.checked });
  const handleViewStateChange = ({ viewState: newViewState }) => setViewState(newViewState);

  const apakahPanelLayerBuka = Boolean(anchorElLayer);
  const ANALYTICS_CARD_WIDTH = 280;
  const ANALYTICS_CARD_MARGIN = 16;

  const showDataComponents = searchAttempted && hasData && !isLoading && !error;

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        layerState={layerState}
        district={district}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        replayLayers={replayLayers}
      />

      {!apakahModalFilterBuka && (
        <StateOverlay
          isLoading={isLoading}
          error={error}
          hasData={hasData}
          searchAttempted={searchAttempted}
          loadingLabel={playbackLoadingLabel}
        />
      )}

      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1300, display: 'flex', gap: 1 }}>
        <TombolFilter onClick={handleBukaFilter} active={apakahModalFilterBuka} />
        <TombolLayer onClick={handleBukaLayer} />
      </Box>

      {previewWarning && !isLoading && !error && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            top: 64,
            left: 16,
            zIndex: 1200,
            maxWidth: 440,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'warning.dark',
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
            fontSize: 13,
            lineHeight: 1.45,
            boxShadow: 1,
          }}
        >
          {previewWarning}
        </Box>
      )}
      
      <FilterModal open={apakahModalFilterBuka} handleClose={handleTutupFilter} />
      <PanelLayer 
        open={apakahPanelLayerBuka}
        anchorEl={anchorElLayer}
        handleClose={handleTutupLayer}
        layerState={layerState}
        onLayerChange={handleLayerChange}
      />
      
      {showDataComponents && (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: `${ANALYTICS_CARD_WIDTH + ANALYTICS_CARD_MARGIN}px`,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 0 24px 0',
              '& > *': {
                pointerEvents: 'auto',
              },
            }}
          >
            <PlaybackInfoOverlay />
            <Box sx={{ flexGrow: 4 }} /> {/* Spacer */}
            <TrailLegend />
            <PlaybackControls />
          </Box>
          <AnalyticsCard />
        </>
      )}

      {/* Map Tooltip */}
      <MapTooltip tooltip={tooltip} position={tooltipPosition} />
    </Box>
  );
};

export default CycleTimePeta;
