/**
 * POS Print Service
 * 
 * Supports:
 * - Electron: Direct ESC/POS printing via IPC
 * - Web: WebUSB API with fallback to browser print
 * 
 * Compatible with thermal printers, label printers, and ESC/POS devices
 */

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const ESCPOS = {
  INIT: [ESC, 0x40], // Initialize printer
  CUT: [GS, 0x56, 0x00], // Full cut
  PARTIAL_CUT: [GS, 0x56, 0x01], // Partial cut
  FEED: [ESC, 0x64, 0x03], // Feed 3 lines
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_SIZE: [ESC, 0x21, 0x30],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  UNDERLINE_ON: [ESC, 0x2D, 0x01],
  UNDERLINE_OFF: [ESC, 0x2D, 0x00],
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA], // Open cash drawer
};

// Printer info interface
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

// Receipt item interface
export interface ReceiptItem {
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  discount?: number;
}

// Receipt data interface
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

// Check if running in Electron
const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
};

// Get Electron API
const getElectronAPI = () => {
  if (isElectron()) {
    return (window as any).electronAPI;
  }
  return null;
};

/**
 * List all available printers
 */
export async function listPrinters(): Promise<PrinterInfo[]> {
  const printers: PrinterInfo[] = [];

  // Try Electron first
  const electronAPI = getElectronAPI();
  if (electronAPI?.printerList) {
    try {
      const result = await electronAPI.printerList();
      if (result.printers) {
        printers.push(...result.printers);
      }
    } catch (e) {
      console.error('[POSPrint] Electron printer list error:', e);
    }
  }

  // Try QZ Tray (brauzer uchun)
  if (!isElectron()) {
    try {
      const { getQZPrinters, isQZConnected, connectQZ } = await import('./qz-tray');
      await connectQZ();
      if (isQZConnected()) {
        const qzPrinters = await getQZPrinters();
        console.log('[POSPrint] QZ Tray printers:', qzPrinters);
        for (const name of qzPrinters) {
          printers.push({
            id: `qz:${name}`,
            name: `${name} (QZ Tray)`,
            type: 'system',
          });
        }
      }
    } catch (e) {
      console.log('[POSPrint] QZ Tray not available:', e);
    }
  }

  // Try WebUSB - oldindan ruxsat berilgan qurilmalar
  if ('usb' in navigator) {
    try {
      const devices = await (navigator as any).usb.getDevices();
      console.log('[POSPrint] WebUSB devices found:', devices.length);
      for (const device of devices) {
        console.log('[POSPrint] Device:', device.productName, device.vendorId, device.productId);
        printers.push({
          id: `usb:${device.vendorId}:${device.productId}`,
          name: device.productName || `USB Qurilma (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
          type: 'usb',
          vendorId: device.vendorId,
          productId: device.productId,
        });
      }
    } catch (e) {
      console.log('[POSPrint] WebUSB not available or no devices:', e);
    }
  }

  // Agar hech qanday printer topilmasa, brauzer print qo'shish
  if (printers.length === 0) {
    printers.push({
      id: 'browser-print',
      name: 'Brauzer orqali chop etish',
      type: 'system',
      isDefault: true,
    });
  }

  return printers;
}

/**
 * Request USB printer access (WebUSB)
 * Barcha USB qurilmalarni ko'rsatadi - foydalanuvchi tanlaydi
 */
export async function requestUSBPrinter(): Promise<PrinterInfo | null> {
  if (!('usb' in navigator)) {
    console.error('[POSPrint] WebUSB not supported in this browser');
    alert('WebUSB bu brauzerda qo\'llab-quvvatlanmaydi. Chrome yoki Edge brauzeridan foydalaning.');
    return null;
  }

  try {
    // Barcha USB qurilmalarni ko'rsatish (filtersiz)
    // Bu foydalanuvchiga barcha ulangan USB qurilmalarni ko'rsatadi
    const device = await (navigator as any).usb.requestDevice({ 
      filters: [] // Bo'sh filter - barcha USB qurilmalar ko'rsatiladi
    });
    
    console.log('[POSPrint] Selected device:', device.productName, device.vendorId, device.productId);
    
    return {
      id: `usb:${device.vendorId}:${device.productId}`,
      name: device.productName || `USB Qurilma (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
      type: 'usb',
      vendorId: device.vendorId,
      productId: device.productId,
    };
  } catch (e: any) {
    if (e.name === 'NotFoundError') {
      console.log('[POSPrint] User cancelled device selection');
    } else {
      console.error('[POSPrint] USB request error:', e);
      alert('USB qurilmani ulashda xatolik: ' + e.message);
    }
    return null;
  }
}

/**
 * Build ESC/POS receipt data
 */
function buildReceiptData(receipt: ReceiptData): Uint8Array {
  const encoder = new TextEncoder();
  const parts: number[] = [];

  // Helper to add bytes
  const addBytes = (bytes: number[]) => parts.push(...bytes);
  const addText = (text: string) => {
    // Convert to CP866 or use UTF-8 for Cyrillic support
    const bytes = encoder.encode(text);
    parts.push(...bytes);
  };
  const addLine = (text: string) => {
    addText(text);
    addBytes([LF]);
  };

  // Initialize
  addBytes(ESCPOS.INIT);

  // AvtoFix Logo - Simple & Clean
  addBytes(ESCPOS.ALIGN_CENTER);
  addBytes(ESCPOS.BOLD_ON);
  addLine('');
  addLine('╔════════════════════════════════════╗');
  addLine('║                                  ║');
  addLine('║    🚛 AVTOFIX 🔧              ║');
  addLine('║                                  ║');
  addLine('║    Avtoehtiyot qismlari           ║');
  addLine('║      do\'koni tarmog\'i              ║');
  addLine('║                                  ║');
  addLine('╚════════════════════════════════════╝');
  addLine('');
  addBytes(ESCPOS.BOLD_OFF);

  // Store name
  addBytes(ESCPOS.BOLD_ON);
  addBytes(ESCPOS.DOUBLE_SIZE);
  
  if (receipt.storeName) {
    addLine(receipt.storeName);
  }
  
  addBytes(ESCPOS.NORMAL_SIZE);
  addBytes(ESCPOS.BOLD_OFF);
  
  if (receipt.storeAddress) {
    addLine(receipt.storeAddress);
  }
  if (receipt.storePhone) {
    addLine(`Tel: ${receipt.storePhone}`);
  }

  // Separator
  addLine('--------------------------------');

  // Receipt type
  addBytes(ESCPOS.BOLD_ON);
  const typeText = receipt.type === 'defectiveRefund' ? 'YAROQSIZ QAYTARISH' : receipt.type === 'refund' ? 'QAYTARISH' : 'CHEK';
  addLine(typeText);
  addBytes(ESCPOS.BOLD_OFF);

  // Date and receipt number
  const date = receipt.date || new Date();
  addLine(date.toLocaleString('ru-RU'));
  if (receipt.receiptNumber) {
    addLine(`Chek #${receipt.receiptNumber}`);
  }
  if (receipt.cashier) {
    addLine(`Kassir: ${receipt.cashier}`);
  }

  addLine('--------------------------------');

  // Items header - REGOS style
  addBytes(ESCPOS.ALIGN_LEFT);
  addBytes(ESCPOS.BOLD_ON);
  addLine('# Mahsulot          Soni   Summa');
  addBytes(ESCPOS.BOLD_OFF);
  addLine('--------------------------------');
  
  for (let i = 0; i < receipt.items.length; i++) {
    const item = receipt.items[i];
    const itemTotal = item.quantity * item.price;
    const discountAmount = item.discount ? (itemTotal * item.discount) / 100 : 0;
    const finalTotal = itemTotal - discountAmount;

    // Tartib raqami + Item name (truncate if too long)
    const num = String(i + 1).padStart(2, ' ');
    const name = item.name.length > 20 ? item.name.substring(0, 20) : item.name;
    addLine(`${num} ${name}`);
    
    // Quantity x Price = Total
    const qtyPrice = `   ${item.quantity} x ${item.price.toLocaleString()}`;
    const totalStr = finalTotal.toLocaleString();
    const spaces = 32 - qtyPrice.length - totalStr.length;
    addLine(qtyPrice + ' '.repeat(Math.max(1, spaces)) + totalStr);
    
    if (item.discount && item.discount > 0) {
      addLine(`   Chegirma: -${item.discount}%`);
    }
  }

  addLine('--------------------------------');

  // Total
  addBytes(ESCPOS.ALIGN_RIGHT);
  addBytes(ESCPOS.BOLD_ON);
  addBytes(ESCPOS.DOUBLE_HEIGHT);
  
  const totalLabel = receipt.type === 'refund' ? 'QAYTARISH:' : 'JAMI:';
  const totalValue = `${receipt.type === 'refund' ? '-' : ''}$${receipt.total.toLocaleString()}`;
  addLine(`${totalLabel} ${totalValue}`);
  
  addBytes(ESCPOS.NORMAL_SIZE);
  addBytes(ESCPOS.BOLD_OFF);

  // Payment type
  addBytes(ESCPOS.ALIGN_CENTER);
  addLine(`To'lov: ${receipt.paymentType}`);

  // Footer
  addLine('--------------------------------');
  addBytes(ESCPOS.ALIGN_CENTER);
  addLine('Xaridingiz uchun rahmat!');
  addLine('');
  addLine('AVTOFIX - Ishonchli hamkor 🔧');
  addLine('Sifatli ehtiyot qismlar');
  addLine('Tez va qulay xizmat');
  addLine('');

  // Feed and cut
  addBytes(ESCPOS.FEED);
  addBytes(ESCPOS.PARTIAL_CUT);

  return new Uint8Array(parts);
}

/**
 * Print via WebUSB
 * Xprinter va boshqa thermal printerlar uchun optimallashtirilgan
 */
async function printViaWebUSB(printerId: string, data: Uint8Array): Promise<boolean> {
  if (!('usb' in navigator)) {
    throw new Error('WebUSB bu brauzerda qo\'llab-quvvatlanmaydi. Chrome yoki Edge ishlatng.');
  }

  const [, vendorIdStr, productIdStr] = printerId.split(':');
  const vendorId = parseInt(vendorIdStr, 10);
  const productId = parseInt(productIdStr, 10);
  
  console.log('[POSPrint] Looking for USB device:', { vendorId, productId });
  
  const devices = await (navigator as any).usb.getDevices();
  console.log('[POSPrint] Available USB devices:', devices.length);
  
  const device = devices.find(
    (d: any) => d.vendorId === vendorId && d.productId === productId
  );

  if (!device) {
    console.error('[POSPrint] Device not found. Available devices:', devices.map((d: any) => ({
      name: d.productName,
      vendorId: d.vendorId,
      productId: d.productId
    })));
    throw new Error('Printer topilmadi. Iltimos, printerni qayta ulang va ruxsat bering.');
  }

  console.log('[POSPrint] Found device:', device.productName);

  try {
    await device.open();
    console.log('[POSPrint] Device opened');
    
    if (device.configuration === null) {
      await device.selectConfiguration(1);
      console.log('[POSPrint] Configuration selected');
    }
    
    // Barcha interfeyslarni ko'rish
    const interfaces = device.configuration?.interfaces || [];
    console.log('[POSPrint] Available interfaces:', interfaces.length);
    
    // Avval printer class (7) ni qidirish, keyin boshqa interfeyslarni sinash
    let iface = interfaces.find(
      (i: any) => i.alternates?.some((a: any) => a.interfaceClass === 7)
    );
    
    // Agar printer class topilmasa, birinchi interfeysni ishlatish
    if (!iface && interfaces.length > 0) {
      iface = interfaces[0];
      console.log('[POSPrint] Using first interface (no printer class found)');
    }
    
    if (!iface) {
      throw new Error('Printer interfeysi topilmadi');
    }

    console.log('[POSPrint] Using interface:', iface.interfaceNumber);
    await device.claimInterface(iface.interfaceNumber);
    console.log('[POSPrint] Interface claimed');

    // OUT endpoint ni qidirish
    const alternates = iface.alternates || [];
    let endpoint = null;
    
    for (const alt of alternates) {
      const eps = alt.endpoints || [];
      endpoint = eps.find((e: any) => e.direction === 'out');
      if (endpoint) break;
    }

    if (!endpoint) {
      // Agar endpoint topilmasa, control transfer ishlatish
      console.log('[POSPrint] No OUT endpoint found, trying control transfer');
      await device.controlTransferOut({
        requestType: 'class',
        recipient: 'interface',
        request: 0x09, // SET_REPORT
        value: 0x0200,
        index: iface.interfaceNumber
      }, data);
    } else {
      console.log('[POSPrint] Using endpoint:', endpoint.endpointNumber);
      // Ma'lumotni yuborish
      await device.transferOut(endpoint.endpointNumber, data);
    }
    
    console.log('[POSPrint] Data sent successfully, size:', data.length, 'bytes');
    
    await device.releaseInterface(iface.interfaceNumber);
    await device.close();
    console.log('[POSPrint] Device closed');

    return true;
  } catch (e: any) {
    console.error('[POSPrint] WebUSB print error:', e);
    try {
      await device.close();
    } catch {}
    throw new Error('Chop etishda xatolik: ' + (e.message || 'Noma\'lum xato'));
  }
}

/**
 * Print receipt
 */
export async function printReceipt(
  printerId: string | null,
  receipt: ReceiptData
): Promise<boolean> {
  // Try Electron first
  const electronAPI = getElectronAPI();
  if (electronAPI?.printerPrintReceipt && printerId) {
    try {
      const result = await electronAPI.printerPrintReceipt(printerId, receipt);
      if (result.success) {
        return true;
      }
      console.warn('[POSPrint] Electron print failed:', result.error);
    } catch (e) {
      console.error('[POSPrint] Electron print error:', e);
    }
  }

  // Try QZ Tray
  if (printerId?.startsWith('qz:')) {
    try {
      const printerName = printerId.replace('qz:', '');
      const { printReceiptQZ } = await import('./qz-tray');
      return await printReceiptQZ(printerName, receipt);
    } catch (e) {
      console.error('[POSPrint] QZ Tray print error:', e);
    }
  }

  // Try WebUSB
  if (printerId?.startsWith('usb:')) {
    try {
      const data = buildReceiptData(receipt);
      return await printViaWebUSB(printerId, data);
    } catch (e) {
      console.error('[POSPrint] WebUSB print error:', e);
    }
  }

  // Fallback to browser print
  return printViaBrowser(receipt);
}

/**
 * Fallback: Print via browser
 * Yaxshilangan dizayn - matn sig'may qolsa keyingi qatorga tushadi
 */
export function printViaBrowser(receipt: ReceiptData): boolean {
  const isRefund = receipt.type === 'refund' || receipt.type === 'defectiveRefund';
  const isDefectiveRefund = receipt.type === 'defectiveRefund';
  
  const itemsHtml = receipt.items
    .map((item, index) => {
      const itemTotal = item.quantity * item.price;
      const discountAmount = item.discount ? (itemTotal * item.discount) / 100 : 0;
      const finalTotal = itemTotal - discountAmount;
      const num = index + 1;
      const skuDisplay = item.sku ? `[${item.sku}] ` : '';
      return `
        <div class="item">
          <div class="item-header">
            <span class="item-num">${num}.</span>
            <span class="item-name">${skuDisplay}${item.name}</span>
          </div>
          <div class="item-details">
            <span class="item-qty">${item.quantity} x ${item.price.toLocaleString()}</span>
            <span class="item-price">${finalTotal.toLocaleString()}</span>
          </div>
          ${item.discount ? `<div class="item-discount">Chegirma: -${item.discount}%</div>` : ''}
        </div>
      `;
    })
    .join('');

  const date = receipt.date || new Date();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${isDefectiveRefund ? 'YAROQSIZ QAYTARISH' : isRefund ? 'QAYTARISH' : 'CHEK'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          padding: 8mm;
          max-width: 80mm;
          margin: 0 auto;
          font-size: 11px;
          line-height: 1.3;
        }
        .header {
          text-align: center;
          margin-bottom: 8px;
          font-weight: bold;
          font-size: 14px;
        }
        .logo {
          text-align: center;
          margin-bottom: 12px;
          font-weight: bold;
          font-size: 16px;
          border: 3px double #000;
          padding: 10px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .logo-title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 3px;
          color: #2c3e50;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }
        .logo-subtitle {
          font-size: 11px;
          font-weight: normal;
          color: #34495e;
          font-style: italic;
        }
        .store-info {
          text-align: center;
          margin-bottom: 8px;
          font-size: 11px;
          color: #000;
          font-weight: bold;
        }
        .separator {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .type {
          text-align: center;
          font-weight: bold;
          font-size: 14px;
          margin: 4px 0;
        }
        .meta {
          text-align: center;
          font-size: 11px;
          margin-bottom: 8px;
          color: #000;
          font-weight: bold;
        }
        
        /* Mahsulotlar ro'yxati */
        .items-list {
          margin: 8px 0;
        }
        .item {
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 1px dotted #ccc;
        }
        .item:last-child {
          border-bottom: none;
        }
        .item-header {
          display: flex;
          gap: 4px;
          font-weight: bold;
        }
        .item-num {
          font-weight: bold;
          flex-shrink: 0;
        }
        .item-name {
          font-weight: bold;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .item-details {
          display: flex;
          justify-content: space-between;
          margin-top: 2px;
          padding-left: 16px;
          font-size: 11px;
          font-weight: bold;
        }
        .item-qty {
          color: #000;
          font-weight: bold;
        }
        .item-price {
          font-weight: bold;
        }
        .item-discount {
          font-size: 10px;
          color: #333;
          padding-left: 16px;
          font-weight: bold;
        }
        
        .total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 14px;
          margin: 8px 0;
          padding: 4px 0;
        }
        .refund { color: red; }
        .payment {
          text-align: center;
          font-size: 12px;
          margin: 6px 0;
          padding: 4px;
          background: #f5f5f5;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 10px;
          font-size: 11px;
          color: #000;
          font-weight: bold;
        }
        .footer-brand {
          margin-top: 8px;
          padding: 6px;
          background: #f8f9fa;
          border-radius: 4px;
          font-size: 10px;
          color: #495057;
        }
        @media print {
          body { padding: 2mm; }
          @page { margin: 3mm; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <!-- AvtoFix Logo -->
      <div class="logo">
        <div class="logo-title">🚛 AVTOFIX 🔧</div>
        <div class="logo-subtitle">Avtoehtiyot qismlari do'koni tarmog'i</div>
      </div>
      
      ${receipt.storeName ? `<div class="header">${receipt.storeName}</div>` : ''}
      ${receipt.storeAddress || receipt.storePhone ? `
        <div class="store-info">
          ${receipt.storeAddress ? receipt.storeAddress + '<br>' : ''}
          ${receipt.storePhone ? `Tel: ${receipt.storePhone}` : ''}
        </div>
      ` : ''}
      <div class="separator"></div>
      <div class="type ${isRefund ? 'refund' : ''}">${isDefectiveRefund ? 'YAROQSIZ QAYTARISH' : isRefund ? 'QAYTARISH' : 'SOTUV CHEKI'}</div>
      <div class="meta">
        ${date.toLocaleString('ru-RU')}<br>
        ${receipt.receiptNumber ? `#${receipt.receiptNumber}` : ''}
        ${receipt.cashier ? ` • ${receipt.cashier}` : ''}
      </div>
      <div class="separator"></div>
      <div class="items-list">
        ${itemsHtml}
      </div>
      <div class="separator"></div>
      <div class="total ${isRefund ? 'refund' : ''}">
        <span>${isDefectiveRefund ? 'YAROQSIZ:' : isRefund ? 'QAYTARISH:' : 'JAMI:'}</span>
        <span>${isRefund ? '-' : ''}$${receipt.total.toLocaleString()}</span>
      </div>
      <div class="payment">To'lov: ${receipt.paymentType}</div>
      <div class="separator"></div>
      <div class="footer">
        Xaridingiz uchun rahmat!
        <div class="footer-brand">
          AVTOFIX - Ishonchli hamkor 🔧<br>
          Sifatli ehtiyot qismlar • Tez va qulay xizmat
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    // Don't close immediately - let user see the print dialog
    setTimeout(() => printWindow.close(), 1000);
    return true;
  }
  
  return false;
}

/**
 * Open cash drawer
 */
export async function openCashDrawer(printerId: string | null): Promise<boolean> {
  // Try Electron first
  const electronAPI = getElectronAPI();
  if (electronAPI?.printerOpenDrawer && printerId) {
    try {
      const result = await electronAPI.printerOpenDrawer(printerId);
      return result.success;
    } catch (e) {
      console.error('[POSPrint] Electron drawer error:', e);
    }
  }

  // Try WebUSB
  if (printerId?.startsWith('usb:')) {
    try {
      const data = new Uint8Array(ESCPOS.OPEN_DRAWER);
      return await printViaWebUSB(printerId, data);
    } catch (e) {
      console.error('[POSPrint] WebUSB drawer error:', e);
    }
  }

  return false;
}

/**
 * Print test receipt
 */
export async function printTestReceipt(printerId: string | null): Promise<boolean> {
  const testReceipt: ReceiptData = {
    type: 'sale',
    items: [
      { name: 'Test mahsulot 1', sku: 'TST001', quantity: 2, price: 15000 },
      { name: 'Test mahsulot 2', sku: 'TST002', quantity: 1, price: 25000, discount: 10 },
    ],
    total: 52500,
    paymentType: 'Naqd',
    date: new Date(),
    receiptNumber: 'TEST-001',
    storeName: '🚛 AVTOFIX - Avtoehtiyot qismlari do\'koni',
    storeAddress: 'Test manzil, Toshkent',
    storePhone: '+998 90 123 45 67',
    cashier: 'Test Kassir',
  };

  return printReceipt(printerId, testReceipt);
}

// ============================================
// PRINTER SETTINGS
// ============================================

// Paper sizes for receipts (mm)
export type ReceiptPaperWidth = 58 | 80;

// Paper sizes for labels (mm) - har qanday raqam qabul qilinadi
export type LabelPaperWidth = number;

// Har bir printer uchun alohida qog'oz o'lchamlari
export interface PrinterPaperSettings {
  width: number;
  height: number;
}

// Printer settings interface
export interface PrinterSettings {
  // Chek printer
  receiptPrinterId: string | null;
  receiptPaperWidth: ReceiptPaperWidth;
  
  // Senik/Label printer
  labelPrinterId: string | null;
  labelPaperWidth: LabelPaperWidth;
  labelHeight: number; // mm
  
  // Har bir printer uchun alohida qog'oz o'lchamlari (printerId -> {width, height})
  printerPaperSettings: Record<string, PrinterPaperSettings>;
  
  // Umumiy sozlamalar
  autoCut: boolean;
  openCashDrawer: boolean;
}

// Default settings - senik 60x40mm
const DEFAULT_SETTINGS: PrinterSettings = {
  receiptPrinterId: null,
  receiptPaperWidth: 80,
  labelPrinterId: null,
  labelPaperWidth: 60,  // Default: 60mm
  labelHeight: 40,      // Default: 40mm
  printerPaperSettings: {},
  autoCut: true,
  openCashDrawer: false,
};

/**
 * Get all printer settings from storage
 */
export function getPrinterSettings(): PrinterSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  
  try {
    const saved = localStorage.getItem('pos_printer_settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('[POSPrint] Failed to load settings:', e);
  }
  
  return DEFAULT_SETTINGS;
}

/**
 * Save printer settings to storage
 */
export function savePrinterSettings(settings: Partial<PrinterSettings>): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    const current = getPrinterSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem('pos_printer_settings', JSON.stringify(updated));
  } catch (e) {
    console.error('[POSPrint] Failed to save settings:', e);
  }
}

/**
 * Get default receipt printer ID from storage
 */
export function getDefaultPrinterId(): string | null {
  return getPrinterSettings().receiptPrinterId;
}

/**
 * Set default receipt printer ID
 */
export function setDefaultPrinterId(printerId: string | null): void {
  savePrinterSettings({ receiptPrinterId: printerId });
}

/**
 * Get default label printer ID from storage
 */
export function getDefaultLabelPrinterId(): string | null {
  return getPrinterSettings().labelPrinterId;
}

/**
 * Set default label printer ID
 */
export function setDefaultLabelPrinterId(printerId: string | null): void {
  savePrinterSettings({ labelPrinterId: printerId });
}

/**
 * Get receipt paper width
 */
export function getReceiptPaperWidth(): ReceiptPaperWidth {
  return getPrinterSettings().receiptPaperWidth;
}

/**
 * Set receipt paper width
 */
export function setReceiptPaperWidth(width: ReceiptPaperWidth): void {
  savePrinterSettings({ receiptPaperWidth: width });
}

/**
 * Get label paper width (global default)
 */
export function getLabelPaperWidth(): LabelPaperWidth {
  return getPrinterSettings().labelPaperWidth;
}

/**
 * Set label paper width (global default)
 */
export function setLabelPaperWidth(width: LabelPaperWidth): void {
  savePrinterSettings({ labelPaperWidth: width });
}

/**
 * Get label height (global default)
 */
export function getLabelHeight(): number {
  return getPrinterSettings().labelHeight;
}

/**
 * Set label height (global default)
 */
export function setLabelHeight(height: number): void {
  savePrinterSettings({ labelHeight: height });
}

/**
 * Get paper settings for a specific printer
 * Agar printer uchun sozlama bo'lmasa, global default qaytaradi
 */
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

/**
 * Set paper settings for a specific printer
 * Har bir printer o'z qog'oz o'lchamlarini eslab qoladi
 */
export function setPrinterPaperSettings(printerId: string, paperSettings: PrinterPaperSettings): void {
  const settings = getPrinterSettings();
  const updatedPrinterSettings = {
    ...settings.printerPaperSettings,
    [printerId]: paperSettings,
  };
  savePrinterSettings({ printerPaperSettings: updatedPrinterSettings });
}


// ============================================
// LABEL / SENIK PRINTING
// ============================================

// Senik razmerlari - mini, kichik va katta
export type LabelSize = 'mini' | 'small' | 'medium' | 'large';

export interface LabelSizeConfig {
  width: number;  // mm
  height: number; // mm
  fontSize: 'small' | 'medium' | 'large';
  barcodeHeight: number;
  barcodeWidth: number;
}

// Senik razmer konfiguratsiyalari
// Default: large (60x40mm)
export const LABEL_SIZE_CONFIGS: Record<LabelSize, LabelSizeConfig> = {
  mini: {
    width: 20,
    height: 30,
    fontSize: 'small',
    barcodeHeight: 20,
    barcodeWidth: 1,
  },
  small: {
    width: 40,
    height: 30,
    fontSize: 'small',
    barcodeHeight: 30,
    barcodeWidth: 1,
  },
  medium: {
    width: 57,
    height: 30,
    fontSize: 'small',
    barcodeHeight: 40,
    barcodeWidth: 1.5,
  },
  large: {
    width: 60,
    height: 40,
    fontSize: 'medium',
    barcodeHeight: 50,
    barcodeWidth: 2,
  },
};

// Default senik o'lchami - 60x40mm
export const DEFAULT_LABEL_SIZE: LabelSize = 'large';
export const DEFAULT_LABEL_WIDTH = 60;
export const DEFAULT_LABEL_HEIGHT = 40;

// Label data interface
export interface LabelData {
  name: string;
  price: number;
  barcode?: string;
  barcodeType?: 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39' | 'UPC-A';
  sku?: string;
  stock?: number; // Ombordagi soni
  quantity?: number; // Number of labels to print
  paperWidth?: LabelPaperWidth; // Label paper width in mm
  paperHeight?: number; // Label paper height in mm
  labelSize?: LabelSize; // Senik razmeri (katta/kichik)
}

/**
 * Build ESC/POS label data for Xprinter and similar thermal label printers
 * Qog'oz o'lchamiga moslashtirilgan
 * Senik razmeri (katta/kichik) qo'llab-quvvatlanadi
 */
function buildLabelData(label: LabelData): Uint8Array {
  const encoder = new TextEncoder();
  const parts: number[] = [];
  
  // Senik razmeri bo'yicha konfiguratsiya olish
  const sizeConfig = label.labelSize ? LABEL_SIZE_CONFIGS[label.labelSize] : null;
  
  // Qog'oz kengligi - razmerdan yoki qo'lda kiritilgandan
  const paperWidth = sizeConfig?.width || label.paperWidth || getLabelPaperWidth();
  const paperHeight = sizeConfig?.height || label.paperHeight || getLabelHeight();
  
  // Qog'oz kengligiga qarab maksimal belgilar soni
  const maxChars: Record<number, number> = {
    30: 16,
    40: 20,
    50: 26,
    60: 32,
    80: 42,
  };
  const maxNameLength = maxChars[paperWidth] || Math.floor(paperWidth / 2);

  // Helper to add bytes
  const addBytes = (bytes: number[]) => parts.push(...bytes);
  const addText = (text: string) => {
    const bytes = encoder.encode(text);
    parts.push(...bytes);
  };
  const addLine = (text: string) => {
    addText(text);
    addBytes([LF]);
  };

  // Initialize printer
  addBytes(ESCPOS.INIT);
  
  // Qator oralig'ini kamaytirish (kompakt label uchun)
  const lineSpacing = paperHeight <= 30 ? 16 : 20;
  addBytes([ESC, 0x33, lineSpacing]);

  // Center alignment
  addBytes(ESCPOS.ALIGN_CENTER);

  // Product name - bold (SKU bilan birga)
  addBytes(ESCPOS.BOLD_ON);
  const nameWithSku = label.sku ? `${label.name} [${label.sku}]` : label.name;
  const name = nameWithSku.length > maxNameLength 
    ? nameWithSku.substring(0, maxNameLength - 2) + '..' 
    : nameWithSku;
  addLine(name);
  addBytes(ESCPOS.BOLD_OFF);

  // Price - large text (razmerga qarab)
  const isLarge = label.labelSize === 'large' || paperWidth >= 50;
  const isMedium = paperWidth >= 40;
  
  if (isLarge) {
    addBytes(ESCPOS.DOUBLE_SIZE);
  } else if (isMedium) {
    addBytes(ESCPOS.DOUBLE_HEIGHT);
  }
  addLine(`${label.price}`);
  addBytes(ESCPOS.NORMAL_SIZE);

  // Barcode
  if (label.barcode) {
    // Barcode balandligi - razmerga qarab
    const barcodeHeight = sizeConfig?.barcodeHeight || (isLarge ? 50 : isMedium ? 40 : 30);
    addBytes([GS, 0x68, barcodeHeight]);
    
    // Barcode kengligi - razmerga qarab
    const barcodeWidth = sizeConfig?.barcodeWidth || (isLarge ? 2 : 1);
    addBytes([GS, 0x77, barcodeWidth]);
    
    // Print barcode text below
    addBytes([GS, 0x48, 0x02]);
    
    // Barcode type
    const barcodeTypes: Record<string, number> = {
      'UPC-A': 0x00,
      'EAN13': 0x02,
      'EAN8': 0x03,
      'CODE39': 0x04,
      'CODE128': 0x49,
    };
    const barcodeType = barcodeTypes[label.barcodeType || 'CODE128'] || 0x49;
    
    if (barcodeType >= 0x41) {
      // New format for CODE128
      const barcodeBytes = encoder.encode(label.barcode);
      addBytes([GS, 0x6B, barcodeType, barcodeBytes.length]);
      parts.push(...barcodeBytes);
    } else {
      // Old format
      addBytes([GS, 0x6B, barcodeType]);
      addText(label.barcode);
      addBytes([0x00]); // NUL terminator
    }
    addBytes([LF]);
  }

  // SKU/Kod - har doim ko'rsatish (agar mavjud bo'lsa)
  if (label.sku) {
    addLine(`Kod: ${label.sku}`);
  }
  
  // Ombordagi soni - har doim ko'rsatish (agar mavjud bo'lsa)
  if (label.stock !== undefined) {
    addLine(`Ombor: ${label.stock} dona`);
  }

  // Feed and cut
  addBytes([ESC, 0x64, 1]); // Feed 1 line
  addBytes(ESCPOS.PARTIAL_CUT);

  return new Uint8Array(parts);
}

/**
 * Print single label/senik
 * Agar printerId berilmasa, saqlangan label printer ishlatiladi
 * Default o'lcham: 60x40mm
 */
export async function printLabel(
  printerId: string | null,
  label: LabelData
): Promise<boolean> {
  // Agar printerId berilmasa, saqlangan label printer ID ni olish
  const effectivePrinterId = printerId || getDefaultLabelPrinterId();
  
  // Qog'oz o'lchamini aniqlash - avval label dan, keyin settings dan, keyin default
  const paperWidth = label.paperWidth || getLabelPaperWidth() || DEFAULT_LABEL_WIDTH;
  const paperHeight = label.paperHeight || getLabelHeight() || DEFAULT_LABEL_HEIGHT;
  
  console.log('[POSPrint] printLabel called with:');
  console.log('  - printerId:', effectivePrinterId);
  console.log('  - paperWidth:', paperWidth, 'paperHeight:', paperHeight);
  console.log('  - label:', label);
  
  // Qog'oz o'lchamini qo'shish
  const labelWithSettings: LabelData = {
    ...label,
    paperWidth,
    paperHeight,
  };
  
  // Agar "browser-print" yoki "system" tanlangan bo'lsa - to'g'ridan-to'g'ri brauzer print
  if (!effectivePrinterId || effectivePrinterId === 'browser-print' || effectivePrinterId.includes('system')) {
    console.log('[POSPrint] Using browser print directly');
    return printLabelViaBrowser(labelWithSettings);
  }
  
  // Try Electron first
  const electronAPI = getElectronAPI();
  if (electronAPI?.printerPrintLabel && effectivePrinterId) {
    try {
      const result = await electronAPI.printerPrintLabel(effectivePrinterId, labelWithSettings);
      if (result.success) {
        return true;
      }
      console.warn('[POSPrint] Electron label print failed:', result.error);
    } catch (e) {
      console.error('[POSPrint] Electron label print error:', e);
    }
  }

  // Try QZ Tray
  if (effectivePrinterId?.startsWith('qz:')) {
    try {
      const printerName = effectivePrinterId.replace('qz:', '');
      const { printLabelQZ } = await import('./qz-tray');
      return await printLabelQZ(printerName, {
        name: label.name,
        price: label.price,
        barcode: label.barcode || label.sku,
      });
    } catch (e) {
      console.error('[POSPrint] QZ Tray label print error:', e);
    }
  }

  // Try WebUSB - faqat agar USB printer tanlangan bo'lsa
  if (effectivePrinterId?.startsWith('usb:')) {
    try {
      console.log('[POSPrint] Trying WebUSB print for:', effectivePrinterId);
      const data = buildLabelData(labelWithSettings);
      console.log('[POSPrint] Label data built, size:', data.length, 'bytes');
      const success = await printViaWebUSB(effectivePrinterId, data);
      if (success) {
        console.log('[POSPrint] WebUSB print SUCCESS!');
        return true;
      }
      console.warn('[POSPrint] WebUSB print returned false, falling back to browser print');
    } catch (e: any) {
      console.error('[POSPrint] WebUSB label print error:', e);
      console.log('[POSPrint] Falling back to browser print due to USB error');
      // USB xatosi - brauzer print ga o'tish (alert ko'rsatmasdan)
    }
  }

  // Brauzer print - USB ishlamasa yoki tanlanmagan bo'lsa
  console.log('[POSPrint] Using browser print');
  return printLabelViaBrowser(labelWithSettings);
}

/**
 * Print multiple labels
 */
export async function printLabels(
  printerId: string | null,
  labels: LabelData[]
): Promise<{ success: boolean; printed: number; errors: string[] }> {
  const errors: string[] = [];
  let printed = 0;

  // Try Electron first (batch print)
  const electronAPI = getElectronAPI();
  if (electronAPI?.printerPrintLabels && printerId) {
    try {
      const result = await electronAPI.printerPrintLabels(printerId, labels);
      if (result.success) {
        return { success: true, printed: labels.length, errors: [] };
      }
      errors.push(result.error || 'Unknown error');
    } catch (e: any) {
      errors.push(e.message || 'Electron print error');
    }
  }

  // Fallback: print one by one
  for (const label of labels) {
    const quantity = label.quantity || 1;
    for (let i = 0; i < quantity; i++) {
      try {
        const success = await printLabel(printerId, label);
        if (success) {
          printed++;
        } else {
          errors.push(`Failed to print: ${label.name}`);
        }
      } catch (e: any) {
        errors.push(`${label.name}: ${e.message}`);
      }
    }
  }

  return {
    success: printed > 0,
    printed,
    errors,
  };
}

/**
 * Fallback: Print label via browser
 * Yangi oyna ochib chop etadi - sahifani buzmaydi
 * Barcode - JsBarcode CDN orqali
 */
export function printLabelViaBrowser(label: LabelData): boolean {
  // O'lchamlarni olish - avval paperWidth/paperHeight, keyin labelSize, keyin default
  const paperWidth = label.paperWidth || (label.labelSize ? LABEL_SIZE_CONFIGS[label.labelSize].width : 60);
  const paperHeight = label.paperHeight || (label.labelSize ? LABEL_SIZE_CONFIGS[label.labelSize].height : 40);
  
  // Font o'lchamlari - qog'oz o'lchamiga qarab
  const nameFontSize = paperWidth >= 60 ? '12px' : paperWidth >= 50 ? '10px' : '9px';
  const priceFontSize = paperWidth >= 60 ? '16px' : paperWidth >= 50 ? '14px' : '12px';
  const smallFontSize = paperWidth >= 60 ? '9px' : '8px';
  
  // Barcode o'lchamlari - kattaroq, scanner o'qishi oson
  const barcodeHeight = paperWidth >= 60 ? 55 : paperWidth >= 50 ? 50 : 45;
  const barcodeWidth = paperWidth >= 60 ? 1.2 : paperWidth >= 50 ? 1.0 : 0.8;
  
  // Barcode qiymati - to'g'ridan-to'g'ri barcode yoki SKU
  // CODE128 format har qanday belgilarni qo'llab-quvvatlaydi
  const barcodeValue = label.barcode || label.sku || '';
  
  // Senik HTML yaratish - yaxshilangan dizayn
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Senik - ${label.name}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        @page {
          size: ${paperWidth}mm ${paperHeight}mm;
          margin: 0;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          width: ${paperWidth}mm;
          height: ${paperHeight}mm;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .label {
          width: ${paperWidth}mm;
          height: ${paperHeight}mm;
          padding: 1.5mm 2mm;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          align-items: center;
        }
        .name {
          font-weight: bold;
          font-size: ${nameFontSize};
          line-height: 1.2;
          max-width: 100%;
          word-wrap: break-word;
          overflow-wrap: break-word;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .price {
          font-size: ${priceFontSize};
          font-weight: bold;
          color: #000;
          margin: 1mm 0;
        }
        .barcode-container {
          width: 100%;
          display: flex;
          justify-content: center;
          flex: 1;
          align-items: center;
        }
        .barcode-container svg {
          max-width: 95%;
          height: auto;
        }
        @media print {
          html, body {
            width: ${paperWidth}mm;
            height: ${paperHeight}mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="name">${label.name}${label.sku ? ` [${label.sku}]` : ''}</div>
        <div class="price">${label.price}</div>
        ${barcodeValue ? `
          <div class="barcode-container">
            <svg id="barcode"></svg>
          </div>
        ` : ''}
      </div>
      ${barcodeValue ? `
        <script>
          try {
            // CODE128 format - qisqa ID uchun optimallashtirilgan
            JsBarcode("#barcode", "${barcodeValue}", {
              format: "CODE128",
              width: 3,
              height: 70,
              displayValue: true,
              fontSize: 16,
              margin: 5,
              textMargin: 5,
              font: "Arial",
              fontOptions: "bold",
              text: "${barcodeValue}"
            });
          } catch(e) {
            console.error('Barcode error:', e);
          }
        </script>
      ` : ''}
    </body>
    </html>
  `;
  
  // Yangi oyna ochish
  const printWindow = window.open('', '_blank', `width=${paperWidth * 4},height=${paperHeight * 4}`);
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // JsBarcode yuklangandan keyin chop etish
    setTimeout(() => {
      printWindow.print();
      // Chop etish dialogidan keyin oynani yopish
      setTimeout(() => {
        printWindow.close();
      }, 500);
    }, 500);
    
    return true;
  }
  
  console.error('[POSPrint] Failed to open print window');
  return false;
}

/**
 * Print label for a product from cart
 */
export async function printProductLabel(
  printerId: string | null,
  product: { name: string; price: number; sku?: string; barcode?: string },
  quantity: number = 1
): Promise<boolean> {
  const label: LabelData = {
    name: product.name,
    price: product.price,
    sku: product.sku,
    barcode: product.barcode || product.sku,
    barcodeType: 'CODE128',
    quantity,
  };

  const result = await printLabels(printerId, [label]);
  return result.success;
}

/**
 * Print multiple labels in one print dialog (bulk print)
 * Barcha labellarni bitta sahifada chop etadi - har biri alohida sahifada (page-break)
 */
export function printBulkLabelsViaBrowser(labels: LabelData[]): boolean {
  if (labels.length === 0) return false;
  
  // Birinchi labeldan o'lchamlarni olish
  const firstLabel = labels[0];
  const paperWidth = firstLabel.paperWidth || (firstLabel.labelSize ? LABEL_SIZE_CONFIGS[firstLabel.labelSize].width : 60);
  const paperHeight = firstLabel.paperHeight || (firstLabel.labelSize ? LABEL_SIZE_CONFIGS[firstLabel.labelSize].height : 40);
  
  // Font o'lchamlari
  const nameFontSize = paperWidth >= 60 ? '12px' : paperWidth >= 50 ? '10px' : '9px';
  const priceFontSize = paperWidth >= 60 ? '16px' : paperWidth >= 50 ? '14px' : '12px';
  
  // Har bir label uchun HTML yaratish
  const labelsHtml = labels.map((label, index) => {
    const barcodeValue = label.barcode || label.sku || '';
    const barcodeId = `barcode-${index}`;
    
    return `
      <div class="label-page" ${index < labels.length - 1 ? 'style="page-break-after: always;"' : ''}>
        <div class="label">
          <div class="name">${label.name}${label.sku ? ` [${label.sku}]` : ''}</div>
          <div class="price">${label.price}</div>
          ${barcodeValue ? `
            <div class="barcode-container">
              <svg id="${barcodeId}"></svg>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Barcode script yaratish
  const barcodeScripts = labels.map((label, index) => {
    const barcodeValue = label.barcode || label.sku || '';
    if (!barcodeValue) return '';
    
    return `
      try {
        JsBarcode("#barcode-${index}", "${barcodeValue}", {
          format: "CODE128",
          width: 3,
          height: 70,
          displayValue: true,
          fontSize: 16,
          margin: 5,
          textMargin: 5,
          font: "Arial",
          fontOptions: "bold",
          text: "${barcodeValue}"
        });
      } catch(e) {
        console.error('Barcode error for ${index}:', e);
      }
    `;
  }).join('\n');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Seniklar - ${labels.length} ta</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        @page {
          size: ${paperWidth}mm ${paperHeight}mm;
          margin: 0;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
        }
        body {
          font-family: Arial, sans-serif;
        }
        .label-page {
          width: ${paperWidth}mm;
          height: ${paperHeight}mm;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .label {
          width: ${paperWidth}mm;
          height: ${paperHeight}mm;
          padding: 1.5mm 2mm;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          align-items: center;
        }
        .name {
          font-weight: bold;
          font-size: ${nameFontSize};
          line-height: 1.2;
          max-width: 100%;
          word-wrap: break-word;
          overflow-wrap: break-word;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .price {
          font-size: ${priceFontSize};
          font-weight: bold;
          color: #000;
          margin: 1mm 0;
        }
        .barcode-container {
          width: 100%;
          display: flex;
          justify-content: center;
          flex: 1;
          align-items: center;
        }
        .barcode-container svg {
          max-width: 95%;
          height: auto;
        }
        @media print {
          .label-page {
            width: ${paperWidth}mm;
            height: ${paperHeight}mm;
          }
        }
      </style>
    </head>
    <body>
      ${labelsHtml}
      <script>
        ${barcodeScripts}
      </script>
    </body>
    </html>
  `;
  
  // Yangi oyna ochish
  const printWindow = window.open('', '_blank', `width=${paperWidth * 4},height=${paperHeight * 4}`);
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // JsBarcode yuklangandan keyin chop etish
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
      }, 500);
    }, 500);
    
    return true;
  }
  
  console.error('[POSPrint] Failed to open print window for bulk labels');
  return false;
}

/**
 * Dispatch print to multiple devices (legacy API for POS.tsx)
 * @param transaction - POS transaction data
 * @param copies - Number of copies
 * @param devices - Array of device types
 * @param options - Additional options
 */
export async function dispatchPrint(
  transaction: { id: string; createdAt: string; lines: Array<{ id: string; name: string; price: number; qty: number }>; total: number },
  copies: number = 1,
  devices: string[] = ['printer'],
  options?: { deviceIds?: string[]; deviceCopies?: Record<string, number> }
): Promise<{ success: boolean; dispatchedTo: string[] }> {
  const dispatchedTo: string[] = [];
  
  // Convert transaction to receipt format
  const receiptData: ReceiptData = {
    type: 'sale',
    items: transaction.lines.map(line => ({
      name: line.name,
      quantity: line.qty,
      price: line.price,
    })),
    total: transaction.total,
    paymentType: 'Naqd',
    date: new Date(transaction.createdAt),
    receiptNumber: transaction.id,
  };

  // Get default printer
  const printerId = options?.deviceIds?.[0] || getDefaultPrinterId();
  
  // Print copies
  for (let i = 0; i < copies; i++) {
    try {
      await printReceipt(printerId, receiptData);
      if (!dispatchedTo.includes('printer')) {
        dispatchedTo.push('printer');
      }
    } catch (e) {
      console.error('[dispatchPrint] Error:', e);
    }
  }

  return { success: dispatchedTo.length > 0, dispatchedTo };
}
