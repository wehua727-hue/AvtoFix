# Offline Electron Conversion Plan

## Overview
Converting the web application to work as a 100% offline Electron desktop app with local JSON database instead of MongoDB.

## Current Status
✅ Local database implementation created (`server/db/local-db.ts`)
✅ Local authentication routes created (`server/routes/auth-local.ts`)
⏳ **IN PROGRESS**: Converting all server routes from MongoDB to local-db

## Step-by-Step Conversion

### Phase 1: Core Route Conversions (CURRENT)
1. **server/routes/products.ts** - Convert MongoDB queries to local-db
2. **server/routes/users.ts** - Convert user management to local-db
3. **server/routes/categories.ts** - Convert categories to local-db
4. **server/routes/stores.ts** - Convert stores to local-db
5. **server/routes/sales.ts** - Convert sales/orders to local-db
6. **server/routes/debts.ts** - Convert debt tracking to local-db
7. **server/routes/customers.ts** - Convert customer data to local-db
8. **server/routes/cash-register.ts** - Convert cash register checks to local-db

### Phase 2: Remove Internet Dependencies
- Remove Telegram bot integration
- Remove cloud API calls
- Remove external service dependencies
- Keep only local operations

### Phase 3: Update Server Configuration
- Update `server/index.ts` to skip MongoDB connection
- Update `server/node-build.ts` for offline operation
- Remove Telegram bot initialization
- Remove external checkers (birthday, debt, subscription)

### Phase 4: Electron Configuration
- Update `electron/main.cjs` for offline-only operation
- Ensure data persistence in user's local directory
- Configure app to work without internet

### Phase 5: Testing & Building
- Test all API endpoints with local database
- Build Windows `.exe` file
- Create user documentation

## Key Changes Required

### MongoDB → Local-DB Conversion Pattern

**Before (MongoDB):**
```typescript
const products = await ProductModel.find({ userId });
```

**After (Local-DB):**
```typescript
const products = findDocuments('products', { userId });
```

### Common Conversions:
- `Model.find(query)` → `findDocuments('collection', query)`
- `Model.findById(id)` → `findOneDocument('collection', { _id: id })`
- `Model.findOne(query)` → `findOneDocument('collection', query)`
- `Model.create(doc)` → `addDocument('collection', doc)`
- `Model.updateOne(query, updates)` → `updateDocument('collection', id, updates)`
- `Model.deleteOne(query)` → `deleteDocument('collection', id)`

## Files to Modify

### Server Routes (8 files)
- [ ] `server/routes/products.ts`
- [ ] `server/routes/users.ts`
- [ ] `server/routes/categories.ts`
- [ ] `server/routes/stores.ts`
- [ ] `server/routes/sales.ts` (if exists)
- [ ] `server/routes/debts.ts`
- [ ] `server/routes/customers.ts`
- [ ] `server/routes/cash-register.ts`

### Server Configuration (3 files)
- [ ] `server/index.ts` - Remove MongoDB init, Telegram bot, checkers
- [ ] `server/node-build.ts` - Already prepared for offline
- [ ] `server/mongo.ts` - Can be removed or stubbed

### Electron Configuration (1 file)
- [ ] `electron/main.cjs` - Ensure offline operation

## Important Notes

1. **Data Persistence**: All data stored in `~/.config/oflayn-dokon/data/database.json` (Electron user data directory)
2. **No Internet Required**: App works 100% offline
3. **Per-User Data**: Each user's data stored only on their computer
4. **Windows .exe Output**: Build with `pnpm run electron:build:win`
5. **Backward Compatibility**: Web version remains unchanged

## Testing Checklist

- [ ] Login/Register works with local database
- [ ] Products CRUD operations work
- [ ] Sales/Orders creation works
- [ ] Debt tracking works
- [ ] Customer management works
- [ ] Cash register checks work
- [ ] All data persists after app restart
- [ ] Windows .exe builds successfully
- [ ] App runs offline without errors

