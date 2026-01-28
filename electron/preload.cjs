const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => process.platform,
  
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  
  // Server status
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  
  // Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  
  // Check if running in Electron
  isElectron: true,
  
  // ============ Printer API ============
  
  // List all available printers
  printerList: () => ipcRenderer.invoke('printer-list'),
  
  // Set default printer
  printerSetDefault: (printerId) => ipcRenderer.invoke('printer-set-default', printerId),
  
  // Get default printer
  printerGetDefault: () => ipcRenderer.invoke('printer-get-default'),
  
  // Add network printer
  printerAddNetwork: (host, port, name) => ipcRenderer.invoke('printer-add-network', { host, port, name }),
  
  // Remove network printer
  printerRemoveNetwork: (host, port) => ipcRenderer.invoke('printer-remove-network', { host, port }),
  
  // Scan network for printers
  printerScanNetwork: (subnet, startIp, endIp) => ipcRenderer.invoke('printer-scan-network', { subnet, startIp, endIp }),
  
  // Print test receipt
  printerTest: (printerId) => ipcRenderer.invoke('printer-test', printerId),
  
  // Print receipt
  printerPrintReceipt: (printerId, receipt) => ipcRenderer.invoke('printer-print-receipt', { printerId, receipt }),
  
  // Print text
  printerPrintText: (printerId, text, options) => ipcRenderer.invoke('printer-print-text', { printerId, text, options }),
  
  // Print barcode label
  printerPrintLabel: (printerId, label) => ipcRenderer.invoke('printer-print-label', { printerId, label }),
  
  // Print multiple labels
  printerPrintLabels: (printerId, labels) => ipcRenderer.invoke('printer-print-labels', { printerId, labels }),
  
  // Open cash drawer
  printerOpenDrawer: (printerId) => ipcRenderer.invoke('printer-open-drawer', printerId),
  
  // Get printer status
  printerStatus: (printerId) => ipcRenderer.invoke('printer-status', printerId),
  
  // Print raw ESC/POS data
  printerPrintRaw: (printerId, data) => ipcRenderer.invoke('printer-print-raw', { printerId, data }),

  // ============ Device API (legacy) ============
  
  // List all devices (printers, scanners, etc.)
  listDevices: async () => {
    try {
      const result = await ipcRenderer.invoke('printer-list');
      return {
        printers: result.printers || [],
        others: []
      };
    } catch (e) {
      return { printers: [], others: [] };
    }
  },
});

console.log('[Preload] Electron API exposed to renderer');
