/**
 * IndexedDB ni butunlay tozalash
 * Bu faqat development uchun - production da ishlatmaslik
 */

export async function clearAllIndexedDB() {
  try {
    console.log('[Clear IndexedDB] Starting cleanup...');
    
    // 1. Barcha IndexedDB bazalarini olish
    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases();
      console.log('[Clear IndexedDB] Found databases:', databases.map(db => db.name));
      
      // 2. Har bir bazani o'chirish
      for (const db of databases) {
        if (db.name) {
          console.log(`[Clear IndexedDB] Deleting database: ${db.name}`);
          const deleteReq = indexedDB.deleteDatabase(db.name);
          
          await new Promise((resolve, reject) => {
            deleteReq.onsuccess = () => {
              console.log(`[Clear IndexedDB] ✅ Deleted: ${db.name}`);
              resolve(true);
            };
            deleteReq.onerror = () => {
              console.error(`[Clear IndexedDB] ❌ Failed to delete: ${db.name}`);
              reject(deleteReq.error);
            };
            deleteReq.onblocked = () => {
              console.warn(`[Clear IndexedDB] ⚠️ Blocked: ${db.name} (close all tabs)`);
              reject(new Error('Database deletion blocked'));
            };
          });
        }
      }
    } else {
      // Fallback - ma'lum bazalarni o'chirish
      const knownDatabases = ['OfflineDB', 'products', 'sales', 'kassa'];
      for (const dbName of knownDatabases) {
        try {
          console.log(`[Clear IndexedDB] Trying to delete: ${dbName}`);
          const deleteReq = indexedDB.deleteDatabase(dbName);
          await new Promise((resolve) => {
            deleteReq.onsuccess = () => {
              console.log(`[Clear IndexedDB] ✅ Deleted: ${dbName}`);
              resolve(true);
            };
            deleteReq.onerror = () => {
              console.log(`[Clear IndexedDB] ❌ Not found or failed: ${dbName}`);
              resolve(false);
            };
            deleteReq.onblocked = () => {
              console.warn(`[Clear IndexedDB] ⚠️ Blocked: ${dbName}`);
              resolve(false);
            };
          });
        } catch (err) {
          console.error(`[Clear IndexedDB] Error deleting ${dbName}:`, err);
        }
      }
    }
    
    // 3. LocalStorage ni ham tozalash (cache keys)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('product') || 
        key.includes('cache') || 
        key.includes('offline') ||
        key.includes('sync')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[Clear IndexedDB] Removed localStorage key: ${key}`);
    });
    
    console.log('[Clear IndexedDB] ✅ Cleanup completed!');
    console.log('[Clear IndexedDB] Please refresh the page to reload data from MongoDB');
    
    return true;
    
  } catch (error) {
    console.error('[Clear IndexedDB] Error:', error);
    return false;
  }
}

// Global function for console access
if (typeof window !== 'undefined') {
  (window as any).clearIndexedDB = clearAllIndexedDB;
  console.log('[Clear IndexedDB] Available as window.clearIndexedDB()');
}