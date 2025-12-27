# Test: Ombor Ustunida Manfiy Qiymat Tuzatish

## Muammo
- Omborda 0 ta mahsulot
- Kassaga 1 ta qo'shilganda
- Ombor ustunida -1 ko'rsatilmoqda ❌

## Yechim
✅ `Math.max(0, calculatedStock)` qo'shildi
✅ Manfiy qiymatlar 0 ga o'zgartiriladi

## Test Qadamlari

### 1. 0 Stock Mahsulot Qo'shish
- SKU "1" ni kiriting (stock = 0)
- Mahsulot kassaga qo'shiladi
- Ombor ustunida **0** ko'rinishi kerak (endi -1 emas)

### 2. Kutilayotgan Ko'rinish
```
┌─────────────────────────────────────┐
│ Kod │ Mahsulot │ Ombor │ Soni │ ... │
├─────────────────────────────────────┤
│  1  │ Гидро... │   0   │  1   │ ... │  ✅
└─────────────────────────────────────┘
```

### 3. Turli Holatlar
- **Stock = 0, Quantity = 1**: Ombor = 0 (eski: -1)
- **Stock = 5, Quantity = 3**: Ombor = 2
- **Stock = 2, Quantity = 5**: Ombor = 0 (eski: -3)

## Rang Kodlari
- **0**: Qizil rang (text-red-400)
- **1-5**: Sariq rang (text-yellow-400)  
- **6+**: Yashil rang (text-emerald-400)

## Texnik Tafsilotlar
```javascript
const calculatedStock = isRefundMode 
  ? (item.stock || 0) + item.quantity 
  : (item.stock || 0) - item.quantity;
const currentStock = Math.max(0, calculatedStock); // ✅ Manfiy yo'q
```