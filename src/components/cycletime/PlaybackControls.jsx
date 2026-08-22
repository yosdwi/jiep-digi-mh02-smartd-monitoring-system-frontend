import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Typography, IconButton, Slider, Button, ButtonGroup, Popover, Chip } from '@mui/material';
import { styled } from '@mui/system';
import useCycleTimeStore from '../../stores/cycleTimeStore';
import ExportHistoryModal from './ExportHistoryModal';

// Icons
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import GpsNotFixedIcon from '@mui/icons-material/GpsNotFixed';

const PlaybackContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '70%',
  maxWidth: '1000px',
  padding: '6px 12px',
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
  gap: '2px',
  boxShadow: `
    0 32px 80px rgba(15, 23, 42, 0.12),
    0 16px 40px rgba(30, 64, 175, 0.08),
    0 8px 20px rgba(5, 150, 105, 0.04)
  `,
}));

const TopRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const InfoChip = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: 'rgba(248, 250, 252, 0.6)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(203, 213, 225, 0.3)',
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '0.75rem',
  color: '#1e293b',
});

const BottomRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
});

const TimeWarpGroup = styled(ButtonGroup)({
  '& .MuiButtonGroup-grouped': {
    color: '#1e293b',
    borderColor: 'rgba(203, 213, 225, 0.4)',
    backgroundColor: 'rgba(248, 250, 252, 0.6)',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderColor: 'rgba(30, 64, 175, 0.3)',
    }
  },
});

const HaulerButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#1e40af',
  border: '1px solid #1e40af',
  color: '#ffffff',
  borderRadius: '8px',
  textTransform: 'none',
  fontWeight: 600,
  padding: '2px 10px',
  minWidth: 'fit-content',
  '&:hover': {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
}));

const HaulerPopover = styled(Popover)({
  '& .MuiPopover-paper': {
    background: `
      linear-gradient(145deg,
        rgba(255, 255, 255, 0.98) 0%,
        rgba(248, 250, 252, 0.95) 100%
      )
    `,
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(203, 213, 225, 0.4)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    padding: '12px',
    minWidth: '120px',
    maxWidth: '160px',
    maxHeight: '250px',
    overflowY: 'auto',
  }
});

const HaulerChip = styled(Chip)(({ selected }) => ({
  backgroundColor: selected ? '#1e40af' : 'rgba(248, 250, 252, 0.8)',
  color: selected ? '#ffffff' : '#1e293b',
  border: `1px solid ${selected ? '#1e40af' : 'rgba(203, 213, 225, 0.4)'}`,
  margin: '2px',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: selected ? '#1d4ed8' : 'rgba(255, 255, 255, 0.9)',
    transform: 'translateY(-1px)',
  },
}));

const PlaybackControls = () => {
  const {
    trackingData,
    filters,
    selectedHauler,
    isPlaying,
    currentProgress,
    playbackSpeed,
    autoFollow,
    setIsPlaying,
    setCurrentProgress,
    setPlaybackSpeed,
    setSelectedHauler,
    setAutoFollow,
  } = useCycleTimeStore();

  // Get store functions directly
  const store = useCycleTimeStore.getState();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [haulerPopoverAnchor, setHaulerPopoverAnchor] = useState(null);
  const animationRef = useRef(null);

  const haulerData = useMemo(() => {
    if (!selectedHauler || !trackingData?.length) return [];
    return trackingData.filter(point => point.unitNo === selectedHauler);
  }, [selectedHauler, trackingData]);
  const totalDataPoints = haulerData.length;
  const startDate = new Date(filters?.startDate || Date.now());
  const endDate = new Date(filters?.endDate || Date.now());


  const getHaulerList = () => {
    return [...new Set(trackingData?.map(item => item.unitNo) || [])];
  };

  const getHaulerDataPoints = (hauler) => {
    return trackingData?.filter(point => point.unitNo === hauler)?.length || 0;
  };

  const handleHaulerPopoverOpen = (event) => {
    setHaulerPopoverAnchor(event.currentTarget);
  };

  const handleHaulerPopoverClose = () => {
    setHaulerPopoverAnchor(null);
  };

  const handleHaulerSelect = (hauler) => {
    setSelectedHauler(hauler);
    setCurrentProgress(0);
    handleHaulerPopoverClose();
  };

  // Start/stop animation
  useEffect(() => {
    if (isPlaying && totalDataPoints > 0 && selectedHauler) {
      // Calculate realistic timing based on data points
      // For 1x speed: progress through all data in reasonable time
      const totalDurationMs = totalDataPoints * 100; // 100ms per data point for 1x
      const stepInterval = Math.max(50, Math.min(200, totalDurationMs / 1000)); // Between 50-200ms
      const progressIncrement = (100 / totalDataPoints) * playbackSpeed;

      animationRef.current = setInterval(() => {
        const currentState = useCycleTimeStore.getState();
        const currentProg = currentState.currentProgress;

        if (currentProg >= 100) {
          currentState.setIsPlaying(false);
          return;
        }

        const newProgress = Math.min(currentProg + progressIncrement, 100);
        currentState.setCurrentProgress(newProgress);

      }, stepInterval);
    } else {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, selectedHauler, totalDataPoints, playbackSpeed]);

  useEffect(() => {
    if (totalDataPoints > 0 && selectedHauler) {
      const progressIndex = Math.floor((currentProgress / 100) * totalDataPoints);
      const currentDataPoint = haulerData[Math.min(progressIndex, totalDataPoints - 1)];
      if (currentDataPoint?.timestamp) {
        setCurrentTime(new Date(currentDataPoint.timestamp));
      }
    }
  }, [currentProgress, haulerData, totalDataPoints, selectedHauler]);

  const formatShiftTime = (date) => {
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).toUpperCase();
  };

  const formatTimeRange = () => {
    const start = startDate.toTimeString().slice(0, 8);
    const end = endDate.toTimeString().slice(0, 8);
    return `${start} - ${end}`;
  };

  const formatCurrentTime = () => {
    return currentTime.toTimeString().slice(0, 12);
  };

  return (
    <PlaybackContainer elevation={8}>
      {/* Top Row - info chips + current time + playback controls + other buttons */}
      <TopRow sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Left side - Info chips */}
        <Box display="flex" alignItems="center" gap={1}>
          <InfoChip>
            <CalendarTodayIcon sx={{ fontSize: '0.9rem' }} />
            <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>{formatShiftTime(startDate)}</Typography>
          </InfoChip>
          <InfoChip>
            <AccessTimeIcon sx={{ fontSize: '0.9rem' }} />
            <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>{formatTimeRange()}</Typography>
          </InfoChip>
        </Box>

        {/* Center - Current time and playback controls */}
        <Box display="flex" alignItems="center" gap={1}>
          <Box textAlign="center">
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', fontSize: '0.6rem' }}>CURRENT TIME</Typography>
            <Typography variant="h6" sx={{ letterSpacing: '1px', color: '#1e293b', lineHeight: 1.2, fontSize: '0.8rem' }}>
              {totalDataPoints > 0 ? formatCurrentTime() : '--:--:--.---'}
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={() => setCurrentProgress(0)}
            disabled={totalDataPoints === 0 || !selectedHauler}
            sx={{
              color: '#64748b',
              background: 'rgba(248, 250, 252, 0.8)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(203, 213, 225, 0.3)',
              borderRadius: 2,
              width: 28,
              height: 28,
              '&:hover': {
                color: '#1e40af',
                background: 'rgba(255, 255, 255, 0.9)',
                borderColor: 'rgba(30, 64, 175, 0.2)',
                transform: 'scale(1.05)',
              },
              '&:disabled': {
                color: 'rgba(100, 116, 139, 0.3)',
                background: 'rgba(248, 250, 252, 0.3)',
              }
            }}
          >
            <SkipPreviousIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={totalDataPoints === 0 || !selectedHauler}
            sx={{
              color: '#ffffff',
              background: 'linear-gradient(135deg, #1e40af 0%, #059669 100%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 16px rgba(30, 64, 175, 0.25)',
              width: 36,
              height: 36,
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1d4ed8 0%, #047857 100%)',
                transform: 'scale(1.1)',
                boxShadow: '0 6px 20px rgba(30, 64, 175, 0.3)',
              },
              '&:active': {
                transform: 'scale(1.05)',
              },
              '&:disabled': {
                background: 'rgba(203, 213, 225, 0.3)',
                color: 'rgba(100, 116, 139, 0.5)',
                boxShadow: 'none',
              }
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>

          <IconButton
            size="small"
            onClick={() => setCurrentProgress(100)}
            disabled={totalDataPoints === 0 || !selectedHauler}
            sx={{
              color: '#64748b',
              background: 'rgba(248, 250, 252, 0.8)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(203, 213, 225, 0.3)',
              borderRadius: 2,
              width: 28,
              height: 28,
              '&:hover': {
                color: '#1e40af',
                background: 'rgba(255, 255, 255, 0.9)',
                borderColor: 'rgba(30, 64, 175, 0.2)',
                transform: 'scale(1.05)',
              },
              '&:disabled': {
                color: 'rgba(100, 116, 139, 0.3)',
                background: 'rgba(248, 250, 252, 0.3)',
              }
            }}
          >
            <SkipNextIcon fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            onClick={() => setAutoFollow(!autoFollow)}
            disabled={totalDataPoints === 0 || !selectedHauler}
            sx={{
              color: autoFollow ? '#ffffff' : '#64748b',
              background: autoFollow
                ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                : 'rgba(248, 250, 252, 0.8)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${autoFollow ? 'rgba(5, 150, 105, 0.3)' : 'rgba(203, 213, 225, 0.3)'}`,
              borderRadius: 2,
              width: 28,
              height: 28,
              transition: 'all 0.3s ease',
              '&:hover': {
                color: autoFollow ? '#ffffff' : '#10b981',
                background: autoFollow
                  ? 'linear-gradient(135deg, #047857 0%, #059669 100%)'
                  : 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                transform: 'scale(1.05)',
              },
              '&:disabled': {
                color: 'rgba(100, 116, 139, 0.3)',
                background: 'rgba(248, 250, 252, 0.3)',
                transform: 'none',
              }
            }}
            title={autoFollow ? "Auto Follow: ON" : "Auto Follow: OFF"}
          >
            {autoFollow ? <GpsFixedIcon fontSize="small" /> : <GpsNotFixedIcon fontSize="small" />}
          </IconButton>
        </Box>

        {/* Right side - Hauler selector, Time Warp, Export */}
        <Box display="flex" alignItems="center" gap={1}>
          <HaulerButton
            onClick={handleHaulerPopoverOpen}
            endIcon={<ExpandMoreIcon />}
            sx={{ fontSize: '0.8rem', padding: '2px 8px' }}
          >
            {selectedHauler || 'Pilih Hauler'}
          </HaulerButton>
          <TimeWarpGroup size="small">
            <Button
              onClick={() => setPlaybackSpeed(1)}
              variant={playbackSpeed === 1 ? 'contained' : 'outlined'}
              disabled={!selectedHauler}
              sx={{ minWidth: '32px', fontSize: '0.7rem' }}
            >
              1x
            </Button>
            <Button
              onClick={() => setPlaybackSpeed(10)}
              variant={playbackSpeed === 10 ? 'contained' : 'outlined'}
              disabled={!selectedHauler}
              sx={{ minWidth: '32px', fontSize: '0.7rem' }}
            >
              10x
            </Button>
            <Button
              onClick={() => setPlaybackSpeed(50)}
              variant={playbackSpeed === 50 ? 'contained' : 'outlined'}
              disabled={!selectedHauler}
              sx={{ minWidth: '32px', fontSize: '0.7rem' }}
            >
              50x
            </Button>
          </TimeWarpGroup>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon sx={{ fontSize: '1rem' }} />}
            onClick={() => setExportModalOpen(true)}
            sx={{
              color: '#1e293b',
              borderColor: 'rgba(203, 213, 225, 0.4)',
              backgroundColor: 'rgba(248, 250, 252, 0.6)',
              textTransform: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '0.7rem',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                borderColor: 'rgba(30, 64, 175, 0.3)',
                color: '#1e40af',
              }
            }}
          >
            Export
          </Button>
        </Box>
      </TopRow>

      {/* Bottom Row - Only slider */}
      <Slider
        size="small"
        aria-label="Playback Progress"
        value={typeof currentProgress === 'number' ? currentProgress : 0}
        onChange={(_, value) => setCurrentProgress(value)}
        disabled={totalDataPoints === 0 || !selectedHauler}
        sx={{
          color: '#1e40af',
          margin: '4px 0',
          '& .MuiSlider-thumb': {
            backgroundColor: '#ffffff',
            border: '2px solid #1e40af',
            boxShadow: '0 4px 12px rgba(30, 64, 175, 0.2)',
            width: 16,
            height: 16,
            '&:hover': {
              boxShadow: '0 6px 16px rgba(30, 64, 175, 0.3)',
            }
          },
          '& .MuiSlider-rail': {
            backgroundColor: 'rgba(203, 213, 225, 0.4)',
          },
          '& .MuiSlider-track': {
            background: 'linear-gradient(90deg, #1e40af 0%, #059669 100%)',
          },
        }}
      />

      <HaulerPopover
        open={Boolean(haulerPopoverAnchor)}
        anchorEl={haulerPopoverAnchor}
        onClose={handleHaulerPopoverClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', mb: 1 }}>
            Pilih Hauler:
          </Typography>
          <Box display="flex" flexDirection="column" gap={0.5}>
            {getHaulerList().map((hauler) => (
              <HaulerChip
                key={hauler}
                label={hauler}
                selected={selectedHauler === hauler}
                onClick={() => handleHaulerSelect(hauler)}
                size="small"
              />
            ))}
          </Box>
        </Box>
      </HaulerPopover>

      <ExportHistoryModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </PlaybackContainer>
  );
};

export default PlaybackControls;
