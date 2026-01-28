/**
 * MongoDB da mahsulotlarni tekshirish va kod qo'shish
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/avtofix';

async function checkAndAddCodes() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('[Check Codes] Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('products');
    
    // Birinchi 10 ta mahsulotni ko'rish
    const products = await collection.find({}).limit(10).toArray();
    
    console.log(`[Check Codes] Found ${products.length} products (showing first 10):`);
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`${i + 1}. Name: ${product.name}`);
      console.log(`   SKU: ${product.sku || 'N/A'}`);
      console.log(`   Code: ${product.code || 'N/A'}`);
      console.log(`   ID: ${product._id}`);
      
      // Agar SKU 1-5 orasida bo'lsa va code yo'q bo'lsa, kod qo'shish
      const sku = product.sku;
      if (sku && ['1', '2', '3', '4', '5'].includes(sku) && !product.code) {
        const codes = {
          '1': '34485',
          '2': '78945', 
          '3': '12354',
          '4': '56789',
          '5': '98765'
        };
        
        const newCode = codes[sku as keyof typeof codes];
        
        await collection.updateOne(
          { _id: product._id },
          { $set: { code: newCode } }
        );
        
        console.log(`   ✅ Added code ${newCode} to SKU ${sku}`);
      }
      
      console.log('---');
    }
    
    console.log('[Check Codes] Completed');
    
  } catch (error) {
    console.error('[Check Codes] Error:', error);
  } finally {
    await client.close();
  }
}

// Script ni ishga tushirish
checkAndAddCodes();