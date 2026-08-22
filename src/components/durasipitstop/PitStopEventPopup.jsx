import React from 'react';
import { Box, Paper, Typography, IconButton, Stack, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PlaceIcon from '@mui/icons-material/Place';
import TimerIcon from '@mui/icons-material/Timer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const formatDuration = (ms) => {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec} dtk`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return secs ? `${mins} mnt ${secs} dtk` : `${mins} mnt`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours} jam ${remMins} mnt` : `${hours} jam`;
};

const formatTime = (date) => new Date(date).toLocaleTimeString('id-ID', {
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

const Row = ({ icon, label, value, valueColor = '#0f172a' }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    {icon}
    <Typography sx={{ fontSize: '0.72rem', color: '#64748b', minWidth: 64 }}>{label}</Typography>
    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: valueColor }}>{value}</Typography>
  </Stack>
);

const PitStopEventPopup = ({ event, formatPitStopName, onClose }) => {
  if (!event || event.x == null || event.y == null) return null;

  const left = Math.max(12, Math.min(event.x + 16, window.innerWidth - 280));
  const top = Math.max(12, event.y - 140);

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        left,
        top,
        width: 260,
        zIndex: 1400,
        borderRadius: 2,
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
      }}
    >
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5, py: 1,
        background: 'linear-gradient(135deg, #1e40af 0%, #059669 100%)',
        color: '#fff',
      }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <LocalShippingIcon sx={{ fontSize: 18 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>{event.unitId}</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} sx={{ color: '#fff', p: 0.25 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Stack spacing={0.75}>
          <Row
            icon={<PlaceIcon sx={{ fontSize: 16, color: '#1e40af' }} />}
            label="Lokasi"
            value={formatPitStopName ? formatPitStopName(event.pitStopName) : event.pitStopName}
          />
          <Row
            icon={<TimerIcon sx={{ fontSize: 16, color: '#059669' }} />}
            label="Durasi"
            value={formatDuration(event.durationMs)}
            valueColor="#059669"
          />
          <Divider sx={{ my: 0.5 }} />
          <Row
            icon={<AccessTimeIcon sx={{ fontSize: 16, color: '#c2410c' }} />}
            label="Masuk"
            value={formatTime(event.startTime)}
          />
          <Row
            icon={<AccessTimeIcon sx={{ fontSize: 16, color: '#7c3aed' }} />}
            label="Keluar"
            value={formatTime(event.endTime)}
          />
        </Stack>
      </Box>
    </Paper>
  );
};

export default PitStopEventPopup;
