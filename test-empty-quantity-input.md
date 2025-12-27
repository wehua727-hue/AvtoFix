# Test: Butunlay Bo'sh Quantity Input

## Muammo
- Quantity input da hali ham "1" default ko'rsatilmoqda
- Foydalanuvchi hech qanday son ko'rishni xohlamaydi

## Yechim
✅ Value dependency olib tashlandi
✅ onFocus da ham bo'sh qoldirish
✅ Har doim faqat placeholder "Soni"

## Test Qadamlari

### 1. Mahsulot Qo'shish
- Biror mahsulotni kassaga qo'shing
- "Soni" ustunida faqat placeholder ko'rinishi kerak
- Hech qanday raqam ko'rinmasligi kerak

### 2. Focus Testi
- Input ustiga bosing
- Bo'sh input ochilishi kerak
- Hech qanday default qiymat yo'q
- Foydalanuvchi o'zi yozishi kerak

### 3. Kutilayotgan Ko'rinish
```
┌─────────────────────────────────────┐
│ Kod │ Mahsulot │ Ombor │ Soni │ ... │
├─────────────────────────────────────┤
│  1  │ Амортиз. │   4   │[Soni]│ ... │  ✅
└─────────────────────────────────────┘
```

### 4. Foydalanuvchi Tajribasi
- ✅ Hech qanday default qiymat yo'q
- ✅ Faqat placeholder "Soni"
- ✅ Focus bo'lganda bo'sh
- ✅ Foydalanuvchi o'zi yozadi

## Texnik O'zgarishlar
```javascript
// Value dependency olib tashlandi:
useEffect(() => {
  // value ni e'tiborsiz qoldirish
}, [isFocused, externalValue]); // value yo'q

// onFocus da bo'sh qoldirish:
onFocus={() => {
  setLocalValue(''); // har doim bo'sh
}}
```

## Kutilayotgan Natija
- Input har doim bo'sh ko'rinadi
- Placeholder "Soni" yozuvi
- Focus bo'lganda ham bo'sh
- Foydalanuvchi o'zi quantity yozadi