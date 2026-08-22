import React, { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import { T, rtkLabel, zoneStatus, zoneShort, statusColor, cabinGlyph, isRtkFix, distLabel } from './mirTokens';
import { isValidLat, coordSentinelLabel } from '../../../utils/geo';

// Sidebar device list Operasi (mockup .side) — driven telemetry live (Redis via .NET, real).
// Taksonomi: Operasi menampilkan CABIN (alat berat ber-MIR) + ROVER (tiang perimeter geofence).
// Filter faceted: dipilih sesuai yang dicari operator (tipe · GPS · zona · status), bukan 1 baris.

const OFFLINE_MS = 5 * 60 * 1000; // > 5 menit = offline (spec §6 presence)

// Grup filter: OR di dalam grup, AND antar-grup. Kosong = tanpa batasan.
const FILTER_GROUPS = [
  { key: 'type', label: 'Tipe', opts: [{ k: 'cabin', label: 'Cabin' }, { k: 'rover', label: 'Rover' }] },
  { key: 'gps', label: 'GPS', opts: [{ k: 'rtkfix', label: 'RTK FIX' }, { k: 'nonrtk', label: 'Non-RTK' }] },
  {
    key: 'zone', label: 'Zona', opts: [
      { k: 'dumping', label: 'Area dumping' },
      { k: 'crossing', label: 'Area crossing' },
      { k: 'outside', label: 'Di luar zona' },
    ],
  },
  { key: 'presence', label: 'Status', opts: [{ k: 'online', label: 'Online' }, { k: 'offline', label: 'Offline' }] },
];
const ZONE_KEY = { CROSSING: 'crossing', DUMPING: 'dumping', OUTSIDE: 'outside' };
const CHIP_COLOR = { crossing: T.crit, dumping: T.warn, outside: T.g4 };

function ageLabel(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}j`;
}
const isOffline = (u) => !u.timestamp || Date.now() - u.timestamp > OFFLINE_MS;
const roverOffline = (r) => r.age_ms == null || r.age_ms > OFFLINE_MS;
const cabinFix = (u) => u.fix_quality ?? u.rtkfix ?? u.FixQuality;
const cabinZone = (u) => zoneStatus({ mirDistance: u.mir_distance, mirInArea: u.mir_in_area, mirUnsafe: u.mir_unsafe });
const groupName = (u) => (u.group ? `Grup ${u.group}` : 'Cabin (belum ter-grup)');

function Row({ u, selected, onSelect }) {
  const fix = cabinFix(u);
  const status = cabinZone(u);
  const offline = isOffline(u);
  const sat = u.gpsnumsat ?? u.NumSat ?? '—';
  const dist = u.mir_distance;
  const dl = distLabel(dist); // "X m" / "FARAWAY" (-9999) / null (no data)
  const speed = u.lastSpeed ?? u.VehicleSpeed;
  const speedLabel = !offline && speed != null ? `${Number(speed).toFixed(0)} km/h` : '—';
  const zoneBadge = !offline && (status === 'CROSSING' || status === 'DUMPING');
  return (
    <Box
      onClick={() => onSelect(u.deviceId)}
      sx={{
        display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 1.1, alignItems: 'center',
        p: '9px 11px 9px 16px', borderBottom: `1px solid ${T.g1}`, cursor: 'pointer',
        background: selected ? T.selBg : 'transparent',
        boxShadow: selected ? `inset 3px 0 0 ${T.sel}` : 'none',
        opacity: offline ? 0.6 : 1,
        '&:hover': { background: selected ? T.selBg : T.g0 },
      }}
    >
      <Box sx={{ fontFamily: T.mono, fontSize: 13, textAlign: 'center', color: offline ? T.g4 : statusColor(status) }}>
        {cabinGlyph(fix)}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ fontWeight: 600, fontSize: 13, color: T.ink, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.unitNo || u.deviceId}</span>
          {zoneBadge && (
            <Box component="span" sx={{
              background: status === 'CROSSING' ? T.crit : 'transparent',
              border: status === 'CROSSING' ? 'none' : `1px solid ${T.warn}`,
              color: status === 'CROSSING' ? '#fff' : T.warn,
              borderRadius: '3px', px: 0.6, fontSize: 9, letterSpacing: '.4px', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              {zoneShort(status)}
            </Box>
          )}
          {offline && (
            <Box component="span" sx={{ border: `1px solid ${T.g4}`, color: T.g6, borderRadius: '3px', px: 0.6, fontSize: 9, letterSpacing: '.5px', textTransform: 'uppercase' }}>
              usang
            </Box>
          )}
        </Box>
        <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g5, mt: '1px' }}>
          {rtkLabel(fix)} · {sat} sat · {ageLabel(u.timestamp)}
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        {dl == null ? (
          <Box sx={{ fontFamily: T.mono, fontSize: 10, color: coordSentinelLabel(u.latitude) ? T.warn : T.g6 }}>
            {coordSentinelLabel(u.latitude)
              ? coordSentinelLabel(u.latitude)
              : (isValidLat(u.latitude) ? Number(u.latitude).toFixed(4) : '—')}
          </Box>
        ) : dist >= 0 ? (
          <>
            <Box sx={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{dl}</Box>
            <Box sx={{ fontSize: 9, color: T.g5, textTransform: 'uppercase', letterSpacing: '.3px' }}>ke garis crossing</Box>
            <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g6, mt: '1px' }}>{speedLabel}</Box>
          </>
        ) : (
          <>
            <Box sx={{ fontSize: 11, fontWeight: 700, color: statusColor('OUTSIDE'), letterSpacing: '.3px' }}>{dl}</Box>
            <Box sx={{ fontFamily: T.mono, fontSize: 10, color: T.g6, mt: '1px' }}>{speedLabel}</Box>
          </>
        )}
      </Box>
    </Box>
  );
}

function RoverRow({ r }) {
  const fix = Number(r.rtkfix ?? r.RTKFix ?? -1);
  const fixOk = fix === 4;
  const fixLabel = fix === 4 ? 'RTK FIX' : fix === 5 ? 'RTK FLOAT' : fix >= 1 ? 'SINGLE' : 'NO FIX';
  const sat = r.gpsnumsat ?? '—';
  const age = r.age_ms != null ? Math.round(r.age_ms / 1000) : null;
  const ageStr = age != null ? (age < 60 ? `${age}s` : `${Math.round(age / 60)}m`) : '—';
  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 1, alignItems: 'center',
      p: '7px 11px 7px 14px', borderBottom: `1px solid ${T.g1}`, opacity: fixOk ? 1 : 0.55,
    }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: fixOk ? T.sel : T.g4, mt: '1px' }} />
      <Box>
        <Box sx={{ fontWeight: 600, fontSize: 12, color: T.ink, fontFamily: T.mono }}>
          R.{r.group ?? '?'}.{r.rovernumber ?? '?'}
        </Box>
        <Box sx={{ fontSize: 10, color: T.g5, fontFamily: T.mono }}>
          {fixLabel} · {sat} sat · {ageStr}
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right', fontSize: 10, color: T.g6, fontFamily: T.mono }}>
        {coordSentinelLabel(r.gpslat)
          ? <span style={{ color: T.warn }}>{coordSentinelLabel(r.gpslat)}</span>
          : (isValidLat(r.gpslat) ? Number(r.gpslat).toFixed(5) : '—')}
      </Box>
    </Box>
  );
}

export default function MirDeviceList({ units, rovers, selectedUnitId, onSelect }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => new Set()); // set of option keys
  const [collapsed, setCollapsed] = useState({});
  const [roverCollapsed, setRoverCollapsed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false); // panel corong filter (absolute, bukan MUI Popover — body di-scale)

  const toggle = (k) => setSel((s) => {
    const n = new Set(s);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });
  const groupSel = (g) => FILTER_GROUPS.find((x) => x.key === g).opts.filter((o) => sel.has(o.k)).map((o) => o.k);

  // Hitungan hidup per opsi (atas seluruh roster, lepas dari pilihan) → chip "Area crossing · 2".
  const counts = useMemo(() => {
    const c = { cabin: units.length, rover: (rovers || []).length, rtkfix: 0, nonrtk: 0, crossing: 0, dumping: 0, outside: 0, online: 0, offline: 0 };
    units.forEach((u) => {
      isRtkFix(cabinFix(u)) ? c.rtkfix++ : c.nonrtk++;
      const zk = ZONE_KEY[cabinZone(u)];
      if (zk) c[zk]++;
      isOffline(u) ? c.offline++ : c.online++;
    });
    (rovers || []).forEach((r) => {
      Number(r.rtkfix ?? r.RTKFix) === 4 ? c.rtkfix++ : c.nonrtk++;
      roverOffline(r) ? c.offline++ : c.online++;
    });
    return c;
  }, [units, rovers]);

  const passCabin = useMemo(() => {
    const typeS = groupSel('type'), gpsS = groupSel('gps'), zoneS = groupSel('zone'), presS = groupSel('presence');
    return (u) => {
      if (typeS.length && !typeS.includes('cabin')) return false;
      if (gpsS.length) {
        const k = isRtkFix(cabinFix(u)) ? 'rtkfix' : 'nonrtk';
        if (!gpsS.includes(k)) return false;
      }
      if (zoneS.length) {
        const zk = ZONE_KEY[cabinZone(u)];
        if (!zk || !zoneS.includes(zk)) return false;
      }
      if (presS.length) {
        const k = isOffline(u) ? 'offline' : 'online';
        if (!presS.includes(k)) return false;
      }
      return true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const passRover = useMemo(() => {
    const typeS = groupSel('type'), gpsS = groupSel('gps'), zoneS = groupSel('zone'), presS = groupSel('presence');
    return (r) => {
      if (typeS.length && !typeS.includes('rover')) return false;
      if (zoneS.length) return false; // zona = keadaan cabin; sembunyikan rover saat memfilter zona
      if (gpsS.length) {
        const k = Number(r.rtkfix ?? r.RTKFix) === 4 ? 'rtkfix' : 'nonrtk';
        if (!gpsS.includes(k)) return false;
      }
      if (presS.length) {
        const k = roverOffline(r) ? 'offline' : 'online';
        if (!presS.includes(k)) return false;
      }
      return true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return units.filter((u) => {
      if (term && !`${u.unitNo || ''} ${u.deviceId || ''}`.toLowerCase().includes(term)) return false;
      return passCabin(u);
    });
  }, [units, q, passCabin]);

  const roverList = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rovers || [])
      .filter((r) => {
        if (!passRover(r)) return false;
        if (term && !`r.${r.group}.${r.rovernumber}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => {
        const ga = `${a.group}`, gb = `${b.group}`;
        if (ga !== gb) return ga.localeCompare(gb);
        return Number(a.rovernumber ?? 0) - Number(b.rovernumber ?? 0);
      });
  }, [rovers, q, passRover]);

  // Grup cabin = c.group (live). Urut: grup ber-nama dulu, "belum ter-grup" terakhir.
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((u) => {
      const g = groupName(u);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(u);
    });
    return [...map.entries()].sort((a, b) => {
      const ua = a[0].startsWith('Cabin'), ub = b[0].startsWith('Cabin');
      return ua === ub ? a[0].localeCompare(b[0]) : ua ? 1 : -1;
    });
  }, [filtered]);

  const anySel = sel.size > 0;
  const shownCount = filtered.length + roverList.length;

  return (
    <Box sx={{ width: 340, flex: '0 0 340px', borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', background: T.w, minHeight: 0 }}>
      <Box sx={{ p: 1.25, borderBottom: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', gap: 0.85 }}>
        {/* Search + tombol corong (filter disembunyikan di popover — sidebar tetap bersih). */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0, border: `1px solid ${T.g3}`, borderRadius: '4px', px: 1, py: 0.6, color: T.g5, transition: 'border-color .15s', '&:focus-within': { borderColor: T.sel } }}>
            <SearchIcon sx={{ fontSize: 17, color: T.g4 }} />
            <Box
              component="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari cabin / rover…"
              sx={{ border: 'none', outline: 'none', flex: 1, minWidth: 0, fontFamily: T.ff, fontSize: 13, color: T.ink, background: 'none', '&::placeholder': { color: T.g4 } }}
            />
          </Box>
          <Box sx={{ position: 'relative', flex: '0 0 auto' }}>
            <Box
              component="button"
              title="Filter"
              onClick={() => setFilterOpen((o) => !o)}
              sx={{
                position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, border: `1px solid ${(anySel || filterOpen) ? T.sel : T.g3}`, borderRadius: '4px', cursor: 'pointer',
                background: (anySel || filterOpen) ? T.selBg : T.w, color: (anySel || filterOpen) ? T.sel : T.g6, transition: 'all .15s',
                '&:hover': { borderColor: T.sel, color: T.sel },
              }}
            >
              <FilterListIcon sx={{ fontSize: 18 }} />
              {anySel && (
                <Box sx={{
                  position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, px: '3px',
                  borderRadius: '8px', background: T.sel, color: T.w, fontSize: 9, fontWeight: 700, fontFamily: T.mono,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}>
                  {sel.size}
                </Box>
              )}
            </Box>

            {filterOpen && (
              <>
                {/* backdrop klik-luar (absolute, ikut ruang ber-scale — bukan portal) */}
                <Box onClick={() => setFilterOpen(false)} sx={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                {/* panel filter: muncul di kanan ikon corong, top-aligned (mengikuti referensi) */}
                <Box sx={{
                  position: 'absolute', top: 0, left: 'calc(100% + 8px)', zIndex: 41, width: 268,
                  background: T.w, border: `1px solid ${T.g3}`, borderRadius: '6px', p: 1.4,
                  boxShadow: '0 6px 24px rgba(15,23,42,.18)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.1 }}>
                    <Box sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: T.g5 }}>Filter</Box>
                    {anySel && (
                      <Box onClick={() => setSel(new Set())} sx={{ fontSize: 10.5, color: T.sel, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                        Hapus filter
                      </Box>
                    )}
                  </Box>
                  {FILTER_GROUPS.map((grp) => (
                    <Box key={grp.key} sx={{ mb: 1.1, '&:last-of-type': { mb: 0 } }}>
                      <Box sx={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.5px', color: T.g5, mb: 0.6 }}>{grp.label}</Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {grp.opts.map((o) => {
                          const on = sel.has(o.k);
                          const accent = CHIP_COLOR[o.k];
                          return (
                            <Box
                              key={o.k}
                              onClick={() => toggle(o.k)}
                              sx={{
                                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                                border: `1px solid ${on ? (accent || T.ink) : T.g3}`, borderRadius: '12px', px: 1, py: 0.3, fontSize: 10.5, cursor: 'pointer',
                                background: on ? (accent || T.ink) : T.w, color: on ? T.w : T.g6, lineHeight: 1.5,
                                '&:hover': { borderColor: accent || T.ink },
                              }}
                            >
                              {accent && !on && <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />}
                              {o.label}
                              <Box component="span" sx={{ fontFamily: T.mono, fontSize: 9.5, opacity: on ? 0.85 : 0.7 }}>{counts[o.k]}</Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 14 }}>
          <Box sx={{ fontSize: 10, color: T.g5, fontFamily: T.mono }}>{shownCount} ditampilkan</Box>
          {anySel && (
            <Box onClick={() => setSel(new Set())} sx={{ fontSize: 10, color: T.sel, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
              Hapus filter
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {units.length === 0 && (rovers || []).length === 0 && (
          <Box sx={{ p: 2, fontSize: 12, color: T.g5, textAlign: 'center' }}>Menunggu data telemetry…</Box>
        )}
        {units.length + (rovers || []).length > 0 && shownCount === 0 && (
          <Box sx={{ p: 2, fontSize: 12, color: T.g5, textAlign: 'center' }}>Tak ada unit cocok filter.</Box>
        )}
        {/* ── Cabin groups ── */}
        {groups.map(([g, arr]) => {
          const isCollapsed = collapsed[g];
          return (
            <Box key={g} sx={{ borderBottom: `1px solid ${T.g1}` }}>
              <Box
                onClick={() => setCollapsed((c) => ({ ...c, [g]: !c[g] }))}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 1.1, background: T.g0, cursor: 'pointer', fontSize: 12, color: T.g6 }}
              >
                <Box sx={{ width: 0, height: 0, borderLeft: `5px solid ${T.g5}`, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', transform: isCollapsed ? 'none' : 'rotate(90deg)' }} />
                {g}
                <Box sx={{ ml: 'auto', fontFamily: T.mono, color: T.g5 }}>{arr.length} unit</Box>
              </Box>
              {!isCollapsed && arr.map((u) => (
                <Row key={u.deviceId} u={u} selected={u.deviceId === selectedUnitId} onSelect={onSelect} />
              ))}
            </Box>
          );
        })}

        {/* ── Rover perimeter posts ── */}
        {roverList.length > 0 && (
          <Box sx={{ borderBottom: `1px solid ${T.g1}` }}>
            <Box
              onClick={() => setRoverCollapsed((c) => !c)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 1.1, background: T.g0, cursor: 'pointer', fontSize: 12, color: T.g6 }}
            >
              <Box sx={{ width: 0, height: 0, borderLeft: `5px solid ${T.g5}`, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', transform: roverCollapsed ? 'none' : 'rotate(90deg)' }} />
              Rover perimeter
              <Box sx={{ ml: 'auto', fontFamily: T.mono, color: T.g5 }}>{roverList.length} pos</Box>
            </Box>
            {!roverCollapsed && roverList.map((r, i) => (
              <RoverRow key={`${r.group}-${r.rovernumber ?? i}`} r={r} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
