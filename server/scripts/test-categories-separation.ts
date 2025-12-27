import "dotenv/config";
import { connectMongo } from "../mongo";

const CATEGORIES_COLLECTION = process.env.OFFLINE_CATEGORIES_COLLECTION || "categories";

/**
 * Тестовый скрипт для проверки разделения категорий по пользователям
 */
async function testCategoriesSeparation() {
  console.log("[test-categories] Starting test...");
  
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.error("[test-categories] MongoDB connection failed");
      process.exit(1);
    }

    const db = conn.db;
    const collection = db.collection(CATEGORIES_COLLECTION);

    // Получаем все категории
    const allCategories = await collection.find({}).toArray();
    console.log(`\n[test-categories] Total categories: ${allCategories.length}`);

    // Группируем по userId
    const byUserId: Record<string, number> = {};
    let withoutUserId = 0;

    allCategories.forEach((cat: any) => {
      if (!cat.userId || cat.userId === null || cat.userId === "") {
        withoutUserId++;
      } else {
        byUserId[cat.userId] = (byUserId[cat.userId] || 0) + 1;
      }
    });

    console.log("\n[test-categories] Categories by userId:");
    console.log(`  - Without userId (old categories): ${withoutUserId}`);
    
    Object.entries(byUserId).forEach(([userId, count]) => {
      console.log(`  - User ${userId}: ${count} categories`);
    });

    // Проверяем структуру категорий
    console.log("\n[test-categories] Sample categories:");
    const samples = allCategories.slice(0, 5);
    samples.forEach((cat: any) => {
      console.log(`  - ${cat.name} | userId: ${cat.userId || 'NO_USER_ID'} | _id: ${cat._id}`);
    });

    console.log("\n[test-categories] Test completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("[test-categories] Test failed:", error);
    process.exit(1);
  }
}

testCategoriesSeparation();
