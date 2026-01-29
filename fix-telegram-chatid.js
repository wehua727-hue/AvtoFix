const { MongoClient } = require('mongodb');

async function fixTelegramChatId() {
  const client = new MongoClient('mongodb://localhost:27017/avtofix');
  
  try {
    await client.connect();
    const db = client.db('avtofix');
    const users = db.collection('users');
    
    // User 910712828 uchun telegramChatId qo'shish
    const result = await users.updateOne(
      { phone: '910712828' },
      { $set: { telegramChatId: '123456789' } }
    );
    
    console.log('Updated user:', result.modifiedCount);
    
    // Tekshirish
    const user = await users.findOne({ phone: '910712828' });
    console.log('User after update:', user);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixTelegramChatId();