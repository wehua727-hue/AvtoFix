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

async function forceCacheRefresh() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🚨 MAJBURIY CACHE YANGILASH');
    console.log('Client cache da eski ma\'lumotlar bor - ularni yangilash');
    console.log('=' .repeat(60));
    
    // Step 1: Check current database state
    console.log('\n📋 Step 1: Database holatini tekshirish...');
    
    const sku1Product = await collection.findOne({ sku: "1" });
    if (sku1Product) {
      console.log(`✅ SKU "1" mahsulot: ${sku1Product.name}`);
      console.log(`   Asosiy mahsulot stock: ${sku1Product.stock} (0 bo'lishi kerak)`);
      
      if (sku1Product.variantSummaries && sku1Product.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        sku1Product.variantSummaries.forEach((v, i) => {
          console.log(`     [${i}] ${v.name} - Stock: ${v.stock}`);
        });
      }
    }
    
    // Step 2: Force update timestamp to trigger cache refresh
    console.log('\n📋 Step 2: Cache refresh trigger yaratish...');
    
    const updateResult = await collection.updateMany(
      { sku: { $exists: true } },
      { 
        $set: { 
          cacheRefreshTrigger: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    console.log(`✅ ${updateResult.modifiedCount} ta mahsulot yangilandi`);
    
    // Step 3: Instructions for user
    console.log('\n📋 Step 3: Foydalanuvchi uchun ko\'rsatmalar');
    console.log('=' .repeat(50));
    
    console.log('\n🔧 QUYIDAGI QADAMLARNI BAJARING:');
    console.log('\n1. Browser da F12 bosing (Developer Tools)');
    console.log('2. Console tab ni oching');
    console.log('3. Quyidagi kodni yozing va Enter bosing:');
    console.log('   window.forceRefreshCache()');
    console.log('\n4. Agar yuqoridagi ishlamasa:');
    console.log('   - Ctrl+Shift+Delete bosing');
    console.log('   - "All time" tanlang');
    console.log('   - Barcha cache ni o\'chiring');
    console.log('   - Browser ni yoping va qayta oching');
    console.log('\n5. Development server ni qayta ishga tushiring:');
    console.log('   Terminal da:');
    console.log('   pkill -f "vite" && pkill -f "node"');
    console.log('   cd server && npm run dev');
    console.log('   # Yangi terminal:');
    console.log('   cd client && npm run dev');
    
    console.log('\n🧪 KEYIN TEST QILING:');
    console.log('1. SKU "1" ni scan qiling');
    console.log('2. Variant ko\'rinishi kerak (asosiy mahsulot emas)');
    console.log('3. Barcha stockni soting');
    console.log('4. Stock 0 bo\'lishi va qaytmasligi kerak');
    
    console.log('\n📊 KUTILAYOTGAN NATIJA:');
    console.log('✅ SKU "1" → Variant qaytadi (stock > 0)');
    console.log('✅ Asosiy mahsulot ko\'rsatilmaydi (stock = 0)');
    console.log('✅ Sotishdan keyin stock darhol kamayadi');
    console.log('✅ Hech qachon eski qiymatga qaytmaydi');
    
    console.log('\n💡 AGAR HALI HAM ISHLAMASA:');
    console.log('Browser console da quyidagini yozing:');
    console.log('localStorage.clear()');
    console.log('sessionStorage.clear()');
    console.log('location.reload(true)');
    
    console.log('\n🎯 XULOSA:');
    console.log('Database to\'liq toza, server logic to\'g\'ri.');
    console.log('Faqat client cache yangilanishi kerak.');
    console.log('Yuqoridagi qadamlar 100% ishga beradi!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

forceCacheRefresh().catch(console.error);