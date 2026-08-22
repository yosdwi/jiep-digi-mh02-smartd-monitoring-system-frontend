import React, { useState } from 'react';
import styles from './UnitCamera.module.css';
import useUserStore from '../../stores/userStore';
import { getCameraStreamHost } from '../../config/cameraConfig';

export const UnitCamera = ({ unitno, deviceip }) => {
  const [view, setView] = useState('FRONT'); // 'FRONT' or 'CABIN'
  const district = useUserStore((state) => state.profile?.distrik);
  const streamHost = getCameraStreamHost(district);

  if (!unitno || !deviceip || !streamHost) {
    return (
      <div className={styles.cameraContainer}>
        <div className={styles.streamPlaceholder}>
          <span>
            {!streamHost
              ? `Camera stream tidak dikonfigurasi untuk distrik: ${district || '(empty)'}`
              : 'Data unit tidak lengkap untuk menampilkan stream.'}
          </span>
        </div>
      </div>
    );
  }

  const streamUrl = `${streamHost}/${unitno}_${view}`;

  return (
    <div className={styles.cameraContainer}>
      <div className={styles.streamPlaceholder}>
        <iframe
          src={streamUrl}
          title={`Live Stream - ${unitno} ${view}`}
          width="100%"
          height="100%"
          style={{ border: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
      </div>
      <div className={styles.buttonGroup}>
        <button 
          className={`${styles.camButton} ${view === 'CABIN' ? styles.active : ''}`}
          onClick={() => setView('CABIN')}
        >
          CABIN
        </button>
        <button 
          className={`${styles.camButton} ${view === 'FRONT' ? styles.active : ''}`}
          onClick={() => setView('FRONT')}
        >
          FRONT
        </button>
      </div>
    </div>
  );
};
