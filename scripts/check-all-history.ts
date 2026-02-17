/**
 * Barcha history ma'lumotlarini ko'rish (userId filtrsiz)
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'avtofix';
const PRODUCT_HISTORY_COLLECTION = 'product_history';

async function main() {
  console.log('========================================');
  console.log('Barcha History Ma\'lumotlarini Ko\'rish');
  console.log('========================================\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');

    const db = client.db(DB_NAME);
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);

    // Jami history soni (userId filtrsiz)
    const totalHistory = await historyCollection.countDocuments();
    console.log(`📊 Jami history (barcha foydalanuvchilar): ${totalHistory} ta\n`);

    if (totalHistory === 0) {
      console.log('❌ product_history collection butunlay bo\'sh!');
      console.log('\n💡 Bu degani:');
      console.log('   1. Hech qanday mahsulot history ga yozilmagan');
      console.log('   2. Backend eski kod ishlagan');
      console.log('   3. Yoki collection yangi yaratilgan\n');
      return;
    }

    // Barcha history'ni ko'rsatish (oxirgi 20 ta)
    console.log('📋 Oxirgi 20 ta history (barcha foydalanuvchilar):\n');
    const allHistory = await historyCollection.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    allHistory.forEach((item: any, index: number) => {
      const createdAt = item.createdAt 
        ? new Date(item.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
        : 'N/A';
      
      console.log(`${index + 1}. ${item.productName || 'N/A'} (SKU: ${item.sku || 'N/A'})`);
      console.log(`   Type: ${item.type || 'N/A'}`);
      console.log(`   UserId: ${item.userId || 'N/A'}`);
      console.log(`   Vaqt: ${createdAt}`);
      console.log(`   Stock: ${item.stock || 0}, Narx: ${item.price || 0} ${item.currency || 'UZS'}`);
      if (item.variants && item.variants.length > 0) {
        console.log(`   Xillar: ${item.variants.length} ta`);
      }
      console.log('');
    });

    // Type bo'yicha statistika
    console.log('========================================');
    console.log('📊 Type bo\'yicha statistika:\n');
    
    const types = await historyCollection.distinct('type');
    for (const type of types) {
      const count = await historyCollection.countDocuments({ type });
      console.log(`   ${type}: ${count} ta`);
    }

    // UserId bo'yicha statistika
    console.log('\n📊 UserId bo\'yicha statistika:\n');
    
    const userIds = await historyCollection.distinct('userId');
    for (const userId of userIds) {
      const count = await historyCollection.countDocuments({ userId });
      console.log(`   ${userId}: ${count} ta`);
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
