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

async function testSKU1CompleteSale() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🔍 TESTING COMPLETE SALE SCENARIO FOR SKU "1"');
    console.log('=' .repeat(60));
    
    // Find all products with SKU "1"
    const products = await collection.find({ sku: "1" }).toArray();
    console.log(`\n📦 Found ${products.length} products with SKU "1":`);
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\n${i + 1}. ${product.name}`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock || 'undefined'}`);
      
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        console.log(`   Variants: ${product.variantSummaries.length}`);
        product.variantSummaries.forEach((v, vi) => {
          console.log(`     [${vi}] ${v.name} - Stock: ${v.stock}, InitialStock: ${v.initialStock || 'undefined'}`);
        });
      }
    }
    
    // Test the second product (the one showing in logs)
    const testProduct = products.find(p => p.name === 'Бачок расширительный 6520-1311010');
    if (!testProduct) {
      console.log('\n❌ Test product not found');
      return;
    }
    
    console.log(`\n🧪 TESTING: ${testProduct.name}`);
    console.log('=' .repeat(50));
    
    // Check if it has variants with stock
    if (testProduct.variantSummaries && testProduct.variantSummaries.length > 0) {
      const variantWithStock = testProduct.variantSummaries.find(v => v.stock > 0);
      if (variantWithStock) {
        const variantIndex = testProduct.variantSummaries.indexOf(variantWithStock);
        console.log(`\n📋 Found variant with stock: ${variantWithStock.name}`);
        console.log(`   Variant Index: ${variantIndex}`);
        console.log(`   Current Stock: ${variantWithStock.stock}`);
        console.log(`   InitialStock: ${variantWithStock.initialStock || 'undefined'}`);
        
        // Simulate selling 1 item from variant
        console.log(`\n🛒 Simulating sale: Selling 1 item from variant...`);
        
        // Update variant stock
        const updatedVariants = [...testProduct.variantSummaries];
        updatedVariants[variantIndex] = {
          ...variantWithStock,
          stock: Math.max(0, variantWithStock.stock - 1)
        };
        
        const updateResult = await collection.updateOne(
          { _id: testProduct._id },
          { 
            $set: { 
              variantSummaries: updatedVariants,
              updatedAt: new Date()
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log('✅ Variant stock updated successfully');
          
          // Verify the update
          const updatedProduct = await collection.findOne({ _id: testProduct._id });
          const updatedVariant = updatedProduct.variantSummaries[variantIndex];
          
          console.log('\n🔍 Verification:');
          console.log(`   Updated Variant Stock: ${updatedVariant.stock}`);
          console.log(`   Updated InitialStock: ${updatedVariant.initialStock || 'undefined'}`);
          
          // Check for reversion
          if (updatedVariant.stock === (variantWithStock.stock - 1)) {
            console.log('✅ SUCCESS: Stock correctly decreased by 1');
            console.log('✅ No reversion detected');
          } else {
            console.log(`❌ FAILURE: Expected stock ${variantWithStock.stock - 1}, got ${updatedVariant.stock}`);
            console.log('❌ Stock reversion detected!');
          }
          
          // Test multiple sales to deplete completely
          if (updatedVariant.stock > 0) {
            console.log(`\n🛒 Simulating complete depletion: Selling remaining ${updatedVariant.stock} items...`);
            
            const finalVariants = [...updatedProduct.variantSummaries];
            finalVariants[variantIndex] = {
              ...updatedVariant,
              stock: 0
            };
            
            await collection.updateOne(
              { _id: testProduct._id },
              { 
                $set: { 
                  variantSummaries: finalVariants,
                  updatedAt: new Date()
                }
              }
            );
            
            // Final verification
            const finalProduct = await collection.findOne({ _id: testProduct._id });
            const finalVariant = finalProduct.variantSummaries[variantIndex];
            
            console.log('\n🔍 Final verification:');
            console.log(`   Final Variant Stock: ${finalVariant.stock}`);
            console.log(`   Final InitialStock: ${finalVariant.initialStock || 'undefined'}`);
            
            if (finalVariant.stock === 0) {
              console.log('✅ SUCCESS: Variant completely depleted');
            } else {
              console.log(`❌ FAILURE: Expected 0, got ${finalVariant.stock}`);
            }
          }
          
          // Restore original stock for future tests
          console.log(`\n🔄 Restoring original stock...`);
          const restoredVariants = [...testProduct.variantSummaries];
          await collection.updateOne(
            { _id: testProduct._id },
            { 
              $set: { 
                variantSummaries: restoredVariants,
                updatedAt: new Date()
              }
            }
          );
          console.log('✅ Original stock restored');
          
        } else {
          console.log('❌ Failed to update variant stock');
        }
      } else {
        console.log('\n⚠️ No variants with stock > 0 found');
      }
    } else {
      console.log('\n⚠️ No variants found');
    }
    
    // Test API endpoint simulation
    console.log('\n🌐 TESTING API ENDPOINT SIMULATION');
    console.log('=' .repeat(40));
    
    // Simulate the PATCH /api/products/:id/stock call
    const testProductId = testProduct._id.toString();
    console.log(`\n📡 Simulating PATCH /api/products/${testProductId}/stock`);
    
    // Find variant with stock
    if (testProduct.variantSummaries && testProduct.variantSummaries.length > 0) {
      const variantWithStock = testProduct.variantSummaries.find(v => v.stock > 0);
      if (variantWithStock) {
        const variantIndex = testProduct.variantSummaries.indexOf(variantWithStock);
        console.log(`   Variant Index: ${variantIndex}`);
        console.log(`   Change: -1 (sale)`);
        
        // Simulate the API logic
        const currentStock = variantWithStock.stock || 0; // This is the problematic line!
        const newStock = Math.max(0, currentStock - 1);
        
        console.log(`   Current Stock (with || 0): ${currentStock}`);
        console.log(`   New Stock: ${newStock}`);
        
        // Check if the || 0 fallback is causing issues
        if (variantWithStock.stock === 0 && currentStock === 0) {
          console.log('⚠️ POTENTIAL ISSUE: || 0 fallback might be masking undefined/null values');
        }
        
        // Test without fallback
        const stockWithoutFallback = variantWithStock.stock;
        console.log(`   Stock without fallback: ${stockWithoutFallback}`);
        
        if (stockWithoutFallback !== currentStock) {
          console.log('❌ FALLBACK ISSUE DETECTED: || 0 is changing the value!');
        } else {
          console.log('✅ No fallback issue detected');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

testSKU1CompleteSale().catch(console.error);