import React from 'react';
import styles from './LiveUnitCard.module.css';
import { UnitInfo } from './UnitInfo';
import { UnitMetrics } from './UnitMetrics';
import { UnitStatus } from './UnitStatus';
import { UnitCamera } from './UnitCamera';

export const LiveUnitCard = ({ unitData, onClose, mirData }) => {
  if (!unitData) return null;

  // Membuat objek data tampilan yang menggabungkan data asli dengan data dari JSON
  const displayData = {
    // Data asli dari WebSocket
    unitNo: unitData.unitNo,
    speed: unitData.lastSpeed !== undefined ? unitData.lastSpeed.toFixed(1) : 0,

    // Data dari getrealtimedata.json
    hourMeter: unitData.HM !== undefined ? Math.round(unitData.HM) : (unitData.lastHm !== undefined ? Math.round(unitData.lastHm) : 0),
    operatorName: unitData.nrp || 'Unknown',
    fuelRate: '-',
    payload: unitData.act_tonnage !== undefined && unitData.act_tonnage !== -9999 ? unitData.act_tonnage : 0,
    plmStatus: unitData.plm_status, 
    statusGps: unitData.gpslat !== undefined && unitData.gpslong !== undefined,
    statusCanbus: unitData.canbusstatus === 'ON',
    statusCam: unitData.frontstatus === 'ON' || unitData.cabinstatus === 'ON',
  };

  return (
    <div className={styles.cardOverlay}>
      <div className={styles.card}>
        <UnitInfo
          unitNo={displayData.unitNo}
          operatorName={displayData.operatorName}
          plmStatus={displayData.plmStatus}
          timestamp={unitData.timestamp}
          onClose={onClose}
        />
        <UnitMetrics 
          speed={displayData.speed}
          hourMeter={displayData.hourMeter}
          fuelRate={displayData.fuelRate}
          payload={displayData.payload}
          mirData={mirData} // <-- Teruskan prop mirData
        />
        <UnitStatus 
          speed={displayData.speed}
          statusGps={displayData.statusGps}
          statusCanbus={displayData.statusCanbus}
          statusCam={displayData.statusCam}
        />
        <UnitCamera unitno={unitData.unitNo} deviceip={unitData.deviceip} />
      </div>
    </div>
  );
};
