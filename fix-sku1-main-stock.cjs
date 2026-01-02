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

async function fixSku1MainStock() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🔧 FIXING SKU "1" MAIN PRODUCT STOCK');
    console.log('Asosiy mahsulotning stockini 0 ga o\'zgartirish');
    console.log('=' .repeat(50));
    
    // Find SKU "1" product
    const product = await collection.findOne({ sku: "1" });
    
    if (!product) {
      console.log('❌ SKU "1" mahsulot topilmadi');
      return;
    }
    
    console.log(`📦 Topildi: ${product.name}`);
    console.log(`   Hozirgi asosiy stock: ${product.stock}`);
    console.log(`   Variants:`);
    
    if (product.variantSummaries && product.variantSummaries.length > 0) {
      product.variantSummaries.forEach((v, i) => {
        console.log(`     [${i}] ${v.name} - Stock: ${v.stock}`);
      });
    }
    
    // Update main product stock to 0
    console.log('\n🔄 Asosiy mahsulot stockini 0 ga o\'zgartirish...');
    
    const updateResult = await collection.updateOne(
      { _id: product._id },
      { 
        $set: { 
          stock: 0,
          updatedAt: new Date()
        } 
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('✅ Asosiy mahsulot stocki 0 ga o\'zgartirildi');
    } else {
      console.log('⚠️ Hech narsa o\'zgartirilmadi');
    }
    
    // Verify the change
    console.log('\n🔍 Tekshirish...');
    const updatedProduct = await collection.findOne({ _id: product._id });
    
    console.log(`📦 ${updatedProduct.name}`);
    console.log(`   Yangi asosiy stock: ${updatedProduct.stock} (0 bo'lishi kerak)`);
    console.log(`   Variants:`);
    
    if (updatedProduct.variantSummaries && updatedProduct.variantSummaries.length > 0) {
      updatedProduct.variantSummaries.forEach((v, i) => {
        console.log(`     [${i}] ${v.name} - Stock: ${v.stock}`);
      });
    }
    
    console.log('\n🎯 NATIJA:');
    if (updatedProduct.stock === 0) {
      console.log('✅ SUCCESS: Asosiy mahsulot stocki 0');
      console.log('✅ Endi SKU "1" scan qilganda variant qaytishi kerak');
      console.log('✅ Stock prioriteti to\'g\'ri ishlaydi');
    } else {
      console.log('❌ FAILURE: Stock hali ham 0 emas');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

fixSku1MainStock().catch(console.error);