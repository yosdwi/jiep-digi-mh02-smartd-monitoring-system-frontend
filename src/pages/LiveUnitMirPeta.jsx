import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import TombolFilter from '../components/peta/TombolFilter';
import TombolLayer from '../components/peta/TombolLayer';
import PanelLayer from '../components/peta/PanelLayer';
import MapContainer from '../components/peta/MapContainer';
import { LiveUnitCard } from '../components/liveunit/LiveUnitCard';
import { UnitSearchBar } from '../components/search/UnitSearchBar';
import { UnitFilterModal } from '../components/modals/UnitFilterModal';
import { ActiveFiltersDisplay } from '../components/peta/ActiveFiltersDisplay';
import { useMirLayers } from '../hooks/useMirLayers';
import { useMirTrackingLogic } from '../hooks/useMirTrackingLogic';
import { useSmoothedUnits } from '../hooks/useSmoothedUnits';
import { ZoomOutButton } from '../components/peta/ZoomOutButton';
import { ResetViewButton } from '../components/peta/ResetViewButton';
import useUserStore from '../stores/userStore';
import { MQTT_TOPIC, getMqttBrokerUrl } from '../config/mqttConfig';
import mqtt from 'mqtt';

const MAX_TRAIL_LENGTH = 200;
const ALL_UNIT_TYPES = ['DT', 'EX'];

const INITIAL_VIEW_STATE = {
  longitude: 117.28, latitude: 1.91, zoom: 13, pitch: 0, bearing: 0, transitionDuration: 1000
};

const MIR_DEFAULT_LAYER_STATE = {
  orthophoto: true, roads: false, boundaries: false, exRadius: false,
  pitStops: false, mirDumpingAreas: true,
};

const LiveUnitMirPeta = () => {
  const location = useLocation();
  const [anchorElLayer, setAnchorElLayer] = useState(null);
  const district = useUserStore((state) => state.profile?.distrik);
  const [layerState, setLayerState] = useState(MIR_DEFAULT_LAYER_STATE);
  const [smoothedUnits, updateUnitPosition] = useSmoothedUnits();
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [liveTrails, setLiveTrails] = useState({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState({ unitTypes: ALL_UNIT_TYPES, status: 'all' });

  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [previousViewState, setPreviousViewState] = useState(null);
  const clientRef = useRef(null);

  const mirGeofenceLayers = useMirLayers();
  const { mirVisualLayers, selectedUnitMirData } = useMirTrackingLogic(smoothedUnits, mirGeofenceLayers, selectedUnitId);

  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    // Prevents double connection in React Strict Mode
    if (clientRef.current) {
      return;
    }

    const brokerUrl = getMqttBrokerUrl(district);
    if (!brokerUrl) {
      console.warn(`MQTT broker URL not configured for district: ${district || '(empty)'}`);
      return;
    }

    const newClient = mqtt.connect(brokerUrl);
    clientRef.current = newClient;

    newClient.on('connect', () => {
      console.log('MQTT Connected!');
      newClient.subscribe(MQTT_TOPIC, (err) => {
        if (err) {
          console.error('Subscription failed:', err);
        } else {
          console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
        }
      });
    });

    newClient.on('message', (_, message) => {
      try {
        const rawUnitData = JSON.parse(message.toString());
        const currentFilters = filtersRef.current;
        const typeMatch = currentFilters.unitTypes.includes(rawUnitData.devicetype);

        if (rawUnitData && rawUnitData.deviceid && typeMatch) {
          const mappedUnitData = {
            deviceId: rawUnitData.deviceid,
            unitNo: rawUnitData.unitno,
            deviceType: rawUnitData.devicetype,
            gpsLong: rawUnitData.gpslong || rawUnitData.longitude,
            latitude: rawUnitData.gpslat || rawUnitData.latitude,
            longitude: rawUnitData.gpslong || rawUnitData.longitude,
            gpsLat: rawUnitData.gpslat || rawUnitData.latitude,
            lastSpeed: rawUnitData.VehicleSpeed,
            timestamp: rawUnitData.heartbeat * 1000,
            ...rawUnitData
          };
          updateUnitPosition(mappedUnitData);
        }
      } catch (e) {
        console.error("Error parsing MQTT message:", e);
      }
    });

    newClient.on('error', (err) => console.error('MQTT Connection error:', err));
    newClient.on('reconnect', () => console.log('MQTT Reconnecting...'));

    // Cleanup on component unmount
    return () => {
      if (newClient) {
        console.log('MQTT Disconnecting...');
        newClient.end();
        clientRef.current = null;
      }
    };
  }, [district]); // Reconnect when district (from user session) becomes available.

  // Efek untuk mengupdate jejak unit yang dipilih
  useEffect(() => {
    if (selectedUnitId && smoothedUnits[selectedUnitId]) {
      const unit = smoothedUnits[selectedUnitId];
      setLiveTrails(prev => {
        const trail = prev[unit.deviceId] || [];
        // Hindari duplikat titik terakhir
        const lastPoint = trail[trail.length - 1];
        if (lastPoint && lastPoint[0] === unit.longitude && lastPoint[1] === unit.latitude) {
          return prev;
        }

        const newTrail = [...trail, [unit.longitude, unit.latitude]];
        if (newTrail.length > MAX_TRAIL_LENGTH) {
          newTrail.shift();
        }
        return { ...prev, [unit.deviceId]: newTrail };
      });
    }
  }, [selectedUnitId, smoothedUnits]);

  const filteredUnits = useMemo(() => {
    const filterUnitTypes = new Set(filters.unitTypes);
    const unitsArray = Object.values(smoothedUnits);

    if (unitsArray.length === 0) return [];

    return unitsArray.filter(unit => {
      if (!unit) return false;
      const typeMatch = filterUnitTypes.has(unit.deviceType);
      const statusMatch = filters.status === 'all' ||
                          (filters.status === 'running' && unit.lastSpeed > 0) ||
                          (filters.status === 'stop' && unit.lastSpeed === 0);
      return typeMatch && statusMatch;
    });
  }, [smoothedUnits, filters]);

  const handleApplyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    setIsFilterModalOpen(false);
  }, []);

  const handleClearFilter = useCallback((type, value) => {
    setFilters(prev => {
      if (type === 'unitType') {
        const newUnitTypes = prev.unitTypes.filter(t => t !== value);
        return { ...prev, unitTypes: newUnitTypes.length > 0 ? newUnitTypes : ALL_UNIT_TYPES };
      }
      if (type === 'status') return { ...prev, status: 'all' };
      return prev;
    });
  }, []);
  
  const handleUnitClick = useCallback((info) => {
    if (info && info.object) {
      const { deviceId, longitude, latitude } = info.object;
      setSelectedUnitId(deviceId);
      setLiveTrails(prev => ({ ...prev, [deviceId]: [[longitude, latitude]] }));

      // Zoom to the unit location
      setViewState(v => ({
        ...v,
        longitude: longitude,
        latitude: latitude,
        zoom: Math.max(v.zoom, 16), // Zoom to at least level 16
        transitionDuration: 1500
      }));

      return true;
    }
    return false;
  }, []);

  const handleMapClick = useCallback((info) => {
    if (!info.object) {
      setSelectedUnitId(null);
      setLiveTrails({});
    }
  }, []);

  const handleSearchSelect = useCallback((unit) => {
    setSelectedUnitId(unit.deviceId);
    setLiveTrails(prev => ({ ...prev, [unit.deviceId]: [[unit.longitude, unit.latitude]] }));
    setViewState(v => ({
      ...v, longitude: unit.longitude, latitude: unit.latitude, zoom: 16, transitionDuration: 2000
    }));
  }, []);

  const handleCloseCard = useCallback(() => {
    setLiveTrails(prev => {
      const newTrails = { ...prev };
      if (selectedUnitId) delete newTrails[selectedUnitId];
      return newTrails;
    });
    setSelectedUnitId(null);
  }, [selectedUnitId]);

  const handleBukaLayer = (event) => setAnchorElLayer(event.currentTarget);
  const handleTutupLayer = () => setAnchorElLayer(null);
  const handleLayerChange = (event) => setLayerState({ ...layerState, [event.target.name]: event.target.checked });
  
  const handleZoomToCluster = useCallback((newViewState) => {
    setPreviousViewState(viewState);
    setViewState(newViewState);
  }, [viewState]);

  const handleZoomOut = useCallback(() => {
    setViewState({...previousViewState, transitionDuration: 1000});
    setPreviousViewState(null);
  }, [previousViewState]);

  const handleResetView = useCallback(() => {
    setViewState(INITIAL_VIEW_STATE);
    setPreviousViewState(null);
  }, []);
  
  const selectedUnitData = selectedUnitId ? smoothedUnits[selectedUnitId] : null;
  const allTrailsArray = Object.values(liveTrails);
  const apakahPanelLayerBuka = Boolean(anchorElLayer);

  const allLayers = useMemo(() => {
    let layers = [...mirVisualLayers];
    if (layerState.mirDumpingAreas) {
      layers = [...layers, ...mirGeofenceLayers];
    }
    return layers;
  }, [layerState.mirDumpingAreas, mirGeofenceLayers, mirVisualLayers]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        layerState={layerState}
        district={district}
        liveUnitData={filteredUnits}
        liveTrailsData={allTrailsArray}
        onUnitClick={handleUnitClick}
        onMapClick={handleMapClick}
        viewState={viewState}
        onViewStateChange={e => setViewState(e.viewState)}
        onSetViewState={handleZoomToCluster}
        replayLayers={allLayers}
      />
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1300, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <UnitSearchBar units={filteredUnits} onUnitSelect={handleSearchSelect} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', gap: 1}}>
            <TombolFilter onClick={() => setIsFilterModalOpen(true)} />
            <TombolLayer onClick={handleBukaLayer} />
          </Box>
          <ActiveFiltersDisplay filters={filters} onClearFilter={handleClearFilter} />
        </Box>
      </Box>
      <LiveUnitCard 
        unitData={selectedUnitData} 
        onClose={handleCloseCard} 
        mirData={selectedUnitMirData}
      />
      <PanelLayer 
        open={apakahPanelLayerBuka}
        anchorEl={anchorElLayer}
        handleClose={handleTutupLayer}
        layerState={layerState}
        onLayerChange={handleLayerChange}
        isMirPage={true}
      />
      {previousViewState && <ZoomOutButton onClick={handleZoomOut} />}
      <ResetViewButton onClick={handleResetView} />
      <UnitFilterModal 
        open={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        currentFilters={filters}
        onApply={handleApplyFilters}
      />
    </Box>
  );
};

export default LiveUnitMirPeta;
