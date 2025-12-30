const { MongoClient } = require('mongodb');
const fs = require('fs');

// Load config
let config;
try {
  const configPath = './electron/config.json';
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Config loaded from electron/config.json');
  } else {
    throw new Error('Config file not found');
  }
} catch (error) {
  console.error('❌ Failed to load config:', error.message);
  process.exit(1);
}

const MONGODB_URI = config.MONGODB_URI;
const DB_NAME = config.DB_NAME;

async function debugSKU5Issue() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🔍 DEBUGGING SKU "5" STOCK REVERSION ISSUE');
    console.log('=' .repeat(60));
    
    // Find the exact product user is working with
    const product = await collection.findOne({ 
      name: 'Бачок ГЦС в сборе',
      sku: '5'
    });
    
    if (!product) {
      console.log('❌ Product "Бачок ГЦС в сборе" with SKU "5" not found');
      
      // Search by name only
      const productByName = await collection.findOne({ name: 'Бачок ГЦС в сборе' });
      if (productByName) {
        console.log(`Found product by name: SKU = "${productByName.sku}"`);
      }
      return;
    }
    
    console.log(`\n📦 FOUND PRODUCT:`);
    console.log(`   Name: ${product.name}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   ID: ${product._id}`);
    console.log(`   Main Stock: ${product.stock}`);
    console.log(`   InitialStock: ${product.initialStock || 'undefined'}`);
    console.log(`   Created: ${product.createdAt}`);
    console.log(`   Updated: ${product.updatedAt}`);
    
    if (product.variantSummaries && product.variantSummaries.length > 0) {
      console.log(`\n📋 VARIANTS:`);
      product.variantSummaries.forEach((v, i) => {
        console.log(`   [${i}] ${v.name}`);
        console.log(`       Stock: ${v.stock}`);
        console.log(`       InitialStock: ${v.initialStock || 'undefined'}`);
        console.log(`       SKU: ${v.sku || 'undefined'}`);
      });
    }
    
    // Check if this is the issue: Main product has stock=5, but user expects it to be 0
    console.log(`\n🎯 ISSUE ANALYSIS:`);
    console.log(`User says: "5 ta sotdim, 0 ta qolishi kerak edi, lekin qaytib 5 ta bo'ldi"`);
    console.log(`Current state: Main stock = ${product.stock}`);
    
    if (product.stock === 5) {
      console.log(`❌ PROBLEM CONFIRMED: Stock is still 5 after selling 5 items`);
      console.log(`This means stock reversion is happening!`);
      
      // Check if there are any background processes resetting the stock
      console.log(`\n🔍 POSSIBLE CAUSES:`);
      console.log(`1. reloadProducts() is overwriting the stock with cached data`);
      console.log(`2. WebSocket updates are reverting the stock`);
      console.log(`3. Multiple API calls are interfering`);
      console.log(`4. Search cache is not being updated`);
      
      // Test the stock update manually
      console.log(`\n🧪 TESTING MANUAL STOCK UPDATE:`);
      console.log(`Manually setting stock to 0...`);
      
      const updateResult = await collection.updateOne(
        { _id: product._id },
        { 
          $set: { 
            stock: 0,
            updatedAt: new Date()
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`✅ Stock manually updated to 0`);
        
        // Wait a moment and check if it reverts
        console.log(`⏳ Waiting 2 seconds to check for reversion...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const checkProduct = await collection.findOne({ _id: product._id });
        console.log(`🔍 Stock after 2 seconds: ${checkProduct.stock}`);
        
        if (checkProduct.stock === 0) {
          console.log(`✅ Stock remains 0 - no automatic reversion in database`);
          console.log(`❌ ISSUE IS IN CLIENT-SIDE: Cache or UI is showing old data`);
        } else {
          console.log(`❌ STOCK REVERTED TO: ${checkProduct.stock}`);
          console.log(`❌ ISSUE IS IN SERVER-SIDE: Something is resetting the stock`);
        }
        
        // Restore original stock for testing
        await collection.updateOne(
          { _id: product._id },
          { $set: { stock: product.stock } }
        );
        console.log(`🔄 Original stock restored for further testing`);
        
      } else {
        console.log(`❌ Failed to update stock manually`);
      }
      
    } else if (product.stock === 0) {
      console.log(`✅ Stock is correctly 0 in database`);
      console.log(`❌ ISSUE IS IN CLIENT-SIDE: UI is showing cached data (stock=5)`);
      console.log(`SOLUTION: Clear browser cache and reload`);
    } else {
      console.log(`⚠️ Stock is ${product.stock} - unexpected value`);
    }
    
    // Check for duplicate products with same SKU
    console.log(`\n🔍 CHECKING FOR DUPLICATE SKUs:`);
    const duplicates = await collection.find({ sku: '5' }).toArray();
    console.log(`Found ${duplicates.length} products with SKU "5":`);
    
    duplicates.forEach((dup, i) => {
      console.log(`   ${i + 1}. ${dup.name} (ID: ${dup._id}) - Stock: ${dup.stock}`);
    });
    
    if (duplicates.length > 1) {
      console.log(`❌ DUPLICATE SKU ISSUE: Multiple products have SKU "5"`);
      console.log(`This can cause confusion in search results`);
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`If stock is 5 in database: Client-side cache issue`);
    console.log(`If stock is 0 in database: UI cache issue`);
    console.log(`If stock reverts automatically: Server-side issue`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

debugSKU5Issue().catch(console.error);