import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mqtt from 'mqtt';
import { IconLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import useUserStore from '../../stores/userStore';
import { useSmoothedUnits } from '../../hooks/useSmoothedUnits';
import { MQTT_TOPIC, getMqttBrokerUrl } from '../../config/mqttConfig';
import MapWorkspace, { DEFAULT_VIEW_STATE } from '../map/MapWorkspace';
import MapToolbar from '../map/MapToolbar';
import useBasemapLayers from '../map/layers/useBasemapLayers';
import LayerManager from '../panel/LayerManager';
import { Button, Chip, Empty, Input, Panel, Row } from '../foundation/ui';
import { color as C, text, space, font, layout, rgb } from '../foundation/tokens';

// Live Unit V3.
//
// The business workflow is unchanged and deliberately so: MQTT subscription,
// position smoothing, unit selection, trail for the selected unit. All of that
// is lifted from pages/LiveUnitPeta.jsx, which works.
//
// What changes is the shell and the map: it mounts the shared MapWorkspace
// (uncontrolled camera, one WebGL context, the same layer manager as the
// historical pages) instead of MapContainer, and the unit roster becomes a
// persistent searchable panel rather than a floating card plus a search bar plus
// a filter modal plus a chips row.

const MAX_TRAIL = 40;
const ICON_ATLAS = '/Monitoring/icons/mining-atlas.png';
const ICON_MAPPING = {
  truck: { x: 0, y: 0, width: 128, height: 128, mask: false },
  excavator: { x: 128, y: 0, width: 128, height: 128, mask: false },
  dot: { x: 256, y: 0, width: 128, height: 128, mask: true },
};

const STALE_MS = 5 * 60 * 1000;

// Status is derived, not stored: speed > 0 is moving, a heartbeat older than
// five minutes is stale regardless of its last speed.
function unitStatus(unit) {
  if (!unit.timestamp || Date.now() - unit.timestamp > STALE_MS) return 'stale';
  return (unit.lastSpeed || 0) > 0 ? 'moving' : 'idle';
}

const STATUS_COLOR = { moving: C.ok, idle: C.warn, stale: C.g4 };
const STATUS_LABEL = { moving: 'Bergerak', idle: 'Diam', stale: 'Tidak ada sinyal' };

export default function LiveUnitV3() {
  const district = useUserStore((s) => s.profile?.distrik) || (import.meta.env.DEV ? 'BRCB' : '');
  const [smoothedUnits, updateUnitPosition] = useSmoothedUnits();
  const [selectedId, setSelectedId] = useState(null);
  const [trails, setTrails] = useState({});
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState({ DT: true, EX: true });
  const [panel, setPanel] = useState('units');
  const [tool, setTool] = useState('pan');
  const [cameraCommand, setCameraCommand] = useState(null);
  const [connection, setConnection] = useState('idle');

  const clientRef = useRef(null);
  const typesRef = useRef(types);
  useEffect(() => { typesRef.current = types; }, [types]);

  const { layers: basemapLayers, orthoVersions } = useBasemapLayers({ district });

  useEffect(() => {
    if (clientRef.current) return undefined;
    const brokerUrl = getMqttBrokerUrl(district);
    if (!brokerUrl) { setConnection('unconfigured'); return undefined; }

    setConnection('connecting');
    const client = mqtt.connect(brokerUrl);
    clientRef.current = client;

    client.on('connect', () => {
      setConnection('connected');
      client.subscribe(MQTT_TOPIC);
    });
    client.on('error', () => setConnection('error'));
    client.on('reconnect', () => setConnection('connecting'));
    client.on('message', (_topic, message) => {
      try {
        const raw = JSON.parse(message.toString());
        if (!raw?.deviceid) return;
        if (!typesRef.current[raw.devicetype]) return;
        updateUnitPosition({
          deviceId: raw.deviceid,
          unitNo: raw.unitno,
          deviceType: raw.devicetype,
          latitude: raw.gpslat ?? raw.latitude,
          longitude: raw.gpslong ?? raw.longitude,
          lastSpeed: raw.VehicleSpeed,
          timestamp: raw.heartbeat * 1000,
          ...raw,
        });
      } catch {
        // A malformed frame must not tear down the subscription.
      }
    });

    return () => { client.end(); clientRef.current = null; };
  }, [district, updateUnitPosition]);

  // Trail for the selected unit only. Following every unit would grow unbounded
  // and answer a question nobody asked — the historical pages own "where has the
  // fleet been".
  useEffect(() => {
    if (!selectedId) return;
    const unit = smoothedUnits[selectedId];
    if (!unit?.longitude) return;
    setTrails((prev) => {
      const trail = prev[selectedId] || [];
      const last = trail[trail.length - 1];
      if (last && last[0] === unit.longitude && last[1] === unit.latitude) return prev;
      const next = [...trail, [unit.longitude, unit.latitude]];
      if (next.length > MAX_TRAIL) next.shift();
      return { ...prev, [selectedId]: next };
    });
  }, [smoothedUnits, selectedId]);

  const units = useMemo(
    () => Object.values(smoothedUnits)
      .filter((u) => u && types[u.deviceType] && Number.isFinite(u.longitude))
      .sort((a, b) => String(a.unitNo).localeCompare(String(b.unitNo))),
    [smoothedUnits, types],
  );

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    return q ? units.filter((u) => String(u.unitNo).toUpperCase().includes(q)) : units;
  }, [units, query]);

  const focusUnit = useCallback((unit) => {
    setSelectedId(unit.deviceId);
    setTrails((prev) => ({ ...prev, [unit.deviceId]: [[unit.longitude, unit.latitude]] }));
    setCameraCommand({ longitude: unit.longitude, latitude: unit.latitude, zoom: 16, transitionDuration: 900 });
  }, []);

  const layers = useMemo(() => {
    const out = [...basemapLayers];

    const trail = selectedId ? trails[selectedId] : null;
    if (trail && trail.length > 1) {
      out.push(new PathLayer({
        id: 'v3-live-trail',
        data: [{ path: trail }],
        getPath: (d) => d.path,
        getColor: [...rgb(C.sel), 200],
        getWidth: 3,
        widthUnits: 'pixels',
        widthMinPixels: 2,
      }));
    }

    if (units.length > 0) {
      out.push(new ScatterplotLayer({
        id: 'v3-live-halo',
        data: units,
        getPosition: (d) => [d.longitude, d.latitude],
        getRadius: (d) => (d.deviceId === selectedId ? 18 : 0),
        radiusUnits: 'pixels',
        getFillColor: [...rgb(C.sel), 60],
        updateTriggers: { getRadius: selectedId },
      }));

      out.push(new IconLayer({
        id: 'v3-live-icons',
        data: units,
        iconAtlas: ICON_ATLAS,
        iconMapping: ICON_MAPPING,
        getIcon: (d) => (d.deviceType === 'EX' ? 'excavator' : 'truck'),
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: (d) => (d.deviceId === selectedId ? 40 : 30),
        getAngle: (d) => -(d.bearing || 0),
        getColor: (d) => rgb(STATUS_COLOR[unitStatus(d)]),
        sizeUnits: 'pixels',
        pickable: true,
        onClick: (info) => { if (info.object) focusUnit(info.object); },
        updateTriggers: {
          getPosition: units,
          getSize: selectedId,
          getColor: units,
          getAngle: units,
        },
      }));

      out.push(new TextLayer({
        id: 'v3-live-labels',
        data: units,
        getPosition: (d) => [d.longitude, d.latitude],
        getText: (d) => String(d.unitNo ?? '').split('-')[1] || String(d.unitNo ?? ''),
        getSize: 11,
        getColor: rgb(C.white),
        getPixelOffset: [0, 22],
        background: true,
        getBackgroundColor: [...rgb(C.ink), 220],
        backgroundPadding: [5, 2],
        getBorderRadius: 3,
        fontFamily: 'ui-sans-serif,system-ui,sans-serif',
        fontWeight: 700,
        fontSettings: { sdf: false },
        pickable: false,
        updateTriggers: { getPosition: units },
      }));
    }

    return out;
  }, [basemapLayers, units, selectedId, trails, focusUnit]);

  const selected = selectedId ? smoothedUnits[selectedId] : null;

  const panels = [
    { key: 'layers', glyph: '◱', title: 'Layer', render: () => <LayerManager orthoVersions={orthoVersions} /> },
    {
      key: 'units',
      glyph: '☰',
      title: `Unit aktif${units.length ? ` (${units.length})` : ''}`,
      render: () => (
        <UnitRoster
          units={visible}
          query={query}
          onQuery={setQuery}
          types={types}
          onTypes={setTypes}
          selectedId={selectedId}
          onSelect={focusUnit}
          connection={connection}
        />
      ),
    },
    ...(selected ? [{ key: 'detail', glyph: 'ⓘ', title: selected.unitNo || 'Detail unit', render: () => <UnitDetail unit={selected} /> }] : []),
  ];

  const activePanel = panels.find((p) => p.key === panel) || null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <MapWorkspace layers={layers} cameraCommand={cameraCommand} tool={tool} />

        <MapToolbar
          tool={tool}
          onToolChange={setTool}
          panel={panel}
          onPanelChange={setPanel}
          onResetView={() => setCameraCommand({ ...DEFAULT_VIEW_STATE, transitionDuration: 600 })}
          panels={panels}
        />

        {selected ? (
          <div style={{
            position: 'absolute', bottom: space[2], right: space[2], display: 'flex', gap: 4,
          }}>
            <Button onClick={() => setPanel('detail')} active={panel === 'detail'}>
              Detail {selected.unitNo}
            </Button>
            <Button onClick={() => { setSelectedId(null); setTrails({}); }}>Lepas pilihan</Button>
          </div>
        ) : null}
      </div>

      {activePanel ? (
        <aside style={{
          width: layout.panelWidth, flexShrink: 0,
          borderLeft: `1px solid ${C.line}`, background: C.white,
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <Panel
            title={activePanel.title}
            style={{ border: 'none', borderRadius: 0, boxShadow: 'none', height: '100%' }}
            actions={
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="Tutup panel"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.g5, fontSize: 14 }}
              >
                ✕
              </button>
            }
          >
            {activePanel.render()}
          </Panel>
        </aside>
      ) : null}
    </div>
  );
}

function UnitRoster({ units, query, onQuery, types, onTypes, selectedId, onSelect, connection }) {
  const tone = { connected: 'ok', connecting: 'warn', error: 'crit', unconfigured: 'warn', idle: 'default' }[connection];
  const label = {
    connected: 'Terhubung', connecting: 'Menghubungkan...', error: 'Koneksi gagal',
    unconfigured: 'Broker belum diatur', idle: '—',
  }[connection];

  return (
    <div>
      <div style={{
        padding: space[3], display: 'flex', flexDirection: 'column', gap: space[2],
        borderBottom: `1px solid ${C.line}`, position: 'sticky', top: 0, background: C.white, zIndex: 1,
      }}>
        <Input placeholder="Cari unit..." value={query} onChange={(e) => onQuery(e.target.value)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {['DT', 'EX'].map((type) => (
            <Button
              key={type}
              size="sm"
              active={types[type]}
              onClick={() => onTypes({ ...types, [type]: !types[type] })}
            >
              {type}
            </Button>
          ))}
          <div style={{ flex: 1 }} />
          <Chip tone={tone}>{label}</Chip>
        </div>
      </div>

      {units.length === 0 ? (
        <Empty title="Belum ada unit" hint="Menunggu data dari broker MQTT." icon="◉" />
      ) : units.map((unit) => {
        const status = unitStatus(unit);
        return (
          <button
            key={unit.deviceId}
            type="button"
            onClick={() => onSelect(unit)}
            style={{
              display: 'flex', alignItems: 'center', gap: space[2], width: '100%',
              padding: `6px ${space[3]}px`, textAlign: 'left', cursor: 'pointer',
              border: 'none', borderBottom: `1px solid ${C.g1}`,
              borderLeft: `3px solid ${unit.deviceId === selectedId ? C.sel : 'transparent'}`,
              background: unit.deviceId === selectedId ? C.selBg : C.white,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: STATUS_COLOR[status],
            }} />
            <span style={{ ...text.base, fontWeight: 600, color: C.ink, flex: 1, minWidth: 0 }}>
              {unit.unitNo}
            </span>
            <span style={{ ...text.sm, color: C.g5 }}>{unit.deviceType}</span>
            <span style={{ ...text.sm, color: C.g6, fontFamily: font.mono, width: 54, textAlign: 'right' }}>
              {Math.round(unit.lastSpeed || 0)} km/j
            </span>
          </button>
        );
      })}
    </div>
  );
}

function UnitDetail({ unit }) {
  const status = unitStatus(unit);
  return (
    <div>
      <Row label="Unit" value={unit.unitNo} />
      <Row label="Device ID" value={unit.deviceId} mono />
      <Row label="Tipe" value={unit.deviceType} />
      <Row label="Status" value={STATUS_LABEL[status]} />
      <Row label="Kecepatan" value={`${Math.round(unit.lastSpeed || 0)} km/jam`} mono />
      <Row label="Lintang" value={Number(unit.latitude).toFixed(6)} mono />
      <Row label="Bujur" value={Number(unit.longitude).toFixed(6)} mono />
      <Row
        label="Heartbeat"
        value={unit.timestamp ? new Date(unit.timestamp).toLocaleTimeString('id-ID') : '—'}
        mono
      />
    </div>
  );
}
