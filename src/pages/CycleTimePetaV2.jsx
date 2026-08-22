import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import { FlyToInterpolator, LinearInterpolator } from '@deck.gl/core';
import TombolFilter from '../components/peta/TombolFilter';
import TombolLayer from '../components/peta/TombolLayer';
import FilterModal from '../components/modals/FilterModal';
import PanelLayer from '../components/peta/PanelLayer';
import MapContainerLite from '../components/peta/MapContainerLite';
import StateOverlay from '../components/peta/StateOverlay';
import useCycleTimeStore from '../stores/cycleTimeStore';
import useUserStore from '../stores/userStore';

import PlaybackControlsV2 from '../components/cycletime/PlaybackControlsV2';
import AnalyticsCard from '../components/cycletime/AnalyticsCard';
import PlaybackInfoOverlay from '../components/cycletime/PlaybackInfoOverlay';
import MapTooltip from '../components/shared/MapTooltip';
import TrailLegend from '../components/cycletime/TrailLegend';
import { useRenderCounter } from '../hooks/usePlaybackPerfDebug';

// PoC: same feature as CycleTimePeta, wired to MapContainerLite (no maplibre-gl,
// no redundant base-tiles raster source, deck.gl-only TileLayer for the ortho
// raster) + per-field store selectors and useCallback'd handlers.
//
// Two things this component deliberately does NOT do, both for the same reason
// (keeping high-frequency values out of the page's render):
//
//  1. It does not call useReplayVisualizationV2 — that hook subscribes to the
//     RAF-frequency playhead (playbackAnimationRuntime.js) and is called from
//     inside MapContainerLite instead. Only currentProgress (Zustand, throttled
//     to ~1/s) is read here, for the camera-follow effect.
//  2. It does not hold the map's viewState. deck.gl's controller owns the
//     camera; this component only emits low-frequency `cameraCommand` objects
//     for programmatic moves. Holding viewState here meant a full page +
//     MUI/Emotion re-render on every pointermove of a drag.
const FOCUS_TRANSITION = {
  zoom: 16,
  pitch: 0,
  transitionDuration: 1200,
  transitionInterpolator: new FlyToInterpolator(),
};

const FOLLOW_INTERPOLATOR = new LinearInterpolator(['longitude', 'latitude']);
const FOLLOW_THROTTLE_MS = 800;

const CycleTimePetaV2 = () => {
  useRenderCounter('CycleTimePetaV2 (page)');
  const [apakahModalFilterBuka, setApakahModalFilterBuka] = useState(false);
  const [anchorElLayer, setAnchorElLayer] = useState(null);
  const district = useUserStore((state) => state.profile?.distrik);
  const [layerState, setLayerState] = useState({
    orthophoto: true,
    roads: true,
    boundaries: true,
    exRadius: false,
  });

  // Not the camera — just the pending programmatic move. Changing this object
  // tells MapContainerLite to jump/fly; user pans and zooms never touch it.
  const [cameraCommand, setCameraCommand] = useState(null);

  const [tooltip, setTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);

  const isLoading = useCycleTimeStore((state) => state.isLoading);
  const error = useCycleTimeStore((state) => state.error);
  const previewWarning = useCycleTimeStore((state) => state.previewWarning);
  const trackingData = useCycleTimeStore((state) => state.trackingData);
  const searchAttempted = useCycleTimeStore((state) => state.searchAttempted);
  const selectedHauler = useCycleTimeStore((state) => state.selectedHauler);
  const currentProgress = useCycleTimeStore((state) => state.currentProgress);
  const autoFollow = useCycleTimeStore((state) => state.autoFollow);
  const getStatusText = useCycleTimeStore((state) => state.getStatusText);
  const getCurrentTrackingPoint = useCycleTimeStore((state) => state.getCurrentTrackingPoint);
  const playbackV2 = useCycleTimeStore((state) => state.playbackV2);

  const playbackLoadingLabel = playbackV2.state === 'queued'
    ? `Antre query... ${playbackV2.progress || 0}%`
    : playbackV2.state === 'running'
      ? `Memproses data... ${playbackV2.progress || 0}%`
      : 'Memuat Data...';

  const handleTrailHover = useCallback((info, event) => {
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
  }, [getStatusText]);

  const hasData = trackingData && trackingData.length > 0;

  // Fly to a newly selected hauler's first point.
  useEffect(() => {
    if (!selectedHauler || !trackingData?.length) return;
    const firstPoint = trackingData.find(point => point.unitNo === selectedHauler);
    if (!firstPoint) return;
    setCameraCommand({
      longitude: firstPoint.longitude,
      latitude: firstPoint.latitude,
      ...FOCUS_TRANSITION,
    });
  }, [selectedHauler, trackingData]);

  // Auto-follow. currentProgress is the throttled (~1/s) Zustand field, not the
  // RAF playhead, so this effect runs about once a second at most; the ref gate
  // keeps it there even if the store ticks faster.
  const lastCameraUpdateRef = useRef(0);

  useEffect(() => {
    if (!autoFollow || !selectedHauler || !trackingData?.length || currentProgress <= 0) return;
    if (Date.now() - lastCameraUpdateRef.current < FOLLOW_THROTTLE_MS) return;

    const currentPoint = getCurrentTrackingPoint();
    if (!currentPoint?.longitude || !currentPoint?.latitude) return;

    lastCameraUpdateRef.current = Date.now();
    setCameraCommand({
      longitude: currentPoint.longitude,
      latitude: currentPoint.latitude,
      transitionDuration: 600,
      transitionInterpolator: FOLLOW_INTERPOLATOR,
    });
  }, [selectedHauler, currentProgress, trackingData, autoFollow, getCurrentTrackingPoint]);

  const handleBukaFilter = useCallback(() => setApakahModalFilterBuka(true), []);
  const handleTutupFilter = useCallback(() => setApakahModalFilterBuka(false), []);
  const handleBukaLayer = useCallback((event) => setAnchorElLayer(event.currentTarget), []);
  const handleTutupLayer = useCallback(() => setAnchorElLayer(null), []);
  const handleLayerChange = useCallback((event) => {
    setLayerState((prev) => ({ ...prev, [event.target.name]: event.target.checked }));
  }, []);

  const apakahPanelLayerBuka = Boolean(anchorElLayer);
  const ANALYTICS_CARD_WIDTH = 280;
  const ANALYTICS_CARD_MARGIN = 16;

  const showDataComponents = searchAttempted && hasData && !isLoading && !error;

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainerLite
        layerState={layerState}
        district={district}
        cameraCommand={cameraCommand}
        onTrailHover={handleTrailHover}
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
            <Box sx={{ flexGrow: 4 }} />
            <TrailLegend />
            <PlaybackControlsV2 />
          </Box>
          <AnalyticsCard />
        </>
      )}

      <MapTooltip tooltip={tooltip} position={tooltipPosition} />
    </Box>
  );
};

export default CycleTimePetaV2;
