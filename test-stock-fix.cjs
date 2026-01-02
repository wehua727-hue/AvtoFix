/**
 * Test Stock Fix
 * Bu script stock update muammosini test qilish uchun
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

async function testStockFix() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // Find the problematic product
    const product = await collection.findOne({ sku: "13" });
    
    if (!product) {
      console.log('❌ Product with SKU "13" not found');
      return;
    }
    
    console.log('📦 Found product:');
    console.log(`   Name: ${product.name}`);
    console.log(`   Current Stock: ${product.stock}`);
    console.log(`   InitialStock: ${product.initialStock}`);
    
    // Simulate a sale - decrease stock by 1
    console.log('\n🛒 Simulating sale - decreasing stock by 1...');
    
    const result = await collection.findOneAndUpdate(
      { _id: product._id },
      { 
        $set: { 
          stock: Math.max(0, (product.stock || 0) - 1),
          updatedAt: new Date()
        }
      },
      { returnDocument: "after" }
    );
    
    console.log('✅ Stock updated:');
    console.log(`   New Stock: ${result.stock}`);
    console.log(`   InitialStock: ${result.initialStock}`);
    
    // Verify the change persisted
    const verifyProduct = await collection.findOne({ _id: product._id });
    console.log('\n🔍 Verification:');
    console.log(`   Stock in DB: ${verifyProduct.stock}`);
    console.log(`   InitialStock in DB: ${verifyProduct.initialStock}`);
    
    if (verifyProduct.stock !== result.stock) {
      console.log('❌ Stock did not persist correctly!');
    } else {
      console.log('✅ Stock update persisted correctly');
    }
    
    // Check if initialStock is causing issues
    if (verifyProduct.initialStock && verifyProduct.stock === verifyProduct.initialStock) {
      console.log('⚠️  WARNING: Stock equals initialStock - this might cause the reversion issue');
      console.log('   This suggests the client might be resetting stock to initialStock value');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testStockFix();