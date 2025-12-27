/**
 * Electron Main Process
 * Запускает локальный сервер и создает окно приложения
 */

const { app, BrowserWindow, dialog, ipcMain, Notification } = require('electron');
const path = require('path');
const { startServer, stopServer, PORT } = require('./server.cjs');

// Printer modules
const printerManager = require('./printer-manager.cjs');
const printService = require('./print-service.cjs');

let mainWindow = null;
let serverStarted = false;

// Determine if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow() {
  console.log('[Main] Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '..', 'public', 'electron_icon.ico'),
    show: false, // Don't show until ready
    backgroundColor: '#ffffff',
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[Main] Window shown');
  });

  // Load URL
  const url = isDev 
    ? 'http://localhost:5174'  // Vite dev server
    : `http://127.0.0.1:${PORT}`;  // Local Express server
  
  console.log('[Main] Loading URL:', url);
  
  try {
    await mainWindow.loadURL(url);
    console.log('[Main] URL loaded successfully');
  } catch (error) {
    console.error('[Main] Failed to load URL:', error.message);
    dialog.showErrorBox(
      'Ошибка загрузки',
      `Не удалось загрузить приложение.\n\nURL: ${url}\nОшибка: ${error.message}\n\nУбедитесь, что сервер запущен.`
    );
  }

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // F12 to open DevTools in production (for debugging)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-server-status', () => {
  return {
    started: serverStarted,
    port: PORT,
    url: `http://127.0.0.1:${PORT}`,
  };
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// ============ Printer IPC Handlers ============

// List all printers
ipcMain.handle('printer-list', async () => {
  try {
    return await printerManager.listPrinters();
  } catch (error) {
    console.error('[Main] printer-list error:', error);
    return { printers: [], error: error.message };
  }
});

// Set default printer
ipcMain.handle('printer-set-default', async (event, printerId) => {
  try {
    return printerManager.setDefaultPrinter(printerId);
  } catch (error) {
    console.error('[Main] printer-set-default error:', error);
    return { success: false, error: error.message };
  }
});

// Get default printer
ipcMain.handle('printer-get-default', async () => {
  try {
    return { printerId: printerManager.getDefaultPrinter() };
  } catch (error) {
    return { printerId: null, error: error.message };
  }
});

// Add network printer
ipcMain.handle('printer-add-network', async (event, { host, port, name }) => {
  try {
    printerManager.addNetworkPrinter(host, port, name);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Remove network printer
ipcMain.handle('printer-remove-network', async (event, { host, port }) => {
  try {
    printerManager.removeNetworkPrinter(host, port);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Scan network for printers
ipcMain.handle('printer-scan-network', async (event, { subnet, startIp, endIp }) => {
  try {
    const printers = await printerManager.scanNetworkPrinters(subnet, startIp, endIp);
    return { printers };
  } catch (error) {
    return { printers: [], error: error.message };
  }
});

// Print test receipt
ipcMain.handle('printer-test', async (event, printerId) => {
  try {
    await printService.printTestReceipt(printerId);
    return { success: true };
  } catch (error) {
    console.error('[Main] printer-test error:', error);
    return { success: false, error: error.message };
  }
});

// Print receipt
ipcMain.handle('printer-print-receipt', async (event, { printerId, receipt }) => {
  try {
    await printService.printReceipt(printerId, receipt);
    return { success: true };
  } catch (error) {
    console.error('[Main] printer-print-receipt error:', error);
    return { success: false, error: error.message };
  }
});

// Print text
ipcMain.handle('printer-print-text', async (event, { printerId, text, options }) => {
  try {
    await printService.printText(printerId, text, options);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Print barcode label
ipcMain.handle('printer-print-label', async (event, { printerId, label }) => {
  try {
    await printService.printBarcodeLabel(printerId, label);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Print multiple labels
ipcMain.handle('printer-print-labels', async (event, { printerId, labels }) => {
  try {
    const result = await printService.printBarcodeLabels(printerId, labels);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open cash drawer
ipcMain.handle('printer-open-drawer', async (event, printerId) => {
  try {
    await printService.openCashDrawer(printerId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get printer status
ipcMain.handle('printer-status', async (event, printerId) => {
  try {
    return await printService.getPrinterStatus(printerId);
  } catch (error) {
    return { online: false, error: error.message };
  }
});

// Print raw data
ipcMain.handle('printer-print-raw', async (event, { printerId, data }) => {
  try {
    const buffer = Buffer.from(data);
    await printService.printRaw(printerId, buffer);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(async () => {
  console.log('[Main] App ready');
  console.log('[Main] isDev:', isDev);
  console.log('[Main] isPackaged:', app.isPackaged);
  
  try {
    // In production, start the local server first
    if (!isDev) {
      console.log('[Main] Starting local server...');
      await startServer();
      serverStarted = true;
      console.log('[Main] Server started successfully');
      
      // Wait a bit for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Create window
    await createWindow();
  } catch (error) {
    console.error('[Main] Startup error:', error);
    dialog.showErrorBox(
      'Ошибка запуска',
      `Не удалось запустить приложение.\n\nОшибка: ${error.message}\n\nПроверьте:\n1. Файл electron/config.json существует\n2. MONGODB_URI указан правильно\n3. Интернет-соединение работает`
    );
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  console.log('[Main] All windows closed');
  
  // Stop server
  if (serverStarted) {
    console.log('[Main] Stopping server...');
    await stopServer();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on('before-quit', async () => {
  console.log('[Main] Before quit');
  if (serverStarted) {
    await stopServer();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
  dialog.showErrorBox('Критическая ошибка', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});
