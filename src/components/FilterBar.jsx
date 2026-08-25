import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "../state/WorkspaceContext";
import { displayRange, pad } from "../utils/workspace";

function FilterButton({ name, label, value, buttonRef }) {
  const { state, dispatch } = useWorkspace();
  return (
    <button ref={buttonRef} className="filterbtn" type="button" onClick={() => dispatch({ type: "SET_POPOVER", name })} aria-expanded={state.popover === name}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      <span className="chev">▾</span>
    </button>
  );
}

function usePopoverPosition(buttonRef, open) {
  const [style, setStyle] = useState({ left: 10, top: 58 });
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      setStyle({ left: Math.min(rect.left, window.innerWidth - 390), top: rect.bottom + 6 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [buttonRef, open]);
  return style;
}

function TimePopover({ buttonRef }) {
  const { state, dispatch } = useWorkspace();
  const open = state.popover === "time";
  const style = usePopoverPosition(buttonRef, open);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, value) => value), []);
  const [local, setLocal] = useState(state.draftFilters);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setLocal(state.draftFilters);
  }, [open, state.draftFilters]);

  const preset = (name) => {
    const [date] = state.initialFilters?.start?.split("T") ?? state.draftFilters.start.split("T");
    const next = { ...local };
    if (name === "shift1") {
      next.start = `${date}T06:00`;
      next.end = `${date}T18:00`;
    } else if (name === "shift2") {
      const base = new Date(`${date}T00:00:00+08:00`);
      const tomorrow = new Date(base.getTime() + 86400000);
      next.start = `${date}T18:00`;
      next.end = `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(tomorrow.getUTCDate())}T06:00`;
    } else {
      next.start = `${date}T00:00`;
      next.end = `${date}T23:00`;
    }
    setLocal(next);
  };

  const apply = () => {
    if (Date.parse(`${local.end}:00+08:00`) <= Date.parse(`${local.start}:00+08:00`)) {
      setError("Waktu selesai harus setelah waktu mulai.");
      return;
    }
    dispatch({ type: "PATCH_DRAFT_FILTERS", patch: { start: local.start, end: local.end } });
    dispatch({ type: "CLOSE_POPOVERS" });
    setError("");
  };

  if (!open) return null;
  const [startDate, startTime] = local.start.split("T");
  const [endDate, endTime] = local.end.split("T");
  return (
    <div className="popover" style={style} onClick={(event) => event.stopPropagation()}>
      <div className="segmented">
        <button type="button" className={state.timeMode === "quick" ? "active" : ""} onClick={() => dispatch({ type: "SET_TIME_MODE", value: "quick" })}>Pintasan</button>
        <button type="button" className={state.timeMode === "custom" ? "active" : ""} onClick={() => dispatch({ type: "SET_TIME_MODE", value: "custom" })}>Kustom</button>
      </div>
      {state.timeMode === "quick" ? (
        <div>
          <div className="pop-title">Pilih cepat</div>
          <div className="quick-grid">
            <button type="button" onClick={() => preset("shift1")}>Shift 1 <span className="small">06–18</span></button>
            <button type="button" onClick={() => preset("shift2")}>Shift 2 <span className="small">18–06</span></button>
            <button type="button" onClick={() => preset("today")}>Hari ini</button>
            <button type="button" onClick={() => preset("full")}>1 hari penuh</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="pop-title">Rentang kustom</div>
          <div className="range-row">
            <label>Mulai</label>
            <input className="input" type="date" value={startDate || ""} onChange={(event) => setLocal((current) => ({ ...current, start: `${event.target.value}T${startTime || "00:00"}` }))} />
            <select className="input" value={Number(startTime?.slice(0, 2) || 0)} onChange={(event) => setLocal((current) => ({ ...current, start: `${startDate}T${pad(event.target.value)}:00` }))}>
              {hours.map((hour) => <option key={hour} value={hour}>{pad(hour)}:00</option>)}
            </select>
          </div>
          <div className="range-row">
            <label>Selesai</label>
            <input className="input" type="date" value={endDate || ""} onChange={(event) => setLocal((current) => ({ ...current, end: `${event.target.value}T${endTime || "00:00"}` }))} />
            <select className="input" value={Number(endTime?.slice(0, 2) || 0)} onChange={(event) => setLocal((current) => ({ ...current, end: `${endDate}T${pad(event.target.value)}:00` }))}>
              {hours.map((hour) => <option key={hour} value={hour}>{pad(hour)}:00</option>)}
            </select>
          </div>
          <div className="small" style={{ color: "#b94f48" }}>{error}</div>
        </div>
      )}
      <div className="pop-footer">
        <button className="btn" type="button" onClick={() => dispatch({ type: "CLOSE_POPOVERS" })}>Batal</button>
        <button className="btn primary" type="button" onClick={apply}>Pakai</button>
      </div>
    </div>
  );
}

function LoaderPopover({ buttonRef }) {
  const { state, dispatch, loaders } = useWorkspace();
  const open = state.popover === "loader";
  const style = usePopoverPosition(buttonRef, open);
  const [query, setQuery] = useState("");
  const filtered = loaders.filter((item) => item.loader.toLowerCase().includes(query.toLowerCase()));
  const selected = new Set(state.draftFilters.loaders);
  const toggle = (loader) => {
    const next = new Set(selected);
    next.has(loader) ? next.delete(loader) : next.add(loader);
    dispatch({ type: "PATCH_DRAFT_FILTERS", patch: { loaders: [...next] } });
  };
  const applyLoaderUnits = () => {
    if (!selected.size) return dispatch({ type: "CLOSE_POPOVERS" });
    const unitSet = new Set(loaders.filter((item) => selected.has(item.loader)).flatMap((item) => item.units));
    dispatch({ type: "PATCH_DRAFT_FILTERS", patch: { units: [...unitSet] } });
    dispatch({ type: "CLOSE_POPOVERS" });
  };
  if (!open) return null;
  return (
    <div className="popover" style={style} onClick={(event) => event.stopPropagation()}>
      <div className="segmented">
        {['miforce', 'timesheet'].map((source) => <button key={source} type="button" className={state.draftFilters.source === source ? "active" : ""} onClick={() => dispatch({ type: "PATCH_DRAFT_FILTERS", patch: { source } })}>{source === 'miforce' ? 'MiForce' : 'Timesheet'}</button>)}
      </div>
      <div className="pop-title">Loader</div>
      <div className="search-wrap"><input className="search-input" type="search" placeholder="Cari loader…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="select-scroll">
        {filtered.map((item) => (
          <label className="check-row" key={item.loader}>
            <span className="check-main"><input type="checkbox" checked={selected.has(item.loader)} onChange={() => toggle(item.loader)} /><strong>{item.loader}</strong></span>
            <span className="small">{item.withData}/{item.unitCount} DT</span>
          </label>
        ))}
      </div>
      <div className="pop-footer">
        <button className="btn" type="button" onClick={() => dispatch({ type: "PATCH_DRAFT_FILTERS", patch: { loaders: [] } })}>Kosongkan</button>
        <button className="btn primary" type="button" onClick={applyLoaderUnits}>Selesai</button>
      </div>
    </div>
  );
}

function UnitPopover({ buttonRef }) {
  const { state, dispatch } = useWorkspace();
  const open = state.popover === "unit";
  const style = usePopoverPosition(buttonRef, open);
  const [query, setQuery] = useState("");
  const units = state.fixture?.unitNos ?? [];
  const selected = new Set(state.draftFilters.units);
  const filtered = units.filter((unit) => unit.toLowerCase().includes(query.toLowerCase()));
  const toggle = (unitNo) => {
    const next = new Set(selected);
    next.has(unitNo) ? next.delete(unitNo) : next.add(unitNo);
    dispatch({ type: "PATCH_DRAFT_FILTERS", patch: { units: [...next] } });
  };
  if (!open) return null;
  return (
    <div className="popover" style={style} onClick={(event) => event.stopPropagation()}>
      <div className="pop-title" style={{ marginTop: 0 }}>Unit</div>
      <div className="search-wrap"><input className="search-input" type="search" placeholder="Cari unit…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="select-scroll">
        {filtered.map((unitNo) => <label className="check-row" key={unitNo}><span className="check-main"><input type="checkbox" checked={selected.has(unitNo)} onChange={() => toggle(unitNo)} /><strong>{unitNo}</strong></span><span className="small">available</span></label>)}
      </div>
      <div className="pop-footer">
        <button className="btn" type="button" onClick={() => dispatch({ type: "PATCH_DRAFT_FILTERS", patch: { units: [] } })}>Kosongkan</button>
        <button className="btn primary" type="button" onClick={() => dispatch({ type: "CLOSE_POPOVERS" })}>Selesai</button>
      </div>
    </div>
  );
}

function IntervalPopover({ buttonRef }) {
  const { state, dispatch } = useWorkspace();
  const open = state.popover === "interval";
  const style = usePopoverPosition(buttonRef, open);
  if (!open) return null;
  return (
    <div className="popover" style={{ ...style, minWidth: 180 }} onClick={(event) => event.stopPropagation()}>
      {[2, 5, 10, 30].map((interval) => <button key={interval} type="button" className="check-row" style={{ width: "100%", border: 0, background: "#fff" }} onClick={() => { dispatch({ type: "PATCH_DRAFT_FILTERS", patch: { interval } }); dispatch({ type: "CLOSE_POPOVERS" }); }}><span>{interval} detik</span><span className="small">{interval === 2 ? "Default" : state.draftFilters.interval === interval ? "Dipilih" : ""}</span></button>)}
    </div>
  );
}

export default function FilterBar() {
  const { state, dispatch, applyFilters, resetFilters, displayDraftRange } = useWorkspace();
  const timeRef = useRef(null);
  const loaderRef = useRef(null);
  const unitRef = useRef(null);
  const intervalRef = useRef(null);
  useEffect(() => {
    const close = () => dispatch({ type: "CLOSE_POPOVERS" });
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [dispatch]);
  const loaderLabel = state.draftFilters.loaders.length ? `${state.draftFilters.loaders.length} loader` : "Semua loader";
  const unitLabel = state.draftFilters.units.length === (state.fixture?.unitNos?.length ?? 0) ? "Semua unit" : `${state.draftFilters.units.length} unit`;
  return (
    <>
      <section className="filterbar" onClick={(event) => event.stopPropagation()}>
        <FilterButton name="time" label="Rentang Waktu" value={displayDraftRange} buttonRef={timeRef} />
        <FilterButton name="loader" label="Loader" value={loaderLabel} buttonRef={loaderRef} />
        <FilterButton name="unit" label="Unit" value={unitLabel} buttonRef={unitRef} />
        <FilterButton name="interval" label="Interval" value={`${state.draftFilters.interval} detik`} buttonRef={intervalRef} />
        <button className="btn primary" type="button" disabled={!state.filterDirty || !state.draftFilters.units.length} onClick={applyFilters}>Terapkan</button>
        <button className="btn" type="button" disabled={!state.initialFilters} onClick={resetFilters}>Reset</button>
        <button className="btn" type="button" disabled={!state.fixture} onClick={() => dispatch({ type: "SET_EXPORT_OPEN", value: true })}>⇩ Export</button>
      </section>
      <TimePopover buttonRef={timeRef} />
      <LoaderPopover buttonRef={loaderRef} />
      <UnitPopover buttonRef={unitRef} />
      <IntervalPopover buttonRef={intervalRef} />
    </>
  );
}
