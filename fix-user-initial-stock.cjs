/**
 * Fix missing initialStock for user-specific products
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
    process.exit(1);
  }
} catch (e) {
  console.error('❌ Error loading config:', e.message);
  process.exit(1);
}

const MONGODB_URI = config.MONGODB_URI;
const DB_NAME = config.DB_NAME || 'oflayn-dokon';

async function fixUserInitialStock() {
  console.log('\n🔌 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected successfully!\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    // MUHIM: Hozirgi foydalanuvchi ID sini ishlatish
    const currentUserId = '694a8cf599adb50cf1248e50'; // Loglardan olingan haqiqiy userId
    const oldUserId = '693d2d63ba2fae9ff378c33a'; // Avval fix qilgan userId
    
    console.log('🔍 Fixing initialStock for CURRENT user:', currentUserId);
    console.log('🔍 Previously fixed user:', oldUserId);
    
    // Find user products without initialStock
    const productsWithoutInitialStock = await collection.find({
      userId: currentUserId,
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: 0 }
      ]
    }).toArray();
    
    console.log(`📦 Found ${productsWithoutInitialStock.length} products without initialStock for current user`);
    
    if (productsWithoutInitialStock.length === 0) {
      console.log('✅ All current user products already have initialStock values');
      
      // Check if there are any products for this user at all
      const totalUserProducts = await collection.countDocuments({ userId: currentUserId });
      console.log(`📦 Total products for current user: ${totalUserProducts}`);
      
      if (totalUserProducts === 0) {
        console.log('⚠️  No products found for current user. Checking all users...');
        
        // Show all unique userIds
        const allUserIds = await collection.distinct('userId');
        console.log('👥 All user IDs in database:', allUserIds);
      }
      
      return;
    }
    
    console.log('\n🔧 Fixing initialStock values...');
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const product of productsWithoutInitialStock) {
      const currentStock = product.stock ?? 0;
      
      // Set initialStock = current stock (assuming no sales have been made yet)
      // For products that have been sold, this might not be accurate, but it's the best we can do
      const initialStock = Math.max(currentStock, 1); // At least 1 to enable refund validation
      
      try {
        const result = await collection.updateOne(
          { _id: product._id },
          { 
            $set: { 
              initialStock: initialStock,
              updatedAt: new Date()
            } 
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`✅ Fixed: SKU "${product.sku}" | Name: ${product.name} | Stock: ${currentStock} → InitialStock: ${initialStock}`);
          fixedCount++;
        } else {
          console.log(`⚠️  Skipped: SKU "${product.sku}" | Name: ${product.name} (no changes made)`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error fixing SKU "${product.sku}":`, error.message);
        skippedCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Fixed: ${fixedCount} products`);
    console.log(`⚠️  Skipped: ${skippedCount} products`);
    
    // Verify the fix for current user
    console.log('\n🔍 Verifying fix for current user...');
    const stillMissingCurrent = await collection.countDocuments({
      userId: currentUserId,
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: 0 }
      ]
    });
    
    console.log(`📦 Current user products still missing initialStock: ${stillMissingCurrent}`);
    
    if (stillMissingCurrent === 0) {
      console.log('🎉 All current user products now have initialStock values!');
      console.log('🔄 Refund validation should now work properly.');
    } else {
      console.log('⚠️  Some current user products still need fixing.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixUserInitialStock().catch(console.error);