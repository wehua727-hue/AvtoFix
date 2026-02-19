/**
 * QZ Tray Integration
 * 
 * QZ Tray - brauzerdan to'g'ridan-to'g'ri printerga chop etish
 * https://qz.io/
 * 
 * O'rnatish:
 * 1. https://qz.io/download/ dan QZ Tray ni yuklab oling
 * 2. O'rnating va ishga tushiring
 * 3. Brauzerda avtomatik ulanadi
 */

// QZ Tray global object (loaded from CDN or local)
declare const qz: any;

let qzReady = false;
let qzConnected = false;

/**
 * QZ Tray kutubxonasini yuklash
 */
export async function loadQZTray(): Promise<boolean> {
  if (typeof qz !== 'undefined') {
    qzReady = true;
    return true;
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
    script.onload = () => {
      qzReady = true;
      console.log('[QZ Tray] Library loaded');
      resolve(true);
    };
    script.onerror = () => {
      console.error('[QZ Tray] Failed to load library');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * QZ Tray ga ulanish
 */
export async function connectQZ(): Promise<boolean> {
  if (!qzReady) {
    await loadQZTray();
  }

  if (typeof qz === 'undefined') {
    console.error('[QZ Tray] Library not loaded');
    return false;
  }

  if (qzConnected) {
    return true;
  }

  try {
    // Security - sertifikatsiz ishlash uchun
    qz.security.setCertificatePromise(() => Promise.resolve(''));
    qz.security.setSignaturePromise(() => Promise.resolve(''));

    await qz.websocket.connect();
    qzConnected = true;
    console.log('[QZ Tray] Connected successfully');
    return true;
  } catch (error: any) {
    console.error('[QZ Tray] Connection error:', error.message || error);
    qzConnected = false;
    return false;
  }
}

/**
 * QZ Tray dan uzilish
 */
export async function disconnectQZ(): Promise<void> {
  if (typeof qz !== 'undefined' && qzConnected) {
    try {
      await qz.websocket.disconnect();
      qzConnected = false;
      console.log('[QZ Tray] Disconnected');
    } catch (e) {
      console.error('[QZ Tray] Disconnect error:', e);
    }
  }
}

/**
 * QZ Tray ulanganmi?
 */
export function isQZConnected(): boolean {
  return qzConnected && typeof qz !== 'undefined' && qz.websocket.isActive();
}

/**
 * Barcha printerlarni olish
 */
export async function getQZPrinters(): Promise<string[]> {
  if (!await connectQZ()) {
    return [];
  }

  try {
    const printers = await qz.printers.find();
    console.log('[QZ Tray] Found printers:', printers);
    return Array.isArray(printers) ? printers : [printers];
  } catch (error: any) {
    console.error('[QZ Tray] Get printers error:', error.message || error);
    return [];
  }
}


/**
 * ESC/POS buyruqlarini yuborish (chek printer)
 */
export async function printRawQZ(printerName: string, data: number[]): Promise<boolean> {
  if (!await connectQZ()) {
    throw new Error('QZ Tray ga ulanib bo\'lmadi');
  }

  try {
    const config = qz.configs.create(printerName);
    
    // Raw ESC/POS data
    const printData = [{
      type: 'raw',
      format: 'base64',
      data: btoa(String.fromCharCode(...data))
    }];

    await qz.print(config, printData);
    console.log('[QZ Tray] Print sent to:', printerName);
    return true;
  } catch (error: any) {
    console.error('[QZ Tray] Print error:', error.message || error);
    throw error;
  }
}

/**
 * Matn chop etish (oddiy printer)
 */
export async function printTextQZ(printerName: string, text: string): Promise<boolean> {
  if (!await connectQZ()) {
    throw new Error('QZ Tray ga ulanib bo\'lmadi');
  }

  try {
    const config = qz.configs.create(printerName);
    
    const printData = [{
      type: 'raw',
      format: 'plain',
      data: text
    }];

    await qz.print(config, printData);
    console.log('[QZ Tray] Text print sent to:', printerName);
    return true;
  } catch (error: any) {
    console.error('[QZ Tray] Text print error:', error.message || error);
    throw error;
  }
}


/**
 * Chek chop etish (ESC/POS)
 */
export interface QZReceiptData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  receiptNumber?: string;
  date?: Date;
  cashier?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    discount?: number;
  }>;
  total: number;
  discount?: number;
  paymentType: string;
  type?: 'sale' | 'refund';
}

export async function printReceiptQZ(printerName: string, receipt: QZReceiptData): Promise<boolean> {
  // ESC/POS commands
  const ESC = 0x1B;
  const GS = 0x1D;
  
  const commands: number[] = [];
  
  // Initialize
  commands.push(ESC, 0x40);
  
  // Center align
  commands.push(ESC, 0x61, 0x01);
  
  // Store name (bold, double size)
  commands.push(ESC, 0x45, 0x01); // Bold on
  commands.push(ESC, 0x21, 0x30); // Double size
  commands.push(...stringToBytes(receipt.storeName || 'DO\'KON'));
  commands.push(0x0A);
  commands.push(ESC, 0x21, 0x00); // Normal size
  commands.push(ESC, 0x45, 0x00); // Bold off
  
  // Store address
  if (receipt.storeAddress) {
    commands.push(...stringToBytes(receipt.storeAddress));
    commands.push(0x0A);
  }
  
  // Store phone
  if (receipt.storePhone) {
    commands.push(...stringToBytes(`Tel: ${receipt.storePhone}`));
    commands.push(0x0A);
  }
  
  // Separator
  commands.push(...stringToBytes('================================'));
  commands.push(0x0A);

  // Left align
  commands.push(ESC, 0x61, 0x00);
  
  // Receipt info
  if (receipt.receiptNumber) {
    commands.push(...stringToBytes(`Chek: ${receipt.receiptNumber}`));
    commands.push(0x0A);
  }
  
  const date = receipt.date || new Date();
  commands.push(...stringToBytes(`Sana: ${date.toLocaleDateString('uz-UZ')} ${date.toLocaleTimeString('uz-UZ')}`));
  commands.push(0x0A);
  
  if (receipt.cashier) {
    commands.push(...stringToBytes(`Kassir: ${receipt.cashier}`));
    commands.push(0x0A);
  }
  
  // Type
  if (receipt.type === 'refund') {
    commands.push(ESC, 0x45, 0x01); // Bold
    commands.push(...stringToBytes('*** QAYTARISH ***'));
    commands.push(ESC, 0x45, 0x00);
    commands.push(0x0A);
  }
  
  // Separator
  commands.push(...stringToBytes('--------------------------------'));
  commands.push(0x0A);
  
  // Items
  for (const item of receipt.items) {
    const itemTotal = item.quantity * item.price;
    const discountAmount = item.discount ? (itemTotal * item.discount / 100) : 0;
    const finalPrice = itemTotal - discountAmount;
    
    commands.push(...stringToBytes(item.name));
    commands.push(0x0A);
    commands.push(...stringToBytes(`  ${item.quantity} x ${formatPrice(item.price)} = ${formatPrice(finalPrice)}`));
    commands.push(0x0A);
  }
  
  // Separator
  commands.push(...stringToBytes('--------------------------------'));
  commands.push(0x0A);

  // Total
  commands.push(ESC, 0x45, 0x01); // Bold
  commands.push(ESC, 0x21, 0x10); // Double height
  commands.push(...stringToBytes(`JAMI: ${formatPrice(receipt.total)}`));
  commands.push(0x0A);
  commands.push(ESC, 0x21, 0x00); // Normal
  commands.push(ESC, 0x45, 0x00);
  
  // Payment type
  commands.push(...stringToBytes(`To'lov: ${receipt.paymentType}`));
  commands.push(0x0A);
  
  // Footer
  commands.push(0x0A);
  commands.push(ESC, 0x61, 0x01); // Center
  commands.push(...stringToBytes('Xaridingiz uchun rahmat!'));
  commands.push(0x0A);
  commands.push(0x0A);
  
  // Cut
  commands.push(GS, 0x56, 0x00);
  
  return printRawQZ(printerName, commands);
}

// Helper: String to bytes (CP866 for Cyrillic)
function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      // Simple UTF-8 to CP866 mapping for Cyrillic
      bytes.push(code > 255 ? 0x3F : code);
    }
  }
  return bytes;
}

// Helper: Format price
function formatPrice(price: number): string {
  return price.toLocaleString('uz-UZ') + " so'm";
}

/**
 * Senik (label) chop etish
 * Faqat: Mahsulot nomi, Narx, Barcode (tagida raqamlar bilan)
 */
export interface QZLabelData {
  name: string;
  price: number;
  barcode?: string;
}

export async function printLabelQZ(
  printerName: string, 
  label: QZLabelData
): Promise<boolean> {
  const ESC = 0x1B;
  const GS = 0x1D;
  
  const commands: number[] = [];
  
  // Initialize
  commands.push(ESC, 0x40);
  
  // Center align
  commands.push(ESC, 0x61, 0x01);
  
  // Product name (bold)
  commands.push(ESC, 0x45, 0x01);
  commands.push(...stringToBytes(label.name.substring(0, 24)));
  commands.push(0x0A);
  commands.push(ESC, 0x45, 0x00);
  
  // Price (large, bold)
  commands.push(ESC, 0x45, 0x01);
  commands.push(ESC, 0x21, 0x30); // Double size
  commands.push(...stringToBytes(formatPrice(label.price)));
  commands.push(0x0A);
  commands.push(ESC, 0x21, 0x00);
  commands.push(ESC, 0x45, 0x00);
  
  // Barcode with numbers below (HRI)
  const barcodeValue = label.barcodeId || label.barcode;
  if (barcodeValue) {
    commands.push(0x0A);
    commands.push(GS, 0x68, 60); // Height: 60 dots
    commands.push(GS, 0x77, 2);  // Width: 2
    commands.push(GS, 0x48, 2);  // HRI: BELOW barcode
    commands.push(GS, 0x66, 0);  // HRI font: A
    commands.push(GS, 0x6B, 73, barcodeValue.length);
    commands.push(...stringToBytes(barcodeValue));
    commands.push(0x0A);
  }
  
  // Feed and cut
  commands.push(0x0A);
  commands.push(GS, 0x56, 0x00);
  
  return printRawQZ(printerName, commands);
}

/**
 * Kassa qutisini ochish
 */
export async function openDrawerQZ(printerName: string): Promise<boolean> {
  const ESC = 0x1B;
  return printRawQZ(printerName, [ESC, 0x70, 0x00, 0x19, 0xFA]);
}

/**
 * Test chop etish
 */
export async function printTestQZ(printerName: string): Promise<boolean> {
  const ESC = 0x1B;
  const GS = 0x1D;
  
  const commands: number[] = [];
  commands.push(ESC, 0x40);
  commands.push(ESC, 0x61, 0x01);
  commands.push(ESC, 0x45, 0x01);
  commands.push(...stringToBytes('QZ TRAY TEST'));
  commands.push(0x0A);
  commands.push(ESC, 0x45, 0x00);
  commands.push(...stringToBytes('Printer ishlayapti!'));
  commands.push(0x0A, 0x0A);
  commands.push(GS, 0x56, 0x00);
  
  return printRawQZ(printerName, commands);
}
