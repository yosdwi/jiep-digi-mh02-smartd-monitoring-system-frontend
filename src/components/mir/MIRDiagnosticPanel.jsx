import React, { useMemo } from 'react';
import {
  Drawer, Box, Typography, IconButton, Chip, Divider, Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import useMIRStore from '../../stores/mirStore';

// Apakah ping ke server RTCM dianggap sukses (IPStatus.Success dari backend)
const isPingSuccess = (status) => typeof status === 'string' && /^(success|berhasil|ok)$/i.test(status.trim());

// Apakah fix quality termasuk RTK Fixed (kondisi ideal)
const isFixed = (point) => {
  if (point.fixQuality === 4) return true;
  const label = point.fixQualityLabel || point.gpsQuality || '';
  return /rtk\s*fix(ed)?/i.test(label) || /^fixed$/i.test(label);
};

const labelOf = (point) => point.fixQualityLabel || point.gpsQuality || 'Unknown';

const fmtNum = (n, digits = 1) =>
  (n === null || n === undefined || Number.isNaN(n)) ? '–' : Number(n).toFixed(digits);

const fmtDateTime = (d) => {
  if (!d) return '–';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '–';
  return date.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
};

const fixColor = (label) => {
  const l = (label || '').toLowerCase();
  if (l.includes('fixed') || l.includes('rtk fix')) return '#10b981';
  if (l.includes('float')) return '#f59e0b';
  if (l.includes('dgps')) return '#3b82f6';
  if (l.includes('single')) return '#8b5cf6';
  return '#ef4444'; // no fix / no gps
};

const StatCard = ({ label, value, unit, hint, color = '#1e293b' }) => (
  <Box sx={{
    flex: 1,
    minWidth: 120,
    p: 1.5,
    borderRadius: 2,
    bgcolor: 'rgba(248, 250, 252, 0.8)',
    border: '1px solid rgba(203, 213, 225, 0.4)',
  }}>
    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
      {label}
    </Typography>
    <Typography sx={{ color, fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.2 }}>
      {value}{unit && <span style={{ fontSize: '0.8rem', fontWeight: 600, marginLeft: 2 }}>{unit}</span>}
    </Typography>
    {hint && (
      <Typography variant="caption" sx={{ color: '#94a3b8' }}>{hint}</Typography>
    )}
  </Box>
);

const CountRow = ({ label, count, total, color }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <Box sx={{ mb: 0.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#1e293b' }}>{label}</Typography>
        </Box>
        <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
          {count} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pct.toFixed(1)}%)</span>
        </Typography>
      </Box>
      <Box sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(203, 213, 225, 0.35)', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, transition: 'width 0.3s ease' }} />
      </Box>
    </Box>
  );
};

const MatrixCell = ({ title, value, pct, color, hint }) => (
  <Tooltip title={hint} arrow placement="top">
    <Box sx={{
      p: 1.5,
      borderRadius: 2,
      bgcolor: `${color}14`,
      border: `1px solid ${color}55`,
    }}>
      <Typography variant="caption" sx={{ color, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.68rem' }}>
        {title}
      </Typography>
      <Typography sx={{ color: '#1e293b', fontWeight: 700, fontSize: '1.4rem', lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: '#64748b' }}>{pct}%</Typography>
    </Box>
  </Tooltip>
);

const MIRDiagnosticPanel = ({ open, onClose }) => {
  const trackingData = useMIRStore((s) => s.trackingData);

  const stats = useMemo(() => {
    const data = trackingData || [];
    const total = data.length;

    const fixCounts = {};
    const pingCounts = {};
    const errorCounts = {};
    let pingTimeSum = 0, pingTimeN = 0;
    let pingTtlSum = 0, pingTtlN = 0;
    let latestCorrection = null;
    let fixedCount = 0;

    // Confusion matrix (prediksi = ping sukses, aktual = RTK Fixed)
    let tp = 0, fp = 0, fn = 0, tn = 0;

    // Latency koreksi (umur koreksi terhadap waktu titik), dipisah fixed vs non-fixed
    let ageFixedSum = 0, ageFixedN = 0;
    let ageUnfixedSum = 0, ageUnfixedN = 0;

    for (const p of data) {
      const flabel = labelOf(p);
      fixCounts[flabel] = (fixCounts[flabel] || 0) + 1;

      const pstatus = p.pingStatus || 'Unknown';
      pingCounts[pstatus] = (pingCounts[pstatus] || 0) + 1;

      if (p.pingError && String(p.pingError).trim() !== '') {
        errorCounts[p.pingError] = (errorCounts[p.pingError] || 0) + 1;
      }

      if (typeof p.pingTime === 'number' && p.pingTime >= 0) { pingTimeSum += p.pingTime; pingTimeN++; }
      if (typeof p.pingTtl === 'number' && p.pingTtl >= 0) { pingTtlSum += p.pingTtl; pingTtlN++; }

      if (p.lastCorrection) {
        const t = new Date(p.lastCorrection).getTime();
        if (!Number.isNaN(t) && (latestCorrection === null || t > latestCorrection)) latestCorrection = t;
      }

      const fixed = isFixed(p);
      if (fixed) fixedCount++;
      const ping = isPingSuccess(p.pingStatus);

      if (ping && fixed) tp++;
      else if (ping && !fixed) fp++;
      else if (!ping && fixed) fn++;
      else tn++;

      // umur koreksi (detik) — abaikan nilai negatif/absurd (>1 hari) untuk hindari noise tz
      if (p.lastCorrection && p.timestamp) {
        const ageSec = (new Date(p.timestamp).getTime() - new Date(p.lastCorrection).getTime()) / 1000;
        if (ageSec >= 0 && ageSec <= 86400) {
          if (fixed) { ageFixedSum += ageSec; ageFixedN++; }
          else { ageUnfixedSum += ageSec; ageUnfixedN++; }
        }
      }
    }

    const consistency = total > 0 ? ((tp + tn) / total) * 100 : 0;
    const validFixRate = total > 0 ? (fixedCount / total) * 100 : 0;

    return {
      total,
      fixCounts: Object.entries(fixCounts).sort((a, b) => b[1] - a[1]),
      pingCounts: Object.entries(pingCounts).sort((a, b) => b[1] - a[1]),
      errorCounts: Object.entries(errorCounts).sort((a, b) => b[1] - a[1]),
      avgPingTime: pingTimeN > 0 ? pingTimeSum / pingTimeN : null,
      avgPingTtl: pingTtlN > 0 ? pingTtlSum / pingTtlN : null,
      latestCorrection,
      fixedCount,
      tp, fp, fn, tn,
      consistency,
      validFixRate,
      avgAgeFixed: ageFixedN > 0 ? ageFixedSum / ageFixedN : null,
      avgAgeUnfixed: ageUnfixedN > 0 ? ageUnfixedSum / ageUnfixedN : null,
    };
  }, [trackingData]);

  const { total } = stats;
  const matrixTotal = stats.tp + stats.fp + stats.fn + stats.tn;
  const mp = (n) => (matrixTotal > 0 ? ((n / matrixTotal) * 100).toFixed(1) : '0.0');

  const SectionTitle = ({ children }) => (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mt: 2.5, mb: 1 }}>
      {children}
    </Typography>
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 460 },
          background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
          backdropFilter: 'blur(24px)',
        }
      }}
    >
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GpsFixedIcon sx={{ color: '#1e40af' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Diagnostik RTK & Ping
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          {total.toLocaleString('id-ID')} titik data dianalisis
        </Typography>

        {total === 0 ? (
          <Box sx={{ mt: 4, textAlign: 'center', color: '#94a3b8' }}>
            <Typography variant="body2">
              Belum ada data. Terapkan filter terlebih dahulu untuk melihat diagnostik.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Ringkasan analitik */}
            <SectionTitle>Resume Analitik</SectionTitle>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <StatCard
                label="Total Valid Fix"
                value={`${stats.consistency.toFixed(0)}`}
                unit="%"
                color="#059669"
                hint="konsistensi ping ↔ fix"
              />
              <StatCard
                label="RTK Fixed"
                value={`${stats.validFixRate.toFixed(0)}`}
                unit="%"
                color="#10b981"
                hint={`${stats.fixedCount} titik`}
              />
              <StatCard
                label="Avg Ping Time"
                value={fmtNum(stats.avgPingTime)}
                unit="ms"
                color="#1e40af"
              />
              <StatCard
                label="Avg Ping TTL"
                value={fmtNum(stats.avgPingTtl, 0)}
                color="#1e40af"
              />
            </Box>

            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(30, 64, 175, 0.05)', border: '1px solid rgba(30,64,175,0.12)' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
                Koreksi RTCM terbaru
              </Typography>
              <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 600 }}>
                {fmtDateTime(stats.latestCorrection)}
              </Typography>
            </Box>

            {/* Confusion matrix */}
            <SectionTitle>Hubungan Ping ↔ Last Correction ↔ Fix</SectionTitle>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
              Prediksi = ping server sukses · Aktual = fix quality RTK Fixed
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <MatrixCell title="True Positif" value={stats.tp} pct={mp(stats.tp)} color="#10b981"
                hint="Ping sukses & RTK Fixed — kondisi ideal" />
              <MatrixCell title="False Positif" value={stats.fp} pct={mp(stats.fp)} color="#f59e0b"
                hint="Ping sukses tapi BELUM fix — ada latency/anomali" />
              <MatrixCell title="False Negatif" value={stats.fn} pct={mp(stats.fn)} color="#ef4444"
                hint="Ping gagal tapi tetap RTK Fixed — fix bertahan" />
              <MatrixCell title="True Negatif" value={stats.tn} pct={mp(stats.tn)} color="#64748b"
                hint="Ping gagal & tidak fix — konsisten" />
            </Box>

            <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
              <StatCard
                label="Latency koreksi (Fixed)"
                value={fmtNum(stats.avgAgeFixed, 0)}
                unit="s"
                color="#10b981"
                hint="rata-rata umur koreksi"
              />
              <StatCard
                label="Latency koreksi (Non-fix)"
                value={fmtNum(stats.avgAgeUnfixed, 0)}
                unit="s"
                color="#f59e0b"
                hint="rata-rata umur koreksi"
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Fix quality breakdown */}
            <SectionTitle>Fix Quality</SectionTitle>
            {stats.fixCounts.map(([label, count]) => (
              <CountRow key={label} label={label} count={count} total={total} color={fixColor(label)} />
            ))}

            {/* Ping status breakdown */}
            <SectionTitle>Ping Status</SectionTitle>
            {stats.pingCounts.map(([label, count]) => (
              <CountRow key={label} label={label} count={count} total={total}
                color={isPingSuccess(label) ? '#10b981' : '#ef4444'} />
            ))}

            {/* Ping errors */}
            <SectionTitle>Ping Error</SectionTitle>
            {stats.errorCounts.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                Tidak ada error tercatat.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {stats.errorCounts.map(([err, count]) => (
                  <Box key={err} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#475569', wordBreak: 'break-word', flex: 1 }}>
                      {err}
                    </Typography>
                    <Chip label={count} size="small" sx={{ height: 20, bgcolor: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 700 }} />
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default MIRDiagnosticPanel;
