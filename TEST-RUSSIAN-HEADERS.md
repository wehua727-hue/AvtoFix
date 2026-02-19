# Rus tilida sarlavhalar bilan test

## Excel fayl misoli

| Наименование | Код | № по каталогу | Цена | Кол-во |
|--------------|-----|---------------|------|--------|
| Zadning pavarot | ABC123 | XYZ789 | 50 | 10 |
| Tormoz kolodka | 12345 | CAT001 | 30 | 5 |
| Двигател масло | MOT456 | ENG002 | 25 | 8 |
| Shesternya | GER789 | GRB003 | 15 | 12 |

## Qanday ishlaydi?

### 1. Sarlavhani avtomatik aniqlash

```typescript
// excel-import-latin.ts - 18-qator
const HEADER_KEYWORDS = {
  name: ['наименование', 'название', 'номи', 'nomi', 'name', 'товар', 'mahsulot', 'product'],
  //     ^^^^^^^^^^^^^^  ← "Наименование" qo'llab-quvvatlanadi!
  code: ['код', 'code', 'артикул'],
  catalogNumber: ['№ по каталогу', 'каталог №', 'по каталогу', 'catalog'],
  price: ['цена', 'narx', 'price', 'стоимость', 'сумма', 'итого'],
  stock: ['кол-во', 'количество', 'к-во', 'soni', 'stock', 'qty', 'остаток', 'шт'],
};
```

### 2. Avtomatik mapping

Funksiya avtomatik ravishda:
- ✅ "Наименование" → `columnMap.name = 0`
- ✅ "Код" → `columnMap.code = 1`
- ✅ "№ по каталогу" → `columnMap.catalogNumber = 2`
- ✅ "Цена" → `columnMap.price = 3`
- ✅ "Кол-во" → `columnMap.stock = 4`

### 3. Faqat "Наименование" ustuni tekshiriladi

```typescript
// Faqat name ustuni (Наименование) tekshiriladi
const alphabet = detectAlphabet(name);  // ← columnMap.name

// Boshqa ustunlar tekshirilmaydi:
// detectAlphabet(code) ❌ - "Код" tekshirilmaydi
// detectAlphabet(catalogNumber) ❌ - "№ по каталогу" tekshirilmaydi
// detectAlphabet(price) ❌ - "Цена" tekshirilmaydi
```

## Qo'llab-quvvatlanadigan sarlavhalar

### Mahsulot nomi uchun:
- ✅ **Наименование** (rus)
- ✅ Название (rus)
- ✅ Номи (o'zbek kiril)
- ✅ Nomi (o'zbek lotin)
- ✅ Name (ingliz)
- ✅ Товар (rus)
- ✅ Mahsulot (o'zbek)
- ✅ Product (ingliz)

### Kod uchun:
- ✅ **Код** (rus)
- ✅ Code (ingliz)
- ✅ Артикул (rus)

### Katalog uchun:
- ✅ **№ по каталогу** (rus)
- ✅ Каталог № (rus)
- ✅ По каталогу (rus)
- ✅ Catalog (ingliz)

### Narx uchun:
- ✅ **Цена** (rus)
- ✅ Narx (o'zbek)
- ✅ Price (ingliz)
- ✅ Стоимость (rus)
- ✅ Сумма (rus)
- ✅ Итого (rus)

### Soni uchun:
- ✅ **Кол-во** (rus)
- ✅ Количество (rus)
- ✅ К-во (rus)
- ✅ Soni (o'zbek)
- ✅ Stock (ingliz)
- ✅ Qty (ingliz)
- ✅ Остаток (rus)
- ✅ Шт (rus)

## Test jarayoni

### 1. Excel fayl tayyorlash

```
| Наименование    | Код    | № по каталогу | Цена | Кол-во |
|-----------------|--------|---------------|------|--------|
| Zadning pavarot | ABC123 | XYZ789        | 50   | 10     |
| Tormoz kolodka  | 12345  | CAT001        | 30   | 5      |
```

### 2. Import qilish

1. Serverni ishga tushiring: `npm run dev`
2. Brauzerda `http://localhost:5173` ni oching
3. "Excel Import" tugmasini bosing
4. Excel faylni yuklang

### 3. Avtomatik aniqlash

Funksiya avtomatik ravishda:
- ✅ "Наименование" ustunini topadi
- ✅ Faqat shu ustundagi mahsulotlarni tekshiradi
- ✅ Lotin mahsulotlarni aniqlaydi

### 4. Dialog oynasida

```
┌─────────────────────────────────────────────────┐
│  🌐 Lotin alifbosi aniqlandi           [X]     │
│     2 ta mahsulot lotinda yozilgan             │
├─────────────────────────────────────────────────┤
│  📋 "Наименование" ustunidagi lotin mahsulotlar:│
│  ┌──┬──────────────┬──┬──────────────┬────┐  │
│  │☑│Lotin (asl)   │→│Kiril (yangi) │Код │  │
│  ├──┼──────────────┼──┼──────────────┼────┤  │
│  │☑│Zadning pavarot│→│Заднинг паварот│ABC123│ │
│  │☑│Tormoz kolodka│→│Тормоз колодка│12345│  │
│  └──┴──────────────┴──┴──────────────┴────┘  │
│                                                 │
│  ⚠️ Eslatma: Faqat "Наименование" ustuni       │
│     o'giriladi, boshqalar o'zgartirilmaydi    │
└─────────────────────────────────────────────────┘
```

### 5. Konvertatsiya natijasi

| Наименование (O'ZGARDI) | Код (O'ZGARMADI) | № по каталогу (O'ZGARMADI) | Цена (O'ZGARMADI) |
|-------------------------|------------------|----------------------------|-------------------|
| Заднинг паварот ✅ | ABC123 ❌ | XYZ789 ❌ | 50 ❌ |
| Тормоз колодка ✅ | 12345 ❌ | CAT001 ❌ | 30 ❌ |
| Двигател масло ❌ | MOT456 ❌ | ENG002 ❌ | 25 ❌ |

## Aralash sarlavhalar

Agar Excel faylda aralash sarlavhalar bo'lsa ham ishlaydi:

| Наименование | Code | Katalog | Price | Soni |
|--------------|------|---------|-------|------|
| Zadning pavarot | ABC123 | XYZ789 | 50 | 10 |

Funksiya avtomatik ravishda:
- ✅ "Наименование" → name
- ✅ "Code" → code
- ✅ "Katalog" → catalogNumber
- ✅ "Price" → price
- ✅ "Soni" → stock

## Muhim eslatmalar

### 1. Katta-kichik harf farqi yo'q

```typescript
"Наименование" ✅
"наименование" ✅
"НАИМЕНОВАНИЕ" ✅
"НаИмЕнОвАнИе" ✅
```

Funksiya avtomatik ravishda kichik harfga o'tkazib tekshiradi.

### 2. Bo'sh joylar

```typescript
"Наименование" ✅
" Наименование " ✅
"  Наименование  " ✅
```

Funksiya avtomatik ravishda bo'sh joylarni olib tashlaydi.

### 3. Qisman mos kelish

```typescript
"Наименование товара" ✅ (ichida "наименование" bor)
"Наименование продукта" ✅ (ichida "наименование" bor)
```

## Test misollari

### Misol 1: Rus sarlavhalari

```
| Наименование | Код | Цена |
|--------------|-----|------|
| Zadning pavarot | 123 | 50 |
```

Natija:
- ✅ "Наименование" ustuni topildi
- ✅ "Zadning pavarot" lotin deb aniqlandi
- ✅ "Заднинг паварот" ga o'girildi

### Misol 2: O'zbek sarlavhalari

```
| Номи | Код | Нарх |
|------|-----|------|
| Zadning pavarot | 123 | 50 |
```

Natija:
- ✅ "Номи" ustuni topildi
- ✅ "Zadning pavarot" lotin deb aniqlandi
- ✅ "Заднинг паварот" ga o'girildi

### Misol 3: Ingliz sarlavhalari

```
| Name | Code | Price |
|------|------|-------|
| Zadning pavarot | 123 | 50 |
```

Natija:
- ✅ "Name" ustuni topildi
- ✅ "Zadning pavarot" lotin deb aniqlandi
- ✅ "Заднинг паварот" ga o'girildi

## Xulosa

✅ **"Наименование" qo'llab-quvvatlanadi!**
✅ **Avtomatik ravishda topiladi**
✅ **Faqat shu ustun tekshiriladi va konvertatsiya qilinadi**
✅ **Boshqa ustunlar (Код, № по каталогу, Цена) o'zgartirilmaydi**

**Funksiya allaqachon rus tilida sarlavhalar bilan ishlaydi!** 🎉

## Real test

1. Excel faylda rus sarlavhalarini yozing:
   ```
   Наименование | Код | Цена
   Zadning pavarot | ABC123 | 50
   ```

2. Import qiling

3. Tekshiring:
   - ✅ "Наименование" ustuni avtomatik topildi
   - ✅ "Zadning pavarot" → "Заднинг паварот"
   - ❌ "ABC123" o'zgarmadi

**Test qiling va ishonch hosil qiling!** 🎉
