# Qaytarish Validatsiyasi Test Qo'llanmasi

## ✅ Hozirgi holat
- Server API to'g'ri initialStock qiymatlarini yubormoqda
- Client tomonida initialStock qiymatlari to'g'ri qabul qilinmoqda
- Qaytarish validatsiyasi kodi mavjud va to'g'ri

## 🧪 Test qilish uchun:

### 1. Qaytarish rejimini yoqish
- Kassa sahifasida "Qaytarish rejimi" tugmasini bosing
- Rejim yoniq bo'lganini tekshiring (toggle yashil bo'lishi kerak)

### 2. Mahsulot qo'shish va test qilish
- SKU "1" mahsulotini qo'shing (Амортизатор основной 6520 ZTD)
- Bu mahsulotning: Stock=2, InitialStock=2
- Demak, 0 ta sotilgan (2-2=0), shuning uchun qaytarish mumkin emas

### 3. Validatsiya test qilish
- Quantity ni 1 ga o'zgartiring
- Xato xabari chiqishi kerak: "0 tadan ortiq qaytara olmaysiz"

### 4. Boshqa mahsulotlar bilan test
- SKU "10" (Stock=3, InitialStock=3) - 0 ta sotilgan
- SKU "11" (Stock=2, InitialStock=2) - 0 ta sotilgan

## 📝 Kutilayotgan natijalar:
1. Qaytarish rejimida mahsulotlar ko'rinishi kerak
2. Quantity o'zgartirganda validatsiya ishlashi kerak
3. Sotilmagan mahsulotlar uchun qaytarish mumkin emas xabari
4. Console da validation loglari ko'rinishi kerak

## 🔍 Debug uchun:
- Browser console ni oching
- `[REFUND VALIDATION]` loglarini kuzating
- Event dispatch va toast notification loglarini tekshiring