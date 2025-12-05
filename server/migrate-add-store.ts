import "dotenv/config";
import { connectMongo } from "./mongo";
import mongoose from "mongoose";

const ObjectId = mongoose.Types.ObjectId;

/**
 * Миграция: добавить поле store ко всем товарам без него
 * Запуск: npx tsx server/migrate-add-store.ts
 */

const DEFAULT_STORE_ID = "691aed70dac62e0c47226161";

async function migrate() {
  console.log("Starting migration: add store field to products...");
  
  const conn = await connectMongo();
  if (!conn) {
    console.error("Failed to connect to MongoDB");
    process.exit(1);
  }

  const db = conn.db;
  const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || "products";
  
  try {
    // Найти все товары без поля store
    const productsWithoutStore = await db
      .collection(PRODUCTS_COLLECTION)
      .find({ store: { $exists: false } })
      .toArray();

    console.log(`Found ${productsWithoutStore.length} products without store field`);

    if (productsWithoutStore.length === 0) {
      console.log("No products to migrate");
      process.exit(0);
    }

    // Добавить поле store ко всем товарам
    const storeObjectId = new ObjectId(DEFAULT_STORE_ID);
    
    const result = await db
      .collection(PRODUCTS_COLLECTION)
      .updateMany(
        { store: { $exists: false } },
        { $set: { store: storeObjectId } }
      );

    console.log(`Updated ${result.modifiedCount} products with store: ${DEFAULT_STORE_ID}`);
    
    // Также обновить в основной коллекции products
    try {
      const mainResult = await db
        .collection("products")
        .updateMany(
          { store: { $exists: false } },
          { $set: { store: storeObjectId } }
        );
      console.log(`Updated ${mainResult.modifiedCount} products in main collection`);
    } catch (err) {
      console.log("Main products collection update skipped (may not exist)");
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
