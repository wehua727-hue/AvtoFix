# 🔄 OFFLINE SYNC (Offline-First Architecture) - Batafsil Hujjat

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `client/db/offlineDB.ts` - IndexedDB boshqaruvi
- `client/services/syncManager.ts` - Sinxronizatsiya menejeri
- `client/hooks/useOfflineSync.ts` - Offline sync hook

**Vazifasi:** Internet yo'q bo'lganda ham to'liq ishlash

**Texnologiya:** IndexedDB, Dexie.js, Service Worker

---

## 🎯 Offline-First Arxitektura

### Asosiy Printsiplar:

1. **Local-First:** Barcha operatsiyalar avval mahalliy bajariladi
2. **Background Sync:** Internet qaytganda avtomatik sinxronizatsiya
3. **Conflict Resolution:** Konfliktlarni hal qilish
4. **Queue System:** Operatsiyalarni navbatga qo'yish
5. **Retry Mechanism:** Xato bo'lganda qayta urinish

---

## 🗄️ IndexedDB Tuzilmasi

### 1. **Database Schema:**

```typescript
import Dexie, { Table } from 'dexie';

class OfflineDatabase extends Dexie {
  // Tables
  products!: Table<OfflineProduct>;
  sales!: Table<OfflineSale>;
  customers!: Table<OfflineCustomer>;
  categories!: Table<OfflineCategory>;
  syncQueue!: Table<SyncQueueItem>;
  defectiveProducts!: Table<DefectiveProduct>;
  
  constructor() {
    super('AvtoFixDB');
    
    this.version(1).stores({
      products: '++id, sku, name, categoryId, userId, synced',
      sales: '++id, offlineId, userId, synced, offlineCreatedAt',
      customers: '++id, phone, userId, synced',
      categories: '++id, name, userId, synced',
      syncQueue: '++id, type, action, synced, timestamp, retryCount',
      defectiveProducts: '++id, productId, date',
    });
  }
}

export const offlineDB = new OfflineDatabase();
```

---

## 📦 Ma'lumotlar Turlari

### 1. **OfflineProduct:**
```typescript
interface OfflineProduct {
  id?: number;              // IndexedDB ID
  productId?: string;       // Server ID
  name: string;
  sku: string;
  price: number;
  currency: Currency;
  stock: number;
  categoryId?: string;
  imageUrl?: string;
  userId: string;
  synced: boolean;          // Sinxronizatsiya qilinganmi?
  localCreatedAt: Date;
  localUpdatedAt: Date;
}
```

### 2. **OfflineSale:**
```typescript
interface OfflineSale {
  id?: number;
  offlineId: string;        // Mahalliy UUID
  serverId?: string;        // Server ID (sync qilingandan keyin)
  items: CartItem[];
  total: number;
  paymentType: PaymentType;
  customerId?: string;
  userId: string;
  cashier: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  synced: boolean;
  offlineCreatedAt: Date;
  syncedAt?: Date;
}
```

### 3. **SyncQueueItem:**
```typescript
interface SyncQueueItem {
  id?: number;
  type: 'product' | 'sale' | 'customer' | 'category';
  action: 'create' | 'update' | 'delete';
  data: any;
  synced: boolean;
  timestamp: Date;
  retryCount: number;
  lastError?: string;
  userId: string;
}
```

---

## 🔄 Sinxronizatsiya Menejeri

### 1. **SyncManager Class:**

```typescript
class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInterval: number = 30000; // 30 soniya
  
  constructor() {
    // Online/Offline event listener
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Davriy sinxronizatsiya
    setInterval(() => this.syncAll(), this.syncInterval);
  }
  
  // Online bo'lganda
  private handleOnline() {
    this.isOnline = true;
    console.log('[SyncManager] Online');
    this.syncAll();
  }
  
  // Offline bo'lganda
  private handleOffline() {
    this.isOnline = false;
    console.log('[SyncManager] Offline');
  }
  
  // Barcha ma'lumotlarni sync qilish
  async syncAll() {
    if (!this.isOnline || this.isSyncing) return;
    
    this.isSyncing = true;
    
    try {
      await this.syncProducts();
      await this.syncSales();
      await this.syncCustomers();
      await this.syncCategories();
      await this.syncQueue();
    } catch (error) {
      console.error('[SyncManager] Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }
  
  // Mahsulotlarni sync qilish
  async syncProducts() {
    const unsyncedProducts = await offlineDB.products
      .where('synced')
      .equals(false)
      .toArray();
    
    for (const product of unsyncedProducts) {
      try {
        const response = await api.post('/api/products/create', product);
        
        // Server ID ni saqlash
        await offlineDB.products.update(product.id!, {
          productId: response.data.id,
          synced: true,
        });
        
        console.log('[SyncManager] Product synced:', product.name);
      } catch (error) {
        console.error('[SyncManager] Product sync error:', error);
      }
    }
  }
  
  // Sotuvlarni sync qilish
  async syncSales() {
    const unsyncedSales = await offlineDB.sales
      .where('synced')
      .equals(false)
      .toArray();
    
    for (const sale of unsyncedSales) {
      try {
        const response = await api.post('/api/sales/offline-sync', {
          offlineId: sale.offlineId,
          items: sale.items,
          total: sale.total,
          paymentType: sale.paymentType,
          customerId: sale.customerId,
          offlineCreatedAt: sale.offlineCreatedAt,
        });
        
        // Sync qilingan deb belgilash
        await offlineDB.sales.update(sale.id!, {
          serverId: response.data.id,
          synced: true,
          syncedAt: new Date(),
        });
        
        console.log('[SyncManager] Sale synced:', sale.offlineId);
      } catch (error) {
        console.error('[SyncManager] Sale sync error:', error);
      }
    }
  }
  
  // Queue ni sync qilish
  async syncQueue() {
    const queueItems = await offlineDB.syncQueue
      .where('synced')
      .equals(false)
      .toArray();
    
    for (const item of queueItems) {
      try {
        // Retry count tekshirish
        if (item.retryCount >= 5) {
          console.error('[SyncManager] Max retry reached:', item);
          continue;
        }
        
        // Sync qilish
        await this.syncQueueItem(item);
        
        // Muvaffaqiyatli bo'lsa, synced = true
        await offlineDB.syncQueue.update(item.id!, {
          synced: true,
        });
      } catch (error) {
        // Xato bo'lsa, retry count oshirish
        await offlineDB.syncQueue.update(item.id!, {
          retryCount: item.retryCount + 1,
          lastError: error.message,
        });
      }
    }
  }
  
  // Queue item ni sync qilish
  private async syncQueueItem(item: SyncQueueItem) {
    const { type, action, data } = item;
    
    switch (type) {
      case 'product':
        if (action === 'create') {
          await api.post('/api/products', data);
        } else if (action === 'update') {
          await api.put(`/api/products/${data.id}`, data);
        } else if (action === 'delete') {
          await api.delete(`/api/products/${data.id}`);
        }
        break;
      
      case 'sale':
        await api.post('/api/sales/offline-sync', data);
        break;
      
      // ... boshqa turlar
    }
  }
  
  // Queue ga qo'shish
  async addToQueue(type: string, action: string, data: any) {
    await offlineDB.syncQueue.add({
      type,
      action,
      data,
      synced: false,
      timestamp: new Date(),
      retryCount: 0,
      userId: data.userId,
    });
  }
}

export const syncManager = new SyncManager();
```

---

## 🎣 useOfflineSync Hook

### 1. **Hook Implementation:**

```typescript
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  useEffect(() => {
    // Online/Offline listener
    const handleOnline = () => {
      setIsOnline(true);
      syncAll();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Pending count ni yangilash
    updatePendingCount();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Pending count ni yangilash
  const updatePendingCount = async () => {
    const count = await offlineDB.syncQueue
      .where('synced')
      .equals(false)
      .count();
    
    setPendingCount(count);
  };
  
  // Barcha ma'lumotlarni sync qilish
  const syncAll = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    
    try {
      await syncManager.syncAll();
      setLastSyncTime(new Date());
      await updatePendingCount();
    } catch (error) {
      console.error('[useOfflineSync] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncAll,
  };
}
```

---

## 💾 Offline Operatsiyalar

### 1. **Offline Mahsulot Qo'shish:**

```typescript
const createOfflineProduct = async (product: ProductInput) => {
  // 1. Mahalliy ID yaratish
  const localId = await offlineDB.products.add({
    ...product,
    synced: false,
    localCreatedAt: new Date(),
    localUpdatedAt: new Date(),
  });
  
  // 2. Sync queue ga qo'shish
  await syncManager.addToQueue('product', 'create', {
    ...product,
    localId,
  });
  
  // 3. UI ni yangilash
  toast.success('Mahsulot qo\'shildi (offline)');
  
  return localId;
};
```

### 2. **Offline Savdo:**

```typescript
const createOfflineSale = async (sale: SaleInput) => {
  // 1. Offline ID yaratish
  const offlineId = generateUUID();
  
  // 2. Mahalliy saqlash
  const localId = await offlineDB.sales.add({
    ...sale,
    offlineId,
    synced: false,
    offlineCreatedAt: new Date(),
  });
  
  // 3. Ombor yangilash (mahalliy)
  for (const item of sale.items) {
    const product = await offlineDB.products.get(item.productId);
    if (product) {
      await offlineDB.products.update(product.id!, {
        stock: product.stock - item.quantity,
      });
    }
  }
  
  // 4. Sync queue ga qo'shish
  await syncManager.addToQueue('sale', 'create', {
    ...sale,
    offlineId,
  });
  
  // 5. Chek chop etish
  await printOfflineReceipt({ ...sale, offlineId });
  
  toast.success('Savdo yaratildi (offline)');
  
  return { localId, offlineId };
};
```

---

## 🔀 Conflict Resolution

### 1. **Konflikt Turlari:**

- **Update Conflict:** Bir xil ma'lumot server va clientda o'zgartirilgan
- **Delete Conflict:** Server da o'chirilgan, clientda yangilangan
- **Create Conflict:** Bir xil SKU bilan mahsulot yaratilgan

### 2. **Konflikt Hal Qilish Strategiyalari:**

```typescript
enum ConflictResolution {
  SERVER_WINS = 'server_wins',     // Server g'olib
  CLIENT_WINS = 'client_wins',     // Client g'olib
  MERGE = 'merge',                 // Birlashtirish
  ASK_USER = 'ask_user',           // Foydalanuvchidan so'rash
}

const resolveConflict = async (
  serverData: any,
  clientData: any,
  strategy: ConflictResolution
) => {
  switch (strategy) {
    case ConflictResolution.SERVER_WINS:
      return serverData;
    
    case ConflictResolution.CLIENT_WINS:
      return clientData;
    
    case ConflictResolution.MERGE:
      return {
        ...serverData,
        ...clientData,
        updatedAt: new Date(),
      };
    
    case ConflictResolution.ASK_USER:
      const choice = await showConflictDialog(serverData, clientData);
      return choice === 'server' ? serverData : clientData;
  }
};
```

---

## 📊 Offline Statistika

### 1. **Offline Savdolar Statistikasi:**

```typescript
const getOfflineStats = async () => {
  const sales = await offlineDB.sales.toArray();
  
  const synced = sales.filter(s => s.synced).length;
  const pending = sales.filter(s => !s.synced).length;
  
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  
  return {
    total: sales.length,
    synced,
    pending,
    totalRevenue,
  };
};
```

### 2. **Sync Holati:**

```typescript
const getSyncStatus = async () => {
  const products = await offlineDB.products.where('synced').equals(false).count();
  const sales = await offlineDB.sales.where('synced').equals(false).count();
  const customers = await offlineDB.customers.where('synced').equals(false).count();
  
  return {
    products,
    sales,
    customers,
    total: products + sales + customers,
  };
};
```

---

## 🧹 Ma'lumotlarni Tozalash

### 1. **Eski Ma'lumotlarni O'chirish:**

```typescript
const cleanupOldData = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // 30 kundan eski sync qilingan savdolarni o'chirish
  await offlineDB.sales
    .where('synced')
    .equals(true)
    .and(sale => sale.syncedAt! < thirtyDaysAgo)
    .delete();
  
  console.log('[Cleanup] Old data deleted');
};
```

### 2. **Barcha Ma'lumotlarni Tozalash:**

```typescript
const clearAllData = async () => {
  const confirmed = await confirm('Barcha mahalliy ma\'lumotlarni o\'chirmoqchimisiz?');
  
  if (confirmed) {
    await offlineDB.products.clear();
    await offlineDB.sales.clear();
    await offlineDB.customers.clear();
    await offlineDB.categories.clear();
    await offlineDB.syncQueue.clear();
    
    toast.success('Barcha ma\'lumotlar tozalandi');
  }
};
```

---

## 🔐 Xavfsizlik

### 1. **Ma'lumotlar Shifrlash:**

```typescript
// IndexedDB ma'lumotlarini shifrlash (agar kerak bo'lsa)
const encryptData = (data: any, key: string) => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

const decryptData = (encrypted: string, key: string) => {
  const bytes = CryptoJS.AES.decrypt(encrypted, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};
```

### 2. **Foydalanuvchi Autentifikatsiyasi:**

```typescript
// Faqat autentifikatsiya qilingan foydalanuvchi ma'lumotlarini ko'rish
const getUserProducts = async (userId: string) => {
  return await offlineDB.products
    .where('userId')
    .equals(userId)
    .toArray();
};
```

---

## 📱 Service Worker

### 1. **Service Worker Registration:**

```typescript
// Service Worker ni ro'yxatdan o'tkazish
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('[SW] Registered:', registration);
    })
    .catch(error => {
      console.error('[SW] Registration failed:', error);
    });
}
```

### 2. **Background Sync:**

```typescript
// Service Worker da background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncSales());
  }
});

// Client da background sync so'rash
const requestBackgroundSync = async () => {
  const registration = await navigator.serviceWorker.ready;
  await registration.sync.register('sync-sales');
};
```

---

## 🎯 Best Practices

### 1. **Optimistik UI:**
```typescript
// Operatsiyani darhol UI da ko'rsatish, keyin serverga yuborish
const optimisticUpdate = async (product: Product) => {
  // 1. UI ni darhol yangilash
  setProducts(prev => [...prev, product]);
  
  // 2. Serverga yuborish
  try {
    await api.post('/api/products', product);
  } catch (error) {
    // 3. Xato bo'lsa, UI ni qaytarish
    setProducts(prev => prev.filter(p => p.id !== product.id));
    toast.error('Xatolik yuz berdi');
  }
};
```

### 2. **Debounce Sync:**
```typescript
// Tez-tez sync qilmaslik uchun debounce
const debouncedSync = debounce(() => {
  syncManager.syncAll();
}, 5000); // 5 soniya
```

### 3. **Batch Operations:**
```typescript
// Ko'p operatsiyalarni bir vaqtda bajarish
const batchSync = async (items: any[]) => {
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(item => syncItem(item)));
  }
};
```

---

## 📊 Monitoring va Debugging

### 1. **Sync Logs:**
```typescript
const logSync = (type: string, action: string, data: any) => {
  console.log(`[Sync] ${type} ${action}:`, data);
  
  // Server ga log yuborish (agar kerak bo'lsa)
  api.post('/api/logs', {
    type: 'sync',
    action,
    data,
    timestamp: new Date(),
  });
};
```

### 2. **Performance Monitoring:**
```typescript
const measureSyncPerformance = async () => {
  const start = performance.now();
  
  await syncManager.syncAll();
  
  const end = performance.now();
  const duration = end - start;
  
  console.log(`[Sync] Duration: ${duration}ms`);
};
```

---

**Yaratilgan:** 2025-02-10
**Versiya:** 1.0.0
**Muallif:** AvtoFix Development Team
