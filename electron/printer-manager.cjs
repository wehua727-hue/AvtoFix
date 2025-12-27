/**
 * Printer Manager
 * Detects USB, Serial (COM), and Network printers
 * Manages printer configuration and selection
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

const CONFIG_PATH = path.join(__dirname, 'printer-config.json');

// Default network printer ports
const DEFAULT_PRINTER_PORT = 9100;

// Common USB Vendor IDs for receipt printers
const PRINTER_VENDOR_IDS = {
  '0x04b8': 'Epson',
  '0x0519': 'Star Micronics',
  '0x0dd4': 'Custom',
  '0x0fe6': 'Xprinter',
  '0x0483': 'STMicroelectronics',
  '0x1504': 'Rongta',
  '0x0416': 'Winbond',
  '0x1fc9': 'NXP',
  '0x28e9': 'GD32',
  '0x1a86': 'QinHeng (CH340)',
  '0x067b': 'Prolific (PL2303)',
  '0x10c4': 'Silicon Labs (CP210x)',
  '0x0403': 'FTDI',
};

/**
 * Load printer configuration
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[PrinterManager] Failed to load config:', e.message);
  }
  return {
    defaultPrinterId: null,
    networkPrinters: [],
    printerSettings: {},
  };
}

/**
 * Save printer configuration
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[PrinterManager] Failed to save config:', e.message);
    return false;
  }
}

async function detectUsbPrinters() {
  const printers = [];
  
  let windowsPrinters = [];
  try {
    windowsPrinters = await detectWindowsPrinters();
  } catch (e) {
  }
  
  try {
    const escposUsb = require('escpos-usb');
    const devices = escposUsb.findPrinter();
    
    devices.forEach((device) => {
      const vendorId = device.deviceDescriptor?.idVendor;
      const productId = device.deviceDescriptor?.idProduct;
      const vendorHex = vendorId ? `0x${vendorId.toString(16).padStart(4, '0')}` : '';
      const productHex = productId ? `0x${productId.toString(16).padStart(4, '0')}` : '';
      const vendorName = PRINTER_VENDOR_IDS[vendorHex] || 'Unknown';
      
      // Try to find matching Windows printer by vendor name
      const matchingWindows = windowsPrinters.find(wp => 
        wp.name.toLowerCase().includes(vendorName.toLowerCase()) ||
        (vendorName === 'Epson' && wp.name.toLowerCase().includes('epson'))
      );
      
      printers.push({
        id: `usb-${vendorHex}-${productHex}`,
        type: 'usb',
        name: `${vendorName} USB Printer (${vendorHex}:${productHex})`,
        vendorId,
        productId,
        vendorHex,
        productHex,
        vendorName,
        // Add Windows printer name for fallback printing
        windowsName: matchingWindows?.name || null,
        windowsPort: matchingWindows?.port || null,
      });
    });
  } catch (e) {
    console.error('[PrinterManager] USB detection error:', e.message);
  }
  
  return printers;
}

/**
 * Detect Serial (COM) printers
 */
async function detectSerialPrinters() {
  const printers = [];
  
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    
    ports.forEach((port) => {
      // Filter likely printer ports
      const isPrinter = 
        port.manufacturer?.toLowerCase().includes('printer') ||
        port.pnpId?.toLowerCase().includes('printer') ||
        PRINTER_VENDOR_IDS[`0x${port.vendorId?.toLowerCase()}`] ||
        port.path?.toLowerCase().includes('com');
      
      if (isPrinter || port.path) {
        const vendorName = port.vendorId 
          ? PRINTER_VENDOR_IDS[`0x${port.vendorId.toLowerCase()}`] || 'Serial'
          : 'Serial';
        
        printers.push({
          id: `serial-${port.path}`,
          type: 'serial',
          name: port.friendlyName || `${vendorName} (${port.path})`,
          path: port.path,
          vendorId: port.vendorId,
          productId: port.productId,
          manufacturer: port.manufacturer,
          serialNumber: port.serialNumber,
          pnpId: port.pnpId,
        });
      }
    });
  } catch (e) {
    console.error('[PrinterManager] Serial detection error:', e.message);
  }
  
  return printers;
}

/**
 * Get Windows system printers
 */
async function detectWindowsPrinters() {
  const printers = [];
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get printers using PowerShell
    const { stdout } = await execAsync(
      'powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 5000 }
    );
    
    const parsed = JSON.parse(stdout || '[]');
    const printerList = Array.isArray(parsed) ? parsed : [parsed];
    
    printerList.forEach((p) => {
      if (p.Name) {
        printers.push({
          id: `windows-${p.Name.replace(/\s+/g, '-')}`,
          type: 'windows',
          name: p.Name,
          driver: p.DriverName,
          port: p.PortName,
          status: p.PrinterStatus,
        });
      }
    });
  } catch (e) {
    console.error('[PrinterManager] Windows printer detection error:', e.message);
  }
  
  return printers;
}


/**
 * Check if network printer is reachable
 */
async function checkNetworkPrinter(host, port = DEFAULT_PRINTER_PORT, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      resolved = true;
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    
    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    
    socket.connect(port, host);
  });
}

/**
 * Scan local network for printers
 */
async function scanNetworkPrinters(subnet = '192.168.1', startIp = 1, endIp = 254) {
  const printers = [];
  const promises = [];
  
  for (let i = startIp; i <= endIp; i++) {
    const host = `${subnet}.${i}`;
    promises.push(
      checkNetworkPrinter(host).then((reachable) => {
        if (reachable) {
          return { host, port: DEFAULT_PRINTER_PORT };
        }
        return null;
      })
    );
  }
  
  const results = await Promise.all(promises);
  results.forEach((result, idx) => {
    if (result) {
      printers.push({
        id: `network-${result.host}`,
        type: 'network',
        name: `Network Printer (${result.host}:${result.port})`,
        host: result.host,
        port: result.port,
      });
    }
  });
  
  return printers;
}

/**
 * Get configured network printers
 */
function getConfiguredNetworkPrinters() {
  const config = loadConfig();
  return (config.networkPrinters || []).map((p, idx) => ({
    id: `network-${p.host}-${p.port || DEFAULT_PRINTER_PORT}`,
    type: 'network',
    name: p.name || `LAN Printer (${p.host}:${p.port || DEFAULT_PRINTER_PORT})`,
    host: p.host,
    port: p.port || DEFAULT_PRINTER_PORT,
    configured: true,
  }));
}

/**
 * Add network printer to configuration
 */
function addNetworkPrinter(host, port = DEFAULT_PRINTER_PORT, name = null) {
  const config = loadConfig();
  config.networkPrinters = config.networkPrinters || [];
  
  // Check if already exists
  const exists = config.networkPrinters.some(
    (p) => p.host === host && (p.port || DEFAULT_PRINTER_PORT) === port
  );
  
  if (!exists) {
    config.networkPrinters.push({
      host,
      port,
      name: name || `LAN Printer (${host}:${port})`,
    });
    saveConfig(config);
  }
  
  return config;
}

/**
 * Remove network printer from configuration
 */
function removeNetworkPrinter(host, port = DEFAULT_PRINTER_PORT) {
  const config = loadConfig();
  config.networkPrinters = (config.networkPrinters || []).filter(
    (p) => !(p.host === host && (p.port || DEFAULT_PRINTER_PORT) === port)
  );
  saveConfig(config);
  return config;
}

/**
 * List all available printers
 */
async function listPrinters(options = {}) {
  const config = loadConfig();
  
  const [usb, serial, windows, network] = await Promise.all([
    options.skipUsb ? [] : detectUsbPrinters(),
    options.skipSerial ? [] : detectSerialPrinters(),
    options.skipWindows ? [] : detectWindowsPrinters(),
    getConfiguredNetworkPrinters(),
  ]);
  
  const printers = [...usb, ...serial, ...windows, ...network];
  
  // Mark default printer
  printers.forEach((p) => {
    p.isDefault = p.id === config.defaultPrinterId;
  });
  
  return {
    printers,
    defaultPrinterId: config.defaultPrinterId,
    settings: config.printerSettings || {},
  };
}

/**
 * Set default printer
 */
function setDefaultPrinter(printerId) {
  const config = loadConfig();
  config.defaultPrinterId = printerId;
  saveConfig(config);
  return { success: true, defaultPrinterId: printerId };
}

/**
 * Get default printer
 */
function getDefaultPrinter() {
  const config = loadConfig();
  return config.defaultPrinterId;
}

/**
 * Save printer settings
 */
function savePrinterSettings(printerId, settings) {
  const config = loadConfig();
  config.printerSettings = config.printerSettings || {};
  config.printerSettings[printerId] = {
    ...config.printerSettings[printerId],
    ...settings,
  };
  saveConfig(config);
  return config.printerSettings[printerId];
}

/**
 * Get printer settings
 */
function getPrinterSettings(printerId) {
  const config = loadConfig();
  return config.printerSettings?.[printerId] || {};
}

/**
 * Find printer by ID
 */
async function findPrinterById(printerId) {
  const { printers } = await listPrinters();
  return printers.find((p) => p.id === printerId) || null;
}

module.exports = {
  loadConfig,
  saveConfig,
  detectUsbPrinters,
  detectSerialPrinters,
  detectWindowsPrinters,
  checkNetworkPrinter,
  scanNetworkPrinters,
  getConfiguredNetworkPrinters,
  addNetworkPrinter,
  removeNetworkPrinter,
  listPrinters,
  setDefaultPrinter,
  getDefaultPrinter,
  savePrinterSettings,
  getPrinterSettings,
  findPrinterById,
  DEFAULT_PRINTER_PORT,
  PRINTER_VENDOR_IDS,
};
