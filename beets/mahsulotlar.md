# 📦 MAHSULOTLAR (Products Management) - Batafsil Hujjat

## 📋 Umumiy Ma'lumot

**Fayl:** `client/pages/Products.tsx`

**Vazifasi:** Mahsulotlarni qo'shish, tahrirlash, o'chirish, boshqarish

**Texnologiya:** React, TypeScript, MongoDB, IndexedDB

---

## 🎯 Asosiy Funksiyalar

### 1. **Mahsulot CRUD Operatsiyalari**

#### 1.1. Mahsulot Tuzilmasi:
```typescript
interface Product {
  id: string;
  name: string;                    // Mahsulot nomi
  sku: string;                     // Mahsulot kodi (Stock Keeping Unit)
  catalogNumber?: string;          // Katalog raqami
  price: number;                   // Narx
  basePrice?: number;              // Asosiy narx (variant uchun)
  priceMultiplier?: number;        // Narx koeffitsienti
  currency: Currency;              // Valyuta (UZS, USD, RUB, CNY)
  stock: number;                   // Ombordagi soni
  categoryId?: string;             // Kategoriya ID
  status: ProductStatus;           // Holati
  imageUrl?: string;               // Rasm URL
  imagePaths?: string[];           // Ko'p rasmlar
  variants?: ProductVariant[];     // Variantlar
  variantSummaries?: VariantSummary[];
  parentProductId?: string;        // Ota mahsulot ID
  childProducts?: ChildProduct[];  // Bola mahsulotlar
  isHidden?: boolean;              // Yashirin mahsulot
  description?: string;            // Tavsif
  video?: VideoInfo;               // Video
  createdAt: Date;
  updatedAt: Date;
}
```

#### 1.2. CREATE - Mahsulot Qo'shish:
```typescript
const createProduct = async (product: ProductInput) => {
  // 1. Validatsiya
  if (!product.name || !product.sku) {
    throw new Error('Nom va kod majburiy');
  }
  
  // 2. SKU dublikat tekshirish
  const existing = await api.get(`/api/products?sku=${product.sku}`);
  if (existing.length > 0) {
    throw new Error('Bu kod allaqachon mavjud');
  }
  
  // 3. Mahsulot yaratish
  const response = await api.post('/api/products', {
    ...product,
    userId: user.id,
    createdAt: new Date(),
  });
  
  // 4. Offline DB ga saqlash
  await offlineDB.products.add(response.data);
  
  return response.data;
};
```

#### 1.3. READ - Mahsulotlarni O'qish:
```typescript
const getProducts = async (filters?: ProductFilters) => {
  // 1. API dan olish
  const response = await api.get('/api/products', {
    params: {
      categoryId: filters?.categoryId,
      status: filters?.status,
      search: filters?.search,
      page: filters?.page,
      limit: filters?.limit,
    }
  });
  
  // 2. Offline DB ga saqlash
  await offlineDB.products.bulkPut(response.data);
  
  return response.data;
};
```

#### 1.4. UPDATE - Mahsulotni Yangilash:
```typescript
const updateProduct = async (id: string, updates: Partial<Product>) => {
  // 1. Validatsiya
  if (updates.sku) {
    const existing = await api.get(`/api/products?sku=${updates.sku}`);
    if (existing.length > 0 && existing[0].id !== id) {
      throw new Error('Bu kod boshqa mahsulotda mavjud');
    }
  }
  
  // 2. Yangilash
  const response = await api.put(`/api/products/${id}`, {
    ...updates,
    updatedAt: new Date(),
  });
  
  // 3. Offline DB ni yangilash
  await offlineDB.products.update(id, updates);
  
  return response.data;
};
```

#### 1.5. DELETE - Mahsulotni O'chirish:
```typescript
const deleteProduct = async (id: string) => {
  // 1. Tasdiqlash
  const confirmed = await confirm('Mahsulotni o\'chirmoqchimisiz?');
  if (!confirmed) return;
  
  // 2. O'chirish
  await api.delete(`/api/products/${id}`);
  
  // 3. Offline DB dan o'chirish
  await offlineDB.products.delete(id);
  
  toast.success('Mahsulot o\'chirildi');
};
```

---

### 2. **Mahsulot Variantlari**

#### 2.1. Variant Tuzilmasi:
```typescript
interface ProductVariant {
  name: string;        // Variant nomi (masalan: "O'lcham")
  options: string[];   // Variantlar (masalan: ["1L", "4L", "5L"])
}

interface VariantSummary {
  name: string;        // Variant kombinatsiyasi (masalan: "1L")
  sku?: string;        // Variant kodi
  price?: number;      // Variant narxi
  stock?: number;      // Variant ombordagi soni
  status?: string;     // Variant holati
  imagePaths?: string[];
}
```

#### 2.2. Variant Yaratish:
```typescript
const createVariants = (product: Product, variants: ProductVariant[]) => {
  // Barcha kombinatsiyalarni yaratish
  const combinations = generateCombinations(variants);
  
  return combinations.map(combo => ({
    name: combo.join(' / '),
    sku: `${product.sku}-${combo.join('-')}`,
    basePrice: product.price,
    priceMultiplier: 1,
    stock: 0,
    status: 'available',
  }));
};

// Misol:
// Variants: [
//   { name: "O'lcham", options: ["1L", "4L"] },
//   { name: "Rang", options: ["Qizil", "Ko'k"] }
// ]
// Natija: ["1L / Qizil", "1L / Ko'k", "4L / Qizil", "4L / Ko'k"]
```

#### 2.3. Variant Modal:
```typescript
<VariantModal
  product={product}
  onSave={(variants) => {
    updateProduct(product.id, { variants });
  }}
/>
```

---

### 3. **Ota-Bola Mahsulot Tizimi**

#### 3.1. Ota-Bola Tuzilmasi:
```typescript
interface ChildProduct {
  productId: string;     // Bola mahsulot ID
  name: string;          // Bola mahsulot nomi
  autoActivate: boolean; // Ota tugaganda avtomatik faollashtirilsinmi?
}

interface ParentProduct extends Product {
  childProducts: ChildProduct[];
}

interface ChildProductData extends Product {
  parentProductId: string;
  isHidden: boolean;  // Ota tugamaguncha yashirin
}
```

#### 3.2. Ota Mahsulot Yaratish:
```typescript
const createParentProduct = async (parent: Product, children: Product[]) => {
  // 1. Ota mahsulotni yaratish
  const parentProduct = await createProduct(parent);
  
  // 2. Bola mahsulotlarni yaratish
  const childProducts = await Promise.all(
    children.map(child => createProduct({
      ...child,
      parentProductId: parentProduct.id,
      isHidden: true,  // Yashirin
    }))
  );
  
  // 3. Ota mahsulotga bola mahsulotlarni bog'lash
  await updateProduct(parentProduct.id, {
    childProducts: childProducts.map(c => ({
      productId: c.id,
      name: c.name,
      autoActivate: true,
    })),
  });
  
  return parentProduct;
};
```

#### 3.3. Avtomatik Faollashtirish:
```typescript
// Ota mahsulot tugaganda bola mahsulotni faollashtirish
const activateChildProduct = async (parentId: string) => {
  const parent = await getProduct(parentId);
  
  if (parent.stock === 0 && parent.childProducts) {
    const firstChild = parent.childProducts[0];
    
    if (firstChild.autoActivate) {
      await updateProduct(firstChild.productId, {
        isHidden: false,  // Ko'rinuvchi qilish
      });
      
      toast.info(`${firstChild.name} faollashtirildi`);
    }
  }
};
```

---

### 4. **Rasm Yuklash**

#### 4.1. Single Image Upload:
```typescript
const uploadImage = async (file: File) => {
  // 1. Validatsiya
  if (!file.type.startsWith('image/')) {
    throw new Error('Faqat rasm yuklash mumkin');
  }
  
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Rasm hajmi 5MB dan oshmasligi kerak');
  }
  
  // 2. FormData yaratish
  const formData = new FormData();
  formData.append('image', file);
  
  // 3. Yuklash
  const response = await api.post('/api/products/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  return response.data.imageUrl;
};
```

#### 4.2. Multiple Images Upload:
```typescript
const uploadMultipleImages = async (files: File[]) => {
  const urls = await Promise.all(
    files.map(file => uploadImage(file))
  );
  
  return urls;
};
```

#### 4.3. Drag & Drop:
```typescript
const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  
  const files = Array.from(e.dataTransfer.files);
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  
  if (imageFiles.length > 0) {
    const urls = await uploadMultipleImages(imageFiles);
    setImageUrls(urls);
  }
};
```

---

### 5. **Excel Import**

#### 5.1. Excel Fayl Formati:
```
| Mahsulot Nomi | Kod | Katalog | Narx | Soni | Kategoriya |
|---------------|-----|---------|------|------|------------|
| Moy 5W-30 1L  | M001| CAT123  | 50000| 100  | Moylar     |
| Moy 5W-30 4L  | M002| CAT124  | 180000| 50  | Moylar     |
```

#### 5.2. Excel Import Jarayoni:
```typescript
const importFromExcel = async (file: File) => {
  // 1. Excel faylni o'qish
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  // 2. Ma'lumotlarni parse qilish
  const products = data.map(row => ({
    name: row['Mahsulot Nomi'],
    sku: row['Kod'],
    catalogNumber: row['Katalog'],
    price: parseFloat(row['Narx']),
    stock: parseInt(row['Soni']),
    categoryId: findCategoryByName(row['Kategoriya']),
  }));
  
  // 3. Validatsiya
  const errors = validateProducts(products);
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  // 4. Import qilish
  const imported = await api.post('/api/excel-import', { products });
  
  return { success: true, count: imported.length };
};
```

#### 5.3. Birinchi 2 So'z bilan Guruhlash:
```typescript
const groupByFirstTwoWords = (products: Product[]) => {
  const groups = new Map<string, Product[]>();
  
  products.forEach(product => {
    const words = product.name.split(' ');
    const key = words.slice(0, 2).join(' ');
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    
    groups.get(key)!.push(product);
  });
  
  return groups;
};

// Misol:
// "Moy 5W-30 1L" -> "Moy 5W-30"
// "Moy 5W-30 4L" -> "Moy 5W-30"
// "Moy 5W-30 5L" -> "Moy 5W-30"
// Natija: 1 ta ota mahsulot, 3 ta bola mahsulot (variant)
```

---

### 6. **Qidiruv va Filtrlash**

#### 6.1. Qidiruv:
```typescript
const searchProducts = (query: string, products: Product[]) => {
  const lowerQuery = query.toLowerCase();
  
  return products.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.sku.toLowerCase().includes(lowerQuery) ||
    p.catalogNumber?.toLowerCase().includes(lowerQuery) ||
    p.description?.toLowerCase().includes(lowerQuery)
  );
};
```

#### 6.2. Kategoriya bo'yicha Filtrlash:
```typescript
const filterByCategory = (categoryId: string, products: Product[]) => {
  return products.filter(p => p.categoryId === categoryId);
};
```

#### 6.3. Holat bo'yicha Filtrlash:
```typescript
const filterByStatus = (status: ProductStatus, products: Product[]) => {
  return products.filter(p => p.status === status);
};
```

#### 6.4. Narx oralig'i bo'yicha Filtrlash:
```typescript
const filterByPriceRange = (min: number, max: number, products: Product[]) => {
  return products.filter(p => p.price >= min && p.price <= max);
};
```

---

### 7. **Mahsulot Holati (Status)**

#### 7.1. Holat Turlari:
```typescript
type ProductStatus = 
  | 'available'      // Mavjud
  | 'pending'        // Kutilmoqda
  | 'out-of-stock'   // Tugagan
  | 'discontinued';  // Ishlab chiqarilmaydi

const productStatusConfig = {
  available: {
    label: 'Mavjud',
    color: 'green',
    icon: Check,
  },
  pending: {
    label: 'Kutilmoqda',
    color: 'yellow',
    icon: Clock,
  },
  'out-of-stock': {
    label: 'Tugagan',
    color: 'red',
    icon: AlertTriangle,
  },
  discontinued: {
    label: 'Ishlab chiqarilmaydi',
    color: 'gray',
    icon: X,
  },
};
```

#### 7.2. Avtomatik Holat Yangilash:
```typescript
// Ombor 0 ga tushganda avtomatik "tugagan" qilish
const updateStockStatus = async (productId: string, newStock: number) => {
  await updateProduct(productId, {
    stock: newStock,
    status: newStock === 0 ? 'out-of-stock' : 'available',
  });
};
```

---

### 8. **Barcode Label Chop Etish**

#### 8.1. Label Tuzilmasi:
```typescript
interface BarcodeLabel {
  productName: string;
  sku: string;
  price: number;
  currency: Currency;
  barcode: string;
}
```

#### 8.2. Label Chop Etish:
```typescript
const printLabel = async (product: Product, quantity: number = 1) => {
  const printer = await getDefaultLabelPrinter();
  
  const label: BarcodeLabel = {
    productName: product.name,
    sku: product.sku,
    price: product.price,
    currency: product.currency,
    barcode: product.sku,
  };
  
  // Ko'p label chop etish
  for (let i = 0; i < quantity; i++) {
    await printer.printLabel(label);
  }
};
```

#### 8.3. Label O'lchamlari:
```typescript
const LABEL_SIZES = {
  '40x30': { width: 40, height: 30 },  // mm
  '50x30': { width: 50, height: 30 },
  '60x40': { width: 60, height: 40 },
};
```

---

### 9. **Mahsulot Tarixi**

#### 9.1. Tarix Tuzilmasi:
```typescript
interface ProductHistory {
  id: string;
  productId: string;
  action: 'create' | 'update' | 'delete' | 'stock_change';
  changes: Record<string, any>;
  userId: string;
  userName: string;
  timestamp: Date;
}
```

#### 9.2. Tarix Saqlash:
```typescript
const saveHistory = async (productId: string, action: string, changes: any) => {
  await api.post('/api/product-history', {
    productId,
    action,
    changes,
    userId: user.id,
    userName: user.name,
    timestamp: new Date(),
  });
};
```

#### 9.3. Tarix Ko'rish:
```typescript
const getProductHistory = async (productId: string) => {
  return await api.get(`/api/product-history?productId=${productId}`);
};
```

---

### 10. **Ombor Boshqaruvi**

#### 10.1. Ombor Yangilash:
```typescript
const updateStock = async (productId: string, quantity: number) => {
  const product = await getProduct(productId);
  const newStock = product.stock + quantity;
  
  if (newStock < 0) {
    throw new Error('Omborda yetarli mahsulot yo\'q');
  }
  
  await updateProduct(productId, { stock: newStock });
  
  // Tarixga saqlash
  await saveHistory(productId, 'stock_change', {
    oldStock: product.stock,
    newStock,
    change: quantity,
  });
};
```

#### 10.2. Ombor Ogohlantirish:
```typescript
const checkLowStock = (products: Product[]) => {
  const lowStock = products.filter(p => p.stock < 10 && p.stock > 0);
  
  if (lowStock.length > 0) {
    toast.warning(`${lowStock.length} ta mahsulot kam qoldi`);
  }
};
```

---

## 🔧 Texnik Tafsilotlar

### State Management:
```typescript
const [products, setProducts] = useState<Product[]>([]);
const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
const [filters, setFilters] = useState<ProductFilters>({});
const [isLoading, setIsLoading] = useState(false);
```

### API Endpoints:
- `GET /api/products` - Mahsulotlar ro'yxati
- `POST /api/products` - Yangi mahsulot
- `PUT /api/products/:id` - Mahsulotni yangilash
- `DELETE /api/products/:id` - Mahsulotni o'chirish
- `POST /api/products/upload-image` - Rasm yuklash
- `POST /api/excel-import` - Excel import
- `GET /api/product-history` - Mahsulot tarixi

---

## 🎨 UI Komponentlar

### Asosiy Komponentlar:
- **ProductCard** - Mahsulot kartochkasi
- **ProductForm** - Mahsulot formasi
- **VariantModal** - Variant modal
- **ExcelImportModal** - Excel import modal
- **ProductStatusSelector** - Holat tanlash
- **ImageUploader** - Rasm yuklash
- **BarcodeGenerator** - Barcode yaratish

---

**Yaratilgan:** 2025-02-10
**Versiya:** 1.0.0
**Muallif:** AvtoFix Development Team
