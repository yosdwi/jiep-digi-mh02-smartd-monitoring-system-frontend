import { useEffect, useMemo } from 'react';
import HistoryWorkspace from './HistoryWorkspace';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import SpeedBandEditor from '../panel/SpeedBandEditor';
import { rgb } from '../foundation/tokens';

// Cycle Time V3.
//
// The default view is the static dot trace for every selected unit, coloured by
// speed band (same classification as Underspeed) — this is what V1's cycle
// time map always showed, via a hook whose name promised a plan-vs-actual
// comparison but only ever applied fixed km/h thresholds.
// Playback is opt-in on a selected subset (see UnitList's "Putar terpilih").
//
// The page itself is thin on purpose: the map, the loader, the timeline and the
// playback runtime all live in HistoryWorkspace, which Underspeed and Durasi In
// Pit mount too. A page's job is to choose an encoding and add its own panels.

export default function CycleTimeV3() {
  const setColorMode = useHistoryStore((s) => s.setColorMode);
  const speedBands = useHistoryStore((s) => s.speedBands);

  useEffect(() => { setColorMode('speed'); }, [setColorMode]);

  // Chunks decoded while another page was active carry unit colours. Repaint
  // them from the current bands rather than refetching (see UnderspeedV3).
  useEffect(() => {
    const table = speedBands.map((b) => rgb(b.color));
    if (table.length === 0) return;
    registry.listDevices().forEach((device) => registry.recolorDeviceByBand(device.deviceId, table));
    registry.touch();
  }, [speedBands]);

  // Band editing is an additional, opt-in panel — the map and its legend
  // already default to speed colouring without it.
  const sidePanels = useMemo(() => ([
    { key: 'bands', title: 'Kelas kecepatan', render: () => <SpeedBandEditor /> },
  ]), []);

  return <HistoryWorkspace defaultPanel="summary" sidePanels={sidePanels} />;
}
