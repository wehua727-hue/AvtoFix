# Files to Modify - Exact Changes Required

## 📝 Only 2 Files Need to Be Modified

### File 1: server/index.ts

**Location**: `server/index.ts`

**Change Type**: Replace imports and remove code

---

#### Change 1a: Replace Imports (Lines 1-20)

**FIND THIS:**
```typescript
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductsClearAll, handleProductStockUpdate, handleProductHistoryGet, handleProductHistoryCreate, handleProductHistoryDelete, handleProductHistoryClear } from "./routes/products";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories";
import { handleStoresGet, handleStoresCreate, handleStoreDelete } from "./routes/stores";
import { handleProductsSync, handleGetAllProducts } from "./routes/sync";
import { handleBulkSync, handleCreateProduct, handleSyncStatus } from "./routes/product-sync.route";
import { handleCurrencyUsd, handleCurrencyRub, handleCurrencyCny, handleCurrencyRates } from "./routes/currency";
import { handleLogin, handleVerifyToken, handleLoginAs } from "./routes/auth";
import { handleUsersGet, handleUserCreate, handleUserUpdate, handleUserDelete } from "./routes/users";
import { handleCustomersGet, handleCustomerCreate, handleCustomerUpdate, handleCustomerDelete, handleBirthdayNotifications, handleTopCustomers } from "./routes/customers";
import { handleOrdersGet, handleOrderCreate, handleFrequentCustomers, handleAutoPromoteCustomers } from "./routes/orders";
import { handleDebtsGet, handleDebtCreate, handleDebtUpdate, handleDebtMarkAsPaid, handleDebtMarkAsUnpaid, handleDebtAdjust, handleDebtDelete, handleDebtHistoryGet, handleBlacklistGet, handleBlacklistCheck } from "./routes/debts";
import { handleCashRegisterGet, handleCurrentCheckGet, handleCurrentCheckSave, handlePendingCheckCreate, handleCheckComplete, handlePendingCheckRestore, handleCheckDelete } from "./routes/cash-register";
import { handleDevicesList } from "./routes/devices";
import { handleProductsDelta } from "./routes/products-delta";
import { handleOfflineSalesSync, handleGetOfflineSales, handleOfflineSalesStats, handleOfflineSalesCleanup } from "./routes/offline-sync";
import { handleExcelImport, handleExcelPreview, handleExcelImportFix } from "./routes/excel-import";
import defectiveRouter from "./routes/defective";
import { connectMongo } from "./mongo";
import { initTelegramBot } from "./telegram-bot";
import { startBirthdayChecker } from "./birthday-checker";
import { startDebtChecker } from "./debt-checker";
import { startSubscriptionChecker } from "./subscription-checker";
```

**REPLACE WITH:**
```typescript
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductsClearAll, handleProductStockUpdate, handleProductHistoryGet, handleProductHistoryCreate, handleProductHistoryDelete, handleProductHistoryClear } from "./routes/products-offline";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories-offline";
import { handleStoresGet, handleStoresCreate, handleStoreDelete } from "./routes/stores-offline";
import { handleDebtsGet, handleDebtCreate, handleDebtUpdate, handleDebtMarkAsPaid, handleDebtMarkAsUnpaid, handleDebtDelete, handleDebtHistoryGet, handleBlacklistGet, handleBlacklistCheck } from "./routes/debts-offline";
import { handleCustomersGet, handleCustomerCreate, handleCustomerUpdate, handleCustomerDelete, handleTopCustomers, handleBirthdayNotifications } from "./routes/customers-offline";
import { handleCashRegisterGet, handleCurrentCheckGet, handleCurrentCheckSave, handlePendingCheckCreate, handleCheckComplete, handlePendingCheckRestore, handleCheckDelete } from "./routes/cash-register-offline";
import { handleLogin, handleRegister } from "./routes/auth-local";
import { handleUsersGet, handleUserCreate, handleUserUpdate, handleUserDelete } from "./routes/users-offline";
```

---

#### Change 1b: Remove MongoDB & External Services Initialization

**FIND THIS SECTION:**
```typescript
export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Init MongoDB
  connectMongo().catch((err) => {
    console.error("[mongo] Failed to connect:", err);
  });

  // Init Telegram Bot
  initTelegramBot();

  // Start checkers
  startBirthdayChecker();
  startDebtChecker();
  startSubscriptionChecker();
```

**REPLACE WITH:**
```typescript
export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Offline mode - no MongoDB, Telegram, or external services
```

---

#### Change 1c: Update Auth Routes

**FIND THIS:**
```typescript
  // AUTH ENDPOINTS
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/verify", handleVerifyToken);
  app.post("/api/auth/login-as", handleLoginAs);
```

**REPLACE WITH:**
```typescript
  // AUTH ENDPOINTS
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/register", handleRegister);
```

---

#### Change 1d: Remove Unused Routes (Optional)

**FIND AND REMOVE THESE SECTIONS:**
```typescript
  // SYNC ENDPOINTS (legacy)
  app.post("/api/products/sync", handleProductsSync);
  
  // OFFLINE-FIRST SYNC ENDPOINTS
  app.post("/api/products/bulk-sync", handleBulkSync);
  app.post("/api/products/create", handleCreateProduct);

  // ... other sync routes ...

  // CURRENCY ENDPOINTS
  app.get("/api/currency/usd", handleCurrencyUsd);
  app.get("/api/currency/rub", handleCurrencyRub);
  app.get("/api/currency/cny", handleCurrencyCny);
  app.get("/api/currency/rates", handleCurrencyRates);

  // ORDERS ENDPOINTS
  app.get("/api/orders", handleOrdersGet);
  app.post("/api/orders", handleOrderCreate);
  app.get("/api/orders/frequent-customers", handleFrequentCustomers);
  app.post("/api/orders/auto-promote-customers", handleAutoPromoteCustomers);

  // DEVICES ENDPOINTS
  app.get("/api/devices", handleDevicesList);

  // PRODUCTS DELTA ENDPOINTS
  app.get("/api/products/delta", handleProductsDelta);

  // OFFLINE SALES SYNC ENDPOINTS
  app.post("/api/offline-sales/sync", handleOfflineSalesSync);
  app.get("/api/offline-sales", handleGetOfflineSales);
  app.get("/api/offline-sales/stats", handleOfflineSalesStats);
  app.post("/api/offline-sales/cleanup", handleOfflineSalesCleanup);

  // EXCEL IMPORT ENDPOINTS
  app.post("/api/excel/import", handleExcelImport);
  app.post("/api/excel/preview", handleExcelPreview);
  app.post("/api/excel/import-fix", handleExcelImportFix);

  // DEFECTIVE PRODUCTS
  app.use("/api/defective", defectiveRouter);
```

---

### File 2: electron/main.cjs

**Location**: `electron/main.cjs`

**Change Type**: Add environment variables

---

#### Change 2: Add Offline Environment Variables

**FIND THIS SECTION (near the top of the file, after all require statements):**
```javascript
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
// ... other requires ...
```

**ADD THIS AFTER ALL REQUIRES:**
```javascript
// Set offline mode environment variables
process.env.OFFLINE_MODE = 'true';
process.env.DISABLE_TELEGRAM = 'true';
process.env.DISABLE_EXTERNAL_APIS = 'true';
process.env.DISABLE_MONGODB = 'true';
process.env.SKIP_TELEGRAM_BOT = 'true';
process.env.SKIP_BIRTHDAY_CHECKER = 'true';
process.env.SKIP_DEBT_CHECKER = 'true';
process.env.SKIP_SUBSCRIPTION_CHECKER = 'true';
```

---

## ✅ Summary of Changes

### server/index.ts
- ✅ Replace 20+ import lines (1 change)
- ✅ Remove MongoDB initialization (1 change)
- ✅ Remove Telegram bot initialization (1 change)
- ✅ Remove checkers initialization (1 change)
- ✅ Update auth routes (1 change)
- ✅ Remove unused routes (optional)

**Total changes: 5-6 edits**

### electron/main.cjs
- ✅ Add 8 environment variable lines (1 change)

**Total changes: 1 edit**

---

## 🎯 Verification

After making changes, verify:

### server/index.ts
- [ ] No import errors
- [ ] No MongoDB imports
- [ ] No Telegram imports
- [ ] No checker imports
- [ ] Offline routes imported
- [ ] Auth routes updated

### electron/main.cjs
- [ ] Environment variables set
- [ ] No syntax errors
- [ ] File saves successfully

---

## 🚀 Next Steps After Modifications

1. **Test server startup:**
   ```bash
   pnpm run dev:server
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:5173/api/health
   ```

3. **Test full development:**
   ```bash
   pnpm run dev
   ```

4. **Build Windows .exe:**
   ```bash
   pnpm run build:client
   pnpm run electron:build:win
   ```

---

## 📋 Checklist

### Before Making Changes
- [ ] Read QUICK_START_OFFLINE.md
- [ ] Backup server/index.ts
- [ ] Backup electron/main.cjs
- [ ] Have all offline route files ready

### Making Changes
- [ ] Update server/index.ts imports
- [ ] Remove MongoDB initialization
- [ ] Remove Telegram initialization
- [ ] Remove checkers initialization
- [ ] Update auth routes
- [ ] Update electron/main.cjs

### After Making Changes
- [ ] No compilation errors
- [ ] No import errors
- [ ] Server starts successfully
- [ ] All endpoints respond
- [ ] Data persists correctly

---

## 💡 Tips

- **Use Find & Replace**: Use your editor's find & replace feature
- **One Change at a Time**: Make one change, test, then move to next
- **Keep Backups**: Save original files before modifying
- **Test After Each Change**: Verify no errors after each modification

---

## ❓ Questions?

- **How to find the section?** Use Ctrl+F (Find) in your editor
- **How to replace?** Use Ctrl+H (Find & Replace) in your editor
- **What if I make a mistake?** Undo with Ctrl+Z or restore from backup
- **Need help?** Check OFFLINE_IMPLEMENTATION_GUIDE.md

---

**Total Modification Time: ~20 minutes**

