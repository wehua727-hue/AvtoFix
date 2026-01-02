/**
 * IndexedDB wrapper for offline data storage
 * Uses idb library for promise-based API
 */

import { openDB, IDBPDatabase } from 'idb';

// Product type
export interface OfflineProduct {
  offlineId: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  stock?: number;
  imageUrl?: string;
  createdAt: string;
  synced: boolean;
}

// Sync queue item type
export interface SyncQueueItem {
  offlineId: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  createdAt: string;
  retryCount: number;
  lastRetry?: string;
}

// Sync log type
export interface SyncLog {
  id?: number;
  timestamp: string;
  status: 'success' | 'error';
  itemCount: number;
  message?: string;
}

// Database schema (simplified for idb v8)
interface OflaynDokonDB {
  products: {
    key: string;
    value: OfflineProduct;
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
  };
  syncLog: {
    key: number;
    value: SyncLog;
  };
}

const DB_NAME = 'oflayn-dokon-db';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<OflaynDokonDB> | null = null;

/**
 * Initialize and open the database
 */
export async function initDB(): Promise<IDBPDatabase<OflaynDokonDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<OflaynDokonDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      console.log(`[DB] Upgrading database`);

      // Create products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', {
          keyPath: 'offlineId',
        });
        productStore.createIndex('by-synced', 'synced');
        productStore.createIndex('by-created', 'createdAt');
      }

      // Create sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', {
          keyPath: 'offlineId',
        });
        queueStore.createIndex('by-retry', 'retryCount');
      }

      // Create sync log store
      if (!db.objectStoreNames.contains('syncLog')) {
        db.createObjectStore('syncLog', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    },
  });

  return dbInstance;
}

/**
 * Get database instance
 */
export async function getDB(): Promise<IDBPDatabase<OflaynDokonDB>> {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}

// ============ PRODUCTS ============

/**
 * Add product to offline storage
 */
export async function addOfflineProduct(product: Omit<OfflineProduct, 'offlineId' | 'createdAt' | 'synced'>) {
  const db = await getDB();
  const offlineId = crypto.randomUUID();
  const productData: OfflineProduct = {
    ...product,
    offlineId,
    createdAt: new Date().toISOString(),
    synced: false,
  };

  await db.add('products', productData);
  return productData;
}

/**
 * Get all offline products
 */
export async function getAllOfflineProducts() {
  const db = await getDB();
  return await db.getAll('products');
}

/**
 * Get unsynced products
 */
export async function getUnsyncedProducts() {
  try {
    const db = await getDB();
    const allProducts = await db.getAll('products');
    return allProducts.filter(p => !p.synced);
  } catch (error) {
    console.error('[DB] Error getting unsynced products:', error);
    return [];
  }
}

/**
 * Mark product as synced
 */
export async function markProductAsSynced(offlineId: string) {
  const db = await getDB();
  const product = await db.get('products', offlineId);
  if (product) {
    product.synced = true;
    await db.put('products', product);
  }
}

/**
 * Delete synced products
 */
export async function deleteSyncedProducts() {
  const db = await getDB();
  const allProducts = await db.getAll('products');
  const syncedProducts = allProducts.filter(p => p.synced);
  const tx = db.transaction('products', 'readwrite');
  
  await Promise.all([
    ...syncedProducts.map(p => tx.store.delete(p.offlineId)),
    tx.done,
  ]);
}

// ============ SYNC QUEUE ============

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(
  type: 'create' | 'update' | 'delete',
  data: any
) {
  const db = await getDB();
  const offlineId = data.offlineId || crypto.randomUUID();
  
  const queueItem: OflaynDokonDB['syncQueue']['value'] = {
    offlineId,
    type,
    data,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  await db.put('syncQueue', queueItem);
  return queueItem;
}

/**
 * Get all items from sync queue
 */
export async function getSyncQueue() {
  const db = await getDB();
  return await db.getAll('syncQueue');
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(offlineId: string) {
  const db = await getDB();
  await db.delete('syncQueue', offlineId);
}

/**
 * Increment retry count for queue item
 */
export async function incrementRetryCount(offlineId: string) {
  const db = await getDB();
  const item = await db.get('syncQueue', offlineId);
  if (item) {
    item.retryCount += 1;
    item.lastRetry = new Date().toISOString();
    await db.put('syncQueue', item);
  }
}

/**
 * Clear sync queue
 */
export async function clearSyncQueue() {
  const db = await getDB();
  await db.clear('syncQueue');
}

// ============ SYNC LOG ============

/**
 * Add sync log entry
 */
export async function addSyncLog(
  status: 'success' | 'error',
  itemCount: number,
  message?: string
) {
  const db = await getDB();
  await db.add('syncLog', {
    timestamp: new Date().toISOString(),
    status,
    itemCount,
    message,
  });
}

/**
 * Get recent sync logs
 */
export async function getRecentSyncLogs(limit = 10) {
  const db = await getDB();
  const logs = await db.getAll('syncLog');
  return logs.slice(-limit).reverse();
}

/**
 * Clear old sync logs (keep last 50)
 */
export async function clearOldSyncLogs() {
  const db = await getDB();
  const logs = await db.getAll('syncLog');
  
  if (logs.length > 50) {
    const toDelete = logs.slice(0, logs.length - 50);
    const tx = db.transaction('syncLog', 'readwrite');
    
    await Promise.all([
      ...toDelete.map(log => log.id && tx.store.delete(log.id)),
      tx.done,
    ]);
  }
}
