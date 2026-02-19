# Latin → Kiril Konvertatsiya Funksiyasi

## Tavsif

Excel import qilishda lotin alifbosida yozilgan mahsulotlarni avtomatik aniqlash va kiril alifbosiga o'girish funksiyasi.

## Qanday ishlaydi?

### 1. Excel fayl yuklash
Foydalanuvchi Excel faylni yuklaydi (odatdagidek).

### 2. Avtomatik aniqlash
Tizim avtomatik ravishda:
- Qaysi mahsulotlar **lotin** alifbosida yozilganligini aniqlaydi
- Qaysi mahsulotlar **kiril** alifbosida yozilganligini aniqlaydi
- Agar lotin mahsulotlar topilsa, "Lotin → Kiril" tugmasi paydo bo'ladi

### 3. Preview va tanlash
Foydalanuvchi "Lotin → Kiril" tugmasini bosadi va:
- Barcha lotin mahsulotlar ro'yxati ko'rsatiladi
- Har bir mahsulotning **asl nomi** (lotin) va **yangi nomi** (kiril) ko'rsatiladi
- Foydalanuvchi qaysi mahsulotlarni o'girishni tanlaydi (default: barchasi tanlangan)

### 4. Konvertatsiya
Tanlangan mahsulotlar kiril alifbosiga o'giriladi va import jarayoni davom etadi.

## Texnik tafsilotlar

### Backend (TypeScript)

#### 1. Alphabet Converter (`server/utils/alphabet-converter.ts`)
- `hasLatinLetters()` - Matnda lotin harflari borligini tekshirish
- `hasCyrillicLetters()` - Matnda kiril harflari borligini tekshirish
- `detectAlphabet()` - Matn qaysi alifboda ekanligini aniqlash
- `latinToCyrillic()` - Lotin matnini kirilga o'girish
- `convertProductName()` - Mahsulot nomini konvertatsiya qilish

**O'zbek lotin → kiril mapping:**
```typescript
// Oddiy harflar: A→А, B→Б, D→Д, ...
// Maxsus harflar: Q→Қ, Gʻ→Ғ, Oʻ→Ў, H→Ҳ
// Ikki harfli: Sh→Ш, Ch→Ч, Yo→Ё, Yu→Ю, Ya→Я
```

#### 2. Excel Import Latin Routes (`server/routes/excel-import-latin.ts`)

**POST /api/excel-import/preview-latin**
- Excel fayldan lotin mahsulotlarni aniqlash
- Har bir mahsulotning kiril variantini hisoblash
- Response:
  ```json
  {
    "success": true,
    "totalRows": 100,
    "latinCount": 25,
    "cyrillicCount": 75,
    "latinProducts": [
      {
        "rowIndex": 5,
        "originalName": "Tormoz kolodka",
        "cyrillicName": "Тормоз колодка",
        "code": "12345",
        "price": 50
      }
    ]
  }
  ```

**POST /api/excel-import/convert-latin-to-cyrillic**
- Tanlangan mahsulotlarni kirilga o'girish
- Request:
  ```json
  {
    "fileData": "base64...",
    "selectedRowIndices": [5, 10, 15],
    "columnMapping": {...}
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "convertedCount": 3,
    "convertedData": [[...], [...], ...]
  }
  ```

### Frontend (React + TypeScript)

#### 1. Latin Preview Dialog (`client/components/ExcelImportLatinPreviewDialog.tsx`)
- Lotin mahsulotlarni ko'rsatish
- Checkbox bilan tanlash imkoniyati
- Lotin → Kiril taqqoslash jadvali
- Konvertatsiya tugmasi

**Komponent props:**
```typescript
interface ExcelImportLatinPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: string;
  columnMapping: any;
  onConvertComplete: (convertedData: any[][] | null) => void;
}
```

#### 2. Excel Import Modal integratsiyasi
- `hasLatinProducts` state - Lotin mahsulotlar borligini saqlash
- `showLatinDialog` state - Dialog ochiq/yopiqligini boshqarish
- `checkForLatinProducts()` - Lotin mahsulotlarni tekshirish
- `handleLatinConvertComplete()` - Konvertatsiya tugagandan keyin

## Foydalanish

### 1. Serverni ishga tushirish
```bash
cd AvtoFix
npm run dev
```

### 2. Excel fayl tayyorlash
Excel faylda lotin alifbosida mahsulotlar bo'lishi kerak:
```
Nomi                    | Kod   | Narx
Tormoz kolodka         | 12345 | 50
Dvigatel maslo         | 67890 | 30
Filtr havo             | 11111 | 15
```

### 3. Import jarayoni
1. "Excel Import" tugmasini bosing
2. Excel faylni yuklang
3. Agar lotin mahsulotlar topilsa, "Lotin → Kiril" tugmasi paydo bo'ladi
4. Tugmani bosing va mahsulotlarni ko'ring
5. Kerakli mahsulotlarni tanlang (yoki barchasini qoldiring)
6. "Kirilga o'girish" tugmasini bosing
7. Import jarayoni davom etadi (endi mahsulotlar kirilga o'girilgan)

## Natija

Import qilingandan keyin mahsulotlar kiril alifbosida saqlanadi:
```
Тормоз колодка
Двигател масло
Филтр ҳаво
```

## Xususiyatlar

✅ **Avtomatik aniqlash** - Lotin mahsulotlar avtomatik aniqlanadi
✅ **Preview** - O'girishdan oldin ko'rish imkoniyati
✅ **Tanlash** - Faqat kerakli mahsulotlarni o'girish
✅ **To'liq mapping** - Barcha o'zbek harflari qo'llab-quvvatlanadi
✅ **Xavfsiz** - Raqam va maxsus belgilar o'zgartirilmaydi
✅ **Tez** - Bir vaqtning o'zida ko'p mahsulotlarni o'girish

## Test qilish

### Test 1: Oddiy lotin matn
```
Input:  "Tormoz kolodka"
Output: "Тормоз колодка"
```

### Test 2: Maxsus harflar
```
Input:  "Gʻildirak podshipnik"
Output: "Ғилдирак подшипник"
```

### Test 3: Aralash (lotin + raqam)
```
Input:  "Filtr 12345 havo"
Output: "Филтр 12345 ҳаво"
```

### Test 4: Ikki harfli kombinatsiyalar
```
Input:  "Shesternya chashka"
Output: "Шестерня чашка"
```

## Muammolarni hal qilish

### Agar "Lotin → Kiril" tugmasi ko'rinmasa:
- Excel faylda lotin harflar yo'q
- Barcha mahsulotlar allaqachon kirilga o'girilgan
- Faqat raqam va belgilar mavjud

### Agar konvertatsiya ishlamasa:
1. Browser console ni tekshiring (F12)
2. Server loglarini tekshiring
3. Network tab da API so'rovlarni tekshiring

### Agar noto'g'ri o'girilsa:
- `alphabet-converter.ts` fayldagi mapping ni tekshiring
- Maxsus harflar uchun yangi mapping qo'shing

## Kelajakda qo'shilishi mumkin

- [ ] Kiril → Lotin konvertatsiya
- [ ] Boshqa tillar uchun qo'llab-quvvatlash
- [ ] Konvertatsiya tarixini saqlash
- [ ] Undo/Redo funksiyasi
- [ ] Bulk konvertatsiya (barcha mahsulotlar)

## Muallif

AvtoFix Development Team
