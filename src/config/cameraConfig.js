const CAMERA_STREAM_HOSTS = {
  BRCB: 'http://10.2.189.190:8889',
  BRCG: 'http://10.2.187.7:8889',
};

export const getCameraStreamHost = (district) => {
  if (!district) return null;
  return CAMERA_STREAM_HOSTS[district.toUpperCase()] ?? null;
};
