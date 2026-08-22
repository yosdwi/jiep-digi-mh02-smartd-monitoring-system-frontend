import React from 'react';
import styles from './ActiveFiltersDisplay.module.css';

const STATUS_MAP = {
  all: 'Semua Status',
  running: 'Bergerak',
  stop: 'Berhenti',
};

export const ActiveFiltersDisplay = ({ filters, onClearFilter }) => {
  const { unitTypes, status } = filters;

  return (
    <div className={styles.container}>
      {/* Selalu tampilkan status */}
      <span className={styles.pill}>
        {STATUS_MAP[status]}
        {status !== 'all' && <button onClick={() => onClearFilter('status', status)}>&times;</button>}
      </span>

      {/* Tampilkan tipe unit yang dipilih */}
      {unitTypes.map(type => (
        <span key={type} className={styles.pill}>
          {type}
          <button onClick={() => onClearFilter('unitType', type)}>&times;</button>
        </span>
      ))}
    </div>
  );
};
