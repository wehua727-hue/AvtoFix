import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'avtofix';
const PRODUCTS_COLLECTION = 'products';

async function fixBarcodeIds() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const collection = db.collection(PRODUCTS_COLLECTION);
    
    // Barcha mahsulotlarni olish
    const products = await collection.find({}).toArray();
    console.log(`Found ${products.length} products`);
    
    let updatedCount = 0;
    
    for (const product of products) {
      const productId = product._id.toString();
      const currentBarcodeId = product.barcodeId;
      
      // Agar barcodeId SKU raqami bo'lsa (1-3 xonali raqam), MongoDB ID ga o'zgartirish
      if (!currentBarcodeId || /^\d{1,3}$/.test(currentBarcodeId)) {
        const newBarcodeId = productId.slice(-8).toUpperCase();
        
        await collection.updateOne(
          { _id: product._id },
          { $set: { barcodeId: newBarcodeId } }
        );
        
        console.log(`Updated product ${product.name}: ${currentBarcodeId} -> ${newBarcodeId}`);
        updatedCount++;
      }
      
      // Variantlarni ham tekshirish
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          const currentVariantBarcodeId = variant.barcodeId;
          
          // Agar variant barcodeId SKU raqami bo'lsa, MongoDB ID ga o'zgartirish
          if (!currentVariantBarcodeId || /^\d{1,3}$/.test(currentVariantBarcodeId)) {
            const variantId = `${productId}-v${i}`;
            const newVariantBarcodeId = variantId.slice(-8).toUpperCase();
            
            await collection.updateOne(
              { _id: product._id },
              { $set: { [`variantSummaries.${i}.barcodeId`]: newVariantBarcodeId } }
            );
            
            console.log(`Updated variant ${variant.name}: ${currentVariantBarcodeId} -> ${newVariantBarcodeId}`);
            updatedCount++;
          }
        }
      }
    }
    
    console.log(`\nFixed ${updatedCount} barcodeIds`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

fixBarcodeIds();
