/**
 * OFFLINE PRINTING SYSTEM
 * Offline rejimda chek chop etish
 * 
 * Xususiyatlar:
 * - Browser print (fallback)
 * - WebUSB ESC/POS (optional)
 * - Offline receipt number
 * - Professional receipt template
 */

import { OfflineSale, OfflineSaleItem } from '../db/offlineDB';

// ============================================
// RECEIPT TEMPLATE
// ============================================

interface ReceiptConfig {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  footerText?: string;
}

const defaultConfig: ReceiptConfig = {
  storeName: 'AVTOFIX DO\'KON',
  storeAddress: 'Toshkent shahri',
  storePhone: '+998 90 123 45 67',
  footerText: 'Xaridingiz uchun rahmat!'
};

/**
 * Chek HTML generatsiya qilish
 */
export function generateReceiptHTML(
  sale: OfflineSale,
  config: ReceiptConfig = defaultConfig
): string {
  const { storeName, storeAddress, storePhone, footerText } = { ...defaultConfig, ...config };
  
  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const itemsHTML = sale.items.map(item => {
    const itemTotal = item.quantity * item.price;
    const discountAmount = (itemTotal * item.discount) / 100;
    const finalPrice = itemTotal - discountAmount;
    
    return `
      <tr>
        <td class="item-name">${item.name}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-price">${finalPrice.toLocaleString()}</td>
      </tr>
      ${item.discount > 0 ? `
        <tr class="discount-row">
          <td colspan="3">Chegirma: -${item.discount}%</td>
        </tr>
      ` : ''}
    `;
  }).join('');

  const isRefund = sale.saleType === 'refund';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chek #${sale.recipientNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      width: 58mm;
      max-width: 58mm;
      margin: 0 auto;
      padding: 2mm;
      background: white;
      color: black;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .store-name {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .store-info {
      font-size: 10px;
      color: #333;
    }
    .receipt-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 11px;
    }
    .receipt-number {
      font-weight: bold;
    }
    ${isRefund ? `
    .refund-badge {
      background: #ff0000;
      color: white;
      padding: 4px 8px;
      text-align: center;
      font-weight: bold;
      margin-bottom: 8px;
    }
    ` : ''}
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    th {
      text-align: left;
      border-bottom: 1px solid #000;
      padding: 4px 0;
      font-size: 11px;
    }
    td {
      padding: 4px 0;
      vertical-align: top;
    }
    .item-name {
      width: 50%;
    }
    .item-qty {
      width: 20%;
      text-align: center;
    }
    .item-price {
      width: 30%;
      text-align: right;
    }
    .discount-row {
      font-size: 10px;
      color: #666;
    }
    .totals {
      border-top: 1px dashed #000;
      padding-top: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .grand-total {
      font-size: 16px;
      font-weight: bold;
      border-top: 2px solid #000;
      padding-top: 8px;
      margin-top: 8px;
    }
    .payment-type {
      text-align: center;
      margin: 8px 0;
      padding: 4px;
      background: #f0f0f0;
    }
    .footer {
      text-align: center;
      border-top: 1px dashed #000;
      padding-top: 8px;
      margin-top: 8px;
      font-size: 11px;
    }
    .offline-badge {
      font-size: 9px;
      color: #666;
      margin-top: 4px;
    }
    @media print {
      body {
        width: 58mm;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="store-name">${storeName}</div>
    <div class="store-info">${storeAddress}</div>
    <div class="store-info">Tel: ${storePhone}</div>
  </div>

  ${isRefund ? '<div class="refund-badge">QAYTARISH</div>' : ''}

  <div class="receipt-info">
    <span class="receipt-number">Chek: ${sale.recipientNumber}</span>
    <span>${dateStr} ${timeStr}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>Mahsulot</th>
        <th style="text-align:center">Soni</th>
        <th style="text-align:right">Narxi</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="totals">
    ${sale.discount > 0 ? `
      <div class="total-row">
        <span>Chegirma:</span>
        <span>-${sale.discount.toLocaleString()} so'm</span>
      </div>
    ` : ''}
    <div class="total-row grand-total">
      <span>JAMI:</span>
      <span>${isRefund ? '-' : ''}${sale.total.toLocaleString()} so'm</span>
    </div>
  </div>

  <div class="payment-type">
    To'lov turi: ${sale.paymentType}
  </div>

  <div class="footer">
    <div>${footerText}</div>
    <div class="offline-badge">Offline chek</div>
  </div>
</body>
</html>
  `;
}

/**
 * Chekni chop etish (browser print)
 */
export function printReceiptOffline(
  sale: OfflineSale,
  config?: ReceiptConfig
): void {
  const html = generateReceiptHTML(sale, config);
  
  const printWindow = window.open('', '_blank', 'width=320,height=600');
  if (!printWindow) {
    console.error('[Print] Failed to open print window');
    alert('Chop etish oynasini ochib bo\'lmadi. Pop-up blocker ni o\'chiring.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    // Close after print dialog
    setTimeout(() => {
      printWindow.close();
    }, 1000);
  };
}

/**
 * Chekni PDF sifatida saqlash (optional)
 */
export function downloadReceiptAsPDF(
  sale: OfflineSale,
  config?: ReceiptConfig
): void {
  const html = generateReceiptHTML(sale, config);
  
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `chek-${sale.recipientNumber}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// ESC/POS PRINTING (WebUSB) - Optional
// ============================================

/**
 * ESC/POS printer bilan ulanish
 * Bu funksiya faqat WebUSB qo'llab-quvvatlaydigan brauzerlarda ishlaydi
 */
export async function connectESCPOSPrinter(): Promise<USBDevice | null> {
  if (!('usb' in navigator)) {
    console.warn('[Print] WebUSB not supported');
    return null;
  }

  try {
    const device = await (navigator as any).usb.requestDevice({
      filters: [
        { vendorId: 0x0483 }, // Common thermal printer vendor
        { vendorId: 0x0416 }, // Another common vendor
        { vendorId: 0x04b8 }, // Epson
      ]
    });

    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);

    console.log('[Print] ESC/POS printer connected:', device.productName);
    return device;
  } catch (error) {
    console.error('[Print] Failed to connect ESC/POS printer:', error);
    return null;
  }
}

/**
 * ESC/POS formatida chek chop etish
 */
export async function printESCPOS(
  device: USBDevice,
  sale: OfflineSale
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const commands: number[] = [];

    // ESC/POS commands
    const ESC = 0x1B;
    const GS = 0x1D;
    const LF = 0x0A;

    // Initialize printer
    commands.push(ESC, 0x40); // ESC @

    // Center align
    commands.push(ESC, 0x61, 0x01); // ESC a 1

    // Store name (bold, double size)
    commands.push(ESC, 0x45, 0x01); // Bold on
    commands.push(GS, 0x21, 0x11); // Double width/height
    commands.push(...encoder.encode('AVTOFIX\n'));
    commands.push(GS, 0x21, 0x00); // Normal size
    commands.push(ESC, 0x45, 0x00); // Bold off

    // Receipt number
    commands.push(...encoder.encode(`Chek: ${sale.recipientNumber}\n`));
    commands.push(...encoder.encode(`${new Date(sale.createdAt).toLocaleString()}\n`));
    commands.push(...encoder.encode('--------------------------------\n'));

    // Left align for items
    commands.push(ESC, 0x61, 0x00); // ESC a 0

    // Items
    for (const item of sale.items) {
      const total = item.quantity * item.price;
      commands.push(...encoder.encode(`${item.name}\n`));
      commands.push(...encoder.encode(`  ${item.quantity} x ${item.price.toLocaleString()} = ${total.toLocaleString()}\n`));
    }

    commands.push(...encoder.encode('--------------------------------\n'));

    // Total (bold)
    commands.push(ESC, 0x45, 0x01);
    commands.push(...encoder.encode(`JAMI: ${sale.total.toLocaleString()} so'm\n`));
    commands.push(ESC, 0x45, 0x00);

    // Payment type
    commands.push(...encoder.encode(`To'lov: ${sale.paymentType}\n`));

    // Footer
    commands.push(ESC, 0x61, 0x01); // Center
    commands.push(...encoder.encode('\nRahmat!\n\n\n'));

    // Cut paper
    commands.push(GS, 0x56, 0x00); // Full cut

    // Send to printer
    const data = new Uint8Array(commands);
    await device.transferOut(1, data);

    console.log('[Print] ESC/POS print completed');
    return true;
  } catch (error) {
    console.error('[Print] ESC/POS print failed:', error);
    return false;
  }
}
