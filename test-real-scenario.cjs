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

async function testRealScenario() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🎯 TESTING REAL USER SCENARIO');
    console.log('User scans SKU "1" and sees product with stock, then sells it');
    console.log('=' .repeat(60));
    
    // Find the exact product the user is seeing
    const product = await collection.findOne({ 
      name: 'Бачок расширительный 6520-1311010',
      sku: '1'
    });
    
    if (!product) {
      console.log('❌ Test product not found');
      return;
    }
    
    console.log(`\n📦 Product: ${product.name}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   Main Stock: ${product.stock}`);
    console.log(`   InitialStock: ${product.initialStock || 'undefined'}`);
    
    if (product.variantSummaries && product.variantSummaries.length > 0) {
      console.log(`\n📋 Variants:`);
      product.variantSummaries.forEach((v, i) => {
        console.log(`   [${i}] ${v.name}`);
        console.log(`       Stock: ${v.stock}`);
        console.log(`       InitialStock: ${v.initialStock || 'undefined'}`);
      });
      
      // Find variant with stock > 0
      const variantWithStock = product.variantSummaries.find(v => v.stock > 0);
      if (variantWithStock) {
        const variantIndex = product.variantSummaries.indexOf(variantWithStock);
        console.log(`\n🎯 User will get variant: ${variantWithStock.name} (index ${variantIndex})`);
        console.log(`   Current stock: ${variantWithStock.stock}`);
        
        // Test the PATCH API call that the client makes
        console.log(`\n🌐 Simulating PATCH /api/products/${product._id}/stock`);
        console.log(`   Body: { change: -1, variantIndex: ${variantIndex} }`);
        
        // Simulate the API logic exactly as in the server
        const variant = product.variantSummaries[variantIndex];
        const currentStock = variant.stock ?? 0; // This is the new logic (was || 0)
        const newStock = Math.max(0, currentStock - 1);
        
        console.log(`   Current stock (with ?? 0): ${currentStock}`);
        console.log(`   New stock: ${newStock}`);
        
        // Apply the update
        const updatedVariants = [...product.variantSummaries];
        updatedVariants[variantIndex] = {
          ...variant,
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
          console.log('✅ Update successful');
          
          // Verify the result
          const updatedProduct = await collection.findOne({ _id: product._id });
          const updatedVariant = updatedProduct.variantSummaries[variantIndex];
          
          console.log('\n🔍 Verification:');
          console.log(`   Updated stock: ${updatedVariant.stock}`);
          console.log(`   Updated initialStock: ${updatedVariant.initialStock || 'undefined'}`);
          
          if (updatedVariant.stock === newStock) {
            console.log('✅ SUCCESS: Stock updated correctly');
            
            // Test what the client API would return
            console.log('\n📡 API Response would be:');
            console.log(`   { success: true, stock: ${updatedVariant.stock}, variantIndex: ${variantIndex} }`);
            
            // Test if there's any reversion after a delay
            console.log('\n⏳ Waiting 1 second to check for reversion...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const finalCheck = await collection.findOne({ _id: product._id });
            const finalVariant = finalCheck.variantSummaries[variantIndex];
            
            if (finalVariant.stock === updatedVariant.stock) {
              console.log('✅ No reversion detected - stock remains correct');
            } else {
              console.log(`❌ REVERSION DETECTED: Stock changed from ${updatedVariant.stock} to ${finalVariant.stock}`);
            }
            
          } else {
            console.log(`❌ FAILURE: Expected ${newStock}, got ${updatedVariant.stock}`);
          }
          
          // Restore original stock
          console.log('\n🔄 Restoring original stock...');
          const originalVariants = [...product.variantSummaries];
          await collection.updateOne(
            { _id: product._id },
            { 
              $set: { 
                variantSummaries: originalVariants,
                updatedAt: new Date()
              }
            }
          );
          console.log('✅ Original stock restored');
          
        } else {
          console.log('❌ Update failed');
        }
      } else {
        console.log('\n⚠️ No variants with stock > 0 found');
        
        // Set stock to 1 for testing
        console.log('🔧 Setting variant stock to 1 for testing...');
        const testVariants = [...product.variantSummaries];
        testVariants[0] = { ...testVariants[0], stock: 1 };
        
        await collection.updateOne(
          { _id: product._id },
          { $set: { variantSummaries: testVariants } }
        );
        
        console.log('✅ Test stock set. Please run the test again.');
      }
    } else {
      console.log('\n⚠️ No variants found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

testRealScenario().catch(console.error);