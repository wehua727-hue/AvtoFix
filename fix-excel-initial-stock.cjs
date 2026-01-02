/**
 * Excel Import Initial Stock Fix
 * Excel orqali import qilingan mahsulotlardagi initialStock muammosini hal qilish
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

async function fixExcelInitialStock() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    console.log('🔍 Finding Excel imported products with initialStock issues...');
    
    // 1. Excel orqali import qilingan mahsulotlarni topish
    const excelProducts = await collection.find({
      $or: [
        { source: 'excel-import' },
        { 
          $and: [
            { initialStock: { $exists: true } },
            { initialStock: { $eq: '$stock' } } // initialStock = stock bo'lgan holatlar
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${excelProducts.length} products to fix`);
    
    if (excelProducts.length === 0) {
      console.log('✅ No products need fixing');
      return;
    }
    
    // 2. Har bir mahsulotni tekshirish va tuzatish
    let fixedCount = 0;
    let variantFixedCount = 0;
    
    for (const product of excelProducts) {
      const updates = {};
      let needsUpdate = false;
      
      console.log(`\n📦 Checking: ${product.name} (SKU: ${product.sku})`);
      console.log(`   Current stock: ${product.stock}, initialStock: ${product.initialStock}`);
      
      // Asosiy mahsulot initialStock ni o'chirish
      if (product.initialStock !== undefined && product.initialStock !== null) {
        console.log(`   ❌ Removing initialStock: ${product.initialStock}`);
        updates.$unset = { initialStock: "" };
        needsUpdate = true;
      }
      
      // Variantlar uchun ham initialStock ni o'chirish
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        const updatedVariants = [];
        let variantChanged = false;
        
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          const updatedVariant = { ...variant };
          
          if (variant.initialStock !== undefined && variant.initialStock !== null) {
            console.log(`   ❌ Variant[${i}] "${variant.name}" - removing initialStock: ${variant.initialStock}`);
            delete updatedVariant.initialStock;
            variantChanged = true;
            variantFixedCount++;
          }
          
          updatedVariants.push(updatedVariant);
        }
        
        if (variantChanged) {
          if (!updates.$set) updates.$set = {};
          updates.$set.variantSummaries = updatedVariants;
          needsUpdate = true;
        }
      }
      
      // Yangilash
      if (needsUpdate) {
        await collection.updateOne(
          { _id: product._id },
          updates
        );
        fixedCount++;
        console.log(`   ✅ Fixed product: ${product.name}`);
      } else {
        console.log(`   ✅ Product already correct: ${product.name}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Products checked: ${excelProducts.length}`);
    console.log(`   Products fixed: ${fixedCount}`);
    console.log(`   Variants fixed: ${variantFixedCount}`);
    
    // 3. Verification - tekshirish
    console.log('\n🔍 Verification...');
    const remainingIssues = await collection.find({
      $or: [
        { initialStock: { $exists: true, $ne: null } },
        { 'variantSummaries.initialStock': { $exists: true, $ne: null } }
      ]
    }).toArray();
    
    if (remainingIssues.length > 0) {
      console.log(`⚠️  Still ${remainingIssues.length} products with initialStock issues:`);
      remainingIssues.forEach(p => {
        console.log(`   - ${p.name} (${p.sku}): stock=${p.stock}, initialStock=${p.initialStock}`);
      });
    } else {
      console.log('✅ All initialStock issues have been resolved!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixExcelInitialStock();         