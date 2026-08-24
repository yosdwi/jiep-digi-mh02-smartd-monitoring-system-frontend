// Shared row-shaping for the Performance grid, used by both the on-screen
// ag-grid table (PerformanceTrend.jsx) and the xlsx export (Modals.jsx) so
// the two can never drift apart.
//
// TODO(backend): this is still demo data cycled from DEMO_ROWS — there is no
// monitor-system endpoint yet for per-unit ritase/cycle/loader aggregates.
// Swap the mapping below for a real response once one exists; `devices`
// (from useHistoryStore) already carries the real unit/deviceId pairing.
const DEMO_ROWS = [
  { unit: 'DT5204', loader: 'EX3001', ritase: 12, cycle: 28.4, loaded: 2.8, empty: 2.4, speed: 24.6 },
  { unit: 'DT5210', loader: 'EX3001', ritase: 11, cycle: 30.1, loaded: 2.7, empty: 2.5, speed: 23.2 },
  { unit: 'DT5328', loader: 'EX3003', ritase: 10, cycle: 31.7, loaded: 3.2, empty: 2.9, speed: 21.8 },
];

export function buildPerformanceRows(devices) {
  if (!devices?.length) return DEMO_ROWS.map((row) => ({ ...row, deviceId: row.unit }));
  return devices.map((d, i) => ({
    deviceId: d.deviceId,
    unit: d.unitNo,
    loader: DEMO_ROWS[i % DEMO_ROWS.length].loader,
    ritase: DEMO_ROWS[i % DEMO_ROWS.length].ritase,
    cycle: DEMO_ROWS[i % DEMO_ROWS.length].cycle,
    loaded: DEMO_ROWS[i % DEMO_ROWS.length].loaded,
    empty: DEMO_ROWS[i % DEMO_ROWS.length].empty,
    speed: DEMO_ROWS[i % DEMO_ROWS.length].speed,
  }));
}
