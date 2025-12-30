# Test: Ombor Ustuni - Hozirgi Stock Ko'rsatish

## Muammo
- Mahsulot stock = 5
- Kassaga 1 ta qo'shilganda
- Ombor ustunida 4 ko'rsatilmoqda (5-1=4) ❌
- Lekin foydalanuvchi hozirgi ombordagi sonni ko'rishni xohlaydi

## Yechim
✅ Ombor ustunida faqat `item.stock` ko'rsatiladi
✅ Kassaga qo'shilgan quantity hisobga olinmaydi
✅ Hozirgi ombordagi son ko'rsatiladi

## Test Qadamlari

### 1. Stock = 5 Mahsulot Qo'shish
- Mahsulot stock = 5
- Kassaga 1 ta qo'shish
- Ombor ustunida **5** ko'rinishi kerak (eski: 4)

### 2. Kutilayotgan Ko'rinish
```
┌─────────────────────────────────────┐
│ Kod │ Mahsulot │ Ombor │ Soni │ ... │
├─────────────────────────────────────┤
│  1  │ Амортиз. │   5   │  1   │ ... │  ✅
└─────────────────────────────────────┘
```

### 3. Turli Holatlar
- **Stock = 5, Quantity = 1**: Ombor = **5** ✅
- **Stock = 0, Quantity = 1**: Ombor = **0** ✅
- **Stock = 10, Quantity = 3**: Ombor = **10** ✅

## Mantiq
- **Ombor ustuni**: Hozirgi ombordagi son
- **Soni ustuni**: Kassaga qo'shilgan miqdor
- **Sotishdan keyin**: Stock yangilanadi (server tomonida)

## Rang Kodlari
- **0**: Qizil rang (tugagan)
- **1-5**: Sariq rang (kam)
- **6+**: Yashil rang (yetarli)

## Texnik Tafsilotlar
```javascript
// AVVAL (noto'g'ri):
const currentStock = (item.stock || 0) - item.quantity; // 5-1=4

// HOZIR (to'g'ri):
const currentStock = item.stock || 0; // 5
```