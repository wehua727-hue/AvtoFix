# Test: Yakuniy Quantity Input - Butunlay Bo'sh

## O'zgarishlar
✅ Murakkab state management olib tashlandi
✅ `defaultValue=""` ishlatildi
✅ `value={localValue}` o'rniga `defaultValue=""`
✅ Focus/blur da to'g'ridan-to'g'ri tozalash

## Test Qadamlari

### 1. Mahsulot Qo'shish
- Biror mahsulotni kassaga qo'shing
- "Soni" ustunida faqat placeholder ko'rinishi kerak
- Hech qanday raqam ko'rinmasligi kerak

### 2. Input Testi
- Input ustiga bosing (focus)
- Bo'sh input ochilishi kerak
- Raqam yozing (masalan: 3)
- Blur bo'lganda yana bo'sh ko'rinishi kerak

### 3. Kutilayotgan Ko'rinish
```
┌─────────────────────────────────────┐
│ Kod │ Mahsulot │ Ombor │ Soni │ ... │
├─────────────────────────────────────┤
│  1  │ Амортиз. │   2   │[Soni]│ ... │  ✅
└─────────────────────────────────────┘
```

## Texnik Tafsilotlar
```javascript
// AVVAL (murakkab):
const [localValue, setLocalValue] = useState('');
value={localValue}
useEffect(() => { ... })

// HOZIR (sodda):
defaultValue=""
onFocus={(e) => e.target.value = ''}
onBlur={(e) => e.target.value = ''}
```

## Xususiyatlar
- ✅ Har doim bo'sh placeholder
- ✅ Hech qanday default qiymat yo'q
- ✅ Sodda va ishonchli
- ✅ State management yo'q
- ✅ Focus/blur da avtomatik tozalash

## Kutilayotgan Natija
- Input har doim bo'sh ko'rinadi
- Faqat "Soni" placeholder
- Hech qachon default raqam ko'rsatilmaydi