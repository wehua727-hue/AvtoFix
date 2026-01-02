import "dotenv/config";
import express from "express";
import cors from "cors";
import { ObjectId } from "mongodb";
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

  // DEFECTIVE PRODUCTS (Yaroqsiz mahsulotlar)
  app.use("/api/defective", defectiveRouter);

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
  app.delete("/api/products/clear-all", handleProductsClearAll);
  // Параметрические роуты - в конце, :id последним
  app.put("/api/products/:id", handleProductUpdate);
  app.patch("/api/products/:id/stock", handleProductStockUpdate);
  app.delete("/api/products/:id", handleProductDelete);
  app.get("/api/products/:id", handleProductGetById); // ВСЕГДА последним

  // PRODUCT HISTORY ENDPOINTS
  app.get("/api/product-history", handleProductHistoryGet);
  app.post("/api/product-history", handleProductHistoryCreate);
  app.delete("/api/product-history/clear", handleProductHistoryClear);
  app.delete("/api/product-history/:id", handleProductHistoryDelete);

  // CATEGORIES ENDPOINTS
  app.get("/api/categories", handleCategoriesGet);
  app.post("/api/categories", handleCategoriesCreate);
  app.put("/api/categories/:id", handleCategoryUpdate);
  app.delete("/api/categories/:id", handleCategoryDelete);

  // STORES ENDPOINTS
  app.get("/api/stores", handleStoresGet);
  app.post("/api/stores", handleStoresCreate);
  app.delete("/api/stores/:id", handleStoreDelete);

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

  // CHECK VIEWING ENDPOINT - QR code scanner uchun
  app.get("/api/check/:receiptNumber", async (req, res) => {
    try {
      const { receiptNumber } = req.params;
      const conn = await connectMongo();
      if (!conn || !conn.db) {
        return res.status(500).json({ error: "Database not available" });
      }

      // MongoDB dan check ma'lumotlarini qidirish
      const db = conn.db;
      
      // Try to convert to ObjectId if it looks like one
      let filter: any = {
        $or: [
          { recipientNumber: receiptNumber },
          { offlineId: receiptNumber }
        ]
      };
      
      // Try ObjectId if it's a valid MongoDB ID
      try {
        const objectId = new ObjectId(receiptNumber);
        filter.$or.push({ _id: objectId });
      } catch (e) {
        // Not a valid ObjectId, skip
      }

      const sale = await db.collection("sales").findOne(filter);

      if (!sale) {
        return res.status(404).json({ error: "Check not found" });
      }

      // Check ma'lumotlarini qaytarish
      res.json({
        success: true,
        check: {
          receiptNumber: sale.recipientNumber || sale.offlineId || sale._id,
          type: sale.saleType || 'sale',
          date: sale.createdAt || sale.offlineCreatedAt,
          items: sale.items || [],
          total: sale.total,
          paymentType: sale.paymentType,
          cashier: sale.cashier,
          storeName: sale.storeName,
          storeAddress: sale.storeAddress,
          storePhone: sale.storePhone,
        }
      });
    } catch (error) {
      console.error("[check] Error:", error);
      res.status(500).json({ error: "Failed to get check" });
    }
  });

  // CHECK HTML PAGE - QR code scanner qilganda bu sahifa ochiladi
  app.get("/check/:receiptNumber", async (req, res) => {
    try {
      const { receiptNumber } = req.params;
      const conn = await connectMongo();
      if (!conn || !conn.db) {
        return res.status(500).send("<h1>Database not available</h1>");
      }

      // MongoDB dan check ma'lumotlarini qidirish
      const db = conn.db;
      
      // Try to convert to ObjectId if it looks like one
      let filter: any = {
        $or: [
          { recipientNumber: receiptNumber },
          { offlineId: receiptNumber }
        ]
      };
      
      // Try ObjectId if it's a valid MongoDB ID
      try {
        const objectId = new ObjectId(receiptNumber);
        filter.$or.push({ _id: objectId });
      } catch (e) {
        // Not a valid ObjectId, skip
      }

      const sale = await db.collection("sales").findOne(filter);

      if (!sale) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Check Not Found</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; }
              h1 { color: #e74c3c; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Check Not Found</h1>
              <p>Receipt Number: <strong>${receiptNumber}</strong></p>
              <p>This check does not exist in the system.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Check HTML ni yaratish
      const items = (sale.items || []).map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.name}${item.sku ? ` [${item.sku}]` : ''}</td>
          <td>${item.quantity}</td>
          <td>${item.price.toLocaleString()}</td>
          <td>${(item.quantity * item.price).toLocaleString()}</td>
        </tr>
      `).join('');

      const date = new Date(sale.createdAt || sale.offlineCreatedAt);
      const checkType = sale.saleType === 'refund' ? 'QAYTARISH' : 'SOTUV CHEKI';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Check - ${receiptNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.3);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              font-size: 28px;
              margin-bottom: 10px;
            }
            .header p {
              font-size: 14px;
              opacity: 0.9;
            }
            .content {
              padding: 30px;
            }
            .check-info {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              border-left: 4px solid #667eea;
            }
            .check-info p {
              margin: 8px 0;
              font-size: 14px;
            }
            .check-info strong {
              color: #667eea;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .items-table th {
              background: #667eea;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #eee;
            }
            .items-table tr:hover {
              background: #f8f9fa;
            }
            .total-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              text-align: right;
              margin: 20px 0;
              border-top: 2px solid #667eea;
              border-bottom: 2px solid #667eea;
            }
            .total-section p {
              font-size: 16px;
              margin: 10px 0;
            }
            .total-amount {
              font-size: 24px;
              font-weight: bold;
              color: #667eea;
              margin-top: 10px;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
            }
            .store-info {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 20px;
              border-bottom: 1px dashed #ddd;
            }
            .store-info h2 {
              font-size: 18px;
              color: #333;
              margin-bottom: 5px;
            }
            .store-info p {
              font-size: 12px;
              color: #666;
              margin: 3px 0;
            }
            .print-button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              border-radius: 6px;
              text-decoration: none;
              margin-top: 20px;
              cursor: pointer;
              border: none;
              font-size: 14px;
              font-weight: bold;
              transition: background 0.3s;
            }
            .print-button:hover {
              background: #764ba2;
            }
            @media print {
              body { background: white; }
              .container { box-shadow: none; border-radius: 0; }
              .print-button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AVTOFIX</h1>
              <p>Avto ehtiyot qismlari do'koni</p>
            </div>
            
            <div class="content">
              <div class="store-info">
                <h2>${sale.storeName || 'AVTOFIX'}</h2>
                ${sale.storeAddress ? `<p>${sale.storeAddress}</p>` : ''}
                ${sale.storePhone ? `<p>Tel: ${sale.storePhone}</p>` : ''}
              </div>

              <div class="check-info">
                <p><strong>Check Type:</strong> ${checkType}</p>
                <p><strong>Receipt Number:</strong> ${receiptNumber}</p>
                <p><strong>Date:</strong> ${date.toLocaleString('ru-RU')}</p>
                ${sale.cashier ? `<p><strong>Cashier:</strong> ${sale.cashier}</p>` : ''}
              </div>

              <table class="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${items}
                </tbody>
              </table>

              <div class="total-section">
                <p>Payment Type: <strong>${sale.paymentType || 'Naqd'}</strong></p>
                <div class="total-amount">Total: ${sale.total.toLocaleString()} so'm</div>
              </div>

              <div style="text-align: center;">
                <button class="print-button" onclick="window.print()">🖨️ Print Check</button>
              </div>
            </div>

            <div class="footer">
              <p>Xaridingiz uchun rahmat!</p>
              <p>AVTOFIX - Ishonchli hamkor</p>
              <p>Sifatli ehtiyot qismlar • Tez va qulay xizmat</p>
            </div>
          </div>
        </body>
        </html>
      `;

      res.send(html);
    } catch (error) {
      console.error("[check] Error:", error);
      res.status(500).send("<h1>Error loading check</h1>");
    }
  });

  // EXCEL IMPORT ENDPOINTS
  app.post("/api/excel-import", handleExcelImport);
  app.post("/api/excel-import/preview", handleExcelPreview);
  app.post("/api/excel-import/fix", handleExcelImportFix);

  // DEBUG ENDPOINT - bazadagi barcha mahsulotlarni ko'rish (filtersiz)
  app.get("/api/debug/products", async (req, res) => {
    try {
      const conn = await connectMongo();
      if (!conn || !conn.db) {
        return res.status(500).json({ error: "Database not available" });
      }
      const db = conn.db;
      const collection = db.collection(process.env.OFFLINE_PRODUCTS_COLLECTION || "products");
      
      // Query parametrlarini olish
      const targetUserId = req.query.userId as string | undefined;
      
      // Barcha mahsulotlarni olish (filtersiz)
      const allProducts = await collection.find({}).toArray();
      
      // Excel import qilingan mahsulotlar
      const excelProducts = allProducts.filter((p: any) => p.source === 'excel-import');
      
      // Statistika
      const stats = {
        total: allProducts.length,
        withUserId: allProducts.filter((p: any) => p.userId).length,
        withoutUserId: allProducts.filter((p: any) => !p.userId).length,
        hidden: allProducts.filter((p: any) => p.isHidden === true).length,
        notHidden: allProducts.filter((p: any) => p.isHidden === false || p.isHidden === undefined).length,
        excelImported: excelProducts.length,
        excelWithUserId: excelProducts.filter((p: any) => p.userId).length,
        excelWithoutUserId: excelProducts.filter((p: any) => !p.userId).length,
        excelHidden: excelProducts.filter((p: any) => p.isHidden === true).length,
        userIds: [...new Set(allProducts.map((p: any) => p.userId).filter(Boolean))],
        targetUserIdMatch: targetUserId ? allProducts.filter((p: any) => p.userId === targetUserId).length : 0,
        excelTargetUserIdMatch: targetUserId ? excelProducts.filter((p: any) => p.userId === targetUserId).length : 0,
      };
      
      // Excel import qilingan mahsulotlarni ko'rsatish
      const excelSamples = excelProducts.slice(0, 10).map((p: any) => ({
        _id: p._id?.toString(),
        name: p.name,
        userId: p.userId,
        isHidden: p.isHidden,
        source: p.source,
      }));
      
      // Qo'lda qo'shilgan mahsulotlar
      const manualProducts = allProducts.filter((p: any) => p.source !== 'excel-import');
      const manualSamples = manualProducts.slice(0, 5).map((p: any) => ({
        _id: p._id?.toString(),
        name: p.name,
        userId: p.userId,
        isHidden: p.isHidden,
        source: p.source,
      }));
      
      console.log('[DEBUG] Products stats:', stats);
      console.log('[DEBUG] Target userId:', targetUserId);
      console.log('[DEBUG] Excel samples:', excelSamples);
      
      return res.json({
        success: true,
        stats,
        targetUserId,
        excelSamples,
        manualSamples,
      });
    } catch (error: any) {
      console.error('[DEBUG] Error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

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
