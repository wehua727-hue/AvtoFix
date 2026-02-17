/**
 * Telefon raqami bo'yicha userId topish
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'avtofix';
const USERS_COLLECTION = 'users';

async function main() {
  const phone = '914058481'; // ✅ Yangi telefon raqami
  
  console.log('========================================');
  console.log('Foydalanuvchi ID Topish');
  console.log('========================================\n');
  console.log(`📞 Telefon: ${phone}\n`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');

    const db = client.db(DB_NAME);
    const usersCollection = db.collection(USERS_COLLECTION);

    // Telefon raqami bo'yicha qidirish
    const user = await usersCollection.findOne({
      $or: [
        { phone: phone },
        { phone: `+998${phone}` },
        { phone: `998${phone}` },
        { username: phone }
      ]
    });

    if (!user) {
      console.log('❌ Foydalanuvchi topilmadi!\n');
      console.log('💡 Barcha foydalanuvchilarni ko\'rish:\n');
      
      const allUsers = await usersCollection.find().limit(10).toArray();
      allUsers.forEach((u: any) => {
        console.log(`   - ${u.phone || u.username} (ID: ${u._id})`);
      });
      
      return;
    }

    console.log('✅ Foydalanuvchi topildi!\n');
    console.log(`   Telefon: ${user.phone || user.username}`);
    console.log(`   Ism: ${user.name || 'N/A'}`);
    console.log(`   Role: ${user.role || 'N/A'}`);
    console.log(`   ID: ${user._id}\n`);

    // Mahsulotlar sonini tekshirish
    const productsCollection = db.collection('products');
    const productsCount = await productsCollection.countDocuments({ userId: user._id.toString() });
    console.log(`📦 Mahsulotlar: ${productsCount} ta\n`);

    // History tekshirish
    const historyCollection = db.collection('product_history');
    const historyCount = await historyCollection.countDocuments({ userId: user._id.toString() });
    console.log(`📊 History: ${historyCount} ta\n`);

    if (historyCount > 0) {
      console.log('✅ History bor - mahsulotlarni qaytarish mumkin!\n');
      
      // O'chirilgan mahsulotlar
      const deletedCount = await historyCollection.countDocuments({ 
        userId: user._id.toString(), 
        type: 'delete' 
      });
      console.log(`🗑️  O'chirilgan mahsulotlar: ${deletedCount} ta\n`);
      
      if (deletedCount > 0) {
        console.log('📝 Qaytarish uchun scriptni yangilang:\n');
        console.log(`   const USER_ID = '${user._id}';\n`);
      }
    } else {
      console.log('❌ History bo\'sh - mahsulotlarni qaytarib bo\'lmaydi\n');
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
