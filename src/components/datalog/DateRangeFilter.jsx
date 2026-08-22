import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Popover, TextField, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  format,
  subHours,
  subDays,
  startOfToday,
  endOfToday,
  startOfYesterday,
  endOfYesterday,
} from 'date-fns';

// Filter Date Range untuk Datalog Record.
// Pakai pola FilterModal (preset shortcut + native date input + pemilihan jam)
// tanpa dependency baru — hanya MUI + date-fns yang sudah dipakai.
// Granularitas waktu PER-JAM (menit selalu :00). Pemilih jam memakai kolom
// scroll INLINE di dalam popover (bukan dropdown melayang) supaya posisinya
// selalu benar dan tidak menutupi tabel.

const fmt = (d) => format(d, "yyyy-MM-dd'T'HH:00");

// value disimpan sebagai 'yyyy-MM-ddTHH:00'. Pisah jadi date + hour (0-23).
const splitVal = (value) => {
  if (!value) return { date: '', hour: 0 };
  const [date, rest = '00:00'] = value.split('T');
  const hour = parseInt(rest.split(':')[0], 10) || 0;
  return { date, hour };
};
const joinVal = (date, hour) => `${date}T${String(hour).padStart(2, '0')}:00`;
const displayVal = (value) => {
  const { date, hour } = splitVal(value);
  return `${date} ${String(hour).padStart(2, '0')}:00`;
};

const PRESETS = [
  { key: 'lasthour', label: 'Last Hour', range: () => [subHours(new Date(), 1), new Date()] },
  { key: 'today', label: 'Today', range: () => [startOfToday(), endOfToday()] },
  { key: 'yesterday', label: 'Yesterday', range: () => [startOfYesterday(), endOfYesterday()] },
  { key: 'last24h', label: 'Last 24 Hours', range: () => [subHours(new Date(), 24), new Date()] },
  { key: 'last2d', label: 'Last 2 Days', range: () => [subDays(new Date(), 2), new Date()] },
  { key: 'last3d', label: 'Last 3 Days', range: () => [subDays(new Date(), 3), new Date()] },
  { key: 'last7d', label: 'Last 7 Days', range: () => [subDays(new Date(), 7), new Date()] },
  { key: 'last30d', label: 'Last 30 Days', range: () => [subDays(new Date(), 30), new Date()] },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

const inputSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '6px', background: '#fff' },
  '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#059669' },
};

export default function DateRangeFilter({ from, to, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [draft, setDraft] = useState({ from, to });
  const open = Boolean(anchorEl);
  const startColRef = useRef(null);
  const endColRef = useRef(null);

  // Sinkronkan draft dengan nilai terbaru tiap popover dibuka.
  useEffect(() => {
    if (open) setDraft({ from, to });
  }, [open, from, to]);

  const start = splitVal(draft.from);
  const end = splitVal(draft.to);

  // Scroll kolom jam ke nilai terpilih saat popover dibuka.
  useEffect(() => {
    if (!open) return undefined;
    const scrollTo = (ref, hour) => {
      const el = ref.current?.querySelector(`[data-hour="${hour}"]`);
      if (el) el.scrollIntoView({ block: 'center' });
    };
    const t = setTimeout(() => {
      scrollTo(startColRef, splitVal(draft.from).hour);
      scrollTo(endColRef, splitVal(draft.to).hour);
    }, 0);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (preset) => {
    const [s, e] = preset.range();
    setDraft({ from: fmt(s), to: fmt(e) });
  };

  const setStart = (patch) => setDraft((d) => {
    const cur = splitVal(d.from);
    return { ...d, from: joinVal(patch.date ?? cur.date, patch.hour ?? cur.hour) };
  });
  const setEnd = (patch) => setDraft((d) => {
    const cur = splitVal(d.to);
    return { ...d, to: joinVal(patch.date ?? cur.date, patch.hour ?? cur.hour) };
  });

  const handleOk = () => {
    onChange(draft.from, draft.to);
    setAnchorEl(null);
  };

  const renderHourColumn = (colRef, value, onSelect) => (
    <Box
      ref={colRef}
      sx={{
        width: 160,
        height: 200,
        overflowY: 'auto',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
      }}
    >
      {HOUR_OPTIONS.map((h) => (
        <Box
          key={h}
          data-hour={h}
          onClick={() => onSelect(h)}
          sx={{
            px: 1.5,
            py: 0.75,
            fontSize: 14,
            textAlign: 'center',
            cursor: 'pointer',
            fontWeight: h === value ? 700 : 500,
            color: h === value ? '#059669' : '#334155',
            background: h === value ? 'rgba(5,150,105,0.12)' : 'transparent',
            '&:hover': { background: 'rgba(5,150,105,0.08)' },
          }}
        >
          {String(h).padStart(2, '0')}:00
        </Box>
      ))}
    </Box>
  );

  return (
    <>
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 0.75,
          minWidth: 340,
          border: '1px solid',
          borderColor: open ? '#059669' : '#cbd5e1',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          '&:hover': { borderColor: '#059669' },
        }}
      >
        <AccessTimeIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
        <Typography sx={{ color: '#1e293b', fontSize: 14 }}>{displayVal(from)}</Typography>
        <Typography sx={{ color: '#94a3b8', fontSize: 13, mx: 0.5 }}>To</Typography>
        <Typography sx={{ color: '#1e293b', fontSize: 14 }}>{displayVal(to)}</Typography>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { borderRadius: '10px', boxShadow: '0 12px 40px rgba(15,23,42,0.15)', overflow: 'hidden' } } }}
      >
        <Box sx={{ display: 'flex' }}>
          {/* Preset shortcuts */}
          <Box sx={{ width: 150, borderRight: '1px solid #e2e8f0', py: 1 }}>
            {PRESETS.map((preset) => (
              <Box
                key={preset.key}
                onClick={() => applyPreset(preset)}
                sx={{
                  px: 2.5,
                  py: 1.25,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  '&:hover': { background: 'rgba(5,150,105,0.08)', color: '#059669' },
                }}
              >
                {preset.label}
              </Box>
            ))}
          </Box>

          {/* Start / End pickers */}
          <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  size="small"
                  type="date"
                  value={start.date}
                  onChange={(e) => setStart({ date: e.target.value })}
                  sx={{ ...inputSx, width: 160 }}
                />
                {renderHourColumn(startColRef, start.hour, (h) => setStart({ hour: h }))}
              </Box>

              <ChevronRightIcon sx={{ color: '#94a3b8', mt: 1 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  size="small"
                  type="date"
                  value={end.date}
                  onChange={(e) => setEnd({ date: e.target.value })}
                  sx={{ ...inputSx, width: 160 }}
                />
                {renderHourColumn(endColRef, end.hour, (h) => setEnd({ hour: h }))}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleOk}
                sx={{ px: 4, background: '#059669', '&:hover': { background: '#047857' } }}
              >
                OK
              </Button>
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
