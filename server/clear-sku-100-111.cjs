/**
 * SKU 100-111 mahsulotlarini o'chirish
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'oflayn-dokon';

async function clearSkus() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('🔍 SKU 100-111 mahsulotlarini qidiryapman...');
    
    // SKU 100-111 ni topish
    const products = await collection.find({
      sku: { $in: ['100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111'] }
    }).toArray();
    
    console.log(`\n📦 Topildi: ${products.length} ta mahsulot`);
    
    if (products.length > 0) {
      products.forEach(p => {
        console.log(`  - SKU: ${p.sku}, Nomi: ${p.name}`);
      });
      
      // O'chirish
      const result = await collection.deleteMany({
        sku: { $in: ['100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111'] }
      });
      
      console.log(`\n✅ O'chirildi: ${result.deletedCount} ta mahsulot`);
    } else {
      console.log('✅ SKU 100-111 mahsulotlari topilmadi');
    }
    
  } catch (error) {
    console.error('❌ Xato:', error.message);
  } finally {
    await client.close();
  }
}

clearSkus();
