import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

async function dropOldIndexes() {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME?.trim() || 'avtofix';
    
    if (!uri) {
      console.error('[dropOldIndexes] MONGODB_URI is not set');
      process.exit(1);
    }
    
    console.log('[dropOldIndexes] Connecting to MongoDB...');
    console.log('[dropOldIndexes] URI:', uri.substring(0, 20) + '...');
    console.log('[dropOldIndexes] DB Name:', dbName);
    
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      dbName,
    });
    
    console.log('[dropOldIndexes] Connected successfully!');
    const db = conn.connection.db;
    const productsCollection = process.env.OFFLINE_PRODUCTS_COLLECTION || 'products';
    
    console.log(`[dropOldIndexes] Working with collection: ${productsCollection}`);
    
    // List all indexes
    const indexes = await db.collection(productsCollection).indexes();
    console.log('[dropOldIndexes] Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Drop productCode_1 index if exists
    try {
      await db.collection(productsCollection).dropIndex('productCode_1');
      console.log('[dropOldIndexes] Successfully dropped productCode_1 index');
    } catch (err: any) {
      if (err?.code === 27 || err?.message?.includes('index not found')) {
        console.log('[dropOldIndexes] productCode_1 index does not exist (already dropped)');
      } else {
        console.error('[dropOldIndexes] Error dropping productCode_1:', err?.message);
      }
    }
    
    // Drop store_1_productCode_1 compound index if exists
    try {
      await db.collection(productsCollection).dropIndex('store_1_productCode_1');
      console.log('[dropOldIndexes] Successfully dropped store_1_productCode_1 index');
    } catch (err: any) {
      if (err?.code === 27 || err?.message?.includes('index not found')) {
        console.log('[dropOldIndexes] store_1_productCode_1 index does not exist (already dropped)');
      } else {
        console.error('[dropOldIndexes] Error dropping store_1_productCode_1:', err?.message);
      }
    }
    
    // Also check main products collection
    try {
      await db.collection('products').dropIndex('productCode_1');
      console.log('[dropOldIndexes] Successfully dropped productCode_1 index from main products collection');
    } catch (err: any) {
      if (err?.code === 27 || err?.message?.includes('index not found')) {
        console.log('[dropOldIndexes] productCode_1 index does not exist in main products collection');
      } else {
        console.error('[dropOldIndexes] Error dropping productCode_1 from main products:', err?.message);
      }
    }
    
    // Drop store_1_productCode_1 from main products collection
    try {
      await db.collection('products').dropIndex('store_1_productCode_1');
      console.log('[dropOldIndexes] Successfully dropped store_1_productCode_1 index from main products collection');
    } catch (err: any) {
      if (err?.code === 27 || err?.message?.includes('index not found')) {
        console.log('[dropOldIndexes] store_1_productCode_1 index does not exist in main products collection');
      } else {
        console.error('[dropOldIndexes] Error dropping store_1_productCode_1 from main products:', err?.message);
      }
    }
    
    // List indexes after dropping
    const indexesAfter = await db.collection(productsCollection).indexes();
    console.log('[dropOldIndexes] Indexes after cleanup:', JSON.stringify(indexesAfter, null, 2));
    
    console.log('[dropOldIndexes] Done!');
    process.exit(0);
  } catch (error) {
    console.error('[dropOldIndexes] Fatal error:', error);
    process.exit(1);
  }
}

dropOldIndexes();
