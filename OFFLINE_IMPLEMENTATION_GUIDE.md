# Offline Electron Implementation Guide

## Current Progress

✅ **Completed:**
- Local database implementation (`server/db/local-db.ts`)
- Local authentication routes (`server/routes/auth-local.ts`)
- Offline products routes (`server/routes/products-offline.ts`)
- Offline users routes (`server/routes/users-offline.ts`)
- Offline categories routes (`server/routes/categories-offline.ts`)
- Conversion plan and guide documents

⏳ **Next Steps:**
1. Create remaining offline route files
2. Update server/index.ts to use offline routes
3. Update server/node-build.ts for offline operation
4. Remove MongoDB dependencies
5. Test all functionality
6. Build Windows .exe

---

## Step 1: Create Remaining Offline Routes

### Files to Create:

#### 1. `server/routes/stores-offline.ts`
```typescript
// Similar pattern to categories-offline.ts
// Collections: stores
// Operations: GET, POST, PUT, DELETE
```

#### 2. `server/routes/sales-offline.ts` (or orders-offline.ts)
```typescript
// Handle sales/orders
// Collections: sales (or orders)
// Operations: GET, POST, PUT, DELETE
```

#### 3. `server/routes/debts-offline.ts`
```typescript
// Handle debt tracking
// Collections: debts, debt_history
// Operations: GET, POST, PUT, DELETE, mark-as-paid, mark-as-unpaid
```

#### 4. `server/routes/customers-offline.ts`
```typescript
// Handle customer management
// Collections: customers
// Operations: GET, POST, PUT, DELETE
```

#### 5. `server/routes/cash-register-offline.ts`
```typescript
// Handle cash register checks
// Collections: cash_register_checks
// Operations: GET, POST, PUT, DELETE
```

---

## Step 2: Update server/index.ts

### Changes Required:

1. **Remove MongoDB initialization:**
```typescript
// REMOVE THIS:
import { connectMongo } from "./mongo";
connectMongo().catch((err) => {
  console.error("[mongo] Failed to connect:", err);
});

// REMOVE THIS:
initTelegramBot();
startBirthdayChecker();
startDebtChecker();
startSubscriptionChecker();
```

2. **Import offline routes instead of MongoDB routes:**
```typescript
// REPLACE:
import { handleProductsGet, ... } from "./routes/products";

// WITH:
import { handleProductsGet, ... } from "./routes/products-offline";
import { handleUsersGet, ... } from "./routes/users-offline";
import { handleCategoriesGet, ... } from "./routes/categories-offline";
// etc.
```

3. **Use local auth instead of MongoDB auth:**
```typescript
// REPLACE:
import { handleLogin, handleVerifyToken } from "./routes/auth";

// WITH:
import { handleLogin, handleRegister } from "./routes/auth-local";
```

4. **Remove external service initialization:**
```typescript
// REMOVE:
- Telegram bot initialization
- Birthday checker
- Debt checker
- Subscription checker
- Any external API calls
```

---

## Step 3: Update server/node-build.ts

### Changes Required:

The file is already prepared for offline operation. Just ensure:

1. No MongoDB connection attempts
2. Proper error handling for missing services
3. Correct port configuration

---

## Step 4: Update electron/main.cjs

### Changes Required:

1. **Ensure offline-only operation:**
```javascript
// Add environment variable to disable internet features
process.env.OFFLINE_MODE = 'true';
process.env.DISABLE_TELEGRAM = 'true';
process.env.DISABLE_EXTERNAL_APIS = 'true';
```

2. **Configure data directory:**
```javascript
// Data stored in user's local directory
const userData = app.getPath('userData');
// Database file: userData/data/database.json
```

3. **Disable internet-dependent features:**
```javascript
// No Telegram bot
// No cloud sync
// No external API calls
```

---

## Step 5: Environment Configuration

### Create `.env.electron` file:

```env
# Offline Mode
OFFLINE_MODE=true
DISABLE_TELEGRAM=true
DISABLE_EXTERNAL_APIS=true
DISABLE_MONGODB=true

# Server
PORT=5173
API_PORT=5173
NODE_ENV=production

# Database
DATABASE_TYPE=local
DATABASE_PATH=./data/database.json

# Disable external services
SKIP_TELEGRAM_BOT=true
SKIP_BIRTHDAY_CHECKER=true
SKIP_DEBT_CHECKER=true
SKIP_SUBSCRIPTION_CHECKER=true
```

---

## Step 6: Testing Checklist

### Before Building:

- [ ] Local database initializes correctly
- [ ] Login/Register works with local database
- [ ] Products CRUD operations work
- [ ] Users management works
- [ ] Categories management works
- [ ] All data persists after app restart
- [ ] No MongoDB connection attempts
- [ ] No Telegram bot errors
- [ ] No external API calls

### Test Commands:

```bash
# Test local database
npm run test

# Test server with offline routes
npm run dev:server

# Test full app
npm run dev

# Test Electron app
npm run electron:dev

# Build Windows .exe
npm run electron:build:win
```

---

## Step 7: Build Windows .exe

### Build Command:

```bash
# Build client
pnpm run build:client

# Build Windows .exe
pnpm run electron:build:win
```

### Output:
- `dist/oflayn-dokon Setup 1.0.0.exe` - Installer
- `dist/oflayn-dokon 1.0.0.exe` - Portable executable

---

## Step 8: Data Migration (Optional)

### If migrating from MongoDB:

Create `server/scripts/migrate-to-offline.ts`:

```typescript
import { connectMongo } from "../mongo";
import { addDocument, getCollection } from "../db/local-db";

export async function migrateToOffline() {
  const conn = await connectMongo();
  if (!conn || !conn.db) {
    console.error("Cannot connect to MongoDB");
    return;
  }

  const collections = ['users', 'products', 'categories', 'stores', 'sales', 'debts'];
  
  for (const collectionName of collections) {
    const mongoCollection = conn.db.collection(collectionName);
    const documents = await mongoCollection.find({}).toArray();
    
    for (const doc of documents) {
      addDocument(collectionName, doc);
    }
    
    console.log(`Migrated ${documents.length} documents from ${collectionName}`);
  }
}
```

---

## Important Notes

### Data Storage:
- **Windows**: `C:\Users\[Username]\AppData\Local\oflayn-dokon\data\database.json`
- **macOS**: `~/Library/Application Support/oflayn-dokon/data/database.json`
- **Linux**: `~/.config/oflayn-dokon/data/database.json`

### Offline Operation:
- 100% offline - no internet required
- All data stored locally
- No cloud sync
- No external API calls
- No Telegram bot

### Performance:
- JSON file database is suitable for small to medium datasets
- For large datasets (>10,000 products), consider SQLite
- Current implementation handles typical store operations

### Security:
- Passwords hashed with bcrypt
- No sensitive data sent externally
- All data encrypted at rest (optional: add encryption)

---

## Troubleshooting

### Database not found:
```
Error: Database not available
```
**Solution**: Ensure `server/db/local-db.ts` is imported and initialized

### Port already in use:
```
Error: listen EADDRINUSE: address already in use :::5173
```
**Solution**: Change PORT in `.env` or kill process using port 5173

### Data not persisting:
```
Products disappear after restart
```
**Solution**: Check that `database.json` is being written to correct directory

### Electron app won't start:
```
Error: Cannot find module
```
**Solution**: Ensure all offline route files are created and imported in `server/index.ts`

---

## Next Actions

1. Create remaining offline route files (stores, sales, debts, customers, cash-register)
2. Update `server/index.ts` to import offline routes
3. Update `server/node-build.ts` if needed
4. Update `electron/main.cjs` for offline operation
5. Test all functionality
6. Build Windows .exe
7. Create user documentation

