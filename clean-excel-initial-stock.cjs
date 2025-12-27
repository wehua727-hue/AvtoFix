/**
 * Clean Excel Initial Stock
 * Excel orqali import qilingan mahsulotlardagi initialStock muammosini hal qilish
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

async function cleanExcelInitialStock() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    console.log('🔍 Finding products with initialStock issues...');
    
    // 1. Barcha mahsulotlardan initialStock ni o'chirish
    console.log('\n📦 Step 1: Removing initialStock from all products...');
    
    const mainProductResult = await collection.updateMany(
      { initialStock: { $exists: true } },
      { $unset: { initialStock: "" } }
    );
    
    console.log(`✅ Removed initialStock from ${mainProductResult.modifiedCount} main products`);
    
    // 2. Barcha variantlardan initialStock ni o'chirish
    console.log('\n🔧 Step 2: Removing initialStock from all variants...');
    
    const products = await collection.find({
      'variantSummaries.initialStock': { $exists: true }
    }).toArray();
    
    let variantFixedCount = 0;
    
    for (const product of products) {
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        const updatedVariants = product.variantSummaries.map(variant => {
          const { initialStock, ...cleanVariant } = variant;
          if (initialStock !== undefined) {
            variantFixedCount++;
          }
          return cleanVariant;
        });
        
        await collection.updateOne(
          { _id: product._id },
          { $set: { variantSummaries: updatedVariants } }
        );
        
        console.log(`✅ Fixed variants in: ${product.name}`);
      }
    }
    
    console.log(`✅ Removed initialStock from ${variantFixedCount} variants`);
    
    // 3. Verification - tekshirish
    console.log('\n🔍 Step 3: Verification...');
    
    const remainingMainProducts = await collection.countDocuments({
      initialStock: { $exists: true }
    });
    
    const remainingVariants = await collection.countDocuments({
      'variantSummaries.initialStock': { $exists: true }
    });
    
    console.log(`\n📊 Results:`);
    console.log(`   Main products with initialStock: ${remainingMainProducts}`);
    console.log(`   Products with variant initialStock: ${remainingVariants}`);
    
    if (remainingMainProducts === 0 && remainingVariants === 0) {
      console.log('\n🎉 SUCCESS: All initialStock fields have been removed!');
      console.log('   The stock reversion issue should now be fixed.');
    } else {
      console.log('\n⚠️  Some initialStock fields still remain. Manual cleanup may be needed.');
    }
    
    // 4. Test with the problematic product
    console.log('\n🧪 Step 4: Testing with SKU "13" product...');
    
    const testProduct = await collection.findOne({ sku: "13" });
    if (testProduct) {
      console.log(`   Product: ${testProduct.name}`);
      console.log(`   Stock: ${testProduct.stock}`);
      console.log(`   InitialStock: ${testProduct.initialStock || 'REMOVED ✅'}`);
      
      if (testProduct.variantSummaries && testProduct.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        testProduct.variantSummaries.forEach((v, i) => {
          console.log(`     [${i}] ${v.name} - Stock: ${v.stock}, InitialStock: ${v.initialStock || 'REMOVED ✅'}`);
        });
      }
    } else {
      console.log('   Test product not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

cleanExcelInitialStock();