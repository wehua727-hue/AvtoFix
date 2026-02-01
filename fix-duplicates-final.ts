import { MongoClient, ObjectId } from 'mongodb';

async function fixDuplicatesFinal() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ MongoDB ga ulandi');
    
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== DUPLICATE LARNI TUZATISH ===');
    
    // 1. SKU 587 duplicate ini tuzatish
    console.log('\n--- SKU 587 duplicate ini tuzatish ---');
    
    // Ikkinchi mahsulotning variantini yangilash (SKU 1813 berish)
    const result = await collection.updateOne(
      { 
        _id: new ObjectId('6979f8eea51607251f1e8588'),
        'variantSummaries.sku': '587'
      },
      { 
        $set: { 'variantSummaries.$.sku': '1813' }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ SKU 587 duplicate tuzatildi, yangi SKU: 1813');
    } else {
      console.log('❌ SKU 587 duplicate tuzatilmadi');
    }
    
    // 2. Tekshirish
    console.log('\n=== YAKUNIY TEKSHIRUV ===');
    
    // Barcha SKU larni qayta yig'ish
    const allProducts = await collection.find({ userId: userId }).toArray();
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
    
    // Duplicate larni tekshirish
    const duplicates = [];
    skuMap.forEach((items, sku) => {
      if (items.length > 1) {
        duplicates.push({ sku, items });
      }
    });
    
    if (duplicates.length === 0) {
      console.log('✅ Duplicate SKU lar yo\'q');
    } else {
      console.log(`❌ Hali ham ${duplicates.length} ta duplicate bor`);
    }
    
    // SKU 1813 ni tekshirish
    const sku1813Items = skuMap.get('1813');
    if (sku1813Items && sku1813Items.length > 0) {
      console.log('✅ SKU 1813 topildi!');
      sku1813Items.forEach((item: any) => {
        if (item.type === 'ASOSIY') {
          console.log(`   [ASOSIY] "${item.productName}"`);
        } else {
          console.log(`   [VARIANT] "${item.productName}" > "${item.variantName}"`);
        }
      });
    } else {
      console.log('❌ SKU 1813 hali ham yo\'q');
    }
    
    // Eng katta SKU
    const numericSkus = Array.from(skuMap.keys())
      .map(sku => parseInt(sku))
      .filter(sku => !isNaN(sku))
      .sort((a, b) => b - a);
    
    console.log(`Eng katta SKU: ${numericSkus[0] || 'topilmadi'}`);
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
    console.log('\n✓ Database ulanishi yopildi');
  }
}

fixDuplicatesFinal().catch(console.error);