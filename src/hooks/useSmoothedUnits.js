import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateSmoothedBearing } from './useBearingLogic';

const ANIMATION_DURATION = 1000;

export const useSmoothedUnits = () => {
  const [smoothedUnits, setSmoothedUnits] = useState({});

  const animationStateRef = useRef({});
  const targetsRef = useRef({});
  const isKnownRef = useRef({});
  const animationFrameId = useRef(null);

  const animationLoop = useCallback(() => {
    const now = Date.now();
    const newSmoothedUnits = {};
    let needsUpdate = false;

    for (const unitId in animationStateRef.current) {
      const state = animationStateRef.current[unitId];
      const { from, to, startTime } = state;

      const elapsedTime = now - startTime;
      const progress = Math.min(elapsedTime / ANIMATION_DURATION, 1.0);

      const lat = from.latitude + (to.latitude - from.latitude) * progress;
      const lon = from.longitude + (to.longitude - from.longitude) * progress;

      const targetData = targetsRef.current[unitId] || to;

      newSmoothedUnits[unitId] = {
        ...targetData,
        latitude: lat,
        longitude: lon,
        bearing: targetData.bearing,
      };
      needsUpdate = true;

      if (progress >= 1.0) {
        delete animationStateRef.current[unitId];
      }
    }

    if (needsUpdate) {
      setSmoothedUnits(prev => ({ ...prev, ...newSmoothedUnits }));
    }

    animationFrameId.current = requestAnimationFrame(animationLoop);
  }, []);

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(animationLoop);
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [animationLoop]);

  // Stable reference — tidak capture smoothedUnits state agar tidak memicu
  // re-render loop: animationLoop → setSmoothedUnits → deps berubah → effect fire ulang.
  const updateUnitPosition = useCallback((unitData) => {
    const unitId = unitData.deviceId;
    const now = Date.now();

    const previousTarget = targetsRef.current[unitId];
    const lastValidBearing = previousTarget?.bearing || 0;
    const newBearing = calculateSmoothedBearing(previousTarget, unitData, lastValidBearing);

    const newUnitDataWithBearing = { ...unitData, bearing: newBearing };
    targetsRef.current[unitId] = newUnitDataWithBearing;

    const fromPos = previousTarget || newUnitDataWithBearing;
    animationStateRef.current[unitId] = {
      from: { latitude: fromPos.latitude, longitude: fromPos.longitude },
      to: newUnitDataWithBearing,
      startTime: now,
    };

    // Unit baru: langsung tambahkan ke state agar muncul sebelum animation loop tick berikutnya.
    if (!isKnownRef.current[unitId]) {
      isKnownRef.current[unitId] = true;
      setSmoothedUnits(prev => ({ ...prev, [unitId]: newUnitDataWithBearing }));
    }
  }, []); // stable — tidak deps pada smoothedUnits

  const updateAllTargets = useCallback((allUnits) => {
    for (const unitId in allUnits) {
      updateUnitPosition(allUnits[unitId]);
    }
  }, [updateUnitPosition]);

  return [smoothedUnits, updateUnitPosition, updateAllTargets];
};
