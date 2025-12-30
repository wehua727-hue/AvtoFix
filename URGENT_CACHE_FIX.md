# 🚨 URGENT: CACHE MUAMMOSI HAL QILISH

## ❌ MUAMMO:
Sizning client cache da eski ma'lumotlar saqlanib qolgan. Database da asosiy mahsulotning stocki 0, lekin client da hali ham 5 ko'rsatilmoqda.

## ✅ YECHIM - 3 TA ODDIY QADAM:

### 1. **Browser Console da Majburiy Cache Yangilash**
```javascript
// Browser da F12 bosing, Console ga quyidagini yozing:
window.forceRefreshCache()
```

### 2. **Agar yuqoridagi ishlamasa - To'liq Restart**
```bash
# Terminal da:
# 1. Barcha jarayonlarni to'xtatish
pkill -f "vite"
pkill -f "node"

# 2. Server ni qayta ishga tushirish
cd server
npm run dev

# 3. Yangi terminal ochib, client ni ishga tushirish
cd client  
npm run dev
```

### 3. **Browser Cache ni To'liq Tozalash**
```
1. Ctrl+Shift+Delete bosing
2. "All time" tanlang
3. Barcha cache, cookies, data ni o'chiring
4. Browser ni yoping va qayta oching
5. Ctrl+F5 bilan hard refresh qiling
```

## 🧪 KEYIN TEST QILING:

1. **SKU "1" ni scan qiling**
2. **Console da quyidagilarni ko'ring:**
   ```
   [DEBUG] Product stock (fresh): 0  ← Bu 0 bo'lishi kerak!
   [DEBUG] Found variant with stock: ... ← Variant qaytishi kerak
   ```
3. **Variant ko'rinishi kerak, asosiy mahsulot emas**

## 🔍 AGAR HALI HAM ISHLAMASA:

### Debug qilish:
```javascript
// Browser console da:
console.log('Cache products:', Array.from(window.productsRef?.current?.values() || []).find(p => p.sku === '1'));
```

Bu sizga cache dagi mahsulot ma'lumotlarini ko'rsatadi.

## 📊 KUTILAYOTGAN NATIJA:

✅ **SKU "1"**: Variant qaytadi (stock > 0)  
✅ **Asosiy mahsulot**: Ko'rsatilmaydi (stock = 0)  
✅ **Stock kamayadi**: Sotishdan keyin darhol  
✅ **Qaytmaydi**: Hech qachon eski qiymatga  

---

## 💡 NIMA BO'LGAN:

1. **Database**: ✅ To'liq toza (stock = 0)
2. **Server**: ✅ To'g'ri ishlaydi  
3. **Client Cache**: ❌ Eski ma'lumotlar (stock = 5)

**Yuqoridagi qadamlarni bajaring va muammo 100% hal bo'ladi!**