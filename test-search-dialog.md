# Test: Qidiruv Dialogida 0 Stock Mahsulotlar

## Hozirgi Holat
✅ SKU "1" to'g'ri topildi (barcode/numpad orqali)
✅ 0 stock xabari ko'rsatildi
❓ Qidiruv dialogida ko'rinadimi?

## Test Qadamlari

### 1. Qidiruv Dialogini Ochish
- **F3** tugmasini bosing YOKI
- **"Qidirish"** tugmasini bosing (qizil tugma)

### 2. SKU "1" ni Qidirish
- Qidiruv maydoniga **"1"** yozing
- Yoki **"Гидромуфта"** deb qidiring

### 3. Kutilayotgan Natija
✅ Mahsulot ko'rinishi kerak
✅ **"TUGAGAN"** yozuvi bilan
✅ Qizil rangda
✅ 🚫 belgisi bilan
✅ Bosganda "omborda mavjud emas" xabari

## Agar Ko'rinmasa
Quyidagi loglar chiqishi kerak:
```
[useOfflineKassa] REAL-TIME SEARCH: 1
[useOfflineKassa] REAL-TIME SEARCH results: [raqam]
```

## Console Tekshirish
Browser console da quyidagi buyruqni bajaring:
```javascript
// Qidiruv natijalarini ko'rish
console.log("Search results:", window.searchResults);
```

## Muammo Bo'lsa
Agar qidiruv natijalarida ko'rinmasa:
1. `useOfflineKassa.ts` da search funksiyasini tekshirish
2. `mainStock > 0` filtri olib tashlanganini tasdiqlash
3. Console loglarni kuzatish