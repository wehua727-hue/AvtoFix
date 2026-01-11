/**
 * Synchronization manager for offline-first functionality
 * Handles syncing offline data with backend when connection is restored
 */

// Type declaration for Background Sync API
declare global {
  interface ServiceWorkerRegistration {
    sync: {
      register(tag: string): Promise<void>;
      getTags(): Promise<string[]>;
    };
  }
}

import {
  getUnsyncedProducts,
  markProductAsSynced,
  addSyncLog,
  getSyncQueue,
  removeFromSyncQueue,
  incrementRetryCount,
} from './db';

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();
const MAX_RETRY_COUNT = 5;

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Sync all unsynced products with backend
 */
export async function syncProducts(): Promise<SyncResult> {
  console.log('[Sync] Starting product sync...');
  
  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  let unsyncedProducts: any[] = [];
  
  try {
    // Get unsynced products
    unsyncedProducts = await getUnsyncedProducts();
    
    if (unsyncedProducts.length === 0) {
      console.log('[Sync] No products to sync');
      return result;
    }

    console.log(`[Sync] Found ${unsyncedProducts.length} products to sync`);

    // Prepare bulk sync payload
    const payload = unsyncedProducts.map(p => ({
      offlineId: p.offlineId,
      name: p.name,
      price: p.price,
      description: p.description,
      category: p.category,
      stock: p.stock,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt,
    }));

    // Send to backend
    const response = await fetch(`${API_BASE}/api/products/bulk-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ products: payload }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Sync] Backend response:', data);

    // Mark products as synced
    for (const product of unsyncedProducts) {
      await markProductAsSynced(product.offlineId);
      result.syncedCount++;
    }

    // Log success
    await addSyncLog('success', result.syncedCount, 'Products synced successfully');
    
    console.log(`[Sync] Successfully synced ${result.syncedCount} products`);
    
  } catch (error) {
    console.error('[Sync] Error:', error);
    result.success = false;
    result.failedCount = unsyncedProducts.length;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    
    // Log error
    await addSyncLog(
      'error',
      0,
      error instanceof Error ? error.message : 'Sync failed'
    );
  }

  return result;
}

/**
 * Process sync queue with retry logic
 */
export async function processSyncQueue(): Promise<SyncResult> {
  console.log('[Sync] Processing sync queue...');
  
  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    const queue = await getSyncQueue();
    
    if (queue.length === 0) {
      console.log('[Sync] Queue is empty');
      return result;
    }

    console.log(`[Sync] Processing ${queue.length} items from queue`);

    for (const item of queue) {
      try {
        // Check retry count
        if (item.retryCount >= MAX_RETRY_COUNT) {
          console.warn(`[Sync] Max retries reached for ${item.offlineId}`);
          result.failedCount++;
          result.errors.push(`Max retries reached for ${item.offlineId}`);
          continue;
        }

        // Sync based on type
        let success = false;
        
        switch (item.type) {
          case 'create':
            success = await syncCreateProduct(item.data);
            break;
          case 'update':
            success = await syncUpdateProduct(item.data);
            break;
          case 'delete':
            success = await syncDeleteProduct(item.data);
            break;
        }

        if (success) {
          await removeFromSyncQueue(item.offlineId);
          result.syncedCount++;
        } else {
          await incrementRetryCount(item.offlineId);
          result.failedCount++;
        }
        
      } catch (error) {
        console.error(`[Sync] Error processing ${item.offlineId}:`, error);
        await incrementRetryCount(item.offlineId);
        result.failedCount++;
        result.errors.push(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Log result
    if (result.syncedCount > 0) {
      await addSyncLog(
        'success',
        result.syncedCount,
        `Synced ${result.syncedCount} items from queue`
      );
    }
    
    if (result.failedCount > 0) {
      await addSyncLog(
        'error',
        result.failedCount,
        `Failed to sync ${result.failedCount} items`
      );
    }
    
  } catch (error) {
    console.error('[Sync] Queue processing error:', error);
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

/**
 * Sync create operation
 */
async function syncCreateProduct(data: any): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/products/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.ok;
  } catch (error) {
    console.error('[Sync] Create failed:', error);
    return false;
  }
}

/**
 * Sync update operation
 */
async function syncUpdateProduct(data: any): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/products/${data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.ok;
  } catch (error) {
    console.error('[Sync] Update failed:', error);
    return false;
  }
}

/**
 * Sync delete operation
 */
async function syncDeleteProduct(data: any): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/products/${data.id}`, {
      method: 'DELETE',
    });

    return response.ok;
  } catch (error) {
    console.error('[Sync] Delete failed:', error);
    return false;
  }
}

/**
 * Register background sync (if supported)
 */
export async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-products');
      console.log('[Sync] Background sync registered');
      return true;
    } catch (error) {
      console.error('[Sync] Background sync registration failed:', error);
      return false;
    }
  }
  
  console.warn('[Sync] Background Sync API not supported');
  return false;
}

/**
 * Auto-sync with retry logic
 */
export async function autoSync(): Promise<SyncResult> {
  console.log('[Sync] Starting auto-sync...');
  
  // Try background sync first
  const bgSyncRegistered = await registerBackgroundSync();
  
  if (!bgSyncRegistered) {
    // Fallback to manual sync
    const productResult = await syncProducts();
    const queueResult = await processSyncQueue();
    
    return {
      success: productResult.success && queueResult.success,
      syncedCount: productResult.syncedCount + queueResult.syncedCount,
      failedCount: productResult.failedCount + queueResult.failedCount,
      errors: [...productResult.errors, ...queueResult.errors],
    };
  }
  
  return {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };
}

/**
 * Schedule periodic sync
 */
export function schedulePeriodicSync(intervalMs: number = 60000) {
  console.log(`[Sync] Scheduling periodic sync every ${intervalMs}ms`);
  
  const intervalId = setInterval(async () => {
    if (navigator.onLine) {
      await autoSync();
    }
  }, intervalMs);

  return () => clearInterval(intervalId);
}
