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

async function verifyCompleteFix() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🔍 COMPREHENSIVE STOCK REVERSION FIX VERIFICATION');
    console.log('=' .repeat(60));
    
    // Test 1: Check that no products have initialStock fallback values
    console.log('\n📋 Test 1: Checking for initialStock fallback contamination...');
    
    const productsWithInitialStock = await collection.find({
      initialStock: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`   Found ${productsWithInitialStock.length} products with initialStock values`);
    
    if (productsWithInitialStock.length > 0) {
      console.log('   ⚠️ Some products still have initialStock - this may cause issues');
      productsWithInitialStock.slice(0, 3).forEach((p, i) => {
        console.log(`     ${i+1}. ${p.name} - initialStock: ${p.initialStock}, stock: ${p.stock}`);
      });
    } else {
      console.log('   ✅ No products have initialStock - clean database');
    }
    
    // Test 2: Check variants for initialStock
    console.log('\n📋 Test 2: Checking variants for initialStock contamination...');
    
    const productsWithVariantInitialStock = await collection.find({
      'variantSummaries.initialStock': { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`   Found ${productsWithVariantInitialStock.length} products with variant initialStock`);
    
    if (productsWithVariantInitialStock.length > 0) {
      console.log('   ⚠️ Some variants still have initialStock');
      productsWithVariantInitialStock.slice(0, 2).forEach((p, i) => {
        console.log(`     ${i+1}. ${p.name}`);
        p.variantSummaries?.forEach((v, vi) => {
          if (v.initialStock !== undefined && v.initialStock !== null) {
            console.log(`        Variant ${vi}: ${v.name} - initialStock: ${v.initialStock}`);
          }
        });
      });
    } else {
      console.log('   ✅ No variants have initialStock - clean database');
    }
    
    // Test 3: Simulate real-world scenario
    console.log('\n📋 Test 3: Real-world stock depletion simulation...');
    
    // Find a product with stock > 0
    const testProduct = await collection.findOne({
      stock: { $gt: 0 },
      sku: { $exists: true }
    });
    
    if (!testProduct) {
      console.log('   ⚠️ No products with stock > 0 found for testing');
    } else {
      console.log(`   Testing with: ${testProduct.name} (SKU: ${testProduct.sku})`);
      console.log(`   Initial stock: ${testProduct.stock}`);
      console.log(`   Initial initialStock: ${testProduct.initialStock || 'undefined'}`);
      
      // Deplete all stock
      const originalStock = testProduct.stock;
      await collection.updateOne(
        { _id: testProduct._id },
        { $set: { stock: 0 } }
      );
      
      // Verify no reversion
      const depleted = await collection.findOne({ _id: testProduct._id });
      console.log(`   After depletion - stock: ${depleted.stock}, initialStock: ${depleted.initialStock || 'undefined'}`);
      
      if (depleted.stock === 0 && (depleted.initialStock === undefined || depleted.initialStock === null)) {
        console.log('   ✅ SUCCESS: No stock reversion detected');
      } else if (depleted.stock === 0) {
        console.log('   ✅ Stock correctly at 0, but initialStock still exists (acceptable)');
      } else {
        console.log(`   ❌ FAILURE: Stock reverted to ${depleted.stock}`);
      }
      
      // Restore original stock for future tests
      await collection.updateOne(
        { _id: testProduct._id },
        { $set: { stock: originalStock } }
      );
      console.log(`   🔄 Restored original stock: ${originalStock}`);
    }
    
    // Test 4: Check specific problematic SKUs
    console.log('\n📋 Test 4: Checking specific problematic SKUs...');
    
    const problematicSKUs = ['1', '13', '5'];
    
    for (const sku of problematicSKUs) {
      const product = await collection.findOne({ sku: sku });
      if (product) {
        console.log(`   SKU "${sku}": ${product.name}`);
        console.log(`     Stock: ${product.stock}, InitialStock: ${product.initialStock || 'undefined'}`);
        
        if (product.variantSummaries && product.variantSummaries.length > 0) {
          console.log(`     Variants: ${product.variantSummaries.length}`);
          product.variantSummaries.forEach((v, i) => {
            console.log(`       [${i}] ${v.name} - Stock: ${v.stock}, InitialStock: ${v.initialStock || 'undefined'}`);
          });
        }
      } else {
        console.log(`   SKU "${sku}": Not found`);
      }
    }
    
    // Summary
    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('=' .repeat(40));
    
    const totalProducts = await collection.countDocuments();
    const productsWithStock = await collection.countDocuments({ stock: { $gt: 0 } });
    const cleanProducts = totalProducts - productsWithInitialStock.length;
    
    console.log(`   Total products: ${totalProducts}`);
    console.log(`   Products with stock > 0: ${productsWithStock}`);
    console.log(`   Products without initialStock: ${cleanProducts}`);
    console.log(`   Clean percentage: ${((cleanProducts / totalProducts) * 100).toFixed(1)}%`);
    
    if (productsWithInitialStock.length === 0 && productsWithVariantInitialStock.length === 0) {
      console.log('\n🎉 COMPLETE SUCCESS: All initialStock fallback patterns removed!');
      console.log('✅ Stock reversion issue should be completely fixed');
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS: Some initialStock values remain');
      console.log('   This may still cause stock reversion in some cases');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

verifyCompleteFix().catch(console.error);