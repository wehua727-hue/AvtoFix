/**
 * Check Specific Product
 * Muayyan mahsulotni tekshirish
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load config
let config = {};
const configPath = path.join(__dirname, 'electron', 'config.json');

try {
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
    console.log('✅ Config loaded from electron/config.json');
  } else {
    console.log('⚠️  electron/config.json not found');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ Error loading config:', e.message);
  process.exit(1);
}

const MONGODB_URI = config.MONGODB_URI;
const DB_NAME = config.DB_NAME || 'oflayn-dokon';

async function checkSpecificProduct() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // SKU "1" li mahsulotni topish (logdan ko'ringan)
    console.log('🔍 Looking for product with SKU "1"...');
    
    const product = await collection.findOne({ sku: "1" });
    
    if (!product) {
      console.log('❌ Product with SKU "1" not found');
      return;
    }
    
    console.log('📦 Found product:');
    console.log(`   ID: ${product._id}`);
    console.log(`   Name: ${product.name}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   Stock: ${product.stock}`);
    console.log(`   InitialStock: ${product.initialStock}`);
    console.log(`   Source: ${product.source || 'N/A'}`);
    console.log(`   Created: ${product.createdAt}`);
    console.log(`   Updated: ${product.updatedAt}`);
    
    // Agar initialStock mavjud bo'lsa, uni o'chirish
    if (product.initialStock !== undefined && product.initialStock !== null) {
      console.log('\n🔧 Removing initialStock from this product...');
      
      await collection.updateOne(
        { _id: product._id },
        { 
          $unset: { initialStock: "" },
          $set: { updatedAt: new Date() }
        }
      );
      
      console.log('✅ InitialStock removed');
      
      // Verification
      const updatedProduct = await collection.findOne({ _id: product._id });
      console.log('\n🔍 Verification:');
      console.log(`   InitialStock: ${updatedProduct.initialStock || 'REMOVED ✅'}`);
    } else {
      console.log('\n✅ Product already has no initialStock');
    }
    
    // Barcha mahsulotlarda initialStock borligini tekshirish
    console.log('\n🔍 Checking all products for remaining initialStock...');
    
    const productsWithInitialStock = await collection.find({
      initialStock: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`Found ${productsWithInitialStock.length} products with initialStock:`);
    
    if (productsWithInitialStock.length > 0) {
      console.log('\n🔧 Removing initialStock from all remaining products...');
      
      const result = await collection.updateMany(
        { initialStock: { $exists: true } },
        { 
          $unset: { initialStock: "" },
          $set: { updatedAt: new Date() }
        }
      );
      
      console.log(`✅ Removed initialStock from ${result.modifiedCount} products`);
    }
    
    // Variantlarda ham tekshirish
    console.log('\n🔍 Checking variants for initialStock...');
    
    const productsWithVariantInitialStock = await collection.find({
      'variantSummaries.initialStock': { $exists: true }
    }).toArray();
    
    console.log(`Found ${productsWithVariantInitialStock.length} products with variant initialStock`);
    
    if (productsWithVariantInitialStock.length > 0) {
      console.log('\n🔧 Removing initialStock from all variants...');
      
      for (const prod of productsWithVariantInitialStock) {
        if (prod.variantSummaries && Array.isArray(prod.variantSummaries)) {
          const cleanedVariants = prod.variantSummaries.map(variant => {
            const { initialStock, ...cleanVariant } = variant;
            return cleanVariant;
          });
          
          await collection.updateOne(
            { _id: prod._id },
            { 
              $set: { 
                variantSummaries: cleanedVariants,
                updatedAt: new Date()
              }
            }
          );
        }
      }
      
      console.log(`✅ Cleaned variants in ${productsWithVariantInitialStock.length} products`);
    }
    
    // Final check
    console.log('\n🔍 Final verification...');
    
    const finalMainCount = await collection.countDocuments({
      initialStock: { $exists: true }
    });
    
    const finalVariantCount = await collection.countDocuments({
      'variantSummaries.initialStock': { $exists: true }
    });
    
    console.log(`\n📊 Final results:`);
    console.log(`   Products with initialStock: ${finalMainCount}`);
    console.log(`   Products with variant initialStock: ${finalVariantCount}`);
    
    if (finalMainCount === 0 && finalVariantCount === 0) {
      console.log('\n🎉 SUCCESS: All initialStock fields completely removed!');
    } else {
      console.log('\n⚠️  Some initialStock fields still remain');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkSpecificProduct();