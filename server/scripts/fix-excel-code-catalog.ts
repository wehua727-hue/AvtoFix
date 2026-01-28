/**
 * Excel import qilingan mahsulotlarda code va catalogNumber ni tuzatish
 * 
 * Muammo: catalogNumber ga kod qo'yilgan, code maydoni bo'sh
 * Yechim: catalogNumber ni code ga ko'chirish, catalogNumber ni null qilish
 */

import { connectMongo } from '../mongo';

const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || "products";

async function fixExcelCodeCatalog() {
  try {
    console.log('[Fix Excel Code/Catalog] Starting...');
    
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      throw new Error("Database not available");
    }

    const db = conn.db;
    const collection = db.collection(PRODUCTS_COLLECTION);

    // 1. Excel import qilingan mahsulotlarni topish
    // code bo'sh, catalogNumber to'ldirilgan
    const productsToFix = await collection.find({
      source: 'excel-import',
      $or: [
        { code: { $exists: false } },
        { code: null },
        { code: '' }
      ],
      catalogNumber: { $exists: true, $ne: null, $ne: '' }
    }).toArray();

    console.log('[Fix Excel Code/Catalog] Found products to fix:', productsToFix.length);

    if (productsToFix.length === 0) {
      console.log('[Fix Excel Code/Catalog] No products to fix');
      return;
    }

    // 2. Har bir mahsulotni tuzatish
    let fixedCount = 0;
    let variantFixedCount = 0;

    for (const product of productsToFix) {
      const updates: any = {};
      
      // catalogNumber ni code ga ko'chirish
      if (product.catalogNumber) {
        updates.code = product.catalogNumber;
        updates.catalogNumber = null; // catalogNumber ni tozalash
        fixedCount++;
      }

      // Variantlarni ham tuzatish
      if (Array.isArray(product.variantSummaries) && product.variantSummaries.length > 0) {
        const fixedVariants = product.variantSummaries.map((variant: any) => {
          if (variant.catalogNumber && (!variant.code || variant.code === '')) {
            variantFixedCount++;
            return {
              ...variant,
              code: variant.catalogNumber,
              catalogNumber: null
            };
          }
          return variant;
        });
        updates.variantSummaries = fixedVariants;
      }

      // Update qilish
      if (Object.keys(updates).length > 0) {
        await collection.updateOne(
          { _id: product._id },
          { $set: updates }
        );
      }
    }

    console.log('[Fix Excel Code/Catalog] Fixed products:', fixedCount);
    console.log('[Fix Excel Code/Catalog] Fixed variants:', variantFixedCount);
    console.log('[Fix Excel Code/Catalog] Done!');

    process.exit(0);
  } catch (error) {
    console.error('[Fix Excel Code/Catalog] Error:', error);
    process.exit(1);
  }
}

fixExcelCodeCatalog();
