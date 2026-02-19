# Lotin → Kiril Konvertatsiya - To'liq Test

## Maqsad
Excel fayldan mahsulotlarni import qilishda lotin alifbosidagi mahsulot nomlarini avtomatik aniqlash va kirilga o'girish funksiyasini test qilish.

## Muhim Qoidalar
1. **FAQAT mahsulot nomi** (`Наименование` ustuni) tekshiriladi va konvertatsiya qilinadi
2. Kod, katalog raqami, narx, kategoriya **o'zgartirilmaydi**
3. Rus tilida sarlavhalar qo'llab-quvvatlanadi
4. Aralash alifbo (lotin + kiril) ham qo'llab-quvvatlanadi

## Test Excel Fayl Namunasi

| Наименование | Код | № по каталогу | Цена | Кол-во |
|--------------|-----|---------------|------|--------|
| Zadning pavarot | Z001 | CAT-123 | 150000 | 10 |
| Dvigatel maslo | D002 | CAT-456 | 85000 | 25 |
| Тормозные колодки | T003 | CAT-789 | 120000 | 15 |
| Filtr havo | F004 | CAT-321 | 45000 | 30 |

## Kutilgan Natija

### 1. Lotin Mahsulotlar Aniqlash
Tizim quyidagi mahsulotlarni lotin deb aniqlashi kerak:
- ✅ "Zadning pavarot" → lotin
- ✅ "Dvigatel maslo" → aralash (kiril + lotin)
- ❌ "Тормозные колодки" → kiril (o'zgartirilmaydi)
- ✅ "Filtr havo" → aralash

### 2. Preview Dialog
Foydalanuvchiga quyidagi ma'lumotlar ko'rsatilishi kerak:
```
Lotin mahsulotlar: 3 ta
Kiril mahsulotlar: 1 ta

Preview:
☑ Zadning pavarot → Задниң паварот
☑ Dvigatel maslo → Двигател масло
☑ Filtr havo → Филтр ҳаво
```

### 3. Konvertatsiya Natijasi
Foydalanuvchi tanlagan mahsulotlar kirilga o'giriladi:

| Наименование | Код | № по каталогу | Цена | Кол-во |
|--------------|-----|---------------|------|--------|
| Задниң паварот | Z001 | CAT-123 | 150000 | 10 |
| Двигател масло | D002 | CAT-456 | 85000 | 25 |
| Тормозные колодки | T003 | CAT-789 | 120000 | 15 |
| Филтр ҳаво | F004 | CAT-321 | 45000 | 30 |

**Muhim:** Kod, katalog, narx o'zgarmagan!

## Test Qadamlari

### 1. Backend Serverni Ishga Tushirish
```bash
cd AvtoFix
npm run dev
```

### 2. Frontend Serverni Ishga Tushirish
```bash
cd AvtoFix
npm run dev:client
```

### 3. Brauzer Keshini Tozalash
- Chrome: `Ctrl + Shift + Delete` → "Cached images and files" → Clear
- Yoki: `Ctrl + F5` (hard refresh)

### 4. Excel Fayl Tayyorlash
Excel faylda quyidagi ustunlar bo'lishi kerak:
- `Наименование` - mahsulot nomi (rus tilida)
- `Код` - mahsulot kodi
- `№ по каталогу` - katalog raqami
- `Цена` - narx
- `Кол-во` - miqdor

### 5. Import Jarayoni
1. Mahsulotlar sahifasiga o'ting
2. "Excel Import" tugmasini bosing
3. Excel faylni tanlang
4. Tizim avtomatik lotin mahsulotlarni aniqlaydi
5. Preview dialog ochiladi
6. Kerakli mahsulotlarni tanlang
7. "Kirilga o'girish" tugmasini bosing
8. Konvertatsiya qilingan ma'lumotlar ko'rsatiladi
9. "Import" tugmasini bosing

## Tekshirish Nuqtalari

### ✅ Backend API
```bash
# 1. Preview endpoint
POST http://localhost:5175/api/excel-import/preview-latin
Body: { fileData: "base64...", columnMapping: {...} }

# Kutilgan javob:
{
  "success": true,
  "totalRows": 4,
  "latinCount": 3,
  "cyrillicCount": 1,
  "latinProducts": [
    {
      "originalName": "Zadning pavarot",
      "cyrillicName": "Задниң паварот",
      "code": "Z001",
      "catalogNumber": "CAT-123",
      "price": 150000
    },
    ...
  ]
}

# 2. Convert endpoint
POST http://localhost:5175/api/excel-import/convert-latin-to-cyrillic
Body: { fileData: "base64...", selectedRowIndices: [1, 2, 4], columnMapping: {...} }

# Kutilgan javob:
{
  "success": true,
  "convertedCount": 3,
  "convertedData": [...]
}
```

### ✅ Frontend UI
1. **Excel Import Modal** ochilishi kerak
2. **Lotin mahsulotlar aniqlanganda** preview dialog avtomatik ochilishi kerak
3. **Preview Dialog** da:
   - Lotin mahsulotlar ro'yxati ko'rsatilishi
   - Har bir mahsulot uchun checkbox bo'lishi
   - Kiril varianti ko'rsatilishi
   - Kod, katalog, narx o'zgarmasligi
4. **Konvertatsiya** tugmasini bosganda:
   - Faqat tanlangan mahsulotlar o'girilishi
   - Boshqa ustunlar o'zgarmagan bo'lishi
5. **Import** tugmasini bosganda:
   - Mahsulotlar bazaga kiril alifbosida saqlanishi

### ✅ Console Loglar
Backend konsolda quyidagi loglar ko'rinishi kerak:
```
[Excel Latin Preview] Starting...
[Excel Latin Preview] Column mapping: { name: 0, code: 1, ... }
[Excel Latin Preview] Total rows: 4
[Excel Latin Preview] Latin products: 3
[Excel Latin Preview] Cyrillic products: 1

[Excel Convert Latin] Starting conversion...
[Excel Convert Latin] Selected rows: 3
[Excel Convert Latin] Converted: Zadning pavarot → Задниң паварот
[Excel Convert Latin] Converted: Dvigatel maslo → Двигател масло
[Excel Convert Latin] Converted: Filtr havo → Филтр ҳаво
[Excel Convert Latin] Total converted: 3
```

## Xatolarni Tuzatish

### Agar preview dialog ochilmasa:
1. Brauzer konsolini tekshiring (`F12`)
2. Network tabda API so'rovlarni tekshiring
3. Backend konsolda xatolarni tekshiring

### Agar konvertatsiya ishlamasa:
1. `alphabet-converter.ts` faylini tekshiring
2. `excel-import-latin.ts` routelarni tekshiring
3. API endpointlar to'g'ri registratsiya qilinganligini tekshiring

### Agar kod/katalog/narx o'zgarsa:
Bu xato! Faqat mahsulot nomi o'zgarishi kerak.
`excel-import-latin.ts` faylda faqat `columnMap.name` ustuni konvertatsiya qilinishini tekshiring.

## Muvaffaqiyat Mezonlari
- ✅ Lotin mahsulotlar to'g'ri aniqlanadi
- ✅ Preview dialog to'g'ri ma'lumotlarni ko'rsatadi
- ✅ Faqat mahsulot nomi konvertatsiya qilinadi
- ✅ Kod, katalog, narx o'zgarmaydi
- ✅ Aralash alifbo (lotin + kiril) qo'llab-quvvatlanadi
- ✅ Rus tilida sarlavhalar ishlaydi
- ✅ Mahsulotlar bazaga kiril alifbosida saqlanadi
- ✅ Hech qanday diagnostika xatosi yo'q

## Qo'shimcha Test Holatlar

### Test 1: Faqat Lotin
```
Maslo → Масло
Filtr → Филтр
Shina → Шина
```

### Test 2: Aralash Alifbo
```
Двигател maslo → Двигател масло
Тормоз kolodka → Тормоз колодка
```

### Test 3: Maxsus Belgilar
```
Maslo 5W-40 → Масло 5W-40
Filtr (havo) → Филтр (ҳаво)
Shina 195/65R15 → Шина 195/65Р15
```

### Test 4: Raqamlar Saqlanadi
```
Maslo 123 → Масло 123
Filtr A1B2C3 → Филтр А1Б2Ц3
```

## Yakuniy Tekshiruv
1. ✅ Backend serveri ishlamoqda
2. ✅ Frontend serveri ishlamoqda
3. ✅ Brauzer keshi tozalangan
4. ✅ Excel fayl to'g'ri formatda
5. ✅ API endpointlar javob bermoqda
6. ✅ Preview dialog ochilmoqda
7. ✅ Konvertatsiya ishlayapti
8. ✅ Import muvaffaqiyatli
9. ✅ Bazada kiril alifbosida saqlanmoqda
10. ✅ Hech qanday xato yo'q

---

**Eslatma:** Agar biror narsa ishlamasa, brauzer konsolini (`F12`) va backend konsolini tekshiring. Xatolar haqida batafsil ma'lumot u yerda bo'ladi.
