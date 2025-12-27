/**
 * OFFLINE SYNC MANAGER
 * IndexedDB ↔ MongoDB sinxronizatsiya
 * 
 * Xususiyatlar:
 * - Delta sync (faqat o'zgargan mahsulotlar)
 * - Offline sales auto-upload
 * - Conflict resolution
 * - Auto-reconnect detection
 * - Background sync
 */

import {
  offlineDB,
  OfflineProduct,
  getAllProducts,
  bulkUpsertProducts,
  deleteProducts,
  getUnsyncedSales,
  markSaleAsSynced,
  getLastSyncTime,
  setLastSyncTime,
  normalizeText,
  tokenize,
  setCurrentUserId,
  clearOtherUsersData
} from '../db/offlineDB';
import { searchEngine } from './searchEngine';

// ============================================
// TYPES
// ============================================

interface DeltaSyncResponse {
  success: boolean;
  data: {
    newProducts: OfflineProduct[];
    updatedProducts: OfflineProduct[];
    deletedProductIds: string[];
    serverTime: number;
  };
}

interface SalesSyncResponse {
  success: boolean;
  syncedIds: string[];
  errors: { id: string; error: string }[];
}

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSyncTime: number;
  pendingSalesCount: number;
  isOnline: boolean;
  error?: string;
}

// ============================================
// SYNC MANAGER CLASS
// ============================================

class SyncManager {
  private apiBaseUrl: string;
  private syncInterval: number = 30000; // 30 sekund
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: Set<(state: SyncState) => void> = new Set();
  private state: SyncState = {
    status: 'idle',
    lastSyncTime: 0,
    pendingSalesCount: 0,
    isOnline: navigator.onLine
  };

  constructor() {
    // API URL
    this.apiBaseUrl = this.getApiBaseUrl();
    
    // Online/Offline detection
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Initial state
    this.state.isOnline = navigator.onLine;
  }

  private getApiBaseUrl(): string {
    if (typeof window === 'undefined') return '';
    // Electron da file:// protokoli ishlatiladi - port 5175
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:5175';
    const envApiUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envApiUrl && !envApiUrl.includes('YOUR_PUBLIC_IP')) {
      return envApiUrl.replace(/\/$/, '');
    }
    return '';
  }

  /**
   * Sync manager ni ishga tushirish
   */
  async initialize(userId: string): Promise<void> {
    
    // Установить текущего пользователя для фильтрации в IndexedDB
    setCurrentUserId(userId);
    
    // ВАЖНО: Сначала синхронизируем ВСЕ несохраненные продажи (всех пользователей)
    if (this.state.isOnline) {
      try {
        await this.uploadAllOfflineSales();
        
        // Очистить данные других пользователей ТОЛЬКО после успешной синхронизации
        await clearOtherUsersData(userId);
      } catch (error) {
        console.error('[SyncManager] Failed to sync or cleanup:', error);
        // Не падаем, продолжаем работу с данными всех пользователей
      }
    } else {
    }
    
    // Load last sync time with validation
    let lastSync = await getLastSyncTime();
    const now = Date.now();
    
    // Agar timestamp noto'g'ri bo'lsa, 0 ga o'zgartirish
    if (lastSync < 0 || lastSync > now || isNaN(lastSync)) {
      console.warn(`[SyncManager] Invalid stored lastSync: ${lastSync}, resetting to 0`);
      lastSync = 0;
      // IndexedDB da ham tozalash
      await setLastSyncTime(0);
    }
    
    this.state.lastSyncTime = lastSync;
    
    // Count pending sales
    const unsyncedSales = await getUnsyncedSales();
    this.state.pendingSalesCount = unsyncedSales.length;
    
    // Initial sync if online
    if (this.state.isOnline) {
      await this.fullSync(userId);
    } else {
      // Load from IndexedDB for offline
      await this.loadOfflineData();
    }
    
    // Start periodic sync
    this.startPeriodicSync(userId);
    
    this.notifyListeners();
  }

  /**
   * Offline ma'lumotlarni yuklash
   */
  private async loadOfflineData(): Promise<void> {
    const products = await getAllProducts();
    
    if (products.length > 0) {
      // Build search index
      await searchEngine.buildIndex(products);
    }
  }

  /**
   * To'liq sinxronizatsiya
   */
  async fullSync(userId: string): Promise<boolean> {
    if (!this.state.isOnline) {
      return false;
    }

    this.updateState({ status: 'syncing' });

    try {
      // 1. Upload offline sales
      const salesSynced = await this.uploadOfflineSales(userId);
      
      // Задержка после синхронизации продаж, чтобы сервер успел обновить stock
      if (salesSynced) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // 2. Delta sync products
      await this.deltaSync(userId);

      // 3. Rebuild search index
      const products = await getAllProducts();
      await searchEngine.buildIndex(products);

      // Update state
      const now = Date.now();
      await setLastSyncTime(now);
      
      this.updateState({
        status: 'idle',
        lastSyncTime: now,
        error: undefined
      });

      return true;
    } catch (error: any) {
      console.error('[SyncManager] Sync error:', error);
      this.updateState({
        status: 'error',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Delta sync - faqat o'zgargan mahsulotlar
   * Agar lastSync = 0 bo'lsa, barcha mahsulotlarni yuklaydi
   */
  private async deltaSync(userId: string): Promise<void> {
    let lastSync = this.state.lastSyncTime;
    const now = Date.now();
    
    // Timestamp validatsiyasi - agar noto'g'ri bo'lsa, 0 ga o'zgartirish
    // Проверяем что timestamp не в будущем (с запасом 24 часа для погрешности)
    const maxValidTimestamp = now + 86400000; // 24 часа в будущем
    
    if (lastSync < 0 || lastSync > maxValidTimestamp || isNaN(lastSync)) {
      console.warn(`[SyncManager] Invalid lastSync timestamp: ${lastSync} (${new Date(lastSync).toISOString()}), current: ${now} (${new Date(now).toISOString()}), resetting to 0`);
      lastSync = 0;
      this.state.lastSyncTime = 0;
      // Сохраняем исправленное значение в IndexedDB
      await setLastSyncTime(0);
    }
    
    const existingProducts = await getAllProducts();
    
    // Agar IndexedDB bo'sh bo'lsa va lastSync = 0, to'liq yuklash
    if (existingProducts.length === 0 && lastSync === 0) {
      await this.initialFullLoad(userId);
      return;
    }
    

    // Get userPhone from localStorage
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const userPhone = user?.phone || '';

    const url = `${this.apiBaseUrl}/api/products/delta?since=${lastSync}&userId=${userId}&userPhone=${encodeURIComponent(userPhone)}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      // Agar delta sync xato bersa, to'liq yuklashga o'tish
      await this.initialFullLoad(userId);
      return;
    }

    const data: DeltaSyncResponse = await response.json();

    if (!data.success) {
      throw new Error('Delta sync returned error');
    }

    const { newProducts, updatedProducts, deletedProductIds } = data.data;

    // Process new and updated products - variant ma'lumotlarini to'g'ri formatlash
    // ВАЖНО: Порядок синхронизации: сначала продажи (uploadOfflineSales), потом продукты (deltaSync)
    // Это гарантирует, что stock на сервере уже обновлен перед синхронизацией продуктов
    const productsToUpsert = [...newProducts, ...updatedProducts].map((p: any) => ({
      ...p,
      id: p._id || p.id,
      normalizedName: normalizeText(p.name),
      keywords: tokenize(p.name),
      sku: p.sku !== undefined && p.sku !== null ? String(p.sku) : undefined,
      barcode: p.barcode !== undefined && p.barcode !== null ? String(p.barcode) : undefined,
      stock: p.stock ?? 0, // Используем stock с сервера (уже обновлен после синхронизации продаж)
      updatedAt: Date.now(),
      userId: p.userId || userId,
      // Ota-bola mahsulot tizimi
      parentProductId: p.parentProductId || undefined,
      childProducts: Array.isArray(p.childProducts) ? p.childProducts : [],
      isHidden: p.isHidden || false,
      // Variantlarni saqlash - SKU va barcode ni string ga aylantirish
      variantSummaries: Array.isArray(p.variantSummaries) ? p.variantSummaries.map((v: any) => ({
        name: v.name,
        sku: v.sku !== undefined && v.sku !== null ? String(v.sku) : undefined,
        barcode: v.barcode !== undefined && v.barcode !== null ? String(v.barcode) : undefined,
        price: v.price || v.basePrice || p.price || 0,
        stock: v.stock ?? v.quantity ?? 0, // Используем stock с сервера
        imageUrl: v.imageUrl || v.images?.[0]
      })) : []
    }));

    if (productsToUpsert.length > 0) {
      await bulkUpsertProducts(productsToUpsert);
    }

    // Delete removed products
    if (deletedProductIds.length > 0) {
      await deleteProducts(deletedProductIds);
    }
  }

  /**
   * Birinchi marta barcha mahsulotlarni yuklash
   */
  private async initialFullLoad(userId: string): Promise<void> {
    
    // Get userPhone from localStorage
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const userPhone = user?.phone || '';
    
    // Загружаем товары с фильтрацией по userId и userPhone
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (userPhone) params.append('userPhone', userPhone);
    params.append('limit', '50000');
    
    const response = await fetch(`${this.apiBaseUrl}/api/products?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Initial load failed: ${response.status}`);
    }
    
    const data = await response.json();
    const products = Array.isArray(data) ? data : data.products || [];

    // Agar serverda mahsulot yo'q bo'lsa, IndexedDB ni ham tozalash
    if (products.length === 0) {
      const localProducts = await getAllProducts();
      if (localProducts.length > 0) {
        await deleteProducts(localProducts.map(p => p.id));
      }
      return;
    }

    // Format and save products
    const formattedProducts: OfflineProduct[] = products.map((p: any) => ({
      id: p._id || p.id,
      name: p.name,
      normalizedName: normalizeText(p.name),
      keywords: tokenize(p.name),
      sku: p.sku !== undefined && p.sku !== null ? String(p.sku) : undefined,
      barcode: p.barcode !== undefined && p.barcode !== null ? String(p.barcode) : undefined,
      price: p.price || 0,
      stock: p.stock ?? p.quantity ?? 0,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl,
      updatedAt: Date.now(),
      userId: p.userId || userId,
      // Ota-bola mahsulot tizimi
      parentProductId: p.parentProductId || undefined,
      childProducts: Array.isArray(p.childProducts) ? p.childProducts : [],
      isHidden: p.isHidden || false,
      // Variantlarni saqlash - SKU va barcode ni string ga aylantirish
      variantSummaries: Array.isArray(p.variantSummaries) ? p.variantSummaries.map((v: any) => ({
        name: v.name,
        sku: v.sku !== undefined && v.sku !== null ? String(v.sku) : undefined,
        barcode: v.barcode !== undefined && v.barcode !== null ? String(v.barcode) : undefined,
        price: v.price || v.basePrice || p.price || 0,
        stock: v.stock ?? v.quantity ?? 0,
        imageUrl: v.imageUrl || v.images?.[0]
      })) : []
    }));

    // MUHIM: Eski mahsulotlarni o'chirish - serverda yo'q bo'lgan mahsulotlarni IndexedDB dan o'chirish
    const serverProductIds = new Set(formattedProducts.map(p => p.id));
    const localProducts = await getAllProducts();
    const productsToDelete = localProducts.filter(p => !serverProductIds.has(p.id)).map(p => p.id);
    
    if (productsToDelete.length > 0) {
      await deleteProducts(productsToDelete);
    }

    await bulkUpsertProducts(formattedProducts);
  }

  /**
   * Offline sotuvlarni yuklash (ВСЕХ пользователей)
   * Используется при смене пользователя для синхронизации всех данных
   */
  private async uploadAllOfflineSales(): Promise<void> {
    // Получаем ВСЕ несинхронизированные продажи (всех пользователей)
    // IndexedDB не поддерживает boolean в индексах, используем фильтрацию
    const allSales = await offlineDB.offlineSales.toArray();
    const allUnsyncedSales = allSales.filter(sale => sale.synced === false);
    
    if (allUnsyncedSales.length === 0) {
      return;
    }


    // Группируем продажи по userId
    const salesByUser = new Map<string, typeof allUnsyncedSales>();
    for (const sale of allUnsyncedSales) {
      const userId = sale.userId;
      if (!salesByUser.has(userId)) {
        salesByUser.set(userId, []);
      }
      salesByUser.get(userId)!.push(sale);
    }

    // Синхронизируем продажи каждого пользователя
    let totalSynced = 0;
    for (const [userId, sales] of salesByUser.entries()) {
      
      try {
        const response = await fetch(`${this.apiBaseUrl}/api/sales/offline-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sales,
            userId
          })
        });

        if (response.ok) {
          const result: SalesSyncResponse = await response.json();
          
          // Mark synced sales
          for (const id of result.syncedIds) {
            await markSaleAsSynced(id);
            totalSynced++;
          }
          
          if (result.errors.length > 0) {
            console.warn(`[SyncManager] Some sales failed for user ${userId}:`, result.errors);
          }
        } else {
          console.error(`[SyncManager] Failed to sync sales for user ${userId}: ${response.status}`);
        }
      } catch (error) {
        console.error(`[SyncManager] Error syncing sales for user ${userId}:`, error);
      }
    }

  }

  /**
   * Offline sotuvlarni yuklash (текущего пользователя)
   */
  private async uploadOfflineSales(userId: string): Promise<boolean> {
    const unsyncedSales = await getUnsyncedSales();
    
    if (unsyncedSales.length === 0) {
      return false;
    }

    const response = await fetch(`${this.apiBaseUrl}/api/sales/offline-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales: unsyncedSales,
        userId
      })
    });

    if (!response.ok) {
      throw new Error(`Sales sync failed: ${response.status}`);
    }

    const result: SalesSyncResponse = await response.json();

    // Mark synced sales
    for (const id of result.syncedIds) {
      await markSaleAsSynced(id);
    }

    // Update pending count
    const remaining = await getUnsyncedSales();
    this.updateState({ pendingSalesCount: remaining.length });
    
    return true;
  }

  /**
   * Periodic sync boshlash
   */
  private startPeriodicSync(userId: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      if (this.state.isOnline && this.state.status !== 'syncing') {
        await this.fullSync(userId);
      }
    }, this.syncInterval);
  }

  /**
   * Online bo'lganda
   */
  private async handleOnline(): Promise<void> {
    this.updateState({ isOnline: true, status: 'idle' });
    
    // Auto-sync when back online
    // Note: userId should be stored or passed
  }

  /**
   * Offline bo'lganda
   */
  private handleOffline(): void {
    this.updateState({ isOnline: false, status: 'offline' });
  }

  /**
   * State yangilash
   */
  private updateState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  /**
   * Listenerlarni xabardor qilish
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * State o'zgarishlarini kuzatish
   */
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state); // Initial call
    return () => this.listeners.delete(listener);
  }

  /**
   * Hozirgi state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Manual sync trigger
   */
  async triggerSync(userId: string): Promise<boolean> {
    return this.fullSync(userId);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.listeners.clear();
  }
}

// Singleton instance
export const syncManager = new SyncManager();
