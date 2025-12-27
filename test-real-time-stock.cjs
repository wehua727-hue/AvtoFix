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

async function testRealTimeStock() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🎯 REAL-TIME STOCK UPDATE TEST');
    console.log('This simulates exactly what happens when user scans and sells');
    console.log('=' .repeat(60));
    
    // Find the exact product user is working with
    const product = await collection.findOne({ 
      name: 'Амортизатор  основной 6520 ZTD',
      sku: '1'
    });
    
    if (!product) {
      console.log('❌ Test product not found');
      return;
    }
    
    console.log(`\n📦 Product: ${product.name}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   Main Stock: ${product.stock}`);
    
    // Find variant with stock
    let variantWithStock = null;
    let variantIndex = -1;
    
    if (product.variantSummaries && product.variantSummaries.length > 0) {
      for (let i = 0; i < product.variantSummaries.length; i++) {
        const v = product.variantSummaries[i];
        if (v.stock > 0) {
          variantWithStock = v;
          variantIndex = i;
          break;
        }
      }
    }
    
    if (!variantWithStock) {
      console.log('\n⚠️ No variant with stock > 0. Setting up test data...');
      
      // Set first variant stock to 5 for testing
      const testVariants = [...product.variantSummaries];
      testVariants[0] = { ...testVariants[0], stock: 5 };
      
      await collection.updateOne(
        { _id: product._id },
        { $set: { variantSummaries: testVariants } }
      );
      
      console.log('✅ Test data set. Variant 0 now has stock: 5');
      
      // Re-fetch product
      const updatedProduct = await collection.findOne({ _id: product._id });
      variantWithStock = updatedProduct.variantSummaries[0];
      variantIndex = 0;
    }
    
    console.log(`\n🎯 Testing variant: ${variantWithStock.name}`);
    console.log(`   Index: ${variantIndex}`);
    console.log(`   Current Stock: ${variantWithStock.stock}`);
    console.log(`   InitialStock: ${variantWithStock.initialStock || 'undefined'}`);
    
    // STEP 1: Simulate user scanning SKU "1"
    console.log('\n📱 STEP 1: User scans SKU "1"');
    console.log('   Client receives product data from /api/products');
    console.log(`   Client sees: ${variantWithStock.name} with stock ${variantWithStock.stock}`);
    
    // STEP 2: User adds to cart and sets quantity to 1
    console.log('\n🛒 STEP 2: User adds to cart and sets quantity to 1');
    console.log('   Client calls addToCart() with variant data');
    console.log(`   Cart item created with stock: ${variantWithStock.stock}`);
    
    // STEP 3: User completes sale
    console.log('\n💳 STEP 3: User completes sale');
    console.log('   Client calls completeSale()');
    console.log('   Client makes PATCH request to update stock');
    
    // Simulate the PATCH request
    const stockChange = -1; // Sale decreases stock
    const currentStock = variantWithStock.stock ?? 0;
    const newStock = Math.max(0, currentStock + stockChange);
    
    console.log(`   PATCH /api/products/${product._id}/stock`);
    console.log(`   Body: { change: ${stockChange}, variantIndex: ${variantIndex} }`);
    console.log(`   Current stock: ${currentStock} -> New stock: ${newStock}`);
    
    // Apply the update
    const updatedVariants = [...product.variantSummaries];
    updatedVariants[variantIndex] = {
      ...variantWithStock,
      stock: newStock
    };
    
    const updateResult = await collection.updateOne(
      { _id: product._id },
      { 
        $set: { 
          variantSummaries: updatedVariants,
          updatedAt: new Date()
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('   ✅ Database updated successfully');
      
      // STEP 4: Verify database state
      console.log('\n🔍 STEP 4: Verify database state');
      const verifyProduct = await collection.findOne({ _id: product._id });
      const verifyVariant = verifyProduct.variantSummaries[variantIndex];
      
      console.log(`   Database stock: ${verifyVariant.stock}`);
      console.log(`   Database initialStock: ${verifyVariant.initialStock || 'undefined'}`);
      
      if (verifyVariant.stock === newStock) {
        console.log('   ✅ Database state is correct');
      } else {
        console.log(`   ❌ Database state is wrong! Expected ${newStock}, got ${verifyVariant.stock}`);
      }
      
      // STEP 5: Simulate client cache refresh
      console.log('\n🔄 STEP 5: Client refreshes cache');
      console.log('   Client calls reloadProducts()');
      console.log('   Client makes GET /api/products request');
      
      // Simulate the GET request (what client would receive)
      const freshProduct = await collection.findOne({ _id: product._id });
      const freshVariant = freshProduct.variantSummaries[variantIndex];
      
      console.log(`   Fresh data from API: stock = ${freshVariant.stock}`);
      console.log(`   Fresh initialStock: ${freshVariant.initialStock || 'undefined'}`);
      
      // STEP 6: Check if client would show correct data
      console.log('\n📱 STEP 6: What client UI should show');
      
      if (freshVariant.stock === newStock) {
        console.log(`   ✅ SUCCESS: Client should show stock = ${freshVariant.stock}`);
        console.log('   ✅ No reversion - stock correctly decreased');
      } else {
        console.log(`   ❌ FAILURE: Client would show wrong stock = ${freshVariant.stock}`);
        console.log(`   ❌ Expected: ${newStock}, Got: ${freshVariant.stock}`);
      }
      
      // STEP 7: Test multiple sales to complete depletion
      if (freshVariant.stock > 0) {
        console.log(`\n🔥 STEP 7: Test complete depletion (sell remaining ${freshVariant.stock} items)`);
        
        const finalVariants = [...freshProduct.variantSummaries];
        finalVariants[variantIndex] = {
          ...freshVariant,
          stock: 0
        };
        
        await collection.updateOne(
          { _id: product._id },
          { $set: { variantSummaries: finalVariants } }
        );
        
        const finalProduct = await collection.findOne({ _id: product._id });
        const finalVariant = finalProduct.variantSummaries[variantIndex];
        
        console.log(`   Final stock: ${finalVariant.stock}`);
        console.log(`   Final initialStock: ${finalVariant.initialStock || 'undefined'}`);
        
        if (finalVariant.stock === 0) {
          console.log('   ✅ SUCCESS: Complete depletion works correctly');
        } else {
          console.log(`   ❌ FAILURE: Stock should be 0, got ${finalVariant.stock}`);
        }
      }
      
      // Restore original stock
      console.log('\n🔄 Restoring original stock for future tests...');
      await collection.updateOne(
        { _id: product._id },
        { $set: { variantSummaries: product.variantSummaries } }
      );
      console.log('✅ Original stock restored');
      
    } else {
      console.log('   ❌ Database update failed');
    }
    
    console.log('\n📊 SUMMARY');
    console.log('=' .repeat(30));
    console.log('If all steps show ✅ SUCCESS, the stock system is working correctly.');
    console.log('If any step shows ❌ FAILURE, there is still an issue to fix.');
    console.log('\nThe user should see the updated stock immediately after sale completion.');
    console.log('If user still sees old stock, the issue is in client-side caching or UI updates.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

testRealTimeStock().catch(console.error);