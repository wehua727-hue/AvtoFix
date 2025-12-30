/**
 * Production serverda refund validation holatini tekshirish
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

async function checkProductionRefund() {
  console.log('\n🔌 Connecting to MongoDB...');
  console.log('URI:', MONGODB_URI);
  console.log('DB:', DB_NAME);
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // 1. Umumiy mahsulotlar soni
    const totalProducts = await collection.countDocuments();
    console.log(`📦 Total products: ${totalProducts}`);
    
    // 2. initialStock mavjud bo'lgan mahsulotlar
    const withInitialStock = await collection.countDocuments({
      initialStock: { $exists: true, $ne: null, $gt: 0 }
    });
    console.log(`✅ Products with initialStock: ${withInitialStock}`);
    
    // 3. initialStock yo'q mahsulotlar
    const withoutInitialStock = await collection.countDocuments({
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: 0 }
      ]
    });
    console.log(`❌ Products without initialStock: ${withoutInitialStock}`);
    
    // 4. SKU "1" mahsulotni tekshirish
    const sku1Product = await collection.findOne({ sku: "1" });
    if (sku1Product) {
      console.log('\n🎯 SKU "1" product details:');
      console.log('Name:', sku1Product.name);
      console.log('Current Stock:', sku1Product.stock);
      console.log('Initial Stock:', sku1Product.initialStock);
      
      if (!sku1Product.initialStock || sku1Product.initialStock <= 0) {
        console.log('❌ SKU "1" initialStock missing - refund validation will not work!');
      } else {
        const soldQuantity = sku1Product.initialStock - (sku1Product.stock || 0);
        console.log('Sold Quantity:', soldQuantity);
        console.log('Max Refundable:', soldQuantity);
      }
    } else {
      console.log('\n❌ SKU "1" product not found');
    }
    
    // 5. Defective products collection tekshirish
    const defectiveCollection = db.collection('defectiveProducts');
    const defectiveCount = await defectiveCollection.countDocuments();
    console.log(`\n🔍 Defective products count: ${defectiveCount}`);
    
    if (withoutInitialStock > 0) {
      console.log('\n🚨 PROBLEM DETECTED:');
      console.log(`${withoutInitialStock} products are missing initialStock values.`);
      console.log('Refund validation will not work for these products.');
      console.log('\n💡 SOLUTION: Run fix-missing-initial-stock.cjs on production server');
    } else {
      console.log('\n✅ All products have initialStock values - refund validation should work');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

checkProductionRefund().catch(console.error);