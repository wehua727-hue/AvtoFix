import { Product, SyncResponse, OfflineState } from '@shared/types';
import {
  getUnsyncedProducts,
  markProductsSynced,
  getAllProducts,
  addProduct,
  updateProduct,
  deleteProduct,
} from '@/db/indexeddb';

const API_BASE_URL = typeof window !== 'undefined' && window.location.protocol === 'file:'
  ? 'http://127.0.0.1:3000'
  : '';

class SyncManager {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private retryDelay = 5000; // 5 seconds
  private listeners: Array<(state: OfflineState) => void> = [];
  private offlineState: OfflineState = {
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    errors: [],
  };

  constructor() {
    this.setupOnlineDetection();
    this.updatePendingCount();
  }

  private setupOnlineDetection() {
    window.addEventListener('online', () => {
      console.log('[SyncManager] Online detected');
      this.offlineState.isOnline = true;
      this.notifyListeners();
      this.startSync();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncManager] Offline detected');
      this.offlineState.isOnline = false;
      this.notifyListeners();
      this.stopSync();
    });
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.offlineState));
  }

  public subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private async updatePendingCount() {
    try {
      const unsynced = await getUnsyncedProducts();
      this.offlineState.pendingCount = unsynced.length;
      this.notifyListeners();
    } catch (error) {
      console.error('[SyncManager] Error updating pending count:', error);
    }
  }

  public async startSync() {
    if (!this.offlineState.isOnline || this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    this.offlineState.isSyncing = true;
    this.notifyListeners();

    try {
      await this.syncWithServer();
      this.retryCount = 0;
      this.offlineState.errors = [];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncManager] Sync failed:', errorMsg);
      this.offlineState.errors = [errorMsg];

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`[SyncManager] Retrying sync (${this.retryCount}/${this.maxRetries})...`);
        setTimeout(() => this.startSync(), this.retryDelay);
      }
    } finally {
      this.isSyncing = false;
      this.offlineState.isSyncing = false;
      await this.updatePendingCount();
      this.notifyListeners();
    }
  }

  private async syncWithServer(): Promise<void> {
    const unsyncedProducts = await getUnsyncedProducts();

    if (unsyncedProducts.length === 0) {
      console.log('[SyncManager] No products to sync');
      return;
    }

    console.log(`[SyncManager] Syncing ${unsyncedProducts.length} products...`);

    const response = await fetch(`${API_BASE_URL}/api/products/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: unsyncedProducts,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    const data: SyncResponse = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Sync failed');
    }

    // Mark synced products
    if (data.syncedIds && data.syncedIds.length > 0) {
      await markProductsSynced(data.syncedIds);
      console.log(`[SyncManager] Marked ${data.syncedIds.length} products as synced`);
    }

    // Handle errors
    if (data.errors && data.errors.length > 0) {
      const errorMessages = data.errors.map((e) => `${e.id}: ${e.error}`);
      console.error('[SyncManager] Sync errors:', errorMessages);
      this.offlineState.errors = errorMessages;
    }
  }

  public stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  public getState(): OfflineState {
    return { ...this.offlineState };
  }

  public isOnline(): boolean {
    return this.offlineState.isOnline;
  }

  public isSyncingNow(): boolean {
    return this.offlineState.isSyncing;
  }

  public async addProductLocally(product: Product): Promise<void> {
    try {
      await addProduct(product);
      await this.updatePendingCount();
      if (this.offlineState.isOnline) {
        this.startSync();
      }
    } catch (error) {
      console.error('[SyncManager] Error adding product locally:', error);
      throw error;
    }
  }

  public async updateProductLocally(product: Product): Promise<void> {
    try {
      await updateProduct(product);
      await this.updatePendingCount();
      if (this.offlineState.isOnline) {
        this.startSync();
      }
    } catch (error) {
      console.error('[SyncManager] Error updating product locally:', error);
      throw error;
    }
  }

  public async deleteProductLocally(productId: string): Promise<void> {
    try {
      await deleteProduct(productId);
      await this.updatePendingCount();
      if (this.offlineState.isOnline) {
        this.startSync();
      }
    } catch (error) {
      console.error('[SyncManager] Error deleting product locally:', error);
      throw error;
    }
  }

  public async getAllProducts(): Promise<Product[]> {
    try {
      return await getAllProducts();
    } catch (error) {
      console.error('[SyncManager] Error getting all products:', error);
      return [];
    }
  }
}

export const syncManager = new SyncManager();
