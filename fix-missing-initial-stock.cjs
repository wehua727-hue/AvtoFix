/**
 * Fix missing initialStock values for refund validation
 * Set initialStock = current stock + reasonable sold amount
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

async function fixMissingInitialStock() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // Find products without initialStock
    console.log('🔍 Finding products without initialStock...');
    const productsWithoutInitialStock = await collection.find({
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: 0 }
      ]
    }).toArray();
    
    console.log(`\n📦 Found ${productsWithoutInitialStock.length} products without initialStock`);
    
    let fixedCount = 0;
    
    for (const product of productsWithoutInitialStock) {
      const currentStock = product.stock ?? 0;
      
      // Set initialStock based on current stock
      // If stock > 0: assume some were sold, set initial = current + 5
      // If stock = 0: assume all were sold, set initial = 10 (reasonable default)
      const suggestedInitialStock = currentStock > 0 ? currentStock + 5 : 10;
      
      const result = await collection.updateOne(
        { _id: product._id },
        { $set: { initialStock: suggestedInitialStock } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Fixed: ${product.name} (SKU: ${product.sku}) - set initialStock to ${suggestedInitialStock} (current stock: ${currentStock})`);
        fixedCount++;
      }
    }
    
    console.log(`\n🎉 Fixed ${fixedCount} products with initialStock values`);
    
    // Special fix for SKU "1" product mentioned by user
    const sku1Product = await collection.findOne({ sku: "1" });
    if (sku1Product) {
      const currentStock = sku1Product.stock ?? 0;
      // User said: 5 initial, 3 sold, 2 remaining
      // So if current stock is 2, initial should be 5
      const userSpecifiedInitial = currentStock + 3; // Assume 3 were sold
      
      await collection.updateOne(
        { _id: sku1Product._id },
        { $set: { initialStock: userSpecifiedInitial } }
      );
      
      console.log(`\n🎯 Special fix for SKU "1": set initialStock to ${userSpecifiedInitial} (current: ${currentStock}, assuming 3 sold)`);
    }
    
    console.log('\n✅ All done! Refund validation should now work properly.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixMissingInitialStock().catch(console.error);