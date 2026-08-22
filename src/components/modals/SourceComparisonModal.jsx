import React, { useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, MenuItem, Select, Typography,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';

const SourceComparisonModal = ({ open, rows, onClose, onApply }) => {
  const [mode, setMode] = useState('miforce');
  const [viewMode, setViewMode] = useState('hauler');

  const comparisonRows = useMemo(() => {
    const map = new Map();
    ['miforce', 'timesheet'].forEach(source => {
      (rows?.[source] || []).forEach(row => {
        const hauler = row.hauler ?? row.HAULER;
        const loader = row.loader ?? row.LOADER;
        if (!hauler) return;
        if (!map.has(hauler)) map.set(hauler, { hauler, miforce: [], timesheet: [] });
        const values = map.get(hauler)[source];
        if (loader && !values.includes(loader)) values.push(loader);
      });
    });
    return [...map.values()].sort((a, b) => a.hauler.localeCompare(b.hauler));
  }, [rows]);

  const loaderRows = useMemo(() => {
    const map = new Map();
    ['miforce', 'timesheet'].forEach(source => {
      (rows?.[source] || []).forEach(row => {
        const loader = row.loader ?? row.LOADER;
        const hauler = row.hauler ?? row.HAULER;
        if (!loader || !hauler) return;
        if (!map.has(loader)) map.set(loader, { loader, miforce: [], timesheet: [] });
        const values = map.get(loader)[source];
        if (!values.includes(hauler)) values.push(hauler);
      });
    });
    return [...map.values()].sort((a, b) => a.loader.localeCompare(b.loader));
  }, [rows]);

  const [manual, setManual] = useState({});
  const getSourceOptions = row => [
    ...(row.miforce?.length ? [{ value: 'miforce', label: `Miforce — ${row.miforce.join(', ')}` }] : []),
    ...(row.timesheet?.length ? [{ value: 'timesheet', label: `Timesheet — ${row.timesheet.join(', ')}` }] : []),
  ];

  const handleApply = () => {
    if (viewMode === 'loader') {
      const selected = loaderRows.filter(row => {
        if (mode === 'miforce') return row.miforce.length > 0;
        if (mode === 'timesheet') return row.timesheet.length > 0;
        return Boolean(manual[`loader:${row.loader}`]);
      }).flatMap(row => {
        if (mode === 'miforce') return row.miforce;
        if (mode === 'timesheet') return row.timesheet;
        const selectedSource = manual[`loader:${row.loader}`];
        return selectedSource === 'miforce' ? row.miforce : row.timesheet;
      });
      onApply([...new Set(selected)]);
      return;
    }
    const selected = comparisonRows.filter(row => {
      if (mode === 'miforce') return row.miforce.length > 0;
      if (mode === 'timesheet') return row.timesheet.length > 0;
      return Boolean(manual[row.hauler]);
    }).map(row => row.hauler);
    onApply(selected);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{ sx: { maxHeight: 'calc(100vh - 48px)', overflow: 'hidden' } }}
    >
      <DialogTitle sx={{ flexShrink: 0 }}>Bandingkan Assignment Loader</DialogTitle>
      <DialogContent dividers sx={{ overflow: 'auto', minHeight: 0 }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2">Gunakan assignment:</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, value) => value && setMode(value)}
            aria-label="Sumber playback"
          >
            <ToggleButton value="miforce">Miforce</ToggleButton>
            <ToggleButton value="timesheet">Timesheet</ToggleButton>
            <ToggleButton value="manual">Manual</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup size="small" exclusive value={viewMode} onChange={(_, value) => value && setViewMode(value)}>
            <ToggleButton value="hauler">Per DT</ToggleButton>
            <ToggleButton value="loader">Per Loader</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 220px', gap: 1, alignItems: 'center', fontSize: 13 }}>
          <Typography fontWeight={700}>{viewMode === 'hauler' ? 'Hauler / DT' : 'Loader'}</Typography>
          <Typography fontWeight={700} color="primary">Miforce</Typography>
          <Typography fontWeight={700} color="success.main">Timesheet</Typography>
          <Typography fontWeight={700}>Pilihan manual</Typography>
          {(viewMode === 'hauler' ? comparisonRows : loaderRows).map(row => (
            <React.Fragment key={viewMode === 'hauler' ? row.hauler : row.loader}>
              <Typography>{viewMode === 'hauler' ? row.hauler : row.loader}</Typography>
              <Typography color={row.miforce.length ? 'text.primary' : 'text.disabled'}>{row.miforce.join(', ') || '—'}</Typography>
              <Typography color={row.timesheet.length ? 'text.primary' : 'text.disabled'}>{row.timesheet.join(', ') || '—'}</Typography>
              <FormControl size="small" disabled={mode !== 'manual'}>
                <Select
                  displayEmpty
                  value={manual[viewMode === 'hauler' ? row.hauler : `loader:${row.loader}`] || ''}
                  onChange={e => setManual(prev => ({ ...prev, [viewMode === 'hauler' ? row.hauler : `loader:${row.loader}`]: e.target.value }))}
                  MenuProps={{
                    disablePortal: true,
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' },
                    PaperProps: { sx: { maxHeight: 280, zIndex: 2200 } },
                  }}
                >
                  <MenuItem value=""><em>Lewati DT</em></MenuItem>
                  {getSourceOptions(row).map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </React.Fragment>
          ))}
        </Box>
        {!(viewMode === 'hauler' ? comparisonRows : loaderRows).length && <Typography sx={{ py: 4 }} color="text.secondary">Tidak ada data assignment pada range ini.</Typography>}
      </DialogContent>
      <DialogActions sx={{ flexShrink: 0, position: 'sticky', bottom: 0, backgroundColor: '#fff', zIndex: 1 }}>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" onClick={handleApply} disabled={!(viewMode === 'hauler' ? comparisonRows : loaderRows).length}>Gunakan untuk Playback</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SourceComparisonModal;
