/**
 * Stock Issue Checker
 * Проверяет актуальные данные о stock в MongoDB после продажи
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

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not configured in config.json');
  process.exit(1);
}

async function checkStockIssue() {
  console.log('\n🔌 Connecting to MongoDB...');
  console.log('   Database:', DB_NAME);
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // Find the problematic product (the one mentioned in logs)
    console.log('🔍 Looking for products with SKU "13" or similar...');
    
    const products = await collection.find({
      $or: [
        { sku: "13" },
        { sku: 13 },
        { name: { $regex: "Блок педалей", $options: "i" } }
      ]
    }).toArray();
    
    console.log(`Found ${products.length} matching products:\n`);
    
    products.forEach((product, index) => {
      console.log(`📦 Product ${index + 1}:`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock}`);
      console.log(`   Updated: ${product.updatedAt}`);
      
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        product.variantSummaries.forEach((variant, vIndex) => {
          console.log(`     [${vIndex}] ${variant.name} - Stock: ${variant.stock}, InitialStock: ${variant.initialStock}`);
        });
      }
      console.log('');
    });
    
    // Check recent sales
    console.log('📊 Checking recent sales...');
    try {
      const salesCollection = db.collection('sales');
      const recentSales = await salesCollection.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      
      console.log(`Found ${recentSales.length} recent sales:`);
      recentSales.forEach((sale, index) => {
        console.log(`   Sale ${index + 1}: ${sale.total} - ${new Date(sale.createdAt).toLocaleString()}`);
        if (sale.items) {
          sale.items.forEach(item => {
            console.log(`     - ${item.name} x${item.quantity}`);
          });
        }
      });
    } catch (e) {
      console.log('   No sales collection or error:', e.message);
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkStockIssue();