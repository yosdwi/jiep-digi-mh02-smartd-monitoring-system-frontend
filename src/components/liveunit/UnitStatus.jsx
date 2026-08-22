import React from 'react';
import styles from './UnitStatus.module.css';

const StatusDot = ({ label, isActive }) => (
  <div className={styles.statusItem}>
    <span className={`${styles.dot} ${isActive ? styles.active : styles.inactive}`}></span>
    <span className={styles.label}>{label}</span>
  </div>
);

export const UnitStatus = ({ speed, statusGps, statusCanbus, statusCam }) => {
  const isRunning = speed > 0;
  
  return (
    <div className={styles.statusContainer}>
      <div className={styles.dotsWrapper}>
        <StatusDot label="GPS" isActive={statusGps} />
        <StatusDot label="CAN" isActive={statusCanbus} />
        <StatusDot label="CAM" isActive={statusCam} />
      </div>
      <div className={`${styles.runningBar} ${isRunning ? styles.running : styles.standby}`}>
        {isRunning ? 'RUNNING' : 'STANDBY'}
      </div>
    </div>
  );
};
