import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';
import MapContainer from '../components/peta/MapContainer';
import { useMirLayers } from '../hooks/useMirLayers';
import { useSmoothedUnits } from '../hooks/useSmoothedUnits';
import useUserStore from '../stores/userStore';
import useMirAlertStore from '../stores/mirAlertStore';
import { T, zoneStatus } from '../components/mir/operasi/mirTokens';
import MirContextBar from '../components/mir/operasi/MirContextBar';
import MirCrossingStrip from '../components/mir/operasi/MirCrossingStrip';
import MirDeviceList from '../components/mir/operasi/MirDeviceList';
import MirToastStack from '../components/mir/operasi/MirToastStack';
import MirMapOverlays from '../components/mir/operasi/MirMapOverlays';
import MirEditBar from '../components/mir/operasi/MirEditBar';
import MirEditPanel from '../components/mir/operasi/MirEditPanel';
import MirEditToolbar from '../components/mir/operasi/MirEditToolbar';
import { buildMirMarkerLayers, buildMirAlertMarkers, buildRoverMarkerLayers, buildMirDistanceLines } from '../components/mir/operasi/mirMarkerLayers';
import { saveRover0, fetchGeofenceGroups, upsertGeofenceGroup, deleteGeofenceGroup } from '../services/mirDeviceApi';
import { isValidLonLat } from '../utils/geo';

// Layar OPERASI MIR (port wireframe-operations.html) — full shell sendiri (tanpa chrome app).
// Monitor: peta + marker + geofence + alert layer. Edit: authoring geofence/Rover 0 (pola MyMaps).
const ALL_UNIT_TYPES = ['DT', 'EX'];
const INITIAL_VIEW_STATE = { longitude: 117.28, latitude: 1.91, zoom: 13, pitch: 0, bearing: 0, transitionDuration: 1000 };
const MIR_LAYER_STATE = { orthophoto: true, roads: false, boundaries: false, exRadius: false, pitStops: false, mirDumpingAreas: true };
const DEFAULT_VIS = { area: true, line: true, warning: true, unsafe: true, rover0: true, units: true, labels: true };
// Grup TIDAK hardcode lagi: registry datang dari backend (GET /api/mir/geofence/groups → config
// geofence-core + arsip SQL). `groupCfg` di-state, line_rovers/rover_0 per-grup ikut dari sana.

export default function MIRPeta() {
  const district = useUserStore((s) => s.profile?.distrik);
  const [smoothedUnits, updateUnitPosition] = useSmoothedUnits();
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [vis, setVis] = useState(DEFAULT_VIS);
  const [basemap, setBasemap] = useState('satellite');
  const [measure, setMeasure] = useState(false);
  const [measurePts, setMeasurePts] = useState([]); // [[lon,lat], ...] maks 2

  // ── edit mode (Ubah geofence) ──
  const [editMode, setEditMode] = useState(false);
  const [editGroup, setEditGroup] = useState('');
  const [lineRovers, setLineRovers] = useState([]);
  const [groupCfg, setGroupCfg] = useState([]); // [{group, line_rovers:[int], rover_0, has_polygon}]
  const [thresholds, setThresholds] = useState({ area: '20', unsafe: '20', lineDelta: '0.1', warnBands: '15,7,5' });
  const [tool, setTool] = useState('select');
  const [rover0, setRover0] = useState(null); // [lon,lat]
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const navigate = useNavigate();
  const connectRealtime = useMirAlertStore((s) => s.connectRealtime);
  const disconnectRealtime = useMirAlertStore((s) => s.disconnectRealtime);
  const alerts = useMirAlertStore((s) => s.alerts);
  const cabinsLive = useMirAlertStore((s) => s.cabinsLive);
  const roversLive = useMirAlertStore((s) => s.roversLive);

  const mirGeofenceLayers = useMirLayers();

  // Mutasi grup = ASYNC (FE→.NET balas 202→geofence-core apply via Redis). Refresh tepat setelah
  // POST sering balik SEBELUM grup teraplikasi → "blip & balik lagi". Solusi: eventual-consistency.
  const pendingDelete = useRef(new Set()); // nama grup yg sedang dihapus (sembunyikan sampai server konfirmasi)

  // Registry grup dari backend (config geofence-core + arsip SQL). Fallback: turunan dari
  // geofence LIVE (layer `mir-dumping-area-<code>`) bila endpoint /geofence/groups belum ada (mock dev).
  const loadGroups = useCallback(async () => {
    try {
      const r = await fetchGeofenceGroups();
      if (!Array.isArray(r?.groups)) return;
      setGroupCfg((prev) => {
        const serverNames = new Set(r.groups.map((g) => g.group));
        // grup yg lagi dihapus: kalau server udah ga punya → tuntas, lepas dari daftar tunda.
        for (const name of [...pendingDelete.current]) if (!serverNames.has(name)) pendingDelete.current.delete(name);
        const filtered = r.groups.filter((g) => !pendingDelete.current.has(g.group));
        // pertahankan grup baru (optimistic) yg belum kebaca server — apply geofence-core async.
        const pendingAdd = prev.filter((g) => g.pending && !serverNames.has(g.group));
        return [...filtered, ...pendingAdd];
      });
    } catch { /* biarkan fallback dari geofence live */ }
  }, []);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Refresh berkala beberapa detik setelah mutasi → tangkap hasil apply geofence-core (async).
  const pollGroups = useCallback(() => {
    loadGroups();
    [700, 1600, 3200].forEach((ms) => setTimeout(loadGroups, ms));
  }, [loadGroups]);

  const groups = useMemo(() => {
    const set = new Set(groupCfg.map((g) => g.group));
    const pre = 'mir-dumping-area-';
    for (const l of mirGeofenceLayers) {
      const id = l.id || '';
      if (id.startsWith(pre)) set.add(id.slice(pre.length));
    }
    for (const name of pendingDelete.current) set.delete(name); // grup yg sedang dihapus disembunyikan
    return [...set].sort();
  }, [groupCfg, mirGeofenceLayers]);

  // line_rovers grup dari registry (string utk checkbox); kalau grup belum ada di cfg → kosong.
  const lineRoversFor = useCallback((g) => {
    const c = groupCfg.find((x) => x.group === g);
    return Array.isArray(c?.line_rovers) ? c.line_rovers.map(String) : [];
  }, [groupCfg]);

  useEffect(() => {
    connectRealtime();
    return () => disconnectRealtime();
  }, [connectRealtime, disconnectRealtime]);

  // editGroup selalu nempel ke grup yg benar-benar ada — saat registry termuat / grup terpilih
  // hilang, lompat ke grup pertama + isi line_rovers-nya dari registry.
  useEffect(() => {
    if (groups.length && !groups.includes(editGroup)) {
      setEditGroup(groups[0]);
      setLineRovers(lineRoversFor(groups[0]));
    }
  }, [groups, editGroup, lineRoversFor]);

  // ── Cabin live telemetry (latest-only) — sumber Redis via .NET, push SignalR `telemetry` +
  // fallback REST /cabins/live (mirAlertStore). Gantikan subscribe MQTT ws:9001 langsung. ──
  // NOTE: backend returns gpslat/gpslong as strings — must parse to Number for deck.gl.
  useEffect(() => {
    (cabinsLive || []).forEach((raw) => {
      if (!raw || !raw.deviceid) return;
      // devicetype mungkin tidak ada — cek unitno prefix sebagai fallback
      const inferredType = raw.devicetype || (raw.unitno ? raw.unitno.replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase() : '');
      if (raw.devicetype && !ALL_UNIT_TYPES.includes(raw.devicetype)) return;
      const lon = Number(raw.gpslong ?? raw.longitude);
      const lat = Number(raw.gpslat ?? raw.latitude);
      // Hanya tolak NaN (data rusak). Sentinel -8888/-8887 TETAP di-ingest supaya
      // unit tetap muncul di list dengan status-nya — yang invalid hanya tidak
      // digambar di peta (lihat buildMirMarkerLayers + guard viewState/flyTo).
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      updateUnitPosition({
        // spread raw FIRST so computed numeric fields override string fields from API
        ...raw,
        deviceId: raw.deviceid,
        unitNo: raw.unitno,
        deviceType: inferredType,
        longitude: lon,
        latitude: lat,
        gpsLong: lon,
        gpsLat: lat,
        lastSpeed: Number(raw.VehicleSpeed) || 0,
        // age_ms (backend, last-known) menang → cabin offline ter-aged dgn benar &
        // diredupkan di list, sambil tetap plot posisi last-known-nya.
        timestamp: (raw.age_ms != null ? Date.now() - Number(raw.age_ms)
          : (raw.heartbeat ? raw.heartbeat * 1000 : Date.now())),
        online: raw.online !== false,
        mir_distance: raw.mir_distance != null ? Number(raw.mir_distance) : null,
        mir_in_area: raw.mir_in_area != null ? Number(raw.mir_in_area) : null,
        mir_unsafe: raw.mir_unsafe != null ? Number(raw.mir_unsafe) : null,
        // titik terdekat di garis crossing (mir-checker) — utk konektor jarak di peta; opsional
        mir_point: Array.isArray(raw.mir_point) && raw.mir_point.length === 2 ? raw.mir_point.map(Number) : null,
        gpsnumsat: raw.gpsnumsat,
        fix_quality: raw.gpsrtkquality != null ? Number(raw.gpsrtkquality) : null,
      });
    });
  }, [cabinsLive, updateUnitPosition]);

  const unitsArray = useMemo(() => Object.values(smoothedUnits).filter(Boolean), [smoothedUnits]);

  // Alert marker hanya untuk alert yang unitnya belum punya posisi live (unit offline/belum konek).
  const alertsWithoutLiveUnit = useMemo(() => {
    const liveIds = new Set(unitsArray.map(u => u.deviceId));
    return alerts.filter(a =>
      a.status === 'NEW' &&
      a.lat != null && a.lon != null &&
      !liveIds.has(a.deviceId)
    );
  }, [alerts, unitsArray]);

  const flyTo = useCallback((lon, lat, zoom = 16) => {
    // Tolak koordinat invalid (sentinel rover -8888 / swap lat-lon) supaya viewState
    // tak pernah keluar rentang — maplibre throw kalau latitude di luar [-90,90].
    if (!isValidLonLat(lon, lat)) return;
    setViewState((v) => ({ ...v, longitude: lon, latitude: lat, zoom: Math.max(v.zoom, zoom), transitionDuration: 1500 }));
  }, []);

  // Auto-center peta pada unit pertama yang muncul — hanya bila view masih di posisi default.
  const autoFlyDone = useRef(false);
  useEffect(() => {
    if (autoFlyDone.current) return;
    // Pilih unit pertama dengan koordinat valid — lewati yang sentinel (-8888/-8887)
    // supaya auto-center tidak "terpakai" oleh unit yang justru tak punya posisi.
    const first = unitsArray.find((u) => isValidLonLat(u.longitude, u.latitude));
    if (first) {
      autoFlyDone.current = true;
      flyTo(first.longitude, first.latitude, 16);
    }
  }, [unitsArray, flyTo]);

  // Operasi = monitoring live saja. Pilih unit = highlight + fly (tanpa panel validasi).
  const selectUnit = useCallback((deviceId) => {
    setSelectedUnitId(deviceId);
    const u = smoothedUnits[deviceId];
    if (u) flyTo(u.longitude, u.latitude);
  }, [smoothedUnits, flyTo]);

  // Manajemen/validasi alert TIDAK di Operasi — diarahkan ke tab Peringatan (fokus alert ini).
  const handleSelectAlert = useCallback((id) => {
    if (id) navigate(`/mir/peringatan?focus=${encodeURIComponent(id)}`);
  }, [navigate]);

  const handleUnitClick = useCallback((info) => {
    if (editMode) return false;
    if (info && info.object) {
      const { deviceId, longitude, latitude } = info.object;
      setSelectedUnitId(deviceId);
      flyTo(longitude, latitude);
      return true;
    }
    return false;
  }, [editMode, flyTo]);

  const measuring = measure || (editMode && tool === 'measure');

  const handleMapClick = useCallback((info) => {
    if (editMode && tool === 'rover0' && info.coordinate) {
      setRover0(info.coordinate); setDirty(true); return;
    }
    if (measuring && info.coordinate) {
      setMeasurePts((prev) => (prev.length >= 2 ? [info.coordinate] : [...prev, info.coordinate]));
      return;
    }
    // Klik peta kosong TIDAK menutup detail (mockup: hanya tombol ‹ yang nutup).
  }, [editMode, tool, measuring]);

  // alat ukur jarak (mockup .measure) — klik 2 titik → garis + label jarak (turf, meter)
  const measureLayers = useMemo(() => {
    if (!measuring || measurePts.length === 0) return [];
    const blue = [58, 110, 165, 255];
    const layers = [new ScatterplotLayer({
      id: 'mir-measure-pts', data: measurePts.map((p) => ({ p })), getPosition: (d) => d.p,
      getFillColor: blue, stroked: true, getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 1.5,
      radiusUnits: 'pixels', getRadius: 5, radiusMinPixels: 5,
    })];
    if (measurePts.length === 2) {
      const m = turf.distance(turf.point(measurePts[0]), turf.point(measurePts[1]), { units: 'kilometers' }) * 1000;
      const mid = [(measurePts[0][0] + measurePts[1][0]) / 2, (measurePts[0][1] + measurePts[1][1]) / 2];
      const label = m >= 1000 ? (m / 1000).toFixed(2) + ' km' : m.toFixed(1) + ' m';
      layers.push(new PathLayer({ id: 'mir-measure-line', data: [{ path: measurePts }], getPath: (d) => d.path, getColor: blue, widthMinPixels: 2 }));
      layers.push(new TextLayer({
        id: 'mir-measure-label', data: [{ p: mid, t: label }], getPosition: (d) => d.p, getText: (d) => d.t,
        getSize: 14, getColor: [31, 122, 150, 255], background: true, getBackgroundColor: [255, 255, 255, 235],
        backgroundPadding: [6, 3], getPixelOffset: [0, -14],
      }));
    }
    return layers;
  }, [measuring, measurePts]);

  // Marker Rover 0 yang sedang diedit — pola sama dgn rover (◉ teal kecil + label R.<grup>.0),
  // bukan blob meter-scaled. Ring luar = penanda "sedang diedit/geser".
  const editLayers = useMemo(() => {
    if (!editMode || !rover0) return [];
    const d = [{ position: rover0, label: `R.${editGroup}.0` }];
    return [
      new ScatterplotLayer({
        id: 'mir-rover0-ring', data: d, getPosition: (x) => x.position, stroked: true, filled: false,
        getLineColor: [31, 122, 150, 200], lineWidthMinPixels: 2, radiusUnits: 'pixels', getRadius: 11,
      }),
      new ScatterplotLayer({
        id: 'mir-rover0', data: d, getPosition: (x) => x.position, stroked: true, filled: true,
        getFillColor: [31, 122, 150, 235], getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 2,
        radiusUnits: 'pixels', getRadius: 6, radiusMinPixels: 6,
      }),
      new TextLayer({
        id: 'mir-rover0-edit-label', data: d, getPosition: (x) => x.position, getText: (x) => x.label,
        getColor: [31, 122, 150], getSize: 11, sizeUnits: 'pixels', getPixelOffset: [0, -16],
        getTextAnchor: 'middle', getAlignmentBaseline: 'center', fontFamily: 'monospace', fontWeight: 700,
        characterSet: 'auto', background: true, getBackgroundColor: [255, 255, 255, 225], backgroundPadding: [4, 2],
      }),
    ];
  }, [editMode, rover0, editGroup]);

  // klik marker (glyph/label) → highlight unit + fly-to (monitoring; validasi di Peringatan)
  const onMarkerClick = useCallback((info) => {
    const d = info.object;
    if (!d) return;
    setSelectedUnitId(d.deviceId);
    flyTo(d.position[0], d.position[1]);
  }, [flyTo]);

  // marker MIR (encoding mockup: ▲/△ + warna status + halo + ring + label) — gantikan marker generic
  const markerLayers = useMemo(
    () => (vis.units ? buildMirMarkerLayers({ units: unitsArray, selectedUnitId, showLabels: vis.labels, onClick: onMarkerClick }) : []),
    [unitsArray, selectedUnitId, vis.units, vis.labels, onMarkerClick]
  );

  // konektor unit → garis crossing terdekat — "ngacu ke garis yang mana" (jarak ada di label marker)
  const distanceLineLayers = useMemo(
    () => (vis.units ? buildMirDistanceLines({ units: unitsArray, geofenceLayers: mirGeofenceLayers }) : []),
    [unitsArray, mirGeofenceLayers, vis.units]
  );

  // ● rover perimeter (dari /api/mir/rovers/live via store)
  const roverMarkerLayers = useMemo(
    () => (vis.units ? buildRoverMarkerLayers({ rovers: roversLive, showLabels: vis.labels }) : []),
    [roversLive, vis.units, vis.labels]
  );

  // ▲ alert marker untuk unit yang offline (tidak ada posisi live) — posisi dari alert lat/lon
  const alertMarkerLayers = useMemo(() => {
    if (!vis.units || alertsWithoutLiveUnit.length === 0) return [];
    return buildMirAlertMarkers({
      alerts: alertsWithoutLiveUnit,
      selectedId: null,
      showLabels: vis.labels,
      onClick: (info) => { if (info.object) handleSelectAlert(info.object.id); },
    });
  }, [alertsWithoutLiveUnit, vis.units, vis.labels, handleSelectAlert]);

  const allLayers = useMemo(() => {
    // Toggle layer geofence = prop `visible`, JANGAN filter keluar-masuk dari array.
    // deck.gl melarang re-init instance Layer yang sudah di-finalize (assertion saat
    // unchecklist→checklist). `.clone()` bikin instance baru tiap render (pola deck.gl).
    const visOf = (id) => {
      if (id.startsWith('mir-dumping-area')) return vis.area;
      if (id.startsWith('mir-unsafe-area')) return vis.unsafe;
      if (id.startsWith('mir-dumping-line')) return vis.line;
      if (id.startsWith('mir-warning')) return vis.warning;
      // Rover 0 grup yg sedang diedit disembunyikan dari geofence (digantikan marker editable).
      if (id.startsWith('mir-rover0')) return vis.rover0 && !(editMode && id.endsWith(`-${editGroup}`));
      return true;
    };
    const geo = mirGeofenceLayers.map((l) => l.clone({ visible: visOf(l.id || '') }));
    return [...geo, ...distanceLineLayers, ...editLayers, ...measureLayers, ...alertMarkerLayers, ...roverMarkerLayers, ...markerLayers];
  }, [mirGeofenceLayers, vis, editMode, editGroup, distanceLineLayers, editLayers, measureLayers, alertMarkerLayers, roverMarkerLayers, markerLayers]);

  const counts = useMemo(() => {
    let crossing = 0, dumping = 0;
    unitsArray.forEach((u) => {
      const s = zoneStatus({ mirDistance: u.mir_distance, mirInArea: u.mir_in_area, mirUnsafe: u.mir_unsafe });
      if (s === 'CROSSING') crossing++;
      else if (s === 'DUMPING') dumping++;
    });
    return {
      cabin: unitsArray.length,
      rover: (roversLive || []).length,
      geofence: mirGeofenceLayers.filter((l) => (l.id || '').startsWith('mir-dumping-area')).length,
      crossing, dumping,
    };
  }, [unitsArray, roversLive, mirGeofenceLayers]);

  const zoomBy = (d) => setViewState((v) => ({ ...v, zoom: Math.min(20, Math.max(3, v.zoom + d)), transitionDuration: 300 }));

  // tool "⚙ Ambang" tidak menggambar di peta — ambang diedit di panel kiri.
  // Beri feedback: scroll ke panel + flash + fokus input pertama (bukan no-op).
  const focusAmbang = () => {
    const el = document.getElementById('mir-ambang-panel');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 600);
    el.querySelector('input')?.focus();
  };

  // Posisi Rover 0 grup dari geofence live (layer mir-rover0-<grup> = data rover_0) → [lon,lat] | null.
  const liveRover0For = (group) => {
    const l = mirGeofenceLayers.find((x) => (x.id || '') === `mir-rover0-${group}`);
    const pos = l?.props?.data?.[0]?.position;
    return Array.isArray(pos) && pos.length === 2 ? [Number(pos[0]), Number(pos[1])] : null;
  };
  const enterEdit = () => {
    setEditMode(true); setSelectedUnitId(null); setTool('select'); setSaveError(null);
    setLineRovers(lineRoversFor(editGroup));
    setRover0(liveRover0For(editGroup)); setDirty(false); // seed dari posisi live (null = belum ada → Taruh R0)
  };
  const exitEdit = () => { setEditMode(false); setMeasure(false); setMeasurePts([]); setSaveError(null); };
  const changeGroup = (g) => { setEditGroup(g); setLineRovers(lineRoversFor(g)); setRover0(liveRover0For(g)); setDirty(false); };
  const toggleRover = (n) => { setLineRovers((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n])); setDirty(true); };

  // Tambah grup baru (dinamis, persist ke backend). Lahir KOSONG: tanpa line_rovers & Rover 0 —
  // user centang anggota + taruh R0 di peta, lalu Simpan. OPTIMISTIC: grup langsung muncul & jadi
  // grup aktif walau persist ke server gagal (mis. backend belum hidup) → UX nggak "diam saja".
  const addGroup = async (name) => {
    const g = (name || '').trim();
    if (!g) return false;
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(g)) { setSaveError('Nama grup tak valid (A-Z, 0-9, _-, maks 32)'); return false; }
    if (groups.includes(g)) { setSaveError(`Grup ${g} sudah ada`); return false; }
    setSaveError(null);
    // optimistic insert → langsung tampil & terpilih
    setGroupCfg((s) => [...s, { group: g, line_rovers: [], rover_0: null, has_polygon: false, pending: true }]);
    setEditGroup(g); setLineRovers([]); setRover0(null); setDirty(false);
    setSaving(true);
    try {
      await upsertGeofenceGroup(g, []); // 202 = diterima; geofence-core apply async
    } catch (e) {
      setSaveError(`Grup "${g}" dibuat lokal — gagal simpan ke server: ${e?.message || ''}`);
    } finally {
      setSaving(false);
    }
    pollGroups(); // refresh bertahap → grup tetap tampil sampai server konfirmasi (anti-blip)
    return true;
  };

  const removeGroup = async (g) => {
    if (!g) return;
    setSaveError(null);
    pendingDelete.current.add(g); // tandai supaya refresh tak munculkan lagi sebelum apply
    setGroupCfg((s) => s.filter((x) => x.group !== g)); // optimistic remove
    setSaving(true);
    try {
      await deleteGeofenceGroup(g);
    } catch (e) {
      pendingDelete.current.delete(g); // gagal → biarkan muncul lagi
      setSaveError(`Grup "${g}" gagal dihapus di server: ${e?.message || ''}`);
    } finally {
      setSaving(false);
    }
    pollGroups(); // reconcile effect akan pindah editGroup ke grup tersisa
  };

  const onSave = async () => {
    // Rover 0 → POST /api/mir/rover0/:group; line_rovers → POST /api/mir/geofence/group {line_rovers}.
    // Dua-duanya geofence-core persist config.json + regen polygon (regen final pakai R0 terbaru).
    setSaveError(null); setSaving(true);
    try {
      if (rover0) { const [lon, lat] = rover0; await saveRover0(editGroup, lat, lon); } // [lon,lat]→{lat,lon}
      await upsertGeofenceGroup(editGroup, lineRovers.map(Number));
      setDirty(false);
      await loadGroups();
    } catch (e) {
      setSaveError(e?.message || 'gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, background: T.w, fontFamily: T.ff }}>
      {editMode ? (
        <MirEditBar group={editGroup} dirty={dirty} saving={saving} error={saveError} onExit={exitEdit} onSave={onSave} />
      ) : (
        <>
          <MirContextBar onSelectAlert={handleSelectAlert} />
          <MirCrossingStrip onSelectAlert={handleSelectAlert} />
        </>
      )}

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {editMode ? (
          <MirEditPanel
            groups={groups}
            groupCfg={groupCfg}
            group={editGroup}
            onGroup={changeGroup}
            onAddGroup={addGroup}
            onDeleteGroup={removeGroup}
            saving={saving}
            lineRovers={lineRovers}
            onToggleRover={toggleRover}
            rover0Set={Boolean(rover0)}
            thresholds={thresholds}
            onThreshold={(k, v) => { setThresholds((s) => ({ ...s, [k]: v })); setDirty(true); }}
          />
        ) : (
          // sidebar kiri = device-list live. Validasi/manajemen alert = tab Peringatan.
          <Box sx={{ position: 'relative', zIndex: 20, flex: '0 0 340px', width: 340, display: 'flex', minHeight: 0 }}>
            <MirDeviceList units={unitsArray} rovers={roversLive} selectedUnitId={selectedUnitId} onSelect={selectUnit} />
          </Box>
        )}

        <Box sx={{ flex: 1, position: 'relative', minWidth: 0, background: T.g1, cursor: (measuring || (editMode && tool === 'rover0')) ? 'crosshair' : 'default' }}>
          <MapContainer
            layerState={MIR_LAYER_STATE}
            district={district}
            basemap={basemap}
            liveUnitData={[]}
            liveTrailsData={[]}
            onUnitClick={handleUnitClick}
            onMapClick={handleMapClick}
            viewState={viewState}
            onViewStateChange={(e) => setViewState(e.viewState)}
            onSetViewState={setViewState}
            replayLayers={allLayers}
          />

          {measuring && (
            <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 15, background: T.ink, color: '#fff', px: 1.5, py: 0.75, borderRadius: '4px', fontSize: 12, fontFamily: T.mono, boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
              {measurePts.length < 2 ? 'Ukur: klik 2 titik di peta' : 'Klik lagi untuk mulai ukur baru'}
            </Box>
          )}

          {editMode ? (
            <MirEditToolbar tool={tool} onTool={(t) => { setTool(t); if (t !== 'measure') setMeasurePts([]); if (t === 'ambang') focusAmbang(); }} />
          ) : (
            <>
              <MirMapOverlays
                layers={vis}
                onToggleLayer={(k) => setVis((s) => ({ ...s, [k]: !s[k] }))}
                basemap={basemap}
                onBasemap={setBasemap}
                measure={measure}
                onToggleMeasure={() => { setMeasure((m) => !m); setMeasurePts([]); }}
                onZoomIn={() => zoomBy(1)}
                onZoomOut={() => zoomBy(-1)}
                onFit={() => setViewState({ ...INITIAL_VIEW_STATE, transitionDuration: 800 })}
                counts={counts}
                onEditGeofence={enterEdit}
              />
              <MirToastStack onSelectAlert={handleSelectAlert} />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
