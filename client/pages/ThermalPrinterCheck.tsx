import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';

interface CheckItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface CheckData {
  type: 'sale' | 'refund';
  items: CheckItem[];
  total: number;
  paymentType: string;
  cashier?: string;
  storeName?: string;
  receiptNumber?: string;
}

export default function ThermalPrinterCheck() {
  const [checkData, setCheckData] = useState<CheckData>({
    type: 'sale',
    items: [
      { name: 'Shimmer 16v', quantity: 1, price: 250000, total: 250000 },
      { name: 'Filtr', quantity: 2, price: 50000, total: 100000 },
      { name: 'Moy', quantity: 1, price: 180000, total: 180000 },
    ],
    total: 530000,
    paymentType: 'Naqd',
    cashier: 'Javohir',
    storeName: 'AVTOFIX - Toshkent',
    receiptNumber: 'CHK-001',
  });

  const checkRef = useRef<HTMLDivElement>(null);

  // QR Code yaratish
  useEffect(() => {
    const loadQRCode = async () => {
      // qrcode.js kutubxonasini dinamik yuklash
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.async = true;
      script.onload = () => {
        const qrContainer = document.getElementById('qrcode-container');
        if (qrContainer && (window as any).QRCode) {
          qrContainer.innerHTML = ''; // Eski QR ni o'chirish
          new (window as any).QRCode(qrContainer, {
            text: `https://avtofix.uz/check/${checkData.receiptNumber}`,
            width: 100,
            height: 100,
            colorDark: '#000000',
            colorLight: '#FFFFFF',
            correctLevel: (window as any).QRCode.CorrectLevel.H,
          });
        }
      };
      document.head.appendChild(script);
    };

    loadQRCode();
  }, [checkData.receiptNumber]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && checkRef.current) {
      const html = checkRef.current.innerHTML;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Check</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              margin: 0 auto;
              padding: 0;
              background: white;
              color: black;
            }
            @media print {
              body { width: 80mm; margin: 0; padding: 0; }
              .no-print { display: none; }
            }
            .check-container {
              width: 80mm;
              padding: 5mm;
              border: 2px solid black;
              background: white;
              color: black;
            }
            .header {
              text-align: center;
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 5mm;
              border-bottom: 2px solid black;
              padding-bottom: 3mm;
            }
            .store-name {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 2mm;
            }
            .receipt-type {
              text-align: center;
              font-weight: bold;
              font-size: 12px;
              margin: 3mm 0;
              text-decoration: underline;
            }
            .meta-info {
              font-size: 10px;
              text-align: center;
              margin-bottom: 3mm;
              border-bottom: 1px dashed black;
              padding-bottom: 2mm;
            }
            .items-section {
              margin: 3mm 0;
              border-bottom: 1px dashed black;
              padding-bottom: 2mm;
            }
            .item {
              font-size: 10px;
              margin-bottom: 2mm;
              display: flex;
              justify-content: space-between;
            }
            .item-name {
              flex: 1;
              word-wrap: break-word;
              max-width: 50mm;
            }
            .item-qty {
              width: 15mm;
              text-align: right;
            }
            .item-price {
              width: 15mm;
              text-align: right;
            }
            .total-section {
              margin: 3mm 0;
              border-top: 2px solid black;
              border-bottom: 2px solid black;
              padding: 2mm 0;
              text-align: right;
              font-weight: bold;
              font-size: 12px;
            }
            .payment-info {
              font-size: 10px;
              text-align: center;
              margin: 2mm 0;
            }
            .qr-section {
              text-align: center;
              margin: 3mm 0;
              padding: 2mm 0;
              border-top: 1px dashed black;
              border-bottom: 1px dashed black;
            }
            .qr-code {
              display: inline-block;
              margin: 2mm auto;
            }
            .qr-code img {
              width: 80px;
              height: 80px;
              image-rendering: pixelated;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              margin-top: 3mm;
              padding-top: 2mm;
              border-top: 1px dashed black;
            }
            .footer-text {
              margin: 1mm 0;
              font-weight: bold;
            }
            .cashier-info {
              font-size: 9px;
              text-align: center;
              margin-top: 2mm;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const handleDownloadHTML = () => {
    if (checkRef.current) {
      const html = checkRef.current.innerHTML;
      const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Thermal Printer Check</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      margin: 0 auto;
      padding: 0;
      background: white;
      color: black;
    }
    @media print {
      body { width: 80mm; margin: 0; padding: 0; }
      .no-print { display: none; }
    }
    .check-container {
      width: 80mm;
      padding: 5mm;
      border: 2px solid black;
      background: white;
      color: black;
    }
    .header {
      text-align: center;
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 5mm;
      border-bottom: 2px solid black;
      padding-bottom: 3mm;
    }
    .store-name {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 2mm;
    }
    .receipt-type {
      text-align: center;
      font-weight: bold;
      font-size: 12px;
      margin: 3mm 0;
      text-decoration: underline;
    }
    .meta-info {
      font-size: 10px;
      text-align: center;
      margin-bottom: 3mm;
      border-bottom: 1px dashed black;
      padding-bottom: 2mm;
    }
    .items-section {
      margin: 3mm 0;
      border-bottom: 1px dashed black;
      padding-bottom: 2mm;
    }
    .item {
      font-size: 10px;
      margin-bottom: 2mm;
      display: flex;
      justify-content: space-between;
    }
    .item-name {
      flex: 1;
      word-wrap: break-word;
      max-width: 50mm;
    }
    .item-qty {
      width: 15mm;
      text-align: right;
    }
    .item-price {
      width: 15mm;
      text-align: right;
    }
    .total-section {
      margin: 3mm 0;
      border-top: 2px solid black;
      border-bottom: 2px solid black;
      padding: 2mm 0;
      text-align: right;
      font-weight: bold;
      font-size: 12px;
    }
    .payment-info {
      font-size: 10px;
      text-align: center;
      margin: 2mm 0;
    }
    .qr-section {
      text-align: center;
      margin: 3mm 0;
      padding: 2mm 0;
      border-top: 1px dashed black;
      border-bottom: 1px dashed black;
    }
    .qr-code {
      display: inline-block;
      margin: 2mm auto;
    }
    .qr-code img {
      width: 80px;
      height: 80px;
      image-rendering: pixelated;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 1px dashed black;
    }
    .footer-text {
      margin: 1mm 0;
      font-weight: bold;
    }
    .cashier-info {
      font-size: 9px;
      text-align: center;
      margin-top: 2mm;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
</head>
<body>
  ${html}
  <script>
    // QR Code yaratish
    const qrContainer = document.getElementById('qrcode-container');
    if (qrContainer && window.QRCode) {
      new QRCode(qrContainer, {
        text: 'AVTOFIX-${checkData.receiptNumber}',
        width: 100,
        height: 100,
        colorDark: '#000000',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H,
      });
    }
  </script>
</body>
</html>
      `;
      const blob = new Blob([fullHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `check-${checkData.receiptNumber}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Termal Printer Check</h1>

        {/* Preview */}
        <div className="bg-white p-4 rounded-lg mb-6 overflow-x-auto">
          <div ref={checkRef} style={{ width: '80mm', margin: '0 auto' }}>
            <div className="check-container" style={{ width: '80mm', padding: '5mm', border: '2px solid black', background: 'white', color: 'black', fontFamily: "'Courier New', monospace", fontSize: '10px' }}>
              {/* Store Name */}
              {checkData.storeName && (
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2mm', textAlign: 'center' }}>
                  {checkData.storeName}
                </div>
              )}

              {/* Receipt Type */}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', margin: '3mm 0', textDecoration: 'underline' }}>
                {checkData.type === 'sale' ? 'SOTUV CHEKI' : 'QAYTARISH CHEKI'}
              </div>

              {/* Meta Info */}
              <div style={{ fontSize: '10px', textAlign: 'center', marginBottom: '3mm', borderBottom: '1px dashed black', paddingBottom: '2mm' }}>
                {new Date().toLocaleString('ru-RU')}
              </div>

              {/* Items */}
              <div style={{ margin: '3mm 0', borderBottom: '1px dashed black', paddingBottom: '2mm' }}>
                {checkData.items.map((item, idx) => (
                  <div key={idx} style={{ fontSize: '10px', marginBottom: '2mm', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, maxWidth: '50mm', wordWrap: 'break-word' }}>{item.name}</div>
                    <div style={{ width: '15mm', textAlign: 'right' }}>{item.quantity}x</div>
                    <div style={{ width: '15mm', textAlign: 'right' }}>{item.total.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{ margin: '3mm 0', borderTop: '2px solid black', borderBottom: '2px solid black', padding: '2mm 0', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>
                JAMI: {checkData.total.toLocaleString()} so'm
              </div>

              {/* Payment */}
              <div style={{ fontSize: '10px', textAlign: 'center', margin: '2mm 0' }}>
                To'lov: {checkData.paymentType}
              </div>

              {/* QR Code */}
              <div style={{ textAlign: 'center', margin: '3mm 0', padding: '2mm 0', borderTop: '1px dashed black', borderBottom: '1px dashed black' }}>
                <div id="qrcode-container" style={{ display: 'inline-block', margin: '2mm auto' }}></div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '3mm', paddingTop: '2mm', borderTop: '1px dashed black' }}>
                <div style={{ margin: '1mm 0', fontWeight: 'bold' }}>Xaridingiz uchun rahmat!</div>
                <div style={{ margin: '1mm 0', fontWeight: 'bold' }}>AVTOFIX</div>
                <div>Sifatli ehtiyot qismlar</div>
              </div>

              {/* Cashier */}
              {checkData.cashier && (
                <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '2mm' }}>
                  Kassir: {checkData.cashier}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <Button onClick={handlePrint} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleDownloadHTML} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            HTML Download
          </Button>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-800 rounded-lg text-gray-300 text-sm">
          <h3 className="font-bold mb-2">Talablar:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Termal printer: XPRINTER 58mm yoki 80mm</li>
            <li>QR Code: JavaScript orqali yaratilgan (qrcode.js)</li>
            <li>Rang: Faqat qora-oq</li>
            <li>Emoji: Taqiqlanadi</li>
            <li>Offline: 100% ishlaydi</li>
            <li>Print o'lchami: 80x80 px QR code</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
