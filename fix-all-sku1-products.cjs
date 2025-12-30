/**
 * Fix ALL SKU "1" products for current user
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

async function fixAllSku1Products() {
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
    
    console.log('🔍 Finding ALL SKU "1" products for user:', userId);
    
    // Find ALL SKU "1" products for this user
    const sku1Products = await collection.find({ 
      userId: userId, 
      sku: "1" 
    }).toArray();
    
    console.log(`📦 Found ${sku1Products.length} SKU "1" products`);
    
    if (sku1Products.length === 0) {
      console.log('❌ No SKU "1" products found!');
      return;
    }
    
    // Show all SKU "1" products
    console.log('\n📋 All SKU "1" products:');
    sku1Products.forEach((product, i) => {
      console.log(`${i + 1}. ObjectId: ${product._id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock}`);
      console.log(`   Has initialStock: ${product.hasOwnProperty('initialStock')}`);
      console.log(`   CreatedAt: ${product.createdAt}`);
      console.log(`   UpdatedAt: ${product.updatedAt}`);
      console.log('');
    });
    
    // Fix all SKU "1" products
    console.log('🔧 Fixing all SKU "1" products...');
    
    let fixedCount = 0;
    
    for (const product of sku1Products) {
      const currentStock = product.stock ?? 0;
      const initialStock = Math.max(currentStock, 1); // At least 1
      
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
          console.log(`✅ Fixed ObjectId ${product._id}: Stock ${currentStock} → InitialStock ${initialStock}`);
          fixedCount++;
        } else {
          console.log(`⚠️  Failed to update ObjectId ${product._id}`);
        }
      } catch (error) {
        console.error(`❌ Error fixing ObjectId ${product._id}:`, error.message);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Fixed: ${fixedCount} products`);
    console.log(`❌ Failed: ${sku1Products.length - fixedCount} products`);
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    const stillMissing = await collection.countDocuments({
      userId: userId,
      sku: "1",
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: undefined }
      ]
    });
    
    console.log(`📦 SKU "1" products still missing initialStock: ${stillMissing}`);
    
    if (stillMissing === 0) {
      console.log('\n🎉 All SKU "1" products now have initialStock values!');
    }
    
    // Show updated products
    const updatedProducts = await collection.find({ 
      userId: userId, 
      sku: "1" 
    }).toArray();
    
    console.log('\n📋 Updated SKU "1" products:');
    updatedProducts.forEach((product, i) => {
      console.log(`${i + 1}. ObjectId: ${product._id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock}`);
      console.log(`   Has initialStock: ${product.hasOwnProperty('initialStock')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixAllSku1Products().catch(console.error);