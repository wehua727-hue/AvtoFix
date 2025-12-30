/**
 * Check user-specific data in MongoDB
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load config
const configPath = path.join(__dirname, 'electron', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const MONGODB_URI = config.MONGODB_URI;
const DB_NAME = config.DB_NAME || 'avtofix';

async function checkUserData() {
  console.log('🔌 Connecting to MongoDB...');
  
  await mongoose.connect(MONGODB_URI, {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: 10000,
  });
  
  console.log('✅ Connected to:', DB_NAME);
  
  const db = mongoose.connection.db;
  
  // Check users
  console.log('\n👥 USERS:');
  const users = await db.collection('users').find({}).toArray();
  users.forEach(u => {
    console.log(`  - ID: ${u._id}, Name: ${u.name}, Phone: ${u.phone}`);
  });
  
  // Check debts
  console.log('\n💰 DEBTS:');
  const debts = await db.collection('debts').find({}).toArray();
  if (debts.length === 0) {
    console.log('  No debts found');
  } else {
    debts.forEach(d => {
      console.log(`  - ID: ${d._id}, Creditor: ${d.creditor}, Amount: ${d.amount}, UserId: ${d.userId}`);
    });
  }
  
  // Check customers
  console.log('\n🧑‍🤝‍🧑 CUSTOMERS:');
  const customers = await db.collection('customers').find({}).toArray();
  if (customers.length === 0) {
    console.log('  No customers found');
  } else {
    customers.forEach(c => {
      console.log(`  - ID: ${c._id}, Name: ${c.firstName} ${c.lastName}, UserId: ${c.userId}`);
    });
  }
  
  await mongoose.disconnect();
  console.log('\n✅ Done');
}

checkUserData().catch(console.error);
