# Latin → Kiril Test Qo'llanma

## 1. Backend Test

### Terminal da test qilish:

```bash
cd AvtoFix/server/utils
npx tsx alphabet-converter.test.ts
```

Yoki Node.js bilan:
```bash
node --loader ts-node/esm alphabet-converter.test.ts
```

### Kutilgan natija:

```
=== ALPHABET CONVERTER TEST ===

Test 1: Lotin harflarni aniqlash
hasLatinLetters("Tormoz"):  true
hasLatinLetters("Тормоз"):  false
hasLatinLetters("12345"):  false

Test 2: Kiril harflarni aniqlash
hasCyrillicLetters("Tormoz"):  false
hasCyrillicLetters("Тормоз"):  true
hasCyrillicLetters("12345"):  false

Test 3: Alifboni aniqlash
detectAlphabet("Tormoz"):  latin
detectAlphabet("Тормоз"):  cyrillic
detectAlphabet("Tormoz Тормоз"):  mixed
detectAlphabet("12345"):  unknown

Test 4: Oddiy lotin → kiril
latinToCyrillic("Tormoz"):  Тормоз
latinToCyrillic("Dvigatel"):  Двигател
latinToCyrillic("Filtr"):  Филтр

Test 5: Maxsus harflar (Q, H)
latinToCyrillic("Qopqoq"):  Қопқоқ
latinToCyrillic("Havo"):  Ҳаво

Test 6: Ikki harfli kombinatsiyalar (Sh, Ch, Yo, Yu, Ya)
latinToCyrillic("Shesternya"):  Шестерня
latinToCyrillic("Chashka"):  Чашка

Test 7: Aralash (lotin + raqam + belgi)
latinToCyrillic("Filtr 12345"):  Филтр 12345
latinToCyrillic("Tormoz-kolodka"):  Тормоз-колодка
latinToCyrillic("Dvigatel (benzin)"):  Двигател (бензин)

Test 8: Mahsulot nomlari
convertProductName("Tormoz kolodka"):  Тормоз колодка
convertProductName("Dvigatel maslo"):  Двигател масло
convertProductName("Filtr havo"):  Филтр ҳаво
convertProductName("Shesternya chashka"):  Шестерня чашка

Test 9: Allaqachon kirilga o'girilgan (o'zgarmaydi)
convertProductName("Тормоз колодка"):  Тормоз колодка

Test 10: Katta-kichik harflar
latinToCyrillic("TORMOZ"):  ТОРМОЗ
latinToCyrillic("tormoz"):  тормоз
latinToCyrillic("Tormoz"):  Тормоз

=== BARCHA TESTLAR TUGADI ===
```

## 2. Frontend Test (Browser da)

### Excel fayl tayyorlash:

Excel faylda quyidagi mahsulotlarni yozing (lotin alifbosida):

| Nomi | Kod | Narx |
|------|-----|------|
| Tormoz kolodka | 12345 | 50 |
| Dvigatel maslo | 67890 | 30 |
| Filtr havo | 11111 | 15 |
| Shesternya chashka | 22222 | 25 |
| Qopqoq benzin | 33333 | 10 |

### Test jarayoni:

1. **Serverni ishga tushiring:**
   ```bash
   cd AvtoFix
   npm run dev
   ```

2. **Brauzerda oching:**
   ```
   http://localhost:5173
   ```

3. **Login qiling** (admin yoki user)

4. **Mahsulotlar sahifasiga o'ting**

5. **"Excel Import" tugmasini bosing**

6. **Excel faylni yuklang**

7. **"Lotin → Kiril" tugmasi paydo bo'lishini kuting**
   - Agar tugma ko'rinmasa, Excel faylda lotin harflar yo'q demakdir

8. **"Lotin → Kiril" tugmasini bosing**

9. **Dialog oynasida tekshiring:**
   - ✅ Barcha lotin mahsulotlar ko'rsatilishi kerak
   - ✅ Har bir mahsulotning asl nomi (lotin) va yangi nomi (kiril) ko'rsatilishi kerak
   - ✅ Checkbox lar ishlashi kerak
   - ✅ "Barchasini tanlash" tugmasi ishlashi kerak

10. **Mahsulotlarni tanlang va "Kirilga o'girish" tugmasini bosing**

11. **Konvertatsiya tugagandan keyin:**
    - ✅ Jadvalda mahsulotlar kirilga o'girilgan bo'lishi kerak
    - ✅ "Tormoz kolodka" → "Тормоз колодка"
    - ✅ "Dvigatel maslo" → "Двигател масло"
    - ✅ "Filtr havo" → "Филтр ҳаво"

12. **Import qiling va bazada tekshiring:**
    - ✅ Mahsulotlar kiril alifbosida saqlanishi kerak

## 3. API Test (Postman yoki curl)

### Test 1: Preview Latin

```bash
curl -X POST http://localhost:5175/api/excel-import/preview-latin \
  -H "Content-Type: application/json" \
  -d '{
    "fileData": "BASE64_ENCODED_EXCEL_FILE",
    "columnMapping": {
      "name": 0,
      "code": 1,
      "price": 2
    }
  }'
```

**Kutilgan javob:**
```json
{
  "success": true,
  "totalRows": 5,
  "latinCount": 5,
  "cyrillicCount": 0,
  "latinProducts": [
    {
      "rowIndex": 1,
      "originalName": "Tormoz kolodka",
      "cyrillicName": "Тормоз колодка",
      "code": "12345",
      "price": 50
    }
  ]
}
```

### Test 2: Convert Latin to Cyrillic

```bash
curl -X POST http://localhost:5175/api/excel-import/convert-latin-to-cyrillic \
  -H "Content-Type: application/json" \
  -d '{
    "fileData": "BASE64_ENCODED_EXCEL_FILE",
    "selectedRowIndices": [1, 2, 3],
    "columnMapping": {
      "name": 0,
      "code": 1,
      "price": 2
    }
  }'
```

**Kutilgan javob:**
```json
{
  "success": true,
  "message": "3 ta mahsulot kirilga o'girildi",
  "convertedCount": 3,
  "convertedData": [
    ["Nomi", "Kod", "Narx"],
    ["Тормоз колодка", "12345", 50],
    ["Двигател масло", "67890", 30]
  ]
}
```

## 4. Browser Console Test

Browser console da (F12) quyidagi kodni ishga tushiring:

```javascript
// Test 1: API ni to'g'ridan-to'g'ri chaqirish
fetch('/api/excel-import/preview-latin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileData: 'YOUR_BASE64_FILE',
    columnMapping: { name: 0, code: 1, price: 2 }
  })
})
.then(r => r.json())
.then(data => console.log('Preview result:', data));

// Test 2: Konvertatsiya
fetch('/api/excel-import/convert-latin-to-cyrillic', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileData: 'YOUR_BASE64_FILE',
    selectedRowIndices: [1, 2, 3],
    columnMapping: { name: 0, code: 1, price: 2 }
  })
})
.then(r => r.json())
.then(data => console.log('Convert result:', data));
```

## 5. Muammolarni hal qilish

### Agar "Lotin → Kiril" tugmasi ko'rinmasa:

1. **Browser console ni oching (F12)**
2. **Network tab ga o'ting**
3. **Excel faylni yuklang**
4. **`/api/excel-import/preview-latin` so'rovini toping**
5. **Response ni tekshiring:**
   - `latinCount: 0` bo'lsa, Excel faylda lotin harflar yo'q
   - Xato bo'lsa, server loglarini tekshiring

### Agar konvertatsiya ishlamasa:

1. **Server loglarini tekshiring:**
   ```bash
   # Terminal da server loglarini ko'ring
   ```

2. **Browser console da xatolarni tekshiring**

3. **API response ni tekshiring:**
   ```javascript
   // Browser console da
   console.log('Response:', data);
   ```

### Agar noto'g'ri o'girilsa:

1. **`alphabet-converter.ts` fayldagi mapping ni tekshiring**
2. **Maxsus harflar uchun yangi mapping qo'shing**
3. **Test faylni qayta ishga tushiring**

## 6. Muvaffaqiyat mezonlari

✅ Backend test barcha testlardan o'tishi kerak
✅ "Lotin → Kiril" tugmasi paydo bo'lishi kerak
✅ Dialog oynasi ochilishi kerak
✅ Barcha lotin mahsulotlar ko'rsatilishi kerak
✅ Kiril variantlari to'g'ri ko'rsatilishi kerak
✅ Konvertatsiya ishlashi kerak
✅ Import qilingandan keyin mahsulotlar kirilga o'girilgan bo'lishi kerak
✅ Bazada mahsulotlar kiril alifbosida saqlanishi kerak

## 7. Qo'shimcha testlar

### Test A: Maxsus harflar
```
Input:  Qopqoq, Havo, Gʻildirak, Oʻq
Output: Қопқоқ, Ҳаво, Ғилдирак, Ўқ
```

### Test B: Ikki harfli
```
Input:  Shesternya, Chashka, Yoshil
Output: Шестерня, Чашка, Ёшил
```

### Test C: Aralash
```
Input:  Tormoz 12345 kolodka
Output: Тормоз 12345 колодка
```

### Test D: Katta harflar
```
Input:  TORMOZ KOLODKA
Output: ТОРМОЗ КОЛОДКА
```

## 8. Performance Test

1000 ta mahsulot bilan test qiling:
- ✅ Preview 2 soniyadan kam vaqt olishi kerak
- ✅ Konvertatsiya 3 soniyadan kam vaqt olishi kerak
- ✅ Import 10 soniyadan kam vaqt olishi kerak

---

**Barcha testlar muvaffaqiyatli o'tsa, funksiya 100% ishlaydi!** 🎉
