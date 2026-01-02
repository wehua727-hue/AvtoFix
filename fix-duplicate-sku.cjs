/**
 * Fix Duplicate SKU
 * Bir xil SKU li mahsulotlarni tuzatish
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

async function fixDuplicateSku() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    console.log('🔍 Finding duplicate SKU products...');
    
    // SKU "13" li mahsulotlarni topish
    const duplicateProducts = await collection.find({ sku: "13" }).toArray();
    
    console.log(`Found ${duplicateProducts.length} products with SKU "13":`);
    
    duplicateProducts.forEach((product, index) => {
      console.log(`\n📦 Product ${index + 1}:`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   Created: ${product.createdAt}`);
      console.log(`   Updated: ${product.updatedAt}`);
    });
    
    if (duplicateProducts.length > 1) {
      console.log('\n🔧 Fixing duplicate SKUs...');
      
      // Eng eski mahsulotni saqlash, qolganlarini o'chirish yoki SKU ni o'zgartirish
      const sortedProducts = duplicateProducts.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      const keepProduct = sortedProducts[0]; // Eng eski
      const duplicatesToFix = sortedProducts.slice(1); // Qolganlari
      
      console.log(`\n✅ Keeping oldest product: ${keepProduct.name} (${keepProduct._id})`);
      console.log(`🔧 Fixing ${duplicatesToFix.length} duplicate(s):`);
      
      for (let i = 0; i < duplicatesToFix.length; i++) {
        const duplicate = duplicatesToFix[i];
        const newSku = `13-${i + 1}`; // 13-1, 13-2, etc.
        
        await collection.updateOne(
          { _id: duplicate._id },
          { 
            $set: { 
              sku: newSku,
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`   ✅ Changed SKU: ${duplicate._id} -> "${newSku}"`);
      }
      
      console.log('\n🎉 Duplicate SKU issue fixed!');
    } else {
      console.log('\n✅ No duplicate SKUs found');
    }
    
    // Final verification
    console.log('\n🔍 Final verification...');
    const finalCheck = await collection.find({ sku: "13" }).toArray();
    console.log(`Products with SKU "13": ${finalCheck.length}`);
    
    if (finalCheck.length === 1) {
      const product = finalCheck[0];
      console.log(`✅ Single product with SKU "13":`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock || 'REMOVED ✅'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixDuplicateSku();