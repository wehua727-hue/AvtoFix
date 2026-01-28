import { MongoClient, ObjectId } from 'mongodb';

async function fixMissingSkus() {
  // MongoDB connection
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/avtofix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== DUPLICATE SKU LARNI TOPISH VA TUZATISH ===');
    
    // 1. Duplicate SKU larni topish
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
    
    if (duplicates.length === 0) {
      console.log('Duplicate SKU lar topilmadi');
      
      // 562-567 oralig'ini tekshirish
      console.log('\n=== 562-567 ORALIG\'INI TEKSHIRISH ===');
      for (let sku = 562; sku <= 567; sku++) {
        const skuStr = sku.toString();
        const product = await collection.findOne({
          userId: userId,
          $or: [
            { sku: skuStr },
            { 'variantSummaries.sku': skuStr }
          ]
        });
        
        if (!product) {
          console.log(`SKU ${sku} topilmadi - yaratish kerak`);
          
          // Eng katta SKU ni topish
          const maxSkuProduct = await collection.findOne(
            { userId: userId, sku: { $regex: /^\d+$/ } },
            { sort: { sku: -1 } }
          );
          
          const maxSku = maxSkuProduct ? parseInt(maxSkuProduct.sku) : 0;
          const nextSku = Math.max(maxSku + 1, 568); // 568 dan boshlaymiz
          
          console.log(`  Keyingi mavjud SKU: ${nextSku}`);
        } else {
          console.log(`✓ SKU ${sku} mavjud: "${product.name}"`);
        }
      }
      
      await client.close();
      return;
    }
    
    console.log(`${duplicates.length} ta duplicate SKU topildi:`);
    
    // 2. Har bir duplicate ni tuzatish
    for (const dup of duplicates) {
      console.log(`\n--- SKU "${dup._id}" (${dup.count} marta) ---`);
      
      // Birinchi mahsulotni saqlab qolish, qolganlarini o'zgartirish
      const productsToFix = dup.products.slice(1); // Birinchisidan tashqari hammasi
      
      console.log(`Saqlab qolinadi: "${dup.products[0].name}"`);
      
      for (let i = 0; i < productsToFix.length; i++) {
        const product = productsToFix[i];
        
        // Keyingi mavjud SKU ni topish
        const allProducts = await collection.find({ userId: userId }).toArray();
        const usedSkus = new Set();
        
        // Barcha ishlatilgan SKU larni yig'ish
        allProducts.forEach(p => {
          if (p.sku) usedSkus.add(p.sku);
          if (p.variantSummaries) {
            p.variantSummaries.forEach((v: any) => {
              if (v.sku) usedSkus.add(v.sku);
            });
          }
        });
        
        // Keyingi bo'sh SKU ni topish
        let newSku = 562; // 562 dan boshlaymiz
        while (usedSkus.has(newSku.toString())) {
          newSku++;
        }
        
        // Mahsulotni yangilash
        await collection.updateOne(
          { _id: new ObjectId(product.id) },
          { $set: { sku: newSku.toString() } }
        );
        
        console.log(`  "${product.name}" -> yangi SKU: ${newSku}`);
      }
    }
    
    console.log('\n=== TUZATISH YAKUNLANDI ===');
    
    // 3. Natijani tekshirish
    console.log('\n=== TEKSHIRISH ===');
    for (let sku = 562; sku <= 567; sku++) {
      const skuStr = sku.toString();
      const product = await collection.findOne({
        userId: userId,
        $or: [
          { sku: skuStr },
          { 'variantSummaries.sku': skuStr }
        ]
      });
      
      if (product) {
        console.log(`✓ SKU ${sku}: "${product.name}"`);
      } else {
        console.log(`✗ SKU ${sku}: hali ham topilmadi`);
      }
    }
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
  }
}

fixMissingSkus();