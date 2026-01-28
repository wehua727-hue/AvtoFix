/**
 * API utilities for web and Electron
 * Provides consistent API base URL across all environments
 */

/**
 * Get API base URL
 * - Electron with file:// protocol: http://127.0.0.1:5174
 * - Electron with HTTP (production): relative paths (same origin)
 * - Web: relative paths or VITE_API_URL if set
 */
export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  
  // Electron with file:// protocol (fallback, not used in production)
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5174';
  }
  
  // Use environment variable if set, otherwise relative paths
  return import.meta.env.VITE_API_URL || '';
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
