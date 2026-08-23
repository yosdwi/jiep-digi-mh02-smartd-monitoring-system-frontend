import { useEffect, useMemo, useRef, useState } from 'react';

const TIME_PRESETS = [
  ['shift1', 'Shift 1', '06–18'],
  ['shift2', 'Shift 2', '18–06'],
  ['today', 'Hari ini', null],
  ['full', '1 hari penuh', null],
];

const INTERVALS = [
  ['0', 'Penuh'],
  ['2', '2 detik'],
  ['5', '5 detik'],
  ['10', '10 detik'],
  ['30', '30 detik'],
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function applyPreset(key) {
  const now = new Date();
  if (key === 'today') {
    return { startDate: todayIso(), startHour: '0', endDate: todayIso(), endHour: '23' };
  }
  if (key === 'full') {
    const d = new Date(now.getTime() - 24 * 3600 * 1000);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { startDate: iso, startHour: '0', endDate: todayIso(), endHour: '23' };
  }
  if (key === 'shift1') return { startDate: todayIso(), startHour: '6', endDate: todayIso(), endHour: '18' };
  if (key === 'shift2') return { startDate: todayIso(), startHour: '18', endDate: todayIso(), endHour: '5' };
  return null;
}

// Ported from the V23.3 mockup's filter popovers (time / loader / unit /
// interval). "Terapkan" wires into the real history query (setContext +
// setTraceInterval + loadTrace, same as the rest of this app) — the popovers
// themselves are local draft state that only becomes the applied filter on
// submit, matching the mockup's applied-vs-draft split (the fix this file is
// literally named after).
export default function FilterBar({
  devices,
  applied,
  busy,
  onApply,
  onReset,
  onExport,
}) {
  const [openPop, setOpenPop] = useState(null);
  const [timeMode, setTimeMode] = useState('quick');
  const [range, setRange] = useState(() => ({ ...applyPreset('shift1') }));
  const [rangeLabel, setRangeLabel] = useState('Shift 1 · 06–18');
  const [loaderSource, setLoaderSource] = useState('miforce');
  const [loaderSearch, setLoaderSearch] = useState('');
  const [loaderSelected, setLoaderSelected] = useState([]);
  const [unitSearch, setUnitSearch] = useState('');
  const [unitSelected, setUnitSelected] = useState([]);
  const [interval, setIntervalValue] = useState('2');
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpenPop(null);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const loaderNames = useMemo(
    () => [...new Set(devices.map((d) => d.loader).filter(Boolean))],
    [devices],
  );
  const unitNames = useMemo(() => devices.map((d) => d.unitNo), [devices]);

  const filteredLoaders = loaderNames.filter((name) =>
    name.toLowerCase().includes(loaderSearch.trim().toLowerCase()),
  );
  const filteredUnits = unitNames.filter((name) =>
    name.toLowerCase().includes(unitSearch.trim().toLowerCase()),
  );

  function toggle(pop) {
    setOpenPop((current) => (current === pop ? null : pop));
  }

  function pickPreset(key) {
    const next = applyPreset(key);
    if (next) setRange(next);
    const preset = TIME_PRESETS.find(([k]) => k === key);
    setRangeLabel(preset ? `${preset[1]}${preset[2] ? ` · ${preset[2]}` : ''}` : '—');
  }

  function toggleLoader(name) {
    setLoaderSelected((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));
  }
  function toggleUnit(name) {
    setUnitSelected((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));
  }

  function submitApply() {
    onApply({
      start: `${range.startDate}T${pad(Number(range.startHour))}:00`,
      end: `${range.endDate}T${pad(Number(range.endHour))}:00`,
      loaders: loaderSelected,
      units: unitSelected,
      interval,
    });
  }

  const canApply = unitSelected.length > 0 && !busy;

  return (
    <div ref={rootRef}>
      <section className="filterbar">
        <button type="button" className="filterbtn" onClick={() => toggle('time')}>
          <span className="label">Rentang Waktu</span>
          <span className="value">{rangeLabel}</span>
          <span className="chev">▾</span>
        </button>
        <button type="button" className="filterbtn" onClick={() => toggle('loader')}>
          <span className="label">Loader</span>
          <span className="value">{loaderSelected.length ? `${loaderSelected.length} loader` : 'Semua loader'}</span>
          <span className="chev">▾</span>
        </button>
        <button type="button" className="filterbtn" onClick={() => toggle('unit')}>
          <span className="label">Unit</span>
          <span className="value">{unitSelected.length ? `${unitSelected.length} unit` : 'Semua unit'}</span>
          <span className="chev">▾</span>
        </button>
        <button type="button" className="filterbtn" onClick={() => toggle('interval')}>
          <span className="label">Interval</span>
          <span className="value">{INTERVALS.find(([v]) => v === interval)?.[1]}</span>
          <span className="chev">▾</span>
        </button>
        <button type="button" className="btn primary" disabled={!canApply} onClick={submitApply}>
          {busy ? 'Memuat…' : 'Terapkan'}
        </button>
        <button type="button" className="btn" disabled={!applied} onClick={onReset}>
          Reset
        </button>
        <button type="button" className="btn" disabled={!applied} onClick={onExport}>
          ⇩ Export
        </button>
      </section>

      {openPop === 'time' ? (
        <div className="popover">
          <div className="segmented">
            <button type="button" className={timeMode === 'quick' ? 'active' : ''} onClick={() => setTimeMode('quick')}>
              Pintasan
            </button>
            <button type="button" className={timeMode === 'custom' ? 'active' : ''} onClick={() => setTimeMode('custom')}>
              Kustom
            </button>
          </div>
          {timeMode === 'quick' ? (
            <div>
              <div className="pop-title">Pilih cepat</div>
              <div className="quick-grid">
                {TIME_PRESETS.map(([key, label, sub]) => (
                  <button key={key} type="button" onClick={() => pickPreset(key)}>
                    {label} {sub ? <span className="small">{sub}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="pop-title">Rentang kustom</div>
              <div className="range-row">
                <label>Mulai</label>
                <input
                  className="input"
                  type="date"
                  value={range.startDate}
                  onChange={(e) => setRange({ ...range, startDate: e.target.value })}
                />
                <select
                  className="input"
                  value={range.startHour}
                  onChange={(e) => setRange({ ...range, startHour: e.target.value })}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{pad(h)}:00</option>
                  ))}
                </select>
              </div>
              <div className="range-row">
                <label>Selesai</label>
                <input
                  className="input"
                  type="date"
                  value={range.endDate}
                  onChange={(e) => setRange({ ...range, endDate: e.target.value })}
                />
                <select
                  className="input"
                  value={range.endHour}
                  onChange={(e) => setRange({ ...range, endHour: e.target.value })}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{pad(h)}:00</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="pop-footer">
            <button type="button" className="btn" onClick={() => setOpenPop(null)}>Batal</button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (timeMode === 'custom') setRangeLabel(`${range.startDate} → ${range.endDate}`);
                setOpenPop(null);
              }}
            >
              Pakai
            </button>
          </div>
        </div>
      ) : null}

      {openPop === 'loader' ? (
        <div className="popover">
          <div className="segmented">
            <button type="button" className={loaderSource === 'miforce' ? 'active' : ''} onClick={() => setLoaderSource('miforce')}>MiForce</button>
            <button type="button" className={loaderSource === 'timesheet' ? 'active' : ''} onClick={() => setLoaderSource('timesheet')}>Timesheet</button>
          </div>
          <div className="pop-title">Loader</div>
          <div className="search-wrap">
            <input
              className="search-input"
              type="search"
              placeholder="Cari loader…"
              value={loaderSearch}
              onChange={(e) => setLoaderSearch(e.target.value)}
            />
          </div>
          <div className="select-scroll">
            {filteredLoaders.length ? (
              filteredLoaders.map((name) => (
                <label key={name} className="check-row">
                  <span className="check-main">
                    <input type="checkbox" checked={loaderSelected.includes(name)} onChange={() => toggleLoader(name)} />
                    {name}
                  </span>
                </label>
              ))
            ) : (
              <div className="small" style={{ padding: '8px 4px' }}>Data loader belum dimuat.</div>
            )}
          </div>
          <div className="pop-footer">
            <button type="button" className="btn" onClick={() => setLoaderSelected([])}>Kosongkan</button>
            <button type="button" className="btn primary" onClick={() => setOpenPop(null)}>Selesai</button>
          </div>
        </div>
      ) : null}

      {openPop === 'unit' ? (
        <div className="popover">
          <div className="pop-title" style={{ marginTop: 0 }}>Unit</div>
          <div className="search-wrap">
            <input
              className="search-input"
              type="search"
              placeholder="Cari unit…"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
            />
          </div>
          <div className="select-scroll">
            {filteredUnits.length ? (
              filteredUnits.map((name) => (
                <label key={name} className="check-row">
                  <span className="check-main">
                    <input type="checkbox" checked={unitSelected.includes(name)} onChange={() => toggleUnit(name)} />
                    {name}
                  </span>
                </label>
              ))
            ) : (
              <div className="small" style={{ padding: '8px 4px' }}>Data unit belum dimuat.</div>
            )}
          </div>
          <div className="pop-footer">
            <button type="button" className="btn" onClick={() => setUnitSelected([])}>Kosongkan</button>
            <button type="button" className="btn primary" onClick={() => setOpenPop(null)}>Selesai</button>
          </div>
        </div>
      ) : null}

      {openPop === 'interval' ? (
        <div className="popover" style={{ minWidth: 180 }}>
          {INTERVALS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`quick-grid-btn${value === interval ? ' active' : ''}`}
              style={{
                display: 'block', width: '100%', textAlign: 'left', height: 34, border: 0, borderRadius: 7,
                background: value === interval ? 'var(--accent-bg)' : 'transparent',
                color: value === interval ? 'var(--accent)' : 'inherit', padding: '0 9px', fontSize: 12,
              }}
              onClick={() => { setIntervalValue(value); setOpenPop(null); }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
