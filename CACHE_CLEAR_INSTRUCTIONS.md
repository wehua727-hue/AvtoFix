# ⚡ CACHE TOZALASH YO'RIQNOMASI

## 🎯 Muammo
- Kod o'zgartirildi lekin hali ham eski ko'rinish
- "Soni" ustunida default qiymat ko'rsatilmoqda
- Browser cache muammosi

## 🚀 TEZKOR YECHIM

### 1. Hard Refresh (ENG OSON)
```
Ctrl + F5 bosing (Windows)
yoki
Ctrl + Shift + R bosing
```

### 2. Developer Console orqali
1. **F12** bosing
2. **Console** tabiga o'ting
3. Quyidagi kodni kiriting va **Enter** bosing:

```javascript
// Barcha cache ni tozalash
localStorage.clear();
sessionStorage.clear();
if ('caches' in window) {
  caches.keys().then(names => names.forEach(name => caches.delete(name)));
}
location.reload(true);
```

### 3. Manual Tozalash
1. **Ctrl + Shift + Delete** bosing
2. **"Cached images and files"** ni tanlang
3. **"Clear data"** bosing
4. Sahifani yangilang

## 🔧 TEXNIK YECHIM

Agar yuqoridagilar ishlamasa, quyidagi amallarni bajaring:

### A. Browser ni Butunlay Qayta Ishga Tushirish
1. Browser ni yoping
2. 5 soniya kuting
3. Qayta oching
4. Sahifaga o'ting

### B. Incognito Mode da Sinash
1. **Ctrl + Shift + N** bosing (Chrome)
2. Yangi incognito oynada saytni oching
3. Agar u yerda ishlasa - cache muammosi

### C. Browser Settings dan Tozalash
**Chrome:**
1. Settings > Privacy and security
2. Clear browsing data
3. "Cached images and files" tanlash
4. Clear data

## ✅ KUTILAYOTGAN NATIJA

Cache tozalangandan keyin:
- ✅ "Soni" ustunida faqat "Soni" placeholder
- ✅ Hech qanday default raqam yo'q
- ✅ Input bo'sh ko'rinadi
- ✅ Focus bo'lganda ham bo'sh

## 🆘 AGAR HALI HAM ISHLAMASA

1. **Ctrl + F5** ni 3 marta bosing
2. Browser ni butunlay yoping va qayta oching
3. Boshqa browser da sinab ko'ring (Firefox, Edge)
4. Kompyuterni qayta ishga tushiring (oxirgi chora)

## 📞 YORDAM

Agar hali ham muammo bo'lsa, quyidagi ma'lumotlarni bering:
- Browser nomi va versiyasi
- Qaysi amallar bajarildi
- Screenshot (agar mumkin bo'lsa)