import React, { useState, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import { ScatterplotLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';
import TombolFilter from '../components/peta/TombolFilter';
import TombolLayer from '../components/peta/TombolLayer';
import FilterModal from '../components/modals/FilterModal';
import PanelLayer from '../components/peta/PanelLayer';
import MapContainer from '../components/peta/MapContainer';
import PitStopSummaryCard from '../components/durasipitstop/PitStopSummaryCard';
import PitStopEventPopup from '../components/durasipitstop/PitStopEventPopup';
import useCycleTimeStore from '../stores/cycleTimeStore';
import useUserStore from '../stores/userStore';

// Hindari fragmentasi event akibat GPS jitter di tepi polygon
const MIN_DURATION_SECONDS = 30;
const MERGE_GAP_SECONDS = 60;

const formatPitStopName = (name) => {
  if (!name || name === '0') return 'Pit Stop Tanpa Nama';
  return name.replace(/\b\w/g, c => c.toUpperCase());
};

const DurasiPitStopPeta = () => {
  const [apakahModalFilterBuka, setApakahModalFilterBuka] = useState(false);
  const [anchorElLayer, setAnchorElLayer] = useState(null);
  const district = useUserStore((state) => state.profile?.distrik);
  const [layerState, setLayerState] = useState({
    orthophoto: true,
    roads: false,
    boundaries: false,
    exRadius: false,
    pitStops: true,
  });
  const [viewState, setViewState] = useState({
    longitude: 117.28, latitude: 1.91, zoom: 13, pitch: 0, bearing: 0,
  });

  const [pitStopGeoJson, setPitStopGeoJson] = useState(null);
  const [pitStopPolygons, setPitStopPolygons] = useState([]);
  const [summaryData, setSummaryData] = useState({});
  const [pitStopEvents, setPitStopEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const { trackingData, isLoading } = useCycleTimeStore();

  // Load pit stop polygons dari KML sekali saat mount
  useEffect(() => {
    const loadKml = async () => {
      try {
        const res = await fetch('/Monitoring/kml/durasipitstop/pitstops.kml');
        if (!res.ok) return;
        const kmlText = await res.text();
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
        const placemarks = Array.from(kmlDoc.getElementsByTagName('Placemark'));

        const features = placemarks.map(pm => {
          const nameEl = pm.getElementsByTagName('name')[0];
          const coordsEl = pm.getElementsByTagName('coordinates')[0];
          if (!nameEl || !coordsEl?.textContent) return null;

          const coords = coordsEl.textContent.trim()
            .split(/\s+/)
            .map(s => { const [lon, lat] = s.split(',').map(Number); return [lon, lat]; })
            .filter(c => !isNaN(c[0]) && !isNaN(c[1]));

          if (coords.length < 3) return null;

          if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])
            coords.push(coords[0]);

          return turf.polygon([coords], { name: nameEl.textContent });
        }).filter(Boolean);

        const fc = turf.featureCollection(features);
        setPitStopGeoJson(fc);
        setPitStopPolygons(features.map(f => ({ name: f.properties.name, polygon: f })));
      } catch {
        // KML tidak tersedia, lanjutkan tanpa pitstop layer
      }
    };
    loadKml();
  }, []);

  // Hitung durasi pitstop saat trackingData berubah (setelah filter diterapkan)
  useEffect(() => {
    if (!trackingData?.length || !pitStopPolygons.length) {
      setSummaryData({});
      setPitStopEvents([]);
      return;
    }

    const byUnit = {};
    for (const pt of trackingData) {
      const key = pt.unitNo;
      if (!byUnit[key]) byUnit[key] = [];
      byUnit[key].push(pt);
    }
    for (const key of Object.keys(byUnit)) {
      byUnit[key].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    const newSummary = {};
    const newEvents = [];

    for (const [unitId, points] of Object.entries(byUnit)) {
      const raw = [];
      let currentPitStop = null;
      let entryTime = null;
      let entryPoint = null;

      const closeEvent = (exitTimestamp) => {
        raw.push({
          pitStopName: currentPitStop,
          startTime: entryTime,
          endTime: new Date(exitTimestamp),
          lon: entryPoint.longitude,
          lat: entryPoint.latitude,
        });
        currentPitStop = null;
        entryTime = null;
        entryPoint = null;
      };

      for (const point of points) {
        const pt = turf.point([point.longitude, point.latitude]);
        const inside = pitStopPolygons.find(p => turf.booleanPointInPolygon(pt, p.polygon));

        if (inside && !currentPitStop) {
          currentPitStop = inside.name;
          entryTime = new Date(point.timestamp);
          entryPoint = point;
        } else if (inside && currentPitStop && inside.name !== currentPitStop) {
          closeEvent(point.timestamp);
          currentPitStop = inside.name;
          entryTime = new Date(point.timestamp);
          entryPoint = point;
        } else if (!inside && currentPitStop) {
          closeEvent(point.timestamp);
        }
      }

      if (currentPitStop && entryTime && entryPoint) {
        const lastTs = points[points.length - 1].timestamp;
        closeEvent(lastTs);
      }

      // Gabungkan dua event ke polygon sama jika gap exit->reentry < MERGE_GAP_SECONDS
      const merged = [];
      for (const e of raw) {
        const last = merged[merged.length - 1];
        if (last && last.pitStopName === e.pitStopName) {
          const gap = (e.startTime - last.endTime) / 1000;
          if (gap <= MERGE_GAP_SECONDS) {
            last.endTime = e.endTime;
            continue;
          }
        }
        merged.push({ ...e });
      }

      // Buang event yang lebih pendek dari MIN_DURATION_SECONDS (kemungkinan noise)
      const filtered = merged.filter(e => (e.endTime - e.startTime) / 1000 >= MIN_DURATION_SECONDS);

      newSummary[unitId] = filtered.map(e => ({
        pitStopName: e.pitStopName,
        startTime: e.startTime,
        endTime: e.endTime,
        durationMs: e.endTime - e.startTime,
        lon: e.lon,
        lat: e.lat,
      }));

      newEvents.push(...filtered.map(e => ({
        unitId,
        pitStopName: e.pitStopName,
        startTime: e.startTime,
        endTime: e.endTime,
        durationMs: e.endTime - e.startTime,
        lon: e.lon,
        lat: e.lat,
      })));
    }

    setSummaryData(newSummary);
    setPitStopEvents(newEvents);
  }, [trackingData, pitStopPolygons]);

  const traceDotLayers = useMemo(() => {
    if (!pitStopEvents.length) return [];
    return [
      new ScatterplotLayer({
        id: 'pit-stop-trace-dots',
        data: pitStopEvents,
        getPosition: d => [d.lon, d.lat],
        getRadius: 10,
        radiusMinPixels: 7,
        radiusMaxPixels: 16,
        getFillColor: [16, 185, 129, 230],
        getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true,
        onClick: (info) => {
          if (info.object) {
            setSelectedEvent({
              ...info.object,
              x: info.x,
              y: info.y,
            });
          }
        },
      })
    ];
  }, [pitStopEvents]);

  const handleRowClick = (event) => {
    if (event?.lon == null || event?.lat == null) return;
    setViewState(prev => ({
      ...prev,
      longitude: event.lon,
      latitude: event.lat,
      zoom: Math.max(prev.zoom || 16, 17),
      transitionDuration: 800,
    }));
    setSelectedEvent({ ...event, x: null, y: null });
  };

  const handleBukaTutupFilter = () => setApakahModalFilterBuka(prev => !prev);
  const handleBukaLayer = (e) => setAnchorElLayer(e.currentTarget);
  const handleTutupLayer = () => setAnchorElLayer(null);
  const handleLayerChange = (e) => setLayerState(prev => ({ ...prev, [e.target.name]: e.target.checked }));

  const mapHeight = panelOpen ? '55%' : 'calc(100% - 48px)';
  const panelHeight = panelOpen ? '45%' : '48px';

  return (
    <Box sx={{ flexGrow: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ position: 'relative', height: mapHeight, transition: 'height 0.3s ease', minHeight: 0 }}>
        <MapContainer
          layerState={layerState}
          district={district}
          kmlContext="durasipitstop"
          pitStopData={pitStopGeoJson}
          viewState={viewState}
          onViewStateChange={({ viewState: vs }) => setViewState(vs)}
          replayLayers={traceDotLayers}
        />

        <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1300, display: 'flex', gap: 1 }}>
          <TombolFilter onClick={handleBukaTutupFilter} />
          <TombolLayer onClick={handleBukaLayer} />
        </Box>

        <FilterModal open={apakahModalFilterBuka} handleClose={handleBukaTutupFilter} />
        <PanelLayer
          open={Boolean(anchorElLayer)}
          anchorEl={anchorElLayer}
          handleClose={handleTutupLayer}
          layerState={layerState}
          onLayerChange={handleLayerChange}
        />

        {selectedEvent && selectedEvent.x != null && (
          <PitStopEventPopup
            event={selectedEvent}
            formatPitStopName={formatPitStopName}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </Box>

      <Box sx={{ height: panelHeight, transition: 'height 0.3s ease', flexShrink: 0 }}>
        <PitStopSummaryCard
          summaryData={summaryData}
          totalEvents={pitStopEvents.length}
          formatPitStopName={formatPitStopName}
          onRowClick={handleRowClick}
          isLoading={isLoading}
          open={panelOpen}
          onToggle={() => setPanelOpen(prev => !prev)}
        />
      </Box>
    </Box>
  );
};

export default DurasiPitStopPeta;
