import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { PolygonLayer, TextLayer } from '@deck.gl/layers';
import HistoryWorkspace from './HistoryWorkspace';
import useHistoryStore from '../state/historyStore';
import useSpeedAnalysisStore from '../state/speedAnalysisStore';
import * as registry from '../state/traceRegistry';
import { suggestSpeedSegments } from '../services/speedSuggestClient';
import SpeedReviewPanel from '../panel/SpeedReviewPanel';
import { Button } from '../foundation/ui';
import { color as C, font, radius, space, text, rgb } from '../foundation/tokens';

const changeColor = (change) => {
  if (change === 'No Recent Coverage') return [152, 162, 179];
  if (change === 'New Segment') return [123, 97, 168];
  if (change === 'Boundary Change') return rgb(C.sel);
  if (change === 'Speed Review') return [224, 138, 60];
  if (change === 'Active' || change === 'Unchanged') return rgb(C.ok);
  return [224, 138, 60];
};

export default function SpeedAnalysisV3({ onOpenGis }) {
  const status = useHistoryStore((s) => s.status);
  const window = useHistoryStore((s) => s.window);
  const rangeStartMs = useHistoryStore((s) => s.rangeStartMs);
  const rangeEndMs = useHistoryStore((s) => s.rangeEndMs);
  const setColorMode = useHistoryStore((s) => s.setColorMode);
  const speedBands = useHistoryStore((s) => s.speedBands);
  useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);

  const draft = useSpeedAnalysisStore((s) => s.draft);
  const active = useSpeedAnalysisStore((s) => s.active);
  const busy = useSpeedAnalysisStore((s) => s.busy);
  const error = useSpeedAnalysisStore((s) => s.error);
  const selectedIds = useSpeedAnalysisStore((s) => s.selectedIds);
  const setBusy = useSpeedAnalysisStore((s) => s.setBusy);
  const setError = useSpeedAnalysisStore((s) => s.setError);
  const setDraft = useSpeedAnalysisStore((s) => s.setDraftFromSuggestion);
  const toggleSelected = useSpeedAnalysisStore((s) => s.toggleSelected);
  const applyDraft = useSpeedAnalysisStore((s) => s.applyDraft);
  const beginHandoff = useSpeedAnalysisStore((s) => s.beginHandoff);

  useEffect(() => {
    setColorMode('speed');
    return () => setColorMode('unit');
  }, [setColorMode]);

  useEffect(() => {
    const table = speedBands.map((band) => rgb(band.color));
    registry.listDevices().forEach((device) => registry.recolorDeviceByBand(device.deviceId, table));
    registry.touch();
  }, [speedBands]);

  const source = draft || active;
  const segments = source?.segments || [];
  const startMs = window?.startMs ?? rangeStartMs;
  const endMs = window?.endMs ?? rangeEndMs;

  const runSuggest = useCallback(async () => {
    if (status.state !== 'ready' || registry.listDevices().length === 0) {
      setError('Tekan Terapkan dan tunggu jejak selesai dimuat terlebih dahulu.');
      return;
    }
    setBusy(true);
    try {
      const devices = registry.listDevices().map((device) => ({
        deviceId: device.deviceId,
        unitNo: device.unitNo,
        chunks: [...device.chunks.values()].map((chunk) => ({
          n: chunk.n, epochMs: chunk.epochMs, position: chunk.position, speed: chunk.speed,
        })),
      }));
      const result = await suggestSpeedSegments({ devices, startMs, endMs, targetMetres: 100, corridorWidthMetres: 36 });
      const currentById = new Map((active?.segments || []).map((segment) => [segment.id, segment]));
      const nextSegments = result.segments.map((segment) => {
        const current = currentById.get(segment.id);
        if (!current) return { ...segment, change: active ? 'New Segment' : 'Suggested' };
        const currentPlan = current.approvedPlan ?? current.proposedPlan ?? null;
        const change = segment.samples === 0 ? 'No Recent Coverage'
          : segment.suggestedPlan !== currentPlan ? 'Speed Review' : 'Unchanged';
        return { ...segment, roadName: current.roadName, currentPlan, proposedPlan: segment.suggestedPlan ?? currentPlan, change };
      });
      if (nextSegments.length === 0) throw new Error('Tidak ada corridor yang cukup panjang pada filter ini.');
      setDraft({
        segments: nextSegments,
        routes: result.routes,
        evidenceKey: `${status.queryId}|${startMs}|${endMs}`,
      });
    } catch (nextError) {
      setError(nextError.message || 'Auto Suggest gagal.');
    }
  }, [status.state, status.queryId, startMs, endMs, active, setBusy, setDraft, setError]);

  const openGis = useCallback(() => {
    const handoff = beginHandoff();
    if (handoff) onOpenGis?.();
  }, [beginHandoff, onOpenGis]);

  const extraLayers = useMemo(() => {
    if (segments.length === 0) return [];
    const selected = new Set(selectedIds);
    return [new PolygonLayer({
      id: 'v3-speed-segments',
      data: segments,
      getPolygon: (segment) => segment.polygon,
      filled: true,
      stroked: true,
      pickable: true,
      autoHighlight: false,
      getFillColor: (segment) => [...changeColor(segment.change), selected.has(segment.id) ? 105 : 38],
      getLineColor: (segment) => selected.has(segment.id) ? rgb(C.ink) : changeColor(segment.change),
      getLineWidth: (segment) => selected.has(segment.id) ? 3 : 1.4,
      lineWidthUnits: 'pixels',
      onClick: (info) => { if (info.object) toggleSelected(info.object.id); },
      updateTriggers: { getFillColor: [selectedIds, draft], getLineColor: [selectedIds, draft], getLineWidth: selectedIds },
    }), new TextLayer({
      id: 'v3-speed-segment-labels',
      data: segments.filter((segment) => selected.has(segment.id)),
      getPosition: (segment) => segment.path[Math.floor(segment.path.length / 2)],
      getText: (segment) => segment.id,
      getSize: 11,
      getColor: rgb(C.ink),
      background: true,
      getBackgroundColor: [255, 255, 255, 220],
      backgroundPadding: [4, 2],
      fontFamily: font.sans,
      fontWeight: 700,
      pickable: false,
    })];
  }, [segments, selectedIds, draft, toggleSelected]);

  const sidePanels = useMemo(() => ([
    { key: 'review', title: draft ? `Review Draft v${draft.version}` : active ? `Active v${active.version}` : 'Speed Segment Review', render: () => <SpeedReviewPanel /> },
  ]), [draft, active]);

  const headerContent = (
    <SpeedRibbon
      draft={draft}
      active={active}
      segments={segments}
      selectedCount={selectedIds.length}
      busy={busy}
      error={error}
      onSuggest={runSuggest}
      onApply={applyDraft}
      onOpenGis={openGis}
    />
  );

  return (
    <HistoryWorkspace
      defaultPanel="review"
      sidePanels={sidePanels}
      extraLayers={extraLayers}
      headerContent={headerContent}
    />
  );
}

function SpeedRibbon({ draft, active, segments, selectedCount, busy, error, onSuggest, onApply, onOpenGis }) {
  const actual = segments.map((segment) => segment.avgActual).filter(Number.isFinite);
  const reviewed = segments.filter((segment) => segment.reviewed).length;
  return (
    <section style={{
      minHeight: 58, flexShrink: 0, display: 'flex', alignItems: 'center', gap: space[4],
      padding: `7px ${space[4]}px`, borderBottom: `1px solid ${C.line}`, background: C.white,
      overflowX: 'auto', whiteSpace: 'nowrap',
    }}>
      <div style={{ minWidth: 154 }}>
        <span style={{ display: 'block', ...text.xs, color: C.g5 }}>Speed Segment Review</span>
        <strong style={{ ...text.md, color: C.ink }}>
          {draft ? `Review Draft v${draft.version}` : active ? `Active v${active.version}` : 'No Layer'}
        </strong>
      </div>
      <Metric label="Route" value={sourceNumber(draft?.routes ?? active?.routes)} />
      <Metric label="Segment" value={segments.length} />
      <Metric label="Reviewed" value={`${reviewed}/${segments.length}`} />
      <Metric label="Avg actual" value={actual.length ? `${(actual.reduce((a, b) => a + b, 0) / actual.length).toFixed(1)} km/jam` : '—'} />
      <div style={{ flex: 1, minWidth: 16 }} />
      {error ? <span title={error} style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', ...text.sm, color: C.crit }}>{error}</span> : null}
      <Button onClick={onSuggest} disabled={busy}>{busy ? 'Menyusun…' : active ? 'Re-evaluate' : 'Auto Suggest'}</Button>
      <Button variant="primary" onClick={onApply} disabled={!draft}>Apply Draft</Button>
      <Button onClick={onOpenGis} disabled={!segments.length} style={{ borderColor: selectedCount ? C.sel : undefined }}>
        Open GIS Workspace →{selectedCount ? ` ${selectedCount}` : ''}
      </Button>
    </section>
  );
}

function sourceNumber(value) { return Number.isFinite(value) ? value : '—'; }

function Metric({ label, value }) {
  return (
    <div style={{ minWidth: 68, paddingLeft: space[3], borderLeft: `1px solid ${C.line}` }}>
      <span style={{ display: 'block', ...text.micro, color: C.g5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <strong style={{ ...text.sm, color: C.ink, fontFamily: font.mono }}>{value}</strong>
    </div>
  );
}
