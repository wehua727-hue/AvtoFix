/**
 * API utilities for web and Electron
 * Provides consistent API base URL across all environments
 */

/**
 * Get API base URL
 * - Development: VITE_API_URL (http://127.0.0.1:5175)
 * - Production (WPS): relative paths or BASE_URL
 * - Electron: http://127.0.0.1:5175
 */
export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  
  // Electron with file:// protocol
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5175';
  }
  
  // Development rejimida
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && (envUrl.includes('127.0.0.1') || envUrl.includes('localhost'))) {
    return envUrl.replace(/\/$/, '');
  }
  
  // Production rejimida (WPS hosting)
  const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
  
  // WPS hosting uchun
  if (baseUrl.includes('shop.avtofix.uz') || baseUrl.includes('wpshost') || baseUrl.includes('hosting')) {
    return baseUrl.replace(/\/$/, '');
  }
  
  // Fallback: relative paths (same origin)
  return '';
};

/**
 * API base URL constant
 * Use this for API requests
 */
export const API_BASE = getApiBaseUrl();

/**
 * Check if running in Electron
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
};

/**
 * Get Electron API if available
 */
export const getElectronAPI = () => {
  if (isElectron()) {
    return (window as any).electronAPI;
  }
  return null;
};
