export function installRuntimeConfig() {
  globalThis.__AW_RUNTIME_CONFIG__ = {
    rawBaseUrl: import.meta.env.VITE_AW_RAW_BASE_URL ||
      "https://raw.githubusercontent.com/yosdwi/jiep-digi-mh02-smartd-monitoring-system-frontend/main",
    apiBaseUrl: import.meta.env.VITE_AW_API_BASE_URL || "/Monitoring/api",
  };
}
