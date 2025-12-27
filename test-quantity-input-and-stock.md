# Test: Quantity Input va Ombor Real-time Yangilanishi

## O'zgarishlar
✅ Focus bo'lganda hozirgi qiymat ko'rsatiladi (0 bo'lsa ham)
✅ Ombor ustuni real-time yangilanadi (stock - quantity)

## Test Qadamlari

### 1. Mahsulot Qo'shish
- Stock = 5 bo'lgan mahsulot qo'shing
- Kassaga 1 ta qo'shiladi
- Ombor ustunida **4** ko'rinishi kerak (5-1=4)

### 2. Quantity Input Testi
- "Soni" inputiga bosing (focus)
- **1** ko'rinishi kerak (hozirgi quantity)
- **3** deb yozing
- Ombor ustunida **2** ko'rinishi kerak (5-3=2)

### 3. Kutilayotgan Ko'rinish
```
┌─────────────────────────────────────┐
│ Kod │ Mahsulot │ Ombor │ Soni │ ... │
├─────────────────────────────────────┤
│  1  │ Амортиз. │   2   │  3   │ ... │  ✅
└─────────────────────────────────────┘
```

### 4. Turli Holatlar
- **Stock = 5, Quantity = 1**: Ombor = **4**
- **Stock = 5, Quantity = 3**: Ombor = **2**
- **Stock = 5, Quantity = 5**: Ombor = **0**
- **Stock = 5, Quantity = 7**: Ombor = **0** (manfiy emas)

## Focus Testi
- Input bo'sh ko'rinadi (placeholder "Soni")
- Focus bo'lganda hozirgi qiymat ko'rsatiladi
- 0 bo'lsa ham "0" ko'rsatiladi
- Focus yo'qolganda yana bo'sh ko'rsatiladi

## Real-time Yangilanish
- Quantity o'zgarganda ombor darhol yangilanadi
- Foydalanuvchi qancha qolishini ko'radi
- Manfiy qiymatlar 0 ga aylanadi

## Texnik Tafsilotlar
```javascript
// Focus:
const currentValue = String(value); // 0 bo'lsa ham ko'rsatish

// Ombor:
const calculatedStock = (item.stock || 0) - item.quantity;
const currentStock = Math.max(0, calculatedStock);
```