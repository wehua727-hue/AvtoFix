const { MongoClient } = require('mongodb');
const fs = require('fs');

// Load config
let config;
try {
  const configPath = './electron/config.json';
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Config loaded from electron/config.json');
  } else {
    throw new Error('Config file not found');
  }
} catch (error) {
  console.error('❌ Failed to load config:', error.message);
  process.exit(1);
}

const MONGODB_URI = config.MONGODB_URI;
const DB_NAME = config.DB_NAME;

async function fixAllDuplicateSKUs() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🔍 FINDING ALL DUPLICATE SKUs');
    console.log('=' .repeat(50));
    
    // Find all duplicate SKUs
    const duplicates = await collection.aggregate([
      {
        $match: {
          sku: { $exists: true, $ne: null, $ne: "" }
        }
      },
      {
        $group: {
          _id: "$sku",
          count: { $sum: 1 },
          products: { $push: { id: "$_id", name: "$name", stock: "$stock", createdAt: "$createdAt" } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).toArray();
    
    console.log(`\nFound ${duplicates.length} duplicate SKUs:`);
    
    let fixedCount = 0;
    
    for (const duplicate of duplicates) {
      const sku = duplicate._id;
      const products = duplicate.products;
      
      console.log(`\n📦 SKU "${sku}" (${products.length} products):`);
      products.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} - Stock: ${p.stock} - Created: ${new Date(p.createdAt).toLocaleDateString()}`);
      });
      
      // Keep the newest product, rename others
      const sortedProducts = products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const newestProduct = sortedProducts[0];
      const olderProducts = sortedProducts.slice(1);
      
      console.log(`   ✅ Keeping: ${newestProduct.name} (newest)`);
      
      for (let i = 0; i < olderProducts.length; i++) {
        const oldProduct = olderProducts[i];
        const newSKU = `${sku}_old${i + 1}`;
        
        console.log(`   🔄 Renaming: ${oldProduct.name} → SKU "${newSKU}"`);
        
        const updateResult = await collection.updateOne(
          { _id: oldProduct.id },
          { 
            $set: { 
              sku: newSKU,
              updatedAt: new Date()
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`   ✅ Updated successfully`);
          fixedCount++;
        } else {
          console.log(`   ❌ Failed to update`);
        }
      }
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`- Found ${duplicates.length} duplicate SKUs`);
    console.log(`- Fixed ${fixedCount} products`);
    console.log(`- Each SKU now has only one product`);
    
    // Verify the fix
    console.log(`\n🔍 VERIFICATION:`);
    const remainingDuplicates = await collection.aggregate([
      {
        $match: {
          sku: { $exists: true, $ne: null, $ne: "" }
        }
      },
      {
        $group: {
          _id: "$sku",
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();
    
    if (remainingDuplicates.length === 0) {
      console.log(`✅ SUCCESS: No duplicate SKUs remaining!`);
      console.log(`✅ Stock reversion issue should be completely fixed!`);
    } else {
      console.log(`❌ Still have ${remainingDuplicates.length} duplicate SKUs`);
    }
    
    console.log(`\n🎯 WHAT THIS FIXES:`);
    console.log(`- No more search confusion`);
    console.log(`- Each SKU returns exactly one product`);
    console.log(`- Stock updates go to the correct product`);
    console.log(`- No more stock reversion due to wrong product selection`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

fixAllDuplicateSKUs().catch(console.error);