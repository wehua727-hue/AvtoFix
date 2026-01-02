/**
 * Product History Checker
 * Tarix kolleksiyasini tekshirish
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'oflayn-dokon';

if (!MONGODB_URI) {
  console.log('⚠️  MONGODB_URI not found in .env');
  process.exit(1);
}

async function checkHistory() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('product_history');
    
    const count = await collection.countDocuments();
    console.log(`📊 product_history: ${count} documents\n`);
    
    // Oxirgi 5 ta tarixni ko'rsatish
    const history = await collection.find({}).sort({ timestamp: -1 }).limit(5).toArray();
    
    console.log('📋 Oxirgi 5 ta tarix:');
    console.log('─'.repeat(60));
    
    history.forEach((h, i) => {
      console.log(`\n${i + 1}. ${h.productName} (${h.type})`);
      console.log(`   ID: ${h._id}`);
      console.log(`   SKU: ${h.sku || '-'}`);
      console.log(`   Stock: ${h.stock}`);
      console.log(`   Variants: ${h.variants ? h.variants.length : 0}`);
      if (h.variants && h.variants.length > 0) {
        console.log(`   Variants data:`, JSON.stringify(h.variants, null, 2));
      }
      console.log(`   Timestamp: ${h.timestamp}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

checkHistory();
