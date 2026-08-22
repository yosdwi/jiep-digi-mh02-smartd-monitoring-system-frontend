import { useEffect, useMemo } from 'react';
import HistoryWorkspace from './HistoryWorkspace';
import useHistoryStore from '../state/historyStore';
import * as registry from '../state/traceRegistry';
import SpeedBandEditor from '../panel/SpeedBandEditor';
import { UnderspeedSummaryPanel, UnderspeedMetricsTable } from '../panel/UnderspeedPanels';
import { rgb } from '../foundation/tokens';

// Underspeed V3.
//
// Same engine as Cycle Time — same map, same loader, same playback runtime.
// Samples are coloured by speed band instead of unit identity, and Ringkasan /
// Metrik unit are overridden with band-time breakdowns instead of the
// cycle-time defaults (see HistoryWorkspace's sidePanels merge). The band
// editor is an additional opt-in panel, not the default view.
//
// NOTE ON BEHAVIOUR: the V1/V2 page at /playback/underspeed reads
// /Monitoring/dummy/unit_tracks.json and assigns every point
// `Math.floor(Math.random() * 50)` as its speed (UnderspeedPeta.jsx:54-76). It
// has never shown a real observation. This page shows real data, so the numbers
// will not match the old screen — that is a defect being fixed, not a change of
// business definition. The default bands are seeded from the values that page
// hardcoded so the classification's operational meaning carries over.

export default function UnderspeedV3() {
  const setColorMode = useHistoryStore((s) => s.setColorMode);
  const speedBands = useHistoryStore((s) => s.speedBands);

  useEffect(() => {
    setColorMode('speed');
    return () => setColorMode('unit');
  }, [setColorMode]);

  // Chunks decoded while another page was active carry unit colours. Repaint
  // them from the current bands rather than refetching: the band index is
  // already in the typed arrays, so this is a pass over existing buffers.
  useEffect(() => {
    const table = speedBands.map((b) => rgb(b.color));
    if (table.length === 0) return;
    registry.listDevices().forEach((device) => registry.recolorDeviceByBand(device.deviceId, table));
    registry.touch();
  }, [speedBands]);

  const sidePanels = useMemo(() => ([
    { key: 'summary', glyph: '▦', title: 'Ringkasan', render: () => <UnderspeedSummaryPanel /> },
    { key: 'metrics', glyph: '▤', title: 'Metrik unit', render: () => <UnderspeedMetricsTable /> },
    { key: 'bands', title: 'Kelas kecepatan', render: () => <SpeedBandEditor /> },
  ]), []);

  return <HistoryWorkspace defaultPanel="summary" sidePanels={sidePanels} />;
}
