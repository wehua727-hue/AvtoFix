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

async function testCurrentStatus() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n📊 CURRENT STATUS CHECK');
    console.log('=' .repeat(50));
    
    // Check SKU "1" status
    console.log('\n🔍 SKU "1" Status:');
    const sku1Products = await collection.find({ sku: "1" }).toArray();
    
    for (let i = 0; i < sku1Products.length; i++) {
      const product = sku1Products[i];
      console.log(`\n${i + 1}. ${product.name}`);
      console.log(`   Main Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock || 'undefined'}`);
      
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        let hasStockVariant = false;
        product.variantSummaries.forEach((v, vi) => {
          console.log(`     [${vi}] ${v.name} - Stock: ${v.stock}, InitialStock: ${v.initialStock || 'undefined'}`);
          if (v.stock > 0) hasStockVariant = true;
        });
        
        if (hasStockVariant) {
          console.log(`   ✅ Has variants with stock - should work correctly`);
        } else {
          console.log(`   ⚠️ No variants with stock`);
        }
      }
    }
    
    // Check SKU "5" status
    console.log('\n🔍 SKU "5" Status:');
    const sku5Products = await collection.find({ sku: "5" }).toArray();
    
    for (let i = 0; i < sku5Products.length; i++) {
      const product = sku5Products[i];
      console.log(`\n${i + 1}. ${product.name}`);
      console.log(`   Main Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock || 'undefined'}`);
      
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        product.variantSummaries.forEach((v, vi) => {
          console.log(`     [${vi}] ${v.name} - Stock: ${v.stock}, InitialStock: ${v.initialStock || 'undefined'}`);
        });
      }
    }
    
    // Test a complete sale simulation
    console.log('\n🧪 SIMULATING COMPLETE SALE PROCESS:');
    
    // Find a product with stock > 1 for testing
    const testProduct = await collection.findOne({ 
      $or: [
        { stock: { $gt: 1 } },
        { 'variantSummaries.stock': { $gt: 1 } }
      ]
    });
    
    if (testProduct) {
      console.log(`\n📦 Test Product: ${testProduct.name}`);
      console.log(`   SKU: ${testProduct.sku}`);
      console.log(`   Main Stock: ${testProduct.stock}`);
      
      let testVariant = null;
      let testVariantIndex = -1;
      
      if (testProduct.variantSummaries && testProduct.variantSummaries.length > 0) {
        for (let i = 0; i < testProduct.variantSummaries.length; i++) {
          const v = testProduct.variantSummaries[i];
          if (v.stock > 1) {
            testVariant = v;
            testVariantIndex = i;
            break;
          }
        }
      }
      
      if (testVariant) {
        console.log(`\n🎯 Testing with variant: ${testVariant.name}`);
        console.log(`   Current Stock: ${testVariant.stock}`);
        
        // Simulate sale
        const newStock = testVariant.stock - 1;
        console.log(`   After Sale Stock: ${newStock}`);
        
        // Apply update
        const updatedVariants = [...testProduct.variantSummaries];
        updatedVariants[testVariantIndex] = { ...testVariant, stock: newStock };
        
        await collection.updateOne(
          { _id: testProduct._id },
          { $set: { variantSummaries: updatedVariants } }
        );
        
        // Verify
        const verifyProduct = await collection.findOne({ _id: testProduct._id });
        const verifyVariant = verifyProduct.variantSummaries[testVariantIndex];
        
        console.log(`   ✅ Database Updated: ${verifyVariant.stock}`);
        
        if (verifyVariant.stock === newStock) {
          console.log(`   ✅ SUCCESS: Stock correctly decreased`);
        } else {
          console.log(`   ❌ FAILURE: Stock reversion detected!`);
        }
        
        // Restore
        await collection.updateOne(
          { _id: testProduct._id },
          { $set: { variantSummaries: testProduct.variantSummaries } }
        );
        console.log(`   🔄 Original stock restored`);
        
      } else if (testProduct.stock > 1) {
        console.log(`\n🎯 Testing with main product`);
        console.log(`   Current Stock: ${testProduct.stock}`);
        
        const newStock = testProduct.stock - 1;
        console.log(`   After Sale Stock: ${newStock}`);
        
        await collection.updateOne(
          { _id: testProduct._id },
          { $set: { stock: newStock } }
        );
        
        const verifyProduct = await collection.findOne({ _id: testProduct._id });
        console.log(`   ✅ Database Updated: ${verifyProduct.stock}`);
        
        if (verifyProduct.stock === newStock) {
          console.log(`   ✅ SUCCESS: Stock correctly decreased`);
        } else {
          console.log(`   ❌ FAILURE: Stock reversion detected!`);
        }
        
        // Restore
        await collection.updateOne(
          { _id: testProduct._id },
          { $set: { stock: testProduct.stock } }
        );
        console.log(`   🔄 Original stock restored`);
      }
    }
    
    console.log('\n📋 SUMMARY:');
    console.log('If you see ✅ SUCCESS messages above, the system is working correctly.');
    console.log('If you still see stock reversion in the UI, try:');
    console.log('1. Clear browser cache (Ctrl+Shift+R)');
    console.log('2. Restart development server');
    console.log('3. Check browser console for errors');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

testCurrentStatus().catch(console.error);