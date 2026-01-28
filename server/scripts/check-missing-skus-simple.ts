import { MongoClient } from 'mongodb';

async function checkMissingSkus() {
  // MongoDB connection
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/avtofix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== SKU 562-567 TEKSHIRUVI ===');
    
    // 562-567 oralig'idagi SKU larni tekshirish
    for (let sku = 562; sku <= 567; sku++) {
      const skuStr = sku.toString();
      
      // Asosiy mahsulotlarda qidirish
      const mainProduct = await collection.findOne({
        userId: userId,
        sku: skuStr
      });
      
      // Variant SKU larda qidirish
      const variantProduct = await collection.findOne({
        userId: userId,
        'variantSummaries.sku': skuStr
      });
      
      if (mainProduct) {
        console.log(`✓ SKU ${sku}: ASOSIY mahsulot - "${mainProduct.name}"`);
      } else if (variantProduct) {
        const variant = variantProduct.variantSummaries?.find((v: any) => v.sku === skuStr);
        console.log(`✓ SKU ${sku}: VARIANT - "${variantProduct.name}" > "${variant?.name}"`);
      } else {
        console.log(`✗ SKU ${sku}: TOPILMADI!`);
      }
    }
    
    // Duplicate SKU larni tekshirish
    console.log('\n=== DUPLICATE SKU TEKSHIRUVI ===');
    
    const duplicates = await collection.aggregate([
      { $match: { userId: userId } },
      { $group: { 
          _id: '$sku', 
          count: { $sum: 1 },
          products: { $push: { id: '$_id', name: '$name' } }
        }
      },
      { $match: { count: { $gt: 1 }, _id: { $ne: null, $ne: '' } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    if (duplicates.length > 0) {
      console.log('DUPLICATE SKU LAR:');
      duplicates.forEach(dup => {
        console.log(`SKU "${dup._id}": ${dup.count} marta`);
      });
    } else {
      console.log('Duplicate SKU lar yo\'q ✓');
    }
    
    // Jami mahsulotlar soni
    const totalProducts = await collection.countDocuments({ userId: userId });
    console.log(`\nJami mahsulotlar: ${totalProducts}`);
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
  }
}

checkMissingSkus();