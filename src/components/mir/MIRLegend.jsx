import React, { useState, useMemo } from 'react';
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  TextField, Button, FormControlLabel, Checkbox, Divider
} from '@mui/material';
import { Visibility, VisibilityOff, Search, Clear } from '@mui/icons-material';
import useMIRStore from '../../stores/mirStore';

const MIRLegend = ({ onFiltersChange }) => {
  const { summary, devices, trackingData, getDeviceList, filters: mirFilters, getTravelDirection } = useMIRStore();

  // State untuk filter status yang aktif
  const [activeFilters, setActiveFilters] = useState({
    // 'UNKNOWN': true,
    'CROSSING': true,
    'FARAWAY': true,
    'ON AWARENESS': true
  });

  const [activeGpsFilters, setActiveGpsFilters] = useState({
    'SINGLE': true,
    'DGPS': true,
    'RTK FIX': true,
    'RTK FLOAT': true,
    'NO GPS': true
  });

  const [activeTravelFilters, setActiveTravelFilters] = useState({
    'FORWARD': true,
    'REVERSE': true,
    'STATIONARY': true,
  });

  // Device filtering state
  const [deviceSearch, setDeviceSearch] = useState('');
  const [activeDeviceFilters, setActiveDeviceFilters] = useState({});

  // Hitung jumlah tiap travel direction dari trackingData
  const directionCounts = useMemo(() => {
    const counts = { FORWARD: 0, REVERSE: 0, STATIONARY: 0 };
    if (!trackingData?.length) return counts;
    trackingData.forEach(point => {
      const dir = getTravelDirection(point.vehiclespeed ?? point.speed, point.shift_indicator);
      if (dir && counts[dir] !== undefined) counts[dir]++;
    });
    return counts;
  }, [trackingData, getTravelDirection]);

  // Get unique devices from tracking data
  const availableDevices = useMemo(() => {
    if (!trackingData?.length) return [];
    const uniqueDevices = [...new Set(trackingData.map(item => item.unitNo))];
    return uniqueDevices.filter(Boolean).sort();
  }, [trackingData]);

  // Initialize device filters when devices change
  React.useEffect(() => {
    if (availableDevices.length > 0) {
      const initialDeviceFilters = {};
      availableDevices.forEach(device => {
        initialDeviceFilters[device] = true;
      });
      setActiveDeviceFilters(initialDeviceFilters);
    }
  }, [availableDevices]);

  // Filtered devices based on search
  const filteredDevices = useMemo(() => {
    return availableDevices.filter(device =>
      device.toLowerCase().includes(deviceSearch.toLowerCase())
    );
  }, [availableDevices, deviceSearch]);

  // Format date range untuk display
  const formatDateRange = () => {
    if (!mirFilters?.startDate || !mirFilters?.endDate) {
      return 'No date/time range selected';
    }

    const startDateTime = new Date(mirFilters.startDate);
    const endDateTime = new Date(mirFilters.endDate);

    // Format tanggal dan waktu
    const formatDateTime = (date) => {
      const dateStr = date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return `${dateStr} ${timeStr}`;
    };

    const startFormatted = formatDateTime(startDateTime);
    const endFormatted = formatDateTime(endDateTime);

    // Check apakah sama hari
    const isSameDay = startDateTime.toDateString() === endDateTime.toDateString();

    if (isSameDay) {
      const dateStr = startDateTime.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const startTime = startDateTime.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const endTime = endDateTime.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return `${dateStr} (${startTime} - ${endTime})`;
    }

    return `${startFormatted} - ${endFormatted}`;
  };

  const updateFilters = () => {
    onFiltersChange?.({
      distanceFilters: activeFilters,
      gpsFilters: activeGpsFilters,
      deviceFilters: activeDeviceFilters,
      travelDirectionFilters: activeTravelFilters,
    });
  };

  const toggleFilter = (status) => {
    const newFilters = { ...activeFilters, [status]: !activeFilters[status] };
    setActiveFilters(newFilters);
    onFiltersChange?.({ distanceFilters: newFilters, gpsFilters: activeGpsFilters, deviceFilters: activeDeviceFilters, travelDirectionFilters: activeTravelFilters });
  };

  const toggleGpsFilter = (quality) => {
    const newGpsFilters = { ...activeGpsFilters, [quality]: !activeGpsFilters[quality] };
    setActiveGpsFilters(newGpsFilters);
    onFiltersChange?.({ distanceFilters: activeFilters, gpsFilters: newGpsFilters, deviceFilters: activeDeviceFilters, travelDirectionFilters: activeTravelFilters });
  };

  const toggleTravelFilter = (direction) => {
    const newTravelFilters = { ...activeTravelFilters, [direction]: !activeTravelFilters[direction] };
    setActiveTravelFilters(newTravelFilters);
    onFiltersChange?.({ distanceFilters: activeFilters, gpsFilters: activeGpsFilters, deviceFilters: activeDeviceFilters, travelDirectionFilters: newTravelFilters });
  };

  const toggleDeviceFilter = (device) => {
    const newDeviceFilters = { ...activeDeviceFilters, [device]: !activeDeviceFilters[device] };
    setActiveDeviceFilters(newDeviceFilters);
    onFiltersChange?.({ distanceFilters: activeFilters, gpsFilters: activeGpsFilters, deviceFilters: newDeviceFilters, travelDirectionFilters: activeTravelFilters });
  };

  const clearSearch = () => {
    setDeviceSearch('');
  };

  const resetAllFilters = () => {
    const allActiveDistance = {};
    Object.keys(activeFilters).forEach(key => { allActiveDistance[key] = true; });
    const allActiveGps = {};
    Object.keys(activeGpsFilters).forEach(key => { allActiveGps[key] = true; });
    const allActiveTravel = { FORWARD: true, REVERSE: true, STATIONARY: true };
    const allActiveDevices = {};
    availableDevices.forEach(device => { allActiveDevices[device] = true; });

    setActiveFilters(allActiveDistance);
    setActiveGpsFilters(allActiveGps);
    setActiveTravelFilters(allActiveTravel);
    setActiveDeviceFilters(allActiveDevices);
    setDeviceSearch('');

    onFiltersChange?.({
      distanceFilters: allActiveDistance,
      gpsFilters: allActiveGps,
      deviceFilters: allActiveDevices,
      travelDirectionFilters: allActiveTravel,
    });
  };

  const distanceStatusLegend = [
    // { status: 'UNKNOWN', color: '#64748b', count: summary?.distanceStatusBreakdown?.UNKNOWN || 0 },
    { status: 'CROSSING', color: '#ef4444', count: summary?.distanceStatusBreakdown?.CROSSING || 0 },
    { status: 'FARAWAY', color: '#3b82f6', count: summary?.distanceStatusBreakdown?.FARAWAY || 0 },
    { status: 'ON AWARENESS', color: '#22c55e', count: summary?.distanceStatusBreakdown?.ON_AWARENESS || 0 },
  ];

  const gpsQualityLegend = [
    { quality: 'SINGLE', symbol: '●', color: '#8b5cf6', count: summary?.shapeConditionBreakdown?.SINGLE || 0 },
    { quality: 'DGPS', symbol: '▲', color: '#3b82f6', count: summary?.shapeConditionBreakdown?.DGPS || 0 },
    { quality: 'RTK FIX', symbol: '◆', color: '#10b981', count: summary?.shapeConditionBreakdown?.RTK_FIX || 0 },
    { quality: 'RTK FLOAT', symbol: '■', color: '#f59e0b', count: summary?.shapeConditionBreakdown?.RTK_FLOAT || 0 },
    { quality: 'NO GPS', symbol: 'x', color: '#ef4444', count: summary?.shapeConditionBreakdown?.NO_GPS || 0 },
  ];

  const travelDirectionLegend = [
    { direction: 'FORWARD', symbol: '▲', color: '#22c55e', count: directionCounts.FORWARD },
    { direction: 'REVERSE', symbol: '▼', color: '#f97316', count: directionCounts.REVERSE },
    { direction: 'STATIONARY', symbol: '■', color: '#64748b', count: directionCounts.STATIONARY },
  ];

  return (
    <Card sx={{
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(16px)',
      borderRadius: 2,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      width: 380,
      maxHeight: 'calc(100vh - 120px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <CardContent sx={{ p: 2, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" fontWeight={600} color="primary" sx={{ mb: 2 }}>
          MIR Control Panel
        </Typography>

        {/* Filter Info */}
        <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(59, 130, 246, 0.05)', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Date Range:</strong> {formatDateRange()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Data Points:</strong> {trackingData?.length || 0} | <strong>Devices:</strong> {availableDevices?.length || 0}
          </Typography>
        </Box>

        {/* Distance Status Legend */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Distance Status
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
          {distanceStatusLegend.map((item) => (
            <Box
              key={item.status}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                padding: '4px 8px',
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: activeFilters[item.status] ? 'transparent' : 'rgba(0,0,0,0.05)',
                opacity: activeFilters[item.status] ? 1 : 0.5,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(0,0,0,0.05)'
                }
              }}
              onClick={() => toggleFilter(item.status)}
            >
              <IconButton
                size="small"
                sx={{
                  width: 20,
                  height: 20,
                  p: 0,
                  color: item.color
                }}
              >
                {activeFilters[item.status] ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
              </IconButton>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: activeFilters[item.status] ? item.color : '#ccc',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  transition: 'background-color 0.2s ease'
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  fontSize: '0.8rem',
                  color: activeFilters[item.status] ? 'inherit' : '#999'
                }}
              >
                {item.status}
              </Typography>
              <Chip
                label={item.count}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  bgcolor: activeFilters[item.status] ? item.color : '#ccc',
                  color: 'white',
                  transition: 'background-color 0.2s ease'
                }}
              />
            </Box>
          ))}
        </Box>

        {/* GPS Quality Legend - Horizontal */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          GPS Quality
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {gpsQualityLegend.map((item) => (
            <Box
              key={item.quality}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                padding: '2px 6px',
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: activeGpsFilters[item.quality] ? item.color : '#ccc',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: activeGpsFilters[item.quality] ? 1 : 0.5,
                transition: 'all 0.2s ease',
                minWidth: 'fit-content',
                '&:hover': {
                  opacity: 0.8
                }
              }}
              onClick={() => toggleGpsFilter(item.quality)}
            >
              <span>{item.symbol}</span>
              <span>{item.quality}</span>
              <span>({item.count})</span>
            </Box>
          ))}
        </Box>

        {/* Travel Direction Filter */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Travel Direction
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {travelDirectionLegend.map((item) => (
            <Box
              key={item.direction}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                padding: '2px 8px',
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: activeTravelFilters[item.direction] ? item.color : '#ccc',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: activeTravelFilters[item.direction] ? 1 : 0.5,
                transition: 'all 0.2s ease',
                minWidth: 'fit-content',
                '&:hover': { opacity: 0.8 }
              }}
              onClick={() => toggleTravelFilter(item.direction)}
            >
              <span>{item.symbol}</span>
              <span>{item.direction}</span>
              <span>({item.count})</span>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Device List Section */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Device Filter ({filteredDevices.length})
        </Typography>

        {/* Search Bar with Reset */}
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search devices..."
            value={deviceSearch}
            onChange={(e) => setDeviceSearch(e.target.value)}
            InputProps={{
              startAdornment: <Search fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
            }}
            sx={{ flex: 1 }}
          />
          {deviceSearch && (
            <IconButton size="small" onClick={clearSearch}>
              <Clear fontSize="small" />
            </IconButton>
          )}
          <Button
            size="small"
            variant="text"
            onClick={resetAllFilters}
            sx={{
              minWidth: 'auto',
              px: 1.5,
              fontSize: '0.75rem',
              color: 'text.secondary'
            }}
          >
            Reset
          </Button>
        </Box>

        {/* Device List with Scroll */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 1,
          p: 1,
          maxHeight: 200
        }}>
          {filteredDevices.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No devices found
            </Typography>
          ) : (
            filteredDevices.map((device) => (
              <FormControlLabel
                key={device}
                control={
                  <Checkbox
                    checked={activeDeviceFilters[device] || false}
                    onChange={() => toggleDeviceFilter(device)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {device}
                  </Typography>
                }
                sx={{
                  width: '100%',
                  margin: 0,
                  display: 'flex',
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.8rem'
                  }
                }}
              />
            ))
          )}
        </Box>

        {/* Filter Info */}
        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          Click to show/hide on map
        </Typography>

        {/* Active Devices */}
        {devices && devices.length > 0 && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(34, 197, 94, 0.05)', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Active Devices: {devices.length}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default MIRLegend;