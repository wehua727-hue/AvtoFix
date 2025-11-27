import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductImageGet, handleProductVideoGet, handleProductImageUpload, productImageUploadMiddleware, handleProductVariantImageUpload, handleProductImageDelete, handleVariantImageDelete, processProductImageUpload, respondProcessedImage } from "./routes/products";
import { addProductUpload } from "./upload";
import sharp from "sharp";
import multer from "multer";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories";
import { handleStoresGet, handleStoresCreate } from "./routes/stores";
import { handleProductsSync, handleGetAllProducts } from "./routes/sync";
import { handleCurrencyUsd, handleCurrencyRub, handleCurrencyCny, handleCurrencyRates } from "./routes/currency";
import { connectMongo } from "./mongo";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root - in production (dist/server) go up 2 levels, in dev go up 1 level
const isProduction = __dirname.includes("dist");
const projectRoot = isProduction ? path.join(__dirname, "..", "..") : path.join(__dirname, "..");
// Base directory for uploads (can be overridden by env)
const uploadsBase = path.resolve(process.env.UPLOADS_DIR || path.join(projectRoot, "uploads"));

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  // Remove strict payload limits for image uploads
  // Multer handles file uploads separately, so we can be more permissive here
  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ extended: true, limit: "200mb" }));

  // Static uploads (product images)
  try {
    if (!fs.existsSync(uploadsBase)) {
      fs.mkdirSync(uploadsBase, { recursive: true });
    }
    const productsDir = path.join(uploadsBase, "products");
    if (!fs.existsSync(productsDir)) {
      fs.mkdirSync(productsDir, { recursive: true });
    }
  } catch (e) {
    console.error("[server] Failed to ensure uploads directories:", e);
  }
  app.use("/uploads", express.static(uploadsBase));
  app.use("/api/uploads", express.static(uploadsBase));

  sharp.cache(false);
  sharp.concurrency(2);

  // Init MongoDB (non-blocking for routes that don't need DB)
  connectMongo().catch((err) => {
    console.error("[mongo] Failed to connect:", err);
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // SYNC ENDPOINTS
  app.post("/api/products/sync", handleProductsSync);
  app.get("/api/products/all", handleGetAllProducts);

  // PRODUCTS ENDPOINTS
  app.get("/api/products", handleProductsGet);
  app.post("/api/products", handleProductsCreate);
  app.get("/api/products/:id/image", handleProductImageGet);
  app.get("/api/products/:id/video", handleProductVideoGet);
  app.get("/api/products/:id", handleProductGetById);
  app.put("/api/products/:id", handleProductUpdate);
  app.put("/api/products/:id/image", productImageUploadMiddleware, handleProductImageUpload);
  app.put("/api/products/:id/variant/:index/image", productImageUploadMiddleware, handleProductVariantImageUpload);
  app.delete("/api/products/:id/images/:imageIndex", handleProductImageDelete);
  app.delete("/api/products/:id/variants/:variantIndex/images/:imageIndex", handleVariantImageDelete);
  app.delete("/api/products/:id", handleProductDelete);

  app.post("/api/products/upload-image", addProductUpload, processProductImageUpload, respondProcessedImage);

  // CATEGORIES ENDPOINTS
  app.get("/api/categories", handleCategoriesGet);
  app.post("/api/categories", handleCategoriesCreate);
  app.put("/api/categories/:id", handleCategoryUpdate);
  app.delete("/api/categories/:id", handleCategoryDelete);

  // STORES ENDPOINTS
  app.get("/api/stores", handleStoresGet);
  app.post("/api/stores", handleStoresCreate);

  // CURRENCY ENDPOINTS
  app.get("/api/currency/rates", handleCurrencyRates); // Barcha valyutalar
  app.get("/api/currency/usd", handleCurrencyUsd);     // USD -> UZS
  app.get("/api/currency/rub", handleCurrencyRub);     // RUB -> UZS
  app.get("/api/currency/cny", handleCurrencyCny);     // CNY -> UZS

  app.use((err: any, _req: any, res: any, _next: any) => {
    let status = 400;
    let message = "Request failed";

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        status = 413;
        message = "File too large. Maximum size is 200MB";
      } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
        message = "Unexpected file field";
      } else {
        message = "Upload error: " + err.message;
      }
    } else if (typeof err?.message === "string") {
      if (err.message.includes("No image uploaded") || err.message.includes("No image file")) {
        message = "No image file provided";
      } else if (err.message.toLowerCase().includes("unsupported")) {
        message = "Unsupported image format";
      } else if (err.message.includes("Only JPEG, PNG or WebP")) {
        message = "Only JPEG, PNG, WebP, or HEIC images are allowed";
      } else {
        message = err.message;
      }
    } else {
      status = 500;
      message = "Unexpected server error";
    }

    console.error("[Error Handler]", { status, message, error: err });
    res.status(status).json({ success: false, error: message });
  });

  return app;
}
