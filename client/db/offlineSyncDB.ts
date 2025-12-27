/**
 * OFFLINE SYNC DATABASE - Production-Ready Queue System
 * 
 * Features:
 * - Idempotent sync with offlineId
 * - Per-item acknowledgements
 * - Conflict resolution
 * - Exponential backoff with jitter
 * - Sync logs for observability
 */

import Dexie, { Table } from 'dexie';

// ============================================
// TYPES & INTERFACES
// ============================================

export type SaleStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed';

export interface SaleItem {
  productId: string;
  productName: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Payment {
  method: PaymentMethod;
  amount: number;
}

export interface SaleTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface SaleMeta {
  operatorId: string;
  operatorName?: string;
  shiftId?: string;
  notes?: string;
}

export interface OfflineSaleV2 {
  // Idempotency & identification
  offlineId: string;           // UUID v4 - idempotency token
  clientId: string;            // Terminal ID
  clientSeq: number;           // Monotonic int per terminal
  receiptNumber: string;       // YYYYMMDD-HHMMSS-RAND4
  
  // Sale data
  items: SaleItem[];
  payments: Payment[];
  totals: SaleTotals;
  meta: SaleMeta;
  saleType: 'sale' | 'refund';
  
  // Timestamps
  createdAt: number;           // Client timestamp (ms)
  updatedAt: number;
  
  // Sync status
  status: SaleStatus;
  retries: number;
  lastRetryAt?: number;
  nextRetryAt?: number;
  
  // Server response
  serverId?: string;           // MongoDB _id
  syncedAt?: number;
  
  // Error handling
  errorCode?: string;
  errorMessage?: string;
  conflictDetails?: ConflictDetail[];
  
  // Optional signature for integrity
  signature?: string;
}

export interface ConflictDetail {
  productId: string;
  productName: string;
  requestedQty: number;
  availableStock: number;
  reason: string;
}

export interface SyncLog {
  id: string;
  timestamp: number;
  type: 'info' | 'warning' | 'error' | 'success';
  action: string;
  batchId?: string;
  offlineId?: string;
  message: string;
  details?: any;
}

export interface SyncState {
  id: string;
  key: string;
  value: string | number | boolean;
  updatedAt: number;
}

export interface ClientSequence {
  clientId: string;
  lastSeq: number;
  updatedAt: number;
}

// ============================================
// BATCH REQUEST/RESPONSE TYPES
// ============================================

export interface BatchSyncRequest {
  clientId: string;
  batchId: string;
  items: OfflineSaleV2[];
}

export interface BatchItemResult {
  offlineId: string;
  status: 'ok' | 'conflict' | 'failed';
  serverId?: string;
  syncedAt?: number;
  error?: string;
  details?: ConflictDetail[];
}

export interface BatchSyncResponse {
  batchId: string;
  results: BatchItemResult[];
  overallStatus: 'success' | 'partial' | 'failed';
  processedAt: number;
}

// ============================================
// DEXIE DATABASE CLASS
// ============================================

export class OfflineSyncDB extends Dexie {
  sales!: Table<OfflineSaleV2>;
  syncLogs!: Table<SyncLog>;
  syncState!: Table<SyncState>;
  clientSequences!: Table<ClientSequence>;

  constructor() {
    super('OfflineSyncDB');

    this.version(1).stores({
      // Sales with comprehensive indices
      sales: 'offlineId, clientId, clientSeq, receiptNumber, status, createdAt, [clientId+clientSeq], [status+createdAt]',
      
      // Sync logs for observability
      syncLogs: 'id, timestamp, type, batchId, offlineId',
      
      // Sync state (locks, last sync, etc.)
      syncState: 'id, key',
      
      // Client sequence tracking
      clientSequences: 'clientId'
    });
  }
}

// Singleton instance
export const syncDB = new OfflineSyncDB();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate UUID v4
 */
export function generateUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate receipt number: YYYYMMDD-HHMMSS-RAND4
 */
export function generateReceiptNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${date}-${time}-${rand}`;
}

/**
 * Get next client sequence number
 */
export async function getNextClientSeq(clientId: string): Promise<number> {
  const existing = await syncDB.clientSequences.get(clientId);
  const nextSeq = (existing?.lastSeq ?? 0) + 1;
  
  await syncDB.clientSequences.put({
    clientId,
    lastSeq: nextSeq,
    updatedAt: Date.now()
  });
  
  return nextSeq;
}

/**
 * Calculate exponential backoff with jitter
 */
export function calculateBackoff(retries: number): number {
  const BASE_DELAY = 2000;      // 2 seconds
  const MULTIPLIER = 2;
  const MAX_DELAY = 3600000;    // 1 hour
  const JITTER_FACTOR = 0.3;
  
  const exponentialDelay = Math.min(
    BASE_DELAY * Math.pow(MULTIPLIER, retries),
    MAX_DELAY
  );
  
  // Add jitter: ±30%
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
  
  return Math.floor(exponentialDelay + jitter);
}

// ============================================
// SALE OPERATIONS
// ============================================

/**
 * Create new offline sale
 */
export async function createOfflineSale(
  clientId: string,
  items: SaleItem[],
  payments: Payment[],
  meta: SaleMeta,
  saleType: 'sale' | 'refund' = 'sale'
): Promise<OfflineSaleV2> {
  const now = Date.now();
  const clientSeq = await getNextClientSeq(clientId);
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);
  
  const sale: OfflineSaleV2 = {
    offlineId: generateUUIDv4(),
    clientId,
    clientSeq,
    receiptNumber: generateReceiptNumber(),
    items,
    payments,
    totals: {
      subtotal,
      discount: totalDiscount,
      tax: 0,
      total: subtotal - totalDiscount
    },
    meta,
    saleType,
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    retries: 0
  };
  
  await syncDB.sales.put(sale);
  await addSyncLog('info', 'sale_created', `Sale created: ${sale.receiptNumber}`, { offlineId: sale.offlineId });
  
  return sale;
}

/**
 * Get pending sales for sync (ordered by createdAt)
 */
export async function getPendingSales(limit: number = 10): Promise<OfflineSaleV2[]> {
  return await syncDB.sales
    .where('status')
    .equals('pending')
    .sortBy('createdAt')
    .then(sales => sales.slice(0, limit));
}

/**
 * Get sales ready for retry
 */
export async function getRetryableSales(limit: number = 10): Promise<OfflineSaleV2[]> {
  const now = Date.now();
  
  const sales = await syncDB.sales
    .where('status')
    .equals('pending')
    .filter(sale => {
      if (!sale.nextRetryAt) return true;
      return sale.nextRetryAt <= now;
    })
    .sortBy('createdAt');
  
  return sales.slice(0, limit);
}

/**
 * Mark sales as syncing
 */
export async function markSalesAsSyncing(offlineIds: string[]): Promise<void> {
  const now = Date.now();
  
  await syncDB.sales
    .where('offlineId')
    .anyOf(offlineIds)
    .modify({ status: 'syncing', updatedAt: now });
}

/**
 * Process sync result for a single sale
 */
export async function processSyncResult(result: BatchItemResult): Promise<void> {
  const now = Date.now();
  const sale = await syncDB.sales.get(result.offlineId);
  
  if (!sale) {
    console.warn(`[SyncDB] Sale not found: ${result.offlineId}`);
    return;
  }
  
  if (result.status === 'ok') {
    await syncDB.sales.update(result.offlineId, {
      status: 'synced',
      serverId: result.serverId,
      syncedAt: result.syncedAt || now,
      updatedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
      conflictDetails: undefined
    });
    
    await addSyncLog('success', 'sale_synced', `Sale synced: ${sale.receiptNumber}`, {
      offlineId: result.offlineId,
      serverId: result.serverId
    });
    
  } else if (result.status === 'conflict') {
    await syncDB.sales.update(result.offlineId, {
      status: 'conflict',
      updatedAt: now,
      errorCode: 'STOCK_CONFLICT',
      errorMessage: result.error || 'Insufficient stock',
      conflictDetails: result.details
    });
    
    await addSyncLog('warning', 'sale_conflict', `Sale conflict: ${sale.receiptNumber}`, {
      offlineId: result.offlineId,
      details: result.details
    });
    
  } else {
    // Failed - schedule retry
    const newRetries = sale.retries + 1;
    const MAX_RETRIES = 10;
    
    if (newRetries >= MAX_RETRIES) {
      await syncDB.sales.update(result.offlineId, {
        status: 'failed',
        retries: newRetries,
        updatedAt: now,
        errorCode: 'MAX_RETRIES',
        errorMessage: result.error || 'Max retries exceeded'
      });
      
      await addSyncLog('error', 'sale_failed', `Sale failed after ${MAX_RETRIES} retries: ${sale.receiptNumber}`, {
        offlineId: result.offlineId,
        error: result.error
      });
    } else {
      const backoff = calculateBackoff(newRetries);
      
      await syncDB.sales.update(result.offlineId, {
        status: 'pending',
        retries: newRetries,
        lastRetryAt: now,
        nextRetryAt: now + backoff,
        updatedAt: now,
        errorMessage: result.error
      });
      
      await addSyncLog('info', 'sale_retry_scheduled', `Retry scheduled in ${Math.round(backoff / 1000)}s: ${sale.receiptNumber}`, {
        offlineId: result.offlineId,
        retries: newRetries,
        nextRetryAt: now + backoff
      });
    }
  }
}

/**
 * Reset sale to pending (for manual retry)
 */
export async function resetSaleToPending(offlineId: string): Promise<void> {
  await syncDB.sales.update(offlineId, {
    status: 'pending',
    retries: 0,
    nextRetryAt: undefined,
    errorCode: undefined,
    errorMessage: undefined,
    conflictDetails: undefined,
    updatedAt: Date.now()
  });
  
  await addSyncLog('info', 'sale_reset', `Sale reset to pending: ${offlineId}`);
}

/**
 * Delete synced sales (cleanup)
 */
export async function deleteSyncedSales(olderThanDays: number = 7): Promise<number> {
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  
  const toDelete = await syncDB.sales
    .where('status')
    .equals('synced')
    .filter(sale => sale.syncedAt && sale.syncedAt < cutoff)
    .toArray();
  
  await syncDB.sales.bulkDelete(toDelete.map(s => s.offlineId));
  
  return toDelete.length;
}

// ============================================
// SYNC STATE OPERATIONS
// ============================================

/**
 * Check if sync is locked
 */
export async function isSyncLocked(): Promise<boolean> {
  const lock = await syncDB.syncState.get('syncLock');
  if (!lock) return false;
  
  // Auto-unlock after 5 minutes (safety)
  const lockTime = Number(lock.value);
  if (Date.now() - lockTime > 5 * 60 * 1000) {
    await syncDB.syncState.delete('syncLock');
    return false;
  }
  
  return true;
}

/**
 * Acquire sync lock
 */
export async function acquireSyncLock(): Promise<boolean> {
  if (await isSyncLocked()) return false;
  
  await syncDB.syncState.put({
    id: 'syncLock',
    key: 'syncLock',
    value: Date.now(),
    updatedAt: Date.now()
  });
  
  return true;
}

/**
 * Release sync lock
 */
export async function releaseSyncLock(): Promise<void> {
  await syncDB.syncState.delete('syncLock');
}

// ============================================
// SYNC LOG OPERATIONS
// ============================================

/**
 * Add sync log entry
 */
export async function addSyncLog(
  type: SyncLog['type'],
  action: string,
  message: string,
  details?: any
): Promise<void> {
  const log: SyncLog = {
    id: generateUUIDv4(),
    timestamp: Date.now(),
    type,
    action,
    message,
    details,
    batchId: details?.batchId,
    offlineId: details?.offlineId
  };
  
  await syncDB.syncLogs.put(log);
  
  // Keep only last 1000 logs
  const count = await syncDB.syncLogs.count();
  if (count > 1000) {
    const oldest = await syncDB.syncLogs.orderBy('timestamp').limit(count - 1000).toArray();
    await syncDB.syncLogs.bulkDelete(oldest.map(l => l.id));
  }
}

/**
 * Get recent sync logs
 */
export async function getSyncLogs(limit: number = 100): Promise<SyncLog[]> {
  return await syncDB.syncLogs
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray();
}

/**
 * Clear all sync logs
 */
export async function clearSyncLogs(): Promise<void> {
  await syncDB.syncLogs.clear();
}

// ============================================
// STATISTICS
// ============================================

export interface SyncStats {
  pending: number;
  syncing: number;
  synced: number;
  conflict: number;
  failed: number;
  total: number;
}

/**
 * Get sync statistics
 */
export async function getSyncStats(): Promise<SyncStats> {
  const all = await syncDB.sales.toArray();
  
  return {
    pending: all.filter(s => s.status === 'pending').length,
    syncing: all.filter(s => s.status === 'syncing').length,
    synced: all.filter(s => s.status === 'synced').length,
    conflict: all.filter(s => s.status === 'conflict').length,
    failed: all.filter(s => s.status === 'failed').length,
    total: all.length
  };
}
