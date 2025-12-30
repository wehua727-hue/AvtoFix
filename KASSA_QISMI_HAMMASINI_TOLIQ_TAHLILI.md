# KASSA QISMI - HAMMASINI TO'LIQ TAHLILI

## 📊 KASSA QISMI ARXITEKTURASI

```
┌─────────────────────────────────────────────────────────────────┐
│                    KASSA (client/pages/Kassa.tsx)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. QIDIRUV VA MAHSULOT QO'SHISH                          │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Barcode Scanner (useBarcodeScanner)             │   │  │
│  │    │ - Barcode o'qish                                │   │  │
│  │    │ - SKU/Barcode qidiruv                           │   │  │
│  │    │ - Mahsulot topish                               │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Real-time Qidiruv (useOfflineKassa)             │   │  │
│  │    │ - MongoDB dan qidiruv                           │   │  │
│  │    │ - Mahsulot va xillarni qidirish                 │   │  │
│  │    │ - Variant indeksini qaytarish                   │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Mahsulot Qo'shish (addToCart)                   │   │  │
│  │    │ - Mahsulot ma'lumotlarini yangilash             │   │  │
│  │    │ - Stock tekshirish                              │   │  │
│  │    │ - CartItem yaratish                             │   │  │
│  │    │ - Kassaga qo'shish                              │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 2. SAVDO CHEKI (CART)                                   │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Mahsulotlar Ro'yxati (checkItems)               │   │  │
│  │    │ - Mahsulot nomi, SKU, narxi                     │   │  │
│  │    │ - Miqdor, chegirma, jami summa                  │   │  │
│  │    │ - Stock, initialStock                           │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Miqdor O'zgartirish (updateQuantity)            │   │  │
│  │    │ - Miqdor oshirish/kamaytirish                   │   │  │
│  │    │ - Stock tekshirish                              │   │  │
│  │    │ - Xato bo'lsa event yuborish                    │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Mahsulot O'chirish (removeFromCart)             │   │  │
│  │    │ - Chekdan mahsulot o'chirish                    │   │  │
│  │    │ - Jami summa yangilash                          │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Jami Summa (total)                              │   │  │
│  │    │ - Barcha mahsulotlarning summasini hisoblash    │   │  │
│  │    │ - Chegirma qo'llash                             │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 3. SOTISH REJIMI (isRefundMode = false)                 │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Mahsulot Qo'shish                               │   │  │
│  │    │ - Barcode scanner orqali                        │   │  │
│  │    │ - Qidiruv orqali                                │   │  │
│  │    │ - Numpad orqali                                 │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Stock Tekshirish                                │   │  │
│  │    │ - quantity <= stock?                            │   │  │
│  │    │ - Agar yo'q bo'lsa xato ko'rsatish              │   │  │
│  │    │ - Event yuborish                                │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ To'lov Turi Tanlash                             │   │  │
│  │    │ - Naqd (Cash)                                   │   │  │
│  │    │ - Karta (Card)                                  │   │  │
│  │    │ - O'tkazma (Transfer)                           │   │  │
│  │    │ - Aralash (Mixed)                               │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Chek Chop Etish (printReceipt)                  │   │  │
│  │    │ - Printer tanlash                               │   │  │
│  │    │ - Chek ma'lumotlarini tayyorlash                │   │  │
│  │    │ - Chop etish                                    │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Savdo Saqlash (completeSale)                    │   │  │
│  │    │ - MongoDB ga saqlash                            │   │  │
│  │    │ - Stock kamaytirish                             │   │  │
│  │    │ - Tarix qo'shish                                │   │  │
│  │    │ - Kassa tozalash                                │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 4. QAYTARISH REJIMI (isRefundMode = true)               │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Tarix Paneli Ochish                             │   │  │
│  │    │ - Eski cheklar ko'rsatish                       │   │  │
│  │    │ - Bugun/O'tgan filtri                           │   │  │
│  │    │ - Chek tanlash                                  │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Qaytarish Rejimiga O'tish                       │   │  │
│  │    │ - isRefundMode = true                           │   │  │
│  │    │ - Chekdagi mahsulotlar kassaga qo'shiladi       │   │  │
│  │    │ - Interfeys o'zgaradi (orange rang)             │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Qaytarish Cheklovi                              │   │  │
│  │    │ - Sotilgan miqdor = initialStock - stock        │   │  │
│  │    │ - Yaroqsiz qaytarilgan = defectiveCounts        │   │  │
│  │    │ - Maksimal qaytarish = sotilgan - yaroqsiz      │   │  │
│  │    │ - Agar quantity > maksimal → XATO               │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Yaroqsiz Mahsulot Qo'shish                      │   │  │
│  │    │ - isDefective = true                            │   │  │
│  │    │ - defectiveProducts ga qo'shish                 │   │  │
│  │    │ - Stock o'zgarmaydi                             │   │  │
│  │    │ - Tarix qo'shish                                │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Oddiy Qaytarish                                 │   │  │
│  │    │ - Stock oshadi                                  │   │  │
│  │    │ - MongoDB ga saqlash                            │   │  │
│  │    │ - Tarix qo'shish                                │   │  │
│  │    │ - Chek chop etish                               │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 5. SENIK CHOP ETISH                                     │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Senik Dialogi Ochish                            │   │  │
│  │    │ - Mahsulot tanlash                              │   │  │
│  │    │ - Senik o'lchamlari tanlash                     │   │  │
│  │    │ - Miqdor kiritish                               │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Senik O'lchamlari                               │   │  │
│  │    │ - Large (60x40mm)                               │   │  │
│  │    │ - Medium (40x30mm)                              │   │  │
│  │    │ - Small (30x20mm)                               │   │  │
│  │    │ - Custom (qo'lda o'lcham)                       │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Printer Tanlash                                 │   │  │
│  │    │ - Mavjud printerlar ro'yxati                    │   │  │
│  │    │ - Default printer saqlash                       │   │  │
│  │    │ - Printer sozlamalari                           │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Senik Chop Etish                                │   │  │
│  │    │ - Senik ma'lumotlarini tayyorlash               │   │  │
│  │    │ - Printer orqali chop etish                     │   │  │
│  │    │ - Miqdor bo'yicha takrorlash                    │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 6. TARIX VA STATISTIKA                                  │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Savdo Tarixi (salesHistory)                     │   │  │
│  │    │ - Bugungi savdolar                              │   │  │
│  │    │ - O'tgan savdolar                               │   │  │
│  │    │ - Qaytarish tarixi                              │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Tarix Filtri                                    │   │  │
│  │    │ - Bugun (today)                                 │   │  │
│  │    │ - O'tgan (past)                                 │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │    ┌─────────────────────────────────────────────────┐   │  │
│  │    │ Tarix Qidirish                                  │   │  │
│  │    │ - Chek tanlash                                  │   │  │
│  │    │ - Chek tafsilotlarini ko'rish                   │   │  │
│  │    │ - Qaytarish qilish                              │   │  │
│  │    └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 KASSA QISMI ALMASHINUVI

### 1. SOTISH JARAYONI

```
Barcode Scanner / Qidiruv
        ↓
searchBySkuWithVariant(sku)
        ↓
addProduct(product, variantIndex?)
        ↓
addToCart(product, isRefundMode=false)
        ↓
Stock Tekshirish
        ↓
Chekda Mahsulot Ko'rsatiladi
        ↓
Miqdor O'zgartirish
        ↓
To'lov Turi Tanlash
        ↓
Chek Chop Etish
        ↓
completeSale(paymentType, "sale")
        ↓
Stock Kamaytirish
        ↓
Tarix Qo'shish
        ↓
Kassa Tozalash
```

### 2. QAYTARISH JARAYONI

```
Tarix Tugmasi
        ↓
Tarix Paneli Ochiladi
        ↓
Eski Chek Tanlash
        ↓
"Qaytarish" Tugmasi
        ↓
isRefundMode = true
        ↓
Chekdagi Mahsulotlar Kassaga Qo'shiladi
        ↓
Qaytarish Cheklovi Tekshirish
        ↓
Miqdor O'zgartirish
        ↓
Yaroqsiz Mahsulot Qo'shish (ixtiyoriy)
        ↓
To'lov Turi Tanlash
        ↓
Chek Chop Etish
        ↓
completeSale(paymentType, "refund")
        ↓
Stock Oshirish (oddiy qaytarish)
        ↓
Tarix Qo'shish
        ↓
Kassa Tozalash
```

---

## 💾 KASSA QISMI MA'LUMOTLARI

### CartItem (Chekdagi mahsulot)
```typescript
interface CartItem {
  id: string;                    // Mahsulot yoki variant ID
  productId: string;             // Asosiy mahsulot ID
  name: string;                  // Mahsulot nomi
  sku?: string;                  // SKU/Kod
  barcode?: string;              // Barcode
  price: number;                 // Sotish narxi
  costPrice?: number;            // Asl narx
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS';
  quantity: number;              // Miqdor
  discount: number;              // Chegirma
  stock: number;                 // Hozirgi ombordagi soni
  initialStock?: number;         // Boshlang'ich stock
  createdByRole?: 'egasi' | 'admin' | 'xodim';
}
```

### OfflineSale (Savdo ma'lumotlari)
```typescript
interface OfflineSale {
  id: string;                    // UUID
  recipientNumber: string;       // YYYYMMDD-HHMMSS-RAND
  items: OfflineSaleItem[];      // Savdo qatorlari
  total: number;                 // Jami summa
  discount: number;              // Jami chegirma
  paymentType: string;           // To'lov turi
  saleType: 'sale' | 'refund';   // Sotish yoki qaytarish
  createdAt: number;             // Vaqti
  synced: boolean;               // MongoDB ga yuborilganmi?
  syncedAt?: number;             // Yuborilgan vaqti
  userId: string;                // Foydalanuvchi ID
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

## 🎯 KASSA QISMI XUSUSIYATLARI

### 1. Real-time Qidiruv
- ✅ MongoDB dan to'g'ridan-to'g'ri qidiruv
- ✅ Cache yo'q - har doim fresh data
- ✅ Barcode scanner qo'llab-quvvatlash
- ✅ SKU/Barcode qidiruv

### 2. Offline Rejimi
- ✅ IndexedDB da mahsulotlar saqlanadi
- ✅ Offline savdolar saqlanadi
- ✅ Ombor bo'lsa - avtomatik sinxronizatsiya
- ✅ Ombor bo'lmasa - offline rejimida ishlaydi

### 3. Stock Tekshirish
- ✅ Sotish rejimida: quantity <= stock
- ✅ Qaytarish rejimida: quantity <= (initialStock - stock - defectiveCount)
- ✅ Xato bo'lsa event yuborish
- ✅ Ogohlantirish ko'rsatish

### 4. Qaytarish Cheklovi
- ✅ Sotilgan miqdor hisoblash
- ✅ Yaroqsiz qaytarilgan sonni tekshirish
- ✅ Maksimal qaytarish hisoblash
- ✅ Xato bo'lsa xabar berish

### 5. Chop Etish
- ✅ Chek chop etish (80mm, 58mm)
- ✅ Senik chop etish (60x40mm, 40x30mm, 30x20mm)
- ✅ Printer tanlash va sozlash
- ✅ Miqdor bo'yicha takrorlash

### 6. Tarix
- ✅ Savdo tarixi (bugun/o'tgan)
- ✅ Qaytarish tarixi
- ✅ Statistika
- ✅ Tarix qidirish

---

## 🔐 KASSA QISMI XAVFSIZLIGI

### 1. Stock Tekshirish
- Sotish rejimida: quantity <= stock
- Qaytarish rejimida: quantity <= (initialStock - stock - defectiveCount)

### 2. Qaytarish Cheklovi
- Sotilgan miqdor = initialStock - hozirgi stock
- Yaroqsiz qaytarilgan = defectiveCounts[productId]
- Maksimal qaytarish = sotilgan - yaroqsiz

### 3. Xodim Huquqlari
- Xodim faqat o'z mahsulotlarini ko'radi
- Xodim faqat o'z savdolarini ko'radi
- Xodim faqat o'z tarixini ko'radi

### 4. Offline Rejimi
- Ombor bo'lmasa - offline rejimida ishlaydi
- Ombor bo'lsa - online rejimida ishlaydi
- Sinxronizatsiya avtomatik

---

## 🚀 KASSA QISMI DEPLOYMENT

```bash
npm run build
npm run pm2:restart
```

---

## ✅ YAKUNIY XULOSA

**Kassa qismi** - to'liq offline-first savdo qismi:
- ✅ Real-time qidiruv
- ✅ Barcode scanner
- ✅ Sotish rejimi
- ✅ Qaytarish rejimi
- ✅ Stock tekshirish
- ✅ Qaytarish cheklovi
- ✅ Yaroqsiz mahsulot
- ✅ Chop etish
- ✅ Tarix va statistika
- ✅ Offline rejimi
- ✅ Sinxronizatsiya

Barcha xususiyatlar to'liq ishlaydi va test qilingan! 🎉
