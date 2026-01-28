const { MongoClient, ObjectId } = require('mongodb');

async function fixDuplicateSkus() {
  // MongoDB connection
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/avtofix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ MongoDB ga ulandi');
    
    const db = client.db();
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== DUPLICATE SKU LARNI TOPISH VA TUZATISH ===');
    console.log('User ID:', userId);
    
    // 1. Barcha mahsulotlarni olish
    const allProducts = await collection.find({ userId: userId }).toArray();
    console.log(`Jami mahsulotlar: ${allProducts.length}`);
    
    // 2. Barcha ishlatilgan SKU larni yig'ish
    const skuMap = new Map(); // SKU -> [product1, product2, ...]
    const usedSkus = new Set();
    
    allProducts.forEach(product => {
      // Asosiy SKU
      if (product.sku && product.sku.trim()) {
        const sku = product.sku.trim();
        if (!skuMap.has(sku)) {
          skuMap.set(sku, []);
        }
        skuMap.get(sku).push({
          id: product._id,
          name: product.name,
          type: 'main',
          sku: sku
        });
        usedSkus.add(sku);
      }
      
      // Variant SKU lar
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        product.variantSummaries.forEach((variant, index) => {
          if (variant.sku && variant.sku.trim()) {
            const sku = variant.sku.trim();
            if (!skuMap.has(sku)) {
              skuMap.set(sku, []);
            }
            skuMap.get(sku).push({
              id: product._id,
              name: product.name,
              type: 'variant',
              variantIndex: index,
              variantName: variant.name,
              sku: sku
            });
            usedSkus.add(sku);
          }
        });
      }
    });
    
    // 3. Duplicate SKU larni topish
    const duplicates = [];
    for (const [sku, products] of skuMap) {
      if (products.length > 1) {
        duplicates.push({ sku, products });
      }
    }
    
    console.log(`\nDuplicate SKU lar: ${duplicates.length}`);
    
    if (duplicates.length === 0) {
      console.log('✓ Duplicate SKU lar topilmadi');
      
      // 562-567 oralig'ini tekshirish
      console.log('\n=== 562-567 ORALIG\'INI TEKSHIRISH ===');
      const missingSkus = [];
      for (let sku = 562; sku <= 567; sku++) {
        const skuStr = sku.toString();
        if (!usedSkus.has(skuStr)) {
          missingSkus.push(skuStr);
          console.log(`✗ SKU ${sku}: TOPILMADI`);
        } else {
          const products = skuMap.get(skuStr);
          console.log(`✓ SKU ${sku}: "${products[0].name}" (${products[0].type})`);
        }
      }
      
      if (missingSkus.length > 0) {
        console.log(`\n${missingSkus.length} ta SKU yo'qolgan: ${missingSkus.join(', ')}`);
        console.log('Bu SKU lar yaratilmagan yoki o\'chirilgan bo\'lishi mumkin');
      }
      
      await client.close();
      return;
    }
    
    // 4. Har bir duplicate ni tuzatish
    let fixedCount = 0;
    
    for (const dup of duplicates) {
      console.log(`\n--- SKU "${dup.sku}" (${dup.products.length} marta) ---`);
      
      // Birinchi mahsulotni saqlab qolish
      const keepProduct = dup.products[0];
      const fixProducts = dup.products.slice(1);
      
      console.log(`Saqlab qolinadi: "${keepProduct.name}" (${keepProduct.type})`);
      
      // Qolgan mahsulotlarni tuzatish
      for (const product of fixProducts) {
        // Keyingi bo'sh SKU ni topish
        let newSku = 1;
        while (usedSkus.has(newSku.toString())) {
          newSku++;
        }
        
        const newSkuStr = newSku.toString();
        usedSkus.add(newSkuStr);
        
        if (product.type === 'main') {
          // Asosiy mahsulot SKU sini o'zgartirish
          await collection.updateOne(
            { _id: new ObjectId(product.id) },
            { $set: { sku: newSkuStr } }
          );
          console.log(`  "${product.name}" (asosiy) -> SKU: ${newSkuStr}`);
        } else if (product.type === 'variant') {
          // Variant SKU sini o'zgartirish
          const updateField = `variantSummaries.${product.variantIndex}.sku`;
          await collection.updateOne(
            { _id: new ObjectId(product.id) },
            { $set: { [updateField]: newSkuStr } }
          );
          console.log(`  "${product.name}" > "${product.variantName}" (variant) -> SKU: ${newSkuStr}`);
        }
        
        fixedCount++;
      }
    }
    
    console.log(`\n=== TUZATISH YAKUNLANDI ===`);
    console.log(`${fixedCount} ta mahsulot tuzatildi`);
    
    // 5. Natijani tekshirish
    console.log('\n=== TEKSHIRISH ===');
    
    // Duplicate tekshiruvi
    const newDuplicates = await collection.aggregate([
      { $match: { userId: userId } },
      { $group: { 
          _id: '$sku', 
          count: { $sum: 1 },
          products: { $push: { id: '$_id', name: '$name' } }
        }
      },
      { $match: { count: { $gt: 1 }, _id: { $ne: null, $ne: '' } } }
    ]).toArray();
    
    if (newDuplicates.length === 0) {
      console.log('✓ Duplicate SKU lar yo\'q');
    } else {
      console.log(`✗ Hali ham ${newDuplicates.length} ta duplicate bor`);
    }
    
    // 562-567 oralig'ini tekshirish
    console.log('\n=== 562-567 OXIRGI TEKSHIRUV ===');
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
        const isVariant = product.sku !== skuStr;
        const type = isVariant ? 'variant' : 'asosiy';
        console.log(`✓ SKU ${sku}: "${product.name}" (${type})`);
      } else {
        console.log(`✗ SKU ${sku}: hali ham topilmadi`);
      }
    }
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
    console.log('✓ MongoDB ulanishi yopildi');
  }
}

// Script ni ishga tushirish
fixDuplicateSkus().catch(console.error);