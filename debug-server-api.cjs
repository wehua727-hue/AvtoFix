/**
 * Debug server API to see what's happening
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

async function debugServerApi() {
  console.log('\n🔌 Connecting to MongoDB directly...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    const userId = '694a8cf599adb50cf1248e50';
    
    console.log('🔍 Direct database query for user:', userId);
    
    // Simulate the exact same filter as the API
    const ADMIN_PHONE = "910712828";
    const userPhone = '998914058481';
    const normalizePhone = (phone) => phone.replace(/[^\d]/g, "");
    const normalizedUserPhone = normalizePhone(userPhone);
    const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);
    
    let filter = {};
    
    if (isAdminPhone && userId) {
      filter = {
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { userId: userId }
        ]
      };
    } else if (userId) {
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
    
    const products = await collection.find(filter).limit(5).toArray();
    console.log(`📦 Found ${products.length} products\n`);
    
    // Check first product in detail
    if (products.length > 0) {
      const firstProduct = products[0];
      console.log('🎯 First product (raw from database):');
      console.log('_id:', firstProduct._id);
      console.log('SKU:', firstProduct.sku);
      console.log('Name:', firstProduct.name);
      console.log('Stock:', firstProduct.stock);
      console.log('InitialStock:', firstProduct.initialStock);
      console.log('InitialStock type:', typeof firstProduct.initialStock);
      console.log('UserId:', firstProduct.userId);
      console.log('All keys:', Object.keys(firstProduct));
      
      // Check if initialStock exists in the object
      console.log('\n🔍 InitialStock analysis:');
      console.log('Has initialStock property:', firstProduct.hasOwnProperty('initialStock'));
      console.log('InitialStock in object:', 'initialStock' in firstProduct);
      console.log('InitialStock value:', firstProduct.initialStock);
      console.log('InitialStock === undefined:', firstProduct.initialStock === undefined);
      console.log('InitialStock === null:', firstProduct.initialStock === null);
    }
    
    // Check SKU "1" specifically
    const sku1Product = await collection.findOne({ 
      userId: userId, 
      sku: "1" 
    });
    
    if (sku1Product) {
      console.log('\n🎯 SKU "1" product (raw from database):');
      console.log('_id:', sku1Product._id);
      console.log('SKU:', sku1Product.sku);
      console.log('Name:', sku1Product.name);
      console.log('Stock:', sku1Product.stock);
      console.log('InitialStock:', sku1Product.initialStock);
      console.log('InitialStock type:', typeof sku1Product.initialStock);
      console.log('Has initialStock property:', sku1Product.hasOwnProperty('initialStock'));
      console.log('Full object:', JSON.stringify(sku1Product, null, 2));
    } else {
      console.log('\n❌ SKU "1" not found for this user');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugServerApi().catch(console.error);