# 🚀 AvtoFix - Loyiha Arxitekturasi va Funksiyalar

## 📋 Loyiha Haqida

**AvtoFix** - avtomobil ehtiyot qismlari do'koni uchun to'liq offline/online POS (Point of Sale) tizimi. Loyiha React, TypeScript, Node.js, Express, MongoDB va Electron texnologiyalari asosida qurilgan.

---

## 🏗️ Loyiha Tuzilmasi

```
AvtoFix/
├── client/          # Frontend (React + TypeScript)
├── server/          # Backend (Node.js + Express)
├── electron/        # Desktop app (Electron)
├── shared/          # Umumiy types va interfacelar
└── beets/           # Har bir funksiya uchun batafsil hujjatlar
```

---

## 🎯 Asosiy Qismlar

### 1. **CLIENT (Frontend)**
**Texnologiya:** React 19, TypeScript, Vite, TailwindCSS, Shadcn/UI

**Vazifasi:** Foydalanuvchi interfeysi va offline ishlash

**Asosiy Komponentlar:**
- **Pages:** Sahifalar (Kassa, Mahsulotlar, Statistika, va boshqalar)
- **Components:** Qayta ishlatiluvchi UI komponentlar
- **Hooks:** Custom React hooks (offline sync, barcode scanner)
- **Services:** Xizmatlar (sync manager, search engine)
- **DB:** IndexedDB bilan ishlash (offline ma'lumotlar)

---

### 2. **SERVER (Backend)**
**Texnologiya:** Node.js, Express, MongoDB, Mongoose

**Vazifasi:** API, ma'lumotlar bazasi, biznes logika

**Asosiy Qismlar:**
- **Routes:** API endpoint'lar
- **Models:** MongoDB sxemalari
- **Middleware:** Autentifikatsiya, validatsiya
- **Utils:** Yordamchi funksiyalar
- **Scripts:** Ma'lumotlar migratsiyasi va boshqaruv

---

### 3. **ELECTRON (Desktop App)**
**Texnologiya:** Electron, Node.js

**Vazifasi:** Desktop ilovasi, printer bilan ishlash

**Asosiy Qismlar:**
- **main.cjs:** Asosiy Electron jarayoni
- **preload.cjs:** Xavfsiz API bridge
- **server.cjs:** Mahalliy server
- **printer-manager.cjs:** Printer boshqaruvi
- **print-service.cjs:** Chek chop etish

---

### 4. **SHARED (Umumiy)**
**Texnologiya:** TypeScript

**Vazifasi:** Frontend va Backend o'rtasida umumiy types

**Fayllar:**
- **types.ts:** Mahsulot, variant, sync types
- **customer-types.ts:** Mijoz types
- **debt-types.ts:** Qarz types
- **order-types.ts:** Buyurtma types
- **print-types.ts:** Chek chop etish types

---

## 🔧 Asosiy Funksiyalar

### 1. **KASSA (POS System)**
**Fayl:** `client/pages/Kassa.tsx`

**Vazifasi:** Mahsulot sotish, to'lov qabul qilish, chek chop etish

**Funksiyalar:**
- ✅ Mahsulot qidirish (nom, kod, shtrix-kod)
- ✅ Savat boshqaruvi
- ✅ To'lov turlari (naqd, karta, nasiya, aralash)
- ✅ Chek chop etish (USB/Network printer)
- ✅ Offline ishlash
- ✅ Valyuta konvertatsiyasi (UZS, USD, RUB, CNY)
- ✅ Barcode scanner qo'llab-quvvatlash
- ✅ Yaroqsiz mahsulotlar boshqaruvi
- ✅ Mijoz tanlash
- ✅ Chegirma qo'llash

**Batafsil:** `beets/kassa.md`

---

### 2. **MAHSULOTLAR (Products Management)**
**Fayl:** `client/pages/Products.tsx`

**Vazifasi:** Mahsulotlarni qo'shish, tahrirlash, o'chirish

**Funksiyalar:**
- ✅ Mahsulot CRUD operatsiyalari
- ✅ **Dublikat tekshiruvi (5 xonali kod yoki nom bo'yicha)** 🆕
- ✅ Kategoriya bo'yicha filtrlash
- ✅ Qidiruv (nom, kod, katalog)
- ✅ Mahsulot variantlari (o'lcham, rang, va boshqalar)
- ✅ Rasm yuklash (drag & drop)
- ✅ Excel import
- ✅ **Excel export (barcha mahsulotlar va xillar)** 🆕
- ✅ Ota-bola mahsulot tizimi
- ✅ Mahsulot holati (mavjud, kutilmoqda, tugagan)
- ✅ Narx va valyuta boshqaruvi
- ✅ Ombor boshqaruvi
- ✅ Barcode label chop etish

**Batafsil:** `beets/mahsulotlar.md`

---

### 3. **KATEGORIYALAR (Categories)**
**Fayl:** `client/pages/AddCategory.tsx`

**Vazifasi:** Mahsulotlarni guruhlash

**Funksiyalar:**
- ✅ Kategoriya qo'shish/tahrirlash/o'chirish
- ✅ Ota-kategoriya va ichki kategoriyalar
- ✅ Daraxt ko'rinishi
- ✅ Kategoriya bo'yicha mahsulotlar soni
- ✅ **Kategoriya ustama foizi (Markup Percentage)** 🆕
- ✅ **Kategoriya bo'yicha barcha mahsulotlar narxini avtomatik yangilash** 🆕

**Batafsil:** `beets/kategoriyalar.md`, `beets/kategoriya-foiz.md`

---

### 4. **STATISTIKA (Statistics & Reports)**
**Fayl:** `client/pages/Stats.tsx`

**Vazifasi:** Savdo hisobotlari va tahlil

**Funksiyalar:**
- ✅ Kunlik savdo statistikasi
- ✅ Haftalik savdo statistikasi
- ✅ Eng ko'p sotiladigan mahsulotlar
- ✅ Daromad va foyda hisoboti
- ✅ Grafik va diagrammalar (Recharts)
- ✅ Yaroqsiz mahsulotlar hisoboti
- ✅ Qaytarilgan mahsulotlar
- ✅ Statistikani tozalash

**Batafsil:** `beets/statistika.md`

---

### 5. **MIJOZLAR (Customers)**
**Fayl:** `client/pages/Customers.tsx`

**Vazifasi:** Mijozlarni boshqarish

**Funksiyalar:**
- ✅ Mijoz qo'shish/tahrirlash/o'chirish
- ✅ Mijoz tarixi
- ✅ Tug'ilgan kun eslatmalari
- ✅ TOP mijozlar
- ✅ Umumiy xarid summasi
- ✅ Telefon raqami bilan qidirish

**Batafsil:** `beets/mijozlar.md`

---

### 6. **QARZLAR (Debts Management)**
**Fayl:** `client/pages/Debts.tsx`

**Vazifasi:** Qarzlarni kuzatish

**Funksiyalar:**
- ✅ Qarz qo'shish/tahrirlash/o'chirish
- ✅ Qarz to'lash
- ✅ Qarz tarixi
- ✅ Muddati o'tgan qarzlar
- ✅ Qora ro'yxat
- ✅ Telegram orqali eslatma
- ✅ Valyuta qo'llab-quvvatlash

**Batafsil:** `beets/qarzlar.md`

---

### 7. **FOYDALANUVCHILAR (Users Management)**
**Fayl:** `client/pages/Users.tsx`, `client/pages/Xodimlar.tsx`

**Vazifasi:** Xodimlar va foydalanuvchilarni boshqarish

**Funksiyalar:**
- ✅ Foydalanuvchi qo'shish/tahrirlash/o'chirish
- ✅ Rol tizimi (Ega, Admin, Menejer, Kassir)
- ✅ Huquqlar boshqaruvi
- ✅ Parol o'zgartirish
- ✅ Obuna boshqaruvi
- ✅ Bloklash/aktivlashtirish

**Batafsil:** `beets/foydalanuvchilar.md`

---

### 8. **DO'KONLAR (Stores/Branches)**
**Fayl:** `client/pages/Stores.tsx`, `client/pages/AddStore.tsx`

**Vazifasi:** Filiallarni boshqarish

**Funksiyalar:**
- ✅ Do'kon qo'shish/tahrirlash/o'chirish
- ✅ Do'kon ma'lumotlari (nom, manzil, telefon)
- ✅ Do'kon bo'yicha mahsulotlar
- ✅ Do'kon bo'yicha statistika

**Batafsil:** `beets/dokonlar.md`

---

### 9. **OFFLINE SYNC (Offline-First Architecture)**
**Fayllar:** 
- `client/db/offlineDB.ts`
- `client/services/syncManager.ts`
- `client/hooks/useOfflineSync.ts`

**Vazifasi:** Internet yo'q bo'lganda ham ishlash

**Funksiyalar:**
- ✅ IndexedDB bilan mahalliy saqlash
- ✅ Avtomatik sinxronizatsiya
- ✅ Conflict resolution
- ✅ Offline savdo
- ✅ Offline mahsulot qo'shish
- ✅ Queue tizimi
- ✅ Retry mexanizmi

**Batafsil:** `beets/offline-sync.md`

---

### 10. **PRINTER INTEGRATION (Chek Chop Etish)**
**Fayllar:**
- `electron/printer-manager.cjs`
- `electron/print-service.cjs`
- `client/lib/pos-print.ts`

**Vazifasi:** Chek va barcode label chop etish

**Funksiyalar:**
- ✅ USB printer qo'llab-quvvatlash
- ✅ Network printer qo'llab-quvvatlash
- ✅ ESC/POS komandalar
- ✅ Chek dizayni
- ✅ Barcode label (40x30mm, 50x30mm, 60x40mm)
- ✅ QR code
- ✅ Cash drawer ochish
- ✅ Printer holati tekshirish

**Batafsil:** `beets/printer.md`

---

### 11. **EXCEL IMPORT (Excel dan Import)**
**Fayllar:**
- `client/components/ExcelImportModal.tsx`
- `server/routes/excel-import.ts`

**Vazifasi:** Excel fayldan mahsulotlarni import qilish

**Funksiyalar:**
- ✅ Excel fayl yuklash
- ✅ Ustunlarni mapping qilish
- ✅ Preview va tahrirlash
- ✅ Dublikat tekshirish
- ✅ Birinchi 2 so'z bilan guruhlash
- ✅ Avtomatik variant yaratish
- ✅ SKU validatsiya
- ✅ Xato xabarlari

**Batafsil:** `beets/excel-import.md`

---

### 12. **TELEGRAM BOT (Telegram Integratsiyasi)**
**Fayl:** `server/telegram-bot.ts`

**Vazifasi:** Telegram orqali xabarlar va eslatmalar

**Funksiyalar:**
- ✅ Tug'ilgan kun eslatmalari
- ✅ Qarz eslatmalari
- ✅ Obuna tugash eslatmalari
- ✅ Yangi buyurtma xabarlari
- ✅ Ombor tugash xabarlari
- ✅ Kunlik hisobot

**Batafsil:** `beets/telegram-bot.md`

---

### 13. **AUTHENTICATION (Autentifikatsiya)**
**Fayllar:**
- `server/routes/auth.ts`
- `client/lib/auth-context.tsx`
- `server/middleware/auth.ts`

**Vazifasi:** Foydalanuvchi autentifikatsiyasi va avtorizatsiya

**Funksiyalar:**
- ✅ Login/Logout
- ✅ JWT token
- ✅ Session boshqaruvi
- ✅ Rol-based access control
- ✅ Password hashing (bcrypt)
- ✅ Token verification
- ✅ Login as (admin uchun)

**Batafsil:** `beets/authentication.md`

---

### 14. **WEBSOCKET (Real-time Updates)**
**Fayl:** `server/websocket.ts`

**Vazifasi:** Real-time ma'lumotlar yangilanishi

**Funksiyalar:**
- ✅ Mahsulot yangilanishi
- ✅ Savdo yangilanishi
- ✅ Ombor yangilanishi
- ✅ Foydalanuvchi holati
- ✅ Broadcast xabarlar

**Batafsil:** `beets/websocket.md`

---

### 15. **CURRENCY (Valyuta Tizimi)**
**Fayllar:**
- `server/routes/currency.ts`
- `client/components/CurrencyPriceInput.tsx`

**Vazifasi:** Ko'p valyuta qo'llab-quvvatlash

**Funksiyalar:**
- ✅ UZS, USD, RUB, CNY
- ✅ Avtomatik kurs yangilanishi
- ✅ Qo'lda kurs kiritish
- ✅ Valyuta konvertatsiyasi
- ✅ Narx ko'rsatish

**Batafsil:** `beets/currency.md`

---

## 🗄️ Ma'lumotlar Bazasi

### MongoDB Collections:

1. **users** - Foydalanuvchilar
2. **products** - Mahsulotlar
3. **categories** - Kategoriyalar
4. **stores** - Do'konlar
5. **customers** - Mijozlar
6. **orders** - Buyurtmalar
7. **debts** - Qarzlar
8. **debt_history** - Qarz tarixi
9. **blacklist** - Qora ro'yxat
10. **sales** - Sotuvlar (offline sync)
11. **cash_register** - Kassa cheklari
12. **defective_products** - Yaroqsiz mahsulotlar

**Batafsil:** `beets/database.md`

---

## 🔐 Xavfsizlik

### Xavfsizlik Choralari:

- ✅ JWT token autentifikatsiya
- ✅ Password hashing (bcrypt)
- ✅ CORS sozlamalari
- ✅ Input validatsiya (Zod)
- ✅ SQL injection himoyasi
- ✅ XSS himoyasi
- ✅ Rate limiting
- ✅ Rol-based access control

**Batafsil:** `beets/security.md`

---

## 📱 Responsive Design

- ✅ Desktop (1920x1080+)
- ✅ Laptop (1366x768+)
- ✅ Tablet (768x1024+)
- ✅ Mobile (375x667+)

---

## 🎨 UI/UX

**Design System:** Shadcn/UI + TailwindCSS

**Komponentlar:**
- Button, Input, Select, Dialog
- Alert, Toast, Notification
- Card, Badge, Avatar
- Table, Tabs, Accordion
- va boshqalar...

**Animatsiyalar:** Framer Motion

**Ikonlar:** Lucide React

---

## 🚀 Deployment

### Development:
```bash
pnpm run dev
```

### Production:
```bash
pnpm run build
pnpm run start
```

### Electron:
```bash
pnpm run electron:build:win
```

**Batafsil:** `beets/deployment.md`

---

## 📊 Texnik Stack

### Frontend:
- React 19
- TypeScript 5.9
- Vite 7
- TailwindCSS 4
- Shadcn/UI
- Framer Motion
- React Query
- React Router DOM
- IndexedDB (Dexie)

### Backend:
- Node.js 20+
- Express 5
- MongoDB 7
- Mongoose 8
- JWT
- Bcrypt
- Multer
- WebSocket (ws)

### Desktop:
- Electron 33
- ESC/POS printer
- USB/Network printer

### DevOps:
- PM2
- Nginx
- Git
- pnpm

---

## 📝 Hujjatlar

Har bir funksiya uchun batafsil hujjat `beets/` papkasida:

1. `kassa.md` - Kassa tizimi
2. `mahsulotlar.md` - Mahsulotlar boshqaruvi
3. `kategoriyalar.md` - Kategoriyalar
4. `kategoriya-foiz.md` - Kategoriya ustama foizi 🆕
5. `statistika.md` - Statistika va hisobotlar
6. `mijozlar.md` - Mijozlar boshqaruvi
7. `qarzlar.md` - Qarzlar boshqaruvi
8. `foydalanuvchilar.md` - Foydalanuvchilar
9. `dokonlar.md` - Do'konlar
10. `offline-sync.md` - Offline sinxronizatsiya
11. `printer.md` - Printer integratsiyasi
12. `excel-import.md` - Excel import
13. `telegram-bot.md` - Telegram bot
14. `authentication.md` - Autentifikatsiya
15. `websocket.md` - WebSocket
16. `currency.md` - Valyuta tizimi
17. `database.md` - Ma'lumotlar bazasi
18. `security.md` - Xavfsizlik
19. `deployment.md` - Deployment

---

## 🔧 Avtomatik Hujjatlashtirish

### Git Hooks O'rnatish

Har safar yangi funksiya qo'shganingizda yoki o'zgartirishlar kiritganingizda, hujjatlarni avtomatik yangilash eslatmasi olish uchun:

**Windows:**
```cmd
setup-hooks.bat
```

**Linux/Mac:**
```bash
chmod +x setup-hooks.sh
./setup-hooks.sh
```

### Ishlash Prinsipi

Git hooks o'rnatilgandan keyin, har safar `git commit` qilganingizda:

1. ✅ `client/` va `server/` papkalaridagi o'zgarishlar avtomatik aniqlanadi
2. ⚠️ Hujjatlarni yangilash eslatmasi ko'rsatiladi
3. ❓ "Hujjatlarni yangaladingizmi?" deb so'raladi
4. ✅ "Yes" desangiz commit davom etadi
5. ❌ "No" desangiz commit bekor qilinadi

### Commit Message Formati

```
type(scope): qisqacha tavsif
```

**Type'lar:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Misol:**
```bash
git commit -m "feat(kassa): chegirma funksiyasi qo'shildi"
```

---

## 📋 Hujjatlashtirish Qoidalari

### Yangi Funksiya Qo'shilganda:

1. **Kod yozing** - Funksiyani implement qiling
2. **Hujjat yarating** - `beets/funksiya-nomi.md` yarating
3. **agents.md yangilang** - Bu faylda ro'yxatga qo'shing
4. **Commit qiling** - Git hook avtomatik tekshiradi

### Hujjat Strukturasi:

```markdown
# 📦 FUNKSIYA NOMI

## 📋 Umumiy Ma'lumot
**Vazifasi:** ...
**Fayllar:** ...

## 🎯 Asosiy Funksiyalar
- ✅ Funksiya 1
- ✅ Funksiya 2

## 💻 Texnik Tafsilotlar
### Frontend
### Backend
### Ma'lumotlar Bazasi

## 🔄 Ishlash Jarayoni
1. Qadam 1
2. Qadam 2

**Yaratilgan:** YYYY-MM-DD
**Oxirgi yangilanish:** YYYY-MM-DD
```

---

**Yaratilgan:** 2025-02-10
**Versiya:** 1.0.0
**Muallif:** AvtoFix Development Team
