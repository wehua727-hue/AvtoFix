/**
 * Browser Cache ni Butunlay Tozalash
 * 
 * Bu script barcha cache larni tozalaydi:
 * - localStorage
 * - sessionStorage
 * - IndexedDB
 * - Service Worker
 */

console.log('🧹 Browser cache ni tozalash...');

// 1. localStorage tozalash
try {
  localStorage.clear();
  console.log('✅ localStorage tozalandi');
} catch (e) {
  console.log('❌ localStorage tozalashda xatolik:', e.message);
}

// 2. sessionStorage tozalash
try {
  sessionStorage.clear();
  console.log('✅ sessionStorage tozalandi');
} catch (e) {
  console.log('❌ sessionStorage tozalashda xatolik:', e.message);
}

// 3. IndexedDB tozalash
if ('indexedDB' in window) {
  try {
    // Barcha database larni o'chirish
    indexedDB.databases().then(databases => {
      databases.forEach(db => {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
          console.log('✅ IndexedDB tozalandi:', db.name);
        }
      });
    });
  } catch (e) {
    console.log('❌ IndexedDB tozalashda xatolik:', e.message);
  }
}

// 4. Service Worker tozalash
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      console.log('✅ Service Worker tozalandi');
    });
  });
}

// 5. Cache API tozalash
if ('caches' in window) {
  caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
      caches.delete(cacheName);
      console.log('✅ Cache API tozalandi:', cacheName);
    });
  });
}

console.log('🎉 Barcha cache lar tozalandi!');
console.log('📝 Endi sahifani yangilang: Ctrl+F5 yoki F5');

// Sahifani avtomatik yangilash (5 soniya kutish)
setTimeout(() => {
  console.log('🔄 Sahifa avtomatik yangilanmoqda...');
  window.location.reload(true);
}, 5000);