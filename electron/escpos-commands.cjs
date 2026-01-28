/**
 * ESC/POS Commands Library
 * Universal commands for thermal receipt printers
 * Supports: Xprinter, Rongta, Sunmi, Epson, POS-80, SENIK, etc.
 */

const ESC = 0x1B;
const GS = 0x1D;
const FS = 0x1C;
const DLE = 0x10;
const EOT = 0x04;
const NUL = 0x00;

// Initialize printer
const INIT = Buffer.from([ESC, 0x40]);

// Text formatting
const TEXT_NORMAL = Buffer.from([ESC, 0x21, 0x00]);
const TEXT_BOLD_ON = Buffer.from([ESC, 0x45, 0x01]);
const TEXT_BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);
const TEXT_UNDERLINE_ON = Buffer.from([ESC, 0x2D, 0x01]);
const TEXT_UNDERLINE_OFF = Buffer.from([ESC, 0x2D, 0x00]);
const TEXT_DOUBLE_HEIGHT = Buffer.from([ESC, 0x21, 0x10]);
const TEXT_DOUBLE_WIDTH = Buffer.from([ESC, 0x21, 0x20]);
const TEXT_DOUBLE_SIZE = Buffer.from([ESC, 0x21, 0x30]);

// Alignment
const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
const ALIGN_RIGHT = Buffer.from([ESC, 0x61, 0x02]);

// Line spacing
const LINE_SPACING_DEFAULT = Buffer.from([ESC, 0x32]);
const LINE_SPACING_SET = (n) => Buffer.from([ESC, 0x33, n]);

// Paper
const FEED_LINE = Buffer.from([ESC, 0x64, 0x01]);
const FEED_LINES = (n) => Buffer.from([ESC, 0x64, n]);
const CUT_PAPER = Buffer.from([GS, 0x56, 0x00]); // Full cut
const CUT_PAPER_PARTIAL = Buffer.from([GS, 0x56, 0x01]); // Partial cut
const CUT_PAPER_FEED = Buffer.from([GS, 0x56, 0x42, 0x00]); // Feed and cut

// Cash drawer
const OPEN_DRAWER = Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA]);

// Character set
const CHARSET_PC437 = Buffer.from([ESC, 0x74, 0x00]);
const CHARSET_PC850 = Buffer.from([ESC, 0x74, 0x02]);
const CHARSET_PC866 = Buffer.from([ESC, 0x74, 0x11]); // Cyrillic
const CHARSET_WPC1252 = Buffer.from([ESC, 0x74, 0x10]);

// Code page for Cyrillic
const CODEPAGE_CYRILLIC = Buffer.from([ESC, 0x74, 0x11]);

// Barcode settings
const BARCODE_HEIGHT = (h) => Buffer.from([GS, 0x68, h]);
const BARCODE_WIDTH = (w) => Buffer.from([GS, 0x77, w]); // 2-6
const BARCODE_TEXT_BELOW = Buffer.from([GS, 0x48, 0x02]);
const BARCODE_TEXT_ABOVE = Buffer.from([GS, 0x48, 0x01]);
const BARCODE_TEXT_NONE = Buffer.from([GS, 0x48, 0x00]);

// Barcode types
const BARCODE_TYPES = {
  UPC_A: 0x00,
  UPC_E: 0x01,
  EAN13: 0x02,
  EAN8: 0x03,
  CODE39: 0x04,
  ITF: 0x05,
  CODABAR: 0x06,
  CODE93: 0x48,
  CODE128: 0x49,
};

// QR Code commands
const QR_MODEL = Buffer.from([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]); // Model 2
const QR_SIZE = (n) => Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, n]); // Size 1-16
const QR_ERROR_CORRECTION = (level) => {
  // L=48, M=49, Q=50, H=51
  const levels = { L: 48, M: 49, Q: 50, H: 51 };
  return Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, levels[level] || 49]);
};


/**
 * Build barcode command
 * @param {string} data - Barcode data
 * @param {string} type - Barcode type (EAN13, CODE128, etc.)
 * @returns {Buffer}
 */
function buildBarcode(data, type = 'CODE128') {
  const barcodeType = BARCODE_TYPES[type.toUpperCase()] || BARCODE_TYPES.CODE128;
  const dataBuffer = Buffer.from(data, 'ascii');
  
  if (barcodeType >= 0x41) {
    // New format for CODE93, CODE128
    return Buffer.concat([
      Buffer.from([GS, 0x6B, barcodeType, dataBuffer.length]),
      dataBuffer
    ]);
  } else {
    // Old format
    return Buffer.concat([
      Buffer.from([GS, 0x6B, barcodeType]),
      dataBuffer,
      Buffer.from([NUL])
    ]);
  }
}

/**
 * Build QR code command
 * @param {string} data - QR code data
 * @param {number} size - Module size (1-16)
 * @returns {Buffer}
 */
function buildQRCode(data, size = 6) {
  const dataBuffer = Buffer.from(data, 'utf8');
  const pL = (dataBuffer.length + 3) % 256;
  const pH = Math.floor((dataBuffer.length + 3) / 256);
  
  return Buffer.concat([
    QR_MODEL,
    QR_SIZE(size),
    QR_ERROR_CORRECTION('M'),
    // Store data
    Buffer.from([GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]),
    dataBuffer,
    // Print QR
    Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30])
  ]);
}

/**
 * Build text with encoding
 * @param {string} text - Text to print
 * @param {string} encoding - Encoding (utf8, cp866, etc.)
 * @returns {Buffer}
 */
function buildText(text, encoding = 'utf8') {
  return Buffer.concat([
    Buffer.from(text, encoding),
    Buffer.from([0x0A]) // Line feed
  ]);
}

/**
 * Build a complete receipt
 * @param {Object} receipt - Receipt data
 * Supports both old format (header, items with qty) and new format (storeName, items with quantity)
 * @returns {Buffer}
 */
function buildReceipt(receipt) {
  const buffers = [INIT, CODEPAGE_CYRILLIC];
  
  // Header - support both old (header) and new (storeName) format
  const headerText = receipt.header || receipt.storeName;
  if (headerText) {
    buffers.push(ALIGN_CENTER, TEXT_BOLD_ON, TEXT_DOUBLE_SIZE);
    buffers.push(buildText(headerText));
    buffers.push(TEXT_NORMAL, TEXT_BOLD_OFF);
  }
  
  // Subheader / Store info
  const subheaderText = receipt.subheader || receipt.storeAddress;
  if (subheaderText) {
    buffers.push(ALIGN_CENTER);
    buffers.push(buildText(subheaderText));
  }
  
  if (receipt.storePhone) {
    buffers.push(ALIGN_CENTER);
    buffers.push(buildText(`Tel: ${receipt.storePhone}`));
  }
  
  // Separator
  buffers.push(ALIGN_LEFT);
  buffers.push(buildText('--------------------------------'));
  
  // Receipt type (sale/refund)
  if (receipt.type) {
    buffers.push(ALIGN_CENTER, TEXT_BOLD_ON);
    const typeText = receipt.type === 'refund' ? 'QAYTARISH' : 'CHEK';
    buffers.push(buildText(typeText));
    buffers.push(TEXT_BOLD_OFF);
  }
  
  // Date and receipt number
  const date = receipt.date ? new Date(receipt.date) : new Date();
  buffers.push(ALIGN_CENTER);
  buffers.push(buildText(date.toLocaleString('ru-RU')));
  
  if (receipt.receiptNumber) {
    buffers.push(buildText(`Chek #${receipt.receiptNumber}`));
  }
  
  if (receipt.cashier) {
    buffers.push(buildText(`Kassir: ${receipt.cashier}`));
  }
  
  buffers.push(buildText('--------------------------------'));
  
  // Items header - REGOS style
  if (receipt.items && receipt.items.length > 0) {
    buffers.push(ALIGN_LEFT);
    buffers.push(TEXT_BOLD_ON);
    buffers.push(buildText('# Mahsulot          Soni   Summa'));
    buffers.push(TEXT_BOLD_OFF);
    buffers.push(buildText('--------------------------------'));
    
    receipt.items.forEach((item, index) => {
      const qty = item.qty || item.quantity || 1;
      const price = item.price || 0;
      const itemTotal = qty * price;
      const discount = item.discount || 0;
      const discountAmount = discount > 0 ? (itemTotal * discount / 100) : 0;
      const finalTotal = itemTotal - discountAmount;
      
      // Tartib raqami + Item name (truncate if too long)
      const num = String(index + 1).padStart(2, ' ');
      const name = (item.name || '').substring(0, 20);
      buffers.push(buildText(`${num} ${name}`));
      
      // Quantity x Price = Total
      const qtyPrice = `   ${qty} x ${formatMoney(price)}`;
      const totalStr = formatMoney(finalTotal);
      const spaces = Math.max(1, 32 - qtyPrice.length - totalStr.length);
      buffers.push(buildText(qtyPrice + ' '.repeat(spaces) + totalStr));
      
      if (discount > 0) {
        buffers.push(buildText(`  Chegirma: -${discount}%`));
      }
    });
  }
  
  // Separator
  buffers.push(buildText('--------------------------------'));
  
  // Totals
  buffers.push(ALIGN_RIGHT);
  
  if (receipt.subtotal !== undefined) {
    buffers.push(buildText(`Jami: ${formatMoney(receipt.subtotal)}`));
  }
  
  if (receipt.discount && receipt.discount > 0) {
    buffers.push(buildText(`Chegirma: -${formatMoney(receipt.discount)}`));
  }
  
  if (receipt.total !== undefined) {
    buffers.push(TEXT_BOLD_ON);
    const totalLabel = receipt.type === 'refund' ? 'QAYTARISH:' : 'JAMI:';
    const totalPrefix = receipt.type === 'refund' ? '-' : '';
    buffers.push(buildText(`${totalLabel} ${totalPrefix}${formatMoney(receipt.total)} so'm`));
    buffers.push(TEXT_NORMAL, TEXT_BOLD_OFF);
  }
  
  // Payment info - support both old (paymentMethod) and new (paymentType) format
  const paymentMethod = receipt.paymentMethod || receipt.paymentType;
  if (paymentMethod) {
    buffers.push(ALIGN_CENTER);
    buffers.push(buildText(`To'lov: ${paymentMethod}`));
  }
  
  if (receipt.cashReceived) {
    buffers.push(ALIGN_LEFT);
    buffers.push(buildText(`Qabul qilindi: ${formatMoney(receipt.cashReceived)}`));
  }
  
  if (receipt.change) {
    buffers.push(buildText(`Qaytim: ${formatMoney(receipt.change)}`));
  }
  
  // Barcode
  if (receipt.barcode) {
    buffers.push(ALIGN_CENTER, FEED_LINE);
    buffers.push(BARCODE_HEIGHT(60), BARCODE_WIDTH(2), BARCODE_TEXT_BELOW);
    buffers.push(buildBarcode(receipt.barcode, receipt.barcodeType || 'CODE128'));
    buffers.push(FEED_LINE);
  }
  
  // QR Code
  if (receipt.qrcode) {
    buffers.push(ALIGN_CENTER, FEED_LINE);
    buffers.push(buildQRCode(receipt.qrcode, receipt.qrSize || 6));
    buffers.push(FEED_LINE);
  }
  
  // Footer
  buffers.push(ALIGN_CENTER);
  buffers.push(buildText('--------------------------------'));
  if (receipt.footer) {
    buffers.push(buildText(receipt.footer));
  } else {
    buffers.push(buildText('Xaridingiz uchun rahmat!'));
  }
  
  // Feed and cut
  buffers.push(FEED_LINES(4), CUT_PAPER_PARTIAL);
  
  // Open drawer if requested
  if (receipt.openDrawer) {
    buffers.push(OPEN_DRAWER);
  }
  
  return Buffer.concat(buffers);
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('ru-RU');
}

/**
 * Build test receipt
 * @returns {Buffer}
 */
function buildTestReceipt() {
  return buildReceipt({
    header: 'TEST CHEK',
    subheader: 'POS Printer Test',
    items: [
      { name: 'Mahsulot 1', qty: 2, price: 10000 },
      { name: 'Mahsulot 2', qty: 1, price: 50000 },
      { name: 'Mahsulot 3', qty: 3, price: 5000 },
    ],
    subtotal: 85000,
    discount: 5000,
    total: 80000,
    paymentMethod: 'Naqd',
    cashReceived: 100000,
    change: 20000,
    barcode: '123456789012',
    barcodeType: 'EAN13',
    qrcode: 'https://example.com/receipt/test',
    footer: 'Xaridingiz uchun rahmat!',
  });
}

module.exports = {
  // Constants
  ESC, GS, FS, DLE, EOT, NUL,
  
  // Commands
  INIT,
  TEXT_NORMAL, TEXT_BOLD_ON, TEXT_BOLD_OFF,
  TEXT_UNDERLINE_ON, TEXT_UNDERLINE_OFF,
  TEXT_DOUBLE_HEIGHT, TEXT_DOUBLE_WIDTH, TEXT_DOUBLE_SIZE,
  ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT,
  LINE_SPACING_DEFAULT, LINE_SPACING_SET,
  FEED_LINE, FEED_LINES,
  CUT_PAPER, CUT_PAPER_PARTIAL, CUT_PAPER_FEED,
  OPEN_DRAWER,
  CHARSET_PC437, CHARSET_PC850, CHARSET_PC866, CHARSET_WPC1252,
  CODEPAGE_CYRILLIC,
  BARCODE_HEIGHT, BARCODE_WIDTH,
  BARCODE_TEXT_BELOW, BARCODE_TEXT_ABOVE, BARCODE_TEXT_NONE,
  BARCODE_TYPES,
  QR_MODEL, QR_SIZE, QR_ERROR_CORRECTION,
  
  // Functions
  buildBarcode,
  buildQRCode,
  buildText,
  buildReceipt,
  buildTestReceipt,
  formatMoney,
};
