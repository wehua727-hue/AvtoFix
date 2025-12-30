/**
 * Check SKU 1 Detailed
 * SKU "1" mahsulotini batafsil tekshirish
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load config
let config = {};
const configPath = path.join(__dirname, 'electron', 'config.json');

try {
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
    console.log('✅ Config loaded from electron/config.json');
  } else {
    console.log('⚠️  electron/config.json not found');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ Error loading config:', e.message);
  process.exit(1);
}

const MONGODB_URI = config.MONGODB_URI;
const DB_NAME = config.DB_NAME || 'oflayn-dokon';

async function checkSku1Detailed() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // SKU "1" li barcha mahsulotlarni topish
    console.log('🔍 Looking for ALL products with SKU "1"...');
    
    const products = await collection.find({ sku: "1" }).toArray();
    
    console.log(`Found ${products.length} products with SKU "1":`);
    
    products.forEach((product, index) => {
      console.log(`\n📦 Product ${index + 1}:`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock}`);
      console.log(`   Source: ${product.source || 'N/A'}`);
      console.log(`   Created: ${product.createdAt}`);
      console.log(`   Updated: ${product.updatedAt}`);
      
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        product.variantSummaries.forEach((variant, vIndex) => {
          console.log(`     [${vIndex}] ${variant.name} - Stock: ${variant.stock}, InitialStock: ${variant.initialStock}`);
        });
      }
    });
    
    // Agar initialStock mavjud bo'lsa, o'chirish
    let fixedCount = 0;
    
    for (const product of products) {
      const updates = {};
      let needsUpdate = false;
      
      // Asosiy mahsulot initialStock
      if (product.initialStock !== undefined && product.initialStock !== null) {
        console.log(`\n🔧 Removing initialStock from: ${product.name}`);
        updates.$unset = { initialStock: "" };
        needsUpdate = true;
        fixedCount++;
      }
      
      // Variant initialStock
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        const cleanedVariants = product.variantSummaries.map(variant => {
          if (variant.initialStock !== undefined && variant.initialStock !== null) {
            console.log(`   🔧 Removing variant initialStock: ${variant.name}`);
            const { initialStock, ...cleanVariant } = variant;
            return cleanVariant;
          }
          return variant;
        });
        
        // Agar variant o'zgargan bo'lsa
        const hasVariantChanges = product.variantSummaries.some(v => 
          v.initialStock !== undefined && v.initialStock !== null
        );
        
        if (hasVariantChanges) {
          if (!updates.$set) updates.$set = {};
          updates.$set.variantSummaries = cleanedVariants;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        if (!updates.$set) updates.$set = {};
        updates.$set.updatedAt = new Date();
        
        await collection.updateOne(
          { _id: product._id },
          updates
        );
        
        console.log(`   ✅ Fixed: ${product.name}`);
      }
    }
    
    console.log(`\n📊 Summary: Fixed ${fixedCount} products`);
    
    // Final verification
    console.log('\n🔍 Final verification...');
    const finalProducts = await collection.find({ sku: "1" }).toArray();
    
    finalProducts.forEach((product, index) => {
      console.log(`\n✅ Product ${index + 1} after fix:`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock || 'REMOVED ✅'}`);
      
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        product.variantSummaries.forEach((variant, vIndex) => {
          console.log(`     [${vIndex}] ${variant.name} - InitialStock: ${variant.initialStock || 'REMOVED ✅'}`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkSku1Detailed();