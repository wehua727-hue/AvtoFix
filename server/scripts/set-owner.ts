import 'dotenv/config';
import { connectMongo } from '../mongo';

async function setOwner() {
  try {
    console.log('Connecting to MongoDB...');
    const conn = await connectMongo();
    
    if (!conn?.db) {
      console.error('Database not available');
      process.exit(1);
    }

    const db = conn.db;
    const usersCollection = db.collection('users');

    // Telefon raqam bo'yicha foydalanuvchini topish va egasi qilish
    const result = await usersCollection.updateOne(
      { phone: '910712828' },
      { $set: { role: 'egasi' } }
    );

    if (result.matchedCount === 0) {
      // 998 bilan ham sinab ko'rish
      const result2 = await usersCollection.updateOne(
        { phone: '998910712828' },
        { $set: { role: 'egasi' } }
      );
      
      if (result2.matchedCount === 0) {
        console.log('Foydalanuvchi topilmadi. Mavjud foydalanuvchilar:');
        const users = await usersCollection.find({}).toArray();
        users.forEach(u => console.log(`- ${u.phone} (${u.name}) - ${u.role}`));
      } else {
        console.log('✅ Foydalanuvchi egasi qilindi (998910712828)');
      }
    } else {
      console.log('✅ Foydalanuvchi egasi qilindi (910712828)');
    }

    process.exit(0);
  } catch (error) {
    console.error('Xatolik:', error);
    process.exit(1);
  }
}

setOwner();
