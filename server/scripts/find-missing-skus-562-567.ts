import { connectMongo } from '../mongo';

async function findMissingSkus() {
  const conn = await connectMongo();
  if (!conn || !conn.db) {
    console.error('Database connection failed');
    return;
  }

  const db = conn.db;
  const collection = db.collection('products');
  
  // User ID (910712828 telefon raqami)
  const userId = '6974aea9af7ded62a69472c4';
  
  console.log('=== MISSING SKU ANALYSIS ===');
  console.log('User ID:', userId);
  
  // 562-567 oralig'idagi SKU larni tekshirish
  const missingSkus = [];
  const foundSkus = [];
  
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
    
    if (mainProduct || variantProduct) {
      foundSkus.push({
        sku: skuStr,
        type: mainProduct ? 'main' : 'variant',
        productName: mainProduct?.name || variantProduct?.name,
        productId: mainProduct?._id || variantProduct?._id
      });
    } else {
      missingSkus.push(skuStr);
    }
  }
  
  console.log('\n=== FOUND SKUs ===');
  foundSkus.forEach(item => {
    console.log(`SKU ${item.sku}: ${item.type} - "${item.productName}" (ID: ${item.productId})`);
  });
  
  console.log('\n=== MISSING SKUs ===');
  missingSkus.forEach(sku => {
    console.log(`SKU ${sku}: TOPILMADI`);
  });
  
  // Umumiy statistika
  const totalProducts = await collection.countDocuments({ userId: userId });
  console.log(`\n=== STATISTIKA ===`);
  console.log(`Jami mahsulotlar: ${totalProducts}`);
  console.log(`562-567 oralig'ida topilgan: ${foundSkus.length}`);
  console.log(`562-567 oralig'ida yo'qolgan: ${missingSkus.length}`);
  
  // Duplicate SKU larni tekshirish
  console.log('\n=== DUPLICATE SKU TEKSHIRUVI ===');
  
  const pipeline = [
    { $match: { userId: userId } },
    { $group: { 
        _id: '$sku', 
        count: { $sum: 1 },
        products: { $push: { id: '$_id', name: '$name' } }
      }
    },
    { $match: { count: { $gt: 1 }, _id: { $ne: null, $ne: '' } } },
    { $sort: { _id: 1 } }
  ];
  
  const duplicates = await collection.aggregate(pipeline).toArray();
  
  if (duplicates.length > 0) {
    console.log('DUPLICATE SKU LAR TOPILDI:');
    duplicates.forEach(dup => {
      console.log(`SKU "${dup._id}": ${dup.count} marta ishlatilgan`);
      dup.products.forEach((prod: any, index: number) => {
        console.log(`  ${index + 1}. "${prod.name}" (ID: ${prod.id})`);
      });
    });
  } else {
    console.log('Duplicate SKU lar topilmadi ✓');
  }
  
  // Variant ichidagi duplicate lar
  console.log('\n=== VARIANT DUPLICATE TEKSHIRUVI ===');
  const variantDuplicates = await collection.find({
    userId: userId,
    'variantSummaries.sku': { $exists: true }
  }).toArray();
  
  let variantDupFound = false;
  for (const product of variantDuplicates) {
    if (product.variantSummaries && product.variantSummaries.length > 0) {
      const skuCounts = new Map();
      
      product.variantSummaries.forEach((variant: any) => {
        if (variant.sku) {
          skuCounts.set(variant.sku, (skuCounts.get(variant.sku) || 0) + 1);
        }
      });
      
      for (const [sku, count] of skuCounts) {
        if (count > 1) {
          console.log(`Mahsulot "${product.name}" da variant SKU "${sku}" ${count} marta takrorlangan`);
          variantDupFound = true;
        }
      }
    }
  }
  
  if (!variantDupFound) {
    console.log('Variant ichida duplicate SKU lar topilmadi ✓');
  }
  
  await conn.client.close();
}

findMissingSkus().catch(console.error);