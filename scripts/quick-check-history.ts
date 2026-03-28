/**
 * Tezkor history tekshiruvi
 * Bu script database'da history mavjudligini tekshiradi
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'avtofix'; // ✅ Database nomi o'zgartirildi
const PRODUCT_HISTORY_COLLECTION = 'product_history';
const USER_ID = '697b239b498334c61c7c1096'; // ✅ 910712828 uchun yangi ID

async function main() {
  console.log('========================================');
  console.log('History Tekshiruvi');
  console.log('========================================\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');

    const db = client.db(DB_NAME);
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);

    // Jami history soni
    const totalHistory = await historyCollection.countDocuments({ userId: USER_ID });
    console.log(`📊 Jami history: ${totalHistory} ta\n`);

    if (totalHistory === 0) {
      console.log('❌ History bo\'sh!');
      console.log('\n💡 Bu degani:');
      console.log('   1. Backend eski kod ishlagan (history logging yo\'q edi)');
      console.log('   2. O\'chirilgan mahsulotlar history ga saqlanmagan');
      console.log('   3. Mahsulotlarni qaytarib bo\'lmaydi (backup yo\'q)\n');
      console.log('🔧 Yechim:');
      console.log('   1. Backend kodini yangilash (DEPLOY.md ga qarang)');
      console.log('   2. Keyingi o\'chirishlar history ga yoziladi');
      console.log('   3. Eski mahsulotlarni qaytarib bo\'lmaydi\n');
      return;
    }

    // O'chirilgan mahsulotlar soni
    const deletedCount = await historyCollection.countDocuments({ 
      userId: USER_ID, 
      type: 'delete' 
    });
    console.log(`🗑️  O'chirilgan mahsulotlar: ${deletedCount} ta\n`);

    if (deletedCount === 0) {
      console.log('❌ O\'chirilgan mahsulotlar yo\'q!');
      console.log('\n💡 Bu degani:');
      console.log('   1. Hech qanday mahsulot o\'chirilmagan');
      console.log('   2. Yoki o\'chirilgan mahsulotlar history ga yozilmagan\n');
      return;
    }

    // Oxirgi 10 ta o'chirilgan mahsulot
    console.log('📋 Oxirgi 10 ta o\'chirilgan mahsulot:\n');
    const recentDeleted = await historyCollection.find({
      userId: USER_ID,
      type: 'delete'
    }).sort({ createdAt: -1 }).limit(10).toArray();

    recentDeleted.forEach((item: any, index: number) => {
      const deletedAt = new Date(item.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
      console.log(`${index + 1}. ${item.productName} (SKU: ${item.sku || 'N/A'})`);
      console.log(`   O'chirilgan: ${deletedAt}`);
      console.log(`   Stock: ${item.stock || 0}, Narx: ${item.price || 0} ${item.currency || 'UZS'}`);
      if (item.variants && item.variants.length > 0) {
        console.log(`   Xillar: ${item.variants.length} ta`);
      }
      console.log('');
    });

    // Kechagi soat 17:00 dagi mahsulotlar
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    const startDate = new Date(`${dateStr}T17:00:00.000Z`);
    const endDate = new Date(`${dateStr}T17:59:59.999Z`);

    const yesterdayCount = await historyCollection.countDocuments({
      userId: USER_ID,
      type: 'delete',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });

    console.log('========================================');
    console.log(`🕐 Kechagi soat 17:00 dagi o'chirilganlar: ${yesterdayCount} ta`);
    console.log('========================================\n');

    if (yesterdayCount > 0) {
      console.log('✅ Mahsulotlarni qaytarish MUMKIN!');
      console.log('\n📝 Qaytarish uchun:');
      console.log('   npx tsx scripts/restore-yesterday-17.ts\n');
    } else {
      console.log('⚠️  Kechagi soat 17:00 da o\'chirilgan mahsulotlar yo\'q');
      console.log('\n💡 Lekin boshqa vaqtdagi mahsulotlarni qaytarish mumkin:');
      console.log('   npx tsx scripts/restore-deleted-products.ts\n');
    }

  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
