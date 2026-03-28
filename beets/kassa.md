# 💰 KASSA (POS System) - Batafsil Hujjat

## 📋 Umumiy Ma'lumot

**Fayl:** `client/pages/Kassa.tsx`

**Vazifasi:** Mahsulot sotish, to'lov qabul qilish, chek chop etish

**Texnologiya:** React, TypeScript, IndexedDB, ESC/POS

---

## 🎯 Asosiy Funksiyalar

### 1. **Mahsulot Qidirish**

#### 1.1. Qidiruv Turlari:
- **Nom bo'yicha:** Mahsulot nomini yozish
- **Kod bo'yicha:** Mahsulot kodini kiritish
- **Katalog bo'yicha:** Katalog raqamini kiritish
- **Shtrix-kod:** Barcode scanner bilan skanerlash

#### 1.2. Qidiruv Algoritmi:
```typescript
// Fuzzy search - noaniq qidiruv
const searchProducts = (query: string) => {
  return products.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.sku.toLowerCase().includes(query.toLowerCase()) ||
    p.catalogNumber?.toLowerCase().includes(query.toLowerCase())
  );
};
```

#### 1.3. Barcode Scanner:
```typescript
// useBarcodeScanner hook
const { scannedCode } = useBarcodeScanner({
  onScan: (code) => {
    const product = findProductByBarcode(code);
    if (product) addToCart(product);
  }
});
```

---

### 2. **Savat (Cart) Boshqaruvi**

#### 2.1. Savat Tuzilmasi:
```typescript
interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  currency: Currency;
  quantity: number;
  stock: number;
  imageUrl?: string;
}
```

#### 2.2. Savat Operatsiyalari:
- **Qo'shish:** `addToCart(product)`
- **Miqdorni o'zgartirish:** `updateQuantity(itemId, quantity)`
- **O'chirish:** `removeFromCart(itemId)`
- **Tozalash:** `clearCart()`

#### 2.3. Savat Validatsiyasi:
```typescript
// Omborda yetarli mahsulot borligini tekshirish
const validateStock = (item: CartItem) => {
  if (item.quantity > item.stock) {
    toast.error(`Omborda faqat ${item.stock} dona bor`);
    return false;
  }
  return true;
};
```

---

### 3. **Valyuta Tizimi**

#### 3.1. Qo'llab-quvvatlanadigan Valyutalar:
- **UZS** - O'zbekiston so'mi (so'm)
- **USD** - Amerika dollari ($)
- **RUB** - Rossiya rubli (₽)
- **CNY** - Xitoy yuani (¥)

#### 3.2. Valyuta Konvertatsiyasi:
```typescript
const convertPrice = (price: number, from: Currency, to: Currency) => {
  const rates = {
    USD: 12500,  // 1 USD = 12500 UZS
    RUB: 135,    // 1 RUB = 135 UZS
    CNY: 1750,   // 1 CNY = 1750 UZS
  };
  
  // UZS ga konvertatsiya
  const inUZS = from === 'UZS' ? price : price * rates[from];
  
  // Kerakli valyutaga konvertatsiya
  return to === 'UZS' ? inUZS : inUZS / rates[to];
};
```

#### 3.3. Umumiy Summa Hisoblash:
```typescript
const calculateTotal = (cart: CartItem[]) => {
  return cart.reduce((sum, item) => {
    const priceInUZS = convertPrice(item.price, item.currency, 'UZS');
    return sum + (priceInUZS * item.quantity);
  }, 0);
};
```

---

### 4. **To'lov Turlari**

#### 4.1. To'lov Variantlari:
- **Naqd (Cash):** Mijoz naqd pul to'laydi
- **Karta (Card):** Bank kartasi orqali to'lov
- **Nasiya (Credit):** Keyinroq to'lash (qarz)
- **Aralash (Mixed):** Bir qismi naqd, bir qismi karta

#### 4.2. To'lov Jarayoni:
```typescript
const processPayment = async (paymentType: PaymentType) => {
  // 1. Savat validatsiyasi
  if (!validateCart()) return;
  
  // 2. Ombor yangilash
  await updateStock(cart);
  
  // 3. Savdo yaratish
  const sale = await createSale({
    items: cart,
    total: calculateTotal(cart),
    paymentType,
    cashier: user.name,
  });
  
  // 4. Chek chop etish
  await printReceipt(sale);
  
  // 5. Savatni tozalash
  clearCart();
};
```

#### 4.3. Nasiya (Qarz) Boshqaruvi:
```typescript
const createDebt = async (customer: Customer, amount: number) => {
  await api.post('/api/debts', {
    creditor: customer.name,
    phone: customer.phone,
    amount,
    currency: 'UZS',
    status: 'pending',
    dueDate: addDays(new Date(), 30), // 30 kun muddatli
  });
};
```

---

### 5. **Chek Chop Etish**

#### 5.1. Chek Tuzilmasi:
```typescript
interface ReceiptData {
  receiptNumber: string;
  date: Date;
  cashier: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  items: CartItem[];
  total: number;
  paymentType: PaymentType;
  qrCode?: string;
}
```

#### 5.2. Chek Chop Etish:
```typescript
const printReceipt = async (receipt: ReceiptData) => {
  // 1. Printer tanlash
  const printer = await getDefaultPrinter();
  
  // 2. Chek ma'lumotlarini tayyorlash
  const receiptText = formatReceipt(receipt);
  
  // 3. ESC/POS komandalar
  const commands = [
    ESC_INIT,           // Printer reset
    ESC_ALIGN_CENTER,   // Markazga tekislash
    ESC_BOLD_ON,        // Qalin matn
    storeName,
    ESC_BOLD_OFF,
    storeAddress,
    ESC_LINE_FEED,
    // ... mahsulotlar ro'yxati
    ESC_CUT,            // Qog'ozni kesish
  ];
  
  // 4. Chop etish
  await printer.print(commands);
};
```

#### 5.3. QR Code:
```typescript
// Chekni online ko'rish uchun QR code
const generateQRCode = (receiptNumber: string) => {
  const url = `https://shop.avtofix.uz/check/${receiptNumber}`;
  return QRCode.toDataURL(url);
};
```

---

### 6. **Offline Ishlash**

#### 6.1. Offline Savdo:
```typescript
const createOfflineSale = async (sale: Sale) => {
  // 1. IndexedDB ga saqlash
  await offlineDB.sales.add({
    ...sale,
    offlineId: generateUUID(),
    synced: false,
    createdAt: new Date(),
  });
  
  // 2. Ombor yangilash (mahalliy)
  await updateLocalStock(sale.items);
  
  // 3. Sync queue ga qo'shish
  await syncManager.addToQueue('sale', sale);
};
```

#### 6.2. Avtomatik Sinxronizatsiya:
```typescript
// Internet qaytganda avtomatik sync
useEffect(() => {
  if (isOnline) {
    syncManager.syncAll();
  }
}, [isOnline]);
```

---

### 7. **Yaroqsiz Mahsulotlar**

#### 7.1. Yaroqsiz Mahsulot Qo'shish:
```typescript
const addDefectiveProduct = async (product: Product, reason: string) => {
  await offlineDB.defectiveProducts.add({
    productId: product.id,
    name: product.name,
    sku: product.sku,
    quantity: 1,
    reason,
    date: new Date(),
  });
  
  // Ombor dan ayirish
  await updateStock(product.id, -1);
};
```

#### 7.2. Yaroqsiz Mahsulotlar Ro'yxati:
```typescript
const getDefectiveProducts = async () => {
  return await offlineDB.defectiveProducts.toArray();
};
```

---

### 8. **Mijoz Tanlash**

#### 8.1. Mijoz Qidirish:
```typescript
const searchCustomers = (query: string) => {
  return customers.filter(c =>
    c.firstName.toLowerCase().includes(query.toLowerCase()) ||
    c.lastName.toLowerCase().includes(query.toLowerCase()) ||
    c.phone?.includes(query)
  );
};
```

#### 8.2. Mijoz Tarixi:
```typescript
const getCustomerHistory = async (customerId: string) => {
  return await api.get(`/api/orders?customerId=${customerId}`);
};
```

---

### 9. **Chegirma (Discount)**

#### 9.1. Chegirma Turlari:
- **Foiz (%):** Umumiy summadan foiz
- **Qat'iy (Fixed):** Aniq summa

#### 9.2. Chegirma Hisoblash:
```typescript
const applyDiscount = (total: number, discount: Discount) => {
  if (discount.type === 'percentage') {
    return total * (1 - discount.value / 100);
  } else {
    return total - discount.value;
  }
};
```

---

### 10. **Savdo Tarixi**

#### 10.1. Tarix Ko'rish:
```typescript
const getSalesHistory = async (filters: SalesFilters) => {
  return await api.get('/api/sales/offline', { params: filters });
};
```

#### 10.2. Chekni Qayta Chop Etish:
```typescript
const reprintReceipt = async (saleId: string) => {
  const sale = await api.get(`/api/sales/${saleId}`);
  await printReceipt(sale);
};
```

#### 10.3. Savdoni Bekor Qilish (Refund):
```typescript
const refundSale = async (saleId: string) => {
  // 1. Savdoni topish
  const sale = await api.get(`/api/sales/${saleId}`);
  
  // 2. Ombor qaytarish
  await returnStock(sale.items);
  
  // 3. Qaytarish savdosi yaratish
  await api.post('/api/sales', {
    ...sale,
    saleType: 'refund',
    total: -sale.total,
  });
  
  // 4. Qaytarish cheki chop etish
  await printReceipt({ ...sale, saleType: 'refund' });
};
```

---

## 🔧 Texnik Tafsilotlar

### State Management:
```typescript
const [cart, setCart] = useState<CartItem[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
const [paymentType, setPaymentType] = useState<PaymentType>('cash');
const [isOffline, setIsOffline] = useState(false);
```

### Hooks:
- `useOfflineKassa()` - Offline kassa boshqaruvi
- `useBarcodeScanner()` - Barcode scanner
- `useNetworkStatus()` - Internet holati
- `useAuth()` - Foydalanuvchi autentifikatsiyasi

### API Endpoints:
- `POST /api/sales/offline-sync` - Offline savdolarni sync qilish
- `GET /api/sales/offline` - Offline savdolar ro'yxati
- `POST /api/orders` - Yangi buyurtma yaratish
- `GET /api/products` - Mahsulotlar ro'yxati
- `GET /api/customers` - Mijozlar ro'yxati

---

## 🎨 UI Komponentlar

### Asosiy Komponentlar:
- **SearchBar** - Qidiruv paneli
- **ProductGrid** - Mahsulotlar ro'yxati
- **Cart** - Savat
- **PaymentDialog** - To'lov oynasi
- **PrinterSettings** - Printer sozlamalari
- **CustomerSelector** - Mijoz tanlash
- **OfflineIndicator** - Offline holat ko'rsatkichi

### Animatsiyalar:
```typescript
// Framer Motion
const cartVariants = {
  hidden: { opacity: 0, x: 100 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 100 }
};
```

---

## 🚀 Performance Optimizatsiya

### 1. Lazy Loading:
```typescript
const ProductCard = lazy(() => import('@/components/ProductCard'));
```

### 2. Memoization:
```typescript
const totalPrice = useMemo(() => calculateTotal(cart), [cart]);
```

### 3. Debounce:
```typescript
const debouncedSearch = useDebounce(searchQuery, 300);
```

### 4. Virtual Scrolling:
```typescript
// Katta ro'yxatlar uchun
<VirtualList items={products} itemHeight={100} />
```

---

## 🐛 Xato Boshqaruvi

### 1. Network Xatolari:
```typescript
try {
  await api.post('/api/sales', sale);
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    // Offline rejimga o'tish
    await createOfflineSale(sale);
  }
}
```

### 2. Validatsiya Xatolari:
```typescript
if (cart.length === 0) {
  toast.error('Savat bo\'sh');
  return;
}

if (!validateStock(cart)) {
  toast.error('Omborda yetarli mahsulot yo\'q');
  return;
}
```

### 3. Printer Xatolari:
```typescript
try {
  await printReceipt(receipt);
} catch (error) {
  toast.error('Chek chop etishda xatolik');
  // Chekni PDF ga saqlash
  await saveToPDF(receipt);
}
```

---

## 📊 Statistika

### Kassa Statistikasi:
- Kunlik savdo summasi
- Sotilgan mahsulotlar soni
- O'rtacha chek summasi
- To'lov turlari bo'yicha taqsimot
- Eng ko'p sotiladigan mahsulotlar

---

## 🔐 Xavfsizlik

### 1. Autentifikatsiya:
```typescript
// Faqat autentifikatsiya qilingan foydalanuvchilar
if (!user) {
  navigate('/login');
  return;
}
```

### 2. Huquqlar:
```typescript
// Faqat kassir va yuqori rollar
if (!['kassir', 'menejer', 'admin', 'ega'].includes(user.role)) {
  toast.error('Sizda huquq yo\'q');
  return;
}
```

### 3. Ma'lumotlar Validatsiyasi:
```typescript
// Zod schema
const saleSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    price: z.number().positive(),
  })),
  total: z.number().positive(),
  paymentType: z.enum(['cash', 'card', 'credit', 'mixed']),
});
```

---

## 📱 Responsive Design

### Desktop (1920x1080+):
- 3 ustunli layout
- Katta mahsulot kartochkalari
- Sidebar ochiq

### Laptop (1366x768+):
- 2 ustunli layout
- O'rtacha mahsulot kartochkalari
- Sidebar yig'ilgan

### Tablet (768x1024+):
- 2 ustunli layout
- Kichik mahsulot kartochkalari
- Sidebar drawer

### Mobile (375x667+):
- 1 ustunli layout
- Juda kichik mahsulot kartochkalari
- Bottom navigation

---

## 🎯 Keyingi Qadamlar

### Rejadagi Funksiyalar:
- [ ] Voice search (ovozli qidiruv)
- [ ] Facial recognition (yuz tanish)
- [ ] AI-powered recommendations (AI tavsiyalar)
- [ ] Multi-language support (ko'p til)
- [ ] Dark mode (qorong'i rejim)
- [ ] PWA (Progressive Web App)
- [ ] Mobile app (React Native)

---

**Yaratilgan:** 2025-02-10
**Versiya:** 1.0.0
**Muallif:** AvtoFix Development Team
