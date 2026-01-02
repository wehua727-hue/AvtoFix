# Next Actions - Offline Electron Conversion

## Current Status: 70% Complete

✅ **Completed:**
- Local database implementation
- Local authentication
- All offline route files created (7 files)
- Comprehensive documentation

⏳ **Remaining:**
- Update server/index.ts to use offline routes
- Remove MongoDB dependencies
- Test all functionality
- Build Windows .exe

---

## Action 1: Update server/index.ts

### File: `server/index.ts`

**Step 1: Replace imports**

Find and replace these imports:
```typescript
// REMOVE THESE:
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductsClearAll, handleProductStockUpdate, handleProductHistoryGet, handleProductHistoryCreate, handleProductHistoryDelete, handleProductHistoryClear } from "./routes/products";
import { handleUsersGet, handleUserCreate, handleUserUpdate, handleUserDelete } from "./routes/users";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories";
import { handleStoresGet, handleStoresCreate, handleStoreDelete } from "./routes/stores";
import { handleLogin, handleVerifyToken, handleLoginAs } from "./routes/auth";

// ADD THESE:
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductsClearAll, handleProductStockUpdate, handleProductHistoryGet, handleProductHistoryCreate, handleProductHistoryDelete, handleProductHistoryClear } from "./routes/products-offline";
import { handleUsersGet, handleUserCreate, handleUserUpdate, handleUserDelete } from "./routes/users-offline";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories-offline";
import { handleStoresGet, handleStoresCreate, handleStoreDelete } from "./routes/stores-offline";
import { handleDebtsGet, handleDebtCreate, handleDebtUpdate, handleDebtMarkAsPaid, handleDebtMarkAsUnpaid, handleDebtDelete, handleDebtHistoryGet, handleBlacklistGet, handleBlacklistCheck } from "./routes/debts-offline";
import { handleCustomersGet, handleCustomerCreate, handleCustomerUpdate, handleCustomerDelete, handleTopCustomers, handleBirthdayNotifications } from "./routes/customers-offline";
import { handleCashRegisterGet, handleCurrentCheckGet, handleCurrentCheckSave, handlePendingCheckCreate, handleCheckComplete, handlePendingCheckRestore, handleCheckDelete } from "./routes/cash-register-offline";
import { handleLogin, handleRegister } from "./routes/auth-local";
```

**Step 2: Remove MongoDB initialization**

Find and remove:
```typescript
// REMOVE THIS ENTIRE SECTION:
import { connectMongo } from "./mongo";

export function createServer() {
  const app = express();
  
  // ... middleware ...
  
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

**Step 3: Remove Telegram and checker imports**

Find and remove:
```typescript
// REMOVE THESE IMPORTS:
import { initTelegramBot } from "./telegram-bot";
import { startBirthdayChecker } from "./birthday-checker";
import { startDebtChecker } from "./debt-checker";
import { startSubscriptionChecker } from "./subscription-checker";
```

**Step 4: Update auth routes**

Find the auth routes section and update:
```typescript
// REPLACE:
app.post("/api/auth/login", handleLogin);
app.post("/api/auth/verify", handleVerifyToken);
app.post("/api/auth/login-as", handleLoginAs);

// WITH:
app.post("/api/auth/login", handleLogin);
app.post("/api/auth/register", handleRegister);
```

---

## Action 2: Create Environment Configuration

### File: `.env.electron`

Create this file in the root directory:

```env
# Offline Mode Configuration
OFFLINE_MODE=true
DISABLE_TELEGRAM=true
DISABLE_EXTERNAL_APIS=true
DISABLE_MONGODB=true

# Server Configuration
PORT=5173
API_PORT=5173
NODE_ENV=production

# Database Configuration
DATABASE_TYPE=local
DATABASE_PATH=./data/database.json

# Disable External Services
SKIP_TELEGRAM_BOT=true
SKIP_BIRTHDAY_CHECKER=true
SKIP_DEBT_CHECKER=true
SKIP_SUBSCRIPTION_CHECKER=true

# App Configuration
APP_NAME=oflayn-dokon
APP_VERSION=1.0.0
```

---

## Action 3: Update electron/main.cjs

### File: `electron/main.cjs`

Add these lines at the top of the file (after requires):

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

## Action 4: Testing

### Test 1: Start Development Server

```bash
# Terminal 1: Start server
pnpm run dev:server

# Terminal 2: Test health endpoint
curl http://localhost:5173/api/health

# Expected response:
# {"status":"ok"}
```

### Test 2: Test Authentication

```bash
# Register new user
curl -X POST http://localhost:5173/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "998901234567",
    "password": "test123",
    "name": "Test User"
  }'

# Expected response:
# {"success":true,"token":"...","user":{...}}
```

### Test 3: Test Products

```bash
# Create product
curl -X POST http://localhost:5173/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "price": 100000,
    "stock": 10,
    "userId": "user-id"
  }'

# Get products
curl http://localhost:5173/api/products?userId=user-id

# Expected response: Array of products
```

### Test 4: Full Development Build

```bash
# Start full dev environment
pnpm run dev

# Open browser to http://localhost:5174
# Test login, create products, manage users, etc.
```

---

## Action 5: Build Windows .exe

### Step 1: Build Client

```bash
pnpm run build:client
```

Expected output:
```
✓ 39 modules transformed
dist/index.html
dist/assets/...
```

### Step 2: Build Electron App

```bash
pnpm run electron:build:win
```

Expected output:
```
Building for Windows...
✓ Electron app built successfully
dist/oflayn-dokon Setup 1.0.0.exe
dist/oflayn-dokon 1.0.0.exe
```

### Step 3: Test Windows .exe

1. Run the installer: `dist/oflayn-dokon Setup 1.0.0.exe`
2. Or run portable: `dist/oflayn-dokon 1.0.0.exe`
3. Test login and basic functionality
4. Verify data persists after restart

---

## Action 6: Verification Checklist

Before considering the conversion complete:

### Database
- [ ] `database.json` created in correct location
- [ ] All collections initialized
- [ ] Data persists after app restart

### Authentication
- [ ] Login works with local database
- [ ] Register works with local database
- [ ] Passwords hashed with bcrypt
- [ ] Token generation works

### Products
- [ ] Create product works
- [ ] Read products works
- [ ] Update product works
- [ ] Delete product works
- [ ] Stock updates work
- [ ] History tracking works

### Users
- [ ] Create user works
- [ ] Read users works
- [ ] Update user works
- [ ] Delete user works

### Categories
- [ ] Create category works
- [ ] Read categories works
- [ ] Update category works
- [ ] Delete category works

### Stores
- [ ] Create store works
- [ ] Read stores works
- [ ] Delete store works

### Debts
- [ ] Create debt works
- [ ] Mark as paid works
- [ ] Mark as unpaid works
- [ ] Blacklist check works

### Customers
- [ ] Create customer works
- [ ] Read customers works
- [ ] Update customer works
- [ ] Delete customer works

### Cash Register
- [ ] Create check works
- [ ] Complete check works
- [ ] Restore check works

### Offline Operation
- [ ] No MongoDB connection attempts
- [ ] No Telegram bot errors
- [ ] No external API calls
- [ ] All data stored locally
- [ ] App works without internet

---

## Quick Reference: File Changes Summary

### Files to Modify:
1. `server/index.ts` - Replace imports, remove MongoDB/Telegram
2. `electron/main.cjs` - Add offline environment variables
3. `.env` - Add offline configuration (optional)

### Files Already Created:
1. `server/db/local-db.ts` - Local database
2. `server/routes/auth-local.ts` - Local auth
3. `server/routes/products-offline.ts` - Products
4. `server/routes/users-offline.ts` - Users
5. `server/routes/categories-offline.ts` - Categories
6. `server/routes/stores-offline.ts` - Stores
7. `server/routes/debts-offline.ts` - Debts
8. `server/routes/customers-offline.ts` - Customers
9. `server/routes/cash-register-offline.ts` - Cash register

### Documentation Created:
1. `OFFLINE_CONVERSION_PLAN.md` - Overall strategy
2. `OFFLINE_IMPLEMENTATION_GUIDE.md` - Detailed guide
3. `OFFLINE_ROUTES_CREATED.md` - Routes summary
4. `NEXT_ACTIONS.md` - This file

---

## Estimated Timeline

- **Update server/index.ts**: 15-20 minutes
- **Update electron/main.cjs**: 5 minutes
- **Testing**: 30-45 minutes
- **Build Windows .exe**: 10-15 minutes
- **Total**: ~1-1.5 hours

---

## Support

If you encounter issues:

1. Check `OFFLINE_IMPLEMENTATION_GUIDE.md` for troubleshooting
2. Review `OFFLINE_ROUTES_CREATED.md` for API reference
3. Check console logs for error messages
4. Verify all files are created in correct locations
5. Ensure file permissions are correct

---

## Success Criteria

The offline conversion is complete when:

✅ All tests pass
✅ Windows .exe builds successfully
✅ App runs offline without errors
✅ Data persists after restart
✅ No MongoDB/Telegram/external API errors
✅ All CRUD operations work
✅ User can install and use app on Windows

