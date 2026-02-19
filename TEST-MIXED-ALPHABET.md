# Aralash Alifbo Test (Lotin + Kiril)

## Vaziyat

Excel faylda:
- ✅ Ba'zi mahsulotlar **kiril** alifbosida
- ✅ Ba'zi mahsulotlar **lotin** alifbosida
- ✅ Ba'zi mahsulotlar **aralash** (lotin + kiril)

## Test Excel fayl

| Nomi | Kod | Narx | Alifbo |
|------|-----|------|--------|
| Тормоз колодка | 11111 | 50 | Kiril ✅ |
| Tormoz kolodka | 22222 | 50 | Lotin ❌ |
| Двигател maslo | 33333 | 30 | Aralash ❌ |
| Филтр havo | 44444 | 15 | Aralash ❌ |
| Шестерня | 55555 | 25 | Kiril ✅ |
| Chashka | 66666 | 10 | Lotin ❌ |

## Kutilgan natija

### 1. Preview API (`/api/excel-import/preview-latin`)

```json
{
  "success": true,
  "totalRows": 6,
  "latinCount": 3,        // Lotin + Aralash
  "cyrillicCount": 2,     // Faqat kiril
  "unknownCount": 0,
  "latinProducts": [
    {
      "originalName": "Tormoz kolodka",
      "cyrillicName": "Тормоз колодка",
      "alphabet": "latin"
    },
    {
      "originalName": "Двигател maslo",
      "cyrillicName": "Двигател масло",
      "alphabet": "mixed"    // ← Aralash!
    },
    {
      "originalName": "Филтр havo",
      "cyrillicName": "Филтр ҳаво",
      "alphabet": "mixed"    // ← Aralash!
    },
    {
      "originalName": "Chashka",
      "cyrillicName": "Чашка",
      "alphabet": "latin"
    }
  ]
}
```

### 2. Dialog oynasida

```
┌─────────────────────────────────────────────────┐
│  🌐 Lotin alifbosi aniqlandi           [X]     │
│     3 ta mahsulot lotinda yozilgan             │
├─────────────────────────────────────────────────┤
│  📊 Statistika                                  │
│  ┌─────────┬─────────┬─────────┐              │
│  │    6    │    3    │    2    │              │
│  │  Jami   │  Lotin  │  Kiril  │              │
│  └─────────┴─────────┴─────────┘              │
│                                                 │
│  📋 Lotin va aralash mahsulotlar:              │
│  ┌──┬──────────────┬──┬──────────────┬────┐  │
│  │☑│Lotin (asl)   │→│Kiril (yangi) │Kod │  │
│  ├──┼──────────────┼──┼──────────────┼────┤  │
│  │☑│Tormoz kolodka│→│Тормоз колодка│22222│  │ ← Lotin
│  │☑│Двигател maslo│→│Двигател масло│33333│  │ ← Aralash
│  │☑│Филтр havo    │→│Филтр ҳаво    │44444│  │ ← Aralash
│  │☑│Chashka       │→│Чашка         │66666│  │ ← Lotin
│  └──┴──────────────┴──┴──────────────┴────┘  │
│                                                 │
│  ⚠️ Eslatma: Aralash mahsulotlarda faqat       │
│     lotin harflar kirilga o'giriladi           │
└─────────────────────────────────────────────────┘
```

### 3. Konvertatsiya natijasi

```
Tormoz kolodka  → Тормоз колодка  ✅
Двигател maslo  → Двигател масло  ✅ (faqat "maslo" o'girildi)
Филтр havo      → Филтр ҳаво      ✅ (faqat "havo" o'girildi)
Chashka         → Чашка           ✅
```

## Backend kod tahlili

### 1. Alifboni aniqlash (`alphabet-converter.ts`)

```typescript
export function detectAlphabet(text: string): 'latin' | 'cyrillic' | 'mixed' | 'unknown' {
  if (!text) return 'unknown';
  
  const hasLatin = hasLatinLetters(text);      // a-zA-Z
  const hasCyrillic = hasCyrillicLetters(text); // а-яА-Я...
  
  if (hasLatin && hasCyrillic) return 'mixed';  // ← Aralash!
  if (hasLatin) return 'latin';
  if (hasCyrillic) return 'cyrillic';
  
  return 'unknown';
}
```

### 2. Lotin mahsulotlarni filtrlash (`excel-import-latin.ts`)

```typescript
// 259-qator
const latinProducts = rows.filter(row => 
  row.alphabet === 'latin' || row.alphabet === 'mixed'  // ← Mixed ham qo'shilgan!
);
```

### 3. Konvertatsiya (`alphabet-converter.ts`)

```typescript
export function latinToCyrillic(text: string): string {
  if (!text) return text;
  
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    // Agar lotin harfi bo'lsa - kirilga o'girish
    if (LATIN_TO_CYRILLIC_MAP[char]) {
      result += LATIN_TO_CYRILLIC_MAP[char];
    } else {
      // Agar kiril yoki boshqa belgi bo'lsa - o'zini qoldirish
      result += char;  // ← Kiril harflar o'zgartirilmaydi!
    }
    
    i++;
  }
  
  return result;
}
```

## Test misollari

### Test 1: Aralash nom (kiril + lotin)

```javascript
Input:  "Двигател maslo"
Process:
  - Д → Д (kiril, o'zgartirilmaydi)
  - в → в (kiril, o'zgartirilmaydi)
  - и → и (kiril, o'zgartirilmaydi)
  - г → г (kiril, o'zgartirilmaydi)
  - а → а (kiril, o'zgartirilmaydi)
  - т → т (kiril, o'zgartirilmaydi)
  - е → е (kiril, o'zgartirilmaydi)
  - л → л (kiril, o'zgartirilmaydi)
  - (space) → (space)
  - m → м (lotin, o'giriladi!)
  - a → а (lotin, o'giriladi!)
  - s → с (lotin, o'giriladi!)
  - l → л (lotin, o'giriladi!)
  - o → о (lotin, o'giriladi!)
Output: "Двигател масло"
```

### Test 2: Aralash nom (lotin + kiril)

```javascript
Input:  "Filtr ҳаво"
Process:
  - F → Ф (lotin, o'giriladi!)
  - i → и (lotin, o'giriladi!)
  - l → л (lotin, o'giriladi!)
  - t → т (lotin, o'giriladi!)
  - r → р (lotin, o'giriladi!)
  - (space) → (space)
  - ҳ → ҳ (kiril, o'zgartirilmaydi)
  - а → а (kiril, o'zgartirilmaydi)
  - в → в (kiril, o'zgartirilmaydi)
  - о → о (kiril, o'zgartirilmaydi)
Output: "Филтр ҳаво"
```

### Test 3: Faqat lotin

```javascript
Input:  "Tormoz kolodka"
Output: "Тормоз колодка"
```

### Test 4: Faqat kiril (o'zgartirilmaydi)

```javascript
Input:  "Тормоз колодка"
Output: "Тормоз колодка"
```

## Qanday test qilish?

### 1. Excel fayl yarating

Yuqoridagi jadvaldan foydalaning (aralash mahsulotlar bilan).

### 2. Import qiling

```bash
cd AvtoFix
npm run dev
```

1. Brauzerda `http://localhost:5173` ni oching
2. Login qiling
3. "Excel Import" tugmasini bosing
4. Excel faylni yuklang

### 3. Tekshiring

✅ "Lotin → Kiril" tugmasi paydo bo'lishi kerak
✅ Tugmani bosing
✅ Dialog oynasida **3 ta mahsulot** ko'rsatilishi kerak:
   - Tormoz kolodka (lotin)
   - Двигател maslo (aralash)
   - Филтр havo (aralash)
   - Chashka (lotin)

✅ Kiril mahsulotlar ko'rsatilmasligi kerak:
   - Тормоз колодка ❌
   - Шестерня ❌

### 4. Konvertatsiya qiling

✅ Barcha 4 ta mahsulotni tanlang
✅ "Kirilga o'girish" tugmasini bosing
✅ Jadvalda tekshiring:
   - "Tormoz kolodka" → "Тормоз колодка"
   - "Двигател maslo" → "Двигател масло"
   - "Филтр havo" → "Филтр ҳаво"
   - "Chashka" → "Чашка"

### 5. Import qiling

✅ Import tugmasini bosing
✅ Bazada tekshiring - barcha mahsulotlar kirilga o'girilgan bo'lishi kerak

## Browser Console Test

```javascript
// Test 1: Aralash matnni tekshirish
const testText = "Двигател maslo";
console.log('Has Latin:', /[a-zA-Z]/.test(testText));      // true
console.log('Has Cyrillic:', /[а-яА-Я]/.test(testText));   // true
console.log('Result: mixed');

// Test 2: API ni chaqirish
fetch('/api/excel-import/preview-latin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileData: 'YOUR_BASE64_FILE',
    columnMapping: { name: 0 }
  })
})
.then(r => r.json())
.then(data => {
  console.log('Total:', data.totalRows);
  console.log('Latin + Mixed:', data.latinCount);
  console.log('Cyrillic:', data.cyrillicCount);
  console.log('Latin Products:', data.latinProducts);
});
```

## Xulosa

✅ **Funksiya allaqachon aralash mahsulotlarni qo'llab-quvvatlaydi!**
✅ **Lotin va aralash mahsulotlar birga ko'rsatiladi**
✅ **Faqat lotin harflar o'giriladi, kiril harflar saqlanadi**
✅ **Kiril mahsulotlar dialog oynasida ko'rsatilmaydi**

**Test qiling va ishonch hosil qiling!** 🎉
