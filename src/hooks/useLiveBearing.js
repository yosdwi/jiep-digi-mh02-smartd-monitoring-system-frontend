import { useState, useRef, useCallback } from 'react';
import { calculateSmoothedBearing } from './useBearingLogic';

export const useLiveBearing = () => {
    const [units, setUnits] = useState({});
    const previousPointsRef = useRef({});

    const updateUnitPosition = useCallback((newPoint) => {
        setUnits(prevUnits => {
            const deviceId = newPoint.deviceId;
            const previousPoint = previousPointsRef.current[deviceId];
            const lastValidBearing = previousPoint?.bearing || 0;

            const newBearing = calculateSmoothedBearing(previousPoint, newPoint, lastValidBearing);
            
            const updatedUnit = {
                ...prevUnits[deviceId],
                ...newPoint,
                bearing: newBearing,
            };

            previousPointsRef.current[deviceId] = updatedUnit;

            return {
                ...prevUnits,
                [deviceId]: updatedUnit
            };
        });
    }, []);

    return [units, updateUnitPosition];
};
