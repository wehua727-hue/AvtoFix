/**
 * MongoDB Data Checker
 * Проверяет подключение к MongoDB и выводит статистику по коллекциям
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load config
let config = {};
const configPath = path.join(__dirname, 'electron', 'config.json');

try {
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
    console.log('✅ Config loaded from electron/config.json');
  } else {
    console.log('⚠️  electron/config.json not found');
    console.log('   Create it from electron/config.example.json');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ Error loading config:', e.message);
  process.exit(1);
}

const MONGODB_URI = config.MONGODB_URI;
const DB_NAME = config.DB_NAME || 'oflayn-dokon';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not configured in config.json');
  process.exit(1);
}

async function checkData() {
  console.log('\n🔌 Connecting to MongoDB...');
  console.log('   Database:', DB_NAME);
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collections = ['products', 'categories', 'stores', 'users', 'customers', 'orders', 'debts'];
    
    console.log('📊 Collection Statistics:');
    console.log('─'.repeat(50));
    
    let totalDocs = 0;
    
    for (const collName of collections) {
      try {
        const collection = db.collection(collName);
        const count = await collection.countDocuments();
        totalDocs += count;
        
        const icon = count > 0 ? '✅' : '⚠️';
        console.log(`${icon} ${collName.padEnd(15)} : ${count} documents`);
        
        // Show sample data for non-empty collections
        if (count > 0 && count <= 5) {
          const samples = await collection.find({}).limit(2).toArray();
          samples.forEach((doc, i) => {
            const preview = JSON.stringify(doc).substring(0, 80);
            console.log(`   └─ Sample ${i + 1}: ${preview}...`);
          });
        }
      } catch (e) {
        console.log(`❌ ${collName.padEnd(15)} : Error - ${e.message}`);
      }
    }
    
    console.log('─'.repeat(50));
    console.log(`📈 Total: ${totalDocs} documents\n`);
    
    // Summary
    if (totalDocs === 0) {
      console.log('⚠️  Database is empty!');
      console.log('   You may need to add test data or sync from production.');
    } else {
      console.log('✅ Database has data and is ready for use.');
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check MONGODB_URI in electron/config.json');
    console.log('   2. Verify your IP is whitelisted in MongoDB Atlas');
    console.log('   3. Check internet connection');
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkData();
