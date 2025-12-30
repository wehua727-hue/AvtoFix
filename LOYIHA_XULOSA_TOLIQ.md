# LOYIHA XULOSA - TO'LIQ TAHLILI

## 📋 LOYIHA NOMI
**OflaynDokon** - Offline auto parts store web app (React + Express + MongoDB)

---

## 🏗️ LOYIHA ARXITEKTURASI

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Pages (client/pages/)                                │   │
│  │ - Kassa (Savdo qismi)                                │   │
│  │ - Products (Mahsulotlar)                             │   │
│  │ - Customers (Mijozlar)                               │   │
│  │ - Debts (Qarzlar)                                    │   │
│  │ - Stats (Statistika)                                 │   │
│  │ - Users (Foydalanuvchilar)                           │   │
│  │ - Stores (Do'konlar)                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Components (client/components/)                      │   │
│  │ - Layout (Sidebar, Navbar)                           │   │
│  │ - UI (Button, Dialog, Input, etc.)                   │   │
│  │ - ExcelImportModal                                   │   │
│  │ - VariantModal                                       │   │
│  │ - PrintPanel                                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Hooks (client/hooks/)                                │   │
│  │ - useOfflineKassa (Kassa logikasi)                   │   │
│  │ - useBarcodeScanner (Barcode scanner)                │   │
│  │ - useAuth (Autentifikatsiya)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Database (client/db/)                                │   │
│  │ - offlineDB (IndexedDB - Dexie.js)                   │   │
│  │ - Products, Categories, Sales, Sync Meta             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Express + Node.js)              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routes (server/routes/)                              │   │
│  │ - products.ts (Mahsulotlar CRUD)                     │   │
│  │ - categories.ts (Kategoriyalar)                      │   │
│  │ - cash-register.ts (Kassa cheklari)                  │   │
│  │ - offline-sync.ts (Offline sinxronizatsiya)          │   │
│  │ - excel-import.ts (Excel import)                     │   │
│  │ - customers.ts (Mijozlar)                            │   │
│  │ - debts.ts (Qarzlar)                                 │   │
│  │ - users.ts (Foydalanuvchilar)                        │   │
│  │ - auth.ts (Autentifikatsiya)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Models (server/*.model.ts)                           │   │
│  │ - ProductModel (Mahsulotlar)                         │   │
│  │ - CashRegisterCheck (Kassa cheklari)                 │   │
│  │ - CustomerModel (Mijozlar)                           │   │
│  │ - DebtModel (Qarzlar)                                │   │
│  │ - UserModel (Foydalanuvchilar)                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Services                                             │   │
│  │ - MongoDB (mongo.ts)                                 │   │
│  │ - WebSocket (websocket.ts)                           │   │
│  │ - Telegram Bot (telegram-bot.ts)                     │   │
│  │ - Checkers (birthday, debt, subscription)            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Database
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (MongoDB)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Collections:                                                │
│  - products (Mahsulotlar)                                    │
│  - categories (Kategoriyalar)                               │
│  - cash_register_checks (Kassa cheklari)                    │
│  - offline_sales (Offline savdolar)                         │
│  - customers (Mijozlar)                                     │
│  - debts (Qarzlar)                                          │
│  - users (Foydalanuvchilar)                                 │
│  - product_history (Mahsulot tarixi)                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 ASOSIY QISMLAR

### 1. MAHSULOT QO'SHISH (Products)

**Ikkita usul:**
1. **Qo'l bilan** - Products sahifasida forma orqali
2. **Excel bilan** - Excel fayldan import qilish

**Xususiyatlar:**
- ✅ SKU duplikati tekshirish (yangi)
- ✅ Ogohlantirish ko'rsatish (yangi)
- ✅ Mahsulot xillari (variantSummaries)
- ✅ Rasm yuklash
- ✅ Video yuklash
- ✅ Kategoriya tanlash
- ✅ Narx va foiz kiritish
- ✅ Ombordagi soni kiritish

**Server Endpoints:**
- `POST /api/products` - Mahsulot qo'shish
- `PUT /api/products/:id` - Mahsulot tahrirlash
- `DELETE /api/products/:id` - Mahsulot o'chirish
- `GET /api/products` - Mahsulotlar ro'yxati
- `POST /api/excel-import` - Excel import

---

### 2. KASSA QISMI (Kassa)

**Asosiy funksiyalar:**
1. **Mahsulot qo'shish**
   - Barcode scanner
   - SKU/Kod qidiruv
   - Mahsulot va xillarni qo'shish

2. **Savdo**
   - Miqdor o'zgartirish
   - Mahsulot o'chirish
   - Jami summa hisoblash
   - To'lov turi tanlash
   - Chek chop etish

3. **Qaytarish**
   - Qaytarish rejimi
   - Qaytarish cheklovi
   - Yaroqsiz mahsulotlar
   - Qaytarish cheki chop etish

4. **Senik Chop Etish**
   - Senik o'lchamlari
   - Printer tanlash
   - Miqdor kiritish

5. **Tarix**
   - Savdo tarixi
   - Qaytarish tarixi
   - Bugun/O'tgan filtri

**Server Endpoints:**
- `POST /api/sales/offline-sync` - Savdo sinxronizatsiya
- `GET /api/sales/offline` - Savdo tarixi
- `POST /api/cash-register` - Kassa cheki qo'shish

---

### 3. MIJOZLAR (Customers)

**Xususiyatlar:**
- Mijoz ro'yxati
- Mijoz ma'lumotlari
- Tug'ilgan kunlar
- Eng ko'p sotilgan mijozlar
- Telegram notifikatsiyalari

**Server Endpoints:**
- `GET /api/customers` - Mijozlar ro'yxati
- `POST /api/customers` - Mijoz qo'shish
- `PUT /api/customers/:id` - Mijoz tahrirlash
- `DELETE /api/customers/:id` - Mijoz o'chirish

---

### 4. QARZLAR (Debts)

**Xususiyatlar:**
- Qarz ro'yxati
- Qarz qo'shish
- Qarz to'lash
- Qarz tarixi
- Qarz statistikasi

**Server Endpoints:**
- `GET /api/debts` - Qarzlar ro'yxati
- `POST /api/debts` - Qarz qo'shish
- `PUT /api/debts/:id` - Qarz tahrirlash
- `DELETE /api/debts/:id` - Qarz o'chirish

---

### 5. STATISTIKA (Stats)

**Ko'rsatiladi:**
- Bugungi savdolar
- Haftalik savdolar
- Oylik savdolar
- Eng ko'p sotilgan mahsulotlar
- Eng ko'p sotilgan mijozlar
- Qarz statistikasi

---

## 👥 FOYDALANUVCHI ROLLARI

### 1. **Egasi (Owner)**
- Barcha mahsulotlarni ko'radi
- Barcha mahsulotlarni tahrirlaydi
- Barcha xodimlarni boshqaradi
- Barcha savdolarni ko'radi
- Statistikani ko'radi

### 2. **Admin**
- Barcha mahsulotlarni ko'radi
- Barcha mahsulotlarni tahrirlaydi
- Barcha savdolarni ko'radi
- Statistikani ko'radi

### 3. **Xodim (Employee)**
- Faqat o'z mahsulotlarini ko'radi
- Faqat o'z mahsulotlarini tahrirlaydi (agar canEditProducts=true)
- Faqat o'z savdolarini ko'radi
- Faqat o'z statistikasini ko'radi

---

## 💾 DATABASE SCHEMA

### Products Collection
```javascript
{
  _id: ObjectId,
  name: String,
  sku: String,
  price: Number,
  basePrice: Number,
  priceMultiplier: Number,
  currency: String,
  stock: Number,
  initialStock: Number,
  categoryId: String,
  userId: String,
  variantSummaries: [{
    name: String,
    sku: String,
    price: Number,
    stock: Number,
    initialStock: Number
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### CashRegisterCheck Collection
```javascript
{
  _id: ObjectId,
  userId: String,
  items: [{
    productId: String,
    name: String,
    quantity: Number,
    price: Number,
    discount: Number
  }],
  total: Number,
  type: String, // "pending", "completed", "current"
  paymentType: String,
  saleType: String, // "sale", "refund"
  createdAt: Date,
  updatedAt: Date
}
```

### OfflineSales Collection
```javascript
{
  _id: ObjectId,
  userId: String,
  items: [{
    productId: String,
    name: String,
    quantity: Number,
    price: Number,
    discount: Number
  }],
  total: Number,
  paymentType: String,
  saleType: String, // "sale", "refund"
  synced: Boolean,
  createdAt: Date,
  offlineCreatedAt: Date
}
```

---

## 🔐 XAVFSIZLIK

### 1. Autentifikatsiya
- JWT token
- Login/Logout
- Token verification

### 2. Avtorizatsiya
- Role-based access control (RBAC)
- userId tekshirish
- Huquq tekshirish

### 3. Data Validation
- Input validation
- Type checking
- Error handling

---

## 📱 OFFLINE REJIMI

### IndexedDB Collections
- products (Mahsulotlar)
- categories (Kategoriyalar)
- offlineSales (Offline savdolar)
- syncMeta (Sinxronizatsiya meta)
- searchIndex (Qidiruv indeksi)
- defectiveProducts (Yaroqsiz mahsulotlar)

### Sinxronizatsiya
- Avtomatik sinxronizatsiya
- Manual sinxronizatsiya
- Conflict resolution
- Deduplication

---

## 🚀 DEPLOYMENT

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run start
```

### PM2
```bash
npm run pm2:start
npm run pm2:restart
npm run pm2:stop
```

---

## 📊 STATISTIKA

### Bugungi Savdolar
- Jami savdolar
- Jami summa
- Eng ko'p sotilgan mahsulotlar

### Haftalik Savdolar
- Har kunning savdolari
- Grafik

### Oylik Savdolar
- Har hafta savdolari
- Grafik

---

## 🎯 XULOSA

**OflaynDokon** - to'liq offline-first auto parts store web app:
- ✅ Offline rejimida ishlaydi
- ✅ Real-time sinxronizatsiya
- ✅ Barcode scanner qo'llab-quvvatlash
- ✅ Excel import
- ✅ Chop etish (chek, senik)
- ✅ Tarix va statistika
- ✅ Role-based access control
- ✅ Telegram notifikatsiyalari
- ✅ Responsive design
- ✅ Dark mode

---

## 📝 FAYLLAR TUZILISHI

```
OflaynDokon/
├── client/
│   ├── pages/
│   │   ├── Kassa.tsx
│   │   ├── Products.tsx
│   │   ├── Customers.tsx
│   │   ├── Debts.tsx
│   │   ├── Stats.tsx
│   │   └── ...
│   ├── components/
│   │   ├── Layout/
│   │   ├── ui/
│   │   ├── ExcelImportModal.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useOfflineKassa.ts
│   │   ├── useBarcodeScanner.ts
│   │   └── ...
│   ├── db/
│   │   └── offlineDB.ts
│   ├── lib/
│   │   ├── auth-context.ts
│   │   ├── pos-print.ts
│   │   └── ...
│   └── App.tsx
├── server/
│   ├── routes/
│   │   ├── products.ts
│   │   ├── categories.ts
│   │   ├── cash-register.ts
│   │   ├── offline-sync.ts
│   │   ├── excel-import.ts
│   │   └── ...
│   ├── *.model.ts
│   ├── index.ts
│   ├── mongo.ts
│   ├── websocket.ts
│   └── ...
├── shared/
│   ├── types.ts
│   ├── order-types.ts
│   └── ...
├── package.json
├── tsconfig.json
├── vite.config.ts
└── ...
```

---

## 🔄 YANGI XUSUSIYATLAR (BAJARILGAN)

### 1. SKU Duplikati Tekshirish
- ✅ Qo'l bilan mahsulot qo'shganda
- ✅ Excel import qilganda
- ✅ Ogohlantirish ko'rsatish
- ✅ Mahsulot qo'shilish davom etish

### 2. Eski Mahsulotga Zarar Yetmasin
- ✅ Yangi mahsulot qo'shiladi
- ✅ Eski mahsulot o'zgartirilmaydi
- ✅ Eski mahsulot saqlanadi

---

## 📞 SUPPORT

Agar savollar bo'lsa, loyiha egasiga murojaat qiling.
