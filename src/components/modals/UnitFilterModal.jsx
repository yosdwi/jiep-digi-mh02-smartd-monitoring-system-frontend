import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './UnitFilterModal.module.css';
import useUserStore from '../../stores/userStore';

const DEFAULT_UNIT_TYPES = ['DT', 'EX'];

export const UnitFilterModal = ({ open, onClose, currentFilters, onApply }) => {
  const [unitTypes, setUnitTypes] = useState(new Set(currentFilters.unitTypes));
  const [status, setStatus] = useState(currentFilters.status || 'all');
  const [availableTypes, setAvailableTypes] = useState(DEFAULT_UNIT_TYPES);
  const [typesLoading, setTypesLoading] = useState(false);
  const district = useUserStore((state) => state.profile?.distrik);

  useEffect(() => {
    setUnitTypes(new Set(currentFilters.unitTypes));
    setStatus(currentFilters.status || 'all');
  }, [open, currentFilters]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchTypes = async () => {
      setTypesLoading(true);
      try {
        const res = await axios.get('/Monitoring/api/devices/unit-types', {
          params: district ? { district } : {},
        });
        if (cancelled) return;
        const fetched = res.data?.data || [];
        // Pastikan DT & EX selalu muncul walau DB belum punya entry-nya,
        // lalu tambahkan tipe lain (LD, FT, dst.) dari hasil distinct.
        const merged = Array.from(new Set([...DEFAULT_UNIT_TYPES, ...fetched]));
        setAvailableTypes(merged);
      } catch (err) {
        console.error('Failed to fetch unit types:', err);
        if (!cancelled) setAvailableTypes(DEFAULT_UNIT_TYPES);
      } finally {
        if (!cancelled) setTypesLoading(false);
      }
    };
    fetchTypes();
    return () => { cancelled = true; };
  }, [open, district]);

  if (!open) return null;

  const handleUnitTypeChange = (type) => {
    setUnitTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const handleApplyClick = () => {
    onApply({ unitTypes: Array.from(unitTypes), status });
  };

  const handleResetClick = () => {
    setUnitTypes(new Set(DEFAULT_UNIT_TYPES));
    setStatus('all');
    onApply({ unitTypes: DEFAULT_UNIT_TYPES, status: 'all' });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Filter Unit</h3>
          <button onClick={onClose} className={styles.closeButton}>&times;</button>
        </div>
        <div className={styles.content}>
          <div className={styles.filterGroup}>
            <h4>Tipe Unit {typesLoading && <small>(loading...)</small>}</h4>
            <div className={styles.checkboxGrid}>
              {availableTypes.map(type => (
                <label key={type} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={unitTypes.has(type)}
                    onChange={() => handleUnitTypeChange(type)}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <h4>Status</h4>
            <div className={styles.radioGroup}>
              <label><input type="radio" value="all" checked={status === 'all'} onChange={e => setStatus(e.target.value)} /> Semua</label>
              <label><input type="radio" value="running" checked={status === 'running'} onChange={e => setStatus(e.target.value)} /> Bergerak</label>
              <label><input type="radio" value="stop" checked={status === 'stop'} onChange={e => setStatus(e.target.value)} /> Berhenti</label>
            </div>
          </div>
          {/* Placeholder untuk filter masa depan */}
          <div className={styles.placeholder}>Filter Lokasi & Loader akan datang...</div>
        </div>
        <div className={styles.footer}>
          <button onClick={handleResetClick} className={`${styles.button} ${styles.reset}`}>Atur Ulang</button>
          <button onClick={handleApplyClick} className={`${styles.button} ${styles.apply}`}>Terapkan</button>
        </div>
      </div>
    </div>
  );
};
