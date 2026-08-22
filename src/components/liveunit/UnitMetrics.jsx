import React from 'react';
import styles from './UnitMetrics.module.css';

// Komponen Card kecil untuk setiap metrik
const MetricCard = ({ label, value, unit, highlight = false }) => (
  <div className={`${styles.metricCard} ${highlight ? styles.highlight : ''}`}>
    <span className={styles.label}>{label}</span>
    <div className={styles.valueContainer}>
      <span className={styles.value}>{value}</span>
      <span className={styles.unit}>{unit}</span>
    </div>
  </div>
);

export const UnitMetrics = ({ speed, hourMeter, fuelRate, payload, mirData }) => {
  return (
    <div className={styles.metricsGrid}>
      <MetricCard label="SPEED" value={speed} unit="km/h" />
      <MetricCard label="HOUR METER" value={hourMeter} unit="h" />
      
      {/* Selalu tampilkan card ini jika prop mirData ada */}
      {mirData && (
        <>
          <MetricCard 
            label="DISPOSAL AREA" 
            value={mirData.inDisposalArea || '-'} 
            unit=""
            highlight={!!mirData.inDisposalArea} 
          />
          <MetricCard 
            label="JARAK KE GARIS" 
            value={mirData.distanceToLine || '-'} 
            unit={mirData.distanceToLine ? 'm' : ''}
            highlight={!!mirData.distanceToLine} 
          />
        </>
      )}

      <MetricCard label="FUEL RATE" value={fuelRate} unit="L/h" />
      <MetricCard label="PAYLOAD" value={payload} unit="Ton" />
    </div>
  );
};
