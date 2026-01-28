/**
 * POS Print Service - Yangilangan chiroyli check dizayni
 */

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
  userRole?: 'admin' | 'xodim' | 'ega';
}

/**
 * Chiroyli va tartibli check chop etish
 */
export function printViaBrowser(receipt: ReceiptData): boolean {
  const isRefund = receipt.type === 'refund' || receipt.type === 'defectiveRefund';
  const isDefectiveRefund = receipt.type === 'defectiveRefund';
  
  // Mahsulotlar jadvalini yaratish
  const itemsHtml = receipt.items
    .map((item, index) => {
      const itemTotal = item.quantity * item.price;
      const discountAmount = item.discount ? (itemTotal * item.discount) / 100 : 0;
      const finalTotal = itemTotal - discountAmount;
      const num = index + 1;
      return `
        <tr class="item-row">
          <td class="item-num">${num}</td>
          <td class="item-name">${item.name}${item.sku ? `<br><span class="item-sku">[${item.sku}]</span>` : ''}</td>
          <td class="item-qty">${item.quantity}</td>
          <td class="item-price">${item.price.toLocaleString()}</td>
          <td class="item-total">${finalTotal.toLocaleString()}</td>
        </tr>
        ${item.discount ? `<tr><td colspan="5" class="item-discount">Chegirma: -${item.discount}%</td></tr>` : ''}
      `;
    })
    .join('');

  const date = receipt.date || new Date();
  const isAdminRole = receipt.userRole === 'admin';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${isDefectiveRefund ? 'YAROQSIZ QAYTARISH' : isRefund ? 'QAYTARISH' : 'SOTUV CHEKI'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: 'Courier New', monospace;
          padding: 5mm;
          margin: 0 auto;
          width: 80mm;
          font-size: 11px;
          line-height: 1.4;
          background: white;
        }
        
        .header {
          text-align: center;
          margin-bottom: 8px;
        }
        .store-name {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 4px;
        }
        .store-info {
          font-size: 10px;
          line-height: 1.3;
        }
        
        .separator {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        
        .receipt-type {
          text-align: center;
          font-weight: bold;
          font-size: 14px;
          margin: 8px 0;
          text-transform: uppercase;
        }
        .receipt-type.refund {
          color: #d32f2f;
        }
        
        .meta-info {
          text-align: center;
          font-size: 10px;
          margin-bottom: 8px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        .items-table th {
          text-align: left;
          padding: 4px 2px;
          border-bottom: 1px solid #000;
          font-size: 10px;
          font-weight: bold;
        }
        .items-table th:first-child {
          width: 25px;
          text-align: center;
        }
        .items-table th:nth-child(3),
        .items-table th:nth-child(4),
        .items-table th:nth-child(5) {
          text-align: right;
          width: 60px;
        }
        .item-row td {
          padding: 4px 2px;
          border-bottom: 1px dotted #ccc;
          vertical-align: top;
        }
        .item-num {
          text-align: center;
          font-weight: bold;
        }
        .item-name {
          font-weight: bold;
        }
        .item-sku {
          font-size: 9px;
          color: #666;
        }
        .item-qty,
        .item-price,
        .item-total {
          text-align: right;
          font-weight: bold;
        }
        .item-discount {
          text-align: right;
          font-size: 9px;
          color: #666;
          padding: 2px;
        }
        
        .total-section {
          margin: 8px 0;
          padding: 8px 0;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 14px;
          padding: 4px 0;
        }
        .total-row.refund {
          color: #d32f2f;
        }
        
        .payment-info {
          text-align: center;
          font-size: 11px;
          margin: 8px 0;
          padding: 4px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        
        .qr-section {
          margin: 10px 0;
        }
        .qr-row {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin: 8px 0;
        }
        .qr-item {
          text-align: center;
        }
        .qr-code {
          width: 70px;
          height: 70px;
          background: white;
          border: 1px solid #ddd;
          display: inline-block;
        }
        .qr-label {
          font-size: 8px;
          margin-top: 3px;
          font-weight: bold;
        }
        
        .footer {
          text-align: center;
          margin-top: 10px;
          font-size: 11px;
        }
        
        @media print {
          body { 
            padding: 0;
            margin: 0;
            width: 80mm;
          }
          @page { 
            margin: 0;
            size: 80mm auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${receipt.storeName ? `<div class="store-name">${receipt.storeName}</div>` : ''}
        ${receipt.storeAddress || receipt.storePhone ? `
          <div class="store-info">
            ${receipt.storeAddress ? receipt.storeAddress + '<br>' : ''}
            ${receipt.storePhone ? `Tel: ${receipt.storePhone}` : ''}
          </div>
        ` : ''}
      </div>
      
      <div class="separator"></div>
      
      <div class="receipt-type ${isRefund ? 'refund' : ''}">
        ${isDefectiveRefund ? 'YAROQSIZ QAYTARISH' : isRefund ? 'QAYTARISH' : 'SOTUV CHEKI'}
      </div>
      
      <div class="meta-info">
        ${date.toLocaleString('uz-UZ', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}<br>
        ${receipt.cashier ? `Kassir: ${receipt.cashier}` : ''}
        ${receipt.receiptNumber ? `<br>Chek #${receipt.receiptNumber}` : ''}
      </div>
      
      <div class="separator"></div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Mahsulot</th>
            <th>Soni</th>
            <th>Narxi</th>
            <th>Summa</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div class="total-section">
        <div class="total-row ${isRefund ? 'refund' : ''}">
          <span>${isDefectiveRefund ? 'YAROQSIZ:' : isRefund ? 'QAYTARISH:' : 'JAMI:'}</span>
          <span>${isRefund ? '-' : ''}${receipt.total.toLocaleString()} so'm</span>
        </div>
      </div>
      
      <div class="payment-info">
        To'lov turi: ${receipt.paymentType}
      </div>
      
      <div class="separator"></div>
      
      ${!isAdminRole ? `
      <div class="qr-section">
        <div class="qr-row">
          <div class="qr-item">
            <div id="qrcode-instagram" class="qr-code"></div>
            <div class="qr-label">Instagram</div>
          </div>
          <div class="qr-item">
            <div id="qrcode-website" class="qr-code"></div>
            <div class="qr-label">avtofix.uz</div>
          </div>
        </div>
        
        <div class="qr-row">
          <div class="qr-item">
            <div id="qrcode-telegram-1" class="qr-code"></div>
            <div class="qr-label">@AvtoFix_GM</div>
          </div>
          <div class="qr-item">
            <div id="qrcode-telegram-2" class="qr-code"></div>
            <div class="qr-label">@AvtoFix_KAMAZ</div>
          </div>
        </div>
        
        <div class="qr-row">
          <div class="qr-item">
            <div id="qrcode-telegram-3" class="qr-code"></div>
            <div class="qr-label">@AVTOFIX_HOWO</div>
          </div>
          <div class="qr-item">
            <div id="qrcode-telegram-4" class="qr-code"></div>
            <div class="qr-label">@AvtoFix_ISUZU</div>
          </div>
        </div>
      </div>
      
      <div class="separator"></div>
      ` : ''}
      
      <div class="footer">
        <strong>Xaridingiz uchun rahmat!</strong>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // QR Code yaratish
    if (!isAdminRole) {
      const qrCodes = [
        { id: 'qrcode-instagram', text: 'https://www.instagram.com/avtofix_uz/', size: 70 },
        { id: 'qrcode-website', text: 'https://avtofix.uz', size: 70 },
        { id: 'qrcode-telegram-1', text: 'https://t.me/AvtoFix_GM', size: 70 },
        { id: 'qrcode-telegram-2', text: 'https://t.me/AvtoFix_KAMAZ', size: 70 },
        { id: 'qrcode-telegram-3', text: 'https://t.me/AVTOFIX_HOWO', size: 70 },
        { id: 'qrcode-telegram-4', text: 'https://t.me/AvtoFix_ISUZU', size: 70 },
      ];
      
      const script = printWindow.document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      
      script.onload = () => {
        qrCodes.forEach(qr => {
          const qrContainer = printWindow.document.getElementById(qr.id);
          if (qrContainer && (printWindow as any).QRCode) {
            try {
              new (printWindow as any).QRCode(qrContainer, {
                text: qr.text,
                width: qr.size,
                height: qr.size,
                colorDark: '#000000',
                colorLight: '#FFFFFF',
                correctLevel: (printWindow as any).QRCode.CorrectLevel.H,
              });
            } catch (e) {
              console.error(`QR code error ${qr.id}:`, e);
            }
          }
        });
      };
      
      printWindow.document.head.appendChild(script);
    }
    
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1500);
    }, 1000);
    
    return true;
  }
  
  return false;
}
