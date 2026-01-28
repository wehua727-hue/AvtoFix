import { connectMongo } from "../mongo";

const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || "products";

/**
 * catalogNumber ni code ga ko'chirish
 * Eski import da catalogNumber ga kod qo'yilgan edi
 */
async function fixCodeCatalogNumber() {
  try {
    console.log('[Fix Code/Catalog] Starting...');
    
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      throw new Error("Database not available");
    }

    const db = conn.db;
    const collection = db.collection(PRODUCTS_COLLECTION);

    // Barcha mahsulotlarni olish
    const products = await collection.find({}).toArray();

    console.log(`[Fix Code/Catalog] Found ${products.length} products`);

    let updatedCount = 0;

    for (const product of products) {
      const updateData: any = {};
      let needsUpdate = false;

      // Agar code yo'q va catalogNumber bor bo'lsa
      if (!product.code && product.catalogNumber) {
        updateData.code = product.catalogNumber; // catalogNumber ni code ga ko'chirish
        updateData.catalogNumber = undefined; // catalogNumber ni bo'shatish
        needsUpdate = true;
        console.log(`[Fix Code/Catalog] Product: ${product.name} - Moving catalogNumber to code: ${product.catalogNumber}`);
      }

      // Xillar uchun ham
      if (product.variantSummaries && Array.isArray(product.variantSummaries) && product.variantSummaries.length > 0) {
        const updatedVariants = product.variantSummaries.map((v: any) => {
          if (!v.code && v.catalogNumber) {
            console.log(`[Fix Code/Catalog]   Variant: ${v.name} - Moving catalogNumber to code: ${v.catalogNumber}`);
            return {
              ...v,
              code: v.catalogNumber, // catalogNumber ni code ga ko'chirish
              catalogNumber: undefined // catalogNumber ni bo'shatish
            };
          }
          return v;
        });

        if (JSON.stringify(updatedVariants) !== JSON.stringify(product.variantSummaries)) {
          updateData.variantSummaries = updatedVariants;
          needsUpdate = true;
        }
      }

      // Yangilash
      if (needsUpdate) {
        await collection.updateOne(
          { _id: product._id },
          { $set: updateData }
        );
        updatedCount++;
      }
    }

    console.log(`[Fix Code/Catalog] ✅ Successfully updated ${updatedCount} products`);
    
    process.exit(0);
  } catch (error) {
    console.error('[Fix Code/Catalog] ❌ Error:', error);
    process.exit(1);
  }
}

// Script ni ishga tushirish
fixCodeCatalogNumber();
