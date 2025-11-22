import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { handleProductsGet, handleProductsCreate, handleProductGetById, handleProductUpdate, handleProductDelete, handleProductImageGet, handleProductVideoGet } from "./routes/products";
import { handleCategoriesGet, handleCategoriesCreate, handleCategoryUpdate, handleCategoryDelete } from "./routes/categories";
import { handleStoresGet, handleStoresCreate } from "./routes/stores";
import { handleProductsSync, handleGetAllProducts } from "./routes/sync";
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
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Static uploads (product images)
  app.use("/uploads", express.static(uploadsBase));

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
  app.delete("/api/products/:id", handleProductDelete);

  // CATEGORIES ENDPOINTS
  app.get("/api/categories", handleCategoriesGet);
  app.post("/api/categories", handleCategoriesCreate);
  app.put("/api/categories/:id", handleCategoryUpdate);
  app.delete("/api/categories/:id", handleCategoryDelete);

  // STORES ENDPOINTS
  app.get("/api/stores", handleStoresGet);
  app.post("/api/stores", handleStoresCreate);

  return app;
}
