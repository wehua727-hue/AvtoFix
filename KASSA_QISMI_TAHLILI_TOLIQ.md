# KASSA QISMI - TO'LIQ TAHLILI

## 📊 KASSA QISMI ARXITEKTURASI

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
│  │ 3. SOTISH VA QAYTARISH                              │   │
│  │    - Sotish rejimi (isRefundMode = false)            │   │
│  │    - Qaytarish rejimi (isRefundMode = true)          │   │
│  │    - To'lov turi (Naqd, Karta, O'tkazma, Aralash)   │   │
│  │    - Chek chop etish (printReceipt)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 4. SENIK CHOP ETISH                                 │   │
│  │    - Senik chop etish dialogi (labelDialogOpen)      │   │
│  │    - Senik o'lchamlari (labelSize)                   │   │
│  │    - Printer tanlash (selectedLabelPrinter)          │   │
│  │    - Miqdor kiritish (labelQuantity)                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 5. TARIX VA STATISTIKA                              │   │
│  │    - Savdo tarixi (salesHistory)                     │   │
│  │    - Bugun/O'tgan filtri (historyFilter)             │   │
│  │    - Tarix qidirish (selectedSale)                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 KASSA QISMI ALMASHINUVI

### 1. MAHSULOT QO'SHISH JARAYONI

```
┌─────────────────────────────────────────────────────────┐
│ BARCODE SCANNER / QIDIRUV                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ searchBySkuWithVariant(sku)                             │
│ - MongoDB dan mahsulot qidirish                         │
│ - Variant va asosiy mahsulot SKU tekshirish             │
│ - Natija: { product, variantIndex? }                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ addProduct(product, variantIndex?)                      │
│ - Mahsulot ma'lumotlarini yangilash (getProduct)        │
│ - Stock tekshirish (sotish/qaytarish rejimi)            │
│ - CartItem yaratish                                     │
│ - addToCart() chaqirish                                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ addToCart(product, isRefundMode)                        │
│ - Mahsulot chekda mavjudmi tekshirish                   │
│ - Agar mavjud bo'lsa - miqdor oshirish                  │
│ - Agar yo'q bo'lsa - yangi qator qo'shish               │
│ - Stock tekshirish (xato bo'lsa - event yuborish)       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ CHEK YANGILANDI (checkItems)                            │
│ - Mahsulot qo'shildi yoki miqdor oshirildi              │
│ - Jami summa hisoblandi                                 │
└─────────────────────────────────────────────────────────┘
```

### 2. SOTISH JARAYONI

```
┌─────────────────────────────────────────────────────────┐
│ TO'LOV TUGMASI BOSILDI                                  │
│ - isRefundMode = false (sotish rejimi)                  │
│ - Stock tekshirish (hasStockError)                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ STOCK TEKSHIRISH                                        │
│ - Har bir mahsulot: quantity <= stock?                  │
│ - Agar yo'q bo'lsa - xato ko'rsatish                    │
│ - Agar ha bo'lsa - davom etish                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ TO'LOV DIALOGI OCHILADI                                 │
│ - To'lov turi tanlash (Naqd, Karta, O'tkazma, Aralash) │
│ - Chek chop etish (printReceipt)                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ completeSale(paymentType, 'sale')                       │
│ - Savdo ma'lumotlarini tayyorlash                       │
│ - MongoDB ga saqlash (offlineSales)                     │
│ - Stock kamaytirish (updateProductStock)               │
│ - Chek qo'shish (CashRegisterCheck)                     │
│ - Tarix qo'shish (salesHistory)                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ CHEK CHOP ETILDI VA SAQLANDI                            │
│ - Chek qo'shildi (salesHistory)                         │
│ - Kassa tozalandi (clearCart)                           │
│ - Yangi savdo boshlandi                                 │
└─────────────────────────────────────────────────────────┘
```

### 3. QAYTARISH JARAYONI

```
┌─────────────────────────────────────────────────────────┐
│ QAYTARISH REJIMI YOQILDI                                │
│ - isRefundMode = true                                   │
│ - Chek tarixi ochiladi                                  │
│ - Eski chekdan mahsulot tanlash                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ QAYTARISH CHEKLOVI                                      │
│ - Sotilgan miqdor = initialStock - hozirgi stock        │
│ - Yaroqsiz qaytarilgan = defectiveCounts               │
│ - Maksimal qaytarish = sotilgan - yaroqsiz              │
│ - Agar quantity > maksimal - xato ko'rsatish            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ completeSale(paymentType, 'refund')                     │
│ - Qaytarish ma'lumotlarini tayyorlash                   │
│ - MongoDB ga saqlash (offlineSales, saleType='refund')  │
│ - Stock oshirish (qaytarish uchun)                      │
│ - Tarix qo'shish (salesHistory)                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ QAYTARISH CHEKI CHOP ETILDI VA SAQLANDI                 │
│ - Qaytarish cheki qo'shildi (salesHistory)              │
│ - Kassa tozalandi (clearCart)                           │
│ - Yangi savdo boshlandi                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 💾 KASSA QISMI MA'LUMOTLARI

### 1. CartItem (Chekdagi mahsulot)
```typescript
interface CartItem {
  id: string;                    // Mahsulot yoki variant ID
  productId: string;             // Asosiy mahsulot ID (defectiveCounts uchun)
  name: string;                  // Mahsulot nomi
  sku?: string;                  // SKU/Kod
  barcode?: string;              // Barcode
  price: number;                 // Sotish narxi
  costPrice?: number;            // Asl narx (tan narxi)
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS';
  quantity: number;              // Miqdor
  discount: number;              // Chegirma
  stock: number;                 // Hozirgi ombordagi soni
  initialStock?: number;         // Boshlang'ich stock (qaytarish cheklovi uchun)
  createdByRole?: 'egasi' | 'admin' | 'xodim';
}
```

### 2. OfflineSale (Savdo ma'lumotlari)
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

### 3. SaleHistory (Tarix)
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

---

## 🔐 KASSA QISMI XAVFSIZLIGI

### 1. Stock Tekshirish
- **Sotish rejimida**: quantity <= stock
- **Qaytarish rejimida**: quantity <= (initialStock - stock - defectiveCount)

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

## 📱 KASSA QISMI INTERFEYSI

### 1. Qidiruv Paneli
- Barcode scanner
- SKU/Kod qidiruv
- Mahsulot ro'yxati
- Xillarni ko'rsatish

### 2. Chek Paneli
- Mahsulotlar ro'yxati
- Miqdor o'zgartirish
- Mahsulot o'chirish
- Jami summa

### 3. To'lov Paneli
- To'lov turi tanlash
- Chek chop etish
- Senik chop etish
- Tarix ko'rish

### 4. Tarix Paneli
- Bugun/O'tgan filtri
- Savdo ro'yxati
- Savdo tafsilotlari
- Qaytarish

---

## 🎯 KASSA QISMI XUSUSIYATLARI

### 1. Real-time Qidiruv
- MongoDB dan to'g'ridan-to'g'ri qidiruv
- Cache yo'q - har doim fresh data
- Barcode scanner qo'llab-quvvatlash

### 2. Offline Rejimi
- IndexedDB da mahsulotlar saqlanadi
- Offline savdolar saqlanadi
- Ombor bo'lsa - avtomatik sinxronizatsiya

### 3. Chop Etish
- Chek chop etish (80mm, 58mm)
- Senik chop etish (60x40mm, 40x30mm)
- Printer tanlash va sozlash

### 4. Tarix
- Savdo tarixi (bugun/o'tgan)
- Qaytarish tarixi
- Statistika

---

## 🚀 KASSA QISMI DEPLOYMENT

1. Frontend o'zgartirildi - qayta build qilish kerak
2. Server o'zgartirildi - qayta start qilish kerak
3. Test qilish kerak

```bash
# Frontend build
npm run build

# Server restart
npm run pm2:restart
```
