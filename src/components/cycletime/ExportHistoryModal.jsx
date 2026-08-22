import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, Chip, LinearProgress, Alert, Link, CircularProgress,
  FormControl, InputLabel, MenuItem, Select, TextField,
} from '@mui/material';
import { styled } from '@mui/system';
import useCycleTimeStore from '../../stores/cycleTimeStore';

// Icons
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import TableChartIcon from '@mui/icons-material/TableChart';
import RefreshIcon from '@mui/icons-material/Refresh';
import LanguageIcon from '@mui/icons-material/Language';

const StyledDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    borderRadius: '16px',
    background: `linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)`,
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(203, 213, 225, 0.4)',
    boxShadow: '0 32px 80px rgba(15, 23, 42, 0.12)',
    minWidth: '500px',
  },
});

const StyledDialogTitle = styled(DialogTitle)({
  background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
  borderBottom: '1px solid rgba(203, 213, 225, 0.3)',
  padding: '16px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#1e293b',
});

const UTM_INTERVAL_PRESETS = [
  { label: '2 detik', value: 2 },
  { label: '4 detik', value: 4 },
  { label: '10 detik', value: 10 },
  { label: '30 detik', value: 30 },
  { label: '2 menit', value: 120 },
];

const ExportHistoryModal = ({ open, onClose }) => {
  const [jobId, setJobId] = useState(null);
  const [exportStatus, setExportStatus] = useState('idle'); // idle, initiating, processing, completed, failed
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [utmJobId, setUtmJobId] = useState(null);
  const [utmExportStatus, setUtmExportStatus] = useState('idle'); // idle, initiating, processing, completed, failed
  const [utmProgress, setUtmProgress] = useState(0);
  const [utmDownloadUrl, setUtmDownloadUrl] = useState(null);
  const [utmErrorMessage, setUtmErrorMessage] = useState(null);
  const [utmIntervalMode, setUtmIntervalMode] = useState('120');
  const [customUtmIntervalSeconds, setCustomUtmIntervalSeconds] = useState('4');

  const { filters } = useCycleTimeStore();

  const resetState = () => {
    setJobId(null);
    setExportStatus('idle');
    setProgress(0);
    setDownloadUrl(null);
    setErrorMessage(null);
    setUtmJobId(null);
    setUtmExportStatus('idle');
    setUtmProgress(0);
    setUtmDownloadUrl(null);
    setUtmErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const resolveUtmIntervalSeconds = () => {
    if (utmIntervalMode !== 'custom') return Number(utmIntervalMode);
    const parsed = Number(customUtmIntervalSeconds);
    if (!Number.isInteger(parsed)) return 120;
    return Math.min(120, Math.max(2, parsed));
  };

  const initiateExport = async () => {
    setExportStatus('initiating');
    setErrorMessage(null);
    setProgress(5);

    try {
      const { startDate, endDate, unitNos } = filters;
      const requestBody = {
        UnitNumbers: unitNos,
        StartDate: startDate.split('T')[0],
        StartTime: startDate.split('T')[1].substring(0, 5),
        EndDate: endDate.split('T')[0],
        EndTime: endDate.split('T')[1].substring(0, 5),
      };

      const response = await fetch('/Monitoring/api/TrackingHistory/InitiateExport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      setJobId(data.jobId);
      setExportStatus('processing');
    } catch (error) {
      console.error('Failed to initiate export:', error);
      setErrorMessage('Gagal memulai proses export. Silakan coba lagi.');
      setExportStatus('failed');
    }
  };

  const initiateUtmExport = async () => {
    setUtmExportStatus('initiating');
    setUtmErrorMessage(null);
    setUtmProgress(5);

    try {
      const { startDate, endDate, unitNos } = filters;
      const selectedInterval = resolveUtmIntervalSeconds();
      const requestBody = {
        UnitNumbers: unitNos,
        StartDate: startDate.split('T')[0],
        StartTime: startDate.split('T')[1].substring(0, 5),
        EndDate: endDate.split('T')[0],
        EndTime: endDate.split('T')[1].substring(0, 5),
        UtmIntervalSeconds: selectedInterval,
      };

      const response = await fetch('/Monitoring/api/TrackingHistory/InitiateUtmExport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      setUtmJobId(data.jobId);
      setUtmExportStatus('processing');
    } catch (error) {
      console.error('Failed to initiate UTM export:', error);
      setUtmErrorMessage('Gagal memulai proses export UTM. Silakan coba lagi.');
      setUtmExportStatus('failed');
    }
  };


  useEffect(() => {
    if (exportStatus !== 'processing' || !jobId) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/Monitoring/api/TrackingHistory/ExportStatus?jobId=${jobId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch export status.');
        }

        const statusData = await response.json();
        setProgress(statusData.progress);

        if (statusData.status === 'Completed') {
          setExportStatus('completed');
          setDownloadUrl(statusData.downloadUrl);
          clearInterval(intervalId);
        } else if (statusData.status === 'Failed') {
          setExportStatus('failed');
          setErrorMessage(statusData.errorMessage || 'Proses export di backend gagal.');
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setErrorMessage('Gagal mendapatkan status export. Koneksi mungkin terputus.');
        setExportStatus('failed');
        clearInterval(intervalId);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(intervalId);
  }, [exportStatus, jobId]);

  useEffect(() => {
    if (utmExportStatus !== 'processing' || !utmJobId) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/Monitoring/api/TrackingHistory/UtmExportStatus?jobId=${utmJobId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch UTM export status.');
        }

        const statusData = await response.json();
        setUtmProgress(statusData.progress);

        if (statusData.status === 'Completed') {
          setUtmExportStatus('completed');
          setUtmDownloadUrl(statusData.downloadUrl);
          clearInterval(intervalId);
        } else if (statusData.status === 'Failed') {
          setUtmExportStatus('failed');
          setUtmErrorMessage(statusData.errorMessage || 'Proses export UTM di backend gagal.');
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('UTM Polling error:', error);
        setUtmErrorMessage('Gagal mendapatkan status export UTM. Koneksi mungkin terputus.');
        setUtmExportStatus('failed');
        clearInterval(intervalId);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(intervalId);
  }, [utmExportStatus, utmJobId]);

  const isProcessing = exportStatus === 'initiating' || exportStatus === 'processing';
  const isUtmProcessing = utmExportStatus === 'initiating' || utmExportStatus === 'processing';
  const utmIntervalSecondsValue = resolveUtmIntervalSeconds();
  const utmIntervalLabel = utmIntervalSecondsValue === 120 ? '2 menit' : `${utmIntervalSecondsValue} detik`;

  return (
    <StyledDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <StyledDialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <DownloadIcon sx={{ color: '#1e40af' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Export Data
          </Typography>
        </Box>
        <Button onClick={handleClose} sx={{ color: '#64748b', minWidth: 'auto', p: 1 }} disabled={isProcessing || isUtmProcessing}>
          <CloseIcon />
        </Button>
      </StyledDialogTitle>

      <DialogContent sx={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 3 }}>

        <Box bgcolor="rgba(241, 245, 249, 0.8)" border="1px solid rgba(203, 213, 225, 0.3)" borderRadius={2} p={2}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', mb: 1 }}>
            Filter Aktif:
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip label={`${filters?.unitNos?.length || 0} Haulers`} size="small" color="primary" />
            <Chip label={`${filters?.startDate?.split('T')[0]} @ ${filters?.startDate?.split('T')[1]}`} size="small" variant="outlined" />
            <Chip label={`${filters?.endDate?.split('T')[0]} @ ${filters?.endDate?.split('T')[1]}`} size="small" variant="outlined" />
          </Box>
        </Box>

        {/* Original Export */}
        <Box display="flex" flexDirection="column" gap={2} p={2} borderRadius={2} border="1px solid rgba(203, 213, 225, 0.3)">
           <Box display="flex" alignItems="center" gap={2}>
               <TableChartIcon sx={{ color: '#059669', fontSize: 40 }} />
               <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Export Raw Data (.xlsx)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Data mentah lengkap sesuai filter. Proses berjalan di background.
                  </Typography>
               </Box>
           </Box>
           {isProcessing && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: '#1e293b', textAlign: 'center' }}>
                   Sedang memproses... ({progress}%)
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
            )}
            {exportStatus === 'completed' && (
               <Alert severity="success" action={
                  <Button color="inherit" size="small" href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    DOWNLOAD
                  </Button>
                }>
                File Excel berhasil dibuat! Klik download untuk mengunduh.
              </Alert>
            )}
            {exportStatus === 'failed' && <Alert severity="error">{errorMessage}</Alert>}
        </Box>

        {/* UTM Export */}
        <Box display="flex" flexDirection="column" gap={2} p={2} borderRadius={2} border="1px solid rgba(203, 213, 225, 0.3)">
           <Box display="flex" alignItems="center" gap={2}>
               <LanguageIcon sx={{ color: '#0f766e', fontSize: 40 }} />
               <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Export UTM (.xlsx)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Data per {utmIntervalLabel} dengan koordinat UTM 50N dan rata-rata VehicleSpeed. Proses berjalan di background.
                  </Typography>
               </Box>
           </Box>
           <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
             <FormControl size="small" sx={{ minWidth: 160 }}>
               <InputLabel id="utm-interval-label">Interval UTM</InputLabel>
               <Select
                 labelId="utm-interval-label"
                 label="Interval UTM"
                 value={utmIntervalMode}
                 onChange={(event) => {
                   const value = event.target.value;
                   setUtmIntervalMode(value);
                 }}
                 disabled={isProcessing || isUtmProcessing}
               >
                 {UTM_INTERVAL_PRESETS.map((option) => (
                   <MenuItem key={option.value} value={String(option.value)}>
                     {option.label}
                   </MenuItem>
                 ))}
                 <MenuItem value="custom">Custom</MenuItem>
               </Select>
             </FormControl>
             {utmIntervalMode === 'custom' && (
               <TextField
                 size="small"
                 type="number"
                 label="Detik"
                 value={customUtmIntervalSeconds}
                 onChange={(event) => setCustomUtmIntervalSeconds(event.target.value)}
                 inputProps={{ min: 2, max: 120, step: 1 }}
                 disabled={isProcessing || isUtmProcessing}
                 sx={{ width: 100 }}
               />
             )}
           </Box>
            {isUtmProcessing && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: '#1e293b', textAlign: 'center' }}>
                   Sedang memproses UTM... ({utmProgress}%)
                </Typography>
                <LinearProgress variant="determinate" value={utmProgress} />
              </Box>
            )}
            {utmExportStatus === 'completed' && (
               <Alert severity="success" action={
                  <Button color="inherit" size="small" href={utmDownloadUrl} target="_blank" rel="noopener noreferrer">
                    DOWNLOAD
                  </Button>
                }>
                File Excel UTM berhasil dibuat! Klik download untuk mengunduh.
              </Alert>
            )}
            {utmExportStatus === 'failed' && <Alert severity="error">{utmErrorMessage}</Alert>}
        </Box>

      </DialogContent>

      <DialogActions sx={{ p: '16px 24px', borderTop: '1px solid rgba(203, 213, 225, 0.3)' }}>
        <Button onClick={handleClose} variant="outlined" disabled={isProcessing || isUtmProcessing}>Batal</Button>

        {exportStatus === 'completed' || exportStatus === 'failed' ? (
           <Button onClick={resetState} variant="contained" startIcon={<RefreshIcon />}>Coba Lagi Export Raw</Button>
        ) : (
           <Button onClick={initiateExport} variant="contained" disabled={isProcessing || isUtmProcessing || !filters.unitNos || filters.unitNos.length === 0} startIcon={<DownloadIcon />}>
              {isProcessing ? `Memproses...` : 'Mulai Export Raw'}
           </Button>
        )}

        {utmExportStatus === 'completed' || utmExportStatus === 'failed' ? (
           <Button onClick={() => { setUtmJobId(null); setUtmExportStatus('idle'); setUtmProgress(0); setUtmDownloadUrl(null); setUtmErrorMessage(null); }} variant="contained" color="secondary" startIcon={<RefreshIcon />}>Coba Lagi Export UTM</Button>
        ) : (
           <Button
             onClick={initiateUtmExport}
             variant="contained"
             color="secondary"
             disabled={isProcessing || isUtmProcessing || !filters.unitNos || filters.unitNos.length === 0}
             startIcon={<LanguageIcon />}
           >
             {isUtmProcessing ? `Memproses...` : 'Mulai Export UTM'}
           </Button>
        )}
      </DialogActions>
    </StyledDialog>
  );
};

export default ExportHistoryModal;
