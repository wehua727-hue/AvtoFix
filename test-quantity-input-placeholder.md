# Test: Quantity Input Placeholder

## O'zgarishlar
✅ Default qiymat olib tashlandi
✅ Har doim bo'sh ko'rsatiladi
✅ Placeholder "Soni" qo'yildi
✅ Focus bo'lganda faqat mavjud qiymat ko'rsatiladi

## Test Qadamlari

### 1. Mahsulot Qo'shish
- SKU "1" ni kiriting
- Mahsulot kassaga qo'shiladi
- "Soni" ustunida bo'sh input ko'rinadi
- Placeholder "Soni" yozuvi bilan

### 2. Input Testlari
- Input ustiga bosing (focus)
- Agar quantity > 0 bo'lsa, qiymat ko'rsatiladi
- Agar quantity = 0 bo'lsa, bo'sh qoladi
- Focus yo'qolganda har doim bo'sh ko'rsatiladi

### 3. Kutilayotgan Ko'rinish
```
┌─────────────────────────────────────┐
│ Kod │ Mahsulot │ Ombor │ Soni │ ... │
├─────────────────────────────────────┤
│  1  │ Гидро... │   0   │[Soni]│ ... │
└─────────────────────────────────────┘
```

## Xususiyatlar
- ✅ Hech qanday default qiymat yo'q
- ✅ Bo'sh placeholder "Soni"
- ✅ Focus bo'lganda mavjud qiymat ko'rsatiladi
- ✅ Focus yo'qolganda bo'sh qoladi
- ✅ Foydalanuvchi tajribasi yaxshilandi

## Texnik Tafsilotlar
- `useState('')` - har doim bo'sh
- `placeholder="Soni"` - tushunarli placeholder
- `onFocus` - faqat mavjud qiymat ko'rsatish
- `onBlur` - har doim bo'sh qoldirish