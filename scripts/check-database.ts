/**
 * MongoDB database holatini tekshirish scripti
 * 
 * Foydalanish:
 * npx tsx scripts/check-database.ts
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'oflayn-dokon';

async function main() {
  console.log('🔍 MongoDB Database Tekshiruvi\n');
  
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');
    
    const db = client.db(DB_NAME);
    
    // 1. Products collection
    console.log('📦 PRODUCTS COLLECTION:');
    const productsCollection = db.collection('products');
    const productsCount = await productsCollection.countDocuments();
    console.log(`   Jami mahsulotlar: ${productsCount} ta\n`);
    
    if (productsCount > 0) {
      const sampleProducts = await productsCollection.find().limit(5).toArray();
      console.log('   Namuna mahsulotlar:');
      sampleProducts.forEach((p: any, i) => {
        console.log(`   ${i + 1}. ${p.name} (SKU: ${p.sku}, Stock: ${p.stock || 0})`);
      });
      console.log('');
    }
    
    // 2. Product History collection
    console.log('📜 PRODUCT_HISTORY COLLECTION:');
    const historyCollection = db.collection('product_history');
    const historyCount = await historyCollection.countDocuments();
    console.log(`   Jami tarix yozuvlari: ${historyCount} ta\n`);
    
    if (historyCount > 0) {
      // Type bo'yicha statistika
      const typeStats = await historyCollection.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      console.log('   Type bo\'yicha statistika:');
      typeStats.forEach((stat: any) => {
        console.log(`   - ${stat._id}: ${stat.count} ta`);
      });
      console.log('');
      
      // Oxirgi 10 ta tarix yozuvi
      const recentHistory = await historyCollection
        .find()
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();
      
      console.log('   Oxirgi 10 ta tarix yozuvi:');
      recentHistory.forEach((h: any, i) => {
        const date = new Date(h.timestamp || h.createdAt).toLocaleString('uz-UZ');
        console.log(`   ${i + 1}. [${h.type}] ${h.productName} (${h.sku}) - ${date}`);
      });
      console.log('');
    }
    
    // 3. Users collection
    console.log('👥 USERS COLLECTION:');
    const usersCollection = db.collection('users');
    const usersCount = await usersCollection.countDocuments();
    console.log(`   Jami foydalanuvchilar: ${usersCount} ta\n`);
    
    if (usersCount > 0) {
      const users = await usersCollection.find().toArray();
      console.log('   Foydalanuvchilar:');
      users.forEach((u: any, i) => {
        console.log(`   ${i + 1}. ${u.name} (${u.phone}) - Role: ${u.role || 'N/A'}`);
        console.log(`      ID: ${u._id}`);
      });
      console.log('');
    }
    
    // 4. Barcha collections ro'yxati
    console.log('📚 BARCHA COLLECTIONS:');
    const collections = await db.listCollections().toArray();
    console.log(`   Jami: ${collections.length} ta\n`);
    collections.forEach((c: any, i) => {
      console.log(`   ${i + 1}. ${c.name}`);
    });
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
