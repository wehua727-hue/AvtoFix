import "dotenv/config";
import { connectMongo } from "../mongo";

const CATEGORIES_COLLECTION = process.env.OFFLINE_CATEGORIES_COLLECTION || "categories";

/**
 * Миграция: добавление userId к существующим категориям
 * 
 * Этот скрипт добавляет поле userId к категориям, у которых его нет.
 * По умолчанию устанавливает userId в null, чтобы админ мог видеть старые категории.
 */
async function migrateCategories() {
  console.log("[migrate-categories] Starting migration...");
  
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.error("[migrate-categories] MongoDB connection failed");
      process.exit(1);
    }

    const db = conn.db;
    const collection = db.collection(CATEGORIES_COLLECTION);

    // Находим все категории без userId
    const categoriesWithoutUserId = await collection.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: "" }
      ]
    }).toArray();

    console.log(`[migrate-categories] Found ${categoriesWithoutUserId.length} categories without userId`);

    if (categoriesWithoutUserId.length === 0) {
      console.log("[migrate-categories] No categories to migrate");
      process.exit(0);
    }

    // Обновляем категории - устанавливаем userId в null
    // Это позволит админу (910712828) видеть эти категории
    const result = await collection.updateMany(
      {
        $or: [
          { userId: { $exists: false } },
          { userId: "" }
        ]
      },
      {
        $set: { userId: null }
      }
    );

    console.log(`[migrate-categories] Updated ${result.modifiedCount} categories`);
    console.log("[migrate-categories] Migration completed successfully");
    
    process.exit(0);
  } catch (error) {
    console.error("[migrate-categories] Migration failed:", error);
    process.exit(1);
  }
}

migrateCategories();
