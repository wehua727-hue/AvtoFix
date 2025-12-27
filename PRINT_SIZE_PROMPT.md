# Chek va Etiketka O'lchamlari - Prompt

Bu prompt React + TypeScript loyihasiga chek (receipt) va etiketka (label/senik) qog'oz o'lchamlarini sozlash funksiyasini qo'shish uchun.

---

## 1. Qog'oz O'lchamlari Tizimlari

### Chek (Receipt) O'lchamlari:
```typescript
// Chek qog'oz kengligi (mm)
export type ReceiptPaperWidth = 58 | 80;

// 58mm - kichik thermal printer (mini POS)
// 80mm - standart thermal printer (kassa)
```

### Etiketka (Label/Senik) O'lchamlari:
```typescript
// Etiketka o'lchamlari - har qanday raqam
export type LabelPaperWidth = number;

// Standart o'lchamlar:
export type LabelSize = 'mini' | 'small' | 'medium' | 'large';

export const LABEL_SIZE_CONFIGS: Record<LabelSize, { width: number; height: number }> = {
  mini:   { width: 20, height: 30 },  // 20x30mm - juda kichik
  small:  { width: 40, height: 30 },  // 40x30mm - kichik
  medium: { width: 57, height: 30 },  // 57x30mm - o'rta
  large:  { width: 60, height: 40 },  // 60x40mm - katta (DEFAULT)
};

// Default qiymatlar
export const DEFAULT_LABEL_WIDTH = 60;   // mm
export const DEFAULT_LABEL_HEIGHT = 40;  // mm
```

---

## 2. Printer Sozlamalari Interfeysi

```typescript
// Har bir printer uchun alohida qog'oz o'lchamlari
export interface PrinterPaperSettings {
  width: number;   // mm
  height: number;  // mm
}

// Umumiy printer sozlamalari
export interface PrinterSettings {
  // Chek printer
  receiptPrinterId: string | null;
  receiptPaperWidth: ReceiptPaperWidth;  // 58 yoki 80
  
  // Senik/Label printer
  labelPrinterId: string | null;
  labelPaperWidth: number;   // mm (default: 60)
  labelHeight: number;       // mm (default: 40)
  
  // Har bir printer uchun alohida o'lchamlar
  printerPaperSettings: Record<string, PrinterPaperSettings>;
  
  // Umumiy sozlamalar
  autoCut: boolean;
  openCashDrawer: boolean;
}

// Default sozlamalar
const DEFAULT_SETTINGS: PrinterSettings = {
  receiptPrinterId: null,
  receiptPaperWidth: 80,
  labelPrinterId: null,
  labelPaperWidth: 60,
  labelHeight: 40,
  printerPaperSettings: {},
  autoCut: true,
  openCashDrawer: false,
};
```

---

## 3. O'lcham Sozlash Funksiyalari

```typescript
// ============================================
// CHEK O'LCHAMLARI
// ============================================

// Chek qog'oz kengligini olish
export function getReceiptPaperWidth(): ReceiptPaperWidth {
  return getPrinterSettings().receiptPaperWidth;
}

// Chek qog'oz kengligini saqlash
export function setReceiptPaperWidth(width: ReceiptPaperWidth): void {
  savePrinterSettings({ receiptPaperWidth: width });
}

// ============================================
// ETIKETKA O'LCHAMLARI (GLOBAL)
// ============================================

// Etiketka kengligini olish
export function getLabelPaperWidth(): number {
  return getPrinterSettings().labelPaperWidth;
}

// Etiketka kengligini saqlash
export function setLabelPaperWidth(width: number): void {
  savePrinterSettings({ labelPaperWidth: width });
}

// Etiketka balandligini olish
export function getLabelHeight(): number {
  return getPrinterSettings().labelHeight;
}

// Etiketka balandligini saqlash
export function setLabelHeight(height: number): void {
  savePrinterSettings({ labelHeight: height });
}

// ============================================
// HAR BIR PRINTER UCHUN ALOHIDA O'LCHAMLAR
// ============================================

// Printer uchun qog'oz o'lchamlarini olish
export function getPrinterPaperSettings(printerId: string): PrinterPaperSettings {
  const settings = getPrinterSettings();
  if (settings.printerPaperSettings[printerId]) {
    return settings.printerPaperSettings[printerId];
  }
  // Default qiymatlar
  return {
    width: settings.labelPaperWidth,
    height: settings.labelHeight,
  };
}

// Printer uchun qog'oz o'lchamlarini saqlash
export function setPrinterPaperSettings(
  printerId: string, 
  paperSettings: PrinterPaperSettings
): void {
  const settings = getPrinterSettings();
  const updatedPrinterSettings = {
    ...settings.printerPaperSettings,
    [printerId]: paperSettings,
  };
  savePrinterSettings({ printerPaperSettings: updatedPrinterSettings });
}

// ============================================
// STORAGE FUNKSIYALARI
// ============================================

export function getPrinterSettings(): PrinterSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  
  try {
    const saved = localStorage.getItem('pos_printer_settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  
  return DEFAULT_SETTINGS;
}

export function savePrinterSettings(settings: Partial<PrinterSettings>): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    const current = getPrinterSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem('pos_printer_settings', JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}
```

---

## 4. O'lcham Sozlash UI Komponenti

```tsx
import { useState, useEffect } from 'react';
import {
  getReceiptPaperWidth,
  setReceiptPaperWidth,
  getLabelPaperWidth,
  setLabelPaperWidth,
  getLabelHeight,
  setLabelHeight,
  getPrinterPaperSettings,
  setPrinterPaperSettings,
  LABEL_SIZE_CONFIGS,
  LabelSize,
} from '@/lib/pos-print';

function PaperSizeSettings() {
  // Chek o'lchami
  const [receiptWidth, setReceiptWidthState] = useState<58 | 80>(80);
  
  // Etiketka o'lchami
  const [labelWidth, setLabelWidthState] = useState(60);
  const [labelHeight, setLabelHeightState] = useState(40);
  const [selectedSize, setSelectedSize] = useState<LabelSize | 'custom'>('large');

  useEffect(() => {
    // Saqlangan qiymatlarni yuklash
    setReceiptWidthState(getReceiptPaperWidth());
    setLabelWidthState(getLabelPaperWidth());
    setLabelHeightState(getLabelHeight());
  }, []);

  // Chek o'lchamini o'zgartirish
  const handleReceiptWidthChange = (width: 58 | 80) => {
    setReceiptWidthState(width);
    setReceiptPaperWidth(width);
  };

  // Etiketka preset tanlash
  const handleLabelSizeSelect = (size: LabelSize | 'custom') => {
    setSelectedSize(size);
    if (size !== 'custom') {
      const config = LABEL_SIZE_CONFIGS[size];
      setLabelWidthState(config.width);
      setLabelHeightState(config.height);
      setLabelPaperWidth(config.width);
      setLabelHeight(config.height);
    }
  };

  // Custom o'lcham
  const handleCustomWidth = (width: number) => {
    setLabelWidthState(width);
    setLabelPaperWidth(width);
    setSelectedSize('custom');
  };

  const handleCustomHeight = (height: number) => {
    setLabelHeightState(height);
    setLabelHeight(height);
    setSelectedSize('custom');
  };

  return (
    <div className="space-y-6">
      {/* CHEK O'LCHAMI */}
      <div>
        <h3 className="font-bold mb-2">Chek Qog'oz Kengligi</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleReceiptWidthChange(58)}
            className={`px-4 py-2 rounded ${
              receiptWidth === 58 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200'
            }`}
          >
            58mm (Mini)
          </button>
          <button
            onClick={() => handleReceiptWidthChange(80)}
            className={`px-4 py-2 rounded ${
              receiptWidth === 80 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200'
            }`}
          >
            80mm (Standart)
          </button>
        </div>
      </div>

      {/* ETIKETKA O'LCHAMI */}
      <div>
        <h3 className="font-bold mb-2">Etiketka O'lchami</h3>
        
        {/* Preset tugmalar */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(LABEL_SIZE_CONFIGS) as LabelSize[]).map((size) => {
            const config = LABEL_SIZE_CONFIGS[size];
            return (
              <button
                key={size}
                onClick={() => handleLabelSizeSelect(size)}
                className={`px-3 py-2 rounded text-sm ${
                  selectedSize === size 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200'
                }`}
              >
                {size === 'mini' && 'Mini'}
                {size === 'small' && 'Kichik'}
                {size === 'medium' && "O'rta"}
                {size === 'large' && 'Katta'}
                <span className="block text-xs opacity-70">
                  {config.width}x{config.height}mm
                </span>
              </button>
            );
          })}
          <button
            onClick={() => handleLabelSizeSelect('custom')}
            className={`px-3 py-2 rounded text-sm ${
              selectedSize === 'custom' 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-200'
            }`}
          >
            Boshqa
            <span className="block text-xs opacity-70">
              {labelWidth}x{labelHeight}mm
            </span>
          </button>
        </div>

        {/* Custom o'lcham inputlari */}
        {selectedSize === 'custom' && (
          <div className="flex gap-4">
            <div>
              <label className="block text-sm mb-1">Kenglik (mm)</label>
              <input
                type="number"
                value={labelWidth}
                onChange={(e) => handleCustomWidth(Number(e.target.value))}
                className="w-24 px-3 py-2 border rounded"
                min={10}
                max={200}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Balandlik (mm)</label>
              <input
                type="number"
                value={labelHeight}
                onChange={(e) => handleCustomHeight(Number(e.target.value))}
                className="w-24 px-3 py-2 border rounded"
                min={10}
                max={200}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hozirgi o'lcham */}
      <div className="p-4 bg-gray-100 rounded">
        <p className="text-sm">
          <strong>Chek:</strong> {receiptWidth}mm kenglik
        </p>
        <p className="text-sm">
          <strong>Etiketka:</strong> {labelWidth}x{labelHeight}mm
        </p>
      </div>
    </div>
  );
}

export default PaperSizeSettings;
```

---

## 5. Chop Etishda O'lchamni Ishlatish

### Chek Chop Etish (Brauzer):

```typescript
export function printViaBrowser(receipt: ReceiptData): boolean {
  const paperWidth = getReceiptPaperWidth(); // 58 yoki 80
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page {
          size: ${paperWidth}mm auto;
          margin: 3mm;
        }
        body {
          max-width: ${paperWidth}mm;
          font-size: ${paperWidth === 58 ? '10px' : '11px'};
        }
      </style>
    </head>
    <body>
      <!-- Chek kontenti -->
    </body>
    </html>
  `;
  
  // ... chop etish
}
```

### Etiketka Chop Etish (Brauzer):

```typescript
export function printLabelViaBrowser(label: LabelData): boolean {
  // O'lchamni aniqlash: label > settings > default
  const paperWidth = label.paperWidth || getLabelPaperWidth() || 60;
  const paperHeight = label.paperHeight || getLabelHeight() || 40;
  
  // Font o'lchamlari - qog'oz o'lchamiga qarab
  const nameFontSize = paperWidth >= 60 ? '12px' : paperWidth >= 50 ? '10px' : '9px';
  const priceFontSize = paperWidth >= 60 ? '16px' : paperWidth >= 50 ? '14px' : '12px';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page {
          size: ${paperWidth}mm ${paperHeight}mm;
          margin: 0;
        }
        html, body {
          width: ${paperWidth}mm;
          height: ${paperHeight}mm;
        }
        .label {
          width: ${paperWidth}mm;
          height: ${paperHeight}mm;
          padding: 1.5mm 2mm;
        }
        .name { font-size: ${nameFontSize}; }
        .price { font-size: ${priceFontSize}; }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="name">${label.name}</div>
        <div class="price">${label.price}</div>
      </div>
    </body>
    </html>
  `;
  
  // ... chop etish
}
```

---

## 6. ESC/POS da O'lchamni Ishlatish

```typescript
function buildLabelData(label: LabelData): Uint8Array {
  const paperWidth = label.paperWidth || getLabelPaperWidth() || 60;
  const paperHeight = label.paperHeight || getLabelHeight() || 40;
  
  // Qog'oz kengligiga qarab maksimal belgilar soni
  const maxChars: Record<number, number> = {
    30: 16,
    40: 20,
    50: 26,
    60: 32,
    80: 42,
  };
  const maxNameLength = maxChars[paperWidth] || Math.floor(paperWidth / 2);
  
  // Qator oralig'i - kichik qog'oz uchun kamroq
  const lineSpacing = paperHeight <= 30 ? 16 : 20;
  
  // Font o'lchami - katta qog'oz uchun kattaroq
  const isLarge = paperWidth >= 50;
  
  // ... ESC/POS komandalar
}
```

---

## 7. Mashhur Etiketka O'lchamlari

| Nom | O'lcham (mm) | Ishlatilishi |
|-----|-------------|--------------|
| Mini | 20x30 | Kichik mahsulotlar, zargarlik |
| Kichik | 40x30 | Oziq-ovqat, kiyim |
| O'rta | 57x30 | Umumiy maqsad |
| Katta | 60x40 | Standart, barcode bilan |
| Juda katta | 80x50 | Quti, katta mahsulotlar |
| Uzun | 100x30 | Polka etiketkalari |

---

## 8. Muhim Eslatmalar

1. **localStorage** da saqlanadi - brauzer yopilsa ham saqlanib qoladi
2. **Har bir printer** o'z o'lchamini eslab qolishi mumkin
3. **Default o'lcham**: Chek 80mm, Etiketka 60x40mm
4. **@page CSS** - brauzer print uchun qog'oz o'lchamini belgilaydi
5. **ESC/POS** - thermal printer uchun font va spacing sozlanadi
