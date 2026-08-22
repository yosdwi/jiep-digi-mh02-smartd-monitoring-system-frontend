// src/config/mapConfig.js
import { getOrthoBaseUrl } from './apiConfig';

const resolveOrthoDistrict = (district) => district || (import.meta.env.DEV ? 'BRCB' : '');

/**
 * Menghasilkan URL API untuk mendapatkan daftar layer ortho untuk distrik tertentu.
 * @param {string} district - Kode distrik (mis., 'BRCB').
 * @returns {Promise<string>} URL API yang lengkap.
 */
export const getOrthoApiUrl = async (district) => {
  const orthoServiceBaseUrl = await getOrthoBaseUrl();
  const resolvedDistrict = resolveOrthoDistrict(district);
  if (!resolvedDistrict) {
    // Sebaiknya selalu ada distrik, tapi sebagai fallback:
    return `${orthoServiceBaseUrl}/api/ortho/layers`;
  }
  return `${orthoServiceBaseUrl}/api/ortho/layers?district=${encodeURIComponent(resolvedDistrict.toUpperCase())}`;
};

/**
 * Menghasilkan URL tile lengkap untuk layer ortho tertentu.
 * @param {string} tilePath - Path dasar tile dari respons API (mis., /tiles/{z}/{x}/{y}.png).
 * @param {string} district - Kode distrik (mis., 'BRCB').
 * @returns {Promise<string>} URL tile yang lengkap.
 */
export const getOrthoTileUrl = async (tilePath, district) => {
  const orthoServiceBaseUrl = await getOrthoBaseUrl();
  const resolvedDistrict = resolveOrthoDistrict(district);
  let url = `${orthoServiceBaseUrl}${tilePath}`;
  if (resolvedDistrict) {
    url += url.includes('?') ? '&' : '?';
    url += `district=${encodeURIComponent(resolvedDistrict.toUpperCase())}`;
  }
  return url;
};

/**
 * Menghasilkan path publik ke file KML untuk distrik tertentu.
 * @param {'boundaries' | 'roads'} type - Jenis file KML yang diinginkan.
 * @param {string} district - Kode distrik (mis., 'BRCB').
 * @param {string} [context] - Konteks atau sub-direktori opsional di dalam /kml.
 * @returns {string} Path publik ke file KML.
 */
export const getKmlPath = (type, district, context) => {
  if (!district) return '';
  
  const upperDistrict = district.toUpperCase();
  const basePath = context ? `/Monitoring/kml/${context}` : '/Monitoring/kml';

  switch (type) {
    case 'boundaries':
      return `${basePath}/BOUNDARY_${upperDistrict}.kml`;
    case 'roads':
      return `${basePath}/ROADS_${upperDistrict}.kml`;
    default:
      return '';
  }
};
