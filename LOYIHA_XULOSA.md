# OFLAYN DOKON - LOYIHA XULOSA

## 🎯 LOYIHA NIMA?

**Oflayn Dokon** - bu **offline auto parts store** (avtomobil ehtiyot qismlari do'koni) uchun web ilovasi.

**Asosiy xususiyatlar:**
- ✅ Offline rejimda ishlaydi (internet yo'q bo'lsa ham)
- ✅ 20,000+ mahsulotlarni boshqaradi
- ✅ Real-time kassa tizimi
- ✅ Barcode scanner qo'llaydi
- ✅ Chek chop etish
- ✅ Qaytarish va refund
- ✅ Telegram bot integratsiyasi
- ✅ Electron desktop app

---

## 📊 LOYIHA ARXITEKTURASI

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Kassa       │  │  Products    │  │  Customers   │  │
│  │  (Sotish)    │  │  (Boshqarish)│  │  (Qarzdorlar)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         ↓                  ↓                  ↓          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Offline Database (IndexedDB)             │  │
│  │  - Products (20,000+)                            │  │
│  │  - Categories                                    │  │
│  │  - Offline Sales                                 │  │
│  │  - Defective Products                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (Express)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Products    │  │  Offline     │  │  Cash        │  │
│  │  API         │  │  Sync        │  │  Register    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         ↓                  ↓                  ↓          │
│  ┌──────────────────────────────────────────────────┐  │
│  │    