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

async function fixSKU1SearchPriority() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🔍 FIXING SKU "1" SEARCH PRIORITY ISSUE');
    console.log('=' .repeat(50));
    
    // Find all products with SKU "1"
    const products = await collection.find({ sku: "1" }).toArray();
    console.log(`\nFound ${products.length} products with SKU "1":`);
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\n${i + 1}. ${product.name}`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Main Stock: ${product.stock}`);
      console.log(`   Created: ${product.createdAt}`);
      
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        product.variantSummaries.forEach((v, vi) => {
          console.log(`     [${vi}] ${v.name} - Stock: ${v.stock}`);
        });
        
        // Find variant with stock > 0
        const variantWithStock = product.variantSummaries.find(v => v.stock > 0);
        if (variantWithStock) {
          console.log(`   ⭐ Has variant with stock: ${variantWithStock.name} (${variantWithStock.stock})`);
        }
      }
    }
    
    // The issue: When user scans SKU "1", the search should prioritize variants with stock
    // Current behavior: Returns main product with stock=0
    // Expected behavior: Return variant with stock>0
    
    console.log('\n🎯 ISSUE ANALYSIS:');
    console.log('When user scans SKU "1":');
    console.log('- searchBySkuWithVariant() finds main product with stock=0');
    console.log('- But variants have stock>0');
    console.log('- User expects to get variant with stock, not main product');
    
    console.log('\n💡 SOLUTION:');
    console.log('The searchBySkuWithVariant function should:');
    console.log('1. First check if main product has stock>0');
    console.log('2. If main product stock=0, check variants');
    console.log('3. Return first variant with stock>0');
    console.log('4. Only return main product if no variants have stock');
    
    // Test the current search logic
    console.log('\n🧪 TESTING CURRENT SEARCH LOGIC:');
    
    // Simulate searchBySkuWithVariant for SKU "1"
    const sku = "1";
    console.log(`\nSearching for SKU "${sku}":`);
    
    // Find by main product SKU
    const mainProduct = products.find(p => p.sku === sku);
    if (mainProduct) {
      console.log(`✅ Found main product: ${mainProduct.name}`);
      console.log(`   Main stock: ${mainProduct.stock}`);
      
      if (mainProduct.stock > 0) {
        console.log(`   ✅ Main product has stock - would return main product`);
      } else {
        console.log(`   ⚠️ Main product has no stock - should check variants`);
        
        // Check variants
        if (mainProduct.variantSummaries && mainProduct.variantSummaries.length > 0) {
          for (let i = 0; i < mainProduct.variantSummaries.length; i++) {
            const variant = mainProduct.variantSummaries[i];
            if (variant.stock > 0) {
              console.log(`   ✅ Found variant with stock: ${variant.name} (index ${i}, stock ${variant.stock})`);
              console.log(`   🎯 SHOULD RETURN: { product: mainProduct, variantIndex: ${i} }`);
              break;
            }
          }
        }
      }
    }
    
    // Check if variants have their own SKUs
    console.log('\n🔍 CHECKING VARIANT SKUs:');
    for (const product of products) {
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          if (variant.sku === sku) {
            console.log(`✅ Found variant with matching SKU: ${variant.name}`);
            console.log(`   Parent: ${product.name}`);
            console.log(`   Variant stock: ${variant.stock}`);
            console.log(`   🎯 SHOULD RETURN: { product: product, variantIndex: ${i} }`);
          }
        }
      }
    }
    
    console.log('\n📋 RECOMMENDATION:');
    console.log('The client-side searchBySkuWithVariant function needs to be updated to:');
    console.log('1. Prioritize variants with stock>0 over main product with stock=0');
    console.log('2. Return the first variant that has stock>0');
    console.log('3. This will ensure user gets a sellable item when scanning SKU "1"');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

fixSKU1SearchPriority().catch(console.error);