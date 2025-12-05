/**
 * Print Service
 * Handles direct printing to ESC/POS printers
 * Supports USB, Serial, Network, and Windows printers
 */

const net = require('net');
const { findPrinterById, getDefaultPrinter, listPrinters } = require('./printer-manager.cjs');
const {
  buildReceipt,
  buildTestReceipt,
  INIT,
  CUT_PAPER_PARTIAL,
  FEED_LINES,
  buildText,
  ALIGN_CENTER,
  TEXT_BOLD_ON,
  TEXT_NORMAL,
} = require('./escpos-commands.cjs');

/**
 * Print raw data to USB printer
 * Falls back to Windows printer if escpos-usb fails
 */
async function printToUsb(printer, data) {
  // First try Windows printer API (more reliable in packaged apps)
  if (printer.windowsName) {
    console.log('[PrintService] USB printer has Windows name, using Windows API');
    return printToWindows({ ...printer, name: printer.windowsName }, data);
  }

  return new Promise((resolve, reject) => {
    try {
      // Try escpos-usb
      const escposUsb = require('escpos-usb');
      const device = new escposUsb(printer.vendorId, printer.productId);
      
      device.open((err) => {
        if (err) {
          console.error('[PrintService] USB open error, falling back to Windows:', err.message);
          // Fallback to Windows printer
          if (printer.name) {
            printToWindows(printer, data).then(resolve).catch(reject);
          } else {
            reject(err);
          }
          return;
        }
        
        device.write(data, (writeErr) => {
          if (writeErr) {
            console.error('[PrintService] USB write error:', writeErr);
            device.close();
            return reject(writeErr);
          }
          
          device.close((closeErr) => {
            if (closeErr) {
              console.error('[PrintService] USB close error:', closeErr);
            }
            resolve({ success: true });
          });
        });
      });
    } catch (e) {
      console.error('[PrintService] escpos-usb error, falling back to Windows:', e.message);
      // Fallback to Windows printer
      if (printer.name) {
        printToWindows(printer, data).then(resolve).catch(reject);
      } else {
        reject(e);
      }
    }
  });
}

/**
 * Print raw data to Serial printer
 */
async function printToSerial(printer, data) {
  return new Promise((resolve, reject) => {
    try {
      const { SerialPort } = require('serialport');
      
      const port = new SerialPort({
        path: printer.path,
        baudRate: printer.baudRate || 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        autoOpen: false,
      });
      
      port.open((err) => {
        if (err) {
          console.error('[PrintService] Serial open error:', err);
          return reject(err);
        }
        
        port.write(data, (writeErr) => {
          if (writeErr) {
            console.error('[PrintService] Serial write error:', writeErr);
            port.close();
            return reject(writeErr);
          }
          
          port.drain((drainErr) => {
            port.close((closeErr) => {
              if (drainErr || closeErr) {
                console.error('[PrintService] Serial drain/close error:', drainErr || closeErr);
              }
              resolve({ success: true });
            });
          });
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Print raw data to Network printer
 */
async function printToNetwork(printer, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = printer.timeout || 10000;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      socket.write(data, (err) => {
        if (err) {
          console.error('[PrintService] Network write error:', err);
          socket.destroy();
          return reject(err);
        }
        
        // Give printer time to process
        setTimeout(() => {
          socket.end();
          resolve({ success: true });
        }, 500);
      });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Network printer timeout'));
    });
    
    socket.on('error', (err) => {
      console.error('[PrintService] Network error:', err);
      socket.destroy();
      reject(err);
    });
    
    socket.on('close', () => {
      // Connection closed
    });
    
    socket.connect(printer.port || 9100, printer.host);
  });
}

/**
 * Print using Windows spooler (for non-ESC/POS printers)
 */
async function printToWindows(printer, data) {
  return new Promise((resolve, reject) => {
    try {
      const { exec } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      // Create temp file
      const tempFile = path.join(os.tmpdir(), `print-${Date.now()}.bin`);
      fs.writeFileSync(tempFile, data);
      
      // Print using Windows command
      const cmd = `copy /b "${tempFile}" "${printer.port || printer.name}"`;
      
      exec(cmd, { encoding: 'utf8', timeout: 10000 }, (err, stdout, stderr) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {}
        
        if (err) {
          console.error('[PrintService] Windows print error:', err);
          return reject(err);
        }
        
        resolve({ success: true });
      });
    } catch (e) {
      reject(e);
    }
  });
}


/**
 * Print raw data to printer
 */
async function printRaw(printerId, data) {
  const printer = await findPrinterById(printerId);
  
  if (!printer) {
    throw new Error(`Printer not found: ${printerId}`);
  }
  
  console.log(`[PrintService] Printing to ${printer.type} printer: ${printer.name}`);
  
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  
  switch (printer.type) {
    case 'usb':
      return printToUsb(printer, buffer);
    case 'serial':
      return printToSerial(printer, buffer);
    case 'network':
      return printToNetwork(printer, buffer);
    case 'windows':
      return printToWindows(printer, buffer);
    default:
      throw new Error(`Unsupported printer type: ${printer.type}`);
  }
}

/**
 * Print receipt
 */
async function printReceipt(printerId, receiptData) {
  // Use default printer if not specified
  if (!printerId) {
    printerId = getDefaultPrinter();
  }
  
  if (!printerId) {
    const { printers } = await listPrinters();
    if (printers.length === 0) {
      throw new Error('No printers available');
    }
    printerId = printers[0].id;
  }
  
  const buffer = buildReceipt(receiptData);
  return printRaw(printerId, buffer);
}

/**
 * Print test receipt
 */
async function printTestReceipt(printerId) {
  // Use default printer if not specified
  if (!printerId) {
    printerId = getDefaultPrinter();
  }
  
  if (!printerId) {
    const { printers } = await listPrinters();
    if (printers.length === 0) {
      throw new Error('No printers available');
    }
    printerId = printers[0].id;
  }
  
  const buffer = buildTestReceipt();
  return printRaw(printerId, buffer);
}

/**
 * Print simple text
 */
async function printText(printerId, text, options = {}) {
  if (!printerId) {
    printerId = getDefaultPrinter();
  }
  
  const buffers = [INIT];
  
  if (options.center) {
    buffers.push(ALIGN_CENTER);
  }
  
  if (options.bold) {
    buffers.push(TEXT_BOLD_ON);
  }
  
  buffers.push(buildText(text));
  
  if (options.bold) {
    buffers.push(TEXT_NORMAL);
  }
  
  if (options.cut) {
    buffers.push(FEED_LINES(3), CUT_PAPER_PARTIAL);
  }
  
  const buffer = Buffer.concat(buffers);
  return printRaw(printerId, buffer);
}

/**
 * Open cash drawer
 */
async function openCashDrawer(printerId) {
  if (!printerId) {
    printerId = getDefaultPrinter();
  }
  
  const { OPEN_DRAWER } = require('./escpos-commands.cjs');
  const buffer = Buffer.concat([INIT, OPEN_DRAWER]);
  return printRaw(printerId, buffer);
}

/**
 * Print barcode label (Xprinter va boshqa ESC/POS label printerlar uchun)
 * 
 * Xprinter XP-365B, XP-420B, XP-460B va shunga o'xshash modellar uchun optimallashtirilgan
 * Qog'oz o'lchamiga moslashtirilgan (30mm, 40mm, 50mm, 60mm, 80mm)
 */
async function printBarcodeLabel(printerId, labelData) {
  if (!printerId) {
    printerId = getDefaultPrinter();
  }
  
  const {
    INIT,
    ALIGN_CENTER,
    ALIGN_LEFT,
    TEXT_BOLD_ON,
    TEXT_BOLD_OFF,
    TEXT_NORMAL,
    TEXT_DOUBLE_SIZE,
    TEXT_DOUBLE_HEIGHT,
    BARCODE_HEIGHT,
    BARCODE_WIDTH,
    BARCODE_TEXT_BELOW,
    buildBarcode,
    buildText,
    FEED_LINES,
    CUT_PAPER_PARTIAL,
    LINE_SPACING_SET,
  } = require('./escpos-commands.cjs');
  
  // Senik razmeri konfiguratsiyalari
  const LABEL_SIZE_CONFIGS = {
    small: { width: 40, height: 30, barcodeHeight: 30, barcodeWidth: 1 },
    large: { width: 60, height: 40, barcodeHeight: 50, barcodeWidth: 2 },
  };
  
  // Senik razmeridan yoki qo'lda kiritilgan o'lchamdan foydalanish
  const sizeConfig = labelData.labelSize ? LABEL_SIZE_CONFIGS[labelData.labelSize] : null;
  const paperWidth = sizeConfig?.width || labelData.paperWidth || 40;
  const paperHeight = sizeConfig?.height || labelData.paperHeight || 30;
  
  // Qog'oz kengligiga qarab maksimal belgilar soni
  const maxChars = {
    30: 16,
    40: 20,
    50: 26,
    60: 32,
    80: 42,
  };
  const maxNameLength = maxChars[paperWidth] || Math.floor(paperWidth / 2);
  
  // Razmerga qarab shrift va barcode o'lchamlari
  const isLarge = labelData.labelSize === 'large' || paperWidth >= 50;
  const isMedium = paperWidth >= 40;
  
  const buffers = [INIT];
  
  // Qator oralig'ini kamaytirish (label uchun kompakt)
  const lineSpacing = paperHeight <= 30 ? 16 : 18;
  buffers.push(LINE_SPACING_SET(lineSpacing));
  
  // Markazga tekislash
  buffers.push(ALIGN_CENTER);
  
  // Mahsulot nomi - qalin
  if (labelData.name) {
    buffers.push(TEXT_BOLD_ON);
    // Uzun nomlarni qisqartirish (label kengligi cheklangan)
    const name = labelData.name.length > maxNameLength 
      ? labelData.name.substring(0, maxNameLength - 2) + '..' 
      : labelData.name;
    buffers.push(buildText(name));
    buffers.push(TEXT_BOLD_OFF);
  }
  
  // Narx - razmerga qarab shrift o'lchami
  if (labelData.price !== undefined) {
    if (isLarge) {
      buffers.push(TEXT_DOUBLE_SIZE);
    } else if (isMedium) {
      buffers.push(TEXT_DOUBLE_HEIGHT);
    }
    const formattedPrice = Number(labelData.price).toLocaleString('ru-RU');
    buffers.push(buildText(`${formattedPrice} so'm`));
    buffers.push(TEXT_NORMAL);
  }
  
  // Shtrix-kod
  if (labelData.barcode) {
    // Shtrix-kod balandligi - razmerga qarab
    const barcodeHeight = sizeConfig?.barcodeHeight || (isLarge ? 50 : isMedium ? 40 : 30);
    buffers.push(BARCODE_HEIGHT(barcodeHeight));
    
    // Shtrix-kod kengligi - razmerga qarab
    const barcodeWidth = sizeConfig?.barcodeWidth || (isLarge ? 2 : 1);
    buffers.push(BARCODE_WIDTH(barcodeWidth));
    
    buffers.push(BARCODE_TEXT_BELOW); // Raqamlar pastda
    
    // Shtrix-kod turi
    const barcodeType = labelData.barcodeType || 'CODE128';
    buffers.push(buildBarcode(labelData.barcode, barcodeType));
    
    // Qo'shimcha bo'sh joy
    buffers.push(Buffer.from([0x0A])); // Line feed
  }
  
  // SKU/Kod - har doim ko'rsatish (agar mavjud bo'lsa)
  if (labelData.sku) {
    buffers.push(buildText(`Kod: ${labelData.sku}`));
  }
  
  // Ombordagi soni - har doim ko'rsatish (agar mavjud bo'lsa)
  if (labelData.stock !== undefined) {
    buffers.push(buildText(`Ombor: ${labelData.stock} dona`));
  }
  
  // Label oxiri - ozgina bo'sh joy va kesish
  buffers.push(FEED_LINES(1));
  buffers.push(CUT_PAPER_PARTIAL);
  
  const buffer = Buffer.concat(buffers);
  return printRaw(printerId, buffer);
}

/**
 * Print multiple labels
 */
async function printBarcodeLabels(printerId, labels) {
  for (const label of labels) {
    await printBarcodeLabel(printerId, label);
  }
  return { success: true, count: labels.length };
}

/**
 * Get printer status (if supported)
 */
async function getPrinterStatus(printerId) {
  const printer = await findPrinterById(printerId);
  
  if (!printer) {
    return { online: false, error: 'Printer not found' };
  }
  
  // For network printers, check connection
  if (printer.type === 'network') {
    const { checkNetworkPrinter } = require('./printer-manager.cjs');
    const online = await checkNetworkPrinter(printer.host, printer.port);
    return { online, printer };
  }
  
  // For other types, assume online if found
  return { online: true, printer };
}

module.exports = {
  printRaw,
  printReceipt,
  printTestReceipt,
  printText,
  openCashDrawer,
  printBarcodeLabel,
  printBarcodeLabels,
  getPrinterStatus,
  printToUsb,
  printToSerial,
  printToNetwork,
  printToWindows,
};
