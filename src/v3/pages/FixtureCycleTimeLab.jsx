import { useEffect, useState } from 'react';
import HistoryWorkspace from './HistoryWorkspace';
import useHistoryStore from '../state/historyStore';
import { loadFixtureTrace } from '../fixtures/loadFixtureTrace';

export default function FixtureCycleTimeLab() {
  const setColorMode = useHistoryStore((s) => s.setColorMode);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setColorMode('speed');
    useHistoryStore.getState().setStatus({
      state: 'loading',
      progress: 20,
      message: 'Memuat fixture ClickHouse 2 detik...',
      error: null,
    });
    loadFixtureTrace().catch((err) => {
      if (cancelled) return;
      const message = err?.message || 'Gagal memuat fixture.';
      setError(message);
      useHistoryStore.getState().setStatus({ state: 'error', error: message, message: null });
    });
    return () => {
      cancelled = true;
    };
  }, [setColorMode]);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <strong>Fixture gagal dimuat.</strong>
        <div>{error}</div>
      </div>
    );
  }

  return <HistoryWorkspace defaultPanel="layers" />;
}
