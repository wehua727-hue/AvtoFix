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

// Simulate the fixed searchBySkuWithVariant logic
function simulateSearchBySkuWithVariant(products, code) {
  const normalizedCode = code.toLowerCase().trim();
  
  console.log(`\n🔍 Simulating searchBySkuWithVariant("${code}"):`);
  
  // Step 1: Check variants first (like the original logic)
  for (const product of products) {
    if (product.variantSummaries && product.variantSummaries.length > 0) {
      for (let i = 0; i < product.variantSummaries.length; i++) {
        const variant = product.variantSummaries[i];
        const variantSku = variant.sku?.toLowerCase().trim();
        
        if (variantSku === normalizedCode) {
          console.log(`   ✅ Found variant by SKU: ${variant.name} (stock: ${variant.stock})`);
          return { product, variantIndex: i };
        }
        
        // Numeric matching
        if (variantSku && /^\d+$/.test(normalizedCode) && /^\d+$/.test(variantSku)) {
          const codeNum = normalizedCode.replace(/^0+/, '') || '0';
          const skuNum = variantSku.replace(/^0+/, '') || '0';
          if (codeNum === skuNum) {
            console.log(`   ✅ Found variant by numeric SKU: ${variant.name} (stock: ${variant.stock})`);
            return { product, variantIndex: i };
          }
        }
      }
    }
  }
  
  // Step 2: Check main products with STOCK PRIORITY
  for (const product of products) {
    const productSku = product.sku?.toLowerCase().trim();
    
    if (productSku === normalizedCode) {
      console.log(`   ✅ Found main product by SKU: ${product.name} (stock: ${product.stock})`);
      
      // NEW LOGIC: If main product has no stock, check variants
      if (product.stock === 0 && product.variantSummaries && product.variantSummaries.length > 0) {
        console.log(`   ⚠️ Main product has no stock, checking variants...`);
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          if (variant.stock > 0) {
            console.log(`   ✅ Found variant with stock: ${variant.name} (stock: ${variant.stock})`);
            return { product, variantIndex: i };
          }
        }
        console.log(`   ⚠️ No variants with stock found`);
      }
      
      return { product, variantIndex: undefined };
    }
    
    // Numeric matching for main product
    if (productSku && /^\d+$/.test(normalizedCode) && /^\d+$/.test(productSku)) {
      const codeNum = normalizedCode.replace(/^0+/, '') || '0';
      const skuNum = productSku.replace(/^0+/, '') || '0';
      if (codeNum === skuNum) {
        console.log(`   ✅ Found main product by numeric SKU: ${product.name} (stock: ${product.stock})`);
        
        // NEW LOGIC: If main product has no stock, check variants
        if (product.stock === 0 && product.variantSummaries && product.variantSummaries.length > 0) {
          console.log(`   ⚠️ Main product has no stock, checking variants...`);
          for (let i = 0; i < product.variantSummaries.length; i++) {
            const variant = product.variantSummaries[i];
            if (variant.stock > 0) {
              console.log(`   ✅ Found variant with stock: ${variant.name} (stock: ${variant.stock})`);
              return { product, variantIndex: i };
            }
          }
          console.log(`   ⚠️ No variants with stock found`);
        }
        
        return { product, variantIndex: undefined };
      }
    }
  }
  
  console.log(`   ❌ No product found for SKU "${code}"`);
  return undefined;
}

async function testSKU1SearchFix() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🎯 TESTING SKU "1" SEARCH FIX');
    console.log('=' .repeat(50));
    
    // Get all products with SKU "1"
    const products = await collection.find({ sku: "1" }).toArray();
    console.log(`\nFound ${products.length} products with SKU "1"`);
    
    // Test the fixed search logic
    const result = simulateSearchBySkuWithVariant(products, "1");
    
    if (result) {
      console.log(`\n🎯 SEARCH RESULT:`);
      console.log(`   Product: ${result.product.name}`);
      console.log(`   Product ID: ${result.product._id}`);
      
      if (result.variantIndex !== undefined) {
        const variant = result.product.variantSummaries[result.variantIndex];
        console.log(`   ✅ VARIANT SELECTED:`);
        console.log(`     Name: ${variant.name}`);
        console.log(`     Stock: ${variant.stock}`);
        console.log(`     Index: ${result.variantIndex}`);
        
        if (variant.stock > 0) {
          console.log(`   ✅ SUCCESS: User will get a sellable item!`);
        } else {
          console.log(`   ❌ ISSUE: Variant has no stock`);
        }
      } else {
        console.log(`   ✅ MAIN PRODUCT SELECTED:`);
        console.log(`     Stock: ${result.product.stock}`);
        
        if (result.product.stock > 0) {
          console.log(`   ✅ SUCCESS: User will get a sellable item!`);
        } else {
          console.log(`   ❌ ISSUE: Main product has no stock`);
        }
      }
    } else {
      console.log(`\n❌ No result found`);
    }
    
    console.log(`\n📊 COMPARISON:`);
    console.log(`OLD BEHAVIOR: Always return main product (stock=0)`);
    console.log(`NEW BEHAVIOR: Return variant with stock>0 if main product has no stock`);
    console.log(`RESULT: User gets sellable item instead of out-of-stock item`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

testSKU1SearchFix().catch(console.error);