import { MongoClient } from 'mongodb';

async function monitorDuplicates() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== DUPLICATE SKU MONITORING ===');
    console.log('Vaqt:', new Date().toLocaleString());
    
    // 1. Asosiy SKU duplicate lar
    const mainDuplicates = await collection.aggregate([
      { $match: { userId: userId, sku: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { 
          _id: '$sku', 
          count: { $sum: 1 },
          products: { $push: { id: '$_id', name: '$name' } }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    // 2. Variant SKU duplicate lar
    const variantDuplicates = await collection.find({
      userId: userId,
      'variantSummaries.sku': { $exists: true }
    }).toArray();
    
    const variantSkuMap = new Map<string, any[]>();
    
    variantDuplicates.forEach(product => {
      if (product.variantSummaries) {
        product.variantSummaries.forEach((variant: any, index: number) => {
          if (variant.sku && variant.sku.trim()) {
            const sku = variant.sku.trim();
            if (!variantSkuMap.has(sku)) {
              variantSkuMap.set(sku, []);
            }
            variantSkuMap.get(sku)!.push({
              productId: product._id,
              productName: product.name,
              variantIndex: index,
              variantName: variant.name
            });
          }
        });
      }
    });
    
    const variantDups = Array.from(variantSkuMap.entries())
      .filter(([_, products]) => products.length > 1)
      .map(([sku, products]) => ({ sku, products }));
    
    // 3. Asosiy va variant orasida duplicate lar
    const crossDuplicates: Array<{sku: string, main: any[], variants: any[]}> = [];
    
    for (const [sku, variants] of variantSkuMap) {
      const mainProduct = await collection.findOne({
        userId: userId,
        sku: sku
      });
      
      if (mainProduct) {
        crossDuplicates.push({
          sku,
          main: [{ id: mainProduct._id, name: mainProduct.name }],
          variants: variants
        });
      }
    }
    
    // 4. Natijalarni chiqarish
    let hasIssues = false;
    
    if (mainDuplicates.length > 0) {
      hasIssues = true;
      console.log('\n🚨 ASOSIY SKU DUPLICATE LAR:');
      mainDuplicates.forEach(dup => {
        console.log(`  SKU "${dup._id}": ${dup.count} marta`);
        dup.products.forEach((prod: any, index: number) => {
          console.log(`    ${index + 1}. "${prod.name}"`);
        });
      });
    }
    
    if (variantDups.length > 0) {
      hasIssues = true;
      console.log('\n🚨 VARIANT SKU DUPLICATE LAR:');
      variantDups.forEach(dup => {
        console.log(`  SKU "${dup.sku}": ${dup.products.length} marta`);
        dup.products.forEach((prod: any, index: number) => {
          console.log(`    ${index + 1}. "${prod.productName}" > "${prod.variantName}"`);
        });
      });
    }
    
    if (crossDuplicates.length > 0) {
      hasIssues = true;
      console.log('\n🚨 ASOSIY-VARIANT DUPLICATE LAR:');
      crossDuplicates.forEach(dup => {
        console.log(`  SKU "${dup.sku}":`);
        console.log(`    Asosiy: "${dup.main[0].name}"`);
        dup.variants.forEach((variant: any, index: number) => {
          console.log(`    Variant ${index + 1}: "${variant.productName}" > "${variant.variantName}"`);
        });
      });
    }
    
    if (!hasIssues) {
      console.log('✅ Duplicate SKU lar topilmadi');
    }
    
    // 5. Statistika
    const totalProducts = await collection.countDocuments({ userId: userId });
    const productsWithSku = await collection.countDocuments({ 
      userId: userId, 
      sku: { $exists: true, $ne: null, $ne: '' } 
    });
    const productsWithVariants = await collection.countDocuments({ 
      userId: userId, 
      'variantSummaries.0': { $exists: true } 
    });
    
    console.log('\n📊 STATISTIKA:');
    console.log(`  Jami mahsulotlar: ${totalProducts}`);
    console.log(`  SKU li mahsulotlar: ${productsWithSku}`);
    console.log(`  Variant li mahsulotlar: ${productsWithVariants}`);
    console.log(`  Asosiy duplicate lar: ${mainDuplicates.length}`);
    console.log(`  Variant duplicate lar: ${variantDups.length}`);
    console.log(`  Cross duplicate lar: ${crossDuplicates.length}`);
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
  }
}

monitorDuplicates().catch(console.error);