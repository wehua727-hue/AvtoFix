# Kassa Tarix Qismi - To'liq Tahlil

## 📋 Umumiy Tushuncha

Tarix qismi - bu barcha sotuvlar va qaytarishlarning to'liq ro'yxati. Foydalanuvchi "Tarix" tugmasini bosganda, barcha savdolar ko'rsatiladi.

---

## 🏗️ Arxitektura

### 1. **Data Manbalari (2 ta)**

#### A. **MongoDB (Server)**
- **Endpoint**: `/api/sales/offline?userId={userId}&limit=1000`
- **Maqsad**: Barcha sinxronlangan savdolarni saqlash
- **Qiymatlar**:
  - `_id` - MongoDB ID
  - `offlineCreatedAt` - Offline yaratilgan vaqt
  - `createdAt` - Server vaqti
  - `items` - Mahsulotlar ro'yxati
  - `total` - Jami summa
  - `paymentType` - To'lov turi (Naqd, Karta, O'tkazma)
  - `saleType` - Savdo turi (sale, refund)

#### B. **IndexedDB (Local)**
- **Maqsad**: Sinxronlanmagan savdolarni saqlash
- **Qiymatlar**: MongoDB bilan bir xil
- **Farq**: `synced: false` bo'ladi

### 2. **Data Yuklash Jarayoni**

```
┌─────────────────────────────────────────┐
│ 1. Server dan tarixni olish (MongoDB)   │
│    - Sinxronlangan savdolar             │
│    - synced: true                       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. IndexedDB dan sinxronlanmagan olish  │
│    - Hali yuborilmagan savdolar         │
│    - synced: false                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. Birlashtirilgan tarix                │
│    - Local + Server                     │
│    - Eng yangi birinchi (sort)          │
│    - Max 1000 ta                        │
└─────────────────────────────────────────┘
```

### 3. **Fallback Mexanizmi**

Agar server xato bersa:
- Faqat IndexedDB dan tarixni olish
- Sinxronlanmagan savdolarni ko'rsatish

---

## 🎨 UI Tuzilishi

### **Tarix Dialog** (Asosiy ko'rinish)

```
┌─────────────────────────────────────────┐
│ 📜 Sotuvlar tarixi                      │
│ ⚠️ 5 ta sinxronlanmagan (agar bor)      │
├─────────────────────────────────────────┤
│ [Bugun] [O'tgan]  ← Filtrlash tugmalari│
├─────────────────────────────────────────┤
│ 📅 2026-01-02 (3 ta)                    │
│ ├─ 🚚 Mahsulot 1, Mahsulot 2 +1 ta     │
│ │  #1 14:30 💳 $150.00                 │
│ │                                       │
│ ├─ 🚚 Mahsulot 3                       │
│ │  #2 14:25 💰 -$50.00 (Qaytarish)    │
│ │                                       │
│ └─ 🚚 Mahsulot 4, Mahsulot 5           │
│    #3 14:20 📱 $200.00 ☁️ (Sinxron)   │
│                                         │
│ 📅 2026-01-01 (2 ta)                    │
│ ├─ 🚚 Mahsulot 6                       │
│ │  #1 10:15 💳 $100.00                 │
│ │                                       │
│ └─ 🚚 Mahsulot 7, Mahsulot 8           │
│    #2 09:30 💰 $300.00                 │
└─────────────────────────────────────────┘
```

### **Savdo Detali Dialog** (Tanlanganda)

```
┌─────────────────────────────────────────┐
│ 🚚                                      │
│ 💳 Chek                                 │
│ 2026-01-02 • 14:30                      │
├─────────────────────────────────────────┤
│ Mahsulotlar:                            │
│ ┌─────────────────────────────────────┐ │
│ │ Mahsulot 1        2 x $50.00 = $100 │ │
│ │ Mahsulot 2        1 x $50.00 = $50  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Jami: $150.00                           │
│ To'lov: Karta                           │
│                                         │
│ [🖨️ Chekni chop etish]                 │
└─────────────────────────────────────────┘
```

---

## 🔄 Filtrlash Logikasi

### **Bugun (Today)**
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

// Faqat bugungi savdolar
saleDate.getTime() === today.getTime()
```

### **O'tgan (Past)**
```javascript
// Bugundan oldingi savdolar
saleDate.getTime() < today.getTime()
```

### **Rejim Filtri**
- **Sotish rejimida**: Faqat `sale` turini ko'rsatish
- **Qaytarish rejimida**: Faqat `refund` turini ko'rsatish

### **Sanalar bo'yicha Guruhlash**
```javascript
const grouped: Record<string, SaleHistory[]> = {};
filteredHistory.forEach((sale) => {
  const dateKey = new Date(sale.date).toLocaleDateString("ru-RU");
  if (!grouped[dateKey]) grouped[dateKey] = [];
  grouped[dateKey].push(sale);
});
```

---

## 💾 Data Struktura

### **SaleHistory Interface**
```typescript
interface SaleHistory {
  id: string;                    // Savdo ID
  items: SaleHistoryItem[];      // Mahsulotlar
  total: number;                 // Jami summa
  date: Date;                    // Savdo vaqti
  paymentType?: string;          // To'lov turi
  type?: "sale" | "refund";      // Savdo turi
  synced?: boolean;              // Sinxronlangan?
}

interface SaleHistoryItem {
  id: string;                    // Item ID
  productId: string;             // Mahsulot ID
  name: string;                  // Mahsulot nomi
  sku?: string;                  // SKU
  price: number;                 // Narxi
  quantity: number;              // Miqdori
  discount: number;              // Chegirma %
}
```

---

## 🎯 Asosiy Xususiyatlar

### 1. **Sinxronizasyon Holati**
- ☁️ **Sinxronlangan**: Server dan yuklangan
- 🔴 **Sinxronlanmagan**: IndexedDB da, hali yuborilmagan
- Indicator: `CloudOff` icon + "Sinxronlanmagan" badge

### 2. **To'lov Turlari**
- 💰 **Naqd** (Banknote icon)
- 💳 **Karta** (CreditCard icon)
- 📱 **O'tkazma** (Smartphone icon)
- 👛 **Boshqa** (Wallet icon)

### 3. **Savdo Turlari**
- ✅ **Sotish** (Sale) - Yashil, `$` belgisi
- ❌ **Qaytarish** (Refund) - Qizil, `-$` belgisi

### 4. **Mahsulot Ko'rsatish**
- Birinchi 2 ta mahsulot nomi ko'rsatiladi
- Agar 3+ ta bo'lsa: `+N ta` qo'shimchasi

---

## 📊 Statistika

### **Tarix Dialogi Headerida**
```
Sotuvlar tarixi
⚠️ 5 ta sinxronlanmagan
```

### **Tarix Tugmasida**
```
Tarix 🟢 12
```
- 🟢 Badge - Jami savdolar soni

---

## 🔧 Texnik Detallar

### **API Endpoint**
```
GET /api/sales/offline?userId={userId}&limit=1000
```

### **Response Format**
```json
{
  "success": true,
  "sales": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "offlineCreatedAt": "2026-01-02T14:30:00Z",
      "createdAt": "2026-01-02T14:35:00Z",
      "items": [...],
      "total": 150,
      "paymentType": "Karta",
      "saleType": "sale"
    }
  ]
}
```

### **IndexedDB Query**
```javascript
offlineDB.offlineSales
  .where("userId").equals(userId)
  .filter(s => s.synced === false)
  .reverse()
  .sortBy("createdAt")
```

---

## 🚀 Jarayonlar

### **1. Tarix Yuklash**
1. Component mount bo'lganda `useEffect` chaqiriladi
2. Server dan tarixni olish (MongoDB)
3. Agar muvaffaq: Local sinxronlanmagan savdolarni qo'shish
4. Agar xato: Faqat IndexedDB dan olish
5. Sanasi bo'yicha tartiblash (eng yangi birinchi)
6. `setSalesHistory` orqali state ga saqlash

### **2. Tarix Ko'rsatish**
1. "Tarix" tugmasini bosish → `setHistoryOpen(true)`
2. Dialog ochiladi
3. Filtrlash tugmalari: "Bugun" / "O'tgan"
4. Sanalar bo'yicha guruhlash
5. Har bir savdo kartasini ko'rsatish

### **3. Savdo Detali Ko'rsatish**
1. Savdo kartasini bosish → `setSelectedSale(sale)`
2. Detail dialog ochiladi
3. Mahsulotlar ro'yxati ko'rsatiladi
4. "Chekni chop etish" tugmasi mavjud

### **4. Chekni Chop Etish**
1. `printReceipt()` funksiyasi chaqiriladi
2. Receipt data tayyorlanadi
3. Printer orqali chop etiladi

---

## ⚠️ Muhim Nuqtalar

### **1. Sinxronizasyon**
- Server dan kelgan savdolar `synced: true`
- IndexedDB da saqlangan savdolar `synced: false`
- Agar internet yo'q bo'lsa, savdolar IndexedDB da saqlanadi
- Internet qaytganda, savdolar serverga yuboriladi

### **2. Filtrlash**
- Sotish rejimida qaytarish ko'rsatilmaydi
- Qaytarish rejimida sotish ko'rsatilmaydi
- "Bugun" - faqat bugungi savdolar
- "O'tgan" - bugundan oldingi savdolar

### **3. Performance**
- Max 1000 ta savdo ko'rsatiladi
- Sanalar bo'yicha guruhlash (O(n) complexity)
- Scroll orqali lazy loading yo'q (barcha data yuklangan)

### **4. Data Integrity**
- Server dan kelgan data `synced: true` bo'ladi
- Local data `synced: false` bo'ladi
- Duplicate savdolar yo'q (ID orqali unique)

---

## 🎓 Xulosa

**Tarix qismi** - bu kassa tizimining muhim qismi bo'lib, barcha savdolarni kuzatish va qayta chop etish imkoniyatini beradi. 

**Asosiy xususiyatlar:**
- ✅ Server + Local data birlashtirilgan
- ✅ Sinxronizasyon holati ko'rsatiladi
- ✅ Filtrlash (Bugun/O'tgan, Sotish/Qaytarish)
- ✅ Sanalar bo'yicha guruhlash
- ✅ Chekni qayta chop etish
- ✅ Fallback mexanizmi (server xato bo'lsa)

**Texnik Stack:**
- React Hooks (useState, useEffect, useCallback)
- IndexedDB (Local storage)
- MongoDB (Server storage)
- Dialog UI (shadcn/ui)
