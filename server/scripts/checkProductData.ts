import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

async function checkProductData() {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME?.trim() || 'avtofix';
    
    if (!uri) {
      console.error('[checkProductData] MONGODB_URI is not set');
      process.exit(1);
    }
    
    console.log('[checkProductData] Connecting to MongoDB...');
    
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      dbName,
    });
    
    console.log('[checkProductData] Connected successfully!');
    const db = conn.connection.db;
    const productsCollection = process.env.OFFLINE_PRODUCTS_COLLECTION || 'products';
    
    // Get the latest product
    const latestProduct = await db
      .collection(productsCollection)
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .toArray();
    
    if (latestProduct.length === 0) {
      console.log('[checkProductData] No products found in database');
    } else {
      console.log('[checkProductData] Latest product:');
      console.log(JSON.stringify(latestProduct[0], null, 2));
      
      const product = latestProduct[0];
      console.log('\n[checkProductData] Key fields:');
      console.log('- name:', product.name);
      console.log('- sku:', product.sku);
      console.log('- price:', product.price);
      console.log('- basePrice:', product.basePrice);
      console.log('- priceMultiplier:', product.priceMultiplier);
      console.log('- stock:', product.stock);
    }
    
    await mongoose.disconnect();
    console.log('\n[checkProductData] Done!');
    process.exit(0);
  } catch (error) {
    console.error('[checkProductData] Fatal error:', error);
    process.exit(1);
  }
}

checkProductData();
