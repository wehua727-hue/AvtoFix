/**
 * BARCHA foydalanuvchi mahsulotlarini to'liq fix qilish
 * 0 dan boshlab barcha mahsulotlarga initialStock qo'shish
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

async function fixAllUserProductsComplete() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    const userId = '694a8cf599adb50cf1248e50';
    
    console.log('🔍 BARCHA foydalanuvchi mahsulotlarini topish:', userId);
    
    // BARCHA foydalanuvchi mahsulotlarini topish
    const allUserProducts = await collection.find({ userId: userId }).toArray();
    console.log(`📦 Jami ${allUserProducts.length} ta mahsulot topildi`);
    
    if (allUserProducts.length === 0) {
      console.log('❌ Hech qanday mahsulot topilmadi!');
      return;
    }
    
    // initialStock mavjud/yo'q statistika
    const withInitialStock = allUserProducts.filter(p => 
      p.hasOwnProperty('initialStock') && 
      p.initialStock !== undefined && 
      p.initialStock !== null && 
      p.initialStock > 0
    );
    const withoutInitialStock = allUserProducts.filter(p => 
      !p.hasOwnProperty('initialStock') || 
      p.initialStock === undefined || 
      p.initialStock === null || 
      p.initialStock <= 0
    );
    
    console.log(`✅ InitialStock mavjud: ${withInitialStock.length} ta`);
    console.log(`❌ InitialStock yo'q: ${withoutInitialStock.length} ta`);
    
    if (withoutInitialStock.length === 0) {
      console.log('🎉 Barcha mahsulotlarda initialStock mavjud!');
      return;
    }
    
    console.log('\n🔧 BARCHA mahsulotlarni fix qilish...');
    console.log('Har bir mahsulot uchun: initialStock = Math.max(currentStock, 1)');
    
    let fixedCount = 0;
    let errorCount = 0;
    
    // Har bir mahsulotni fix qilish
    for (let i = 0; i < withoutInitialStock.length; i++) {
      const product = withoutInitialStock[i];
      const currentStock = product.stock ?? 0;
      const initialStock = Math.max(currentStock, 1); // Kamida 1 ta
      
      try {
        const result = await collection.updateOne(
          { _id: product._id },
          { 
            $set: { 
              initialStock: initialStock,
              updatedAt: new Date()
            } 
          }
        );
        
        if (result.modifiedCount > 0) {
          fixedCount++;
          if (fixedCount % 10 === 0 || fixedCount <= 10) {
            console.log(`✅ ${fixedCount}/${withoutInitialStock.length}: SKU "${product.sku}" | ${product.name} | Stock: ${currentStock} → InitialStock: ${initialStock}`);
          }
        } else {
          console.log(`⚠️  Yangilanmadi: SKU "${product.sku}"`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Xato SKU "${product.sku}":`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 YAKUNIY NATIJA:`);
    console.log(`✅ Muvaffaqiyatli fix qilindi: ${fixedCount} ta mahsulot`);
    console.log(`❌ Xato: ${errorCount} ta mahsulot`);
    console.log(`📦 Jami: ${withoutInitialStock.length} ta mahsulot`);
    
    // Tekshirish
    console.log('\n🔍 Yakuniy tekshirish...');
    const stillMissing = await collection.countDocuments({
      userId: userId,
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: undefined },
        { initialStock: 0 }
      ]
    });
    
    const totalFixed = await collection.countDocuments({
      userId: userId,
      initialStock: { $exists: true, $ne: null, $gt: 0 }
    });
    
    console.log(`📦 Hali ham initialStock yo'q: ${stillMissing} ta`);
    console.log(`✅ InitialStock mavjud: ${totalFixed} ta`);
    
    if (stillMissing === 0) {
      console.log('\n🎉 BARCHA MAHSULOTLAR FIX QILINDI!');
      console.log('🔄 Endi qaytarish validation ishlashi kerak.');
    } else {
      console.log('\n⚠️  Ba\'zi mahsulotlar hali ham fix qilinmagan.');
    }
    
    // Birinchi 5 ta mahsulotni ko'rsatish
    console.log('\n📋 Birinchi 5 ta mahsulot (tekshirish uchun):');
    const sampleProducts = await collection.find({ userId: userId }).limit(5).toArray();
    sampleProducts.forEach((p, i) => {
      console.log(`${i + 1}. SKU: "${p.sku}" | ${p.name} | Stock: ${p.stock} | InitialStock: ${p.initialStock}`);
    });
    
  } catch (error) {
    console.error('❌ Umumiy xato:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB dan uzildi');
  }
}

fixAllUserProductsComplete().catch(console.error);