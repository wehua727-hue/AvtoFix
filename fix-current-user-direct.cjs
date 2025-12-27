/**
 * Fix current user products directly by ObjectId
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

async function fixCurrentUserDirect() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    const userId = '694a8cf599adb50cf1248e50';
    
    console.log('🔍 Finding ALL products for current user:', userId);
    
    // Find ALL products for this user
    const allUserProducts = await collection.find({ userId: userId }).toArray();
    console.log(`📦 Found ${allUserProducts.length} total products for this user`);
    
    // Check how many have initialStock
    const withInitialStock = allUserProducts.filter(p => p.hasOwnProperty('initialStock') && p.initialStock !== undefined && p.initialStock !== null);
    const withoutInitialStock = allUserProducts.filter(p => !p.hasOwnProperty('initialStock') || p.initialStock === undefined || p.initialStock === null);
    
    console.log(`✅ Products with initialStock: ${withInitialStock.length}`);
    console.log(`❌ Products without initialStock: ${withoutInitialStock.length}`);
    
    if (withoutInitialStock.length === 0) {
      console.log('🎉 All products already have initialStock!');
      return;
    }
    
    console.log('\n🔧 Fixing products without initialStock...');
    
    let fixedCount = 0;
    
    for (const product of withoutInitialStock) {
      const currentStock = product.stock ?? 0;
      const initialStock = Math.max(currentStock, 1); // At least 1 for refund validation
      
      try {
        const result = await collection.updateOne(
          { _id: product._id },
          { 
            $set: { 
              initialStock: initialStock,
              updatedAt: new Date()
            } 
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`✅ Fixed: SKU "${product.sku}" | Name: ${product.name} | Stock: ${currentStock} → InitialStock: ${initialStock}`);
          fixedCount++;
        } else {
          console.log(`⚠️  Failed to update: SKU "${product.sku}"`);
        }
      } catch (error) {
        console.error(`❌ Error fixing SKU "${product.sku}":`, error.message);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Fixed: ${fixedCount} products`);
    console.log(`❌ Failed: ${withoutInitialStock.length - fixedCount} products`);
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    const stillMissing = await collection.countDocuments({
      userId: userId,
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: undefined }
      ]
    });
    
    console.log(`📦 Products still missing initialStock: ${stillMissing}`);
    
    // Check the specific SKU "1" product
    const sku1Product = await collection.findOne({ userId: userId, sku: "1" });
    if (sku1Product) {
      console.log('\n🎯 SKU "1" after fix:');
      console.log('Name:', sku1Product.name);
      console.log('Stock:', sku1Product.stock);
      console.log('InitialStock:', sku1Product.initialStock);
      console.log('Has initialStock property:', sku1Product.hasOwnProperty('initialStock'));
    }
    
    if (stillMissing === 0) {
      console.log('\n🎉 All products now have initialStock values!');
      console.log('🔄 Server restart may be needed to clear any cache.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixCurrentUserDirect().catch(console.error);