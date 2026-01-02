/**
 * Excel orqali qo'shilgan mahsulotlardan initialStock ni olib tashlash
 * Bu script faqat bir marta ishga tushiriladi
 */

import { connectMongo } from '../mongo';

async function fixExcelInitialStock() {
  try {
    console.log('[Fix Excel InitialStock] Starting...');
    
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      throw new Error('Database connection failed');
    }
    
    const db = conn.db;
    const collection = db.collection(process.env.OFFLINE_PRODUCTS_COLLECTION || 'products');
    
    // 1. Excel orqali qo'shilgan mahsulotlardan initialStock ni olib tashlash
    console.log('[Fix Excel InitialStock] Removing initialStock from Excel imported products...');
    
    const result1 = await collection.updateMany(
      { source: 'excel-import' },
      { $unset: { initialStock: "" } }
    );
    
    console.log(`[Fix Excel InitialStock] Removed initialStock from ${result1.modifiedCount} main products`);
    
    // 2. Excel orqali qo'shilgan mahsulotlarning variantlaridan ham initialStock ni olib tashlash
    console.log('[Fix Excel InitialStock] Removing initialStock from variants...');
    
    const productsWithVariants = await collection.find({
      source: 'excel-import',
      variantSummaries: { $exists: true, $ne: [] }
    }).toArray();
    
    let variantUpdates = 0;
    
    for (const product of productsWithVariants) {
      if (Array.isArray(product.variantSummaries)) {
        const updatedVariants = product.variantSummaries.map((variant: any) => {
          const { initialStock, ...variantWithoutInitialStock } = variant;
          return variantWithoutInitialStock;
        });
        
        await collection.updateOne(
          { _id: product._id },
          { $set: { variantSummaries: updatedVariants } }
        );
        
        variantUpdates++;
      }
    }
    
    console.log(`[Fix Excel InitialStock] Updated variants in ${variantUpdates} products`);
    
    // 3. Statistika
    const totalExcelProducts = await collection.countDocuments({ source: 'excel-import' });
    const productsWithInitialStock = await collection.countDocuments({ 
      source: 'excel-import', 
      initialStock: { $exists: true } 
    });
    
    console.log(`[Fix Excel InitialStock] ✅ Migration completed!`);
    console.log(`[Fix Excel InitialStock] Total Excel products: ${totalExcelProducts}`);
    console.log(`[Fix Excel InitialStock] Products still with initialStock: ${productsWithInitialStock}`);
    
    if (productsWithInitialStock === 0) {
      console.log(`[Fix Excel InitialStock] 🎉 All Excel products fixed successfully!`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('[Fix Excel InitialStock] Error:', error);
    process.exit(1);
  }
}

// Script ni ishga tushirish
if (require.main === module) {
  fixExcelInitialStock();
}

export { fixExcelInitialStock };