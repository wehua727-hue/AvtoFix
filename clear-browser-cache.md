# Browser Cache ni Tozalash

## Muammo
- Kod o'zgartirildi lekin hali ham eski ko'rinish
- Browser cache muammosi
- Default qiymat hali ham ko'rsatilmoqda

## Yechimlar

### 1. Hard Refresh (Eng Oson)
- **Ctrl + F5** bosing (Windows)
- **Cmd + Shift + R** bosing (Mac)
- Yoki **Ctrl + Shift + R** (Windows)

### 2. Browser Cache ni Tozalash
1. **F12** bosib Developer Tools ochish
2. **Network** tabiga o'tish
3. **Disable cache** checkboxni belgilash
4. Sahifani yangilash

### 3. Manual Cache Tozalash
1. **Ctrl + Shift + Delete** bosish
2. **Cached images and files** tanlash
3. **Clear data** bosish

### 4. Incognito/Private Mode
- **Ctrl + Shift + N** (Chrome)
- **Ctrl + Shift + P** (Firefox)
- Yangi incognito oynada sinash

## Texnik Yechim
Agar cache muammosi davom etsa, men quyidagi o'zgarishlarni qilaman:

### Cache Headers qo'shish
```typescript
// API chaqiruvlarga cache-busting qo'shish
const timestamp = Date.now();
const url = `/api/products?_t=${timestamp}`;
```

### Service Worker tozalash
```javascript
// Service worker ni unregister qilish
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
}
```

## Kutilayotgan Natija
Hard refresh dan keyin:
- ✅ "Soni" ustunida faqat placeholder
- ✅ Hech qanday default qiymat yo'q
- ✅ Bo'sh input ko'rinadi

## Qo'shimcha
Agar hali ham muammo bo'lsa:
1. Browser ni butunlay yoping
2. Qayta oching
3. Sahifani yangilang