/**
 * Electron Express Server
 * Локальный сервер для работы с MongoDB Atlas
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { listPrinters, setDefaultPrinter } = require('./printer-manager.cjs');
const { printTestReceipt, printReceipt } = require('./print-service.cjs');

// Get user data path for storing uploads (works in packaged app)
let userDataPath = null;
try {
  const { app } = require('electron');
  userDataPath = app.getPath('userData');
} catch (e) {
  // Not in Electron context, use project root
  userDataPath = path.join(__dirname, '..');
}

let mongoose;
try {
  mongoose = require('mongoose');
} catch (e) {
  console.error('[Server] mongoose not found:', e.message);
}

let multer;
try {
  multer = require('multer');
} catch (e) {
  console.log('[Server] multer not found, file uploads will be limited');
}

// Telegram Bot
let TelegramBot;
let telegramBot = null;
const TELEGRAM_BOT_TOKEN = '8283418093:AAEazrxdFKrR3XTsgxwSmnazr4PUjDTutzk';

try {
  TelegramBot = require('node-telegram-bot-api');
} catch (e) {
  console.log('[Server] node-telegram-bot-api not found, Telegram notifications disabled');
}

// Load config
let config = {};
const configPath = path.join(__dirname, 'config.json');

try {
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
    console.log('[Server] Config loaded from config.json');
  } else {
    console.log('[Server] config.json not found, using environment variables');
  }
} catch (e) {
  console.error('[Server] Error loading config:', e.message);
}

// Config with fallback to env
const MONGODB_URI = config.MONGODB_URI || process.env.MONGODB_URI;
const DB_NAME = config.DB_NAME || process.env.DB_NAME || 'oflayn-dokon';
const PORT = config.PORT || process.env.PORT || 5174;

let app = null;
let server = null;
let isConnected = false;

// Mongoose schemas (strict: false для гибкости)
const productSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const categorySchema = new mongoose.Schema({}, { strict: false, collection: 'categories' });
const storeSchema = new mongoose.Schema({}, { strict: false, collection: 'stores' });
const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const customerSchema = new mongoose.Schema({}, { strict: false, collection: 'customers' });
const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const debtSchema = new mongoose.Schema({}, { strict: false, collection: 'debts' });

// Схема для истории долгов
const debtHistorySchema = new mongoose.Schema({
  debtId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  action: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'debthistories' });

// Схема для чёрного списка
const blacklistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  creditor: { type: String, required: true },
  phone: { type: String },
  reason: { type: String },
  debtId: { type: mongoose.Schema.Types.ObjectId },
  totalUnpaidAmount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'blacklists' });

// Схема для удалённых продуктов (delta sync)
const deletedProductSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  deletedAt: { type: Date, default: Date.now, index: true }
}, { collection: 'deletedproducts' });

// Схема для offline продаж
const offlineSaleItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  sku: { type: String },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 }
}, { _id: false });

const offlineSaleSchema = new mongoose.Schema({
  offlineId: { type: String, required: true, unique: true, index: true },
  recipientNumber: { type: String, required: true, index: true },
  items: [offlineSaleItemSchema],
  total: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  paymentType: { type: String, required: true },
  saleType: { type: String, enum: ['sale', 'refund'], default: 'sale' },
  userId: { type: String, required: true, index: true },
  offlineCreatedAt: { type: Date, required: true },
  syncedAt: { type: Date, default: Date.now }
}, { collection: 'offlinesales' });

// Схема для кассовых чеков
const cashRegisterCheckSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  items: { type: Array, default: [] },
  total: { type: Number, default: 0 },
  type: { type: String, enum: ['current', 'pending', 'completed'], default: 'current' },
  paymentType: { type: String },
  saleType: { type: String, enum: ['sale', 'refund'], default: 'sale' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'cashregisterchecks' });

let Product, Category, Store, User, Customer, Order, Debt;
let DebtHistory, Blacklist, DeletedProduct, OfflineSale, CashRegisterCheck;

async function connectMongoDB() {
  if (!MONGODB_URI) {
    console.error('[Server] MONGODB_URI not configured!');
    return false;
  }

  try {
    console.log('[Server] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    // Initialize models
    Product = mongoose.models.Product || mongoose.model('Product', productSchema);
    Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
    Store = mongoose.models.Store || mongoose.model('Store', storeSchema);
    User = mongoose.models.User || mongoose.model('User', userSchema);
    Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
    Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
    Debt = mongoose.models.Debt || mongoose.model('Debt', debtSchema);
    DebtHistory = mongoose.models.DebtHistory || mongoose.model('DebtHistory', debtHistorySchema);
    Blacklist = mongoose.models.Blacklist || mongoose.model('Blacklist', blacklistSchema);
    DeletedProduct = mongoose.models.DeletedProduct || mongoose.model('DeletedProduct', deletedProductSchema);
    OfflineSale = mongoose.models.OfflineSale || mongoose.model('OfflineSale', offlineSaleSchema);
    CashRegisterCheck = mongoose.models.CashRegisterCheck || mongoose.model('CashRegisterCheck', cashRegisterCheckSchema);
    
    isConnected = true;
    console.log('[Server] MongoDB connected successfully to:', DB_NAME);
    
    // Start Telegram bot and checkers after MongoDB connection
    // Telegram bot disabled in Electron - only for web server
    // initTelegramBot();
    startBirthdayChecker();
    startDebtChecker();
    
    return true;
  } catch (error) {
    console.error('[Server] MongoDB connection error:', error.message);
    isConnected = false;
    return false;
  }
}

// ============ TELEGRAM BOT ============
function initTelegramBot() {
  if (!TelegramBot || !TELEGRAM_BOT_TOKEN) {
    console.log('[Telegram] Bot disabled (no token or module)');
    return;
  }

  try {
    telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    
    // Handle /start command
    telegramBot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username || msg.from?.first_name || 'Foydalanuvchi';
      const startParam = (match?.[1] || '').trim();

      console.log('[Telegram] /start from:', username, 'chatId:', chatId, 'param:', startParam);

      if (startParam && User) {
        try {
          const user = await User.findById(startParam).lean();
          if (user) {
            await User.updateOne({ _id: startParam }, { $set: { telegramChatId: chatId.toString() } });
            await telegramBot.sendMessage(chatId,
              `✅ Muvaffaqiyatli bog'landi!\n\n` +
              `Salom, ${user.name || username}! 👋\n\n` +
              `Endi siz quyidagi xabarlarni olasiz:\n` +
              `🎂 Mijozlarning tug'ilgan kunlari\n` +
              `💰 Qarzlarni qaytarish eslatmalari\n\n` +
              `Saytga qaytishingiz mumkin!`
            );
            return;
          }
        } catch (e) {
          console.error('[Telegram] Auto-link error:', e.message);
        }
      }

      await telegramBot.sendMessage(chatId,
        `Assalomu alaykum, ${username}! 👋\n\n` +
        `Tug'ilgan kun va qarz eslatmalarini olish uchun, iltimos telefon raqamingizni yuboring.\n\n` +
        `Masalan: +998901234567`
      );
    });

    // Handle phone number
    telegramBot.on('message', async (msg) => {
      if (msg.text?.startsWith('/')) return;
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const phoneRegex = /^\+?998\d{9}$/;
      
      if (phoneRegex.test(text.replace(/\s/g, '')) && User) {
        const phone = text.replace(/\s/g, '');
        try {
          const user = await User.findOne({ phone }).lean();
          if (user) {
            await User.updateOne({ phone }, { $set: { telegramChatId: chatId.toString() } });
            await telegramBot.sendMessage(chatId,
              `✅ Muvaffaqiyatli bog'landi!\n\nEndi mijozlaringizning tug'ilgan kunlari haqida xabar olasiz.`
            );
          } else {
            await telegramBot.sendMessage(chatId,
              `❌ Bu telefon raqami bilan foydalanuvchi topilmadi.\n\nIltimos, saytda ro'yxatdan o'tgan telefon raqamingizni kiriting.`
            );
          }
        } catch (e) {
          console.error('[Telegram] Phone link error:', e.message);
        }
      }
    });

    console.log('[Telegram] Bot started successfully');
  } catch (e) {
    console.error('[Telegram] Bot start error:', e.message);
  }
}

// Send birthday notification
async function sendBirthdayNotification(telegramChatId, customerName, customerPhone) {
  if (!telegramBot) return false;
  try {
    await telegramBot.sendMessage(telegramChatId,
      `🎉 Tug'ilgan kun eslatmasi!\n\n` +
      `Bugun mijozingiz ${customerName}ning tug'ilgan kuni.\n` +
      (customerPhone ? `📞 Telefon: ${customerPhone}\n\n` : '\n') +
      `Tabriklab qo'ying! 🎂`
    );
    return true;
  } catch (e) {
    console.error('[Telegram] Birthday notification error:', e.message);
    return false;
  }
}

// Send debt reminder
async function sendDebtReminderNotification(telegramChatId, creditorName, amount, currency, dueDate, creditorPhone) {
  if (!telegramBot) return false;
  try {
    const dueDateStr = new Date(dueDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedAmount = new Intl.NumberFormat('uz-UZ').format(amount);
    await telegramBot.sendMessage(telegramChatId,
      `💰 Qarz eslatmasi!\n\n` +
      `Ertaga ${creditorName}ga qarz qaytarish muddati tugaydi.\n\n` +
      `💵 Summa: ${formattedAmount} ${currency}\n` +
      `📅 Muddat: ${dueDateStr}\n` +
      (creditorPhone ? `📞 Telefon: ${creditorPhone}\n\n` : '\n') +
      `Iltimos, o'z vaqtida to'lang! ⏰`
    );
    return true;
  } catch (e) {
    console.error('[Telegram] Debt reminder error:', e.message);
    return false;
  }
}

// ============ BIRTHDAY CHECKER ============
const sentBirthdayNotifications = new Map();

async function checkBirthdaysAndNotify() {
  if (!Customer || !User) return;
  
  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const todayStr = `${today.getFullYear()}-${todayMonth}-${todayDay}`;

    // Clear old notifications
    for (const [key, date] of sentBirthdayNotifications.entries()) {
      if (date !== todayStr) sentBirthdayNotifications.delete(key);
    }

    const customers = await Customer.find({ birthDate: { $exists: true, $ne: null } }).lean();
    
    for (const customer of customers) {
      const birthDate = new Date(customer.birthDate);
      if (birthDate.getMonth() + 1 !== todayMonth || birthDate.getDate() !== todayDay) continue;
      
      const notificationKey = `${customer._id}-${customer.userId}`;
      if (sentBirthdayNotifications.get(notificationKey) === todayStr) continue;

      if (customer.userId) {
        const user = await User.findById(customer.userId).lean();
        if (user?.telegramChatId) {
          const success = await sendBirthdayNotification(user.telegramChatId, 
            `${customer.firstName} ${customer.lastName || ''}`.trim(), 
            customer.phone
          );
          if (success) {
            sentBirthdayNotifications.set(notificationKey, todayStr);
            console.log('[Birthday] Notification sent for:', customer.firstName);
          }
        }
      }
    }
  } catch (e) {
    console.error('[Birthday] Check error:', e.message);
  }
}

function startBirthdayChecker() {
  console.log('[Birthday] Checker started (every 1 minute)');
  checkBirthdaysAndNotify();
  setInterval(checkBirthdaysAndNotify, 60 * 1000);
}

// ============ DEBT CHECKER ============
const sentDebtNotifications = new Map();

async function checkDebtsAndNotify() {
  if (!Debt || !User) return;
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    // Clear old notifications
    for (const [key, date] of sentDebtNotifications.entries()) {
      if (date !== todayStr) sentDebtNotifications.delete(key);
    }

    const debts = await Debt.find({
      status: { $ne: 'paid' },
      dueDate: { $gte: tomorrow, $lt: dayAfter }
    }).lean();

    for (const debt of debts) {
      const notificationKey = `${debt._id}`;
      if (sentDebtNotifications.get(notificationKey) === todayStr) continue;

      if (debt.userId) {
        const user = await User.findById(debt.userId).lean();
        if (user?.telegramChatId) {
          const success = await sendDebtReminderNotification(
            user.telegramChatId,
            debt.creditor,
            debt.amount,
            debt.currency || 'UZS',
            debt.dueDate,
            debt.phone
          );
          if (success) {
            sentDebtNotifications.set(notificationKey, todayStr);
            console.log('[Debt] Reminder sent for:', debt.creditor);
          }
        }
      }
    }
  } catch (e) {
    console.error('[Debt] Check error:', e.message);
  }
}

function startDebtChecker() {
  console.log('[Debt] Checker started (every 1 minute)');
  checkDebtsAndNotify();
  setInterval(checkDebtsAndNotify, 60 * 1000);
}

function createExpressApp() {
  app = express();

  // CORS
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  }));

  // Body parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logging
  app.use((req, res, next) => {
    const userId = req.headers['x-user-id'] || req.query.userId || 'none';
    console.log(`[Server] ${req.method} ${req.path} (userId: ${userId})`);
    next();
  });

  // ============ PRINTERS (ESC/POS) ============
  app.get('/api/printers', async (req, res) => {
    try {
      const { printers, defaultPrinterId } = await listPrinters();
      res.json({
        success: true,
        printers,
        defaultPrinterId,
      });
    } catch (error) {
      console.error('[Server] Error listing printers:', error.message);
      res.status(500).json({ success: false, error: error.message, printers: [] });
    }
  });

  app.post('/api/printers/default', async (req, res) => {
    try {
      const { printerId } = req.body;
      if (!printerId) {
        return res.status(400).json({ success: false, error: 'printerId required' });
      }
      const config = setDefaultPrinter(printerId);
      res.json({ success: true, defaultPrinterId: config.defaultPrinterId });
    } catch (error) {
      console.error('[Server] Error setting default printer:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/printers/print-test', async (req, res) => {
    try {
      const { printerId } = req.body;
      if (!printerId) {
        return res.status(400).json({ success: false, error: 'printerId required' });
      }
      await printTestReceipt(printerId);
      res.json({ success: true });
    } catch (error) {
      console.error('[Server] Error printing test:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/printers/print-receipt', async (req, res) => {
    try {
      const { printerId, payload } = req.body;
      if (!printerId) {
        return res.status(400).json({ success: false, error: 'printerId required' });
      }
      await printReceipt(printerId, payload || {});
      res.json({ success: true });
    } catch (error) {
      console.error('[Server] Error printing receipt:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      source: 'electron-local',
      mongodb: isConnected ? 'connected' : 'disconnected',
      database: DB_NAME
    });
  });

  // ============ PRODUCTS ============
  
  // Специальный номер который видит все товары без фильтрации
  const ADMIN_PHONE = "910712828";
  const normalizePhone = (phone) => (phone || '').replace(/[^\d]/g, '');
  // ВАЖНО: /api/products/delta должен быть ПЕРЕД /api/products/:id
  app.get('/api/products/delta', async (req, res) => {
    try {
      const { since, userId, userPhone } = req.query;
      console.log('[Server] Delta sync request:', { since, userId, userPhone });

      const now = Date.now();
      let sinceTimestamp = new Date(0);

      if (since) {
        const sinceNum = Number(since);
        if (!isNaN(sinceNum) && sinceNum >= 0 && sinceNum <= now) {
          sinceTimestamp = sinceNum > 1e12 ? new Date(sinceNum) : new Date(sinceNum * 1000);
        }
      }

      // Build query
      const query = { updatedAt: { $gt: sinceTimestamp } };

      // Filter by userId - admin sees all, others see only their products
      const normalizedUserPhone = normalizePhone(userPhone);
      const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);

      if (isAdminPhone && userId) {
        // Admin видит товары без userId + свои товары
        query.$or = [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { userId: userId }
        ];
      } else if (userId) {
        // Обычные пользователи видят ТОЛЬКО свои товары
        query.userId = userId;
      }

      const products = await Product.find(query).lean();

      // Separate new vs updated
      const newProducts = products.filter(p => 
        new Date(p.createdAt).getTime() > sinceTimestamp.getTime()
      );
      const updatedProducts = products.filter(p => 
        new Date(p.createdAt).getTime() <= sinceTimestamp.getTime()
      );

      // Get deleted products
      const deleteQuery = { deletedAt: { $gt: sinceTimestamp } };
      if (userId) deleteQuery.userId = userId;
      
      const deletedRecords = await DeletedProduct.find(deleteQuery).lean();
      const deletedProductIds = deletedRecords.map(d => d.productId);

      // Format products
      const formatProduct = (p) => ({
        id: p._id.toString(),
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price || 0,
        stock: p.stock || 0,
        categoryId: p.categoryId,
        imageUrl: p.imageUrl,
        userId: p.userId,
        variantSummaries: p.variantSummaries || [],
        updatedAt: new Date(p.updatedAt).getTime()
      });

      console.log(`[Server] Delta sync: New=${newProducts.length}, Updated=${updatedProducts.length}, Deleted=${deletedProductIds.length}`);

      res.json({
        success: true,
        data: {
          newProducts: newProducts.map(formatProduct),
          updatedProducts: updatedProducts.map(formatProduct),
          deletedProductIds,
          serverTime: now
        }
      });
    } catch (error) {
      console.error('[Server] Delta sync error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      const userPhone = req.query.userPhone;
      
      // Build query with userId filter
      let query = {};
      const normalizedUserPhone = normalizePhone(userPhone);
      const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);

      if (isAdminPhone && userId) {
        // Admin видит товары без userId + свои товары
        query.$or = [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { userId: userId }
        ];
      } else if (userId) {
        // Обычные пользователи видят ТОЛЬКО свои товары
        query.userId = userId;
      }
      
      const products = await Product.find(query).lean();
      console.log(`[Server] Found ${products.length} products for user ${userId || 'all'}`);
      res.json({ products });
    } catch (error) {
      console.error('[Server] Error fetching products:', error.message);
      res.status(500).json({ error: 'Failed to fetch products', products: [] });
    }
  });

  app.get('/api/products/all', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      const userPhone = req.query.userPhone;
      
      let query = {};
      const normalizedUserPhone = normalizePhone(userPhone);
      const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);

      if (isAdminPhone && userId) {
        query.$or = [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { userId: userId }
        ];
      } else if (userId) {
        query.userId = userId;
      }
      
      const products = await Product.find(query).lean();
      console.log(`[Server] Found ${products.length} products (all) for user ${userId || 'all'}`);
      res.json({ products });
    } catch (error) {
      console.error('[Server] Error fetching all products:', error.message);
      res.status(500).json({ error: 'Failed to fetch products', products: [] });
    }
  });

  // ВАЖНО: /api/products/:id должен быть ПОСЛЕ всех /api/products/xxx роутов
  app.get('/api/products/:id', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      const userPhone = req.query.userPhone;
      
      const product = await Product.findById(req.params.id).lean();
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      
      // Проверка доступа: админ видит все, обычный пользователь - только свои товары
      const normalizedUserPhone = normalizePhone(userPhone);
      const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);
      
      if (!isAdminPhone && userId && product.userId && product.userId !== userId) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      
      // Возвращаем в формате { success: true, product: {...} }
      res.json({ success: true, product });
    } catch (error) {
      console.error('[Server] Error fetching product:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch product' });
    }
  });

  app.post('/api/products', async (req, res) => {
    try {
      const productData = { ...req.body };
      // Convert userId to ObjectId for consistency with web server
      if (productData.userId) {
        try {
          productData.userId = new mongoose.Types.ObjectId(String(productData.userId));
        } catch (e) {
          console.error('[Server] Invalid userId format:', productData.userId);
        }
      }
      const product = new Product(productData);
      await product.save();
      console.log('[Server] Product created:', product._id);
      res.status(201).json(product);
    } catch (error) {
      console.error('[Server] Error creating product:', error.message);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  // Alias for /api/products (used by OfflineProductForm)
  app.post('/api/products/create', async (req, res) => {
    try {
      const productData = { ...req.body };
      // Convert userId to ObjectId for consistency with web server
      if (productData.userId) {
        try {
          productData.userId = new mongoose.Types.ObjectId(String(productData.userId));
        } catch (e) {
          console.error('[Server] Invalid userId format:', productData.userId);
        }
      }
      const product = new Product(productData);
      await product.save();
      console.log('[Server] Product created via /create:', product._id);
      res.status(201).json({ success: true, product });
    } catch (error) {
      console.error('[Server] Error creating product:', error.message);
      res.status(500).json({ success: false, error: 'Failed to create product' });
    }
  });

  app.put('/api/products/:id', async (req, res) => {
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      ).lean();
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(product);
    } catch (error) {
      console.error('[Server] Error updating product:', error.message);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    try {
      const result = await Product.findByIdAndDelete(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
      console.error('[Server] Error deleting product:', error.message);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // ============ CATEGORIES ============
  app.get('/api/categories', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      const userPhone = req.query.userPhone;
      
      // Build query with userId filter
      let query = {};
      const normalizedUserPhone = normalizePhone(userPhone);
      const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);

      if (isAdminPhone && userId) {
        // Admin видит категории без userId + свои категории
        query.$or = [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { userId: userId }
        ];
      } else if (userId) {
        // Обычные пользователи видят ТОЛЬКО свои категории
        query.userId = userId;
      }
      
      const raw = await Category.find(query).lean();
      console.log(`[Server] Found ${raw.length} categories for user ${userId || 'all'}`);
      const categories = raw.map(c => ({
        id: c._id?.toString() || '',
        name: c.name || '',
        storeId: c.storeId || '',
        parentId: c.parentId ? c.parentId.toString() : null,
        order: typeof c.order === 'number' ? c.order : 0,
        level: typeof c.level === 'number' ? c.level : 0,
        isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
        slug: c.slug || '',
        userId: c.userId || '',
      }));
      res.json({ categories });
    } catch (error) {
      console.error('[Server] Error fetching categories:', error.message);
      res.status(500).json({ error: 'Failed to fetch categories', categories: [] });
    }
  });

  app.post('/api/categories', async (req, res) => {
    try {
      const categoryData = { ...req.body };
      // Convert userId to ObjectId for consistency with web server
      if (categoryData.userId) {
        try {
          categoryData.userId = new mongoose.Types.ObjectId(String(categoryData.userId));
        } catch (e) {
          console.error('[Server] Invalid userId format:', categoryData.userId);
        }
      }
      const category = new Category(categoryData);
      await category.save();
      console.log('[Server] Category created:', category._id);
      
      // Format category with id field for frontend
      const formattedCategory = {
        id: category._id.toString(),
        name: category.name || '',
        storeId: category.storeId || '',
        parentId: category.parentId ? category.parentId.toString() : null,
        order: typeof category.order === 'number' ? category.order : 0,
        level: typeof category.level === 'number' ? category.level : 0,
        isActive: typeof category.isActive === 'boolean' ? category.isActive : true,
        slug: category.slug || '',
        userId: category.userId ? category.userId.toString() : '',
      };
      res.status(201).json({ success: true, category: formattedCategory });
    } catch (error) {
      console.error('[Server] Error creating category:', error.message);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    try {
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      ).lean();
      if (!category) {
        return res.status(404).json({ success: false, error: 'Category not found', message: 'Kategoriya topilmadi' });
      }
      
      // Format category with id field for frontend
      const formattedCategory = {
        id: category._id.toString(),
        name: category.name || '',
        storeId: category.storeId || '',
        parentId: category.parentId ? category.parentId.toString() : null,
        order: typeof category.order === 'number' ? category.order : 0,
        level: typeof category.level === 'number' ? category.level : 0,
        isActive: typeof category.isActive === 'boolean' ? category.isActive : true,
        slug: category.slug || '',
        userId: category.userId ? category.userId.toString() : '',
      };
      res.json({ success: true, category: formattedCategory });
    } catch (error) {
      console.error('[Server] Error updating category:', error.message);
      res.status(500).json({ success: false, error: 'Failed to update category', message: error.message });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const result = await Category.findByIdAndDelete(req.params.id);
      if (!result) {
        return res.status(404).json({ success: false, error: 'Category not found', message: 'Kategoriya topilmadi' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[Server] Error deleting category:', error.message);
      res.status(500).json({ success: false, error: 'Failed to delete category', message: error.message });
    }
  });

  // ============ STORES ============
  app.get('/api/stores', async (req, res) => {
    try {
      const raw = await Store.find({}).lean();
      console.log(`[Server] Found ${raw.length} stores`);
      const stores = raw.map(s => ({
        id: s._id?.toString() || '',
        name: s.name || '',
      }));
      res.json({ stores });
    } catch (error) {
      console.error('[Server] Error fetching stores:', error.message);
      res.status(500).json({ error: 'Failed to fetch stores', stores: [] });
    }
  });

  app.post('/api/stores', async (req, res) => {
    try {
      const store = new Store(req.body);
      await store.save();
      console.log('[Server] Store created:', store._id);
      res.status(201).json({ success: true, store });
    } catch (error) {
      console.error('[Server] Error creating store:', error.message);
      res.status(500).json({ error: 'Failed to create store' });
    }
  });

  // ============ USERS ============
  app.get('/api/users', async (req, res) => {
    try {
      const raw = await User.find({}).select('-password').lean();
      console.log(`[Server] Found ${raw.length} users`);
      const users = raw.map(u => ({
        id: u._id?.toString() || '',
        name: u.name || '',
        phone: u.phone || '',
        address: u.address || '',
        role: u.role || 'user',
        telegramChatId: u.telegramChatId || '',
        subscriptionType: u.subscriptionType || 'cheksiz',
        subscriptionEndDate: u.subscriptionEndDate || null,
        isBlocked: u.isBlocked || false,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));
      res.json({ success: true, users });
    } catch (error) {
      console.error('[Server] Error fetching users:', error.message);
      res.status(500).json({ error: 'Failed to fetch users', users: [] });
    }
  });

  app.get('/api/users/:id', async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select('-password').lean();
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({
        success: true,
        user: {
          id: user._id?.toString() || '',
          name: user.name || '',
          phone: user.phone || '',
          address: user.address || '',
          role: user.role || 'user',
          telegramChatId: user.telegramChatId || '',
          subscriptionType: user.subscriptionType || 'cheksiz',
          subscriptionEndDate: user.subscriptionEndDate || null,
          isBlocked: user.isBlocked || false,
        }
      });
    } catch (error) {
      console.error('[Server] Error fetching user:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const { name, phone, password, address, role, subscriptionType, subscriptionEndDate } = req.body;
      if (!name || !phone || !password) {
        return res.status(400).json({ success: false, error: 'Name, phone and password required' });
      }
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      const userData = { 
        name, 
        phone, 
        password: hashedPassword, 
        address, 
        role: role || 'user',
        subscriptionType: subscriptionType || 'cheksiz',
        subscriptionEndDate: subscriptionEndDate || null,
        isBlocked: false,
      };
      const user = new User(userData);
      await user.save();
      res.status(201).json({ 
        success: true, 
        user: { 
          id: user._id.toString(), 
          name, 
          phone, 
          role: user.role,
          subscriptionType: user.subscriptionType,
          subscriptionEndDate: user.subscriptionEndDate,
          isBlocked: user.isBlocked,
        } 
      });
    } catch (error) {
      console.error('[Server] Error creating user:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      const { name, phone, password, address, role, subscriptionType, subscriptionEndDate, isBlocked } = req.body;
      const updateData = {};
      if (name) updateData.name = name;
      if (phone) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (role) updateData.role = role;
      if (subscriptionType) updateData.subscriptionType = subscriptionType;
      if (subscriptionEndDate !== undefined) updateData.subscriptionEndDate = subscriptionEndDate;
      if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
      if (password) {
        const bcrypt = require('bcryptjs');
        updateData.password = await bcrypt.hash(password, 10);
      }
      const user = await User.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true }).select('-password').lean();
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({ 
        success: true, 
        user: { 
          id: user._id.toString(), 
          name: user.name, 
          phone: user.phone, 
          role: user.role,
          subscriptionType: user.subscriptionType,
          subscriptionEndDate: user.subscriptionEndDate,
          isBlocked: user.isBlocked,
        } 
      });
    } catch (error) {
      console.error('[Server] Error updating user:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[Server] Error deleting user:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ CURRENCY ============
  app.get('/api/currency/rates', async (req, res) => {
    try {
      // Return default rates (can be updated to fetch from external API)
      // Keys must be lowercase to match client expectations
      res.json({
        success: true,
        rates: {
          usd: 12850,
          eur: 13900,
          rub: 137,
          cny: 1770,
        },
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Server] Error fetching currency rates:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/currency/usd', (req, res) => {
    res.json({ success: true, rate: 12850, currency: 'USD' });
  });

  app.get('/api/currency/rub', (req, res) => {
    res.json({ success: true, rate: 137, currency: 'RUB' });
  });

  app.get('/api/currency/cny', (req, res) => {
    res.json({ success: true, rate: 1770, currency: 'CNY' });
  });

  // ============ AUTH ============
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { phone, password } = req.body;
      console.log('[Server] Login request body:', { phone, password: '***' });

      if (!phone || !password) {
        console.log('[Server] Login failed: missing phone or password');
        return res.status(400).json({ 
          success: false, 
          error: 'Телефон и пароль обязательны' 
        });
      }

      const user = await User.findOne({ phone }).lean();
      console.log('[Server] User found:', user ? 'yes' : 'no');

      if (!user) {
        console.log('[Server] Login failed: user not found');
        return res.status(401).json({ 
          success: false, 
          error: 'Пользователь не найден' 
        });
      }

      // Check password - support both plain text and bcrypt
      const storedPassword = user.password || '';
      const isBcrypt = /^\$2[aby]\$/.test(storedPassword);
      let isValid = false;

      if (isBcrypt) {
        console.log('[Server] Password type: bcrypt');
        try {
          const bcrypt = require('bcryptjs');
          isValid = await bcrypt.compare(password, storedPassword);
        } catch (e) {
          console.error('[Server] bcrypt compare error:', e.message);
        }
      } else {
        console.log('[Server] Password type: plain text');
        isValid = password === storedPassword;
      }

      console.log('[Server] Password valid:', isValid);

      if (!isValid) {
        return res.status(401).json({ 
          success: false, 
          error: 'Неверный пароль' 
        });
      }

      console.log('[Server] Login successful for:', phone);
      res.json({
        success: true,
        user: {
          id: user._id.toString(),
          name: user.name || '',
          phone: user.phone || '',
          role: user.role || 'user',
          address: user.address || '',
          telegramChatId: user.telegramChatId || '',
        },
      });
    } catch (error) {
      console.error('[Server] Login error:', error.message);
      res.status(500).json({ 
        success: false, 
        error: 'Ошибка сервера: ' + error.message 
      });
    }
  });

  app.post('/api/auth/verify', async (req, res) => {
    try {
      const { userId } = req.body;
      console.log('[Server] Verify request for userId:', userId);

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      const user = await User.findById(userId).lean();
      
      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }

      res.json({
        success: true,
        user: {
          id: user._id.toString(),
          name: user.name || '',
          phone: user.phone || '',
          role: user.role || 'user',
          address: user.address || '',
          telegramChatId: user.telegramChatId || '',
        },
      });
    } catch (error) {
      console.error('[Server] Verify error:', error.message);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  // ============ CUSTOMERS ============
  app.get('/api/customers', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      console.log('[Server] Customers request, userId:', userId);
      
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID kerak', customers: [] });
      }
      
      // Search by both string and ObjectId to handle different storage formats
      const query = {
        $or: [
          { userId: userId },
          { userId: new mongoose.Types.ObjectId(userId) }
        ]
      };
      
      const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();
      console.log(`[Server] Found ${customers.length} customers for user ${userId}`);
      res.json({ success: true, customers });
    } catch (error) {
      console.error('[Server] Error fetching customers:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch customers', customers: [] });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {
      const { firstName, lastName, phone, birthDate, notes, userId } = req.body;
      const finalUserId = userId || req.headers['x-user-id'];
      
      if (!finalUserId) {
        return res.status(400).json({ success: false, error: 'User ID kerak' });
      }
      
      if (!firstName || !lastName || !birthDate) {
        return res.status(400).json({ success: false, error: "Ism, familiya va tug'ilgan kun majburiy" });
      }
      
      // Convert userId to ObjectId for consistency with web server
      let userObjectId;
      try {
        userObjectId = new mongoose.Types.ObjectId(String(finalUserId));
      } catch (e) {
        console.error('[Server] Invalid userId format:', finalUserId);
        return res.status(400).json({ success: false, error: 'Noto\'g\'ri user ID formati' });
      }
      
      const customer = new Customer({
        userId: userObjectId,
        firstName,
        lastName,
        phone,
        birthDate: new Date(birthDate),
        notes,
        totalOrders: 0,
        totalSpent: 0,
      });
      
      await customer.save();
      console.log('[Server] Customer created:', customer._id);
      res.json({ success: true, customer });
    } catch (error) {
      console.error('[Server] Error creating customer:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, phone, birthDate, notes } = req.body;
      
      const customer = await Customer.findByIdAndUpdate(
        id,
        { firstName, lastName, phone, birthDate: birthDate ? new Date(birthDate) : undefined, notes },
        { new: true }
      ).lean();
      
      if (!customer) {
        return res.status(404).json({ success: false, error: 'Mijoz topilmadi' });
      }
      
      res.json({ success: true, customer });
    } catch (error) {
      console.error('[Server] Error updating customer:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await Customer.findByIdAndDelete(id);
      
      if (!customer) {
        return res.status(404).json({ success: false, error: 'Mijoz topilmadi' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('[Server] Error deleting customer:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/customers/birthdays/notifications', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID kerak' });
      }
      
      const customers = await Customer.find({ userId }).lean();
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();
      
      const notifications = customers
        .map(customer => {
          const birthDate = new Date(customer.birthDate);
          const birthMonth = birthDate.getMonth() + 1;
          const birthDay = birthDate.getDate();
          const isToday = birthMonth === todayMonth && birthDay === todayDay;
          
          let daysUntil = 0;
          if (!isToday) {
            const thisYearBirthday = new Date(today.getFullYear(), birthMonth - 1, birthDay);
            if (thisYearBirthday < today) {
              thisYearBirthday.setFullYear(today.getFullYear() + 1);
            }
            daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }
          
          return { customer, daysUntil, isToday };
        })
        .filter(n => n.isToday || n.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil);
      
      res.json({ success: true, notifications });
    } catch (error) {
      console.error('[Server] Error fetching birthday notifications:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/customers/top', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID kerak' });
      }
      
      const topByOrders = await Customer.find({ userId }).sort({ totalOrders: -1 }).limit(10).lean();
      const topBySpent = await Customer.find({ userId }).sort({ totalSpent: -1 }).limit(10).lean();
      
      res.json({ success: true, topByOrders, topBySpent });
    } catch (error) {
      console.error('[Server] Error fetching top customers:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ ORDERS ============
  app.get('/api/orders', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      const query = userId ? { userId } : {};
      const orders = await Order.find(query).sort({ createdAt: -1 }).lean();
      console.log(`[Server] Found ${orders.length} orders`);
      res.json({ orders });
    } catch (error) {
      console.error('[Server] Error fetching orders:', error.message);
      res.status(500).json({ error: 'Failed to fetch orders', orders: [] });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const order = new Order(req.body);
      await order.save();
      console.log('[Server] Order created:', order._id);
      res.status(201).json({ success: true, order });
    } catch (error) {
      console.error('[Server] Error creating order:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/orders/frequent-customers', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      // Return empty for now - can be implemented later
      res.json({ success: true, customers: [] });
    } catch (error) {
      console.error('[Server] Error fetching frequent customers:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/orders/auto-promote', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      // Return empty for now - can be implemented later
      res.json({ success: true, promoted: [] });
    } catch (error) {
      console.error('[Server] Error auto-promoting customers:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ DEBTS ============
  app.get('/api/debts', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      console.log('[Server] Debts request, userId:', userId);
      
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID kerak', debts: [] });
      }
      
      // Search by both string and ObjectId to handle different storage formats
      const query = {
        $or: [
          { userId: userId },
          { userId: new mongoose.Types.ObjectId(userId) }
        ]
      };
      
      const debts = await Debt.find(query).sort({ createdAt: -1 }).lean();
      console.log(`[Server] Found ${debts.length} debts for user ${userId}`);
      
      // Auto-update overdue status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const formattedDebts = debts.map(d => {
        let status = d.status;
        if (status === 'pending' && d.dueDate) {
          const dueDate = new Date(d.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            status = 'overdue';
          }
        }
        return {
          _id: d._id.toString(),
          branchId: d.branchId,
          creditor: d.creditor,
          amount: d.amount,
          description: d.description,
          phone: d.phone,
          countryCode: d.countryCode,
          debtDate: d.debtDate,
          dueDate: d.dueDate,
          currency: d.currency,
          status: status,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      });
      
      res.json({ success: true, debts: formattedDebts });
    } catch (error) {
      console.error('[Server] Error fetching debts:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch debts', debts: [] });
    }
  });

  app.post('/api/debts', async (req, res) => {
    try {
      const { creditor, amount, description, phone, countryCode, debtDate, dueDate, currency, branchId, userId } = req.body;
      const finalUserId = userId || req.headers['x-user-id'];
      
      if (!finalUserId) {
        return res.status(400).json({ success: false, error: 'User ID kerak' });
      }
      
      if (!creditor || !amount || !debtDate) {
        return res.status(400).json({ success: false, error: 'Kreditor, summa va sana majburiy' });
      }
      
      // Convert userId to ObjectId for consistency with web server
      let userObjectId;
      try {
        userObjectId = new mongoose.Types.ObjectId(String(finalUserId));
      } catch (e) {
        console.error('[Server] Invalid userId format:', finalUserId);
        return res.status(400).json({ success: false, error: 'Noto\'g\'ri user ID formati' });
      }
      
      const debt = new Debt({
        userId: userObjectId,
        branchId,
        creditor,
        amount,
        description,
        phone,
        countryCode: countryCode || '+998',
        debtDate: new Date(debtDate),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        currency: currency || 'UZS',
        status: 'pending',
      });
      
      await debt.save();
      
      // Save history
      await DebtHistory.create({
        debtId: debt._id,
        action: 'created',
        amount: debt.amount,
        reason: "Yangi qarz qo'shildi"
      });
      
      console.log('[Server] Debt created:', debt._id);
      res.status(201).json({ success: true, debt });
    } catch (error) {
      console.error('[Server] Error creating debt:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/debts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { creditor, amount, description, phone, countryCode, debtDate, dueDate, currency } = req.body;
      
      const debt = await Debt.findByIdAndUpdate(
        id,
        { creditor, amount, description, phone, countryCode, debtDate, dueDate, currency },
        { new: true }
      ).lean();
      
      if (!debt) {
        return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
      }
      
      res.json({ success: true, debt });
    } catch (error) {
      console.error('[Server] Error updating debt:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/debts/:id/paid', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const debt = await Debt.findById(id);
      if (!debt) {
        return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
      }

      const wasUnpaid = debt.status === 'unpaid';
      debt.status = 'paid';
      await debt.save();

      // If was in blacklist, update it
      if (wasUnpaid) {
        // Convert userId to ObjectId for blacklist search
        let userObjectId;
        try {
          userObjectId = new mongoose.Types.ObjectId(String(debt.userId));
        } catch (e) {
          userObjectId = debt.userId;
        }
        
        const query = { userId: userObjectId };
        if (debt.phone) {
          query.$and = [
            { userId: userObjectId },
            { $or: [{ phone: debt.phone }, { creditor: debt.creditor }] }
          ];
        } else {
          query.creditor = debt.creditor;
        }
        const blacklistEntry = await Blacklist.findOne(query);
        if (blacklistEntry) {
          blacklistEntry.totalUnpaidAmount -= debt.amount;
          if (blacklistEntry.totalUnpaidAmount <= 0) {
            await Blacklist.findByIdAndDelete(blacklistEntry._id);
            console.log('[Server] Blacklist entry removed for:', debt.creditor);
          } else {
            await blacklistEntry.save();
            console.log('[Server] Blacklist entry updated for:', debt.creditor);
          }
        }
      }

      // Save history
      await DebtHistory.create({
        debtId: debt._id,
        action: 'paid',
        amount: debt.amount,
        reason: reason || (wasUnpaid ? "Qarz to'landi - qora ro'yxatdan chiqarildi" : "Qarz to'landi")
      });
      
      res.json({ 
        success: true, 
        debt: { _id: debt._id.toString(), status: debt.status, updatedAt: debt.updatedAt },
        removedFromBlacklist: wasUnpaid
      });
    } catch (error) {
      console.error('[Server] Error marking debt as paid:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/debts/:id/adjust', async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, type, reason } = req.body;
      
      if (!amount || !type) {
        return res.status(400).json({ success: false, error: 'Summa va tur majburiy' });
      }
      
      const debt = await Debt.findById(id);
      if (!debt) {
        return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
      }
      
      if (type === 'add') {
        debt.amount += amount;
      } else if (type === 'subtract') {
        debt.amount -= amount;
        if (debt.amount < 0) debt.amount = 0;
      }
      
      await debt.save();
      
      // Save history
      await DebtHistory.create({
        debtId: debt._id,
        action: type === 'add' ? 'increased' : 'decreased',
        amount: amount,
        reason: reason || `Summa ${type === 'add' ? 'oshirildi' : 'kamaytirildi'}`
      });
      
      res.json({ success: true, debt });
    } catch (error) {
      console.error('[Server] Error adjusting debt:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/debts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const debt = await Debt.findById(id);
      if (!debt) {
        return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
      }
      
      // Save history before deletion
      await DebtHistory.create({
        debtId: debt._id,
        action: 'deleted',
        amount: debt.amount,
        reason: reason || "Qarz o'chirildi"
      });
      
      await Debt.findByIdAndDelete(id);
      
      res.json({ success: true, message: "Qarz o'chirildi" });
    } catch (error) {
      console.error('[Server] Error deleting debt:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/debts/:id/history', async (req, res) => {
    try {
      const { id } = req.params;
      const history = await DebtHistory.find({ debtId: id }).sort({ createdAt: -1 }).lean();
      
      res.json({
        success: true,
        history: history.map(h => ({
          _id: h._id.toString(),
          debtId: h.debtId.toString(),
          action: h.action,
          amount: h.amount,
          reason: h.reason,
          createdAt: h.createdAt
        }))
      });
    } catch (error) {
      console.error('[Server] Error fetching debt history:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ PRODUCT IMAGE UPLOAD ============
  // Setup multer for file uploads
  // Use userDataPath for packaged app, or project root for development
  const uploadsDir = path.join(userDataPath || path.join(__dirname, '..'), 'uploads');
  console.log('[Server] Uploads directory:', uploadsDir);
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (mkdirErr) {
    console.error('[Server] Failed to create uploads directory:', mkdirErr.message);
  }

  let upload = null;
  if (multer) {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'product-' + uniqueSuffix + ext);
      }
    });
    upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
  }

  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));

  // Support both /api/upload and /api/products/upload-image for compatibility
  app.post('/api/upload', (req, res, next) => {
    if (upload) {
      upload.single('image')(req, res, async (err) => {
        if (err) {
          console.error('[Server] Multer error:', err.message);
          return res.status(400).json({ success: false, error: err.message });
        }
        
        if (req.file) {
          const url = `/uploads/${req.file.filename}`;
          console.log('[Server] Image uploaded:', url);
          return res.json({ success: true, url });
        }
        
        // Fallback to base64 handling
        handleBase64Upload(req, res);
      });
    } else {
      handleBase64Upload(req, res);
    }
  });

  function handleBase64Upload(req, res) {
    try {
      const { image } = req.body;
      
      if (image && typeof image === 'string' && image.startsWith('data:')) {
        // Save base64 image to file
        const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1];
          const data = matches[2];
          const filename = `product-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
          const filepath = path.join(uploadsDir, filename);
          
          fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
          const url = `/uploads/${filename}`;
          console.log('[Server] Base64 image saved:', url);
          return res.json({ success: true, url });
        }
      }
      
      res.json({ success: true, url: '/placeholder-image.png' });
    } catch (error) {
      console.error('[Server] Error uploading image:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Alias for backward compatibility
  app.post('/api/products/upload-image', (req, res, next) => {
    // Redirect to /api/upload
    req.url = '/api/upload';
    app._router.handle(req, res, next);
  });

  // ============ PRODUCT SYNC ============
  app.post('/api/products/sync', async (req, res) => {
    try {
      const { products } = req.body;
      const syncedIds = [];
      const errors = [];

      if (Array.isArray(products)) {
        for (const p of products) {
          try {
            if (p._id || p.id) {
              // Update existing
              await Product.findByIdAndUpdate(p._id || p.id, { $set: p }, { upsert: true });
            } else {
              // Create new
              const newProduct = new Product(p);
              await newProduct.save();
            }
            syncedIds.push(p.offlineId || p._id || p.id);
          } catch (err) {
            errors.push({ id: p.offlineId || p._id || p.id, error: err.message });
          }
        }
      }

      res.json({ success: true, syncedIds, errors });
    } catch (error) {
      console.error('[Server] Error syncing products:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Bulk sync endpoint (used by sync.ts)
  app.post('/api/products/bulk-sync', async (req, res) => {
    try {
      const { products } = req.body;
      const syncedIds = [];
      const errors = [];

      if (Array.isArray(products)) {
        for (const p of products) {
          try {
            const newProduct = new Product({
              ...p,
              synced: true,
              syncedAt: new Date(),
            });
            await newProduct.save();
            syncedIds.push(p.offlineId);
          } catch (err) {
            errors.push({ id: p.offlineId, error: err.message });
          }
        }
      }

      res.json({ success: true, syncedIds, errors, message: `Synced ${syncedIds.length} products` });
    } catch (error) {
      console.error('[Server] Error bulk syncing products:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ DEVICES ============
  app.get('/api/devices/list', (req, res) => {
    // Return empty list for Electron - printing handled differently
    res.json({ success: true, devices: [] });
  });

  // ============ PRINT ============
  app.post('/api/print', (req, res) => {
    try {
      // In Electron, printing is handled via IPC
      console.log('[Server] Print request received:', req.body);
      res.json({ success: true, message: 'Print request received' });
    } catch (error) {
      console.error('[Server] Error printing:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ DELETE PRODUCT IMAGE ============
  app.delete('/api/products/:id/images/:index', async (req, res) => {
    try {
      const { id, index } = req.params;
      const product = await Product.findById(id);
      
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      const imagePaths = product.imagePaths || [];
      const imageIndex = parseInt(index, 10);
      
      if (imageIndex >= 0 && imageIndex < imagePaths.length) {
        imagePaths.splice(imageIndex, 1);
        product.imagePaths = imagePaths;
        await product.save();
      }

      res.json({ success: true, imagePaths: product.imagePaths });
    } catch (error) {
      console.error('[Server] Error deleting image:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ STATS ============
  app.get('/api/stats/daily', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      // Return basic stats
      res.json({
        success: true,
        stats: {
          totalSales: 0,
          totalRevenue: 0,
          totalOrders: 0,
          totalCustomers: 0,
          topProducts: []
        }
      });
    } catch (error) {
      console.error('[Server] Error fetching daily stats:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ PRODUCT STOCK UPDATE ============
  app.patch('/api/products/:id/stock', async (req, res) => {
    try {
      const { id } = req.params;
      const { stock, increment } = req.body;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      if (typeof increment === 'number') {
        product.stock = (product.stock || 0) + increment;
      } else if (typeof stock === 'number') {
        product.stock = stock;
      }

      product.updatedAt = new Date();
      await product.save();

      res.json({ success: true, product: { _id: product._id, stock: product.stock } });
    } catch (error) {
      console.error('[Server] Error updating stock:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ OFFLINE SALES SYNC ============
  app.post('/api/sales/offline-sync', async (req, res) => {
    try {
      const { sales, userId } = req.body;

      if (!sales || !Array.isArray(sales)) {
        return res.status(400).json({ success: false, error: 'sales array required' });
      }

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      console.log(`[Server] Processing ${sales.length} offline sales for user ${userId}`);

      const result = { success: true, syncedIds: [], errors: [] };

      for (const sale of sales) {
        try {
          // Check for duplicate
          const existing = await OfflineSale.findOne({ offlineId: sale.id });
          if (existing) {
            console.log(`[Server] Duplicate sale skipped: ${sale.id}`);
            result.syncedIds.push(sale.id);
            continue;
          }

          // Create sale record
          await OfflineSale.create({
            offlineId: sale.id,
            recipientNumber: sale.recipientNumber,
            items: sale.items,
            total: sale.total,
            discount: sale.discount,
            paymentType: sale.paymentType,
            saleType: sale.saleType || 'sale',
            userId: sale.userId || userId,
            offlineCreatedAt: new Date(sale.createdAt),
            syncedAt: new Date()
          });

          // Update stock for each item
          for (const item of sale.items) {
            const stockChange = sale.saleType === 'refund' ? item.quantity : -item.quantity;
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: stockChange } });
          }

          result.syncedIds.push(sale.id);
          console.log(`[Server] Sale synced: ${sale.recipientNumber}`);
        } catch (err) {
          console.error(`[Server] Sale error ${sale.id}:`, err.message);
          result.errors.push({ id: sale.id, error: err.message });
        }
      }

      console.log(`[Server] Offline sync completed: ${result.syncedIds.length} synced, ${result.errors.length} errors`);
      res.json(result);
    } catch (error) {
      console.error('[Server] Offline sync error:', error.message);
      res.status(500).json({ success: false, error: error.message, syncedIds: [], errors: [] });
    }
  });

  app.get('/api/sales/offline', async (req, res) => {
    try {
      const { userId, limit = 100, offset = 0 } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      const sales = await OfflineSale.find({ userId })
        .sort({ offlineCreatedAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean();

      const total = await OfflineSale.countDocuments({ userId });

      res.json({ success: true, sales, total, limit: Number(limit), offset: Number(offset) });
    } catch (error) {
      console.error('[Server] Error fetching offline sales:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/sales/offline/stats', async (req, res) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);

      // Daily stats
      const dailySales = await OfflineSale.find({
        userId,
        saleType: 'sale',
        offlineCreatedAt: { $gte: today }
      }).lean();

      const dailyStats = {
        totalSales: dailySales.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.quantity, 0), 0),
        totalRevenue: dailySales.reduce((sum, s) => sum + s.total, 0),
        totalOrders: dailySales.length
      };

      // Weekly stats
      const weeklySales = await OfflineSale.find({
        userId,
        saleType: 'sale',
        offlineCreatedAt: { $gte: weekStart }
      }).lean();

      const weekDays = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
      const dailyData = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);

        const daySales = weeklySales.filter(s => {
          const saleDate = new Date(s.offlineCreatedAt);
          return saleDate >= dayStart && saleDate <= dayEnd;
        });

        dailyData.push({
          day: weekDays[d.getDay()],
          sales: daySales.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.quantity, 0), 0),
          revenue: daySales.reduce((sum, s) => sum + s.total, 0),
          orders: daySales.length
        });
      }

      const weeklyStats = {
        totalSales: dailyData.reduce((sum, d) => sum + d.sales, 0),
        totalRevenue: dailyData.reduce((sum, d) => sum + d.revenue, 0),
        totalOrders: dailyData.reduce((sum, d) => sum + d.orders, 0),
        dailyData
      };

      res.json({ success: true, daily: dailyStats, weekly: weeklyStats });
    } catch (error) {
      console.error('[Server] Error fetching offline stats:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/sales/offline/cleanup', async (req, res) => {
    try {
      const { userId, days } = req.query;
      const olderThanDays = days ? Number(days) : 7;

      if (isNaN(olderThanDays) || olderThanDays <= 0) {
        return res.status(400).json({ success: false, error: 'days must be positive number' });
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);

      const match = { offlineCreatedAt: { $lt: cutoff } };
      if (userId) match.userId = userId;

      const result = await OfflineSale.deleteMany(match);

      res.json({ success: true, deletedCount: result.deletedCount || 0, olderThanDays });
    } catch (error) {
      console.error('[Server] Error cleaning up offline sales:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ CASH REGISTER ============
  app.get('/api/cash-register', async (req, res) => {
    try {
      const { type, userId } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      const filter = { userId };
      if (type) filter.type = type;

      const checks = await CashRegisterCheck.find(filter).sort({ createdAt: -1 }).lean();
      res.json({ success: true, checks });
    } catch (error) {
      console.error('[Server] Cash register GET error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to get checks' });
    }
  });

  app.get('/api/cash-register/current', async (req, res) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      const currentCheck = await CashRegisterCheck.findOne({ userId, type: 'current' }).lean();
      res.json({ success: true, check: currentCheck });
    } catch (error) {
      console.error('[Server] Cash register current GET error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to get current check' });
    }
  });

  app.post('/api/cash-register/current', async (req, res) => {
    try {
      const { items, total, userId } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      let currentCheck = await CashRegisterCheck.findOne({ userId, type: 'current' });

      if (currentCheck) {
        currentCheck.items = items || [];
        currentCheck.total = total || 0;
        await currentCheck.save();
      } else {
        currentCheck = await CashRegisterCheck.create({
          userId,
          items: items || [],
          total: total || 0,
          type: 'current'
        });
      }

      res.json({ success: true, check: currentCheck });
    } catch (error) {
      console.error('[Server] Cash register current SAVE error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to save current check' });
    }
  });

  app.post('/api/cash-register/pending', async (req, res) => {
    try {
      const { items, total, userId } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      const check = await CashRegisterCheck.create({
        userId,
        items: items || [],
        total: total || 0,
        type: 'pending'
      });

      // Clear current check
      await CashRegisterCheck.deleteOne({ userId, type: 'current' });

      res.json({ success: true, check });
    } catch (error) {
      console.error('[Server] Cash register pending CREATE error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to create pending check' });
    }
  });

  app.post('/api/cash-register/complete', async (req, res) => {
    try {
      const { items, total, paymentType, userId, saleType } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      const check = await CashRegisterCheck.create({
        userId,
        items: items || [],
        total: total || 0,
        type: 'completed',
        paymentType: paymentType || null,
        saleType: saleType || 'sale'
      });

      // Clear current check
      await CashRegisterCheck.deleteOne({ userId, type: 'current' });

      res.json({ success: true, check });
    } catch (error) {
      console.error('[Server] Cash register COMPLETE error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to complete check' });
    }
  });

  app.post('/api/cash-register/restore/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      const pendingCheck = await CashRegisterCheck.findOne({ _id: id, userId });
      if (!pendingCheck || pendingCheck.type !== 'pending') {
        return res.status(404).json({ success: false, error: 'Pending check not found' });
      }

      // Save as current
      await CashRegisterCheck.findOneAndUpdate(
        { userId, type: 'current' },
        { userId, items: pendingCheck.items, total: pendingCheck.total, type: 'current' },
        { upsert: true }
      );

      // Delete from pending
      await CashRegisterCheck.findByIdAndDelete(id);

      res.json({ success: true });
    } catch (error) {
      console.error('[Server] Cash register RESTORE error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to restore check' });
    }
  });

  app.delete('/api/cash-register/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }

      await CashRegisterCheck.findOneAndDelete({ _id: id, userId });
      res.json({ success: true });
    } catch (error) {
      console.error('[Server] Cash register DELETE error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to delete check' });
    }
  });

  // ============ BLACKLIST ============
  app.get('/api/blacklist', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID kerak' });
      }

      // Convert userId to ObjectId and search by both formats
      let userObjectId;
      try {
        userObjectId = new mongoose.Types.ObjectId(String(userId));
      } catch (e) {
        userObjectId = null;
      }

      const query = userObjectId 
        ? { $or: [{ userId: userId }, { userId: userObjectId }] }
        : { userId: userId };

      const blacklist = await Blacklist.find(query).sort({ createdAt: -1 }).lean();
      console.log(`[Server] Found ${blacklist.length} blacklist entries for user ${userId}`);

      res.json({
        success: true,
        blacklist: blacklist.map(b => ({
          _id: b._id.toString(),
          creditor: b.creditor,
          phone: b.phone,
          reason: b.reason,
          totalUnpaidAmount: b.totalUnpaidAmount,
          createdAt: b.createdAt
        }))
      });
    } catch (error) {
      console.error('[Server] Blacklist GET error:', error.message);
      res.status(500).json({ success: false, error: 'Server xatosi' });
    }
  });

  app.get('/api/blacklist/check', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      const { phone, creditor } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID kerak' });
      }

      // Convert userId to ObjectId
      let userObjectId;
      try {
        userObjectId = new mongoose.Types.ObjectId(String(userId));
      } catch (e) {
        userObjectId = null;
      }

      const query = userObjectId 
        ? { $or: [{ userId: userId }, { userId: userObjectId }] }
        : { userId: userId };
        
      if (phone) {
        query.phone = phone;
      } else if (creditor) {
        query.creditor = { $regex: new RegExp(creditor, 'i') };
      } else {
        return res.status(400).json({ success: false, error: 'Telefon yoki ism kerak' });
      }

      const blacklistEntry = await Blacklist.findOne(query).lean();

      res.json({
        success: true,
        isBlacklisted: !!blacklistEntry,
        entry: blacklistEntry ? {
          _id: blacklistEntry._id.toString(),
          creditor: blacklistEntry.creditor,
          phone: blacklistEntry.phone,
          reason: blacklistEntry.reason,
          totalUnpaidAmount: blacklistEntry.totalUnpaidAmount
        } : null
      });
    } catch (error) {
      console.error('[Server] Blacklist check error:', error.message);
      res.status(500).json({ success: false, error: 'Server xatosi' });
    }
  });

  // ============ DEBT UNPAID (Blacklist) ============
  app.patch('/api/debts/:id/unpaid', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const debt = await Debt.findById(id);
      if (!debt) {
        return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
      }

      debt.status = 'unpaid';
      await debt.save();

      // Convert userId to ObjectId for blacklist
      let userObjectId;
      try {
        userObjectId = new mongoose.Types.ObjectId(String(debt.userId));
      } catch (e) {
        console.error('[Server] Invalid userId format in debt:', debt.userId);
        return res.status(400).json({ success: false, error: 'Noto\'g\'ri user ID formati' });
      }

      // Add to blacklist
      const query = { userId: userObjectId };
      if (debt.phone) {
        query.$and = [
          { userId: userObjectId },
          { $or: [{ phone: debt.phone }, { creditor: debt.creditor }] }
        ];
      } else {
        query.creditor = debt.creditor;
      }

      const existingBlacklist = await Blacklist.findOne(query);

      if (existingBlacklist) {
        existingBlacklist.totalUnpaidAmount += debt.amount;
        existingBlacklist.reason = reason || `Qarz to'lanmadi: ${debt.amount} ${debt.currency}`;
        await existingBlacklist.save();
        console.log('[Server] Blacklist updated for:', debt.creditor);
      } else {
        await Blacklist.create({
          userId: userObjectId,
          creditor: debt.creditor,
          phone: debt.phone,
          reason: reason || `Qarz to'lanmadi: ${debt.amount} ${debt.currency}`,
          debtId: debt._id,
          totalUnpaidAmount: debt.amount
        });
        console.log('[Server] Blacklist created for:', debt.creditor);
      }

      // Save history
      await DebtHistory.create({
        debtId: debt._id,
        action: 'unpaid',
        amount: debt.amount,
        reason: reason || "Qarz to'lanmadi - qora ro'yxatga qo'shildi"
      });

      res.json({
        success: true,
        debt: { _id: debt._id.toString(), status: debt.status, updatedAt: debt.updatedAt },
        message: `${debt.creditor} qora ro'yxatga qo'shildi`
      });
    } catch (error) {
      console.error('[Server] Debt unpaid error:', error.message);
      res.status(500).json({ success: false, error: 'Server xatosi' });
    }
  });

  // ============ SYNC STATUS ============
  app.get('/api/products/sync-status', async (req, res) => {
    try {
      const { userId } = req.query;
      const count = userId 
        ? await Product.countDocuments({ userId })
        : await Product.countDocuments();
      
      res.json({ 
        success: true, 
        totalProducts: count,
        lastSync: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Server] Sync status error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Static files - public folder
  const publicPath = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log('[Server] Serving static files from:', publicPath);
  }

  // Static files - dist folder (built client)
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    console.log('[Server] Serving static files from:', distPath);
  }

  // SPA fallback - ВАЖНО: используем app.use(), НЕ app.get('*')
  app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Serve index.html for SPA routes
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('index.html not found. Run build:client first.');
    }
  });

  return app;
}

async function startServer() {
  return new Promise(async (resolve, reject) => {
    try {
      // Connect to MongoDB first
      await connectMongoDB();
      
      // Create Express app
      createExpressApp();
      
      // Start server
      server = app.listen(PORT, '127.0.0.1', () => {
        console.log(`[Server] Running on http://127.0.0.1:${PORT}`);
        console.log(`[Server] MongoDB: ${isConnected ? 'connected' : 'disconnected'}`);
        resolve({ port: PORT, url: `http://127.0.0.1:${PORT}` });
      });

      server.on('error', (err) => {
        console.error('[Server] Error:', err.message);
        reject(err);
      });
    } catch (error) {
      console.error('[Server] Failed to start:', error.message);
      reject(error);
    }
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Server] Stopped');
        resolve();
      });
    } else {
      resolve();
    }
    
    if (mongoose && mongoose.connection) {
      mongoose.connection.close();
    }
  });
}

module.exports = { startServer, stopServer, PORT };
