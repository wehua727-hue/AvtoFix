import { MongoClient } from 'mongodb';

async function findAllDuplicates() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ MongoDB ga ulandi');
    
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== BARCHA SKU LARNI TEKSHIRISH (ASOSIY + VARIANTLAR) ===');
    console.log('User ID:', userId);
    
    // 1. Jami mahsulotlar soni
    const totalProducts = await collection.countDocuments({ userId: userId });
    console.log(`Jami mahsulotlar: ${totalProducts}`);
    
    // 2. Barcha mahsulotlarni olish
    const allProducts = await collection.find({ userId: userId }).toArray();
    
    // 3. Barcha SKU larni yig'ish (asosiy + variantlar)
    const skuMap = new Map();
    let totalSkus = 0;
    
    allProducts.forEach((product: any) => {
      // Asosiy mahsulot SKU si
      if (product.sku && product.sku.trim() !== '') {
        const sku = product.sku.trim();
        totalSkus++;
        
        if (!skuMap.has(sku)) {
          skuMap.set(sku, []);
        }
        skuMap.get(sku).push({
          type: 'ASOSIY',
          productId: product._id,
          productName: product.name,
          sku: sku
        });
      }
      
      // Variant SKU lari
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        product.variantSummaries.forEach((variant: any) => {
          if (variant.sku && variant.sku.trim() !== '') {
            const sku = variant.sku.trim();
            totalSkus++;
            
            if (!skuMap.has(sku)) {
              skuMap.set(sku, []);
            }
            skuMap.get(sku).push({
              type: 'VARIANT',
              productId: product._id,
              productName: product.name,
              variantName: variant.name,
              sku: sku
            });
          }
        });
      }
    });
    
    console.log(`Jami SKU lar: ${totalSkus}`);
    console.log(`Noyob SKU lar: ${skuMap.size}`);
    
    // 4. Duplicate larni topish
    const duplicates = [];
    skuMap.forEach((items, sku) => {
      if (items.length > 1) {
        duplicates.push({ sku, items });
      }
    });
    
    console.log(`\n🚨 DUPLICATE SKU LAR: ${duplicates.length} ta`);
    
    if (duplicates.length > 0) {
      duplicates.forEach((dup: any) => {
        console.log(`\n--- SKU "${dup.sku}": ${dup.items.length} marta takrorlangan ---`);
        dup.items.forEach((item: any, index: number) => {
          if (item.type === 'ASOSIY') {
            console.log(`  ${index + 1}. [ASOSIY] "${item.productName}"`);
          } else {
            console.log(`  ${index + 1}. [VARIANT] "${item.productName}" > "${item.variantName}"`);
          }
          console.log(`     ID: ${item.productId}`);
        });
      });
    } else {
      console.log('✅ Duplicate SKU topilmadi');
    }
    
    // 5. 1813 kodli mahsulotni qidirish
    console.log('\n=== 1813 KODLI MAHSULOT QIDIRUVI ===');
    
    const sku1813Items = skuMap.get('1813');
    if (sku1813Items && sku1813Items.length > 0) {
      console.log(`✓ SKU 1813 topildi: ${sku1813Items.length} ta`);
      sku1813Items.forEach((item: any, index: number) => {
        if (item.type === 'ASOSIY') {
          console.log(`  ${index + 1}. [ASOSIY] "${item.productName}"`);
        } else {
          console.log(`  ${index + 1}. [VARIANT] "${item.productName}" > "${item.variantName}"`);
        }
      });
    } else {
      console.log('❌ SKU 1813 TOPILMADI!');
    }
    
    // 6. Eng katta SKU ni topish
    const numericSkus = Array.from(skuMap.keys())
      .map(sku => parseInt(sku))
      .filter(sku => !isNaN(sku))
      .sort((a, b) => b - a);
    
    console.log(`\nEng katta SKU: ${numericSkus[0] || 'topilmadi'}`);
    console.log(`Raqamli SKU lar soni: ${numericSkus.length}`);
    
    // 7. SKU siz mahsulotlar
    let noSkuCount = 0;
    allProducts.forEach((product: any) => {
      if (!product.sku || product.sku.trim() === '') {
        noSkuCount++;
      }
    });
    
    console.log(`SKU siz asosiy mahsulotlar: ${noSkuCount} ta`);
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
    console.log('\n✓ Database ulanishi yopildi');
  }
}

findAllDuplicates().catch(console.error);