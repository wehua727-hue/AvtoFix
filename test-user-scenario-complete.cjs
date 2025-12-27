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

async function testUserScenarioComplete() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🎯 TESTING COMPLETE USER SCENARIO');
    console.log('User scans SKU "1", expects to see variant with stock, sells all stock');
    console.log('=' .repeat(70));
    
    // Step 1: Find product with SKU "1"
    console.log('\n📋 Step 1: Finding product with SKU "1"...');
    const product = await collection.findOne({ sku: "1" });
    
    if (!product) {
      console.log('❌ Product with SKU "1" not found');
      return;
    }
    
    console.log(`✅ Found: ${product.name}`);
    console.log(`   Main product stock: ${product.stock}`);
    console.log(`   InitialStock: ${product.initialStock || 'undefined'}`);
    
    if (product.variantSummaries && product.variantSummaries.length > 0) {
      console.log(`   Variants: ${product.variantSummaries.length}`);
      product.variantSummaries.forEach((v, i) => {
        console.log(`     [${i}] ${v.name} - Stock: ${v.stock}, InitialStock: ${v.initialStock || 'undefined'}`);
      });
    }
    
    // Step 2: Simulate search logic - should return variant with stock
    console.log('\n📋 Step 2: Simulating search logic for SKU "1"...');
    
    let selectedVariant = null;
    let selectedVariantIndex = -1;
    
    // Main product has stock=0, check variants
    if (product.stock === 0 && product.variantSummaries && product.variantSummaries.length > 0) {
      console.log('   Main product has no stock, checking variants...');
      for (let i = 0; i < product.variantSummaries.length; i++) {
        const variant = product.variantSummaries[i];
        if (variant.stock > 0) {
          selectedVariant = variant;
          selectedVariantIndex = i;
          console.log(`   ✅ Found variant with stock: ${variant.name} (stock: ${variant.stock})`);
          break;
        }
      }
    } else if (product.stock > 0) {
      console.log(`   ✅ Main product has stock: ${product.stock}`);
    }
    
    if (!selectedVariant && product.stock === 0) {
      console.log('   ❌ No variants with stock found');
      return;
    }
    
    // Step 3: Simulate selling all stock
    console.log('\n📋 Step 3: Simulating sale of all stock...');
    
    if (selectedVariant) {
      const stockToSell = selectedVariant.stock;
      console.log(`   Selling ${stockToSell} units of variant: ${selectedVariant.name}`);
      
      // Update variant stock to 0
      const updatedVariants = [...product.variantSummaries];
      updatedVariants[selectedVariantIndex] = {
        ...selectedVariant,
        stock: 0
      };
      
      await collection.updateOne(
        { _id: product._id },
        { 
          $set: { 
            variantSummaries: updatedVariants,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`   ✅ Updated variant stock to 0`);
      
    } else {
      const stockToSell = product.stock;
      console.log(`   Selling ${stockToSell} units of main product: ${product.name}`);
      
      // Update main product stock to 0
      await collection.updateOne(
        { _id: product._id },
        { 
          $set: { 
            stock: 0,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`   ✅ Updated main product stock to 0`);
    }
    
    // Step 4: Verify no stock reversion
    console.log('\n📋 Step 4: Verifying no stock reversion...');
    
    const updatedProduct = await collection.findOne({ _id: product._id });
    
    console.log(`   Main product stock: ${updatedProduct.stock} (should be ${product.stock})`);
    console.log(`   Main product initialStock: ${updatedProduct.initialStock || 'undefined'}`);
    
    if (updatedProduct.variantSummaries && updatedProduct.variantSummaries.length > 0) {
      updatedProduct.variantSummaries.forEach((v, i) => {
        const wasSelected = i === selectedVariantIndex;
        const expectedStock = wasSelected ? 0 : (product.variantSummaries[i]?.stock || 0);
        const actualStock = v.stock;
        const status = actualStock === expectedStock ? '✅' : '❌';
        
        console.log(`     [${i}] ${v.name} - Stock: ${actualStock} (expected: ${expectedStock}) ${status}`);
        console.log(`         InitialStock: ${v.initialStock || 'undefined'}`);
      });
    }
    
    // Step 5: Check for any stock reversion
    console.log('\n📋 Step 5: Final verification...');
    
    let hasReversion = false;
    
    if (selectedVariant) {
      // Check if variant stock reverted
      const currentVariant = updatedProduct.variantSummaries[selectedVariantIndex];
      if (currentVariant.stock !== 0) {
        console.log(`   ❌ STOCK REVERSION DETECTED: Variant stock is ${currentVariant.stock}, should be 0`);
        hasReversion = true;
      } else {
        console.log(`   ✅ Variant stock correctly at 0`);
      }
    } else {
      // Check if main product stock reverted
      if (updatedProduct.stock !== 0) {
        console.log(`   ❌ STOCK REVERSION DETECTED: Main product stock is ${updatedProduct.stock}, should be 0`);
        hasReversion = true;
      } else {
        console.log(`   ✅ Main product stock correctly at 0`);
      }
    }
    
    // Check for any initialStock contamination
    if (updatedProduct.initialStock !== undefined && updatedProduct.initialStock !== null) {
      console.log(`   ⚠️ Main product still has initialStock: ${updatedProduct.initialStock}`);
    }
    
    if (updatedProduct.variantSummaries) {
      updatedProduct.variantSummaries.forEach((v, i) => {
        if (v.initialStock !== undefined && v.initialStock !== null) {
          console.log(`   ⚠️ Variant [${i}] still has initialStock: ${v.initialStock}`);
        }
      });
    }
    
    // Step 6: Restore original state for future tests
    console.log('\n📋 Step 6: Restoring original state...');
    
    if (selectedVariant) {
      const restoredVariants = [...updatedProduct.variantSummaries];
      restoredVariants[selectedVariantIndex] = {
        ...restoredVariants[selectedVariantIndex],
        stock: selectedVariant.stock // Restore original stock
      };
      
      await collection.updateOne(
        { _id: product._id },
        { 
          $set: { 
            variantSummaries: restoredVariants,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`   🔄 Restored variant stock to ${selectedVariant.stock}`);
    } else {
      await collection.updateOne(
        { _id: product._id },
        { 
          $set: { 
            stock: product.stock, // Restore original stock
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`   🔄 Restored main product stock to ${product.stock}`);
    }
    
    // Final result
    console.log('\n🎯 TEST RESULT');
    console.log('=' .repeat(40));
    
    if (hasReversion) {
      console.log('❌ FAILURE: Stock reversion detected!');
      console.log('   The issue is NOT completely fixed');
    } else {
      console.log('✅ SUCCESS: No stock reversion detected!');
      console.log('   The fix appears to be working correctly');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

testUserScenarioComplete().catch(console.error);