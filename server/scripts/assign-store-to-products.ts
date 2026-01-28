/**
 * Скрипт для привязки всех товаров к магазину AvtoFix
 * 
 * Запуск: npx ts-node server/scripts/assign-store-to-products.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const STORE_ID = "691aed70dac62e0c47226161";
// Коллекция products (не offline_products!)
const PRODUCTS_COLLECTION = "products";

async function main() {
  let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || "avtofix";
  
  if (!mongoUri) {
    console.error("❌ MONGODB_URI yoki MONGO_URI topilmadi!");
    process.exit(1);
  }

  // URI oxiriga database nomini qo'shish (agar yo'q bo'lsa)
  if (mongoUri.endsWith("/")) {
    mongoUri = mongoUri + dbName;
  } else if (!mongoUri.includes("mongodb.net/" + dbName)) {
    mongoUri = mongoUri + "/" + dbName;
  }

  console.log("🔗 MongoDB ga ulanmoqda...");
  console.log("   URI:", mongoUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")); // Parolni yashirish
  console.log("   Database:", dbName);
  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB ga ulandi!");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ Database topilmadi!");
    process.exit(1);
  }

  // Mavjud kolleksiyalarni ko'rsatish
  const collections = await db.listCollections().toArray();
  console.log("\n📁 Mavjud kolleksiyalar:", collections.map(c => c.name).join(", "));

  const collection = db.collection(PRODUCTS_COLLECTION);
  console.log(`\n📦 "${PRODUCTS_COLLECTION}" kolleksiyasi bilan ishlamoqda...`);

  // Hozirgi holatni ko'rish
  const totalProducts = await collection.countDocuments();
  console.log(`\n📊 Jami mahsulotlar: ${totalProducts}`);

  if (totalProducts === 0) {
    console.log("⚠️ Mahsulotlar topilmadi! Kolleksiya nomini tekshiring.");
    await mongoose.disconnect();
    return;
  }

  // "store" maydoni bo'yicha tekshirish (bazada "store" ishlatilgan, "storeId" emas)
  const productsWithStore = await collection.countDocuments({ 
    store: { $exists: true, $ne: null } 
  });
  const productsWithoutStore = await collection.countDocuments({ 
    $or: [
      { store: { $exists: false } },
      { store: null }
    ]
  });

  console.log(`   "store" maydoni bor: ${productsWithStore}`);
  console.log(`   "store" maydoni yo'q: ${productsWithoutStore}`);

  // ObjectId yaratish
  const storeObjectId = new mongoose.Types.ObjectId(STORE_ID);

  if (productsWithoutStore === 0) {
    console.log("\n✅ Barcha mahsulotlarda store mavjud!");
    
    // Lekin boshqa store ga tegishli bo'lishi mumkin, hammasi AvtoFix ga o'zgartirilsinmi?
    const notAvtoFix = await collection.countDocuments({ 
      store: { $exists: true, $ne: storeObjectId } 
    });
    
    if (notAvtoFix > 0) {
      console.log(`\n⚠️ ${notAvtoFix} ta mahsulot boshqa store ga tegishli.`);
      console.log(`🔄 Barcha mahsulotlarni AvtoFix ga o'zgartirmoqchi bo'lsangiz, skriptni o'zgartiring.`);
    }
    
    await mongoose.disconnect();
    return;
  }

  console.log(`\n🔄 ${productsWithoutStore} ta mahsulotga store="${STORE_ID}" qo'shilmoqda...`);

  // store yo'q bo'lgan barcha mahsulotlarga store qo'shish (ObjectId sifatida)
  const result = await collection.updateMany(
    { 
      $or: [
        { store: { $exists: false } },
        { store: null }
      ]
    },
    { 
      $set: { 
        store: storeObjectId,
        updatedAt: new Date()
      } 
    }
  );

  console.log(`✅ ${result.modifiedCount} ta mahsulot yangilandi!`);

  // Natijani tekshirish
  const finalCount = await collection.countDocuments({ store: storeObjectId });
  console.log(`\n📊 Yangi holat:`);
  console.log(`   store="${STORE_ID}" bo'lgan mahsulotlar: ${finalCount}`);

  await mongoose.disconnect();
  console.log("\n✅ Tayyor!");
}

main().catch((err) => {
  console.error("❌ Xatolik:", err);
  process.exit(1);
});
