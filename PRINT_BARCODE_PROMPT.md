# Chek/Senik Chop Etish va Barcode Skaner - To'liq Prompt

Bu prompt React + TypeScript loyihasiga chek (receipt) va senik (label/etiketka) chop etish hamda barcode skaner funksiyalarini qo'shish uchun.

---

## 1. POS Print Service (`client/lib/pos-print.ts`)

Bu fayl thermal printer va label printerlar bilan ishlash uchun to'liq servis.

### Xususiyatlar:
- **Electron**: IPC orqali to'g'ridan-to'g'ri ESC/POS chop etish
- **Web**: WebUSB API + brauzer print fallback
- **QZ Tray**: Brauzer uchun qo'shimcha qo'llab-quvvatlash
- Thermal printerlar (Xprinter, Epson, va h.k.) bilan ishlaydi
- Chek va senik (label) chop etish
- Kassa qutisini ochish

### Asosiy Interfeys va Tiplar:

```typescript
// Printer ma'lumotlari
export interface PrinterInfo {
  id: string;
  name: string;
  type: 'usb' | 'network' | 'serial' | 'system';
  vendorId?: number;
  productId?: number;
  host?: string;
  port?: number;
  isDefault?: boolean;
}

// Chek elementi
export interface ReceiptItem {
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  discount?: number;
}

// Chek ma'lumotlari
export interface ReceiptData {
  type: 'sale' | 'refund' | 'defectiveRefund';
  items: ReceiptItem[];
  total: number;
  discount?: number;
  paymentType: string;
  cashier?: string;
  date?: Date;
  receiptNumber?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

// Senik (label) ma'lumotlari
export interface LabelData {
  name: string;
  price: number;
  barcode?: string;
  barcodeType?: 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39' | 'UPC-A';
  sku?: string;
  stock?: number;
  quantity?: number;
  paperWidth?: number;
  paperHeight?: number;
  labelSize?: 'mini' | 'small' | 'medium' | 'large';
}

// Senik o'lchamlari
export const LABEL_SIZE_CONFIGS = {
  mini: { width: 20, height: 30 },
  small: { width: 40, height: 30 },
  medium: { width: 57, height: 30 },
  large: { width: 60, height: 40 }, // Default
};
```

### Asosiy Funksiyalar:

```typescript
// Printerlar ro'yxatini olish
export async function listPrinters(): Promise<PrinterInfo[]>

// USB printer ulash (WebUSB)
export async function requestUSBPrinter(): Promise<PrinterInfo | null>

// Chek chop etish
export async function printReceipt(
  printerId: string | null,
  receipt: ReceiptData
): Promise<boolean>

// Senik chop etish
export async function printLabel(
  printerId: string | null,
  label: LabelData
): Promise<boolean>

// Ko'p senik chop etish
export async function printLabels(
  printerId: string | null,
  labels: LabelData[]
): Promise<{ success: boolean; printed: number; errors: string[] }>

// Brauzer orqali senik chop etish (fallback)
export function printLabelViaBrowser(label: LabelData): boolean

// Ko'p senikni bitta dialog da chop etish
export function printBulkLabelsViaBrowser(labels: LabelData[]): boolean

// Kassa qutisini ochish
export async function openCashDrawer(printerId: string | null): Promise<boolean>

// Test chek chop etish
export async function printTestReceipt(printerId: string | null): Promise<boolean>

// Printer sozlamalari
export function getPrinterSettings(): PrinterSettings
export function savePrinterSettings(settings: Partial<PrinterSettings>): void
export function getDefaultPrinterId(): string | null
export function setDefaultPrinterId(printerId: string | null): void
export function getDefaultLabelPrinterId(): string | null
export function setDefaultLabelPrinterId(printerId: string | null): void
```

### ESC/POS Komandalar:

```typescript
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const ESCPOS = {
  INIT: [ESC, 0x40],           // Printerni boshlash
  CUT: [GS, 0x56, 0x00],       // To'liq kesish
  PARTIAL_CUT: [GS, 0x56, 0x01], // Qisman kesish
  FEED: [ESC, 0x64, 0x03],     // 3 qator surish
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_SIZE: [ESC, 0x21, 0x30],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA],
};
```

---

## 2. Barcode Scanner Hook (`client/hooks/useBarcodeScanner.ts`)

USB/HID/Laser barcode skanerlar bilan ishlash uchun React hook.

### Xususiyatlar:
- Global listener (input fokussiz ishlaydi)
- Enter tugmasi bilan skan tugallash
- Debounce va timeout
- Avtomatik uzun barcode qayta ishlash

### Kod:

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeSccannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;        // Default: 1
  debounceTime?: number;     // Default: 100ms
  scanTimeout?: number;      // Default: 1000ms
  enabled?: boolean;         // Default: true
  preventDefault?: boolean;  // Default: true
}

export function useBarcodeScanner({
  onScan,
  minLength = 1,
  debounceTime = 100,
  scanTimeout = 1000,
  enabled = true,
  preventDefault = true,
}: UseBarcodeSccannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const processBarcode = useCallback(() => {
    const barcode = bufferRef.current.trim();
    if (barcode.length >= minLength) {
      onScan(barcode);
    }
    clearBuffer();
  }, [onScan, minLength, clearBuffer]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Input da yozayotgan bo'lsa, scanner ishlamasin
      const activeElement = document.activeElement;
      const isInputFocused = 
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      if (isInputFocused) return;

      // Modifier keys - o'tkazib yuborish
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Enter yoki Tab - barcodeni qayta ishlash
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current.length >= minLength) {
          if (preventDefault) {
            e.preventDefault();
            e.stopPropagation();
          }
          processBarcode();
        } else {
          clearBuffer();
        }
        return;
      }

      // Faqat printable characters
      if (e.key.length !== 1) return;

      // Timeout bo'lsa, bufferni tozalash
      if (timeSinceLastKey > scanTimeout && bufferRef.current.length > 0) {
        clearBuffer();
      }

      // Belgini bufferga qo'shish
      bufferRef.current += e.key;

      // Timeout - agar Enter kelmasa
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        // Uzun barcode - avtomatik qayta ishlash
        if (bufferRef.current.length >= 8) {
          processBarcode();
        } else {
          clearBuffer();
        }
      }, scanTimeout);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, minLength, scanTimeout, preventDefault, processBarcode, clearBuffer]);

  return { clearBuffer };
}

export default useBarcodeScanner;
```

---

## 3. Foydalanish Misollari

### Chek Chop Etish:

```typescript
import { printReceipt, ReceiptData } from '@/lib/pos-print';

const handlePrintReceipt = async () => {
  const receipt: ReceiptData = {
    type: 'sale',
    items: [
      { name: 'Mahsulot 1', quantity: 2, price: 15000 },
      { name: 'Mahsulot 2', quantity: 1, price: 25000, discount: 10 },
    ],
    total: 52500,
    paymentType: 'Naqd',
    date: new Date(),
    receiptNumber: 'CHK-001',
    storeName: 'Do\'kon nomi',
    storeAddress: 'Manzil',
    storePhone: '+998 90 123 45 67',
    cashier: 'Kassir ismi',
  };

  const success = await printReceipt(selectedPrinter, receipt);
  if (success) {
    console.log('Chek chop etildi!');
  }
};
```

### Senik Chop Etish:

```typescript
import { printLabel, LabelData } from '@/lib/pos-print';

const handlePrintLabel = async () => {
  const label: LabelData = {
    name: 'Mahsulot nomi',
    price: 25000,
    sku: '12345',
    barcode: '12345', // yoki SKU ishlatiladi
    labelSize: 'large', // 60x40mm
  };

  const success = await printLabel(selectedPrinter, label);
  if (success) {
    console.log('Senik chop etildi!');
  }
};
```

### Ko'p Senik Chop Etish:

```typescript
import { printBulkLabelsViaBrowser, LabelData } from '@/lib/pos-print';

const handleBulkPrint = () => {
  const labels: LabelData[] = products.map(p => ({
    name: p.name,
    price: p.price,
    sku: p.sku,
    barcode: p.sku,
    paperWidth: 60,
    paperHeight: 40,
  }));

  printBulkLabelsViaBrowser(labels);
};
```

### Barcode Scanner:

```typescript
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

function KassaPage() {
  const handleBarcodeScan = (barcode: string) => {
    console.log('Skanlangan:', barcode);
    // Mahsulotni qidirish va kassaga qo'shish
    const product = findProductByBarcode(barcode);
    if (product) {
      addToCart(product);
    }
  };

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    minLength: 1,
    enabled: true,
  });

  return <div>Kassa sahifasi</div>;
}
```

---

## 4. Printer Tanlash UI

```tsx
import { useState, useEffect } from 'react';
import { 
  listPrinters, 
  requestUSBPrinter, 
  setDefaultPrinterId,
  setDefaultLabelPrinterId,
  PrinterInfo 
} from '@/lib/pos-print';

function PrinterSettings() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [receiptPrinter, setReceiptPrinter] = useState<string | null>(null);
  const [labelPrinter, setLabelPrinter] = useState<string | null>(null);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    const list = await listPrinters();
    setPrinters(list);
  };

  const handleAddUSBPrinter = async () => {
    const printer = await requestUSBPrinter();
    if (printer) {
      await loadPrinters();
    }
  };

  const handleSelectReceiptPrinter = (printerId: string) => {
    setReceiptPrinter(printerId);
    setDefaultPrinterId(printerId);
  };

  const handleSelectLabelPrinter = (printerId: string) => {
    setLabelPrinter(printerId);
    setDefaultLabelPrinterId(printerId);
  };

  return (
    <div>
      <h3>Printerlar</h3>
      <button onClick={handleAddUSBPrinter}>USB Printer Qo'shish</button>
      
      <h4>Chek Printer</h4>
      <select 
        value={receiptPrinter || ''} 
        onChange={(e) => handleSelectReceiptPrinter(e.target.value)}
      >
        <option value="">Tanlang...</option>
        {printers.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <h4>Senik Printer</h4>
      <select 
        value={labelPrinter || ''} 
        onChange={(e) => handleSelectLabelPrinter(e.target.value)}
      >
        <option value="">Tanlang...</option>
        {printers.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
```

---

## 5. Kerakli Kutubxonalar

```json
{
  "dependencies": {
    "jsbarcode": "^3.11.6"
  }
}
```

Brauzer print uchun JsBarcode CDN orqali yuklanadi:
```html
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
```

---

## 6. Muhim Eslatmalar

1. **WebUSB** faqat HTTPS yoki localhost da ishlaydi
2. **Barcode Scanner** Enter tugmasini yuborishi kerak
3. **Thermal Printer** ESC/POS protokolini qo'llab-quvvatlashi kerak
4. **Brauzer Print** fallback sifatida har doim ishlaydi
5. **Senik o'lchami** default 60x40mm, sozlash mumkin
6. **Printer sozlamalari** localStorage da saqlanadi

---

## 7. Xatolarni Bartaraf Etish

- **USB qurilma topilmadi**: Printerni qayta ulang va ruxsat bering
- **WebUSB qo'llab-quvvatlanmaydi**: Chrome yoki Edge brauzeridan foydalaning
- **Barcode skanlanmaydi**: Scanner Enter yuborishini tekshiring
- **Chop etilmaydi**: Brauzer print fallback ishlatiladi
