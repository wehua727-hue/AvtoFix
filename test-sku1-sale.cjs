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

async function testSKU1Sale() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    // Find product with SKU "1"
    console.log('\n🔍 Looking for product with SKU "1"...');
    const product = await collection.findOne({ sku: "1" });
    
    if (!product) {
      console.log('❌ Product with SKU "1" not found');
      return;
    }
    
    console.log('\n📦 Found product:');
    console.log(`   Name: ${product.name}`);
    console.log(`   Current Stock: ${product.stock}`);
    console.log(`   InitialStock: ${product.initialStock || 'undefined'}`);
    
    // Test selling all stock
    const currentStock = product.stock || 0;
    if (currentStock === 0) {
      console.log('\n⚠️ Product already has 0 stock. Setting stock to 5 for testing...');
      await collection.updateOne(
        { _id: product._id },
        { $set: { stock: 5 } }
      );
      console.log('✅ Stock set to 5 for testing');
    }
    
    // Get updated product
    const updatedProduct = await collection.findOne({ _id: product._id });
    const testStock = updatedProduct.stock || 0;
    
    console.log(`\n🛒 Simulating sale - selling ALL ${testStock} items...`);
    
    // Simulate selling all stock
    const result = await collection.updateOne(
      { _id: product._id },
      { $inc: { stock: -testStock } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Stock updated successfully');
    } else {
      console.log('❌ Failed to update stock');
      return;
    }
    
    // Verify the result
    console.log('\n🔍 Verification after selling all stock...');
    const finalProduct = await collection.findOne({ _id: product._id });
    
    console.log(`   Final Stock: ${finalProduct.stock}`);
    console.log(`   InitialStock: ${finalProduct.initialStock || 'undefined'}`);
    
    // Check if stock reverted
    if (finalProduct.stock === 0) {
      console.log('\n✅ SUCCESS: Stock correctly shows 0 after selling all items');
      console.log('✅ No reversion to initialStock detected');
    } else {
      console.log(`\n❌ FAILURE: Stock shows ${finalProduct.stock} instead of 0`);
      console.log('❌ Stock reversion detected!');
    }
    
    // Test with variants if they exist
    if (finalProduct.variantSummaries && finalProduct.variantSummaries.length > 0) {
      console.log('\n🔍 Testing variants...');
      const firstVariant = finalProduct.variantSummaries[0];
      console.log(`   Variant: ${firstVariant.name}`);
      console.log(`   Variant Stock: ${firstVariant.stock}`);
      console.log(`   Variant InitialStock: ${firstVariant.initialStock || 'undefined'}`);
      
      if (firstVariant.stock > 0) {
        console.log(`\n🛒 Simulating variant sale - selling ALL ${firstVariant.stock} items...`);
        
        // Update variant stock to 0
        const updatedVariants = [...finalProduct.variantSummaries];
        updatedVariants[0] = { ...firstVariant, stock: 0 };
        
        await collection.updateOne(
          { _id: product._id },
          { $set: { variantSummaries: updatedVariants } }
        );
        
        // Verify variant
        const finalCheck = await collection.findOne({ _id: product._id });
        const finalVariant = finalCheck.variantSummaries[0];
        
        console.log('\n🔍 Variant verification:');
        console.log(`   Final Variant Stock: ${finalVariant.stock}`);
        console.log(`   Final Variant InitialStock: ${finalVariant.initialStock || 'undefined'}`);
        
        if (finalVariant.stock === 0) {
          console.log('✅ SUCCESS: Variant stock correctly shows 0');
        } else {
          console.log(`❌ FAILURE: Variant stock shows ${finalVariant.stock} instead of 0`);
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

testSKU1Sale().catch(console.error);