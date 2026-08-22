/**
 * Trail Tooltip Utility for Deck.GL PathLayer
 * Professional tooltip for trail interaction with unit data
 */

export const createTrailTooltip = (hauler, timestamp, speed) => {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const dateStr = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });

  return {
    html: `
      <div style="
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: #ffffff;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        min-width: 180px;
        backdrop-filter: blur(8px);
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        ">
          <div style="
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
          "></div>
          <span style="
            font-weight: 600;
            font-size: 14px;
            color: #10b981;
          ">${hauler}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8; font-size: 12px;">Date:</span>
            <span style="font-weight: 500; font-size: 12px;">${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8; font-size: 12px;">Time:</span>
            <span style="font-weight: 500; font-size: 12px;">${time}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8; font-size: 12px;">Speed:</span>
            <span style="
              font-weight: 600;
              font-size: 12px;
              color: ${speed > 0 ? '#10b981' : '#f59e0b'};
            ">${speed} kph</span>
          </div>
        </div>
      </div>
    `,
    style: {
      zIndex: 9999,
      pointerEvents: 'none'
    }
  };
};

export const findClosestTrailPoint = (coordinate, pointsData) => {
  if (!coordinate || !pointsData || pointsData.length === 0) return null;

  return pointsData.reduce((best, point) => {
    const dist = Math.abs(coordinate[0] - point.longitude) +
                Math.abs(coordinate[1] - point.latitude);
    return dist < best.distance ? { point, distance: dist } : best;
  }, { distance: Infinity, point: null });
};

export const handleTrailClick = (info, onHaulerSelect) => {
  if (!info.object?.hauler) return null;

  // Find closest data point based on click coordinate
  if (info.coordinate && info.object.pointsData) {
    const closest = findClosestTrailPoint(info.coordinate, info.object.pointsData);

    if (closest?.point) {
      const speed = closest.point.speed || closest.point.vehiclespeed || 0;

      const time = new Date(closest.point.timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // Show simple alert for now (can be enhanced later)
      console.log(`Trail clicked: ${info.object.hauler} ${time} ${speed} kph`);

      // Select hauler
      if (onHaulerSelect) {
        onHaulerSelect(info.object.hauler);
      }

      // Return tooltip data for getTooltip method
      return createTrailTooltip(
        info.object.hauler,
        closest.point.timestamp,
        speed
      );
    }
  }

  // Fallback: just select hauler
  if (onHaulerSelect) {
    onHaulerSelect(info.object.hauler);
  }

  return null;
};