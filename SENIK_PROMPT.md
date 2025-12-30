# SENIK (ETIKETKA) CHIQARISH - TO'LIQ PROMPT

Menga kassada mahsulotlar uchun senik (etiketka/label) chop etish funksiyasini qo'shib ber. React + TypeScript + Tailwind CSS ishlatiladi.

## XUSUSIYATLAR:
1. Kassadagi har bir mahsulot yonida senik tugmasi (Tag icon)
2. Tugma bosilganda modal oyna - mahsulot nomi, kodi, narxi, qog'oz o'lchami, nechta senik
3. "Hammasidan senik" tugmasi - barcha mahsulotlar uchun bir vaqtda
4. Brauzer orqali chop etish (printer driver orqali)
5. JsBarcode kutubxonasi orqali barcode generatsiya
6. 4 ta tayyor qog'oz o'lchami: 20×30, 40×30, 57×30, 60×40 mm
7. Qo'lda o'lcham kiritish imkoniyati

## TO'LIQ KOD:

```tsx
// ============================================
// 1. TIPLAR VA KONSTANTALAR
// ============================================

type LabelSize = 'mini' | 'small' | 'medium' | 'large';

interface LabelSizeConfig {
  width: number;
  height: number;
}

const LABEL_SIZE_CONFIGS: Record<LabelSize, LabelSizeConfig> = {
  mini: { width: 20, height: 30 },
  small: { width: 40, height: 30 },
  medium: { width: 57, height: 30 },
  large: { width: 60, height: 40 },
};

interface LabelData {
  name: string;
  price: number;
  barcode?: string;
  sku?: string;
  paperWidth?: number;
  paperHeight?: number;
}

// ============================================
// 2. CHOP ETISH FUNKSIYALARI
// ============================================

function printLabelViaBrowser(label: LabelData): boolean {
  const paperWidth = label.paperWidth || 60;
  const paperHeight = label.paperHeight || 40;
  const nameFontSize = paperWidth >= 60 ? '12px' : paperWidth >= 50 ? '10px' : '9px';
  const priceFontSize = paperWidth >= 60 ? '16px' : paperWidth >= 50 ? '14px' : '12px';
  const barcodeValue = label.barcode || label.sku || '';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Senik - ${label.name}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        @page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: ${paperWidth}mm; height: ${paperHeight}mm; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; }
        .label { width: ${paperWidth}mm; height: ${paperHeight}mm; padding: 1.5mm 2mm; text-align: center; display: flex; flex-direction: column; justify-content: space-around; align-items: center; }
        .name { font-weight: bold; font-size: ${nameFontSize}; line-height: 1.2; max-width: 100%; word-wrap: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .price { font-size: ${priceFontSize}; font-weight: bold; margin: 1mm 0; }
        .barcode-container { width: 100%; display: flex; justify-content: center; flex: 1; align-items: center; }
        .barcode-container svg { max-width: 95%; height: auto; }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="name">${label.name}${label.sku ? ` [${label.sku}]` : ''}</div>
        <div class="price">${label.price}</div>
        ${barcodeValue ? `<div class="barcode-container"><svg id="barcode"></svg></div>` : ''}
      </div>
      ${barcodeValue ? `<script>try { JsBarcode("#barcode", "${barcodeValue}", { format: "CODE128", width: 3, height: 70, displayValue: true, fontSize: 16, margin: 5, font: "Arial", fontOptions: "bold" }); } catch(e) {}</script>` : ''}
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank', `width=${paperWidth * 4},height=${paperHeight * 4}`);
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); setTimeout(() => printWindow.close(), 500); }, 500);
    return true;
  }
  return false;
}

function printBulkLabelsViaBrowser(labels: LabelData[]): boolean {
  if (labels.length === 0) return false;
  const paperWidth = labels[0].paperWidth || 60;
  const paperHeight = labels[0].paperHeight || 40;
  const nameFontSize = paperWidth >= 60 ? '12px' : paperWidth >= 50 ? '10px' : '9px';
  const priceFontSize = paperWidth >= 60 ? '16px' : paperWidth >= 50 ? '14px' : '12px';
  
  const labelsHtml = labels.map((label, i) => {
    const barcodeValue = label.barcode || label.sku || '';
    return `
      <div class="label-page" ${i < labels.length - 1 ? 'style="page-break-after: always;"' : ''}>
        <div class="label">
          <div class="name">${label.name}${label.sku ? ` [${label.sku}]` : ''}</div>
          <div class="price">${label.price}</div>
          ${barcodeValue ? `<div class="barcode-container"><svg id="barcode-${i}"></svg></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  const barcodeScripts = labels.map((label, i) => {
    const barcodeValue = label.barcode || label.sku || '';
    return barcodeValue ? `try { JsBarcode("#barcode-${i}", "${barcodeValue}", { format: "CODE128", width: 3, height: 70, displayValue: true, fontSize: 16, margin: 5, font: "Arial", fontOptions: "bold" }); } catch(e) {}` : '';
  }).join('\n');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Seniklar (${labels.length} ta)</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        @page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; }
        .label-page { width: ${paperWidth}mm; height: ${paperHeight}mm; display: flex; justify-content: center; align-items: center; }
        .label { width: 100%; height: 100%; padding: 1.5mm 2mm; text-align: center; display: flex; flex-direction: column; justify-content: space-around; align-items: center; }
        .name { font-weight: bold; font-size: ${nameFontSize}; line-height: 1.2; max-width: 100%; word-wrap: break-word; }
        .price { font-size: ${priceFontSize}; font-weight: bold; margin: 1mm 0; }
        .barcode-container { width: 100%; display: flex; justify-content: center; flex: 1; align-items: center; }
        .barcode-container svg { max-width: 95%; height: auto; }
      </style>
    </head>
    <body>${labelsHtml}<script>${barcodeScripts}</script></body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank', `width=${paperWidth * 4},height=${paperHeight * 4}`);
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); setTimeout(() => printWindow.close(), 500); }, 500);
    return true;
  }
  return false;
}

// ============================================
// 3. KASSA KOMPONENTIDA ISHLATISH
// ============================================

// CartItem interfeysi (sizning loyihangizga moslashtiring)
interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  sku?: string;
  stock?: number;
  quantity: number;
}

// Kassa komponentida qo'shish kerak bo'lgan state lar:
const [labelDialogOpen, setLabelDialogOpen] = useState(false);
const [labelDialogItem, setLabelDialogItem] = useState<CartItem | null>(null);
const [labelQuantity, setLabelQuantity] = useState<number | null>(null);
const [labelSize, setLabelSize] = useState<LabelSize>('large');
const [customLabelWidth, setCustomLabelWidth] = useState(60);
const [customLabelHeight, setCustomLabelHeight] = useState(40);
const [useCustomSize, setUseCustomSize] = useState(false);
const [bulkLabelOpen, setBulkLabelOpen] = useState(false);
const [bulkLabelQuantities, setBulkLabelQuantities] = useState<Record<string, number>>({});
const [isPrinting, setIsPrinting] = useState(false);

// ============================================
// 4. MAHSULOT YONIDAGI SENIK TUGMASI
// ============================================

// Kassadagi mahsulotlar ro'yxatida, har bir mahsulot yoniga qo'shing:
<button 
  onClick={(e) => { 
    e.stopPropagation(); 
    setLabelDialogItem(item);
    setLabelQuantity(null);
    setLabelSize('large');
    setCustomLabelWidth(60);
    setCustomLabelHeight(40);
    setUseCustomSize(false);
    setLabelDialogOpen(true);
  }} 
  disabled={isPrinting}
  className="w-8 h-8 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 flex items-center justify-center transition-all disabled:opacity-50"
  title="Senik chop etish"
>
  <Tag className="w-4 h-4" />
</button>

// ============================================
// 5. "HAMMASIDAN SENIK" TUGMASI
// ============================================

// Kassadagi mahsulotlar ro'yxati ostiga qo'shing:
{checkItems.length > 0 && (
  <button
    onClick={() => {
      const quantities: Record<string, number> = {};
      checkItems.forEach(item => { quantities[item.id] = 1; });
      setBulkLabelQuantities(quantities);
      setBulkLabelOpen(true);
    }}
    className="py-2 px-3 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 text-sm font-bold flex items-center gap-2"
  >
    <Tag className="w-4 h-4" />
    Hammasidan senik
  </button>
)}

// ============================================
// 6. YAKKA SENIK DIALOG
// ============================================

<Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
  <DialogContent className="max-w-md bg-slate-900 border-slate-700 rounded-2xl">
    <DialogHeader>
      <DialogTitle className="text-white flex items-center gap-2">
        <Tag className="w-5 h-5 text-amber-400" />
        Senik chop etish
      </DialogTitle>
    </DialogHeader>
    {labelDialogItem && (
      <div className="space-y-4">
        {/* Mahsulot ma'lumotlari */}
        <div className="p-3 bg-slate-800 rounded-xl">
          <div className="font-bold text-white mb-1">{labelDialogItem.name}</div>
          <div className="flex justify-between text-sm">
            <span className="text-purple-400">Kod: {labelDialogItem.sku || '-'}</span>
            <span className="text-green-400 font-bold">${labelDialogItem.price}</span>
          </div>
        </div>

        {/* Qog'oz o'lchami */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-slate-400">Qog'oz o'lchami (mm)</label>
            <button
              onClick={() => setUseCustomSize(!useCustomSize)}
              className={`text-xs px-2 py-1 rounded ${useCustomSize ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}
            >
              {useCustomSize ? "Qo'lda" : 'Tayyor'}
            </button>
          </div>
          
          {useCustomSize ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="20"
                max="100"
                value={customLabelWidth}
                onChange={(e) => setCustomLabelWidth(Math.max(20, Math.min(100, parseInt(e.target.value) || 40)))}
                className="flex-1 h-10 text-center bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
              <span className="text-slate-500">×</span>
              <input
                type="number"
                min="15"
                max="100"
                value={customLabelHeight}
                onChange={(e) => setCustomLabelHeight(Math.max(15, Math.min(100, parseInt(e.target.value) || 30)))}
                className="flex-1 h-10 text-center bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(LABEL_SIZE_CONFIGS).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => { setLabelSize(key as LabelSize); setCustomLabelWidth(config.width); setCustomLabelHeight(config.height); }}
                  className={`p-2 rounded-lg border-2 ${customLabelWidth === config.width && customLabelHeight === config.height ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 text-slate-400'}`}
                >
                  <div className="text-xs font-bold">{config.width}×{config.height}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Soni */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400">Nechta senik?</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setLabelQuantity(Math.max(1, (labelQuantity || 0) - 1))} className="w-10 h-10 rounded-lg bg-slate-700 text-white text-xl font-bold">-</button>
            <input
              type="number"
              min="1"
              max="100"
              value={labelQuantity ?? ''}
              placeholder="Soni"
              onChange={(e) => {
                const val = e.target.value;
                setLabelQuantity(val === '' ? null : Math.min(100, Math.max(1, parseInt(val) || 1)));
              }}
              className="flex-1 h-10 text-center text-xl font-bold bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 placeholder:text-sm"
            />
            <button onClick={() => setLabelQuantity(Math.min(100, (labelQuantity || 0) + 1))} className="w-10 h-10 rounded-lg bg-slate-700 text-white text-xl font-bold">+</button>
          </div>
        </div>

        {/* Chop etish */}
        <button
          onClick={() => {
            if (!labelDialogItem || !labelQuantity) return;
            setIsPrinting(true);
            const shortId = labelDialogItem.productId.slice(-8).toUpperCase();
            const paperWidth = useCustomSize ? customLabelWidth : LABEL_SIZE_CONFIGS[labelSize].width;
            const paperHeight = useCustomSize ? customLabelHeight : LABEL_SIZE_CONFIGS[labelSize].height;
            
            for (let i = 0; i < labelQuantity; i++) {
              printLabelViaBrowser({ name: labelDialogItem.name, price: labelDialogItem.price, sku: labelDialogItem.sku, barcode: shortId, paperWidth, paperHeight });
            }
            setIsPrinting(false);
            setLabelDialogOpen(false);
          }}
          disabled={isPrinting || !labelQuantity}
          className="w-full h-12 bg-amber-600 hover:bg-amber-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
          {labelQuantity || 0} ta senik ({useCustomSize ? `${customLabelWidth}×${customLabelHeight}` : `${LABEL_SIZE_CONFIGS[labelSize].width}×${LABEL_SIZE_CONFIGS[labelSize].height}`}mm)
        </button>
      </div>
    )}
  </DialogContent>
</Dialog>

// ============================================
// 7. OMMAVIY SENIK DIALOG
// ============================================

<Dialog open={bulkLabelOpen} onOpenChange={setBulkLabelOpen}>
  <DialogContent className="max-w-lg bg-slate-900 border-slate-700 rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle className="text-white flex items-center gap-2">
        <Tag className="w-5 h-5 text-yellow-400" />
        Hammasidan senik
      </DialogTitle>
    </DialogHeader>
    
    {/* Qog'oz o'lchami */}
    <div className="py-3 border-b border-slate-700">
      <div className="flex gap-2 flex-wrap">
        {Object.entries(LABEL_SIZE_CONFIGS).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setLabelSize(key as LabelSize)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${labelSize === key ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-300'}`}
          >
            {config.width}×{config.height}
          </button>
        ))}
      </div>
    </div>
    
    {/* Mahsulotlar */}
    <div className="flex-1 overflow-y-auto space-y-2 py-4">
      {checkItems.map((item) => {
        const qty = bulkLabelQuantities[item.id] ?? 1;
        return (
          <div key={item.id} className="bg-slate-800 p-3 rounded-xl">
            <div className="flex justify-between mb-2">
              <div>
                <div className="text-sm font-bold text-white truncate">{item.name}</div>
                <div className="text-xs text-slate-400">Kod: {item.sku || '-'}</div>
              </div>
              <div className="text-green-400 font-bold">${item.price}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Nechta:</span>
              <button onClick={() => setBulkLabelQuantities(prev => ({...prev, [item.id]: Math.max(0, qty - 1)}))} className="w-7 h-7 rounded bg-slate-700 text-white font-bold text-sm">-</button>
              <input
                type="number"
                min="0"
                value={qty}
                onChange={(e) => setBulkLabelQuantities(prev => ({...prev, [item.id]: Math.max(0, parseInt(e.target.value) || 0)}))}
                className="w-14 h-7 text-center text-sm font-bold bg-slate-700 border border-slate-600 rounded text-yellow-400"
              />
              <button onClick={() => setBulkLabelQuantities(prev => ({...prev, [item.id]: qty + 1}))} className="w-7 h-7 rounded bg-slate-700 text-white font-bold text-sm">+</button>
            </div>
          </div>
        );
      })}
    </div>
    
    {/* Tugmalar */}
    <div className="flex gap-3 pt-3 border-t border-slate-700">
      <button onClick={() => setBulkLabelOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400">Bekor qilish</button>
      <button
        onClick={() => {
          const totalLabels = checkItems.reduce((sum, item) => sum + (bulkLabelQuantities[item.id] ?? 1), 0);
          if (totalLabels === 0) { alert("Kamida 1 ta senik tanlang"); return; }
          
          const paperWidth = LABEL_SIZE_CONFIGS[labelSize].width;
          const paperHeight = LABEL_SIZE_CONFIGS[labelSize].height;
          
          const labels: LabelData[] = [];
          checkItems.forEach(item => {
            const qty = bulkLabelQuantities[item.id] ?? 1;
            const shortId = item.productId.slice(-8).toUpperCase();
            for (let i = 0; i < qty; i++) {
              labels.push({ name: item.name, price: item.price, sku: item.sku, barcode: shortId, paperWidth, paperHeight });
            }
          });
          
          printBulkLabelsViaBrowser(labels);
          setBulkLabelOpen(false);
        }}
        className="flex-1 py-3 rounded-xl bg-yellow-500 text-black font-bold flex items-center justify-center gap-2"
      >
        <Printer className="w-4 h-4" />
        Chop etish ({checkItems.reduce((sum, item) => sum + (bulkLabelQuantities[item.id] ?? 1), 0)} ta)
      </button>
    </div>
  </DialogContent>
</Dialog>

// ============================================
// 8. KERAKLI IMPORTLAR
// ============================================

import { useState } from "react";
import { Tag, Printer, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// yoki shadcn/ui dan: import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```

## QISQACHA:

1. `printLabelViaBrowser` - yakka senik chop etish (yangi oyna ochib, JsBarcode bilan barcode generatsiya qilib, print dialog ochadi)
2. `printBulkLabelsViaBrowser` - ommaviy senik chop etish (har bir senik alohida sahifada, bitta print dialog)
3. State lar: `labelDialogOpen`, `labelDialogItem`, `labelQuantity`, `labelSize`, `customLabelWidth`, `customLabelHeight`, `useCustomSize`, `bulkLabelOpen`, `bulkLabelQuantities`, `isPrinting`
4. Mahsulot yonida Tag tugmasi - bosilganda yakka senik dialog ochiladi
5. "Hammasidan senik" tugmasi - bosilganda ommaviy senik dialog ochiladi
6. 4 ta tayyor qog'oz o'lchami + qo'lda kiritish imkoniyati
7. JsBarcode CDN orqali barcode generatsiya (CODE128 format)
