// IndexedDB ni tozalash va qayta sinxronlash uchun
// F12 > Console > bu kodni paste qiling va Enter bosing

console.log('IndexedDB ni tozalash...');

// 1. IndexedDB ni to'liq tozalash
indexedDB.deleteDatabase('OfflineDB').onsuccess = function() {
  console.log('✅ IndexedDB tozalandi');
  
  // 2. LocalStorage ni ham tozalash (cache uchun)
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('products:') || key.startsWith('categories:') || key.startsWith('offlineDB'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('✅ LocalStorage cache tozalandi');
  
  // 3. Sahifani yangilash - serverdan qayta sinxronlash
  setTimeout(() => {
    console.log('🔄 Sahifa yangilanmoqda...');
    window.location.reload();
  }, 1000);
};