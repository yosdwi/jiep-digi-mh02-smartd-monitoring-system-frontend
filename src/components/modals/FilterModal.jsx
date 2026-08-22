import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton,
  Typography, Box, TextField, Autocomplete, CircularProgress,
  ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, Checkbox, Chip,
  Popper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import useCycleTimeStore from '../../stores/cycleTimeStore';
import SourceComparisonModal from './SourceComparisonModal';
import { format, subHours, startOfToday, endOfToday, startOfYesterday, endOfYesterday } from 'date-fns';

const selectAllLoaderOption = { label: 'Pilih Semua Loader', value: 'all-loaders' };

const AutocompletePopper = (props) => {
  const width = props.anchorEl?.clientWidth;
  return (
    <Popper
      {...props}
      placement="bottom-start"
      style={{ ...props.style, width, zIndex: 2000 }}
      modifiers={[
        { name: 'flip', enabled: true },
        { name: 'preventOverflow', enabled: true, options: { boundary: 'viewport', padding: 12 } },
      ]}
    />
  );
};

const autocompletePaperStyle = {
  background: 'rgba(255, 255, 255, 0.98)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(203, 213, 225, 0.45)',
  borderRadius: '8px',
  boxShadow: '0 8px 32px rgba(15, 23, 42, 0.14)',
  maxHeight: 280,
  overflow: 'auto',
};

const FilterModal = ({ open, handleClose }) => {
  const {
    filters,
    setFilters,
    fetchAvailableLoaders,
    clearAvailableLoaders,
    clearAvailableHaulers,
    fetchAvailableHaulers,
    fetchAllAvailableHaulers,
    fetchTrackingData,
    availableLoaders,
    availableHaulers,
    loadersLoading,
    haulersLoading,
    selectedLoader: storeSelectedLoader,
    setSelectedLoader: setStoreSelectedLoader,
    sourceRows,
    fetchSourceRows,
  } = useCycleTimeStore();

  const [localStartDate, setLocalStartDate] = useState(filters.startDate.split('T')[0]);
  const [localStartHour, setLocalStartHour] = useState(parseInt(filters.startDate.split('T')[1].split(':')[0]));
  const [localEndDate, setLocalEndDate] = useState(filters.endDate.split('T')[0]);
  const [localEndHour, setLocalEndHour] = useState(parseInt(filters.endDate.split('T')[1].split(':')[0]));
  
  const [selectedLoaders, setSelectedLoaders] = useState(storeSelectedLoader ? [storeSelectedLoader] : []);
  const [selectedHaulers, setSelectedHaulers] = useState([]);
  const [selectionMode, setSelectionMode] = useState('loader'); // 'loader' or 'haulers'
  const [activeShortcut, setActiveShortcut] = useState(null);
  const [sourceMode, setSourceMode] = useState('miforce');
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const handleSourceModeChange = async (event, nextMode) => {
    if (!nextMode) return;
    setSourceMode(nextMode);
    clearAvailableLoaders();
    clearAvailableHaulers();
    setSelectedLoaders([]);
    setSelectedHaulers([]);
    if (nextMode === 'both') {
      await fetchSourceRows('both');
      setComparisonOpen(true);
    } else {
      await fetchAvailableLoaders(nextMode);
    }
  };

  const handleComparisonApply = (unitNos) => {
    if (unitNos.length > 0) {
      setFilters({ unitNos });
      fetchTrackingData({ unitNos });
      setComparisonOpen(false);
      handleClose();
    }
  };

  const updateDateTimeFilters = (start, end) => {
      const formattedStart = format(start, "yyyy-MM-dd'T'HH:00");
      const formattedEnd = format(end, "yyyy-MM-dd'T'HH:00");

      setLocalStartDate(formattedStart.split('T')[0]);
      setLocalStartHour(parseInt(formattedStart.split('T')[1].split(':')[0]));
      setLocalEndDate(formattedEnd.split('T')[0]);
      setLocalEndHour(parseInt(formattedEnd.split('T')[1].split(':')[0]));

      setFilters({ startDate: formattedStart, endDate: formattedEnd });

      clearAvailableLoaders();
      clearAvailableHaulers();
      setSelectedLoaders([]);
      setSelectedHaulers([]);
  };
  
  const handleManualDateChange = () => {
      const newStartDate = `${localStartDate}T${String(localStartHour).padStart(2, '0')}:00`;
      const newEndDate = `${localEndDate}T${String(localEndHour).padStart(2, '0')}:00`;

      setFilters({ startDate: newStartDate, endDate: newEndDate });

      clearAvailableLoaders();
      clearAvailableHaulers();
      setSelectedLoaders([]);
      setSelectedHaulers([]);
  };
  
  useEffect(() => {
    if (open) {
      if (!activeShortcut) {
        setActiveShortcut('last_hour');
        const now = new Date();
        updateDateTimeFilters(subHours(now, 1), now);
      }
    }
  }, [open]);

  useEffect(() => {
    handleManualDateChange();
  }, [localStartDate, localStartHour, localEndDate, localEndHour]);

  useEffect(() => {
    if (open && selectionMode === 'haulers' && availableHaulers.length === 0 && !haulersLoading) {
      fetchAllAvailableHaulers();
    }
  }, [open, selectionMode]);
  
  const handleShortcutChange = (event, newShortcut) => {
    if (!newShortcut) return;
    setActiveShortcut(newShortcut);
    const now = new Date();
    switch (newShortcut) {
      case 'last_hour':
        updateDateTimeFilters(subHours(now, 1), now);
        break;
      case 'last_12_hours':
        updateDateTimeFilters(subHours(now, 12), now);
        break;
      case 'today':
        updateDateTimeFilters(startOfToday(), endOfToday());
        break;
      case 'yesterday':
        updateDateTimeFilters(startOfYesterday(), endOfYesterday());
        break;
      default:
        break;
    }
  };

  const handleLoaderChange = (event, newValue) => {
    const isSelectAll = newValue.some(option => option.value === 'all-loaders');
    if (isSelectAll) {
      setSelectedLoaders([selectAllLoaderOption, ...availableLoaders]);
    } else {
      setSelectedLoaders(newValue.filter(option => option.value !== 'all-loaders'));
    }
  };

  const handleHaulersChange = (event, newValue) => {
    setSelectedHaulers(newValue);
  };

  const handleApplyClick = () => {
    let unitNos = [];
    
    setStoreSelectedLoader(null);

    if (selectionMode === 'loader' && selectedLoaders.length > 0) {
      const actualLoaders = selectedLoaders.filter(l => l.value !== 'all-loaders');
      const allHaulers = actualLoaders.flatMap(loader => loader.haulers.map(h => h.label));
      unitNos = [...new Set(allHaulers)];
    } else if (selectionMode === 'haulers' && selectedHaulers.length > 0) {
      unitNos = selectedHaulers.map(h => h.label);
    }

    if (unitNos.length > 0) {
      const selectedFilters = {
        startDate: `${localStartDate}T${String(localStartHour).padStart(2, '0')}:00`,
        endDate: `${localEndDate}T${String(localEndHour).padStart(2, '0')}:00`,
        unitNos,
      };
      setFilters(selectedFilters);
      fetchTrackingData(selectedFilters);
    }
    handleClose();
  };
  
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  const haulerStats = useMemo(() => {
    const total = availableHaulers.length;
    const avail = availableHaulers.filter(h => h.available !== false).length;
    return { total, avail, noData: total - avail };
  }, [availableHaulers]);

  const loaderSelectedHaulerCount = useMemo(() => {
    const actualLoaders = selectedLoaders.filter(l => l.value !== 'all-loaders');
    const all = actualLoaders.flatMap(loader => (loader.haulers || []).map(h => h.label));
    return new Set(all).size;
  }, [selectedLoaders]);

  const selectedHaulersAvailCount = useMemo(
    () => selectedHaulers.filter(h => h.available !== false).length,
    [selectedHaulers]
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          background: `
            linear-gradient(145deg,
              rgba(255, 255, 255, 0.98) 0%,
              rgba(248, 250, 252, 0.95) 50%,
              rgba(241, 245, 249, 0.92) 100%
            )
          `,
          backdropFilter: 'blur(24px) saturate(1.2)',
          color: '#1e293b',
          borderRadius: '16px',
          border: '1px solid rgba(203, 213, 225, 0.4)',
          boxShadow: `
            0 32px 80px rgba(15, 23, 42, 0.12),
            0 16px 40px rgba(30, 64, 175, 0.08),
            0 8px 20px rgba(5, 150, 105, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.4)
          `,
          overflow: 'visible',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #1e40af 0%, #3b82f6 25%, #059669 50%, #10b981 75%, #1e40af 100%)',
            backgroundSize: '300% 100%',
            animation: 'gradient-flow 3s ease-in-out infinite',
          },
          '@keyframes gradient-flow': {
            '0%, 100%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
          },
        }
      }}
    >
      <DialogTitle sx={{
        m: 0,
        p: 3,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(203, 213, 225, 0.3)',
        position: 'relative',
        zIndex: 2,
      }}>
        <Typography variant="h6" component="div" sx={{
          fontWeight: 700,
          color: '#1e293b',
          fontSize: '1.35rem',
          letterSpacing: '-0.02em',
          textShadow: '0 1px 2px rgba(15, 23, 42, 0.1)',
        }}>Filter Analisis</Typography>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            color: '#64748b',
            background: 'rgba(248, 250, 252, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(203, 213, 225, 0.3)',
            borderRadius: 2,
            width: 40,
            height: 40,
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '&:hover': {
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderColor: 'rgba(239, 68, 68, 0.2)',
              transform: 'scale(1.1) rotate(90deg)',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
            }
          }}
        ><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{
        borderColor: 'rgba(203, 213, 225, 0.3)',
        p: 3,
        background: 'transparent',
        overflow: 'visible',
      }}>
        <Box component="form" noValidate autoComplete="off">
            <ToggleButtonGroup
              value={activeShortcut}
              exclusive
              onChange={handleShortcutChange}
              fullWidth
              sx={{
                mb: 3,
                '& .MuiToggleButton-root': {
                  color: '#64748b',
                  background: 'rgba(248, 250, 252, 0.6)',
                  border: '1px solid rgba(203, 213, 225, 0.3)',
                  borderRadius: 2,
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#1e40af',
                    borderColor: 'rgba(30, 64, 175, 0.2)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.08)',
                  },
                  '&.Mui-selected': {
                    background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.1) 0%, rgba(5, 150, 105, 0.08) 100%)',
                    color: '#1e40af',
                    borderColor: 'rgba(30, 64, 175, 0.2)',
                    fontWeight: 600,
                    '&:hover': {
                      background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.15) 0%, rgba(5, 150, 105, 0.12) 100%)',
                    }
                  }
                }
              }}
            >
                <ToggleButton value="last_hour">Jam Terakhir</ToggleButton>
                <ToggleButton value="last_12_hours">12 Jam Terakhir</ToggleButton>
                <ToggleButton value="today">Hari Ini</ToggleButton>
                <ToggleButton value="yesterday">Kemarin</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
                <TextField
                  name="startDate"
                  label="Dari Tanggal"
                  type="date"
                  fullWidth
                  value={localStartDate}
                  onChange={(e) => { setLocalStartDate(e.target.value); setActiveShortcut(null); }}
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      color: '#64748b',
                      fontWeight: 500,
                    }
                  }}
                  sx={{
                    '& .MuiInputBase-root': {
                      color: '#1e293b',
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(8px)',
                    },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '& fieldset': {
                        borderColor: 'rgba(203, 213, 225, 0.4)'
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(30, 64, 175, 0.3)'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#1e40af',
                        borderWidth: '2px',
                      }
                    }
                  }}
                />
                <FormControl sx={{
                  minWidth: 120,
                  '& .MuiInputLabel-root': {
                    color: '#64748b',
                    fontWeight: 500,
                  },
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 2,
                  }
                }}>
                    <InputLabel>Jam</InputLabel>
                    <Select
                      native
                      value={localStartHour}
                      onChange={(e) => { setLocalStartHour(e.target.value); setActiveShortcut(null); }}
                      sx={{
                        color: '#1e293b',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(203, 213, 225, 0.4)'
                        },
                        '& .MuiSvgIcon-root': {
                          color: '#64748b'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(30, 64, 175, 0.3)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#1e40af',
                          borderWidth: '2px',
                        }
                      }}
                    >
                        {hourOptions.map(h => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}:00
                          </option>
                        ))}
                    </Select>
                </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
                <TextField
                  name="endDate"
                  label="Sampai Tanggal"
                  type="date"
                  fullWidth
                  value={localEndDate}
                  onChange={(e) => { setLocalEndDate(e.target.value); setActiveShortcut(null); }}
                  InputLabelProps={{
                    shrink: true,
                    sx: {
                      color: '#64748b',
                      fontWeight: 500,
                    }
                  }}
                  sx={{
                    '& .MuiInputBase-root': {
                      color: '#1e293b',
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(8px)',
                    },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '& fieldset': {
                        borderColor: 'rgba(203, 213, 225, 0.4)'
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(30, 64, 175, 0.3)'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#1e40af',
                        borderWidth: '2px',
                      }
                    }
                  }}
                />
                <FormControl sx={{
                  minWidth: 120,
                  '& .MuiInputLabel-root': {
                    color: '#64748b',
                    fontWeight: 500,
                  },
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 2,
                  }
                }}>
                    <InputLabel>Jam</InputLabel>
                    <Select
                      native
                      value={localEndHour}
                      onChange={(e) => { setLocalEndHour(e.target.value); setActiveShortcut(null); }}
                      sx={{
                        color: '#1e293b',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(203, 213, 225, 0.4)'
                        },
                        '& .MuiSvgIcon-root': {
                          color: '#64748b'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(30, 64, 175, 0.3)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#1e40af',
                          borderWidth: '2px',
                        }
                      }}
                    >
                        {hourOptions.map(h => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}:00
                          </option>
                        ))}
                    </Select>
                </FormControl>
            </Box>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 700, color: '#334155' }}>
            Mode Seleksi
          </Typography>

          <ToggleButtonGroup
            value={selectionMode}
            exclusive
            onChange={(event, newMode) => {
              if (newMode) {
                setSelectionMode(newMode);
                setSelectedLoaders([]);
                setSelectedHaulers([]);
              }
            }}
            fullWidth
            sx={{
              mt: 3,
              mb: 2,
              '& .MuiToggleButton-root': {
                color: '#64748b',
                background: 'rgba(248, 250, 252, 0.6)',
                border: '1px solid rgba(203, 213, 225, 0.3)',
                borderRadius: 2,
                fontWeight: 500,
                fontSize: '0.875rem',
                textTransform: 'none',
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.1) 0%, rgba(5, 150, 105, 0.08) 100%)',
                  color: '#1e40af',
                  borderColor: 'rgba(30, 64, 175, 0.2)',
                  fontWeight: 600,
                }
              }
            }}
          >
            <ToggleButton value="loader">Per Loader</ToggleButton>
            <ToggleButton value="haulers">Per Unit</ToggleButton>
          </ToggleButtonGroup>

          {selectionMode === 'loader' && (
            <>
            <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, fontWeight: 700, color: '#334155' }}>
              Sumber Assignment
            </Typography>
            <ToggleButtonGroup
              value={sourceMode}
              exclusive
              onChange={handleSourceModeChange}
              fullWidth
              sx={{
                mb: 2,
                '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' },
              }}
            >
              <ToggleButton value="miforce">Miforce</ToggleButton>
              <ToggleButton value="timesheet">Timesheet</ToggleButton>
              <ToggleButton value="both">Bandingkan</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Assignment loader digunakan untuk menentukan unit DT.
            </Typography>
            {(selectedLoaders.length > 0 || availableLoaders.length > 0) && (
              <Box sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                mb: 1.5,
                px: 0.5,
                alignItems: 'center',
              }}>
                {availableLoaders.length > 0 && (
                  <Chip
                    size="small"
                    icon={<CloudDoneIcon sx={{ fontSize: '1rem !important' }} />}
                    label={`${availableLoaders.length} loader tersedia`}
                    sx={{
                      background: 'rgba(5, 150, 105, 0.1)',
                      color: '#047857',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      '& .MuiChip-icon': { color: '#059669' },
                    }}
                  />
                )}
                {selectedLoaders.filter(l => l.value !== 'all-loaders').length > 0 && (
                  <Chip
                    size="small"
                    icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                    label={`${selectedLoaders.filter(l => l.value !== 'all-loaders').length} loader dipilih · ${loaderSelectedHaulerCount} unit hauler`}
                    sx={{
                      background: 'rgba(30, 64, 175, 0.1)',
                      color: '#1e40af',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      '& .MuiChip-icon': { color: '#1e40af' },
                    }}
                  />
                )}
              </Box>
            )}
             {sourceMode !== 'both' && <Autocomplete
              multiple
              disableCloseOnSelect
              disablePortal
              PopperComponent={AutocompletePopper}
              noOptionsText={!loadersLoading && availableLoaders.length === 0 ? "Tidak ada loader yang tersedia" : "No options"}
              onOpen={() => {
                if (sourceMode !== 'both' && availableLoaders.length === 0) {
                  fetchAvailableLoaders(sourceMode);
                }
              }}
              options={availableLoaders.length > 0 ? [selectAllLoaderOption, ...availableLoaders] : []}
              value={selectedLoaders}
              onChange={handleLoaderChange}
              loading={loadersLoading}
              getOptionLabel={(option) => option.label || ''}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox style={{ marginRight: 8 }} checked={selected} />
                  {option.label}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pilih Loader"
                  sx={{
                    '& .MuiInputLabel-root': {
                      color: '#64748b',
                      fontWeight: 500,
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadersLoading ? <CircularProgress color="primary" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{
                '& .MuiInputBase-root': {
                  color: '#1e293b',
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(8px)',
                },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '& fieldset': {
                    borderColor: 'rgba(203, 213, 225, 0.4)'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(30, 64, 175, 0.3)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1e40af',
                    borderWidth: '2px',
                  }
                },
                '& .MuiSvgIcon-root': {
                  color: '#64748b'
                },
              }}
              PaperComponent={({ children, ...other }) => (
                <div
                  {...other}
                  style={{ ...autocompletePaperStyle, ...other.style }}
                >
                  {children}
                </div>
              )}
            />}
            </>
          )}

          {selectionMode === 'haulers' && (
            <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Pilih unit DT secara langsung tanpa assignment loader.
            </Typography>
            {(availableHaulers.length > 0 || selectedHaulers.length > 0) && (
              <Box sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                mb: 1.5,
                px: 0.5,
                alignItems: 'center',
              }}>
                {availableHaulers.length > 0 && (
                  <>
                    <Chip
                      size="small"
                      icon={<CloudDoneIcon sx={{ fontSize: '1rem !important' }} />}
                      label={`S3 tersedia: ${haulerStats.avail}`}
                      sx={{
                        background: 'rgba(5, 150, 105, 0.1)',
                        color: '#047857',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        '& .MuiChip-icon': { color: '#059669' },
                      }}
                    />
                    {haulerStats.noData > 0 && (
                      <Chip
                        size="small"
                        icon={<CloudOffIcon sx={{ fontSize: '1rem !important' }} />}
                        label={`Tanpa data: ${haulerStats.noData}`}
                        sx={{
                          background: 'rgba(148, 163, 184, 0.15)',
                          color: '#64748b',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          '& .MuiChip-icon': { color: '#94a3b8' },
                        }}
                      />
                    )}
                  </>
                )}
                {selectedHaulers.length > 0 && (
                  <Chip
                    size="small"
                    icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                    label={`Dipilih: ${selectedHaulers.length} unit${selectedHaulersAvailCount !== selectedHaulers.length ? ` (${selectedHaulersAvailCount} dgn data S3)` : ''}`}
                    sx={{
                      background: 'rgba(30, 64, 175, 0.1)',
                      color: '#1e40af',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      '& .MuiChip-icon': { color: '#1e40af' },
                    }}
                  />
                )}
              </Box>
            )}
            <Autocomplete
              multiple
              disableCloseOnSelect
              disablePortal
              PopperComponent={AutocompletePopper}
              noOptionsText={!haulersLoading && availableHaulers.length === 0 ? "Tidak ada hauler yang tersedia" : "No options"}
              onOpen={() => {
                if (availableHaulers.length === 0) {
                  fetchAllAvailableHaulers();
                }
              }}
              options={availableHaulers}
              value={selectedHaulers}
              onChange={handleHaulersChange}
              loading={haulersLoading}
              getOptionLabel={(option) => option.label || ''}
              getOptionDisabled={(option) => option.available === false}
              renderOption={(props, option, { selected }) => {
                const isAvailable = option.available !== false;
                return (
                  <li
                    {...props}
                    style={{
                      ...props.style,
                      opacity: isAvailable ? 1 : 0.55,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Checkbox style={{ marginRight: 4 }} checked={selected} disabled={!isAvailable} />
                    {isAvailable ? (
                      <CloudDoneIcon sx={{ fontSize: '1rem', color: '#059669', mr: 0.5 }} />
                    ) : (
                      <CloudOffIcon sx={{ fontSize: '1rem', color: '#94a3b8', mr: 0.5 }} />
                    )}
                    <span style={{ flex: 1, color: isAvailable ? '#1e293b' : '#94a3b8' }}>{option.label}</span>
                    {!isAvailable && (
                      <Chip
                        size="small"
                        label="no S3 data"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          background: 'rgba(148, 163, 184, 0.15)',
                          color: '#64748b',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    )}
                  </li>
                );
              }}
              renderInput={(params) => {
                const availCount = haulerStats.avail;
                const totalCount = haulerStats.total;
                return (
                <TextField
                  {...params}
                  label={
                    totalCount > 0
                      ? `Pilih Unit DT (${availCount} / ${totalCount} tersedia)`
                      : 'Pilih Unit DT'
                  }
                  sx={{
                    '& .MuiInputLabel-root': {
                      color: '#64748b',
                      fontWeight: 500,
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {haulersLoading ? <CircularProgress color="primary" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
                );
              }}
              sx={{
                '& .MuiInputBase-root': {
                  color: '#1e293b',
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(8px)',
                },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '& fieldset': {
                    borderColor: 'rgba(203, 213, 225, 0.4)'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(30, 64, 175, 0.3)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1e40af',
                    borderWidth: '2px',
                  }
                },
                '& .MuiSvgIcon-root': {
                  color: '#64748b'
                },
              }}
              PaperComponent={({ children, ...other }) => (
                <div
                  {...other}
                  style={{ ...autocompletePaperStyle, ...other.style }}
                >
                  {children}
                </div>
              )}
            />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{
        padding: '20px 24px',
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(203, 213, 225, 0.3)',
        gap: 2,
      }}>
        <Button
          onClick={handleClose}
          sx={{
            color: '#64748b',
            background: 'rgba(248, 250, 252, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(203, 213, 225, 0.4)',
            borderRadius: 2,
            fontWeight: 600,
            fontSize: '0.95rem',
            textTransform: 'none',
            px: 3,
            py: 1.5,
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#1e293b',
              borderColor: 'rgba(203, 213, 225, 0.6)',
              transform: 'translateY(-1px) scale(1.02)',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            }
          }}
        >
          Batal
        </Button>
        <Button
          onClick={handleApplyClick}
          variant="contained"
          autoFocus
          disabled={
            (selectionMode === 'loader' && selectedLoaders.length === 0) ||
            (selectionMode === 'haulers' && selectedHaulers.length === 0)
          }
          sx={{
            background: 'linear-gradient(135deg, #1e40af 0%, #059669 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 2,
            fontWeight: 600,
            fontSize: '0.95rem',
            textTransform: 'none',
            px: 3,
            py: 1.5,
            boxShadow: '0 4px 16px rgba(30, 64, 175, 0.25)',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
              transition: 'left 0.6s ease',
            },
            '&:hover': {
              background: 'linear-gradient(135deg, #1d4ed8 0%, #047857 100%)',
              transform: 'translateY(-2px) scale(1.05)',
              boxShadow: `
                0 8px 25px rgba(30, 64, 175, 0.3),
                0 4px 12px rgba(5, 150, 105, 0.2)
              `,
              '&::before': {
                left: '100%',
              }
            },
            '&:active': {
              transform: 'translateY(0) scale(1.02)',
            },
            '&:disabled': {
              background: 'rgba(203, 213, 225, 0.3)',
              color: 'rgba(100, 116, 139, 0.5)',
              boxShadow: 'none',
              transform: 'none',
            }
          }}
        >
          Terapkan Filter
        </Button>
      </DialogActions>
      <SourceComparisonModal
        open={comparisonOpen}
        rows={sourceRows}
        onClose={() => setComparisonOpen(false)}
        onApply={handleComparisonApply}
      />
    </Dialog>
  );
};

export default FilterModal;
