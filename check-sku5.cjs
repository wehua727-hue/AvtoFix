/**
 * Check SKU 5 Product
 * SKU "5" mahsulotini tekshirish
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

async function checkSku5() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // SKU "5" li mahsulotni topish
    console.log('🔍 Looking for product with SKU "5"...');
    
    const product = await collection.findOne({ sku: "5" });
    
    if (!product) {
      console.log('❌ Product with SKU "5" not found');
      return;
    }
    
    console.log('📦 Found product:');
    console.log(`   ID: ${product._id}`);
    console.log(`   Name: ${product.name}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   Stock: ${product.stock}`);
    console.log(`   InitialStock: ${product.initialStock || 'undefined'}`);
    console.log(`   Source: ${product.source || 'N/A'}`);
    console.log(`   Created: ${product.createdAt}`);
    console.log(`   Updated: ${product.updatedAt}`);
    
    // Test: Stock ni 5 ga o'rnatish
    console.log('\n🔧 Setting stock to 5 for testing...');
    
    await collection.updateOne(
      { _id: product._id },
      { 
        $set: { 
          stock: 5,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('✅ Stock updated to 5');
    
    // Verification
    const updatedProduct = await collection.findOne({ _id: product._id });
    console.log('\n🔍 Updated product:');
    console.log(`   Stock: ${updatedProduct.stock}`);
    console.log(`   InitialStock: ${updatedProduct.initialStock || 'undefined'}`);
    
    console.log('\n🧪 Now you can test:');
    console.log('   1. Scan SKU "5" in the app');
    console.log('   2. Add to cart and sell 5 items');
    console.log('   3. Stock should go from 5 → 0');
    console.log('   4. Scan again - should show stock: 0');
    console.log('   5. Should NOT be able to add to cart (stock 0)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkSku5();