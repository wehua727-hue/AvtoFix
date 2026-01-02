# Quick Start - Offline Electron Conversion

## TL;DR - 3 Simple Steps to Complete Offline Version

### Step 1: Update server/index.ts (15 minutes)

**Location**: `server/index.ts`

**Action 1a**: Replace imports at the top of file

Find and replace these import lines:
```typescript
// FIND AND REMOVE:
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductsClearAll, handleProductStockUpdate, handleProductHistoryGet, handleProductHistoryCreate, handleProductHistoryDelete, handleProductHistoryClear } from "./routes/products";
import { handleUsersGet, handleUserCreate, handleUserUpdate, handleUserDelete } from "./routes/users";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories";
import { handleStoresGet, handleStoresCreate, handleStoreDelete } from "./routes/stores";
import { handleLogin, handleVerifyToken, handleLoginAs } from "./routes/auth";
import { connectMongo } from "./mongo";
import { initTelegramBot } from "./telegram-bot";
import { startBirthdayChecker } from "./birthday-checker";
import { startDebtChecker } from "./debt-checker";
import { startSubscriptionChecker } from "./subscription-checker";

// REPLACE WITH:
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductsClearAll, handleProductStockUpdate, handleProductHistoryGet, handleProductHistoryCreate, handleProductHistoryDelete, handleProductHistoryClear } from "./routes/products-offline";
import { handleUsersGet, handleUserCreate, handleUserUpdate, handleUserDelete } from "./routes/users-offline";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories-offline";
import { handleStoresGet, handleStoresCreate, handleStoreDelete } from "./routes/stores-offline";
import { handleDebtsGet, handleDebtCreate, handleDebtUpdate, handleDebtMarkAsPaid, handleDebtMarkAsUnpaid, handleDebtDelete, handleDebtHistoryGet, handleBlacklistGet, handleBlacklistCheck } from "./routes/debts-offline";
import { handleCustomersGet, handleCustomerCreate, handleCustomerUpdate, handleCustomerDelete, handleTopCustomers, handleBirthdayNotifications } from "./routes/customers-offline";
import { handleCashRegisterGet, handleCurrentCheckGet, handleCurrentCheckSave, handlePendingCheckCreate, handleCheckComplete, handlePendingCheckRestore, handleCheckDelete } from "./routes/cash-register-offline";
import { handleLogin, handleRegister } from "./routes/auth-local";
```

**Action 1b**: Remove MongoDB and external service initialization

Find this section in `createServer()` function:
```typescript
// FIND AND REMOVE THIS ENTIRE BLOCK:
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

**Action 1c**: Update auth routes

Find this section:
```typescript
// FIND:
app.post("/api/auth/login", handleLogin);
app.post("/api/auth/verify", handleVerifyToken);
app.post("/api/auth/login-as", handleLoginAs);

// REPLACE WITH:
app.post("/api/auth/login", handleLogin);
app.post("/api/auth/register", handleRegister);
```

---

### Step 2: Update electron/main.cjs (5 minutes)

**Location**: `electron/main.cjs`

**Action 2**: Add offline environment variables

Find the top of the file (after all `require` statements) and add:

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

### Step 3: Test & Build (1 hour)

**Test Development Server:**
```bash
# Terminal 1: Start server
pnpm run dev:server

# Terminal 2: Test health endpoint
curl http://localhost:5173/api/health
# Expected: {"status":"ok"}
```

**Test Full Development:**
```bash
# Start full dev environment
pnpm run dev

# Open http://localhost:5174 in browser
# Test login, create products, etc.
```

**Build Windows .exe:**
```bash
# Build client
pnpm run build:client

# Build Windows executable
pnpm run electron:build:win

# Output: dist/oflayn-dokon Setup 1.0.0.exe
```

---

## What's Already Done ✅

All offline route files are already created:
- ✅ `server/db/local-db.ts` - Local database
- ✅ `server/routes/auth-local.ts` - Local authentication
- ✅ `server/routes/products-offline.ts` - Products
- ✅ `server/routes/users-offline.ts` - Users
- ✅ `server/routes/categories-offline.ts` - Categories
- ✅ `server/routes/stores-offline.ts` - Stores
- ✅ `server/routes/debts-offline.ts` - Debts
- ✅ `server/routes/customers-offline.ts` - Customers
- ✅ `server/routes/cash-register-offline.ts` - Cash register

---

## Key Points

### ✅ What You Get:
- 100% offline operation
- No internet required
- All data stored locally
- Windows .exe installer
- No MongoDB needed
- No Telegram bot
- No external APIs

### ❌ What's Removed:
- MongoDB connection
- Telegram bot
- External API calls
- Cloud synchronization
- Birthday notifications (local only)
- Debt checkers (local only)

### 📁 Data Storage:
- Windows: `C:\Users\[Username]\AppData\Local\oflayn-dokon\data\database.json`
- All user data stored locally on their computer

---

## Verification Checklist

After completing all 3 steps, verify:

- [ ] Server starts without MongoDB errors
- [ ] No Telegram bot errors
- [ ] Login works
- [ ] Create product works
- [ ] Data persists after restart
- [ ] Windows .exe builds successfully
- [ ] App runs offline

---

## Troubleshooting

### "Cannot find module" error
**Solution**: Ensure all offline route files exist in `server/routes/`

### "Database not available" error
**Solution**: Check that `server/db/local-db.ts` is imported in `server/index.ts`

### Port 5173 already in use
**Solution**: 
```bash
# Windows: Find and kill process
netstat -ano | findstr :5173
taskkill /PID [PID] /F

# Or change port in .env
PORT=5174
```

### Windows .exe won't build
**Solution**: 
```bash
# Clean and rebuild
rm -rf dist
pnpm run build:client
pnpm run electron:build:win
```

---

## Timeline

- **Step 1 (Update server/index.ts)**: 15 minutes
- **Step 2 (Update electron/main.cjs)**: 5 minutes
- **Step 3 (Test & Build)**: 45-60 minutes
- **Total**: ~1.5 hours

---

## Success = Done! 🎉

When you can:
1. ✅ Start the app offline
2. ✅ Login with local database
3. ✅ Create/edit/delete products
4. ✅ Manage users and categories
5. ✅ Data persists after restart
6. ✅ Windows .exe installs and runs

**You're done!** The offline Electron version is complete.

---

## Next: Distribute to Users

Once built, share the `.exe` file:
```
dist/oflayn-dokon Setup 1.0.0.exe  (Installer)
dist/oflayn-dokon 1.0.0.exe        (Portable)
```

Users can:
1. Download and run the .exe
2. Install the app
3. Use it completely offline
4. All data stored on their computer

---

## Documentation Reference

For more details, see:
- `OFFLINE_ELECTRON_SUMMARY.md` - Complete overview
- `OFFLINE_IMPLEMENTATION_GUIDE.md` - Detailed guide
- `NEXT_ACTIONS.md` - Detailed action items
- `OFFLINE_ROUTES_CREATED.md` - API reference

