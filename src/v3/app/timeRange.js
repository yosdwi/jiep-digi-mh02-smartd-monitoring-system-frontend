// Pure date arithmetic behind TimeRangePicker. Split out of the component so it
// can be asserted without a DOM or a test framework — see timeRange.test.mjs.

export const pad = (n) => String(n).padStart(2, '0');

// Everything downstream is hourly.
//
// Availability (tbl_t_datalog_s3_availability) is one row per unit per WITA
// hour, and both fleet sources report assignment by hour — MiForce as
// DATEPART(HOUR, CREATED_AT), Timesheet as ProduksiDetilJam. V1 never offered
// minutes for the same reason.
//
// Allowing them here bought nothing and cost correctness: 06:30-18:30 produced
// an hour window of 6..18 for the assignment query while the availability
// denominator counted a different set of slots, so the two answers were built
// over ranges that did not match. Minutes are always emitted as :00.
export const toInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;

/** Down to the hour — for the start of a range. */
export function floorHour(d) { const x = new Date(d); x.setMinutes(0, 0, 0); return x; }

/**
 * Up to the hour — for the end of a range.
 *
 * Ceil rather than floor so the hour in progress is included: at 09:37,
 * "6 jam terakhir" means 04:00-10:00, not 03:00-09:00, which would drop the
 * data the operator is most likely looking for.
 */
export function ceilHour(d) {
  const x = new Date(d);
  if (x.getMinutes() || x.getSeconds() || x.getMilliseconds()) {
    x.setMinutes(0, 0, 0);
    x.setHours(x.getHours() + 1);
  }
  return x;
}

export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

/**
 * The exclusive end of the day: midnight the next morning.
 *
 * It used to be 23:59, which was harmless while minutes existed and is not now —
 * snapping that down to 23:00 would silently drop the last hour of every
 * "hari ini" query. The range end is exclusive when hours are enumerated, so
 * 24:00 is what makes a day 24 slots.
 */
export function endOfDay(d) { const x = startOfDay(d); x.setDate(x.getDate() + 1); return x; }

export function plusHours(d, h) { return new Date(d.getTime() + h * 3600e3); }

/**
 * The most recent shift of this type that has already *started*.
 *
 * The previous version built shift 2 as today 18:00 → tomorrow 06:00, so an
 * operator opening the page at 08:00 — the normal time to review the night —
 * got an entirely future window and an empty map.
 *
 * WITA has no DST, so hour arithmetic on a local Date is safe here.
 */
export function shiftRange(which, now = new Date()) {
  const begin = new Date(startOfDay(now).getTime() + (which === 1 ? 6 : 18) * 3600e3);
  if (now < begin) begin.setDate(begin.getDate() - 1);
  return [begin, plusHours(begin, 12)];
}

/** Same window, moved by whole days. Returns null if either bound is unparseable. */
export function stepRangeDays(startDateTime, endDateTime, delta) {
  const a = new Date(startDateTime);
  const b = new Date(endDateTime);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  a.setDate(a.getDate() + delta);
  b.setDate(b.getDate() + delta);
  return [a, b];
}
