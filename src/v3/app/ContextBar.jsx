import { useCallback, useState } from 'react';
import useHistoryStore from '../state/historyStore';
import useUserStore from '../../stores/userStore';
import { loadTrace, abortLoad } from '../services/traceLoader';
import UnitPicker from './UnitPicker';
import LoaderPicker from './LoaderPicker';
import TimeRangePicker from './TimeRangePicker';
import useUnitAvailability from './useUnitAvailability';
import ExportDialog from '../panel/ExportDialog';
import { Button, Chip, Divider, ProgressBar } from '../foundation/ui';
import { color as C, text, space, layout } from '../foundation/tokens';

// The context bar replaces the 972-line blocking FilterModal.
//
// The three things that define what is on screen — district, time range, units —
// stay visible while the result is visible, so a range can be adjusted while
// looking at what it produced. In V1/V2 the filter covered the map, so context
// was always configured blind.

const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');

export default function ContextBar() {
  const context = useHistoryStore((s) => s.context);
  const setContext = useHistoryStore((s) => s.setContext);
  const status = useHistoryStore((s) => s.status);
  const profileDistrict = useUserStore((s) => s.profile?.distrik);

  const [exportOpen, setExportOpen] = useState(false);
  // Latched by whichever picker opens first. Fleet-wide availability is not a
  // cheap scan and the bar's datetime fields change on every keystroke, so it
  // stays unfetched until an operator actually asks to choose something.
  const [wantAvailability, setWantAvailability] = useState(false);

  const district = context.district || profileDistrict || (import.meta.env.DEV ? 'BRCB' : '');
  const availability = useUnitAvailability({
    district,
    startDateTime: context.startDateTime,
    endDateTime: context.endDateTime,
    source: context.source,
    enabled: wantAvailability,
  });

  const busy = ['resolving', 'queued', 'running', 'loading'].includes(status.state);
  const canRun = Boolean(district) && context.unitNos.length > 0
    && Date.parse(context.endDateTime) > Date.parse(context.startDateTime);

  // Choosing a loader selects its DTs.
  //
  // The filter used to only narrow the list and leave selection to the operator.
  // That was wrong for the actual task: work is assigned by loader, so "LDR-07"
  // already means "those trucks" — making someone tick twelve boxes to say what
  // they just said is busywork.
  //
  // Selection stays editable afterwards. Deselecting a loader removes only the
  // DTs that came with it, so a truck ticked by hand, or one shared with a
  // loader still selected, survives.
  const handleLoaderChange = useCallback((nextLoaders) => {
    const index = availability.data?.loaders || [];
    const unitsOf = (name) => index.find((l) => l.loader === name)?.units || [];

    const removed = context.loaders.filter((l) => !nextLoaders.includes(l));

    const keep = new Set(context.unitNos);
    // Drop the removed loaders' units, then re-add every still-selected
    // loader's. Order matters: a DT shared between a dropped loader and a kept
    // one has to end up selected, not dropped.
    removed.forEach((name) => unitsOf(name).forEach((u) => keep.delete(u)));
    nextLoaders.forEach((name) => unitsOf(name).forEach((u) => keep.add(u)));

    setContext({ loaders: nextLoaders, unitNos: [...keep] });
  }, [availability.data, context.loaders, context.unitNos, setContext]);

  const handleRun = useCallback(() => {
    if (busy) { abortLoad(); return; }
    loadTrace({
      district,
      unitNos: context.unitNos,
      startDateTime: context.startDateTime,
      endDateTime: context.endDateTime,
    });
  }, [busy, district, context.unitNos, context.startDateTime, context.endDateTime]);

  return (
    <header style={{
      height: layout.contextBarHeight, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: space[2],
      padding: `0 ${space[3]}px`,
      background: C.white, borderBottom: `1px solid ${C.line}`,
      overflow: 'hidden',
    }}>
      {/* Filters scroll when the bar is cramped; the actions after this group do
          not. A fifth control plus a taller type scale overflowed a single
          nowrap row, and because the shell is `position: fixed` the overflow was
          simply clipped — "Terapkan" was still rendered, just off-screen with
          nothing to hint that it existed. */}
      <div style={{
        flex: '1 1 auto', minWidth: 0,
        display: 'flex', alignItems: 'center', gap: space[2],
        overflowX: 'auto', overflowY: 'hidden',
        // The popovers are portalled, so a scroll container here cannot clip
        // them; only the triggers move.
        scrollbarWidth: 'thin',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 2, flexShrink: 0 }}>
          <span style={{ ...text.sm, color: C.g5 }}>Distrik</span>
          <span style={{ ...text.base, fontWeight: 700, color: C.ink, letterSpacing: '0.02em' }}>
            {district || '—'}
          </span>
        </div>

        <Divider vertical style={{ height: 20, alignSelf: 'center' }} />

        <TimeRangePicker
          startDateTime={context.startDateTime}
          endDateTime={context.endDateTime}
          onChange={setContext}
        />

        <LoaderPicker
          value={context.loaders}
          onChange={handleLoaderChange}
          loaders={availability.data?.loaders}
          loaded={Boolean(availability.data)}
          assignmentError={availability.data?.assignmentError}
          assignmentNote={availability.data?.assignmentNote}
          loading={availability.loading}
          error={availability.error}
          onOpen={() => setWantAvailability(true)}
          source={context.source}
          onSourceChange={(source) => setContext({ source })}
        />

        <UnitPicker
          value={context.unitNos}
          onChange={(unitNos) => setContext({ unitNos })}
          data={availability.data}
          loading={availability.loading}
          error={availability.error}
          onOpen={() => setWantAvailability(true)}
          loaderFilter={context.loaders}
        />
      </div>

      {/* The primary action never scrolls and never shrinks. It is the one
          control the bar exists to lead to. */}
      <Button
        variant={busy ? 'default' : 'primary'}
        onClick={handleRun}
        disabled={!busy && !canRun}
        style={{ flexShrink: 0 }}
        title={canRun || busy ? undefined : 'Pilih unit dan rentang waktu dulu'}
      >
        {busy ? 'Batalkan' : 'Terapkan'}
      </Button>

      {/* Shrinks and truncates rather than pushing the Export button off the
          bar — the error state can carry a long server message. */}
      <div style={{ flexShrink: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <StatusReadout status={status} />
      </div>

      {/* Export works off the same context as the query, so it belongs beside
          it rather than in a panel the user has to go find. Enabled on a valid
          selection, not on a finished query: exporting raw data does not
          require having rendered it first. */}
      <Button
        onClick={() => setExportOpen(true)}
        disabled={!canRun}
        style={{ flexShrink: 0 }}
        title={canRun ? 'Export data mentah untuk konteks ini' : 'Pilih unit dan rentang waktu dulu'}
      >
        Export
      </Button>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        context={context}
        district={district}
      />
    </header>
  );
}

// The readout answers one question per phase, in the phase's own terms.
//
// It used to render "5/274 · 12.043 titik" in mono for every phase, which reads
// as instrumentation rather than as an answer. Resolving devices, waiting on the
// server and streaming hours are different waits and are named as such; the
// finished state leads with the figure that matters and demotes the caveats.
function StatusReadout({ status }) {
  if (status.state === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], maxWidth: 460 }}>
        <span style={{ ...text.sm, color: C.crit, fontWeight: 600 }}>Gagal memuat</span>
        <span style={{
          ...text.sm, color: C.g5, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={status.error}>
          {status.error}
        </span>
      </div>
    );
  }

  if (['resolving', 'queued', 'running'].includes(status.state)) {
    return (
      <Phase
        // Indeterminate on purpose: the server has not told us how much work
        // there is yet, and a bar that sits at 0% reads as stalled.
        value={status.state === 'running' ? status.progress : null}
        label={status.message || 'Memproses…'}
      />
    );
  }

  if (status.state === 'loading') {
    const { loadedChunks = 0, totalChunks = 0, sampleCount = 0 } = status;
    return (
      <Phase
        value={totalChunks ? (loadedChunks / totalChunks) * 100 : null}
        label={`Memuat jejak · ${loadedChunks} dari ${totalChunks} jam`}
        detail={sampleCount > 0 ? `${fmtInt(sampleCount)} titik` : null}
      />
    );
  }

  if (status.state === 'ready') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
        {status.message ? <Chip tone="warn">{status.message}</Chip> : null}
        {/* Stride is reported, never silent: showing fewer samples than were
            asked for without saying so is how an operational tool loses trust.
            Only appears when the operator set a manual interval — loading is
            always full-resolution otherwise. */}
        {status.stride > 1 ? (
          <Chip tone="warn" title="Interval manual diset di panel filter">
            1 dari {status.stride} sampel
          </Chip>
        ) : null}
        <span className="tnum" style={{ ...text.md, fontWeight: 600, color: C.ink }}>
          {fmtInt(status.sampleCount)}
        </span>
        <span style={{ ...text.sm, color: C.g5, marginLeft: -4 }}>titik</span>
      </div>
    );
  }

  return <span style={{ ...text.sm, color: C.g5 }}>Pilih unit dan rentang waktu, lalu Terapkan</span>;
}

function Phase({ value, label, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{ ...text.sm, color: C.g6 }}>{label}</span>
        {detail ? (
          <span className="tnum" style={{ ...text.xs, color: C.g5 }}>{detail}</span>
        ) : null}
      </div>
      <ProgressBar compact value={value} style={{ width: 108 }} />
    </div>
  );
}
