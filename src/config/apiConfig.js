// src/config/apiConfig.js

let configPromise = null;

async function fetchConfig() {
  // For production, fetch from the backend's config endpoint.
  // The backend reads this from appsettings.json
  try {
    const response = await fetch('/Monitoring/api/configuration');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const config = await response.json();
    return config;
  } catch (error) {
    console.error("Failed to fetch config from backend, falling back to dev proxy:", error);
    // Fallback for development or if the endpoint fails
    return { orthoUrl: import.meta.env.DEV ? '/api-ortho' : '/Monitoring/api-ortho' };
  }
}

function getConfig() {
  if (!configPromise) {
    configPromise = fetchConfig();
  }
  return configPromise;
}

export async function getOrthoBaseUrl() {
  // During development with Vite's dev server, import.meta.env.DEV is true.
  // We can bypass the fetch and use the proxy URL directly.
  if (import.meta.env.DEV) {
    return '/api-ortho';
  }
  
  const config = await getConfig();
  return config.orthoUrl;
}

export async function getPerformanceV2Config() {
  const config = await getConfig();
  return {
    materializerEnabled: Boolean(config.performanceV2?.materializerEnabled),
    playbackEnabled: Boolean(config.performanceV2?.playbackEnabled),
    datalogEnabled: Boolean(config.performanceV2?.datalogEnabled),
  };
}

export async function getPerformanceV3Config() {
  const config = await getConfig();
  return {
    enabled: Boolean(config.performanceV3?.enabled),
    ingestEnabled: Boolean(config.performanceV3?.ingestEnabled),
    playbackEnabled: Boolean(config.performanceV3?.playbackEnabled),
    datalogEnabled: Boolean(config.performanceV3?.datalogEnabled),
  };
}

// V3 and V2 expose the same routes under the same request/response shapes, so
// choosing a backend is choosing a base path. V3 first when enabled, then V2, then
// the original endpoint.
export async function getPlaybackApiBase() {
  const config = await getConfig();
  if (config.performanceV3?.playbackEnabled) return '/api/PlaybackV3';
  if (config.performanceV2?.playbackEnabled) return '/api/PlaybackV2';
  return null;
}

// Only for the POST search/chart/map trio. DatalogRecordV3 mirrors those three
// routes from the original /api/DatalogRecord exactly, so they are interchangeable.
// DatalogRecordV2 is deliberately NOT a candidate here: it exposes a different shape
// entirely (queries/{id}/rows, exports/{id}, ...) and swapping base paths between the
// two would 404. Callers that need V2's query or export lifecycle must address it
// directly.
export async function getDatalogSearchApiBase() {
  const config = await getConfig();
  if (config.performanceV3?.datalogEnabled) return '/api/DatalogRecordV3';
  return '/api/DatalogRecord';
}
