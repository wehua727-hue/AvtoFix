# KASSA QISMI - TO'LIQ TAHLIL

## 🎯 KASSA NIMA?

Kassa - bu **offline sotish tizimi**. Mahsulotlarni qo'shish, sotish, qaytarish va chek chop etish uchun.

---

## 📊 KASSA QISMLARI

### 1️⃣ Frontend: Kassa.tsx

**Fayl:** `client/pages/Kassa.tsx`

**Asosiy funksiyalar:**
1. **Mahsulot qidirish** - Barcode scanner yoki qo'lda kod kiritish
2. **Savdoga qo'shish** - Mahsulotni savdoga qo'shish
3. **Miqdor o'zgartirish** - Mahsulot miqdorini o'zgartirish
4. **Chek tayyorlash** - Savdoni to'ldirish
5. **To'lov** - Naqd, Karta, O'tkazma
6. **Chek chop etish** - Printer orqali chek chop etish
7. **Qaytarish** - Sotilgan mahsulotni qaytarish

**Kassa interfeysi:**
```
┌─────────────────────────────────────┐
│  KASSA                              │
├─────────────────────────────────────┤
│  Qidiruv: [_____________]           │
├─────────────────────────────────────┤
│  Savdo:                             │
│  1. Bolt (SKU: 5)      100,000 x 2  │
│  2. Rol (SKU: 6)        50,000 x 1  │
├─────────────────────────────────────┤
│  Jami: 250,000 so'm                 │
├─────────────────────────────────────┤
│  [Naqd] [Karta] [O'tkazma]          │
└─────────────────────────────────────┘
```

---

### 2️⃣ Backend: Offline Sync

**Fayl:** `server/routes/offline-sync.ts`

**Funksiyalar:**
1. **Offline sotuvlarni yuklash** - IndexedDB dan MongoDB ga
2. **Stock kamaytirish** - Sotilgan mahsulotlar uchun
3. **Conflict resolution** - Takroriy yuklashni oldini olish
4. **Ota-bola mahsulot tizimi** - Ota tugaganda bola faollashtiriladi

---

### 3️⃣ Offline Database: offlineDB.ts

**Fayl:** `client/db/offlineDB.ts`

**Saqlanadigan ma'lumotlar:**
1. **Products** - Mahsulotlar (20,000+)
2. **Categories** - Kategoriyalar
3. **Offline Sales** - Offline sotuvlar
4. **Sync Queue** - Sinxronizatsiya navbati
5. **Defective Products** - Yaroqsiz mahsulotlar

---

### 4️⃣ Kassa Hook: useOfflineKassa.ts

**Fayl:** `client/hooks/useOfflineKassa.ts`

**Funksiyalar:**
1. **Real-time product search** - MongoDB dan yangi ma'lumotlar
2. **Cart management** - Savdoga qo'shish/o'chirish
3. **Sale completion** - Sotuvni yakunlash
4. **Offline support** - Internet yo'q bo'lsa ham ishlaydi

---

## 🔄 KASSA JARAYONI

### 1. Mahsulot qidirish
```
Barcode scanner yoki qo'lda kod kiritish
        ↓
MongoDB dan mahsulot qidirish
        ↓
Mahsulot topilsa - savdoga qo'shish
        ↓
Topilmasa - qidiruv dialogi ochish
```

**Kod:**
```typescript
// client/pages/Kassa.tsx
const handleBarcodeScan = useCallback(async (barcode: string) => {
  // Variant va asosiy mahsulot SKU/barcode ni qidirish
  const result = await searchBySkuWithVariant(barcode);
  
  if (result) {
    // Mahsulotni savdoga qo'shish
    await addProduct(result.product, result.variantIndex);
  } else {
    // Qidiruv dialogi ochish
    setSearchQuery(barcode);
    setSearchOpen(true);
  }
}, [searchBySkuWithVariant, addProduct]);
```

### 2. Savdoga qo'shish
```
Mahsulot tanlash
        ↓
Miqdor kiritish
        ↓
Savdoga qo'shish (IndexedDB)
        ↓
Jami hisoblash
```

**Kod:**
```typescript
// client/hooks/useOfflineKassa.ts
const addToCart = (product: OfflineProduct, isRefundMode?: boolean) => {
  // Savdoga qo'shish
  const cartItem: CartItem = {
    id: generateUUID(),
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: 1,
    stock: product.stock,
    // ...
  };
  
  setItems([...items, cartItem]);
};
```

### 3. To'lov
```
To'lov turi tanlash (Naqd/Karta/O'tkazma)
        ↓
Sotuvni yakunlash
        ↓
IndexedDB ga saqlash
        ↓
Chek chop etish
```

**Kod:**
```typescript
// client/pages/Kassa.tsx
const handlePayment = async (paymentType: string) => {
  // Sotuvni yakunlash
  const sale = await completeSale(paymentType);
  
  if (sale) {
    // Chek chop etish
    await printReceipt(sale);
    
    // Savdoni tozalash
    clearCart();
  }
};
```

### 4. Sinxronizatsiya
```
Internet aloqasi bo'lsa
        ↓
Offline sotuvlarni MongoDB ga yuklash
        ↓
Stock kamaytirish
        ↓
Ota-bola mahsulot tizimi
```

**Kod:**
```typescript
// server/routes/offline-sync.ts
export const handleOfflineSalesSync = async (req: Request, res: Response) => {
  // Offline sotuvlarni yuklash
  const { sales, userId } = req.body;
  
  for (const sale of sales) {
    // Stock kamaytirish
    for (const item of sale.items) {
      await ProductModel.updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity } }
      );
    }
  }
};
```

---

## 📋 KASSA QISMLARI BATAFSIL

### Frontend: Kassa.tsx

**Asosiy state'lar:**
```typescript
// Savdo
const [checkItems, setCheckItems] = useState<CartItem[]>([]);
const [total, setTotal] = useState(0);

// Qidiruv
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<any[]>([]);

// To'lov
const [paymentOpen, setPaymentOpen] = useState(false);
const [paymentType, setPaymentType] = useState('');

// Printer
const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
const [isPrinting, setIsPrinting] = useState(false);

// Qaytarish
const [isRefundMode, setIsRefundMode] = useState(false);
```

**Asosiy funksiyalar:**
```typescript
// Mahsulot qo'shish
const addProduct = async (product: OfflineProduct) => {
  await addToCart(product, isRefundMode);
};

// Miqdor o'zgartirish
const updateQuantity = (index: number, quantity: number) => {
  updateCartQuantity(checkItems[index].id, quantity, false, isRefundMode);
};

// Sotuvni yakunlash
const handlePayment = async (paymentType: string) => {
  const sale = await completeSale(paymentType, isRefundMode ? 'refund' : 'sale');
  if (sale) {
    await printReceipt(sale);
    clearCart();
  }
};
```

### Backend: offline-sync.ts

**Asosiy funksiyalar:**
```typescript
// Offline sotuvlarni yuklash
export const handleOfflineSalesSync = async (req: Request, res: Response) => {
  // 1. Offline sotuvlarni olish
  const { sales, userId } = req.body;
  
  // 2. Har bir sotuvni qayta ishlash
  for (const sale of sales) {
    // Stock kamaytirish
    for (const item of sale.items) {
      await updateProductStock(item.productId, -item.quantity);
    }
    
    // Ota-bola mahsulot tizimi
    if (product.parentProductId) {
      // Ota mahsulot tugaganda bola faollashtiriladi
      await promoteFirstVariantToProduct(product.parentProductId);
    }
  }
};
```

### Offline Database: offlineDB.ts

**Saqlanadigan ma'lumotlar:**
```typescript
// Mahsulot
export interface OfflineProduct {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stock: number;
  initialStock?: number; // Qaytarish cheklovi uchun
  variantSummaries?: OfflineVariant[]; // Xillar
}

// Offline sotuvlar
export interface OfflineSale {
  id: string;
  items: OfflineSaleItem[];
  total: number;
  paymentType: string;
  saleType: 'sale' | 'refund';
  synced: boolean;
}

// Yaroqsiz mahsulotlar
export interface DefectiveProduct {
  id: string;
  productId: string;
  quantity: number;
  reason?: string;
  refundId: string;
}
```

---

## 🔐 KASSA XAVFSIZLIGI

### 1. Stock tekshirish
```typescript
// Sotish rejimida: miqdor > stock bo'lsa xato
if (!isRefundMode && item.quantity > item.stock) {
  toast.error(`Omborda yetarli emas! "${item.name}" - faqat ${item.stock} ta mavjud`);
}

// Qaytarish rejimida: sotilgan miqdordan ortiq qaytarib bo'lmaydi
if (isRefundMode && item.quantity > soldQuantity) {
  toast.error(`"${item.name}" - faqat ${soldQuantity} ta sotilgan, ${item.quantity} ta qaytara olmaysiz!`);
}
```

### 2. Qaytarish cheklovi
```typescript
// Sotilgan miqdor = boshlang'ich - hozirgi ombordagi
const soldQuantity = initialStock - currentStock;

// Maksimal qaytarish = sotilgan - yaroqsiz qaytarilgan
const maxReturn = soldQuantity - defectiveCount;

// Tekshirish
if (returnQuantity > maxReturn) {
  toast.error(`Maksimal ${maxReturn} ta qaytara olmaysiz!`);
}
```

### 3. Yaroqsiz mahsulotlar
```typescript
// Yaroqsiz mahsulotni qaytarish
const saveDefectiveProduct = async (product: CartItem, quantity: number) => {
  const defective: DefectiveProduct = {
    id: generateUUID(),
    productId: product.productId,
    quantity: quantity,
    reason: 'Yaroqsiz',
    refundId: sale.id,
  };
  
  await offlineDB.defectiveProducts.add(defective);
};
```

---

## 📊 KASSA STATISTIKASI

### Bugungi sotuvlar
```typescript
// Bugungi sotuvlarni olish
const todaySales = salesHistory.filter(sale => {
  const saleDate = new Date(sale.date);
  const today = new Date();
  return saleDate.toDateString() === today.toDateString();
});

// Jami daromad
const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);

// Sotilgan mahsulotlar soni
const totalItems = todaySales.reduce((sum, sale) => 
  sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
);
```

---

## 🛠️ KASSA SOZLAMALARI

### Printer sozlamalari
```typescript
// Chek printer
const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
const [receiptPaperWidth, setReceiptPaperWidth] = useState<ReceiptPaperWidth>(80);

// Senik printer
const [selectedLabelPrinter, setSelectedLabelPrinter] = useState<string | null>(null);
const [labelPaperWidth, setLabelPaperWidth] = useState<LabelPaperWidth>(40);
const [labelHeight, setLabelHeight] = useState<number>(30);
```

### Chek sozlamalari
```typescript
// Chek qog'oz kengligi
const receiptPaperWidth = 80; // mm

// Senik o'lchamlari
const labelSize = 'large'; // 60x40mm
const customLabelWidth = 60; // mm
const customLabelHeight = 40; // mm
```

---

## 📝 KASSA TARIXLARI

### Sotuvlar tarixlari
```typescript
// Sotuvlar tarixini olish
const salesHistory = await fetch(`${API_BASE_URL}/api/sales/offline?userId=${userId}`);

// Tarixni filtrlash
const todaySales = salesHistory.filter(sale => {
  const saleDate = new Date(sale.date);
  const today = new Date();
  return saleDate.toDateString() === today.toDateString();
});
```

### Mahsulot tarixlari
```typescript
// Mahsulot tarixini olish
const productHistory = await fetch(`${API_BASE_URL}/api/product-history?userId=${userId}`);

// Tarixni filtrlash
const todayHistory = productHistory.filter(h => {
  const historyDate = new Date(h.timestamp);
  const today = new Date();
  return historyDate.toDateString() === today.toDateString();
});
```

---

## 🚀 KASSA OPTIMIZATSIYASI

### 1. Real-time qidiruv
```typescript
// MongoDB dan yangi ma'lumotlar
const fetchProductsFromMongoDB = async () => {
  const response = await fetch(`${API_BASE_URL}/api/products?userId=${userId}`);
  return await response.json();
};
```

### 2. Offline qidiruv
```typescript
// IndexedDB dan qidiruv
const searchOfflineProducts = (query: string) => {
  return offlineDB.products
    .where('normalizedName')
    .startsWithIgnoreCase(query)
    .toArray();
};
```

### 3. Barcode scanner
```typescript
// Barcode scanner hook
const { onScan } = useBarcodeScanner({
  onScan: handleBarcodeScan,
  minLength: 1,
  scanTimeout: 1000,
  enabled: !searchOpen && !paymentOpen,
});
```

---

## 📞 KASSA MUAMMOLARI VA YECHIMI

### Muammo 1: Stock yetarli emas
**Sababi:** Mahsulot omborda yo'q
**Yechim:** Ogohlantirish ko'rsatish va qo'shishni rad etish

### Muammo 2: Qaytarish cheklovi
**Sababi:** Sotilgan miqdordan ortiq qaytarish
**Yechim:** Maksimal qaytarish miqdorini tekshirish

### Muammo 3: Internet yo'q
**Sababi:** Offline rejim
**Yechim:** IndexedDB dan ishlash va keyinroq sinxronizatsiya

### Muammo 4: Printer xatosi
**Sababi:** Printer ulanmagan
**Yechim:** Printer sozlamalarini tekshirish

---

## 🎯 KASSA KEYINGI QADAMLAR

1. **Kassa interfeysi** - Yanada yaxshi UI
2. **Kassa statistikasi** - Bugungi sotuvlar, daromad
3. **Kassa raporti** - Kunlik raporti
4. **Kassa sinxronizatsiyasi** - Real-time sinxronizatsiya
5. **Kassa xavfsizligi** - PIN kod, fingerprint

---

## 📚 KASSA FAYLLAR

| Fayl | Maqsad |
|------|--------|
| `client/pages/Kassa.tsx` | Kassa interfeysi |
| `client/hooks/useOfflineKassa.ts` | Kassa hook |
| `client/db/offlineDB.ts` | Offline database |
| `server/routes/offline-sync.ts` | Offline sinxronizatsiya |
| `server/routes/cash-register.ts` | Kassa API |
| `server/cash-register.model.ts` | Kassa modeli |

---

## 🔗 KASSA ALOQALARI

```
Frontend (Kassa.tsx)
    ↓
useOfflineKassa hook
    ↓
offlineDB (IndexedDB)
    ↓
Backend (offline-sync.ts)
    ↓
MongoDB
```

---

## 📊 KASSA STATISTIKASI

### Bugungi sotuvlar
- Jami daromad: 1,250,000 so'm
- Sotilgan mahsulotlar: 25 ta
- O'rtacha chek: 50,000 so'm

### O'tgan kunlar
- Jami daromad: 15,000,000 so'm
- Sotilgan mahsulotlar: 300 ta
- O'rtacha chek: 50,000 so'm
