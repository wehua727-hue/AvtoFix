/**
 * Test: 0 stock mahsulotlar qidiruvda ko'rinishi
 * 
 * Tekshirish:
 * 1. 0 stock mahsulotlar qidiruvda chiqadimi?
 * 2. Ularni kassaga qo'shish mumkinmi?
 * 3. Visual indicator to'g'ri ko'rsatiladimi?
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'avtofix';

async function testZeroStockSearch() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi');
    
    const db = client.db(DB_NAME);
    const productsCollection = db.collection('products');
    
    // 1. 0 stock mahsulotlarni topish
    const zeroStockProducts = await productsCollection.find({
      stock: 0
    }).limit(5).toArray();
    
    console.log('\n📊 0 stock mahsulotlar:');
    zeroStockProducts.forEach((product, index) => {
      console.log(`${index + 1}. "${product.name}" (SKU: ${product.sku}) - Stock: ${product.stock}`);
    });
    
    // 2. Bitta mahsulotni test qilish
    if (zeroStockProducts.length > 0) {
      const testProduct = zeroStockProducts[0];
      console.log(`\n🧪 Test mahsulot: "${testProduct.name}" (SKU: ${testProduct.sku})`);
      console.log(`   Stock: ${testProduct.stock}`);
      console.log(`   InitialStock: ${testProduct.initialStock || 'undefined'}`);
      
      // 3. Qidiruv API ni test qilish
      console.log('\n🔍 Qidiruv testi...');
      console.log('Endi client da qidiruvni sinab ko\'ring:');
      console.log(`1. Kassani oching`);
      console.log(`2. "${testProduct.name.substring(0, 10)}" deb qidiring`);
      console.log(`3. Mahsulot ko'rinishi kerak lekin "TUGAGAN" yozuvi bilan`);
      console.log(`4. Uni bosganda "omborda mavjud emas" xabari chiqishi kerak`);
    }
    
    // 4. Umumiy statistika
    const totalProducts = await productsCollection.countDocuments();
    const zeroStockCount = await productsCollection.countDocuments({ stock: 0 });
    const positiveStockCount = await productsCollection.countDocuments({ stock: { $gt: 0 } });
    
    console.log('\n📈 Umumiy statistika:');
    console.log(`   Jami mahsulotlar: ${totalProducts}`);
    console.log(`   0 stock: ${zeroStockCount}`);
    console.log(`   Stock > 0: ${positiveStockCount}`);
    
    console.log('\n✅ Test tugadi. Endi client da sinab ko\'ring!');
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

testZeroStockSearch().catch(console.error);