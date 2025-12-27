# Test: 0 Stock Mahsulotlar Qidiruvda Ko'rinishi

## Maqsad
Foydalanuvchi so'rovi: "omborda 0 ta qolsa ham kassaga chaqirganda topib bersin lekin sotib bo'lmasin"

## O'zgarishlar
1. **useOfflineKassa.ts**: Search funksiyasida 0 stock mahsulotlarni ham ko'rsatish
2. **Kassa.tsx**: 0 stock mahsulotlar uchun visual indicator va click prevention

## Test Qadamlari

### 1. Qidiruv Testi
- Kassani oching
- Biror mahsulot nomini qidiring
- 0 stock mahsulotlar ham ko'rinishi kerak
- Ular "TUGAGAN" yozuvi bilan belgilanishi kerak
- Qizil rangda va 🚫 belgisi bilan ko'rinishi kerak

### 2. Click Prevention Testi
- 0 stock mahsulotni bosing
- "omborda mavjud emas (0 ta)" xabari chiqishi kerak
- Mahsulot kassaga qo'shilmasligi kerak

### 3. Qaytarish Rejimi Testi
- Qaytarish rejimiga o'ting
- 0 stock mahsulotlar oddiy ko'rinishi kerak (restriction yo'q)
- Ularni kassaga qo'shish mumkin bo'lishi kerak

## Kutilayotgan Natija
✅ 0 stock mahsulotlar qidiruvda ko'rinadi
✅ Ular visual jihatdan farqlanadi (qizil, "TUGAGAN", 🚫)
✅ Sotish rejimida ularni bosganda xabar chiqadi
✅ Kassaga qo'shilmaydi
✅ Qaytarish rejimida ishlaydi

## Texnik Tafsilotlar
- Search filter o'zgartirildi: `mainStock > 0` → barcha mahsulotlar
- Visual styling qo'shildi: `isOutOfStock` condition
- Click handler yangilandi: 0 stock uchun toast message
- Toast message: `toast.error()` ishlatildi