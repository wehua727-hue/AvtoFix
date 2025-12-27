/**
 * Check products for specific user to see initialStock values
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

async function checkUserProducts() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    const userId = '693d2d63ba2fae9ff378c33a';
    const userPhone = '998914058481';
    
    console.log('🔍 Checking products for user:', userId);
    console.log('📱 User phone:', userPhone);
    
    // Check what filter the API would use
    const ADMIN_PHONE = "910712828";
    const normalizePhone = (phone) => phone.replace(/[^\d]/g, "");
    const normalizedUserPhone = normalizePhone(userPhone);
    const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);
    
    console.log('🔑 Normalized phone:', normalizedUserPhone);
    console.log('👑 Is admin phone:', isAdminPhone);
    
    let filter = {};
    
    if (isAdminPhone && userId) {
      // Admin access
      filter = {
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { userId: userId }
        ]
      };
    } else if (userId) {
      // Regular user
      filter = { userId: userId };
    }
    
    // Add hidden filter
    const hiddenFilter = { $or: [{ isHidden: { $exists: false } }, { isHidden: false }] };
    
    if (filter.$or) {
      filter = {
        $and: [
          { $or: filter.$or },
          hiddenFilter
        ]
      };
    } else if (Object.keys(filter).length > 0) {
      filter = {
        $and: [
          filter,
          hiddenFilter
        ]
      };
    } else {
      filter = hiddenFilter;
    }
    
    console.log('🔍 Filter used:', JSON.stringify(filter, null, 2));
    
    const products = await collection.find(filter).toArray();
    console.log(`📦 Found ${products.length} products for this user\n`);
    
    // Check initialStock status
    const withInitialStock = products.filter(p => p.initialStock && p.initialStock > 0);
    const withoutInitialStock = products.filter(p => !p.initialStock || p.initialStock <= 0);
    
    console.log(`✅ Products with initialStock: ${withInitialStock.length}`);
    console.log(`❌ Products without initialStock: ${withoutInitialStock.length}`);
    
    // Check SKU "1" specifically
    const sku1Product = products.find(p => p.sku === "1");
    if (sku1Product) {
      console.log('\n🎯 SKU "1" product found:');
      console.log('Name:', sku1Product.name);
      console.log('Stock:', sku1Product.stock);
      console.log('InitialStock:', sku1Product.initialStock);
    } else {
      console.log('\n❌ SKU "1" not found in user products');
      
      // Check for renamed SKUs
      const renamedSku1 = products.find(p => p.sku && p.sku.startsWith("1_"));
      if (renamedSku1) {
        console.log('🔄 Found renamed SKU "1":');
        console.log('SKU:', renamedSku1.sku);
        console.log('Name:', renamedSku1.name);
        console.log('Stock:', renamedSku1.stock);
        console.log('InitialStock:', renamedSku1.initialStock);
      }
    }
    
    // Show first few products with their initialStock
    console.log('\n📋 First 5 products:');
    products.slice(0, 5).forEach((p, i) => {
      console.log(`${i + 1}. SKU: "${p.sku}" | Name: ${p.name} | Stock: ${p.stock} | InitialStock: ${p.initialStock}`);
    });
    
    if (withoutInitialStock.length > 0) {
      console.log('\n🚨 Products missing initialStock:');
      withoutInitialStock.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. SKU: "${p.sku}" | Name: ${p.name} | Stock: ${p.stock} | InitialStock: ${p.initialStock}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkUserProducts().catch(console.error);