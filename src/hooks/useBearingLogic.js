import { useMemo } from 'react';
import { distance, bearing as turfBearing } from '@turf/turf';

const DISTANCE_THRESHOLD_METERS = 5;
const SPEED_THRESHOLD_KMH = 1;
const LOOKAHEAD_POINTS = 10; 

const normalizeBearing = (bearing) => (bearing + 360) % 360;

export const interpolateAngle = (startAngle, endAngle, t) => {
    if (startAngle === undefined || endAngle === undefined) return startAngle || 0;
    let diff = endAngle - startAngle;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const interpolated = startAngle + diff * t;
    return (interpolated + 360) % 360;
};

export const calculateSmoothedBearing = (previousPoint, currentPoint, lastValidBearing) => {
    if (!previousPoint || !currentPoint) {
        return lastValidBearing;
    }

    const dist = distance(
        [previousPoint.longitude, previousPoint.latitude],
        [currentPoint.longitude, currentPoint.latitude],
        { units: 'meters' }
    );

    const speed = currentPoint.speed || currentPoint.vehiclespeed || 0;

    if (speed < SPEED_THRESHOLD_KMH || dist < DISTANCE_THRESHOLD_METERS) {
        return lastValidBearing;
    }

    const newBearing = -turfBearing(
        [previousPoint.longitude, previousPoint.latitude],
        [currentPoint.longitude, currentPoint.latitude]
    );

    const normalizedNewBearing = normalizeBearing(newBearing);

    let diff = normalizedNewBearing - lastValidBearing;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    const smoothingFactor = 0.5;
    const smoothedBearing = lastValidBearing + diff * smoothingFactor;
    
    return normalizeBearing(smoothedBearing);
};

const calculateSmoothedBearingsForTrack = (points) => {
    if (points.length < 2) {
        return points.map(p => ({ ...p, bearing: 0 }));
    }

    const newPoints = points.map(p => ({ ...p }));
    let lastValidBearing = 0;

    // Find first valid bearing to initialize lastValidBearing
    for(let i=0; i < newPoints.length - 1; i++) {
        const p1 = newPoints[i];
        const p2 = newPoints[i+1];
        if (distance([p1.longitude, p1.latitude], [p2.longitude, p2.latitude], { units: 'meters' }) > DISTANCE_THRESHOLD_METERS) {
            lastValidBearing = normalizeBearing(-turfBearing([p1.longitude, p1.latitude], [p2.longitude, p2.latitude]));
            break;
        }
    }
    
    newPoints[0].bearing = lastValidBearing;

    for (let i = 1; i < newPoints.length; i++) {
        const previousPoint = newPoints[i-1];
        const currentPoint = newPoints[i];
        
        const newBearing = calculateSmoothedBearing(previousPoint, currentPoint, lastValidBearing);
        currentPoint.bearing = newBearing;
        lastValidBearing = newBearing;
    }
    return newPoints;
};

export const useBearingLogic = (haulerDataMap) => {
    return useMemo(() => {
        const newHaulerDataMap = {};
        for (const unitNo in haulerDataMap) {
            if (haulerDataMap.hasOwnProperty(unitNo)) {
                newHaulerDataMap[unitNo] = calculateSmoothedBearingsForTrack(haulerDataMap[unitNo]);
            }
        }
        return newHaulerDataMap;
    }, [haulerDataMap]);
};
