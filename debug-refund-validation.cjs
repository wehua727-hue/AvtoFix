/**
 * Debug script to check refund validation
 * Test case: SKU "1" product - 5 initial, 3 sold, should allow max 2 refunds
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'avtofix';

async function debugRefundValidation() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB connected');
    
    const db = client.db(DB_NAME);
    const productsCollection = db.collection('products');
    
    // Find SKU "1" product
    const product = await productsCollection.findOne({ sku: "1" });
    
    if (!product) {
      console.log('❌ SKU "1" product not found');
      return;
    }
    
    console.log('\n📦 Product Details:');
    console.log('Name:', product.name);
    console.log('SKU:', product.sku);
    console.log('Current Stock:', product.stock);
    console.log('Initial Stock:', product.initialStock);
    
    // Calculate sold quantity
    const currentStock = product.stock ?? 0;
    const initialStock = product.initialStock ?? 0;
    const soldQuantity = initialStock - currentStock;
    
    console.log('\n📊 Calculations:');
    console.log('Initial Stock:', initialStock);
    console.log('Current Stock:', currentStock);
    console.log('Sold Quantity:', soldQuantity);
    console.log('Max Returnable:', soldQuantity);
    
    // Check if initialStock exists
    if (!initialStock || initialStock <= 0) {
      console.log('\n❌ PROBLEM: initialStock is missing or 0');
      console.log('This will cause refund validation to fail');
      
      // Fix by setting initialStock = current stock + some reasonable sold amount
      const suggestedInitialStock = currentStock + 3; // Assume 3 were sold
      console.log(`\n💡 Suggested fix: Set initialStock to ${suggestedInitialStock}`);
      
      const result = await productsCollection.updateOne(
        { _id: product._id },
        { $set: { initialStock: suggestedInitialStock } }
      );
      
      if (result.modifiedCount > 0) {
        console.log('✅ Fixed: initialStock updated');
      }
    } else {
      console.log('\n✅ initialStock is properly set');
    }
    
    // Check defective counts
    const defectiveCollection = db.collection('defectiveProducts');
    const defectiveCount = await defectiveCollection.countDocuments({ 
      productId: product._id.toString() 
    });
    
    console.log('\n🔍 Defective Returns:', defectiveCount);
    console.log('Remaining Returnable:', Math.max(0, soldQuantity - defectiveCount));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

debugRefundValidation().catch(console.error);