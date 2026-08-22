import { useMemo } from 'react';
import { ScatterplotLayer, TextLayer, IconLayer } from '@deck.gl/layers';

export const DEFAULT_UNIT_TYPE_MAP = {
  DT: { icon: 'dumptruck', color: [243, 156, 18] },
  EX: { icon: 'excavator', color: [52, 152, 219] },
};

export const STATUS_COLOR_MAP = {
  moving: [46, 204, 113],
  idle: [243, 156, 18],
  down: [231, 76, 60],
  offline: [150, 150, 150],
  default: [200, 200, 200]
};

export const MINING_ICON_MAPPING = {
  'dumptruck': { x: 0, y: 0, width: 128, height: 128, mask: false },
  'excavator': { x: 128, y: 0, width: 128, height: 128, mask: false },
  'dot': { x: 256, y: 0, width: 32, height: 32, mask: false },
};

export const LOD_CONFIG = {
  ZOOM_THRESHOLD: 14,
  DOT_SIZE: 8,
  ICON_SIZE: 30,
  LABEL_SIZE: 11,
};

export const calculateHeading = (currentPos, previousPos) => {
  if (!currentPos || !previousPos) return 0;

  const [currentLng, currentLat] = currentPos;
  const [prevLng, prevLat] = previousPos;

  const deltaLng = currentLng - prevLng;
  const deltaLat = currentLat - prevLat;

  if (deltaLng === 0 && deltaLat === 0) return 0;

  let heading = Math.atan2(deltaLng, deltaLat) * 180 / Math.PI;

  if (heading < 0) heading += 360;

  return Math.round(heading);
};

export const enhanceDataWithHeading = (currentData, previousData, unitIdField = 'deviceId') => {
  if (!previousData || previousData.length === 0) return currentData;

  const prevDataMap = new Map();
  previousData.forEach(unit => {
    const id = unit[unitIdField];
    if (id) prevDataMap.set(id, unit);
  });

  return currentData.map(unit => {
    const unitId = unit[unitIdField];
    const prevUnit = prevDataMap.get(unitId);

    if (prevUnit && unit.longitude && unit.latitude && prevUnit.longitude && prevUnit.latitude) {
      const heading = calculateHeading(
        [unit.longitude, unit.latitude],
        [prevUnit.longitude, prevUnit.latitude]
      );
      return { ...unit, calculatedHeading: heading };
    }

    return { ...unit, calculatedHeading: unit.heading || 0 };
  });
};

export const DEFAULT_ICON_STYLES = {
  radius: 7,
  radiusMinPixels: 4,
  radiusMaxPixels: 10,
  outlineWidth: 1,
  outlineColor: [255, 255, 255, 180],
};

export const DEFAULT_LABEL_STYLES = {
  fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 700,
  textColor: [255, 255, 255, 255],
  textOutlineWidth: 6,
  textOutlineColor: [0, 0, 0, 200],
  pixelOffset: [0, 18],
  fontSettings: { sdf: true },
};

export const useIconMarkerLayers = ({
  data = [],
  id,
  getPosition,
  getText,
  getColor,
  getDeviceType,
  onClick,
  iconStyles = {},
  labelStyles = {},
  unitTypeMap = DEFAULT_UNIT_TYPE_MAP,
  pickable = true,
  visible = true,
  opacity = 1.0,
}) => {

  const iconLayer = useMemo(() => {
    if (!data || data.length === 0) return null;

    const mergedIconStyles = { ...DEFAULT_ICON_STYLES, ...iconStyles };

    return new ScatterplotLayer({
      id: `${id}-icon`,
      data,
      pickable,
      visible,
      opacity,
      getPosition,
      getFillColor: getColor || ((d) => {
        const deviceType = getDeviceType?.(d);
        return unitTypeMap[deviceType]?.color || [200, 200, 200];
      }),
      getRadius: mergedIconStyles.radius,
      radiusMinPixels: mergedIconStyles.radiusMinPixels,
      radiusMaxPixels: mergedIconStyles.radiusMaxPixels,
      stroked: Boolean(mergedIconStyles.outlineWidth),
      getLineColor: mergedIconStyles.outlineColor,
      getLineWidth: mergedIconStyles.outlineWidth,
      onClick,
      updateTriggers: {
        getFillColor: [getColor, getDeviceType, unitTypeMap],
        getPosition: getPosition,
      }
    });
  }, [
    data, id, pickable, visible, opacity, getPosition, getColor,
    getDeviceType, unitTypeMap, onClick, iconStyles
  ]);

  const labelLayer = useMemo(() => {
    if (!data || data.length === 0) return null;

    const mergedLabelStyles = { ...DEFAULT_LABEL_STYLES, ...labelStyles };

    return new TextLayer({
      id: `${id}-label`,
      data,
      pickable,
      visible,
      opacity,
      getPosition,
      getText,
      getSize: mergedLabelStyles.fontSize,
      getColor: mergedLabelStyles.textColor,
      getPixelOffset: mergedLabelStyles.pixelOffset,
      fontFamily: mergedLabelStyles.fontFamily,
      fontWeight: mergedLabelStyles.fontWeight,
      outlineWidth: mergedLabelStyles.textOutlineWidth,
      outlineColor: mergedLabelStyles.textOutlineColor,
      fontSettings: mergedLabelStyles.fontSettings,
      onClick,
      updateTriggers: {
        getText: getText,
        getPosition: getPosition,
      }
    });
  }, [
    data, id, pickable, visible, opacity, getPosition, getText,
    onClick, labelStyles
  ]);

  return useMemo(() => [iconLayer, labelLayer].filter(Boolean), [iconLayer, labelLayer]);
};

// `positionVersion`: opt-in escape hatch for callers that keep ONE stable `data`
// array and mutate the objects inside it in place every frame (playback replay
// does this). deck.gl treats a changed `data` reference as a full invalidation
// and regenerates every attribute — including TextLayer's per-glyph layout —
// so handing it a fresh array 60x/second is the expensive way to move a marker.
// With a stable array, deck.gl needs an explicit trigger to know positions
// moved; bumping this number is that trigger. Callers that pass a fresh array
// each time (the default, every other call site) leave it undefined and keep
// the old data-identity-driven behaviour unchanged.
export const useEnhancedIconMarkerLayers = ({
  data = [],
  id,
  zoom = 12,
  getPosition,
  getText,
  getDeviceType,
  getStatus,
  getHeading,
  onClick,
  positionVersion,
  iconAtlasUrl = '/Monitoring/icons/mining-atlas.png',
  iconMapping = MINING_ICON_MAPPING,
  unitTypeMap = DEFAULT_UNIT_TYPE_MAP,
  statusColorMap = STATUS_COLOR_MAP,
  lodConfig = LOD_CONFIG,
  pickable = true,
  visible = true,
}) => {

  const isHighZoom = zoom >= lodConfig.ZOOM_THRESHOLD;

  const dotLayer = useMemo(() => {
    if (isHighZoom || !data?.length) return null;

    return new ScatterplotLayer({
      id: `${id}-dots`,
      data,
      pickable,
      visible,
      getPosition,
      getFillColor: d => {
        const status = getStatus?.(d) || 'default';
        return statusColorMap[status] || statusColorMap.default;
      },
      getRadius: lodConfig.DOT_SIZE,
      radiusMinPixels: lodConfig.DOT_SIZE,
      radiusMaxPixels: lodConfig.DOT_SIZE + 2,
      onClick,
      updateTriggers: {
        getPosition: positionVersion,
        getFillColor: [getStatus, statusColorMap],
      }
    });
  }, [data, id, isHighZoom, pickable, visible, getPosition, getStatus, onClick, statusColorMap, lodConfig, positionVersion]);

  const iconLayer = useMemo(() => {
    if (!isHighZoom || !data?.length) return null;

    return new IconLayer({
      id: `${id}-icons`,
      data,
      pickable,
      visible,
      iconAtlas: iconAtlasUrl,
      iconMapping,
      getPosition,
      getIcon: d => {
        const deviceType = getDeviceType?.(d);
        return unitTypeMap[deviceType]?.icon || 'dot';
      },
      getSize: lodConfig.ICON_SIZE,
      getAngle: getHeading || (() => 0),
      getColor: d => {
        const status = getStatus?.(d) || 'default';
        return statusColorMap[status] || statusColorMap.default;
      },
      sizeScale: 1,
      sizeMinPixels: lodConfig.ICON_SIZE,
      onClick,
      updateTriggers: {
        getPosition: positionVersion,
        getIcon: [getDeviceType, unitTypeMap],
        getColor: [getStatus, statusColorMap],
        getAngle: [getHeading, positionVersion],
      }
    });
  }, [
    data, id, isHighZoom, pickable, visible, iconAtlasUrl, iconMapping,
    getPosition, getDeviceType, getHeading, getStatus, onClick,
    unitTypeMap, statusColorMap, lodConfig, positionVersion
  ]);

  const labelLayer = useMemo(() => {
    if (!isHighZoom || !data?.length) return null;

    return new TextLayer({
      id: `${id}-labels`,
      data,
      pickable,
      visible,
      getPosition,
      getText,
      getSize: lodConfig.LABEL_SIZE,
      getColor: d => {
        const status = getStatus?.(d) || 'default';
        return status === 'moving' ? [46, 204, 113, 255] :
               status === 'idle' ? [243, 156, 18, 255] :
               status === 'down' ? [255, 255, 255, 255] : [255, 255, 255, 255];
      },
      getPixelOffset: [0, lodConfig.ICON_SIZE / 2 + 10],
      fontFamily: 'Inter, sans-serif',
      fontWeight: 700,
      // No outlineWidth/outlineColor: deck.gl only renders text outlines from an
      // SDF font atlas, and this layer uses a bitmap one (sdf: false), so those
      // props did nothing except log a warning per layer per rebuild. The label's
      // readability comes from `background` + `getBorderColor` below.
      fontSettings: { sdf: false },
      background: true,
      getBackgroundColor: d => {
        const status = getStatus?.(d) || 'default';
        return status === 'down' ? [231, 76, 60, 230] : [0, 0, 0, 230];
      },
      backgroundPadding: [6, 2],
      getBorderRadius: 8,
      getBorderColor: d => {
        const status = getStatus?.(d) || 'default';
        return status === 'moving' ? [46, 204, 113, 255] :
               status === 'idle' ? [243, 156, 18, 255] :
               status === 'down' ? [231, 76, 60, 255] : [255, 255, 255, 80];
      },
      getBorderWidth: 1,
      onClick,
      updateTriggers: {
        // Deliberately NOT keyed on positionVersion: re-running getText makes
        // TextLayer re-tessellate every label's glyphs, and the label text does
        // not change when a marker merely moves.
        getPosition: positionVersion,
        getText: getText,
        getColor: [getStatus, statusColorMap],
        getBackgroundColor: [getStatus, statusColorMap],
        getBorderColor: [getStatus, statusColorMap],
      }
    });
  }, [
    data, id, isHighZoom, pickable, visible, getPosition,
    getText, onClick, lodConfig, getStatus, statusColorMap, positionVersion
  ]);

  return useMemo(() =>
    [dotLayer, iconLayer, labelLayer].filter(Boolean),
    [dotLayer, iconLayer, labelLayer]
  );
};

export const useClusterMarkerLayer = ({
  data = [],
  id,
  getPosition,
  getText,
  onClick,
  styles = {},
  pickable = true,
  visible = true,
}) => {

  const defaultClusterStyles = {
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    textColor: [255, 255, 255, 255],
    backgroundColor: [30, 64, 175, 240],
    backgroundPadding: [12, 8],
    borderRadius: 16,
  };

  return useMemo(() => {
    if (!data || data.length === 0) return null;

    const mergedStyles = { ...defaultClusterStyles, ...styles };

    return new TextLayer({
      id,
      data,
      pickable,
      visible,
      getPosition,
      getText,
      getSize: mergedStyles.fontSize,
      getColor: mergedStyles.textColor,
      getBackgroundColor: mergedStyles.backgroundColor,
      background: true,
      backgroundPadding: mergedStyles.backgroundPadding,
      getBorderRadius: mergedStyles.borderRadius,
      fontFamily: mergedStyles.fontFamily,
      fontWeight: mergedStyles.fontWeight,
      onClick,
      updateTriggers: {
        getText: getText,
        getPosition: getPosition,
      }
    });
  }, [data, id, pickable, visible, getPosition, getText, onClick, styles]);
};

export const createMarkerConfig = ({
  data,
  id,
  unitNoField = 'unitNo',
  deviceTypeField = 'deviceType',
  positionFields = { longitude: 'longitude', latitude: 'latitude' },
  customGetPosition,
  customGetText,
  customGetColor,
  onClick,
  ...restConfig
}) => ({
  data,
  id,
  getPosition: customGetPosition || ((d) => [
    d[positionFields.longitude],
    d[positionFields.latitude]
  ]),
  getText: customGetText || ((d) => d[unitNoField]),
  getDeviceType: (d) => d[deviceTypeField],
  getColor: customGetColor,
  onClick,
  ...restConfig
});

export const createEnhancedMarkerConfig = ({
  data,
  id,
  zoom,
  unitNoField = 'unitNo',
  deviceTypeField = 'deviceType',
  statusField = 'status',
  headingField = 'heading',
  positionFields = { longitude: 'longitude', latitude: 'latitude' },
  customGetPosition,
  customGetText,
  customGetDeviceType,
  customGetStatus,
  customGetHeading,
  onClick,
  ...restConfig
}) => ({
  data,
  id,
  zoom,
  getPosition: customGetPosition || ((d) => [
    d[positionFields.longitude],
    d[positionFields.latitude]
  ]),
  getText: customGetText || ((d) => d[unitNoField]?.toString().split('-')[1] || d[unitNoField]),
  getDeviceType: customGetDeviceType || ((d) => d[deviceTypeField]),
  getStatus: customGetStatus || ((d) => d[statusField] || 'default'),
  getHeading: customGetHeading || ((d) => d.calculatedHeading || d[headingField] || 0),
  onClick,
  ...restConfig
});