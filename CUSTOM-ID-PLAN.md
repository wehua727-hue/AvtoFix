# Custom ID Rejasi

## Status: ✅ BAJARILDI

## Muammo
- Mahsulotlarni o'chirib qayta qo'shganda MongoDB yangi ID beradi
- Eski stikerlar ishlamay qoladi
- 2004 ta mahsulot uchun yangi stiker chop etish kerak

## Yechim
Mahsulot qo'shishda qo'lda **Custom ID** kiritish imkoniyati:
- Agar Custom ID kiritilsa - uni ishlatamiz (masalan: `98F3C471`)
- Agar kiritilmasa - MongoDB avtomatik ID beradi
- Custom ID unique bo'lishi kerak (bir xil ID 2 marta ishlatib bo'lmaydi)

## O'zgarishlar

### 1. Database Schema ✅
```typescript
{
  _id: ObjectId,           // MongoDB ID (har doim bor)
  customId: string,        // Qo'lda kiritilgan ID (optional, unique)
  name: string,
  sku: string,
  price: number,
  stock: number,
  variantSummaries: [{     // Xillar
    name: string,
    sku: string,
    customId: string,      // ✅ Xil uchun Custom ID
    // ...
  }],
  // ... boshqa fieldlar
}
```

### 2. Backend API ✅
**POST /api/products** - mahsulot yaratish
```typescript
{
  customId: "98F3C471",  // Optional - agar berilsa unique bo'lishi kerak
  name: "Mahsulot nomi",
  sku: "1",
  price: 100000,
  variantSummaries: [{
    name: "Xil nomi",
    sku: "2",
    customId: "ABC12345",  // ✅ Xil uchun Custom ID
    // ...
  }],
  // ...
}
```

**Validation:**
- `customId` unique bo'lishi kerak
- Agar `customId` allaqachon mavjud bo'lsa - xatolik qaytarish
- Xil `customId` ham unique bo'lishi kerak

### 3. Frontend - Mahsulot Qo'shish ✅
**Products.tsx** - yangi input qo'shildi:
```tsx
<Input
  label="Custom ID (ixtiyoriy)"
  placeholder="Masalan: 98F3C471"
  value={customId}
  onChange={(e) => setCustomId(e.target.value.toUpperCase())}
  helperText="Agar kiritmasangiz, avtomatik ID beriladi"
/>
```

### 4. Frontend - Xil Qo'shish ✅
**VariantModal.tsx** - yangi input qo'shildi:
```tsx
<Input
  label="Custom ID (ixtiyoriy)"
  placeholder="Masalan: 98F3C471"
  value={customId}
  onChange={(e) => setCustomId(e.target.value.toUpperCase())}
  helperText="Eski senik yopishtirgan mahsulotni qayta qo'shganda, eski ID ni bu yerga kiriting"
/>
```

### 5. Senik Chop Etish ✅
**ProductDetail.tsx** - barcode uchun customId ishlatish:
```typescript
// Avval customId ni tekshirish, keyin MongoDB ID
let barcode: string;
let barcodeId: string; // Barcode ostida ko'rsatiladigan ID

if (product.customId) {
  barcode = product.customId.toUpperCase();
  barcodeId = barcode; // ✅ Barcode ostida ham customId ko'rsatiladi
} else {
  // MongoDB ID dan barcode yaratish
  barcodeId = productIdString.slice(-8).toUpperCase();
  barcode = barcodeId;
}

// Xillar uchun ham
if (variant.customId) {
  barcode = variant.customId.toUpperCase();
  barcodeId = barcode; // ✅ Barcode ostida ham customId ko'rsatiladi
} else {
  barcodeId = `${productIdShort}V${variantIndex}`;
  barcode = barcodeId;
}
```

### 6. Kassa Scanner ✅
**useOfflineKassa.ts** - searchBySkuWithVariant funksiyasiga qo'shildi:
```typescript
// 1. CustomId bo'yicha qidirish (eng yuqori prioritet)
for (const product of products) {
  if (product.customId?.toUpperCase() === normalizedCodeUpper) {
    return { product, variantIndex: undefined };
  }
  
  // Xil customId bo'yicha qidirish
  if (product.variantSummaries) {
    for (let i = 0; i < product.variantSummaries.length; i++) {
      const variant = product.variantSummaries[i];
      if (variant.customId?.toUpperCase() === normalizedCodeUpper) {
        return { product: variantProduct, variantIndex: i };
      }
    }
  }
}

// 2. MongoDB ID bo'yicha qidirish (eski usul)
// ...
```

## Foydalanish

### Yangi Mahsulot Qo'shish
1. Mahsulotlar sahifasiga o'ting
2. "Mahsulot qo'shish" tugmasini bosing
3. **Custom ID** maydoniga ID kiriting (masalan: `98F3C471`)
4. Boshqa ma'lumotlarni kiriting
5. Saqlang

### Yangi Xil Qo'shish
1. Mahsulot sahifasida "Xil qo'shish" tugmasini bosing
2. **Custom ID** maydoniga ID kiriting (masalan: `ABC12345`)
3. Boshqa ma'lumotlarni kiriting
4. Saqlang

### Eski Mahsulotlarni Qayta Qo'shish
1. Excel fayldan import qiling
2. Har bir mahsulot uchun eski Custom ID ni kiriting
3. Eski stikerlar ishlaydi ✅

### Senik Chop Etish
1. Mahsulot sahifasida "Senik chop etish"
2. Barcode = Custom ID (agar mavjud bo'lsa)
3. Eski stikerlar bilan bir xil ID chiqadi ✅

### Kassa Scanner
1. Stikerdan barcode ni skanerlang
2. Kassa Custom ID bo'yicha qidiradi (eng birinchi)
3. Mahsulot yoki xil topiladi va savatga qo'shiladi ✅

## Afzalliklar
- ✅ Eski stikerlar ishlaydi
- ✅ Yangi stiker chop etish shart emas
- ✅ Custom ID ixtiyoriy (majburiy emas)
- ✅ MongoDB ID ham ishlaydi (backward compatible)
- ✅ Xillar uchun ham ishlaydi

## Kamchiliklar
- ⚠️ Qo'lda ID kiritish kerak (2004 ta mahsulot uchun)
- ⚠️ ID unique bo'lishi kerak (dublikat bo'lmasligi kerak)

## Alternativ Yechim
Agar 2004 ta mahsulot uchun qo'lda ID kiritish qiyin bo'lsa:
1. Excel faylga Custom ID ustuni qo'shing
2. Import scriptda Custom ID ni o'qing
3. Avtomatik import qiling

## Bajarilgan Ishlar
1. ✅ Backend - customId field qo'shish (CREATE)
2. ✅ Backend - customId field qo'shish (UPDATE) - **YANGI FIX**
3. ✅ Backend - validation qo'shish (duplicate check)
4. ✅ Frontend - mahsulot formiga input qo'shish
5. ✅ Frontend - xil formiga input qo'shish
6. ✅ Senik - customId ishlatish (mahsulot va xillar uchun)
7. ✅ Kassa - customId bo'yicha qidirish (mahsulot va xillar uchun)
8. ✅ Interfaces - customId qo'shish (Product, VariantSummary, OfflineProduct, OfflineVariant)
9. ✅ Debug logging qo'shish (frontend va backend)

## Tuzatilgan Muammolar
1. ✅ **UPDATE funksiyasida customId yo'q edi** - Mahsulotni tahrirlashda customId saqlanmayotgan edi
   - `handleProductUpdate` funksiyasiga customId handling qo'shildi
   - Duplicate check qo'shildi (o'zidan boshqa mahsulotlarda)
   - Bo'sh qiymat uchun customId ni o'chirish qo'shildi

2. ✅ **Scanner Enter tugmasi muammosi** - Barcode scanner bilan ID kiritganda avtomatik Enter bosilayotgan edi
   - Custom ID input maydoniga `onKeyDown` handler qo'shildi
   - Enter tugmasi bloklandi va focus keyingi input ga o'tkaziladi
   - Mahsulot formasi (Products.tsx) va Xil formasi (VariantModal.tsx) da tuzatildi

3. ✅ **Tahrirlashda customId yuklanmayotgan edi** - Mahsulotni tahrirlash uchun ochganda customId bo'sh edi
   - Mahsulot ma'lumotlarini yuklash joyiga `setCustomId` qo'shildi (2 ta joyda)
   - Endi tahrirlashda customId to'g'ri yuklanadi va ko'rsatiladi

4. ✅ **Xillarning customId si MongoDB ga saqlanmayotgan edi** - Xilga kiritilgan ID saqlanmayotgan edi
   - CREATE funksiyasida variantSummaries map da customId qo'shildi
   - UPDATE funksiyasida addVariantMode da customId qo'shildi
   - UPDATE funksiyasida oddiy yangilash rejimida customId qo'shildi
   - Endi xillarning customId si to'g'ri saqlanadi

5. ✅ **Frontend onSave handlerida customId yo'q edi** - VariantModal dan qaytgan customId variantSummaries ga qo'shilmayotgan edi
   - Products.tsx da VariantModal onSave handlerida yangi xil qo'shishda customId qo'shildi
   - Products.tsx da VariantModal onSave handlerida xil tahrirlashda customId qo'shildi
   - Endi frontend da ham customId to'g'ri saqlanadi va backend ga yuboriladi

## Test Qilish Kerak
- [ ] Yangi mahsulot qo'shish va customId kiritish
- [ ] Yangi xil qo'shish va customId kiritish
- [ ] Senik chop etish va customId tekshirish
- [ ] Kassa scanner bilan customId bo'yicha qidirish
- [ ] Duplicate customId validation tekshirish
- [ ] Bo'sh customId bilan ishlashni tekshirish (MongoDB ID ishlatilishi kerak)



6. ✅ **GET endpoint response mapping muammosi** - MongoDB dan to'g'ri o'qilgan customId response da yo'qolayotgan edi
   - PUT response mapping da customId explicitly qo'shildi
   - GET /api/products da variantSummaries mapping ga customId qo'shildi
   - GET /api/products/:id da variantSummaries mapping ga customId qo'shildi
   - Debug logging qo'shildi (MongoDB ga nima saqlanayotgani va nima qaytayotganini ko'rish uchun)
   - Endi customId to'g'ri saqlanadi va to'g'ri o'qiladi

7. ✅ **Frontend variant edit loading muammosi** - Xilni tahrirlash uchun ochganda customId input maydonida ko'rinmayotgan edi
   - `setEditingVariantInitialData` ga `customId: variant?.customId ?? ''` qo'shildi (Products.tsx, line ~3843)
   - Endi xilni tahrirlash uchun ochganda customId to'g'ri yuklanadi va input maydonida ko'rinadi

## Keyingi Test
1. ✅ **TUZATILDI** - Xilni tahrirlash uchun ochganda customId yuklanmayotgan edi
   - `setEditingVariantInitialData` ga `customId: variant?.customId ?? ''` qo'shildi
   - Endi xilni tahrirlash uchun ochganda customId input maydonida ko'rinadi

## Test Qilish
1. Xilni tahrirlang va customId kiriting (masalan: `6921734922717`)
2. Saqlang
3. Sahifani yangilang
4. Xilni qayta tahrirlash uchun oching
5. CustomId input maydonida `6921734922717` ko'rinishi kerak ✅
6. Kassa sahifasiga o'ting va `6921734922717` ni skanerlang
7. Xil topilishi va savatga qo'shilishi kerak ✅
