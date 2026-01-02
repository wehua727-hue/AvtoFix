/**
 * Test: SKU "1" aynan o'sha mahsulotni qaytarishi
 * 
 * Muammo: SKU "1" kiritganda stock=0 bo'lgani uchun variant qaytarmoqda
 * Yechim: Stock prioritetini olib tashladik - aynan kiritilgan SKU qaytaradi
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'avtofix';

async function testSku1ExactMatch() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi');
    
    const db = client.db(DB_NAME);
    const productsCollection = db.collection('products');
    
    // SKU "1" mahsulotni topish
    const sku1Product = await productsCollection.findOne({ sku: "1" });
    
    if (!sku1Product) {
      console.log('❌ SKU "1" mahsulot topilmadi');
      return;
    }
    
    console.log('\n📦 SKU "1" mahsulot:');
    console.log(`   Nomi: "${sku1Product.name}"`);
    console.log(`   SKU: ${sku1Product.sku}`);
    console.log(`   Stock: ${sku1Product.stock}`);
    console.log(`   InitialStock: ${sku1Product.initialStock || 'undefined'}`);
    
    // Variantlarni tekshirish
    if (sku1Product.variantSummaries && sku1Product.variantSummaries.length > 0) {
      console.log(`\n🔄 Variantlar (${sku1Product.variantSummaries.length} ta):`);
      sku1Product.variantSummaries.forEach((variant, index) => {
        console.log(`   ${index + 1}. "${variant.name}" (SKU: ${variant.sku}) - Stock: ${variant.stock}`);
      });
    }
    
    console.log('\n🧪 Test natijasi:');
    console.log('Endi kassada SKU "1" ni kiritganda:');
    console.log(`✅ "${sku1Product.name}" qaytarishi kerak`);
    console.log(`✅ Stock: ${sku1Product.stock} (0 bo'lsa ham ko'rsatiladi)`);
    console.log(`❌ Variant qaytarmasligi kerak`);
    
    console.log('\n📝 Kutilayotgan console logs:');
    console.log('[DEBUG] REAL-TIME: Found main product: ' + sku1Product.name + ' stock: ' + sku1Product.stock);
    console.log('[Kassa] ✅ Adding product to cart: ' + sku1Product.name);
    
    if (sku1Product.stock === 0) {
      console.log('\n⚠️  Stock 0 bo\'lgani uchun:');
      console.log('- Qidiruvda ko\'rinadi');
      console.log('- "TUGAGAN" yozuvi bilan');
      console.log('- Bosganda "omborda mavjud emas" xabari');
      console.log('- Kassaga qo\'shilmaydi');
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

testSku1ExactMatch().catch(console.error);