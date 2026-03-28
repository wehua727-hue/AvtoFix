# 📊 EXCEL IMPORT - Excel dan Mahsulot Import

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `client/components/ExcelImportModal.tsx`
- `server/routes/excel-import.ts`

**Texnologiya:** XLSX.js

---

## 📄 Excel Fayl Formati

### Ustunlar:
| Mahsulot Nomi | Kod | Katalog | Narx | Soni | Kategoriya |
|---------------|-----|---------|------|------|------------|
| Moy 5W-30 1L  | M001| CAT123  | 50000| 100  | Moylar     |
| Moy 5W-30 4L  | M002| CAT124  | 180000| 50  | Moylar     |

---

## 🎯 Import Jarayoni

### 1. Excel Yuklash
```typescript
const file = event.target.files[0];
const workbook = XLSX.read(await file.arrayBuffer());
```

### 2. Ma'lumotlarni Parse Qilish
```typescript
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
```

### 3. Validatsiya
- Majburiy ustunlar bormi?
- Ma'lumotlar to'g'rimi?
- Dublikat SKU bormi?

### 4. Preview
- Barcha mahsulotlarni ko'rsatish
- Tahrirlash imkoniyati
- Xatolarni ko'rsatish

### 5. Import
```typescript
POST /api/excel-import
{
  products: [...]
}
```

---

## 🔄 Birinchi 2 So'z bilan Guruhlash

### Algoritm:
```typescript
const groupByFirstTwoWords = (products) => {
  const groups = new Map();
  
  products.forEach(product => {
    const words = product.name.split(' ');
    const key = words.slice(0, 2).join(' ');
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    
    groups.get(key).push(product);
  });
  
  return groups;
};
```

### Misol:
```
Input:
- "Moy 5W-30 1L"
- "Moy 5W-30 4L"
- "Moy 5W-30 5L"

Output:
- Ota: "Moy 5W-30" (birinchi mahsulot)
- Bola 1: "Moy 5W-30 1L" (variant)
- Bola 2: "Moy 5W-30 4L" (variant)
- Bola 3: "Moy 5W-30 5L" (variant)
```

---

## ⚠️ Xato Boshqaruvi

### Xato Turlari:
- Noto'g'ri fayl formati
- Majburiy ustunlar yo'q
- Dublikat SKU
- Noto'g'ri narx
- Noto'g'ri soni

### Xato Xabarlari:
```typescript
{
  row: 5,
  field: "sku",
  error: "Bu kod allaqachon mavjud"
}
```

---

**Yaratilgan:** 2025-02-10
