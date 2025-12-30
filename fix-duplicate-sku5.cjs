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

async function fixDuplicateSKU5() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('products');
    
    console.log('\n🔧 FIXING DUPLICATE SKU "5" ISSUE');
    console.log('=' .repeat(50));
    
    // Find all products with SKU "5"
    const duplicates = await collection.find({ sku: '5' }).toArray();
    console.log(`\nFound ${duplicates.length} products with SKU "5":`);
    
    duplicates.forEach((product, i) => {
      console.log(`\n${i + 1}. ${product.name}`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   Created: ${product.createdAt}`);
    });
    
    if (duplicates.length > 1) {
      console.log(`\n🎯 FIXING STRATEGY:`);
      console.log(`1. Keep the newer product: "Бачок ГЦС в сборе"`);
      console.log(`2. Change SKU of older product: "Javohir" → "5_old"`);
      
      // Find the older product (Javohir)
      const olderProduct = duplicates.find(p => p.name === 'Javohir');
      const newerProduct = duplicates.find(p => p.name === 'Бачок ГЦС в сборе');
      
      if (olderProduct && newerProduct) {
        console.log(`\n🔄 Updating older product SKU...`);
        
        const updateResult = await collection.updateOne(
          { _id: olderProduct._id },
          { 
            $set: { 
              sku: '5_old',
              updatedAt: new Date()
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`✅ Updated "${olderProduct.name}" SKU: "5" → "5_old"`);
          
          // Verify the fix
          console.log(`\n🔍 Verification:`);
          const verifyDuplicates = await collection.find({ sku: '5' }).toArray();
          console.log(`Products with SKU "5" after fix: ${verifyDuplicates.length}`);
          
          if (verifyDuplicates.length === 1) {
            const remainingProduct = verifyDuplicates[0];
            console.log(`✅ Only one product remains with SKU "5":`);
            console.log(`   Name: ${remainingProduct.name}`);
            console.log(`   Stock: ${remainingProduct.stock}`);
            console.log(`   This should fix the search confusion!`);
          } else {
            console.log(`❌ Still have ${verifyDuplicates.length} products with SKU "5"`);
          }
          
          // Check the renamed product
          const renamedProduct = await collection.findOne({ _id: olderProduct._id });
          console.log(`\n📦 Renamed product:`);
          console.log(`   Name: ${renamedProduct.name}`);
          console.log(`   New SKU: ${renamedProduct.sku}`);
          console.log(`   Stock: ${renamedProduct.stock}`);
          
        } else {
          console.log(`❌ Failed to update older product SKU`);
        }
      } else {
        console.log(`❌ Could not identify older/newer products`);
      }
    } else {
      console.log(`✅ No duplicate SKU issue found`);
    }
    
    console.log(`\n📊 EXPECTED RESULT:`);
    console.log(`After this fix:`);
    console.log(`- SKU "5" will only return "Бачок ГЦС в сборе" (stock=0)`);
    console.log(`- SKU "5_old" will return "Javohir" (stock=5)`);
    console.log(`- No more search confusion`);
    console.log(`- Stock reversion should be fixed`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔌 Disconnected from MongoDB');
    await client.close();
  }
}

fixDuplicateSKU5().catch(console.error);