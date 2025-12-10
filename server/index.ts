import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductStockUpdate } from "./routes/products";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories";
import { handleStoresGet, handleStoresCreate } from "./routes/stores";
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
import { connectMongo } from "./mongo";
import { initTelegramBot } from "./telegram-bot";
import { startBirthdayChecker } from "./birthday-checker";
import { startDebtChecker } from "./debt-checker";
import { startSubscriptionChecker } from "./subscription-checker";
export { wsManager } from "./websocket";

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

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // AUTH ENDPOINTS
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/verify", handleVerifyToken);
  app.post("/api/auth/login-as", handleLoginAs);

  // SYNC ENDPOINTS (legacy)
  app.post("/api/products/sync", handleProductsSync);
  
  // OFFLINE-FIRST SYNC ENDPOINTS
  app.post("/api/products/bulk-sync", handleBulkSync);
  app.post("/api/products/create", handleCreateProduct);

  // PRODUCTS ENDPOINTS
  // Порядок важен: сначала все конкретные роуты, потом параметрические
  app.post("/api/products", handleProductsCreate);
  app.get("/api/products", handleProductsGet);
  // Все "словарные" GET роуты должны быть выше /api/products/:id
  app.get("/api/products/all", handleGetAllProducts);
  app.get("/api/products/delta", handleProductsDelta);
  app.get("/api/products/sync-status", handleSyncStatus);
  // Параметрические роуты - в конце, :id последним
  app.put("/api/products/:id", handleProductUpdate);
  app.patch("/api/products/:id/stock", handleProductStockUpdate);
  app.delete("/api/products/:id", handleProductDelete);
  app.get("/api/products/:id", handleProductGetById); // ВСЕГДА последним

  // CATEGORIES ENDPOINTS
  app.get("/api/categories", handleCategoriesGet);
  app.post("/api/categories", handleCategoriesCreate);
  app.put("/api/categories/:id", handleCategoryUpdate);
  app.delete("/api/categories/:id", handleCategoryDelete);

  // STORES ENDPOINTS
  app.get("/api/stores", handleStoresGet);
  app.post("/api/stores", handleStoresCreate);

  // USERS ENDPOINTS
  app.get("/api/users", handleUsersGet);
  app.post("/api/users", handleUserCreate);
  app.put("/api/users/:id", handleUserUpdate);
  app.delete("/api/users/:id", handleUserDelete);

  // CUSTOMERS ENDPOINTS
  app.get("/api/customers", handleCustomersGet);
  app.post("/api/customers", handleCustomerCreate);
  app.put("/api/customers/:id", handleCustomerUpdate);
  app.delete("/api/customers/:id", handleCustomerDelete);
  app.get("/api/customers/birthdays/notifications", handleBirthdayNotifications);
  app.get("/api/customers/top", handleTopCustomers);

  // ORDERS ENDPOINTS
  app.get("/api/orders", handleOrdersGet);
  app.post("/api/orders", handleOrderCreate);
  app.get("/api/orders/frequent-customers", handleFrequentCustomers);
  app.get("/api/orders/auto-promote", handleAutoPromoteCustomers);

  // DEBTS ENDPOINTS
  app.get("/api/debts", handleDebtsGet);
  app.post("/api/debts", handleDebtCreate);
  app.put("/api/debts/:id", handleDebtUpdate);
  app.patch("/api/debts/:id/paid", handleDebtMarkAsPaid);
  app.patch("/api/debts/:id/unpaid", handleDebtMarkAsUnpaid);
  app.patch("/api/debts/:id/adjust", handleDebtAdjust);
  app.delete("/api/debts/:id", handleDebtDelete);
  app.get("/api/debts/:id/history", handleDebtHistoryGet);

  // BLACKLIST ENDPOINTS
  app.get("/api/blacklist", handleBlacklistGet);
  app.get("/api/blacklist/check", handleBlacklistCheck);

  // DEVICES ENDPOINTS
  app.get("/api/devices/list", handleDevicesList);

  // CURRENCY ENDPOINTS
  app.get("/api/currency/rates", handleCurrencyRates);
  app.get("/api/currency/usd", handleCurrencyUsd);
  app.get("/api/currency/rub", handleCurrencyRub);
  app.get("/api/currency/cny", handleCurrencyCny);

  // OFFLINE SYNC ENDPOINTS
  app.post("/api/sales/offline-sync", handleOfflineSalesSync);
  app.get("/api/sales/offline", handleGetOfflineSales);
  app.get("/api/sales/offline/stats", handleOfflineSalesStats);
  app.delete("/api/sales/offline/cleanup", handleOfflineSalesCleanup);

  // CASH REGISTER ENDPOINTS
  app.get("/api/cash-register", handleCashRegisterGet);
  app.get("/api/cash-register/current", handleCurrentCheckGet);
  app.post("/api/cash-register/current", handleCurrentCheckSave);
  app.post("/api/cash-register/pending", handlePendingCheckCreate);
  app.post("/api/cash-register/complete", handleCheckComplete);
  app.post("/api/cash-register/restore/:id", handlePendingCheckRestore);
  app.delete("/api/cash-register/:id", handleCheckDelete);

  // Error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("[Error Handler]", err?.message || err);
    res.status(500).json({ success: false, error: err?.message || "Server error" });
  });

  return app;
}
