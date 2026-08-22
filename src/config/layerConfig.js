// src/config/layerConfig.js

/**
 * Konfigurasi ini mendefinisikan status visibilitas layer default untuk setiap halaman peta.
 * Kunci (key) dari objek ini harus cocok dengan path dari React Router (misalnya, '/playback/underspeed').
 * 
 * Struktur untuk setiap entri:
 * {
 *   orthophoto: boolean,
 *   roads: boolean,
 *   boundaries: boolean,
 *   // ... tambahkan layer lain sesuai kebutuhan
 * }
 */

export const layerConfig = {
  '/playback/underspeed': {
    orthophoto: true,
    roads: true,
    boundaries: false,
  },
  '/playback/cycle-time': {
    orthophoto: true,
    roads: false,
    boundaries: true,
  },
  '/playback/leadtime': {
    orthophoto: true,
    roads: true,
    boundaries: true,
  },
  '/playback/rtk-quality': {
    orthophoto: true,
    roads: true,
    boundaries: true,
  },
  // Konfigurasi default untuk halaman peta generik
  'default': {
    orthophoto: true,
    roads: true,
    boundaries: true,
  }
};

/**
 * Helper function untuk mendapatkan konfigurasi layer berdasarkan path.
 * @param {string} pathname - Path dari URL saat ini (misalnya, dari `useLocation()`).
 * @returns {object} - Objek konfigurasi layer yang sesuai.
 */
export const getLayerConfigForPath = (pathname) => {
  return layerConfig[pathname] || layerConfig['default'];
};
