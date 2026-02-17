/**
 * Database va collection'larni topish
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

async function main() {
  console.log('========================================');
  console.log('Database va Collection\'larni Topish');
  console.log('========================================\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');
    console.log(`📍 URI: ${MONGO_URI}\n`);

    // Barcha database'larni ko'rsatish
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();

    console.log('📊 Mavjud Database\'lar:\n');
    for (const db of dbs.databases) {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    }

    console.log('\n========================================\n');

    // Har bir database'dagi collection'larni ko'rsatish
    for (const dbInfo of dbs.databases) {
      if (dbInfo.name === 'admin' || dbInfo.name === 'config' || dbInfo.name === 'local') {
        continue; // System database'larni o'tkazib yuborish
      }

      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();

      console.log(`📁 Database: ${dbInfo.name}`);
      console.log(`   Collection'lar (${collections.length} ta):\n`);

      for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`   - ${coll.name} (${count} ta document)`);

        // Agar product_history bo'lsa, batafsil ma'lumot
        if (coll.name.toLowerCase().includes('history')) {
          console.log(`     🔍 History topildi!`);
          
          // Birinchi documentni ko'rsatish
          const sample = await db.collection(coll.name).findOne();
          if (sample) {
            console.log(`     📄 Namuna document:`);
            console.log(`        userId: ${sample.userId || 'N/A'}`);
            console.log(`        type: ${sample.type || 'N/A'}`);
            console.log(`        productName: ${sample.productName || 'N/A'}`);
            console.log(`        createdAt: ${sample.createdAt || 'N/A'}`);
          }
        }
      }

      console.log('');
    }

    console.log('========================================');
    console.log('✅ Tekshirish tugadi');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
