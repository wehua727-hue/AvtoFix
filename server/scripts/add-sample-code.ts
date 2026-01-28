/**
 * Test uchun bitta mahsulotga 5 talik kod qo'shish
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/avtofix';

async function addSampleCode() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('[Add Sample Code] Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('products');
    
    // Birinchi mahsulotni topish va unga kod qo'shish
    const firstProduct = await collection.findOne({});
    
    if (firstProduct) {
      const result = await collection.updateOne(
        { _id: firstProduct._id },
        { $set: { code: '34485' } }
      );
      
      console.log(`[Add Sample Code] Updated product "${firstProduct.name}" with code 34485`);
      console.log(`[Add Sample Code] Product ID: ${firstProduct._id}`);
      console.log(`[Add Sample Code] Product SKU: ${firstProduct.sku}`);
    } else {
      console.log('[Add Sample Code] No products found');
    }
    
  } catch (error) {
    console.error('[Add Sample Code] Error:', error);
  } finally {
    await client.close();
  }
}

// Script ni ishga tushirish
addSampleCode();