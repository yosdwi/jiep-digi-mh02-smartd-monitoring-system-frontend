import React, { useMemo } from 'react';
import {
  Box, Paper, Typography, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Stack, Tooltip, CircularProgress,
} from '@mui/material';
import { styled } from '@mui/system';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PlaceIcon from '@mui/icons-material/Place';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimerIcon from '@mui/icons-material/Timer';

const PanelRoot = styled(Paper)(() => ({
  width: '100%',
  height: '100%',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
  backdropFilter: 'blur(16px)',
  borderTop: '1px solid rgba(203, 213, 225, 0.5)',
  borderRadius: 0,
  color: '#1e293b',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.08)',
  overflow: 'hidden',
}));

const HeaderBar = styled(Box)(() => ({
  height: 48,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  borderBottom: '1px solid rgba(203, 213, 225, 0.4)',
  background: 'rgba(255,255,255,0.7)',
}));

const StyledRow = styled(TableRow)(() => ({
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
  '&:hover': {
    backgroundColor: 'rgba(30, 64, 175, 0.06)',
  },
}));

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

const PitStopSummaryCard = ({
  summaryData = {},
  totalEvents = 0,
  formatPitStopName = (n) => n,
  onRowClick,
  isLoading,
  open,
  onToggle,
}) => {
  const stats = useMemo(() => {
    let totalUnits = Object.keys(summaryData).length;
    let totalDuration = 0;
    let unitWithMostStops = { unit: '-', count: 0 };
    for (const [unitId, entries] of Object.entries(summaryData)) {
      for (const e of entries) totalDuration += e.durationMs;
      if (entries.length > unitWithMostStops.count) {
        unitWithMostStops = { unit: unitId, count: entries.length };
      }
    }
    const avgDuration = totalEvents > 0 ? totalDuration / totalEvents : 0;
    return { totalUnits, totalDuration, avgDuration, unitWithMostStops };
  }, [summaryData, totalEvents]);

  const unitEntries = Object.entries(summaryData).filter(([, list]) => list.length > 0);

  return (
    <PanelRoot elevation={6}>
      <HeaderBar>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <PlaceIcon sx={{ fontSize: 18, color: '#1e40af' }} /> Ringkasan Durasi Pit Stop
          </Typography>
          {open && (
            <Stack direction="row" spacing={0.75}>
              <Chip
                size="small"
                icon={<LocalShippingIcon sx={{ fontSize: 14 }} />}
                label={`${stats.totalUnits} unit`}
                sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600, bgcolor: 'rgba(30,64,175,0.08)', color: '#1e40af' }}
              />
              <Chip
                size="small"
                icon={<TimerIcon sx={{ fontSize: 14 }} />}
                label={`${totalEvents} kunjungan`}
                sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600, bgcolor: 'rgba(5,150,105,0.08)', color: '#059669' }}
              />
              <Chip
                size="small"
                icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                label={`rata-rata ${formatDuration(stats.avgDuration)}`}
                sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600, bgcolor: 'rgba(234,88,12,0.08)', color: '#c2410c' }}
              />
            </Stack>
          )}
        </Stack>
        <Tooltip title={open ? 'Sembunyikan panel' : 'Tampilkan panel'}>
          <IconButton size="small" onClick={onToggle}>
            {open ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Tooltip>
      </HeaderBar>

      {open && (
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', p: 2 }}>
          {isLoading && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ color: '#64748b' }}>Memuat data...</Typography>
            </Stack>
          )}

          {!isLoading && unitEntries.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center', color: '#94a3b8' }}>
              <Typography variant="body2">
                Belum ada kunjungan pit stop terdeteksi. Pilih hauler dan rentang waktu lalu klik <strong>Terapkan</strong>.
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                Kunjungan singkat (&lt; 30 detik) atau yang berdekatan akan otomatis digabung untuk mengurangi noise GPS.
              </Typography>
            </Box>
          )}

          {!isLoading && unitEntries.length > 0 && (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: 2,
            }}>
              {unitEntries.map(([unitId, entries]) => {
                const totalUnitDuration = entries.reduce((a, e) => a + e.durationMs, 0);
                return (
                  <Paper key={unitId} variant="outlined" sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.85)',
                    borderColor: 'rgba(203, 213, 225, 0.6)',
                  }}>
                    <Box sx={{
                      px: 1.5, py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'linear-gradient(135deg, rgba(30,64,175,0.08) 0%, rgba(5,150,105,0.05) 100%)',
                      borderBottom: '1px solid rgba(203,213,225,0.5)',
                    }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <LocalShippingIcon sx={{ fontSize: 18, color: '#1e40af' }} />
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{unitId}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <Chip
                          size="small"
                          label={`${entries.length}x`}
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: 'rgba(30,64,175,0.1)', color: '#1e40af' }}
                        />
                        <Chip
                          size="small"
                          label={formatDuration(totalUnitDuration)}
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: 'rgba(5,150,105,0.1)', color: '#059669' }}
                        />
                      </Stack>
                    </Box>
                    <TableContainer sx={{ maxHeight: 240 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(248,250,252,0.95)' }}>Lokasi</TableCell>
                            <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(248,250,252,0.95)' }}>Durasi</TableCell>
                            <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(248,250,252,0.95)' }}>Waktu</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {entries.map((entry, idx) => (
                            <StyledRow key={idx} onClick={() => onRowClick && onRowClick({ ...entry, unitId })}>
                              <TableCell sx={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 500 }}>
                                {formatPitStopName(entry.pitStopName)}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                                {formatDuration(entry.durationMs)}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.78rem', color: '#475569' }}>
                                {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                              </TableCell>
                            </StyledRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      )}
    </PanelRoot>
  );
};

export default PitStopSummaryCard;
