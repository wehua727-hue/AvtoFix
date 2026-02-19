# Faqat Mahsulot Nomini Tekshirish

## Muhim!

✅ **Faqat mahsulot NOMI tekshiriladi**
❌ Kod tekshirilmaydi
❌ Katalog raqami tekshirilmaydi
❌ Narx tekshirilmaydi
❌ Kategoriya tekshirilmaydi

## Test Excel fayl

| Nomi | Kod | Katalog | Narx | Kategoriya |
|------|-----|---------|------|------------|
| Zadning pavarot | ABC123 | XYZ789 | 50 | Ehtiyot qism |
| Tormoz kolodka | 12345 | CAT001 | 30 | Tormoz |
| Двигател масло | MOT456 | ENG002 | 25 | Moy |
| Shesternya | GER789 | GRB003 | 15 | Uzatma |

## Kutilgan natija

### 1. Alifboni aniqlash (faqat nom ustuni)

```javascript
"Zadning pavarot"  → latin   ✅ (faqat nom tekshirildi)
"Tormoz kolodka"   → latin   ✅ (faqat nom tekshirildi)
"Двигател масло"   → cyrillic ✅ (faqat nom tekshirildi)
"Shesternya"       → latin   ✅ (faqat nom tekshirildi)

// Kod, katalog, narx tekshirilmaydi:
"ABC123"  → tekshirilmaydi ❌
"XYZ789"  → tekshirilmaydi ❌
"50"      → tekshirilmaydi ❌
```

### 2. Dialog oynasida

```
┌─────────────────────────────────────────────────┐
│  🌐 Lotin alifbosi aniqlandi           [X]     │
│     3 ta mahsulot lotinda yozilgan             │
├─────────────────────────────────────────────────┤
│  📋 Lotin mahsulotlar (faqat nom tekshirildi): │
│  ┌──┬──────────────┬──┬──────────────┬────┐  │
│  │☑│Lotin (asl)   │→│Kiril (yangi) │Kod │  │
│  ├──┼──────────────┼──┼──────────────┼────┤  │
│  │☑│Zadning pavarot│→│Заднинг паварот│ABC123│ │
│  │☑│Tormoz kolodka│→│Тормоз колодка│12345│  │
│  │☑│Shesternya    │→│Шестерня      │GER789│ │
│  └──┴──────────────┴──┴──────────────┴────┘  │
│                                                 │
│  ⚠️ Eslatma: Faqat mahsulot nomi o'giriladi   │
│     Kod, katalog, narx o'zgartirilmaydi       │
└─────────────────────────────────────────────────┘
```

### 3. Konvertatsiya natijasi

| Nomi (O'ZGARDI) | Kod (O'ZGARMADI) | Katalog (O'ZGARMADI) | Narx (O'ZGARMADI) |
|-----------------|------------------|----------------------|-------------------|
| Заднинг паварот ✅ | ABC123 ❌ | XYZ789 ❌ | 50 ❌ |
| Тормоз колодка ✅ | 12345 ❌ | CAT001 ❌ | 30 ❌ |
| Двигател масло ❌ | MOT456 ❌ | ENG002 ❌ | 25 ❌ |
| Шестерня ✅ | GER789 ❌ | GRB003 ❌ | 15 ❌ |

## Kod tahlili

### Backend: Faqat name tekshiriladi

```typescript
// excel-import-latin.ts - 237-qator
// FAQAT MAHSULOT NOMINI tekshirish
const alphabet = detectAlphabet(name);  // ← Faqat name!

// Kod, katalog, narx tekshirilmaydi:
// detectAlphabet(code) ❌ - ISHLATILMAYDI
// detectAlphabet(catalogNumber) ❌ - ISHLATILMAYDI
// detectAlphabet(price) ❌ - ISHLATILMAYDI
```

### Backend: Faqat name konvertatsiya qilinadi

```typescript
// excel-import-latin.ts - 357-qator
// FAQAT MAHSULOT NOMINI konvertatsiya qilish
if (columnMap.name >= 0 && row[columnMap.name]) {
  const originalName = String(row[columnMap.name]).trim();
  const cyrillicName = latinToCyrillic(originalName);
  
  // Faqat name ustunini o'zgartirish
  convertedData[rowIndex][columnMap.name] = cyrillicName;
  
  // Boshqa ustunlar o'zgartirilmaydi!
  // convertedData[rowIndex][columnMap.code] - o'zgarmaydi ❌
  // convertedData[rowIndex][columnMap.catalogNumber] - o'zgarmaydi ❌
  // convertedData[rowIndex][columnMap.price] - o'zgarmaydi ❌
}
```

## Test misollari

### Misol 1: Lotin kod, lotin nom

```
Input:
  Nomi: "Zadning pavarot"  (lotin)
  Kod: "ABC123"            (lotin, lekin tekshirilmaydi)

Process:
  1. detectAlphabet("Zadning pavarot") → latin ✅
  2. detectAlphabet("ABC123") → ISHLATILMAYDI ❌

Output:
  Nomi: "Заднинг паварот"  ✅ O'ZGARDI
  Kod: "ABC123"            ❌ O'ZGARMADI
```

### Misol 2: Kiril kod, lotin nom

```
Input:
  Nomi: "Tormoz kolodka"   (lotin)
  Kod: "КОД123"            (kiril, lekin tekshirilmaydi)

Process:
  1. detectAlphabet("Tormoz kolodka") → latin ✅
  2. detectAlphabet("КОД123") → ISHLATILMAYDI ❌

Output:
  Nomi: "Тормоз колодка"   ✅ O'ZGARDI
  Kod: "КОД123"            ❌ O'ZGARMADI (kiril bo'lib qoldi)
```

### Misol 3: Raqamli kod, lotin nom

```
Input:
  Nomi: "Shesternya"       (lotin)
  Kod: "12345"             (raqam, lekin tekshirilmaydi)

Process:
  1. detectAlphabet("Shesternya") → latin ✅
  2. detectAlphabet("12345") → ISHLATILMAYDI ❌

Output:
  Nomi: "Шестерня"         ✅ O'ZGARDI
  Kod: "12345"             ❌ O'ZGARMADI
```

### Misol 4: Kiril nom, lotin kod

```
Input:
  Nomi: "Двигател масло"   (kiril)
  Kod: "ABC123"            (lotin, lekin tekshirilmaydi)

Process:
  1. detectAlphabet("Двигател масло") → cyrillic ✅
  2. Konvertatsiya kerak emas (allaqachon kiril)

Output:
  Nomi: "Двигател масло"   ❌ O'ZGARMADI (kerak emas)
  Kod: "ABC123"            ❌ O'ZGARMADI
```

## Browser Console Test

```javascript
// Test 1: Faqat nom tekshirilishini tasdiqlash
const testData = {
  name: "Zadning pavarot",  // lotin
  code: "ABC123",           // lotin (lekin tekshirilmaydi)
  price: 50
};

// Faqat name tekshiriladi
console.log('Name alphabet:', detectAlphabet(testData.name));  // latin
console.log('Code alphabet:', 'NOT CHECKED');  // ❌ tekshirilmaydi
console.log('Price alphabet:', 'NOT CHECKED'); // ❌ tekshirilmaydi

// Test 2: API ni chaqirish
fetch('/api/excel-import/preview-latin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileData: 'YOUR_BASE64_FILE',
    columnMapping: { 
      name: 0,    // ← Faqat bu tekshiriladi
      code: 1,    // ← Bu tekshirilmaydi
      price: 2    // ← Bu tekshirilmaydi
    }
  })
})
.then(r => r.json())
.then(data => {
  console.log('Latin Products:', data.latinProducts);
  // Faqat name ustuni bo'yicha filtrlangan
});
```

## Xulosa

✅ **Faqat mahsulot NOMI tekshiriladi va konvertatsiya qilinadi**
✅ **Kod, katalog, narx, kategoriya o'zgartirilmaydi**
✅ **Kod lotinda bo'lsa ham, tekshirilmaydi**
✅ **Kod kirilga o'girilmaydi**

**Bu to'g'ri ishlaydi! Faqat mahsulot nomi bilan ishlaydi!** 🎉

## Real test

1. Excel faylda quyidagi ma'lumotlarni yozing:

```
Nomi              | Kod    | Narx
Zadning pavarot   | ABC123 | 50
Tormoz kolodka    | XYZ789 | 30
```

2. Import qiling va tekshiring:
   - ✅ "Zadning pavarot" → "Заднинг паварот"
   - ✅ "Tormoz kolodka" → "Тормоз колодка"
   - ❌ "ABC123" o'zgarmaydi
   - ❌ "XYZ789" o'zgarmaydi

**Test qiling va ishonch hosil qiling!** 🎉
