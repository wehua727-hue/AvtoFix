/**
 * Printing Module Types
 * ESC/POS Receipt Printer Support
 */

// Printer connection types
export type PrinterConnectionType = 'usb' | 'serial' | 'network' | 'windows';

// Printer info returned from detection
export interface PrinterInfo {
  id: string;
  name: string;
  connectionType: PrinterConnectionType;
  path?: string;        // USB/Serial path or IP:port
  vendorId?: number;    // USB vendor ID
  productId?: number;   // USB product ID
  isDefault?: boolean;
  status?: 'online' | 'offline' | 'unknown';
}

// Printer settings saved by user
export interface PrinterSettings {
  defaultPrinterId: string | null;
  printerName: string | null;
  paperWidth: 58 | 80;  // mm
  encoding: 'cp866' | 'cp1251' | 'utf8';
  autoCut: boolean;
  openCashDrawer: boolean;
  printLogo: boolean;
  copies: number;
}

// ESC/POS text alignment
export type TextAlign = 'left' | 'center' | 'right';

// ESC/POS text style
export interface TextStyle {
  bold?: boolean;
  underline?: boolean;
  doubleWidth?: boolean;
  doubleHeight?: boolean;
  inverted?: boolean;
}

// Barcode types supported by ESC/POS
export type BarcodeType = 
  | 'UPC-A' | 'UPC-E' | 'EAN13' | 'EAN8' 
  | 'CODE39' | 'ITF' | 'CODABAR' | 'CODE93' | 'CODE128';

// QR Code error correction level
export type QRErrorLevel = 'L' | 'M' | 'Q' | 'H';

// Receipt line item
export interface ReceiptLineItem {
  name: string;
  qty: number;
  price: number;
  total: number;
  unit?: string;
}

// Receipt data structure
export interface ReceiptData {
  // Header
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeLogo?: string;  // Base64 image
  
  // Transaction info
  receiptNumber: string;
  date: string;
  time: string;
  cashier?: string;
  
  // Items
  items: ReceiptLineItem[];
  
  // Totals
  subtotal: number;
  discount?: number;
  discountPercent?: number;
  tax?: number;
  total: number;
  
  // Payment
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
  amountPaid?: number;
  change?: number;
  
  // Footer
  footerText?: string;
  qrCode?: string;      // QR code data (e.g., receipt URL)
  barcode?: string;     // Barcode data
  barcodeType?: BarcodeType;
  
  // Customer
  customerName?: string;
  customerPhone?: string;
}

// Print job request
export interface PrintJobRequest {
  printerId: string;
  receipt: ReceiptData;
  copies?: number;
  openDrawer?: boolean;
}

// Print job response
export interface PrintJobResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

// Printer list response
export interface PrinterListResponse {
  success: boolean;
  printers: PrinterInfo[];
  error?: string;
}

// Test print request
export interface TestPrintRequest {
  printerId: string;
}

// Raw ESC/POS print request (for advanced users)
export interface RawPrintRequest {
  printerId: string;
  commands: number[];  // Raw ESC/POS byte array
}
