import { Product, SyncRecord } from '@shared/types';

const DB_NAME = 'OflaynDokon';
const DB_VERSION = 1;
const PRODUCTS_STORE = 'products';
const SYNC_QUEUE_STORE = 'syncQueue';

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      console.log('[IndexedDB] Database initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Products store
      if (!database.objectStoreNames.contains(PRODUCTS_STORE)) {
        const productStore = database.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' });
        productStore.createIndex('synced', 'synced', { unique: false });
        productStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[IndexedDB] Products store created');
      }

      // Sync queue store
      if (!database.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = database.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
        syncStore.createIndex('synced', 'synced', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[IndexedDB] Sync queue store created');
      }
    };
  });
}

export async function getDB(): Promise<IDBDatabase> {
  if (!db) {
    db = await initDB();
  }
  return db;
}

// PRODUCTS OPERATIONS
export async function addProduct(product: Product): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE], 'readwrite');
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.add({
      ...product,
      synced: false,
      timestamp: Date.now(),
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Product added:', product.id);
      resolve();
    };
  });
}

export async function updateProduct(product: Product): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE], 'readwrite');
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.put({
      ...product,
      synced: false,
      timestamp: Date.now(),
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Product updated:', product.id);
      resolve();
    };
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE], 'readwrite');
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.delete(productId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Product deleted:', productId);
      resolve();
    };
  });
}

export async function getProduct(productId: string): Promise<Product | undefined> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.get(productId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllProducts(): Promise<Product[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getUnsyncedProducts(): Promise<Product[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTS_STORE);
    const index = store.index('synced');
    const request = index.getAll(false);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function markProductSynced(productId: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE], 'readwrite');
    const store = transaction.objectStore(PRODUCTS_STORE);
    const getRequest = store.get(productId);

    getRequest.onsuccess = () => {
      const product = getRequest.result;
      if (product) {
        product.synced = true;
        const updateRequest = store.put(product);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => {
          console.log('[IndexedDB] Product marked as synced:', productId);
          resolve();
        };
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function markProductsSynced(productIds: string[]): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE], 'readwrite');
    const store = transaction.objectStore(PRODUCTS_STORE);

    let completed = 0;
    let hasError = false;

    productIds.forEach((id) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        if (!hasError) {
          const product = getRequest.result;
          if (product) {
            product.synced = true;
            const updateRequest = store.put(product);
            updateRequest.onerror = () => {
              hasError = true;
              reject(updateRequest.error);
            };
          }
          completed++;
          if (completed === productIds.length && !hasError) {
            console.log('[IndexedDB] Marked', productIds.length, 'products as synced');
            resolve();
          }
        }
      };

      getRequest.onerror = () => {
        hasError = true;
        reject(getRequest.error);
      };
    });

    if (productIds.length === 0) {
      resolve();
    }
  });
}

// SYNC QUEUE OPERATIONS
export async function addToSyncQueue(record: SyncRecord): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.add(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Added to sync queue:', record.id);
      resolve();
    };
  });
}

export async function getSyncQueue(): Promise<SyncRecord[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SYNC_QUEUE_STORE], 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function removeSyncQueueItem(recordId: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.delete(recordId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Removed from sync queue:', recordId);
      resolve();
    };
  });
}

export async function clearDatabase(): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTS_STORE, SYNC_QUEUE_STORE], 'readwrite');

    const productsStore = transaction.objectStore(PRODUCTS_STORE);
    const syncStore = transaction.objectStore(SYNC_QUEUE_STORE);

    const productsRequest = productsStore.clear();
    const syncRequest = syncStore.clear();

    productsRequest.onerror = () => reject(productsRequest.error);
    syncRequest.onerror = () => reject(syncRequest.error);

    transaction.oncomplete = () => {
      console.log('[IndexedDB] Database cleared');
      resolve();
    };
  });
}
