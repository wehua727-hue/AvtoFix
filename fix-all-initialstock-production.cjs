/**
 * Production database da barcha mahsulotlar uchun initialStock ni tuzatish
 * Bu script deploy qilingan saytda ishlatish uchun
 */

const { MongoClient } = require('mongodb');

// Production MongoDB connection string
// Bu yerga production database connection string ni qo'ying
const MONGO_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'avtofix';

async function fixAllInitialStock() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    console.log('🔧 Production database da initialStock ni tuzatish...');
    console.log('📡 Connecting to:', MONGO_URL);
    
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    // Barcha mahsulotlarni olish
    const products = await collection.find({}).toArray();
    console.log(`📦 Jami ${products.length} ta mahsulot topildi`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const product of products) {
      let needsUpdate = false;
      const updateData = {};
      
      // Asosiy mahsulot uchun initialStock tekshirish
      if (product.initialStock === undefined || product.initialStock === null) {
        const currentStock = product.stock || 0;
        updateData.initialStock = currentStock;
        needsUpdate = true;
        console.log(`✅ Main product SKU "${product.sku}": initialStock = ${currentStock}`);
      }
      
      // Variantlar uchun initialStock tekshirish
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        const updatedVariants = product.variantSummaries.map((variant, index) => {
          if (variant.initialStock === undefined || variant.initialStock === null) {
            const variantStock = variant.stock || 0;
            console.log(`✅ Variant[${index}] SKU "${variant.sku}": initialStock = ${variantStock}`);
            return {
              ...variant,
              initialStock: variantStock
            };
          }
          return variant;
        });
        
        // Agar biror variant yangilangan bo'lsa
        const hasVariantChanges = updatedVariants.some((v, i) => 
          v.initialStock !== product.variantSummaries[i].initialStock
        );
        
        if (hasVariantChanges) {
          updateData.variantSummaries = updatedVariants;
          needsUpdate = true;
        }
      }
      
      // Database ni yangilash
      if (needsUpdate) {
        updateData.updatedAt = new Date();
        
        await collection.updateOne(
          { _id: product._id },
          { $set: updateData }
        );
        
        fixedCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log(`🎉 Tugadi!`);
    console.log(`✅ Tuzatildi: ${fixedCount} ta mahsulot`);
    console.log(`⏭️ O'tkazib yuborildi: ${skippedCount} ta mahsulot (allaqachon to'g'ri)`);
    
    // Tekshirish
    const stillBroken = await collection.countDocuments({
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { 'variantSummaries.initialStock': { $exists: false } },
        { 'variantSummaries.initialStock': null }
      ]
    });
    
    if (stillBroken > 0) {
      console.log(`⚠️ Hali ham ${stillBroken} ta mahsulotda muammo bor`);
    } else {
      console.log(`🎉 Barcha mahsulotlar to'g'rilandi!`);
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

// Script ni ishga tushirish
if (require.main === module) {
  fixAllInitialStock().catch(console.error);
}

module.exports = { fixAllInitialStock };