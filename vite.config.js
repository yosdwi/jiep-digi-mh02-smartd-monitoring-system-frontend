import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// MIR API service (project terpisah jiep-digi-mh02-mir-api-service): /api/mir, /hubs/mir,
// dan historical /Monitoring/api/MIR/*. Dev → :42071. Override via VITE_MIR_BACKEND.
// const MIR_BACKEND = process.env.VITE_MIR_BACKEND || 'http://localhost:42071'
const MIR_BACKEND = process.env.VITE_MIR_BACKEND || 'http://mir-digi-mh2-gateway.apps.pamapersada.net/'
// monitor-system (API umum non-MIR: tracking history, cctv, cycletime, dll). Dev → :42070.
const MONITOR_BACKEND = process.env.VITE_MONITOR_BACKEND || 'http://localhost:42070'
const ORTHO_BACKEND = process.env.VITE_ORTHO_BACKEND || 'http://smartd-mh02-ortho-service.apps.pamapersada.net'

// Shared between `server.proxy` (dev) and `preview.proxy` (local `vite preview`
// testing of a production build) — `vite preview` doesn't inherit `server.proxy`,
// so without this API/ortho calls just 404 when testing a prod build locally.
const proxyConfig = {
      // MIR alert API + SSE stream (lebih spesifik → harus sebelum '/api')
      '/api/mir': {
        target: MIR_BACKEND,
        changeOrigin: true,
      },
      // SignalR hub MIR (transport=signalr di prod .NET)
      '/hubs/mir': {
        target: MIR_BACKEND,
        changeOrigin: true,
        ws: true,
      },
      // Historical MIR tracking (MIRController) → service MIR baru. Lebih spesifik,
      // harus SEBELUM '/Monitoring/api/' umum.
      '/Monitoring/api/MIR': {
        target: MIR_BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/Monitoring\/api/, '/api'),
      },
      // API umum non-MIR tetap ke monitor-system.
      '/Monitoring/api/': {
        target: MONITOR_BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/Monitoring\/api/, '/api'),
      },
      '/api-ortho': {
        target: ORTHO_BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-ortho/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Suppress 404 errors from ortho tiles
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (proxyRes.statusCode === 404 && req.url.includes('/tiles/')) {
              res.statusCode = 204;
              res.end();
            }
          });
        }
      },
      // Alias kompatibilitas untuk kode/browser cache lama. Kode baru memakai /api-ortho.
      '/Monitoring/api-ortho': {
        target: ORTHO_BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/Monitoring\/api-ortho/, ''),
      },
      '/geofence-management': {
        target: 'http://smartd-mh02-geofence-management.apps.pamapersada.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/geofence-management/, ''),
      },
      // '/api': {
        // target: 'http://localhost:42070',
        // target: 'http://smartd-mh02-tracking-monitoring.apps.pamapersada.net',
        // changeOrigin: true,
        // Remove rewrite for proper API routing
        // rewrite: (path) => path.replace(/^\/api/, ''),
      // },
      '/deviceHub': {
        target: 'http://smartd-mh02-brcb-trck.apps.pamapersada.net',
        changeOrigin: true,
        ws: true,
        timeout: 30000
      },
};

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Monitoring/', // Assets need this for proper routing through Ocelot
  // Tailwind drives the V3 theme only; src/v3/foundation/theme.css imports the
  // theme and utility layers without preflight so the legacy MUI pages in this
  // same bundle keep their own resets.
  plugins: [react(), tailwindcss()],
  server: {
    hmr: true,
    watch: {
      usePolling: true
    },
    proxy: proxyConfig,
  },
  preview: {
    proxy: proxyConfig,
  },
  optimizeDeps: {
    // Pre-bundle deck.gl + editable-layers bersama supaya berbagi satu instance luma.gl
    // (mencegah error "luma.gl - multiple versions detected").
    include: [
      'maplibre-gl',
      '@deck.gl/core',
      '@deck.gl/layers',
      '@deck.gl/react',
      '@deck.gl-community/editable-layers',
      '@luma.gl/core',
    ]
  },
  resolve: {
    alias: {
      'mapbox-gl': 'maplibre-gl'
    },
    // Paksa satu salinan fisik luma.gl/deck.gl core di seluruh tree.
    dedupe: [
      '@luma.gl/core',
      '@luma.gl/engine',
      '@luma.gl/webgl',
      '@luma.gl/shadertools',
      '@luma.gl/constants',
      '@deck.gl/core',
    ]
  },
  build: {
    target: 'esnext',
    // Split the three heavy independent dependency trees out of the app bundle.
    // They change far less often than application code, so a deploy no longer
    // invalidates ~2.5MB of cached vendor JS for every user. Grouped by library
    // rather than by route because deck.gl and MUI are both used across most
    // routes — per-route splitting would duplicate them.
    rollupOptions: {
      output: {
        manualChunks: {
          deckgl: ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/geo-layers', '@deck.gl/react',
            '@deck.gl/aggregation-layers', '@deck.gl/extensions', '@deck.gl-community/editable-layers'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          arrow: ['apache-arrow'],
          maplibre: ['maplibre-gl', 'react-map-gl'],
        },
      },
    },
  }
})
