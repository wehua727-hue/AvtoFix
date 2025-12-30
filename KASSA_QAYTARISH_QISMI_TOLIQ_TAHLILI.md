# KASSA QAYTARISH QISMI - TO'LIQ TAHLILI

## 📋 KASSA QISMI UMUMIY TUZILISHI

```
┌─────────────────────────────────────────────────────────────┐
│                    KASSA (client/pages/Kassa.tsx)           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. QIDIRUV VA MAHSULOT QO'SHISH                      │   │
│  │    - Barcode scanner (useBarcodeScanner)             │   │
│  │    - SKU/Barcode qidiruv (searchBySkuWithVariant)    │   │
│  │    - Mahsulot va xillarni qo'shish (addToCart)       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 2. SAVDO CHEKI (CART)                               │   │
│  │    - Mahsulotlar ro'yxati (checkItems)               │   │
│  │    - Miqdor o'zgartirish (updateQuantity)            │   │
│  │    - Mahsulot o'chirish (removeFromCart)             │   │
│  │    - Jami summa (total)                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 3. SOTISH REJIMI (isRefundMode = false)              │   │
│  │    - Mahsulot qo'shish                               │   │
│  │    - Miqdor o'zgartirish                             │   │
│  │    - Stock tekshirish                                │   │
│  │    - To'lov turi tanlash                             │   │
│  │    - Chek chop etish                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 4. QAYTARISH REJIMI (isRefundMode = true)            │   │
│  │    - Tarix ochish                                    │   │
│  │    - Eski chekdan mahsulot tanlash                   │   │
│  │    - Qaytarish cheklovi                              │   │
│  │    - Yaroqsiz mahsulot qo'shish                      │   │
│  │    - Qaytarish cheki chop etish                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 5. SENIK CHOP ETISH                                 │   │
│  │    - Senik chop etish dialogi (labelDialogOpen)      │   │
│  │    - Senik o'lchamlari (labelSize)                   │   │
│  │    - Printer tanlash (selectedLabelPrinter)          │   │
│  │    - Miqdor kiritish (labelQuantity)                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 6. TARIX VA STATISTIKA                              │   │
│  │    - Savdo tarixi (salesHistory)                     │   │
│  │    - Bugun/O'tgan filtri (historyFilter)             │   │
│  │    - Tarix qidirish (selectedSale)                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 QAYTARISH REJIMI ALMASHINUVI

### 1. QAYTARISH REJIMIGA KIRISH

```
┌─────────────────────────────────────────────────────────┐
│ TARIX TUGMASI BOSILDI                                   │
│ - History paneli ochiladi                               │
│ - Eski cheklar ko'rsatiladi                             │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ ESKI CHEK TANLANDI                                      │
│ - Chekdagi mahsulotlar ko'rsatiladi                     │
│ - Qaytarish rejimiga o'tish tugmasi ko'rsatiladi        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ "QAYTARISH" TUGMASI BOSILDI                             │
│ - isRefundMode = true                                   │
│ - Chekdagi mahsulotlar kassaga qo'shiladi               │
│ - Interfeys o'zgaradi (orange rang)                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ QAYTARISH REJIMIDA ISHLASH                              │
│ - Mahsulot miqdorini o'zgartirish                       │
│ - Qaytarish cheklovi tekshirish                         │
│ - Yaroqsiz mahsulot qo'shish                            │
│ - To'lov turi tanlash                                   │
│ - Qaytarish cheki chop etish                            │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 QAYTARISH CHEKLOVI

### Qaytarish Cheklovi Formulasi

```
Sotilgan miqdor = initialStock - hozirgi stock
Yaroqsiz qaytarilgan = defectiveCounts[productId]
Maksimal qaytarish = sotilgan - yaroqsiz

Agar: quantity + yaroqsiz > sotilgan
      → XATO! Qaytara olmaysiz
```

### Misol

```
Mahsulot: "Bolt 15mm"
- Boshlang'ich stock (initialStock): 100 ta
- Hozirgi stock: 70 ta
- Sotilgan: 100 - 70 = 30 ta
- Yaroqsiz qaytarilgan: 5 ta
- Maksimal qaytarish: 30 - 5 = 25 ta

Foydalanuvchi 26 ta qaytarmoqchi:
❌ XATO! "Bolt 15mm" - boshlang'ich 100 ta, 30 ta sotilgan, 
   5 ta yaroqsiz qaytarilgan, 25 tadan ortiq qaytara olmaysiz!
```

---

## 📊 QAYTARISH REJIMI STATE'LARI

### 1. isRefundMode (Qaytarish rejimi)
```typescript
const [isRefundMode, setIsRefundMode] = useState(false);

// false = Sotish rejimi
// true = Qaytarish rejimi
```

### 2. isDefective (Yaroqsiz mahsulot)
```typescript
const [isDefective, setIsDefective] = useState(false);

// false = Oddiy qaytarish (stock oshadi)
// true = Yaroqsiz qaytarish (stock o'zgarmaydi)
```

### 3. selectedItems (Tanlangan mahsulotlar)
```typescript
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

// Tarixdan tanlangan mahsulotlar
// Checkbox orqali tanlash
```

### 4. defectiveCounts (Yaroqsiz sonlar)
```typescript
const [defectiveCounts, setDefectiveCounts] = useState<Map<string, number>>(new Map());

// Har bir mahsulot uchun yaroqsiz qaytarilgan soni
// Qaytarish cheklovi uchun ishlatiladi
```

---

## 🎯 QAYTARISH JARAYONI

### 1. TARIX PANELINI OCHISH

```typescript
// History tugmasi bosilganda
const handleHistoryClick = () => {
  setHistoryOpen(true);
  // Tarix paneli ochiladi
  // Eski cheklar ko'rsatiladi
};
```

### 2. ESKI CHEK TANLASH

```typescript
// Eski chekdan mahsulot tanlash
const handleSelectSale = (sale: SaleHistory) => {
  setSelectedSale(sale);
  // Chekdagi mahsulotlar ko'rsatiladi
  // "Qaytarish" tugmasi ko'rsatiladi
};
```

### 3. QAYTARISH REJIMIGA O'TISH

```typescript
// "Qaytarish" tugmasi bosilganda
const handleStartRefund = () => {
  setIsRefundMode(true);
  // Chekdagi mahsulotlar kassaga qo'shiladi
  // Interfeys o'zgaradi (orange rang)
  // Qaytarish cheklovi tekshiriladi
};
```

### 4. QAYTARISH CHEKLOVI

```typescript
// Stock tekshirish - qaytarish rejimida
const hasStockError = useMemo(() => {
  if (!isRefundMode) return false;
  
  return checkItems.some(item => {
    const currentStock = item.stock ?? 0;
    const currentInitialStock = item.initialStock;
    
    if (currentInitialStock > 0) {
      const defectiveKey = item.id.includes('-v') ? item.id : item.productId;
      const defectiveCount = defectiveCounts.get(defectiveKey) || 0;
      const soldQuantity = currentInitialStock - currentStock;
      
      // Qaytarish miqdori + yaroqsiz > sotilgan bo'lsa xato
      return (item.quantity + defectiveCount) > soldQuantity;
    }
    
    return false;
  });
}, [checkItems, isRefundMode, defectiveCounts]);
```

### 5. YAROQSIZ MAHSULOT QOSHISH

```typescript
// Yaroqsiz mahsulot qo'shish
if (isRefundMode && isDefective) {
  // Yaroqsiz mahsulotlarni saqlash
  const refundId = generateUUID();
  
  // defectiveProducts ga qo'shish
  for (const item of checkItems) {
    await saveDefectiveProduct({
      productId: item.productId,
      productName: item.name,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      refundId,
      createdAt: Date.now(),
      userId,
    });
  }
  
  // Stock o'zgarmaydi (faqat defectiveProducts ga qo'shiladi)
  // Tarixga qo'shish
  setSalesHistory((prev) => [{
    id: refundId,
    items: checkItems.map((item) => ({...})),
    total,
    date: new Date(),
    paymentType,
    type: "refund",
    synced: false,
  }, ...prev]);
  
  // Chek chop etish
  // Kassa tozalash
  clearCart();
  setIsRefundMode(false);
  setIsDefective(false);
}
```

### 6. ODDIY QAYTARISH

```typescript
// Oddiy qaytarish (stock oshadi)
const sale = await completeSale(paymentType, "refund");

if (sale) {
  // Tarixga qo'shish
  setSalesHistory((prev) => [{
    id: sale.id,
    items: sale.items,
    total: sale.total,
    date: new Date(),
    paymentType,
    type: "refund",
    synced: false,
  }, ...prev]);
  
  // Chek chop etish
  // Kassa tozalash
  clearCart();
  setIsRefundMode(false);
  setIsDefective(false);
}
```

---

## 🎨 INTERFEYS O'ZGARISHLARI

### Sotish Rejimida
```
┌─────────────────────────────────────────────────────────┐
│ SOTISH REJIMI                                           │
│ - Rang: Qizil (#dc2626)                                 │
│ - Sarlavha: "SOTISH"                                    │
│ - Tugmalar: Qo'shish, O'chirish, To'lov                 │
└─────────────────────────────────────────────────────────┘
```

### Qaytarish Rejimida
```
┌─────────────────────────────────────────────────────────┐
│ QAYTARISH REJIMI                                        │
│ - Rang: Apelsin (#ea580c)                               │
│ - Sarlavha: "QAYTARISH"                                 │
│ - Tugmalar: Miqdor o'zgartirish, Yaroqsiz, To'lov       │
│ - Chekdagi mahsulotlar ko'rsatiladi                     │
└─────────────────────────────────────────────────────────┘
```

---

## 📱 QAYTARISH REJIMI TUGMALARI

### 1. Tarix Tugmasi
```
- Tarix panelini ochish
- Eski cheklar ko'rsatish
- Bugun/O'tgan filtri
```

### 2. Qaytarish Tugmasi
```
- Qaytarish rejimiga o'tish
- Chekdagi mahsulotlar kassaga qo'shiladi
- Interfeys o'zgaradi
```

### 3. Yaroqsiz Tugmasi
```
- Yaroqsiz mahsulot qo'shish
- Stock o'zgarmaydi
- defectiveProducts ga qo'shiladi
```

### 4. To'lov Tugmasi
```
- To'lov turi tanlash
- Chek chop etish
- Kassa tozalash
```

---

## 🔔 QAYTARISH CHEKLOVI XABARLARI

### Stock Exceeded Event
```typescript
// Sotish rejimida: stock yetarli emas
window.dispatchEvent(new CustomEvent('stock-exceeded', {
  detail: { name, stock, requested }
}));

// Xabar: "Omborda yetarli emas! "Bolt" - faqat 10 ta mavjud"
```

### Refund Limit Exceeded Event
```typescript
// Qaytarish rejimida: qaytarish cheklovi
window.dispatchEvent(new CustomEvent('refund-limit-exceeded', {
  detail: { name, maxReturn, soldQuantity, defectiveCount, initialStock }
}));

// Xabar: ""Bolt" - boshlang'ich 100 ta, 30 ta sotilgan, 
//        5 ta yaroqsiz qaytarilgan, 25 tadan ortiq qaytara olmaysiz!"
```

---

## 💾 QAYTARISH MA'LUMOTLARI

### SaleHistory (Tarix)
```typescript
interface SaleHistory {
  id: string;                    // Savdo ID
  items: SaleHistoryItem[];      // Savdo qatorlari
  total: number;                 // Jami summa
  date: Date;                    // Sana
  paymentType?: string;          // To'lov turi
  type?: "sale" | "refund";      // Sotish yoki qaytarish
  synced?: boolean;              // MongoDB ga yuborilganmi?
}
```

### DefectiveProduct (Yaroqsiz mahsulot)
```typescript
interface DefectiveProduct {
  id: string;                    // UUID
  productId: string;             // Mahsulot ID
  productName: string;           // Mahsulot nomi
  sku?: string;                  // SKU
  quantity: number;              // Miqdor
  price: number;                 // Narxi
  reason?: string;               // Sabab
  refundId: string;              // Qaytarish ID
  createdAt: number;             // Vaqti
  userId: string;                // Foydalanuvchi ID
}
```

---

## 🚀 QAYTARISH REJIMI DEPLOYMENT

```bash
npm run build
npm run pm2:restart
```

---

## ✅ YAKUNIY XULOSA

**Kassa qaytarish rejimi** - to'liq ishlaydi:
- ✅ Tarix paneli
- ✅ Eski chek tanlash
- ✅ Qaytarish rejimiga o'tish
- ✅ Qaytarish cheklovi
- ✅ Yaroqsiz mahsulot qo'shish
- ✅ Chek chop etish
- ✅ Stock yangilash
- ✅ Tarix saqlash

Barcha xususiyatlar to'liq ishlaydi va test qilingan! 🎉
