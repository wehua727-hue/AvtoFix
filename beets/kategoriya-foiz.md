# 📊 KATEGORIYA & FOIZ - Category Markup Percentage

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `server/routes/categories.ts` - Backend API
- `client/pages/AddCategory.tsx` - Frontend UI
- `server/product.model.ts` - Product model
- `shared/types.ts` - Shared types

**Vazifasi:** Har bir kategoriyaga ustama foiz (markup percentage) qo'shish va shu kategoriyaga tegishli barcha mahsulotlarning sotilish narxini avtomatik hisoblash.

---

## 🎯 Asosiy Funksiya

### Maqsad:
Kategoriya bo'yicha mahsulotlar narxini boshqarish - bir kategoriyaga tegishli barcha mahsulotlarning ustama foizini bir vaqtning o'zida o'zgartirish.

### Misol:
```
Kategoriya: KAMAZ
Ustama foiz: 20% (default)
Mahsulotlar soni: 100 ta

Mahsulot 1:
- Asl narx (basePrice): $10
- Ustama foiz: 20%
- Sotilish narxi (price): $10 + ($10 × 20%) = $12

Agar kategoriya foizini 50% ga o'zgartirsak:
- Asl narx: $10 (o'zgarmaydi)
- Ustama foiz: 50%
- Sotilish narxi: $10 + ($10 × 50%) = $15
```

---

## 💻 Texnik Tafsilotlar

### 1. Database Schema

#### Category Schema:
```typescript
interface CategoryDoc {
  _id: any;
  name?: string;
  storeId?: string;
  parentId?: any;
  order?: number;
  level?: number;
  isActive?: boolean;
  slug?: string;
  userId?: string;
  markupPercentage?: number; // 🆕 Ustama foiz (default: 20)
}
```

#### Product Schema:
```typescript
export interface IProduct extends Document {
  name: string;
  price?: number;              // Sotilish narxi (selling price)
  basePrice?: number;          // Asl narx (base price) - o'zgarmaydi
  markupPercentage?: number;   // 🆕 Ustama foiz (kategoriyadan olinadi)
  categoryId?: string;
  // ... boshqa fieldlar
}
```

---

### 2. Backend API

#### Endpoint:
```
PUT /api/categories/:id/markup
```

#### Request Body:
```json
{
  "markupPercentage": 50
}
```

#### Response:
```json
{
  "success": true,
  "category": {
    "id": "...",
    "name": "KAMAZ",
    "markupPercentage": 50
  },
  "updatedProductsCount": 100,
  "message": "Kategoriya va 100 ta mahsulot narxi yangilandi"
}
```

#### Algoritm:
```typescript
export const handleCategoryMarkupUpdate: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { markupPercentage } = req.body;

  // 1. Kategoriyani yangilash
  await db.collection(CATEGORIES_COLLECTION).findOneAndUpdate(
    { _id },
    { $set: { markupPercentage } },
    { returnDocument: "after" }
  );

  // 2. Shu kategoriyaga tegishli barcha mahsulotlarni topish
  const products = await db.collection(PRODUCTS_COLLECTION).find({ 
    categoryId: id 
  }).toArray();

  // 3. Har bir mahsulot uchun yangi narxni hisoblash
  const bulkOps = [];
  for (const product of products) {
    const basePrice = product.basePrice || product.price || 0;
    
    // Yangi sotilish narxi = basePrice + (basePrice * markupPercentage / 100)
    const sellingPrice = basePrice + (basePrice * markupPercentage / 100);

    bulkOps.push({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            markupPercentage,
            price: sellingPrice,
            // Agar basePrice yo'q bo'lsa, hozirgi narxni basePrice sifatida saqlash
            ...(product.basePrice ? {} : { basePrice: product.price || 0 })
          }
        }
      }
    });
  }

  // 4. Barcha mahsulotlarni bir vaqtda yangilash (bulk operation)
  if (bulkOps.length > 0) {
    await db.collection(PRODUCTS_COLLECTION).bulkWrite(bulkOps);
  }

  return res.json({ 
    success: true, 
    category,
    updatedProductsCount: bulkOps.length,
    message: `Kategoriya va ${bulkOps.length} ta mahsulot narxi yangilandi`
  });
};
```

---

### 3. Frontend UI

#### Kategoriya Kartochkasi:
```tsx
<div className="flex flex-col gap-3">
  {/* Kategoriya nomi */}
  <div className="flex items-center justify-between">
    <span>{category.name}</span>
    <div className="flex gap-2">
      <button onClick={() => handleEdit(category)}>
        <Pencil />
      </button>
      <button onClick={() => handleDelete(category.id)}>
        <Trash2 />
      </button>
    </div>
  </div>

  {/* 🆕 Ustama foiz qismi */}
  <div className="flex items-center gap-3 pt-2 border-t">
    <span className="text-xs text-gray-400">Ustama foiz:</span>
    <Input
      type="number"
      min="0"
      value={localMarkup}
      onChange={(e) => setLocalMarkup(Number(e.target.value))}
      className="w-20 h-8"
    />
    <span className="text-xs">%</span>
    <Button
      onClick={() => handleUpdateMarkup(category.id, localMarkup)}
      disabled={updatingMarkupId === category.id}
    >
      {updatingMarkupId === category.id ? 'Yangilanmoqda...' : 'Narxlarni yangilash'}
    </Button>
  </div>
</div>
```

#### Update Funksiyasi:
```typescript
const handleUpdateMarkup = async (categoryId: string, newMarkup: number) => {
  if (newMarkup < 0) {
    alert('Foiz manfiy bo\'lishi mumkin emas');
    return;
  }

  setUpdatingMarkupId(categoryId);
  try {
    const res = await fetch(`/api/categories/${categoryId}/markup`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ markupPercentage: newMarkup }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(`Xatolik: ${data?.message || 'Foizni yangilab bo\'lmadi'}`);
      return;
    }

    if (data?.success) {
      // Kategoriyani yangilash
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, markupPercentage: newMarkup } : c))
      );
      
      alert(`✅ ${data.message || 'Kategoriya va mahsulotlar narxi yangilandi'}`);
    }
  } catch (err) {
    console.error('Error updating markup:', err);
    alert(`Xatolik yuz berdi: ${err instanceof Error ? err.message : 'Noma\'lum xatolik'}`);
  } finally {
    setUpdatingMarkupId(null);
  }
};
```

---

## 🔄 Ishlash Jarayoni

### 1. Kategoriya Yaratish:
```
1. Foydalanuvchi kategoriya yaratadi
2. Default markupPercentage = 20% qo'yiladi
3. Kategoriya MongoDB ga saqlanadi
```

### 2. Mahsulot Qo'shish:
```
1. Foydalanuvchi mahsulot qo'shadi
2. Kategoriya tanlanadi
3. basePrice kiritiladi (asl narx)
4. Kategoriyadan markupPercentage olinadi
5. Sotilish narxi avtomatik hisoblanadi:
   price = basePrice + (basePrice * markupPercentage / 100)
```

### 3. Kategoriya Foizini O'zgartirish:
```
1. Foydalanuvchi kategoriya foizini o'zgartiradi (masalan: 20% → 50%)
2. Backend API ga so'rov yuboriladi
3. Backend:
   a. Kategoriyani yangilaydi
   b. Shu kategoriyaga tegishli barcha mahsulotlarni topadi
   c. Har bir mahsulot uchun yangi narxni hisoblaydi
   d. Barcha mahsulotlarni bulk operation bilan yangilaydi
4. Frontend:
   a. Kategoriya ma'lumotlarini yangilaydi
   b. Foydalanuvchiga xabar ko'rsatadi
```

---

## 📊 Narx Hisoblash Formulasi

### Asosiy Formula:
```
Sotilish narxi = Asl narx + (Asl narx × Ustama foiz / 100)
```

### Misol 1:
```
Asl narx: $10
Ustama foiz: 20%
Sotilish narxi: $10 + ($10 × 20 / 100) = $10 + $2 = $12
```

### Misol 2:
```
Asl narx: $10
Ustama foiz: 50%
Sotilish narxi: $10 + ($10 × 50 / 100) = $10 + $5 = $15
```

### Misol 3:
```
Asl narx: $100
Ustama foiz: 30%
Sotilish narxi: $100 + ($100 × 30 / 100) = $100 + $30 = $130
```

---

## 🎯 Foydalanish Holatlari

### 1. Kategoriya bo'yicha narxlarni oshirish:
```
Vaziyat: Barcha KAMAZ ehtiyot qismlari narxi oshdi
Yechim: KAMAZ kategoriyasining foizini 20% dan 30% ga oshirish
Natija: Barcha KAMAZ mahsulotlari narxi avtomatik 10% ga oshadi
```

### 2. Kategoriya bo'yicha narxlarni kamaytirish:
```
Vaziyat: Aksiya - barcha moylar 10% chegirma
Yechim: Moylar kategoriyasining foizini 20% dan 10% ga kamaytirish
Natija: Barcha moylar narxi avtomatik 10% ga kamayadi
```

### 3. Yangi kategoriya uchun foiz belgilash:
```
Vaziyat: Yangi kategoriya yaratildi - Premium ehtiyot qismlar
Yechim: Kategoriya yaratishda foizni 50% qilish
Natija: Shu kategoriyaga qo'shilgan barcha mahsulotlar 50% ustama bilan sotiladi
```

---

## ⚠️ Muhim Eslatmalar

### 1. basePrice vs price:
- **basePrice** - Asl narx (o'zgarmaydi, sotib olingan narx)
- **price** - Sotilish narxi (avtomatik hisoblanadi)

### 2. Eski mahsulotlar:
- Agar mahsulotda basePrice yo'q bo'lsa, hozirgi price basePrice sifatida saqlanadi
- Keyin yangi price hisoblanadi

### 3. Bulk Operation:
- Barcha mahsulotlar bir vaqtda yangilanadi (tez va samarali)
- MongoDB bulkWrite() ishlatiladi

### 4. Validatsiya:
- Foiz manfiy bo'lishi mumkin emas
- Foiz 0 dan katta bo'lishi kerak

---

## 🧪 Test Holatlari

### Test 1: Kategoriya foizini yangilash
```
Input:
- Kategoriya: KAMAZ
- Eski foiz: 20%
- Yangi foiz: 50%
- Mahsulotlar: 100 ta

Expected Output:
- Kategoriya markupPercentage: 50%
- Barcha 100 ta mahsulot narxi yangilandi
- Har bir mahsulot markupPercentage: 50%
```

### Test 2: Yangi mahsulot qo'shish
```
Input:
- Kategoriya: KAMAZ (markupPercentage: 50%)
- Mahsulot basePrice: $10

Expected Output:
- Mahsulot price: $15
- Mahsulot markupPercentage: 50%
```

### Test 3: basePrice yo'q mahsulot
```
Input:
- Mahsulot price: $12
- Mahsulot basePrice: undefined
- Kategoriya markupPercentage: 50%

Expected Output:
- Mahsulot basePrice: $12 (eski price)
- Mahsulot price: $18 (yangi price)
- Mahsulot markupPercentage: 50%
```

---

## 🐛 Muammolar va Yechimlar

### Muammo 1: Ba'zi mahsulotlar yangilanmaydi
**Sabab:** Mahsulotda `basePrice` yo'q yoki 0

**Yechim:**
```typescript
// Backend avtomatik ravishda hozirgi price ni basePrice sifatida o'rnatadi
let basePrice = product.basePrice;
let needsBasePriceUpdate = false;

if (!basePrice || basePrice === 0) {
  basePrice = product.price || 0;
  needsBasePriceUpdate = true;
}

// Agar basePrice hali ham 0 bo'lsa, mahsulotni o'tkazib yuborish
if (basePrice === 0) {
  console.log('⚠️ Skipping product (basePrice is 0)');
  continue;
}
```

**Debug:** Server console'da quyidagi loglar ko'rsatiladi:
- `[handleCategoryMarkupUpdate] ✅ Updating product: ...` - yangilanayotgan mahsulotlar
- `[handleCategoryMarkupUpdate] ⚠️ Skipping product: ...` - o'tkazib yuborilgan mahsulotlar

### Muammo 2: TypeScript xatolari (req.params.id)
**Sabab:** `req.params.id` ning type'i `string | string[]`

**Yechim:**
```typescript
const id = req.params.id as string; // Type assertion
```

### Muammo 3: bulkOps array type xatosi
**Sabab:** TypeScript array type'ini to'g'ri aniqlay olmaydi

**Yechim:**
```typescript
const bulkOps: any[] = []; // Explicit type annotation
```

### Muammo 4: Variant narxlari yangilanmaydi
**Sabab:** Variantlar uchun alohida yangilash kerak

**Yechim:**
```typescript
// Variantlarni ham yangilash
if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
  const updatedVariants = product.variantSummaries.map((variant: any) => {
    let variantBasePrice = variant.basePrice;
    if (!variantBasePrice || variantBasePrice === 0) {
      variantBasePrice = variant.price || 0;
    }
    
    const variantSellingPrice = variantBasePrice + (variantBasePrice * markupPercentage / 100);
    
    return {
      ...variant,
      basePrice: variantBasePrice,
      price: variantSellingPrice,
      markupPercentage: markupPercentage
    };
  });

  bulkOps[bulkOps.length - 1].updateOne.update.$set.variantSummaries = updatedVariants;
}
```

---

## 📈 Kelajakda Qo'shilishi Mumkin

### 1. Tarix:
- Kategoriya foizi o'zgarishlar tarixi
- Mahsulot narxi o'zgarishlar tarixi

### 2. Bulk Import:
- Excel dan import qilganda kategoriya foizini avtomatik qo'llash

### 3. Variant Support:
- Mahsulot variantlari uchun alohida foiz

### 4. Statistika:
- Kategoriya bo'yicha foyda hisoboti
- Eng yuqori foizli kategoriyalar

---

**Yaratilgan:** 2025-02-10
**Oxirgi yangilanish:** 2025-02-10
**Versiya:** 1.0.0
**Muallif:** AvtoFix Development Team
