const MQTT_BROKER_URLS = {
  BRCB: 'ws://10.2.189.217:9001',
  BRCG: 'ws://10.2.187.215:9001',
};

export const MQTT_TOPIC = 'SMARTD_DEVICE_STATUS_NEW';

export const getMqttBrokerUrl = (district) => {
  if (!district) return null;
  return MQTT_BROKER_URLS[district.toUpperCase()] ?? null;
};
