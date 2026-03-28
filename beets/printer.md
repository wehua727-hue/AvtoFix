# 🖨️ PRINTER INTEGRATION - Chek va Label Chop Etish

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `electron/printer-manager.cjs` - Printer boshqaruvi
- `electron/print-service.cjs` - Chop etish xizmati
- `client/lib/pos-print.ts` - Frontend API

**Texnologiya:** ESC/POS, USB, Network, Electron

---

## 🖨️ Printer Turlari

### 1. USB Printer
- Kompyuterga USB orqali ulangan
- Tez va ishonchli
- Driver kerak emas (ESC/POS)

### 2. Network Printer
- Wi-Fi yoki Ethernet orqali
- Ko'p qurilmadan foydalanish mumkin
- IP address va port kerak

### 3. Bluetooth Printer
- Simsiz ulanish
- Mobil qurilmalar uchun qulay

---

## 📄 Chek Chop Etish

### Chek Tuzilmasi:
```
================================
        AVTOFIX
   Avto ehtiyot qismlari
================================
Do'kon: GM Filiali
Manzil: Toshkent, Chilonzor
Tel: +998 90 123 45 67
================================
Chek: #12345
Sana: 10.02.2025 14:30
Kassir: Javohir
================================
Mahsulot         Soni    Summa
--------------------------------
Moy 5W-30 1L      2    100,000
Filter yog'       1     50,000
--------------------------------
Jami:                  150,000
To'lov: Naqd
================================
Xaridingiz uchun rahmat!
[QR CODE]
================================
```

### ESC/POS Komandalar:
```typescript
const ESC = '\x1B';
const GS = '\x1D';

// Asosiy komandalar
const ESC_INIT = ESC + '@';              // Reset
const ESC_ALIGN_CENTER = ESC + 'a' + '1'; // Markazga
const ESC_ALIGN_LEFT = ESC + 'a' + '0';   // Chapga
const ESC_BOLD_ON = ESC + 'E' + '1';      // Qalin
const ESC_BOLD_OFF = ESC + 'E' + '0';     // Oddiy
const ESC_CUT = GS + 'V' + '1';           // Qog'oz kesish
```

---

## 🏷️ Barcode Label Chop Etish

### Label O'lchamlari:
- 40x30mm - Kichik label
- 50x30mm - O'rtacha label
- 60x40mm - Katta label

### Label Tuzilmasi:
```
┌──────────────────┐
│  Moy 5W-30 1L    │
│  SKU: M001       │
│  50,000 so'm     │
│  [BARCODE]       │
└──────────────────┘
```

---

## 🔧 API

### Printer Ro'yxati:
```typescript
const printers = await listPrinters();
// [{ id: 'USB001', name: 'POS-80', type: 'usb' }]
```

### Chek Chop Etish:
```typescript
await printReceipt(printerId, {
  storeName: 'AVTOFIX',
  items: [...],
  total: 150000,
});
```

### Label Chop Etish:
```typescript
await printLabel(printerId, {
  name: 'Moy 5W-30 1L',
  sku: 'M001',
  price: 50000,
  barcode: 'M001',
});
```

---

**Yaratilgan:** 2025-02-10
