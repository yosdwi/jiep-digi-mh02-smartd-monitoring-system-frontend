import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton,
  Typography, Box, TextField, Autocomplete, CircularProgress, Checkbox, Chip,
  ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select,
  Popper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import useMIRStore from '../../stores/mirStore';
import { format, subHours, startOfToday, endOfToday, startOfYesterday, endOfYesterday } from 'date-fns';

const AutocompletePopper = (props) => {
  const width = props.anchorEl?.clientWidth;
  return (
    <Popper
      {...props}
      placement="bottom-start"
      style={{ ...props.style, width, zIndex: 1700 }}
      modifiers={[
        { name: 'flip', enabled: false },
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

const MIRFilterModal = ({ open, handleClose }) => {
  const {
    filters,
    setFilters,
    fetchTrackingData,
    fetchMIRDevices,
    devices,
  } = useMIRStore();

  const [localStartDate, setLocalStartDate] = useState(filters.startDate.split('T')[0]);
  const [localStartHour, setLocalStartHour] = useState(parseInt(filters.startDate.split('T')[1].split(':')[0]));
  const [localEndDate, setLocalEndDate] = useState(filters.endDate.split('T')[0]);
  const [localEndHour, setLocalEndHour] = useState(parseInt(filters.endDate.split('T')[1].split(':')[0]));

  const [activeShortcut, setActiveShortcut] = useState(null);

  const [haulerMode, setHaulerMode] = useState('all'); // 'all' atau 'haulers'
  const [selectedHaulers, setSelectedHaulers] = useState([]);
  const [haulersLoading, setHaulersLoading] = useState(false);

  const updateDateTimeFilters = (start, end) => {
      const formattedStart = format(start, "yyyy-MM-dd'T'HH:00");
      const formattedEnd = format(end, "yyyy-MM-dd'T'HH:00");

      setLocalStartDate(formattedStart.split('T')[0]);
      setLocalStartHour(parseInt(formattedStart.split('T')[1].split(':')[0]));
      setLocalEndDate(formattedEnd.split('T')[0]);
      setLocalEndHour(parseInt(formattedEnd.split('T')[1].split(':')[0]));

      setFilters({ startDate: formattedStart, endDate: formattedEnd });
  };

  const handleManualDateChange = () => {
      const newStartDate = `${localStartDate}T${String(localStartHour).padStart(2, '0')}:00`;
      const newEndDate = `${localEndDate}T${String(localEndHour).padStart(2, '0')}:00`;

      setFilters({ startDate: newStartDate, endDate: newEndDate });
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

  const handleHaulerModeChange = (event, newMode) => {
    if (!newMode) return;
    setHaulerMode(newMode);
    if (newMode === 'all') setSelectedHaulers([]);
  };

  const handleApplyClick = () => {
    handleManualDateChange();
    const deviceIds = haulerMode === 'haulers'
      ? selectedHaulers.map(h => h.deviceId)
      : [];
    setFilters({ deviceIds });
    fetchTrackingData();
    handleClose();
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

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
          overflow: 'hidden',
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
        }}>Filter MIR Movement</Typography>
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

            <ToggleButtonGroup
              value={haulerMode}
              exclusive
              onChange={handleHaulerModeChange}
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
              <ToggleButton value="all">Semua Unit Hauler</ToggleButton>
              <ToggleButton value="haulers">Pilih Multiple Haulers</ToggleButton>
            </ToggleButtonGroup>

            {haulerMode === 'haulers' && (
              <>
                {selectedHaulers.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5, px: 0.5, alignItems: 'center' }}>
                    <Chip
                      size="small"
                      icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                      label={`Dipilih: ${selectedHaulers.length} unit`}
                      sx={{
                        background: 'rgba(30, 64, 175, 0.1)',
                        color: '#1e40af',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        '& .MuiChip-icon': { color: '#1e40af' },
                      }}
                    />
                  </Box>
                )}
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  disablePortal
                  PopperComponent={AutocompletePopper}
                  noOptionsText={!haulersLoading && devices.length === 0 ? "Tidak ada unit hauler yang tersedia" : "No options"}
                  onOpen={async () => {
                    if (devices.length === 0) {
                      setHaulersLoading(true);
                      await fetchMIRDevices();
                      setHaulersLoading(false);
                    }
                  }}
                  options={devices}
                  value={selectedHaulers}
                  onChange={(event, newValue) => setSelectedHaulers(newValue)}
                  loading={haulersLoading}
                  isOptionEqualToValue={(option, value) => option.deviceId === value.deviceId}
                  getOptionLabel={(option) => option.unitNo || option.deviceId || ''}
                  renderOption={(props, option, { selected }) => (
                    <li {...props} key={option.deviceId}>
                      <Checkbox style={{ marginRight: 8 }} checked={selected} />
                      {option.unitNo || option.deviceId}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={devices.length > 0 ? `Pilih Unit Hauler (${devices.length} unit)` : 'Pilih Unit Hauler'}
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
                  )}
                  sx={{
                    '& .MuiInputBase-root': {
                      color: '#1e293b',
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(8px)',
                    },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '& fieldset': { borderColor: 'rgba(203, 213, 225, 0.4)' },
                      '&:hover fieldset': { borderColor: 'rgba(30, 64, 175, 0.3)' },
                      '&.Mui-focused fieldset': { borderColor: '#1e40af', borderWidth: '2px' }
                    },
                    '& .MuiSvgIcon-root': { color: '#64748b' },
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
          disabled={haulerMode === 'haulers' && selectedHaulers.length === 0}
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
    </Dialog>
  );
};

export default MIRFilterModal;
