/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// POS shared types
export interface POSProductLine {
  id: string;
  name: string;
  price: number; // so'm
  qty: number;
}

export interface POSTransaction {
  id: string; // could be timestamp-based
  createdAt: string; // ISO timestamp
  lines: POSProductLine[];
  total: number; // computed total so'm
}

export type POSDevice = 'printer' | 'kitchen' | 'prep';

export interface PrintRequest {
  transaction: POSTransaction;
  copies: number; // number of checks to generate
  devices: POSDevice[]; // generic device types where to send
  deviceIds?: string[]; // optional specific device identifiers
  deviceCopies?: Record<string, number>; // optional per-device copies by device id
}

export interface PrintResponse {
  success: boolean;
  dispatchedTo: POSDevice[];
  message?: string;
}

// Device discovery
export interface DeviceInfo {
  id: string;
  name: string;
  type: POSDevice;
}

export interface DevicesResponse {
  printers: DeviceInfo[];
  others: DeviceInfo[];
}
