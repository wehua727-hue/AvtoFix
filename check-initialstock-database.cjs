/**
 * Database da initialStock qiymatlarini tekshirish
 */

const { MongoClient } = require('mongodb');

async function checkInitialStock() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    console.log('🔍 Database da initialStock qiymatlarini tekshirish...');
    
    // Barcha mahsulotlarni olish
    const products = await collection.find({}).limit(10).toArray();
    
    console.log(`📦 Jami ${products.length} ta mahsulot topildi`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. SKU: "${product.sku}" | Name: ${product.name}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   InitialStock: ${product.initialStock} (type: ${typeof product.initialStock})`);
      console.log(`   Has initialStock property: ${product.hasOwnProperty('initialStock')}`);
      console.log('   ---');
    });
    
    // InitialStock mavjud bo'lgan mahsulotlar soni
    const withInitialStock = await collection.countDocuments({
      initialStock: { $exists: true, $ne: null, $gt: 0 }
    });
    
    const withoutInitialStock = await collection.countDocuments({
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: { $lte: 0 } }
      ]
    });
    
    console.log(`✅ InitialStock mavjud: ${withInitialStock}`);
    console.log(`❌ InitialStock yo'q: ${withoutInitialStock}`);
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

checkInitialStock().catch(console.error);