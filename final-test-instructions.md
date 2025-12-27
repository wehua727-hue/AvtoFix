# Final Test Instructions - Stock Management Fix

## 🧪 Test qilish uchun qadamlar:

### Test 1: Stock 0 bo'lgan mahsulotni qo'shishga urinish

1. **SKU "13" ni scan qiling** (stock: 0)
   - ❌ Kassaga qo'shilmasligi kerak
   - ✅ "Omborda yetarli emas" xabari chiqishi kerak

### Test 2: Stock bor mahsulotni to'liq sotish

1. **SKU "5" ni scan qiling** (stock: 5)
   - ✅ Kassaga qo'shilishi kerak
   - ✅ Stock: 5 ko'rsatilishi kerak

2. **5 ta sotish**:
   - Quantity: 5 ga o'rnating
   - "To'lov" tugmasini bosing
   - Sotishni yakunlang

3. **Natijani tekshirish**:
   - MongoDB da stock: 0 bo'lishi kerak
   - Cache yangilanishi kerak

4. **Qayta scan qilish**:
   - SKU "5" ni yana scan qiling
   - ❌ Kassaga qo'shilmasligi kerak (stock: 0)
   - ✅ "Omborda yetarli emas" xabari chiqishi kerak

### Test 3: MongoDB sinxronizatsiyasi

1. **Boshqa device dan** mahsulot stock ini o'zgartiring
2. **WebSocket orqali** yangilanish kelishi kerak
3. **Cache avtomatik yangilanishi** kerak

## 🎯 Kutilgan natijalar:

### ✅ Muvaffaqiyatli holatlar:
- Stock > 0: Kassaga qo'shiladi
- Stock = 0: Kassaga qo'shilmaydi
- Sotish: Stock kamayadi va MongoDB ga saqlanadi
- Cache: Har doim fresh ma'lumotlar
- InitialStock: Hech qachon ishlatilmaydi (undefined)

### ❌ Xato holatlar (endi bo'lmasligi kerak):
- Stock 0 bo'lsa ham qo'shilishi
- Stock qaytib ketishi (5 → 0 → 5)
- Cache eski ma'lumotlar ko'rsatishi
- InitialStock fallback ishlashi

## 📊 Monitoring:

Console loglarida quyidagilarni kuzating:

```
✅ Yaxshi loglar:
[Kassa] Product stock: 5 initialStock: undefined
[useOfflineKassa] ✅ Stock updated successfully
[useOfflineKassa] 🔄 Products reloaded from MongoDB

❌ Yomon loglar (bo'lmasligi kerak):
[Kassa] Product stock: 0 initialStock: 0
initialStock: 5 (fallback ishlayapti)
```

## 🔧 Agar muammo bo'lsa:

1. Browser cache ni tozalang
2. `node check-sku5.cjs` - MongoDB holatini tekshiring
3. Console loglarni tekshiring
4. Network tab da API chaqiruvlarni kuzating

**Maqsad**: Barcha ma'lumotlar faqat MongoDB da saqlanishi va real-time yangilanishi!