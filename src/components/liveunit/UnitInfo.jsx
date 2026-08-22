import React from 'react';
import styles from './UnitInfo.module.css';

const getStatusText = (status) => {
  const statusMap = {
    0: 'ACC ON',
    1: 'Standby',
    2: 'Running - Kosongan',
    3: 'Loading',
    4: 'Running - Muatan',
    5: 'Stop -  Muatan',
    6: 'Dumping'
  };
  return statusMap[status] || 'Unknown';
};

const formatLastUpdate = (timestamp) => {
  if (!timestamp) return 'No data';
  const now = new Date();
  const updateTime = new Date(timestamp);
  const diffMs = now - updateTime;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return updateTime.toLocaleDateString();
};

export const UnitInfo = ({ unitNo, operatorName, plmStatus, timestamp, onClose }) => {
  const isOnline = timestamp && (Date.now() - new Date(timestamp).getTime()) < 5 * 60 * 1000;

  return (
    <div className={styles.infoContainer}>
      <div className={styles.titleWrapper}>
        <div className={styles.unitHeader}>
          <h2 className={styles.unitModel}>{unitNo}</h2>
          {plmStatus !== undefined && plmStatus !== -9999 && (
            <span className={styles.statusBadge}>
              {getStatusText(plmStatus)}
            </span>
          )}
          <span className={`${styles.onlineStatus} ${isOnline ? styles.online : styles.offline}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className={styles.details}>{operatorName}</p>
        <p className={styles.lastUpdate}>Last update: {formatLastUpdate(timestamp)}</p>
      </div>
      <button onClick={onClose} className={styles.closeButton}>&times;</button>
    </div>
  );
};
