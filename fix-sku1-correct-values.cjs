/**
 * SKU "1" mahsulot uchun to'g'ri initialStock qiymatini o'rnatish
 * User: 5 ta bor edi, 2 ta sotdi, 3 ta qoldi, maksimal 2 ta qaytarish mumkin
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

async function fixSku1CorrectValues() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // SKU "1" mahsulotni topish
    const sku1Product = await collection.findOne({ sku: "1" });
    
    if (!sku1Product) {
      console.log('❌ SKU "1" product not found');
      return;
    }
    
    console.log('📦 Current SKU "1" product:');
    console.log('Name:', sku1Product.name);
    console.log('Current Stock:', sku1Product.stock);
    console.log('Current Initial Stock:', sku1Product.initialStock);
    
    // User ma'lumotlari bo'yicha to'g'ri qiymatlar
    const currentStock = sku1Product.stock || 0; // 3 ta qolgan
    const correctInitialStock = currentStock + 2; // 3 + 2 = 5 (user aytganidek)
    
    console.log('\n🎯 Correcting values based on user info:');
    console.log('- User had 5 initially');
    console.log('- User sold 2');  
    console.log('- Current stock:', currentStock);
    console.log('- Correct initialStock should be:', correctInitialStock);
    console.log('- Max refundable should be: 2');
    
    // Database ni yangilash
    const result = await collection.updateOne(
      { _id: sku1Product._id },
      { $set: { initialStock: correctInitialStock } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('\n✅ Successfully updated SKU "1" initialStock to', correctInitialStock);
      
      // Tekshirish
      const updatedProduct = await collection.findOne({ sku: "1" });
      const soldQuantity = updatedProduct.initialStock - updatedProduct.stock;
      
      console.log('\n📊 Final verification:');
      console.log('Initial Stock:', updatedProduct.initialStock);
      console.log('Current Stock:', updatedProduct.stock);
      console.log('Sold Quantity:', soldQuantity);
      console.log('Max Refundable:', soldQuantity);
      
      if (soldQuantity === 2) {
        console.log('✅ Perfect! Now user can refund maximum 2 items');
      } else {
        console.log('❌ Something is still wrong');
      }
    } else {
      console.log('❌ Failed to update');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixSku1CorrectValues().catch(console.error);