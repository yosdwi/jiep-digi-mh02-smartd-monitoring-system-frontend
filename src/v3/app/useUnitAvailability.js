import { useEffect, useState } from 'react';
import axios from 'axios';

// Per-hour availability for the district's fleet, plus each DT's loader
// assignment over the range.
//
// Lifted out of UnitPicker because the loader filter needs the same answer. The
// endpoint scans availability across the whole fleet for the range, so two
// components fetching it independently would double a query that is not cheap.
// ContextBar owns the call; both pickers read the result.
//
// Still lazy: `enabled` stays false until an operator opens one of the pickers.
// The context bar changes on every keystroke of a datetime field, and firing a
// fleet-wide scan on each of those was never worth it.

export default function useUnitAvailability({
  district, startDateTime, endDateTime, source, enabled,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !district) return undefined;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    axios
      .get('/Monitoring/api/HistoryContextV3/units', {
        params: { district, start: startDateTime, end: endDateTime, source },
        signal: controller.signal,
      })
      .then((response) => {
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Gagal mengambil daftar unit.');
        }
        setData(response.data);
      })
      .catch((err) => { if (err.name !== 'CanceledError') setError(err.message); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [enabled, district, startDateTime, endDateTime, source]);

  return { data, loading, error };
}

// The loader list is NOT derived here. `/units` returns a `loaders` index built
// from the fleet-source assignment itself, and the picker reads that.
//
// Deriving it from the unit rows was wrong in a way that hid work: those rows
// are filtered by the device master, so a loader whose DTs are unregistered
// counted low, and one whose DTs were all unregistered vanished from the filter
// completely. Two paths to the same number is how they drift apart, so there is
// only one.
