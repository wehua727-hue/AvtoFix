/**
 * Check available SKUs in production database
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

async function checkAvailableSkus() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // Find first 10 products with their SKUs
    const products = await collection.find({}, {
      projection: { name: 1, sku: 1, stock: 1, initialStock: 1 }
    }).limit(10).toArray();
    
    console.log('📦 First 10 products:');
    products.forEach((p, i) => {
      console.log(`${i + 1}. SKU: "${p.sku}" | Name: ${p.name} | Stock: ${p.stock} | InitialStock: ${p.initialStock}`);
    });
    
    // Find products with numeric SKUs
    const numericSkus = await collection.find({
      sku: { $regex: /^\d+$/ }
    }, {
      projection: { name: 1, sku: 1, stock: 1, initialStock: 1 }
    }).limit(5).toArray();
    
    console.log('\n🔢 Products with numeric SKUs:');
    numericSkus.forEach((p, i) => {
      console.log(`${i + 1}. SKU: "${p.sku}" | Name: ${p.name} | Stock: ${p.stock} | InitialStock: ${p.initialStock}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkAvailableSkus().catch(console.error);